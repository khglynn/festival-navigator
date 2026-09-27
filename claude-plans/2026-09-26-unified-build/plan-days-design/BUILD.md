# Our picks across the days — the build (2026-09-26 night →)

**Branch** `live/plan-days-design` (worktree `.claude/worktrees/plan-days`). **Design**
`DESIGN.md` beside this: Kevin settled every question at its default on 2026-09-26.
For C3/C6 that means two together for 2–4 highlighted people, and the crew's own
`barFor` from five up. **Target:** ACL Late nights, from Tue Sep 29.

**Base.** The prototype, with main at v103 merged in (0b82dfa: the Share, the catches
cut). v104 (`live/v103`) lands on main on Mon Sep 28. It touches the same seams
(`passesPeople` in `js/v3/filters.js`, the day row, repaintWall's focus restore, the
highlight menu), so merge it as soon as it lands (merge, never rebase), and re-run the
suites on it first. Until then, build against those seams as they stand on
`origin/live/v103` where a phase needs them.

**Gate** (the Share's, unchanged): red-first tests for every behaviour; `npm test` green
except the SW stamp (the coordinator stamps); the browser suites green locally at 0 and
at `LATE_ANIMATIONS_MS=700`; CI's browser job (Linux, WebKit included) green on three
attempts in a row on one head; a Sonnet walker on real input (phone and laptop, both
engines); Sol; the SHA to the coordinator. No stamp, no PR, no merge to main, no real
crew link, no database writes (previews and `vercel dev` use production's).

## Phases (each: red-first tests, small commits, pushed; a line in the log below)

1. **P1: the prototype becomes the product.**
   a. Delete the DESIGN-ONLY paths (DESIGN.md "What changes in code"): `window.__planDesign`,
      `planOf`'s `dropIn` modes and `groupBar`, `lightTouch`, `backRow`, and
      `thinnedWordsLocal` (import wall.js `thinnedWords`).
   b. The bar per C3/C6: 1 for one person, 2 for 2–4, `barFor(n)` from five.
   c. Model goldens: rule 9 (the Despacio crew's three nights, `crew-despacio.mjs`),
      rule 10 (one, two, three, five highlighted).
   d. Validator tests: a non-boolean `dropIn` is an error; the one-set nudge warns on a
      live festival only; Portola stays at zero warnings.
   e. The three unit tests the prototype turned red, rewritten to the settled rules:
      a highlight filters (no dim), the people menu's row only while the plan is
      closed, and the welcome card's cascade.
2. **P2: across the days (B1–B4).** Browser tests, red first:
   a. the head turns with the day at the top;
   b. the Share names and sends that day, from now for today and whole for the others;
   c. the link opens on that night;
   d. `fitTail` brings the last day to the top;
   e. Earlier folds past nights, as a date span past three (ACL);
   f. bare days fold with their reason;
   g. the laptop corner stays today's.
   Decide, and test, what a link for a later night does on an earlier day. Today it
   lands on the wall and opens nothing. With the days in one list, it could open the
   plan scrolled to that day. Default: open it scrolled there, since that is what the
   words were about. That's in the spirit of B1; flag it to the coordinator.
3. **P3: menus while open (C1–C5).** The Show menu and the people menu open over the
   open plan and re-plan it. "Our picks" shows in the menu only while the plan is closed.
   A highlight filters through `passesPeople`, the one predicate the List uses too. The
   head says whose plan it is. A highlighted Share goes out unnamed, with "Opens on
   everyone's picks". Tests cover each, including the menu taking no history entry (the
   v93 lesson).
4. **P4: where a stop ends.** DESIGN.md's banked section: its five acceptance tests are
   written first, over every five minutes of every Portola and ACL night, and then the
   fix. List everything that reads a stop's end again before changing it.
5. **P5: ACL ready.** The made-up ACL nine (`crew-acl.mjs`) across Late nights and both
   weekends: goldens for the days list, Earlier's span, and the Share per night. Check
   the Late nights data renders with times (data #56).
6. **P6 (optional): the window model.** The banked catches (DESIGN.md section, tag
   `back-pocket/window-catches`) go in only as one model of where the window is, with
   their tests passing three times in a row on CI's WebKit, and without making the
   refit path depend on motion timing. Otherwise they stay banked, and the release goes
   without them.

## Log

1. **P0 (0b82dfa):** main at v103 merged in. Conflicts in plan.js, plan-rows.js,
   plan-shelf.js and app.js were resolved to keep both sides. The shelf draws
   `planDays` on the Share's single source (`drawn`, the forced repaint, the held
   guard, `holdForShare`). The signature is per night (`rowsKey`, plus the drop-in
   lines). The per-day Share sends the day at the top, with a link that opens on that
   night (`linkOf(id)`). npm test shows the prototype's same four expected reds.
2. **P1 (in progress, builder, from 31d06f2):** the prototype becomes the product.
   Baseline on 31d06f2: `npm test` 1262 tests, 4 fail (the three the prototype turned
   red, plus the SW stamp); `plan-share` 39 tests, 4 fail (the button's words: the
   prototype says "Share today's picks" where the suite says "Share our picks");
   `plan-drag` 39 tests, 4 fail (two tests per engine: the fold-grow test's keys
   predate the night in `stopKey`, and the pinned catch needs a window that can grow,
   which a days list no longer is at Saturday 9:40 PM).
   a. **1f25ceb** `barForGroup`: 1, 2 for 2–4, `barFor(n)` from five (C3/C6). Red on
      31d06f2: `[1,2,2,2,2,2,2,3,3,4,5]` vs `[1,2,2,2,3,3,3,3,3,4,5]` (five to eight
      highlighted took 2).
   b. **1acf9b7** one path: `window.__planDesign`, planOf's `dropIn` modes and
      `groupBar`, `lightTouch`, `backRow` (and its CSS), the highlight's dim (the rows,
      the shelf's dim animation, `--plan-dim`) and `thinnedWordsLocal` are gone.
      `thinnedWords` sits in wall.js at v104's own anchor, byte for byte, so the merge
      is one trivial hunk (v104's side wins); app.js imports it on its own line because
      v104 edits line 12. `planList` is gone (planDays draws every night); plan-text's
      goldens read the landing night's rows of `planDays`. A stray grid set (a stage
      that is not a column) now carries its `dropIn` like a grid cell (the prototype
      dropped it).
   c. Rule 9's model tests (plan-model section 6, eight tests): the Despacio crew's
      nights equal the nine's goldens plus one line each (Fri `Pier 80 (loyalty
      invite) 5 PM–11 PM 7`, Sat `Despacio 2:45 PM–9:45 PM 7`, Sun `3:30 PM–10:30 PM
      7`); a sweep at every five minutes Thu noon to Mon 5 AM that no drop-in is a
      stop, an "or" or the peek; seating (a must on the room yields to a 1); the trip
      (a must on a drop-in never holds a body against a room); the drift caption at
      the bar and not under it; the line counts pickers even when nobody sits there;
      a hidden drop-in has no line; a mixed venue is not a drop-in; a stray declared
      set is. Red on main (250bc45): 8 of 8 fail, e.g. Friday `'most 5 PM–9:30 PM 7
      Pier 80 (loyalty invite)'` where the golden starts at Regency 8 PM, and the
      synth seating `'most 2 PM–10 PM 3 W (Room)'`. Red on the prototype (31d06f2):
      the stray test, `undefined` vs `true`. Mutants (each rule 9 line of plan.js
      removed in turn: aheadAt, the seating key, the ranked filter, the hidden line,
      every→some, the drift caption) are each caught by at least one test.
   d. Rule 10's goldens (plan-model section 7, on the Despacio crew): Gus alone (bar 1,
      ten rows, his give-ups as alt "or" lines: Kettama or Fatboy Slim, Prospa or
      Audio), Ana + Cy and Ana + Cy + Hal (bar 2: the sets they share, drifts
      "Despacio 2"), and five (bar 3 per C6, twelve rows, no stop of two). The
      invariants: across nine highlights every stop, fork and line is the group's and
      clears the bar; all nine highlighted is the crew's route; a stranger is no
      highlight; a member with no picks is named but not in the group, and every night
      says `unpicked`; two who never meet say `scattered`. The stale "people filter is
      not an input" test (it passed an option planOf never read) is gone. Red on main:
      5 of 5 (planOf returns no `group`, bar 3 for Gus). Red on the prototype: the bar
      and the five (bar `2` vs `3`).
