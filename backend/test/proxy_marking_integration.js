'use strict';

const assert = require('assert');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { Pool } = require('pg');
const { markProxyIps } = require('../scripts/mark_proxy_ips');
const execute = promisify(execFile);

(async () => {
  assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must point to a disposable local PostgreSQL instance');
  const connection = new URL(process.env.TEST_DATABASE_URL);
  const admin = new Pool({ connectionString: connection.href });
  const database = `proxy_marking_test_${process.pid}_${Date.now()}`;
  let pool;
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    connection.pathname = `/${database}`;
    const options = { cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: connection.href, PGSSLMODE: '' } };
    await execute(process.execPath, ['src/migrate.js'], options);
    pool = new Pool({ connectionString: connection.href });
    await pool.query(`INSERT INTO analytics_events (path, ip, ip_source) VALUES
      ('/', '152.233.0.0', NULL), ('/', '152.233.255.255', NULL),
      ('/', '84.17.1.2', NULL), ('/', '169.150.1.2', NULL),
      ('/', '152.232.255.255', NULL), ('/', '152.234.0.0', NULL),
      ('/', '2001:db8::1', NULL), ('/', NULL, NULL),
      ('/', '84.17.1.3', 'proxy_legacy'), ('/', '84.17.1.4', 'x-forwarded-for')`);
    const before = await pool.query('SELECT * FROM analytics_events ORDER BY id');
    const dry = await markProxyIps(pool, { dryRun: true });
    assert.strictEqual(dry.total, 4);
    assert.strictEqual(dry.ranges.find(range => range.range === '152.233.0.0/16').count, 2);
    const cliDry = await execute(process.execPath, ['scripts/mark_proxy_ips.js', '--dry-run'], options);
    assert(cliDry.stdout.includes('Dry run: would mark 4'));
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, before.rows);
    const applied = await execute(process.execPath, ['scripts/mark_proxy_ips.js'], options);
    assert(applied.stdout.includes('Marked 4 legacy proxy events'));
    for (const range of ['152.233.0.0/16', '84.17.0.0/16', '169.150.0.0/16']) assert(applied.stdout.includes(range));
    const after = (await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows;
    assert.strictEqual(after.filter(event => event.ip_source === 'proxy_legacy').length, 5);
    assert.strictEqual(after.find(event => event.ip === '84.17.1.4').ip_source, 'x-forwarded-for');
    assert.strictEqual((await markProxyIps(pool)).total, 0);
    assert.strictEqual((await markProxyIps(pool, { dryRun: true })).total, 0);
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, after);
    console.log('Proxy marking integration passed: CIDR boundaries, dry-run CLI, summary, historical-only updates and idempotence');
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
