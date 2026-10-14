'use strict';

const PROXY_RANGES = ['152.233.0.0/16', '84.17.0.0/16', '169.150.0.0/16', '89.222.0.0/16', '79.127.0.0/16', '104.28.0.0/16'];

async function markProxyIps(db, { dryRun = false } = {}) {
  const ranges = process.env.PROXY_LEGACY_CIDRS === undefined
    ? PROXY_RANGES
    : [...new Set(process.env.PROXY_LEGACY_CIDRS.split(',').map(range => range.trim()).filter(Boolean))];
  const candidates = `SELECT ae.id, ranges.network
    FROM analytics_events ae
    JOIN unnest($1::cidr[]) AS ranges(network) ON ae.ip <<= ranges.network
    WHERE ae.ip_source IS NULL`;
  const changes = dryRun
    ? `SELECT id, network FROM candidates`
    : `UPDATE analytics_events ae SET ip_source = 'proxy_legacy'
       FROM candidates WHERE ae.id = candidates.id AND ae.ip_source IS NULL
       RETURNING ae.id, candidates.network`;
  const result = await db.query(`WITH candidates AS (${candidates}), changes AS (${changes})
    SELECT ranges.network::text AS range, COUNT(changes.id)::integer AS count
    FROM unnest($1::cidr[]) AS ranges(network)
    LEFT JOIN changes ON changes.network = ranges.network
    GROUP BY ranges.network ORDER BY ranges.network`, [ranges]);
  return { dry_run: dryRun, total: result.rows.reduce((total, row) => total + Number(row.count), 0), ranges: result.rows };
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
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { markProxyIps, PROXY_RANGES };
