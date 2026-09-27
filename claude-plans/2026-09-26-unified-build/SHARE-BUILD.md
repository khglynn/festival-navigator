# Sharing our picks — the build (2026-09-26, from 2:40 PM PT)

Branch `live/share`, cut from main at b1301a7 (v101, Our picks, live). The design
round and Kevin's answers are in `OUR-PLAN-BUILD.md` ("Kevin's Share answers"); the
frames are in `share-design/` on `live/plan-share`. The coordinator stamps, opens the
PR and merges; this branch is never stamped here.

## Scope (Kevin's answers, the coordinator's go at 2:40 PM)

1. **Share our picks** at the open plan's foot, phone and laptop. It hands the share
   sheet the day as text, in Kevin's shape:

       Our crew's main picks for Sat Portola, now till end of day

       Pier Stage for Dog Blood @ now till 10:15pm
       Ship Tent for … @ 10:30pm
       …up to five

       Full rundown: https://fest.kevinhg.com/f/portola-2026#g=…&f=portola-2026&plan=open

   The five are "our top picks overall across all locations based on applied filters":
   the day's stops and their or-lines still to come, the people highlight applied,
   hidden rooms already out (the plan's rule 8), ranked by how many of us, then listed
   in time order. No names of people. With no share sheet it reads **Copy our picks**
   and copies the same text.
2. **`&plan=open`** on that link: read once at boot, beside `&view=`, never written to
   the crew doc or the address bar. A member lands on Our picks open; a newcomer gets
   the welcome card first and the plan opens when the card goes. A day with no plan
   drops the flag.
3. **An ✕ on the welcome card**, upper right, like the other cards and sheets. It does
   what Look around does.
4. **Share the crew link**, a row in the Show menu above Settings: the share sheet with
   the invite text and the crew link (the rooms and Board/List being shown), or
   **Copy the crew link** and "Copied ✓" where there is none.
5. **The window's catches** (banked in v101): a touch during the peek's arrival, and a
   grab during a redraw's slide, catch the window where it is instead of snapping it to
   the peek or turning a slide into a slightly opened plan; a font that lands during
   the arrival retargets it instead of letting it land on old numbers and drop 23px.
   The mechanism: a pixel **lift** kept apart from the progress `p`. A catch during a
   settle takes progress (and the overshoot's remainder as lift); a catch during an
   arrival or a slide takes lift. The next settle takes the lift home.

## Steps (each a commit on live/share, pushed)

- [x] S1 the text: `planEntries` + `planText` in `js/v3/plan-rows.js`, goldens per clock
      state (morning, NOW, tomorrow, a highlight, nothing left)
- [x] S2 the link: `crewLink(…, { plan: true })` → `&plan=open` last; `planFromHash`
- [x] S3 the plan's foot: Share / Copy, the words on the button, laptop and phone
- [x] S4 `&plan=open` at boot, member and newcomer paths
- [x] S5 the welcome ✕
- [x] S6 the Show menu row
- [x] S7 the lift: arrival and slide catches, the font retarget
- [x] S8 browser tests for each; jsdom tests; docs (README/CLAUDE where they describe it)
- [x] Gate: npm test, browser suite at 0 and 700 ms late, a Sonnet walker on the real
      app, Sol, CI both jobs; the SHA to the coordinator

## Log

1. **S1** (eedade2): `planPicks` + `planText` in plan-rows.js. A room listed
   twice in one night (a fork into it, then the route coming back) is one line
   at its first time: deduped by place, keeping the earliest start and the most
   of us. Goldens for 11 AM and 9:40 PM Saturday, a highlight, and not-today.
2. **S2** (36f128a): `crewLink(…, { plan: true })` puts `&plan=open` last, only
   with a festival; `planFromHash` reads it.
3. **S3**: the foot under the rows, fading with the head, inert in the peek, not
   a drag handle. The laptop pill needed a height of its own (36px; the 44px
   floor only reaches coarse pointers), and it follows the list rather than
   the panel's bottom, so it reads as the plan's last line. The share marks
   the page busy while the sheet is up (a new build waits). Walked in Chromium
   at 390 and 1280 with the made-up nine: the text matched the 9:40 golden.
4. **S4** (28fdd68): a member's `&plan=open` lands on the plan open (the peek's arrival,
   then `openPlan`, which the lift turns into one motion). A newcomer's waits while the
   welcome card is due and opens when it goes. The flag belongs to the crew it came with
   (`planOpenFor` holds that token), is dropped on a day with no plan, and never reaches
   the crew doc or the address bar.
5. **S5** (eb7e10f): the welcome card's ✕ is Look around by another name (`gotIt`).
6. **S6** (02d284c, 65fa0fc): "Share the crew link" in the Show menu above Settings: the
   share sheet with the invite text and the link to what is being shown, or Copy and
   "Copied ✓" with the menu left up. Both the row and the plan's foot say what their link
   opens on (the v92 rule: every place that hands out a link says so), and sharing stamps
   the invite's festival the way the Invite sheet does.
7. **S7** (393d025): the lift. A finger on the peek mid-arrival, or a grab mid-slide,
   keeps the window where it is; a font landing mid-arrival re-aims the arrival from where
   it stands (`reaim`), and a first observer answer with nothing changed is ignored. Each
   new test fails on the old shelf, except WebKit's font case, which the old shelf passed
   in its held form (noted in the test).
8. **S8** (fc86005): `tests/browser/plan-share.test.mjs`, ten cases in both engines, and
   the README's Our picks bullet.
9. **The gate so far** (3:40 PM PT). Local: the browser suite 361 of 363 at 0 and at 700 ms
   late, each run with one different timing failure in a file this branch does not touch
   (`fold-intent`, `tap-shelf-contract`) while other sessions loaded the machine; both
   files pass alone at 0 and 700. Node 1254 of 1257, the SW stamp the only red (the
   coordinator stamps). CI on fc86005: the browser job green on Linux, WebKit included;
   checks red only on the stamp. Sol and a Sonnet walker are running.
10. **Sol's round** (gpt-6-sol high, on edb30b8; six findings, all real, all fixed):
    a. A plan link could open the wrong festival: a phone that keeps the crew on
       another festival lands there (the saved festival wins over a link's `&f=`), and
       that festival's plan opened. The wish is now `{ token, fest }` and goes when the
       festival differs; the landing itself keeps the app's rule.
    b. "Pick shows" on the welcome card let the plan open under the join shelf and spend
       the wish. It now waits while the shelf asks and opens when the shelf is left
       (`planAfterShelf`); after a join it waits for the join's own welcome.
    c. Copy was outside the reload guard: the busy mark now covers the whole share or
       copy, in the plan and in the menu (which takes the menu's own mark for its length
       and hands it back).
    d. The Share pill was 36px under a finger: the class rule out-ranked the 44px floor.
       Its own height is kept off coarse pointers now.
    e. A crew-link share the browser refused did nothing and said nothing. The menu now
       stays up under the sheet, goes once the sheet answers, and a refusal copies and
       says "Copied ✓" in the menu.
    f. The two catch tests said "touch" and drove a mouse. They drive both now: the mouse
       in both engines, and in Chromium a real finger (CDP touch, a still finger before
       it lifts). The finger versions fail on the shelf before the lift.
    New browser tests: another festival's link, the join shelf, the refused sheet, the
    floor at 390 coarse and 1280 fine. Each fails on fc86005 and passes now.
11. **The walk** (a Sonnet walker, real input, fc86005; brief and screenshots in the
    session's scratchpad `walk3/`): 15 of 16 steps pass in both engines, no page errors,
    no app failure. The one inconclusive step, "the plan-link landing jumps ~350px in one
    frame", is the harness: under `page.clock` a sampled animation shows no in-between
    frames in either engine, the plain peek arrival included; on the real clock the same
    landing samples as one smooth curve (Chromium 799 → 50 → 55px, WebKit the same shape).
    Banked in the project memory's harness traps. Its catch reading (3.4px against a 2px
    bound) was a live animation read a touch-dispatch before the finger landed; the paused
    tests hold it to 1px, in both hands.
12. **CI on Linux**: the browser job was green on fc86005. Two later runs each had one
    timing failure in a test this branch does not change the behaviour of (edb30b8, docs
    only over fc86005: WebKit's widen-to-a-laptop-and-back; 7ad9721: show-links' Tix door
    60 ms after a +). Neither appears in the last 20 failed runs on other branches; both
    pass locally 5 of 5 and 3 of 3 at 700 ms late. The failed job was re-run.
13. **Sol's release round** (gpt-6-sol high, on the coordinator's release head 52653f1;
    one blocker, two important, one nit, all real, all fixed on `live/share` after
    merging main; each new test fails before its fix):
    a. **A stop outlasted its set** (the blocker; the model fix below was taken back
       out in 14). routeOf folds a blip (a crowd shift
       under 15 minutes) into the stop before it, and that carried the stop past its own
       set: with the nine on Sunday, the Warehouse's ten-minute Tiësto blip kept the Pier
       Stage stop to 8:15 while Zara Larsson ended at 8:05, so from 8:05 to 8:15 the peek
       said "NOW · Zara Larsson · till 8:05 PM" and the Share "now till 8:05pm". Live in
       production since v101 (checked on main 5bf380f), at most ten minutes after a set,
       wherever a crew's picks make such a blip. The fix is in the model: a stop and a
       fork end where their place does (plan.js routeOf, `endOf`). The blip still folds;
       its minutes become the changeover they are. Everything that reads a stop's end was
       listed first: atOn's NOW (the peek), planAt's "last night still going", forkFor's
       overlap, the NOW row's till (a room's is its stop's end), the open plan's Earlier
       fold, the Share's "still to come", the shelf's repaint key. Seating and the trip
       rule are upstream of the route and do not read it. What those ten minutes show
       now: exactly what 8:15 to 8:20 already showed, the changeover's rule — the peek
       says NEXT for the next time most of us meet (Swedish House Mafia, 8:45), the dock's
       NOW tab comes back (the one-NOW rule: no NOW row), and Zara's row folds into
       Earlier at 8:05. Two goldens moved and say why: Sunday's Zara stop ends 8:05, and
       the tiny festival's fold test ends X at 9, not 9:10. New: no stop or fork outlasts
       its place on any Portola night; the peek at 8:04, 8:05, 8:10, 8:14 and 8:17; the
       Sunday 8:10 text word for word; and a browser test at Sunday 8:10 in both engines
       (the peek, the open plan, the Share), which fails on the unfixed model with the
       peek reading "NOW till 8:05 PM".
    b. **The plan link forgot its day.** `&plan=open` became `&plan=<the night's date>`
       (crew.js `PLAN_NIGHT_RE`; `planFromHash` returns the date). The receiver opens
       the plan only when it is on that night; on any other the link lands on the wall
       with its peek, because the open plan shows one night and a Saturday text's
       "Full rundown" must not open Sunday's. When the plan scrolls across the days (the
       design round's B), the link can land on its own day instead. No `&plan=open` link
       exists in the wild (v103 is unreleased), so there is no old form to read. New:
       the link test, and a browser test for a Friday link opened on Saturday; a
       mutation run without the night check fails it.
    c. **A highlight's Share named the whole crowd's acts and ranked by the whole
       crew.** Under a highlight a place now counts only the highlighted people at it (a
       stop's timeline, a fork's peak crowd), a room is named for what they picked
       there, and the five are the most of them, then the earliest. A person is only
       seated at their own picks, so every act named passes `passesPeople` — the test
       asserts it for four highlights. Cy at 9:40 now reads "Public Works for Milli Meng
       and Fcukers" (she picked no Chloé Caillet); Ben, Eli and Gus at 11 AM get the five
       places all three are at, not the crew's big stops. The head still says "Our
       crew's main picks": its words under a highlight are the design round's question
       C5.
    d. The join-shelf test's fixed 700 ms sleep now waits for the peek rising behind the
       question, then asserts it did not open.
14. **Sol's second release round** (on the coordinator's release head 4403e58). It
    confirmed the date link and the test wait, and found three holes, all in 13a's cap.
    First, the capped Zara stop folded into Earlier at 8:05 and took its live Tiësto
    or-line with it, so the open plan left out the line the Share led with. Second, a
    highlighted "now" counted anyone who had ever been in a stop. Third, the fork's
    15-minute check ran before the cap. That made two rounds on one mechanism, and the
    coordinator offered two ways out: (a) fix the cap properly, or (b) take it out of this
    release and bank it for the design round. This took (b).
    a. **Why (b).** The holes kept coming from the Share reading the route on its own,
       beside the rows' reading, and not only from the cap. A sweep over every Portola
       night, every five minutes, for the whole crew and a set of highlights, found the
       Share naming lines the open plan never draws, even on v101's model. A stop's row
       shows ONE or-line (forkFor), while the Share listed every fork over the bar.
       Friday 8:45 PM: "Regency Ballroom for Gelli Haha and Channel Tres @ ~9:30pm" is
       Public Works' second or-line, and its row shows 1015 Folsom. Sol's Tiësto case is
       the same class, made by the cap. Kevin's rule for a third round on one kind of
       hole is to cut the mechanism, not the feature.
    b. **What changed.**
       1. The model cap is out: plan.js routeOf and its tests are v102's again. That
          drops the "no stop outlasts its place" test, the peek at 8:04–8:17, and the
          two goldens 13a moved.
       2. Forks gain `crowds`, who is at the fork every five minutes. It is additive and
          named apart from `timeline`, so hasAny and the rows read exactly what they did.
       3. The Share reads the rows. Its candidates are the stops the open plan has not
          folded, plus the one or-line each row draws: plan-rows.js `overAt` and
          `orLineOf`, which planList now calls too. planText takes the peek the rows
          were drawn with.
       4. A line leaves when the route leaves it or when what it's for is over (`endOf`:
          the act's end, a room's close). At 8:10 Zara Larsson is gone even though her
          stop runs to 8:15.
       5. "Now" means who is there now (`crowdAt`, that five-minute slice's crowd), with
          or without a highlight. Ben at 7:15 is at Kettama, not Robyn.
    c. **What the ten minutes after a set show now.** The peek and the open plan keep
       v101's "NOW · Zara Larsson · till 8:05 PM" until 8:15, which production has shown
       since v101. The Share leads with what is actually on (Tiësto till 8:15), and every
       line it sends is a row in the open plan.
    d. **Tests.** Each fails on the release head's Share code.
       1. The every-clock sweep runs on Portola's nine and a made-up nine at ACL (its
          rooms, its two weekends), reading over 20,000 lines in about 11 seconds. It
          asserts that each line the Share could send is a row the open plan shows, that
          no "now till" is already past, and that a highlighted "now" has one of them
          there at that minute.
       2. Ben at 7:15; Friday 8:45's or-line; the Sunday 8:10 text.
       3. The Sunday 8:10 browser test now checks every shared line against the open
          plan's rows, in both engines.
       4. One expectation moved. For Ben, Eli and Gus, DJ Shadow now reads 6:30, his
          row's time, not 6:10: that time came from the or-line under Tove Lo, and her
          row shows Groove Armada's instead.
    e. **Banked for the plan-days design round** (DESIGN.md on `live/plan-days-design`,
       with acceptance tests up front): a stop that ends with its place, a live or-line
       that outlives its stop, the fork check measured on the capped interval, and the
       peek's stale ten minutes.
