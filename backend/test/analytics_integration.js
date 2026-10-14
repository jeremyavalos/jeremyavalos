'use strict';

const assert = require('assert');
const { randomUUID, randomBytes } = require('crypto');
assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must point to a disposable local PostgreSQL instance');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = 'analytics-test';
process.env.ADMIN_PASSWORD_HASH = 'test-password';
delete process.env.IPINFO_TOKEN;
const app = require('../src/index');
const db = require('../src/db');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const visitors = [randomUUID(), randomUUID()];
  const fingerprint = randomBytes(4).toString('hex');
  const track = (payload, headers = {}) => fetch(`${base}/api/analytics/track`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload)
  });
  try {
    for (let index = 0; index < 12; index++) {
      const response = await track({ visitor_id: visitors[index % 2], fingerprint, path: '/work?token=secret', utm_source: 'test' },
        { 'cf-connecting-ip': '198.51.100.7', 'x-real-ip': '203.0.113.3', 'x-forwarded-for': '192.0.2.1, 192.0.2.2' });
      assert.strictEqual(response.status, 200);
      await response.json();
    }
    const stored = await db.query('SELECT * FROM analytics_events WHERE fingerprint = $1', [fingerprint]);
    assert.strictEqual(stored.rows.length, 12);
    assert(stored.rows.every(event => event.ip === '198.51.100.7' && event.path === '/work' && event.utm_source === 'test'));
    assert.strictEqual((await track({ visitor_id: visitors[0], fingerprint: 'invalid' })).status, 400);
    const legacy = await track({ visitor_id: visitors[0], path: '/' }, { 'x-forwarded-for': '192.0.2.1, 192.0.2.2' });
    assert.strictEqual(legacy.status, 200);
    await legacy.json();
    const legacyRow = await db.query('SELECT ip, fingerprint FROM analytics_events WHERE visitor_id = $1 AND fingerprint IS NULL', [visitors[0]]);
    assert.strictEqual(legacyRow.rows[0].ip, '192.0.2.1');
    assert.strictEqual(legacyRow.rows[0].fingerprint, null);
    assert.strictEqual((await fetch(`${base}/api/admin/fingerprint/${fingerprint}`)).status, 403);
    const login = await fetch(`${base}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD_HASH }) });
    assert.strictEqual(login.status, 200);
    const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
    const result = await fetch(`${base}/api/admin/fingerprint/${fingerprint}?page_size=10`, { headers });
    assert.strictEqual(result.status, 200);
    const data = await result.json();
    assert.strictEqual(data.visitors.length, 2);
    assert.strictEqual(data.events.length, 10);
    assert.strictEqual(data.pagination.total, 12);
    const second = await (await fetch(`${base}/api/admin/fingerprint/${fingerprint}?page_size=10&page=2`, { headers })).json();
    assert.strictEqual(second.events.length, 2);
    assert(!second.events.some(event => data.events.some(first => first.id === event.id)));
    assert.strictEqual((await fetch(`${base}/api/admin/fingerprint/invalid`, { headers })).status, 400);
    const profile = await (await fetch(`${base}/api/admin/visitors/${visitors[0]}`, { headers })).json();
    assert(profile.visitor.recent_visits.some(event => event.fingerprint === fingerprint));
    console.log('Analytics PostgreSQL integration passed: IP priority, query removal, legacy clients, fingerprint storage, authorization, profile and pagination');
  } finally {
    await db.query('DELETE FROM analytics_events WHERE visitor_id = ANY($1::uuid[])', [visitors]);
    await new Promise(resolve => server.close(resolve));
    await db.pool.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
