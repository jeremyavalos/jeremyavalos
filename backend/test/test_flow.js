const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API = process.env.API_BASE || 'http://localhost:4001';

async function run() {
  console.log('Running flow tests against', API);

  // Health
  let r = await fetch(`${API}/health`);
  console.log('/health', r.status);

  // Create challenge
  r = await fetch(`${API}/api/challenges`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gamertag: 'tester', game: 'chess' })
  });
  const create = await r.json();
  console.log('create status', r.status, create);
  if (!create || !create.challenge) return console.log('create failed');

  const challengeId = create.challenge.id;
  const token = create.token;
  console.log('challengeId', challengeId);

  // Fetch challenge
  r = await fetch(`${API}/api/challenges/${challengeId}?token=${token}`);
  console.log('get challenge', r.status, await r.json());

  // Get current game
  r = await fetch(`${API}/api/challenges/${challengeId}/games/current`);
  const cg = await r.json();
  console.log('current game', r.status, cg);
  const gameId = cg.game.id;

  // Make a legal move: e2e4 if possible
  let move = { from: 'e2', to: 'e4' };
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(move) });
  console.log('move e2e4', r.status, await r.json());

  // Attempt illegal move
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ from: 'e2', to: 'e3' }) });
  console.log('illegal move status', r.status, await r.json());

  // Wrong-turn attempt: Jeremy (no token) attempt to move same side
  r = await fetch(`${API}/api/games/${gameId}/moves`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'e7', to: 'e5' }) });
  console.log('unauthenticated move status', r.status, await r.json());

  console.log('Flow tests finished (requires DB and server).');
}

run().catch(err=>{console.error(err); process.exit(1)});
