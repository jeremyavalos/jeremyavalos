import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const ingestPath = '/api/analytics/ingest';
const limit = 8192;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const eventTypes = new Set([
  'page_view', 'section_view', 'contact_opened', 'returning_popup_shown',
  'returning_popup_email_opened', 'returning_popup_email_submitted', 'returning_popup_dismissed',
  'returning_popup_start_project', 'returning_popup_details_opened'
]);
const fields = new Set([
  'event_id', 'visitor_id', 'fingerprint', 'path', 'referrer', 'event_type', 'section_name',
  'ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'
]);
const metadata = ['user-agent', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'];

async function readBounded(body) {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, length);
      length += value.length;
      if (length > limit) {
        void reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

function reply(status, error) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function cookieValue(header, name) {
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

function visitorBinding(request, visitor, key, now) {
  const cookie = request.headers.get('cookie') || '';
  const rawId = cookieValue(cookie, 'visitor_id');
  const binding = cookieValue(cookie, '__Host-analytics-visitor');
  if (visitor == null) return binding ? false : '';
  if (typeof visitor !== 'string' || !uuid.test(visitor) || rawId !== visitor) return false;
  const sign = (id, expires) => createHmac('sha256', key)
    .update(JSON.stringify(['visitor-cookie-v1', id, expires])).digest();
  if (binding) {
    const [id, expires, signature, ...extra] = binding.split('.');
    if (!extra.length && id === visitor && /^\d{10}$/.test(expires || '') &&
        /^[0-9a-f]{64}$/.test(signature || '') &&
        timingSafeEqual(sign(id, expires), Buffer.from(signature, 'hex'))) {
      if (Number(expires) > now) return '';
    } else {
      return false;
    }
  }
  const expires = String(now + 31536000);
  return `__Host-analytics-visitor=${visitor}.${expires}.${sign(visitor, expires).toString('hex')}; Max-Age=31536000; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export function createGateway(env = process.env, fetchImpl = fetch) {
  return async function gateway(request) {
    if (request.method !== 'POST') return reply(405, 'method not allowed');
    const url = new URL(request.url);
    const canonical = env.ANALYTICS_PUBLIC_ORIGIN || 'https://www.jeremyavalos.xyz';
    const fetchSite = request.headers.get('sec-fetch-site');
    if (url.origin !== canonical || url.pathname !== '/api/analytics' || url.search ||
        request.headers.get('origin') !== canonical || (fetchSite && fetchSite !== 'same-origin')) {
      return reply(403, 'origin not allowed');
    }
    const secret = env.ANALYTICS_HMAC_SECRET;
    let target;
    try {
      target = new URL(env.ANALYTICS_RAILWAY_ORIGIN + ingestPath);
    } catch {
      return reply(503, 'analytics unavailable');
    }
    if (!secret || !/^[0-9a-f]{64}$/i.test(secret) || target.protocol !== 'https:' ||
        target.origin !== env.ANALYTICS_RAILWAY_ORIGIN || target.pathname !== ingestPath || target.username || target.password) {
      return reply(503, 'analytics unavailable');
    }
    const length = request.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > limit)) return reply(413, 'event too large');
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') || '') ||
        request.headers.has('content-encoding')) return reply(415, 'unsupported content type');

    // This function must only run behind Vercel's ingress. Vercel documents
    // X-Real-IP as identical to its platform-normalized client address.
    const ip = (request.headers.get('x-real-ip') || '').trim().replace(/^::ffff:/i, '');
    if (!isIP(ip) || ip.includes('%') || ip.length > 45) return reply(400, 'client address unavailable');
    let event;
    try {
      const raw = await readBounded(request.body);
      if (!raw) return reply(413, 'event too large');
      event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    } catch {
      return reply(400, 'invalid event');
    }
    if (!event || typeof event !== 'object' || Array.isArray(event) ||
        Object.keys(event).some(key => !fields.has(key)) ||
        typeof event.event_id !== 'string' || !uuid.test(event.event_id) ||
        !eventTypes.has(event.event_type) || typeof event.path !== 'string' || !event.path.startsWith('/')) {
      return reply(400, 'invalid event');
    }
    const client = Object.fromEntries(metadata.flatMap(name => {
      const value = request.headers.get(name);
      return value && value.length <= 512 ? [[name, value]] : [];
    }));
    const body = Buffer.from(JSON.stringify({ event, client }));
    if (body.length > limit) return reply(413, 'event too large');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(secret, 'hex');
    const cookie = visitorBinding(request, event.visitor_id, key, Number(timestamp));
    if (cookie === false) return reply(400, 'invalid visitor binding');
    const nonce = randomBytes(16).toString('hex');
    const digest = createHash('sha256').update(body).digest('hex');
    const signature = createHmac('sha256', key)
      .update(JSON.stringify(['portfolio-analytics-v1', 'POST', ingestPath, timestamp, nonce, ip, digest])).digest('hex');

    try {
      const response = await fetchImpl(target, {
        method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: {
          'Content-Type': 'application/json',
          'X-Analytics-IP': ip, 'X-Analytics-Time': timestamp,
          'X-Analytics-Nonce': nonce, 'X-Analytics-Signature': signature
        }
      });
      if (response.status >= 500 || ![200, 400, 409, 429].includes(response.status)) {
        return reply(503, 'analytics unavailable');
      }
      const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      if (cookie && response.status === 200) headers.set('Set-Cookie', cookie);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return reply(503, 'analytics unavailable');
    }
  };
}

export default { fetch: createGateway() };
