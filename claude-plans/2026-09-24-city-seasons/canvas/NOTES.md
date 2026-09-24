# City seasons canvas — working notes (2026-09-24)

Brief: `BRIEF.md` beside this file. Rig forked from
`claude-plans/2026-09-23-rating-canvas/`.

Build (from the repo root or anywhere):
`ESBUILD=~/DevKev/personal/ynai/node_modules/esbuild node claude-plans/2026-09-24-city-seasons/canvas/build.mjs`
-> `canvas.html`, one self-contained file (~530 KB).

Checks (one headless Chromium each, closed after; screenshots go to OUT,
never the repo): `PW=<repo>/node_modules/playwright OUT=<scratch>` then
`node checks/shot.mjs <width> <selector…>`, `node checks/probe.mjs <width> '<js>'`,
`node checks/walk.mjs desk|phone` (real mouse at 1280, real touch at 390).

## Status (bank)

- [x] 1. Rig forked, builds, artboard 0 renders (today's code, Austin fed in)
- [x] 2. Shared grammar: month tabs, `FRI OCT 16` heads, zoom lines (support
      acts, tickets, on-sale, past pick), taste seed, thin-month line, zoom strip
- [x] 3. A · The month (phone + desktop + Slack DM)
- [x] 4. B · Yours (tab + dot arrive like NOW, on-sale whisper, 48h DM + digest;
      "One list" variant beside the brief's night rooms)
- [x] 5. C · This week (week tab, day-before + on-sale reminders)
- [x] 6. Rooms filter (show menu: 15 read rooms with counts, 6 unread named)
- [x] 7. Edge cases (96-char name, 15-show night, 3-show month, cancelled,
      no doors, door only, one name two nights)
- [x] 8. Browser pass at 390 and 1280 on every frame, then the honest read
- Added at the coordinator's ask: "Where the shows come from" (after the
  intro) and "Your call" (four numbered questions, at the end).

## How it is built (what differs from the rating canvas)

- Frames are whole app screens: index.html's own `#screen-app` markup
  (header, toolbar, day rail, wall root, dock) is lifted at build time, ids
  turned into `data-id`, and the runtime fills what app.js would paint. Each
  frame scrolls on its own (390x760 phone, 1280x780 laptop scaled to fit).
- Artboard 0 is `renderWall` untouched. The directions compose the wall from
  exported production pieces (`venueGroups`, `renderCard`, the room-head DOM,
  `.day-block`): renderExtra's own recipe with one change, the head names
  the date. Tabs and the scrollspy are app.js's / wireScrollspy's rules,
  re-hosted on the frame's scroller (production listens to the window).
- Two hooks in the bundle only (repo untouched): end of `renderCard` (A's
  NEW tag) and end of `grownBlock` (the zoom's new lines, so the zoom
  measures and blooms them; they also join its cascade and slide on a pick).
- Data: the season file, plus at build time (read-only) the venues' own buy
  links from ground truth (265 shows) and Do512's 7 real on-sale times.
- The zoom follows production's scroll rule (never closes on scroll; closes
  when its card leaves the frame).

## Seeds (said on the canvas)

Kevin's Spotify (13 artists), his picks at Portola and ACL, the crew (Ben,
Cleo, Dev), the announce dates behind NEW, one cancellation (Stella Lefty,
Jan 31). Real: every show/room/date/doors/billing, the buy links, Do512's 7
on-sale times (Fri Sep 25, 10 AM), MUNA's whole timeline. The alerts assume
a daily read at 9 AM (STUDY.md: Do512 + JamBase see an announcement within a
day), so A's DM lands Sat May 9, B's and C's Mon May 11 — all before the
first presale (Tue May 12).

## Found while building

- Today's code already renders the season as a calendar (MODEL-V4's dated
  sections), and the rough edges are exactly three: dock tabs cut to five
  letters (`SEPTE OCTOB NOVEM`), heads that name the month (`THU SEPTEMBER
  SEP 24 · AUSTIN`), a show menu that lists months. The zoom has no buy line.
- Cards are 95px tall in a stack (content-box: 64 min-height + padding);
  production, not the canvas.
- On Sep 24 tonight is the first night in the file, so every door opens on
  the same room. The bar's "Fri Oct 16" switch shows the opens differing:
  A lands mid-October on tonight's room with Oct 1-15 above; C's week is
  Oct 16-22 (43 shows) and the months follow without those nights.
- On Sep 24 THIS WEEK and SEP are the same seven nights, so C removes SEP
  (no card shows twice). At a month's start the week is a quarter of it.
- YOURS as night rooms, measured on the phone frame: 3,950px for 19 shows
  (5.5 screens of 715px), mostly one half-width card per night. The "One
  list" variant (a search-style list: one head, the on-sale whisper, cards
  saying their night and room) is 1,090px. Built beside the brief's.
- A YOURS arriving while you look at the top: the first cut slid the whole
  wall 4000px in 380ms (a whoosh with a blank beat). Now: scrolled into the
  months, the view is anchored and only the tab (and its dot) arrives; at
  the top, the month slides 48px down and fades (quick, plain) and YOURS's
  rooms rise in with the beat.
- The rooms menu stays open while you tick (production's closes on every
  row tap); fifteen rooms is a list you edit. On a phone its 44px rows make
  it scroll — production's touch floor, kept.
- The season has names that play twice (Bleachers, Lola Young, ZHU, Kacey
  Musgraves...). Picks are keyed by name, so a pick lights both nights.
  Shown as an edge case; THINKING.md §2's show id is the fix.
