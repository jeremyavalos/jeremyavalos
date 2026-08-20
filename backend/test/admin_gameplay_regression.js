const crypto = require('crypto');
const path = require('path');
const { Chess } = require('chess.js');

process.env.NODE_ENV = 'test';
process.env.ADMIN_USERNAME = 'admin-test';
process.env.ADMIN_PASSWORD_HASH = 'test-password';
process.env.SESSION_SECRET = 'session-test-secret';
process.env.PLAYER_TOKEN_SECRET = 'player-test-secret';
process.env.RESEND_API_KEY = 'resend-test-key';
process.env.CHALLENGE_FROM_EMAIL = 'matches@example.test';
process.env.PUBLIC_URL = 'https://jeremyavalos.xyz';

const challengeId = '11111111-1111-4111-8111-111111111111';
const gameId = '22222222-2222-4222-8222-222222222222';
const privateToken = 'existing-private-token';
const tokenHash = crypto.createHmac('sha256', process.env.PLAYER_TOKEN_SECRET).update(privateToken).digest('hex');
const challenge = { id: challengeId, gamertag: 'Test Challenger', game_type: 'chess', status: 'open', player_wins: 0, jeremy_wins: 0, draws: 0, winner: null, current_game_id: gameId, player_token_hash: tokenHash, email: 'challenger@example.test', updated_at: new Date() };
const game = { id: gameId, challenge_id: challengeId, game_number: 1, fen_current: new Chess().fen(), fen_start: new Chess().fen(), challenger_color: 'black', status: 'ongoing', result: null, created_at: new Date(), ended_at: null };
const moves = [];
let nextGameCreated = null;

function rows(value) { return { rows: value }; }
function sideToMove() { return new Chess(game.fen_current).turn() === 'w' ? 'white' : 'black'; }
async function query(sql) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.includes('FROM games WHERE id = $1')) return rows([game]);
  if (normalized.includes('FROM challenges WHERE id = $1')) return rows([challenge]);
  if (normalized.includes('FROM moves WHERE game_id = $1 ORDER BY move_number')) return rows(moves);
  if (normalized.includes('FROM challenges c LEFT JOIN games g')) return rows([{ ...challenge, game_id: game.id, game_number: game.game_number, fen_current: game.fen_current, challenger_color: game.challenger_color, game_status: game.status, last_move_at: moves.at(-1)?.created_at || game.created_at }]);
  if (normalized.startsWith('SELECT g.fen_current, g.challenger_color FROM challenges c')) return rows(challenge.status === 'completed' ? [] : [{ fen_current: game.fen_current, challenger_color: game.challenger_color }]);
  if (normalized.startsWith('SELECT winner, updated_at FROM challenges')) return rows([]);
  if (normalized.startsWith('SELECT (SELECT COUNT(*) FROM analytics_events)')) return rows([{ total_visits: '1', visits_today: '1', unique_visitors: '0', total_challenges: '1', active_matches: challenge.status === 'completed' ? '0' : '1', games_completed: game.status === 'finished' ? '1' : '0', jeremy_wins: String(challenge.jeremy_wins), player_wins: String(challenge.player_wins) }]);
  throw new Error(`Unexpected query: ${normalized}`);
}
async function transaction(callback) {
  return callback({ query: async (sql, params = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT COUNT(*) FROM moves')) return rows([{ count: String(moves.length) }]);
    if (normalized.startsWith('INSERT INTO moves')) { moves.push({ move_number: params[1], uci: params[2], san: params[3], from_sq: params[4], to_sq: params[5], player_side: params[8], created_at: new Date() }); return rows([]); }
    if (normalized.startsWith('UPDATE games SET fen_current')) { game.fen_current=params[0]; game.status=params[1]; game.result=params[2]; if (game.status === 'finished') game.ended_at=new Date(); return rows([]); }
    if (normalized.startsWith('UPDATE challenges SET jeremy_wins')) { challenge.jeremy_wins += 1; challenge.updated_at=new Date(); return rows([]); }
    if (normalized.startsWith('UPDATE challenges SET player_wins')) { challenge.player_wins += 1; challenge.updated_at=new Date(); return rows([]); }
    if (normalized.startsWith('UPDATE challenges SET draws')) { challenge.draws += 1; challenge.updated_at=new Date(); return rows([]); }
    if (normalized.startsWith('SELECT player_wins, jeremy_wins')) return rows([{ player_wins: challenge.player_wins, jeremy_wins: challenge.jeremy_wins }]);
    if (normalized.startsWith('UPDATE challenges SET status')) { challenge.status=params[0]; challenge.winner=params[1]; challenge.updated_at=new Date(); return rows([]); }
    if (normalized.startsWith('INSERT INTO games')) { nextGameCreated={ id:'33333333-3333-4333-8333-333333333333', challenge_id:params[0], game_number:params[1], fen_start:params[2], fen_current:params[3], challenger_color:params[4], status:'ongoing' }; return rows([nextGameCreated]); }
    if (normalized.startsWith('UPDATE challenges SET current_game_id')) { challenge.current_game_id=params[0]; challenge.updated_at=new Date(); return rows([]); }
    throw new Error(`Unexpected transaction query: ${normalized}`);
  }});
}

