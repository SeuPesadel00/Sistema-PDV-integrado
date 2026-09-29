-- Atualização do Banco de Dados para Emissão Fiscal (NFC-e)

-- 1. Inclusão dos dados tributários obrigatórios nos Produtos
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm VARCHAR(8) DEFAULT '22030000'; -- Cervejas de malte (Padrão para a distribuidora)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cfop VARCHAR(4) DEFAULT '5102'; -- Venda de mercadoria adquirida ou recebida de terceiros
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS icms_cst VARCHAR(3) DEFAULT '102'; -- Tributada pelo Simples Nacional sem permissão de crédito
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS pis_cst VARCHAR(2) DEFAULT '99'; -- Outras Operações
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS cofins_cst VARCHAR(2) DEFAULT '99'; -- Outras Operações
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS origem_mercadoria VARCHAR(1) DEFAULT '0'; -- Nacional

-- 2. Inclusão dos controles fiscais no Cabeçalho da Venda
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cpf_cnpj_cliente VARCHAR(14);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status_nfe VARCHAR(20) DEFAULT 'NAO_EMITIDA'; -- NAO_EMITIDA, PENDENTE, AUTORIZADA, REJEITADA, CANCELADA
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS chave_nfe VARCHAR(44);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS protocolo_nfe VARCHAR(50);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS xml_nfe TEXT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS num_nfe INTEGER;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS serie_nfe INTEGER DEFAULT 1;

-- Criação de uma tabela para Logs Fiscais
CREATE TABLE IF NOT EXISTS notas_fiscais_logs (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER REFERENCES vendas(id),
    data_evento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    mensagem TEXT,
    retorno_sefaz TEXT
);
