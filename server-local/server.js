import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import pg from 'pg'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from '@fastify/rate-limit'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_inseguro'

const { Pool } = pg

const fastify = Fastify({ logger: true })

// Limite de Requisições contra Ataques de Força Bruta
await fastify.register(rateLimit, {
  global: false // Ativaremos especificamente na rota de auth
})

// Permite acesso de qualquer origem temporariamente para evitar erros de CORS no deploy da Vercel ou IP local
await fastify.register(cors, { 
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
})

// Configuração da conexão com o Banco de Dados (Supabase/Local)
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      user: 'postgres',
      host: '127.0.0.1',
      database: 'Tailandia_db',
      password: 'Tailandia@2026', 
      port: 6666,
    })

// Força UTF-8 em toda nova conexão (resolve incompatibilidade WIN1252 no Windows)
pool.on('connect', (client) => {
  client.query("SET client_encoding = 'UTF8'")
})

// ==========================================
// AUTO-MIGRAÇÃO DO SCHEMA (MÉTRICAS E MOVIMENTAÇÕES)
// Roda a cada inicialização. Todos os comandos são idempotentes.
// ==========================================
const TIPOS_ENTRADA = ['SALDO_INICIAL', 'ENTRADA_CADASTRO', 'ENTRADA_REPOSICAO']

