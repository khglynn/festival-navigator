# Sol (Codex gpt-6-sol, high) on daf9c3b — 2026-09-27, 7:54 AM PT

A targeted recheck of the round after `SOL-R1.md` (run `cx-20260927-075339-95964-f86558`, 211 s; read-only, no browser suites while the walker drove browsers).

**The lead's check before passing it on:**

1. **The BLOCKER is refuted.** Grown cards do carry `data-night`: `dayRows` pushes `grownEl` into its rows (plan-rows.js ~376), and `planDays`' `night()` tags every row it returns (`out.push(...body); rows.push(...tag(out, id))`, ~477). No other code inserts a grown card. So `nightAtTop` and the place anchor both see them.
2. **The first IMPORTANT holds but is minor.** A tap pins the shelf's height while it is open (main's rule, so the window never moves under a finger). If the later day goes while it is open (the 5 AM rollover, a highlight, an unpick), the blank room under the last row stays until the close. That is the same look the short-plan default already accepts.
3. **The second IMPORTANT holds.** Closing a plan with no row to close to calls `leave()`, and `mode` stays `open` until the exit ends. `planIsOpen()` still says open, so a tick or a friend's update in that window gets the fallback answer, and `paintPlanShelf` treats it as an arrival: `cancelLeave`, then `arrive`. The shelf comes back as a peek with no row.
4. **The NIT holds.** plan-tail's layout-crossing test sleeps 400 ms.

---

## BLOCKER

- **A grown card can make the head and Share name the next day too early.** [plan-shelf.js:312](../../../js/v3/plan-shelf.js) scans only children with `data-night`, but [grownEl in plan-rows.js:189](../../../js/v3/plan-rows.js) creates a separate child without it. If a reader scrolls into a grown Saturday card just before Sunday’s head, the scan skips the card and names Sunday; Share then sends Sunday. The place anchor uses the same scan, so a repaint preserves the wrong day. Give grown cards their parent night and a stable anchor key, or resolve them to the preceding stop in both scans. Test a repaint and Share with the list’s top edge inside that card.

## IMPORTANT

- **The full-height shelf can remain pinned after its later day disappears.** [plan-shelf.js:1147](../../../js/v3/plan-shelf.js) pins an inline height on a phone tap. A rollover removes `data-later`, but an open repaint does not clear that inline height. For example, grow a card on Saturday, leave the plan open into Sunday, and the now today-only plan can retain the full-height gap instead of becoming content-sized. Clear or recompute the pin when `data-later` changes, while preserving the window’s on-screen position.

- **A repaint can reopen the morning-after shelf while it is closing.** [plan-shelf.js:668](../../../js/v3/plan-shelf.js) leaves `mode === 'open'` until the exit animation finishes. During that interval, [app.js:1335](../../../js/v3/app.js) still treats it as open; a tick or friend update can supply the fallback answer, and `paintPlanShelf` cancels the exit. Record close intent immediately so that answer cannot revive it, and test a repaint during the close motion.

## NIT

- **The resize test still waits a fixed 400 ms.** [plan-tail.test.mjs:443](../../../tests/browser/plan-tail.test.mjs) can read before a delayed resize/refit on a loaded runner. Wait for the refitted layout condition instead.

For ordinary rows, the row-and-offset restore, missing-row fallback, and `offsetWidth` guard address the prior numeric-scroll finding. The past flag is limited to a night before the festival clock; ACL gap days and Portola’s Saturday-to-Sunday rollover still select a night ahead. The filtered rows have no fixed-position descendants in the reviewed plan markup; phone paint cost remains unmeasured because browser suites were reserved for the walker. `holdGlide` checks the app’s carry-on request on both engines, while the in-between animation is asserted only on Chromium; it cannot establish native WebKit glide behavior.

`npm test`: **1,290 passed, 1 failed** on the expected unstamped service-worker hash, 1 skipped, 1 todo. No browser suites ran and no tracked files changed.