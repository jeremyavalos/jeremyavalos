'use strict';

const PROXY_RANGES = ['152.233.0.0/16', '84.17.0.0/16', '169.150.0.0/16', '89.222.0.0/16', '79.127.0.0/16', '104.28.0.0/16', '212.102.0.0/16', '95.173.0.0/16'];

async function markProxyIps(db, { dryRun = false } = {}) {
  const ranges = process.env.PROXY_LEGACY_CIDRS === undefined
    ? PROXY_RANGES
    : [...new Set(process.env.PROXY_LEGACY_CIDRS.split(',').map(range => range.trim()).filter(Boolean))];
  const candidates = `SELECT ae.id, matched.network, COALESCE(geo.asn_org ILIKE '%datacamp%', false) AS asn_match
    FROM analytics_events ae
    LEFT JOIN ip_geolocation_cache geo ON geo.ip = ae.ip
    LEFT JOIN LATERAL (
      SELECT network FROM unnest($1::cidr[]) AS ranges(network)
      WHERE ae.ip <<= network ORDER BY masklen(network) DESC, network LIMIT 1
    ) matched ON true
    WHERE ae.ip_source IS NULL AND ae.ip IS NOT NULL
      AND (matched.network IS NOT NULL OR geo.asn_org ILIKE '%datacamp%')`;
  const changes = dryRun
    ? `SELECT id, network, asn_match FROM candidates`
    : `UPDATE analytics_events ae SET ip_source = 'proxy_legacy'
       FROM candidates WHERE ae.id = candidates.id AND ae.ip_source IS NULL
       RETURNING ae.id, candidates.network, candidates.asn_match`;
  const result = await db.query(`WITH candidates AS (${candidates}), changes AS (${changes})
    SELECT (SELECT COUNT(*)::integer FROM changes) AS total,
      (SELECT COUNT(*)::integer FROM changes WHERE asn_match) AS asn_matches,
      (SELECT COUNT(*)::integer FROM changes WHERE network IS NULL) AS asn_only,
      COALESCE((SELECT json_agg(summary ORDER BY summary.range::cidr) FROM (
        SELECT network::text AS range,
          (SELECT COUNT(*)::integer FROM changes WHERE changes.network = ranges.network) AS count
        FROM (SELECT DISTINCT network FROM unnest($1::cidr[]) AS configured(network)) ranges
      ) summary), '[]'::json) AS ranges`, [ranges]);
  return { dry_run: dryRun, ...result.rows[0] };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--dry-run')) throw new Error('Usage: node scripts/mark_proxy_ips.js [--dry-run]');
  require('dotenv').config();
  const db = require('../src/db');
  try {
    const result = await markProxyIps(db, { dryRun: args.includes('--dry-run') });
    console.log(`${result.dry_run ? 'Dry run: would mark' : 'Marked'} ${result.total} legacy proxy events`);
    for (const range of result.ranges) console.log(`${range.range}: ${range.count}`);
    console.log(`ASN organization only (outside configured CIDRs): ${result.asn_only}`);
    console.log(`ASN organization matches (including CIDR matches): ${result.asn_matches}`);
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { markProxyIps, PROXY_RANGES };
