# OURS round two — "Our plan", a plan for the day (design brief)

**Status:** round three done, nothing built, 2026-09-25 late night PT.
Kevin picked R3 ("the shelf that peeks and can be dragged up") and asked for
round three: the peek row rearranged, the plan it opens made calmer, and
desktop. **Round three is the next section**; round two follows it unchanged
as the record. OURS stays the working name in these files; the UI name is
**Our plan**.

**Round three, look at these first:**

1. `frames/round3-phone.png` — the peek and the plan it opens, 390 and 320.
2. `frames/round3-desktop.png` and `frames/round3-desktop-2.png` — 1280 and 1440.
3. `frames/round3-zoom.png` — the crowded zoom with ghost − · note · +, 390 and 320.

**Round two, for the record** (one image each, on a phone):

1. `frames/overview.png` — the three directions and the shelf, side by side.
2. `frames/docks.png` — today's dock against D1, D2 and R3's, at 390 and 320.
3. `frames/N-names-390.png` — the naming board.
4. `frames/R1-people-test.png` — the people row at 320 and 390, crews of 6 and 12.

**Folder map** (everything in this folder; nothing outside it touched):

| File | What it is |
|---|---|
| `BRIEF.md` | this |
| `ours-model.mjs` | the logic, round two (copied from `../ours/`, two rules changed) |
| `crew.mjs` | the made-up crew: nine people (Ana..Ivy), plus six and twelve for the people-row test |
| `print-route.mjs` | `node print-route.mjs` prints every night's plan, then again with Folsom hidden |
| `measure-people.mjs` | the honest people-row test: where the row sits on open, at 320 and 390, crews of 6 and 12 |
| `r2-proto.mjs` + `r2-proto.css` | the directions, drawn inside the real app (real cards, real sheet, real tokens) |
| `rig.mjs` + `frames.mjs` | `node frames.mjs [R1 D2 ...]` re-renders the frames (one headless Chromium, API stubbed, no network, no database) |
| `r3-proto.mjs` + `r3-proto.css` + `frames3.mjs` | round three: the rearranged row, the peek into the plan, desktop, the ghost stepper (`node frames3.mjs`) |
| `sheet.py` + `sheets.sh` | contact sheets; `./sheets.sh` rebuilds `overview.png`, `docks.png` and `R1-people-test.png` from the frames |
| `frames/` | the phone frames, 2x PNG (390 x 844, and 320 x 844). PNGs are gitignored in this repo, so they live on this Mac only. `PR-*` are the people-row test's inputs. |

## Round three — the peek that grows into the plan, and desktop

Kevin on round two, verbatim: "Left float the now and next to the right side
to the left of the number of people going. That'll look nice in that flow. I
love the shelf that peaks and can be dragged up but how would that work on
desktop? What's the affordance? How does all this work on desktop? So it's
like R3 that can swipe up into R1. R1 flow doesn't need extra big times.
That's kinda confusing and loud. Bigger artist names or similar is chill. And
then again now on the right." Then: prove the zoom's − · note · + as ghost
buttons on a crowded card, at 1280 and on phones.

### 1. One row, rearranged (the peek and the plan share it)

Still one grid of four columns, in a new order:

| Column | Holds |
|---|---|
| 1 | the node on the path (the stop's aura; the path is one rail) |
| 2 | **the artist**, now the biggest thing on the row (17px/800 for a "most" stop, 14.5px/700 for a smaller group), the place under it, faces under that |
| 3 | **when**, quiet: the start time. On the stop that matters, the tag sits on the artist's line and its time under it: `NOW` over "till 10:15 PM", or `NEXT` (outlined) over "5:40 PM" |
| 4 | how many of us, the only number on the row that is not a time |

**Two text sizes per row, no more** (Kevin, after round three: "same size for
place and time"): the artist, and one second-line style (Inter 12px/600,
secondary grey, `--q-line` in `r3-proto.css`) shared by the place under the
artist and the time under the tag. A row without a tag carries its time on
the artist's line, in that same second-line style. A smaller group's place
keeps it too; only "also Thu" and a fork's place step down in colour, never
in size.

The big display-type time column is gone (Kevin: "confusing and loud"), and
so is round two's `8 OF US AT PIER STAGE` headline: the peek already says it,
and the peek's row *is* the plan's tagged row.

### 2. The peek swipes up into the plan (phone)

- **The peek:** one row on the dock's top edge, a grabber above it. During a
  set: `Dog Blood · Pier Stage · NOW till 10:15 PM · 8 of us`. Otherwise the
  next time most of us meet: `Tove Lo · Pier Stage · NEXT 5:40 PM · 6 of us`.
- **Dragged up, it is the plan:** `SAT OUR PLAN`, the whole day in the new
  row, the peek's row now wearing the same tag in its place in the list (NEXT
  on Tove Lo before doors; NOW on Dog Blood during the set, grown into its
  real card), the stops already over folded into "Earlier today: 8 stops".
