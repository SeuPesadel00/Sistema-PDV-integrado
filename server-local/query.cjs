const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: '127.0.0.1', database: 'Tailandia_db', password: 'Tailandia@2026', port: 6666 });
pool.query('SELECT matricula, nome, nivel_acesso, status FROM funcionarios;').then(res => { console.table(res.rows); process.exit(0); });
