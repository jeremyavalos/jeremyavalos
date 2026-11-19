'use strict';
const assert = require('node:assert/strict');
const { randomBytes, randomUUID, createHash, createHmac } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

assert(process.env.TEST_DATABASE_URL, 'Disposable PostgreSQL required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.ANALYTICS_HMAC_SECRET = randomBytes(32).toString('hex');
process.env.ANALYTICS_REQUIRE_GATEWAY = '1';
process.env.IPINFO_TOKEN = 'test-placeholder';
process.env.ADMIN_USERNAME = 'gateway-test';
process.env.ADMIN_PASSWORD_HASH = 'local-only';
const request = global.fetch;
const queried = new Set();
global.fetch = async url => {
  const address = new URL(url);
  assert.equal(address.origin, 'https://ipinfo.io');
  queried.add(decodeURIComponent(address.pathname.split('/')[1]));
  return Response.json({ city: 'Cancún', region: 'Quintana Roo', country: 'MX', org: 'AS64501 Test ISP' });
};
const app = require('../src/index');
global.fetch = request;
const db = require('../src/db');
const gateway = require('../src/analyticsGateway');
const key = Buffer.from(process.env.ANALYTICS_HMAC_SECRET, 'hex');
const publicOrigin = 'https://portal.test';
const railwayOrigin = 'https://railway.test';
const testIp = '198.51.100.53';
const otherIp = '2001:db8:5555::27';
const visitors = [randomUUID(), randomUUID(), randomUUID()];

function signature(body, ip = testIp, options = {}) {
  const time = options.time || String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce || randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(body).digest('hex');
  const signed = createHmac('sha256', key).update(JSON.stringify([
    'portfolio-analytics-v1', options.method || 'POST', options.path || gateway.ingestPath, time, nonce, ip, hash
  ])).digest('hex');
  return { 'Content-Type': 'application/json', 'X-Analytics-IP': ip, 'X-Analytics-Time': time,
    'X-Analytics-Nonce': nonce, 'X-Analytics-Signature': signed };
}

function event(visitor = visitors[0], extra = {}) {
  return { event_id: randomUUID(), event_type: 'page_view', path: '/work', visitor_id: visitor,
    fingerprint: 'a1b2c3d4', ref: 'gateway-qa', utm_source: 'staging', ...extra };
}

async function listen(server) {
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  return 'http://127.0.0.1:' + server.address().port;
}

(async () => {
  const { createGateway } = await import('../../api/analytics.mjs');
  const railway = createServer(app);
  const railwayBase = await listen(railway);
  const send = (body, headers, suffix = gateway.ingestPath) => request(railwayBase + suffix, {
    method: 'POST', headers, body, signal: AbortSignal.timeout(6000)
  });
  const encode = input => JSON.stringify({ event: input, client: { 'user-agent': 'Chrome/145.0.0.0' } });
  const env = { ANALYTICS_PUBLIC_ORIGIN: publicOrigin, ANALYTICS_RAILWAY_ORIGIN: railwayOrigin,
    ANALYTICS_HMAC_SECRET: process.env.ANALYTICS_HMAC_SECRET };
  const relay = (url, options) => request(railwayBase + url.pathname, options);
  const handler = createGateway(env, relay);
  const forward = (input, headerOverrides = {}, impl = handler) => impl(new Request(publicOrigin + '/api/analytics', {
    method: 'POST', headers: { Origin: publicOrigin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json',
      'X-Real-IP': testIp, Cookie: 'visitor_id=' + input.visitor_id, ...headerOverrides },
    body: JSON.stringify(input)
  }));
  try {
    delete process.env.ANALYTICS_REQUIRE_GATEWAY;
    const legacyEvent = event(visitors[2]);
    delete legacyEvent.event_id;
    assert.equal((await send(JSON.stringify(legacyEvent), { 'Content-Type': 'application/json' }, '/api/analytics/track')).status, 200);
    const overlap = await forward(event(visitors[2]));
    assert.equal(overlap.status, 200);
    assert.equal((await overlap.json()).returning_visitor, true);
    process.env.ANALYTICS_REQUIRE_GATEWAY = '1';
    assert.equal((await send(JSON.stringify(legacyEvent), { 'Content-Type': 'application/json' }, '/api/analytics/track')).status, 401);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM analytics_events WHERE visitor_id=$1', [visitors[2]])).rows[0].n, 2);

    const raw = encode(event());
    const auth = signature(raw);
    assert.equal((await send(raw, { 'Content-Type': 'application/json' })).status, 401);
    assert.equal((await send(raw, { 'Content-Type': 'application/json', 'X-Real-IP': testIp }, '/api/analytics/track')).status, 401);
    assert.equal((await send(raw, { ...auth, 'X-Analytics-Signature': '0'.repeat(64) })).status, 401);
    assert.equal((await send(raw + ' ', auth)).status, 401);
    assert.equal((await send(raw, { ...auth, 'X-Analytics-IP': otherIp })).status, 401);
    assert.equal((await send(raw, { ...auth, 'X-Analytics-Nonce': randomBytes(16).toString('hex') })).status, 401);
    assert.equal((await send(raw, signature(raw, testIp, { method: 'GET' }))).status, 401);
    assert.equal((await send(raw, auth, gateway.ingestPath + '?modified=1')).status, 401);
    for (const shift of [-60, 60]) {
      assert.equal((await send(raw, signature(raw, testIp, { time: String(Math.floor(Date.now()/1000) + shift) }))).status, 401);
    }
    assert.equal((await send(raw, { ...auth, 'Content-Encoding': 'gzip' })).status, 415);
    assert.equal((await send('x'.repeat(8193), auth)).status, 413);
    assert.equal((await send(raw, { ...auth, 'X-Forwarded-For': otherIp, 'CF-Connecting-IP': otherIp })).status, 200);
    assert.equal((await send(raw, auth)).status, 409);
    assert.equal((await send(raw, signature(raw))).status, 200);
    const changed = encode({ ...JSON.parse(raw).event, path: '/changed' });
    assert.equal((await send(changed, signature(changed))).status, 409);

    const concurrent = encode(event(visitors[1]));
    const sameNonce = signature(concurrent);
    const replays = await Promise.all(Array.from({ length: 4 }, () => send(concurrent, sameNonce)));
    assert.deepEqual(replays.map(r => r.status).sort(), [200,409,409,409]);
    const independent = await Promise.all(Array.from({ length: 5 }, () => send(concurrent, signature(concurrent))));
    assert(independent.every(r => r.status === 200));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM analytics_events WHERE visitor_id=$1", [visitors[1]])).rows[0].n, 1);

    const submitted = event();
    assert.equal((await forward({ ...submitted, ip: otherIp })).status, 400);
    assert.equal((await forward(submitted, { 'X-Real-IP': testIp + ', ' + otherIp })).status, 400);
    assert.equal((await forward(submitted, { Origin: 'https://foreign.test' })).status, 403);
    assert.equal((await forward(submitted, { Cookie: 'visitor_id=' + visitors[1] })).status, 400);
    assert.equal((await forward(submitted, { 'Content-Length': '9000' })).status, 413);

    // Lose the HTTP response after the database has committed, then retry the same event ID.
    const loseResponse = createGateway(env, async (url, options) => {
      const accepted = await relay(url, options);
      assert.equal(accepted.status, 200);
      await accepted.arrayBuffer();
      throw Error('simulated connection loss');
    });
    assert.equal((await forward(submitted, {}, loseResponse)).status, 503);
    const retry = await forward(submitted, { 'X-Real-IP': otherIp, 'X-Analytics-IP': '203.0.113.88', 'X-Forwarded-For': '203.0.113.88' });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).returning_visitor, true);
    const binding = retry.headers.get('set-cookie');
    assert.match(binding, /__Host-analytics-visitor=/);
    assert.match(binding, /Secure; HttpOnly; SameSite=Lax/);
    const cookie = binding.split(';')[0];
    assert.equal((await forward(event(visitors[1]), { Cookie: 'visitor_id=' + visitors[1] + '; ' + cookie })).status, 400);
    const v6 = await forward(event(), { 'X-Real-IP': otherIp, Cookie: 'visitor_id=' + visitors[0] + '; ' + cookie });
    assert.equal(v6.status, 200);
    assert.equal((await v6.json()).returning_visitor, true);

    for (let i = 0; i < 100; i++) {
      const r = await db.query('SELECT city FROM analytics_events WHERE visitor_id=$1', [visitors[0]]);
      if (r.rows.length === 3 && r.rows.every(row => row.city === 'Cancún')) break;
      if (i === 99) assert.fail('geolocation did not finish');
      await delay(20);
    }
    const stored = await db.query('SELECT ip, ip_source, fingerprint, ref, utm_source, city, region, country, asn_org FROM analytics_events WHERE visitor_id=$1 ORDER BY id', [visitors[0]]);
    assert.deepEqual(stored.rows.map(row => row.ip), [testIp, testIp, otherIp]);
    assert(stored.rows.every(row => row.ip_source === 'vercel-gateway' && row.fingerprint === 'a1b2c3d4' &&
      row.ref === 'gateway-qa' && row.utm_source === 'staging' && row.country === 'MX' &&
      row.region === 'Quintana Roo' && row.asn_org === 'AS64501 Test ISP'));
    assert(queried.has(testIp) && queried.has(otherIp));

    // Atomic threshold on one IPv6 /64 across concurrent invocations.
    const untilNextMinute = 60000 - Date.now() % 60000;
    if (untilNextMinute < 2500) await delay(untilNextMinute + 100);
    const rate = await Promise.all(Array.from({ length: 125 }, (_, i) => db.transaction(
      client => gateway.allowNetwork(client, '2001:db8:1234:5678::' + (i + 1).toString(16), key)
    )));
    assert.equal(rate.filter(Boolean).length, 120);

    const login = await request(railwayBase + '/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD_HASH })
    });
    assert.equal(login.status, 200);
    const authHeaders = { Cookie: login.headers.get('set-cookie').split(';')[0] };
    for (const visitor of visitors) {
      const profile = await request(railwayBase + '/api/admin/visitors/' + visitor, { headers: authHeaders });
      assert.equal(profile.status, 200);
      assert.equal((await profile.json()).visitor.session_count, 1);
    }

    if (process.env.STAGING_PLAYWRIGHT) {
      const { chromium } = require(process.env.STAGING_PLAYWRIGHT);
      let origin;
      let browser;
      let loseFirstPageResponse = true;
      const web = createServer(async (req, res) => {
        try {
          if (req.url === '/api/analytics') {
            // This adapter simulates Vercel replacing any caller-supplied address.
            const headers = new Headers(req.headers);
            headers.set('X-Real-IP', testIp);
            const result = await createGateway({ ...env, ANALYTICS_PUBLIC_ORIGIN: origin }, relay)(
              new Request(origin + req.url, { method: req.method, headers, body: req, duplex: 'half' })
            );
            const body = Buffer.from(await result.arrayBuffer());
            if (loseFirstPageResponse && result.status === 200 && 'returning_visitor' in JSON.parse(body)) {
              loseFirstPageResponse = false;
              return res.writeHead(503).end();
            }
            res.writeHead(result.status, Object.fromEntries(result.headers));
            res.end(body);
          } else {
            const name = new URL(req.url, origin).pathname === '/' ? 'index.html' : new URL(req.url, origin).pathname.slice(1);
            const resolved = path.resolve(__dirname, '../..', name);
            if (!resolved.startsWith(path.resolve(__dirname, '../..') + path.sep) || !/\.(html|js|css)$/.test(name)) {
              return res.writeHead(404).end();
            }
            const source = await fs.readFile(resolved);
            const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
            res.writeHead(200, { 'Content-Type': mime[path.extname(name)] }).end(source);
          }
        } catch {
          res.writeHead(500).end();
        }
      });
      origin = await listen(web);
      try {
        browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
        const context = await browser.newContext();
        await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        const page = await context.newPage();
        async function visit() {
          const response = page.waitForResponse(r => r.url() === origin + '/api/analytics' && r.status() === 200 &&
            r.request().postDataJSON()?.event_type === 'page_view');
          await page.goto(origin + '/?ref=gateway-browser&utm_source=local');
          const result = await response;
          assert.equal(result.status(), 200);
          return result.json();
        }
        assert.equal((await visit()).returning_visitor, false);
        assert.equal((await visit()).returning_visitor, true);
        const data = await db.query("SELECT ip, visitor_id, ip_source, utm_source FROM analytics_events WHERE ref='gateway-browser' ORDER BY id");
        assert.equal(data.rows.length, 2);
        assert.equal(data.rows[0].visitor_id, data.rows[1].visitor_id);
        assert(data.rows.every(row => row.ip === testIp && row.ip_source === 'vercel-gateway' && row.utm_source === 'local'));
        assert((await context.cookies()).some(cookie => cookie.name === '__Host-analytics-visitor' && cookie.secure && cookie.httpOnly));
        console.log('Chromium staging passed: real browser, gateway, authenticated Railway route and PostgreSQL');
      } finally {
        await browser?.close();
        await new Promise(resolve => web.close(resolve));
      }
    }
    console.log('Gateway HMAC, payload integrity, replay, private bypass, IPv4/IPv6, limits, lost response and geolocation passed');
  } finally {
    await db.query('DELETE FROM analytics_events WHERE visitor_id = ANY($1::uuid[]) OR ref = $2', [visitors, 'gateway-browser']);
    await new Promise(resolve => railway.close(resolve));
    await db.pool.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