15. **Sol's third release round** (on the coordinator's release head dccf078). It
    confirmed that the cap came out cleanly and that the sweep checks against rows drawn
    on their own. It found two blockers.
    1. The open plan's repaint signature left out the or-line. At Saturday 6:00 PM, Tove
       Lo's NOW row should switch its or-line from Groove Armada to DJ Shadow, and
       nothing else changes. The signature stayed the same, so an open plan kept
       Groove Armada, while the Share, on the new minute, named DJ Shadow.
    2. The WebKit resize failure was a real path. The page's scroll frame measured a
       narrowed window without settling the plan's state, and reaim's "no new numbers"
       return never cleared `data-side="open"`.

    That made three rounds of the Share and the open plan disagreeing. The rule is to
    cut the mechanism: the Share no longer works anything out beside the plan.
    a. **What changed.**
       1. The Share is single-source. A tap first repaints the plan at that minute
          through the app's own paint (the answer carries `repaint`, which is app.js
          `paintPlan`, so the peek and the dock's NOW tab repaint on the same date). The
          repaint draws even when the signature says nothing changed. The words then
          come from `drawn`, the answer the rows on screen were drawn from, which draw()
          records. A minute that takes the plan away sends nothing.
       2. The signature's route part is plan-rows.js `rowsKey`, built from the same
          rules planList draws by: each item's times, count and tier, whether it is
          over, and the or-line its row shows. An open plan now moves on at 6:00 PM by
          itself.
       3. Every measure that crosses between the phone's layout and the laptop's
          settles the state. reaim's "nothing changed" return also checks the side
          attribute against the layout, not just the last numbers. With (3) in place no
          public path reaches that check, so it is a guard only.
    b. **Tests.** Each fails first on the release head, and each fails again with only
       its own fix taken out (checked one fix at a time).
       1. "A plan left open across Saturday 6:00 PM" (plan-share, both engines). It
          starts at 5:59:30 and moves the clock to 6:00:30. It fires the minute's tick
          with the page busy, so the tick alone runs and not the wall's repaint of the
          past (which redraws everything). The or-line must move to DJ Shadow. Without
          the or-line in rowsKey it stays on Groove Armada.
       2. "Share at Saturday 6:00 PM, before the minute's tick" (plan-share, both
          engines). The tap must draw DJ Shadow's or-line and share no Groove Armada,
          and every line shared must be a row on screen. Without the forced repaint the
          plan still shows 5:59.
       3. "1280: narrowed to a phone with a scroll in the same moment" (plan-drag,
          both engines). An animation in the plan that never ends holds every refit, so
          the scroll frame's measure is the only one that runs, with no retries.
          `data-side` must be gone at once, then the plan must stand open on the dock.
          It fails without the flip settle, and it also fails without the scroll (that
          measure is the one under test).
    c. **Not reproduced as a test:** the refit going through reaim while an arrival or
       slide is still showing, the "stuck for good" half of the CI failure. Holding that
       motion needs the module's own animation handle. After (a3) the scroll frame
       settles first, so that path now finds the attribute already right.
