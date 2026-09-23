# Crew join build — recognize you, bring your picks, the Spotify progress bug

**2026-09-23 · running log · branch `worktree-agent-a0eac819f12e52976`**

Kevin's call today: one person with two crew links for the same festival stays
two separate crews ("keep crews isolated but support multiple for one fest").
A merged wall is a later arc. This build is the three small things that make
two crews at one fest feel less like starting over:

1. **Recognize you.** A crew link you are not yet "me" in on this device
   skips the join screen when the crew doc already carries this device's
   person id (`people.<Name>.pid`) on exactly one active member.
2. **Bring your picks.** Entering a crew for a festival offers, once, to copy
   your own picks over from another crew at the same festival.
3. **The Spotify progress bug.** A drill that re-renders mid-scan sat at
   "Reading your library…" with an empty bar until the scan finished.

## Plan (as started)

- Pure logic first, tested in isolation: `recognizedMember` in `js/crew.js`
  (identity), the bring-picks planner + copy in a new `js/v3/crew-entry.js`.
- App glue kept to the crew-entry path in `js/v3/app.js` (boot's join
  branch, `enterApp`) — another builder is changing the wall's heads, the
  fold code and v3.css in parallel.
- Spotify: route progress to whichever drill card is mounted, replay the
  latest snapshot on mount, indeterminate bar before the first number.
- Not run here on purpose: `scripts/sw-stamp.mjs` (the orchestrator stamps
  once, on a clean tree, after both branches merge), any push.

## Log

- 2026-09-23 — read NOW, CLAUDE.md, the fests × circles × you direction,
  crew.js / state.js / sync.js, app.js boot + join + enterApp, settings.js
  Spotify drill, the shell rig and the closest tests.
- Pure first (`tests/crew-entry.test.mjs`, 16): `recognizedMember` in
  crew.js; planner, copy and once-memory in `js/v3/crew-entry.js`.
- Shell (`tests/crew-join-recognize.test.mjs`, 8, red before the glue):
  boot's join branch recognizes; `enterApp` welcomes ("Welcome back,
  Kevin." + a "Not me" door) and offers; a Settings festival switch offers
  too. crew-entry.js added to APP_CORE.
- Spotify (`tests/spotify-scan-progress.test.mjs`, 4, red before the fix):
  progress goes to the mounted card, replays on mount, bar breathes before
  the first page. Found alongside: a failed scan restarted itself forever
  (offline = a hot loop) — now a "Try again" card.
- Real Chromium walk (390×844, touch, reduced motion on/off, /api mocked
  in-page, NO production writes): the day-of open lands the wall on
  Saturday, which is why the offer is a card above the dock and not a
  toolbar strip. Fixes from the walk: "Not me" wrapped to two lines (toast
  action now nowrap); the done state now fades → shrinks → answer rises;
  the Spotify waiting words moved into the finds slot so nothing jumps.
- Not done here, on purpose: `scripts/sw-stamp.mjs` (the stamp test is the
  one expected red until integration), any push.

## Decisions worth a second look

- A pick you CLEARED here (a 0 tombstone) counts as decided — bring-over
  never writes onto it. Conservative reading of "never overwrite".
- The offer counts as answered only on a tap; ignoring it asks again on the
  next entry.
- The "fullest" other crew = most of your live picks there, among crews
  with anything left to bring.
- Toasts shrink to half the viewport (`left: 50%` with no width), so
  "Welcome back, Kevin." wraps on a phone. Left alone — a global toast
  width change belongs to its own pass.
- A possible follow-up: the + Add picker could carry a person's pid from
  another crew, so their device is recognized the first time they open
  the new crew's link. Not built — it writes a pid someone else asserted.

# Round 2 — the lie-fi cold open, and the share-copy trims (2026-09-23)

