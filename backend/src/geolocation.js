const net = require('net');

function normalizeIp(value) {
  const ip = String(value || '').trim();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function isPublicIp(value) {
  const ip = normalizeIp(value);
  const version = net.isIP(ip);
  if (!version) return false;
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224);
  }
  const lower = ip.toLowerCase();
  return lower !== '::1' && lower !== '::' && !lower.startsWith('fe8') &&
    !lower.startsWith('fe9') && !lower.startsWith('fea') && !lower.startsWith('feb') &&
    !lower.startsWith('fc') && !lower.startsWith('fd') && !lower.startsWith('ff');
}

function parseIpinfo(data = {}) {
  const geo = data.geo || data;
  const asn = data.as || data.asn || {};
  const asnOrg = data.org || [asn.asn, asn.name].filter(Boolean).join(' ') || null;
  return {
    country: geo.country_code || geo.country || null,
    region: geo.region || null,
    city: geo.city || null,
    timezone: geo.timezone || null,
    asn_org: asnOrg
  };
}

function createGeolocationService({ db, token, fetchImpl = global.fetch, logger = console }) {
  const inflight = new Map();

  async function apply(eventId, location) {
    await db.query(`UPDATE analytics_events SET
      country = COALESCE($2, country), region = COALESCE($3, region),
      city = COALESCE($4, city), timezone = COALESCE($5, timezone),
      asn_org = COALESCE($6, asn_org) WHERE id = $1`,
    [eventId, location.country, location.region, location.city, location.timezone, location.asn_org]);
  }

  async function lookup(ip) {
    const cached = await db.query(`SELECT country, region, city, timezone, asn_org, status
      FROM ip_geolocation_cache WHERE ip = $1 AND expires_at > now()`, [ip]);
    if (cached.rows.length) return cached.rows[0].status === 'resolved' ? cached.rows[0] : null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetchImpl(`https://ipinfo.io/${encodeURIComponent(ip)}/json`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`IPinfo returned ${response.status}`);
      const location = parseIpinfo(await response.json());
      await db.query(`INSERT INTO ip_geolocation_cache
        (ip, country, region, city, timezone, asn_org, status, looked_up_at, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,'resolved',now(),now() + interval '30 days')
        ON CONFLICT (ip) DO UPDATE SET country=EXCLUDED.country, region=EXCLUDED.region,
        city=EXCLUDED.city, timezone=EXCLUDED.timezone, asn_org=EXCLUDED.asn_org,
        status='resolved', looked_up_at=now(), expires_at=EXCLUDED.expires_at`,
      [ip, location.country, location.region, location.city, location.timezone, location.asn_org]);
      return location;
    } catch (error) {
      logger.warn('IP geolocation lookup failed', error.message);
      await db.query(`INSERT INTO ip_geolocation_cache (ip, status, looked_up_at, expires_at)
        VALUES ($1,'failed',now(),now() + interval '1 hour')
        ON CONFLICT (ip) DO UPDATE SET status='failed', looked_up_at=now(), expires_at=EXCLUDED.expires_at`, [ip]);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function enrichEvent(eventId, rawIp) {
    const ip = normalizeIp(rawIp);
    if (!token || !isPublicIp(ip)) return;
    let pending = inflight.get(ip);
    if (!pending) {
      pending = lookup(ip).finally(() => inflight.delete(ip));
      inflight.set(ip, pending);
    }
    const location = await pending;
    if (location) await apply(eventId, location);
  }

  return { enrichEvent };
}

module.exports = { createGeolocationService, isPublicIp, normalizeIp, parseIpinfo };
