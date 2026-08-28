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
process.env.JEREMY_NOTIFICATION_EMAIL = 'jeremy@example.test';
process.env.PUBLIC_URL = 'https://jeremyavalos.xyz';

const challengeId = '11111111-1111-4111-8111-111111111111';
const gameId = '22222222-2222-4222-8222-222222222222';
const privateToken = 'existing-private-token';
const visitorId = 'a82f9100-1111-4111-8111-111111111111';
const secondVisitorId = 'b73e8200-2222-4222-8222-222222222222';
const tokenHash = crypto.createHmac('sha256', process.env.PLAYER_TOKEN_SECRET).update(privateToken).digest('hex');
const challenge = { id: challengeId, gamertag: 'Test Challenger', game_type: 'chess', status: 'open', player_wins: 0, jeremy_wins: 0, draws: 0, winner: null, current_game_id: gameId, player_token_hash: tokenHash, email: 'challenger@example.test', updated_at: new Date() };
const game = { id: gameId, challenge_id: challengeId, game_number: 1, fen_current: new Chess().fen(), fen_start: new Chess().fen(), challenger_color: 'black', status: 'ongoing', result: null, created_at: new Date(), ended_at: null };
const moves = [];
let nextGameCreated = null;
let capturedCreatedIp = null;
let capturedChallengeVisitorId = null;
let capturedAnalytics = null;

