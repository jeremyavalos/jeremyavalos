(() => {
  'use strict';
  const challengeId = document.querySelector('meta[name="challenge-id"]')?.content;
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  const pieces = { p:{w:'♙',b:'♟'},r:{w:'♖',b:'♜'},n:{w:'♘',b:'♞'},b:{w:'♗',b:'♝'},q:{w:'♕',b:'♛'},k:{w:'♔',b:'♚'} };
  let selected = null; let legal = []; let currentGame = null; let currentPosition = {};
  async function api(path, options = {}) { const response = await fetch(path,{credentials:'same-origin',...options}); const type=response.headers.get('content-type')||''; const data=type.includes('application/json')?await response.json():null; if(!response.ok) throw new Error(data?.error || `Request failed (${response.status})`); if(!data) throw new Error('Server returned an invalid response'); return data; }
  function position(fen) { const board={}; const rows=fen.split(' ')[0].split('/'); rows.forEach((row,i)=>{let file=0; for(const char of row){if(/\d/.test(char)){file+=Number(char);continue;} const color=char===char.toUpperCase()?'w':'b'; board['abcdefgh'[file]+(8-i)]={type:char.toLowerCase(),color}; file++;}}); return board; }
  function showError(message) { const node=document.getElementById('match-error'); node.hidden=false; node.textContent=message; }
  async function choose(square) {
    if (!currentGame?.admin_turn) return;
    if (selected && legal.some(move => move.to === square)) { await move(selected,square,legal.find(item=>item.to===square)?.promotion); return; }
    const adminColor = currentGame.jeremy_color === 'white' ? 'w' : 'b';
    if (currentPosition[square]?.color !== adminColor) { selected=null; legal=[]; renderBoard(); return; }
    selected=square; legal=[];
    try { const data=await api(`/api/games/${encodeURIComponent(currentGame.id)}/legal?square=${square}`); legal=data.moves || []; if (!legal.length) selected=null; renderBoard(); } catch(error) { selected=null; renderBoard(); showError(`Unable to load legal moves — ${error.message}`); }
  }
  async function move(from,to,promotion) {
    document.getElementById('move-status').textContent='Saving move…';
    try { await api(`/api/games/${encodeURIComponent(currentGame.id)}/moves`,{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify({from,to,promotion:promotion || (to.endsWith('1')||to.endsWith('8')?'q':undefined)})}); selected=null; legal=[]; await load(); }
    catch(error) { document.getElementById('move-status').textContent=`Move failed — ${error.message}`; }
  }
  function renderBoard() {
    const board=document.getElementById('board'); board.replaceChildren(); currentPosition=position(currentGame.fen_current); const map=currentPosition; const whiteBottom=currentGame.jeremy_color==='white'; const ranks=whiteBottom?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8]; const files=whiteBottom?'abcdefgh'.split(''):'hgfedcba'.split('');
    ranks.forEach(rank=>files.forEach((file,index)=>{const square=file+rank; const piece=map[square]; const button=document.createElement('button'); button.className=`square ${(index+ranks.indexOf(rank))%2?'dark':''}${selected===square?' selected':''}${legal.some(m=>m.to===square)?' legal':''}`; button.textContent=piece?pieces[piece.type][piece.color]:''; button.title=square; button.disabled=!currentGame.admin_turn; button.addEventListener('click',()=>choose(square)); board.append(button);}));
  }
  async function load() {
    try {
      const {challenge,game,moves}=await api(`/api/admin/challenges/${encodeURIComponent(challengeId)}/match`); currentGame=game; document.getElementById('match-error').hidden=true;
      document.getElementById('match-meta').textContent=`${challenge.gamertag} / GAME ${game.game_number} OF 3 / JEREMY ${challenge.jeremy_wins} — ${challenge.player_wins} CHALLENGER / ${game.admin_turn?'YOUR TURN':'WAITING FOR CHALLENGER'}`;
      document.getElementById('move-status').textContent=game.admin_turn?'Select one of Jeremy’s pieces.':'This match is waiting for the challenger.'; renderBoard(); const history=document.getElementById('history'); history.replaceChildren(); moves.forEach(item=>{const li=document.createElement('li'); li.textContent=item.san||item.uci; history.append(li);});
    } catch(error) { document.getElementById('match-meta').textContent='Unable to load match.'; showError(error.message); document.getElementById('board').replaceChildren(); }
  }
  load();
})();
