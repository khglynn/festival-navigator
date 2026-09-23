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
