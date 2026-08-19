const year = document.querySelector("#year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// piece unicode helper
function pieceToUnicode(type, color) {
  const m = { p: { w: '♙', b: '♟' }, r: { w: '♖', b: '♜' }, n: { w: '♘', b: '♞' }, b: { w: '♗', b: '♝' }, q: { w: '♕', b: '♛' }, k: { w: '♔', b: '♚' } };
  return m[type]?.[color] || '';
}

const revealItems = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.14,
    rootMargin: "0px 0px -32px 0px",
  },
);

revealItems.forEach((item) => revealObserver.observe(item));

if (window.location.hash) {
  window.setTimeout(() => {
    const target = document.querySelector(window.location.hash);
    target?.scrollIntoView({ block: "start" });
    target?.classList.add("is-visible");
    target?.querySelectorAll(".reveal").forEach((item) => {
      item.classList.add("is-visible");
      revealObserver.unobserve(item);
    });
  }, 120);
}

// If the page was opened with a challenge match link, open the Challenge section immediately
// and preserve the token in session storage so the match UI can restore when ready.
(function handleInitialChallengeParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const challengeId = params.get('challenge') || params.get('match');
    const token = params.get('token');
    if (!challengeId) return;

    // scroll to challenge section and reveal its items
    const target = document.querySelector('#challenge');
    if (target) {
      target.scrollIntoView({ block: 'start' });
      target.querySelectorAll('.reveal').forEach((item) => {
        item.classList.add('is-visible');
      });
    }

    // hide the creation form (we're restoring an existing match)
    const form = document.getElementById('challenge-form');
    if (form) form.setAttribute('aria-hidden', 'true');

    // persist token for the session (localStorage) so match UI can use it
    if (token) {
      try { localStorage.setItem(`challenge_token_${challengeId}`, token); } catch (e) { /* ignore storage errors */ }
    }

    // expose the initial challenge id so match UI can opt-in if needed
    window.__initialChallenge = { id: challengeId };
  } catch (err) {
    console.error('Failed to parse initial challenge params', err);
  }
})();

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", () => {
    const target = document.querySelector(link.getAttribute("href"));
    window.setTimeout(() => {
      target?.querySelectorAll(".reveal").forEach((item) => {
        item.classList.add("is-visible");
        revealObserver.unobserve(item);
      });
    }, 180);
  });
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const parallaxItems = document.querySelectorAll(".parallax");

const updateParallax = () => {
  if (prefersReducedMotion.matches) return;

  const viewportMid = window.innerHeight / 2;
  parallaxItems.forEach((item) => {
    const depth = Number(item.dataset.depth || 0);
    const rect = item.getBoundingClientRect();
    const itemMid = rect.top + rect.height / 2;
    const offset = (viewportMid - itemMid) * depth;
    const clampedOffset = Math.max(-50, Math.min(50, offset));
    item.style.transform = `translate3d(0, ${clampedOffset.toFixed(2)}px, 0)`;
  });
};

let ticking = false;
const requestParallax = () => {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(() => {
    updateParallax();
    ticking = false;
  });
};

window.addEventListener("scroll", requestParallax, { passive: true });
window.addEventListener("resize", requestParallax);
updateParallax();

