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
2. **P1 (done at 599138d, builder, from 31d06f2):** the prototype becomes the product.
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
   e. The validator (data-guards, three tests): a `dropIn` of `"true"`, `1`, `null` or
      `"yes"` is an error on a grid set and on a section entry, `true`/`false` clean;
      the one-set nudge fires once on a live festival, is answered by `true` or
      `false`, is never asked of an archived file or a day of one-set stages; Portola
      declares exactly its three rooms and is clean, and with the grid's two
      declarations stripped is asked about exactly Saturday's and Sunday's Despacio.
      Red on main: 3 of 3 (`"true"` gives no error). The Share leaves a drop-in out
      (A4): the Despacio crew's words equal the nine's at every 15 minutes Fri noon to
      Sun 5 AM (plan-text); red on main, `'Pier 80 (loyalty invite) for Despacio @
      5pm'`. `docs/add-a-festival.md` documents `dropIn`; the validator's comments
      lose their DESIGN voice.
   f. The three red unit tests (plan-shelf), rewritten to the settled rules. The
      highlight test: Gus (this phone) gets his own day, "Next: Prospa, Warehouse,
      9:45 PM" with no count, the head "Sep 26 · just you", no Dog Blood row and no
      `.dim`; Ana + Cy + Hal read "Now: Dog Blood … 3 of 3", the Soulwax row says
      "Ana + Hal", one NOW; everyone is the crew's "8 picked" and "9 picking". The
      people-menu test: the row leads while the plan is closed; the menu opens over
      the open plan, leaves it open and has no row; closing the plan brings the row
      back; no history entry. The welcome test was a cascade (the old highlight test
      failed before clearing its highlight, which the tab keeps per festival) and
      passes unchanged. Red on main: the highlight test (`'Next: The Great Northern,
      ~1:30 AM, 4 picked'` — the crew's route through a peek filter) and the menu
      test ("the menu opens over the open plan and leaves it open"). The prototype
      passes both new tests: it already behaved this way, and the old tests were the
      stale half.
   g. **599138d** the browser suites read the days list: plan-share's button words
      ("Share today’s picks", "Copy today’s picks"; red on main, which says "Share our
      picks"), plan-drag's grown-card keys carry the night, and the pinned catch runs
      at Portola's last night (Sunday 11:30 PM), where the open window is shorter
      than the screen. On Saturday the days list already fills it, so a pin cannot
      change its height and the test's own precondition failed (`pinned 744`,
      `caught.height 744`).
   **Gate on 599138d** (a snapshot of HEAD): `npm test` 1278 tests, 1275 pass, 1 fail
   (the SW stamp), 1 skipped, 1 todo; plan-share 39/39 at 0 and at 700; plan-drag 38/39 at 0
   and at 700 (the one skip is WebKit's keyboard test, on purpose).
   **Doubts.** (1) `thinnedWords` is a copy of v104's in wall.js until the merge; the
   hunk is v104's side. (2) peekOf's `people` option, `hasAny` and planPicks'
   `highlight` still exist, read only by tests: the app filters by planOf now. P3
   removes them with the highlighted Share's tests. (3) A stray grid set's `dropIn`
   was the prototype's gap, closed here with a test. (4) A single stop that is over
   folds into Earlier (the old one-night list waited for two); the design's frames
   show it, so it stands. (5) A drop-in venue is judged by the trip rule like any
   venue: a room across town open since 6 PM is not "worth the trip" at 7 (the tail
   rule). Portola's rooms are on the grounds, so nothing moves; the design didn't
   cover it.
3. **P2 (done at dc31d42, builder):** across the days (B1–B4). Most of B1–B4 came
   with the prototype, whose code P1 kept: the head's turn, the Share per day, `fitTail`,
   Earlier's span, bare runs ahead of today, the laptop corner. P2 pins each with a
   browser suite and builds the two things the prototype did not do.
   a. **b45ae37** a link for a later night opens the plan on that night (the brief's
      default, flagged below). The window grows from tonight's peek row as it always
      does, and once it has landed the list glides to the named night, the head turning
      over as that night reaches the top. It is instant under Reduce Motion or Low
      power, and a hand on the window or a scroll of the person's own keeps things where
      they are. A night already over still lands on the wall (plan-share's "a plan link
      for another night"). Bare runs fold behind Earlier as they do ahead of today (with
      Earlier open, ACL W1 Sunday showed MON and TUE as two empty heads), and a run's
      rows name every night in it (`data-nights`), so a link for Tue Oct 6 finds it.
   b. **42d6bf7** `tests/browser/plan-days.test.mjs`, in Chromium and WebKit, on Portola
      and a made-up ACL eight (`tests/fixtures/plan-crew-acl.json`). The head and the
      Share follow the day at the top, and the head turns from the side the list moves
      toward (recorded `Element.animate`, 200 ms). Reduce Motion changes the day at once.
      A later night's link glides there (the list's scroll positions recorded, each with
      whether the window was still growing). ACL's short last Sunday reaches the top.
      Earlier's date span past three nights opens dimmed under its heads. Bare runs are
      one head and one reason, and their Share rests. The laptop's corner stays
      today's.
   c. **dc31d42** the glide carries on across a repaint. A tick or a friend's pick
      mid-glide replaced the list and left it short of the night. The glide now
      remembers where it is going until it lands or a hand takes over. The top night is
      read from offsets (the list is the rows' offsetParent), not rects: a repaint's
      rows travel to their new places, and a rect read mid-motion put Saturday in the
      head with Sunday at the top.
   **Red first.** On main (250bc45), 14 of 14 fail, e.g. `'Share our picks'` for
   `'Share today’s picks'`, "a row for 2026-09-27 in the open plan" (main's plan
   holds one night), ACL W2 `['SAT','Oct 10 · 8 picking','Share our picks']` (the
   last day never reaches the top), and the bare run `null`. On the P1 head (599138d),
   4 fail: the later-night link, both engines (`TimeoutError: waiting for
   locator('#plan[data-state="open"]')`, because it landed on the wall), and Earlier
   open on ACL W1 Sunday, both engines (`'MONOct 5','TUEOct 6'` for `'MON · TUEOct 5 –
   6'`). The glide, against a version that scrolled the list in the open's own frame:
   `the list moved only once the window had landed: [{"top":511,"moving":true}]`. The
   carry-on test, without the continuation: `timed out waiting: the glide reaches
   Sunday after the repaint`. With rects in `nightAtTop`, at 700: `'SAT' !== 'SUN'`.
   **Gate on dc31d42:** a snapshot of HEAD: `npm test` 1278 tests, 1275
   pass, 1 fail (the SW stamp), 1 skipped, 1 todo; plan-share 39/39 at 0 and at 700;
   plan-drag 38/39 at 0 and at 700 (WebKit's keyboard test skips, on purpose);
   plan-days 16/16 at 0 and at 700. (The same gate on 42d6bf7, before the carry-on:
   the same lines, plan-days 14/14.)
   **Doubts, and what the design didn't settle.**
   (1) **For the coordinator:** a later night's link opens the plan and glides to that
   night, the brief's default. The other way is the old one, landing on the wall.
   (2) A past night's link still lands on the wall: the words were about a day that is
   gone.
   (3) Bare runs fold behind Earlier too. The frames only show them ahead; I used one
   rule both ways.
   (4) With Earlier open, a past night at the top can be shared: the button names it
   ("Share Thursday’s picks") and sends it whole. Its link lands on the wall, because
   the night is over. The design didn't say, and I didn't disable the Share for past
   days. It's a small call for Kevin.
   (5) A bare run's head and Share name its first night ("Nothing to share Monday" for
   Mon–Tue), per frame D5.
   (6) The glide is the browser's native smooth scroll, about 350 ms here, not a
   motion.js curve. A designed curve would need a scroll driven from script.
   (7) When a repaint lands mid-glide, the rows' travel and the glide run together.
   The test checks that this is correct, not how it feels, so a walker should look.
   **Settled by the coordinator (2026-09-27):** (1) keep the later-night glide; (4) keep
   the Share for a past night, naming it (Kevin gets it as an FYI with a one-word
   override).
4. **P3 (done at 60107d2, builder):** menus while open (C1–C7). The prototype already
   behaved the C way (P1 kept its code and rewrote the two unit tests). P3 removed the
   second highlight path, pinned the menus in real browsers, and fixed the one gap the
   tests found.
   a. **7a61db3** a highlight has one path, the plan itself (rule 10). peekOf's
      `people`, `hasAny`, and planPicks/planText/whoAt's `highlight` were read only by
      tests, and are gone. `stretchFor` asks `passesPeople` per person, the List's
      question. The model's peek test and the Share's highlight tests build the plan
      as app.js does, so the goldens are the group's own route. Cy alone sends "Picks
      for Sat Portola…": Dog Blood now, Soulwax (the pick his day gives up, as its
      or-line), Regency for Parcels ~10:15, Public Works ~10:30. Ben, Eli and Gus reach
      DJ Shadow at 6:10 and Prospa at 9:45, their route's times (the crew's route got
      there at 6:30 and 10:15).
   b. **69712f2** today with every stop behind it says "Nothing left today", and its
      Share rests. The emptied-plan test found this: with Gus and Hal highlighted,
      today showed no rows under the head, and its Share offered to send a head with no
      lines.
   c. **60107d2** the menus in plan-days, five cases in Chromium and WebKit, with real
      taps. The Show menu opens over the open plan with no history entry, and hiding
      Afters takes The Great Northern out of Saturday while the menu is up. The people
      menu opens over it without Our picks: Gus, then Gus + Cy + Hal, re-plan it live
      ("just you", "you, Cy + Hal", "2 of 3"); the highlighted Share starts "Our picks
      for Sat Portola", names no one, and the foot reads "Opens on everyone’s picks".
      With the plan closed the row is there and opens it. On the laptop the corner says
      "JUST YOU". Gus + Hal empty the plan: it stays open, the Share rests, closing lets
      the shelf go, and Everyone brings back the peek and the menu's row. A jsdom twin
      of (b) is in plan-shelf. Where a menu overlaps the plan, what a finger reaches at
      the overlap's middle is the menu.
   **Red first.** On main (250bc45): the Show-menu test `the plan stays open under the
   menu` (`'peek'`: main closes the plan), the people-menu and laptop tests (`'peek'`
   for `'open'`), and the model's peek test `the count is theirs` (`['now','Pier
   Stage','9 PM',8]`, main's peek filter over the crew's route). The closed-plan row
   test passes on main, which already offered it; it is a guard. On the P2 head
   (dc31d42), the four menu tests and the rewritten unit tests pass: the prototype
   behaved this way, and the removed path was dead. The emptied-plan tests fail there,
   in both engines and in jsdom, with `today says why` (`[]` for `['Nothing left
   today']`).
   **Gate on 60107d2:** a snapshot of HEAD: `npm test` 1279 tests, 1276
   pass, 1 fail (the SW stamp), 1 skipped, 1 todo. plan-share 39/39, plan-drag 38/39
   (the WebKit keyboard skip), plan-days 26/26, people-menu 24/24 and show-menu-stacking
   2/2, each at 0 and at 700. **now-jump fails: 58 tests, 42 pass, 16 fail at 0**
   (13 Chromium, 3 WebKit, every case with someone highlighted). I stopped its 700 run
   because the cause is the same one, below.
   **Found at the gate: a product question the design doesn't settle (the stop).**
   now-jump's highlighted cases have failed since P1 (599138d), not since P3. They pass
   on main (250bc45); on 599138d, "390: Ross highlighted — NOW lands on his live pick"
   and "390: Nhu highlighted…" both time out. The P1 and P2 gates ran only the plan
   suites, so this went unseen until now. The mechanism, probed on now-jump's own crew
   at Sat 10:30 PM: Ross, Nhu, Kat and Dee never gather the crew's bar of 3, so on main
   there is no peek, highlighted or not, and the dock's NOW tab is always there. Under
   rule 10, one person highlighted is their own day at bar 1. Ross's live pick becomes
   the peek's NOW (`Now: Milli Meng, Public Works`; Nhu Soulwax, Kat Prospa, Dee at
   7 PM DJ Shadow), and ONE NOW (app.js paintNowTabs) then hides the NOW tab the tests
   tap: `element is not visible`, 30 s. So whenever a highlighted person has a live
   pick, the plan now answers Kevin's 2026-09-24 question, "where is Ross likely right
   now", in the peek. The wall's answer he asked for that day (the now line and Ross's
   highlighted card seen together, cycling through several live picks) is no longer
   reachable, because its door has stepped aside. The ways out, for Kevin:
   (a) ONE NOW holds under a highlight, as built: the peek's NOW is the answer. Rewrite
   now-jump's highlighted cases to where the plan isn't saying NOW. The wall's
   now-line landing under a highlight is then mostly unreachable.
   (b) Under a highlight, the NOW tab stays beside the peek: two doors while someone is
   highlighted, one to the wall's live cards and one to their route. now-jump passes as
   it is; ONE NOW gets one exception.
   (c) Something else, such as the peek's NOW row landing the wall on that card.
   Tried in a scratch tree, not on the branch: (b) is one condition in paintNowTabs
   (`planShowsNow() && !filterPeople.length`). It makes now-jump 58/58 at 0, but it
   reverses an assertion that is already on main, plan-shelf's "one NOW, a highlight
   or not" (`dock-now` hidden while a highlighted peek says NOW). The three plan-shelf
   tests after that one fail only in cascade, because the highlight is left on. So ONE
   NOW under a highlight is a standing rule, not the prototype's. Rule 10 only makes it
   fire whenever a highlighted person has a live pick, where the old peek filter fired
   only when they were in the crew's stop. My lean is now (a): it is Kevin's rule as it
   stands, and the peek answers "where is Ross right now" at a glance. Its cost: under
   a one-person highlight, the NOW tab shows only when their live pick is a drop-in or
   a hidden room, so now-jump's 16 single-person cases need new setups or retire.
   Choosing (b) keeps the 2026-09-24 wall answer and takes the one-NOW exception. I
   haven't changed the branch: either way changes what a person sees.
   **The other browser suites at 0 on 60107d2** (a sweep of every suite outside the
   gate list, one at a time): all green: by-time 4, error-report 1, fold-intent 4,
   guest-tap-route 6, heads 7, hover 11, import-flow 4, list-view 12, meter 27, shell
   11, show-links 6, stack-row 9, strip-follow 3, tap-shelf 31, touch-ghost 2,
   zoom-chips-burst 8, zoom-chips 45, zoom-chrome 18, zoom-door-row 8, zoom-notes-chip
   1, zoom-still-hand 6.
   **Doubts, and what the design didn't settle.**
   (1) "Nothing left today" is my wording for today with every stop behind it. The
   design's edge cases word only a person with no picks ("Nothing Gus picked"). It's a
   one-word override for Kevin.
   (2) On the laptop the people menu drops from the rail clear of the panel; only the
   Show menu overlaps it. The test requires an overlap only where the design draws one
   (the phone's menus, the laptop's Show menu).
   (3) The Share's sweep (every five minutes, two festivals, nine highlights) now builds
   a plan per highlight. Under load it went from 56 s to 69 s, and it is the slowest
   unit test.
   (4) Under a highlight, the Share breaks a tie in count by MOST, as the crew's does.
   MOST is the group's own now; the old path skipped it because MOST was the crew's.
