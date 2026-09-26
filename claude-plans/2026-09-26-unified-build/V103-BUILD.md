# v103 build log — NOW on the left, the List filters by highlight, the crew playlist's top songs

*Builder's log beside `V103-BRIEF.md`. Started 2026-09-26 ~3:30 PM PT on
`live/v103` (off main at v101, v102 merged in at `3a1a304`). Newest state at the
top of "Where it stands"; the calls and their reasons below it. If this session
dies, this file and the branch are the handoff.*

## Where it stands

- [x] read the brief, the laws, the code each ask touches (app.js NOW doors,
      wall.js `restingLeft` / the List's `foldPast`, spotify.js `findTrackUris`)
- [x] merged `origin/main` (v102, the Spotify playlist names) — `3a1a304`, no conflicts
- [x] 1. NOW the first item of the day row, one place whatever the day — see "Step 1" below
- [x] 2. the List filters by highlight — see "Step 2" below
- [x] 3. the crew playlist's top songs: paced, backed off, counted, said — see "Step 3" below
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

## Step 1 — NOW first in the day row

What changed: index.html puts each NOW inside its row as the first child, for
good; `renderDayNav` removes only the day tabs and appends the new ones after
it (no parking, no re-placing, no focus rescue — it never leaves the DOM);
`showNowTab(tab, row, live)` only arrives or leaves; `liveTabIn`, `inPlace`,
`placeNowTab`, `parkNowTab` and `restingLeft`'s `live` are gone. **The order of
`renderDayNav` → `paintPlan()` is unchanged** (the coordinator's note for the
Share build). CSS: a hidden NOW is still the row's `:first-child`, so the first
day after it takes the centring margin then (`.now-tab[hidden] + *`).

Frames (Chromium, Mac glyphs, `v103-shots/now-*`, rendered by `v103-rig.mjs`;
the rows as the eye sees them, `seen/width` px):

| | Portola Fri 8 PM | Portola Sat 10:30 PM | Portola Sun 5 PM | ACL Sat 8 PM |
|---|---|---|---|---|
| 1280 rail | — | **NOW** THU FRI SAT* SUN | **NOW** THU FRI SAT SUN* | **NOW** FRI 2 SAT 3* … LATE NIGHTS |
| 430 dock | — | **NOW** THU FRI SAT* SUN (gaps tighten) | — | — |
| 390 dock | **NOW** THU FRI* SAT(30/36) | THU(35/38) FRI SAT* SUN — NOW past the left edge | THU FRI SAT SUN* — NOW past | SAT 3* SUN 4 — NOW past |
| 320 dock | THU FRI* SAT — NOW past | FRI(25/30) SAT* SUN(32/38) — NOW past | FRI SAT SUN* — NOW past | SAT 3* — NOW past |

With the made-up nine-person crew the peek says NOW at Sat 10:30 PM, so the
dock shows only days (one NOW, unchanged). The arrival and leave were filmed at
a tenth of the speed (`v103-film.mjs`, `filmsheet-*`): NOW fades in from 6px
left at the row's start as the days slide over to make room; leaving, it fades
and the days close up by sliding. On the rail its dot is clipped for the first
few frames of the 6px slide (it comes out from behind the row's edge) — read as
emerging, left as is.

Tests: `tests/day-row.test.mjs` rewritten for the new rule (pure numbers + the
booted shell: first child, the same element across a repaint, hidden in place
when nothing is live); `tests/browser/now-jump.test.mjs` — the frames table
above as exact rows on a Mac and as the contract on Linux, the 44px reach on a
Friday (NOW whole there), the arrival/leave on a Friday (visible there), and a
NEW real-input test: at 390 on Saturday NOW rests past the edge, a finger's
swipe on the row (CDP touches, the finger still before it lifts) brings it
whole, and a real tap on it lands the now line. `tests/browser/people-menu.test.mjs`
— the pill's promise restated for NOW-first (call 1b).

## Step 2 — the List filters by highlight

What changed: `wall.js foldPast` now judges every room's past up front on the
WHOLE wall, folds whole days, then (List only) calls `thinByPeople`, then folds
each room's own past counting only what the highlight left. `thinByPeople`
removes every row `passesPeople` (filters.js) rejects, drops an hour band it
empties and a non-room list it empties (EVERYTHING ELSE, with its head), and
turns an emptied room into its quiet line: the head alone, name in the quiet
tone, the room's own place dropped, the date it leads with kept in the sub,
and the words in their own `.quiet-words` span that never gives way.
`app.js setPeopleFilter` keeps the Board's `dimInPlace` and, when the wall is a
List, runs `thinFlow`: the rows (and the band hours / whispers / EARLIER lines
that go with them) fade quick and plain, the wall is redrawn with the page held
where you were standing (`takeWallPlace` / `keepWallPlace`), what stayed on
screen slides from its old place (a FLIP, transforms only — crisp when rows
closed up, with the arrival's overshoot when rows came back), and what came
back arrives with the beat. `settleThin` joins the other settles (NOW, a day
tab, the fold, the view switch, the past), and `pastMayMove` waits for it; the
page is busy (`data-busy="thin"`) while rows fade, so a new build never reloads
mid-fade. `paintPlan` is called exactly where it was.

**The one predicate (coordinator's note):** `filters.js passesPeople` is the
single "did the highlighted people pick this" check — the Board's dim, this
filter, and (next) Our picks' route all call it; its header now says so.

Frames (`v103-shots/list-*`, `board-ben-390`; Saturday 4:15 PM, the nine-person
crew, Ben highlighted with real taps/clicks on the people menu): 390 / 320 /
1280 everyone, menu open mid-choice, Ben, SAT AFTERS + SAT FOLSOM quiet, Sunday,
Ben + Cy ("nothing Ben or Cy picked"), Ana ("nothing you picked"), his EARLIER
opened, the Board dimming beside it, ACL at 390, and both Our picks orders. Filmed
at a tenth of the speed (`filmsheet-thin-on/off`): on, the rows go, then the rest
slide up and the ones below arrive; off, his rows slide down to make room and the
others come in top first.

Our picks open (Kevin: "does filters work with our picks open"): yes, both ways.
Highlight first, then Our picks from the same menu: the open plan over a List
already thinned to Ben, the plan's rows none of his stepping back (as they did
before). Our picks open first: a tap on the avatar puts the plan down to its
peek (unchanged; the Share build owns the menus and the plan) and opens
Highlight; the wall thins behind it and the peek follows (NEXT for Ben).

Tests: `tests/list-highlight.test.mjs` (the real modules on the real Portola
file: only his rows; the quiet line; the date kept; the words; two people; the
fold counts following while the days line does not move; the Board still dims;
a search dims; nothing written), `tests/list-highlight-shell.test.mjs` (the real
shell in the List: the people menu thins in place, widens with a second person,
Everyone restores, the Board beside it dims, no crew write),
`tests/browser/list-view.test.mjs` §6 (Chromium touch, WebKit touch, 1280
mouse — real input, the words never cut, transforms and opacity only).

## Step 3 — the crew playlist's top songs

What changed (`js/spotify.js`): every Spotify call goes through one `call`:
a 429 waits `Retry-After` when the browser can read it (seconds or a date),
else backs off 1-2-4-8 s; it never sits through a single wait over 20 s nor
more than four, and past either it throws `SpotifyBusy`; a 5xx is retried once
after a second; a dropped connection is the browser's TypeError, untouched (one
attempt — offline, a retry only delays the drill's own "Try again", which
`tests/spotify-scan-progress.test.mjs` holds). The playlist's `findTrackUris`
paces its searches a quarter second apart, clamps `limit` to Spotify's dev-mode
max of 10, and on `SpotifyBusy` — or three failures in a row — stops asking.
It hands back `unsearched`: every artist whose top songs did not come. Their
saved tracks still go in, but they stay OFF `found`, the crew ledger, so the
next "Add new picks" tries them again (their saved tracks, already in, are
deduped against the live playlist). Playlist creation and the adds go through
`call` too. A run with nothing at all to add makes no empty playlist, and says
whether Spotify was busy or the lineup unknown.

The words (`js/v3/settings.js`, `spotify.unsearchedNote`): Make playlist ends
"✓ “Portola peeps’ picks” — 4 tracks. 39 artists had no songs found — try Add
new picks again later." (Everyone) or "— try again later." (Just mine); the
top-up (Add new picks, and the quiet one after connecting) says "Added 117
tracks to the crew playlist." and the same count when some are still missing,
and never "already has everyone's picks" while one is missing.

Walked in a real browser (`v103-spotify-walk.mjs`, 390, real taps, a Spotify
answered from memory that 429s for 21 hours after the first search): Make →
the line above, 41 searches in all, no hour slept; a fresh open → Add new
picks → "Added 117 tracks", and the ledger holds all 40. Frames
`spotify-before-390`, `spotify-made-busy-390`, `spotify-topped-up-390`.

Tests: `tests/spotify-rate-limit.test.mjs` (a fake Spotify: 429 then 200; an
unreadable Retry-After's backoff; persistent 429 — four waits, then counted,
saved tracks in, off the ledger; a 21-hour Retry-After never slept; 5xx once;
three failures stop the run; pacing and the limit; the top-up's dedupe and
count; Retry-After parsing), `tests/spotify-playlist-ui.test.mjs` (the real
drill: the Make line, the ledger, Add new picks trying exactly the missed ones,
the top-up's own note, and a re-render mid-run — call 3b).

## Calls (the brief left these open)

**1a. When NOW and the day you are in cannot both show, the row centres on the
day alone.** The rule already ranked the day you are in above NOW. But it
centred on the PAIR even when the pair could not fit, which at 390 on Saturday
rested the row with a 6px violet tail of NOW's W at the left edge and a 5px
sliver of SUN at the right — a stray mark, exactly the edge case Kevin catches.
Now `restingLeft` centres on NOW + the day only when the two fit the row
together; otherwise on the day alone, so the row rests on whole days and NOW
sits past the edge where the fade says there is more.

**1b. The highlight pill keeps the disc counts it had.** `pillCap` asked for
room for `SAT · NOW` as a pair. NOW-first has no pair: keeping NOW whole beside
SAT would need the span NOW…SAT (≈217px at 390), which would fold the pill at
nearly every phone width on Saturday and on Sunday at every phone width — and
fold it for nothing below 412, where NOW cannot show beside SAT even with the
bare avatar. A conditional ask ("only where it fits") is the non-monotonic rule
v96 already removed (a narrower phone showing more discs). So the pill asks for
NOW's width and one gap beside the day's — the same size v93's pair asked for,
monotonic, and the disc counts are exactly what they were. The cost: at 412–430
on a Saturday with two or more people highlighted, NOW rests past the edge where
a bare avatar would have left it in view. The browser promise now says this.

**1c. Disagreement, for the coordinator and Kevin — NOW is out of sight at rest
on most phones on the days it matters.** On a Portola Saturday or Sunday at 390
and below (and ACL at 390 and below on any day but its first), the row cannot
hold NOW and the day you are in, and the day you are in wins (the scrollspy's
promise), so NOW rests a swipe away at the row's start. That is what "scrolling
with the row, not pinned over it" means at those widths; it is consistent (NOW
is always in the same place, which is the ask), and the one-NOW rule means the
peek usually carries NOW on a phone during the festival. But Kevin's own "where
is Ross" flow — highlight Ross, tap NOW — is exactly the moment the peek hands
NOW back to the dock, and at 390 on Saturday it is then off screen. If that
bites, the honest options are: (a) keep this, and teach it (NOW is always at the
start of the days); (b) v90's fixed slot before the row — always in view, costs
the days ~65px (THU scrolls off at 390, and at 320 the row holds one day); (c)
v93's `SAT · NOW`. Not built; his call.

**2a. The quiet line is the room's own head, stepped back.** "One quiet line,
not an empty head": the head stays (it is the door to that night's notes, and
the day keeps its shape as you toggle), its name drops to the quiet tone, the
room's own place goes (nothing there to find), and it says "nothing Ross
picked" / "nothing you picked" / "nothing Ross or Kat picked" / "nothing they
picked" (three or more — the pill beside it names them). The day's first head
keeps the date it leads with. The words sit in their own span that never
shrinks: on ACL's "SAT ACL MUSIC FESTIVAL · OCT 3 · WEEKEND 1" the date and then
the name ellipsize first (found in the ACL frame, where the first cut lost the
words to the ellipsis).

**2b. A quiet room drops its note whisper.** One line means one line; the
night's notes are still behind the head (it stays a door) and in the all-notes
sheet. EVERYTHING ELSE, which is not a room and not a door, simply goes when it
empties.

**2c. The past is judged on the whole wall, then filtered.** Whole days fold
behind "EARLIER · THU · FRI" whatever the highlight (a night is over or not
regardless of Ross), and each room's line counts what is left of his ("EARLIER ·
1 SET"). A room whose only rows of his are over keeps its EARLIER line — it is
not quiet, there is something to open.

**2d. A pick while filtered is not a filter change.** In a List filtered to you,
un-picking a row dims it where it is (the Board's language, `renderCard`'s
`.dim`) instead of pulling it out from under your finger; the next repaint (a
poll, a highlight change) leaves it out. A friend's change arriving on the poll
redraws the List like any remote change, as a cut.

**2e. NOW under a filter follows the filter.** In a List thinned to Ross, what
is live is what is live of his: with nothing of his on, the wall has nothing
live and NOW is not offered (the peek's NOW already follows the highlight —
Kevin: "the filters should filter the now too"). On the Board it still lands on
what IS on, with the quiet toast.

**2f. Follow-up, not built — ACL's Late nights under a filter.** Late nights is
a room per date, so a person with no late-night picks gets one quiet line per
night (up to eleven, frame `list-acl-ben-390`). Truthful and per the brief, but
a run that long reads as noise; collapsing a run of quiet nights into one line
("LATE NIGHTS · SEP 29 – OCT 6 · nothing Ben picked") would lose the per-date
doors in the filtered view. Kevin's call before ACL (Oct 2).

**3a. The root cause, as read, and what could not be confirmed.** The code
path is certain: any search error kept only the maker's saved tracks, silently,
and recorded the artist on the crew ledger as done, so no top-up ever retried
it. Why the searches failed on Kevin's run is not provable from here (no live
429 to read, and the errlog only records thrown errors). The likely story is a
burst of ~50 searches drawing 429s whose `Retry-After` the browser could not
read cross-origin; a 429 without CORS headers, or a Retry-After of hours, fails
the same way. The fix covers all three, and the count now makes the next time
visible to the person instead of silent.

**3b. The drill keeps a running playlist's words across a re-render.** Pacing
makes a 50-artist run a dozen seconds, and the drill re-renders under a running
job (a friend's pick on the poll, the owner-app config landing — the scan's own
known case). The progress line and the closing count used to be written to the
card that started the run, which a re-render orphans — the count this release
exists to say could have landed on a card nobody sees. Now `sayPl` keeps the
latest line and writes it to the mounted card (`#spot-pl-status`); a card
mounted mid-run catches up and keeps Make / Add new picks down until it ends;
a finished line stays a minute for a card that comes back to it.

**3c. Not changed, noticed:** the crew-playlist header ("Crew playlist · 1
artists · by Ana") is drawn when the drill opens, so after a top-up it shows
the old count until the drill opens again (and says "1 artists"); a
connect-time top-up still records artists only by the member who connected
(other members' saves for an artist already on the ledger are never added —
the ledger's design, not this bug).
