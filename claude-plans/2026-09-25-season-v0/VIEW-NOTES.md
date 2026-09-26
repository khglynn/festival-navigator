# Season view — builder's notes (2026-09-25)

Branch `seasons/view` (worktree `.claude/worktrees/season-view`), cut from
`seasons/austin-v0` at 4c4f7f1, with the live data merged in (4eb0ce8,
97b8e1c, 527b0e2 — the data files take that branch's side). Brief:
`VIEW-BRIEF.md`; `UX.md` is newer where they differ. A restart picks up from
here and the last commit.

## Status (bank)

- [x] Read the brief, PLAN, UX, CLAUDE.md laws, the memories, the 09-24 canvas
- [x] Baseline: `npm test` 884 pass / 1 skip; browser suite 176/178 (the two
      misses were my half-written edits booting mid-run; re-run below)
- [x] Model (events.js, pure): months from today, Monday–Sunday weeks, YOURS
- [x] Wall (wall.js): the season path, search, tabs; festivals untouched
- [x] Shell (app.js): open on today, YOURS arrival, keep your place, no sort
- [x] Zoom (card-facts.js): the bill, start + doors, on-sale / presale while
      ahead, sold out, other nights — season shows only
- [x] Lists: Austin after the upcoming festivals under "City seasons" (landing,
      Settings, the create list); never the default festival
- [x] Copy: notes say "Austin" ("Add an Austin note…"), never "festival"
- [x] Speed: a full repaint of the real season 450 → 265 ms at 4x CPU throttle
- [x] Unit tests (`tests/season-view.test.mjs`, clock pinned via ctx.now) and a
      browser contract (`tests/browser/season-contract.test.mjs`)
- [x] Location filter (UX.md §3): the fest name lists the locations
- [x] Full browser suite 185/185 and unit 915/915 on 5794d66 (d7a2c3e is one
      Settings line after it; unit + shell and season contracts re-run green)
- [x] Pushed; preview built from d7a2c3e (stamp 66ae6153):
      https://festival-navigator-git-seasons-view-kevinhg.vercel.app
      (unique: festival-navigator-finc8whma-kevinhg.vercel.app). Behind Vercel
      login; a share link lasts 23 h and dies on the next deploy of the branch.
- [x] Throwaway crew `zz-season-demo` made through the preview (one member,
      Kevin; a seeded, made-up Spotify taste of 14 artists so YOURS shows; its
      invite points at Austin). Its token is in the builder's report only.

### Round 2 (the review, 2026-09-25 evening)

- [x] Merged `seasons/austin-v0` at e326f9d (main's v89 merged there; stamp
      v90, unreleased). Import conflict resolved without `showUndoToast`
      (main removed it); data files match e326f9d exactly.
- [x] `unlisted` shows: off the wall, YOURS, counts, the location list and
      "also" (a moved show stood twice).
- [x] The day turn: tickClock repaints a season when Austin's festival day
      changes (5 AM rollover). Browser test crosses 4:58 → 5:02 AM and fails
      without the fix.
- [x] One season model per repaint (memo; festDatesOf skips a season);
      findEventEntry reads a per-file name index. **Full repaint of the real
      752-show file at 4x CPU throttle: ~180 ms** (265 after round 1, ~450
      before it). Portola: ~52 ms, unchanged.
- [x] renderDayNav reads tab positions only on a season.
- [x] Month labels are keys, never parsed: "September 2027" gets its own tab;
      labels come from dates; a second SEP wears "’27" in the dock.
- [x] Sale times say "CT".
- [x] List heads after the seasons: City seasons → Past festivals → More.
- [x] `npm test` 929/929 (1 skip) and `npm run test:browser` 187/187 on
      9615bc1 (the merged tree with every fix).

### Round 3 (Kevin: seasons, not one long list — 2026-09-25 night)

- [x] Fast-forwarded to 868a908: `austin.json` is gone; four season files
      (austin-fall-2026, -winter-2027, -spring-2027, -summer-2027), each a
      three-month window with startsOn / endsOn / updated.
- [x] **The description line** (events.js `seasonLine`, one builder):
      "Dec 2026 – Feb 2027 · updated Sep 25" / "updated today" / "updated
      yesterday"; a season that is over says its window alone. It shows in:
      (1) the wall header under the season's name (`#fest-sub`, via
      card-facts.js `festPlaceLine`); (2) Settings' current-fest card (the
      same `festPlaceLine`); (3) Settings' "Your festivals" rows; (4) the
      add-a-fest / create list rows (tools.js `festRow`); (5) the landing's
      rows, above the people. A season's label is its name and year
      ("Austin Winter '27"): no month from startsOn, which said "Dec '27".
