require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

const PORT = process.env.PORT || 4000;

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8000';
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true);
  if ([CORS_ORIGIN, 'http://localhost:3000', 'http://localhost:8000'].includes(origin)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
}}));

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
  const cookie = req.cookies?.admin_session;
  if (!cookie) return false;
  const expected = crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'admin_dev').update('admin_session').digest('hex');
  return cookie === expected;
}

function setAdminSession(res) {
  const value = crypto.createHmac('sha256', process.env.ADMIN_SECRET || 'admin_dev').update('admin_session').digest('hex');
  // set httpOnly secure cookie
  res.cookie('admin_session', value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
}

function clearAdminSession(res) {
  res.clearCookie('admin_session');
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Create challenge
app.post('/api/challenges', async (req, res) => {
  try {
    const { gamertag, game } = req.body;
    if (!gamertag) return res.status(400).json({ error: 'gamertag required' });
    const gameType = game === 'backgammon' ? 'backgammon' : 'chess';

    const token = generateToken();
    const tokenHash = hashToken(token);

    // create challenge row
    // transactional creation: challenge + first game (if chess)
    const result = await db.transaction(async (client) => {
      const r = await client.query(`INSERT INTO challenges (gamertag, player_token_hash, game_type) VALUES ($1,$2,$3) RETURNING *`, [gamertag, tokenHash, gameType]);
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
      if (chess.in_checkmate()) {
        gameStatus = 'finished';
        gameResult = chess.turn() === 'w' ? 'black' : 'white';
      } else if (chess.in_stalemate() || chess.in_draw() || chess.in_threefold_repetition() || chess.insufficient_material()) {
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
    const rows = await db.query('SELECT id, gamertag, status, player_wins, jeremy_wins, draws, current_game_id, winner, created_at, updated_at FROM challenges ORDER BY created_at DESC LIMIT 200');
    res.json({ challenges: rows.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Admin login/logout for setting httpOnly session cookie
app.post('/admin/login', (req, res) => {
  const { secret } = req.body || {};
  if (!secret || secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'forbidden' });
  setAdminSession(res);
  res.json({ ok: true });
});

app.post('/admin/logout', (req, res) => {
  clearAdminSession(res);
  res.json({ ok: true });
});

// Serve a minimal admin dashboard page
app.get('/admin', (req, res) => {
  if (!isAdminAuthenticated(req)) {
    // simple login form
    return res.send(`
      <html><head><title>Admin Login</title></head><body style="background:#070809;color:#f4f1ec;font-family:Arial;padding:2rem;">
        <h2>Admin Login</h2>
        <form method="POST" action="/admin/login" id="login">
          <input name="secret" placeholder="ADMIN_SECRET" />
          <button type="submit">Login</button>
        </form>
      </body></html>
    `);
  }

  // simple dashboard UI that fetches /admin/challenges
  return res.send(`
    <html><head><title>Admin</title></head><body style="background:#070809;color:#f4f1ec;font-family:Arial;padding:1rem;">
      <h2>Admin Dashboard</h2>
      <div id="list">Loading...</div>
      <script>
        async function load() {
          const r = await fetch('/admin/challenges');
          const j = await r.json();
          const list = document.getElementById('list');
          list.innerHTML = '<ul>' + j.challenges.map(function(c){ return '<li>' + c.gamertag + ' — ' + (c.player_wins||0) + '-' + (c.jeremy_wins||0) + ' — ' + c.status + ' — <a href="/admin/open/' + c.id + '">Open</a></li>'; }).join('') + '</ul>';
        }
        load();
      </script>
    </body></html>
  `);
});

// Admin open a challenge (redirect to challenge page on frontend but as admin session)
app.get('/admin/open/:id', async (req, res) => {
  if (!isAdminAuthenticated(req)) return res.status(403).send('forbidden');
  const id = req.params.id;
  // redirect admin to public frontend with challenge id (no token) — admin cookie authenticates moves
  // Serve a minimal admin match UI that allows Jeremy to view and play the match without exposing secrets.
  return res.send(`
    <html><head><title>Admin Match ${id}</title>
      <script src="https://cdn.jsdelivr.net/npm/chess.js@1.1.0/chess.min.js"></script>
      <style>body{background:#070809;color:#f4f1ec;font-family:Inter,Arial;padding:1rem} .mono{font-family:monospace;color:#d3a75a}</style>
    </head><body>
      <h2>Admin Match: ${id}</h2>
      <div id="meta" class="mono">Loading...</div>
      <div id="board"></div>
      <div id="history"></div>
      <script>
        async function api(path, opts) {
          const res = await fetch(path, opts);
          return res.json();
        }
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
          for(let r=7;r>=0;r--){for(let f=0;f<8;f++){const file='abcdefgh'[f];const rank=r+1;const coord=file+rank;const sq=chess.get(coord);const btn=document.createElement('button');btn.style.width='48px';btn.style.height='48px';btn.style.fontSize='20px';btn.dataset.square=coord;btn.textContent=sq?pieceToUnicode(sq.type,sq.color):'';btn.addEventListener('click',async()=>{if(!window.sel){window.sel=coord;btn.style.outline='2px solid #d3a75a';} else if(window.sel===coord){window.sel=null;btn.style.outline='';} else {const from=window.sel;const to=coord;window.sel=null;document.querySelectorAll('#board button').forEach(b=>b.style.outline='');const resp=await api('/api/games/'+game.id+'/moves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to})});if(resp.error)alert(resp.error);else await load();}});grid.appendChild(btn);}}
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
