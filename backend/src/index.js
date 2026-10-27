require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  for (const [name, developmentValue] of [['SESSION_SECRET', 'dev_session_secret']]) {
    const value = process.env[name]?.trim();
    if (!value || value === developmentValue) console.warn(`WARNING: ${name} is missing or uses its development value in production. Configure a strong secret.`);
  }
}
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const csurf = require('csurf');
const bcrypt = require('bcrypt');
const { isIP, BlockList } = require('net');
const path = require('path');
const db = require('./db');
const { createGeolocationService, isPublicIp, normalizeIp } = require('./geolocation');
const { parseUserAgent } = require('./userAgent');

const geolocation = createGeolocationService({ db, token: process.env.IPINFO_TOKEN });

const app = express();
// Railway is one hop; review this if Cloudflare or another proxy is added. getClientIp prioritizes cf-connecting-ip.
app.set('trust proxy', 1);
let proxyConfiguration;
let trustedProxyNetworks;

function getTrustedProxyNetworks() {
  const configuration = process.env.TRUSTED_PROXY_CIDRS;
  if (configuration === undefined) return null;
  if (configuration === proxyConfiguration) return trustedProxyNetworks;
  proxyConfiguration = configuration;
  const networks = new BlockList();
  try {
    for (const entry of configuration.split(',')) {
      const parts = entry.trim().split('/');
      const version = isIP(parts[0]);
      const prefix = Number(parts[1]);
      if (parts.length !== 2 || !version || !/^\d+$/.test(parts[1]) || prefix > (version === 4 ? 32 : 128)) {
        throw new Error('Expected comma-separated IPv4/IPv6 CIDRs');
      }
      networks.addSubnet(parts[0], prefix, version === 4 ? 'ipv4' : 'ipv6');
    }
    trustedProxyNetworks = networks;
  } catch (error) {
    console.warn('WARNING: invalid TRUSTED_PROXY_CIDRS; forwarding headers will be ignored.', error.message);
    trustedProxyNetworks = new BlockList();
  }
  return trustedProxyNetworks;
}

function ipCandidates(value) {
  return (Array.isArray(value) ? value : [value]).flatMap(item => typeof item === 'string' ? item.split(',') : [])
    .map(item => item.trim().replace(/^::ffff:/i, '').trim()).filter(ip => isIP(ip));
}

// Order: valid CF-Connecting-IP, XFF, X-Real-IP, socket. Configured CIDRs gate all
// headers on the socket peer and traverse XFF right-to-left to the first untrusted
// hop; left-to-right selection permits spoofed prefixes. Without CIDRs, XFF uses
// the first valid value for compatibility and is spoofable. Trusted ingress must
// overwrite CF-Connecting-IP/X-Real-IP and sanitize XFF; CIDRs alone cannot verify CF.
function getClientIpDetails(req) {
  const headers = req.headers || {};
  const socketIp = ipCandidates(req.socket?.remoteAddress)[0] || req.socket?.remoteAddress || null;
  const socketResult = { ip: socketIp, source: 'socket' };
  const networks = getTrustedProxyNetworks();
  const trusted = ip => Boolean(isIP(ip || '') && networks?.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6'));
  if (networks && !trusted(socketIp)) return socketResult;
  const cloudflareIp = ipCandidates(headers['cf-connecting-ip'])[0];
  if (cloudflareIp) return { ip: cloudflareIp, source: 'cf-connecting-ip' };
  const forwarded = ipCandidates(headers['x-forwarded-for']);
  if (networks) forwarded.reverse();
  const forwardedIp = forwarded.find(ip => !networks || !trusted(ip));
  if (forwardedIp) return { ip: forwardedIp, source: 'x-forwarded-for' };
  const realIp = ipCandidates(headers['x-real-ip'])[0];
  return realIp ? { ip: realIp, source: 'x-real-ip' } : socketResult;
}

function getClientIp(req) {
  return getClientIpDetails(req).ip;
}

function normalizeAnalyticsPath(value) {
  return typeof value === 'string' ? value.split('?')[0].trim() || '/' : '/';
}

function parseFingerprint(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' && /^[0-9a-f]{8}$/i.test(value) ? value.toLowerCase() : false;
}

app.use((req, res, next) => {
  if (process.env.DEBUG_IP === '1') {
    console.log('DEBUG_IP', {
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'socket.remoteAddress': req.socket?.remoteAddress || null,
      'req.ip': req.ip,
      'cf-connecting-ip': req.headers['cf-connecting-ip'] || null,
      'x-real-ip': req.headers['x-real-ip'] || null,
      clientIp: getClientIp(req),
      ip_source: getClientIpDetails(req).source
    });
  }
  next();
});
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (server-side session). Use an in-memory store while
// testing to avoid requiring a real Postgres session table during tests.
const sessionStore = process.env.NODE_ENV === 'test'
  ? new session.MemoryStore()
  : new PgSession({ pool: db.pool, tableName: 'session' });

app.use(session({
  store: sessionStore,
  name: 'admin.sid',
  secret: process.env.SESSION_SECRET || 'dev_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4 // 4 hours
  }
}));

