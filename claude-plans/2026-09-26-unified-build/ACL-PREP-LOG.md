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
2. (this step) — `order` + printed/guessed `time`/`close` on all 66 Late
   nights entries; 12 new venue registry entries in
   `data/venues/index.json`.

Every diff scanned for `#g=<token>` before staging (`git diff --cached | grep
-oE '#g=[A-Za-z0-9_-]{10,}'`) — clean both times.
