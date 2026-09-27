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
- [x] frames 390 / 320 / 1280, Portola and ACL, looked at (`v103-shots/`, git-ignored;
      rendered by `v103-rig.mjs`, `v103-film.mjs`, `v103-spotify-walk.mjs`; all
      re-rendered on the final code after main's ticket-price data merged; the
      rows each frame shows are in `v103-shots/rig-report.txt`; contact sheets
      `sheet-now-docks`, `sheet-now-rails`, `sheet-list-*`, `sheet-spotify`,
      films `filmsheet-390-in/out`, `filmsheet-1280-in/out`, `filmsheet-thin-on/off`)
- [x] local `npm run test:browser` at 0c256a6: 349 of 351 (1 skipped) — the one
      red `meter-contract` "a real click is a small event" under a load average
      of 20–32 from other sessions; that file alone: 27 of 27. The run before
      (464ed69): 349 of 351, its one red the plan-drag flick (a known
      load-sensitive delivery, OUR-PLAN-BUILD.md).
- [x] gate at 0c256a6: npm test at UTC / Asia/Tokyo / the night clock 1274 of 1277
      each, the one red the SW stamp (with a temporary local `--keep` stamp,
      restored after: 1275 of 1277, 0 fail, at all three); validate-festivals 0
      errors; `npm audit --omit=dev --audit-level=high` 0; CI 36280202963:
      **browser green** (Linux Chromium + WebKit), checks red on the stamp only
      (so CI's Tokyo / night / audit steps never ran there — run locally above)

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

## The gate, as it runs (reds read by name)

- CI 36280202963 (0c256a6): browser **success**; checks red on the stamp only.
- CI 36279004159 (464ed69): the three reds below fixed; one WebKit red once —
  `WebKit 320: Ross highlighted — NOW slides SAT AFTERS … just enough` read the
  stack row at 38 of 41 (its glide not done); it passed in every run before
  and after and three times locally, so it is logged as a flake, not fixed.
- Node, three clocks, at 6f77de1: 1273 / 1276 each (UTC, Asia/Tokyo, the night
  clock); the one red is the service-worker stamp (not stamped, by the brief);
  one skipped, one todo (the banked offline-add casing). validate-festivals: 0 errors.
- CI 36276281144 (f3259ae), 36277438452 (4b7f92d), 36278032908 (6f77de1) —
  `checks` red on the stamp only; `browser` red on:
  1. **`acl-2026 at 430: the row's contract` (every run, Linux):** "SAT3*:45/46"
     — the day you are in cut 1.3px. With NOW leading, NOW…SAT 3 came one
     pixel wider than the row, and `restingLeft`'s pixel of slack (meant for
     rounding at the row's END) called SAT 3 whole inside the row, where its
     sub-pixel width cut it further. Fixed: the slack applies only at the
     row's two ends; a new pure test pins it (red under the old rule).
  2. **`Chromium 320: the pill refits when NOW leaves the day row`** (runs 1
     and 3, and once in my full local suite; never alone, throttled 6x, or six
     copies at once, even instrumented): after NOW left, the row rested at 0
     with SAT past its right edge. What v103 had changed under it: the pill
     used to refit when NOW LEFT THE ROW (a childList mutation), and NOW no
     longer leaves the row — it only hides — so the refit after NOW had gone
     never came; and `pillCap` had stopped counting a NOW on its way out,
     which moved the refit earlier, into NOW's leave. Both put back: the
     pill's watch now also observes NOW's `hidden`, and a leaving NOW keeps its
     room until it is gone (as `dayRowGeometry` already said) — v102's
     sequence of events exactly. (Ruled out by a probe: a same-place scrollTo
     does abort a smooth glide in both engines, so it is not a no-op race.)
     That was not it — CI 36279447834 (250537d) red again, the wide-glyph
     twin. **Diagnosed with a row log** (now carried in the test's failure
     message): on the Tuesday tick the day turns, `recomputePast` redraws the
     whole festival (a record, read whole: THU and FRI back above), and
     `renderDayNav` wires the scrollspy at the page's OLD height — it lights
     THURSDAY and the row rests at 0 — before `keepWallPlace` restores the
     place; the spy then relights SATURDAY a long frame later (~950 ms here,
     longer on a loaded runner) and glides the row to it. The test read the
     row in that window: Saturday lit, row still on Thursday. The app ends
     right; the test's "at rest" now waits for the lit day to be whole as well
     as the row still (`dockStill`). The late relight is the banked "FRI flash
     on open" (NOW.md, ACL prep) — the same spy-before-place order — so it is
     left for that fix and not patched here.
  3. **`WebKit 390: NOW is the day row's first item … a tap lands`** (runs 1
     and 2, Linux WebKit): the page never moved, so the tap missed NOW. At 390
     on Saturday NOW rests past the edge and the test let Playwright's click
     scroll the row to it. A new helper, `tests/helpers/browser.mjs
     nowInView`, brings the row to its start first (the swipe's stand-in — the
     swipe itself has its own real-touch test) and waits for NOW whole and
     still; every NOW tap in the now-jump contract uses it. It also caught a
     test that had been passing for the wrong reason: the List's "NOW lands on
     a row" at 390 tapped NOW's centre past the row's edge — the avatar — and
     passed because rows were already ringed at the top.

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

## For the coordinator (not done here)

- **CLAUDE.md not edited** (the harness's instruction file). Proposed, for the
  List bullet: "In the List a highlight FILTERS (v103): rows none of the
  highlighted picked leave the DOM, an emptied room is its own head, quiet
  (`wall.js thinByPeople`); the Board still dims. `filters.js passesPeople`
  is the one 'did they pick this' predicate — the dim, the filter and Our
  picks' route all ask it." And for NOW: the day row's first item, one place
  whatever the day (the `SAT · NOW` wording in the zoom bullet's neighbours is
  history now).
- **Not stamped, no PR** (the brief). `renderDayNav` → `paintPlan` order is
  unchanged; `paintPlan`, `openShowMenu` and the menus are untouched.

## Sol's review of bfcf621 (2026-09-26 ~5:15 PM PT) — the round, as it runs

Review: `~/.codex-runs/cx-20260926-171201-83805-a34ebf/last-message.md`. The
coordinator's order: the Spotify items and the test helper first; `app.js`,
`wall.js` and CSS only once the v104 walker (walking bfcf621 in this worktree,
its files `V104-WALK.md`, `v104-walk.mjs`, `v103-shots/walk-*` — not ours to
touch) says it is finished. Each fix gets a failing test first.

- [x] R1 BLOCKER — a Spotify WRITE is never repeated blind. The shared path
      retried a playlist create or add after a 5xx, which Spotify may have
      done anyway (a second playlist, doubled tracks). Reads keep their one
      retry; a 429 on a write still waits and retries (a 429 is a refusal —
      nothing was done); a 5xx on a write is ambiguous: an add re-reads the
      playlist and adds only what is missing, a create is not repeated and
      the words say so. **Done:** `call` throws `SpotifyUnsure` on a write's
      5xx; `pushTracks` reads the playlist back and adds only what is missing
      (once — a second unsure answer is said); a create is never repeated
      ("Spotify didn’t confirm the playlist — check your Spotify before making
      another."). Five fake-Spotify tests, four red first (the 429-on-a-write
      one was already right and stays as a guard). While there: a track two
      picked artists share goes in once.
- [x] R2 BLOCKER — an artist whose search answered with NO top songs is not
      "done": it stays off the crew ledger even when the maker's saved tracks
      went in, the top-up carries the count, and "already has everyone's
      picks" is never said while one is missing. **Done:** `findTrackUris`
      returns `topless` (searched, answered, no top songs) apart from
      `unsearched`; only artists whose top songs came are `found` (the ledger);
      `toplessNote` says "N artist(s) had no top songs on Spotify — Add new
      picks looks again." on Make and on the top-up, and "already has
      everyone's picks" needs nothing added, nothing unsearched, nothing
      topless. It replaces "had no findable track". Cost, accepted: an artist
      Spotify never has is searched again on every Add new picks and said
      again — one search, and honest. Tests: two fake-Spotify, two in the real
      drill (both cases the coordinator named), red first.
- [x] R5 NIT — `nowInView` fails with the row's geometry instead of swallowing
      its timeout. **Done:** it throws "NOW never came whole and still in N ms"
      with NOW's and the row's boxes and scroll; `tests/browser/now-in-view.test.mjs`
      (plain pages, red first). The NOW contract and the List suite pass
      with it (74 of 74).
- [x] R3 BLOCKER (Sol) / kept as designed (coordinator) — unpick in a filtered
      List dims in place (call 2d), but "the next repaint" must be real and
      bounded; a pick change from elsewhere repaints the filtered List. UI test.
      **Done** (after the walk finished, per the coordinator): a row that stops
      belonging dims where it is and LEAVES at the first natural moment once you
      have let it go — the zoom gone (standing or still shrinking), the shelf
      closed, the mouse off it, a keyboard's focus moved on — checked every
      400 ms while one waits, and at the minute tick; it leaves the way the
      filter's own changes do (fades, rows slide up, the room's words and
      EARLIER count right). Any repaint in between (a friend's change on the
      poll) keeps a row you are still on (`ctx.holdRows`, wall.js `listKeeps`);
      a change made elsewhere redraws the filtered List at once. A focused row
      holds only while a key was the last input: a closed shelf hands focus back
      to its card for every hand, and the first cut held the finger's row for
      good because of it. Filmed at a tenth of the speed (`filmsheet-left`):
      the zoom shrinks away, then the row fades, then the rows below slide up;
      the first cut faded the row while the zoom was still shrinking over it.
      Tests: `tests/list-highlight-pick.test.mjs` (the real shell: a finger's
      shelf, a poll while the shelf is up, the room going quiet, EARLIER · 1 SET
      staying, a keyboard's focus, a friend's sync), three red first on the old
      code; `tests/browser/list-view.test.mjs` §7 (Chromium touch, WebKit touch,
      1280 mouse — real input: dims, stays while you are on it, leaves).
- [x] R4 IMPORTANT — the dayless EVERYTHING ELSE group renders after the
      filter ran; it must pass the same predicate. Fixture test. **Done:** the
      group is filtered by `listKeeps` (the one predicate plus rows in hand) and
      not drawn when empty; a fixture (Portola plus two dayless names) in
      `tests/list-highlight.test.mjs`, red first.

**Also fixed on the way:** the frames rig seeded a highlight into
localStorage, where filters.js never reads (a highlight is this tab's —
sessionStorage), so round one's `now-sparse-hl-*` frames were not highlighted.
Re-rendered: `sheet-now-hl.png` (390: the pill with one face and its ✕, NOW past
the edge; 320: the pill folded to the avatar's size). And this worktree's
`node_modules` link pointed at the removed `list` worktree (dangling since about
5:30 PM, which also blocked the walker's start); it now points at the main
checkout's (jsdom 30.0.1, Playwright 1.58.2, the lockfile's).

**The v104 walk (`V104-WALK.md`) — its three FAILs read against the code, all
measurement:** (1) at 1280 its "in view" compared the line to the dock's top,
and the dock is `display: none` on a laptop (top 0), so every landing read out
of view; at 320 its 140px swipe is shorter than the ~147px the row rests from
its start on a Saturday — NOW came 34 of 41 px into view (that distance is call
1c's point, not a defect). (3) The Board has 32 cards to the List's 25 because
the Board does not fold a room's own past (LIST-BUILD call 2) — its 24 of 32
dimmed is the Board dimming. (8) The 9 "refused writes" before its pick are
`POST /api/person`, the boot's person ping, one per page it opened (the rig's
own report says so for every frame: "writes refused: N (POST /api/person)");
no highlight or filter wrote to the crew.

- [x] R6 (the coordinator's call on 2f, after the walk) — a run of consecutive
      empty date-rooms of one dated section is ONE quiet line naming its span:
      "LATE NIGHTS  SEP 29 – OCT 10 · NOTHING BEN PICKED" (frame
      `list-acl-ben-390`, where there were ten lines). A single empty date keeps
      its own quiet line and its door; the span's line is a plain head (no new
      control — a span is not one date's thread; the all-notes sheet still lists
      any notes on those dates) and keeps every date it stands for
      (`data-isos`), so the day-of open still lands on it (`scrollToNowLine`).
      Test in `tests/list-highlight.test.mjs` (ACL, red first): nothing late →
      one line; one pick on Oct 9 → "Sep 29 – Oct 8" · the Oct 9 room ·
      Oct 10 alone.
- [x] `nowInView`, as the NIT meant, caught a real race on CI (36283368547,
      WebKit 390, Nhu highlighted): the row was taken to its start, then the
      highlight's pill refit brought it back to rest (`scrollLeft` 57) and NOW
      stayed cut — the old helper had hidden this by letting Playwright's
      click scroll for it. The helper now swipes again when the row comes to
      rest with NOW still cut (a person would), with an 8 s budget, and still
      fails with the geometry; `tests/browser/now-in-view.test.mjs` has the
      re-resting row as a third case. Locally the NOW, List, people-menu and
      helper suites: 104 of 104.
- The v104 walk files (`V104-WALK.md`, `v104-walk.mjs`, the walker's) are
  committed with this step, as the coordinator asked; the walker reports 8 of
  8 PASS on bfcf621 (its first table's three FAILs were its own measurements,
  read above).

**Gate of the review round, at d6cd473:** npm test at UTC / Asia/Tokyo / the
night clock 1290 of 1293 each — the one red the service-worker stamp (not
stamped, by the brief); validate-festivals 0 errors. CI 36284277397:
**browser green** (Linux Chromium + WebKit), checks red on the stamp only.
Earlier heads this round: 421c141 (Spotify) browser green; 83b486c browser red
once on the NOW helper race fixed at d6cd473 (read above).

## Sol's re-review of 02536c3 (2026-09-26 ~6:15 PM PT) — round two

Review: `~/.codex-runs/cx-20260926-181122-2124-7467fb/last-message.md`. Cleared:
the 429 write retry, the paginated readback, re-searching no-song artists,
EVERYTHING ELSE, `nowInView`, the span line. Three left, each red-first. The
coordinator's rule for Spotify's ambiguous writes: if a round three finds
another hole there, cut to "never retry or resume a write, just say what
happened".

- [x] S1 BLOCKER — a confirmed create is recorded (id + URL, where a finished
      Make records it) the moment Spotify confirms it, before any add; a later
      add failure leaves a playlist the screen links and tops up (Add new
      picks), never a second create. **Done:** `playlistFromPicks` calls
      `onCreated({ id, url })` as soon as the create is confirmed; the screen
      records an Everyone playlist then, with no artist done yet (`artists: []`),
      and records the finished artists after. An add that fails after the create
      throws with `.playlist`; the screen says "Spotify made the playlist but
      didn’t confirm the songs — Add new picks finishes it." and links it (a
      Just mine one: "— open it to check"). Tests: two fake-Spotify (the
      hand-back before any add; the error carrying the playlist, one create) and
      one in the real drill (the adds and their read back failing: recorded,
      linked; then Add new picks fills it; one create), all red first.
- [x] S2 IMPORTANT — each leftover row settles on its own: un-pick A, move to
      B and un-pick it — A leaves while B is held. The page is held by the row
      the person is on (the zoomed or hovered card), so nothing under the
      pointer moves when a row above it leaves. **Done**, with one rule the
      browser taught: a row leaving ABOVE the card in hand is taken back by
      scrolling the page up by its height — and where the page is too near its
      top to scroll that far (a List filtered to yourself is often one screen),
      it would pull the held card up under the pointer, so that row waits for
      the held card to be let go; rows below it always go. "In hand" is per row
      now (its own zoom, a mouse on it, a keyboard's focus); the whole wall
      waits only while a sheet is up or a zoom is really shrinking away (a
      slot with a running animation — a stranded one never holds the wall).
      The card in hand, for holding the page, is the zoomed card, else the
      hovered one, else a keyboard's, else the card nearest a mouse between
      rows (the one it is on its way to). Tests: `tests/list-highlight-pick.test.mjs`
      "un-pick A, then B" (red first); `tests/browser/list-view.test.mjs` §8,
      real mouse at 1280, both cases — a long filtered List (Tricky leaves
      while Robyn's zoom stands; Robyn's top sampled every 16 ms never moves)
      and one at the page's top (Tricky waits; Robyn never moves; both go when
      the pointer does). The long case failed once of six runs, at a load
      average of 135 from other sessions (it waited 22 s); five passes since.
- [x] S3 NIT — the leftover check sleeps while the tab is hidden and wakes on
      visible. **Done:** the watch stops on a hidden page and restarts when the
      page is seen (the clock's visibility handler calls it); test watches the
      app's 400 ms timers across hidden → visible (red first).

**Gate of round two, at 80b2cb9:** npm test at UTC / Asia/Tokyo / the night
clock 1295 of 1298 each — the one red the service-worker stamp (not stamped,
by the brief); CI 36285983812: **browser green**, checks red on the stamp only.
Local: the List browser suite 20 of 20 (both §8 cases), `list-highlight-pick`
8 of 8. The leftover re-filmed (`filmsheet-left.png`): the zoom shrinks away,
the row fades, the rows below slide up — unchanged by the per-row settling.

## Sol's round 3 on e2988ee (2026-09-26 ~6:50 PM PT) — the mechanism cut

Review: `~/.codex-runs/cx-20260926-184621-58555-af5a91/last-message.md`. The
hidden-tab watch is clean. This is the third round on Spotify's ambiguous
writes, so, as agreed, the mechanism is CUT rather than patched a fourth time:

- [x] T1 BLOCKER — no early record, no mid-flight resume, no read-back-and-
      add-the-missing. A 5xx on a write is never repeated (a 429 still waits
      and resends: a refusal). The crew playlist is recorded ONCE, at the end,
      by the finished Make's own path — and the drill is redrawn then, so the
      button in front of you is the recorded playlist's Add new picks, never
      Make playlist. On a failure after a confirmed create it is recorded with
      the artists whose songs were confirmed so far, and the words say "Spotify
      made the playlist but didn’t confirm every song — Add new picks finishes
      it". No shared crew record exists mid-run (which also removes the window
      where a friend saw an empty-ledger playlist). Test in the open drill,
      without reopening it. **Done:** `pushTracks` adds in batches of 100 and
      stops at the first failure, saying how many songs landed before it; the
      error from `playlistFromPicks` carries `.playlist` and `.confirmed` (the
      found artists whose every song landed). The screen records once — after a
      finished Make with its found artists, after a failure with the confirmed
      ones — and redraws the drill both times (a finished Make now shows the
      recorded playlist's Add new picks at once, too). Just mine records
      nothing and says "— open it to check". Removed: `onCreated`, the
      read-back in `pushTracks`, their tests. Tests, red first: an add's 5xx is
      one add, no read back, and says none confirmed; a 150-song Make whose
      second batch fails confirms exactly the 33 artists whose songs all landed
      in the first 100; in the real drill, never reopened: no crew record at
      the create or the add, then Add new picks visible (no Make playlist), the
      words, the link, the record with no artist, and Add new picks filling the
      same playlist — one create.
- [x] T2 IMPORTANT — rows are kept by their occurrence and room, not the
      artist's name: un-pick Horse Meat Disco while holding its Afters row, and
      its Folsom row still leaves. **Done:** one key for a row, `rowKey(card)`
      in wall.js — the day block, the room (and its date), the artist and the
      occurrence — which a fresh render gives the same row again. The shell's
      held rows (`rowsInHand`), the thinning's keep set (`thinFlow`), the
      leftover settle and the render's `ctx.holdRows` all carry row keys now,
      and `listKeeps(ctx, card)` asks about a CARD, never a name. EVERYTHING
      ELSE is drawn whole and then thinned by that same card rule (it used to
      filter entries by name before drawing), its head going with its last
      row. Test, red first (it timed out on the old code, "still waiting for
      the Folsom row to leave while the Afters row is held"): Horse Meat Disco
      picked by Kevin, which Portola shows on Friday under Afters AND Folsom;
      the keyboard on the Afters row un-picks it; the Folsom row leaves, the
      Afters row stays dimmed.
      **Found walking it, and fixed (call 3a):** the real-browser walk
      (`v103-twice.mjs`, Chromium and WebKit, real Enter and Tab) showed the
      Folsom row leave as it should — and the keyboard lose its place. The
      Folsom row leaving repaints the wall, every card is a new node, and the
      focused Afters card was replaced: focus fell to `<body>`, so the next
      Tab went to the top of the page, and the row's keyboard zoom (handed to
      the fresh card by the repaint) stood on with nothing focused in it,
      holding the row until something else closed it. Then, once the row did
      leave, the same repaint dropped the focus from the room head the
      keyboard had just reached. On main every repaint (a friend's pick on the
      25 s poll) drops keyboard focus the same way; v103 made it matter,
      because "a keyboard is on the row" is what holds a row. Fix, in the one
      repaint path (`repaintWall`): read where the focus is before the render
      — a card by its row key, anything else a Tab reaches by its day, room
      and kind, the nth of that key — and hand it back to the same place
      afterwards, quietly (`focusQuietly`: no fresh keyboard zoom), only when
      the focus went nowhere. Never by its words (a count in them is what
      changes). Tests, red first, in the Horse Meat Disco test: after the
      Folsom row leaves, the focus is still on the Afters row (was `<body>`);
      the focus moved to the days line, the Afters row leaves and the focus is
      still on the days line (was `<body>`). Walk after the fix, both engines:
      focus stays on the row; Tab walks the zoom's "Add a note" and "More"
      (row stays), then the next room head (row gone, focus kept there), then
      Despacio. Frames: `v103-shots/twice-{chromium,webkit}-{1-before,2-held,
      3-left}.png` — the Our picks peek goes from "NOW till 9 PM" to "till 11
      PM" as Horse Meat Disco comes off Kevin's night.
      **And the same drop from inside a zoom (call 3b):** the keyboard on a
      standing zoom's own controls (its −, "+ note") when a friend's pick
      arrives on the poll — the repaint rebuilds the overlay, and the focus
      fell to `<body>`. Focus inside a standing zoom now counts as the zoom's
      card, and the card takes it back (as the notes door already hands focus
      back to the card the zoom stood on). Test, red first: Ross's Tricky,
      keyboard zoom, focus on its first enabled control, a friend's pick
      polled in — the zoom stands on, the focus is on Tricky (was `<body>`).
      Walked in both engines: Tab into Despacio's zoom ("Less for Despacio"),
      a friend's pick brought by the poll, the wall really repainted (a mark
      on the old card is gone), the zoom stands and the focus is on the
      Despacio card — `twice-*-4-repainted.png`. The walk's one page error,
      `reg.update` of undefined, is the rig: Playwright's service-worker block
      resolves `register()` with nothing; a real browser resolves a
      registration.
      **A flake read, not the system:** one full local browser run failed
      `people-menu` "Chromium 1280 mouse … the tops on one line (40.6 /
      38.5)" — green alone three times, green on CI, and 2.1px is the menu's
      4px arrival slide caught mid-way on a loaded machine (the test read the
      boxes 350 ms after a press). Its `press` now waits for the menus'
      animations to rest before any geometry is read; the file is 24/24.
- [ ] T3 IMPORTANT, pre-existing on main — banked below, not fixed now.

### T3, banked: the crew playlist's ledger is one array, and arrays don't merge

What Sol found (pre-existing — main has it at the top-up in
`js/v3/settings.js`, `syncEveryonePlaylists`): the crew playlist's record
keeps the artists already added as ONE array, `spotify.playlists[fid].artists`,
and every top-up writes the whole record back — `{ ...meta, artists: [...old,
...found] }`. `jsonb_deep_merge` (`db/schema.sql`) merges objects key by key
but REPLACES arrays, the same reason notes are keyed objects (see CLAUDE.md).

The scenario: Kevin connects Spotify and his quiet top-up starts (it reads the
ledger `[A, B]`, finds C). Meanwhile Nhu opens the drill and presses Add new
picks (she read `[A, B]` too, and finds D). Kevin's write lands `[A, B, C]`;
Nhu's lands `[A, B, D]` and erases C. (Two members pressing Make at the same
moment is the same race one level up — two playlists, and the record keeps
whichever landed last. Rarer, and also on main.)

What it costs today, read from the code: C's songs ARE in the playlist, but
the ledger says C is missing, so every later top-up looks C up again (more
Spotify calls each run, against the rate limit this release paces) and
the drill's "Crew playlist · N artists" reads low. It does NOT double songs:
`addArtistsToPlaylist` checks the live playlist's tracks before adding. T1
narrowed it back to main's level — there is no mid-run record any more, so the
only writes are the finished Make and each top-up's end.

The fix, for a follow-up release: key the ledger by artist —
`artistsBy: { "<lowercased name>": 1 }` — so two top-ups merge into the union
instead of the last one winning. Read BOTH shapes (the legacy array and the
keyed object; the union of the two is the ledger), write only the keyed one,
never migrate. Readers to move with it: `playlistMissingArtists`
(js/spotify.js), the drill's artist count, and the Make's end record. Test it
where the merge really runs: `tests/db-merge.test.mjs` (PGlite, the production
merge SQL) with Sol's scenario — two top-ups from the same `[A, B]`, one adding
C and one adding D, in either order, and the ledger ends `A, B, C, D`; plus a
legacy-array crew topped up by the new code keeps its array artists.
