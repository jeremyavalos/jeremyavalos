'use strict';

const assert = require('assert');
const { randomUUID, randomBytes } = require('crypto');
const { Resolver } = require('node:dns').promises;
assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must point to a disposable local PostgreSQL instance');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
delete process.env.RAILWAY_ENVIRONMENT_ID;
process.env.ADMIN_USERNAME = 'analytics-test';
process.env.ADMIN_PASSWORD_HASH = 'test-password';
delete process.env.IPINFO_TOKEN;
delete process.env.TRUSTED_PROXY_CIDRS;
const app = require('../src/index');
const db = require('../src/db');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const visitors = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const fingerprint = randomBytes(4).toString('hex');
  const track = (payload, headers = {}) => fetch(`${base}/api/analytics/track`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000)
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
    assert(stored.rows.every(event => event.ip === '198.51.100.7' && event.ip_source === 'cf-connecting-ip' && event.path === '/work' && event.utm_source === 'test'));
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
    const reviewVisitor = visitors[2];
    const historicalDate = '2026-01-01T10:00:00.000Z';
    const chromeOS = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
    const historical = await db.query(`INSERT INTO analytics_events
      (visitor_id, created_at, path, ref, event_type, user_agent, device_name, browser)
      VALUES ($1, $2, '/work', 'analytics-qa', 'page_view', $3, 'Unknown', 'Chrome') RETURNING *`,
      [reviewVisitor, historicalDate, chromeOS]);
    const reducedUa = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
    const hintTrack = await track({ visitor_id: reviewVisitor, path: '/work', ref: 'analytics-qa', utm_source: 'qa' }, {
      'user-agent': reducedUa,
      'sec-ch-ua': '"Chromium";v="140", "Microsoft Edge";v="140", "Not A Brand";v="99"',
      'sec-ch-ua-platform': '"Android"',
      'sec-ch-ua-mobile': '?0'
    });
    assert.equal(hintTrack.status, 200);
    const returning = await hintTrack.json();
    assert.equal(returning.returning_visitor, true);
    assert.equal(returning.returning_context.browser, 'Edge 140');
    const click = await track({ visitor_id: reviewVisitor, path: '/#contact', event_type: 'contact_opened' }, {
      'user-agent': 'ExampleClient/1.0'
    });
    assert.equal(click.status, 200);
    const spoof = await track({ visitor_id: reviewVisitor, path: '/work', ref: 'analytics-qa', event_type: 'page_view' }, {
      'user-agent': `${reducedUa} (compatible; Googlebot/2.1)`, 'x-forwarded-for': '66.249.66.1'
    });
    assert.equal(spoof.status, 200);
    const read = async path => {
      const response = await fetch(base + path, { headers, signal: AbortSignal.timeout(3000) });
      assert.equal(response.status, 200, path);
      return response.json();
    };
    const overview = (await read('/api/admin/overview')).overview;
    const detailed = (await read(`/api/admin/visitors/${reviewVisitor}`)).visitor;
    assert.equal(detailed.total_visits, 4);
    assert.equal(detailed.session_count, 2);
    assert.deepEqual(detailed.sessions.map(session => session.event_count), [1, 3]);
    assert.equal(detailed.latest_device.identification.device_name, 'Unknown');
    assert.match(detailed.latest_device.identification.reasons.browser, /declares a crawler/);
    assert.equal(detailed.latest_device.traffic.traffic, 'Suspected Automation');
    assert.match(detailed.latest_device.traffic.why, /No trusted/);
    assert.equal(detailed.recent_visits[1].traffic.traffic, 'Likely Human');
    assert.equal(detailed.recent_visits[2].traffic.traffic, 'Unknown');
    assert.deepEqual(detailed.last_device_recognized, { value: 'ChromeOS device', created_at: historicalDate });
    assert.equal(detailed.last_browser_recognized.value, 'Edge');
    assert.equal(detailed.last_browser_recognized.version, '140');
    assert(detailed.last_seen > detailed.last_browser_recognized.created_at);
    assert.equal(detailed.acquisition.ref, 'analytics-qa');
    assert.equal(detailed.recent_source.source, 'qa');
    const listed = (await read('/api/admin/visitors')).visitors.find(visitor => visitor.visitor_id === reviewVisitor);
    assert.equal(listed.traffic.traffic, 'Suspected Automation');
    assert.equal(listed.visits, 4);
    const attribution = await read('/api/admin/tracking/analytics-qa');
    assert.equal(attribution.pagination.total, 3);
    assert(attribution.referral.events.some(event => event.utm_source === 'qa' && event.identification.browser === 'Edge'));
    assert.equal((await read('/api/admin/ips/66.249.66.1')).ip.events[0].traffic.traffic, 'Suspected Automation');
    assert.deepStrictEqual((await read('/api/admin/overview')).overview, overview);
    assert.deepStrictEqual((await db.query('SELECT * FROM analytics_events WHERE id = $1', [historical.rows[0].id])).rows, historical.rows);
    console.log('Identification, historical read-only projection, dashboard, attribution, sessions and returning visits passed');

    const parserVisitor = visitors[3];
    const parserCases = [
      ['firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0', 'Linux PC', 'Firefox'],
      ['safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15', 'Mac', 'Safari'],
      ['empty', '', 'Unknown', 'Unknown'],
      ['tv', reducedUa.replace('Android 10; K', 'Android 12; TV'), 'Android TV', 'Chrome'],
      ['samsung', `${reducedUa} SamsungBrowser/24.0`, 'Unknown', 'Samsung Internet'],
      ['android-webview', reducedUa.replace('Android 10; K', 'Android 13; wv'), 'Unknown', 'Android WebView'],
      ['ios-webview', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', 'iPhone', 'iOS WebView'],
      ['headless', 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/140.0.0.0', 'Linux PC', 'Headless Chrome']
    ];
    for (const [path, ua] of parserCases) {
      const response = await track({ visitor_id: parserVisitor, path: `/${path}` }, { 'user-agent': ua });
      assert.equal(response.status, 200, path);
    }
    const parserProfile = (await read(`/api/admin/visitors/${parserVisitor}`)).visitor;
    for (const [path, , device, browser] of parserCases) {
      const event = parserProfile.recent_visits.find(entry => entry.path === `/${path}`);
      assert.equal(event.device_name, device, path);
      assert.equal(event.browser, browser, path);
      assert.equal(event.identification.device_name, device, path);
      assert.equal(event.identification.browser, browser, path);
    }
    assert.equal(parserProfile.recent_visits.find(event => event.path === '/headless').traffic.traffic, 'Suspected Automation');
    // Seed a direct peer and stub DNS to test the verified path without external requests.
    const originalReverse = Resolver.prototype.reverse;
    const originalResolve4 = Resolver.prototype.resolve4;
    let releaseDns;
    const dnsGate = new Promise(resolve => { releaseDns = resolve; });
    try {
      Resolver.prototype.reverse = async ip => {
        assert.equal(ip, '66.249.66.1');
        await dnsGate;
        return ['crawl-66-249-66-1.googlebot.com'];
      };
      Resolver.prototype.resolve4 = async hostname => {
        assert.equal(hostname, 'crawl-66-249-66-1.googlebot.com');
        return ['66.249.66.1'];
      };
      await db.query(`INSERT INTO analytics_events (visitor_id, path, ip, ip_source, user_agent)
        VALUES ($1, '/verified-test', '66.249.66.1', 'socket', 'Googlebot/2.1')`, [parserVisitor]);
      const profileUrl = `/api/admin/visitors/${parserVisitor}`;
      const firstRead = (await read(profileUrl)).visitor;
      assert.match(firstRead.latest_device.traffic.why, /pending/);
      assert.equal((await track({ visitor_id: parserVisitor, path: '/nonblocking', event_type: 'contact_opened' })).status, 200);
      assert.match((await read(profileUrl)).visitor.recent_visits.find(event => event.path === '/verified-test').traffic.why, /pending/);
      releaseDns();
      const verified = (await read(profileUrl)).visitor;
      const verifiedBot = verified.recent_visits.find(event => event.path === '/verified-test');
      assert.equal(verifiedBot.traffic.traffic, 'Known Bot');
      assert.equal(verifiedBot.traffic.confidence, 'High');
      assert.equal((await read(`/api/admin/visitors/${reviewVisitor}`)).visitor.latest_device.traffic.traffic, 'Suspected Automation');
    } finally {
      releaseDns();
      Resolver.prototype.reverse = originalReverse;
      Resolver.prototype.resolve4 = originalResolve4;
    }
    console.log('Browser ingestion cases and verified bot projection with isolated DNS fixtures passed');

    const historyVisitor = randomUUID();
    visitors.push(historyVisitor);
    await db.query(`INSERT INTO analytics_events (visitor_id, path, event_type, created_at, user_agent)
      SELECT $1, '/bulk/' || n, 'page_view', '2026-01-02 10:00:00+00'::timestamptz + n * interval '1 second',
        CASE WHEN n = 1 THEN $2 ELSE NULL END
      FROM generate_series(1, 250) n`, [historyVisitor, chromeOS]);
    const profilePath = `/api/admin/visitors/${historyVisitor}`;
    const newest = (await read(profilePath)).visitor;
    const oldest = (await read(`${profilePath}?history_page=3`)).visitor;
    assert.deepEqual(newest.history_pagination, { page: 1, page_size: 100, pages: 3, total: 250 });
    assert.equal(newest.recent_visits[0].path, '/bulk/250');
    assert.equal(oldest.recent_visits.at(-1).path, '/bulk/1');
    assert.equal(newest.last_device_recognized.value, 'ChromeOS device');
    for (const [page, visible] of [[newest, 100], [oldest, 50]]) {
      assert.equal(page.total_visits, 250);
      assert.equal(page.session_count, 1);
      assert.equal(page.sessions[0].event_count, 250);
      assert.equal(page.sessions[0].events.length, visible);
      assert.equal(page.recent_visits.length, visible);
    }
    console.log('History pagination preserves full profile and session counts and older identification');



    process.env.TRUSTED_PROXY_CIDRS = '127.0.0.1/32,100.64.0.0/10';
    const cases = [
      [{ 'cf-connecting-ip': '192.0.2.10', 'x-forwarded-for': '192.0.2.11' }, '192.0.2.10', 'cf-connecting-ip'],
      [{ 'x-forwarded-for': '192.0.2.99, 192.0.2.11, 100.64.0.1' }, '192.0.2.11', 'x-forwarded-for'],
      [{ 'cf-connecting-ip': 'bad', 'x-forwarded-for': 'bad', 'x-real-ip': '192.0.2.12' }, '192.0.2.12', 'x-real-ip'],
      [{}, '127.0.0.1', 'socket']
    ];
    for (const [requestHeaders, ip, source] of cases) {
      const response = await track({ visitor_id: visitors[1], path: '/ip-source-check', ip_source: 'proxy_legacy' }, requestHeaders);
      assert.strictEqual(response.status, 200);
      await response.json();
      const latest = await db.query('SELECT ip, ip_source FROM analytics_events WHERE visitor_id = $1 ORDER BY id DESC LIMIT 1', [visitors[1]]);
      assert.deepStrictEqual(latest.rows[0], { ip, ip_source: source });
    }
    await db.query(`INSERT INTO analytics_events (path, visitor_id, ip, ip_source) VALUES
      ('/', $1, '152.233.1.1', 'proxy_legacy'), ('/', $1, '152.233.1.1', 'proxy_legacy'),
      ('/', $1, '152.233.1.2', 'proxy_legacy'), ('/', $1, '152.233.1.2', NULL),
      ('/', $1, '152.233.1.3', 'proxy_legacy'), ('/', $1, '152.233.1.3', 'x-forwarded-for')`, [visitors[0]]);
    const list = await (await fetch(`${base}/api/admin/ips?page_size=100`, { headers })).json();
    assert.strictEqual(list.ips.find(row => row.ip === '152.233.1.1').proxy_legacy, true);
    assert.strictEqual(list.ips.find(row => row.ip === '152.233.1.2').proxy_legacy, false);
    assert.strictEqual(list.ips.find(row => row.ip === '152.233.1.3').proxy_legacy, false);
    console.log('IP source integration passed: all sources, spoofed XFF, and proxy badges for all-legacy versus mixed histories');
    console.log('Analytics PostgreSQL integration passed: IP priority, query removal, legacy clients, fingerprint storage, authorization, profile and pagination');
  } finally {
    delete process.env.TRUSTED_PROXY_CIDRS;
    await db.query('DELETE FROM analytics_events WHERE visitor_id = ANY($1::uuid[])', [visitors]);
    await new Promise(resolve => server.close(resolve));
    await db.pool.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