/* Challenge Me UI interactions (frontend only) */
(function () {
  const startBtn = document.getElementById("start-challenge");
  const rulesBtn = document.getElementById("view-rules");
  const leaderboardBtn = document.getElementById("view-leaderboard");
  const form = document.getElementById("challenge-form");
  const createBtn = document.getElementById("create-challenge");
  const cancelBtn = document.getElementById("cancel-challenge");
  const openMatchesEl = document.getElementById("open-matches");

  let openMatches = 0;

  const showForm = () => {
    form?.setAttribute("aria-hidden", "false");
    form?.querySelector("input, select")?.focus();
  };

  const hideForm = () => {
    form?.setAttribute("aria-hidden", "true");
  };

  startBtn?.addEventListener("click", () => showForm());
  cancelBtn?.addEventListener("click", () => hideForm());

  // If the page was opened with an existing challenge URL, disable creating a new challenge
  if (window.__initialChallenge && createBtn) {
    createBtn.disabled = true;
    createBtn.title = 'Viewing an existing match';
  }

  const API_BASE = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';

  async function apiCreateChallenge(gamertag, game) {
    const resp = await fetch(`${API_BASE}/api/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gamertag, game })
    });
    if (!resp.ok) throw new Error('create failed');
    return resp.json();
  }

  const ensureBoardContainer = () => {
    const panel = document.querySelector('.challenge-panel');
    let container = panel.querySelector('.match-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'match-container';
      container.style.marginTop = '1rem';
      panel.appendChild(container);
    }
    return container;
  };

  function renderLinkArea(matchUrl) {
    const container = ensureBoardContainer();
    container.innerHTML = '';
    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.gap = '0.6rem';
    info.style.alignItems = 'center';
    info.innerHTML = `<div style="font-family:var(--mono);color:var(--gold-soft);">Match ready</div>`;
    const link = document.createElement('input');
    link.value = matchUrl;
    link.readOnly = true;
    link.style.flex = '1';
    link.style.padding = '0.6rem';
    link.style.borderRadius = '8px';
    link.style.border = '1px solid var(--line)';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.textContent = 'Copy Match Link';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(link.value);
      copyBtn.textContent = 'Copied';
      setTimeout(() => (copyBtn.textContent = 'Copy Match Link'), 2000);
    });
    info.appendChild(link);
    info.appendChild(copyBtn);
    container.appendChild(info);
  }

  createBtn?.addEventListener('click', async () => {
    const tag = document.getElementById('gamertag')?.value?.trim();
    const game = document.getElementById('game-select')?.value;
    if (!tag) {
      alert('Please enter a gamertag to create a challenge.');
      return;
    }

    try {
      createBtn.disabled = true;
      const data = await apiCreateChallenge(tag, game);
      if (data?.match_url) {
        renderLinkArea(data.match_url);
        // update open matches UI
        openMatches += 1;
        if (openMatchesEl) openMatchesEl.textContent = String(openMatches);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create challenge. Check console for details.');
    } finally {
      createBtn.disabled = false;
      hideForm();
    }
  });

  const showModal = (title, body) => {
    const existing = document.getElementById("challenge-modal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "challenge-modal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.display = "grid";
    modal.style.placeItems = "center";
    modal.style.background = "rgba(0,0,0,0.55)";
    modal.innerHTML = `
      <div style=\"width:min(680px,94%);max-height:88vh;overflow:auto;padding:1.2rem;border-radius:14px;background:var(--panel);border:1px solid var(--line);\">
        <div style=\"display:flex;justify-content:space-between;align-items:center;gap:1rem;\"><h3 style=\"margin:0;\">${title}</h3><button id=\"close-challenge-modal\" class=\"btn\">Close</button></div>
        <div style=\"margin-top:0.8rem;color:var(--muted);\">${body}</div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("close-challenge-modal")?.addEventListener("click", () => modal.remove());
  };

  rulesBtn?.addEventListener("click", () => {
    showModal("Rules", `
      <ul>
        <li>Match format: Best of 3.</li>
        <li>Chess: standard rules. Backgammon: standard rules.</li>
        <li>This is an honor system — results will be confirmed manually.</li>
        <li>Winner receives a free one-page website. I will contact the winner to arrange details.</li>
      </ul>
    `);
  });

  leaderboardBtn?.addEventListener("click", () => {
    showModal("Leaderboard", `<p class=\"muted\">Leaderboard will appear here once challenges have been played. For now this is a placeholder.</p>`);
  });
})();

/* Match loader and interactive board (defensive) */
function initMatchUI() {
  const params = new URLSearchParams(window.location.search);
  const challengeId = params.get('challenge') || params.get('match');
  const tokenFromUrl = params.get('token');
  const API_BASE = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';

  async function apiGetChallenge(id, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${API_BASE}/api/challenges/${id}`, { headers });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>null);
      const msg = `GET /api/challenges/${id} failed: ${resp.status} ${resp.statusText} ${text||''}`;
      throw new Error(msg);
    }
    return resp.json();
  }

  async function apiGetCurrentGame(challengeId, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${API_BASE}/api/challenges/${challengeId}/games/current`, { headers });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>null);
      throw new Error(`GET /api/challenges/${challengeId}/games/current failed: ${resp.status} ${resp.statusText} ${text||''}`);
    }
    return resp.json();
  }

  async function apiGetGame(gameId, token) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${API_BASE}/api/games/${gameId}`, { headers });
    if (!resp.ok) {
      const text = await resp.text().catch(()=>null);
      throw new Error(`GET /api/games/${gameId} failed: ${resp.status} ${resp.statusText} ${text||''}`);
    }
    return resp.json();
  }

  async function apiPostMove(gameId, move, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(`${API_BASE}/api/games/${gameId}/moves`, {
      method: 'POST',
      headers,
      body: JSON.stringify(move)
    });
    if (resp.status === 401) throw new Error('unauthorized');
    if (resp.status === 403) throw new Error('not your turn');
    if (!resp.ok) {
      const j = await resp.json().catch(()=>({ error: 'server' }));
      throw new Error(j.error || 'move failed');
    }
    return resp.json();
  }

  function ensureBoardContainer() {
    const panel = document.querySelector('.challenge-panel');
    let container = panel.querySelector('.match-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'match-container';
      container.style.marginTop = '1rem';
      panel.appendChild(container);
    }
    return container;
  }

  // renderChessBoard assumes `Chess` is available
  function renderChessBoard(fen, onMove, opts = {}) {
    const container = ensureBoardContainer();
    // keep meta area if present
    const existingMeta = container.querySelector('.match-meta');
    container.innerHTML = '';
    if (existingMeta) container.appendChild(existingMeta);

    // opts: { lastMove, challengerColor, gameId, token, isPlayerTurn }
    const gameId = opts.gameId;
    const token = opts.token;
    const isPlayerTurn = Boolean(opts.isPlayerTurn);

    // If interactive Chess lib available, use it. Otherwise render a static board from FEN.
    if (typeof window.Chess !== 'function') {
      renderFenOnlyBoard(fen, opts.lastMove, opts.challengerColor);
      // attach server-side based interactivity (read-only if not player's turn)
      attachServerLegalMoveHandlers(container, gameId, token, opts.challengerColor, isPlayerTurn, onMove);
      return;
    }

    const boardEl = document.createElement('div');
    boardEl.className = 'chess-board';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
    boardEl.style.gap = '4px';
    boardEl.style.maxWidth = '420px';
    boardEl.style.borderRadius = '8px';
    boardEl.style.padding = '6px';
    boardEl.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';

    const chess = new window.Chess(fen);
    const lastMove = opts.lastMove;
    const challengerColor = opts.challengerColor || 'white';
    // Determine orientation: if challenger is black, rotate board 180deg
    const rowRanks = challengerColor === 'black' ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
    const fileChars = challengerColor === 'black' ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    for (let ri = 0; ri < rowRanks.length; ri++) {
      const rank = rowRanks[ri];
      for (let fi = 0; fi < fileChars.length; fi++) {
        const file = fileChars[fi];
        const coord = `${file}${rank}`;
        const sq = chess.get(coord);
        const sqEl = document.createElement('button');
        sqEl.className = 'chess-square';
        sqEl.dataset.square = coord;
        sqEl.style.minHeight = '48px';
        sqEl.style.display = 'grid';
        sqEl.style.placeItems = 'center';
        sqEl.style.border = '1px solid var(--line)';
        // color based on file+rank parity for visual checkboard
        const parity = (fileChars.indexOf(file) + (rowRanks.length - 1 - ri)) % 2 === 0;
        sqEl.style.background = parity ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.25)';
        sqEl.style.color = 'var(--text)';
        sqEl.style.fontSize = '1.35rem';
        sqEl.style.fontFamily = 'var(--mono)';

        if (sq) {
          const glyph = pieceToUnicode(sq.type, sq.color);
          sqEl.textContent = glyph;
        }

        if (lastMove && (lastMove.from === coord || lastMove.to === coord)) {
          sqEl.style.boxShadow = 'inset 0 0 0 3px rgba(211,167,90,0.12)';
        }

        boardEl.appendChild(sqEl);
      }
    }

    // click-to-select then click-to-move with legal move highlighting
    let selected = null;
    let isProcessing = false;
    boardEl.addEventListener('click', async (ev) => {
      if (isProcessing) return;
      const btn = ev.target.closest('.chess-square');
      if (!btn) return;
      const sq = btn.dataset.square;

      const piece = chess.get(sq);
      const pieceColor = piece ? (piece.color === 'w' ? 'white' : 'black') : null;
      const challengerColor = opts.challengerColor || 'white';

      // Only allow selecting player's own pieces when it's their turn
      if (!isPlayerTurn) return;
      if (!selected) {
        if (!piece || pieceColor !== challengerColor) return; // not player's piece
        selected = sq;
        console.log('[Chess] selected square', selected);
        btn.style.outline = `2px solid var(--gold)`;
        // highlight legal moves via local chess.js
        const moves = chess.moves({ square: selected, verbose: true }) || [];
        console.log('[Chess] legal moves', moves.map(m=>m.to));
        document.querySelectorAll('.chess-square').forEach(s => s.style.borderColor = 'var(--line)');
        moves.forEach(m => {
          const el = boardEl.querySelector(`[data-square='${m.to}']`);
          if (el) el.style.borderColor = 'rgba(211,167,90,0.8)';
        });
      } else if (selected === sq) {
        selected = null;
        btn.style.outline = 'none';
        document.querySelectorAll('.chess-square').forEach(s => s.style.borderColor = 'var(--line)');
      } else {
        const from = selected;
        const to = sq;
        selected = null;
        document.querySelectorAll('.chess-square').forEach(s => { s.style.outline = 'none'; s.style.borderColor = 'var(--line)'; });
        const legalMoves = chess.moves({ square: from, verbose: true }) || [];
        const candidate = legalMoves.find(m => m.to === to);
        if (!candidate) return; // illegal
        const doMove = async (promotionPiece) => {
          if (typeof onMove === 'function') {
            try {
              isProcessing = true;
              await showInlineStatus('Submitting move...', 0);
              console.log('[Chess] submitting move', { from, to, promotion: promotionPiece });
              await onMove({ from, to, promotion: promotionPiece });
              console.log('[Chess] server response: move accepted');
              await showInlineStatus('MOVE SAVED', 800);
            } catch (err) {
              console.error('[Chess] server response', err);
              await showInlineStatus(err.message || 'MOVE COULD NOT BE SAVED', 1600);
            } finally {
              isProcessing = false;
            }
          }
        };
        if (candidate.promotion) {
          const choice = await showPromotionDialog();
          if (!choice) return;
          await doMove(choice);
        } else {
          await doMove();
        }
      }
    });

    container.appendChild(boardEl);
  }

  function showPromotionDialog() {
    return new Promise((resolve) => {
      const existing = document.getElementById('promo-modal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'promo-modal';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.display = 'grid';
      modal.style.placeItems = 'center';
      modal.style.background = 'rgba(0,0,0,0.6)';
      modal.innerHTML = `<div style="background:var(--panel);padding:1rem;border-radius:10px;">
        <div style="font-family:var(--mono);color:var(--gold-soft);margin-bottom:8px;">Choose promotion</div>
        <div style="display:flex;gap:8px;">
          <button class="btn" data-piece="q">Queen</button>
          <button class="btn" data-piece="r">Rook</button>
          <button class="btn" data-piece="b">Bishop</button>
          <button class="btn" data-piece="n">Knight</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-piece]');
        if (btn) {
          const p = btn.dataset.piece;
          modal.remove();
          resolve(p);
        }
      });
    });
  }

  // Static FEN-only renderer: displays board position using unicode pieces without relying on chess.js
  function renderFenOnlyBoard(fen, lastMove, challengerColor) {
    const container = ensureBoardContainer();
    const boardEl = document.createElement('div');
    boardEl.className = 'chess-board';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
    boardEl.style.gap = '4px';
    boardEl.style.maxWidth = '420px';
    boardEl.style.borderRadius = '8px';
    boardEl.style.padding = '6px';
    boardEl.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';

    const placement = (fen || '').split(' ')[0] || '';
    const rows = placement.split('/');
    // build a map coord -> pieceChar
    const boardMap = {};
    for (let r = 0; r < 8; r++) {
      const row = rows[r] || '';
      let fileIndex = 0;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (/[1-8]/.test(ch)) {
          const count = Number(ch);
          for (let k = 0; k < count; k++) {
            const file = 'abcdefgh'[fileIndex];
            const rank = 8 - r;
            const coord = `${file}${rank}`;
            boardMap[coord] = null;
            fileIndex++;
          }
        } else {
          const file = 'abcdefgh'[fileIndex];
          const rank = 8 - r;
          const coord = `${file}${rank}`;
          boardMap[coord] = ch;
          fileIndex++;
        }
      }
    }

    // orientation
    const challenger = challengerColor || 'white';
    const rowRanks = challenger === 'black' ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
    const fileChars = challenger === 'black' ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];

    for (let ri = 0; ri < rowRanks.length; ri++) {
      const rank = rowRanks[ri];
      for (let fi = 0; fi < fileChars.length; fi++) {
        const file = fileChars[fi];
        const coord = `${file}${rank}`;
        const sqEl = document.createElement('div');
        sqEl.className = 'chess-square';
        sqEl.dataset.square = coord;
        sqEl.style.minHeight = '48px';
        sqEl.style.display = 'grid';
        sqEl.style.placeItems = 'center';
        sqEl.style.border = '1px solid var(--line)';
        const parity = (fi + (rowRanks.length - 1 - ri)) % 2 === 0;
        sqEl.style.background = parity ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.25)';
        sqEl.style.color = 'var(--text)';
        sqEl.style.fontSize = '1.35rem';
        sqEl.style.fontFamily = 'var(--mono)';
        const ch = boardMap[coord];
        if (ch) {
          const isUpper = ch === ch.toUpperCase();
          const type = ch.toLowerCase();
          const color = isUpper ? 'w' : 'b';
          sqEl.textContent = pieceToUnicode(type, color === 'w' ? 'w' : 'b');
        }
        if (lastMove && (lastMove.from === coord || lastMove.to === coord)) {
          sqEl.style.boxShadow = 'inset 0 0 0 3px rgba(211,167,90,0.12)';
        }
        boardEl.appendChild(sqEl);
      }
    }

    // replace container content but preserve any .match-meta
    const existingMeta = container.querySelector('.match-meta');
    container.innerHTML = '';
    if (existingMeta) container.appendChild(existingMeta);
    container.appendChild(boardEl);
  }

  // show an inline status in the match meta area; timeout 0 means persist until cleared
  function showInlineStatus(msg, timeout = 1200) {
    return new Promise((resolve) => {
      const panel = document.querySelector('.challenge-panel');
      if (!panel) return resolve();
      const meta = panel.querySelector('.match-meta');
      if (!meta) return resolve();
      let s = meta.querySelector('.match-status-inline');
      if (!s) {
        s = document.createElement('div');
        s.className = 'match-status-inline';
        s.style.fontFamily = 'var(--mono)';
        s.style.color = 'var(--muted)';
        s.style.marginTop = '6px';
        meta.appendChild(s);
      }
      s.textContent = msg;
      if (timeout > 0) setTimeout(() => { s.remove(); resolve(); }, timeout);
      else resolve();
    });
  }

  // Attach handlers that query the server for legal moves when local chess.js is unavailable.
  function attachServerLegalMoveHandlers(container, gameId, token, challengerColor = 'white', isPlayerTurn = false, onMove) {
    if (!gameId) return;
    let selected = null;
    let legal = [];
    let processing = false;

    function clearHighlights() {
      container.querySelectorAll('.chess-square').forEach(s => { s.style.borderColor = 'var(--line)'; s.style.outline = 'none'; });
    }

    container.addEventListener('click', async (ev) => {
      if (processing) return;
      const btn = ev.target.closest('.chess-square');
      if (!btn) return;
      const sq = btn.dataset.square;
      // read piece from DOM (unicode present for static renderer)
      const text = (btn.textContent || '').trim();

      // If not player's turn, ignore selection
      if (!isPlayerTurn) return;

      // If no selection yet, ensure clicked square has player's piece
      if (!selected) {
        // simple heuristic: fetch legal moves for this square; if none, it's not selectable
        try {
          const headers = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const resp = await fetch(`${API_BASE}/api/games/${gameId}/legal?square=${sq}`, { headers });
          if (!resp.ok) return; // not authorized or no moves
          const j = await resp.json();
          legal = j.moves || [];
          if (!legal.length) return; // nothing to do
          selected = sq;
          console.log('[Chess] selected square', selected);
          btn.style.outline = `2px solid var(--gold)`;
          console.log('[Chess] legal moves', legal.map(m=>m.to));
          legal.forEach(m => {
            const el = container.querySelector(`[data-square='${m.to}']`);
            if (el) el.style.borderColor = 'rgba(211,167,90,0.8)';
          });
        } catch (err) {
          console.error('Failed to fetch legal moves', err);
        }
      } else if (selected === sq) {
        selected = null;
        clearHighlights();
      } else {
        const from = selected;
        const to = sq;
        const candidate = legal.find(m => m.to === to);
        if (!candidate) return; // illegal
        // handle promotion
        let promotionChoice = null;
        if (candidate.promotion) {
          promotionChoice = await showPromotionDialog();
          if (!promotionChoice) return;
        }
        try {
          processing = true;
          await showInlineStatus('Submitting move...', 0);
          console.log('[Chess] submitting move', { from, to, promotion: promotionChoice });
          if (typeof onMove === 'function') await onMove({ from, to, promotion: promotionChoice });
          console.log('[Chess] server response');
          await showInlineStatus('MOVE SAVED', 800);
        } catch (err) {
          console.error('[Chess] server response', err);
          await showInlineStatus(err.message || 'MOVE COULD NOT BE SAVED', 1600);
        } finally {
          processing = false;
          selected = null;
          legal = [];
          clearHighlights();
        }
      }
    });
  }

  async function loadMatch(matchId, token) {
    const container = ensureBoardContainer();
    container.innerHTML = '';
    const status = document.createElement('div');
    status.className = 'match-status';
    status.style.fontFamily = 'var(--mono)';
    status.style.color = 'var(--muted)';
    status.textContent = 'Loading match...';
    container.appendChild(status);

    try {
      console.log('Match restore: challengeId=', matchId);
      console.log('Match restore: token present=', Boolean(token));

      const challengeResp = await apiGetChallenge(matchId, token);
      console.log('GET /api/challenges/:', challengeResp);
      const challenge = challengeResp.challenge;
      if (!challenge) {
        status.textContent = 'Invalid or expired private match link.';
        console.error('Challenge not found or invalid');
        return;
      }
      if (!challengeResp.authorized) {
        status.textContent = 'Invalid or expired private match link.';
        console.error('Token not authorized for this challenge');
        return;
      }

      // now fetch current game
      const cg = await apiGetCurrentGame(matchId, token);
      console.log('GET current game:', cg);
      const game = cg && cg.game;
      if (!game) {
        status.textContent = 'Match found, but game data could not be loaded.';
        console.error('No current game for challenge', matchId);
        return;
      }

      // fetch game details (moves + fen)
      const gameDetails = await apiGetGame(game.id, token);
      console.log('GET game details:', gameDetails);
      const moves = (gameDetails && gameDetails.moves) || [];

      // render meta and board
      const meta = document.createElement('div');
      meta.className = 'match-meta';
      meta.style.display = 'grid';
      meta.style.gap = '0.6rem';

      const playerWins = challenge.player_wins || 0;
      const jeremyWins = challenge.jeremy_wins || 0;
      meta.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;"><div class=\"mono\">MATCH / ACTIVE</div><div style=\"font-size:1.1rem;\">${challenge.gamertag}</div><div class=\"mono\">GAME ${game.game_number} / BEST OF 3</div><div class=\"mono\">Jeremy ${jeremyWins} — ${playerWins} Player</div><div class=\"mono\">Status: ${game.status}</div></div>`;

      container.innerHTML = '';
      container.appendChild(meta);

      // determine whose turn from FEN
      const fen = game.fen_current;
      const activeColor = (fen || '').split(' ')[1] || 'w';
      const challengerColor = game.challenger_color || 'white';
      const playerSide = challengerColor === 'white' ? 'white' : 'black';
      const jeremySide = playerSide === 'white' ? 'black' : 'white';
      const sideToMove = activeColor === 'w' ? 'white' : 'black';
      const turnText = sideToMove === playerSide ? 'YOUR TURN' : "JEREMY'S TURN";

      const turnEl = document.createElement('div');
      turnEl.className = 'match-turn';
      turnEl.style.fontFamily = 'var(--mono)';
      turnEl.style.marginTop = '6px';
      turnEl.textContent = turnText;
      meta.appendChild(turnEl);

      // render board (static or interactive)
      try {
        console.log('FEN received:', fen);
        const isPlayerTurn = sideToMove === playerSide;
        renderChessBoard(fen, async (move) => {
          try {
            const resp = await apiPostMove(game.id, move, token);
            await loadMatch(matchId, token);
          } catch (err) {
            // show inline error instead of alert
            console.error('Move error', err);
            const panel = document.querySelector('.challenge-panel');
            const meta = panel.querySelector('.match-meta');
            if (meta) {
              const s = meta.querySelector('.match-status-inline') || document.createElement('div');
              s.className = 'match-status-inline';
              s.style.fontFamily = 'var(--mono)';
              s.style.color = 'var(--muted)';
              s.textContent = err.message || 'Move failed';
              meta.appendChild(s);
              setTimeout(()=>s.remove(), 2200);
            }
          }
        }, { lastMove: moves.length ? moves[moves.length-1] : null, challengerColor: game.challenger_color, gameId: game.id, token, isPlayerTurn });
        console.log('Board render invoked');
      } catch (err) {
        console.error('Board render failed', err);
        status.textContent = 'Match found, but board could not be rendered.';
      }

      // move history
      let historyEl = meta.querySelector('.move-history');
      if (!historyEl) {
        historyEl = document.createElement('div');
        historyEl.className = 'move-history';
        historyEl.style.fontFamily = 'var(--mono)';
        historyEl.style.color = 'var(--muted)';
        meta.appendChild(historyEl);
      }
      historyEl.innerHTML = `<div style="margin-top:8px;">Move history:</div><ol>${moves.map(m=>`<li>${m.san || m.uci}</li>`).join('')}</ol>`;

      // copy link button
      const copyArea = document.createElement('div');
      copyArea.style.marginTop = '8px';
      const linkInput = document.createElement('input');
      linkInput.value = `${window.location.origin}/?challenge=${matchId}`;
      linkInput.readOnly = true;
      linkInput.style.padding = '0.5rem';
      linkInput.style.marginRight = '8px';
      linkInput.style.border = '1px solid var(--line)';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn';
      copyBtn.textContent = 'Copy Private Match Link';
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(linkInput.value);
        copyBtn.textContent = 'Copied';
        setTimeout(()=>copyBtn.textContent = 'Copy Private Match Link',2000);
      });
      copyArea.appendChild(linkInput);
      copyArea.appendChild(copyBtn);
      container.appendChild(copyArea);

    } catch (err) {
      console.error('Match restore error:', err);
      const msg = String(err?.message || err);
      const userMsg = msg.includes('401') || msg.includes('not authorized') ? 'Invalid or expired private match link.' : (msg.includes('Failed to fetch') ? 'Unable to connect to match server.' : 'Match found, but game data could not be loaded.');
      container.innerHTML = `<div style="color:var(--muted);font-family:var(--mono);">${userMsg}</div><div style="display:none">${msg}</div>`;
    }
  }

  if (challengeId) {
    if (tokenFromUrl) localStorage.setItem(`challenge_token_${challengeId}`, tokenFromUrl);
    const token = tokenFromUrl || localStorage.getItem(`challenge_token_${challengeId}`);
    loadMatch(challengeId, token);
  }
}

// Initialize immediately if Chess already available, otherwise wait for chess-ready event.
if (typeof window !== 'undefined') {
  // Always initialize match UI immediately (it will fall back to a static FEN renderer if Chess is unavailable)
  try { initMatchUI(); } catch (e) { console.error('Match UI init failed', e); }

  // Still listen for chess-ready to allow upgrading the static board to interactive later
  window.addEventListener('chess-ready', () => {
    try {
      // Re-initialize match UI to enable interactive features if a match is active
      initMatchUI();
    } catch (e) {
      console.error('Match UI upgrade failed', e);
    }
  }, { once: true });

  // If chess fails to load, show a muted notice (non-fatal)
  window.addEventListener('chess-failed', () => {
    const panel = document.querySelector('.challenge-panel');
    if (!panel) return;
    const note = document.createElement('div');
    note.style.color = 'var(--muted)';
    note.style.marginTop = '0.6rem';
    note.textContent = 'Challenge (Chess) is currently unavailable. Board will be displayed in a static view.';
    panel.appendChild(note);
  }, { once: true });
}