function rows(value) { return { rows: value }; }
function sideToMove() { return new Chess(game.fen_current).turn() === 'w' ? 'white' : 'black'; }
async function query(sql, params = []) {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  if (normalized.includes('FROM games WHERE id = $1')) return rows([game]);
  if (normalized.includes('FROM challenges WHERE id = $1')) return rows([challenge]);
  if (normalized.includes('FROM moves WHERE game_id = $1 ORDER BY move_number')) return rows(moves);
  if (normalized.startsWith('INSERT INTO analytics_events')) { capturedAnalytics={ ip:params[6], visitor_id:params[7] }; return rows([{ id:99 }]); }
  if (normalized.startsWith('SELECT COUNT(DISTINCT visitor_id)')) return rows([{ count:'2' }]);
  if (normalized.startsWith('SELECT COUNT(DISTINCT ip)')) return rows([{ count:'2' }]);
  if (normalized.includes('FROM analytics_events ae WHERE ae.visitor_id IS NOT NULL')) {
    if (!normalized.includes('c.visitor_id = ae.visitor_id') || normalized.includes('c.created_ip = ae.ip')) throw new Error('Visitor gamertags are not exclusively associated by visitor ID');
    return rows([
      { visitor_id:visitorId, associated_gamertags:['fito'], ip_count:'2', most_recent_ip:'79.127.178.82', country:'MX', region:'Quintana Roo', city:'Cancun', asn_org:'AS64500 Example ISP', device_category:'desktop', browser_family:'chrome', visits:'2', first_seen:new Date(), last_seen:new Date() },
      { visitor_id:secondVisitorId, associated_gamertags:[], ip_count:'1', most_recent_ip:'79.127.178.82', country:'MX', region:'Quintana Roo', city:'Cancun', asn_org:'AS64500 Example ISP', device_category:'mobile', browser_family:'safari', visits:'1', first_seen:new Date(), last_seen:new Date() }
    ]);
  }
  if (normalized.includes('FROM analytics_events ae WHERE ae.ip IS NOT NULL GROUP BY ae.ip')) return rows([{ ip:'79.127.178.82', ip_associated_gamertags:['Legacy Alias'], country:'MX', region:'Quintana Roo', city:'Cancun', asn_org:'AS64500 Example ISP', visits:'3', first_seen:new Date(), last_seen:new Date() }]);
  if (normalized.startsWith('SELECT COUNT(*) AS total_visits') && normalized.includes('WHERE ip = $1')) return rows([params[0] === '79.127.178.81' ? { total_visits:'1', distinct_visitor_ids:'1', legacy_events:'0', legacy_first_seen:null, legacy_last_seen:null, first_seen:new Date('2026-08-01T00:00:00Z'), last_seen:new Date('2026-08-01T00:00:00Z'), country:'DE', region:'Hesse', city:'Frankfurt', timezone:'Europe/Berlin', asn_org:'AS212238 Datacamp Limited', device_categories:['desktop'], browsers:['chrome'] } : { total_visits:'3', distinct_visitor_ids:'2', legacy_events:'1', legacy_first_seen:new Date('2026-08-01T00:00:00Z'), legacy_last_seen:new Date('2026-08-01T00:00:00Z'), first_seen:new Date('2026-08-01T00:00:00Z'), last_seen:new Date('2026-08-03T00:00:00Z'), country:'MX', region:'Quintana Roo', city:'Cancun', timezone:'America/Cancun', asn_org:'AS64500 Example ISP', device_categories:['desktop','mobile'], browsers:['chrome','safari'] }]);
  if (normalized.startsWith('SELECT COUNT(*) AS total_visits')) return rows([{ total_visits:'2', first_seen:new Date(), last_seen:new Date(), country:'MX', region:'Quintana Roo', city:'Cancun', timezone:'America/Cancun', asn_org:'AS64500 Example ISP', browser_family:'chrome', device_category:'desktop', user_agent:'test' }]);
  if (normalized.startsWith('SELECT path, referrer') && normalized.includes('visitor_id = $1')) return rows([{ path:'/challenge', referrer:null, ip:'79.127.178.82', country:'MX', region:'Quintana Roo', city:'Cancun', asn_org:'AS64500 Example ISP', browser_family:'chrome', device_category:'desktop', created_at:new Date() }]);
  if (normalized.startsWith('SELECT ae.visitor_id, MIN(ae.created_at)')) {
    if (!normalized.includes('c.visitor_id = ae.visitor_id') || normalized.includes('created_ip')) throw new Error('IP visitor gamertags were inferred without Visitor ID');
    return rows(params[0] === '79.127.178.81' ? [{ visitor_id:visitorId, first_seen:new Date('2026-08-01T00:00:00Z'), last_seen:new Date('2026-08-01T00:00:00Z'), visits:'1', associated_gamertags:['fito'] }] : [{ visitor_id:visitorId, first_seen:new Date('2026-08-01T00:00:00Z'), last_seen:new Date('2026-08-03T00:00:00Z'), visits:'1', associated_gamertags:['fito'] }, { visitor_id:secondVisitorId, first_seen:new Date('2026-08-02T00:00:00Z'), last_seen:new Date('2026-08-02T00:00:00Z'), visits:'1', associated_gamertags:[] }]);
  }
  if (normalized.startsWith('SELECT ae.path, ae.referrer')) {
    if (![[10,10],[25,0]].some(([limit,offset]) => params[1] === limit && params[2] === offset) || !normalized.includes('ORDER BY ae.created_at DESC LIMIT $2 OFFSET $3') || !normalized.includes('c.visitor_id = ae.visitor_id')) throw new Error('IP history pagination or identity association is incorrect');
    return rows([{ path:'/challenge', referrer:'https://google.com/search', visitor_id:visitorId, associated_gamertags:['fito'], device_category:'desktop', browser_family:'chrome', country:'MX', region:'Quintana Roo', city:'Cancun', asn_org:'AS64500 Example ISP', created_at:new Date('2026-08-03T00:00:00Z') }]);
  }
  if (normalized.startsWith("SELECT COALESCE(NULLIF(path, ''), '/')")) return rows([{ path:'/', count:'2' }, { path:'/challenge', count:'1' }]);
  if (normalized.startsWith('SELECT referrer, COUNT(*) AS count')) return rows([{ referrer:null, count:'1' }, { referrer:'https://google.com/search', count:'2' }]);
  if (normalized.includes('FROM challenges WHERE visitor_id = $1')) return rows([{ gamertag:'fito', status:'completed', created_at:new Date(), winner:'jeremy', player_wins:0, jeremy_wins:2, draws:0 }]);
  if (normalized.includes('FROM challenges WHERE created_ip = $1')) return rows([{ gamertag:'Legacy Alias', status:'completed', created_at:new Date() }]);
  if (normalized.startsWith('SELECT ip, COUNT(*) AS visits')) return rows([{ ip:'79.127.178.82', visits:'1', first_seen:new Date(), last_seen:new Date(), country:'MX', region:'Quintana Roo', city:'Cancun', timezone:'America/Cancun', asn_org:'AS64500 Example ISP' }, { ip:'79.127.178.81', visits:'1', first_seen:new Date(), last_seen:new Date(), country:'DE', region:'Hesse', city:'Frankfurt', timezone:'Europe/Berlin', asn_org:'AS212238 Datacamp Limited' }]);
  if (normalized.includes('FROM challenges c LEFT JOIN games g')) return rows([{ ...challenge, game_id: game.id, game_number: game.game_number, fen_current: game.fen_current, challenger_color: game.challenger_color, game_status: game.status, last_move_at: moves.at(-1)?.created_at || game.created_at }]);
  if (normalized.startsWith('SELECT g.fen_current, g.challenger_color FROM challenges c')) return rows(challenge.status === 'completed' ? [] : [{ fen_current: game.fen_current, challenger_color: game.challenger_color }]);
  if (normalized.startsWith('SELECT winner, updated_at FROM challenges')) return rows([]);
  if (normalized.startsWith('SELECT (SELECT COUNT(*) FROM analytics_events)')) return rows([{ total_visits:'6', visits_today:'1', visitors:'2', ips_observed:'2', unidentified_visits:'3', total_challenges:'1', active_matches:challenge.status === 'completed' ? '0' : '1', games_completed:game.status === 'finished' ? '1' : '0', jeremy_wins:String(challenge.jeremy_wins), player_wins:String(challenge.player_wins) }]);
  throw new Error(`Unexpected query: ${normalized}`);
}
async function transaction(callback) {
  return callback({ query: async (sql, params = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('INSERT INTO challenges')) { capturedCreatedIp=params[4]; capturedChallengeVisitorId=params[5]; return rows([{ id:'44444444-4444-4444-8444-444444444444', gamertag:params[0], game_type:'chess' }]); }
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
let resendResponseStatus = 200;
global.fetch = async (url, options) => {
  if (String(url) === 'https://api.resend.com/emails') { sentEmails.push(JSON.parse(options.body)); return { ok: resendResponseStatus >= 200 && resendResponseStatus < 300, status: resendResponseStatus, json: async () => resendResponseStatus < 300 ? { id:'email-test-id' } : { message:'rejected' } }; }
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

    response = await request('/admin', { headers });
    const dashboardHtml = await response.text();
    const dashboardAsset = dashboardHtml.match(/<script src="([^"]*dashboard\.js[^"]*)"/)?.[1];
    if (!response.ok || !dashboardAsset || !dashboardAsset.includes('?v=')) throw new Error('Admin dashboard assets are not deployment-versioned');
    response = await request(dashboardAsset, { headers });
    const dashboardJs = await response.text();
    if (!response.ok || !dashboardJs.includes("'NETWORK'") || !dashboardJs.includes('v.asn_org') || response.headers.get('cache-control') !== 'private, no-cache, no-store, must-revalidate') throw new Error('Admin dashboard asset is stale or cacheable');

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
    const overview = (await response.json()).overview;
    if (overview.my_turn !== 0 || overview.visitors !== 2 || overview.ips_observed !== 2 || overview.unidentified_visits !== 3 || overview.total_visits !== 6) throw new Error('Admin visitor, visit, IP, or legacy counting semantics changed');

    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 1 || sentEmails[0].subject !== `Jeremy moved against ${challenge.gamertag} — your turn` || !sentEmails[0].html.includes(challenge.gamertag) || sentEmails[0].from !== 'matches@example.test') throw new Error('Challenger email flow changed unexpectedly');
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

    challenge.current_game_id=gameId; challenge.status='open'; challenge.winner=null; challenge.email='challenger@example.test'; challenge.player_wins=0; challenge.jeremy_wins=0; game.game_number=1; game.status='ongoing'; game.result=null; game.fen_current=new Chess().fen(); game.challenger_color='white'; moves.length=0;
    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${privateToken}`}, body:JSON.stringify({from:'e2',to:'e4'}) });
    if (!response.ok) throw new Error(`Challenger move failed: ${await response.text()}`);
    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 2 || sentEmails[1].subject !== `${challenge.gamertag} made a move` || !sentEmails[1].html.includes(`/admin/open/${challengeId}`) || sentEmails[1].html.includes('token=')) throw new Error('Jeremy notification flow changed unexpectedly');

    resendResponseStatus=422;
    response = await request(`/api/games/${gameId}/moves`, { method:'POST', headers:{...headers,'Content-Type':'application/json','x-csrf-token':csrfToken}, body:JSON.stringify({from:'e7',to:'e5'}) });
    if (!response.ok || moves.length !== 2) throw new Error('Resend rejection blocked a valid move');
    await new Promise(resolve => setTimeout(resolve, 10));
    if (sentEmails.length !== 3) throw new Error('Rejected Resend request was not attempted');

    response = await request('/api/challenges', { method:'POST', headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.42'}, body:JSON.stringify({gamertag:'IP Test',email:'',visitor_id:visitorId}) });
    const created = await response.json();
    if (!response.ok || capturedCreatedIp !== '203.0.113.42' || capturedChallengeVisitorId !== visitorId || JSON.stringify(created).includes('created_ip') || JSON.stringify(created).includes('visitor_id')) throw new Error('Challenge identity association is missing or publicly exposed');

    response = await request('/api/analytics/track', { method:'POST', headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.43'}, body:JSON.stringify({path:'/',visitor_id:visitorId}) });
    if (!response.ok || capturedAnalytics?.ip !== '203.0.113.43' || capturedAnalytics?.visitor_id !== visitorId) throw new Error('Analytics did not retain trusted IP and first-party visitor ID');
    response = await request('/api/analytics/track', { method:'POST', headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.44'}, body:JSON.stringify({path:'/legacy-compatible'}) });
    if (!response.ok || capturedAnalytics?.visitor_id !== null) throw new Error('Analytics without a visitor ID no longer work as legacy/unidentified events');
    response = await request('/api/analytics/track', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path:'/',visitor_id:'not-a-uuid'}) });
    if (response.status !== 400) throw new Error('Malformed visitor ID was accepted');

    response = await request('/api/admin/visitors?page=1&page_size=25', { headers });
    const visitors = await response.json();
    if (!response.ok || visitors.visitors.length !== 2 || visitors.visitors[0].ip_count !== 2 || visitors.visitors[0].associated_gamertags[0] !== 'fito' || visitors.visitors[0].visitor_id !== visitorId || visitors.visitors[1].most_recent_ip !== visitors.visitors[0].most_recent_ip) throw new Error('Visitor grouping failed for same-ID/different-IP or different-ID/same-IP cases');
    response = await request(`/api/admin/visitors/${visitorId}`, { headers });
    const visitor = await response.json();
    if (!response.ok || visitor.visitor.observed_ips.length !== 2 || visitor.visitor.associated_gamertags[0] !== 'fito' || visitor.visitor.timezone !== 'America/Cancun' || JSON.stringify(visitor).includes('player_token_hash') || JSON.stringify(visitor).includes('email') || JSON.stringify(visitor).includes('loc')) throw new Error('Private visitor challenge/location details are incorrect or unsafe');

    response = await request('/api/admin/ips?page=1&page_size=25', { headers });
    const ips = await response.json();
    if (!response.ok || ips.ips[0].ip !== '79.127.178.82' || ips.ips[0].asn_org !== 'AS64500 Example ISP' || ips.ips[0].ip_associated_gamertags[0] !== 'Legacy Alias') throw new Error('Raw IP analytics view is missing');
    response = await request('/api/admin/ips/79.127.178.82?page=2&page_size=10', { headers });
    const ipPayload = await response.json(); const ipDetail = ipPayload.ip;
    if (!response.ok || ipDetail.events[0].visitor_id !== visitorId || ipDetail.visitors.length !== 2 || ipDetail.legacy_events !== 1 || ipDetail.distinct_visitor_ids !== 2 || ipDetail.total_visits !== 3 || ipDetail.associated_gamertags[0] !== 'fito' || ipDetail.paths[0].path !== '/' || ipDetail.referrers.some(r => r.source === 'direct / no referrer' && r.count !== 1) || ipPayload.pagination.page !== 2 || ipPayload.pagination.page_size !== 10) throw new Error('Detailed IP history identity, counts, aggregations, or pagination are incorrect');
    response = await request('/api/admin/ips/79.127.178.81', { headers });
    const singleVisitorIp = (await response.json()).ip;
    if (!response.ok || singleVisitorIp.visitors.length !== 1 || singleVisitorIp.distinct_visitor_ids !== 1 || singleVisitorIp.legacy_events !== 0) throw new Error('Single-Visitor IP history is incorrect');

    response = await request('/api/admin/visitors');
    if (response.status !== 403) throw new Error('Private visitor analytics are publicly accessible');
    response = await request('/api/admin/ips');
    if (response.status !== 403) throw new Error('Private IP analytics are publicly accessible');
    response = await request('/api/admin/ips/79.127.178.82');
    if (response.status !== 403) throw new Error('Private IP history is publicly accessible');
    console.log('Admin gameplay, CSRF, persistence, transition, email, and best-of-three regressions passed');
  } finally { global.fetch=realFetch; await new Promise(resolve=>server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });
