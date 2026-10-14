'use strict';

const assert = require('assert');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const { Pool } = require('pg');
const { markProxyIps } = require('../scripts/mark_proxy_ips');
const execute = promisify(execFile);
const originalRanges = process.env.PROXY_LEGACY_CIDRS;
delete process.env.PROXY_LEGACY_CIDRS;

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
      ('/', '89.222.1.2', NULL), ('/', '79.127.1.2', NULL), ('/', '104.28.1.2', NULL),
      ('/', '212.102.1.2', NULL), ('/', '95.173.1.2', NULL),
      ('/', '203.0.113.8', NULL),
      ('/', '152.232.255.255', NULL), ('/', '152.234.0.0', NULL),
      ('/', '2001:db8::1', NULL), ('/', NULL, NULL),
      ('/', '84.17.1.3', 'proxy_legacy'), ('/', '84.17.1.4', 'x-forwarded-for')`);
    const before = await pool.query('SELECT * FROM analytics_events ORDER BY id');
    const dry = await markProxyIps(pool, { dryRun: true });
    assert.strictEqual(dry.total, 9);
    assert.strictEqual(dry.ranges.find(range => range.range === '152.233.0.0/16').count, 2);
    for (const range of ['84.17.0.0/16', '169.150.0.0/16', '89.222.0.0/16', '79.127.0.0/16', '104.28.0.0/16', '212.102.0.0/16', '95.173.0.0/16']) {
      assert.strictEqual(dry.ranges.find(row => row.range === range).count, 1);
    }
    const cliDry = await execute(process.execPath, ['scripts/mark_proxy_ips.js', '--dry-run'], options);
    assert(cliDry.stdout.includes('Dry run: would mark 9'));
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, before.rows);
    process.env.PROXY_LEGACY_CIDRS = ' 203.0.113.0/24 , 2001:db8::/32 ';
    const overrideDry = await markProxyIps(pool, { dryRun: true });
    assert.strictEqual(overrideDry.total, 2);
    assert.deepStrictEqual(overrideDry.ranges.map(row => row.range), ['203.0.113.0/24', '2001:db8::/32']);
    const overrideOptions = { ...options, env: { ...options.env, PROXY_LEGACY_CIDRS: process.env.PROXY_LEGACY_CIDRS } };
    const overrideCliDry = await execute(process.execPath, ['scripts/mark_proxy_ips.js', '--dry-run'], overrideOptions);
    assert(overrideCliDry.stdout.includes('Dry run: would mark 2'));
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, before.rows);
    const overrideApplied = await execute(process.execPath, ['scripts/mark_proxy_ips.js'], overrideOptions);
    assert(overrideApplied.stdout.includes('Marked 2 legacy proxy events'));
    const overridden = (await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows;
    assert.strictEqual(overridden.find(event => event.ip === '203.0.113.8').ip_source, 'proxy_legacy');
    assert.strictEqual(overridden.find(event => event.ip === '2001:db8::1').ip_source, 'proxy_legacy');
    assert.strictEqual(overridden.find(event => event.ip === '89.222.1.2').ip_source, null);
    assert.strictEqual((await markProxyIps(pool)).total, 0);
    process.env.PROXY_LEGACY_CIDRS = '';
    assert.strictEqual((await markProxyIps(pool)).total, 0);
    delete process.env.PROXY_LEGACY_CIDRS;
    const applied = await execute(process.execPath, ['scripts/mark_proxy_ips.js'], options);
    assert(applied.stdout.includes('Marked 9 legacy proxy events'));
    for (const range of ['152.233.0.0/16', '84.17.0.0/16', '169.150.0.0/16', '89.222.0.0/16', '79.127.0.0/16', '104.28.0.0/16', '212.102.0.0/16', '95.173.0.0/16']) assert(applied.stdout.includes(range));
    const after = (await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows;
    assert.strictEqual(after.filter(event => event.ip_source === 'proxy_legacy').length, 12);
    for (const ip of ['152.232.255.255', '152.234.0.0', null]) {
      assert.strictEqual(after.find(event => event.ip === ip).ip_source, null);
    }
    assert.strictEqual(after.find(event => event.ip === '84.17.1.4').ip_source, 'x-forwarded-for');
    assert.strictEqual((await markProxyIps(pool)).total, 0);
    assert.strictEqual((await markProxyIps(pool, { dryRun: true })).total, 0);
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, after);
    await pool.query(`INSERT INTO analytics_events (path, ip, ip_source) VALUES
      ('/', '198.51.100.10', NULL), ('/', '198.51.100.10', NULL),
      ('/', '198.51.100.11', NULL), ('/', '198.51.100.12', 'socket'),
      ('/', '95.173.2.3', NULL)`);
    await pool.query(`INSERT INTO ip_geolocation_cache (ip, asn_org, expires_at) VALUES
      ('198.51.100.10', 'AS60068 DaTaCaMp Limited', now() - interval '1 day'),
      ('198.51.100.11', 'Other Provider', now() + interval '1 day'),
      ('198.51.100.12', 'Datacamp', now() + interval '1 day'),
      ('95.173.2.3', 'Datacamp Limited', now() + interval '1 day')`);
    const beforeAsn = (await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows;
    const asnDry = await markProxyIps(pool, { dryRun: true });
    assert.strictEqual(asnDry.total, 3);
    assert.strictEqual(asnDry.asn_only, 2);
    assert.strictEqual(asnDry.asn_matches, 3);
    assert.strictEqual(asnDry.ranges.reduce((sum, range) => sum + range.count, 0), 1);
    const asnCliDry = await execute(process.execPath, ['scripts/mark_proxy_ips.js', '--dry-run'], options);
    assert(asnCliDry.stdout.includes('Dry run: would mark 3'));
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, beforeAsn);
    const asnApplied = await execute(process.execPath, ['scripts/mark_proxy_ips.js'], options);
    assert(asnApplied.stdout.includes('Marked 3 legacy proxy events'));
    assert(asnApplied.stdout.includes('ASN organization only (outside configured CIDRs): 2'));
    const afterAsn = (await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows;
    assert(afterAsn.filter(event => event.ip === '198.51.100.10').every(event => event.ip_source === 'proxy_legacy'));
    assert.strictEqual(afterAsn.find(event => event.ip === '198.51.100.11').ip_source, null);
    assert.strictEqual(afterAsn.find(event => event.ip === '198.51.100.12').ip_source, 'socket');
    assert.strictEqual(afterAsn.find(event => event.ip === null).ip_source, null);
    assert.strictEqual(afterAsn.find(event => event.ip === '95.173.2.3').ip_source, 'proxy_legacy');
    assert.strictEqual((await markProxyIps(pool)).total, 0);
    assert.strictEqual((await markProxyIps(pool, { dryRun: true })).total, 0);
    assert.deepStrictEqual((await pool.query('SELECT * FROM analytics_events ORDER BY id')).rows, afterAsn);
    await pool.query("INSERT INTO analytics_events (path, ip) VALUES ('/', '198.51.100.10')");
    process.env.PROXY_LEGACY_CIDRS = '';
    const onlyAsn = await markProxyIps(pool);
    assert.strictEqual(onlyAsn.total, 1);
    assert.strictEqual(onlyAsn.asn_only, 1);
    assert.deepStrictEqual(onlyAsn.ranges, []);
    console.log('Proxy marking integration passed: eight CIDRs, environment override, ASN union, case-insensitive matching, no double counting, unrelated IP exclusion, dry-run and idempotence');
  } finally {
    if (originalRanges === undefined) delete process.env.PROXY_LEGACY_CIDRS;
    else process.env.PROXY_LEGACY_CIDRS = originalRanges;
    if (pool) await pool.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
