require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const csurf = require('csurf');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { Chess } = require('chess.js');
const db = require('./db');
const { getTurnState } = require('./turn');
const { createGeolocationService } = require('./geolocation');

const geolocation = createGeolocationService({ db, token: process.env.IPINFO_TOKEN });

const app = express();
// Trust the first proxy (Railway) so req.ip and related helpers reflect the client IP
app.set('trust proxy', 1);
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
  await db.query(`UPDATE challenges c SET visitor_id = NULL WHERE c.visitor_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM analytics_events ae WHERE ae.visitor_id = c.visitor_id)`);
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

function hashToken(token) {
  const secret = process.env.PLAYER_TOKEN_SECRET || 'dev_secret';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(28).toString('hex');
}

function parseVisitorId(value) {
  if (value == null || value === '') return null;
  const visitorId = String(value).trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(visitorId) ? visitorId : false;
}

function generateResumeToken(challenge) {
  const secret = process.env.PLAYER_TOKEN_SECRET || 'dev_secret';
  return crypto.createHmac('sha256', secret)
    .update(`resume:${challenge.id}:${challenge.player_token_hash}`)
    .digest('hex');
}

function isValidPlayerToken(challenge, token) {
  if (!challenge || !token) return false;
  const suppliedHash = hashToken(token);
  if (suppliedHash === challenge.player_token_hash) return true;
  const expectedResume = Buffer.from(generateResumeToken(challenge));
  const suppliedResume = Buffer.from(String(token));
  return expectedResume.length === suppliedResume.length && crypto.timingSafeEqual(expectedResume, suppliedResume);
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

// Turn classifications must never be served from a stale browser cache.
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Create challenge
app.post('/api/challenges', async (req, res) => {
  try {
    const { gamertag, email } = req.body;
    const visitorId = parseVisitorId(req.body?.visitor_id);
    if (!gamertag) return res.status(400).json({ error: 'gamertag required' });
    if (visitorId === false) return res.status(400).json({ error: 'invalid visitor id' });
    const gameType = 'chess';

    const token = generateToken();
    const tokenHash = hashToken(token);
    const createdIp = req.ip || null;

    // create challenge row
    // transactional creation: challenge + first game (if chess)
    const result = await db.transaction(async (client) => {
      const r = await client.query(`INSERT INTO challenges (gamertag, player_token_hash, game_type, email, created_ip, visitor_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [gamertag, tokenHash, gameType, email || null, createdIp, visitorId]);
      const challenge = r.rows[0];
      let gameRow = null;
      if (gameType === 'chess') {
        const chess = new Chess();
        const fen = chess.fen();
        // determine challenger color for game 1 randomly
        const challengerColor = Math.random() < 0.5 ? 'white' : 'black';
        const g = await client.query(`INSERT INTO games (challenge_id, game_number, fen_start, fen_current, challenger_color) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [challenge.id, 1, fen, fen, challengerColor]);
        gameRow = g.rows[0];
        await client.query(`UPDATE challenges SET current_game_id = $1 WHERE id = $2`, [gameRow.id, challenge.id]);
      }
      return { challenge: challenge, game: gameRow };
    });

    const challenge = result.challenge;
    res.json({
      challenge: { id: challenge.id, gamertag: challenge.gamertag, game_type: challenge.game_type },
      token,
      match_url: `${process.env.PUBLIC_URL || ''}/?challenge=${challenge.id}&token=${token}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// helper to get challenge and verify token
async function getChallengeAndVerify(id, token) {
  const ch = await db.query('SELECT * FROM challenges WHERE id = $1', [id]);
  if (!ch.rows.length) return null;
  const challenge = ch.rows[0];
  if (!token) return { challenge, authorized: false };
  return { challenge, authorized: isValidPlayerToken(challenge, token) };
}

// Get challenge
app.get('/api/challenges/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token || req.headers.authorization?.split(' ')[1];
    const { challenge, authorized } = await getChallengeAndVerify(id, token) || {};
    if (!challenge) return res.status(404).json({ error: 'not found' });
    res.json({ challenge: { id: challenge.id, gamertag: challenge.gamertag, game_type: challenge.game_type, status: challenge.status, player_wins: challenge.player_wins, jeremy_wins: challenge.jeremy_wins, draws: challenge.draws }, authorized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Get current game for challenge
app.get('/api/challenges/:id/games/current', async (req, res) => {
  try {
    const { id } = req.params;
    const q = await db.query('SELECT current_game_id FROM challenges WHERE id = $1', [id]);
    if (!q.rows.length) return res.status(404).json({ error: 'not found' });
    const currentGameId = q.rows[0].current_game_id;
    if (!currentGameId) return res.status(404).json({ error: 'no game' });
    const g = await db.query('SELECT * FROM games WHERE id = $1', [currentGameId]);
    if (!g.rows.length) return res.status(404).json({ error: 'game not found' });
    res.json({ game: g.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Play a move: server validates with chess.js
app.post('/api/games/:id/moves', async (req, res) => {
  try {
    const gameId = req.params.id;
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    const { from, to, promotion } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    // load game and challenge
    const gq = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (!gq.rows.length) return res.status(404).json({ error: 'game not found' });
    const game = gq.rows[0];
    const chq = await db.query('SELECT * FROM challenges WHERE id = $1', [game.challenge_id]);
    const challenge = chq.rows[0];

    if (game.status === 'finished') return res.status(409).json({ error: 'game already completed' });

    // determine actor: challenger (with token) or admin (Jeremy)
    const isChallenger = isValidPlayerToken(challenge, token);
    const isAdmin = isAdminAuthenticated(req);
    if (!isChallenger && !isAdmin) return res.status(401).json({ error: 'unauthorized' });

    // If this request is coming from an admin session, require CSRF token
    if (isAdmin) {
      try {
        await runMiddleware(req, res, csurf());
      } catch (e) {
        console.error('admin csrf validation failed', e);
        return res.status(403).json({ error: 'forbidden' });
      }
    }

    // server-side chess validation
    const chess = new Chess(game.fen_current);
    const turn = getTurnState(game.fen_current, game.challenger_color);
    const actorCanMove = isChallenger ? turn.isChallengerTurn : (isAdmin && turn.isJeremyTurn);
    if (!actorCanMove) return res.status(403).json({ error: 'not your turn' });

    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;
    const result = chess.move(moveObj);
    if (!result) return res.status(400).json({ error: 'illegal move' });

    const fenAfter = chess.fen();

    // transactional persistence: insert move, update game, possibly update challenge and create next game
    const response = await db.transaction(async (client) => {
      const mvCountRes = await client.query('SELECT COUNT(*) FROM moves WHERE game_id = $1', [gameId]);
      const moveNumber = Number(mvCountRes.rows[0].count) + 1;
      await client.query(
        `INSERT INTO moves (game_id, move_number, uci, san, from_sq, to_sq, piece, fen_after, player_side) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [gameId, moveNumber, result.from + result.to, result.san, result.from, result.to, result.piece, fenAfter, result.color === 'w' ? 'white' : 'black']
      );

      // determine game terminal state
      let gameStatus = 'ongoing';
      let gameResult = null;
      let challengerTurnAfterMove = true;
      if (chess.isCheckmate()) {
        gameStatus = 'finished';
        gameResult = chess.turn() === 'w' ? 'black' : 'white';
      } else if (chess.isStalemate() || chess.isDraw() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        gameStatus = 'finished';
        gameResult = 'draw';
      }

      await client.query('UPDATE games SET fen_current = $1, status = $2, result = $3, ended_at = CASE WHEN $2 = $4 THEN now() ELSE ended_at END WHERE id = $5', [fenAfter, gameStatus, gameResult, 'finished', gameId]);

      // if game finished, update challenge
      if (gameStatus === 'finished') {
        if (gameResult === 'draw') {
          await client.query('UPDATE challenges SET draws = draws + 1, updated_at = now() WHERE id = $1', [challenge.id]);
        } else {
          // determine who won: compare gameResult with challenger_side
          const challengerWon = (gameResult === turn.challengerColor);
          if (challengerWon) {
            await client.query('UPDATE challenges SET player_wins = player_wins + 1, updated_at = now() WHERE id = $1', [challenge.id]);
          } else {
            await client.query('UPDATE challenges SET jeremy_wins = jeremy_wins + 1, updated_at = now() WHERE id = $1', [challenge.id]);
          }

        }
        const c2 = await client.query('SELECT player_wins, jeremy_wins FROM challenges WHERE id = $1 FOR UPDATE', [challenge.id]);
        const counts = c2.rows[0];
        if (counts.player_wins >= 2 || counts.jeremy_wins >= 2) {
          challengerTurnAfterMove = false;
          const winner = counts.player_wins >= 2 ? 'player' : 'jeremy';
          await client.query('UPDATE challenges SET status = $1, winner = $2, updated_at = now() WHERE id = $3', ['completed', winner, challenge.id]);
        } else {
          const nextNumber = game.game_number + 1;
          const nextChallengerColor = turn.challengerColor === 'white' ? 'black' : 'white';
          challengerTurnAfterMove = nextChallengerColor === 'white';
          const fen = new Chess().fen();
          const newG = await client.query('INSERT INTO games (challenge_id, game_number, fen_start, fen_current, challenger_color) VALUES ($1,$2,$3,$4,$5) RETURNING *', [challenge.id, nextNumber, fen, fen, nextChallengerColor]);
          await client.query('UPDATE challenges SET current_game_id = $1, updated_at = now() WHERE id = $2', [newG.rows[0].id, challenge.id]);
        }
      }

      return { move: result, fen: fenAfter, gameStatus, gameResult, challengerTurnAfterMove };
    });

    const { challengerTurnAfterMove, ...moveResponse } = response;
    res.json(Object.assign({ ok: true }, moveResponse));
    // Send non-blocking notifications
    (async () => {
      try {
        const fromChallenger = isChallenger;
        const challengerEmail = challenge.email;
        const fromEmail = process.env.CHALLENGE_FROM_EMAIL;
        const resendKey = process.env.RESEND_API_KEY;
        const jeremyEmail = process.env.JEREMY_NOTIFICATION_EMAIL;
        console.info(`EMAIL: challenge email present: ${Boolean(challengerEmail)}`);
        console.info(`EMAIL: RESEND_API_KEY configured: ${Boolean(resendKey)}`);
        console.info(`EMAIL: CHALLENGE_FROM_EMAIL configured: ${Boolean(fromEmail)}`);
        console.info(`EMAIL: JEREMY_NOTIFICATION_EMAIL configured: ${Boolean(jeremyEmail)}`);

        // Helper
        async function sendMail(to, subject, html, requestedLabel) {
          console.info(`EMAIL: ${requestedLabel} notification requested`);
          if (!resendKey || !fromEmail || !to) {
            console.warn('EMAIL: skipped — required recipient or configuration missing');
            return { accepted: false, skipped: true };
          }
          try {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`
              },
              body: JSON.stringify({ from: fromEmail, to: [to], subject, html })
            });
            let result = null;
            try { result = await response.json(); } catch (e) { /* response body is optional */ }
            if (!response.ok) {
              console.error(`EMAIL: Resend rejected request status=${response.status}`);
              return { accepted: false, status: response.status };
            }
            console.info(`EMAIL: Resend accepted message id=${result?.id || 'not-returned'}`);
            return { accepted: true, id: result?.id || null };
          } catch (e) {
            console.error(`EMAIL: send failed ${e?.code || e?.name || 'request-error'}`);
            return { accepted: false };
          }
        }

        if (fromChallenger) {
          // Notify Jeremy of a new move
          if (jeremyEmail) {
            const subject = `${challenge.gamertag} made a move`;
            const html = `<p>${escapeHtml(challenge.gamertag)} made a move.<br/>Chess · Game ${game.game_number} · Best of 3<br/>It's your turn.</p><p><a href="${process.env.PUBLIC_URL || ''}/admin/open/${challenge.id}">Open Match</a></p>`;
            await sendMail(jeremyEmail, subject, html, 'Jeremy');
          } else {
            console.warn('EMAIL: skipped — JEREMY_NOTIFICATION_EMAIL not configured');
          }
        } else {
          // Admin moved (Jeremy) — notify challenger if email provided
          if (challengerEmail && challengerTurnAfterMove) {
            const resumeToken = generateResumeToken(challenge);
            const matchUrl = `${process.env.PUBLIC_URL || ''}/?challenge=${encodeURIComponent(challenge.id)}&token=${encodeURIComponent(resumeToken)}`;
            const subject = `Jeremy moved against ${challenge.gamertag} — your turn`;
            const html = `<p>Jeremy responded to ${escapeHtml(challenge.gamertag)}.<br/>Chess · Game ${game.game_number} · Best of 3<br/>It's your turn.</p><p><a href="${matchUrl}">Continue Match</a></p>`;
            await sendMail(challengerEmail, subject, html, 'challenger');
          } else if (!challengerEmail) {
            console.info('EMAIL: skipped — challenger has no email');
          } else {
            console.info('EMAIL: skipped — challenger does not move next');
          }
        }
      } catch (e) {
        console.error('Notification error', e);
      }
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Return legal moves for a given square (requires authorization: player token or admin)
app.get('/api/games/:id/legal', async (req, res) => {
  try {
    const gameId = req.params.id;
    const square = req.query.square;
    if (!square) return res.status(400).json({ error: 'square required' });

    const token = req.headers.authorization?.split(' ')[1] || req.query.token;

    const gq = await db.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (!gq.rows.length) return res.status(404).json({ error: 'game not found' });
    const game = gq.rows[0];
    const chq = await db.query('SELECT * FROM challenges WHERE id = $1', [game.challenge_id]);
    const challenge = chq.rows[0];

    const isChallenger = isValidPlayerToken(challenge, token);
    const isAdmin = isAdminAuthenticated(req);
    if (!isChallenger && !isAdmin) return res.status(401).json({ error: 'unauthorized' });

    const turn = getTurnState(game.fen_current, game.challenger_color);
    const actorCanMove = isChallenger ? turn.isChallengerTurn : turn.isJeremyTurn;
    if (!actorCanMove) return res.status(403).json({ error: 'not your turn' });

    const chess = new Chess(game.fen_current);
    const moves = chess.moves({ square, verbose: true }) || [];
    // return concise moves
    const out = moves.map(m => ({ to: m.to, from: m.from, san: m.san, flags: m.flags, promotion: m.promotion || null }));
    res.json({ moves: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Leaderboard: public summary
app.get('/api/leaderboard', async (req, res) => {
  try {
    const q = await db.query(`SELECT gamertag, SUM(player_wins) as wins, SUM(jeremy_wins) as losses, SUM(draws) as draws FROM challenges WHERE game_type='chess' GROUP BY gamertag ORDER BY SUM(player_wins) DESC LIMIT 50`);
    res.json({ leaderboard: q.rows.map(r => ({ gamertag: r.gamertag, wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Analytics tracking (privacy-friendly)
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { path, referrer, device_category, browser_family } = req.body || {};
    const visitorId = parseVisitorId(req.body?.visitor_id);
    if (visitorId === false) return res.status(400).json({ error: 'invalid visitor id' });
    // Determine client IP using Express's req.ip with trust proxy set. This
    // respects trusted proxies (Railway). Do NOT trust raw X-Forwarded-For
    // headers from clients.
    const ip = req.ip || null;
    const inserted = await db.query(
      'INSERT INTO analytics_events (path, referrer, user_agent, device_category, browser_family, country, ip, visitor_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
      [path || req.path, referrer || req.get('Referer') || null, req.get('User-Agent') || null, device_category || null, browser_family || null, null, ip, visitorId]
    );
    res.json({ ok: true });
    geolocation.enrichEvent(inserted.rows[0]?.id, ip).catch(error => console.warn('IP geolocation enrichment failed', error.message));
  } catch (e) {
    console.error('analytics track error', e);
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
        COALESCE((SELECT array_agg(a.gamertag ORDER BY a.gamertag) FROM
          (SELECT DISTINCT c.gamertag FROM challenges c WHERE c.visitor_id = ae.visitor_id) a), ARRAY[]::text[]) AS associated_gamertags,
        COUNT(DISTINCT ae.ip) FILTER (WHERE ae.ip IS NOT NULL) AS ip_count,
        (array_agg(ae.ip ORDER BY ae.created_at DESC) FILTER (WHERE ae.ip IS NOT NULL))[1] AS most_recent_ip,
        (array_agg(ae.country ORDER BY ae.created_at DESC) FILTER (WHERE ae.country IS NOT NULL))[1] AS country,
        (array_agg(ae.region ORDER BY ae.created_at DESC) FILTER (WHERE ae.region IS NOT NULL))[1] AS region,
        (array_agg(ae.city ORDER BY ae.created_at DESC) FILTER (WHERE ae.city IS NOT NULL))[1] AS city,
        (array_agg(ae.asn_org ORDER BY ae.created_at DESC) FILTER (WHERE ae.asn_org IS NOT NULL))[1] AS asn_org,
        (array_agg(ae.device_category ORDER BY ae.created_at DESC) FILTER (WHERE ae.device_category IS NOT NULL))[1] AS device_category,
        (array_agg(ae.browser_family ORDER BY ae.created_at DESC) FILTER (WHERE ae.browser_family IS NOT NULL))[1] AS browser_family,
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
    const q = await db.query(`SELECT path, referrer, user_agent, device_category, browser_family, ip, country, region, city, timezone, asn_org, created_at
      FROM analytics_events WHERE visitor_id = $1 ORDER BY created_at DESC LIMIT 200`, [visitorId]);
    if (!q.rows.length) return res.status(404).json({ error: 'visitor not found' });
    const associated = await db.query(`SELECT gamertag, status, created_at, winner, player_wins, jeremy_wins, draws
      FROM challenges WHERE visitor_id = $1 ORDER BY created_at DESC`, [visitorId]);
    const observed = await db.query(`SELECT ip, COUNT(*) AS visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
      (array_agg(country ORDER BY created_at DESC) FILTER (WHERE country IS NOT NULL))[1] AS country,
      (array_agg(region ORDER BY created_at DESC) FILTER (WHERE region IS NOT NULL))[1] AS region,
      (array_agg(city ORDER BY created_at DESC) FILTER (WHERE city IS NOT NULL))[1] AS city,
      (array_agg(timezone ORDER BY created_at DESC) FILTER (WHERE timezone IS NOT NULL))[1] AS timezone,
      (array_agg(asn_org ORDER BY created_at DESC) FILTER (WHERE asn_org IS NOT NULL))[1] AS asn_org
      FROM analytics_events WHERE visitor_id = $1 AND ip IS NOT NULL GROUP BY ip ORDER BY last_seen DESC`, [visitorId]);
    const s = summary.rows[0];
    const associatedChallenges = associated.rows.map(c => ({ gamertag: c.gamertag, status: c.status, created_at: c.created_at, result: c.status === 'completed' ? (c.winner === 'jeremy' ? 'Jeremy won' : c.winner === 'player' ? 'Challenger won' : 'Completed') : null, score: { jeremy: Number(c.jeremy_wins), challenger: Number(c.player_wins), draws: Number(c.draws) } }));
    res.json({ visitor: { visitor_id: visitorId, associated_gamertags: [...new Set(associatedChallenges.map(c => c.gamertag))].sort(), associated_challenges: associatedChallenges, country: s.country, region: s.region, city: s.city, timezone: s.timezone, asn_org: s.asn_org, browser_family: s.browser_family, device_category: s.device_category, user_agent: s.user_agent, first_seen: s.first_seen, last_seen: s.last_seen, total_visits: Number(s.total_visits), observed_ips: observed.rows.map(ip => ({ ...ip, visits: Number(ip.visits) })), recent_visits: q.rows } });
  } catch (e) {
    console.error('admin visitor detail error', e);
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
      COALESCE((SELECT array_agg(a.gamertag ORDER BY a.gamertag) FROM
        (SELECT DISTINCT c.gamertag FROM challenges c WHERE c.created_ip = ae.ip) a), ARRAY[]::text[]) AS ip_associated_gamertags,
      (array_agg(ae.country ORDER BY ae.created_at DESC) FILTER (WHERE ae.country IS NOT NULL))[1] AS country,
      (array_agg(ae.region ORDER BY ae.created_at DESC) FILTER (WHERE ae.region IS NOT NULL))[1] AS region,
      (array_agg(ae.city ORDER BY ae.created_at DESC) FILTER (WHERE ae.city IS NOT NULL))[1] AS city,
      (array_agg(ae.asn_org ORDER BY ae.created_at DESC) FILTER (WHERE ae.asn_org IS NOT NULL))[1] AS asn_org,
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
    const q = await db.query(`SELECT path, referrer, user_agent, device_category, browser_family, country, region, city, timezone, asn_org, visitor_id, created_at
      FROM analytics_events WHERE ip = $1 ORDER BY created_at DESC LIMIT 200`, [ip]);
    if (!q.rows.length) return res.status(404).json({ error: 'ip not found' });
    const associated = await db.query(`SELECT gamertag, status, created_at FROM challenges
      WHERE created_ip = $1 ORDER BY created_at DESC`, [ip]);
    res.json({ ip: { address: ip, ip_associated_gamertags: [...new Set(associated.rows.map(c => c.gamertag))].sort(), associated_challenges: associated.rows, recent_visits: q.rows } });
  } catch (e) {
    console.error('admin ip detail error', e);
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
      (SELECT COUNT(*) FROM analytics_events WHERE visitor_id IS NULL) AS unidentified_visits,
      (SELECT COUNT(*) FROM challenges WHERE game_type='chess') AS total_challenges,
      (SELECT COUNT(*) FROM challenges WHERE game_type='chess' AND status <> 'completed') AS active_matches,
      (SELECT COUNT(*) FROM games WHERE status='finished') AS games_completed,
      (SELECT COALESCE(SUM(jeremy_wins),0) FROM challenges) AS jeremy_wins,
      (SELECT COALESCE(SUM(player_wins),0) FROM challenges) AS player_wins`);
    // current streak: look at most recent completed games and count consecutive same winner
    const recent = await db.query("SELECT winner, updated_at FROM challenges WHERE status='completed' AND winner IS NOT NULL ORDER BY updated_at DESC LIMIT 50");
    let streak = { who: null, count: 0 };
    for (const r of recent.rows) {
      if (!streak.who) { streak.who = r.winner; streak.count = 1; }
      else if (r.winner === streak.who) streak.count += 1; else break;
    }
    const activeTurns = await db.query(`SELECT g.fen_current, g.challenger_color FROM challenges c
      JOIN games g ON g.id = c.current_game_id WHERE c.status <> 'completed'`);
    const myTurnCount = activeTurns.rows.reduce((count, game) => count + (getTurnState(game.fen_current, game.challenger_color).isJeremyTurn ? 1 : 0), 0);
    const t = totals.rows[0];
    res.json({ overview: { total_visits: Number(t.total_visits), visits_today: Number(t.visits_today), visitors: Number(t.visitors), ips_observed: Number(t.ips_observed), unidentified_visits: Number(t.unidentified_visits), total_challenges: Number(t.total_challenges), active_matches: Number(t.active_matches), games_completed: Number(t.games_completed), jeremy_wins: Number(t.jeremy_wins), player_wins: Number(t.player_wins), current_streak: streak, my_turn: myTurnCount } });
  } catch (e) {
    console.error('admin overview error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Public stats endpoint (reads from DB; no sensitive data)
app.get('/api/stats', async (req, res) => {
  try {
    const totalChallenges = await db.query("SELECT COUNT(*) FROM challenges WHERE game_type='chess'");
    const gamesCompleted = await db.query("SELECT COUNT(*) FROM games WHERE status='finished'");
    const jeremyWins = await db.query("SELECT COALESCE(SUM(jeremy_wins),0) AS v FROM challenges");
    const playerWins = await db.query("SELECT COALESCE(SUM(player_wins),0) AS v FROM challenges");
    const draws = await db.query("SELECT COALESCE(SUM(draws),0) AS v FROM challenges");
    const recent = await db.query("SELECT winner, updated_at FROM challenges WHERE status='completed' AND winner IS NOT NULL ORDER BY updated_at DESC LIMIT 50");
    let streak = { who: null, count: 0 };
    for (const r of recent.rows) {
      if (!streak.who) { streak.who = r.winner; streak.count = 1; }
      else if (r.winner === streak.who) streak.count += 1; else break;
    }
    res.json({ total_challenges: Number(totalChallenges.rows[0].count), games_completed: Number(gamesCompleted.rows[0].count), jeremy_wins: Number(jeremyWins.rows[0].v), challenger_wins: Number(playerWins.rows[0].v), draws: Number(draws.rows[0].v), current_streak: streak });
  } catch (e) {
    console.error('public stats error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Get game details and move history
app.get('/api/games/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const g = await db.query('SELECT * FROM games WHERE id = $1', [id]);
    if (!g.rows.length) return res.status(404).json({ error: 'game not found' });
    const game = g.rows[0];
    const mv = await db.query('SELECT move_number, uci, san, from_sq, to_sq, piece, fen_after, player_side, created_at FROM moves WHERE game_id = $1 ORDER BY move_number', [id]);
    res.json({ game, moves: mv.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin challenge list. No private challenger tokens are selected or returned.
app.get('/api/admin/challenges', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const q = await db.query(`SELECT c.id, c.gamertag, c.status, c.player_wins, c.jeremy_wins, c.draws, c.winner, c.created_at, c.updated_at, c.game_type,
      (c.email IS NOT NULL AND btrim(c.email) <> '') AS email_enabled,
      g.id AS game_id, g.game_number, g.fen_current, g.challenger_color, g.status AS game_status,
      COALESCE((SELECT MAX(m.created_at) FROM moves m WHERE m.game_id = g.id), g.created_at, c.updated_at) AS last_move_at
      FROM challenges c LEFT JOIN games g ON g.id = c.current_game_id ORDER BY c.updated_at DESC LIMIT 200`);
    const out = q.rows.map(c => {
      const turn = c.game_id ? getTurnState(c.fen_current, c.challenger_color) : null;
      return { id: c.id, gamertag: c.gamertag, game_type: c.game_type, status: c.status, email_enabled: Boolean(c.email_enabled), player_wins: c.player_wins, jeremy_wins: c.jeremy_wins, draws: c.draws, winner: c.winner, created_at: c.created_at, updated_at: c.updated_at, last_move_at: c.last_move_at, admin_turn: c.status !== 'completed' && Boolean(turn?.isJeremyTurn), challenger_turn: c.status !== 'completed' && Boolean(turn?.isChallengerTurn), current_game: c.game_id ? { id: c.game_id, game_number: c.game_number, challenger_color: turn.challengerColor, jeremy_color: turn.jeremyColor, side_to_move: turn.sideToMove, status: c.game_status } : null };
    });
    res.json({ challenges: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/admin/challenges/:id/match', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const ch = await db.query(`SELECT id, gamertag, status, player_wins, jeremy_wins, draws, winner, current_game_id,
      (email IS NOT NULL AND btrim(email) <> '') AS email_enabled
      FROM challenges WHERE id = $1`, [req.params.id]);
    if (!ch.rows.length) return res.status(404).json({ error: 'challenge not found' });
    const challenge = ch.rows[0];
    if (!challenge.current_game_id) return res.status(404).json({ error: 'no active game' });
    const g = await db.query(`SELECT id, game_number, fen_current, challenger_color, status, result, created_at, ended_at
      FROM games WHERE id = $1`, [challenge.current_game_id]);
    if (!g.rows.length) return res.status(404).json({ error: 'game not found' });
    const game = g.rows[0];
    const moves = await db.query(`SELECT move_number, uci, san, from_sq, to_sq, player_side, created_at
      FROM moves WHERE game_id = $1 ORDER BY move_number`, [game.id]);
    const turn = getTurnState(game.fen_current, game.challenger_color);
    res.json({ challenge: { id: challenge.id, gamertag: challenge.gamertag, status: challenge.status, email_enabled: Boolean(challenge.email_enabled), player_wins: challenge.player_wins, jeremy_wins: challenge.jeremy_wins, draws: challenge.draws, winner: challenge.winner }, game: { ...game, challenger_color: turn.challengerColor, jeremy_color: turn.jeremyColor, side_to_move: turn.sideToMove, admin_turn: challenge.status !== 'completed' && turn.isJeremyTurn, challenger_turn: challenge.status !== 'completed' && turn.isChallengerTurn }, moves: moves.rows });
  } catch (err) {
    console.error('admin match error', err);
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
    <nav><a href="#overview">OVERVIEW</a><a href="#my-turn">MY TURN <span id="turn-count">—</span></a><a href="#waiting">WAITING</a><a href="#challenges">CHALLENGES</a><a href="#visitors">VISITORS</a><a href="#ips">IPS</a><a href="#completed">COMPLETED</a></nav><main>
    <section id="overview"><div class="section-head"><div><span>01</span><h2>OVERVIEW</h2></div><p id="updated">Loading dashboard…</p></div><div id="overview-content" class="metric-grid"><div class="state">Loading overview…</div></div></section>
    <section id="my-turn"><div class="section-head"><div><span>02</span><h2>MY TURN</h2></div></div><div id="myturn-content"><div class="state">Loading challenges…</div></div></section>
    <section id="waiting"><div class="section-head"><div><span>03</span><h2>WAITING</h2></div></div><div id="waiting-content"><div class="state">Loading challenges…</div></div></section>
    <section id="challenges"><div class="section-head"><div><span>04</span><h2>CHALLENGES</h2></div></div><div id="challenges-content"><div class="state">Loading challenges…</div></div></section>
    <section id="visitors"><div class="section-head"><div><span>05</span><h2>VISITORS</h2></div><p>First-party browser IDs · location is approximate</p></div><div id="visitors-content"><div class="state">Loading visitors…</div></div><div id="visitor-detail" hidden></div><div id="visitor-pagination" class="pagination"></div></section>
    <section id="ips"><div class="section-head"><div><span>06</span><h2>IPS OBSERVED</h2></div><p>Raw network analytics · location is approximate</p></div><div id="ips-content"><div class="state">Loading IPs…</div></div><div id="ip-detail" hidden></div><div id="ip-pagination" class="pagination"></div></section>
    <section id="completed"><div class="section-head"><div><span>07</span><h2>COMPLETED</h2></div></div><div id="completed-content"><div class="state">Loading completed matches…</div></div></section>
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

// Admin open a challenge (redirect to challenge page on frontend but as admin session)
app.get('/admin/open/:id', async (req, res) => {
  if (!isAdminAuthenticated(req)) return res.status(403).send('forbidden');
  const id = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).send('invalid challenge');
  // redirect admin to public frontend with challenge id (no token) — admin cookie authenticates moves
  // Serve a minimal admin match UI that allows Jeremy to view and play the match without exposing secrets.
  // initialize csurf and expose token to admin UI
  try {
    await runMiddleware(req, res, csurf());
  } catch (e) {}
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  return res.send(`
    <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="csrf-token" content="${csrfToken}"><meta name="challenge-id" content="${id}"><title>Admin Match</title><link rel="stylesheet" href="/admin/assets/admin.css?v=${adminAssetVersion}"><script src="/admin/assets/match.js?v=${adminAssetVersion}" defer></script></head>
    <body><div class="shell match-shell"><header><div><div class="eyebrow">PRIVATE / MATCH CONTROL</div><h1>ADMIN MATCH</h1></div><a class="button" href="/admin">← DASHBOARD</a></header><main><section><div id="match-meta" class="state">Loading match…</div><div id="match-error" class="error" hidden></div><div class="match-layout"><div><div id="board" class="board"></div><p id="move-status" class="state">Select a piece to move.</p></div><div><h2>MOVE HISTORY</h2><ol id="history" class="history"></ol></div></div></section></main></div></body></html>
  `);
});

const HOST = process.env.HOST || '0.0.0.0';
if (require.main === module) {
  app.listen(PORT, HOST, () => console.log(`Server listening on ${HOST}:${PORT}`));
}

module.exports = app;