16. **Sol's fourth release round** (on the coordinator's release head cf3019c). Sol
    agreed the single-source design holds for ordinary taps: the forced draw keeps
    the list's scroll, and rowsKey redraws only when a row's facts change, not every
    minute. It found one blocker and two important issues. The coordinator's call was
    to close them without a fifth round and without cutting the picks lines.
    a. **Blocker, fixed: a Share tapped under a held paint.** A paint that arrives
       while a hand is on the window waits for the hand, so the rows don't jump out
       from under the finger. The Share read `drawn` all the same. Example: hold the
       grabber across Saturday 6:00 PM and tap Share with a second finger. The sheet
       got Groove Armada, and the release then drew DJ Shadow. Now sharePlan sends
       only when the tap's own forced paint drew. `drawn` must be the answer that
       paint computed, and nothing may be held. Otherwise nothing is sent, and the
       tap after the hand lets go shares.
    b. **Important, fixed: the Share's hold on a new build's reload.** The page's busy
       mark has one owner. Both shares took it only when it was free (the crew link's
       share also took it from the Show menu). So a share that started while
       something else held the mark (a laptop's Earlier fold, a hand on the window)
       held nothing of its own. When that owner let go, a waiting reload could land
       under the share sheet. Each share now sets its own mark, `data-sharing`
       (`plan` or `crew`), for as long as its sheet or copy runs. index.html's
       quiet() reads it beside the busy mark, a one-line change to the gate. The
       old owner-juggling code in both shares is gone.
    c. **Important, banked: a rotation during row motion.** refitPlanShelf() waits
       for running animations before it measures. A phone rotated past the 720px
       laptop breakpoint while a row animates keeps the phone's `data-side` and
       geometry until that animation ends. The scroll frame is no fallback in that
       direction: onScroll bails out while the old geometry is the phone's. The lag
       is under a second and cosmetic (the CSS changes at once). The fix belongs
       with the refit's wait rules in the design round: measure the layout flip at
       once and wait only to re-aim motion.
    d. **Tests, red first in both engines, then green:**
       1. "A hand holding the grabber across Saturday 6:00 PM" (plan-share). A real
          mouse holds and moves the grabber, and the keyboard activates Share (the
          second input). Nothing may be sent, and the rows must stay on 5:59. After
          the release the or-line is DJ Shadow, and a Share then sends no Groove
          Armada.
       2. "Share our picks / Share the crew link holds a new build's reload for as
          long as the sheet is up" (plan-share, two tests). Another owner holds the
          busy mark when the tap comes and lets go while the sheet (a stub that
          stays up) is open. `data-sharing` must still be set, then cleared when the
          sheet answers.
       3. tests/new-build-reload.test.mjs: `data-sharing` alone holds the reload.
    e. **Outside the Share: a WebKit flake on PR #64** (CI run 36286253730, on
       cf3019c). "WebKit (iPhone): with the keys up, the shelf's composer…" typed
       "Pier by 6:45" and read back "Pier by ": keystrokes were lost while typing,
       before the fake keyboard came up. Nothing in the Share code touches the notes
       shelf, its textarea or any focus outside `#plan`. The Share's only paths that
       run without a Share tap are the signature and the layout-flip check, and they
       write nothing outside the plan. It is the only failure of that test in the
       last 60 CI runs. It passed on 2d8b7c8's run 36285667551 and passed 5 of 5
       times locally in WebKit.
