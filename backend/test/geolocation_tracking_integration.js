'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

assert(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL must point to a disposable local PostgreSQL instance');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.RAILWAY_ENVIRONMENT_ID = 'simulated-railway-production';
process.env.ADMIN_USERNAME = 'geo-tracking-test';
process.env.ADMIN_PASSWORD_HASH = 'local-password';
process.env.IPINFO_TOKEN = 'synthetic-test-token';
process.env.TRUSTED_PROXY_CIDRS = '127.0.0.1/32';

const locations = new Map([
  ['198.51.100.40', { country: 'MX', region: 'Quintana Roo', city: 'Cancún', timezone: 'America/Cancun', org: 'AS64501 Example ISP' }],
  ['203.0.113.40', { geo: { country_code: 'MX', region: 'Yucatán', city: 'Mérida', timezone: 'America/Merida' }, as: { asn: 'AS64502', name: 'Other ISP' } }]
]);
const lookedUp = [];
const request = global.fetch;
global.fetch = async url => {
  const destination = new URL(url);
  assert.equal(destination.origin, 'https://ipinfo.io');
  const ip = destination.pathname.split('/')[1];
  lookedUp.push(ip);
  assert(locations.has(ip), 'IPinfo should only receive the selected client IP');
  return Response.json(locations.get(ip));
};
const app = require('../src/index');
global.fetch = request;
const db = require('../src/db');

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const visitor = randomUUID();
  const track = async (headers, path) => {
    const response = await request(base + '/api/analytics/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ visitor_id: visitor, path, ref: visitor, utm_source: 'geolocation-test' })
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const waitForLocation = async (path, expected) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const { rows } = await db.query(`SELECT ip, ip_source, city, region, country, timezone, asn_org
        FROM analytics_events WHERE visitor_id = $1 AND path = $2`, [visitor, path]);
      if (rows[0]?.city) return assert.deepEqual(rows[0], expected);
      await delay(20);
    }
    assert.fail('Event was not enriched');
  };
  try {
    const cf = { 'cf-connecting-ip': '198.51.100.40', 'x-real-ip': '152.233.1.4' };
    assert.equal((await track(cf, '/first')).returning_visitor, false);
    const cancun = { ip: '198.51.100.40', ip_source: 'cf-connecting-ip', city: 'Cancún', region: 'Quintana Roo', country: 'MX',
      timezone: 'America/Cancun', asn_org: 'AS64501 Example ISP' };
    await waitForLocation('/first', cancun);
    const returning = await track(cf, '/return');
    assert.equal(returning.returning_visitor, true);
    for (const key of ['ip', 'city', 'region', 'country']) assert.equal(returning.returning_context[key], cancun[key]);
    assert.equal(returning.returning_context.network, cancun.asn_org);
    await waitForLocation('/return', cancun);
    const merida = { ip: '203.0.113.40', ip_source: 'x-forwarded-for', city: 'Mérida', region: 'Yucatán', country: 'MX',
      timezone: 'America/Merida', asn_org: 'AS64502 Other ISP' };
    await track({ 'x-forwarded-for': merida.ip, 'x-real-ip': '152.233.1.4' }, '/merida');
    await waitForLocation('/merida', merida);
    assert.deepEqual(lookedUp, [cancun.ip, merida.ip]);

    const login = await request(base + '/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD_HASH })
    });
    assert.equal(login.status, 200);
    const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
    const read = async path => {
      const response = await request(base + path, { headers });
      assert.equal(response.status, 200, path);
      return response.json();
    };
    const profile = (await read('/api/admin/visitors/' + visitor)).visitor;
    assert.equal(profile.session_count, 1);
    assert.equal(profile.total_visits, 3);
    assert.equal(profile.acquisition.ref, visitor);
    for (const [event, location] of [[profile.recent_visits[0], merida], [profile.recent_visits.at(-1), cancun]]) {
      for (const [key, value] of Object.entries(location)) assert.equal(event[key], value);
      assert.equal(event.traffic.traffic, 'Unknown');
    }
    const listed = (await read('/api/admin/visitors')).visitors.find(entry => entry.visitor_id === visitor);
    assert.equal(listed.most_recent_ip, merida.ip);
    for (const key of ['city', 'region', 'country', 'asn_org']) assert.equal(listed[key], merida[key]);
    const ipDetail = (await read('/api/admin/ips/' + cancun.ip)).ip;
    assert.equal(ipDetail.asn_org, cancun.asn_org);
    assert.equal(ipDetail.city, cancun.city);
    assert.equal(ipDetail.total_visits, 2);
    const referral = (await read('/api/admin/tracking/' + visitor)).referral;
    assert.equal(referral.events[0].city, merida.city);
    console.log('Geolocation is preserved through Railway metadata, Cloudflare/XFF, cache, returning visits, sessions and admin attribution.');
  } finally {
    await db.query('DELETE FROM analytics_events WHERE visitor_id = $1', [visitor]);
    await db.query('DELETE FROM ip_geolocation_cache WHERE ip = ANY($1::inet[])', [[...locations.keys()]]);
    await new Promise(resolve => server.close(resolve));
    await db.pool.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