- **No send button** (Kevin, after round three): with v92 a friend can open
  the crew link and look around as a guest, so the plan itself is what gets
  shared. `shareTextOf` stays in `ours-model.mjs` as reference only.
- **Motion:** the shelf follows the finger (direct manipulation, never
  eased); the peek's row stays under the finger and settles into its place in
  the list while the rows above and below arrive a beat apart. Past a third of
  the way it settles open with the arrival curve; short of that it drops
  back, quick and plain. The live card blooms from its row once the shelf has
  landed. Reduce Motion and Low power: it jumps open and shut.
- **Frames:** `frames/Q-peek-next-390.png`, `frames/Q-peek-now-390.png`,
  `frames/Q-plan-390.png`, `frames/Q-plan-now-390.png`, `frames/Q-peek-320.png`,
  `frames/Q-plan-320.png`, `frames/Q-plan-now-320.png`.

### 3. Desktop

- **The peek is a card in the bottom-right corner,** 380px, 20px in from the
  edges: `OUR PLAN · SAT · 9 OF US` and an **Open ⌃** button on its top line,
  the same row under it. **The affordance** does not depend on hover: the
  card is named, and it carries a labelled button with a chevron that says
  which way it opens. The whole card is one button (Enter opens it, Escape
  closes it). On hover it lifts 2px, its edge turns brand, the Open button
  fills, and a tip says "The whole day ⌃". There is no grabber on desktop,
  because drag is a touch gesture. Frames: `frames/DT-peek-1440.png` (at
  rest, NEXT) and `frames/DT-peek-hover-1280.png` (hover, NOW).
- **Opened, it grows up into a companion panel on the right,** 400px, from
  under the day rail to the bottom. The card's bottom-right corner is the
  anchor: its top edge rises to the rail and its row slides to its place in
  the list. There is no backdrop, so the wall stays usable beside it. **Close
  ⌄** folds it back into the corner. It holds the same plan, rows and grid as
  the phone. Frames: `frames/DT-plan-1280.png` (NOW, the live card grown) and
  `frames/DT-plan-1440.png` (planning, NEXT on Tove Lo).
- **One NOW on every screen:** the rail's NOW tab goes too; now lives in the
  peek. With a friend highlighted, the peek shows their now and a click lands
  the wall on their card (the NOW jump, moved).
- **One rule for tonight's shelves on a wide screen:** a *companion* (the plan,
  the welcome card) lives in the bottom-right **corner stack**: one right
  edge, 10px apart, newest on top, the wall still live. A *question* (the join
  shelf, notes) stays the **centred dialog** every sheet already becomes at
  720px and up, with the wall dimmed. Frames: `frames/DT-welcome-1280.png`
  (the welcome card, with the guest-shelf round's words and two equal doors,
  stacked on the plan), `frames/DT-join-1280.png` ("Pick Tove Lo as…" as the
  dialog, "Click your name" on a mouse).

### 4. The zoom's − · note · + as ghost buttons

- All three are one family: a thin scrim that lets the card's wash through
  (dark at 26%), a hairline, white glyphs, a slight blur behind. **+** keeps
  "the way up" with a brighter ring and a light fill instead of the guest-shelf
  round's solid white disc; − and the notes door are the quiet pair. A mouse's
  hover fills the circle a little; nothing moves. The circles are 36px on a
  phone and 32px on desktop, and the phone keeps the guest-shelf round's
  whole-third tap targets.
- **Proven on a crowded card,** Femme Jatale b2b erika (Friday afters, Great
  American Music Hall), picked by all twelve of a test crew at every level:
  four level chips wrapping to two lines, `Tix @ AXS · Info @ DoTheBay`, the
  "Guessing they're 1st of 3" line. Frames: `frames/Z-1280.png` (the real
  hover route, the pointer resting on +), `frames/Z-390.png`, `frames/Z-320.png`.
