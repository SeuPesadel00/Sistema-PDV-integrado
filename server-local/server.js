import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from '@fastify/rate-limit'

// ==========================================
// CONFIGURAÇÃO E SEGREDOS
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error('[FATAL] Variável de ambiente JWT_SECRET ausente ou fraca (mínimo 16 caracteres). Servidor não iniciado.')
  process.exit(1)
}

const { Pool } = pg

const fastify = Fastify({ logger: true, bodyLimit: 512 * 1024, trustProxy: true })

// Limite global (anti-abuso) + limite rígido na rota de login
await fastify.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute' })

// API usa token Bearer (não cookies), então CORS aberto não expõe a sessão a CSRF.
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})

// Cabeçalhos de segurança em todas as respostas
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('X-Frame-Options', 'DENY')
  reply.header('Referrer-Policy', 'no-referrer')
  reply.header('Cache-Control', 'no-store')
  return payload
})

// Configuração da conexão com o Banco de Dados (Supabase/Local)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      user: process.env.PGUSER || 'postgres',
      host: process.env.PGHOST || '127.0.0.1',
      database: process.env.PGDATABASE || 'Tailandia_db',
      password: process.env.PGPASSWORD,
      port: Number(process.env.PGPORT) || 6666,
    })

// Força UTF-8 em toda nova conexão (resolve incompatibilidade WIN1252 no Windows)
pool.on('connect', (client) => {
  client.query("SET client_encoding = 'UTF8'")
})

// ==========================================
// UTILITÁRIOS FINANCEIROS (sempre em centavos para não haver erro de arredondamento)
// ==========================================
const FORMAS = ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'POS']
const cents = (v) => Math.round(Number(v || 0) * 100)
const reais = (c) => Math.round(c) / 100
const zeroFormas = () => Object.fromEntries(FORMAS.map(f => [f, 0]))
const TZ = 'America/Sao_Paulo'

function normMetodo(m) {
  const s = String(m || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  if (s.includes('DINHEIRO')) return 'DINHEIRO'
  if (s.includes('PIX')) return 'PIX'
  if (s.includes('CRED')) return 'CARTAO_CREDITO'
  if (s.includes('DEB')) return 'CARTAO_DEBITO'
  if (s.includes('POS') || s.includes('MAQUININHA')) return 'POS'
  return null
}

// Lista de pagamentos de uma venda. Vendas antigas (sem JSON) usam o texto legado.
function pagamentosDaVenda(v) {
  if (Array.isArray(v.pagamentos) && v.pagamentos.length > 0) {
    return v.pagamentos.map(p => ({ metodo: normMetodo(p.metodo) || 'OUTROS', valor: cents(p.valor) }))
  }
  const partes = String(v.metodo_pagamento || '').split(',').map(s => s.trim()).filter(Boolean)
  const unico = partes.length === 1 ? normMetodo(partes[0]) : null
  return [{ metodo: unico || 'OUTROS', valor: cents(v.total) }]
}

// Quanto efetivamente ficou com a loja em cada forma (troco sai do dinheiro)
function liquidoPorForma(v) {
  const out = {}
  for (const p of pagamentosDaVenda(v)) out[p.metodo] = (out[p.metodo] || 0) + p.valor
  const troco = cents(v.troco)
  if (troco > 0) out.DINHEIRO = (out.DINHEIRO || 0) - troco
  return out
}

const chaveData = (d, agrupar) => {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d))
  if (agrupar === 'ano') return iso.slice(0, 4)
  if (agrupar === 'mes') return iso.slice(0, 7)
  return iso
}

const TERMINAL_RE = /^[A-Za-z0-9_-]{1,10}$/
const terminalValido = (t) => (typeof t === 'string' && TERMINAL_RE.test(t)) ? t : '01'
const idValido = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }
const texto = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ==========================================
// AUTO-MIGRAÇÃO DO SCHEMA
// Roda a cada inicialização. Todos os comandos são idempotentes.
// ==========================================
const TIPOS_ENTRADA = ['SALDO_INICIAL', 'ENTRADA_CADASTRO', 'ENTRADA_REPOSICAO']

async function garantirSchema() {
  const client = await pool.connect()
    await client.query('ALTER TABLE produtos ALTER COLUMN ean TYPE VARCHAR(50)')
    await client.query('ALTER TABLE produtos ALTER COLUMN nome TYPE VARCHAR(255)')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100)')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS descricao TEXT')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true')
    await client.query('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS wp_id INTEGER')

    await client.query('ALTER TABLE vendas_itens ALTER COLUMN produto_ean TYPE VARCHAR(50)')
    await client.query('ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(255)')
    await client.query('ALTER TABLE vendas_itens ALTER COLUMN produto_nome TYPE VARCHAR(255)')
    await client.query('ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2)')

    // Status e rastreabilidade de cancelamentos/estornos
    await client.query("ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'CONCLUIDA'")
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS estorno_info JSONB')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cancelado_por INTEGER')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS origem_cancelamento VARCHAR(20)')
    // Financeiro / caixa
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS pagamentos JSONB')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS troco NUMERIC(10, 2) DEFAULT 0')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS caixa_id INTEGER')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS funcionario_id INTEGER')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS operador_nome VARCHAR(100)')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS num_nfe INTEGER')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS protocolo_nfe VARCHAR(50)')
    await client.query('ALTER TABLE vendas ADD COLUMN IF NOT EXISTS chave_nfe VARCHAR(44)')

    await client.query(`
      CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
        id SERIAL PRIMARY KEY,
        produto_id INTEGER,
        produto_ean VARCHAR(50) NOT NULL,
        produto_nome VARCHAR(255),
        tipo VARCHAR(30) NOT NULL,
        quantidade INTEGER NOT NULL,
        custo_unitario NUMERIC(10, 2) DEFAULT 0,
        valor_total NUMERIC(12, 2) DEFAULT 0,
        venda_id INTEGER,
        usuario_id INTEGER,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('ALTER TABLE movimentacoes_estoque ALTER COLUMN produto_ean TYPE VARCHAR(50)')
    await client.query('ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(255)')
    await client.query('ALTER TABLE movimentacoes_estoque ALTER COLUMN produto_nome TYPE VARCHAR(255)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_mov_ean ON movimentacoes_estoque (produto_ean)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_vi_ean ON vendas_itens (produto_ean)')

    // Caixas (turnos de operação de um terminal PDV)
    await client.query(`
      CREATE TABLE IF NOT EXISTS caixas (
        id SERIAL PRIMARY KEY,
        terminal VARCHAR(10) NOT NULL DEFAULT '01',
        status VARCHAR(10) NOT NULL DEFAULT 'ABERTO',
        aberto_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        aberto_por INTEGER,
        operador_nome VARCHAR(100),
        valor_abertura NUMERIC(12, 2) NOT NULL DEFAULT 0,
        fechado_em TIMESTAMP,
        fechado_por INTEGER,
        fechado_por_nome VARCHAR(100),
        resumo JSONB,
        contado JSONB,
        diferenca NUMERIC(12, 2),
        observacoes TEXT
      )
    `)
    // Garante no máximo UM caixa aberto por terminal
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_aberto_terminal ON caixas (terminal) WHERE status = 'ABERTO'")
    await client.query(`
      CREATE TABLE IF NOT EXISTS caixa_movimentos (
        id SERIAL PRIMARY KEY,
        caixa_id INTEGER NOT NULL REFERENCES caixas(id),
        tipo VARCHAR(20) NOT NULL,
        metodo VARCHAR(20) NOT NULL DEFAULT 'DINHEIRO',
        valor NUMERIC(12, 2) NOT NULL,
        motivo TEXT,
        venda_id INTEGER,
        usuario_id INTEGER,
        usuario_nome VARCHAR(100),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas (caixa_id)')

    // Saldo inicial (uma única vez por produto)
    await client.query(`
      INSERT INTO movimentacoes_estoque (produto_id, produto_ean, produto_nome, tipo, quantidade, custo_unitario, valor_total)
      SELECT p.id, p.ean, p.nome, 'SALDO_INICIAL',
             (p.estoque_atual + COALESCE(s.qtd, 0))::int,
             COALESCE(p.preco_custo, 0),
             (p.estoque_atual + COALESCE(s.qtd, 0)) * COALESCE(p.preco_custo, 0)
      FROM produtos p
      LEFT JOIN (SELECT produto_ean, SUM(quantidade) AS qtd FROM vendas_itens GROUP BY produto_ean) s ON s.produto_ean = p.ean
      WHERE NOT EXISTS (SELECT 1 FROM movimentacoes_estoque m WHERE m.produto_ean = p.ean)
    `)
    console.log('[SCHEMA] Tabelas de vendas, estoque e caixa verificadas.')
  } catch (e) {
    console.error('[SCHEMA] Falha na auto-migração:', e.message)
  } finally {
    client.release()
  }
}