const db = require(path.join(__dirname, '..', 'src', 'db'));
db.query = query;
db.transaction = transaction;
const realFetch = global.fetch;
const sentEmails = [];
global.fetch = async (url, options) => {
  if (String(url) === 'https://api.resend.com/emails') { sentEmails.push(JSON.parse(options.body)); return { ok: true, status: 200 }; }
  return realFetch(url, options);
};
const app = require(path.join(__dirname, '..', 'src', 'index'));

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => realFetch(base + url, options);
  try {
    let response = await request('/admin/login', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({username:'admin-test',password:'test-password'}) });
    const cookie = response.headers.get('set-cookie').split(';')[0];
    await response.json();
    const headers = { Cookie: cookie };

    response = await request(`/admin/open/${challengeId}`, { headers });
    const matchHtml = await response.text();
    const csrfToken = matchHtml.match(/name="csrf-token" content="([^"]+)"/)?.[1];
    if (!response.ok || !csrfToken || matchHtml.includes('token=')) throw new Error('Admin match page did not use the authenticated session safely');

    response = await request(`/api/admin/challenges/${challengeId}/match`, { headers });
    const opened = await response.json();
    if (!response.ok || opened.game.fen_current !== game.fen_current || opened.game.admin_turn !== true || opened.game.challenger_color !== 'black') throw new Error('Admin match did not open with the authoritative current game');

    response = await request(`/api/games/${gameId}/legal?square=e2`, { headers });
    const legal = await response.json();
    if (!response.ok || !legal.moves.some(move => move.to === 'e4')) throw new Error('Admin legal moves unavailable');
    response = await request(`/api/games/${gameId}/legal?square=e7`, { headers });
    if (!response.ok || (await response.json()).moves.length !== 0) throw new Error('Challenger piece returned legal admin moves');

    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{...headers,'Content-Type':'application/json'}, body:JSON.stringify({from:'e2',to:'e4'}) });
    if (response.status !== 403) throw new Error('Admin move succeeded without CSRF');
    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{...headers,'Content-Type':'application/json','x-csrf-token':csrfToken}, body:JSON.stringify({from:'e2',to:'e4'}) });
    if (!response.ok) throw new Error(`Admin move failed: ${await response.text()}`);
    const expected = new Chess(); expected.move('e4');
    if (moves.length !== 1 || game.fen_current !== expected.fen() || sideToMove() !== 'black') throw new Error('Move persistence or FEN transition failed');

    response = await request('/api/admin/challenges', { headers });
    if ((await response.json()).challenges[0].admin_turn !== false) throw new Error('Challenge did not transition to WAITING');
    response = await request('/api/admin/overview', { headers });
    if ((await response.json()).overview.my_turn !== 0) throw new Error('Jeremy move count did not decrease');

    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 1 || !sentEmails[0].subject.includes(challenge.gamertag)) throw new Error('Challenger email was not sent with match identity');
    const href = sentEmails[0].html.match(/href="([^"]+)"/)?.[1];
    const resumeUrl = new URL(href);
    if (!resumeUrl.searchParams.get('token')) throw new Error('Continue Match link omitted private credentials');
    response = await request(`/api/challenges/${challengeId}?token=${encodeURIComponent(resumeUrl.searchParams.get('token'))}`);
    if (!(await response.json()).authorized) throw new Error('Continue Match credential was not accepted');

    challenge.email=null; challenge.jeremy_wins=0; challenge.status='open'; challenge.winner=null; game.game_number=1; game.status='ongoing'; game.result=null; moves.length=0;
    const mate = new Chess(); mate.move('f3'); mate.move('e5'); mate.move('g4'); game.fen_current=mate.fen(); game.challenger_color='white';
    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{...headers,'Content-Type':'application/json','x-csrf-token':csrfToken}, body:JSON.stringify({from:'d8',to:'h4'}) });
    if (!response.ok || challenge.jeremy_wins !== 1 || !nextGameCreated || nextGameCreated.game_number !== 2 || nextGameCreated.challenger_color !== 'black') throw new Error('Best-of-three next-game transition failed');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 1) throw new Error('Email attempted when the next game still belongs to Jeremy');

    challenge.current_game_id=gameId; challenge.jeremy_wins=1; challenge.status='open'; challenge.winner=null; game.game_number=3; game.status='ongoing'; game.result=null; game.fen_current=mate.fen(); moves.length=0;
    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{...headers,'Content-Type':'application/json','x-csrf-token':csrfToken}, body:JSON.stringify({from:'d8',to:'h4'}) });
    if (!response.ok || challenge.status !== 'completed' || challenge.winner !== 'jeremy' || challenge.jeremy_wins !== 2 || game.status !== 'finished') throw new Error('Best-of-three completion failed');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 1) throw new Error('Email attempted for challenge without email');
    console.log('Admin gameplay, CSRF, persistence, transition, email, and best-of-three regressions passed');
  } finally { global.fetch=realFetch; await new Promise(resolve=>server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
