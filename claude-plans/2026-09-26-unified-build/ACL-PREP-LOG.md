# ACL prep — working log (2026-09-26)

Branch `data/acl-prep`, worktree `.claude/worktrees/acl-prep`. Following
`ACL-PREP-BRIEF.md` in this folder. Data files only — no code changes.

## Step 0 — freeze pick keys

`node scripts/freeze-pick-keys.mjs acl-2026` — 148 names, 4 day labels frozen,
0 new names (re-stamped `frozenAt` 2026-09-23 → 2026-09-26 only; no rename, no
add/remove). Safe to proceed with time edits. Re-ran the freeze test after
every later step below — stayed green throughout (no artist name or day label
ever touched).

## A tooling gap found early: `guess-run-times.mjs` can't see Late nights

The script's `runsOf()` groups artists by `${a.night}|${a.venue}` — it never
looks at `a.date`. ACL's "Late nights" section is a **dated** section
(MODEL-V4: it runs Sep 29–Oct 10, more than a week, so its entries carry
`date`, never `night` — see `docs/add-a-festival.md` "Event fields" and the
repo CLAUDE.md's wall-v4 bullet). A dry run of
`node scripts/guess-run-times.mjs acl-2026` against the untouched file printed
nothing at all — not an error, just zero runs found, because every Late
nights entry has `night: undefined` and `!night` short-circuits `runsOf`'s
loop before it ever looks at `date`.

This is a real script gap for dated sections, not a data mistake, and it is
out of scope to fix (brief: "no code changes" — the coordinator should look at
teaching `runsOf` to fall back to `a.date` when `a.night` is absent, the same
way `planFestival`/`applyPlans` are otherwise date-agnostic). Rather than
patch the script, I reused its actual exported `planRun` function unchanged
(same algorithm, same rounding, same fallback rules) from a throwaway script
in my scratchpad, just grouping runs by `date+venue` instead of `night+venue`.
Every guessed time below came from that real function, not a hand-rolled
substitute.

## Gap 1 — Late nights (66 `artists[]` entries, 12 venues, 40 event pages)

### Step 1 — billing order

Do512's own titles already print each show's billing (headliner first, e.g.
"Steve Aoki (Dim Mak 30) w/ Elephante b2b Riot Ten"). Per
`docs/add-a-festival.md` ("The order follows the billing: the billed
headliner closes and the rest run in descending print"), I reversed that
print order into `order.seq`/`order.of` for every Late nights entry (headliner
= highest seq/closes, last-billed opener = seq 1), sourced to each entry's own
`page.url`. 66/66 entries got an order assignment in this first pass.

The validator then caught something real: **a run of one act cannot carry
`order`** ("order.of must be a whole number of 2 or more — a run of one is
not a run", and `docs/add-a-festival.md` says the same: "A room with one act
may carry doors, a close, and a guessed time, but no order"). 17 of the 40
shows are single-act (Villanelle, Night Tapes, Grocery Bag, Almost Heaven,
Ryan Beatty, Suki Waterhouse, LP, Annie DiRusso, The War on Drugs, Sunday
(1994), Yousuke Yukimatsu, Jess Williamson/Continental, Noga Erez, Rodrigo y
Gabriela, Claire Rosinkranz, Fcukers/Devil May Care 10/10, Montclair). I kept
`order` on them just long enough to run `planRun` (which handles n=1 fine —
`starts=[first]`), then stripped `order` back off those 17 once they had a
computed `time`/`close`. `node scripts/validate-festivals.mjs` is 0 errors
with this shape.

### Step 2 — printed times, per venue

For each show, I read the page already on the artist entry (`page.url`,
mostly Do512), then the venue's own ticket-platform page (Ticketmaster, AXS,
Eventim, Etix, Eventbrite, SeeTickets) and the venue's own website, looking
for a printed time distinct from doors.

**Do512 and AXS print doors only, never a set time** (confirmed across ~15
pages spot-checked — Fcukers/Total Wife, Brandon Flowers/Jess Williamson,
Palace, Montclair, The Chainsmokers, Finn Wolfhard/Malcy, Bleachers/This Is
Lorelei, Villanelle, BUNT./Sarah Pederzani, Hunx and His Punx/CorMae, and the
AXS pages for 3TEN). Ticketmaster event pages 401'd on every attempt (basic
and stealth proxy both) — a hard wall, not a fluke; no Ticketmaster-hosted
show got anything beyond its Do512 doors time from the ticket page itself.

**Real finds, each a printed time distinct from a guess:**

- **Stubb's** (amphitheater) and **Stubb's Indoors**: the venue's own
  `stubbsaustin.com/concert-calendar/` widget embeds a per-event `displayTime`
  (`aria-label="<title>|<date>|<time>"`) sourced from each show's own
  `stubbsaustin.com/tm-event/<slug>/` page — a genuinely distinct field from
  doors, not a repeat. Two of five Indoors shows differed from the recorded
  doors value outright: **Grocery Bag** (doors 10 PM → Show 10:30 PM) and
  **Sunday (1994)** (doors 8 PM → Show 9 PM). The other three Indoors shows
  (Montclair, Almost Heaven, Annie DiRusso) and all four amphitheater
  first-acts (Jess Williamson, This Is Lorelei, Velvet Trip, Leon Knight)
  matched their doors value exactly but are still recorded as posted `time`
  from this source (it's the venue's own listing, not an inferred repeat).
  Also pulled the FAQ's two general facts into the registry: standard doors
  are 7 PM, "show times usually begin an hour after doors," and the **indoor**
  stage has a hard 1:45 AM curfew every night (the amphitheater has no
  published close, kept null).
- **The Continental Club** (Jess Williamson, 10/8): Eventbrite's own event
  page prints "Thursday, October 8 · 10 PM – 11:30 PM" and the body text says
  "@10pm ... Doors open @9pm" — a real printed start **and** end, both
  recorded with no `approx`.
- **Devil May Care** (Rebecca Black 10/2, Fcukers 10/10): each show's own
  Eventim/SeeTickets ticket page prints "Doors: 10:00PM | Show: 11:45PM |
  Ends: 2:00AM" — identical on both nights. Recorded as printed `time` and
  `close` (Fcukers already had `close: "2 AM"` in the file from an earlier
  pass; Rebecca Black's was added to match).
- **Mohawk Austin** (Total Wife, 9/29): mohawkaustin.com's own site lists
  "Fcukers / Total Wife / 8pm" and Etix's ticket page for the same show prints
  "September 29, 2026 8:00 PM / Doors Open: 7:00 PM" — two independent venue-
  adjacent sources agreeing on the same distinct show time.
- **Brushy Street Commons** (CorMae 10/2, Common People 10/8, LP 10/5):
  Eventim's ticket pages print "Doors: X:00pm / Show: Y:00pm" — a consistent
  60-minute gap across all three, used for the opening act's posted time.
- **The Concourse Project** (Riot Ten 10/2, Yousuke Yukimatsu 10/8): Eventim
  prints "Show: 9:00PM" (== doors) on both — DJ-club format, no gap.

18 posted times total (4 close values among them) came from these direct
sources; the rest of the 66 entries got a `time` computed by `planRun` from
doors + the venue registry below, marked `approx: true`.

### Step 3 — venue registry (`data/venues/index.json`)

Added 12 new venues in the existing `venues-v1` shape. Summary (full sources
and verbatim quotes are in the file itself):

| Venue | doors→first-act | close | confidence |
|---|---|---|---|
| The Concourse Project | 0 min (DJ format) | 2 AM (venue routine, Eventim boilerplate on 2 different listings) | medium |
| Stubb's (amphitheater) | 60 min (FAQ) | **null** — FAQ's 1:45 AM curfew is stated for the indoor stage only | unknown |
| Stubb's Indoors | null — real gap varied 0/30/60 min across 5 shows, a single number would misrepresent it | 1:45 AM (FAQ, direct quote) | high |
| Emo's | 60 min (Reddit anecdote, corroborated by the venue's own calendar matching doors=show on 5 real ACL shows) | null — nothing published | unknown |
| Historic Scoot Inn | 60 min (Ticket Fairy) | null — nothing published | unknown |
| Antone's | 60 min (venue's own Ticketmaster calendar, 4 real bookings, exact 60-min gap every time) | 12 AM (Yelp business hours; the venue's own "LATE:" series runs past this, noted as an exception) | medium |
| 3TEN | 60 min (AXS: doors 8 PM, show 9 PM for Villanelle) | null | unknown |
| Devil May Care | 105 min / 135-min set (both printed, see Step 2) | 2 AM (printed on both shows) | medium |
| Mohawk Austin | 60 min (Yelp + venue's own site + Etix) | 12 AM default / 1 AM late (Yelp; noise-curfew variable) | medium |
| Fair Market | null — one-off warehouse event space, no routine hours exist; aggregator claims (SeatGeek 90min-2hr vs VividSeats 60-90min) actively contradict each other, so both dropped rather than averaged | null | unknown |
| The Continental Club | 60 min (Eventbrite, the one show here) | null (its own public calendar shows two sets/night but never prints a close) | unknown |
| Brushy Street Commons | 60 min (3 separate Eventim listings, exact match every time) | null | unknown |

Where I had nothing, I left it `null` with a note rather than invent a number
— the per-kind fallback in `guess-run-times.mjs` (`KIND_DEFAULTS`) covers the
gap and marks everything it touches `approx: true`.

### Step 4 — running the plan, then `--write`

Dry run first (`planRun` reused as above), read every room, then wrote. Full
before/after table is reproducible from git history; spot highlights:

- **Steve Aoki run** (Concourse, doors 9 PM, close 2 AM guessed): Riot Ten
  (posted 9 PM) → Elephante 10:45 PM → Steve Aoki 12:30 AM. The closing set
  runs exactly to the 2 AM close by design (fair-share spacing).
- **Fair Market / The War on Drugs**: single act, no venue data at all, so it
  fell to the hall `KIND_DEFAULTS` (doors+60 min start, 12 AM close) — both
  marked `approx: true`. Flagging this one specifically: it's the fallback
  working as designed on a genuine unknown, not a researched number, and
  worth a second look if anyone finds Fair Market's real hours later.

### A guessed room that looked off, and what I did

**Devil May Care, Rebecca Black night (10/2).** The registry's 105-minute
doors-to-show gap (sourced from Rebecca Black's and Fcukers' own *single-act*
printed pages) doesn't fit this specific night, which has TWO acts (Bambi
opens, Rebecca Black closes). Applied mechanically, `planRun` put Bambi's
guessed slot at 11:45 PM — the same clock time as Rebecca Black's own printed,
posted 11:45 PM start. That's the exact "a time repeated on every act is
probably a doors time mistranscribed into set-time" smell the validator
watches for, except here it's the *guesser* colliding with a *posted* time it
correctly left untouched. I hand-corrected Bambi to **10:30 PM** (30 min
after doors, ~75 min ahead of Rebecca Black), kept `approx: true`. Everywhere
else I checked a posted opener against its guessed headliner (Brandon
Flowers/Jess Williamson, Bleachers/This Is Lorelei, Parcels/Velvet Trip, Lola
Young/Leon Knight, Mohawk's Fcukers/Total Wife, Brushy's Hunx and His
Punx/CorMae) — no other collision; the guessed headliner always lands safely
later than the posted opener.

### Checks

- `node scripts/validate-festivals.mjs`: 0 errors (2 pre-existing warnings
  unrelated to Late nights: a Sunday-grid billing note and the empty
  Tomorrowland Winter file — not touched).
- `node --test tests/live-pick-keys.test.mjs`: green, 148 names / 4 day
  labels, byte-for-byte.
- `npm test`: **5 failures**, all the same root cause — snapshot-style tests
  that read the real `acl-2026.json` "as shipped" and hardcoded the *pre-fix*
  doors-only render for two specific shows (Stubb's/Brandon Flowers Thu Oct 1,
  Continental Club/Jess Williamson Thu Oct 8) as their expected string. Now
  that those two shows correctly carry real times (and Jess Williamson a real
  close), the rendered string changed from `"Doors 9:30 PM"` /
  `"Doors 7 PM"`-style strings to `"Runs 9:30 PM – 11:30 PM"` / `"7 PM"`
  (with a room label) — which is the intended, correct consequence of fixing
  Gap 1, not a regression. The five tests:
  `tests/dated-occurrence.test.mjs` ("occOf carries the date and the venue…",
  "factsFor tells each late night its own truth…", "the artist sheet's header
  for a dated occurrence…"), `tests/day-image-sections.test.mjs` ("a dated
  section exports with its dates: ACL Late nights, as shipped"),
  `tests/two-weekend-schedule.test.mjs` ("ACL as shipped: searching finds a
  Weekend 2 headliner…"). Since this branch is data-only, I did not touch the
  test files — they need a one-line snapshot update from whoever has code
  latitude on this branch (the new expected strings are visible in the diff
  each test prints).

## Gap 2 — Zilker headliner ends

Seven grid slots print a start with no end (the same headliner appears twice
under different weekend tags where untagged):

| Day | Stage | Weekend | Headliner | Start |
|---|---|---|---|---|
| Friday | T-Mobile | W1 | Skrillex | 8:15 PM |
| Friday | T-Mobile | W2 | Kings of Leon | 8:15 PM |
| Friday | American Express | both | Charli xcx | 8:40 PM |
| Saturday | T-Mobile | both | Lorde | 8:15 PM |
| Saturday | American Express | both | RÜFÜS DU SOL | 8:30 PM |
| Sunday | T-Mobile | both | The xx | 8:30 PM |
| Sunday | American Express | both | Twenty One Pilots | 8:30 PM |

Searched: the official festival site and its support FAQ, the SeatGeek and
OneStoWatch/press "full schedule" write-ups, austintexas.org's visitor guide,
a parking-guide blog, Instagram/Facebook official posts, Reddit's
schedule-release thread, KLBJ, and CultureMap Austin's schedule-reveal
article (its page didn't render past nav/header — 404-adjacent JS shell, no
usable body).

**What every source actually prints:** a start time for each headliner
(matching what's already in the file) and, separately, the **festival's own
gate/operating hours** — never a sentence tying a specific artist to a
specific end clock time. The official source
(`support.aclfestival.com/hc/en-us/articles/4405406283924`) states plainly:
"The festival's scheduled entrances/gates/doors open and close each day at
the following times" — **12pm–10pm for all six days, both weekends** (Fri/Sat/
Sun × W1/W2, uniformly). Three more independent sources corroborate "10 p.m.
each day" for all three days (austintexas.org: "10 a.m. to 10 p.m. each day";
swvl.com's ACL parking guide: "runs Friday through Sunday from 10 a.m. to 10
p.m. each day"; ACL's own Instagram/Facebook 25th-anniversary posts: "from
noon to 10 p.m. each day"). One outlier contradicts this — onestowatch.com's
"Weekend One" guide claims Saturday/Sunday hours are "11 a.m. to 9 p.m." (a 9
PM close) — but that's a single unofficial aggregator against four sources
including the festival's own FAQ, and a 9 PM close would give Saturday's
Lorde only 45 minutes and RÜFÜS DU SOL only 30 minutes before "close" —
physically implausible for closing headliner sets, which is a good sign that
number is simply wrong, not that 10 PM is.

**I did not write any of the seven ends.** "Gates open/close at 10 PM" is the
festival's operating hours, not a sentence that says "Skrillex plays until
10:00 PM" — the closest thing to a source I found, but still an inference
from park hours rather than a printed set end, and the brief is explicit
twice over: never guess a headliner's end, leave it and report it when no
source prints one. All seven headliner grid entries are unchanged from
before this branch (`time` is still start-only, e.g. `"8:15 PM"`); Gap 2 is
**not fixed** — see the report for what's needed to close it (an ACL app
screenshot of the actual per-slot grid, or a press piece that explicitly
states an end time, would do it; general "festival hours" should not).

## Commits

1. `9c18ce9` — freeze pick keys, start this log.
2. `1cf5808` — `order` + printed/guessed `time`/`close` on all 66 Late
   nights entries; 12 new venue registry entries in
   `data/venues/index.json`.

Every diff scanned for `#g=<token>` before staging (`git diff --cached | grep
-oE '#g=[A-Za-z0-9_-]{10,}'`) — clean both times.

---

# Round two (2026-09-26) — no guess later than the show, the tool groups by date, the suite green

Following `ACL-PREP-ROUND2.md`. Worked in the same worktree/branch. Order of
work differs from the brief's numbering on purpose: the tool first (step A),
because every re-run below needs it; then the data (step B); then the tests
(step C).

## Step A — the tool (`scripts/guess-run-times.mjs`)

**What was wrong, beyond the brief's gap.** Three things, not one:

1. `runsOf()` keyed rooms by `night|venue`, so a dated section (Late nights)
   produced zero rooms — the gap round one reported.
2. It only took entries with an `order`, and the validator forbids an order
   on a one-act room, so even with dates it could never reproduce the 8
   single-act guesses round one wrote (Villanelle, Night Tapes, Suki, Ryan
   Beatty, War on Drugs, Rodrigo y Gabriela, Noga Erez, Claire Rosinkranz).
3. The deeper one, and the actual cause of the dangerous guesses: `planRun`
   laid EVERY room back from its close (closer = close − headliner set). That
   is right for a club night that runs to the close, and wrong for a concert
   bill, which ends when its headliner does. With a 2 AM fallback close it put
   Palace at 12:30 AM behind 7 PM doors; fixing only the registry's closes
   would not have fixed it, because one venue hosts 7 PM and 9 PM doors shows
   and a single close cannot serve both.

**What changed.**

- A room = one section, one `night` or one `date`, one venue — read with the
  app's own `nightOf` / `dateOf` / `venueOf` (events.js), so the tool and the
  wall cannot disagree. A dated room reads the registry's by-weekday close
  through the weekday of its date. By-time sections (Folsom) have no rooms.
- A room of one act that already has a time is a run of one (re-laid, never
  numbered). A timeless room stays timeless (MODEL-V3 §5, TIME TBA) — that is
  what keeps Portola's Boys Noize (doors, a printed close, no time) from
  getting a 10:15 PM guess on a re-run.
- Two shapes, chosen by the registry's new optional `shape`, else by `kind`
  (club/bar → club, hall/outdoor → concert):
  - **club**: unchanged — first act at doors + gap, closer ends at the close.
  - **concert**: the first act at its posted time (a posted opener IS the first
    act) or doors + gap; each act after it by the support slot; the close is a
    CAP — when it binds (a curfew), the headliner still plays a full set and
    the openers move earlier, never before doors. This is the shape that errs
    early.
- A posted set is a fixed point for every shape: a guess never lands on or
  past a posted set that follows it (k guesses before it sit at least k half
  hours ahead). This is the Bambi collision, now impossible by construction;
  the plan prints a warning if posted sets leave no room.

**Disagreeing with the brief, gently:** it framed the tool gap as grouping
only. Grouping alone would have made the tool reproduce round one's late
guesses faithfully. The shape rule is the fix for section 1 of the brief.

**Portola stays byte-identical, on purpose.** Portola is live today (Sat Sep
26) and not in this round's scope. Its three Regency Ballroom rooms are `hall`,
so the concert shape would move them (Thu Soulwax 10:30 → 9:30 PM, Fri Channel
Tres 10:30 → 9:30 PM, **Sat Parcels 10:45 → 10 PM — tonight**). I pinned
Regency's registry entry to `"shape": "club"` with a dated note so
`tests/portola-events.test.mjs` ("the guessed times are DERIVED") keeps holding
Portola to exactly what the tool writes. Dry run of `portola-2026` before and
after the change: identical plans. **Whether tonight's Parcels guess should move
earlier is a live, friend-facing call for Kevin** — flagged in the report.

**Tests** (`tests/run-guess.test.mjs`, 10 new, all 14 old ones unchanged and
green): date + venue grouping and weekday close; run of one vs timeless vs
unnumbered pair; by-time sections skipped; concert follows its posted opener
(Palace 8:45 PM, where the club shape gives 12:30 AM); a curfew caps a concert
and pulls the opener earlier but never before doors; the posted fixed point
(Bambi at 11:15 PM with round one's 105-minute gap, 10:30 PM once the gap is
read correctly); a club night with a 2-hour headliner at a 2 AM room → 12 AM;
the shape pin; dated rooms write back and re-run to the same bytes.

Docs kept true: the tool paragraph in `docs/add-a-festival.md` and the README
script line (both describe the tool; a scope note, since the brief listed
data + script + tests).

## Step B — the rooms (`data/venues/index.json`, `data/festivals/acl-2026.json`)

Read every one of the 40 rooms. Sources: each venue's OWN event data first
(Live Nation's embedded data behind emosaustin.com / scootinnaustin.com,
antonesnightclub.com and stubbsaustin.com event pages, acllive.com, the
Concourse / Brushy / Devil May Care ticket pages), Ticketmaster's event text
where its page refuses scrapers (read through search), city code for curfews,
and — for the Concourse only — community reports of when headliners go on.
Full quotes are in each registry entry's `sources` / `setSources`.

### The finding that changed the most rooms: "Show" is the first act

Every venue here prints a Doors time and a Show time, and the Show time is
when the FIRST act goes on. Round one had most of these as guesses; 18 are now
posted from the venue's own print (36 posted in all, 30 guesses). Two of round
one's "posted" readings were wrong the other way:

- **Stubb's concert calendar prints DOORS, not show.** Its one time per show is
  labelled "Doors:" on the calendar; Ticketmaster prints "Doors: 7:00pm Show:
  8:00pm" (Brandon Flowers, Bleachers, Lola Young) and "Doors 8 / Show 9"
  (Parcels). So the amphitheater openers move 7 → 8 PM (Parcels' 8 → 9 PM),
  and the Stubb's Indoors shows move to their printed Show: Montclair 10:30,
  Grocery Bag 11, Almost Heaven 11:30, Annie DiRusso 10:30. These move LATER,
  deliberately: they are the venue's printed start, replacing a doors time.
- **Sunday (1994)** "9 PM" is its show start, but its page bills an opener we do
  not carry ("With Semiwestern"), so it is a guess (~9 PM, the opener's start).

### Per venue — what changed and the evidence

| Venue | kind/shape | close | gap / sets | Evidence (verbatim in the registry) |
|---|---|---|---|---|
| **Emo's** | club → **hall** (concert) | 2 AM fallback → unknown (hall fallback ~12 AM draws the window, schedules nobody) | gap 60 | emosaustin.com event data: Palace "Doors: 7:00pm Show: 8:00pm" (lineup Palace, The 4411); BUNT./Levity/Suki/RyG "Doors: 9:00pm Show: 10:00pm". Its own IG shows 9 PM-doors DJ nights running to 2 AM, concerts end in the evening — no single close fits both, so none. |
| **Brushy Street Commons** | club → **hall** | unknown | gap 60 (30 on the DJ night) | brushystreet.com: "Located within the sound stage of the historic 501 Studios building" — **indoor** (the brief called it outdoor; it is not, so no outdoor curfew). Eventim: Hunx "Doors 9 / Show 10", Arcy Drive "Doors 7 / Show 8", underscores DJ set "Doors 9:00pm Show: 9:30pm". |
| **3TEN** | club → **hall** | unknown | gap 60 | acllive.com: Villanelle, Łaszewo, Claire Rosinkranz all "Showtimes … 9:00PM" (AXS: doors 8). Claire's page bills "with Abby Powledge" (not in our lineup). |
| **Antone's** | club → **hall** | 12 AM (Yelp, kept) | gap 60 | Its own pages: World Famous Pets w/ Elijah Delgado "8:00pm (Doors: 7:00pm)"; Night Tapes "10:00pm (Doors: 9:00pm)"; Rochelle Jordan w/ Stefon Osae "10:00pm (Doors: 9:00pm)"; Don West w/ Kesmar "10:00pm (Doors: 9:00pm)". |
| **Mohawk Austin** | club → **hall** | 12 AM (Yelp, kept) | gap 60 | A concert venue ("music starts at 8p and goes to 10:30p-1a"); the Fcukers night is indoor. |
| **Stubb's** (amphitheater) | outdoor (concert) | none → **Red River curfew by weekday** (Sun–Wed 10:30 PM, Thu 12 AM, Fri/Sat 1 AM; Austin Code 9-2-30(A)(4), 2018 ordinance text, adoption not re-verified — Tue is 10:30 PM under the general rule too) | gap 60 | FAQ "an hour after doors"; Ticketmaster Doors/Show above. Per night, tighter: the indoor wristband after-shows open at 10 PM Thu (Montclair, "Free with wristband from Brandon Flowers"), 10:30 PM Fri (Grocery Bag, Bleachers), 11 PM Sat (Almost Heaven, Parcels) — written as an EVIDENCED close (`closeApprox` + that page's https link) on those three nights. |
| **Stubb's Indoors** | hall | 1:45 AM (FAQ, kept) | gap null (30 on four pages, 60 on two) | Each show's own page: Montclair "Doors: 10:00PM. Show: 10:30PM." (Ticketmaster: Doors 9:30), Grocery Bag "Doors: 10:30pm Show: 11:00pm" (Ticketmaster copies: Doors 10), Almost Heaven "Doors: 11:00PM. Show: 11:30PM." (an older Ticketmaster copy: Show 12 AM), Annie DiRusso "Doors 10 / Show 10:30", Sunday (1994) "Doors: 8:00PM. Show: 9:00PM … With Semiwestern". Where two sources disagree, the earlier time is kept. |
| **Historic Scoot Inn** | outdoor (concert) | none → **city outdoor curfew by weekday** (Sun–Wed 10:30 PM, Thu 11 PM, Fri/Sat 12 AM; Austin Code 9-2-30(A)(1)) | gap 60 | scootinnaustin.com event data: Finn Wolfhard/Malcy and CMAT/Fancy Hagood "Doors 6 / Show 7"; Saint Motel/The 4411 "Doors 5 / Show 6"; Noga Erez "Doors 7 / Show 8:30"; Ryan Beatty "Doors 5 / Show 6" with girlsweetvoiced (not in our lineup). |
| **The Concourse Project** | club | 2 AM, now **printed** per night | gap 0, **headliner 120** (was the 90 default) | Each night's own ticket page: "Show: 9:00PM" and "18+ Welcome // 9pm - 2am" (Chainsmokers, Aoki, it's murph, Yukimatsu, BUNT.). Headliners: r/concourseproject "Headliners go on at midnight unless otherwise stated"; r/Austin "Sets at Concourse usually start at 12:00 or so and go until 2:00"; r/ZedsDeadFam "typically midnight. Maybe 12:15-30"; the venue's own 2023 post shows a headliner from 11:30 PM on an extended night. |
| **Devil May Care** | bar (club) | 2 AM printed (kept) | gap **105 → null** (bar default 30), headliner 135 | The 105 minutes was each night's printed "Show: 11:45PM" — the HEADLINER's start, not the first act's. |
| **Fair Market** | hall | unknown | — | Universe ticket page: sponsor event "Thu, Oct 8, 2026 at 6:00 PM", no set time or end. |
| **The Continental Club** | club → hall | none | — | Its own Eventbrite: "@10pm … Doors open @9pm" → doors 9:30 → **9 PM**. |
| **Regency Ballroom** (Portola) | hall, **shape pinned to club** | — | — | Keeps Portola's live file exactly what the tool writes (step A). |

### Every room whose guess moved (round one → round two)

All earlier. (Posted-time corrections are in the table further down.)

- Emo's: **Palace ~12:30 AM → ~8:45 PM** (Oct 1), **BUNT. ~12:30 AM → ~10:45 PM** (Oct 2), **Levity ~12:30 AM → ~10:45 PM** (Oct 3).
- Brushy Street Commons: **Hunx and his Punx ~12:30 AM → ~10:45 PM** (Oct 2); underscores night (Oct 3) Directress ~11:15 → ~10:15 PM, **Underscores ~12:30 AM → ~11 PM**; **Arcy Drive ~12:30 AM → ~8:45 PM** (Oct 8, 7 PM doors).
- 3TEN: **Łaszewo ~12:30 AM → ~9:45 PM** (Oct 8).
- Mohawk Austin: **Fcukers ~10:30 → ~8:45 PM** (Sep 29, 8 PM opener).
- Antone's: **World Famous Pets ~10:30 → ~8:45 PM** (Oct 8, 8 PM opener); Rochelle Jordan ~10:45 → ~10:30 PM; Don West ~10:45 → ~10:30 PM (the venue's midnight close caps a 90-minute headliner).
- Stubb's: **Brandon Flowers ~9 → ~8:30 PM** (the outdoor show is over by the 10 PM after-show); **Parcels ~10 → ~9:30 PM** (over by 11).
- The Concourse Project: **The Chainsmokers, Steve Aoki, It's Murph, BUNT. (Oct 9) ~12:30 → ~12 AM**; Elephante and Nate Band ~10:45 → ~10:30 PM. The brief expected the Concourse might be right as it was; the evidence says its headliners go on at midnight, so 12:30 was 30 minutes late.

### Rooms left as they were, and why

- Devil May Care (both nights): Rebecca Black 11:45 PM and Fcukers 11:45 PM are printed; Bambi ~10:30 PM is now **the tool's** answer (bar gap 30, headliner 135), not a hand edit — a re-run cannot undo it.
- Stubb's Bleachers ~9 PM and Lola Young ~9 PM: the curfew (10:30 PM) and the forward rule agree.
- Historic Scoot Inn Finn Wolfhard ~8, CMAT ~8, Saint Motel ~7 PM: an hour after a printed 7 PM (6 PM) show, well inside the curfew.
- Single acts left on doors + gap because an opener we do not carry is billed (so the guess marks the opener's start — early, the safe side): Ryan Beatty ~6 PM (girlsweetvoiced), Claire Rosinkranz ~9 PM (Abby Powledge), Sunday (1994) ~9 PM (Semiwestern). Night Tapes is posted at 10 PM from Antone's own page, which bills it alone; Do512 bills "w/ Alice Rivers", so Night Tapes may go on later — again the safe side.
- The War on Drugs ~7 PM: nothing printed beyond a 6 PM event start; an hour later is the earliest likely.
- Jess Williamson at the Continental Club (10 PM – 11:30 PM printed) and Yukimatsu (9 PM printed): posted, untouched.

### Closes

A guessed close left in a room where every set is now posted could never be
refreshed (the tool leaves such rooms alone), so I removed those rather than
leave an orphan: Suki Waterhouse and Rodrigo y Gabriela (Emo's, "kind default
(club)" 2 AM), Villanelle (3TEN, same), Night Tapes (Antone's routine 12 AM).
Those rooms read "Doors 9 PM" in the zoom — no invented window.

### Checks

- `node scripts/guess-run-times.mjs acl-2026 --write` → 46 changes; a second
  `--write` → **0 changes** (the file is exactly what the tool writes; Bambi
  included).
- `node scripts/validate-festivals.mjs` → 0 errors.
- The validator's run checks never see a dated room (its room key needs a
  `night`) — **a gap worth fixing in the validator**, out of this round's
  scope. I ran the same invariants by hand on all 40 rooms / 66 sets (shared
  doors/close, distinct seq, `of` = room size, clock agrees with order, 30
  minutes apart, every set inside doors → close, no order on one act): 0
  problems.
- Pick keys: 148 names byte-identical (no name touched); freeze test green.
- Round one did NOT reorder `artists[]` (the brief's worry): array order and
  every name are identical to main; its "apply-order" step only added `order`.

### Full table — every Late nights set, round one → round two

`~` = guess. Bold = changed.

| Date | Venue | Act | Doors | Set (r1 → r2) | Close (r1 → r2) |
|---|---|---|---|---|---|
| 09-29 | Mohawk Austin | Total Wife | 7 PM | 8 PM | ~12 AM |
| 09-29 | Mohawk Austin | Fcukers | 7 PM | ~10:30 PM → **~8:45 PM** | ~12 AM |
| 10-01 | Emo's | The 4411 | 7 PM | ~8 PM → **8 PM** | ~2 AM → ~12 AM |
| 10-01 | Emo's | Palace | 7 PM | ~12:30 AM → **~8:45 PM** | ~2 AM → ~12 AM |
| 10-01 | Stubb's | Jess Williamson | 7 PM | 7 PM → **8 PM** | — → ~10 PM |
| 10-01 | Stubb's | Brandon Flowers | 7 PM | ~9 PM → **~8:30 PM** | — → ~10 PM |
| 10-01 | Stubb's Indoors | Montclair | 9:30 PM | 9:30 PM → **10:30 PM** | — |
| 10-01 | The Concourse Project | Austin Ashtin | 9 PM | ~9 PM → **9 PM** | ~2 AM → 2 AM |
| 10-01 | The Concourse Project | The Chainsmokers | 9 PM | ~12:30 AM → **~12 AM** | ~2 AM → 2 AM |
| 10-02 | 3TEN | Villanelle | 8 PM | ~9 PM → **9 PM** | ~2 AM → — |
| 10-02 | Antone's | Night Tapes | 9 PM | ~10 PM → **10 PM** | ~12 AM → — |
| 10-02 | Brushy Street Commons | CorMae | 9 PM | 10 PM | ~2 AM → ~12 AM |
| 10-02 | Brushy Street Commons | Hunx and his Punx | 9 PM | ~12:30 AM → **~10:45 PM** | ~2 AM → ~12 AM |
| 10-02 | Devil May Care | Bambi | 10 PM | ~10:30 PM | 2 AM |
| 10-02 | Devil May Care | Rebecca Black | 10 PM | 11:45 PM | 2 AM |
| 10-02 | Emo's | Sarah Pederzani | 9 PM | ~10 PM → **10 PM** | ~2 AM → ~12 AM |
| 10-02 | Emo's | BUNT. | 9 PM | ~12:30 AM → **~10:45 PM** | ~2 AM → ~12 AM |
| 10-02 | Historic Scoot Inn | Malcy | 6 PM | ~7 PM → **7 PM** | — → ~12 AM |
| 10-02 | Historic Scoot Inn | Finn Wolfhard | 6 PM | ~8 PM | — → ~12 AM |
| 10-02 | Stubb's | This Is Lorelei | 7 PM | 7 PM → **8 PM** | — → ~10:30 PM |
| 10-02 | Stubb's | Bleachers | 7 PM | ~9 PM | — → ~10:30 PM |
| 10-02 | Stubb's Indoors | Grocery Bag | 10 PM | 10:30 PM → **11 PM** | — |
| 10-02 | The Concourse Project | Riot Ten | 9 PM | 9 PM | ~2 AM → 2 AM |
| 10-02 | The Concourse Project | Elephante | 9 PM | ~10:45 PM → **~10:30 PM** | ~2 AM → 2 AM |
| 10-02 | The Concourse Project | Steve Aoki | 9 PM | ~12:30 AM → **~12 AM** | ~2 AM → 2 AM |
| 10-03 | Brushy Street Commons | 1x333 | 9 PM | ~10 PM → **9:30 PM** | ~2 AM → ~12 AM |
| 10-03 | Brushy Street Commons | Directress | 9 PM | ~11:15 PM → **~10:15 PM** | ~2 AM → ~12 AM |
| 10-03 | Brushy Street Commons | Underscores | 9 PM | ~12:30 AM → **~11 PM** | ~2 AM → ~12 AM |
| 10-03 | Emo's | Untitld | 9 PM | ~10 PM → **10 PM** | ~2 AM → ~12 AM |
| 10-03 | Emo's | Levity | 9 PM | ~12:30 AM → **~10:45 PM** | ~2 AM → ~12 AM |
| 10-03 | Historic Scoot Inn | Fancy Hagood | 6 PM | ~7 PM → **7 PM** | — → ~12 AM |
| 10-03 | Historic Scoot Inn | CMAT | 6 PM | ~8 PM | — → ~12 AM |
| 10-03 | Stubb's | Velvet Trip | 8 PM | 8 PM → **9 PM** | — → ~11 PM |
| 10-03 | Stubb's | Parcels | 8 PM | ~10 PM → **~9:30 PM** | — → ~11 PM |
| 10-03 | Stubb's Indoors | Almost Heaven | 11 PM | 11 PM → **11:30 PM** | — |
| 10-03 | The Concourse Project | Dazzle Camouflage | 9 PM | ~9 PM → **9 PM** | ~2 AM → 2 AM |
| 10-03 | The Concourse Project | Nate Band | 9 PM | ~10:45 PM → **~10:30 PM** | ~2 AM → 2 AM |
| 10-03 | The Concourse Project | It's Murph | 9 PM | ~12:30 AM → **~12 AM** | ~2 AM → 2 AM |
| 10-04 | Antone's | Stefon Osae | 9 PM | ~10 PM → **10 PM** | ~12 AM |
| 10-04 | Antone's | Rochelle Jordan | 9 PM | ~10:45 PM → **~10:30 PM** | ~12 AM |
| 10-04 | Emo's | Suki Waterhouse | 9 PM | ~10 PM → **10 PM** | ~2 AM → — |
| 10-04 | Historic Scoot Inn | Ryan Beatty | 5 PM | ~6 PM | — → ~10:30 PM |
| 10-05 | Brushy Street Commons | LP | 7 PM | 8 PM | — |
| 10-05 | Historic Scoot Inn | The 4411 | 5 PM | ~6 PM → **6 PM** | — → ~10:30 PM |
| 10-05 | Historic Scoot Inn | Saint Motel | 5 PM | ~7 PM | — → ~10:30 PM |
| 10-06 | Stubb's | Leon Knight | 7 PM | 7 PM → **8 PM** | — → ~10:30 PM |
| 10-06 | Stubb's | Lola Young | 7 PM | ~9 PM | — → ~10:30 PM |
| 10-06 | Stubb's Indoors | Annie DiRusso | 10 PM | 10 PM → **10:30 PM** | — |
| 10-08 | 3TEN | Left Lucid | 8 PM | ~9 PM → **9 PM** | ~2 AM → ~12 AM |
| 10-08 | 3TEN | Łaszewo | 8 PM | ~12:30 AM → **~9:45 PM** | ~2 AM → ~12 AM |
| 10-08 | Antone's | Elijah Delgado | 7 PM | ~8 PM → **8 PM** | ~12 AM |
| 10-08 | Antone's | World Famous Pets | 7 PM | ~10:30 PM → **~8:45 PM** | ~12 AM |
| 10-08 | Brushy Street Commons | Common People | 7 PM | 8 PM | ~2 AM → ~12 AM |
| 10-08 | Brushy Street Commons | Arcy Drive | 7 PM | ~12:30 AM → **~8:45 PM** | ~2 AM → ~12 AM |
| 10-08 | Fair Market | The War on Drugs | 6 PM | ~7 PM | ~12 AM |
| 10-08 | Stubb's Indoors | Sunday (1994) | 8 PM | 9 PM → **~9 PM** | — → ~1:45 AM |
| 10-08 | The Concourse Project | ¥ØU$UK€ ¥UK1MAT$U | 9 PM | 9 PM | — → 2 AM |
| 10-08 | The Continental Club | Jess Williamson | 9:30 PM → **9 PM** | 10 PM | 11:30 PM |
| 10-09 | Emo's | Rodrigo y Gabriela | 9 PM | ~10 PM → **10 PM** | ~2 AM → — |
| 10-09 | Historic Scoot Inn | Noga Erez | 7 PM | ~8 PM → **8:30 PM** | — |
| 10-09 | The Concourse Project | DJ Bad Apple | 9 PM | ~9 PM → **9 PM** | ~2 AM → 2 AM |
| 10-09 | The Concourse Project | BUNT. | 9 PM | ~12:30 AM → **~12 AM** | ~2 AM → 2 AM |
| 10-10 | 3TEN | Claire Rosinkranz | 8 PM | ~9 PM | ~2 AM → ~12 AM |
| 10-10 | Antone's | Kesmar | 9 PM | ~10 PM → **10 PM** | ~12 AM |
| 10-10 | Antone's | Don West | 9 PM | ~10:45 PM → **~10:30 PM** | ~12 AM |
| 10-10 | Devil May Care | Fcukers | 10 PM | 11:45 PM | 2 AM |

## Step C — the five red tests

All five asserted the OLD data (doors only, no clock on the two Jess
Williamson nights, no close), and none of them protected something the data
change broke. Each now asserts the shipped data, with a line saying why:

1. `occOf carries the date and the venue…` (tests/dated-occurrence.test.mjs):
   expected `time: null` on both of Jess Williamson's nights. Old data: they
   now carry their printed starts (Stubb's 8 PM show, the Continental Club's
   10 PM). What the test protects — two late nights are two occurrences,
   by date and venue — still holds.
2. `factsFor tells each late night its own truth…`: expected "Doors 7 PM" /
   "Doors 9:30 PM" / "Doors 9 PM" ×2. Old data: rooms with a close now read
   as a window — "Runs 7 PM – ~10 PM" (Stubb's, evidenced close, tilde),
   "Runs 9 PM – 11:30 PM" (Continental, printed; doors corrected to 9 PM),
   "Runs 9 PM – ~12 AM" (Emo's, hall fallback, tilde), "Runs 9 PM – 2 AM"
   (Concourse, printed). The right venue / map door / date per night: intact.
3. `the artist sheet's header for a dated occurrence…`: the same Continental
   Club string ("Doors 9:30 PM" → "Runs 9 PM – 11:30 PM"). Old data.
4. `a dated section exports with its dates: ACL Late nights, as shipped`
   (tests/day-image-sections.test.mjs): rows "Thu · Oct 1 · Stubb's" now end
   "· 8 PM" / "· 10 PM" because the sets have times. Old data; every row still
   leads with its date and names its own room.
5. `ACL as shipped: searching finds a Weekend 2 headliner…`
   (tests/two-weekend-schedule.test.mjs): a late card's `data-time` is now
   "8 PM\nStubb's" rather than the bare venue. Old data; the search, the
   date heads and the one-tab axis all still pass.

Play order, search and pick keys: round one never reordered `artists[]`
(identical to main) — it added `order` objects, which my room check shows
agree with the clock in all 40 rooms; search finds the late nights under
their dates (test 5); 148 pick keys byte-identical (freeze test green).

**One FYI the probe turned up (code, not in scope):** `findEventEntry` matches
an occurrence on its `time`. A notes sheet restored from a history entry
written BEFORE this data drop carries the old time and no longer finds its
show, so its header prints the stale clock without a tilde — for Palace,
"Thu · Oct 1 · 12:30 AM", the very late guess this round removed. The wall
re-renders from data and is fine. Suggest: for dated/venue entries, match on
name + date + venue and let `time` go (a guessed time is designed to move).

## Checks before reporting

- `node scripts/validate-festivals.mjs`: 0 errors (2 unrelated warnings).
- `npm test`: 1,081 pass / 0 fail at the default clock, at `TZ=Asia/Tokyo`,
  and at `NIGHT_CLOCK=2026-09-27T04:30:00Z` (+ night-clock import).
- `node scripts/guess-run-times.mjs acl-2026 --write` twice: 0 changes on the
  second — every Late nights time is reproducible by the tool.
- `node scripts/guess-run-times.mjs portola-2026`: identical plan to before
  this round (Regency pinned; Boys Noize stays timeless).

## Commits (round two)

1. `6be721e` — scripts: rooms by date, concerts laid forward, posted sets as
   fixed points; Regency pinned; 10 unit tests; docs line kept true.
2. `5de3639` — scripts: a fallback close draws a concert's window but
   schedules nobody (+1 test).
3. `befa69a` — data: registry corrections with sources; posted Show times;
   Stubb's/Scoot curfews and after-show closes; tool-written guesses.
4. (this commit) — tests: the five as-shipped expectations; this log.
