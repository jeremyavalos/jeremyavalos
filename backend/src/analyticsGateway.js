'use strict';

const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { isIP } = require('node:net');

const ingestPath = '/api/analytics/ingest';
const bodyLimit = 8192;
const clockSkewSeconds = 45;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const metadata = new Set(['user-agent', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function authenticate(req, key, now = Math.floor(Date.now() / 1000)) {
  if (req.method !== 'POST' || req.originalUrl !== ingestPath || !key || !Buffer.isBuffer(req.body)) return null;
  const ip = req.get('x-analytics-ip');
  const time = req.get('x-analytics-time');
  const nonce = req.get('x-analytics-nonce');
  const signature = req.get('x-analytics-signature');
  if (!ip || ip.length > 45 || ip.includes('%') || /^::ffff:/i.test(ip) || !isIP(ip) ||
      !/^\d{10}$/.test(time || '') || Math.abs(now - Number(time)) > clockSkewSeconds ||
      !/^[0-9a-f]{32}$/.test(nonce || '') || !/^[0-9a-f]{64}$/.test(signature || '')) return null;
  const digest = createHash('sha256').update(req.body).digest('hex');
  const expected = createHmac('sha256', key)
    .update(JSON.stringify(['portfolio-analytics-v1', req.method, req.originalUrl, time, nonce, ip, digest])).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
  return { ip, nonce };
}

function decode(body) {
  try {
    const envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    if (!record(envelope) || Object.keys(envelope).length !== 2 || !record(envelope.event) || !record(envelope.client) ||
        typeof envelope.event.event_id !== 'string' || !uuid.test(envelope.event.event_id)) return null;
    for (const [name, value] of Object.entries(envelope.client)) {
      if (!metadata.has(name) || typeof value !== 'string' || value.length > 512 || /[\x00-\x1f\x7f]/.test(value)) return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

async function claimNonce(client, nonce) {
  const hit = await client.query(
    "INSERT INTO analytics_gateway_nonces (nonce, expires_at) VALUES ($1, now() + interval '2 minutes') ON CONFLICT DO NOTHING",
    [nonce]
  );
  return hit.rowCount === 1;
}

async function allowNetwork(client, ip, key) {
  const normalized = await client.query(
    "SELECT host(network(set_masklen($1::inet, CASE WHEN family($1::inet)=6 THEN 64 ELSE 32 END))) AS address, floor(extract(epoch FROM now())/60)::text AS minute",
    [ip]
  );
  const { address, minute } = normalized.rows[0];
  const bucket = createHmac('sha256', key).update(JSON.stringify(['rate-limit-v1', address, minute])).digest('hex');
  const result = await client.query(`INSERT INTO analytics_gateway_limits (bucket, expires_at, hits)
    VALUES ($1, now() + interval '2 minutes', 1)
    ON CONFLICT (bucket) DO UPDATE SET hits = analytics_gateway_limits.hits + 1
    WHERE analytics_gateway_limits.hits < 120 RETURNING hits`, [bucket]);
  return result.rowCount === 1;
}

function eventHash(event) {
  // Key order from a retry may differ without changing the submitted event.
  return createHash('sha256').update(JSON.stringify(Object.keys(event).sort().map(name => [name, event[name]]))).digest('hex');
}

async function cleanGatewayRecords(db) {
  await db.query('DELETE FROM analytics_gateway_nonces WHERE expires_at < now()');
  await db.query('DELETE FROM analytics_gateway_events WHERE expires_at < now()');
  await db.query('DELETE FROM analytics_gateway_limits WHERE expires_at < now()');
}

module.exports = { ingestPath, bodyLimit, authenticate, decode, claimNonce, allowNetwork, eventHash, cleanGatewayRecords };
