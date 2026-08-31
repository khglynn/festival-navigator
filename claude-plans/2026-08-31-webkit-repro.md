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

resumed 2026-08-31 13:03:48 CDT — writing the script
- 18:56:44Z SCRIPT RUN (in-band, backgrounded shell) — webkit launching
- 18:56:51Z console.error: Failed to load resource: the server responded with a status of 404 ()
- 18:56:51Z console.error: Refused to execute https://festival-navigator-larsqy7ws-kevinhg.vercel.app/_vercel/insights/script.js as script because "X-Content-Type-Options: nosniff" was given and its Content-Type is not a script MIME type.
- 18:56:56Z joined as Ava
- 18:56:59Z wall up; cards=110; SW=festival-nav-v66,festival-nav-data-v1
- 18:57:00Z a1 hover grid: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:01Z a2 click1: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:01Z a3 click2: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:02Z a4 away: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:03Z b1 hover afters GA: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:03Z b2 notes chip clicked
- 18:57:05Z b3 note submitted
- 18:57:07Z b4 sheet closed: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:07Z c r0 Gelli Haha: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:08Z c r0 Oskar Med K: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:09Z c r0 Fcukers: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:10Z c r0 Tricky: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:11Z c r0 Nimino: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:12Z c r0 Sam Alfred: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:13Z c r0 Felly Fell: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:13Z c r0 Six Sex: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:14Z c r1 Gelli Haha: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:14Z c r1 Oskar Med K: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:15Z c r1 Fcukers: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:15Z c r1 Tricky: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:15Z c r1 Nimino: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:15Z c r1 Sam Alfred: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:16Z c r1 Felly Fell: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:16Z c r1 Six Sex: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:17Z c r2 Gelli Haha: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:18Z c r2 Oskar Med K: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:19Z c r2 Fcukers: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:20Z c r2 Tricky: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:20Z c r2 Nimino: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:21Z c r2 Sam Alfred: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:22Z c r2 Felly Fell: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:23Z c r2 Six Sex: slots=1 shown=1 unplaced=0 zoomSources=1
- 18:57:24Z c r3 Gelli Haha: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:24Z c r3 Oskar Med K: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:24Z c r3 Fcukers: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:24Z c r3 Tricky: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:25Z c r3 Nimino: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:25Z c r3 Sam Alfred: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:25Z c r3 Felly Fell: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:25Z c r3 Six Sex: slots=0 shown=0 unplaced=0 zoomSources=0
- 18:57:31Z cleanup pick: Airwolf Paradise — not picked
- 18:57:34Z cleanup note: delete armed+confirmed
- 18:57:35Z cleanup note visible after delete: false
- 18:57:35Z DONE — total pageerrors: 0
