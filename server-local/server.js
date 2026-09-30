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

// Bloqueia acesso de outros sites (CORS Restrito a portas conhecidas do PDV e ADM)
await fastify.register(cors, { 
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:1420', 'tauri://localhost', 'https://tauri.localhost'];
    if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      return cb(null, true);
    }
    cb(new Error("Not allowed"), false);
  }
})

// Configuração da conexão com o Banco de Dados PostgreSQL que acabamos de criar
const pool = new Pool({
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
  try {
    const { rows } = await pool.query(
      'INSERT INTO produtos (ean, nome, preco_custo, preco_venda, estoque_atual) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [ean, nome, preco_custo || 0, preco_venda, estoque_atual]
    )
    return rows[0]
  } catch(e) {
    fastify.log.error(e)
    return reply.status(500).send({error: 'Erro ao cadastrar produto. Verifique se o EAN já existe.'})
  }
})

// Editar Produto
fastify.put('/admin/produtos/:id', async (request, reply) => {
  const { id } = request.params
  const { ean, nome, preco_custo, preco_venda, estoque_atual } = request.body
  try {
    await pool.query(
      'UPDATE produtos SET ean=$1, nome=$2, preco_custo=$3, preco_venda=$4, estoque_atual=$5 WHERE id=$6',
      [ean, nome, preco_custo, preco_venda, estoque_atual, id]
    )
    return { sucesso: true }
  } catch(e) { return reply.status(500).send({error: 'Erro ao editar produto'}) }
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

// Listar todas as Vendas com itens
fastify.get('/admin/vendas', async (request, reply) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.id, v.total, v.metodo_pagamento, v.criado_em,
             json_agg(json_build_object('ean', vi.produto_ean, 'quantidade', vi.quantidade, 'preco', vi.preco_unitario)) as itens
      FROM vendas v
      LEFT JOIN vendas_itens vi ON vi.venda_id = v.id
      GROUP BY v.id
      ORDER BY v.criado_em DESC
    `)
    return rows
  } catch(e) { console.error('[ERRO /admin/vendas]', e.message); return reply.status(500).send({error: 'Erro ao buscar vendas'}) }
})

// ==========================================
// ROTAS DA NOSSA API (FRENTE DE CAIXA)
// ==========================================
fastify.post('/auth', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes'
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
    
    // 2. Salva os Itens e Abate o Estoque!
    for (const item of itens) {
      // Guarda o item vendido
      await client.query(
        'INSERT INTO vendas_itens (venda_id, produto_ean, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
        [vendaId, item.ean, item.quantity, item.unitPrice]
      )
      // Abate o estoque
      await client.query(
        'UPDATE produtos SET estoque_atual = estoque_atual - $1 WHERE ean = $2',
        [item.quantity, item.ean]
      )
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
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log(`API do PDV rodando com sucesso na porta 3000!`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
