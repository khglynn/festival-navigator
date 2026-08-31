# WebKit repro — zoom-strand bug (2026-08-31)

started 2026-08-31 12:06:17 CDT

## Task
Reproduce a Safari-only bug where, after opening a card's notes and adding a
note, subsequent zooms strand: (a) a resting card's content goes invisible
(`.card.zoom-source > * { opacity: 0 }` left behind, no overlay), and (b) a
full-viewport-width flat bar with the grown card's text stuck at the TOP of
the viewport (matches a `.zoom-slot` that entered the DOM but never got
`place()`d or `.shown`). Suspect: uncaught exception mid-`zoomCard` in
js/v3/card-facts.js. Artist involved: "Groove Armada" (Saturday grid cell +
Afters list card).

## Findings log
(appending as I go)

- 12:06 CDT — `npm ls playwright` in repo: not installed (empty). Playwright not present as a repo dep.
- Scratch dir created at `/tmp/webkit-repro-2026-08-31` (npm init + `npm i -D playwright`), NOT in repo, per rules.
- `npx playwright install webkit` succeeded: WebKit 26.5 (playwright webkit v2336) downloaded to `~/Library/Caches/ms-playwright/webkit-2336`. One attempt, no retry needed.
- Next: write standalone node script using `const { webkit } = require('playwright')`, drive the deployed share-link build at 596x800 mouse viewport, run scenario steps a/b/c from the brief.
