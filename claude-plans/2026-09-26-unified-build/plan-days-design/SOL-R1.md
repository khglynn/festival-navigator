# Sol (Codex gpt-6-sol, high) on 0f076a6 — 2026-09-27, 4:17 AM PT

Run `cx-20260927-041739-486-8c14b2` (295 s). Read-only on a detached snapshot; no browser suites (the builder was running them). The lead checked the blocker and the important against the code before passing them to the builder; both hold.

## Release review of `0f076a6`

**One blocker.** I would hold the release for the scroll position issue below. I made no tracked-file changes and did not run browser suites, as requested.

### BLOCKER

- **A redraw can change the day a reader is viewing.** [plan-shelf.js:422](../../../js/v3/plan-shelf.js) replaces the list and restores its numeric `scrollTop`. If a friend’s pick or a highlight adds a row above Sunday while Sunday is at the top, Sunday moves down but the old offset remains. The head and Share then switch to the preceding day; a Share tap can send that day instead. The new `.plan-tail` fixes the earlier scroll *clamp*, but does not preserve the visible row when content above it changes. **Fix:** retain the top visible day or row and its offset through redraw and refit, then restore that anchor before painting the head. Test both row insertion and removal above a later day, including across 720px.

### IMPORTANT

- **The last night’s finished plan revives after the 5 AM rollover.** [app.js:1336](../../../js/v3/app.js) falls back to the last night when there is no current or future night. At 11:30 PM on ACL’s final Sunday, an open plan says “Nothing left today” and disables Share. Keep it open past 5 AM Monday: `at` and `peek` are null, so the fallback selects Sunday with `today: false` and `nowMin: null`. [app.js:1366](../../../js/v3/app.js) then treats every Sunday stop as shareable again and draws the whole finished day. **Fix:** keep the final night in its finished state while the plan remains open, or close the shelf at rollover. Add that crossing to the ACL golden.

### NIT

- **The ACL Share test relies on a fixed wait.** [plan-acl.test.mjs:128](../../../tests/browser/plan-acl.test.mjs) sleeps 150 ms before checking the share stub. A slow Linux run can fail without a product regression. **Fix:** wait for `window.__shared.length` to increase.

The v103 Share safeguards remain present: forced repaint, `drawn` and held guards, `holdForShare`/`dropShares` with `pagehide`, and `afterArrival` with the stint and link identity checks. The prior review’s drop-in, blip-end, menu, and Share-mark fixes read consistently with their stated rules. I found no new `--fest`, touch-floor, WebKit selection, storage-getter, or bare DOM-global violation in this diff.

`npm test`: **1,289 passed; 1 failed (the expected unstamped service worker); 1 skipped; 1 todo.** Browser behavior remains unverified in this pass because another agent is running those suites.