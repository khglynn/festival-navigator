# OURS — "where will most of us be?" (design brief)

**Status:** design done, nothing built, 2026-09-25 evening PT. Three
directions, nine phone frames rendered from the production app, one
recommendation (**O3, "Find us"**), and five calls for Kevin at the bottom.

**Folder map** (all in this folder, nothing else touched):

| File | What it is |
|---|---|
| `BRIEF.md` | this |
| `frames/*.png` | the nine frames, 390 x 844 CSS px at 2x |
| `ours-model.mjs` | the logic as a pure, runnable module (the builder's reference) |
| `crew.mjs` | the made-up crew: Ana..Jo, invented picks on the real lineup |
| `print-route.mjs` | `node print-route.mjs` prints every night's route and share text |
| `ours-proto.mjs` + `ours-proto.css` | the three directions, built on the real wall in the page |
| `rig.mjs` + `frames.mjs` | `node frames.mjs [O1 O2 ...]` re-renders the frames |
| `baseline.mjs`, `scratch/` | the untouched wall at Sat 9:40 PM, for comparison |

How the frames were made: `rig.mjs` boots the real app (index.html, v3.css,
renderCard, sheetCard) in one headless Chromium with the made-up crew, the
harness pattern from `tests/browser/now-jump.test.mjs`. `/api` is answered
inside the page (writes refused), every request that is not the local static
server is aborted, and the clock is pinned. Nothing touched a database. The
token in `rig.mjs` is invented. Frames are PNGs, which `.gitignore` denies by
default, so they will not ride along in a commit unless allowlisted.

## The ask (Kevin, voice, lightly trimmed)

An OURS door after the day tabs. Filters to what most of the crew wants,
across times and shows. Friends outside the group need to find us: where,
and when. Never show things only one or two people picked. Hide or
highlight — undecided. Center on the use case.

## Grounding notes (read 2026-09-25)

1. The wall: stage grid only where the fest publishes one (Portola Sat/Sun,
   five stages at `--col-w`, two visible on a phone); everything else is
   venue stacks (afters, Folsom). One room head per room (`SAT PORTOLA`).
2. Highlighting a person dims (`.card.dim`, opacity .28), never hides
   (MODEL-V4 §3b.2, Kevin 2026-09-17). The old hiding filter is the "weird
   and jarring" one Kevin remembers.
3. NOW (v87): a `--brand` button before the day tabs; with a person
   highlighted it lands on their live pick, stop by stop.
4. Late nights (ACL) set the precedent for a tab AFTER the days; the
   seasons branch's YOURS is a tab + a block (room head + flat card grid)
   that arrives the way NOW does.
5. Picks are per ARTIST, not per set. Portola has at least ten artists who
   play twice (Groove Armada Warehouse 4:45 PM and Great Northern 1:30 AM
   the same day; Fcukers, Chloé Caillet, Max Styler, Airwolf Paradise,
   Jigitz, Parcels, Fatboy Slim, Soulwax, Clearcast...). The logic has to
   say which occurrence a pick puts you at.
6. Friday night and Sunday have real cross-town conflicts: Folsom Street
   Fair (Sun 11 AM - 6 PM) overlaps Pier 80; Horse Meat Disco (Public Works)
   vs 2manydjs (1015 Folsom) on Friday.

## The logic (the design lives or dies on this)

The reframe: "most of us" is not "what a majority picked across the day".
A crew of nine at a five-stage festival almost never has a majority at one
set. The question a friend asks is "where is the BIG group at 9:40?", so the
answer is, moment by moment, **the place with the most of us** — as long as
it is a real crowd. Runnable reference: `ours-model.mjs` (pure; imports only
`js/v3/events.js`), printed by `print-route.mjs`.

1. **Who is "us".** Crew members with at least one pick at this festival.
   A member with no picks here is not counted anywhere (they may not be
   going; counting them makes the bar unreachable and the "of 10" a lie).
   Fewer than three pickers: there is no OURS at all (no door).
2. **The bar.** `max(3, ceil(us / 4))` people at one place at one time.
   Three for any crew up to 12, then a quarter (20 pickers: 5). Kevin:
   "never show ones where it's just one or two people". Nothing under the
   bar ever renders, not even as a count.
3. **Most vs some.** More than half of us together is **most** (drawn as
   the full card); at or over the bar but not half is **some** (drawn
   quieter, one line). Nine pickers: 5+ is most, 3-4 is some.
4. **Must vs picked.** Counts are heads, never weights: a must and a
   one-bar pick are one person each (a friend is looking for bodies). The
   level decides only WHERE a person is when their picks overlap, and the
   stop says how many musts it holds.
5. **One body, one place.** Picks overlap (Ana has Dog Blood 9:00-10:15 and
   Soulwax 9:55-10:55). Every 5 minutes each person is put at exactly one
   place: their highest-level live pick; a tie goes where more of the crew
   is, then where they already were (nobody hops mid-set for an equal pick),
   then to the set that just began. Without this, 9:55 would count Ana twice.
6. **What a place is.** On the grid, one set on one stage. Everywhere else
   (afters, Folsom, Late nights), a **room**: a venue on a night, as the wall
   already treats it (MODEL-V4 §5). In a room you arrive for your first pick
   and stay through your last, so a room's crowd grows through the night.
   Its time is the room's own clock (`venueGroupsOf` windows): a run member
   until the next starts, a ranged show start to end, a doors-only room
   doors to close.
7. **Untimed acts.** An untimed name inside a timed room counts toward the
   room (you are at the venue) for the room's whole window. A festival name
   with no set at all has no place on a clock: never on the route.
8. **An artist who plays twice** (the big one). Picks are per artist, and
   Portola has ten-plus doubles: Groove Armada is Warehouse 4:45 PM AND the
   Great Northern 1:30 AM the same Saturday. A Groove Armada pick counts at
   the festival's set; it counts in a room only for someone who also picked
   an act there that plays nowhere else. Without this rule, Saturday 1:30 AM
   showed "4 of us at the Great Northern" built from people who wanted the
   4:45 PM set. Cost: a room whose every act also plays Pier 80 (Sun 888
   Garage: Fatboy Slim + riria) can never count; per-set picks would fix it
   and are not on the table before ACL.
9. **The route.** At each moment, the top place if it clears the bar. A
   second place that also clears it is a **fork** ("or 3 at Prospa").
   Moments where nothing clears it for 20+ minutes are **scattered**, said
   honestly; shorter gaps are a changeover and just continue the path.
   Blips under 15 minutes fold into their neighbour.
10. **NOW.** The stop the festival clock is inside, plus the next one.
    Between stops: "scattered right now" and the next time most of us meet.
11. **A friend NOT in the crew.** They cannot see the crew (law 1: nobody
    sees people in circles they are not in, and the crew link makes them a
    member). So the answer leaves as words the sharer sends: "Sat at Portola,
    we'll be: 9 PM Dog Blood, Pier Stage · 10:15 Soulwax, Crane Stage ·
    10:30 till late, Public Works". Counts optional, never names, never a
    link (a crew link is a credential). The share sheet does it; no server.
12. **Nothing clears the bar.** Say so in one quiet line and point to the
    nearest night that does ("Nothing has three of us on Thursday — Friday
    does, from 9 PM"). Never fall back to showing pairs.
13. **The fold (show menu).** OURS describes the crew, not your view, so
    by default it ignores rooms you have hidden (if most of us are at
    Folsom, that is the truth). This breaks the "a hidden part renders
    nothing" rule on purpose; it is an open call for Kevin.

What the model computes for the made-up crew (9 pickers, Jo picked
nothing, bar 3), real Portola file:

- **Thu:** nothing reaches three (empty state).
- **Fri:** 9 PM Public Works, Horse Meat Disco, 4 · fork from 12:30 AM:
  1015 Folsom, 2manydjs, 4.
- **Sat:** some: Gelli Haha 4, Tricky 3, Groove Armada 4 (fork Fcukers 4) ·
  MOST: Tove Lo 6 · some: DJ Shadow 3 · MOST: Robyn 7 (fork Kettama 3) ·
  some: Kettama 3, Fatboy Slim 3 · MOST: Dog Blood 8 (9-10:15) · MOST:
  Soulwax 5 (fork Prospa 3) · MOST: Public Works from 10:30, Milli Meng →
  Fcukers, 5 (forks: 3 stay at Soulwax till 10:55, then 3 at Audio).
- **Sun:** some: Folsom Street Fair 4 (11-6, forks at Pier 80 all
  afternoon) · MOST: Mochakk 5 · some: Tiësto 4 / Zara Larsson 4 (a true
  split) · Overmono 3 · MOST: Swedish House Mafia 8 · some: Parcels 4
  (fork Four Tet 3) · scattered 11 PM - 12:30 AM · some: The Midway, Two
  Shell 4.

## Words this adds to the UI

`OURS` (Kevin's word), "of us", "split", "scattered", "Tell a friend where
we'll be". None of them collide with picked / must / notes / fest. The count
is always heads ("5 of us"), never a percentage.

## Three directions

Each one answers the same test: a crewmate gets "where are y'all?" in the
group chat and has to answer from the phone in under five seconds. All three
run on the same logic above, so the choice is about where the answer lives,
not what it says.

### O1 — Our day: the route (a tab after the days)

**Pitch:** the day as the group will walk it, top to bottom: one path, a
node per stop, the real card beside each big moment.

- **Door:** `OURS` after the day tabs, with three small dots in the colours
  of the people at today's biggest stop, so it reads as "us" before it is
  read. Idle it looks like a day tab. Open, it is `--brand` with the tab's
  underline, never `--fest`, because it is not a day.
- **Where it lives:** a block after the last day, like ACL's Late nights:
  one room per night (`SAT OURS  SEP 26 · 9 OF US PICKING`), one route per
  room. A tap lands on today's route.
- **The route:** "most" stops get the time in Anton, the place, the crowd
  (avatar cluster + "7 of us"), and the real card at `--col-w` beside them.
  "Some" stops are one quiet line on the same path. A fork branches off the
  path ("or 3 at Kettama · Warehouse · from 7:15 PM"). A split puts two cards
  side by side on the one column track, each with its own count. A scattered
  stretch is a dotted run of path with its hours.
- **NOW:** what is over steps back to .42; the stop you are in wears the
  wall's own now ring and a `NOW · 9:40 PM` pill on its node.
- **Empty:** "Nothing has 3 of us on Thursday. **Friday does**, from 9 PM."
- **Answering the friend:** fast if you are already on it (about three
  seconds from a tap on OURS); a "Tell a friend" line at each route's foot
  would send the same text as O3.
- **Motion:** OURS glides the wall down like any day tab. On arrival the
  path draws down from the first node (scaleY from its top), each stop rises
  6px and fades in a beat apart, cards last; forks unfurl sideways from the
  path. When a crewmate picks mid-look, a stop that appears slides in and its
  neighbours make room (FLIP transforms); counts cross-fade. Out is quick
  and plain. Reduce Motion / Low power: instant.
- **Cost before Sunday: M, leaning L.** A new block type after the last day
  (the Late nights tab is the precedent), the tab joining the dock, rail and
  scrollspy, the route renderer (five row kinds), NOW classes on the minute
  ticker, motion, tests.
- **Risks:** the longest build; a fourth-plus screen of route under a
  wall that is already long; it shows the plan well and the moment less
  well than O3.

Frames:
1. `frames/O1-key.png` — Saturday before doors, the route from Gelli Haha to
   Dog Blood: two quiet stops, a 4/4 split (Groove Armada / Fcukers), Tove Lo
   6 with a fork, Robyn 7, Dog Blood 8.
2. `frames/O1-now.png` — Saturday 9:40 PM: the past stepped back, Dog Blood
   ringed with the NOW pill, then Soulwax 5, then Public Works from ~10:30
   ("then Fcukers ~1 AM · till ~3 AM"), Sunday's route starting below.
3. `frames/O1-empty.png` — Friday 5:30 PM (tonight): THU OURS says nothing
   reached three and points at Friday; FRI OURS is one quiet stop with an
   even fork across town; Saturday under it.

### O2 — Ours, in place: the crew's highlight (a chip, the wall dims)

**Pitch:** tap `Ours` the way you tap a friend's name, and the wall keeps
only what most of us are doing, lit and counted, everything else dimmed.

- **Door:** an `Ours` chip leading the people row, wearing everyone's colour
  at once (the aura engine with every picker at two bars). The individual
  chips fade the way they do for any highlight; `everyone ✕` clears it.
  This is Kevin's "filter-type toggle", done with **highlight, not hide**:
  hiding reflowed the wall ("weird and jarring"), and MODEL-V4 §3b.2 already
  made every highlight a dim.
- **The wall:** cards not at a stop or fork step back to the existing
  `.card.dim`. Lit cards carry a count badge in the top-left corner ("8 of
  us": brand edge for most, a white hairline for some). An artist who plays
  twice lights only where the crew is (matched by the card's occurrence).
- **The wide-stage problem:** a lit set in a column off the right of the
  phone gets an edge tab on the grid's right edge at that card's height:
  the count over a chevron, 26 x 44. Tapping it slides the grid there (the
  NOW build's sideways slide).
- **NOW:** with Ours on, NOW lands on the group's live stop with the now
  line, the way it already does for a highlighted person.
- **Empty:** everything dims, and one toast says "Nothing has 3 of us on
  Thursday. Friday does, from 9 PM."
- **Answering the friend:** slow on the grid. You still scroll the clock
  and read columns, and when the group is in the third column the answer is
  a tab you have to tap. There is no answer for someone outside the crew.
- **Motion:** the chip's aura starts its slow drift; the rest of the wall
  dims in one quick fade (the existing dim); a beat later each lit card's
  badge grows from its corner with a touch of overshoot, top to bottom;
  edge tabs slide in from the screen edge once the dim settles. Off: badges
  leave first, then the dim lifts.
- **Cost before Sunday: S to M.** Cheapest: the dim is built, NOW's
  highlight landing is built, the chip is a chip. The new work is the
  badge (a fifth thing on a card that already fits a meter, notes, Spotify
  and crew marks, so `GIVE_WAY` and the meter contract have to learn it) and
  the edge tabs (live geometry on every scroll and resize, beside the strip's
  scroll-timeline rules).
- **Risks:** fails the five-second test whenever the group is off-screen;
  gives the outsider nothing; adds weight to the busiest component.

Frames:
1. `frames/O2-key.png` — Saturday before doors, Ours on: Pier lit (Fcukers
   4, Tove Lo 6, Robyn 7, Dog Blood 8), Crane's DJ Shadow and Fatboy Slim lit
   quieter (3), Soulwax 5, Nimino dimmed, and edge tabs at the right for the
   Warehouse sets off-screen: Groove Armada (4), Kettama (3), Prospa (3).
2. `frames/O2-now.png` — Saturday 9:40 PM, Ours on: the now line through Dog
   Blood (8), Soulwax 5 below it, Kettama and Prospa tabs (3) at the edge, the afters
   below with Milli Meng lit (5) and Velvet Trip dimmed.
3. `frames/O2-empty.png` — Thursday 11 PM, Ours on: the door chip, faded
   friends, everything dimmed, the toast.

### O3 — Find us: the live answer (a sheet from the door)

**Pitch:** tap `OURS` and the answer is the first thing you read, in the
wall's biggest type: **8 OF US AT PIER STAGE**. Under it: the card, what's
next, and a button that texts it to a friend.

- **Door:** the same `OURS` tab as O1, after the day tabs. It stays visible
  and lit while the sheet is open: the sheet sits on the dock, so it grows
  from its door and a second tap closes it.
- **The sheet** (the notes sheet's own surface and grown card, with the
  shell's gutter so two cards fit side by side):
  1. `● RIGHT NOW · SAT 9:40 PM`, with the live dot in brand.
  2. The answer in Anton: `8 OF US AT PIER STAGE`, then `Dog Blood · till
     10:15 PM`. The count is the count at this minute, not the stop's peak.
  3. The real `sheetCard`: time, stage, and the who-row of blended level
     chips (`MUST You · Fay`, three bars `Ben · Cy +1` ...).
  4. A fork line when a second crowd is live ("or 3 at Prospa ...").
  5. **THEN**: the rest of tonight on the route's path, each node wearing its
     stop's own aura: `10:15 PM Soulwax · Crane Stage 5 of us`, `~10:30 PM
     Public Works · Afters · Milli Meng → Fcukers 5 of us`.
  6. **Tell a friend where we'll be** (the tonal button; the share sheet, or
     the clipboard where there is none). "Sends places and times, never
     names, never the crew link."
- **Split:** `WE'RE SPLIT 4 + 3`, two real cards side by side on `--col-w`,
  each with its crowd and place.
- **Scattered / empty:** `WE'RE SCATTERED`, "Nothing has 3 of us on
  Thursday.", then `NEXT · FRIDAY` → `4 OF US AT PUBLIC WORKS` from 9 PM, the
  grown card, and the even fork across town.
- **Before doors / after the last stop:** the kicker becomes `FIRST · SAT
  5:40 PM` (or `TONIGHT`) and the list is the whole day; after the last stop
  it points at the next night, as the empty state does.
- **What the friend gets** (computed by `shareTextOf`, real output):

  ```
  Portola Saturday, where most of us will be:
  Now: Dog Blood, Pier Stage, till 10:15 PM
  10:15 PM: Soulwax, Crane Stage
  10:30 PM on: Public Works (Milli Meng, then Fcukers)
  ```
  ```
  Portola Friday, where most of us will be:
  9 PM on: Public Works (Horse Meat Disco)
    or 1015 Folsom (2manydjs) from 12:30 AM
  ```
- **Answering the friend:** one tap on OURS and one tap on Tell a friend.
  The answer is readable in about two seconds and sendable in five.
- **Motion:** the sheet rises out of the OURS tab (transform-origin at the
  tab, translateY plus .98 → 1) as the wall behind dims. Inside, a beat
  apart: the live dot starts breathing, the answer rises 6px, the grown card
  blooms from its centre (the zoom's bloom: opaque from frame 0, scale with
  a touch of overshoot), the THEN path draws down with its aura nodes
  scaling up as the line reaches them, the button last. When the clock
  crosses into the next stop, that THEN row rises into the answer slot and
  grows into the card while the old one steps back; counts and "till"
  cross-fade on the minute ticker. Closing drops the sheet back into the tab,
  quick and plain. Reduce Motion / Low power: instant. On desktop the same
  sheet is the centred dialog every sheet already becomes, and OURS sits
  after the rail's days.
- **Cost before Sunday: M.** The model (`ours-model.mjs`, about 80% there:
  it needs to read the wall's own plan for its days and dates), its unit
  tests against the Portola file with a pinned crew and clock, the door in
  dock and rail, the sheet (reusing `.sheet`, `sheetCard`, the avatar
  cluster), the share, the ticker refresh while open, a browser contract,
  a real-input walk on WebKit and Chromium, and the review gate.
- **Risks:** the dock's room (below); an open sheet is in-progress work, so
  it must mark itself busy for the new-build reload rule; a sheet covers the
  wall (fine for this question, wrong for "where exactly is Pier Stage").

Frames:
1. `frames/O3-now.png` — Saturday 9:40 PM: 8 of us at Pier Stage, Dog Blood,
   then Soulwax 5 and Public Works 5, the send button, OURS lit on the dock.
2. `frames/O3-split.png` — Sunday 2 PM: `WE'RE SPLIT 4 + 3`, Folsom Street
   Fair beside Kaytree, then Mochakk 5, Tiësto 4, Zara Larsson 4.
3. `frames/O3-empty.png` — Thursday 11 PM: `WE'RE SCATTERED`, nothing reached
   three, next: Friday, 4 of us at Public Works from 9 PM, or 4 at 1015 Folsom.

## The dock's room (measured, applies to O1 and O3)

At 390 with the made-up crew, the dock row is you · NOW · the days · fest
name. With NOW showing, the day row is already overflowing at **158px**
(THU scrolled off; the NOW build accepted that). Adding OURS (53px) takes it
to **91px**, about one and a half day tabs. The frames use the fix I
propose: while OURS is beside it on a phone, NOW keeps only its dot in its
faint ring (the existing `.now-tab.compact`, 17px), which puts the day row
back to **115px**, about two tabs. At 320-360 OURS would also drop its word
and keep its three dots in the same faint ring. The fallback is OURS as the
last tab inside the scrolling day row: free room, but hidden until you
scroll the row.

## Recommendation: O3, "Find us", built on the shared logic

1. **It is the only one that answers the actual use case end to end.** The
   friend is often outside the crew; O3 turns the answer into a text they
   can read. O1 and O2 answer only people already in the app.
2. **It is the fastest glance.** Kevin's own worry, "the stages are so wide,
   so it's hard to tell what's happening", is solved by not making anyone
   read the grid: the sheet says the place in words.
3. **It carries O1's best part.** The THEN list is the route in miniature
   (same path, same nodes). A "See the whole day" line at its foot can open
   O1 later, post-ACL, with no redesign.
4. **It leaves the wall alone.** No new card corner, no layout change, no
   edge geometry. The wall's own laws stay untouched.
5. **Why not O2:** cheapest, but it fails the five-second test whenever the
   crowd is off-screen, gives the outsider nothing, and puts a fifth mark on
   the busiest component. The count badge is worth banking for a later
   "crowd" lens.
6. **Ship honestly.** O3 is an M. It should go out only through the normal
   gate (CI, independent review, a real-input walk). If that is met by
   Saturday midday it is worth shipping mid-festival (Saturday and Sunday
   night are when it pays); if not, it waits for ACL (Oct 2) rather than
   landing half-walked during Sunday.

Things none of the directions can fix (true of the data, not the design):
picks mean "want to see", not "will be at"; a member who picks nothing is
invisible; ACL's two weekends share one pick per artist, so on ACL a W1-only
crewmate counts toward W2 too. The fix for the last one is a "which weekend
are you at" answer per person, which is a separate call.

## Calls for Kevin (each with the default I would take)

1. **Direction.** Default: O3 "Find us", with O1's full route later.
2. **The bar.** Default: 3 people, a quarter of pickers once the crew is
   over 12; members with no picks at this fest are not counted.
3. **An artist who plays twice.** Default: the pick counts at the
   festival's set; it counts at a club only for someone who also picked an
   act that plays only there. (Cost: a club whose whole bill also plays Pier
   80 never counts.)
4. **Hidden rooms.** Default: OURS ignores the show menu, because it
   describes the crew, not your view. That breaks "a hidden part renders
   nothing" on purpose.
5. **The dock.** Default: at phone widths NOW shrinks to its dot while OURS
   is showing; OURS itself shrinks to its dots below 360.
