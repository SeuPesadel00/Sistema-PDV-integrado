-- Habilita extensão de criptografia no Supabase
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Criação da tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    ean VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    preco_custo NUMERIC(10, 2) DEFAULT 0,
    preco_venda NUMERIC(10, 2) NOT NULL,
    estoque_atual INTEGER DEFAULT 0,
    ncm VARCHAR(8) DEFAULT '22030000',
    cfop VARCHAR(4) DEFAULT '5102',
    icms_cst VARCHAR(3) DEFAULT '102',
    pis_cst VARCHAR(2) DEFAULT '99',
    cofins_cst VARCHAR(2) DEFAULT '99',
    origem_mercadoria VARCHAR(1) DEFAULT '0',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserindo os produtos
INSERT INTO produtos (ean, nome, preco_venda, estoque_atual) VALUES
('7894900700046', 'Cerveja Heineken LN 330ml', 6.50, 150),
('7891991000826', 'Cerveja Budweiser Lata 350ml', 4.20, 300),
('7891136000000', 'Cerveja Stella Artois LN 330ml', 7.90, 120),
('7891991010856', 'Cerveja Corona Extra LN 330ml', 8.50, 90),
('7891136052000', 'Whisky JW Red Label 1L', 95.00, 20),
('7896045500049', 'Vodka Smirnoff 998ml', 45.90, 35),
('7891136015509', 'Gin Tanqueray London Dry 750ml', 139.90, 15),
('7891010505151', 'Fardo Coca-Cola Lata 350ml (12)', 34.90, 50),
('7894900011517', 'Guaraná Antarctica 2L', 9.50, 100),
('7894900010015', 'Água Mineral Sem Gás 500ml', 2.50, 250),
('7896020613245', 'Energético Red Bull Lata 250ml', 10.90, 80),
('7894320611221', 'Saco de Gelo Cubo 5kg', 15.00, 40),
('7891000100101', 'Salgadinho Doritos Queijo 140g', 12.50, 60),
('7891000200202', 'Amendoim Japonês Yoki 150g', 5.90, 75)
ON CONFLICT DO NOTHING;

-- 2. Criação da tabela de Funcionários
CREATE TABLE IF NOT EXISTS funcionarios (
    id SERIAL PRIMARY KEY,
    matricula VARCHAR(5) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    endereco TEXT,
    data_nascimento DATE,
    desconto_funcionario NUMERIC(5,2) DEFAULT 0.00,
    loja_id INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ATIVO',
    nivel_acesso VARCHAR(20) DEFAULT 'CAIXA',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserindo os funcionários com senha criptografada via pgcrypto
INSERT INTO funcionarios (matricula, senha, cpf, nome, nivel_acesso) 
VALUES ('00001', crypt('admin123', gen_salt('bf')), '000.000.000-00', 'Administrador Chefe', 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO funcionarios (matricula, senha, cpf, nome, nivel_acesso) 
VALUES ('12345', crypt('caixa123', gen_salt('bf')), '111.111.111-11', 'João Silva', 'CAIXA')
ON CONFLICT DO NOTHING;

-- 3. Criação da tabela de Vendas e Itens
CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    total NUMERIC(10, 2) NOT NULL,
    metodo_pagamento VARCHAR(20) NOT NULL,
    cpf_cnpj_cliente VARCHAR(14),
    status_nfe VARCHAR(20) DEFAULT 'NAO_EMITIDA',
    chave_nfe VARCHAR(44),
    protocolo_nfe VARCHAR(50),
    xml_nfe TEXT,
    status VARCHAR(20) DEFAULT 'CONCLUIDA', -- CONCLUIDA | CANCELADA | ESTORNADA
    motivo_cancelamento TEXT,
    estorno_info JSONB,
    num_nfe INTEGER,
    serie_nfe INTEGER DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendas_itens (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER REFERENCES vendas(id),
    produto_ean VARCHAR(14) NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    produto_nome VARCHAR(100),      -- snapshot do nome no momento da venda
    preco_custo NUMERIC(10, 2)      -- snapshot do custo no momento da venda (para cálculo de lucro)
);

-- 3.1 Livro de movimentações de estoque (entradas e saídas)
-- Obs: o servidor (server.js -> garantirSchema) cria/atualiza isso automaticamente ao iniciar.
-- tipo: SALDO_INICIAL | ENTRADA_CADASTRO | ENTRADA_REPOSICAO | VENDA | AJUSTE_SAIDA
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
);

-- 4. Criação da tabela de Logs Fiscais
CREATE TABLE IF NOT EXISTS notas_fiscais_logs (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER REFERENCES vendas(id),
    data_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    mensagem TEXT,
    retorno_sefaz TEXT
);