- [x] **The shelf** (Kevin: "just the next two seasons - we can have the
      others tucked away"): events.js `seasonLead` = the city's two soonest
      live seasons (Fall + Winter on Sep 25, Winter + Spring from Dec 1), read
      from each row's window against Austin's day; the rest sit behind one
      "Later seasons · N" row (the disclosure fold, now with the app's
      arrive / leave motion) — in the landing, Settings and the create list.
      A season a crew already has picks or notes in always shows.
- [x] A season whose window is over is past like an archived festival, even
      before the feed marks it (landingPairs, the create list), and its wall
      shows all of its shows with no THIS WEEK. A future season (Winter)
      opens on its first month with nothing hidden. YOURS is per season.
- [x] Tests: the test season is a real three-month window with a real id
      (`seasonShape` picks the season around `today`; its edge cases sit a
      few days after today, so the suite reads the same any day); the
      browser contract routes its index row; new unit tests pin the line,
      the shelf (Sep 25 / Dec 1 / a crew with Spring picks) and over seasons;
      a browser test walks the landing's rows and Winter opening on
      December. No code or test refers to the retired `austin` id.

- [x] `npm test` 935/935 (1 skip) and `npm run test:browser` 188/188 on
      7348aea; stamp v90 fresh (4927b7e7); pushed once. Preview:
      festival-navigator-er0n2y9z7-kevinhg.vercel.app.
- [x] Demo crew re-pointed the way a person would: opened with
      `&f=austin-fall-2026` on a fresh device, joined as Kevin, Share invite
      → its invite is `austin-fall-2026`; Winter, Spring and Summer opened once
      each so its landing holds all four. Its doc still carries the retired
      `austin` key (and a stray `portola-2026`): merges never delete, so on
      its landing an "Austin" row sits under "More" (demo crew only).
- [x] Walked the preview at 390 (touch) and 1280 (mouse): Fall lands on
      SEP 25 – 27 THIS WEEK under YOURS (11), header "Sep – Nov 2026 · updated
      today"; the landing shows CITY SEASONS · Fall, Winter, "Later seasons ·
      2" (opens to Spring, Summer); Winter from its row opens on December
      (DEC 1 – 6) under YOURS (3), tabs YOURS DEC JAN FEB. No console errors.

### Round 4 (Kevin: previous / next season — 2026-09-25 late)

- [x] Fast-forwarded to 2a04adb (index rows carry `timezone`).
- [x] Chevrons ‹ › flank the months in the dock and the rail, outside the
      scrolling row (‹ before NOW, so NOW's neighbour is still the days row).
      No words; aria-label + title "Next season: Austin Winter '27". A
      direction with no season keeps its space (visibility); festivals never
      show them. Borrowed 44px (inset ::after), not real height: 44px would
      make the dock 18px taller — the glyph-button rule in v3.css.
- [x] events.js `seasonNeighbours`: the city's seasons (same `location`, kind
      season) in startsOn order, every one — tucked and archived too.
- [x] The slide (storyboard: `SLIDE-STORYBOARD.md`), see the account below.
- [x] Holding still: the dock and rail name hold the city's widest name, and
      on a season the rail's months row fills the line, so neither chevron
      moves between seasons (measured: › at 253px on every season at 390,
      1015px at 1280). The dock names just the season ("WINTER '27"; the
      header says Austin), and a season's dock tabs sit 18px apart: with the
      full name the dock showed one month.
- [x] The review's view-side items: the shelf unit test and the browser
      landing walk read a fixed snapshot of the index rows with a pinned
      clock; a season over by its window says no "updated"; stale comments.
- [x] Tests: neighbour order (gap, ends, other city, festival); a browser
      test taps › and ‹ with real touch (390), real mouse (1280) and under
      Reduce Motion, plus two quick taps landing two seasons over; festivals
      show no chevrons.

- [x] `npm test` 936/936 (1 skip); `npm run test:browser` 192/192 (166 in
      the full run, whose browser died mid-way through now-jump.test.mjs on
      this memory-short Mac, cascading that file; now-jump alone 52/52).
      Stamp v90 (e713e358). Pushed once: festival-navigator-dnhhkryql-kevinhg
      .vercel.app (from f37dddf).
- [x] Walked the preview on the demo crew: 390 by touch, 1280 by mouse, 390
      under Reduce Motion. Fall → › Winter (settles in ~0.5 s; ~50 ms under
      Reduce Motion), › › to Summer (lands clean, › hidden in place), ‹ ‹ ‹
      back to Fall. The chevrons sit at the same pixels on every season
      (51 / 253 at 390, 139 / 1015 at 1280). No console errors.

**The motion as built.** A tap on › fades the season you are reading out to
the left — the wall 28px, the month tabs 16px, the name 8px, 130 ms, quick
and plain — while the chevrons stay exactly where they are, the hinge of the
page. At the one frame where nothing is visible the next season is swapped in:
its accent, its months, its wall, and the scroll set to its first month (at
the top of the page it stays at the top). Then it arrives from the right: the
wall from 36px over 280 ms with the app's small overshoot, the months 30 ms
behind it, the name 30 ms after that, and a ‹ that has just gained somewhere
to go fades in last. About 410 ms end to end; ‹ is the mirror. The neighbour
files are fetched as soon as a season paints, so a turn never waits. A second
tap during a turn is kept and runs when this one lands (two quick › taps land
two seasons over, through two whole turns). Reduce Motion and Low Power swap
instantly. Watched at 25% speed at 390 and 1280; the first cut cut its exit
short under slow motion (a wall-clock guard), now it waits for the
animations, or for the tab being hidden.

## Decisions (and why)

1. **The season shows from today on.** Past months drop off (brief), and so
   do past days of the current month (UX.md §1 agrees): every card is a show
   you can still go to. A month shows while it has a show dated today or later.
   The file keeps every past show; only the view lets go.
2. **Week heads, one line each** (`SEP 25 – 27  THIS WEEK`, `OCT 5 – 11`): a
   week is Monday to Sunday, clamped to its month and to today, so a head never
   names a date the wall is not showing. They are plain heads (no note door —
   a season has no date notes), 44px on touch like every room head.
3. **The card says its date**, plus the start when there is one
   (`Fri · Sep 25 · 8 PM`). Doors, the location, the links live in the zoom.
4. **YOURS is one list**, soonest first (the canvas measured 1,090px vs
   3,950px as night rooms). Yours = a liked song or a follow in your Spotify,
   or a pick of yours at another fest in this crew; only for someone whose
   crew doc carries a Spotify affinity map; never a cancelled show.
5. **The open lands on today**: the current month's first week, below YOURS.
   With no YOURS the page stays at the top (today IS the top) and the season's
   name stays in view.
6. **A search answers by name or location** ("mohawk"), a list head per month,
   and the answer's card adds the location on a second line (a search must
   say where and when; the wall leaves where to the zoom).
