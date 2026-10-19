# BACKLOG — festival-navigator

**last-updated: 2026-10-19.** The off-season list: real fixes, test debts,
product ideas and the slower calls for Kevin. One line each, with where it
came from. "LEDGER n" is follow-up n in
`claude-plans/2026-09-25-portola-live/LEDGER.md`, which has the full
evidence. The questions Kevin can answer now are in `NOW.md` ("Open with
Kevin"), not here. When something ships, delete its line and say so in
DEVLOG.

## Real fixes, biggest first

1. The offline "drew"/"Drew" add still leaves sync blocked; redo the
   reconcile keyed on pid, never on the name (LEDGER 13 and 39;
   `tests/offline-add-casing.test.mjs` holds the todo).
2. The crew playlist ledger is an array, which the merge replaces whole:
   key it by artist and read both shapes (LEDGER 27; V103-BUILD.md T3).
3. `pastMayMove` never retries when a hold clears, so a set that ended
   while the phone was locked stays unfolded until the next unlock
   (LEDGER 36).
4. A List room of only cancelled cards waits for 5 AM to fold (LEDGER 50;
   no data triggers it yet).
5. The import's rate limit is per server instance; move it to a shared
   per-crew quota before the import gets popular (LEDGER 7).
6. The join shelf still has a grabber (LEDGER 14).
7. A ResizeObserver loop in the rail's scrollspy; fix the observer, then
   drop the filters five-plus browser suites carry (LEDGER 15 and 37).
8. ACL's day row can rest on a sliver at a 320px phone with Late nights
    (LEDGER 58); the day row's NOW behind the fade at phone width under a
    highlight (LEDGER 34).
9. The QR card can sit half a device pixel off centre in Chromium
    (LEDGER 55); Safari draws the kept card on the main thread, watch for a
    hitch (LEDGER 57).
10. v92 minors: a resize mid-bloom, a font load and a resize in one frame
    (LEDGER 4); v97 minors: a closing fold before a festival switch, a
    folded import landing renders twice (LEDGER 9).
11. Only if a phone tap ever grows a card on a real iPhone: gate hover
    arming on `(any-hover: hover)`; `js/v3/card-facts.js` deliberately
    avoids media queries today (old NOW, kept 2026-10-19).
12. Festival date strings read unevenly in the picker ("Jun 25, Jun 26,
    Jun 27, Jun 28"; "(8-day event, seventh edition)"). Trimming them means
    re-rendering the link-preview cards, which print the dates (off-season
    walk, 2026-10-19).

## Tests

1. Linux WebKit 1280: the day row can stay on the day above after the open
   lands; the assertion is quarantined in
   `tests/browser/acl-latenights.test.mjs` (LEDGER 38).
2. Prove the wrong-crew push guard: a push for crew A, switch to B mid
   flight (audit 2026-10-19, ledger-10).
3. A `LATE_ANIMATIONS_MS` CI pass, so Linux-only timing reds show up
   first (LEDGER 18).
4. The gallery has no List-view section, though every state is meant to
   live there (LEDGER 12; audit ledger-13).
5. The v101 window catches (banked at tag `back-pocket/window-catches`)
   and the stop-end cap, with their acceptance tests (LEDGER 29, 30).
6. `tests/brand-assets.test.mjs` and `tests/view-menu.test.mjs` (line 131)
   hard-code `https://fest.kevinhg.com`, so a fork that follows
   `docs/fork-setup.md` must edit them too. Derive the expected origin
   from `api/share.js`'s `ORIGIN` and index.html's `fn-canonical-host`
   instead (PR #94 review, 2026-10-19).

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
4. Wording v116 left as it was (2026-10-19): a stranger opening an old
   Portola or ACL link still reads "be first to pick" under the archive
   note (proposed: "{crew} was here for {fest}. It already happened. Tap
   any artist to add your picks for the record."); the can't-start panel
   under Stay offline doesn't name Stay offline (proposed: "…this phone
   needs a fresh copy of it, and Stay offline is on. Try again fetches
   one."); the screen stays blank during a repair (up to 20 s on a hung
   network; a "Repairing…" line would be new copy). Default: ship the two
   proposals, skip the third.
5. Portola opens on its Saturday, which scrolls the archive note above
   the fold. Default: leave it.
6. The README's picture is a row of cards, not a timetable. Default: keep
   it; a phone-frame shot of a real day would sell the app better.

## Process lessons (already in the RUNBOOK or AGENTS.md)

LEDGER 5, 19, 25, 32 and 33: end a CDP flick with the finger still (holds
are gone since v98), read festival data from `origin/main`, gates include
CI, link worktrees to the root's install, fast-forward the root checkout
after each merge.