5. **P4 (done at 724d0bb, builder, from db99c3d):** where a stop ends. The rig
   (`stop-ends.mjs`) matches P4-PREP.md on db99c3d: the nine meet one carry (Zara
   Larsson, Sunday 8:05–8:15), the ACL nine none, and forks never outlive their stop.
   **Everything that reads a stop's end, listed again on db99c3d before the fix**
   (P4-PREP.md's eight, plus six the plan-days rounds added or it didn't name):
   a. `atOn`'s `current` (`s.from <= m < s.to`): the peek's NOW, and its count from
      the stop's `timeline`.
   b. `planAt`: last night is still being lived while any stop has `i.to > m`.
   c. `forkFor`: a fork still to come (`f.to > nowMin`), and "a real second door"
      overlaps 60% of the stop's own span, so a shorter stop changes that ratio.
   d. `tillOf`: a room's till is its stop's end (a set's is its act's).
   e. `routeOf` itself: the peak, the tier, the timeline and the forks come from the
      run's slices, and a folded blip's slices count in all four.
   f. The Earlier fold and `.past` (plan-rows `overAt`), planDays' `overToday`, and
      the landing night's fold (`skip: i.to <= clock`).
   g. `rowsKey`, the shelf's repaint signature (`from-to` and `over` per item).
   h. The Share: `endOf` (the least of the stop's end, its act's end and its place's
      end), `tillText`, `whoAt`/`crowdAt` from the timeline and a fork's crowds, and a
      line's `live` (`from <= nowMin`).
   i. The shelf's `nightRows` signature (plan-shelf.js).
   j. app.js `dayOf`'s `bare`: today with no stop left (`i.to > nowMin`, P3's
      "Nothing left today").
   k. The one-NOW rule: app.js `paintNowTabs` asks `planShowsNow`, which is the peek's
      tag.
   l. `stopRow`: the `live` class and "till" on the NOW row.
   m. `scatteredRow`: "Scattered till" a stretch's end (a stretch between stops ends
      where the next stop begins).
   n. `stopKey` (`night|where|from`) reads the start only, so a stop that ends earlier
      keeps its key and its FLIP.
   **Acceptance tests, first** (`tests/plan-stop-ends.test.mjs`, every five minutes of
   every festival day, 5 AM to 5 AM, from the first night to the morning after the
   last). Crews: the nine, the made-up ACL nine (plan-text's seed 7, one in five), the
   ACL crew of eight the browser suites use (`plan-crew-acl.json`, the same crew as
   `crew-acl.mjs`), and six seeded nines the rig found carrying a stop (Portola 7919,
   15838, 31676; ACL 55433, 79190, 95028). Test 5 is a browser suite,
   `tests/browser/plan-stop-ends.test.mjs`.
   a. **628d855** the Share sweep draws the plan without paint. A CPU profile of
      plan-text (288 s on db99c3d; main's was 58 s) put jsdom's CSS parser, reading
      the rows' aura gradients (`nodeEl`, `whoEl`), under nearly all of it: each
      drawing of the plan-days list draws every later night. `tests/helpers/
      paint-free.mjs` makes `background` and `border` write nothing, for tests that
      read words and classes. plan-text runs in 50 s. (The review's item 11.)
   b. **a3d59cb** a stop ends by the time its place does. routeOf folds a blip into
      the stop before it only while that stop's set (its act's end, what tillOf
      reads) or room (its close) plays through the blip; after that the blip stands
      as a short stop of its own; with no stop before it, it is nothing, as before.
      `tillOf` and the fold share one reading (`actEnd`, `playsTill`). On Sunday:
      "NOW · Tiësto · Warehouse · till 8:15 PM" from 8:05, which the Share already
      sent. The rig after: 0 carries across the nine, the ACL nine and 240 seeded
      crews (215 stops before). Stops grow 3–7% at Portola (x5 466→478, x9
      1121→1187, x15 1302→1397) and under 1% at ACL (2110→2111, 3741→3757,
      3947→3970). Goldens: Zara Larsson 7:05–8:05, then Tiësto 8:05–8:15 (the
      crew's golden, Folsom hidden, and the Despacio crew's); Sunday has 12 stops,
      13 with Folsom hidden → 14. The blip rule's test gains the case where the set
      still plays (Xa to 9:30: the ten minutes fold in; its timeline skips 9:00
      and 9:05, where the three were at Y). Comments that described the carry
      (plan-rows `endOf`, plan-text's and plan-share's 8:10 notes, `MIN_STOP`) are
      rewritten. `endOf`'s min stays as a guard: the stop's `to` in practice now.
   c. **724d0bb** the frames E1–E5 (`node frames.mjs E`): Sunday 7:50 open, 8:10
      peek, open and the laptop's corner, and Ben, Eli + Gus at 9:25.
   **Red first.** On db99c3d, `tests/plan-stop-ends.test.mjs`: test 1 fails with
   `the peek says NOW for Zara Larsson (Pier Stage), over at 8:05 PM` and `the NOW
   row is Zara Larsson (Pier Stage), over at 8:05 PM` (the nine, 2026-09-27 8:05 and
   8:10), then the seeded crews' carries (Fcukers 5:30, Bassvictim 7:40, ...); its
   route form fails with `Zara Larsson (Pier Stage) 7:05 PM–8:15 PM, over at 8:05
   PM`, and under a highlight `the nine [Ben,Eli,Gus], 2026-09-27: Overmono
   (Warehouse) 8:20 PM–9:30 PM, over at 9:20 PM`. Tests 2, 3 and 4 pass on db99c3d:
   the head has no cap, forks are built from the stop's own slices, and the Share
   reads the rows. They guard against the fix that was cut from the Share release,
   so their red is shown on a scratch copy of db99c3d with that cap put back
   (e93c876's parent: stop and fork `to` = min(run end, place end)): test 2 fails
   with `the or-line Tiësto (Warehouse) (on till 8:15 PM) is not on screen — its
   row, Zara Larsson (Pier Stage) 7:05 PM–8:05 PM, is over` (plus two seeded ACL
   crews), test 4 with `Tiësto (Warehouse) 7:05 PM–8:15 PM under Zara Larsson (Pier
   Stage) 7:05 PM–8:05 PM is not inside its stop`, and test 1 passes there. Test 3
   is the Share release's sweep, kept in plan-text, and here run over the seeded
   crews too; it passes on db99c3d and on the cap, since the Share reads the rows'
   own rules. Its red is the Share release's. The browser suite (test 5) fails on
   db99c3d with `20:05: Zara Larsson ended at 8:05; the crew is at Tiësto` (the
   minute log shows "Now: Zara Larsson, Pier Stage, till 8:05 PM" at 8:05). Its
   one-NOW assertion passes on db99c3d; with paintNowTabs' `planShowsNow()` switched
   off in a scratch copy, it fails at once: `19:58: the NOW tab and the plan's NOW
   both show`. On the fix, the minute log shows the tab stepping in for the walk
   (8:15–8:19, the peek saying NEXT Overmono) and out at 8:20.
   **The short stops: they do not read as noise to me, and it is Kevin's look.**
   The nine meet one (Tiësto, 8:05–8:15, "catch the end of Tiësto" before Overmono
   at the same Warehouse); the ACL nine and the ACL crew none, highlights included;
   Ben, Eli + Gus one (Swedish House Mafia 9:20–9:30, "Ben + Eli, 2 of 3", then Four
   Tet 9:30 with Eli + Gus); seeded Portola nines 1.7 per crew of about 30 stops over
   four nights, seeded ACL nines 0.4 of about 94. In E1 the short Tiësto row sits
   right under Zara's "or Tiësto" line, so Tiësto is named twice. That is the rows'
   existing grammar, not a new one: Parcels' "or Four Tet" above "Four Tet 10:45 PM"
   in the same frame does the same on db99c3d. In E5 the ten-minute NOW row says
   "till 10 PM" (Swedish House Mafia's set), with Four Tet 9:30 under it: the till is
   the set's, as for every set the route leaves early. If Kevin reads either as noise,
   the fallback is the changeover (the Share's 8:10 golden then loses its Tiësto
   line); I haven't chosen it.