7. **No sort control, no show menu, no NOW** for a season (one order; nothing
   to hide yet; no end times). No share-a-day image for a season either.
8. **The zoom's billing line** shows `billedAs` only when it does not simply
   lead with the artist's own name ("ACL TV Taping: Lola Young" shows;
   "Denis O'Donnell at Hole in the Wall" does not).
9. **The location filter** is the show menu on the fest name: "Show · 69 of
   69 locations", busiest first with counts, "All locations" first (one tap
   back from any filter, or a clear wall). A tap keeps the menu open. Hidden
   locations leave the months, YOURS and search. Motion: the location's cards
   leave quick and plain; cards that stay in their row or column slide, and
   cards the reflow moves to another row fade in where they land (a diagonal
   slide ran them over their neighbours, watched in slow motion).
10. **Lists**: Austin after the upcoming festivals under "City seasons", then
   "Past festivals" gets its own head (landing, Settings, create). Never the
   default festival. Settings shows no Day image row for a season.

## Checked in a real browser (headless Chromium, real input)

- 390 (touch) and 1280 (mouse), the real 757-show file and a generated
  ~1,000-show file shaped like the trial feed: open lands on today under
  YOURS; dock and rail light the month you are in; two cards across at 390,
  five at 1280, one width per row; no sideways scroll; every card's date
  matches its show; tab taps land (SEP, OCT, back up to YOURS).