async function registrarMovimentacao(db, { produto_id, ean, nome, tipo, quantidade, custo, venda_id = null, usuario_id = null }) {
  const custoUnit = Number(custo) || 0
  await db.query(
    `INSERT INTO movimentacoes_estoque (produto_id, produto_ean, produto_nome, tipo, quantidade, custo_unitario, valor_total, venda_id, usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [produto_id, ean, nome, tipo, quantidade, custoUnit, quantidade * custoUnit, venda_id, usuario_id]
  )
}

async function auditar(db, { venda_id = null, status, mensagem, retorno = 'Auditoria interna' }) {
  await db.query(
    'INSERT INTO notas_fiscais_logs (venda_id, status, mensagem, retorno_sefaz) VALUES ($1, $2, $3, $4)',
    [venda_id, status, mensagem, retorno]
  )
}

// ==========================================
// MIDDLEWARE DE SEGURANÇA (JWT + verificação do funcionário no banco)
// ==========================================
fastify.addHook('onRequest', async (request, reply) => {
  if (request.method === 'OPTIONS') return
  const path = request.url.split('?')[0]
  if (path === '/auth' && request.method === 'POST') return

  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Acesso Negado: Token JWT ausente.' })
  }

  let decoded
  try {
    decoded = jwt.verify(authHeader.slice(7), JWT_SECRET, { algorithms: ['HS256'] })
  } catch {
    return reply.status(401).send({ error: 'Acesso Negado: Token inválido ou expirado.' })
  }

  // Revalida no banco: funcionário excluído, desativado ou rebaixado perde o acesso na hora
  try {
    const { rows } = await pool.query('SELECT id, nome, nivel_acesso, status FROM funcionarios WHERE id = $1', [decoded.id])
    const func = rows[0]
    if (!func || func.status !== 'ATIVO') {
      return reply.status(401).send({ error: 'Acesso Negado: Usuário inativo ou removido.' })
    }
    request.user = { id: func.id, nome: func.nome, nivel: func.nivel_acesso }
  } catch (e) {
    request.log.error(e)
    return reply.status(503).send({ error: 'Serviço temporariamente indisponível.' })
  }

  if (path.toLowerCase().startsWith('/admin') && request.user.nivel !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso Negado: Apenas Administradores podem acessar.' })
  }
})

// Erros não tratados: nunca vazar detalhes internos para o cliente
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error)
  if (error.validation || error.statusCode === 400) return reply.status(400).send({ error: 'Requisição inválida.' })
  if (error.statusCode === 429) return reply.status(429).send({ error: 'Muitas requisições. Aguarde alguns instantes.' })
  return reply.status(500).send({ error: 'Erro interno no servidor.' })
})

// ==========================================
// ROTAS DE ADMINISTRAÇÃO (BACKOFFICE)
// ==========================================

// ---------- PRODUTOS ----------
fastify.get('/admin/produtos', async (request, reply) => {
  const { rows } = await pool.query('SELECT * FROM produtos ORDER BY id DESC')
  return rows
})

fastify.post('/admin/produtos', async (request, reply) => {
  const { ean, nome, preco_custo, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao } = request.body || {}
  const eanS = texto(ean, 50), nomeS = texto(nome, 255)
  const catS = texto(categoria, 100) || 'Diversos', subS = texto(subcategoria, 100) || ''
  const imgS = texto(imagem_url, 1000) || '', descS = texto(descricao, 2000) || ''
  const custo = preco_custo !== undefined && preco_custo !== null && preco_custo !== '' ? Number(preco_custo) : 0
  const venda = Number(preco_venda)
  const estoque = estoque_atual !== undefined && estoque_atual !== null && estoque_atual !== '' ? Number(estoque_atual) : 0
  if (!eanS || !nomeS || !Number.isFinite(venda) || venda < 0 || !Number.isFinite(custo) || custo < 0 || !Number.isInteger(estoque) || estoque < 0) {
    return reply.status(400).send({ error: 'Dados do produto inválidos.' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO produtos (ean, nome, preco_custo, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [eanS, nomeS, custo, venda, estoque, catS, subS, imgS, descS]
    )
    await registrarMovimentacao(client, {
      produto_id: rows[0].id, ean: eanS, nome: nomeS, tipo: 'ENTRADA_CADASTRO',
      quantidade: estoque, custo, usuario_id: request.user.id
    })
    await client.query('COMMIT')
    return rows[0]
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    request.log.error(e)
    if (e.code === '23505') return reply.status(409).send({ error: 'Já existe um produto com este código de barras (EAN).' })
    return reply.status(500).send({ error: 'Erro ao cadastrar produto.' })
  } finally {
    client.release()
  }
})

// Editar Produto (mudança de estoque aqui = reposição/ajuste manual, registrada no livro)
fastify.put('/admin/produtos/:id', async (request, reply) => {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID inválido.' })
  const { ean, nome, preco_custo, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao } = request.body || {}
  const eanS = texto(ean, 50), nomeS = texto(nome, 255)
  const catS = texto(categoria, 100), subS = texto(subcategoria, 100)
  const imgS = texto(imagem_url, 1000), descS = texto(descricao, 2000)
  const custo = preco_custo !== undefined && preco_custo !== null && preco_custo !== '' ? Number(preco_custo) : 0
  const venda = Number(preco_venda)
  const estoque = estoque_atual !== undefined && estoque_atual !== null && estoque_atual !== '' ? Number(estoque_atual) : 0
  if (!eanS || !nomeS || !Number.isFinite(venda) || venda < 0 || !Number.isFinite(custo) || custo < 0 || !Number.isInteger(estoque) || estoque < 0) {
    return reply.status(400).send({ error: 'Dados do produto inválidos.' })
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const atual = await client.query('SELECT estoque_atual FROM produtos WHERE id=$1 FOR UPDATE', [id])
    if (atual.rows.length === 0) {
      await client.query('ROLLBACK')
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }
    await client.query(
      `UPDATE produtos SET 
        ean=$1, nome=$2, preco_custo=$3, preco_venda=$4, estoque_atual=$5,
        categoria=COALESCE(NULLIF($6, ''), categoria),
        subcategoria=COALESCE(NULLIF($7, ''), subcategoria),
        imagem_url=COALESCE(NULLIF($8, ''), imagem_url),
        descricao=COALESCE(NULLIF($9, ''), descricao)
       WHERE id=$10`,
      [eanS, nomeS, custo, venda, estoque, catS, subS, imgS, descS, id]
    )
    const diff = estoque - Number(atual.rows[0].estoque_atual)
    if (diff !== 0) {
      await registrarMovimentacao(client, {
        produto_id: id, ean: eanS, nome: nomeS,
        tipo: diff > 0 ? 'ENTRADA_REPOSICAO' : 'AJUSTE_SAIDA',
        quantidade: Math.abs(diff), custo, usuario_id: request.user.id
      })
    }
    await client.query('COMMIT')
    return { sucesso: true }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    request.log.error(e)
    if (e.code === '23505') return reply.status(409).send({ error: 'Já existe um produto com este código de barras (EAN).' })
    return reply.status(500).send({ error: 'Erro ao editar produto.' })
  } finally {
    client.release()
  }
})

fastify.delete('/admin/produtos/:id', async (request, reply) => {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID inválido.' })
  await pool.query('DELETE FROM produtos WHERE id=$1', [id])
  return { sucesso: true }
})

// ---------- FUNCIONÁRIOS ----------
const NIVEIS = ['ADMIN', 'CAIXA', 'GERENTE']

fastify.get('/admin/funcionarios', async () => {
  const { rows } = await pool.query('SELECT id, matricula, nome, cpf, endereco, data_nascimento, desconto_funcionario, nivel_acesso, status FROM funcionarios ORDER BY id DESC')
  return rows
})

fastify.post('/admin/funcionarios', async (request, reply) => {
  const { matricula, senha, cpf, nome, endereco, data_nascimento, desconto_funcionario, nivel_acesso } = request.body || {}
  if (!texto(matricula, 5) || typeof senha !== 'string' || senha.trim().length < 4 || !texto(nome, 100) || !texto(cpf, 14)) {
    return reply.status(400).send({ error: 'Preencha matrícula, nome, CPF e uma senha com pelo menos 4 caracteres.' })
  }
  const nivel = NIVEIS.includes(nivel_acesso) ? nivel_acesso : 'CAIXA'
  try {
    const hashSenha = bcrypt.hashSync(senha.trim(), 10)
    const { rows } = await pool.query(
      'INSERT INTO funcionarios (matricula, senha, cpf, nome, endereco, data_nascimento, desconto_funcionario, nivel_acesso) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, matricula, nome, cpf, nivel_acesso, status',
      [texto(matricula, 5), hashSenha, texto(cpf, 14), texto(nome, 100), texto(endereco, 300), data_nascimento || null, Number(desconto_funcionario) || 0, nivel]
    )
    return rows[0]
  } catch (e) {
    request.log.error(e)
    return reply.status(409).send({ error: 'Erro ao cadastrar. Verifique se matrícula ou CPF já existem.' })
  }
})

fastify.put('/admin/funcionarios/:id', async (request, reply) => {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID inválido.' })
  const { matricula, nome, cpf, endereco, data_nascimento, desconto_funcionario, nivel_acesso, status, senha } = request.body || {}
  const nivel = NIVEIS.includes(nivel_acesso) ? nivel_acesso : 'CAIXA'
  const st = status === 'INATIVO' ? 'INATIVO' : 'ATIVO'
  // Impede que o administrador se rebaixe/desative e fique trancado fora do sistema
  if (id === request.user.id && (nivel !== 'ADMIN' || st !== 'ATIVO')) {
    return reply.status(400).send({ error: 'Você não pode remover seu próprio acesso de administrador.' })
  }
  try {
    await pool.query(
      'UPDATE funcionarios SET matricula=$1, nome=$2, cpf=$3, endereco=$4, data_nascimento=$5, desconto_funcionario=$6, nivel_acesso=$7, status=$8 WHERE id=$9',
      [texto(matricula, 5), texto(nome, 100), texto(cpf, 14), texto(endereco, 300), data_nascimento || null, Number(desconto_funcionario) || 0, nivel, st, id]
    )
    if (typeof senha === 'string' && senha.trim()) {
      if (senha.trim().length < 4) return reply.status(400).send({ error: 'A nova senha deve ter pelo menos 4 caracteres.' })
      await pool.query('UPDATE funcionarios SET senha=$1 WHERE id=$2', [bcrypt.hashSync(senha.trim(), 10), id])
    }
    return { sucesso: true }
  } catch (e) {
    request.log.error(e)
    return reply.status(409).send({ error: 'Erro ao editar funcionário. Verifique se matrícula ou CPF já existem.' })
  }
})

fastify.delete('/admin/funcionarios/:id', async (request, reply) => {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID inválido.' })
  if (id === request.user.id) return reply.status(400).send({ error: 'Você não pode excluir o próprio usuário.' })
  const { rows } = await pool.query('SELECT matricula, nome, cpf FROM funcionarios WHERE id=$1', [id])
  if (rows.length === 0) return reply.status(404).send({ error: 'Funcionário não encontrado' })
  const func = rows[0]
  await auditar(pool, {
    status: 'EXCLUSAO_FUNCIONARIO',
    mensagem: `Exclusão de funcionário: ${func.nome} (Matrícula: ${func.matricula}). Excluído por ${request.user.nome}. Histórico de vendas, caixas e estoque preservados.`
  })
  await pool.query('DELETE FROM funcionarios WHERE id=$1', [id])
  return { sucesso: true, mensagem: `Funcionário ${func.nome} excluído com sucesso.` }
})

// ---------- VENDAS (CONSULTA) ----------
const SQL_VENDAS = `
  SELECT v.id, v.total, v.metodo_pagamento, v.cpf_cnpj_cliente, v.criado_em,
         COALESCE(v.status, 'CONCLUIDA') AS status,
         v.motivo_cancelamento, v.estorno_info, v.cancelado_em, v.origem_cancelamento,
         v.status_nfe, v.chave_nfe, v.num_nfe, v.protocolo_nfe,
         v.pagamentos, COALESCE(v.troco, 0) AS troco, v.caixa_id, v.operador_nome,
         COALESCE(
           json_agg(json_build_object(
             'ean', vi.produto_ean,
             'nome', COALESCE(vi.produto_nome, p.nome, 'Produto removido'),
             'quantidade', vi.quantidade,
             'preco', vi.preco_unitario,
             'custo', COALESCE(vi.preco_custo, p.preco_custo, 0),
             'subtotal', vi.quantidade * vi.preco_unitario
           ) ORDER BY vi.id) FILTER (WHERE vi.id IS NOT NULL),
           '[]'::json
         ) AS itens
  FROM vendas v
  LEFT JOIN vendas_itens vi ON vi.venda_id = v.id
  LEFT JOIN produtos p ON p.ean = vi.produto_ean
`

fastify.get('/admin/vendas', async () => {
  const { rows } = await pool.query(`${SQL_VENDAS} GROUP BY v.id ORDER BY v.criado_em DESC`)
  return rows
})

// ---------- CANCELAMENTO / ESTORNO (única via de devolução ao estoque) ----------
// Toda reversão acontece numa transação com a venda travada (FOR UPDATE).
// Se a venda já não estiver CONCLUIDA, a operação é recusada: impossível devolver estoque duas vezes.
const PRAZO_PDV_MIN = 30

async function reverterVenda(request, reply, novoStatus) {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID de venda inválido.' })
  const body = request.body || {}
  const motivo = texto(body.motivo) || (novoStatus === 'CANCELADA' ? 'Cancelamento solicitado pelo estabelecimento' : 'Estorno financeiro efetuado')
  const origem = body.origem === 'PDV' ? 'PDV' : 'BACKOFFICE'
  const terminal = terminalValido(body.terminal)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resVenda = await client.query(
      `SELECT *, EXTRACT(EPOCH FROM (LOCALTIMESTAMP - criado_em)) / 60 AS idade_min FROM vendas WHERE id = $1 FOR UPDATE`, [id]
    )
    if (resVenda.rows.length === 0) {
      await client.query('ROLLBACK')
      return reply.status(404).send({ error: 'Venda não encontrada.' })
    }
    const venda = resVenda.rows[0]
    const statusAtual = venda.status || 'CONCLUIDA'
    if (statusAtual !== 'CONCLUIDA') {
      await client.query('ROLLBACK')
      return reply.status(409).send({ error: `Esta venda já está ${statusAtual.toLowerCase()}. Nenhuma alteração foi feita no estoque.` })
    }
    if (origem === 'PDV' && Number(venda.idade_min) > PRAZO_PDV_MIN) {
      await client.query('ROLLBACK')
      return reply.status(403).send({ error: `Prazo de ${PRAZO_PDV_MIN} minutos para cancelar no PDV expirado. Faça pelo Backoffice.` })
    }

    // 1. Devolve cada item ao estoque (exatamente a quantidade vendida)
    const resItens = await client.query('SELECT * FROM vendas_itens WHERE venda_id = $1', [id])
    for (const item of resItens.rows) {
      const upd = await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual + $1 WHERE ean = $2 RETURNING id',
        [item.quantidade, item.produto_ean]
      )
      await registrarMovimentacao(client, {
        produto_id: upd.rows[0]?.id || null,
        ean: item.produto_ean,
        nome: item.produto_nome,
        tipo: novoStatus === 'CANCELADA' ? 'CANCELAMENTO_VENDA' : 'ESTORNO_VENDA',
        quantidade: Number(item.quantidade),
        custo: Number(item.preco_custo || 0),
        venda_id: id,
        usuario_id: request.user.id
      })
    }

    // 2. Marca a venda
    const estornoInfo = novoStatus === 'ESTORNADA'
      ? JSON.stringify({
          motivo, forma_devolucao: texto(body.forma_devolucao, 30), nsu_comprovante: texto(body.nsu_comprovante, 60),
          observacoes: texto(body.observacoes), data: new Date().toISOString(), por: request.user.nome
        })
      : null
    await client.query(
      `UPDATE vendas SET status = $1, motivo_cancelamento = $2, status_nfe = 'CANCELADA',
              estorno_info = COALESCE($3::jsonb, estorno_info), cancelado_em = LOCALTIMESTAMP,
              cancelado_por = $4, origem_cancelamento = $5
       WHERE id = $6`,
      [novoStatus, motivo, estornoInfo, request.user.id, origem, id]
    )

    // 3. Reflexo no caixa:
    //    - Venda de um caixa ainda ABERTO: ela simplesmente deixa de contar no fechamento (nada a lançar).
    //    - Venda de um caixa já FECHADO, revertida no PDV com outro caixa aberto: o dinheiro devolvido sai da gaveta atual.
    let caixaAfetado = null
    if (origem === 'PDV') {
      const cx = await client.query("SELECT id FROM caixas WHERE terminal = $1 AND status = 'ABERTO'", [terminal])
      const caixaAtual = cx.rows[0]
      if (caixaAtual && venda.caixa_id !== caixaAtual.id) {
        const liquido = liquidoPorForma(venda)
        for (const [metodo, valorC] of Object.entries(liquido)) {
          if (valorC <= 0) continue
          await client.query(
            `INSERT INTO caixa_movimentos (caixa_id, tipo, metodo, valor, motivo, venda_id, usuario_id, usuario_nome)
             VALUES ($1, 'DEVOLUCAO', $2, $3, $4, $5, $6, $7)`,
            [caixaAtual.id, metodo, reais(valorC), `Devolução da venda #${id}: ${motivo}`, id, request.user.id, request.user.nome]
          )
        }
        caixaAfetado = caixaAtual.id
      }
    }

    await auditar(client, {
      venda_id: id,
      status: novoStatus === 'CANCELADA' ? 'VENDA_CANCELADA' : 'VENDA_ESTORNADA',
      mensagem: `${novoStatus === 'CANCELADA' ? 'Cancelamento' : 'Estorno'} da venda #${id} via ${origem} por ${request.user.nome}. Motivo: ${motivo}`,
      retorno: 'Estoque devolvido'
    })

    await client.query('COMMIT')
    return {
      sucesso: true,
      status: novoStatus,
      caixa_afetado: caixaAfetado,
      mensagem: `Venda #${id} ${novoStatus === 'CANCELADA' ? 'cancelada' : 'estornada'}. Estoque devolvido.`
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    request.log.error(e)
    return reply.status(500).send({ error: 'Erro ao reverter a venda. Nenhuma alteração foi aplicada.' })
  } finally {
    client.release()
  }
}

