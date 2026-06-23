const year = document.querySelector("#year");
if (year) {
  year.textContent = new Date().getFullYear();
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
    rootMargin: "0px 0px -48px 0px",
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
    }, 220);
  });
});

const cards = document.querySelectorAll(
  ".service-card, .project-card, .proof-card, .contact-panel, .glass-card",
);

cards.forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    const rect = card.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    card.style.background = `
      radial-gradient(circle at ${x}% ${y}%, rgba(217, 183, 111, 0.16), transparent 13rem),
      linear-gradient(180deg, rgba(18, 18, 21, 0.84), rgba(12, 12, 14, 0.76))
    `;
  });

  card.addEventListener("pointerleave", () => {
    card.style.background = "";
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
    item.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
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

window.addEventListener(
  "pointermove",
  (event) => {
    if (prefersReducedMotion.matches) return;

    const x = `${(event.clientX / window.innerWidth) * 100}%`;
    const y = `${(event.clientY / window.innerHeight) * 100}%`;
    document.documentElement.style.setProperty("--mouse-x", x);
    document.documentElement.style.setProperty("--mouse-y", y);
  },
  { passive: true },
);
