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

### (c) an offline add "drew" while the crew has "Drew" — fixed in the sync engine
- Cause: a local-only add is keyed by this phone's spelling; the merge refuses
  two active names equal case-insensitively (the law, crew-sql.mjs, pinned by
  db-merge "two active members differing only by case"); sync.js treated the
  400 as deterministic and parked the payload → BLOCKED until a new edit.
- No server change: the server's refusal is right and stays the law. The fix
  is client-side reconciliation of PENDING edits against the server's names.
- state.js: `namesToReconcile(pending, remotePeople)` (pending person that
  would be active, server holds it active under another spelling) and
  `renamePending(pending, renames)` (drops the pending person entry — the
  server's person stands, colour/pid included — and moves picks, affinity,
  spotifyStats onto the server key; an edit already under the server key
  wins). `reconcilePendingNames` renames memory AND disk (disk written whole:
  persistPending merges with disk and would resurrect the old spelling).
- Notes are left alone on purpose: a note id embeds its author and the server
  checks the prefix, so rewriting the author would orphan replies. A note
  written offline as "drew" shows author "drew". Logged, not fixed.
- sync.js: every server doc applies through `applyServerDoc` (poll, push
  answer): reconcile first, and if the renamed name is this phone's `me`
  (offline join), `crew.setMe` follows. And after a 400 whose payload carries
  people: ONE GET, apply (reconciles), and if the pending bytes changed, push
  once more (`pushOnce(true)`); if nothing is left, status online. A refusal
  a read cannot fix (full crew) stays refused exactly as before — 1 POST,
  1 GET, then no traffic. A 400 with no people in it does no GET at all.
- Tests: offline-add-casing (todo → real; red 'blocked' on old code) and
  tests/pending-name-reconcile.test.mjs (7 cases; 6 red on old code).
- Bug caught while building: `return` inside `try` returned undefined before
  my post-finally `return 'again'` ran — the retry never fired and the shell
  test still passed (it only asserted "not blocked"). The unit test caught it
  ('syncing'); the shell test now also asserts 'online'.