async function garantirSchema() {
  const client = await pool.connect()
  try {
    // Snapshot do produto no momento da venda (nome e custo não mudam se o produto for editado depois)
    // Sem DEFAULT de propósito: vendas antigas ficam NULL e caem no fallback do cadastro atual.
    await client.query('ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(100)')
    await client.query('ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2)')

    // Livro-razão de estoque: toda entrada (cadastro/reposição) e saída (venda/ajuste) fica registrada
    await client.query(`
      CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
        id SERIAL PRIMARY KEY,
        produto_id INTEGER,
        produto_ean VARCHAR(14) NOT NULL,
        produto_nome VARCHAR(100),
        tipo VARCHAR(30) NOT NULL,
        quantidade INTEGER NOT NULL,
        custo_unitario NUMERIC(10, 2) DEFAULT 0,
        valor_total NUMERIC(12, 2) DEFAULT 0,
        venda_id INTEGER,
        usuario_id INTEGER,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_mov_ean ON movimentacoes_estoque (produto_ean)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_vi_ean ON vendas_itens (produto_ean)')

    // Saldo inicial (uma única vez por produto): reconstrói o que entrou = estoque atual + o que já foi vendido
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
    console.log('[SCHEMA] Tabelas de métricas e movimentações verificadas.')
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

// ==========================================
// MIDDLEWARE DE SEGURANÇA (JWT GUARDA DE ROTA)
// ==========================================
fastify.addHook('onRequest', async (request, reply) => {
  // Ignora a rota de login e rotas de preflight (OPTIONS)
  if (request.url === '/auth' || request.method === 'OPTIONS') return;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Acesso Negado: Token JWT ausente.' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    request.user = decoded; // Salva { id, matricula, nivel } na request

    // Se for uma rota administrativa, bloqueia funcionários normais
    if (request.url.startsWith('/admin') && decoded.nivel !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso Negado: Apenas Administradores podem acessar.' });
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Acesso Negado: Token inválido ou expirado.' });
  }
});

// ==========================================
// ROTAS DE ADMINISTRAÇÃO (BACKOFFICE)
// ==========================================

// ---------- PRODUTOS ----------

// Listar todos os Produtos
fastify.get('/admin/produtos', async (request, reply) => {
  try {
    const { rows } = await pool.query('SELECT * FROM produtos ORDER BY id DESC')
    return rows
  } catch(e) { console.error('[ERRO /admin/produtos]', e.message); return reply.status(500).send({error: 'Erro no bd: ' + e.message}) }
})

// Cadastrar Novo Produto
fastify.post('/admin/produtos', async (request, reply) => {
  const { ean, nome, preco_custo, preco_venda, estoque_atual } = request.body
  const client = await pool.connect()
  try {
    const custo = preco_custo !== undefined && preco_custo !== null && preco_custo !== '' ? Number(preco_custo) : 0
    const venda = Number(preco_venda)
    const estoque = estoque_atual !== undefined && estoque_atual !== null && estoque_atual !== '' ? Number(estoque_atual) : 0

    await client.query('BEGIN')
    const { rows } = await client.query(
      'INSERT INTO produtos (ean, nome, preco_custo, preco_venda, estoque_atual) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ean, nome, custo, venda, estoque]
    )
    // Cadastro = mercadoria entrando para venda. Sempre registra (mesmo com qtd 0) para manter o histórico.
    await registrarMovimentacao(client, {
      produto_id: rows[0].id, ean, nome, tipo: 'ENTRADA_CADASTRO',
      quantidade: estoque, custo, usuario_id: request.user?.id
    })
    await client.query('COMMIT')
    return rows[0]
  } catch(e) {
    await client.query('ROLLBACK').catch(() => {})
    fastify.log.error(e)
    return reply.status(500).send({error: 'Erro ao cadastrar produto: ' + e.message})
  } finally {
    client.release()
  }
})

// Editar Produto
fastify.put('/admin/produtos/:id', async (request, reply) => {
  const { id } = request.params
  const { ean, nome, preco_custo, preco_venda, estoque_atual } = request.body
  const client = await pool.connect()
  try {
    const custo = preco_custo !== undefined && preco_custo !== null && preco_custo !== '' ? Number(preco_custo) : 0
    const venda = Number(preco_venda)
    const estoque = estoque_atual !== undefined && estoque_atual !== null && estoque_atual !== '' ? Number(estoque_atual) : 0

    await client.query('BEGIN')
    const atual = await client.query('SELECT estoque_atual FROM produtos WHERE id=$1 FOR UPDATE', [id])
    if (atual.rows.length === 0) {
      await client.query('ROLLBACK')
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }

    await client.query(
      'UPDATE produtos SET ean=$1, nome=$2, preco_custo=$3, preco_venda=$4, estoque_atual=$5 WHERE id=$6',
      [ean, nome, custo, venda, estoque, id]
    )

    // Diferença de estoque vira movimentação: aumento = reposição (gasto), redução = ajuste/perda
    const diff = estoque - Number(atual.rows[0].estoque_atual)
    if (diff !== 0) {
      await registrarMovimentacao(client, {
        produto_id: Number(id), ean, nome,
        tipo: diff > 0 ? 'ENTRADA_REPOSICAO' : 'AJUSTE_SAIDA',
        quantidade: Math.abs(diff), custo, usuario_id: request.user?.id
      })
    }
    await client.query('COMMIT')
    return { sucesso: true }
  } catch(e) { 
    await client.query('ROLLBACK').catch(() => {})
    fastify.log.error(e)
    return reply.status(500).send({error: 'Erro ao editar produto: ' + e.message}) 
  } finally {
    client.release()
  }
})

// Excluir Produto
fastify.delete('/admin/produtos/:id', async (request, reply) => {
  const { id } = request.params
  try {
    await pool.query('DELETE FROM produtos WHERE id=$1', [id])
    return { sucesso: true }
  } catch(e) { return reply.status(500).send({error: 'Erro ao excluir produto'}) }
})

// ---------- FUNCIONÁRIOS ----------

// Listar Funcionários
fastify.get('/admin/funcionarios', async (request, reply) => {
  try {
    const { rows } = await pool.query('SELECT id, matricula, nome, cpf, endereco, data_nascimento, desconto_funcionario, nivel_acesso, status FROM funcionarios ORDER BY id DESC')
    return rows
  } catch(e) { return reply.status(500).send({error: 'Erro no bd'}) }
})

// Cadastrar Funcionário
fastify.post('/admin/funcionarios', async (request, reply) => {
  const { matricula, senha, cpf, nome, endereco, data_nascimento, desconto_funcionario, nivel_acesso } = request.body
  try {
    const hashSenha = bcrypt.hashSync(senha, 10)
    const { rows } = await pool.query(
      'INSERT INTO funcionarios (matricula, senha, cpf, nome, endereco, data_nascimento, desconto_funcionario, nivel_acesso) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, matricula, nome, cpf, nivel_acesso, status',
      [matricula, hashSenha, cpf, nome, endereco || '', data_nascimento || null, desconto_funcionario || 0, nivel_acesso || 'CAIXA']
    )
    return rows[0]
  } catch(e) {
    fastify.log.error(e)
    return reply.status(500).send({error: 'Erro ao cadastrar. Verifique se matrícula ou CPF já existem.'})
  }
})

// Editar Funcionário
fastify.put('/admin/funcionarios/:id', async (request, reply) => {
  const { id } = request.params
  const { matricula, nome, cpf, endereco, data_nascimento, desconto_funcionario, nivel_acesso, status } = request.body
  try {
    await pool.query(
      'UPDATE funcionarios SET matricula=$1, nome=$2, cpf=$3, endereco=$4, data_nascimento=$5, desconto_funcionario=$6, nivel_acesso=$7, status=$8 WHERE id=$9',
      [matricula, nome, cpf, endereco, data_nascimento || null, desconto_funcionario, nivel_acesso, status, id]
    )
    return { sucesso: true }
  } catch(e) { return reply.status(500).send({error: 'Erro ao editar funcionário'}) }
})

// Excluir Funcionário
fastify.delete('/admin/funcionarios/:id', async (request, reply) => {
  const { id } = request.params
  try {
    await pool.query('DELETE FROM funcionarios WHERE id=$1', [id])
    return { sucesso: true }
  } catch(e) { return reply.status(500).send({error: 'Erro ao excluir funcionário'}) }
})

// ---------- VENDAS (CONSULTA) ----------

// Listar todas as Vendas com itens detalhados
// Vendas antigas (sem snapshot) usam nome/custo do cadastro atual como fallback.
fastify.get('/admin/vendas', async (request, reply) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.id, v.total, v.metodo_pagamento, v.cpf_cnpj_cliente, v.criado_em,
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
      GROUP BY v.id
      ORDER BY v.criado_em DESC
    `)
    return rows
  } catch(e) { console.error('[ERRO /admin/vendas]', e.message); return reply.status(500).send({error: 'Erro ao buscar vendas'}) }
})

