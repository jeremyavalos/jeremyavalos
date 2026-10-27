const year = document.querySelector("#year");
if (year) {
  year.textContent = new Date().getFullYear();
}

// Random first-party browser installation ID for private analytics association.
// It contains no user attributes and is never derived from device or network data.
function getOrCreateVisitorId() {
  try {
    const existing = document.cookie.split('; ').find(part => part.startsWith('visitor_id='))?.split('=')[1];
    const decoded = existing ? decodeURIComponent(existing) : '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decoded)) return decoded;
    if (typeof window.crypto?.randomUUID !== 'function') return null;
    const visitorId = window.crypto.randomUUID();
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `visitor_id=${encodeURIComponent(visitorId)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    return visitorId;
  } catch (e) {
    return null;
  }
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

// Privacy-friendly analytics ping (non-blocking)
try {
  (function sendAnalytics(){
    try {
      const API = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';
      const visitor_id = getOrCreateVisitorId();
      const params = new URLSearchParams(location.search);
      const tracking = {};
      ['ref','utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(key => { if (params.has(key)) tracking[key] = params.get(key); });
      const fingerprint = window.getFingerprint?.() || null;
      const sendEvent = payload => fetch(`${API}/api/analytics/track`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ referrer:document.referrer||null, visitor_id, fingerprint, ...payload }) });
      sendEvent({ event_type:'page_view', path:location.pathname, ...tracking })
        .then(response => response.ok ? response.json() : null)
        .then(result => { if (result?.returning_visitor) window.dispatchEvent(new CustomEvent('returning-visitor-eligible', { detail: { visitor_id, context:result.returning_context } })); })
        .catch(()=>{});
      document.querySelector('#contact a')?.addEventListener('click',()=>sendEvent({event_type:'contact_opened',path:`${location.pathname}#contact`}).catch(()=>{}),{once:true});
      if ('IntersectionObserver' in window) {
        const seen=new Set(); const dwellTimers=new Map();
        const targets=[['HOME',document.querySelector('main#home > .hero')],['CAPABILITIES',document.getElementById('capabilities')],['WORK',document.getElementById('work')],['ABOUT',document.getElementById('about')],['CONTACT',document.getElementById('contact')]].filter(([,node])=>node);
        const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
          const name=entry.target.dataset.analyticsSection;
          if(entry.isIntersecting&&entry.intersectionRatio>=0.55&&!seen.has(name)&&!dwellTimers.has(name)){
            dwellTimers.set(name,setTimeout(()=>{
              dwellTimers.delete(name);if(seen.has(name))return;seen.add(name);
              sendEvent({event_type:'section_view',section_name:name,path:`${location.pathname}#${name.toLowerCase()}`}).catch(()=>{});
            },1000));
          }else if((!entry.isIntersecting||entry.intersectionRatio<0.55)&&dwellTimers.has(name)){
            clearTimeout(dwellTimers.get(name));dwellTimers.delete(name);
          }
        }),{threshold:[0.55]});
        targets.forEach(([name,node])=>{node.dataset.analyticsSection=name;observer.observe(node);});
      }
    } catch (e) { /* ignore */ }
  })();
} catch (e) { /* ignore */ }

