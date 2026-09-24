CREATE TABLE IF NOT EXISTS funcionarios (
    id SERIAL PRIMARY KEY,
    matricula VARCHAR(5) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL, -- em produção ideal usar hash (bcrypt)
    cpf VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    endereco TEXT,
    data_nascimento DATE,
    desconto_funcionario NUMERIC(5,2) DEFAULT 0.00,
    loja_id INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ATIVO',
    nivel_acesso VARCHAR(20) DEFAULT 'CAIXA', -- 'CAIXA' ou 'ADMIN'
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir o primeiro ADMIN de teste
INSERT INTO funcionarios (matricula, senha, cpf, nome, nivel_acesso) 
VALUES ('00001', 'admin123', '000.000.000-00', 'Administrador Chefe', 'ADMIN')
ON CONFLICT DO NOTHING;

-- Inserir um Operador de Caixa de teste
INSERT INTO funcionarios (matricula, senha, cpf, nome, nivel_acesso) 
VALUES ('12345', 'caixa123', '111.111.111-11', 'João Silva', 'CAIXA')
ON CONFLICT DO NOTHING;
