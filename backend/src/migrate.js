require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error('Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  try {
    // Ensure migrations table exists
    await client.query(`CREATE TABLE IF NOT EXISTS migrations_applied (id serial primary key, filename text UNIQUE, applied_at timestamptz DEFAULT now())`);

    // Read migration files and sort deterministically
    let files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    files = files.sort();
    // Ensure init.sql runs first if present
    const initIndex = files.indexOf('init.sql');
    if (initIndex > -1) {
      files.splice(initIndex, 1);
      files.unshift('init.sql');
    }

    const appliedRes = await client.query('SELECT filename FROM migrations_applied');
    const applied = new Set(appliedRes.rows.map(r => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log('Skipping already applied migration:', file);
        continue;
      }
      const p = path.join(migrationsDir, file);
      console.log('Applying migration:', file);
      const sql = fs.readFileSync(p, 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations_applied (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
        await client.query('COMMIT');
        console.log('Applied:', file);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', file, err);
        throw err;
      }
    }

    console.log('All migrations processed');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
