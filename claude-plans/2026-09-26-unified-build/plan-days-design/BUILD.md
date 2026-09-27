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

   **Gate on 934cece** (a snapshot started at 724d0bb's code; 4892932 and 934cece add
   only docs): `npm test` 1284 tests, 1281 pass, 1 fail (the SW stamp), 1 skipped, 1
   todo. Every browser suite at 0, one at a time, and the plan suites at 700 too:
   plan-days 26/26, plan-drag 38/39 (the WebKit keyboard skip), plan-share 39/39 and
   plan-stop-ends 6/6, each at 0 and 700; people-menu 24, by-time 4, error-report 1,
   fold-intent 4, guest-tap-route 6, heads 7, hover 11, import-flow 4, list-view 12,
   meter 27, shell 11, show-links 6, show-menu-stacking 2, stack-row 9, strip-follow
   3, tap-shelf 31, touch-ghost 2, zoom-chips-burst 8, zoom-chips 45, zoom-chrome 18,
   zoom-door-row 8, zoom-notes-chip 1, zoom-still-hand 6, all green. now-jump 42/58:
   the sixteen highlighted cases, the product question P3 raised, answered next.
6. **now-jump under ONE NOW (624c495, builder).** Kevin chose (a) on 2026-09-27 ("k ya
   that works", in chat with the lead): ONE NOW holds under a highlight, as built. A
   highlighted person's live pick is the plan's NOW, and the NOW tab steps aside for
   it; the wall's NOW under a highlight is tested where the plan says nothing now.
   a. The sixteen cases keep what they test (NOW lands on the live pick, slides the
      row, pulses the fresh card, cycles the stops, Reduce Motion) with the person
      highlighted beside someone who has nothing on at that minute: Dee at 10:30 PM
      (DJ Shadow and Despacio are over by 9:45) for Ross, Nhu and Kat; Nhu at 7 PM
      (Soulwax, Prospa and Galen all start after 9) for Dee. Two highlighted need a
      shared stop (GROUP_FLOOR 2), and these pairs share only Despacio, a drop-in and
      never a stop, so there is no stop and no peek, and the tab is there. The
      highlight lets both people's cards through, and the quiet one has none on, so
      the tab lands where it did for one person. None retired.
   b. New, at 390, 1280 and WebKit 390: nobody highlighted, the tab is there (the crew
      never gathers its bar of three); Ross alone, the plan says NOW ("Now: Public
      Works, till 11:45 PM", Milli Meng in the row) and the tab is gone; Dee added
      beside him, the tab is back.
   **Red first.** The sixteen failed on the P4 head as the P3 gate found (`element is
   not visible`, the tab stepped aside); rewritten, all pass there. The three new cases
   pass on the P4 head too: they pin the rule as built, for Kevin's (a). A mutation
   with paintNowTabs' `planShowsNow()` switched off fails them (the same mutation as
   P4's test 5). **At 0 on the P4 head's code: 61/61.**
   **At 700, on 9d68c34's code (the review fixes in): 61/61.**
7. **The P1–P3 review's fixes (builder, 2026-09-27).** REVIEW-P1P3.md's eleven, in its
   order. Every red line below is from 934cece's code (the two commits between it and
   f6196de changed only tests and docs).
   a. **Items 1–3, the room under the last day (c565776): one mechanism.** fitTail
      cleared the list's bottom padding, measured and wrote it back on every draw. Now
      an empty, aria-hidden `.plan-tail` is the list's last child. It is sized from
      offsets that leave it out (the list is `position: relative`, so it is the rows'
      offsetParent; the old comment saying otherwise was stale), and only while the rows
      alone overflow the list's box. Nothing is cleared, so no repaint can shrink the
      scroll range under a reader. `showGrown`'s floor reads the base padding again, so
      item 2 needed no change of its own. A plan that fits gets no room, so the phone's
      content-sized shelf has no gap and no jump (item 3). `tests/browser/plan-tail.test.mjs`
      is the review's four tests on ACL W2 Saturday, both engines, phone and laptop.
      **Red first:**
      - Repaint: `after the repaint Sunday's head is still at the top: 361.83 (scrollTop
        218)` (422.47/143, 363.05/214, 424.05/138). The test first grows two Saturday
        cards and asserts that the rows still overflow once the minute folds Arcy
        Drive. My first version skipped that: the fold left a plan that fits, and it
        failed on the fix as well (scrollTop 0), so its red was not evidence and I
        didn't count it.
      - Share: `Sunday's head is still at the top after the Share: 338.64 (scrollTop
        159)` (345.99/154, 389.21/84, 403.00/79). The text sent was Sunday's; the list
        clamped under it after, so the next Share would have sent Saturday.
      - Lower row: `Lorde, T-Mobile, 8:15 PM, 6 picked: the row stayed under the finger
        (423.11 → 233.11; the list scrolled 0 → 190)` (425→229, 473→208, 474→204).
      - Plan that fits: `the window keeps its height as it opens…: 529.05 → [744]`
        (Chromium), `530.67 → [530.7, 744]` (WebKit).
      Green: 14/14 at 0 and at 700, on the commit's own code, with plan-days 26,
      plan-drag 38 (+1 skip), plan-share 39 and plan-stop-ends 6 at 0 there.
   b. **Items 4–6, the model (f6196de).** A night whose only pick is a drop-in has its
      own reason (`dropin`) and no empty line under its drop-in line. A drop-in seat no
      longer moves the site or marks the grounds as left, so a must on a drop-in at
      another venue can't pull anyone off the grounds. rowsKey carries each drop-in
      line's clock (open, over), and the shelf's key reads rowsKey alone (44a80e5, no
      behaviour change). **Red first:** the rule 9 seating test got `'scattered'` for
      `'dropin'`; the new trip test kept only `['4 PM Early']` (Late at 10 PM lost);
      plan-text's drop-in-only night gave `[0, 1, 'scattered']`; plan-stop-ends test 6
      found one key drawing two row sets: `portola-2026, the Despacio crew, 2026-09-26
      2:40 PM → 3:25 PM, one key: …drop in 2:45 – 9:45 PM7picked → …drop in till 9:45
      PM7picked`. Green: plan-model 54/54, plan-text 13/13, plan-stop-ends 6/6.
   c. **Items 7, 8 and 10, motion (9d68c34).** Item 7: the turn now plays on the head a
      person sees (the panel's head line on a laptop). Item 8: a close from a later day
      holds that day's rows and head while they fade, and paints today's head once the
      fade is done. Under it was a bigger bug: the window was measured while the list
      was still scrolled, so the peek's row came to rest about 510px off the dock (the
      peek showed the wrong rows). The list now goes back to the top before measuring,
      and the peek's row comes down to its place. Item 10: the Share's mark fades and
      narrows on a bare day instead of `display: none`. **Red first:**
      - Close: `while it closes, the head and the rows are Sunday's: 9 of 9 frames are
        not, from {top:55, wd:SAT}` (WebKit 8 of 8). With that check off, `the peek's
        row ends on the dock: 511` (WebKit 508).
      - Laptop turn: `the panel's head line rose in from below: [{part:wd,
        where:head…}, {part:sub, where:head…}]` (the turn played on the hidden head).
      - Share mark: `{display:none, opacity:1, width:13px, eased:false}`.
      Green: plan-days 30/30 at 0 and at 700.
   d. **Item 9, the Share's words (b0b5642).** The words are the button's name and no
      longer a live region. A copy's result is said once, in an sr-only span beside the
      button. **Red first:** `nothing a screen reader would say again… actual: [ 'Copy
      today's picks', 'Copy today's picks' ]`. Green: plan-shelf 17/17.
   e. **Item 11, the sweep's cost:** done earlier, by 628d855 (the Share sweep draws
      without paint: 288 s to 50 s, main's 58 s).
   **The question for Kevin: a plan that fits.** DESIGN.md B7 says the list brings the
   last day to the top "so Sunday can be read and shared from the head like any day".
   A plan short enough to fit the phone's shelf has nowhere to scroll. As built it gets
   no room: the head and the Share stay on today while Sunday's rows sit in view above
   the Share, which is close to what B's first alternative says a Share button must
   never do. The button does say "Share today's picks", which softens it. The same
   happens when a repaint makes a plan fit while a reader is on Sunday (the minute
   folding a stop): the view goes back to today. The choices I see:
   (1) While a plan has a later day, the open shelf takes its full height, so every day
       can come to the top. This is what the laptop panel already does. It costs blank
       space under a short last day. A today-only plan stays content-sized.
   (2) Each later day in a plan that fits gets a small Share of its own on its head.
   (3) Leave it as built.
   I lean (1): it keeps one rule (the head and the Share are the day at the top) and
   removes the repaint case with it. I haven't built it.
8. **P5, ACL ready (builder, 2026-09-27).**
   a. **a2297fb, the days list and Earlier's span** (`tests/plan-acl.test.mjs`, the real
      shell in jsdom, the ACL crew of eight). There are 147 golden lines at six moments,
      each read against the model's routes and the data before freezing:
      - Tue Sep 29 6 PM: every night ahead, with the bare Mon · Tue as one head.
      - Mon Oct 5 and Tue Oct 6: no peek. A later night's peek is tomorrow's only
        (Kevin, 2026-09-26), and Thu is not tomorrow.
      - Wed Oct 7 noon: the plan opens on Thu, "Earlier · Sep 29 – Oct 6".
      - Sat Oct 10 4 PM: Earlier shut ("Sep 29 – Oct 9") and open (the past under
        dimmed heads).
      - Sun Oct 11 9 PM, then 11:30 PM with the plan still open: "Nothing left today".
        A close then takes the shelf away.
      There is no behaviour change, so there is no red-first run. As a mutation, night
      labels always the weekday fail three of the four tests (`also Sun, Sat` for `also
      Oct 4, Oct 10, Oct 11`).
   b. **f577682, in a real browser** (`tests/browser/plan-acl.test.mjs`).
      - The Share per night. From Tue Sep 29 6 PM the list is brought to each of the
        ten places a day can sit at the top: today, Thu Oct 1 to Sun Oct 4, the Mon ·
        Tue run once, and Thu Oct 8 to Sun Oct 11. (The commit message says eleven;
        it is ten.) What the Share says and sends at each is golden. Today's reads
        from now; the others read whole, each link opening on its night; the bare run
        rests ("Nothing to share Monday"). Every picks line is a row of that night.
        Chromium and WebKit send the same texts.
      - The Late nights, opened Mon Sep 28. All 66 entries sit on their 10 dates
        (2, 7, 16, 13, 4, 3, 3, 10, 4, 4), and each card's time is drawn, visible and
        inside its card. The 31 guesses carry the tilde. This holds on the Board and
        in the List. The List is set as this phone's view, because a link's `&view=`
        only starts a phone that has never shown the festival; the test asserts 66
        rows to prove the List was on.
      There is no behaviour change. As a mutation, dropping the tilde in events.js fails
      both Late nights views: `2026-09-29 Fcukers: its time is ~8:45 PM, drawn "8:45
      PM"`. 6/6.
   c. **Seen on the way, for Kevin's look (not changed):**
      - **"Also" across ACL's two weekends depends on whether the stage moved.** A
        festival set's play is `stage|weekday` (plan.js, since the Our plan model), so a
        repeat on the same stage is one play and a moved one is two. Faouzia (Miller Lite
        W1, American Express W2) reads "also Oct 9" and counts as a doubled pick. Paris
        Paloma (Miller Lite both weekends, 3:15 then 5:15) doesn't. Fcukers on Sun Oct 4
        says "also Sep 29, Oct 10" but not Oct 11 (Tito's both Sundays). Whether ACL's
        weekend repeats are one play or two is a model call; either way it should not
        turn on the stage.
      - A bare run's head reads "MON · TUE" in the list, but the panel's head and the
        Share say only Monday ("Nothing to share Monday").
   **Gate on f577682** (the review's fixes and P5; bb99070 after it adds only this log):
   `npm test` 1292 tests, 1289 pass, 1 fail (the SW stamp, left for the lead), 1
   skipped, 1 todo. Every browser suite at 0, one at a time, and the plan suites at 700
   too. At 0 and 700: plan-acl 6/6, plan-days 30/30, plan-drag 38/39 (the WebKit
   keyboard skip), plan-share 39/39, plan-stop-ends 6/6, plan-tail 14/14. At 0:
   now-jump 61/61 (61/61 at 700 too, run on 9d68c34's code), people-menu 24, by-time
   4, error-report 1, fold-intent 4, guest-tap-route 6, heads 7, hover 11, import-flow
   4, list-view 12, meter 27, shell 11, show-links 6, show-menu-stacking 2, stack-row
   9, strip-follow 3, tap-shelf 31, touch-ghost 2, zoom-chips-burst 8, zoom-chips 45,
   zoom-chrome 18, zoom-door-row 8, zoom-notes-chip 1, zoom-still-hand 6. All green.
9. **The CI round and Sol's first review (builder, 2026-09-27).** CI's browser job had
   two Linux WebKit reds; Sol reviewed 0f076a6 (`SOL-R1.md`) alongside. One commit per
   item, each red first on the code before it.
   a. **A, the glide on Linux WebKit (DIAG 471ae9b, fix eca35e2).** The diagnostic
      answered the question before any fix. On CI's Linux WebKit the app's one ask,
      `scrollTo({top: 508, behavior: 'smooth'})` from 0 once the window had landed,
      fired ONE scroll event, at 508, and a Node sampler saw 0 then 508. A scratch
      scroller on a clock-free page moved `[0, 1964, 2000]` over 673 ms (Node saw
      1416 once). So the engine does move in time, but in two or three steps, too
      coarse for a test (or an eye) to see rows go by. Chromium showed 44 positions
      for the same probe; a Mac's WebKit a dozen. Linux WebKit is not a platform a
      friend uses, and a real Safari animates it, so I found no reason to drive the
      glide from script: the app keeps the native glide. The tests are now engine
      aware: every engine is held to the intent (one ask, `smooth`, from tonight's
      top to Sunday's head, made once the window had landed, and the list moving only
      after), and "through the rows between" is asserted only where a probe sees the
      in-between. The probe asks a scratch scroller in a settled app page (the tests'
      own fake clock and late starts) for 500px and counts the places its scroll
      events report; three or more, as the glide test counts, means it shows. It runs
      once per engine and prints its verdict with `t.diagnostic`. The carry-on test
      skips where it doesn't show ("no mid-glide to repaint in"), and where it does it
      now also checks the new list was asked to carry on from where the old one had
      got to, to Sunday's head. The diagnostic code is gone. CI on eca35e2 (run
      36319088534) bears it out: Linux WebKit's probe saw 2 places in 540 ms, its link
      test passed on the intent (`[508]` went to a diagnostic) and the carry-on
      skipped with its reason; Linux Chromium saw 22 places and ran both whole.
      The probe did not last: it flipped on a later run, and k replaces it.
   b. **B, the bare run's Share mark (b66da93).** Read at the end of its transition
      (the mark's own animations finished, 3 s real-time cap), not at a fixed moment.
      Proved by holding the transition open at 1.5 s: the old read failed, the new one
      waited.
   c. **C, the welcome card at WebKit 1280 (run 36310811089): not this branch.** The
      same test timed out waiting for the peek in 4 of the 147 failed runs among CI's
      last 200 (all branches, since 2026-09-26 17:37Z): this branch's b0b5642,
      back-pocket/composer-probe bc6a61e, live/share 89a3f92, and release/share
      dccf078, which is in origin/main. This branch never changed the welcome → peek
      path (only openPhone's clock in plan-drag, the highlight condition in paintPlan,
      and openPlanForLink). A flake on main's code; not fixed here.
   d. **Sol 1, the blocker: a redraw keeps the reader's place (625f82b).** draw() kept
      the list's scrollTop, a number: a friend's pick above Sunday slid Sunday down
      under it, and the head and the Share turned to Saturday. The place is now the row
      nightAtTop names (its night and stop), how far into it the list's top edge sits,
      and the rows after it on that night. It is taken on every scroll the reader or a
      glide makes (not one a width change made), and put back after every draw, settle
      and refit, before the head is painted. A row that has gone hands its place to the
      next of its night, then the night's head, then the nearest later night. A glide
      keeps aiming at its night and, on the list it is scrolling, is asked again only
      if the night moved (a smooth scroll asked twice restarts its curve).
      **Red first** (plan-tail): `Chromium: a friend's pick that adds a Saturday stop
      above…: Sunday's head is still at the top: 81.84375 (scrollTop 521)` (all four
      layouts × engines red, 81.1–81.8); `WebKit: crossing 390 → 1280…: 64.109375
      (scrollTop 454)` (Chromium's own scroll anchoring hid the crossing there). A
      removal above passed on the phone before (the tail's exact room clamps it). The
      laptop's removal and a highlight while on Sunday failed at scrollTop 0 before
      and after: both leave a plan that fits, which had no room, so they went in with
      D.
   e. **D, the short-plan default (d621145): item 7's question, answered with its (1).**
      Kevin's to overrule. While a plan has a later day, the phone's shelf is laid out
      at its cap, peek and open alike, and its list fills the window with the Share at
      the foot; the list keeps the room to bring every day to the top. A plan whose
      last day is today stays content-sized.
      The laptop's panel was full height already; its list now fills it too while a
      later day exists. The fill matters: a list sized by its rows is sized by the
      room under them, and the room is measured from the list's box, a circle that
      left the laptop's short plan unable to reach its Sunday (found on the way,
      measured: the new list 589px tall with a 223px room, then 654 with 446, the
      scroll range short of Sunday by 65px). showGrown's floor needs no change: at the
      cap it never pins, it scrolls. plan-tail's "plan that fits" test is now the
      today-only plan (ACL's last Sunday, The xx), and still asserts no gap under the
      last row and no resize through open and close.
      **Red first:**
      - ACL short plan (the made-up three: Arcy Drive now, The xx Sunday): `the open
        shelf takes its full height: {"h":530.67,"cap":743}`; laptop `Sunday's head is
        at the top: 222.67`.
      - The repaint case (the crew's plan, the minute folding Arcy Drive leaves it
        short): `after the fold Sunday's head is still at the top: 340.05 (scrollTop
        0)` (338, 325.69, 323).
      - Open and close: `the peek is laid out at the full height: {"h":530.67,
        "cap":743}`.
      - Sol's two that needed it: laptop removal `419.08 (scrollTop 0)`, highlight
        `under the menu … 186.28 (scrollTop 0)`.
      A short plan whose day turns while open (the last stop of Saturday ends: the
      peek becomes tomorrow's) drops to content-sized; the redraw slides the window's
      top down to it (play), and the test holds the head and the Share on Sunday.
      **For Kevin's look:** with a later day the Share sits at the window's foot, on
      the laptop too, under blank room when the plan is short (it always did for a
      plan that overflowed). That is not a separate choice: a list with the room to
      bring its last day up is always at least its box's height. Screens of the
      made-up three, phone and laptop, were checked by eye.
   f. **E, "also" across ACL's weekends: no change.** PLAN.md §5 question 5 settles it
      with Kevin's default: "only a different place does" count as playing twice, so
      `stage|weekday` is intended, Paris Paloma's same-stage time shift included (8c).
   g. **Sol 2, the morning after (2e6fe66).** Past 5 AM after the festival's last
      night, a plan left open fell back to that night with no clock, and Sunday came
      back whole, undimmed, its Share on. Chosen: keep it open, drawn as a night
      before today (dimmed under its head, as an opened Earlier draws one); its Share
      names it by its date and sends it whole, as any past night's does; a close lets
      the shelf go. Why not close at the rollover: a clock tick would take the plan
      from under a reader (the same rule that keeps an open plan a highlight emptied),
      and a past night is already shareable whole from an opened Earlier, so this is
      the same object, not a new one. **Red first:** the ACL golden's new crossing
      (Sun Oct 11 11:30 PM open, then Mon Oct 12 5:01 AM) got Sunday's four lines
      without a head or `(past)`; the browser case, both engines, `Sunday under its
      own head: [{"past":false,"head":false,"dim":false}, ×4]`. Green: the goldens
      5/5, plan-acl (browser) 8/8, and the new case at 700.
   h. **Sol 3, the nit (51e28cb).** The Share helpers in plan-acl, plan-days and
      plan-tail wait for the stub's text on the real clock (4 s), then a beat to see
      one text came, not two.
   i. **The past's dim, found by CI on eca35e2 (9052fb7).** Run 36319088534: the
      morning-after case read two of Sunday's five lines undimmed on Linux WebKit.
      The coordinator suspected a read mid-fade, and it was that and something real
      under it: `.plan-row.past` and `.plan-day.past` dimmed with the row's own
      opacity, the property every fade of the window's writes (a repaint's play,
      Earlier's arrival, the drag, the open). A past line faded in to full, then
      dropped to .42 at the end: a pop, since P2. The dim is now `filter:
      opacity(.42)`, which multiplies with the fades; the look at rest is the same.
      **Red first**, each motion held at 95% of its run: the morning after, `a past
      line never shows brighter than it rests, even as it arrives (10 motions held
      near their end): [… "lit":1 ×5]`; Earlier opened on ACL's second Saturday, `(55
      motions held near their end): [1,1,1, … ×37]`. Both engines, green at 0 and 700.
      The morning-after case now reads brightness (opacity × any opacity filter) at
      rest, not a computed opacity mid-fade.
   j. **The place's width guard, found reading my own diff back (2679514).** Sol 1's
      guard told a reflow from a reader's scroll by the list's clientWidth, which also
      moves with the list's own scrollbar where one takes room (Windows, a Mac with a
      mouse). A repaint mid-glide measured the new list before it was the open,
      scrolling list, 15px wider than it became, and the settle after it only re-aims
      a glide. So every scroll after that read as a reflow and was never taken, and
      the next settle or repaint put the list back where the glide had been when the
      tick came. The guard now reads offsetWidth, the list's box, which only a real
      layout change moves. Playwright hides every scrollbar in headless Chromium, a
      styled one included, so `launchBrowser({ scrollbars: true })` gives them back
      and the test styles a 15px one.
      **Red first**, on a racing glide: `Chromium laptop, a scrollbar that takes room:
      the repaint kept the reader where they were: {"row":"…|Public Works|1375",
      "at":-32,"scrollTop":276} → {"row":"…|Crane Stage|1335","at":0,"scrollTop":30}
      (the tick came at 30)`. WebKit passed on that version (a refit landed after its
      glide). On the held glide (k) it is red on both engines at 0 and 700: `Sunday's
      head is still at the top once everything has settled: {"row":"2026-09-26#…|Crane
      Stage|1335","at":0,"scrollTop":30}`. The landing snapped back to where the glide
      was held.
      A second suspicion did not hold: that a repaint waiting for a hand on the open
      window left the list unscrollable. Its test passed on the old code (the refit
      after the draw restores it), so the test was dropped and nothing changed.
   k. **No runtime probe for the glide (98548e4; the coordinator's call after CI run
      36323629568).** A's probe flipped. On 2679514 it counted 3 places on CI's Linux
      WebKit (1 and 2 on the runs before), read that as a glide, and ran three glide
      tests there. The list itself still landed in one step, and all three failed:
      `[508]`, `the repaint came mid-glide (at 448, Sunday at 448)`, and j's test
      with `the tick at 433`. That third red was the same dependence, not a problem of
      its own: the list had landed before the tick came. Now:
      - Every engine is held to the app's part: one smooth scrollTo to the night's
        head, once the window has landed.
      - "Through the rows between" and a repaint racing the engine's own glide are
        Chromium's (`ANIMATES`), with the reason in the test. The frames are the
        engine's job once the ask is right.
      - The held glide (open's `holdGlide`, in the scrollTo recorder) stops the first
        smooth ask 40% of the way and lands every later ask at once, so a repaint
        comes mid-glide on any engine, every time. The carry-on runs on it on both
        engines, with a friend's pick as the repaint. (The minute that ends Dog Blood
        takes away the grown card the list is held in, and the place passes to the
        next row by design; the racing test takes that path.) j's test runs on it too.
      Seen on the way, not changed: a pull's answer is drawn twice, some 50 ms apart,
      on both engines. WebKit's second draw can land before the glide's landing event
      and re-ask the same spot (a no-op, allowed by the test).
   **Gate on eca35e2** (A to Sol 3; 9052fb7 after it changes only the past's dim and
   its two tests): `npm test` 1293 tests, 1290 pass, 1 fail (the SW stamp, left for the
   lead), 1 skipped, 1 todo. Every browser suite at 0, one at a time, and the plan
   suites at 700 too. At 0 and 700: plan-acl 8/8, plan-days 30/30, plan-drag 38/39 (the
   WebKit keyboard skip), plan-share 39/39, plan-stop-ends 6/6, plan-tail 38/38. At 0:
   now-jump 61/61, people-menu 24, by-time 4, error-report 1, fold-intent 4,
   guest-tap-route 6, heads 7, hover 11, import-flow 4, list-view 12, meter 27, shell
   11, show-links 6, show-menu-stacking 2, stack-row 9, strip-follow 3, tap-shelf 31,
   touch-ghost 2, zoom-chips-burst 8, zoom-chips 45, zoom-chrome 18, zoom-door-row 8,
   zoom-notes-chip 1, zoom-still-hand 6. All green.
   **On 9052fb7, again:** the six plan suites at 0 and 700 with the same counts, now-jump
   61/61 at 0, and `npm test` the same (the stamp alone red). CI on 9052fb7 (run
   36320693628): the browser job green, 463 tests, 459 pass, 0 fail, 4 skipped; the
   glide carry-on on Linux WebKit is the only new skip (its probe saw 1 place in 344
   ms, Linux Chromium's 22 in 430 ms). The checks job is red on the SW stamp alone.
   **Gate on 2679514 and 98548e4** (j, then k, which changes only plan-days' tests):
   on 2679514, `npm test` the same (the stamp alone red) and every browser suite at 0,
   one at a time, with the plan suites at 700 too, all green with the counts above but
   for plan-days, 32/32 with j's test. On 98548e4: plan-days 33/34 at 0 and at 700 (the
   racing carry-on skipped on WebKit, with its reason), the glide tests three more times,
   and `npm test` the same. CI on 98548e4 (run 36326580757): the browser job green, 467
   tests, 463 pass, 0 fail, 4 skipped (the WebKit racing carry-on and the three older
   skips); the checks job red on the SW stamp alone.
10. **Sol's recheck and the walk's catch (builder, 2026-09-27).** From d5731a9: Sol
    rechecked daf9c3b (`SOL-R2.md`, with the lead's check of each point) and the
    real-input walk passed on both engines, phone and laptop (`WALK-1.md`). One
    commit per item, each red first on the code before it where behaviour changed.
    a. **A repaint during a close brought the shelf back (3f5a337).** A plan with no
       row to close to (the morning after, a highlight emptied it) leaves from open,
       and `mode` stays open until the leave ends. planIsOpen() said open all through
       the leave, so a tick or a friend's update in that motion got planAnswer's
       fallback answer (the rule that keeps an open plan a highlight emptied), and
       paintPlanShelf took it for an arrival: cancelLeave, draw, arrive. The shelf
       came back as a peek with no row. planIsOpen is now open and not leaving. Each
       caller in app.js:
       - planAnswer's fallback (~1335) no longer keeps a closing plan: the answer is
         null and the leave runs on.
       - The people menu's row (~1441, 2462) and a plan link (~1471–1482) ask
         planHere() first, which already said no while leaving.
       - Escape (~5057) passes a closing plan by. Its close is under way, and with
         nothing else open the fall-through does nothing.
       **Red first**, both engines. The tests dispatch the repaint from a document
       pointerup listener, which runs right after the shelf's own pointerup starts
       the close. The morning after (plan-acl, Mon Oct 12 5:01 AM, the close at 5:02)
       and a highlight that empties the plan (plan-days, Gus + Hal at 9:40 PM, the
       close at 9:41) both read `the repaint did not bring the shelf back:
       {"was":{"hidden":false,"state":"open","moving":1},"then":{"hidden":false,
       "state":"peek"}}`. Green at 0 and 700, and each test holds the shelf gone at
       the next minute. The highlight test now filters the harness's service-worker
       throw on visibilitychange, as the other tests do.
    b. **The pinned height after a later day goes: logged, not changed.** A tap pins
       the phone shelf's height while it is open (main's rule: the window never moves
       under a finger; unpinned on the open, the close, an arrival, and a refit
       whenever the shelf is not open). If the later day goes while the shelf is open
       (the 5 AM rollover, a highlight, an unpick), the blank room under the last row
       stays until the close. That is the look the short-plan default (9e) already
       has, and resizing under a reader is worse.
    c. **The crossing tests wait for the new layout (2ab870a, Sol's nit).** plan-tail's
       layout-crossing tests slept 400 ms after setViewportSize. They now poll from
       Node, on a 4 s real-time deadline, until the shelf's side says the new layout
       (`data-side="open"` for the open laptop panel, none on the phone; settleState
       writes it), then wait for the motion. The flag flips both ways, so each wait is
       real. Green at 0 and 700.
    d. **Sol's grown-card "blocker": refuted, now guarded (ca12ba2).** Grown cards do
       carry `data-night`: planDays' night() tags every row dayRows returns, grownEl's
       included. plan-text now asserts every direct child of the list names its night.
       It runs with every stop grown and Earlier shut and open, on Portola (Sat 9:40
       PM, Sun 5 PM, and Gus + Hal, whose days are empty) and ACL (Tue Sep 29 with the
       bare Mon · Tue ahead, and Sat Oct 10). It also asserts the cases drew grown
       cards, empty lines and a bare run's rows, so the coverage it names is real. No
       behaviour change. As a mutation, a tag() that skips `.plan-grow` fails it.
    e. **The Earlier line is never cut (8f76795, the lead's look at the walk).** On
       Portola Sunday at 390px it read "EARLIER · THU · FRI · SAT · 4 S…". Its words
       had only the name's column (138px at 320, 192px at 390), with the time and
       count columns empty beside them. Two changes:
       - Three nights behind on consecutive dates are one range, "Thu – Sat", the way
         a bare run is "Oct 5 – 6". Three with a gap keep their labels. Two stay as
         the wall writes them ("Thu · Fri"): a range would be no shorter. Past three
         nights, the date span stands. isoAfter moves to plan.js, shared with app.js's
         tomorrow check.
       - The row has no time and no count, so its words run to the row's end
         (grid-column 2 / 5), padded clear of the chevron. The chevron keeps its place
         at the end of the count column. Spanning the time column alone left ACL's
         "SEP 29 – OCT 9 · 2 STOPS" 2px short at 320.
       bd7a0cb then drops a wrapper 8f76795 added for nothing (the range reads
       nightLabelOf directly). Its message says "plan-text 16/16"; the count was 15/15.
       **Red first:** plan-days, measured, both engines, Portola Sun 9 PM: `the Earlier
       line's words fit their box: {"text":"Earlier · Thu · Fri · Sat · 6
       stops","scroll":210,"client":138}` at 320 (client 192 at 390). plan-text's
       range test read `'Earlier · Thu · Fri · Sat'`. Green at 320 and 390 on Portola
       Sunday and ACL's second Saturday (9 PM, stops folded), at 0 and 700. The
       chevron is asserted at the row's end, clear of the words. Checked by eye, shut
       and open, at 320, 390 and 1280.
       **For Kevin's look:** a two-night Earlier stays "Thu · Fri". Say if you'd rather
       every consecutive run read as a range.
    f. **The composer flake:** its cause (notes.js dialogize's held-frame focus) is
       fixed on fix/composer-focus, riding v104.
    **Gate on 435f92b** (the round's last code; dfdec8d after it is the lead's NOW line),
    started 09:29 PDT: `npm test` 1295 tests, 1292 pass, 1 fail (the SW stamp, left for
    the lead), 1 skipped, 1 todo. Every browser suite at 0, one at a time, and the plan
    suites at 700 too. At 0 and 700: plan-acl 8/8, plan-days 37/38 (the WebKit racing
    carry-on skipped), plan-drag 38/39 (the WebKit keyboard skip), plan-share 39/39,
    plan-stop-ends 6/6, plan-tail 38/38. At 0: now-jump 61/61, people-menu 24, by-time
    4, error-report 1, fold-intent 4, guest-tap-route 6, heads 7, hover 11, import-flow
    4, list-view 12, meter 27, shell 11, show-links 6, show-menu-stacking 2, stack-row
    9, strip-follow 3, touch-ghost 2, zoom-chips-burst 8, zoom-chips 45, zoom-chrome 18,
    zoom-door-row 8, zoom-notes-chip 1, zoom-still-hand 6, all green. tap-shelf 29/31:
    the two reds are the clock below, not this round.
    CI on 8f76795 (run 36332455417), 435f92b (run 36333299701) and dfdec8d (run
    36333619449): the browser job green each time, 471 tests, 467 pass, 0 fail, 4
    skipped; the checks job red on the SW stamp alone. All three ran before 10 AM PDT.
    **From 10 AM PDT on Portola Sunday the suites fail on the machine's clock, on main
    too.** Aftershock (Folsom, Saturday night, 3 AM - 10 AM) is Saturday's last window.
    Once it ends, the wall judges Saturday over and folds it behind the Earlier line
    (wall.js foldPast), so Saturday's cards and heads leave the DOM. Every test that
    boots Portola on the machine's clock and reaches for a Saturday card then reads
    null. A browser probe on this build, Chromium at 1280: at 9:55 AM Saturday's block
    is drawn with Tove Lo in it; at 10:05 AM the wall is Sunday alone under "Earlier ·
    THU · FRI · SAT". The same tests fail the same way on a main snapshot (250bc45).
    - `npm test` at 10:38 AM: 63 fail, the stamp and 62 in 11 files (tap-shelf 23,
      first-open-guest 13, zoom-door-row 8, first-open-guest-doors 8,
      first-open-joins-hold 3, warm-open-shared-file 2, warm-open-custom 2, warm-open,
      offline-add-casing, first-open-tap-welcome, first-open-shelf-close). The night
      clock proves the cause: at 9:50 AM tap-shelf, first-open-guest, zoom-door-row and
      warm-open pass, and at 10:05 AM they fail 23, 13, 8 and 1. With the whole suite
      pinned a week before (NIGHT_CLOCK=2026-09-19T16:00:00Z) it is the stamp alone.
    - The browser suites: tap-shelf's keyboard test went red in the gate at about 10
      AM, in both engines (`page.evaluate: TypeError: null is not an object
      (evaluating 'el.scrollIntoView')`). It boots on the machine's clock on purpose,
      because Playwright's fixed clock holds requestAnimationFrame. A second sweep at
      0, from 10:11 AM, added heads-contract's long name and "Portola hidden" tests,
      whose openPhone pins a clock only when a test asks. Every other suite was green.
    The failures last until Sunday's night is over. Its last window, Real Bad 37, ends
    at 5 AM Monday, and a festival over from end to end folds nothing: the probe has
    Tove Lo gone at 4:55 AM Monday and back at 5:05. ACL's weekends
    will do the same to any test that boots ACL on the machine's clock. The lead has
    the fix, verified and not committed here, because the tests are main's.
    - The browser tests: tap-shelf's keyboard test offsets Date alone in the page to the
      Saturday 3:15 PM its file's other tests use (night-clock.mjs's move; frames and
      timers stay native). heads-contract's openPhone always pins, a week before unless
      a test names a moment. After 10 AM both files were green: tap-shelf 31/31, and
      heads 7/7 twice.
    - The unit suite: one pin for the whole run, or a clock for each of those 11 files.
      That is the lead's call.

11. **Sol's final check, and the combined head (builder, 2026-09-27).** From 958d96e:
    Sol's two findings on af238e9 (`SOL-R3.md`), red first; then v104 (live/v103), the
    composer fix and the test-clocks fix merged in, never rebased. The plan changed
    mid-round (Kevin, via the coordinator): plan-days ships today as v105, before
    Despacio's Sunday set, on top of v104, which the coordinator releases to main.
    a. **The Earlier line wraps rather than cut (ea1fc0e).** 8f76795 widened the
       line's box, but its words still inherited `nowrap` and the ellipsis from
       `.plan-what .nm`, and three nights that are not consecutive keep three labels.
       The longest real case: ACL's first Saturday is the one night with three behind
       that are not consecutive (Sep 29, Oct 1, Oct 2, each a date because its weekday
       comes twice). A crew that picked every act that night, on the grid and at the
       late shows, has 13 stops. At 1:50 AM the last is on and 12 are over. From 2 AM
       the plan lands on Sunday, and the line is a span. The test builds that crew
       from ACL's own data (`ACL_ALL_SAT`).
       - **Red** on the old CSS at 320, both engines: `the Earlier line's words fit
         their box: {"text":"Earlier · Sep 29 · Oct 1 · Oct 2 · 12 stops",
         "scroll":260,"client":246}`. At 390 the same line fits on the old CSS (260
         of 314px), so 390 holds it to one line rather than going red.
       - The fix: the line wraps (`white-space: normal`, no clip), and each label and
         the count stay whole (`b { white-space: nowrap }`), so "SEP" never parts from
         "29". The chevron keeps its 22px. At 320 it reads "EARLIER · SEP 29 · OCT 1 ·
         OCT 2 ·" over "12 STOPS".
       - Green: two lines at 320, counted by line height (a flex item has one client
         rect whatever its lines). Every label is on one line. The node and the row
         are within 1.5px of the words' middle, and the chevron within 2.5px: its
         translateY(-2px) inside a 45° turn lifts its box about 1.4px, an optical
         centre. Portola Sunday and ACL's second Saturday stay one line.
    b. **The night guard asserts the right night (8a91df1).** ca12ba2 checked that
       every row names a night. The guard now reads the night a row belongs to from
       what the row is, its `data-stop`, and requires `data-night` to match:
       - a stop's key starts with its night;
       - grow, or and dropin carry that key after their tag;
       - day, empty and scattered name their night;
       - the Earlier line takes the first night behind.
       At each day head, the first row after it is the head's night, and the row
       before it is its own night, never the head's. Coverage over its five cases,
       with Earlier shut and open: 165 grown cards, 42 heads, 28 grown cards right
       before a head, 36 stops right after one. **Red** as mutations of plan-rows.js
       in a scratch copy, because the code was right and the old guard couldn't have
       shown it. Each mutation passed ca12ba2's guard and fails this one: the first
       row after each head tagged with the night before; every grown card tagged
       with the night after; each head tagged with the night before.
    c. **live/v103 (5860ac4), with the brief's resolutions.**
       - pastMayMove keeps both guards (`sharing`, `pendingThin`).
       - setPeopleFilter takes v103's branch (the List thins, the Board dims), then
         paintPlan with plan-days' comment (the plan re-plans).
       - wall.js takes v103's side of both hunks. thinnedWords is defined once,
         and app.js still imports it for Our picks' empty day.
       - `passesPeople` is still the one predicate: wall.js (the dim, listKeeps),
         app.js (thinFlow) and plan.js (the route).
       Auto-merged and read: v3.css (the quiet room, NOW first in the day row),
       index.html (NOW inside `#dock-days` and `#rail-days`; no plan-days code
       reads those rows' children), the harness's `nowInView`, and now-jump.
    d. **fix/composer-focus (0b88475)** merged clean.
    e. **fix/test-clocks at eded04e (c52bff1).** launchBrowser keeps plan-days'
       `scrollbars` option, with each launch wrapped in pinByDefault.
       `tests/test-clocks.test.mjs` passes 7/7. Every plan suite, and v103's
       people-menu, list-view and now-jump, sets page.clock before its first
       navigation, so none inherits the week-before default by accident.
    f. **Not fixed: now-jump's "WebKit 320: Ross highlighted".** It went red three
       times on CI (40f8a0b, probe/composer-main, eded04e): row scrollLeft 38 of a
       40 max, the card's right edge at 308.04 against the row's 306. It comes with
       v104's content. The coordinator accepts it read by name for v105. Next: is
       38 of 40 the app landing short, a target measured before a late font refit,
       or rounding?
    g. **One NOW under a hand (ccd23ba).** Sol, on the v104 release (in the shelf
       since v103): while a hand holds the window, the new answer waits in `data`
       for its rows (flushHeld), and planShowsNow read `data`. So at a NEXT→NOW
       minute with the grabber held, the day row's NOW stepped aside while the peek
       still read NEXT, and there was no NOW anywhere. The other way round, there
       were two. planShowsNow now reads `drawn`, the answer the rows on screen came
       from, cleared with `data`. flushHeld calls the answer's `onDrawn`, which is
       app.js paintNowTabs, so the tab asks again once the held rows are drawn.
       **Red first** in plan-drag, both engines. Portola Saturday, the peek is NEXT
       at 4:44 PM and NOW at 4:45. A hand moves past the tap slop, comes back, and
       holds still. The clock crosses the minute and the tick runs.
       - Old code: `{"tab":false,"peek":"next","count":0}` under the hand.
       - `drawn` without the hook: `{"tab":true,"peek":"now","count":2}` after the
         release.
       - Green: one NOW held (the tab, with the peek still NEXT), and one after the
         release (the peek's), still a peek.
    h. **The gate at c52bff1** (from a snapshot, 11:55 AM-12:08 PM PDT):
       - `npm test` 1354 tests, 1 fail, the same with CI's night pin and in
         TZ=Asia/Tokyo. The one fail is the unstamped service worker, expected: the
         stamp is the coordinator's.
       - plan-share 39/39, plan-drag 38/39 (its WebKit skip), plan-days 37/38 (its
         ANIMATES skip), plan-tail 38/38, plan-acl 8/8.
    i. **The gate at ccd23ba**, in the worktree, 12:10-12:20 PM: `npm test` 1354
       tests, 1 fail, the stamp. plan-drag 40/41 (its WebKit skip), people-menu
       24/24, list-view 20/20, fold-intent 4/4, zoom-still-hand 6/6, now-jump 62/62,
       plan-stop-ends 5/6: item j.
    j. **plan-stop-ends' corner card and the rail's ResizeObserver (25b17f0).**
       WebKit 1280, "Sunday 7:58 to 8:22 PM, minute by minute", went red on
       'ResizeObserver loop completed with undelivered notifications.' from the
       live/v103 merge on: green at 958d96e and ea1fc0e, red at 5860ac4, c52bff1
       and 374c3df, 2 of 2 at the head. live/v103 has no such test. v103 put NOW
       in the rail's day row, so a tick that shows or hides it resizes
       `#rail-days`, whose observer (wall.js wireScrollspy) re-fits that row's gap
       in its own callback. Instrumented: the `#rail-days` callback, the notice in
       the same millisecond, then `#rail-days` again the next frame. This is
       TAP-BUILD.md follow-up 6: the browser's notice, not the app's error
       (errlog.js drops it as noise). The test now lets it by, as plan-drag,
       plan-share, tap-shelf and the smoke already do. Every NOW assertion holds,
       6/6. The rail's own fix is still open, and a minute tick at 1280 now makes
       it happen every time rather than under load.
    k. **origin/main, v104 stamped (374c3df).** Clean. service-worker.js is main's
       (festival-nav-v104, 82d97c76). No stamp here: v105's is the coordinator's.
       pastMayMove is one return with both guards, and nothing calls parkNowTab,
       which v104 removed. `npm test` at the default clock: 1354 tests, 1 fail, the
       stamp. The one-NOW fix (ccd23ba) went in before this merge.