- **The two-line name** needs a second card, because no real Portola show has
  both doors *and* a name long enough to wrap: the zoom widens up to its
  maximum width before it wraps, so Femme Jatale b2b erika fits on one line
  even at 320. Big Muscle: Bare Chest Calendar (a Folsom party, DNA Lounge, an
  Info door only), with the same crowd, wraps to two balanced lines at 320.
  Frames: `frames/Z2-320.png`, plus `frames/Z2-390.png` and
  `frames/Z2-1280.png`, where it fits on one line.

### Cost

Round two's R3 estimate stands (**L**, for ACL, Oct 2). The desktop corner card
and panel add an **M**; the ghost restyle is an **XS** on top of the
guest-shelf stepper, and ships with it.

### Round three questions (reply like "2: no")

1. **The desktop plan is a companion panel** (right side, no dimming, the
   wall usable beside it), not the centred dialog every other sheet becomes?
   *Default: yes.*
2. **One NOW on every screen:** the desktop rail's NOW tab goes too, and now
   lives only in the peek? *Default: yes.*
3. **The zoom's +** becomes a ghost with a brighter ring rather than the solid
   white disc, so "the way up" is quieter. Keep the ring as its only emphasis?
   *Default: yes, as you asked; if + gets lost on pale washes in a real-phone
   walk, give its fill back a little.*

---

*Everything below is round two, kept as the record. Kevin picked R3 on
2026-09-25; round three above supersedes its row layout, its NOW headline
and its "desktop: not drawn" note.*

## Kevin's notes on round one → what changes

