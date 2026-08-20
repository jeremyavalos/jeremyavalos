const { createGeolocationService, isPublicIp, normalizeIp, parseIpinfo } = require('../src/geolocation');

function assert(value, message) { if (!value) throw new Error(message); }

(async () => {
  assert(normalizeIp('::ffff:8.8.8.8') === '8.8.8.8', 'mapped IPv4 normalization failed');
  assert(isPublicIp('8.8.8.8') && !isPublicIp('127.0.0.1') && !isPublicIp('10.0.0.1'), 'public IP check failed');
  const parsed = parseIpinfo({ city:'Cancun', region:'Quintana Roo', country:'MX', timezone:'America/Cancun', org:'AS64500 Example ISP', loc:'1,2' });
  assert(parsed.city === 'Cancun' && parsed.asn_org === 'AS64500 Example ISP' && !Object.hasOwn(parsed, 'loc'), 'IPinfo parsing failed');

  const cache = new Map(); const events = new Map(); let fetches = 0;
  const db = { query: async (sql, params) => {
    if (sql.includes('FROM ip_geolocation_cache')) return { rows: cache.has(params[0]) ? [cache.get(params[0])] : [] };
    if (sql.includes('INSERT INTO ip_geolocation_cache')) { cache.set(params[0], sql.includes("'failed'") ? { status:'failed' } : { country:params[1], region:params[2], city:params[3], timezone:params[4], asn_org:params[5], status:'resolved' }); return { rows:[] }; }
    if (sql.includes('UPDATE analytics_events')) { events.set(params[0], { country:params[1], region:params[2], city:params[3], timezone:params[4], asn_org:params[5] }); return { rows:[] }; }
    throw new Error(`Unexpected query: ${sql}`);
  }};
  const service = createGeolocationService({ db, token:'test-token', logger:{ warn(){} }, fetchImpl: async () => { fetches += 1; return { ok:true, json:async()=>({ country:'MX', region:'Quintana Roo', city:'Cancun', timezone:'America/Cancun', org:'AS64500 Example ISP', loc:'1,2' }) }; } });
  await service.enrichEvent('event-1', '8.8.8.8');
  await service.enrichEvent('event-2', '8.8.8.8');
  assert(fetches === 1, 'cached IP triggered a second provider lookup');
  assert(events.get('event-2').city === 'Cancun', 'cached location was not applied');
  assert(!Object.hasOwn(events.get('event-1'), 'loc'), 'coordinates must not be stored');
  console.log('geolocation regression checks passed');
})().catch(error => { console.error(error); process.exit(1); });
