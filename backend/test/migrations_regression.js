'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must point to a disposable local PostgreSQL instance');
  const connection = new URL(process.env.TEST_DATABASE_URL);
  const admin = new Pool({ connectionString: connection.href });
  const database = `migration_test_${process.pid}_${Date.now()}`;
  let pool;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    connection.pathname = `/${database}`;
    const options = { cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: connection.href, PGSSLMODE: '' }, encoding: 'utf8' };
    const first = execFileSync(process.execPath, ['src/migrate.js'], options);
    assert(first.includes('All migrations processed'));
    const second = execFileSync(process.execPath, ['src/migrate.js'], options);
    assert(!second.includes('Applying migration:'));
    pool = new Pool({ connectionString: connection.href });
    const applied = await pool.query('SELECT COUNT(*) FROM migrations_applied');
    const files = fs.readdirSync(path.join(__dirname, '..', 'migrations')).filter(file => file.endsWith('.sql'));
    assert.strictEqual(Number(applied.rows[0].count), files.length);
    const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'analytics_events'");
    assert(indexes.rows.some(row => row.indexname === 'analytics_events_visitor_created_idx'));
    await pool.query('SELECT ip, ip_source, visitor_id, event_type, device_name FROM analytics_events LIMIT 0');
    console.log('Empty database migrations and repeat-run regression checks passed');
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
