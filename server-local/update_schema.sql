CREATE TABLE IF NOT EXISTS vendas (
    id SERIAL PRIMARY KEY,
    total NUMERIC(10, 2) NOT NULL,
    metodo_pagamento VARCHAR(20) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendas_itens (
    id SERIAL PRIMARY KEY,
    venda_id INTEGER REFERENCES vendas(id),
    produto_ean VARCHAR(14) NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL
);