fastify.post('/admin/vendas/:id/cancelar', (request, reply) => reverterVenda(request, reply, 'CANCELADA'))
fastify.post('/admin/vendas/:id/estornar', (request, reply) => reverterVenda(request, reply, 'ESTORNADA'))

// ---------- MÉTRICAS ----------
fastify.get('/admin/metricas/produtos', async (request) => {
  const dias = request.query?.dias ? parseInt(request.query.dias, 10) : null
  const { rows } = await pool.query(`
    WITH vendidos AS (
      SELECT vi.produto_ean AS ean,
             MAX(COALESCE(vi.produto_nome, p.nome)) AS nome,
             SUM(vi.quantidade)::int AS qtd_vendida,
             SUM(vi.quantidade * vi.preco_unitario) AS receita,
             SUM(vi.quantidade * COALESCE(vi.preco_custo, p.preco_custo, 0)) AS custo_vendido,
             COUNT(DISTINCT vi.venda_id)::int AS num_vendas,
             MAX(v.criado_em) AS ultima_venda
      FROM vendas_itens vi
      JOIN vendas v ON v.id = vi.venda_id
      LEFT JOIN produtos p ON p.ean = vi.produto_ean
      WHERE ($1::int IS NULL OR v.criado_em >= NOW() - make_interval(days => $1::int))
        AND COALESCE(v.status, 'CONCLUIDA') = 'CONCLUIDA'
      GROUP BY vi.produto_ean
    ),
    entradas AS (
      SELECT produto_ean AS ean,
             MAX(produto_nome) AS nome,
             SUM(quantidade)::int AS qtd_entrada,
             SUM(valor_total) AS valor_investido
      FROM movimentacoes_estoque
      WHERE tipo = ANY($2::text[])
        AND ($1::int IS NULL OR criado_em >= NOW() - make_interval(days => $1::int))
      GROUP BY produto_ean
    ),
    chaves AS (
      SELECT ean FROM produtos UNION SELECT ean FROM vendidos UNION SELECT ean FROM entradas
    )
    SELECT c.ean,
           COALESCE(p.nome, vd.nome, e.nome, 'Produto removido') AS nome,
           p.estoque_atual, p.preco_custo, p.preco_venda,
           COALESCE(vd.qtd_vendida, 0) AS qtd_vendida,
           COALESCE(vd.receita, 0) AS receita,
           COALESCE(vd.custo_vendido, 0) AS custo_vendido,
           COALESCE(vd.receita, 0) - COALESCE(vd.custo_vendido, 0) AS lucro,
           COALESCE(vd.num_vendas, 0) AS num_vendas,
           vd.ultima_venda,
           COALESCE(e.qtd_entrada, 0) AS qtd_entrada,
           COALESCE(e.valor_investido, 0) AS valor_investido
    FROM chaves c
    LEFT JOIN produtos p ON p.ean = c.ean
    LEFT JOIN vendidos vd ON vd.ean = c.ean
    LEFT JOIN entradas e ON e.ean = c.ean
    ORDER BY qtd_vendida DESC, receita DESC, nome ASC
  `, [Number.isFinite(dias) ? dias : null, TIPOS_ENTRADA])
  return rows
})

