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
const { v4: uuidv4 } = require('uuid');
const { Chess } = require('chess.js');
const db = require('./db');

const app = express();
// Trust the first proxy (Railway) so req.ip and related helpers reflect the client IP
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware (server-side session). For production, consider a persistent store.
app.use(session({
  store: new PgSession({ pool: db.pool, tableName: 'session' }),
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

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no Origin (same-origin or server-side requests)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Log rejected origin for debugging in production (temporary)
    try { console.warn('CORS: rejected origin ->', origin); } catch (e) {}
    return cb(new Error('Not allowed by CORS'));
  },
  // Credentials (cookies) are required for admin session flows. Only
  // allowed origins will be accepted by the origin check above.
  credentials: true
}));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

function hashToken(token) {
  const secret = process.env.PLAYER_TOKEN_SECRET || 'dev_secret';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(28).toString('hex');
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

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Create challenge
app.post('/api/challenges', async (req, res) => {
  try {
    const { gamertag, game, email } = req.body;
    if (!gamertag) return res.status(400).json({ error: 'gamertag required' });
    const gameType = game === 'backgammon' ? 'backgammon' : 'chess';

    const token = generateToken();
    const tokenHash = hashToken(token);

    // create challenge row
    // transactional creation: challenge + first game (if chess)
    const result = await db.transaction(async (client) => {
      const r = await client.query(`INSERT INTO challenges (gamertag, player_token_hash, game_type, email) VALUES ($1,$2,$3,$4) RETURNING *`, [gamertag, tokenHash, gameType, email || null]);
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
  const tokenHash = hashToken(token);
  return { challenge, authorized: tokenHash === challenge.player_token_hash };
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
    const tokenHash = token ? hashToken(token) : null;
    const isChallenger = tokenHash && tokenHash === challenge.player_token_hash;
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
    // enforce turn: only the side to move can move
    const sideToMove = chess.turn() === 'w' ? 'white' : 'black';
    // determine which side the challenger plays this game
    const challengerSide = game.challenger_color === 'white' ? 'white' : 'black';
    const actorSide = isChallenger ? challengerSide : (isAdmin ? (challengerSide === 'white' ? 'black' : 'white') : null);
    if (actorSide !== sideToMove) return res.status(403).json({ error: 'not your turn' });

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
          const challengerWon = (gameResult === game.challenger_color);
          if (challengerWon) {
            await client.query('UPDATE challenges SET player_wins = player_wins + 1, updated_at = now() WHERE id = $1', [challenge.id]);
          } else {
            await client.query('UPDATE challenges SET jeremy_wins = jeremy_wins + 1, updated_at = now() WHERE id = $1', [challenge.id]);
          }

          // check victory condition
          const c2 = await client.query('SELECT player_wins, jeremy_wins FROM challenges WHERE id = $1 FOR UPDATE', [challenge.id]);
          const counts = c2.rows[0];
          if (counts.player_wins >= 2 || counts.jeremy_wins >= 2) {
            const winner = counts.player_wins >= 2 ? 'player' : 'jeremy';
            await client.query('UPDATE challenges SET status = $1, winner = $2 WHERE id = $3', ['completed', winner, challenge.id]);
          } else {
            // create next game with swapped challenger_color
            const nextNumber = game.game_number + 1;
            const nextChallengerColor = game.challenger_color === 'white' ? 'black' : 'white';
            const chessNew = new Chess();
            const fen = chessNew.fen();
            const newG = await client.query('INSERT INTO games (challenge_id, game_number, fen_start, fen_current, challenger_color) VALUES ($1,$2,$3,$4,$5) RETURNING *', [challenge.id, nextNumber, fen, fen, nextChallengerColor]);
            await client.query('UPDATE challenges SET current_game_id = $1 WHERE id = $2', [newG.rows[0].id, challenge.id]);
          }
        }
      }

      return { move: result, fen: fenAfter, gameStatus, gameResult };
    });

    res.json(Object.assign({ ok: true }, response));
    // Send non-blocking notifications
    (async () => {
      try {
        const fromChallenger = isChallenger;
        const challengerEmail = challenge.email;
        const fromEmail = process.env.CHALLENGE_FROM_EMAIL;
        const resendKey = process.env.RESEND_API_KEY;
        const jeremyEmail = process.env.JEREMY_NOTIFICATION_EMAIL;

        // Helper
        async function sendMail(to, subject, html) {
          if (!resendKey || !fromEmail || !to) return;
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`
              },
              body: JSON.stringify({ from: fromEmail, to: [to], subject, html })
            });
          } catch (e) {
            console.error('Email send failed', e);
          }
        }

        if (fromChallenger) {
          // Notify Jeremy of a new move
          if (jeremyEmail) {
            const subject = `${challenge.gamertag} made a move`;
            const html = `<p>${challenge.gamertag} made a move.<br/>Chess · Game ${game.game_number} · Best of 3<br/>It's your turn.</p><p><a href="${process.env.PUBLIC_URL || ''}/admin/open/${challenge.id}">Open Match</a></p>`;
            await sendMail(jeremyEmail, subject, html);
          }
        } else {
          // Admin moved (Jeremy) — notify challenger if email provided
          if (challengerEmail) {
            const subject = `Jeremy made his move — your turn`;
            const html = `<p>Jeremy responded to your chess challenge.<br/>Game ${game.game_number} · Best of 3<br/>It's your turn.</p><p><a href="${process.env.PUBLIC_URL || ''}/?challenge=${challenge.id}">Continue Match</a></p>`;
            await sendMail(challengerEmail, subject, html).catch(()=>{});
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

    const tokenHash = token ? hashToken(token) : null;
    const isChallenger = tokenHash && tokenHash === challenge.player_token_hash;
    const isAdmin = isAdminAuthenticated(req);
    if (!isChallenger && !isAdmin) return res.status(401).json({ error: 'unauthorized' });

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
    const { path, referrer, device_category, browser_family, country } = req.body || {};
    await db.query('INSERT INTO analytics_events (path, referrer, user_agent, device_category, browser_family, country) VALUES ($1,$2,$3,$4,$5,$6)', [path || req.path, referrer || req.get('Referer') || null, req.get('User-Agent') || null, device_category || null, browser_family || null, country || req.get('CF-IPCountry') || null]);
    res.json({ ok: true });
  } catch (e) {
    console.error('analytics track error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin overview: database-backed real stats
app.get('/api/admin/overview', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const totalChallenges = await db.query("SELECT COUNT(*) FROM challenges WHERE game_type='chess'");
    const gamesCompleted = await db.query("SELECT COUNT(*) FROM games WHERE status='finished'");
    const jeremyWins = await db.query("SELECT COALESCE(SUM(jeremy_wins),0) AS v FROM challenges");
    const playerWins = await db.query("SELECT COALESCE(SUM(player_wins),0) AS v FROM challenges");
    const draws = await db.query("SELECT COALESCE(SUM(draws),0) AS v FROM challenges");
    // current streak: look at most recent completed games and count consecutive same winner
    const recent = await db.query("SELECT winner, ended_at FROM challenges WHERE status='completed' AND winner IS NOT NULL ORDER BY updated_at DESC LIMIT 50");
    let streak = { who: null, count: 0 };
    for (const r of recent.rows) {
      if (!streak.who) { streak.who = r.winner; streak.count = 1; }
      else if (r.winner === streak.who) streak.count += 1; else break;
    }
    // visits today
    const visitsToday = await db.query("SELECT COUNT(*) FROM analytics_events WHERE created_at >= now()::date");
    res.json({ overview: { total_challenges: Number(totalChallenges.rows[0].count), games_completed: Number(gamesCompleted.rows[0].count), jeremy_wins: Number(jeremyWins.rows[0].v), player_wins: Number(playerWins.rows[0].v), draws: Number(draws.rows[0].v), current_streak: streak, visits_today: Number(visitsToday.rows[0].count) } });
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

// Admin minimal endpoint
app.get('/admin/challenges', async (req, res) => {
  try {
    if (!isAdminAuthenticated(req)) return res.status(403).json({ error: 'forbidden' });
    const q = await db.query('SELECT id, gamertag, status, player_wins, jeremy_wins, draws, current_game_id, winner, created_at, updated_at, game_type FROM challenges ORDER BY created_at DESC LIMIT 200');
    const out = [];
    for (const c of q.rows) {
      let game = null;
      let lastMoveAt = null;
      let adminTurn = false;
      if (c.current_game_id) {
        const gq = await db.query('SELECT * FROM games WHERE id = $1', [c.current_game_id]);
        if (gq.rows.length) {
          game = gq.rows[0];
          const mv = await db.query('SELECT max(created_at) as last_at FROM moves WHERE game_id = $1', [game.id]);
          lastMoveAt = mv.rows[0].last_at;
          try {
            const chess = new Chess(game.fen_current);
            const sideToMove = chess.turn() === 'w' ? 'white' : 'black';
            adminTurn = sideToMove !== game.challenger_color;
          } catch (e) {
            adminTurn = false;
          }
        }
      }
      out.push({ id: c.id, gamertag: c.gamertag, game_type: c.game_type, status: c.status, player_wins: c.player_wins, jeremy_wins: c.jeremy_wins, draws: c.draws, current_game: game ? { id: game.id, game_number: game.game_number, challenger_color: game.challenger_color } : null, last_move_at: lastMoveAt, admin_turn: adminTurn });
    }
    res.json({ challenges: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin login/logout using username + bcrypt password hash
const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 6 });
app.post('/admin/login', loginLimiter, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    console.info('POST /admin/login reached from', req.ip);
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing credentials' });
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedHash = process.env.ADMIN_PASSWORD_HASH;
    if (!expectedUser || !expectedHash) return res.status(500).json({ error: 'admin not configured' });
    if (username !== expectedUser) return res.status(403).json({ error: 'forbidden' });
    const ok = await bcrypt.compare(password, expectedHash);
    if (!ok) return res.status(403).json({ error: 'forbidden' });
    // regenerate session to prevent fixation, then mark as admin
    req.session.regenerate((err) => {
      if (err) {
        console.error('session regen failed', err);
        return res.status(500).json({ error: 'server error' });
      }
      setAdminSession(req);
      console.info('admin login success (session established) from', req.ip);
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
  console.info('GET /admin reached from', req.ip);
  if (!isAdminAuthenticated(req)) {
    return res.send(`
      <html><head><title>Admin Login</title></head><body style="background:#070809;color:#f4f1ec;font-family:Inter,monospace;padding:2rem;">
        <h2 style="font-family:monospace;color:#d3a75a">SYSTEM / ADMIN</h2>
        <form id="login" style="display:flex;flex-direction:column;gap:8px;max-width:360px;margin-top:1rem;" method="POST" action="/admin/login">
          <input name="username" id="username" placeholder="Username" />
          <input name="password" id="password" type="password" placeholder="Password" />
          <button id="loginBtn" type="submit" class="btn">Login</button>
        </form>
        <div id="msg" style="color:#f78a8a;margin-top:8px"></div>
        <script>
          // Diagnostic-friendly submit handler: surface network errors and do a fetch if JS runs.
          (function(){
            const form = document.getElementById('login');
            const msg = document.getElementById('msg');
            if (!form) return;
            console.log('Admin login form initialized');
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              msg.textContent = '';
              const u = document.getElementById('username').value;
              const p = document.getElementById('password').value;
              try {
                console.log('Admin login: submitting request');
                const r = await fetch('/admin/login', { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'}, body: new URLSearchParams({ username: u, password: p }) });
                if (r.ok) {
                  console.log('Admin login: success response received');
                  location.reload();
                } else {
                  console.warn('Admin login: non-OK response');
                  const j = await r.json().catch(()=>null);
                  msg.textContent = j?.error || 'Login failed';
                }
              } catch (err) {
                console.error('Admin login: fetch failed', err);
                msg.textContent = 'Network error during login. See console.';
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
    <html><head><title>Admin</title></head><body style="background:#070809;color:#f4f1ec;font-family:Inter,monospace;padding:1rem;">
      <h2 style="font-family:monospace;color:#d3a75a">ADMIN DASHBOARD</h2>
      <div id="overview">Loading...</div>
      <div id="myturn">Loading...</div>
      <div id="waiting">Loading...</div>
      <div id="completed">Loading...</div>
      <div style="margin-top:12px"><button id="logout">Logout</button></div>
      <script>window.CSRF_TOKEN='${csrfToken}';</script>
      <script>
        async function api(path){ const r = await fetch(path); return r.json(); }
        async function loadOverview(){ const j = await api('/api/admin/overview'); const o = j.overview; document.getElementById('overview').innerHTML = '<div class="mono">VISITS TODAY: '+o.visits_today+'</div><div class="mono">Challenges: '+o.total_challenges+'</div><div class="mono">Games completed: '+o.games_completed+'</div><div class="mono">Jeremy wins: '+o.jeremy_wins+'</div><div class="mono">Player wins: '+o.player_wins+'</div><div class="mono">Draws: '+o.draws+'</div><div class="mono">Current streak: '+(o.current_streak.count||0)+' by '+(o.current_streak.who||'n/a')+'</div>'; }
        async function loadLists(){ const j = await api('/admin/challenges'); const my = j.challenges.filter(c=>c.admin_turn); const wait = j.challenges.filter(c=>!c.admin_turn && c.status!=='completed'); const comp = j.challenges.filter(c=>c.status==='completed'); document.getElementById('myturn').innerHTML = '<h3 class="mono">MY TURN</h3>'+ (my.length?('<ul>'+my.map(c=>'<li>'+c.gamertag+' — Game '+(c.current_game?.game_number||'?')+' — <a href="/admin/open/'+c.id+'">OPEN MATCH</a></li>').join('')+'</ul>'):'<div class="mono">None</div>'); document.getElementById('waiting').innerHTML = '<h3 class="mono">WAITING</h3>' + (wait.length?('<ul>'+wait.map(c=>'<li>'+c.gamertag+' — Game '+(c.current_game?.game_number||'?')+' — <a href="/admin/open/'+c.id+'">OPEN MATCH</a></li>').join('')+'</ul>'):'<div class="mono">None</div>'); document.getElementById('completed').innerHTML = '<h3 class="mono">COMPLETED</h3>' + (comp.length?('<ul>'+comp.map(c=>'<li>'+c.gamertag+' — '+(c.player_wins||0)+'-'+(c.jeremy_wins||0)+' — '+(c.winner||'n/a')+'</li>').join('')+'</ul>'):'<div class="mono">None</div>'); }
        document.getElementById('logout').addEventListener('click', async ()=>{ await fetch('/admin/logout',{method:'POST', headers: {'x-csrf-token': window.CSRF_TOKEN}}); location.reload(); });
        loadOverview(); loadLists(); setInterval(loadOverview, 30*1000); setInterval(loadLists, 30*1000);
      </script>
    </body></html>
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
  // redirect admin to public frontend with challenge id (no token) — admin cookie authenticates moves
  // Serve a minimal admin match UI that allows Jeremy to view and play the match without exposing secrets.
  // initialize csurf and expose token to admin UI
  try {
    await runMiddleware(req, res, csurf());
  } catch (e) {}
  const csrfToken = req.csrfToken ? req.csrfToken() : '';
  return res.send(`
    <html><head><title>Admin Match ${id}</title>
      <script src="https://cdn.jsdelivr.net/npm/chess.js@1.1.0/chess.min.js"></script>
      <style>body{background:#070809;color:#f4f1ec;font-family:Inter,Arial;padding:1rem} .mono{font-family:monospace;color:#d3a75a}</style>
    </head><body>
      <h2>Admin Match: ${id}</h2>
      <div id="meta" class="mono">Loading...</div>
      <div id="board"></div>
      <div id="history"></div>
      <script>window.CSRF_TOKEN='${csrfToken}';</script>
      <script>
        async function api(path, opts) { const res = await fetch(path, opts); return res.json(); }
        async function load() {
          const ch = await api('/api/challenges/${id}');
          const cg = await api('/api/challenges/${id}/games/current');
          const game = cg.game;
          document.getElementById('meta').textContent = ch.challenge.gamertag + ' — ' + (ch.challenge.player_wins||0) + '-' + (ch.challenge.jeremy_wins||0) + ' — Game ' + game.game_number;
          await render(game);
        }
        function pieceToUnicode(t,c){const m={p:{w:'♙',b:'♟'},r:{w:'♖',b:'♜'},n:{w:'♘',b:'♞'},b:{w:'♗',b:'♝'},q:{w:'♕',b:'♛'},k:{w:'♔',b:'♚'}};return m[t]?.[c]||''}
        async function render(game){
          const board = document.getElementById('board'); board.innerHTML='';
          const chess = new Chess(game.fen_current);
          const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(8,48px)'; grid.style.gap='4px';
          for(let r=7;r>=0;r--){for(let f=0;f<8;f++){const file='abcdefgh'[f];const rank=r+1;const coord=file+rank;const sq=chess.get(coord);const btn=document.createElement('button');btn.style.width='48px';btn.style.height='48px';btn.style.fontSize='20px';btn.dataset.square=coord;btn.textContent=sq?pieceToUnicode(sq.type,sq.color):'';btn.addEventListener('click',async()=>{if(!window.sel){window.sel=coord;btn.style.outline='2px solid #d3a75a';} else if(window.sel===coord){window.sel=null;btn.style.outline='';} else {const from=window.sel;const to=coord;window.sel=null;document.querySelectorAll('#board button').forEach(b=>b.style.outline='');const resp=await api('/api/games/'+game.id+'/moves',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token': window.CSRF_TOKEN},body:JSON.stringify({from,to})});if(resp.error)alert(resp.error);else await load();}});grid.appendChild(btn);}}
          board.appendChild(grid);
          const mh = document.getElementById('history'); const mv = await api('/api/games/'+game.id); mh.innerHTML = '<ol>'+ (mv.moves||[]).map(m=>'<li>'+ (m.san||m.uci) +'</li>').join('') +'</ol>';
        }
        load();
      </script>
    </body></html>
  `);
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server listening on ${HOST}:${PORT}`));
