# MODEL v3 — day-first, the layout rule, buckets, the deck, back-to-back runs (2026-08-31)

*Proposed; canvas-v3.html is the picture. Nothing built. Supersedes the
section-tab structure of `2026-08-31-events-model.md`; keeps its structured
data change.*

## 1 · Day-first

The day tabs are THE days (THU FRI SAT SUN — the union of grid days and
event nights), never section names. One day renders its rooms in order:

1. **The main grid**, if this day is a grid day (`days[day]`), exactly as
   today.
2. **One section per events section active that day** (AFTERS, FOLSOM …),
   as a quiet sub-rule under the day, each laid out by the rule below.

General landings: a grid-only fest (EDC, Seismic) is unchanged — tabs are
its grid days, no sections render. A pre-party day (Lost Lands WED) is a
tab with no grid and one section. Two-weekend fests (ACL) keep the W1/W2
control orthogonally — day-first changes nothing there.

**Frozen-key law:** artist names and existing day keys are pick/notes data.
Section notes keep their key (notes written on day "Afters" stay keyed
"Afters" — the section's notes chip points there). New day tabs (THU/FRI)
introduce NEW note keys, which is additive and safe. Nothing renames.

## 2 · The layout rule (per section — the data decides, ONCE per fest)

```
timed = events with a time
E = timed.length          V = distinct venues among timed
R = E / V                 T = timed / all events

a day EARNS columns       iff  E >= 5  AND  R >= 1.5  AND  T >= 0.6
SECTION MODE = COLUMNS    iff  ANY day of the section earns them
             = TILES      otherwise
```

**The consistency law (Kevin, 2026-08-31):** the mode is decided per
SECTION per FEST, not per day — "if any days warrant columns, then all
days warrant columns. Otherwise it's confusing to go from Friday and see
stage columns and then to Saturday and see no stage columns." The COLUMN
SET stays each day's own venues — which is also the answer when stages
differ day to day: the mode holds steady across days, the venue heads
change with the day. A columns-mode day whose data is thin just renders a
short timetable (timeless events still land in the TIME TBA row).

Justified against every real file: Portola FRI afters (12 shows · 8
venues, all timed) earns columns → the AFTERS section is columns ALL
week (SAT's thinner night included); Folsom never earns them (R≈1) →
tiles all week; Lost Lands WED (1 venue, no times) → tiles;
single-venue fests never have sections at all. Festival files carry only
`night` + `venue` per event (the round-1 data change); they never
declare a layout.

## 3 · The bucket filter (persists)

*(Round-3 correction — venue-level filtering was overreach. Kevin: "hide
or focus on big buckets when we have them like 'afters' 'folsom' or
'portola'.")*

- One **chip per room the fest has** (PORTOLA · AFTERS · FOLSOM), drawn
  in the people-chip vocabulary on the day view. Toggling a bucket off
  hides that section from EVERY day; a foot-whisper ("Folsom is hidden —
  tap its chip to bring it back") keeps the way back visible.
- Persistence: `fn_buckets_v1_<festId>`, device-local like the weekend
  view — never written to the crew doc.
- Coexistence: stage-solo taps govern the main grid only; the people
  filter dims/hides by picks as today; the bucket filter governs whole
  sections. No interaction terms.

## 4 · The deck (the stacked slot)

In columns mode, 2 simultaneous sets still lane-split (readable). **3+
become one deck**: the earliest card on top, two ghost edges behind, a
count pill (`4 · 10 PM`). A tap grows the deck **in place** — the zoom's
own gesture and budget (transform/opacity, overshoot curve, instant under
Low Power) — into a panel titled `VENUE · HOUR` holding the full cards,
each hover/tap/pickable exactly like wall cards. Escape / outside / scroll
put it away like the zoom. Tiles mode never needs it.

**Scope narrowed 2026-08-31:** the deck is for data that is TRULY
simultaneous. The pile that motivated it turned out not to be — see §5.
It stays as the honest default for any pile nobody has re-read yet.

## 5 · Back-to-back runs (the doors-time pile, re-read)

Kevin's read of the portola-week source (2026-08-31): the Midway's "four
10 PM shows" are ONE night played in sequence — the poster gives DOORS,
not set times. The model:

- **Data:** each set gets a GUESSED time (`approx: true` on the event),
  spaced from doors at roughly an hour a set. Order from the poster's own
  hierarchy: the headliner (the name in the buy-tickets text under the
  image) closes; the other large-print act plays right before it; small
  print opens. The guess is data-entry judgment, recorded per event —
  never inferred at render time.
- **Layout:** the venue's column becomes a plain vertical run — stacked
  in the time bands, never side-by-side lanes, never a deck, never a
  combined card. Artist separation is law: every set stays its own
  tappable card (a combined card would eat the crew's picks).
- **The mark (LOCKED, Kevin 2026-09-01):** the resting card renders the
  guessed time with a tilde (`~12 AM`) plus ONE section-level whisper
  ("~ marks a guessed set time — the order is the plan"). Never per-card
  explanations. The zoom tells the whole truth in two `f-sub` lines —
  `Sun · Runs 10 PM – 2 AM` (the venue's real window, so no invented
  clock in the zoom) then `Guessing they're 3rd of 4` as a DOOR to the
  poster or ticket page, the way a venue is a door to its map. Once the
  venue posts the order the word goes and the door stays: `3rd of 4`.
  Data this implies per event: `doors`, `close`, `order: { seq, of,
  source (url), confirmed }`. Canvas frame `hover` shows all three
  states; `approx` keeps the runners-up (the word `1-ish`; running order
  on the resting card, which falls off the clock).

**Build notes (2026-09-01, PR #16 review round — the spec matches the build):**

- The whisper is exactly `~ marks a guessed set time — the order is the plan`
  — no terminal period.
- When the CLOSE is our guess too (`closeApprox: true` — Portola's Midway
  prints doors, not an end), the window line wears the tilde on the close:
  `Sun · Runs 10 PM – ~2 AM`. A sourced close reads `Runs 10 PM – 2 AM`.
- The apostrophe in `Guessing they’re 3rd of 4` is typographic (’), like
  the app's other copy.
- §4's deck decides on PEAK concurrency (three sets on the clock at one
  moment), not on how many sets an overlap chain touches — a long set
  bridging two shorter ones that never overlap each other is two lanes.
- The tilde travels with `approx` on every surface a time prints on — the
  tile, the cell, the deck's pill and title, a search result, a flat sort —
  and the whisper follows it to each.

## 6 · Build sizing (honest)

M+, one PR after data migration: restructure Portola's 45 events to
`night`/`venue` (script) + validator rule; `extraSectionsOf` → day-first
composition in wall.js; the tiles renderer is renderLineupGroup minus day
grouping; columns reuses the timetable renderer with venues as stages; the
deck is new (cell + grown panel, sharing the zoom's motion constants);
filter chip + popover + persistence + whisper; day-tab derivation.
Riskiest edge: one sticky stage strip per day when multiple column
sections coexist on a grid day — the strip must scope to its own scroller
(the Sat frame shows it working statically).
