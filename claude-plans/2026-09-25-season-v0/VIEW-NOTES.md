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
- [ ] Full browser suite green on the final tree
- [ ] Push, preview URL, throwaway `zz-season-` crew
- [ ] Location filter (UX.md §3: only if it fits v0)

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

## Weakest

- A full repaint of ~750 cards is ~265 ms at 4x throttle (~65 ms on this
  Mac). It happens on a crew-mate's pick arriving by poll and on clearing a
  search. Month-by-month rendering would fix it; not done in v0.
- 2 across on a phone means October is ~150 rows. Week heads and search help;
  the location filter (not built yet) is the next lens.

## For Kevin

(filled in at the end)
