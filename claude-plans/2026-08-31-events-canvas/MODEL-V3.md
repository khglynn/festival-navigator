# MODEL v3 — day-first, the layout rule, filters, the deck (2026-08-31)

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

## 2 · The layout rule (per day, per section — the data decides)

```
timed = events with a time
E = timed.length          V = distinct venues among timed
R = E / V                 T = timed / all events

COLUMNS (venues on a clock)  iff  E >= 5  AND  R >= 1.5  AND  T >= 0.6
TILES  (time-sorted cards)   otherwise; timeless sort to the end as
                             "time TBA" (columns mode: a TIME TBA row)
```

Justified against every real file: Portola FRI afters (12 shows · 8
venues, all timed) → columns; SAT afters (9 shows, 4 timeless → T=.56) →
tiles; Folsom any night (R≈1) → tiles; Lost Lands WED (1 venue, no
times) → tiles; single-venue fests never have sections at all. Festival
files carry only `night` + `venue` per event (the round-1 data change);
they never declare a layout.

## 3 · Venue filter (persists)

- One **Venues chip** on the first events section of a day (pin icon,
  `Venues` / `Venues · 2 hidden`). Opens a checklist of every venue in the
  FEST (not just the day): all checked by default, uncheck to hide,
  `all` resets. A hidden venue disappears from every day's sections
  (columns lose the column, tiles lose the cards); a foot-whisper
  "2 venues hidden — Venues ›" keeps the way back visible.
- Persistence: `fn_venues_v1_<festId>` = `{"hidden":["SF Eagle"]}`,
  device-local like the weekend view — never written to the crew doc.
- Coexistence: stage-solo taps govern the main grid only; the people
  filter dims/hides by picks as today; the venue filter governs events
  sections only. No interaction terms.

## 4 · The deck (the stacked slot)

In columns mode, 2 simultaneous sets still lane-split (readable). **3+
become one deck**: the earliest card on top, two ghost edges behind, a
count pill (`4 · 10 PM`). A tap grows the deck **in place** — the zoom's
own gesture and budget (transform/opacity, overshoot curve, instant under
Low Power) — into a panel titled `VENUE · HOUR` holding the full cards,
each hover/tap/pickable exactly like wall cards. Escape / outside / scroll
put it away like the zoom. Tiles mode never needs it.

## 5 · Build sizing (honest)

M+, one PR after data migration: restructure Portola's 45 events to
`night`/`venue` (script) + validator rule; `extraSectionsOf` → day-first
composition in wall.js; the tiles renderer is renderLineupGroup minus day
grouping; columns reuses the timetable renderer with venues as stages; the
deck is new (cell + grown panel, sharing the zoom's motion constants);
filter chip + popover + persistence + whisper; day-tab derivation.
Riskiest edge: one sticky stage strip per day when multiple column
sections coexist on a grid day — the strip must scope to its own scroller
(the Sat frame shows it working statically).
