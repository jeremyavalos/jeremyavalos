# Portfolio V2 — layout revision

Local branch: `review/portfolio-v2`. No production deployment was performed.

## Final homepage sequence

1. Hero
2. Engineering Labs
3. Selected Work — “Built for the real world”
4. Capabilities — “Across the stack”
5. Certifications & Achievements
6. Contact

The About section and its navigation item were removed. The project content and
order inside Engineering Labs and Selected Work remain unchanged.

Contact links now appear in this order: Email, GitHub, Instagram, LinkedIn,
Threads and Credly. The public Threads URL was checked and returned HTTP 200.

## Engineering Labs visuals

Three new WebP covers were generated with the built-in Imagegen workflow and
saved under `assets/projects/`:

- `polymarket-flow.webp`
- `binancebot-flow.webp`
- `tokentrader-flow.webp`

The prompts requested restrained editorial system flows with no text, neon,
fake terminal UI, financial results, crypto logos, robots or AI clichés. Each
visual is an interpretive explanation of the inspected system architecture, not
a runtime screenshot. The case-study captions say this explicitly.

## Validation

- 32 page/viewport checks passed at 320, 390, 768 and 1440 pixels.
- Section order, removal of About, contact-link order and the three new image
  paths are asserted by the browser regression.
- Keyboard navigation, mobile menu, images, direct project navigation,
  `prefers-reduced-motion` and no-JavaScript links passed.
- Certifications passed four viewport sizes, 16 lightbox openings, mouse,
  keyboard, touch, zoom, focus return and unchanged-PDF checks.
- No console errors or horizontal page overflow were found.

Review captures are retained locally as `review/engineering-labs-1440.png`,
`review/engineering-labs-390.png`, `review/portfolio-desktop.png` and
`review/portfolio-mobile.png`. Review images remain excluded from deployment.
