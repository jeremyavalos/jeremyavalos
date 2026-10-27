'use strict';

const assert = require('assert');

process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = 'admin-test';
process.env.ADMIN_PASSWORD_HASH = 'test-password';
process.env.SESSION_SECRET = 'session-test-secret';
process.env.DATABASE_URL = 'postgres://test:test@127.0.0.1:5432/test';

const db = require('../src/db');
db.query = async sql => {
  assert(sql.includes('FROM analytics_events'), 'Overview queried a non-analytics table');
  assert(!/\b(?:FROM|JOIN)\s+(?:challenges|games|moves)\b/i.test(sql), 'Overview remains coupled to game tables');
  return { rows: [{ total_visits: '6', visits_today: '2', visitors: '2', ips_observed: '2', unidentified_visits: '1' }] };
};
const app = require('../src/index');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => fetch(base + url, options);

  try {
    assert.strictEqual((await request('/api/admin/overview')).status, 403);

    const login = await request('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD_HASH })
    });
    assert.strictEqual(login.status, 200);
    await login.json();
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const headers = { Cookie: cookie };

    const dashboard = await request('/admin', { headers });
    const html = await dashboard.text();
    assert(dashboard.ok);
    const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1];
    assert(csrfToken, 'Admin dashboard did not provide a CSRF token');
    assert(html.includes('VISITORS') && html.includes('IPS OBSERVED') && html.includes('TRACKING / INTERACTIONS'));
    for (const term of ['CHALLENGES', 'MY TURN', 'WAITING', 'COMPLETED', 'match.js', 'admin/open']) {
      assert(!html.toLowerCase().includes(term.toLowerCase()), `Game UI remains in admin HTML: ${term}`);
    }

    const dashboardAsset = html.match(/<script src="([^"]*dashboard\.js[^"]*)"/)?.[1];
    assert(dashboardAsset?.includes('?v='), 'Admin dashboard script is not versioned');
    const script = await request(dashboardAsset, { headers });
    const dashboardJs = await script.text();
    assert(script.ok && dashboardJs.includes('/api/admin/visitors') && dashboardJs.includes('/api/admin/ips'));
    assert(!/challenges|gamertag|loadChallenges|admin\/open/i.test(dashboardJs), 'Game UI remains in admin script');
    assert.strictEqual(script.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate');
    const stylesheetAsset = html.match(/<link rel="stylesheet" href="([^"]*admin\.css[^"]*)"/)?.[1];
    assert(stylesheetAsset, 'Admin dashboard stylesheet is missing');
    const stylesheet = await request(stylesheetAsset, { headers });
    const dashboardCss = await stylesheet.text();
    assert(stylesheet.ok && !/match-layout|chess|board|gamertag/i.test(dashboardCss), 'Game styling remains in admin stylesheet');

    const overviewResponse = await request('/api/admin/overview', { headers });
    assert.strictEqual(overviewResponse.status, 200);
    assert.deepStrictEqual(await overviewResponse.json(), {
      overview: { total_visits: 6, visits_today: 2, visitors: 2, ips_observed: 2, unidentified_visits: 1 }
    });
    assert.strictEqual((await request('/api/challenges', { headers })).status, 404);
    assert.strictEqual((await request('/api/admin/challenges', { headers })).status, 404);
    assert.strictEqual((await request('/api/admin/overview', { method: 'POST', headers })).status, 404);
    assert.strictEqual((await request('/admin/logout', { method: 'POST', headers })).status, 403);
    assert.strictEqual((await request('/admin/logout', {
      method: 'POST', headers: { ...headers, 'x-csrf-token': csrfToken }
    })).status, 200);
    console.log('Admin analytics-only dashboard, API access, session authentication and CSRF regression checks passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
