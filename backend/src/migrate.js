require('dotenv').config();
const fs = require('fs');
const { Pool } = require('pg');

async function run() {
  const sqlPath = __dirname + '/../migrations/init.sql';
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migrations applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
