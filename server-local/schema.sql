-- Criação da tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    ean VARCHAR(14) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    preco_venda NUMERIC(10, 2) NOT NULL,
    estoque_atual INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Limpar a tabela antes de popular (para testes)
TRUNCATE TABLE produtos RESTART IDENTITY;

-- Inserindo os produtos da Distribuidora Tailândia
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
('7891000200202', 'Amendoim Japonês Yoki 150g', 5.90, 75);
