const assert = require('assert');

let API = process.env.API_BASE || 'http://localhost:4001';
let server;
let db;
let createdChallengeId;

async function run() {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'flow-admin';
    process.env.ADMIN_PASSWORD_HASH = 'flow-password';
    delete process.env.RESEND_API_KEY;
    const app = require('../src/index');
    db = require('../src/db');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    API = `http://127.0.0.1:${server.address().port}`;
  }
  console.log('Running flow tests against', API);

  // Health
  let r = await fetch(`${API}/health`);
  assert.strictEqual(r.status, 200);
  console.log('/health', r.status);

  // Create challenge
  r = await fetch(`${API}/api/challenges`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gamertag: 'tester', game: 'chess' })
  });
  const create = await r.json();
  assert.strictEqual(r.status, 200);
  assert(create.challenge && create.token, 'Challenge creation failed');
  console.log('create status', r.status);
  createdChallengeId = create.challenge.id;

  const challengeId = create.challenge.id;
  const token = create.token;
  console.log('challengeId', challengeId);

  // Fetch challenge
  r = await fetch(`${API}/api/challenges/${challengeId}?token=${token}`);
  assert.strictEqual(r.status, 200);
  console.log('get challenge', r.status, await r.json());

  // Get current game
  r = await fetch(`${API}/api/challenges/${challengeId}/games/current`);
  const cg = await r.json();
  assert.strictEqual(r.status, 200);
  assert(cg.game, 'Current game missing');
  console.log('current game', r.status, cg);
  const gameId = cg.game.id;
  if (cg.game.challenger_color === 'black') {
    const login = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD_HASH }) });
    assert.strictEqual(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const dashboard = await (await fetch(`${API}/admin`, { headers: { Cookie: cookie } })).text();
    const csrf = dashboard.match(/name="csrf-token" content="([^"]+)"/)[1];
    const opening = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'x-csrf-token': csrf },
      body: JSON.stringify({ from: 'e2', to: 'e4' }) });
    assert.strictEqual(opening.status, 200);
    await opening.json();
  }

  // Make a legal move: e2e4 if possible
  let move = cg.game.challenger_color === 'white' ? { from: 'e2', to: 'e4' } : { from: 'e7', to: 'e5' };
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(move) });
  assert.strictEqual(r.status, 200);
  console.log('legal challenger move', r.status, await r.json());

  // Attempt illegal move
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ from: 'e2', to: 'e3' }) });
  assert(r.status >= 400 && r.status < 500, 'Illegal move accepted');
  console.log('illegal move status', r.status, await r.json());

  // Wrong-turn attempt: Jeremy (no token) attempt to move same side
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'e7', to: 'e5' }) });
  assert.strictEqual(r.status, 401);
  console.log('unauthenticated move status', r.status, await r.json());

  console.log('Flow tests finished (requires DB and server).');
}

run().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) {
    try {
      if (createdChallengeId) await db.query('DELETE FROM challenges WHERE id = $1', [createdChallengeId]);
    } finally {
      await db.pool.end();
    }
  }
});