// helper to run middleware-style functions (like csurf) in async handlers
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (err) => err ? reject(err) : resolve());
  });
}

const PORT = process.env.PORT || 4000;
const adminAssetVersion = encodeURIComponent(process.env.RAILWAY_GIT_COMMIT_SHA || 'admin-assets-v2');

// CORS allowlist: prefer explicit origins only. Do NOT use '*'.
const allowedOrigins = [
  // Prefer explicit production origins first
  process.env.CORS_ORIGIN || 'https://www.jeremyavalos.xyz',
  'https://jeremyavalos.xyz',
  process.env.BACKEND_PUBLIC_URL || 'https://jeremyavalos-production.up.railway.app',
  // local dev
  'http://localhost:3000',
  'http://localhost:8000'
].filter(Boolean);

// Apply CORS only to API routes. Server-rendered HTML routes (e.g. /admin)
// should not be blocked by CORS checks and rely on session/CSRF instead.
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const leadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

const apiCors = cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin (server-to-server or curl)
    if (!origin) return cb(null, true);
    // Reject literal 'null' Origins for API requests
    if (origin === 'null') {
      try { console.warn('CORS: rejected origin ->', origin); } catch (e) {}
      return cb(new Error('Not allowed by CORS'));
    }
    if (allowedOrigins.includes(origin)) return cb(null, true);
    try { console.warn('CORS: rejected origin ->', origin); } catch (e) {}
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
});

// Mount CORS and rate limiting only for /api routes
app.use('/api', apiCors, apiLimiter);

// (apiLimiter and /api mount moved above with apiCors)

// Retention: remove analytics older than 90 days on startup, and run daily.
async function cleanExpiredAnalytics() {
  await db.query("DELETE FROM analytics_events WHERE created_at < now() - interval '90 days'");
  await db.query('DELETE FROM ip_geolocation_cache c WHERE NOT EXISTS (SELECT 1 FROM analytics_events ae WHERE ae.ip = c.ip)');
}

(async () => {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await cleanExpiredAnalytics();
  } catch (e) {
    console.error('analytics retention cleanup failed', e);
  }
  setInterval(async () => {
    try {
      await cleanExpiredAnalytics();
    } catch (e) {
      console.error('analytics retention cleanup failed', e);
    }
  }, 24 * 60 * 60 * 1000);
}
)();

function parseVisitorId(value) {
  if (value == null || value === '') return null;
  const visitorId = String(value).trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(visitorId) ? visitorId : false;
}

const TRACKING_FIELDS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const PUBLIC_EVENT_TYPES = new Set([
  'page_view', 'section_view', 'contact_opened',
  'returning_popup_shown', 'returning_popup_email_opened', 'returning_popup_email_submitted',
  'returning_popup_dismissed', 'returning_popup_start_project', 'returning_popup_details_opened'
]);
const SECTION_NAMES = new Set(['HOME', 'WORK', 'CAPABILITIES', 'ABOUT', 'CONTACT']);
function parseTracking(req) {
  const tracking = {};
  for (const field of TRACKING_FIELDS) {
    const value = req.body?.[field];
    if (value == null || value === '') { tracking[field] = null; continue; }
    if (typeof value !== 'string' || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) return false;
    tracking[field] = value;
  }
  return tracking;
}

function readableReferrer(raw) {
  if (!raw) return 'Direct';
  let host;
  try { host = new URL(raw).hostname.toLowerCase().replace(/^www\./, ''); } catch { return raw; }
  if (host === 'l.instagram.com' || host === 'instagram.com') return 'Instagram';
  if (host === 't.co' || host === 'twitter.com' || host === 'x.com') return 'X / Twitter';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'LinkedIn';
  if (host === 'facebook.com' || host === 'l.facebook.com') return 'Facebook';
  return host;
}

