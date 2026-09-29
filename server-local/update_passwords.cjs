const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'tailandia_local',
  password: '',
  port: 5432,
});

async function run() {
  const { rows } = await pool.query('SELECT id, senha FROM funcionarios');
  for (let func of rows) {
    if (!func.senha.startsWith('$2')) { // Verifica se já não é bcrypt
      const hash = bcrypt.hashSync(func.senha, 10);
      await pool.query('UPDATE funcionarios SET senha = $1 WHERE id = $2', [hash, func.id]);
      console.log(`Senha do usuário ID ${func.id} atualizada com criptografia bcrypt.`);
    }
  }
  console.log("Feito!");
  process.exit(0);
}
run();