Brief: on a network that HANGS (Pier 80, 40k phones), a cold open showed the
loader for up to ~16 s with everything it needed already on the phone —
navigation 4 s (worker budget), then catalog 4 s ‖ crew doc 8 s ‖ customs 8 s,
then the festival file 4 s. Goal: with a cached crew doc + a claimed name (+
the catalog and festival file in the worker's caches) the wall paints from
cache at once, and the network lands the ordinary way. Keep: the crew-gone path
(JSON 404 only), boot's generation guards, the bad-link paths, the first-ever
open waiting on the network, festival-JSON freshness. "Stay offline" becomes
the field escape hatch. Then the option-a copy trims from the notes audit
(A5, A14, A19, A18, A11, A10).

## Plan

- Tests first: jsdom boots with a network that never answers (warm paints
  fast; a later doc applies; a later JSON 404 is crew-gone; no cache still
  waits; Stay offline asks the network nothing it can skip).
- `js/festivals.js`: read index.json and a festival file straight from the
  worker's caches (DATA_CACHE first), never throwing.
- `js/v3/app.js` boot: a warm branch after the token is known; `enterApp`
  gets `warm` (festival cache-first, migration not awaited); a small
  `freshenWarmOpen` lands the catalog, customs and a fresh festival file
  through the same repaint a remote change takes.
- Worker: a shorter navigation budget when a shell is cached (decide
  against the new-build reload glue first).

## Log (round 2)
- Warm open built test-first (`tests/warm-open*.test.mjs`, 4 files, shared
  `tests/helpers/warm-rig.mjs`; the warm ones red before, the cold one an
  invariant). Commit 7371230.
- Codex found two bring-your-picks bugs on the merged branch; both
  reproduced red (unit + `tests/bring-picks-guards.test.mjs`) and fixed in
  03bbd80: ownership is affirmative on both sides (pid, or the record's own
  mirror names exactly that name; another member carrying the pid = not me;
  no person record = no offer), and the tap only brings from the crew the
  card named (`bringFromSource`), else "Nothing new to bring". A picker
  switch or rename withdraws the offer. A first join re-asks once the
  identity stamp lands.
- Worker: navigations give up at 1.5 s when a shell is cached; data keeps
  4 s (145c3e1). Reasoned against the new-build glue: the browser's worker
  update check and index.html's `reg.update()` never pass through the fetch
  handler, so a new build still installs and reloads when quiet.
- Real Chromium, worker installed, then EVERY request hangs, reload,
  time to the wall: base 724fbc0 = 16,085 ms; this branch = 1,572 ms and
  1,573 ms (≈ the navigation budget + ~70 ms). Online first paint unchanged
  (~90–450 ms, machine load 60–95).
- Copy (d462742): A5, A14, A19, A18, A11, A10 at option a; A17 and the P3
  items untouched ("invite link" still appears in the Forget-this-crew row
  and its toast — A15/A16, P3). No test pinned the old strings;
  `tests/share-copy.test.mjs` pins the new vocabulary and the
  one-sentence rule. Landing and Settings → Crew looked at on a 390 px
  Chromium viewport.
- Housekeeping: one tagged stash entry, navbudget-check-a0eac819, holds the
  worker edit that is already committed in 145c3e1. The repo's
  destructive-op hook blocks removing stash entries from an agent; it is
  safe to remove by hand.
- Not verified: a real iPhone / WebKit lie-fi open; the new-build reload
  under a real worker update with the shorter navigation budget (reasoned,
  not exercised); Stay offline and the data-push swap in a real browser
  (jsdom only).

# Round 3 — the Codex review of the warm open (2026-09-23)

Merged `integrate/prefest-0923` @ 3d95ebb first (a fast-forward: nothing
resolved by hand). Baseline there: 694 tests, 693 pass, 1 skipped, stamp v86
green.

Seven repro tests (2dd7e04) were red for all five findings before any fix:
`tests/warm-open-catalog-added`, `-catalog-dropped`, `-switch`, `-custom`,
`-gone-elsewhere`, `-stay-offline-toggle`, and a new case in
`-stay-offline`.

- 5a, sync half (14cf493): a poll/push landing after Stay offline was
  switched on keeps the dot offline and schedules nothing.
- 1–5 (2c1f940, 0ce611d): the warm open is provisional —
  `activateCrew(..., { provisional })` writes no saved choice and the "not
  in the lineup" toast waits; `state.festivalChoiceFor` (the one rule, now
  shared with activateCrew) is re-run by `settleFestivalChoice` once the
  live catalog lands, with the SAME invite hint, then
  `confirmFestivalChoice` does what an ordinary open does. Fresh festival
  files are kept whichever festival is showing (days forgotten per fid);
  changed customs repaint; a late JSON 404 for a crew you left forgets it
  without leaving the crew on screen; Stay offline is read at every step
  and switching it off runs the skipped refresh.
