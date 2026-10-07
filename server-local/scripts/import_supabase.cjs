const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SUPABASE_URL = 'postgresql://postgres.rgggdawwkmncpfetuhij:Q3jYPW_%5EwHvj%3Fdz@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // ignore CR
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

function parsePrice(s) {
  if (!s) return 0;
  const t = String(s).trim();
  if (!t) return 0;
  const numStr = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(numStr);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  console.log('--- IMPORTANDO PRODUTOS REAIS PARA O SUPABASE (NUVEM) ---');
  const client = await pool.connect();

  try {
    // 1. Atualizar schema no Supabase
    console.log('[1/4] Atualizando tabelas no Supabase...');
    await client.query(`
      ALTER TABLE produtos ALTER COLUMN ean TYPE VARCHAR(50);
      ALTER TABLE produtos ALTER COLUMN nome TYPE VARCHAR(255);
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100);
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS descricao TEXT;
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS wp_id INTEGER;

      ALTER TABLE vendas_itens ALTER COLUMN produto_ean TYPE VARCHAR(50);
      ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(255);
      ALTER TABLE vendas_itens ALTER COLUMN produto_nome TYPE VARCHAR(255);
      ALTER TABLE vendas_itens ADD COLUMN IF NOT EXISTS preco_custo NUMERIC(10, 2);

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
      );
      ALTER TABLE movimentacoes_estoque ALTER COLUMN produto_ean TYPE VARCHAR(50);
      ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS produto_nome VARCHAR(255);
      ALTER TABLE movimentacoes_estoque ALTER COLUMN produto_nome TYPE VARCHAR(255);

      CREATE INDEX IF NOT EXISTS idx_produtos_wp_id ON produtos(wp_id);
      CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
    `);
    console.log('Schema no Supabase atualizado com sucesso.');

    // 2. Ler e processar CSV
    console.log('[2/4] Lendo e parseando arquivo CSV...');
    const csvPath = path.join(__dirname, '..', 'wc-products.csv');
    const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
    const rows = parseCSV(raw);
    const headers = rows[0].map(h => h.trim());
    const colIdx = {};
    headers.forEach((h, i) => colIdx[h] = i);

    console.log(`Total de linhas CSV: ${rows.length - 1}`);

    const existingEans = new Set();
    const { rows: existingDbProds } = await client.query('SELECT ean FROM produtos');
    existingDbProds.forEach(p => existingEans.add(p.ean));

    const produtosToInsert = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 5) continue;
      const wpId = Number(r[colIdx['ID']]);
      const tipo = r[colIdx['Tipo']];
      const nome = r[colIdx['Nome']] ? r[colIdx['Nome']].trim() : '';
      const precoRaw = r[colIdx['Preço']];
      const skuRaw = r[colIdx['SKU']] ? r[colIdx['SKU']].trim() : '';
      const gtinRaw = r[colIdx['GTIN, UPC, EAN, or ISBN']] ? r[colIdx['GTIN, UPC, EAN, or ISBN']].trim() : '';
      const catsRaw = r[colIdx['Categorias']] ? r[colIdx['Categorias']].trim() : '';
      const imgRaw = r[colIdx['Imagens']] ? r[colIdx['Imagens']].trim() : '';
      const estoqueRaw = r[colIdx['Estoque']];
      const emEstoque = r[colIdx['Em estoque?']];
      const descCurta = r[colIdx['Descrição curta']];
      const descLonga = r[colIdx['Descrição']];

      // Ignora variações vazias ou rascunhos sem nome
      if (!nome || tipo === 'variation' || nome.toUpperCase().includes('AUTO-DRAFT')) {
        continue;
      }

      // Define EAN / Código de barras
      let eanCandidate = gtinRaw || skuRaw;
      if (!eanCandidate) {
        eanCandidate = '789' + String(wpId).padStart(10, '0');
      }

      // Garante unicidade
      let finalEan = eanCandidate;
      let counter = 1;
      while (existingEans.has(finalEan)) {
        finalEan = `${eanCandidate}-${wpId || counter}`;
        counter++;
      }
      existingEans.add(finalEan);

      const precoVenda = parsePrice(precoRaw);

      let estoqueAtual = 0;
      if (emEstoque === '1' || emEstoque === 1) {
        const parsedEstoque = parseInt(estoqueRaw, 10);
        estoqueAtual = Number.isInteger(parsedEstoque) && parsedEstoque > 0 ? parsedEstoque : 50;
      }

      let categoria = 'Diversos';
      let subcategoria = '';
      if (catsRaw) {
        const parts = catsRaw.split(',')[0].split('>');
        categoria = parts[0].trim();
        if (parts.length > 1) {
          subcategoria = parts.slice(1).map(s => s.trim()).join(' > ');
        }
      }

      if (categoria === 'Sem categoria' || !categoria) {
        const nl = nome.toLowerCase();
        if (nl.includes('cerveja') || nl.includes('whisky') || nl.includes('vodka') || nl.includes('gin') || nl.includes('refrigerante') || nl.includes('suco') || nl.includes('combo') || nl.includes('ice')) {
          categoria = 'Bebidas';
        } else if (nl.includes('seda') || nl.includes('piteira') || nl.includes('tabaco') || nl.includes('cigarro') || nl.includes('rosh') || nl.includes('narguile') || nl.includes('carvão') || nl.includes('abafador')) {
          categoria = 'Tabacaria';
        } else if (nl.includes('chocolate') || nl.includes('trident') || nl.includes('halls') || nl.includes('salgadinho') || nl.includes('fini') || nl.includes('mentos')) {
          categoria = 'Bomboniere';
        } else {
          categoria = 'Diversos';
        }
      }

      const imagemUrl = imgRaw ? imgRaw.split(',')[0].trim() : '';
      const descricao = stripHtml(descCurta || descLonga || '');

      produtosToInsert.push({
        wpId,
        ean: finalEan,
        nome: nome.slice(0, 255),
        precoVenda,
        precoCusto: 0,
        estoqueAtual,
        categoria: categoria.slice(0, 100),
        subcategoria: subcategoria.slice(0, 100),
        imagemUrl,
        descricao
      });
    }

    console.log(`[3/4] ${produtosToInsert.length} produtos preparados para inserção no Supabase.`);

    // Inserção em lotes de 100 para máxima performance
    const BATCH_SIZE = 100;
    let inseridos = 0;

    for (let i = 0; i < produtosToInsert.length; i += BATCH_SIZE) {
      const batch = produtosToInsert.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (const p of batch) {
        values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, true, $${pIdx++})`);
        params.push(p.ean, p.nome, p.precoCusto, p.precoVenda, p.estoqueAtual, p.categoria, p.subcategoria, p.imagemUrl, p.descricao, p.wpId);
      }

      const sql = `
        INSERT INTO produtos (ean, nome, preco_custo, preco_venda, estoque_atual, categoria, subcategoria, imagem_url, descricao, ativo, wp_id)
        VALUES ${values.join(', ')}
        ON CONFLICT (ean) DO UPDATE SET
          nome = EXCLUDED.nome,
          preco_venda = EXCLUDED.preco_venda,
          categoria = EXCLUDED.categoria,
          subcategoria = EXCLUDED.subcategoria,
          imagem_url = COALESCE(NULLIF(EXCLUDED.imagem_url, ''), produtos.imagem_url),
          descricao = COALESCE(NULLIF(EXCLUDED.descricao, ''), produtos.descricao),
          wp_id = EXCLUDED.wp_id
      `;

      await client.query(sql, params);
      inseridos += batch.length;
      process.stdout.write(`Inseridos ${inseridos}/${produtosToInsert.length}...\r`);
    }

    console.log(`\n[4/4] Importação para o Supabase concluída com sucesso! Total: ${inseridos}`);

    const { rows: stats } = await client.query(`
      SELECT categoria, count(*) as total, sum(estoque_atual) as estoque_total
      FROM produtos
      GROUP BY categoria
      ORDER BY total DESC;
    `);
    console.log('\n--- RESUMO DE PRODUTOS NO SUPABASE ---');
    console.table(stats);

    const { rows: totalGeral } = await client.query('SELECT count(*) as total_produtos, sum(estoque_atual) as total_unidades FROM produtos');
    console.log('Total Geral no Supabase:', totalGeral[0]);

  } catch (err) {
    console.error('ERRO na importação para Supabase:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