fastify.get('/admin/movimentacoes', async () => {
  const { rows } = await pool.query('SELECT * FROM movimentacoes_estoque ORDER BY criado_em DESC, id DESC LIMIT 300')
  return rows
})

// ==========================================
// CAIXA (FRENTE DE LOJA)
// ==========================================

// Calcula, a partir do banco, tudo o que deveria existir no caixa
async function calcularResumoCaixa(db, caixa) {
  const { rows: vendas } = await db.query(
    `SELECT id, total, troco, pagamentos, metodo_pagamento, COALESCE(status, 'CONCLUIDA') AS status, criado_em, cancelado_em
     FROM vendas WHERE caixa_id = $1 ORDER BY id`, [caixa.id]
  )
  const { rows: movs } = await db.query('SELECT * FROM caixa_movimentos WHERE caixa_id = $1 ORDER BY id', [caixa.id])

  const recebido = zeroFormas()
  const devolucoes = zeroFormas()
  let vendasQtd = 0, vendasTotal = 0, trocoTotal = 0, cancQtd = 0, cancTotal = 0, outros = 0
  const canceladas = []

  for (const v of vendas) {
    if (v.status === 'CONCLUIDA') {
      vendasQtd++
      vendasTotal += cents(v.total)
      trocoTotal += cents(v.troco)
      for (const p of pagamentosDaVenda(v)) {
        if (recebido[p.metodo] !== undefined) recebido[p.metodo] += p.valor
        else outros += p.valor
      }
    } else {
      cancQtd++
      cancTotal += cents(v.total)
      canceladas.push({ id: v.id, total: Number(v.total), status: v.status, cancelado_em: v.cancelado_em })
    }
  }

  let sangrias = 0, suprimentos = 0
  for (const m of movs) {
    if (m.tipo === 'SANGRIA') sangrias += cents(m.valor)
    else if (m.tipo === 'SUPRIMENTO') suprimentos += cents(m.valor)
    else if (m.tipo === 'DEVOLUCAO' && devolucoes[m.metodo] !== undefined) devolucoes[m.metodo] += cents(m.valor)
  }

  const abertura = cents(caixa.valor_abertura)
  const esperado = zeroFormas()
  for (const f of FORMAS) esperado[f] = recebido[f] - devolucoes[f]
  esperado.DINHEIRO += abertura + suprimentos - sangrias - trocoTotal
  const totalEsperado = FORMAS.reduce((s, f) => s + esperado[f], 0)

  const toReais = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, reais(v)]))
  return {
    valor_abertura: reais(abertura),
    vendas: { quantidade: vendasQtd, total: reais(vendasTotal) },
    canceladas: { quantidade: cancQtd, total: reais(cancTotal), lista: canceladas },
    recebido: toReais(recebido),
    outros: reais(outros),
    troco: reais(trocoTotal),
    sangrias: reais(sangrias),
    suprimentos: reais(suprimentos),
    devolucoes: toReais(devolucoes),
    esperado: toReais(esperado),
    total_esperado: reais(totalEsperado),
    movimentos: movs.map(m => ({ id: m.id, tipo: m.tipo, metodo: m.metodo, valor: Number(m.valor), motivo: m.motivo, usuario_nome: m.usuario_nome, venda_id: m.venda_id, criado_em: m.criado_em }))
  }
}

