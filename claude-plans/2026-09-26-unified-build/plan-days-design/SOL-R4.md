# Sol (Codex gpt-6-sol, high) on the combined head c52bff1 — 2026-09-27, 11:56 AM PT

A review of where plan-days and v104's content (live/v103) meet, plus the fixes for Sol's final findings and the two main fixes (run `cx-20260927-115635-84479-72d42b`, about 4 minutes). The unit suite on the default pin: 1351 passed, the unstamped SW test the only red.

**The lead's check before passing it on:**

1. **The BLOCKER is the stamp.** It's the expected red: the coordinator stamps festival-nav-v105 at release.
2. **The IMPORTANT is real but was on main before this merge, and it isn't a v105 blocker.**
   a. `pastMayMove()` refuses the resume check while a hold is on: the Share's `data-sharing`, a sheet, a zoom, a fold in flight, and now v103's `pendingThin`. Nothing retries when the hold clears. The next chance is the next resume, a NOW tap (5+ minutes after the last check), or the 5 AM day turn.
   b. main 250bc45 (v103 live) has the same guard and the same single check. Only `!pendingThin` is new, and a thin is in flight for a few hundred ms after a highlight tap, which is not a moment anyone resumes a phone in.
   c. The effect is that a set that ended while the phone was away stays unfolded until the next unlock or NOW tap. It can never light, and nothing moves under a finger. The comment above `pastMayMove` says so on purpose ("keep the wall as it is until the next chance").
   d. A deferred check that runs when the hold clears is a real improvement, but it's a new mechanism. Logged as a follow-up after v105, not built in the ship window.
3. **Nothing else.** Sol found no merge issue in the highlight's two filters (one `passesPeople`), `holdRows`, one NOW, or Despacio's drop-in line. The Earlier wrap is scoped to that row, and the night guard reads each row's night from its stop key.
4. **After this head:** ccd23ba (one NOW while a hand holds the plan: `planShowsNow` asks the drawn rows, and the tab asks again when held rows are drawn), 374c3df (main at v104 merged, clean) and 25b17f0 (plan-stop-ends lets the day rail's ResizeObserver notice by, as the other suites do).

---

**BLOCKER — release gate:** `service-worker.js:5` still says `festival-nav-v103` and carries a stale asset stamp. Friends with the existing service worker can receive cached code instead of v105. Run `node scripts/sw-stamp.mjs`, then rerun the stamp test before shipping. This is the expected red gate, not a newly found merge conflict.

**IMPORTANT — missed past fold after resume:** `js/v3/app.js:1485` checks the past once when the phone becomes visible. If that happens while Share still holds `data-sharing`, or a List thin is pending, `pastMayMove()` refuses the check. Releasing either hold does not retry it; later minute ticks only recheck at a festival-day change. On Portola Sunday, sets that ended while the phone was away can remain unfolded for the rest of the day. Record a deferred check and run it when the hold clears, once the page is visible and idle.

**NIT:** None.

I found no other merge issue in the filter, held-row, one-NOW, or Despacio paths. Despacio’s Sunday 3:30–10:30 PM window remains a drop-in line when the selected group meets its threshold; the List and plan use the same pick predicate. The Earlier wrap is scoped to that row, and the strengthened night test checks a row’s night against its stop key, including day boundaries.

`npm test`: **1,351 passed, 1 failed** (the stamp above), 1 skipped, 1 todo. I did not run browser suites or modify tracked files; visual centering remains for the concurrent walker to confirm.