- One call to flag: with a dropped saved festival and a doc invite hint,
  the warm open now confirms the hint as saved once the live catalog agrees
  — exactly the long-standing cold-open rule. My first test expected the
  saved id to survive; it was wrong about the cold path, and was corrected.
- Suite: 709 tests, 707 pass, 1 skipped, 1 fail = the stamp (cached files
  touched: js/state.js, js/sync.js, js/v3/app.js) — needs a `--keep`
  re-stamp.
- Lie-fi first paint re-measured (real Chromium, worker installed, every
  request hanging): 1,545 ms and 1,663 ms (was 1,572 / 1,573 before this
  round; 16,085 on the old base).

# Round 4 — the strict warm open (2026-09-23)

Codex round 3 closed #2, #3, #4; #1 and #5 stayed open, with two new bugs
(a note re-aimed into another festival by the automatic correction; a shared
festival file updated without repainting the crew that shows it). All four
lived in the provisional-festival reconciliation. The coordinator's call, the
day before the festival: make the warm open STRICT — paint only the exact
wall the person left, otherwise the cold path, and never switch afterwards.

- Red first (67909ff): `warm-open-strict-catalog` (renamed from
  `-catalog-added`), `-strict-stay-offline`, `-strict-file`,
  `-strict-custom`, `-shared-file`, and `-catalog-dropped` rewritten (stays
  on screen; a half-typed note saves where it was typed). 7 red on the
  round-3 code.
- Built (32d97f1, a9d8737): `canOpenWarm` — claimed name, cached doc, a SAVED
  festival listed in the cached catalog (a crew's own: in local customs),
  its file in hand.
  - Deleted: activateCrew's provisional mode, festivalChoiceFor,
    showFestivalChoice, confirmFestivalChoice (state.js back to pre-round-3
    but for `forgetComputedDays(fid)`); settleFestivalChoice, the warmOpen
    record, sayFestivalMissing and the deferred toast; enterApp's
    cache-first festival load.
  - Kept: freshenFromNetwork (only refreshes what is on screen: the file, the
    catalog for later switches, the customs), refreshFestivalFile (now
    repaints whichever wall SHOWS that fid — new B), applyFreshCustoms (#3),
    the crew-gone guard (#4), sync's Stay-offline status (#5a), the
    toggle-off refresh (#5b), the nav budget.
  - Stay offline: boot starts the catalog request lazily (not at all on a
    warm open under it); every warm-path request reads the setting as it
    would fire; the warm migration kick is skipped under it.
- Suite: 716 tests, 714 pass, 1 skipped, 1 fail = the stamp (app.js and
  state.js touched again) — needs the `--keep` re-stamp.
- Lie-fi first paint (real Chromium, same crew, same festival, all cached,
  every request hanging): 1,556 ms and 1,577 ms.
- Known and unchanged from main: the 25 s loop retries a legacy migration
  whenever the network is up, Stay offline or not; stampIdentity's
  fire-and-forget /api/person calls. Neither is a warm-path step.
