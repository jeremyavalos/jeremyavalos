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