async function caixaAberto(db, terminal, lock = false) {
  const { rows } = await db.query(
    `SELECT * FROM caixas WHERE terminal = $1 AND status = 'ABERTO' ${lock ? 'FOR UPDATE' : ''}`, [terminal]
  )
  return rows[0] || null
}

// Caixa aberto do terminal (com resumo ao vivo)
fastify.get('/caixa/atual', async (request) => {
  const terminal = terminalValido(request.query?.terminal)
  const caixa = await caixaAberto(pool, terminal)
  if (!caixa) return { aberto: false, terminal }
  return { aberto: true, terminal, caixa, resumo: await calcularResumoCaixa(pool, caixa) }
})

fastify.post('/caixa/abrir', async (request, reply) => {
  const terminal = terminalValido(request.body?.terminal)
  const valor = Number(request.body?.valor_abertura)
  if (!Number.isFinite(valor) || valor < 0 || valor > 100000) {
    return reply.status(400).send({ error: 'Informe um valor de abertura (fundo de troco) válido.' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO caixas (terminal, aberto_por, operador_nome, valor_abertura) VALUES ($1, $2, $3, $4) RETURNING *`,
      [terminal, request.user.id, request.user.nome, reais(cents(valor))]
    )
    await auditar(pool, { status: 'CAIXA_ABERTO', mensagem: `Caixa #${rows[0].id} (terminal ${terminal}) aberto por ${request.user.nome} com fundo de R$ ${reais(cents(valor)).toFixed(2)}` })
    return { aberto: true, terminal, caixa: rows[0], resumo: await calcularResumoCaixa(pool, rows[0]) }
  } catch (e) {
    if (e.code === '23505') return reply.status(409).send({ error: 'Já existe um caixa aberto neste terminal.' })
    throw e
  }
})

// Sangria (retirada) ou Suprimento (reforço de troco)
fastify.post('/caixa/movimento', async (request, reply) => {
  const terminal = terminalValido(request.body?.terminal)
  const tipo = request.body?.tipo === 'SUPRIMENTO' ? 'SUPRIMENTO' : (request.body?.tipo === 'SANGRIA' ? 'SANGRIA' : null)
  const valor = Number(request.body?.valor)
  const motivo = texto(request.body?.motivo)
  if (!tipo) return reply.status(400).send({ error: 'Tipo de movimento inválido.' })
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100000) return reply.status(400).send({ error: 'Informe um valor maior que zero.' })
  if (tipo === 'SANGRIA' && !motivo) return reply.status(400).send({ error: 'Informe o motivo da sangria.' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const caixa = await caixaAberto(client, terminal, true)
    if (!caixa) { await client.query('ROLLBACK'); return reply.status(409).send({ error: 'Nenhum caixa aberto neste terminal.' }) }
    if (tipo === 'SANGRIA') {
      const resumo = await calcularResumoCaixa(client, caixa)
      if (cents(valor) > cents(resumo.esperado.DINHEIRO)) {
        await client.query('ROLLBACK')
        return reply.status(400).send({ error: `Sangria maior que o dinheiro em gaveta (R$ ${resumo.esperado.DINHEIRO.toFixed(2)}).` })
      }
    }
    await client.query(
      `INSERT INTO caixa_movimentos (caixa_id, tipo, metodo, valor, motivo, usuario_id, usuario_nome) VALUES ($1, $2, 'DINHEIRO', $3, $4, $5, $6)`,
      [caixa.id, tipo, reais(cents(valor)), motivo || null, request.user.id, request.user.nome]
    )
    await client.query('COMMIT')
    return { sucesso: true, resumo: await calcularResumoCaixa(pool, caixa) }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
})

// Fechamento: operador informa o que contou; o servidor calcula o esperado e a diferença
fastify.post('/caixa/fechar', async (request, reply) => {
  const terminal = terminalValido(request.body?.terminal)
  const contadoIn = request.body?.contado || {}
  const contado = zeroFormas()
  for (const f of FORMAS) {
    const v = contadoIn[f] === undefined || contadoIn[f] === '' ? 0 : Number(contadoIn[f])
    if (!Number.isFinite(v) || v < 0 || v > 10000000) return reply.status(400).send({ error: `Valor contado inválido em ${f}.` })
    contado[f] = cents(v)
  }
  const observacoes = texto(request.body?.observacoes, 1000)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const caixa = await caixaAberto(client, terminal, true)
    if (!caixa) { await client.query('ROLLBACK'); return reply.status(409).send({ error: 'Nenhum caixa aberto neste terminal.' }) }

    const resumo = await calcularResumoCaixa(client, caixa)
    const diferencas = {}
    let difTotal = 0, contadoTotal = 0
    for (const f of FORMAS) {
      const d = contado[f] - cents(resumo.esperado[f])
      diferencas[f] = reais(d)
      difTotal += d
      contadoTotal += contado[f]
    }
    const resumoFinal = { ...resumo, diferencas, total_contado: reais(contadoTotal), diferenca_total: reais(difTotal) }
    const contadoReais = Object.fromEntries(FORMAS.map(f => [f, reais(contado[f])]))

    const { rows } = await client.query(
      `UPDATE caixas SET status = 'FECHADO', fechado_em = LOCALTIMESTAMP, fechado_por = $1, fechado_por_nome = $2,
              resumo = $3, contado = $4, diferenca = $5, observacoes = $6
       WHERE id = $7 RETURNING *`,
      [request.user.id, request.user.nome, JSON.stringify(resumoFinal), JSON.stringify(contadoReais), reais(difTotal), observacoes || null, caixa.id]
    )
    await auditar(client, {
      status: 'CAIXA_FECHADO',
      mensagem: `Caixa #${caixa.id} (terminal ${terminal}) fechado por ${request.user.nome}. Esperado R$ ${resumo.total_esperado.toFixed(2)}, contado R$ ${reais(contadoTotal).toFixed(2)}, diferença R$ ${reais(difTotal).toFixed(2)}`
    })
    await client.query('COMMIT')
    return { sucesso: true, caixa: rows[0], resumo: resumoFinal }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
})

// ---------- CAIXAS / FINANCEIRO (BACKOFFICE) ----------
fastify.get('/admin/caixas', async (request) => {
  const limite = Math.min(Math.max(parseInt(request.query?.limite, 10) || 200, 1), 1000)
  const { rows } = await pool.query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM vendas v WHERE v.caixa_id = c.id AND COALESCE(v.status,'CONCLUIDA') = 'CONCLUIDA') AS vendas_qtd,
            (SELECT COALESCE(SUM(v.total),0) FROM vendas v WHERE v.caixa_id = c.id AND COALESCE(v.status,'CONCLUIDA') = 'CONCLUIDA') AS vendas_total_atual
     FROM caixas c ORDER BY c.aberto_em DESC LIMIT $1`, [limite]
  )
  return rows
})

fastify.get('/admin/caixas/:id', async (request, reply) => {
  const id = idValido(request.params.id)
  if (!id) return reply.status(400).send({ error: 'ID inválido.' })
  const { rows } = await pool.query('SELECT * FROM caixas WHERE id = $1', [id])
  const caixa = rows[0]
  if (!caixa) return reply.status(404).send({ error: 'Caixa não encontrado.' })
  const resumoAtual = await calcularResumoCaixa(pool, caixa)
  const { rows: vendas } = await pool.query(`${SQL_VENDAS} WHERE v.caixa_id = $1 GROUP BY v.id ORDER BY v.criado_em ASC`, [id])
  // Reversões feitas depois do fechamento (ex.: cancelamento pelo Backoffice dias depois)
  const posFechamento = caixa.fechado_em
    ? vendas.filter(v => v.cancelado_em && new Date(v.cancelado_em) > new Date(caixa.fechado_em))
        .map(v => ({ id: v.id, total: Number(v.total), status: v.status, cancelado_em: v.cancelado_em, motivo: v.motivo_cancelamento }))
    : []
  return { caixa, resumo: caixa.status === 'FECHADO' ? caixa.resumo : resumoAtual, resumo_atual: resumoAtual, vendas, reversoes_pos_fechamento: posFechamento }
})

// Consolidado financeiro por dia / mês / ano
fastify.get('/admin/financeiro/consolidado', async (request) => {
  const agrupar = ['dia', 'mes', 'ano'].includes(request.query?.agrupar) ? request.query.agrupar : 'dia'
  const reData = /^\d{4}-\d{2}-\d{2}$/
  const de = reData.test(request.query?.de || '') ? request.query.de : null
  const ate = reData.test(request.query?.ate || '') ? request.query.ate : null

  // Margem de 1 dia nas pontas por causa do fuso; o filtro exato é feito pela chave local
  const { rows: vendas } = await pool.query(
    `SELECT id, total, troco, pagamentos, metodo_pagamento, COALESCE(status,'CONCLUIDA') AS status, criado_em
     FROM vendas
     WHERE ($1::date IS NULL OR criado_em >= $1::date - INTERVAL '1 day')
       AND ($2::date IS NULL OR criado_em < $2::date + INTERVAL '2 day')`, [de, ate]
  )
  const { rows: caixas } = await pool.query(
    `SELECT id, terminal, fechado_em, diferenca, resumo FROM caixas
     WHERE status = 'FECHADO'
       AND ($1::date IS NULL OR fechado_em >= $1::date - INTERVAL '1 day')
       AND ($2::date IS NULL OR fechado_em < $2::date + INTERVAL '2 day')`, [de, ate]
  )

  const dentro = (d) => {
    const dia = chaveData(d, 'dia')
    return (!de || dia >= de) && (!ate || dia <= ate)
  }
  const grupos = new Map()
  const novo = (periodo) => ({
    periodo, vendas_qtd: 0, faturamento: 0, por_forma: { ...zeroFormas(), OUTROS: 0 },
    canceladas_qtd: 0, canceladas_valor: 0, caixas_fechados: 0, diferenca_caixas: 0, sangrias: 0, suprimentos: 0
  })
  const pegar = (k) => { if (!grupos.has(k)) grupos.set(k, novo(k)); return grupos.get(k) }

  for (const v of vendas) {
    if (!dentro(v.criado_em)) continue
    const g = pegar(chaveData(v.criado_em, agrupar))
    if (v.status === 'CONCLUIDA') {
      g.vendas_qtd++
      g.faturamento += cents(v.total)
      for (const [m, c] of Object.entries(liquidoPorForma(v))) {
        g.por_forma[g.por_forma[m] !== undefined ? m : 'OUTROS'] += c
      }
    } else {
      g.canceladas_qtd++
      g.canceladas_valor += cents(v.total)
    }
  }
  for (const c of caixas) {
    if (!dentro(c.fechado_em)) continue
    const g = pegar(chaveData(c.fechado_em, agrupar))
    g.caixas_fechados++
    g.diferenca_caixas += cents(c.diferenca)
    g.sangrias += cents(c.resumo?.sangrias)
    g.suprimentos += cents(c.resumo?.suprimentos)
  }

  const conv = (g) => ({
    ...g,
    faturamento: reais(g.faturamento),
    ticket_medio: g.vendas_qtd ? reais(g.faturamento / g.vendas_qtd) : 0,
    por_forma: Object.fromEntries(Object.entries(g.por_forma).map(([k, v]) => [k, reais(v)])),
    canceladas_valor: reais(g.canceladas_valor),
    diferenca_caixas: reais(g.diferenca_caixas),
    sangrias: reais(g.sangrias),
    suprimentos: reais(g.suprimentos)
  })
  const periodos = [...grupos.values()].sort((a, b) => b.periodo.localeCompare(a.periodo))
  const total = periodos.reduce((t, g) => {
    t.vendas_qtd += g.vendas_qtd; t.faturamento += g.faturamento; t.canceladas_qtd += g.canceladas_qtd
    t.canceladas_valor += g.canceladas_valor; t.caixas_fechados += g.caixas_fechados; t.diferenca_caixas += g.diferenca_caixas
    t.sangrias += g.sangrias; t.suprimentos += g.suprimentos
    for (const k of Object.keys(t.por_forma)) t.por_forma[k] += g.por_forma[k]
    return t
  }, novo('TOTAL'))
  return { agrupar, de, ate, periodos: periodos.map(conv), total: conv(total) }
})

// ==========================================
// ROTAS DA FRENTE DE CAIXA (PDV)
// ==========================================
const DUMMY_HASH = bcrypt.hashSync('senha-inexistente-para-tempo-constante', 10)

fastify.post('/auth', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
}, async (request, reply) => {
  const { matricula, senha } = request.body || {}
  if (typeof matricula !== 'string' || typeof senha !== 'string' || !matricula.trim() || !senha || matricula.length > 10 || senha.length > 200) {
    return reply.status(400).send({ error: 'Informe matrícula e senha.' })
  }
  const { rows } = await pool.query('SELECT * FROM funcionarios WHERE matricula = $1', [matricula.trim()])
  const func = rows[0]
  // Compara mesmo quando a matrícula não existe: mesma resposta e mesmo tempo (evita descobrir matrículas)
  const ok = bcrypt.compareSync(senha, func ? func.senha : DUMMY_HASH)
  if (!func || !ok) return reply.status(401).send({ error: 'Matrícula ou senha incorretos.' })
  if (func.status !== 'ATIVO') return reply.status(403).send({ error: 'Usuário desativado. Procure o administrador.' })

  const token = jwt.sign({ id: func.id, matricula: func.matricula, nivel: func.nivel_acesso }, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' })
  return { token, nome: func.nome, nivel: func.nivel_acesso }
})

// Catálogo completo de produtos para o PDV (sem custo: operador de caixa não precisa ver margem)
fastify.get('/produtos', async () => {
  const { rows } = await pool.query('SELECT id, ean, nome, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao FROM produtos WHERE COALESCE(ativo, true) = true ORDER BY nome ASC')
  return rows
})

fastify.get('/produtos/busca', async (request) => {
  const termo = texto(request.query?.q, 60)
  if (!termo) {
    const { rows } = await pool.query('SELECT id, ean, nome, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao FROM produtos WHERE COALESCE(ativo, true) = true ORDER BY nome ASC LIMIT 50')
    return rows
  }
  const { rows } = await pool.query(
    'SELECT id, ean, nome, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao FROM produtos WHERE COALESCE(ativo, true) = true AND (nome ILIKE $1 OR ean ILIKE $1 OR categoria ILIKE $1) ORDER BY nome ASC LIMIT 50',
    [`%${termo.replace(/[%_\\]/g, '\\$&')}%`]
  )
  return rows
})

fastify.get('/produtos/:ean', async (request, reply) => {
  const ean = texto(request.params.ean, 50)
  const { rows } = await pool.query('SELECT id, ean, nome, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao FROM produtos WHERE ean = $1', [ean])
  if (rows.length === 0) return reply.status(404).send({ error: 'Produto não encontrado' })
  return rows[0]
})

// Registrar Venda: o servidor é quem define preço, total, troco e baixa de estoque.
fastify.post('/vendas', async (request, reply) => {
  const body = request.body || {}
  const terminal = terminalValido(body.terminal)
  const cpfCnpj = texto(body.cpfCnpj, 18).replace(/\D/g, '').slice(0, 14) || null

  // 1. Itens: agrupa por EAN e valida quantidades
  if (!Array.isArray(body.itens) || body.itens.length === 0 || body.itens.length > 300) {
    return reply.status(400).send({ error: 'A venda não possui itens válidos.' })
  }
  const qtdPorEan = new Map()
  for (const it of body.itens) {
    const ean = texto(String(it?.ean ?? ''), 50)
    const q = Number(it?.quantity ?? it?.quantidade)
    if (!ean || !Number.isInteger(q) || q <= 0 || q > 10000) return reply.status(400).send({ error: 'Item com código ou quantidade inválida.' })
    qtdPorEan.set(ean, (qtdPorEan.get(ean) || 0) + q)
  }

  // 2. Pagamentos
  if (!Array.isArray(body.pagamentos) || body.pagamentos.length === 0 || body.pagamentos.length > 20) {
    return reply.status(400).send({ error: 'Informe as formas de pagamento.' })
  }
  const pagamentos = []
  for (const p of body.pagamentos) {
    const metodo = normMetodo(p?.metodo)
    const valor = cents(p?.valor)
    if (!metodo || !(valor > 0)) return reply.status(400).send({ error: 'Forma de pagamento inválida.' })
    pagamentos.push({ metodo, valor, autorizacao: texto(p?.autorizacao, 40) || undefined })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const caixa = await caixaAberto(client, terminal)
    if (!caixa) {
      await client.query('ROLLBACK')
      return reply.status(409).send({ error: 'Caixa fechado. Abra o caixa antes de registrar vendas.', codigo: 'CAIXA_FECHADO' })
    }

    // 3. Trava os produtos (ordem fixa evita deadlock) e confere estoque
    const eans = [...qtdPorEan.keys()].sort()
    const { rows: prods } = await client.query(
      'SELECT id, ean, nome, preco_venda, preco_custo, estoque_atual FROM produtos WHERE ean = ANY($1::text[]) ORDER BY ean FOR UPDATE', [eans]
    )
    const porEan = new Map(prods.map(p => [p.ean, p]))
    let totalC = 0
    for (const ean of eans) {
      const p = porEan.get(ean)
      if (!p) { await client.query('ROLLBACK'); return reply.status(400).send({ error: `Produto ${ean} não cadastrado.` }) }
      const q = qtdPorEan.get(ean)
      if (Number(p.estoque_atual) < q) {
        await client.query('ROLLBACK')
        return reply.status(409).send({ error: `Estoque insuficiente para "${p.nome}" (disponível: ${p.estoque_atual}).` })
      }
      totalC += cents(p.preco_venda) * q
    }

    // 4. Confere pagamento x total e calcula o troco (troco só pode sair do dinheiro)
    const pagoC = pagamentos.reduce((s, p) => s + p.valor, 0)
    const dinheiroC = pagamentos.filter(p => p.metodo === 'DINHEIRO').reduce((s, p) => s + p.valor, 0)
    if (pagoC < totalC) {
      await client.query('ROLLBACK')
      return reply.status(409).send({ error: `Pagamento insuficiente. Total da venda: R$ ${reais(totalC).toFixed(2)}. Os preços podem ter sido atualizados — confira e tente novamente.`, total: reais(totalC), codigo: 'TOTAL_DIVERGENTE' })
    }
    const trocoC = pagoC - totalC
    if (trocoC > dinheiroC) {
      await client.query('ROLLBACK')
      return reply.status(400).send({ error: 'Troco só pode ser dado sobre pagamento em dinheiro. Ajuste os valores dos cartões/PIX.' })
    }

    const formasUsadas = [...new Set(pagamentos.map(p => p.metodo))]
    const metodoTxt = formasUsadas.length === 1 ? formasUsadas[0] : 'MÚLTIPLOS'
    const pagamentosJson = pagamentos.map(p => ({ metodo: p.metodo, valor: reais(p.valor), ...(p.autorizacao ? { autorizacao: p.autorizacao } : {}) }))

    const resVenda = await client.query(
      `INSERT INTO vendas (total, metodo_pagamento, cpf_cnpj_cliente, status_nfe, status, pagamentos, troco, caixa_id, funcionario_id, operador_nome)
       VALUES ($1, $2, $3, 'NAO_EMITIDA', 'CONCLUIDA', $4, $5, $6, $7, $8) RETURNING id, criado_em`,
      [reais(totalC), metodoTxt, cpfCnpj, JSON.stringify(pagamentosJson), reais(trocoC), caixa.id, request.user.id, request.user.nome]
    )
    const vendaId = resVenda.rows[0].id

    const itensResposta = []
    for (const ean of eans) {
      const p = porEan.get(ean)
      const q = qtdPorEan.get(ean)
      await client.query(
        'INSERT INTO vendas_itens (venda_id, produto_ean, quantidade, preco_unitario, produto_nome, preco_custo) VALUES ($1, $2, $3, $4, $5, $6)',
        [vendaId, ean, q, p.preco_venda, p.nome, p.preco_custo || 0]
      )
      await client.query('UPDATE produtos SET estoque_atual = estoque_atual - $1 WHERE id = $2', [q, p.id])
      await registrarMovimentacao(client, {
        produto_id: p.id, ean, nome: p.nome, tipo: 'VENDA',
        quantidade: q, custo: p.preco_custo || 0, venda_id: vendaId, usuario_id: request.user.id
      })
      itensResposta.push({ ean, nome: p.nome, quantidade: q, preco: Number(p.preco_venda) })
    }

    await client.query('COMMIT')
    request.log.info(`[VENDA] #${vendaId} registrada no caixa #${caixa.id}`)
    return {
      sucesso: true, id_venda: vendaId, caixa_id: caixa.id,
      total: reais(totalC), troco: reais(trocoC), pagamentos: pagamentosJson, itens: itensResposta,
      criado_em: resVenda.rows[0].criado_em
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    request.log.error(err)
    return reply.status(500).send({ error: 'Erro ao registrar a venda. Nada foi gravado.' })
  } finally {
    client.release()
  }
})

// ===================================================================
// ROTA FISCAL: EMISSÃO DE NFC-e (Simulação ACBr / Nuvem Fiscal)
// ===================================================================
fastify.post('/fiscal/emitir-nfce', async (request, reply) => {
  const vendaId = idValido(request.body?.venda_id)
  if (!vendaId) return reply.status(400).send({ error: 'Venda inválida.' })
  const client = await pool.connect()
  try {
    const resVenda = await client.query('SELECT * FROM vendas WHERE id = $1', [vendaId])
    if (resVenda.rows.length === 0) return reply.status(404).send({ error: 'Venda não encontrada' })
    const venda = resVenda.rows[0]
    if (venda.status_nfe === 'AUTORIZADA') return reply.status(400).send({ error: 'NFC-e já foi autorizada para esta venda.' })
    if ((venda.status || 'CONCLUIDA') !== 'CONCLUIDA') return reply.status(400).send({ error: 'Venda cancelada não pode emitir NFC-e.' })

    await new Promise(resolve => setTimeout(resolve, 800)) // Simula delay da SEFAZ
    const chave_acesso = '352609' + '00000000000100' + '65' + '001' + String(venda.id).padStart(9, '0') + '1' + '12345678' + '0'
    const protocolo = '135' + String(Date.now()).slice(0, 12)

    await client.query(
      'UPDATE vendas SET status_nfe = $1, chave_nfe = $2, protocolo_nfe = $3 WHERE id = $4',
      ['AUTORIZADA', chave_acesso, protocolo, venda.id]
    )
    await auditar(client, { venda_id: venda.id, status: 'AUTORIZADO_SEFAZ', mensagem: 'Lote Autorizado com Sucesso', retorno: 'cStat: 100 - Autorizado o uso da NFC-e' })
    return {
      sucesso: true,
      status: 'Autorizado o uso da NFC-e',
      chave_acesso,
      protocolo,
      url_qr_code: `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${chave_acesso}|2|1|1`
    }
  } catch (err) {
    request.log.error(err)
    return reply.status(500).send({ error: 'Erro de Comunicação com SEFAZ' })
  } finally {
    client.release()
  }
})

// Inicia o servidor da API
const start = async () => {
  try {
    await garantirSchema()
    const port = Number(process.env.PORT) || 3000
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`API do PDV rodando na porta ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