function eventSection(event) {
  if (SECTION_NAMES.has(event.section_name)) return event.section_name;
  const path = String(event.path || '/').split('?')[0];
  const hash = path.includes('#') ? path.split('#').pop().toUpperCase() : '';
  if (SECTION_NAMES.has(hash)) return hash;
  if (path === '/' || path === '') return 'HOME';
  return path.replace(/^\//, '').split('/')[0].toUpperCase() || 'HOME';
}

function buildSessions(events) {
  const sessions = [];
  for (const event of [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
    const last = sessions.at(-1);
    if (!last || new Date(event.created_at) - new Date(last.last_seen) > 30 * 60 * 1000) sessions.push({ first_seen:event.created_at, last_seen:event.created_at, events:[event] });
    else { last.events.push(event); last.last_seen=event.created_at; }
  }
  return sessions.map((session, index) => ({ number:index + 1, first_seen:session.first_seen, last_seen:session.last_seen, duration_minutes:Math.max(0, Math.round((new Date(session.last_seen)-new Date(session.first_seen))/60000)), event_count:session.events.length, ip_count:new Set(session.events.map(e=>e.ip).filter(Boolean)).size, events:session.events }));
}

function mostCommon(events, field) {
  const counts = new Map(); events.forEach(event=>{if(event[field])counts.set(event[field],(counts.get(event[field])||0)+1);});
  return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0] || null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function isAdminAuthenticated(req) {
  try {
    return Boolean(req.session && req.session.isAdmin === true && req.session.username === process.env.ADMIN_USERNAME);
  } catch (e) { return false; }
}

function setAdminSession(req) {
  req.session.isAdmin = true;
  req.session.username = process.env.ADMIN_USERNAME || 'admin';
}

function clearAdminSession(req) {
  try { req.session.destroy(() => {}); } catch (e) { /* ignore */ }
}

function requireAdmin(req, res, next) {
  if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
  next();
}

// Admin assets are session-protected and external so Helmet's CSP can remain strict.
app.use('/admin/assets', requireAdmin, express.static(path.join(__dirname, '..', 'admin'), {
  fallthrough: false,
  etag: true,
  maxAge: 0,
  setHeaders: (res) => res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')
}));

// Admin API responses contain private visitor data and must not be cached.
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Analytics tracking (privacy-friendly)
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { path, referrer } = req.body || {};
    const fingerprint = parseFingerprint(req.body?.fingerprint);
    if (fingerprint === false) return res.status(400).json({ error: 'invalid fingerprint' });
    const visitorId = parseVisitorId(req.body?.visitor_id);
    if (visitorId === false) return res.status(400).json({ error: 'invalid visitor id' });
    const tracking = parseTracking(req);
    if (tracking === false) return res.status(400).json({ error: 'invalid tracking parameters' });
    const eventType = req.body?.event_type == null ? 'page_view' : String(req.body.event_type);
    if (!PUBLIC_EVENT_TYPES.has(eventType)) return res.status(400).json({ error: 'invalid event type' });
    const sectionName = req.body?.section_name == null ? null : String(req.body.section_name).toUpperCase();
    if ((eventType === 'section_view' && !SECTION_NAMES.has(sectionName)) || (eventType !== 'section_view' && sectionName)) return res.status(400).json({ error: 'invalid section' });
    const { ip, source: ipSource } = getClientIpDetails(req);
    const rawUserAgent = req.get('User-Agent') || null;
    const ua = parseUserAgent(rawUserAgent);
    let returningVisitor = false;
    let returningContext = null;
    let previousVisit = null;
    let firstSeen = null;
    if (visitorId && eventType === 'page_view') {
      const previous = await db.query(`SELECT created_at AS previous_visit, MIN(created_at) OVER () AS first_seen
        FROM analytics_events WHERE visitor_id = $1 AND event_type = 'page_view'
        ORDER BY created_at DESC LIMIT 1`, [visitorId]);
      previousVisit = previous.rows[0]?.previous_visit || null;
      firstSeen = previous.rows[0]?.first_seen || previousVisit;
      returningVisitor = Boolean(previousVisit);
      const currentIp = normalizeIp(ip);
      if (returningVisitor) {
        let location = {};
        if (isPublicIp(currentIp)) {
          const cachedLocation = await db.query("SELECT city, region, country, asn_org FROM ip_geolocation_cache WHERE ip = $1 AND status = 'resolved' AND expires_at > now()", [currentIp]);
          location = cachedLocation.rows[0] || {};
        }
        returningContext = {
          ip: isPublicIp(currentIp) ? currentIp : null,
          city: location.city || null,
          region: location.region || null,
          country: location.country || null,
          network: location.asn_org || null,
          device: ua.device_name || null,
          os: [ua.operating_system, ua.operating_system_version].filter(Boolean).join(' ') || null,
          browser: [ua.browser, ua.browser_version].filter(Boolean).join(' ') || null,
          previous_visit: previousVisit,
          first_seen: firstSeen
        };
      }
    }
    const inserted = await db.query(
      'INSERT INTO analytics_events (path, referrer, user_agent, device_category, browser_family, country, ip, visitor_id, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term, event_type, section_name, device_name, device_type, operating_system, operating_system_version, browser, browser_version, fingerprint, ip_source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id, created_at',
      [normalizeAnalyticsPath(path), referrer || req.get('Referer') || null, rawUserAgent, ua.device_type, ua.browser, null, ip, visitorId, tracking.ref, tracking.utm_source, tracking.utm_medium, tracking.utm_campaign, tracking.utm_content, tracking.utm_term, eventType, sectionName, ua.device_name, ua.device_type, ua.operating_system, ua.operating_system_version, ua.browser, ua.browser_version, fingerprint, ipSource]
    );
    if (returningContext) returningContext.current_visit = inserted.rows[0]?.created_at || null;
    res.json({ ok: true, ...(eventType === 'page_view' ? { returning_visitor: returningVisitor, returning_context: returningContext } : {}) });
    geolocation.enrichEvent(inserted.rows[0]?.id, ip).catch(error => console.warn('IP geolocation enrichment failed', error.message));
  } catch (e) {
    console.error('analytics track error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Private voluntary lead capture for the returning-visitor prompt.
app.post('/api/leads', leadLimiter, async (req, res) => {
  try {
    const visitorId = parseVisitorId(req.body?.visitor_id);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!visitorId) return res.status(400).json({ error: 'valid visitor id required' });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'valid email required' });

    await db.query('INSERT INTO visitor_leads (visitor_id, email, source) VALUES ($1,$2,$3)', [visitorId, email, 'returning_visitor_popup']);
    res.status(201).json({ ok: true });

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.CHALLENGE_FROM_EMAIL;
    const contactEmail = process.env.CONTACT_NOTIFICATION_EMAIL || 'contact@jeremyavalos.xyz';
    if (resendKey && fromEmail) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: fromEmail,
          to: [contactEmail],
          subject: 'Returning visitor left their email',
          html: `<p>A returning visitor asked to connect.</p><p>Email: ${escapeHtml(email)}</p><p>Visitor ID: ${escapeHtml(visitorId.slice(0, 8))}</p>`
        })
      }).then(response => {
        if (!response.ok) console.error(`EMAIL: lead notification rejected status=${response.status}`);
      }).catch(error => console.error(`EMAIL: lead notification failed ${error?.code || error?.name || 'request-error'}`));
    } else {
      console.warn('EMAIL: lead notification skipped — Resend configuration missing');
    }
  } catch (error) {
    console.error('lead capture error', error);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin-only identified visitors. Legacy events with no visitor_id remain in the raw IP view.
app.get('/api/admin/visitors', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const count = await db.query('SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE visitor_id IS NOT NULL');
    const q = await db.query(`
      SELECT ae.visitor_id,
        COUNT(DISTINCT ae.ip) FILTER (WHERE ae.ip IS NOT NULL) AS ip_count,
        (array_agg(ae.ip ORDER BY ae.created_at DESC) FILTER (WHERE ae.ip IS NOT NULL))[1] AS most_recent_ip,
        (array_agg(ae.country ORDER BY ae.created_at DESC) FILTER (WHERE ae.country IS NOT NULL))[1] AS country,
        (array_agg(ae.region ORDER BY ae.created_at DESC) FILTER (WHERE ae.region IS NOT NULL))[1] AS region,
        (array_agg(ae.city ORDER BY ae.created_at DESC) FILTER (WHERE ae.city IS NOT NULL))[1] AS city,
        (array_agg(ae.asn_org ORDER BY ae.created_at DESC) FILTER (WHERE ae.asn_org IS NOT NULL))[1] AS asn_org,
        (array_agg(ae.device_category ORDER BY ae.created_at DESC) FILTER (WHERE ae.device_category IS NOT NULL))[1] AS device_category,
        (array_agg(ae.browser_family ORDER BY ae.created_at DESC) FILTER (WHERE ae.browser_family IS NOT NULL))[1] AS browser_family,
        (array_agg(ae.device_name ORDER BY ae.created_at DESC) FILTER (WHERE ae.device_name IS NOT NULL))[1] AS device_name,
        (array_agg(ae.operating_system ORDER BY ae.created_at DESC) FILTER (WHERE ae.operating_system IS NOT NULL))[1] AS operating_system,
        (array_agg(ae.browser ORDER BY ae.created_at DESC) FILTER (WHERE ae.browser IS NOT NULL))[1] AS browser,
        COUNT(*) AS visits, MIN(ae.created_at) AS first_seen, MAX(ae.created_at) AS last_seen
      FROM analytics_events ae WHERE ae.visitor_id IS NOT NULL
      GROUP BY ae.visitor_id ORDER BY last_seen DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
    const out = q.rows.map(r => ({ ...r, ip_count: Number(r.ip_count), visits: Number(r.visits) }));
    res.json({ visitors: out, pagination: { page, page_size: pageSize, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / pageSize) } });
  } catch (e) {
    console.error('admin visitors error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/visitors/:visitorId', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const visitorId = parseVisitorId(req.params.visitorId);
    if (!visitorId) return res.status(400).json({ error: 'invalid visitor id' });
    const summary = await db.query(`SELECT COUNT(*) AS total_visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
      (array_agg(country ORDER BY created_at DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
      (array_agg(region ORDER BY created_at DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
      (array_agg(city ORDER BY created_at DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
      (array_agg(timezone ORDER BY created_at DESC) FILTER (WHERE timezone IS NOT NULL))[1] AS timezone,
      (array_agg(asn_org ORDER BY created_at DESC) FILTER (WHERE asn_org IS NOT NULL))[1] AS asn_org,
      (array_agg(browser_family ORDER BY created_at DESC) FILTER (WHERE browser_family IS NOT NULL))[1] AS browser_family,
      (array_agg(device_category ORDER BY created_at DESC) FILTER (WHERE device_category IS NOT NULL))[1] AS device_category,
      (array_agg(user_agent ORDER BY created_at DESC) FILTER (WHERE user_agent IS NOT NULL))[1] AS user_agent
      FROM analytics_events WHERE visitor_id = $1`, [visitorId]);
    const q = await db.query(`SELECT fingerprint, path, referrer, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term, event_type, section_name, ip_source,
      user_agent, device_category, browser_family, device_name, device_type, operating_system,
      operating_system_version, browser, browser_version, ip, country, region, city, timezone, asn_org, created_at
      FROM analytics_events WHERE visitor_id = $1 ORDER BY created_at DESC`, [visitorId]);
    if (!q.rows.length) return res.status(404).json({ error: 'visitor not found' });
    const acquisition = await db.query(`SELECT path, referrer, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at
      FROM analytics_events WHERE visitor_id = $1
      ORDER BY (ref IS NOT NULL OR utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL
        OR utm_content IS NOT NULL OR utm_term IS NOT NULL OR referrer IS NOT NULL) DESC, created_at ASC LIMIT 1`, [visitorId]);
    const observed = await db.query(`SELECT ip, COUNT(*) AS visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
      (array_agg(country ORDER BY created_at DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
      (array_agg(region ORDER BY created_at DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
      (array_agg(city ORDER BY created_at DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
      (array_agg(timezone ORDER BY created_at DESC) FILTER (WHERE timezone IS NOT NULL))[1] AS timezone,
      (array_agg(asn_org ORDER BY created_at DESC) FILTER (WHERE asn_org IS NOT NULL))[1] AS asn_org
      FROM analytics_events WHERE visitor_id = $1 AND ip IS NOT NULL GROUP BY ip ORDER BY last_seen DESC`, [visitorId]);
    const s = summary.rows[0];
    const firstTouch = acquisition.rows[0];
    const events = q.rows.map(event => ({ ...event, page_name:eventSection(event), referrer_label:readableReferrer(event.referrer) }));
    const sessions = buildSessions(events);
    const sectionCounts = new Map(); events.forEach(event=>sectionCounts.set(event.page_name,(sectionCounts.get(event.page_name)||0)+1));
    const pages = [...sectionCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    const recentSource = events.find(event=>event.utm_source||event.referrer);
    const activeDays = new Set(events.map(event=>new Date(event.created_at).toISOString().slice(0,10))).size;
    const latest = events[0];
    res.json({ visitor: { visitor_id: visitorId, country: s.country, region: s.region, city: s.city, timezone: s.timezone, asn_org: s.asn_org, browser_family: s.browser_family, device_category: s.device_category, user_agent: s.user_agent, latest_device:latest ? { device_name:latest.device_name, device_type:latest.device_type, operating_system:latest.operating_system, operating_system_version:latest.operating_system_version, browser:latest.browser, browser_version:latest.browser_version, ip:latest.ip, country:latest.country, region:latest.region, city:latest.city, asn_org:latest.asn_org } : null, first_seen: s.first_seen, last_seen: s.last_seen, total_visits: Number(s.total_visits), active_days:activeDays, session_count:sessions.length, primary_device:mostCommon(events,'device_name')||mostCommon(events,'device_category'), primary_browser:mostCommon(events,'browser')||mostCommon(events,'browser_family'), recent_source:recentSource ? { source:recentSource.utm_source, referrer_label:readableReferrer(recentSource.referrer) } : null, acquisition: firstTouch ? { ...firstTouch, source: firstTouch.utm_source, medium: firstTouch.utm_medium, campaign: firstTouch.utm_campaign, referrer_label: readableReferrer(firstTouch.referrer) } : null, page_summary:{ pages, first_section:events.at(-1)?.page_name||null, last_section:events[0]?.page_name||null, most_viewed:pages[0]?.name||null, contact_visits:sectionCounts.get('CONTACT')||0 }, sessions, observed_ips: observed.rows.map(ip => ({ ...ip, visits: Number(ip.visits) })), recent_visits:events } });
  } catch (e) {
    console.error('admin visitor detail error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/fingerprint/:fp', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const fingerprint = parseFingerprint(req.params.fp);
    if (!fingerprint) return res.status(400).json({ error: 'invalid fingerprint' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const count = await db.query('SELECT COUNT(*) FROM analytics_events WHERE fingerprint = $1', [fingerprint]);
    const total = Number(count.rows[0].count);
    const visitors = await db.query(`SELECT visitor_id, COUNT(*) AS visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
      FROM analytics_events WHERE fingerprint = $1 AND visitor_id IS NOT NULL
      GROUP BY visitor_id ORDER BY last_seen DESC`, [fingerprint]);
    const events = await db.query(`SELECT id, visitor_id, fingerprint, ip, ip_source, path, event_type, section_name, created_at,
      device_name, device_type, operating_system, browser
      FROM analytics_events WHERE fingerprint = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [fingerprint, pageSize, (page - 1) * pageSize]);
    res.json({ fingerprint, visitors: visitors.rows.map(visitor => ({ ...visitor, visits: Number(visitor.visits) })), events: events.rows,
      pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error('admin fingerprint error', error);
    res.status(500).json({ error: 'server error' });
  }
});

// Raw IP analytics remain available independently of first-party visitor identity.
app.get('/api/admin/ips', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const count = await db.query('SELECT COUNT(DISTINCT ip) FROM analytics_events WHERE ip IS NOT NULL');
    const q = await db.query(`SELECT ae.ip,
      (array_agg(ae.country ORDER BY ae.created_at DESC) FILTER (WHERE ae.country IS NOT NULL))[1] AS country,
      (array_agg(ae.region ORDER BY ae.created_at DESC) FILTER (WHERE ae.region IS NOT NULL))[1] AS region,
      (array_agg(ae.city ORDER BY ae.created_at DESC) FILTER (WHERE ae.city IS NOT NULL))[1] AS city,
      (array_agg(ae.asn_org ORDER BY ae.created_at DESC) FILTER (WHERE ae.asn_org IS NOT NULL))[1] AS asn_org,
      BOOL_AND(COALESCE(ae.ip_source = 'proxy_legacy', false)) AS proxy_legacy,
      COUNT(*) AS visits, MIN(ae.created_at) AS first_seen, MAX(ae.created_at) AS last_seen
      FROM analytics_events ae WHERE ae.ip IS NOT NULL GROUP BY ae.ip
      ORDER BY last_seen DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
    res.json({ ips: q.rows.map(r => ({ ...r, visits: Number(r.visits) })), pagination: { page, page_size: pageSize, total: Number(count.rows[0].count), pages: Math.ceil(Number(count.rows[0].count) / pageSize) } });
  } catch (e) {
    console.error('admin ips error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/ips/:ip', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const ip = req.params.ip;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const summary = await db.query(`SELECT COUNT(*) AS total_visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
      COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS distinct_visitor_ids,
      COUNT(*) FILTER (WHERE visitor_id IS NULL) AS legacy_events,
      MIN(created_at) FILTER (WHERE visitor_id IS NULL) AS legacy_first_seen,
      MAX(created_at) FILTER (WHERE visitor_id IS NULL) AS legacy_last_seen,
      COALESCE(array_agg(DISTINCT device_category) FILTER (WHERE device_category IS NOT NULL), ARRAY[]::text[]) AS device_categories,
      COALESCE(array_agg(DISTINCT browser_family) FILTER (WHERE browser_family IS NOT NULL), ARRAY[]::text[]) AS browsers,
      COALESCE(array_agg(DISTINCT device_name) FILTER (WHERE device_name IS NOT NULL), ARRAY[]::text[]) AS device_names,
      COALESCE(array_agg(DISTINCT operating_system) FILTER (WHERE operating_system IS NOT NULL), ARRAY[]::text[]) AS operating_systems,
      (array_agg(country ORDER BY created_at DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
      (array_agg(region ORDER BY created_at DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
      (array_agg(city ORDER BY created_at DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
      (array_agg(timezone ORDER BY created_at DESC) FILTER (WHERE timezone IS NOT NULL))[1] AS timezone,
      (array_agg(asn_org ORDER BY created_at DESC) FILTER (WHERE asn_org IS NOT NULL))[1] AS asn_org
      FROM analytics_events WHERE ip = $1`, [ip]);
    const s = summary.rows[0];
    if (!s || Number(s.total_visits) === 0) return res.status(404).json({ error: 'ip not found' });
    const visitors = await db.query(`SELECT ae.visitor_id, MIN(ae.created_at) AS first_seen, MAX(ae.created_at) AS last_seen,
      COUNT(*) AS visits
      FROM analytics_events ae WHERE ae.ip = $1 AND ae.visitor_id IS NOT NULL
      GROUP BY ae.visitor_id ORDER BY last_seen DESC`, [ip]);
    const events = await db.query(`SELECT ae.path, ae.referrer, ae.ref, ae.utm_source, ae.utm_medium, ae.utm_campaign, ae.utm_content, ae.utm_term,
      ae.user_agent, ae.device_category, ae.browser_family, ae.device_name, ae.device_type,
      ae.operating_system, ae.operating_system_version, ae.browser, ae.browser_version, ae.country, ae.region, ae.city,
      ae.asn_org, ae.visitor_id, ae.created_at, ae.ip_source
      FROM analytics_events ae WHERE ae.ip = $1 ORDER BY ae.created_at DESC LIMIT $2 OFFSET $3`, [ip, pageSize, offset]);
    const paths = await db.query(`SELECT COALESCE(NULLIF(path, ''), '/') AS path, COUNT(*) AS count
      FROM analytics_events WHERE ip = $1 GROUP BY COALESCE(NULLIF(path, ''), '/') ORDER BY count DESC, path`, [ip]);
    const referrers = await db.query(`SELECT referrer, COUNT(*) AS count FROM analytics_events
      WHERE ip = $1 GROUP BY referrer ORDER BY count DESC`, [ip]);
    const referrerCounts = new Map();
    for (const row of referrers.rows) {
      const source = readableReferrer(row.referrer);
      referrerCounts.set(source, (referrerCounts.get(source) || 0) + Number(row.count));
    }
    res.json({ ip: {
      address: ip, first_seen: s.first_seen, last_seen: s.last_seen, total_visits: Number(s.total_visits),
      distinct_visitor_ids: Number(s.distinct_visitor_ids), legacy_events: Number(s.legacy_events),
      legacy_first_seen: s.legacy_first_seen, legacy_last_seen: s.legacy_last_seen,
      device_categories: s.device_categories, browsers: s.browsers,
      device_names: s.device_names, operating_systems: s.operating_systems,
      country: s.country, region: s.region, city: s.city, timezone: s.timezone, asn_org: s.asn_org,
      visitors: visitors.rows.map(v => ({ ...v, visits: Number(v.visits) })),
      events: events.rows.map(event => ({ ...event, referrer_label: readableReferrer(event.referrer) })),
      paths: paths.rows.map(row => ({ path: row.path, count: Number(row.count) })),
      referrers: [...referrerCounts].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
    }, pagination: { page, page_size: pageSize, total: Number(s.total_visits), pages: Math.ceil(Number(s.total_visits) / pageSize) } });
  } catch (e) {
    console.error('admin ip detail error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin-only campaign/referral reporting over the existing retained events.
app.get('/api/admin/tracking', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const count = await db.query(`SELECT COUNT(*) FROM (SELECT 1 FROM analytics_events
      WHERE ref IS NOT NULL OR utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL
        OR utm_content IS NOT NULL OR utm_term IS NOT NULL
      GROUP BY ref, utm_source, utm_medium, utm_campaign) tracked_groups`);
    const q = await db.query(`SELECT ref, utm_source AS source, utm_medium AS medium, utm_campaign AS campaign,
      COUNT(*) AS visits, COUNT(DISTINCT visitor_id) FILTER (WHERE visitor_id IS NOT NULL) AS distinct_visitor_ids,
      MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
      FROM analytics_events
      WHERE ref IS NOT NULL OR utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL
        OR utm_content IS NOT NULL OR utm_term IS NOT NULL
      GROUP BY ref, utm_source, utm_medium, utm_campaign
      ORDER BY last_seen DESC LIMIT $1 OFFSET $2`, [pageSize, offset]);
    const total = Number(count.rows[0].count);
    res.json({ tracking: q.rows.map(row => ({ ...row, visits: Number(row.visits), distinct_visitor_ids: Number(row.distinct_visitor_ids) })), pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (e) {
    console.error('admin tracking error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/tracking/:ref', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const ref = req.params.ref;
    if (!ref || ref.length > 200 || /[\u0000-\u001f\u007f]/.test(ref)) return res.status(400).json({ error: 'invalid ref' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.page_size, 10) || 25));
    const offset = (page - 1) * pageSize;
    const count = await db.query('SELECT COUNT(*) FROM analytics_events WHERE ref = $1', [ref]);
    const total = Number(count.rows[0].count);
    if (!total) return res.status(404).json({ error: 'ref not found' });
    const visitors = await db.query(`SELECT visitor_id, COUNT(*) AS visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
      FROM analytics_events WHERE ref = $1 AND visitor_id IS NOT NULL GROUP BY visitor_id ORDER BY last_seen DESC`, [ref]);
    const events = await db.query(`SELECT created_at, visitor_id, ip, path, referrer, ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      user_agent, device_name, device_type, operating_system, operating_system_version, browser, browser_version,
      device_category, browser_family, country, region, city, asn_org
      FROM analytics_events WHERE ref = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [ref, pageSize, offset]);
    res.json({ referral: { ref, visitors: visitors.rows.map(v => ({ ...v, visits: Number(v.visits) })), events: events.rows.map(event => ({ ...event, referrer_label: readableReferrer(event.referrer) })) }, pagination: { page, page_size: pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (e) {
    console.error('admin tracking detail error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin overview: database-backed real stats
app.get('/api/admin/overview', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const totals = await db.query(`SELECT
      (SELECT COUNT(*) FROM analytics_events) AS total_visits,
      (SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE) AS visits_today,
      (SELECT COUNT(DISTINCT visitor_id) FROM analytics_events WHERE visitor_id IS NOT NULL) AS visitors,
      (SELECT COUNT(DISTINCT ip) FROM analytics_events WHERE ip IS NOT NULL) AS ips_observed,
      (SELECT COUNT(*) FROM analytics_events WHERE visitor_id IS NULL) AS unidentified_visits`);
    const overview = totals.rows[0];
    res.json({ overview: Object.fromEntries(
      Object.entries(overview).map(([key, value]) => [key, Number(value)])
    ) });
  } catch (e) {
    console.error('admin overview error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin login/logout using username + bcrypt password hash
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 6 });
app.post('/admin/login', loginLimiter, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'missing credentials' });
    }
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedHash = process.env.ADMIN_PASSWORD_HASH;
    if (!expectedUser || !expectedHash) return res.status(500).json({ error: 'admin not configured' });
    if (username !== expectedUser) {
      return res.status(403).json({ error: 'forbidden' });
    }
    // Normalize accidental surrounding whitespace in stored hash only
    const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
    // In test mode allow direct equality for easier testing without bcrypt.
    let ok = false;
    if (process.env.NODE_ENV === 'test') {
      ok = String(password) === adminPasswordHash;
    } else {
      ok = await bcrypt.compare(password, adminPasswordHash);
    }
    if (!ok) {
      return res.status(403).json({ error: 'forbidden' });
    }
    // regenerate session to prevent fixation, then mark as admin
    req.session.regenerate((err) => {
      if (err) {
        console.error('session regen failed', err);
        return res.status(500).json({ error: 'server error' });
      }
      setAdminSession(req);
      // attach a CSRF token for subsequent admin requests
      try {
        runMiddleware(req, res, csurf())
          .then(() => {
            const token = req.csrfToken ? req.csrfToken() : null;
            res.json({ ok: true, csrfToken: token });
          })
          .catch((e) => {
            // csurf may still work on future requests; return success
            res.json({ ok: true });
          });
      } catch (e) {
        res.json({ ok: true });
      }
    });
  } catch (e) {
    console.error('admin login error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/admin', async (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.send(`
      <html><head><title>Admin Login</title></head><body style="background:#070809;color:#f4f1ec;font-family:Inter,monospace;padding:2rem;">
        <h2 style="font-family:monospace;color:#d3a75a">SYSTEM / ADMIN</h2>
        <form id="login" autocomplete="off" style="display:flex;flex-direction:column;gap:8px;max-width:360px;margin-top:1rem;" method="POST" action="/admin/login">
          <input name="username" id="username" placeholder="Username" autocomplete="username" />
          <input name="password" id="password" type="password" placeholder="Password" autocomplete="new-password" />
          <button id="loginBtn" type="submit" class="btn">Login</button>
        </form>
        <div id="msg" style="color:#f78a8a;margin-top:8px"></div>
        <script>
          (function(){
            const form = document.getElementById('login');
            const msg = document.getElementById('msg');
            if (!form) return;
            // Clear any autofilled value on load (defensive) then handle submit
            try { const pwd = document.getElementById('password'); if (pwd) { pwd.value = ''; } } catch (e) {}
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              msg.textContent = '';
              const u = document.getElementById('username').value;
              const p = document.getElementById('password').value;
              try {
                const r = await fetch('/admin/login', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ username: u, password: p }) });
                if (r.ok) {
                  location.reload();
                } else {
                  const j = await r.json().catch(()=>null);
                  msg.textContent = j?.error || 'Login failed';
                }
              } catch (err) {
                msg.textContent = 'Network error during login.';
              }
            });
          })();
        </script>
      </body></html>
    `);
  }

  // authenticated admin dashboard
  try {
    await runMiddleware(req, res, csurf());
  } catch (e) {
    // if csrf cannot be initialized, continue without token (future requests may obtain it)
  }
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  return res.send(`
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="csrf-token" content="${csrfToken}"><title>Admin / Jeremy Avalos</title><link rel="stylesheet" href="/admin/assets/admin.css?v=${adminAssetVersion}"><script src="/admin/assets/dashboard.js?v=${adminAssetVersion}" defer></script></head>
    <body><div class="shell"><header><div><div class="eyebrow">JEREMYAVALOS.XYZ / PRIVATE</div><h1>ADMIN DASHBOARD</h1></div><div class="actions"><button id="refresh">REFRESH</button><button id="logout">LOGOUT</button></div></header>
    <nav><a href="#overview">OVERVIEW</a><a href="#visitors">VISITORS</a><a href="#ips">IPS</a><a href="#tracking">TRACKING / INTERACTIONS</a></nav><main>
    <section id="overview"><div class="section-head"><div><span>01</span><h2>OVERVIEW</h2></div><p id="updated">Loading dashboard…</p></div><div id="overview-content" class="metric-grid"><div class="state">Loading overview…</div></div></section>
    <section id="visitors"><div class="section-head"><div><span>02</span><h2>VISITORS</h2></div><p>First-party browser IDs · location is approximate</p></div><div id="visitors-content"><div class="state">Loading visitors…</div></div><div id="visitor-detail" hidden></div><div id="visitor-pagination" class="pagination"></div></section>
    <section id="ips"><div class="section-head"><div><span>03</span><h2>IPS OBSERVED</h2></div><p>Raw network analytics · location is approximate</p></div><div id="ips-content"><div class="state">Loading IPs…</div></div><div id="ip-detail" hidden></div><div id="ip-pagination" class="pagination"></div></section>
    <section id="tracking"><div class="section-head"><div><span>04</span><h2>TRACKING / INTERACTIONS</h2></div><p>First-party events, referrals and page activity</p></div><div id="tracking-content"><div class="state">Loading tracking…</div></div><div id="tracking-detail" hidden></div><div id="tracking-pagination" class="pagination"></div></section>
    </main></div></body></html>
  `);

});

// Logout endpoint
app.post('/admin/logout', async (req, res) => {
  try {
    // require CSRF for admin logout
    if (isAdminAuthenticated(req)) {
      await runMiddleware(req, res, csurf());
    }
  } catch (e) {
    console.error('csrf logout failed', e);
    return res.status(403).json({ error: 'forbidden' });
  }
  clearAdminSession(req);
  res.json({ ok: true });
});

const HOST = process.env.HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`Server listening on ${HOST}:${PORT}`));
}

module.exports = app;
module.exports.getClientIp = getClientIp;
module.exports.getClientIpDetails = getClientIpDetails;
module.exports.normalizeAnalyticsPath = normalizeAnalyticsPath;
module.exports.parseFingerprint = parseFingerprint;
