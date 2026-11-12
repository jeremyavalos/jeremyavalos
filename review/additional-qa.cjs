const {
  chromium,
} = require("/home/jeremex/Desktop/PROJETCS/Yatchslifemaster/node_modules/playwright");
const fs = require("fs");
const assert = require("assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const results = [];
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.route("**/*", (r) => {
      const host = new URL(r.request().url()).hostname;
      return [
        "127.0.0.1",
        "fonts.googleapis.com",
        "fonts.gstatic.com",
      ].includes(host)
        ? r.continue()
        : r.abort();
    });
    await ctx.addInitScript(() => {
      window.vitals = { cls: 0, lcp: null };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.vitals.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.vitals.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const p = await ctx.newPage();
    await p.goto("http://127.0.0.1:4180/", { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    results.push({
      width,
      ...(await p.evaluate(() => ({
        ...window.vitals,
        fcp: performance.getEntriesByName("first-contentful-paint")[0]
          ?.startTime,
        requests: performance.getEntriesByType("resource").length,
        transferredBytes: performance
          .getEntriesByType("resource")
          .reduce((n, r) => n + r.transferSize, 0),
      }))),
    });
    await p.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("returning-visitor-eligible", {
          detail: {
            visitor_id: "11111111-1111-4111-8111-111111111111",
            context: {
              previous_visit: "2026-11-10T12:00:00Z",
              current_visit: "2026-11-12T12:00:00Z",
            },
          },
        }),
      );
    });
    await p
      .locator("#returning-visitor-dialog")
      .waitFor({ state: "visible", timeout: 5000 });
    await p.locator('[data-returning-action="explore"]').click();
    assert.equal(
      await p.locator("#returning-visitor-dialog").evaluate((el) => el.open),
      false,
    );
    await ctx.close();
  }
  fs.writeFileSync(
    "review/local-metrics.json",
    JSON.stringify(
      {
        note: "Local, unthrottled Chromium diagnostics; not field Core Web Vitals or a Lighthouse score. Returning visitor dialog uses a synthetic eligibility event, never production data.",
        results,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
  console.log(
    "PASS: returning visitor prompt opens and dismisses on desktop and mobile",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