- Zoom by hover at 1280 and by a held finger at 390: bill, start and doors,
  location (map door), Tix/Info, presale then on-sale; a tap on the zoom picks
  and both of that show's cards (YOURS and its month) carry the pick.
- YOURS arriving while scrolled into September (Spotify affinity landing on a
  poll): the tab fades in 6px from the left, the months slide 78px to make
  room, and the page holds the week you were reading (scroll 3000 → 3545 =
  YOURS's 532px + the gap).
- Landing: Portola, ACL, [City seasons] Austin, [Past festivals] EF.
- Search "mohawk": 48 answers in 8 months, each saying `Fri · Sep 25 · 8:30 PM`
  then `Mohawk`; tabs narrow to the months that answered.

- The location menu at 390 (touch) and 1280 (mouse): untick the busiest
  location (its cards leave, the menu stays open, "68 of 69"), All locations
  back, a tap outside closes; slow-motion frames of the reflow at 1280.
- Edge cases on the real file: Freaky Deaky (untimed, 8-name bill → "with
  AHEE, Boogie T, Crankdat +5"), cancelled shows (struck, last in their week,
  Info door kept, tickets gone), the longest name, 320px (no overflow).
- **On the real preview** (share link, then the crew link, "I'm Kevin"), 390
  by touch and 1280 by mouse: lands on SEP 25 – 27 under YOURS (15 shows),
  held-finger and hover zooms, a pick on the zoom lights both of that
  artist's cards and reached the server, the location filter, a "mohawk"
  search. No console errors.

## Weakest

- A full repaint of ~750 cards is ~180 ms at 4x CPU throttle. It happens when
  a crew-mate's pick arrives by poll and when a search is cleared. Rendering
  month by month would take it further; not done in v0.
- October is ~150 rows on a phone. Week heads, search and the location
  filter are the lenses; nothing yet says "your crew picked these" as a lens
  (the people filter dims, it does not gather).
- An API-made crew without `meta.inviteFestId` opens the default festival
  (Portola) — found making the demo crew; crews made in the app are stamped.
- On the preview nobody can connect Spotify (Connect hops to production, v88,
  which has no Austin), so YOURS's Spotify half only knows artists v88 badged
  at the crew's other festivals, until production has Austin.

## For Kevin

1. Past days of this month are gone too (the wall starts today). OK, or keep
   the month whole and land on today?
2. Weeks run Monday to Sunday under `OCT 5 – 11`. Want weekend-only breaks
   instead?
3. Locations sort busiest first. A–Z instead?
4. The preview is behind Vercel login. Showing friends: a share link (23 h)
   or turn preview protection off?
5. Don't press Connect Spotify on the preview: it hops to production (v88,
   no Austin). The demo crew's YOURS uses a made-up taste of 14 artists.
