const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
}

// Configure SSL for Railway/Postgres when PGSSLMODE is set (e.g. require)
// Scope SSL behavior to the pg client only; do NOT disable global TLS verification.
const sslOption = process.env.PGSSLMODE ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString, ssl: sslOption });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  // helper to run transactions
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};
