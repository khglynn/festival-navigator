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