// ---------- MÉTRICAS ----------

// Desempenho por produto: vendido x investido x lucro. ?dias=N filtra o período (vazio = tudo)
fastify.get('/admin/metricas/produtos', async (request, reply) => {
  const dias = request.query?.dias ? parseInt(request.query.dias, 10) : null
  try {
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
  } catch(e) { console.error('[ERRO /admin/metricas/produtos]', e.message); return reply.status(500).send({error: 'Erro ao calcular métricas'}) }
})

// Últimas movimentações de estoque (entradas, reposições, vendas, ajustes)
fastify.get('/admin/movimentacoes', async (request, reply) => {
  try {
    const { rows } = await pool.query('SELECT * FROM movimentacoes_estoque ORDER BY criado_em DESC, id DESC LIMIT 300')
    return rows
  } catch(e) { console.error('[ERRO /admin/movimentacoes]', e.message); return reply.status(500).send({error: 'Erro ao buscar movimentações'}) }
})

// ==========================================
// ROTAS DA NOSSA API (FRENTE DE CAIXA)
// ==========================================
fastify.post('/auth', {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  const { matricula, senha } = request.body
  try {
    const { rows } = await pool.query('SELECT * FROM funcionarios WHERE matricula = $1', [matricula])
    if (rows.length === 0) return reply.status(401).send({ error: 'Matrícula não encontrada' })
    
    const func = rows[0]
    if (!bcrypt.compareSync(senha, func.senha)) return reply.status(401).send({ error: 'Senha incorreta' })
    if (func.status !== 'ATIVO') return reply.status(403).send({ error: 'Funcionário desativado' })

    const token = jwt.sign({ id: func.id, matricula: func.matricula, nivel: func.nivel_acesso }, JWT_SECRET, { expiresIn: '12h' })
    
    return { token, nome: func.nome, nivel: func.nivel_acesso }
  } catch (err) {
    fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro no servidor' })
  }
})

// Rota 1: Buscar um produto específico pelo Código de Barras (EAN)
fastify.get('/produtos/:ean', async (request, reply) => {
  const { ean } = request.params
  try {
    // Busca na tabela 'produtos' onde o EAN é igual ao que o PDV pediu
    const { rows } = await pool.query('SELECT * FROM produtos WHERE ean = $1', [ean])
    
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }
    
    // Devolve o produto encontrado em formato JSON
    return rows[0]
  } catch (err) {
    fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro ao buscar o produto no banco' })
  }
})