1. **"The group's question is about planning their day, not checking now."**
   OURS becomes a plan for the day: the stops where most of us will be, in
   order, readable at breakfast and sendable to a friend. The NOW shelf
   (round one's O3) stays, as the plan opened at the moment you are in: the
   same shelf, the same rows, with the live stop grown into its card at the
   top. "A path to that" is literal: every door that opens the plan during a
   live set opens it at now.
2. **"The shelf is def the cleanest design."** Every direction below ends in
   the same shelf. They differ in where it opens from and whether the plan
   also lives on the wall.
3. **"Is putting it in that row smart? Maybe in the line with the people?"**
   Tested honestly in R1: the people row is the right *home* for OURS (it is
   the crew, and "us" is one more way to look at the crew), but it is not a
   reliable *door*: it scrolls away, and during the festival the app opens
   scrolled past it. Measured and drawn below.
4. **"Idk if the plus is clear."** Every "+" a person sees is inventoried
   below, with the rule that fixes all of them: a plus only ever sits beside
   the word for what it adds, and a count is never written as "+n" next to
   another count.
5. **"The alignment of the cards and people list is off."** Round one's
   route (O1) put counts in three places (under the time, at the right edge,
   centred under split cards) and cards floated in a second column. Round two
   has one row grammar on one four-column grid, used by every row in every
   direction (see "The grid").
6. **An artist who plays twice: count them at both places.** Done (rule 5).
7. **Hidden rooms: respect them.** Done (rule 8).
8. **The dock: "Now pinned to the left feels like the problem … making it a
   dot is a bit too clever."** Agreed on both. NOW stops being pinned, and
   nothing shrinks to a dot: D1 puts it in the scrolling day row (his "left
   and right scroll bar"), D2 floats it, R3 moves it out of the dock into the
   footer peek.
9. **"Is 'ours' clear?"** (his follow-up, mid-round). No: on its own it is a
   possessive with no noun. The name is **Our plan** (chip `Our plan ›`, head
   `SAT OUR PLAN`); six candidates compared on one board, below.
10. **Footer shelves are becoming a family** (the welcome card, the NOW
    shelf, a join shelf). The plan shelf joins it, and R3 is the direction
    built the most from it.

## The logic, updated

Runnable: `ours-model.mjs`, printed by `node print-route.mjs`. Rules 1-4 and
6-7 are round one's (see `../ours/BRIEF.md` "The logic" for why); 5 and 8
changed.

1. **Who is us:** members with at least one pick at this festival. New:
   *always the whole festival's*, never the folded view's, so hiding a room
   never moves the bar or flips a stage you can still see from most to some.
2. **The bar:** `max(3, ceil(us / 4))`. Nine of us: 3.
3. **One body, one place:** every 5 minutes each person is at their
   highest-level live pick (ties: the bigger crowd, then where they already
   were, then the set that just began).
4. **A place** is a grid set, or a room (a venue on a night) where you
   arrive for your first pick and stay through your last.
5. **An artist who plays twice counts at both places** (Kevin: "They might
   be at either. They're different locations right?"). Rule 3 still holds
   moment by moment. New honesty detail: when half or more of a stop's crowd
   is there only on an act that also plays elsewhere, the stop knows where
   else (`alsoAt`), and its row says so in one quiet word ("also Thu").
6. **The route:** at each moment, the place with the most of us if it clears
   the bar; a second place that clears it is a fork; 20+ minutes with
   nothing is "scattered".
7. **Most** (more than half of us) vs **some** (at or over the bar).
8. **Hidden rooms are hidden.** A room unchecked in the show menu never
   appears in OURS: no stop, no fork, no count, no line in the text a friend
   gets. A show billed to two rooms ("Afters & Folsom") stays while either is
   shown (the wall's own rule). But bodies are placed *before* the fold: Cy
   at the Folsom Street Fair is not re-seated at Mochakk because you hid
   Folsom. Hiding changes what OURS shows, never what it counts.

### What that computes (nine of us, bar 3, the real Portola file)

Everything visible:

- **Thu** (new): MOST, 10:30 PM - midnight, Regency Ballroom, 5 of us (LAIMA
  → Soulwax). Three of the five are there only on Soulwax, who also plays
  Saturday, so the row reads "also Sat".
- **Fri:** some, 8-9 PM Regency Ballroom 4 (Gelli Haha → Channel Tres, all
  on doubled acts) · some, 9 PM on Public Works 4 (Horse Meat Disco), forks
  Regency 3 and 1015 Folsom 4 from 12:30 AM.
- **Sat:** some Gelli Haha 4 · Tricky 3 · Groove Armada 4 (fork Fcukers 4) ·
  **MOST Tove Lo 6** · DJ Shadow 3 · **MOST Robyn 7** · Kettama 3 · Fatboy
  Slim 3 · **MOST Dog Blood 8** · **MOST Soulwax 5** · **MOST Public Works
  6 from 10:30 PM** (Milli Meng → Chloé Caillet → Fcukers; round one said 5,
  Chloé Caillet's pickers now count) · new: some, 1:30 AM Great Northern 4
  (Groove Armada), fork Public Works 4.
- **Sun:** some Folsom Street Fair 4 (11-6, forks at Pier 80) · **MOST
  Mochakk 5** · Tiësto 4 / Zara Larsson 4 (a true split) · Overmono 3 ·
  **MOST Swedish House Mafia 8** · Parcels 4 · Four Tet 3 · new: Public Works
  3 (Kaytree → Ben UFO → Overmono) · scattered 12-12:30 AM · Two Shell 4 ·
  new: Great Northern 4 (SG Lewis).

With Folsom hidden (rule 8), Sunday afternoon changes and nothing else does:
the Folsom Street Fair stop and its line in the friend's text are gone; the
afternoon becomes Kaytree 3 (Ship Tent) · scattered 2:55-3:30 · Channel Tres
3 · SG Lewis 4 · Mochakk 5 from 5:35 PM. Mochakk still counts 5, not 6: Cy
is at the fair until 6 PM whether you can see it or not.

**The cost of rule 5, said plainly:** round one's model found 21 stops over
the four nights; round two finds 26. The five new ones are Thu and Fri at
Regency, Sat and Sun at the Great Northern, and Sun at Public Works, and 11
of the 26 lean on doubled picks. Saturday's spine (Tove Lo, Robyn, Dog Blood,
Soulwax, Public Works) does not move.

What a friend is sent, Saturday before doors (`shareTextOf`, real output):

```
Portola Saturday, where most of us will be:
5:40 PM: Tove Lo, Pier Stage
7:10 PM: Robyn, Pier Stage
9 PM: Dog Blood, Pier Stage
10:15 PM: Soulwax, Crane Stage
10:30 PM on: Public Works (Milli Meng, then Chloé Caillet, then Fcukers)
```

## Every "+" a person sees

The rule: **a plus always travels with the word for what it adds, a dashed
outline means "add" and nothing else wears one, and a count is never written
as "+n" beside another number.**

| Where | Today | Clear? | Round two |
|---|---|---|---|
| People row, last chip (`app.js` renderPersonChips) | `+ Add` in a dashed chip | No: add what? A festival, a show, yourself? | `+ Add someone`, the words Settings already uses (`settings.js`). Costs a second line at 390 with six people once OURS leads the row (`frames/R1-people-test.png`). |
| How it works demo (`settings.js`) | "Add your people with + Add" | Follows the chip | Changes with it. |
| Card crew corner (`aura.js` "+n" ghost) | `+3` in a **dashed** ring | Reads as an add button, because dashed means add everywhere else (`+ Add`, the guest ring) | Same `+3`, **solid** scrim ring like every other mark. Same 1px border, so the fit table is untouched. Drawn in the R1 frames (compare R1-door's cards with R2-open's). |
| Zoom who-row (`Ben · Cy +1`) | follows names | Yes: "and one more" | Keep. |
| Landing fest row, five faces then `+3` | no other number beside it | Yes | Keep. |
| `+ note`, `+ Add a note`, `+ Add a festival` | word attached | Yes | Keep. |
| Round one's avatar stacks (`A B C D E +3  8 of us`) | two numbers side by side | No | Gone. A "most" row shows every face (nine take about 105px at 15px each) and a "some" row shows none; the count is the only number. |
| Round one's split (`WE'RE SPLIT 4 + 3`) | a plus as arithmetic | Ambiguous | `4 AT PIER STAGE · 4 AT WAREHOUSE` (`frames/X-sun-split.png`). |
| First-open proposal (F2): the guest's dashed `+` ring in the dock's "you" slot | a bare plus | No: it joins you to the crew | The word **Join** in the slot (brand text, no ring). Not drawn here; it belongs to the first-open round. |

## The grid (Kevin: "the alignment of the cards and people list is off")

One row grammar, four columns, used by every row in every direction (the
shelf, the wall room, the footer bar), so each thing sits on one vertical
line down the whole plan:

| Column | Holds | Width (390 / 320) |
|---|---|---|
| 1 | the time, right-aligned so "5:40 PM" and "10:15 PM" end together; "or" for a fork; the NOW pill for the live stop | 66 / 60px |
| 2 | the node on the path (the stop's own aura, the card's colours); the path is one continuous rail | 16px |
| 3 | what (the act, or the venue for an afters room) and where; faces on a third line for a "most" stop; a grown card starts here | the rest |
| 4 | how many of us, right-aligned; the only number on the row; a grown card ends here | 50 / 46px |

Three tiers, one layout: **most** (more than half of us) is two lines plus
faces, bigger type, the aura node; **some** is one line, one step quieter; a
**fork** is one line with "or" in the time column and its own count in
column 4. The live stop's real `sheetCard` spans columns 3-4, so its left
edge is the names' line and its right edge is the counts' line. Measured in
the frames at 390 and 320; nothing is centred under anything.

## The people row, tested honestly (Kevin: "maybe in the line with the people?")

`node measure-people.mjs`, the real app, Saturday and Wednesday opens:

| Width | Crew | People row | Where it is when the app opens during the week |
|---|---|---|---|
| 320 | 6 | 2 lines, 53px | 2,607px above the screen (Sat 11 AM), 3,261px (Sat 9:40 PM) |
| 320 | 12 | 3 lines, 82px | same |
| 390 | 6 | 1 line, 24px (2 lines once OURS leads it) | same |
| 390 | 12 | 2 lines, 53px | same |

The row is a good *home* for OURS: it is the crew, and "all of us" is one
more way to look at the crew. It is not a *door*: the app opens on the day
(the day-of open), so on every open from Wednesday on the row is two to
three thousand pixels up, the same finding that sank the How it works bar in
the first-open round. Kevin's own NOW story ("tapping ross on the top to
highlight him") already makes that trip. So R1 below only works if the row
comes along: one pinned line, 44px, scrolling sideways, the same height for
6 or 12 people (`frames/R1-people-test.png`, left: today's wrapping row with
OURS first; right: the pinned line).

## Directions R1 / R2 / R3

All three open the same **shelf** (Kevin: "the shelf is def the cleanest
design"), and it is the plan: planning state before and between stops,
NOW state during one. They differ in the door: the people row (R1), the
wall itself (R2), or the footer (R3).

**The shelf, shared.** Planning: the day's head in the wall's own grammar
(`SAT OUR PLAN  SEP 26 · 9 OF US PICKING`), then the whole day on the grid (12 stops on Saturday, the five "most" stops
carrying their faces), then **Tell a friend where we'll be** pinned at the
foot. NOW: round one's loved answer on top (`● RIGHT NOW · SAT 9:40 PM`,
`8 OF US AT PIER STAGE`), then the plan from the live stop on, the live stop
grown into its real card, the stops already over folded into one line
("Earlier today: 8 stops"). Tap any row and it grows into its card in place,
with its who-row of names at their levels: that is where people are named.
A true split grows neither place and the headline names both.

*Shelf motion:* it rises from its door (the footer for R3, the bottom edge
for R1 and R2, as every sheet in the app does; transform only) while the
wall behind dims. Inside, a beat apart: the rows arrive top to bottom (a 6px
rise and fade, about 40ms apart), the path draws down from the first node as
they land (scaleY from its top), the faces slide in along the names line one
after another, the live card blooms from its row (the zoom's bloom: opaque
from frame 0, a touch of overshoot), the send button last. Tapping a row
grows its card in place and the rows below slide down to make room (FLIP
transforms); tapping again folds it back. When the clock crosses into the
next stop, the finished row folds up into "Earlier today" (its count ticks
up), the next row grows its card, and the headline cross-fades. Closing
drops the shelf quick and plain. Reduce Motion and Low power: instant.

### R1 — the people line (Kevin's suggestion, made to work)

- **Door:** `Our plan ›`, a brand-tonal chip leading the people row, pinned
  as one sideways line at the top of the screen; the stage strip pins under it (`--rail-h`, the
  desktop rail's own variable). You sit first after it in the pinned line.
- **Looks like:** the shared shelf, rising from the bottom (the Notes chip
  in the same row already opens a bottom sheet, so the family holds).
- **Right now:** tap the chip during a set: the shelf opens at NOW.
- **A friend outside:** Tell a friend, at the shelf's foot.
- **Bonus:** the same pinned line makes "tap Ross, then NOW" work from
  anywhere on the wall, which today needs a trip to the top.
- **Motion:** the line never moves while the wall scrolls under it (it is
  chrome). Tap: the chip fills brand and the shelf rises (shared motion
  above). Close: the chip goes back to tonal as the shelf drops.
- **Cost: L.** The shared shelf and model (M) plus sticky chrome: every
  jump, the NOW landing band and the zoom's clearance learn a 44px top bar.
- **Risk:** 44px taken from the grid on every screen, forever.
- **Frames:** `frames/R1-door.png` (Sat 11 AM, the pinned line over the
  day-of open), `frames/R1-plan.png` (the shelf, planning), `frames/R1-now.png`
  (Sat 9:40 PM, NOW), `frames/R1-320.png`, `frames/R1-people-test.png`.

### R2 — the plan is the first thing on the day

- **Door:** none to find. Each day with a plan starts with its own room,
  `SAT OUR PLAN` above `SAT PORTOLA`, in the one-line head grammar. The day-of
  open lands on it; the SAT tab lands on it; the show menu lists it, so
  hiding it works like hiding Afters.
- **Looks like:** the plan's spine on the grid (only the "most" stops, no
  faces, so Saturday is five rows) and a "The whole day ›" line; the head is
  a button that opens the shared shelf.
- **Right now:** during a set the live row wears the NOW pill and the stops
  before it step back; tapping the head opens the shelf at NOW.
- **A friend outside:** the shelf's Tell a friend.
- **Motion:** the room is part of the day, so it arrives and leaves the way
  rooms do (the fold flow). When a crewmate's pick moves a stop, its count
  cross-fades; a stop that appears slides in and its neighbours make room;
  one that goes leaves quick. The head opens the shelf the way a head opens
  notes today.
- **Cost: M.** The shared shelf and model plus a new room kind in the wall's
  plan (the fold, day tabs, scrollspy and day-of open all read rooms).
- **Risk:** pushes each day's grid down by the spine (about 450px on
  Saturday, head and link included); during a set the plan is only in view after a tap on the day.
- **Frames:** `frames/R2-open.png` (Sat 11 AM, what the app opens on),
  `frames/R2-now.png` (Sat 9:40 PM), `frames/R2-320.png`.

### R3 — the shelf, peeking (the footer)

- **Door:** the shelf itself, collapsed to one row on the dock's top edge
  on any day that has a plan. During a set: `NOW 9:40 PM · Dog Blood · Pier
  Stage · till 10:15 PM · 8 of us`. Before and between sets: the next time
  *most* of us meet, `NEXT 5:40 PM · Tove Lo · Pier Stage · 6 of us` (the
  NOW pill's outlined twin). Tap or drag it up and it becomes the shared
  shelf, planning state or NOW state by the clock.
- **Looks like:** one row of the plan on the same four columns (a pill and
  the time in column 1, the node, the act and place, the count), a grabber
  above it. It needs no label: "of us" says whose it is, and the shelf it
  opens is headed `SAT OUR PLAN`.
- **Right now:** it *is* now, all the time, without a tap.
- **The dock:** NOW leaves the dock entirely (the peek carries it), so the
  dock is you · days · fest name again, and all four Portola days fit at 390.
  With a person highlighted, the peek shows *their* now and tapping lands
  the wall on their card (today's NOW jump, moved), which keeps the Ross story.
- **A friend outside:** the shelf's Tell a friend.
- **Motion:** the peek rises from behind the dock's top edge the first time
  a day has a plan; when the clock crosses into the next stop its row slides
  out left and the next slides in from the right, counts cross-fade; dragged
  or tapped, it grows into the shelf (its row becomes the shelf's live row
  and the rest unfolds around it); pulled down, it settles back.
- **Cost: L.** The shared shelf and model plus the peek, NOW's move out of
  the dock (its person-cycling included), and the zoom learning to clear it.
- **Risk:** about 44px of permanent footer on festival days; it covers the
  wall's bottom edge.
- **Frames:** `frames/R3-next.png` (Sat 11 AM: NEXT, Tove Lo 5:40 PM),
  `frames/R3-now.png` (Sat 9:40 PM: NOW, Dog Blood), `frames/R3-320.png`.
  Tapped open, it is the shelf in `frames/R1-plan.png` and `frames/R1-now.png`
  (the same shelf; only the door differs).

### The shelf's edge states (shared)

- `frames/X-sun-split.png`: Sun 7:30 PM, Zara Larsson 4 and Tiësto 4 at
  once: `4 AT PIER STAGE · 4 AT WAREHOUSE`, neither grown.
- `frames/X-thu-also.png`: Thu 6 PM, the planning shelf for Thursday:
  Regency Ballroom 5 of us, "LAIMA → Soulwax · also Sat" (rule 5's honesty).
- `frames/X-sun-folsom-hidden.png`: Sun 2 PM with Folsom hidden: `3 OF US
  AT SHIP TENT`, no fair anywhere, Mochakk still 5 (rule 8).

## The dock: D1 / D2 (NOW not pinned, nothing shrinks to a dot)

Today (`frames/D0-390.png`, `frames/D0-320.png`): NOW is pinned left of the
days, so at 390 THU scrolls off, and at 320 NOW becomes a ringed dot and the
days show as slivers, "RI | SAT | S".

- **D1 — NOW joins the day row.** While something is live, NOW is a tab in
  the scrolling day row, right after the day that is live (`SAT · NOW`), in
  its own brand violet with the live dot. The row keeps that pair in view and
  never leaves a sliver at either edge: 390 shows `FRI SAT NOW SUN`, 320 shows
  `SAT NOW`. Nothing is pinned, and the fest name never gives way.
  Motion: NOW fades in from 6px left while the tabs after it slide right to
  make room (the existing tab FLIP); the row glides to centre the pair; when
  nothing is live NOW leaves quick and SUN slides back. The row's rule in
  every option (D1, D2, R3): no tab ever shows as a sliver; anything past an
  edge sits inside the fade that says the row scrolls. Cost: **S** (the
  row's centring learns the pair; `fitNowTab`'s dot and squeeze retire).
  Frames: `frames/D1-390.png`, `frames/D1-320.png`.
- **D2 — NOW floats above the dock.** NOW leaves the dock and floats, a
  small pill centred just above it, while something is live; the dock is you
  · days · fest name, and all four days fit at 390. Motion: the pill rises 8px
  from behind the dock's edge with the beat and leaves quick; under an open
  sheet it steps down behind the dock. Cost: **S**. Risk: it covers the wall's
  bottom edge (in the frame, a corner of the Milli Meng card). Frames:
  `frames/D2-390.png`, `frames/D2-320.png`.
- **R3 is a third answer:** NOW lives in the footer peek and the dock has
  none.

A strip comparison of all six docks: `frames/docks.png`.

## The name (Kevin: "Is 'ours' clear?")

Six candidates, each drawn as the chip leading the people line and as the
day's head, at 390 and 320 (`frames/N-names-390.png`, `frames/N-names-320.png`):

| Name | Verdict |
|---|---|
| Ours | Round one's. A possessive with no noun: ours what? |
| **Our plan** | **The pick.** Keeps Kevin's "our", adds the noun, names the job he gave ("planning their day"). Fits at 320 as a chip (about 75px) and a head (`SAT OUR PLAN`). |
| Our day | Warm, but a day is what the tabs already are. |
| All of us | Beside the names it reads as "everyone's picks", which is the unfiltered wall you already have, so the chip seems to do nothing. |
| Everyone | Taken: the row already shows `everyone ✕` to clear a person filter. The board draws the collision. |
| Where we'll be | The clearest and the longest (about 110px as a chip). Kept for the send button: "Tell a friend where we'll be". |

Words this round adds to the UI: **Our plan**, "of us", NEXT, "Earlier
today", "also" (a stop that leans on an artist playing twice). None collide
with picked / must / notes / fest.

## Recommendation: R3, the plan shelf peeking from the footer, named "Our plan"

1. **It is the only door that is on screen at every moment.** The people row
   is 2,600px+ away on every open during the week; the wall room is only in
   view at the top of a day. The footer is always there, and the answer is
   written on the door: before doors it says the next time most of us meet,
   during a set it says where we are, with no tap.
2. **It is the shelf Kevin called the cleanest, and the path to NOW he
   asked for.** Drag it up: the whole day on the grid (planning). During a
   set, the same drag opens the NOW answer. One surface, one row grammar,
   the footer-shelf family he is already building.
3. **It fixes the dock by emptying it, not by shrinking anything.** NOW
   moves into the peek, so the dock is you · days · fest name, and all four
   Portola days fit at 390 without a dot or a sliver.
4. **The cost is honest: L,** for ACL (Oct 2), not this weekend. The shared
   shelf and model (the model is about 80% there; it needs to read the wall's
   own plan and `ctx.folded`), the peek, NOW's move (its person-cycling
   included: with Ross highlighted, the peek shows Ross's now and a tap lands
   on his card), the zoom learning to clear the peek, a browser contract, a
   real-input walk on WebKit and Chromium, and the review gate.
5. **Runner-up: R2.** If a permanent footer row is too much, the plan as the
   first thing on each day is the calmest answer to "planning", reuses the
   wall's own grammar, and costs M. R1 (the pinned people line) is worth
   doing on its own merits for highlighting a friend from anywhere, but it
   is the heaviest way to open a plan.
6. **This weekend:** D1 is an S and fixes the dock Kevin complained about
   during Portola. It is superseded when R3 lands (NOW moves into the peek),
   and the plus fixes (`+ Add someone`, the solid `+3` ring) can ride with it.

Also true of the data, whatever the design: picks mean "want to see", not
"will be at"; a member with no picks is invisible; ACL's two weekends share
one pick per artist, and with rule 5 an ACL artist on both weekends now
counts on both, which is right by the rule and worth a glance on ACL's frames.

## Questions for Kevin, round two (answered: R3 picked; the rest carry over)

1. **Direction:** R3 (the plan peeking from the footer; NOW moves into it),
   R2 (the plan as the first thing on each day), or R1 (the pinned people
   line)? *Default: R3, built for ACL.*
2. **The name:** "Our plan" (chip `Our plan ›`, head `SAT OUR PLAN`)?
   *Default: yes.*
3. **The dock this weekend:** ship D1 now (NOW as a tab beside the live day
   in the scrolling row), knowing R3 moves NOW into the peek for ACL?
   *Default: yes, ship D1 during Portola through the normal gate.*
4. **Artists who play twice:** every stop that leans on one says so in one
   quiet word ("also Thu", "also 1:30 AM"). It is why Thursday now shows 5 of
   us at Regency (three are there for Soulwax, who also plays Saturday). Keep
   the word? *Default: keep it.*
5. **The plus:** the people row's `+ Add` becomes `+ Add someone` (it costs a
   second line at 390 with six people once the plan chip leads the row), and
   the card corner's `+3` gets a solid ring instead of a dashed one, so
   dashed only ever means "add". *Default: yes to both, riding with D1.*

## Re-running, and what is not done

- `node print-route.mjs` (the plan, printed), `node measure-people.mjs` (the
  people-row numbers), `node frames.mjs` (round two's frames) and
  `node frames3.mjs` (round three's: phone, desktop, zoom), then `./sheets.sh`
  for the contact sheets. One browser at a time, each page closed after its
  screenshot. Nothing here writes to a database
  or loads production; the crew link in `rig.mjs` is invented.
- Not drawn: D2 at a moment with a sheet open, R3 with a person highlighted
  (Ross's now in the peek), the guest's **Join** slot, and desktop (the
  shelf becomes the centred dialog every sheet already becomes; the peek has
  no desktop form yet, where the rail's NOW stays).
- Not committed: this folder is on disk in the `portola-live` worktree. The
  PNGs would not ride along anyway (`.gitignore` denies images).
