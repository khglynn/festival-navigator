# BACKLOG — festival-navigator

**last-updated: 2026-10-19.** The off-season list: real fixes, test debts,
product ideas and the slower calls for Kevin. One line each, with where it
came from. "LEDGER n" is follow-up n in
`claude-plans/2026-09-25-portola-live/LEDGER.md`, which has the full
evidence. The questions Kevin can answer now are in `NOW.md` ("Open with
Kevin"), not here. When something ships, delete its line and say so in
DEVLOG.

## Real fixes, biggest first

1. A phone that boots stale cached modules beside new ones recovers with
   one reload, never a cache purge, so a bad cache loops to the panel
   (LEDGER 17; audit ledger-4).
2. The offline "drew"/"Drew" add still leaves sync blocked; redo the
   reconcile keyed on pid, never on the name (LEDGER 13 and 39;
   `tests/offline-add-casing.test.mjs` holds the todo).
3. An open phone keeps the festival file it booted with: refresh on
   resume, throttled like the sync poll. Matters the day EDC Orlando or
   Seismic posts set times (LEDGER 52).
4. The crew playlist ledger is an array, which the merge replaces whole:
   key it by artist and read both shapes (LEDGER 27; V103-BUILD.md T3).
5. Settings → Diagnostics' build line reads only cache names; use the
   build crash reports use (audit 2026-10-19, ledger-3).
6. After an offline festival switch, the stand-in's empty "made" row is
   saved into the crew copy (LEDGER 42, with its repro).
7. `pastMayMove` never retries when a hold clears, so a set that ended
   while the phone was locked stays unfolded until the next unlock
   (LEDGER 36).
8. A List room's "Earlier · N sets" counts cancelled acts as sets
   (LEDGER 49); a room of only cancelled cards waits for 5 AM (LEDGER 50,
   no data triggers it yet).
9. The address bar carries the view but not `&show=`, unlike the invite
   link (LEDGER 10).
10. The import's rate limit is per server instance; move it to a shared
    per-crew quota before the import gets popular (LEDGER 7).
11. The join shelf still has a grabber (LEDGER 14).
12. A ResizeObserver loop in the rail's scrollspy; fix the observer, then
    drop the filters five-plus browser suites carry (LEDGER 15 and 37).
13. ACL's day row can rest on a sliver at a 320px phone with Late nights
    (LEDGER 58); the day row's NOW behind the fade at phone width under a
    highlight (LEDGER 34).
14. The QR card can sit half a device pixel off centre in Chromium
    (LEDGER 55); Safari draws the kept card on the main thread, watch for a
    hitch (LEDGER 57).
15. v92 minors: a resize mid-bloom, a font load and a resize in one frame
    (LEDGER 4); v97 minors: a closing fold before a festival switch, a
    folded import landing renders twice (LEDGER 9).

## Tests

1. `tests/warm-open.test.mjs`'s 1-second wall-clock budget fails under a
   busy full run; judge it against the fetch's own timeout (LEDGER 59).
2. Linux WebKit 1280: the day row can stay on the day above after the open
   lands; the assertion is quarantined in
   `tests/browser/acl-latenights.test.mjs` (LEDGER 38).
3. Prove the wrong-crew push guard: a push for crew A, switch to B mid
   flight (audit 2026-10-19, ledger-10).
4. A `LATE_ANIMATIONS_MS` CI pass, so Linux-only timing reds show up
   first (LEDGER 18).
5. The gallery has no List-view section, though every state is meant to
   live there (LEDGER 12; audit ledger-13).
6. Worker N to build N+1: nothing tests a phone's first upgrade after weeks
   idle (audit 2026-10-19, C9).
7. The v101 window catches (banked at tag `back-pocket/window-catches`)
   and the stop-end cap, with their acceptance tests (LEDGER 29, 30).

## Product ideas, banked

1. The 2027 tabs: Discover (Ray's fork is the source; it can't merge
   straight in, it is 1,300+ commits behind), Our picks, and a reference
   tab with the grounds, venue maps and everyone's notes (Kevin's Pen,
   2026-09-26).
2. City seasons: a whole city's shows by season. Austin v0 lives on the
   unmerged branch `seasons/austin-v0` (LEDGER 31).
3. The iOS and Android app: `claude-plans/2026-09-29-native-apps-stack.md`
   (NOW.md has the next step).
4. Add a show the festival file doesn't know
   (`claude-plans/2026-09-02-add-a-show.md`); the merged wall for two crews
   at one festival.
5. The schedule-drop watcher: catch a set-times drop and open a data PR
   (`claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`).
6. An AI festival import graded by an eval.
7. List-view swipes; the in-app venue map; a sticky member-chip row
   (Kevin's Pen).
8. The Board's in-room fold (only whole past days fold on the Board;
   LEDGER 12).
9. Folsom neighbourhoods for its parties (LEDGER 6, for next year).
10. ACL's Late nights calendar edges, for 2027 data: skipping the next
    evening's Late night, Our picks jumping a day early, one line per
    finished date in the List (LEDGER 41).
11. The deferred sync and merge hardening list (DEVLOG 2026-08-23); day
    scroll mirroring only on scroll end (needs Kevin's yes).
12. Duplicate person rows for Portola crew members: an idempotent claim
    fixes it, as a designed build (audit 2026-10-19, ledger-11).

## Kevin's slower calls

1. The people menu on a phone on its side: nine 44px rows need a layout
   (LEDGER 56). Default: the Invite sheet's two-column step as the model.
2. Pen tidy-ups: a Project for "Take Austin seasons live", a Peep row for
   Ray (LEDGER 31). Default: add both.
3. The BONUS TRACKS column on ACL's posters (talks, drag, guest spots) was
   never entered (LEDGER 51). Default: leave it for 2027.

## Process lessons (already in the RUNBOOK or AGENTS.md)

LEDGER 5, 19, 25, 32 and 33: end a CDP flick with the finger still (holds
are gone since v98), read festival data from `origin/main`, gates include
CI, link worktrees to the root's install, fast-forward the root checkout
after each merge.
