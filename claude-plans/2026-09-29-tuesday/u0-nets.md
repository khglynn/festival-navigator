# U0 nets — three small safety nets (2026-09-29, Tue)

Branch `fix/u0-nets`, off main 1c97b25 (production v105). From the LEDGER's
"Follow-ups found tonight" (claude-plans/2026-09-25-portola-live/LEDGER.md):

- (a) item 2 — error reports name no build when no service worker controls the page
- (b) item 3 — "Zoom closed right after a click: notes sheet opened" reported as a warning
- (c) item 13 — an offline add "drew" while the crew has "Drew" blocks sync

## Log

### (a) the page names its own build — done (178864d)
- Cause: errlog.js asked the controlling worker; with none it guessed from
  cache names, and a first open (or any page no worker controls) has none →
  `build: null, sw: "none"` on every report that night.
- Fix: index.html carries `<meta name="fn-build" content="v105">`; errlog.js
  `metaBuild()` reads it (only `^v\d{1,6}$` is ever sent) before the cache
  guess, both when no worker controls the page and when a worker never answers.
  The worker's own answer still wins when it comes. `sw` still says which.
- The meta is written by `scripts/sw-stamp.mjs` beside CACHE_VERSION, BEFORE
  hashing (index.html is in APP_CORE). `--check` is red when they disagree.
  The script's body moved into an exported `stamp(root, argv)` so it can be
  tested against a temp checkout; the CLI is a wrapper (same messages/codes).
- Tests: errlog-queue (3 new; 2 red on old code: null and 'v99'), sw-stamp
  (3 new; red on old script), incl. "the repo's index.html names the build its
  worker caches" — so the coordinator's stamp at release must bump both (it does).
- NOT stamped (coordinator's job). The stamp test is red on this branch as expected.

### (b) "Zoom closed right after a click: notes sheet opened" — already quiet since v92; now pinned
- Finding: app.js onOpenNotes has passed `meant: true` since 99a8aa2 (v92,
  merged 01:26 Sep 26); the LEDGER item was written 02:17 Sep 26 from reports
  that carried `build: null` — so they were most likely older shells (v88–v91)
  and nobody could tell. (a) is what makes that answerable next time.
- Gap: no test would catch a regression — zoom-door-row's note-door test uses
  `.click()` (no mousedown, so the after-a-press check never arms) and the
  WebKit chip test only filtered "focus left".
- Added: zoom-door-row "a mouse press on the note door … reports nothing"
  (real down/up/click sequence) and the WebKit chip test now asserts no
  `zoom-close-after-click` at all. Both red with `meant: true` removed
  (actual ['notes sheet opened']), green on main.
- Not done on purpose: a send-time filter for queued old-build reports — they
  expire in a week and old shells update on next open; permanent code for a
  one-week trickle isn't worth it.
