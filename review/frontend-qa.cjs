const {
  chromium,
} = require("/home/jeremex/Desktop/PROJETCS/Yatchslifemaster/node_modules/playwright");
const fs = require("fs");
const assert = require("assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const report = [];
  const errors = [];
  const ctx = await browser.newContext();
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (
      !["127.0.0.1", "fonts.googleapis.com", "fonts.gstatic.com"].includes(
        u.hostname,
      )
    ) {
      errors.push("Unexpected external request: " + u.origin);
      return route.abort();
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const files = [
    "index.html",
    ...fs
      .readdirSync(".")
      .filter((f) => f.startsWith("project-") && f.endsWith(".html")),
  ];
  for (const width of [1440, 390, 768, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const file of files) {
      const res = await page.goto("http://127.0.0.1:4180/" + file, {
        waitUntil: "networkidle",
      });
      assert.equal(res.status(), 200);
      await page.evaluate(async () => {
        document
          .querySelectorAll("img[loading=lazy]")
          .forEach((i) => (i.loading = "eager"));
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        broken: [...document.images]
          .filter(
            (i) => i.hasAttribute("src") && (!i.complete || !i.naturalWidth),
          )
          .map((i) => i.src),
        h1: document.querySelectorAll("h1").length,
        dead: [...document.querySelectorAll('a[href^="#"]')]
          .filter((a) => !document.getElementById(a.hash.slice(1)))
          .map((a) => a.hash),
      }));
      assert(!result.overflow, `${file} overflow at ${width}`);
      assert.equal(result.broken.length, 0, `${file} broken images`);
      assert.equal(result.h1, 1);
      assert.equal(
        result.dead.length,
        0,
        `${file} broken anchors: ${result.dead}`,
      );
      report.push({ file, width, ...result });
      if (width === 1440 || width === 390) {
        await page.screenshot({
          path: `review/${file === "index.html" ? "portfolio" : file.replace(".html", "")}-${width === 1440 ? "desktop" : "mobile"}.png`,
          fullPage: true,
        });
        if (file === "index.html") {
          await page
            .locator("#work")
            .screenshot({ path: `review/selected-work-${width}.png` });
        }
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4180/");
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await page.locator(".nav-toggle").click();
  assert.equal(
    await page.locator(".nav-toggle").getAttribute("aria-expanded"),
    "true",
  );
  await page.locator('#site-nav a[href="#work"]').click();
  assert.equal(
    await page.locator(".nav-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(await page.locator("#work .v2-card").count(), 4);
  assert.equal(await page.locator("#labs .v2-card").count(), 3);
  for (const card of await page.locator(".v2-card").all())
    assert((await card.locator(".v2-tags span").count()) <= 4);
  await page.locator("#work .v2-explore").first().click();
  await page.waitForURL("**/project-yachts-life-master.html");
  await page.locator(".v2-technical summary").focus();
  await page.keyboard.press("Enter");
  assert((await page.locator(".v2-technical").getAttribute("open")) !== null);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".v2-back")
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    "0s",
  );
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto("http://127.0.0.1:4180/");
  assert(await np.locator(".hero h1").isVisible());
  await np.locator("#work .v2-explore").first().click();
  assert(
    await np
      .locator("h1")
      .innerText()
      .then((t) => t.includes("Yachts Life Master")),
  );
  await nojs.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "review/frontend-results.json",
    JSON.stringify(
      {
        checks: report,
        interactions: [
          "skip link",
          "mobile menu",
          "project navigation",
          "native engineering details",
          "reduced motion",
          "no JavaScript navigation",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${report.length} page/viewport checks; keyboard, menu, navigation, images, reduced motion and no-JS checks`,
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
