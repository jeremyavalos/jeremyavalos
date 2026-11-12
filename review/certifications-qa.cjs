const {
  chromium,
} = require("/home/jeremex/Desktop/PROJETCS/Yatchslifemaster/node_modules/playwright");
const assert = require("assert/strict");
const fs = require("fs");
const crypto = require("crypto");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const errors = [];
  const results = [];
  const ctx = await browser.newContext();
  await ctx.route("**/*", (r) => {
    const h = new URL(r.request().url()).hostname;
    return ["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"].includes(
      h,
    )
      ? r.continue()
      : r.abort();
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  for (const width of [1440, 768, 390, 320]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.goto("http://127.0.0.1:4180/", { waitUntil: "networkidle" });
    await p.locator("#certifications").scrollIntoViewIfNeeded();
    await p.locator("#certifications img").evaluateAll(async (images) => {
      for (const i of images) i.loading = "eager";
      await Promise.all(images.map((i) => i.decode()));
    });
    assert.equal(await p.locator(".cert-card").count(), 5);
    assert.deepEqual(
      await p.locator(".cert-card").evaluateAll((cards) =>
        cards.map((card) => card.dataset.title),
      ),
      [
        "Ethical Hacker",
        "Introduction to Cybersecurity",
        "Data Analytics Essentials",
        "Python Essentials 1",
        "Python Essentials 2",
      ],
    );
    assert(
      !(await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )),
    );
    assert.equal(
      await p
        .locator(
          'a[href="https://www.credly.com/users/daniel-ramon-jeremy-avalos-esquivel"]',
        )
        .count(),
      2,
    );
    await p.locator("[data-cert-next]").click();
    await p.waitForTimeout(850);
    assert(await p.locator("#cert-track").evaluate((e) => e.scrollLeft > 0));
    await p.locator("#cert-track").focus();
    await p.keyboard.press("End");
    await p.waitForTimeout(850);
    assert(await p.locator("[data-cert-next]").isDisabled());
    await p.keyboard.press("Home");
    await p.waitForTimeout(850);
    assert(await p.locator("[data-cert-prev]").isDisabled());
    await p.locator(".cert-dots button").last().click();
    await p.waitForTimeout(850);
    assert(await p.locator("[data-cert-next]").isDisabled());
    await p.locator("#cert-track").focus();
    await p.keyboard.press("Home");
    await p.waitForTimeout(850);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(850);
    assert(await p.locator("#cert-track").evaluate((e) => e.scrollLeft > 0));
    await p.keyboard.press("ArrowLeft");
    await p.waitForTimeout(850);
    for (let i = 0; i < 5; i++) {
      const card = p.locator(".cert-card").nth(i);
      await card.locator(".cert-preview").click();
      await p.locator("#certificate-image").evaluate((i) => i.decode());
      assert(await p.locator("#certificate-lightbox").evaluate((e) => e.open));
      assert.equal(
        await p.locator("#certificate-title").innerText(),
        await card.getAttribute("data-title"),
      );
      assert.equal(
        await p.locator("#certificate-pdf").getAttribute("href"),
        await card.getAttribute("data-pdf"),
      );
      assert.equal(
        await p.locator("#certificate-pdf").getAttribute("target"),
        "_blank",
      );
      if (i === 0 && (width === 1440 || width === 390)) {
        await p
          .locator("#certificate-lightbox")
          .screenshot({ path: `review/certifications-lightbox-${width}.png` });
      }
      await p.locator("[data-cert-zoom]").click();
      assert.equal(
        await p.locator("[data-cert-zoom]").getAttribute("aria-pressed"),
        "true",
      );
      assert(
        await p
          .locator(".cert-lightbox-image")
          .evaluate((e) => e.scrollWidth > e.clientWidth),
      );
      await p.keyboard.press("Escape");
      assert(
        !(await p.locator("#certificate-lightbox").evaluate((e) => e.open)),
      );
      assert(
        await card
          .locator(".cert-preview")
          .evaluate((e) => e === document.activeElement),
      );
    }
    await p.locator(".cert-preview").first().click();
    await p.locator("[data-cert-modal-next]").click();
    assert.equal(
      await p.locator("#certificate-title").innerText(),
      "Introduction to Cybersecurity",
    );
    await p.locator("[data-cert-modal-prev]").click();
    await p.locator(".cert-close").click();
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.locator("#cert-track").focus();
    await p.keyboard.press("Home");
    await p.waitForTimeout(50);
    assert(await p.locator("[data-cert-prev]").isDisabled());
    assert.equal(
      await p
        .locator(".cert-preview img")
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    await p.emulateMedia({ reducedMotion: "no-preference" });
    if (width === 1440 || width === 390) {
      await p.locator("#certifications").screenshot({
        path: `review/certifications-${width === 1440 ? "desktop" : "mobile"}.png`,
      });
    }
    results.push({
      width,
      certificates: 5,
      overflow: false,
      keyboard: true,
      arrows: true,
      dots: true,
      lightboxes: 5,
      zoom: true,
      escapeAndFocusReturn: true,
      reducedMotion: true,
    });
  }
  const originals = [
    ["ethical-hacker", "EthicalHackerUpdate20261112-20-m8q2vx.pdf"],
    ["data-analytics", "DataAnalyticsEssentialsUpdate20261112-20-eemdd0.pdf"],
    ["cybersecurity", "I2CSUpdate20261112-20-gos81g.pdf"],
    ["python-1", "PythonEssentials1Update20261112-20-snjl8v.pdf"],
    ["python-2", "PythonEssentials2Update20261112-20-j65ri0.pdf"],
  ];
  const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
  for (const [id, source] of originals) {
    const res = await ctx.request.get(
      `http://127.0.0.1:4180/assets/certifications/${id}.pdf`,
    );
    assert.equal(res.status(), 200);
    assert(res.headers()["content-type"].includes("application/pdf"));
    assert.equal(
      hash(await res.body()),
      hash(
        fs.readFileSync("/home/jeremex/Downloads/certtificaciones/" + source),
      ),
    );
  }
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.route("**/*", (r) =>
    new URL(r.request().url()).hostname === "127.0.0.1"
      ? r.continue()
      : r.abort(),
  );
  const touch = await mobile.newPage();
  await touch.goto("http://127.0.0.1:4180/", { waitUntil: "networkidle" });
  await touch.locator("#certifications").scrollIntoViewIfNeeded();
  const rect = await touch.locator("#cert-track").boundingBox();
  const session = await mobile.newCDPSession(touch);
  const y = Math.min(rect.y + 100, 700);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 340, y }],
  });
  for (let x = 310; x >= 60; x -= 25) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
    await touch.waitForTimeout(20);
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touch.waitForTimeout(850);
  assert(await touch.locator("#cert-track").evaluate((e) => e.scrollLeft > 0));
  await touch.locator(".cert-preview").nth(1).tap();
  assert(await touch.locator("#certificate-lightbox").evaluate((e) => e.open));
  await touch.locator(".cert-close").tap();
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto("http://127.0.0.1:4180/");
  assert.equal(await np.locator(".cert-pdf").count(), 5);
  await np.locator(".cert-preview").first().click();
  assert(np.url().endsWith("ethical-hacker.webp"));
  await nojs.close();
  await mobile.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "review/certifications-results.json",
    JSON.stringify(
      {
        results,
        pdfs: "5 HTTP 200 application/pdf, SHA-256 identical to originals",
        touch: "CDP touch swipe and touchscreen lightbox tap passed",
        nojs: "images and PDFs remain native links",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: four widths, 20 lightboxes, zoom, keyboard, focus, dots, mouse, touch, reduced motion, no-JS and 5 unchanged PDFs. No console errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
