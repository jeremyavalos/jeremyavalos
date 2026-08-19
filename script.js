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

/* Match loader and interactive board */
(function () {
  const params = new URLSearchParams(window.location.search);
  const challengeId = params.get('challenge') || params.get('match');
  const tokenFromUrl = params.get('token');
  const API_BASE = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';

  async function apiGetChallenge(id, token) {
    const url = new URL(`${API_BASE}/api/challenges/${id}`);
    if (token) url.searchParams.set('token', token);
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error('not found');
    return resp.json();
  }

  async function apiGetCurrentGame(challengeId) {
    const resp = await fetch(`${API_BASE}/api/challenges/${challengeId}/games/current`);
    if (!resp.ok) throw new Error('no game');
    return resp.json();
  }

  async function apiGetGame(gameId) {
    const resp = await fetch(`${API_BASE}/api/games/${gameId}`);
    if (!resp.ok) throw new Error('game not found');
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

  // overwrite renderChessBoard with enhanced UX: legal move highlights, promotion dialog, last move
  function renderChessBoard(fen, onMove, opts = {}) {
    const container = ensureBoardContainer();
    // keep meta area if present
    const existingMeta = container.querySelector('.match-meta');
    container.innerHTML = '';
    if (existingMeta) container.appendChild(existingMeta);

    const boardEl = document.createElement('div');
    boardEl.className = 'chess-board';
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = 'repeat(8, 1fr)';
    boardEl.style.gap = '4px';
    boardEl.style.maxWidth = '420px';
    boardEl.style.borderRadius = '8px';
    boardEl.style.padding = '6px';
    boardEl.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))';

    const chess = new Chess(fen);
    const board = chess.board();
    const lastMove = opts.lastMove;
    // board is 8 rows from 8 to 1
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = board[r][f];
        const file = 'abcdefgh'[f];
        const rank = r + 1;
        const coord = `${file}${rank}`;
        const sqEl = document.createElement('button');
        sqEl.className = 'chess-square';
        sqEl.dataset.square = coord;
        sqEl.style.minHeight = '48px';
        sqEl.style.display = 'grid';
        sqEl.style.placeItems = 'center';
        sqEl.style.border = '1px solid var(--line)';
        sqEl.style.background = ((f + r) % 2 === 0) ? 'rgba(255,255,255,0.012)' : 'rgba(0,0,0,0.25)';
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
    boardEl.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.chess-square');
      if (!btn) return;
      const sq = btn.dataset.square;
      if (!selected) {
        selected = sq;
        btn.style.outline = `2px solid var(--gold)`;
        // highlight legal moves
        const moves = chess.moves({ square: selected, verbose: true }) || [];
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
            await onMove({ from, to, promotion: promotionPiece });
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

  async function loadMatch(matchId, token) {
    try {
      const challengeResp = await apiGetChallenge(matchId, token);
      const challenge = challengeResp.challenge;
      const container = ensureBoardContainer();
      // meta area
      const meta = document.createElement('div');
      meta.className = 'match-meta';
      meta.style.display = 'grid';
      meta.style.gap = '0.6rem';
      container.innerHTML = '';
      container.appendChild(meta);

      async function refresh() {
        const ch = await apiGetChallenge(matchId, token).catch(()=>null);
        const cg = await apiGetCurrentGame(matchId);
        const game = cg.game;
        const gameDetails = await apiGetGame(game.id).catch(()=>null);
        const moves = (gameDetails && gameDetails.moves) || [];
        // meta
        meta.innerHTML = `<div style="display:flex;gap:1rem;align-items:center;"><div class=\"mono\">${challenge.gamertag}</div><div class=\"mono\">Score: ${ch?.challenge?.player_wins||0} - ${ch?.challenge?.jeremy_wins||0} (draws ${ch?.challenge?.draws||0})</div><div class=\"mono\">Game ${game.game_number}</div><div class=\"mono\">Status: ${game.status}</div></div>`;
        const lastMove = moves.length ? moves[moves.length-1] : null;
        // render board with last move highlight
        renderChessBoard(game.fen_current, async (move) => {
          try {
            const resp = await apiPostMove(game.id, move, token);
            // after successful move refresh
            await refresh();
          } catch (err) {
            alert(err.message || 'Move failed');
          }
        }, { lastMove });

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
      }

      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  if (challengeId) {
    if (tokenFromUrl) localStorage.setItem(`challenge_token_${challengeId}`, tokenFromUrl);
    const token = tokenFromUrl || localStorage.getItem(`challenge_token_${challengeId}`);
    loadMatch(challengeId, token);
  }
})();

