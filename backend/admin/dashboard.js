(() => {
  'use strict';
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
  let visitorPage = 1;

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error('Session expired or access denied');
      throw new Error(data?.error || `Request failed (${response.status})`);
    }
    if (!data) throw new Error('Server returned an invalid response');
    return data;
  }
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const relative = value => { if (!value) return 'No moves yet'; const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000); if (seconds < 60) return 'just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`; return `${Math.floor(seconds / 86400)} days ago`; };
  const network = value => value ? value.replace(/^(AS\d+)\s+(.+)$/i, '$1 · $2') : '—';
  const shortVisitorId = value => String(value || '').replaceAll('-', '').slice(0, 6).toUpperCase() || '—';
  const state = (id, message, error = false) => { const target = document.getElementById(id); target.replaceChildren(el('div', error ? 'error' : 'empty', message)); };

  function metric(label, value) { const node = el('div', 'metric'); node.append(el('b', '', String(value ?? 0)), el('span', '', label)); return node; }
  async function loadOverview() {
    try {
      const { overview: o } = await api('/api/admin/overview');
      const streak = o.current_streak?.count ? `${o.current_streak.count} ${o.current_streak.who === 'jeremy' ? 'W' : 'L'}` : '—';
      document.getElementById('overview-content').replaceChildren(metric('Visitors', o.visitors), metric('Visits', o.total_visits), metric('IPs observed', o.ips_observed), metric('Legacy / unidentified visits', o.unidentified_visits), metric('Visits today', o.visits_today), metric('Challenges created', o.total_challenges), metric('Active matches', o.active_matches), metric('Games played', o.games_completed), metric('Wins', o.jeremy_wins), metric('Losses', o.player_wins), metric('Current streak', streak), metric("Jeremy's move", o.my_turn));
      document.getElementById('updated').textContent = `Updated ${relative(new Date())}`;
    } catch (error) { state('overview-content', `Unable to load overview — ${error.message}`, true); }
  }

  function challengeCard(c, status) {
    const card = el('article', `card${status === 'MY TURN' ? ' urgent' : ''}`); const top = el('div', 'card-top');
    top.append(el('span', `tag${status === 'MY TURN' ? ' turn' : ''}`, status), el('span', 'tag', c.current_game ? `GAME ${c.current_game.game_number} / BEST OF 3` : 'NO ACTIVE GAME'));
    card.append(top, el('h3', '', c.gamertag), el('div', 'score', `Jeremy ${c.jeremy_wins || 0} — ${c.player_wins || 0} Challenger`));
    const foot = el('div', 'card-foot'); foot.append(el('span', '', relative(c.last_move_at)));
    if (c.current_game && c.status !== 'completed') { const link = el('a', 'button', 'OPEN MATCH'); link.href = `/admin/open/${encodeURIComponent(c.id)}`; foot.append(link); }
    card.append(foot); return card;
  }
  function renderChallengeGroup(id, list, emptyMessage, statusFn) { if (!list.length) return state(id, emptyMessage); const wrap = el('div', 'cards'); list.forEach(c => wrap.append(challengeCard(c, statusFn(c)))); document.getElementById(id).replaceChildren(wrap); }
  async function loadChallenges() {
    try {
      const { challenges } = await api('/api/admin/challenges');
      const active = challenges.filter(c => c.status !== 'completed'); const mine = active.filter(c => c.admin_turn); const waiting = active.filter(c => !c.admin_turn); const completed = challenges.filter(c => c.status === 'completed');
      document.getElementById('turn-count').textContent = String(mine.length);
      renderChallengeGroup('myturn-content', mine, 'No matches require your move.', () => 'MY TURN');
      renderChallengeGroup('waiting-content', waiting, 'No matches are waiting for a challenger.', () => 'WAITING');
      renderChallengeGroup('challenges-content', challenges, 'No challenges have been created.', c => c.status === 'completed' ? 'COMPLETED' : c.admin_turn ? 'MY TURN' : 'WAITING');
      renderChallengeGroup('completed-content', completed, 'No completed matches.', () => 'COMPLETED');
    } catch (error) { ['myturn-content','waiting-content','challenges-content','completed-content'].forEach(id => state(id, `Unable to load challenges — ${error.message}`, true)); }
  }

  async function showVisitor(visitorId) {
    const target = document.getElementById('visitor-detail'); target.hidden = false; target.replaceChildren(el('div', 'state', 'Loading visitor details…'));
    try {
      const { visitor: v } = await api(`/api/admin/visitors/${encodeURIComponent(visitorId)}`); const box = el('div', 'detail'); const grid = el('div', 'detail-grid');
      [['Visitor ID',v.visitor_id],['Associated gamertags',(v.associated_gamertags || []).join(', ') || '—'],['Country (approx.)',v.country || 'Unknown'],['Region (approx.)',v.region || 'Unknown'],['City (approx.)',v.city || 'Unknown'],['Timezone',v.timezone || 'Unknown'],['ASN / ISP',network(v.asn_org)],['Browser',v.browser_family || 'Unknown'],['Device',v.device_category || 'Unknown'],['First seen',new Date(v.first_seen).toLocaleString()],['Last seen',new Date(v.last_seen).toLocaleString()],['Total visits',v.total_visits]].forEach(([label,value]) => { const item = el('div'); item.append(el('label','',label), el('span','',value)); grid.append(item); });
      const associations = el('ul','visit-list'); (v.associated_challenges || []).forEach(challenge => { const li = el('li'); li.append(el('div','',challenge.gamertag), el('div','state',`${challenge.status.toUpperCase()} · ${new Date(challenge.created_at).toLocaleString()}${challenge.result ? ` · ${challenge.result}` : ''}`)); associations.append(li); });
      const associationNote = el('p','state','Associated gamertags are linked by this first-party Visitor ID, not inferred from IP. Locations are approximate.');
      const associationContent = associations.childElementCount ? associations : el('div','empty','No associated challenges.');
      const ips = el('ul','visit-list'); (v.observed_ips || []).forEach(item => { const li = el('li'); const place=[item.city,item.region,item.country].filter(Boolean).join(', ') || 'Unknown location'; const link=el('button','text-link',item.ip); link.addEventListener('click',()=>{ document.getElementById('ips').scrollIntoView(); showIp(item.ip); }); li.append(link, el('span','',` · ${network(item.asn_org)}`), el('div','state',`${place} (approx.) · ${item.visits} visits · last ${new Date(item.last_seen).toLocaleString()}`)); ips.append(li); });
      const visits = el('ul','visit-list'); v.recent_visits.forEach(visit => { const li = el('li'); li.append(el('div','',`${visit.path || '/'} · ${visit.ip || 'IP unavailable'}`), el('div','state',`${new Date(visit.created_at).toLocaleString()} · ${visit.referrer || 'Direct'} · ${visit.browser_family || 'Unknown browser'} / ${visit.device_category || 'Unknown device'}`)); visits.append(li); });
      box.append(grid, el('h3','','ASSOCIATED CHALLENGES'), associationNote, associationContent, el('h3','','OBSERVED IPS / APPROXIMATE LOCATIONS'), ips, el('h3','','RECENT ACTIVITY'), visits); target.replaceChildren(box);
    } catch (error) { target.replaceChildren(el('div','error',`Unable to load visitor — ${error.message}`)); }
  }
  async function loadVisitors(page = visitorPage) {
    visitorPage = page;
    try {
      const { visitors, pagination } = await api(`/api/admin/visitors?page=${page}&page_size=25`); if (!visitors.length) { state('visitors-content','No visitor data yet.'); return; }
      const table = el('table'); const head = el('thead'); const hr = el('tr'); ['VISITOR','GAMERTAG','IP COUNT','RECENT IP','COUNTRY','REGION','CITY','NETWORK','DEVICE','VISITS','LAST SEEN'].forEach(x => hr.append(el('th','',x))); head.append(hr); const body = el('tbody');
      visitors.forEach(v => { const row = el('tr'); const gamertags=(v.associated_gamertags || []).join(', ') || '—'; [[shortVisitorId(v.visitor_id),''],[gamertags,''],[v.ip_count,''],[v.most_recent_ip || '—',''],[v.country || 'Unknown','hide-mobile'],[v.region || 'Unknown','hide-mobile'],[v.city || 'Unknown','hide-mobile'],[network(v.asn_org),'hide-mobile'],[v.device_category || 'Unknown','hide-mobile'],[v.visits,''],[relative(v.last_seen),'']].forEach(([value,className]) => row.append(el('td',className,value))); row.addEventListener('click',() => showVisitor(v.visitor_id)); body.append(row); }); table.append(head,body); document.getElementById('visitors-content').replaceChildren(table);
      const pager = document.getElementById('visitor-pagination'); pager.replaceChildren(); if (pagination.page > 1) { const prev = el('button','','← PREV'); prev.addEventListener('click',()=>loadVisitors(page-1)); pager.append(prev); } pager.append(el('span','state',`PAGE ${pagination.page} / ${Math.max(1,pagination.pages)}`)); if (pagination.page < pagination.pages) { const next = el('button','','NEXT →'); next.addEventListener('click',()=>loadVisitors(page+1)); pager.append(next); }
    } catch (error) { state('visitors-content',`Unable to load visitors — ${error.message}`,true); }
  }
  let ipPage = 1;
  async function showIp(ip, historyPage = 1) {
    const target = document.getElementById('ip-detail'); target.hidden = false; target.replaceChildren(el('div','state','Loading IP details…'));
    try {
      const { ip: detail, pagination } = await api(`/api/admin/ips/${encodeURIComponent(ip)}?page=${historyPage}&page_size=25`); const box=el('div','detail');
      const back=el('button','','← BACK TO IPS'); back.addEventListener('click',()=>{ target.hidden=true; target.replaceChildren(); document.getElementById('ips-content').scrollIntoView(); });
      box.append(back,el('h3','detail-title',`IP ${detail.address}`),el('p','state','An IP is a network address, not a human visitor. One IP may be used by multiple Visitor IDs. Geolocation below is approximate and is not the visitor’s physical location.'));
      const section = title => el('h3','detail-heading',title);
      const grid=el('div','detail-grid'); [['IP address',detail.address],['First seen',new Date(detail.first_seen).toLocaleString()],['Last seen',new Date(detail.last_seen).toLocaleString()],['Total visits / events',detail.total_visits],['Distinct Visitor IDs',detail.distinct_visitor_ids],['Associated gamertags',(detail.associated_gamertags||[]).join(', ')||'—'],['Device categories',(detail.device_categories||[]).join(', ')||'Unknown'],['Browsers',(detail.browsers||[]).join(', ')||'Unknown']].forEach(([label,value])=>{const item=el('div');item.append(el('label','',label),el('span','',value));grid.append(item);});
      const location=el('div','detail-grid'); [['Country (approx.)',detail.country||'Unknown'],['Region (approx.)',detail.region||'Unknown'],['City (approx.)',detail.city||'Unknown'],['Timezone',detail.timezone||'Unknown'],['ASN / Network',network(detail.asn_org)]].forEach(([label,value])=>{const item=el('div');item.append(el('label','',label),el('span','',value));location.append(item);});
      const visitorTable=el('table'); const vh=el('tr'); ['VISITOR ID','FIRST SEEN FROM IP','LAST SEEN FROM IP','EVENTS','GAMERTAGS'].forEach(x=>vh.append(el('th','',x))); const vb=el('tbody'); (detail.visitors||[]).forEach(v=>{const row=el('tr'); const link=el('button','text-link',shortVisitorId(v.visitor_id)); link.title=v.visitor_id; link.addEventListener('click',()=>{document.getElementById('visitors').scrollIntoView();showVisitor(v.visitor_id);}); const first=el('td');first.append(link);row.append(first,el('td','',new Date(v.first_seen).toLocaleString()),el('td','',new Date(v.last_seen).toLocaleString()),el('td','',v.visits),el('td','',(v.associated_gamertags||[]).join(', ')||'—'));vb.append(row);}); if(detail.legacy_events){const row=el('tr');row.append(el('td','','Legacy / unidentified'),el('td','',new Date(detail.legacy_first_seen).toLocaleString()),el('td','',new Date(detail.legacy_last_seen).toLocaleString()),el('td','',detail.legacy_events),el('td','','—'));vb.append(row);} visitorTable.append(el('thead','').appendChild(vh).parentNode,vb);
      const aggregateTable=(heading,rows,labelKey)=>{const wrap=el('div');wrap.append(section(heading));const list=el('ul','aggregate-list');rows.forEach(row=>{const li=el('li');li.append(el('span','',row[labelKey]),el('b','',row.count));list.append(li);});wrap.append(list);return wrap;};
      const history=el('table','history-table'); const hh=el('tr'); ['TIMESTAMP','VISITOR ID','GAMERTAG','PATH','REFERRER','DEVICE','BROWSER','COUNTRY','REGION','CITY','NETWORK'].forEach(x=>hh.append(el('th','',x))); const hb=el('tbody'); detail.events.forEach(event=>{const row=el('tr');const visitorCell=el('td');if(event.visitor_id){const link=el('button','text-link',shortVisitorId(event.visitor_id));link.title=event.visitor_id;link.addEventListener('click',()=>{document.getElementById('visitors').scrollIntoView();showVisitor(event.visitor_id);});visitorCell.append(link);}else visitorCell.textContent='Legacy / unidentified';[new Date(event.created_at).toLocaleString(),visitorCell,(event.associated_gamertags||[]).join(', ')||'—',event.path||'/',event.referrer||'direct / no referrer',event.device_category||'Unknown',event.browser_family||'Unknown',event.country||'Unknown',event.region||'Unknown',event.city||'Unknown',network(event.asn_org)].forEach((value,index)=>row.append(index===1?value:el('td','',value)));hb.append(row);});history.append(el('thead','').appendChild(hh).parentNode,hb);
      const historyPager=el('div','pagination');if(pagination.page>1){const prev=el('button','','← NEWER');prev.addEventListener('click',()=>showIp(ip,historyPage-1));historyPager.append(prev);}historyPager.append(el('span','state',`PAGE ${pagination.page} / ${Math.max(1,pagination.pages)}`));if(pagination.page<pagination.pages){const next=el('button','','OLDER →');next.addEventListener('click',()=>showIp(ip,historyPage+1));historyPager.append(next);}
      box.append(section('SUMMARY'),grid,section('NETWORK / APPROXIMATE LOCATION'),location,section('VISITOR IDs USING THIS IP'),visitorTable,aggregateTable('REFERRERS',detail.referrers,'source'),aggregateTable('PATHS',detail.paths,'path'),section('VISIT HISTORY'),history,historyPager); target.replaceChildren(box); target.scrollIntoView({block:'start'});
    }
    catch(error){ target.replaceChildren(el('div','error',`Unable to load IP — ${error.message}`)); }
  }
  async function loadIps(page = ipPage) {
    ipPage=page;
    try { const { ips, pagination }=await api(`/api/admin/ips?page=${page}&page_size=25`); if(!ips.length){state('ips-content','No IP data yet.');return;} const table=el('table'); const head=el('thead'); const hr=el('tr'); ['IP','IP-ASSOCIATED GAMERTAGS','COUNTRY','REGION','CITY','NETWORK','VISITS','LAST SEEN'].forEach(x=>hr.append(el('th','',x))); head.append(hr); const body=el('tbody'); ips.forEach(item=>{const row=el('tr'); const ipCell=el('td');const link=el('button','text-link',item.ip);link.addEventListener('click',()=>showIp(item.ip));ipCell.append(link);row.append(ipCell); [[(item.ip_associated_gamertags||[]).join(', ')||'—',''],[item.country||'Unknown','hide-mobile'],[item.region||'Unknown','hide-mobile'],[item.city||'Unknown','hide-mobile'],[network(item.asn_org),'hide-mobile'],[item.visits,''],[relative(item.last_seen),'']].forEach(([value,className])=>row.append(el('td',className,value))); body.append(row);}); table.append(head,body); document.getElementById('ips-content').replaceChildren(table); const pager=document.getElementById('ip-pagination'); pager.replaceChildren(); if(pagination.page>1){const prev=el('button','','← PREV');prev.addEventListener('click',()=>loadIps(page-1));pager.append(prev);} pager.append(el('span','state',`PAGE ${pagination.page} / ${Math.max(1,pagination.pages)}`)); if(pagination.page<pagination.pages){const next=el('button','','NEXT →');next.addEventListener('click',()=>loadIps(page+1));pager.append(next);} }
    catch(error){state('ips-content',`Unable to load IPs — ${error.message}`,true);}
  }
  async function refresh() { document.getElementById('refresh').disabled = true; await Promise.allSettled([loadOverview(),loadChallenges(),loadVisitors(visitorPage),loadIps(ipPage)]); document.getElementById('refresh').disabled = false; }
  document.getElementById('refresh').addEventListener('click',refresh);
  document.getElementById('logout').addEventListener('click',async()=>{ try { await api('/admin/logout',{method:'POST',headers:{'x-csrf-token':csrf}}); location.reload(); } catch (error) { alert(`Unable to log out — ${error.message}`); } });
  refresh(); setInterval(() => { loadOverview(); loadChallenges(); }, 30000);
})();
