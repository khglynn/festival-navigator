# v103 build log — NOW on the left, the List filters by highlight, the crew playlist's top songs

*Builder's log beside `V103-BRIEF.md`. Started 2026-09-26 ~3:30 PM PT on
`live/v103` (off main at v101, v102 merged in at `3a1a304`). Newest state at the
top of "Where it stands"; the calls and their reasons below it. If this session
dies, this file and the branch are the handoff.*

## Where it stands

- [x] read the brief, the laws, the code each ask touches (app.js NOW doors,
      wall.js `restingLeft` / the List's `foldPast`, spotify.js `findTrackUris`)
- [x] merged `origin/main` (v102, the Spotify playlist names) — `3a1a304`, no conflicts
- [ ] 1. NOW the first item of the day row, one place whatever the day
- [ ] 2. the List filters by highlight
- [ ] 3. the crew playlist's top songs: paced, backed off, counted, said
- [ ] frames 390 / 320 / 1280, Portola and ACL, looked at
- [ ] npm test at UTC, Tokyo, NIGHT_CLOCK; `npm run test:browser`; CI green on both jobs

## The plan, per ask

### 1. NOW at the far left of the day row

Today NOW parks hidden just before the row and is moved INTO it after the live
day each paint (`showNowTab` / `placeNowTab` / `parkNowTab` / `liveTabIn`), and
`renderDayNav` lifts it out before every rebuild. New shape:

- NOW lives in the row for good, as its first child (index.html puts it there);
  `renderDayNav` clears only the day tabs, so nothing parks and nothing
  re-places. `showNowTab(tab, row, live)` only arrives or leaves — the FLIP of
  the days making room (`slideTabs`) stays, so NOW coming or going is still a
  small event, not a pop.
- `restingLeft` keeps its order of rules with `live` gone: the day you are in
  whole > NOW whole > no sliver > clear of the fades > centred. NOW being first,
  "NOW whole" pulls the row to its start wherever the day you are in still fits.
- `pillCap` (how many discs the highlight pill may hold) keeps its promise in the
  new geometry: the day you are in whole, and NOW whole beside the row's start
  when the two can share the row (see call 1b).
- The one-NOW rule is untouched: `paintNowTabs` still asks `planShowsNow()`.
  **Order kept (coordinator's note):** `renderDayNav` still rebuilds the day
  tabs first and calls `paintPlan()` after, exactly as before.

### 2. The List filters by highlight

The Board keeps dimming (`dimInPlace`). In the List a highlight is a filter:

- A pass after the wall is drawn (wall.js, beside `foldPast`), List only, never
  in a search: every row none of the highlighted people picked leaves the DOM; a
  band it empties goes; a room it empties becomes ONE quiet line.
- The past is judged on the whole wall FIRST (a night is over or not whatever
  the highlight — the days line never flips with a highlight), then the filter,
  then each room's own fold counts only what is left ("EARLIER · 2 SETS" is
  Ross's two).
- Viewer-side only: the highlight is already device-local
  (`filters.js savePeopleFilter`); nothing new is written anywhere.
- Motion: rows the highlight removes fade quick and plain, then the rows that
  stay glide to their new places (a FLIP of what is on screen only — transforms);
  rows that come back arrive with the beat. Instant under Reduce Motion / Low
  Power. The page is held where you are standing (`takeWallPlace`).
- Checked with Our picks open (Kevin: "does filters work with our picks open").

### 3. The crew playlist's top songs

Root cause as read in code (not yet on a live 429): `findTrackUris` fires ~50
searches back to back; `api()` retries a 429 up to 5 times but its wait reads
`Retry-After`, a header a browser cannot read cross-origin unless Spotify lists
it in `Access-Control-Expose-Headers` — so it waits a flat 3 s, gives up, and
the catch keeps only your saved tracks, silently. Worse, the crew ledger records
that artist as done (`found`), so "Add new picks" never tries its top songs again.
And a real `Retry-After` can be hours (Spotify community reports ~21 h in dev
mode), which the old loop would have slept through.

- One request path (`call`) for every Spotify call: honour `Retry-After` when it
  can be read, else back off 1-2-4-8 s; never sit through a wait past a cap —
  past it, stop asking (a breaker for the rest of the run) and say so; retry a
  5xx or a dropped connection once.
- Searches paced (one at a time, spaced), `limit` clamped to Spotify's
  dev-mode max of 10 (Feb 2026 migration guide).
- Counted: artists whose top songs could not be fetched are reported ("N artists
  had no songs found — try again later"), for the Make button and the crew
  top-up alike — and they stay OUT of the crew ledger, so the next "Add new
  picks" tries them again (their liked tracks already added are deduped
  against the live playlist).
- Unit tests with a fake Spotify: 429 then 200; persistent 429; a 21-hour
  Retry-After; a 5xx retried once; the ledger leaving the failed ones out.

## Calls (the brief left these open)

*(filled in as each is made)*
