# Portfolio 2.0 — local review plan

Review branch: `review/portfolio-v2`. No publishing, push, production database access or original-project modifications authorized. Existing untracked audits predate this task and remain untouched.

## Diagnosis
The current static HTML/CSS/JS portfolio has a strong dark cyberdeck identity and authentic personal photographs. Its seven-item horizontal carousel starts with experimental bots, uses generated illustrations, omits two commercial websites and Local Studio, and places extensive technical studies inside the homepage. Some stack labels conflate a mobile product with a separate web landing. This hides the strongest evidence and makes the visitor work to understand the offer. Preserve Cybernetic Liquid, contact links, returning visitor dialog and all analytics scripts.

## References reviewed
- https://brittanychiang.com/ — explicit role, short project summaries, accessible navigation and supporting evidence. Adopt clear hierarchy and a skip link; do not reproduce her layout.
- https://rauno.me/ — restrained introduction and craft-centered presentation. Adopt careful spacing and focused interaction; no animation-heavy imitation.
- https://leerob.com/ — direct biography and progressively accessible detail. Adopt concise language and separate project detail pages.
- https://www.jeremyavalos.xyz/ — browser capture attempted alongside commercial sites; browser result recorded in review evidence. Text-fetch service could not access it. Local implementation is the reliable source for analytics preservation.
These are qualitative reference observations, not measured comparative performance claims.

## Verified inventory (read-only source inspection)
All paths are under `/home/jeremex/Desktop/PROJETCS/`.

| Project | Category | Verified implementation | Material / scope |
| --- | --- | --- | --- |
| Yatchslifemaster | Client Work (user attribution) | Next.js, React, TypeScript, Express, PostgreSQL; `app/page.tsx`, `app/yates`, `server/`; responsive fleet and reservation-request journey | Capture published domain on desktop/mobile. Distinct from YATCHKCLUB; no mobile app claim. Local revision may differ from published site. |
| tuagenteseguro.mx | Client Work (user attribution) | Next.js, React, TypeScript, Tailwind; service pages, contextual WhatsApp and advisor presentation; server-side lead integration in source | Capture provided Vercel URL. Do not claim production lead delivery; README says integration requires configuration. |
| localstudio | Own Brand, within Own Products | React, TypeScript, Vite, Express; bilingual studio, six explicitly sample-data demos and quote flow | Capture published domain. Do not present demo businesses as real clients. |
| metanoia | Own Product | Expo, React Native, TypeScript app; separate static `web/` landing, legal resources and support | Capture published landing. Do not label website screenshot as native app; no connected auth/payments/documents claims. |
| minigbot | Engineering Labs | TypeScript, Node.js, Polymarket clients, PostgreSQL; discovery, market classifier, strategy routing, probability and edge modules, execution and evaluation | Source-derived diagram; no logs/accounts, private dashboard or runtime activation. README has older PAPER scope; do not infer current operating mode or results. |
| binancebot | Engineering Labs | TypeScript, Node.js, Binance Spot, Ollama; `src/index.ts` orchestrates market, strategy, risk, execution, journals | Source-derived diagram; do not run bot or show financial data. |
| tokentrader | Engineering Labs | Python, asyncio, Web3.py, SQLite; scanner, analysis pipeline, scoring, outcomes; `main.py` explicitly observation only | Source-derived diagram; no transaction signing or trade claims. |

## Structure and presentation
1. Hero: full-stack developer, web/mobile/API/automation offer; immediate work and contact actions, portrait and restrained terminal detail.
2. Selected work: four image-first editorial cards, in order Yachts Life Master, Tu Agente Seguro, Local Studio, Metanoia. One short description, category and max four technologies each. Native links to individual static case-study pages.
3. Engineering Labs: three compact visual cards using original SVG architecture diagrams derived from source. Separate detailed pages, technical notes behind native details.
4. Capabilities, personal background and contact retain existing anchors and verified content.
5. Each case study: problem, contribution, real desktop/mobile captures for web work, plain-language features, verified stack, state and published website link. Advanced decisions secondary. Lab pages link only to public portfolio/profile, not assumed-public private repositories.

## Assets and privacy
Published sites captured read-only, without submitting forms or opening admin screens. WebP derivatives for cards/case studies retain screenshot content; original captures kept in ignored local review evidence. Diagrams summarize modules and contain no source code, private paths, credentials or metrics. No generated images. No `.env`, logs, databases or customer records read.

## Technical risks and validation
- Keep backend/, API settings, fingerprint, returning-visitor copy and tracking script byte-identical. Browser QA intercepts portfolio analytics requests to avoid production writes.
- No new runtime dependencies, bundler or backend migration. Static HTML case pages work without JavaScript; preserve analytics integration using existing scripts and hooks.
- Responsive desktop/mobile checks, overflow, keyboard navigation, menu, project links, image loading, direct study access, reduced motion and frontend syntax. Run existing backend regression suite without starting backend or loading environment files.
- Measure local browser performance only as diagnostic; cannot certify field Core Web Vitals.
- `review/` and internal reports must not become deployable public files. Maintain explicit publication exclusion; no deployment in this task.
- Screenshots are evidence of a specific capture, not proof all remote backend functions are operational.

## Implementation and review outcome
- Published frontend captures succeeded for all four featured projects and the original portfolio (HTTP 200).
- Implemented four editorial cards, a separate three-project Engineering Labs collection and seven standalone HTML case studies. Each web study has real desktop and mobile-browser screenshots; diagrams are original vectors based on verified source modules.
- Retained the static architecture and all existing runtime dependencies. No image-generation tools used.
- `.vercelignore` excludes internal reports/review evidence, backend/tests and superseded generated illustrations from future frontend artifacts.
- Browser QA: 32 page/viewport combinations passed (8 documents × 320, 390, 768, 1440 px), plus navigation, keyboard, native details, reduced motion and no-JavaScript checks. Captures reviewed visually and spacing/type refined.
- Existing `npm test --prefix backend` passed. `git diff --exit-code` confirms backend, tracking script, fingerprint, returning-visitor copy, Cybernetic Liquid, old case helper and shared stylesheet remain unchanged.
- Local preview deliberately stubs analytics on loopback, without editing the production API configuration in source. No production telemetry, customer forms or bot execution used for QA.
- Runtime field Core Web Vitals, authenticated production dashboard access and remote integrations were not tested. No public-repository status was assumed for private lab code.
