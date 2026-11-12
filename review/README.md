# Local visual review

Branch: `review/portfolio-v2`. Nothing has been pushed or deployed.

## Preview

From the portfolio root:

```sh
python3 review/serve.py
```

Open http://127.0.0.1:4180/ . Stop with Ctrl+C when finished.

This preview serves the real static pages, but replaces the Railway API origin **in the served HTML only** with a loopback analytics stub. It does not change the production API setting on disk. The local stub returns a non-returning response and stores nothing. Admin routes, internal reports and backend files are not served. Preview all seven studies from their project links.

## Evidence

- `portfolio-desktop.png`, `portfolio-mobile.png`: full homepage, 1440 and 390 CSS-pixel widths.
- `selected-work-1440.png`, `selected-work-390.png`: focused editorial collection.
- `project-*-desktop.png`, `project-*-mobile.png`: all seven individual studies.
- `*-source.png`: unaltered source captures of the four published websites, desktop and mobile.
- `portfolio-before-*.png`: original published portfolio.
- `frontend-results.json`: responsive and interaction check results.
- `project-inventory.json`: copy and source-derived content inventory used for the proposal.

Captures were made on the local review date, November 12, 2026 (America/Cancun). They are evidence of the public frontend at capture time, not verification of live booking, contact or payment processing. The studio's sample businesses are demos. Metanoia captures are its web landing, not native app screens.

## Checks

`node review/frontend-qa.cjs` uses the existing Playwright installation in the sibling Yatchslifemaster repository and the installed Chromium binary; neither repository dependencies nor client source were changed. Run it with the local preview active. It blocks external origins other than the existing Google Fonts providers, so it cannot write production analytics. The script covers eight pages at four widths (320, 390, 768 and 1440), images, overflow, one H1, local anchors, keyboard skip navigation, mobile menu, study links, native technical details, reduced motion and navigation without JavaScript.

`npm test --prefix backend` runs the existing regression suite using local test servers, without starting the production service or running migrations. Expected negative-case CSRF diagnostics and missing DATABASE_URL notices are printed by the unchanged test setup.

`.vercelignore` excludes this directory, internal Markdown reports, backend/test sources and superseded artificial illustrations from future frontend uploads. No publication was performed.
