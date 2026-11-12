(() => {
  const section = document.getElementById("certifications");
  if (!section) return;
  const track = section.querySelector(".cert-track");
  const cards = [...track.querySelectorAll("[data-certificate]")];
  const prev = section.querySelector("[data-cert-prev]");
  const next = section.querySelector("[data-cert-next]");
  const dots = section.querySelector(".cert-dots");
  const status = section.querySelector(".cert-status");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const limit = () => Math.max(0, track.scrollWidth - track.clientWidth);
  const scroll = (left) =>
    track.scrollTo({ left, behavior: motion.matches ? "instant" : "smooth" });
  let pages = [];
  let frame = 0;
  function update() {
    frame = 0;
    const viewport = track.getBoundingClientRect();
    const visible = cards
      .map((card, index) => {
        const rect = card.getBoundingClientRect();
        return Math.min(rect.right, viewport.right) -
          Math.max(rect.left, viewport.left) >
          rect.width / 2
          ? index + 1
          : null;
      })
      .filter(Boolean);
    const pad = (n) => String(n).padStart(2, "0");
    if (visible.length)
      status.textContent = `${pad(visible[0])}${visible.length > 1 ? "–" + pad(visible.at(-1)) : ""} / ${pad(cards.length)}`;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= limit() - 2;
    const active = pages.reduce(
      (best, point, index) =>
        Math.abs(point - track.scrollLeft) <
        Math.abs(pages[best] - track.scrollLeft)
          ? index
          : best,
      0,
    );
    [...dots.children].forEach((dot, i) =>
      dot.setAttribute("aria-current", String(i === active)),
    );
  }
  function resize() {
    pages = [0];
    const max = limit();
    for (
      let point = track.clientWidth;
      point < max - 2;
      point += track.clientWidth
    )
      pages.push(point);
    if (max > 2) pages.push(max);
    dots.replaceChildren(
      ...pages.map((point, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute(
          "aria-label",
          `Certificate page ${index + 1} of ${pages.length}`,
        );
        button.setAttribute("aria-controls", "cert-track");
        button.append(document.createElement("span"));
        button.addEventListener("click", () => scroll(point));
        return button;
      }),
    );
    update();
  }
  prev.addEventListener("click", () =>
    scroll(Math.max(0, track.scrollLeft - track.clientWidth)),
  );
  next.addEventListener("click", () =>
    scroll(Math.min(limit(), track.scrollLeft + track.clientWidth)),
  );
  track.addEventListener("keydown", (event) => {
    if (event.target !== track) return;
    const actions = {
      ArrowLeft: () => prev.click(),
      ArrowRight: () => next.click(),
      Home: () => scroll(0),
      End: () => scroll(limit()),
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  });
  track.addEventListener(
    "scroll",
    () => {
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true },
  );
  new ResizeObserver(resize).observe(track);
  section.querySelector(".cert-controls").hidden = false;
  dots.hidden = false;
  resize();

  const dialog = document.getElementById("certificate-lightbox");
  if (typeof dialog?.showModal !== "function") return;
  const image = dialog.querySelector("#certificate-image");
  const viewport = dialog.querySelector(".cert-lightbox-image");
  const zoom = dialog.querySelector("[data-cert-zoom]");
  let selected = 0;
  let opener = null;
  function resetZoom() {
    viewport.classList.remove("is-zoomed");
    zoom.setAttribute("aria-pressed", "false");
    zoom.textContent = "Zoom in";
  }
  function display(index) {
    selected = index;
    const { title, issuer, date, image: src, pdf } = cards[index].dataset;
    dialog.querySelector("#certificate-title").textContent = title;
    dialog.querySelector("#certificate-meta").textContent =
      `${issuer} · ${date}`;
    image.src = src;
    image.alt = `${title} — original certificate issued to Daniel Ramon Jeremy Avalos Esquivel`;
    dialog.querySelector("#certificate-pdf").href = pdf;
    dialog.querySelector("[data-cert-modal-prev]").disabled = index === 0;
    dialog.querySelector("[data-cert-modal-next]").disabled =
      index === cards.length - 1;
    resetZoom();
  }
  cards.forEach((card, index) =>
    card.querySelectorAll("[data-cert-open]").forEach((link) =>
      link.addEventListener("click", (event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        opener = link;
        display(index);
        dialog.showModal();
        document.documentElement.classList.add("certificate-is-open");
      }),
    ),
  );
  dialog
    .querySelector(".cert-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("certificate-is-open");
    resetZoom();
    opener?.focus({ preventScroll: true });
  });
  dialog
    .querySelector("[data-cert-modal-prev]")
    .addEventListener("click", () => display(Math.max(0, selected - 1)));
  dialog
    .querySelector("[data-cert-modal-next]")
    .addEventListener("click", () =>
      display(Math.min(cards.length - 1, selected + 1)),
    );
  zoom.addEventListener("click", () => {
    const enlarged = viewport.classList.toggle("is-zoomed");
    zoom.setAttribute("aria-pressed", String(enlarged));
    zoom.textContent = enlarged ? "Fit to screen" : "Zoom in";
    if (enlarged) viewport.focus();
  });
})();