// Returning visitor prompt. Eligibility comes from prior first-party page-view activity.
(function initReturningVisitorPrompt() {
  const returningVisitorPopupConfig = {
    cooldownMs: 7 * 24 * 60 * 60 * 1000,
    showDelayMs: 1800,
    cooldownStorageKey: 'returningVisitorPromptDismissedAt',
  };
  const dialog = document.getElementById('returning-visitor-dialog');
  const emailForm = document.getElementById('returning-email-form');
  const emailInput = document.getElementById('returning-email');
  const status = dialog?.querySelector('.returning-email-status');
  const popupIp = document.getElementById('returning-visitor-ip');
  const popupLocation = document.getElementById('returning-visitor-location');
  const popupEmphasis = document.getElementById('returning-visitor-emphasis');
  const popupVariant = document.getElementById('returning-visitor-variant');
  const popupLocationHeadline = document.getElementById('returning-location-headline');
  const popupNetworkAside = document.getElementById('returning-network-aside');
  const popupDetails = document.getElementById('returning-details');
  let eligibleVisitorId = null;
  let emailOpened = false;
  let detailsOpened = false;

  function trackPopup(eventType) {
    const API = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';
    return fetch(`${API}/api/analytics/track`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ visitor_id:eligibleVisitorId, fingerprint:window.getFingerprint?.() || null, event_type:eventType, path:location.pathname }) }).catch(()=>{});
  }

  function onCooldown() {
    try {
      const dismissedAt = Number(localStorage.getItem(returningVisitorPopupConfig.cooldownStorageKey));
      return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < returningVisitorPopupConfig.cooldownMs;
    } catch (e) { return true; }
  }

  function activeInteraction() {
    return Boolean(document.querySelector('form:focus-within') || document.querySelector('dialog[open]') || document.getElementById('promo-modal'));
  }

  function formatVisitTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }).format(date);
  }

  function setDetail(name, value) {
    const row = popupDetails?.querySelector(`[data-detail="${name}"]`);
    if (!row) return;
    row.hidden = !value;
    if (value) row.querySelector('dd').textContent = value;
  }

  function closePrompt(trackDismissal = true) {
    try { localStorage.setItem(returningVisitorPopupConfig.cooldownStorageKey, String(Date.now())); } catch (e) { /* storage may be unavailable */ }
    if (trackDismissal) trackPopup('returning_popup_dismissed');
    if (dialog?.open) dialog.close();
  }

  window.addEventListener('returning-visitor-eligible', event => {
    eligibleVisitorId = event.detail?.visitor_id || null;
    if (!dialog || !eligibleVisitorId || onCooldown() || activeInteraction()) return;
    const context = event.detail?.context;
    if (!context?.previous_visit) return;
    const copy = window.ReturningVisitorCopy?.build(context);
    popupIp.textContent = context?.ip ? `, ${context.ip}` : '';
    popupVariant.textContent = copy?.variant || 'Looks like curiosity won.';
    popupLocationHeadline.textContent = copy?.locationHeadline || 'WELCOME BACK.';
    popupLocation.replaceChildren(copy?.locationLead || "Your connection isn't giving me much of a location this time.", document.createElement('br'), copy?.locationQualifier || 'But the important part is: you came back.');
    popupNetworkAside.textContent = copy?.networkAside || '';
    popupNetworkAside.hidden = !copy?.networkAside;
    popupEmphasis.hidden = !copy?.showEmphasis;
    document.getElementById('returning-last-seen').textContent = formatVisitTime(context.previous_visit) || 'Unavailable';
    document.getElementById('returning-current-visit').textContent = formatVisitTime(context.current_visit) || 'Current session';
    setDetail('device', context.device);
    setDetail('os', context.os);
    setDetail('browser', context.browser);
    setDetail('location', [context.city, context.region, context.country].filter(Boolean).join(', ') + (context.city || context.region || context.country ? ' · approximate' : ''));
    setDetail('ip', context.ip);
    setDetail('first-seen', formatVisitTime(context.first_seen));
    window.setTimeout(() => {
      if (!onCooldown() && !activeInteraction() && !dialog.open) {
        dialog.showModal();
        trackPopup('returning_popup_shown');
      }
    }, returningVisitorPopupConfig.showDelayMs);
  });

  dialog?.querySelector('.returning-visitor-close')?.addEventListener('click', closePrompt);
  dialog?.querySelector('[data-returning-action="explore"]')?.addEventListener('click', closePrompt);
  dialog?.querySelector('[data-returning-action="project"]')?.addEventListener('click', () => {
    trackPopup('returning_popup_start_project');
    closePrompt(false);
  });
  dialog?.querySelector('[data-returning-action="email"]')?.addEventListener('click', () => {
    emailForm.hidden = false;
    emailInput?.focus();
    if (!emailOpened) {
      emailOpened = true;
      trackPopup('returning_popup_email_opened');
    }
  });
  popupDetails?.addEventListener('toggle', () => {
    if (popupDetails.open && !detailsOpened) {
      detailsOpened = true;
      trackPopup('returning_popup_details_opened');
    }
  });
  dialog?.addEventListener('cancel', event => { event.preventDefault(); closePrompt(); });
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closePrompt();
  });
  emailForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = emailInput?.value.trim();
    if (!email || !eligibleVisitorId) return;
    const submit = emailForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = 'SENDING…';
    try {
      const API = window.API_BASE || 'REPLACE_WITH_RAILWAY_URL';
      const response = await fetch(`${API}/api/leads`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, visitor_id:eligibleVisitorId }) });
      if (!response.ok) throw new Error('lead submission failed');
      trackPopup('returning_popup_email_submitted');
      status.textContent = "Got it. I'll be in touch.";
      window.setTimeout(() => closePrompt(false), 1100);
    } catch (error) {
      status.textContent = 'SIGNAL LOST — PLEASE TRY AGAIN.';
      submit.disabled = false;
    }
  });
})();

// Native scrolling keeps the project collection usable with touch and trackpads.
(() => {
  const track = document.querySelector('#project-track');
  if (!track) return;
  const carousel = track.closest('.project-carousel');
  const cards = [...track.querySelectorAll('.project-card')];
  const prev = carousel.querySelector('[data-project-prev]');
  const next = carousel.querySelector('[data-project-next]');
  const status = carousel.querySelector('.carousel-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let frame = 0;
  const positions = () => {
    const left = track.getBoundingClientRect().left;
    const limit = track.scrollWidth - track.clientWidth;
    return cards.map(card => Math.min(limit, card.getBoundingClientRect().left - left + track.scrollLeft));
  };
  const update = () => {
    frame = 0;
    const points = positions();
    current = points.reduce((best, point, index) =>
      Math.abs(point - track.scrollLeft) < Math.abs(points[best] - track.scrollLeft) ? index : best, 0);
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    status.textContent = `${String(current + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  };
  const move = direction => {
    current = Math.max(0, Math.min(cards.length - 1, current + direction));
    track.scrollTo({ left: positions()[current], behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  };
  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') current = 0;
    if (event.key === 'End') current = cards.length - 1;
    move(event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
  });
  const scheduleUpdate = () => { if (!frame) frame = requestAnimationFrame(update); };
  track.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  carousel.querySelector('.carousel-controls').hidden = false;
  update();
})();