- Data-cleaning leftovers in the file (not the canvas's to fix): a show named
  "TWO NIGHTS" (Emo's, Nov 6), Dave Chappelle (comedy) passed the music filter.
- Harness: a Playwright mouse click in a touch context makes Chromium believe
  a mouse exists and the zoom arms on hover; phone walks tap everything.

## Log
- 2026-09-24: read the brief, the rating canvas rig, MODEL-V4 §1-3c/§6,
  events.js, wall.js, card-facts.js, app.js (tabs, show menu, fold, chips),
  the v87 NOW tab on `feat/now-jump`, the season data, ground truth.
- 2026-09-24: built steps 1-7; walked at 1280 (mouse) and 390 (touch):
  zoom + pick, B's replay mid-flight in slow motion, the list variant, the
  Oct 16 clock, untick a room. No console errors, no page overflow.
- 2026-09-24: coordinator: Do512 carries real on-sale times (7); seeds cut.
- 2026-09-24: final pass. Looked at, in headless Chromium: at 1280 every
  section and frame (artboard 0 phone + laptop, A/B/C phones and laptops,
  both rooms-filter frames, the zoom strip, every edge case, the alerts,
  the timeline, the recommendation); at 390 (touch, isMobile) the intro,
  timeline, bar, artboard 0, A/B/C, laptops (scaled), rooms filter, edge
  cases, recommendation, your call. Walked with real input at both widths:
  zoom by hover (1280) and by hold (390), a pick while zoomed, a press
  outside closes it, B's replay mid-flight in slow motion, the One-list
  switch, the Oct 16 clock, untick a room (its stacks leave, the rest
  slide). Reduced motion: replay and filter land instantly. No console
  errors, no horizontal page overflow at either width.
- Fixed from the look: timeline columns (10 days, 9 tracks), labels that
  ellipsized at 390 now wrap under their dot; the bar is one scrolling row
  on a phone; edge-case boxes narrower than a phone take their own width as
  the phone's (two columns, not one); Kingdom's edge case now includes
  Kingdom; YOURS's arrival no longer whooshes the wall; the dot's look-timer
  resets on a new match; the rooms menu's head says `15 of 21 rooms`; the
  zoom follows production's scroll rule instead of closing.

## Honest read

**Pick: B's wall with A's alert, YOURS drawn as one list.** (Also the
canvas's recommendation block.)

1. A's alert is the only one that needs nothing but the listing: the daily
   read finds a match and the DM goes out the next morning (MUNA: Sat May 9,
   while the artist-presale sign-up was still open). B's weekly digest +
   48h rule and C's on-sale reminders both spoke Monday, and both lean on
   on-sale times, which we have for few shows (Do512: 7 of 425 on Sep 24;
   Ticketmaster's API only for the rooms it sells). C, as briefed, never
   announces — a Mohawk show by an artist Kevin loves, with no on-sale time,
   would pass in silence. Batch same-morning matches into one DM (an ACL
   Fest Nights drop is ten matches at once).
2. B's YOURS is the in-app home the alert needs (the DM's button should land
   there), and its dot is the in-app echo of the DM. The months stay A's.
3. YOURS as night rooms is the weakest surface on the page: 3,950px of one
   half-width card per night on a phone, and on a laptop a single card per
   row across a 1,000px shell. As one list it is 1,090px. I built the list
   beside the brief's rooms rather than swapping it.

**Weakest in each**
- A: nothing in the app gathers yours. October is 178 shows, 10 of them
  Kevin's, and the only mark is the small green Spotify pill (a past-fest
  pick has no mark on the resting card at all, only a line in the zoom).
- B: the brief's alert cadence (it spoke Monday; the DM and the digest land
  the same morning and repeat each other); YOURS as rooms (above).
- C: no announcement alert; THIS WEEK equals the month at a month's end
  (Sep 24: SEP disappears entirely); the day-before reminder needs picks
  the server can read, which is later work.

**What I'd change in the shared grammar**
1. A show id before a season ships (THINKING.md §2): picks are keyed by
   name, so Bleachers' Oct 2 and Oct 11 share one pick. Shown as an edge case.
2. Support acts should be data (`with: […]`), not parsed from `billedAs` —
   the parse is good on w/ / with / feat. / +, and shows the billing as
   printed otherwise ("Official 2026 ACL Fest Nights: Bleachers").
3. Whose buy link: the canvas prefers the venue's own (ground truth, 265
   shows, no hop) and falls back to Do512's; the study notes Do512's links
   carry its referral code and pay Do512. That is a values call for Kevin,
   tied to the Do512 email ("Your call" 4).
4. "Door only" for the Continental Club is our reading of its calendar (no
   ticket page for residencies); confirm with the club before shipping it.
5. The rooms menu stays open while ticking (production's closes per tap).
   On a phone the 44px rows make it scroll, so the head carries the count.
6. The head's sub says TONIGHT / TOMORROW; nothing else. Kept deliberately
   quiet (the fest heads' sub is the place).

**Where I disagree with the brief (built beside, not swapped)**
- YOURS as night rooms (above): the list variant is on the page.
- "Arrives the way the NOW tab does": NOW is a jump button beside the tabs,
  never lit by the scrollspy; YOURS and THIS WEEK are real tabs with blocks.
  I kept them real tabs (the scrollspy lights them) and gave them NOW's
  motion (fade in from 6px left with the beat, neighbours slide tab by
  tab), plus a still NOW-style dot on YOURS for "something new".
- "Opens on the current month, scrolled to tonight's room": on Sep 24 the
  file starts tonight, so every door opens on the same room. The bar's
  "Fri Oct 16" switch is what makes A's open visible.

**Open questions for Kevin** are the canvas's "Your call" list: which door
(or mix), where alerts land, card per show or per artist, and the Do512 /
JamBase / Ticketmaster asks.