// Rota 2: Registrar a Venda Finalizada e Abater Estoque
fastify.post('/vendas', async (request, reply) => {
  const { itens, total, metodo_pagamento, cpfCnpj } = request.body
  const client = await pool.connect()
  
  try {
    // Inicia uma Transação (Se algo der errado, ele desfaz tudo para não corromper o estoque)
    await client.query('BEGIN')
    
    // 1. Salva o cabeçalho da Venda (Agora gravando o CPF na Nota)
    const resVenda = await client.query(
      'INSERT INTO vendas (total, metodo_pagamento, cpf_cnpj_cliente, status_nfe) VALUES ($1, $2, $3, $4) RETURNING id',
      [total, metodo_pagamento, cpfCnpj || null, 'NAO_EMITIDA']
    )
    const vendaId = resVenda.rows[0].id
    
    // 2. Salva os Itens (com snapshot de nome e custo), Abate o Estoque e registra a saída
    for (const item of itens) {
      const resProd = await client.query('SELECT id, nome, preco_custo FROM produtos WHERE ean = $1', [item.ean])
      const prod = resProd.rows[0] || {}
      const nomeItem = prod.nome || item.name || item.nome || null
      const custoItem = prod.preco_custo !== undefined && prod.preco_custo !== null ? Number(prod.preco_custo) : 0

      // Guarda o item vendido
      await client.query(
        'INSERT INTO vendas_itens (venda_id, produto_ean, quantidade, preco_unitario, produto_nome, preco_custo) VALUES ($1, $2, $3, $4, $5, $6)',
        [vendaId, item.ean, item.quantity, item.unitPrice, nomeItem, custoItem]
      )
      // Abate o estoque
      await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual - $1 WHERE ean = $2',
        [item.quantity, item.ean]
      )
      // Registro redundante no livro de estoque
      await registrarMovimentacao(client, {
        produto_id: prod.id || null, ean: item.ean, nome: nomeItem, tipo: 'VENDA',
        quantidade: Number(item.quantity), custo: custoItem, venda_id: vendaId, usuario_id: request.user?.id
      })
    }
    
    // Confirma a transação
    await client.query('COMMIT')
    console.log(`[SUCESSO] Venda #${vendaId} Registrada e Estoque Atualizado.`)
    
    return { sucesso: true, id_venda: vendaId }
  } catch (err) {
    await client.query('ROLLBACK')
    fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro ao registrar a venda no banco' })
  } finally {
    client.release()
  }
})

// ===================================================================
// ROTA FISCAL: EMISSÃO DE NFC-e (Simulação ACBr / Nuvem Fiscal)
// ===================================================================
fastify.post('/fiscal/emitir-nfce', async (request, reply) => {
  const { venda_id } = request.body;
  const client = await pool.connect();
  
  try {
    // 1. Busca os dados completos da venda no banco
    const resVenda = await client.query('SELECT * FROM vendas WHERE id = $1', [venda_id]);
    if (resVenda.rows.length === 0) return reply.status(404).send({ error: 'Venda não encontrada' });
    const venda = resVenda.rows[0];

    if (venda.status_nfe === 'AUTORIZADA') {
      return reply.status(400).send({ error: 'NFC-e já foi autorizada para esta venda.' });
    }

    // Aqui enviaríamos o JSON do Produto/Cliente/Impostos para a Nuvem Fiscal ou ACBr.
    // Como estamos desenhando a estrutura, vamos SIMULAR o retorno de SUCESSO:
    
    await new Promise(resolve => setTimeout(resolve, 800)); // Simula delay da SEFAZ
    
    const chave_acesso = '352609' + '00000000000100' + '65' + '001' + String(venda.id).padStart(9, '0') + '1' + '12345678' + '0';
    const protocolo = '135' + String(Date.now()).slice(0, 12);
    
    // Atualiza o banco com a Chave e Autorização
    await client.query(
      'UPDATE vendas SET status_nfe = $1, chave_nfe = $2, protocolo_nfe = $3 WHERE id = $4',
      ['AUTORIZADA', chave_acesso, protocolo, venda.id]
    );
    
    // Grava no Log Fiscal
    await client.query(
      'INSERT INTO notas_fiscais_logs (venda_id, status, mensagem, retorno_sefaz) VALUES ($1, $2, $3, $4)',
      [venda.id, 'AUTORIZADO_SEFAZ', 'Lote Autorizado com Sucesso', 'cStat: 100 - Autorizado o uso da NFC-e']
    );

    console.log(`[FISCAL] NFC-e Emitida com Sucesso! Venda #${venda.id} - Chave: ${chave_acesso}`);

    return { 
      sucesso: true, 
      status: 'Autorizado o uso da NFC-e',
      chave_acesso,
      protocolo,
      url_qr_code: `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${chave_acesso}|2|1|1`
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Erro de Comunicação com SEFAZ' });
  } finally {
    client.release();
  }
})

// Inicia o servidor da API
const start = async () => {
  try {
    await garantirSchema()
    await fastify.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' })
    console.log(`API do PDV rodando com sucesso na porta 3000!`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
