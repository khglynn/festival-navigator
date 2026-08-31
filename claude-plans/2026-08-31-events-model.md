# Events inside a festival — the structured model (proposal, 2026-08-31)

*Status: PROPOSED, awaiting Kevin's yes. Nothing below is built.*

## Kevin's ask, in his words

> for the afters we need stages and times, and for folsom we need sort
> order. if done correctly we'll have a build that'll allow for more
> flexible combinations of event / location types within the same festival.

## What exists today (portola-2026.json)

Two grid days (`days.Saturday`, `days.Sunday` — stages × times, the
timetable) plus **45 event entries in the top-level `artists[]`** keyed by a
non-grid `day`:

| day | count | shape |
|---|---|---|
| `Afters` | 37 | `{ name, day: "Afters", stage: "Thu · Regency Ballroom", time: "8 PM" }` |
| `Folsom` | 7 | `{ name, day: "Folsom", stage: "Sun · SVN West", time: "7 PM - 2 AM" }` |
| `Afters & Folsom` | 1 | Horse Meat Disco — lands in both sections |

The weekday and the venue are **smashed into one string** (`"Thu · Venue"`);
`wall.js` and `card-facts.js` both split on `" · "` to pull them apart.
Sections render as a flat card grid in **file order** — and the file is not
sorted (Afters: Thu 8 PM, Thu 10 PM, Fri 5 PM, Fri 10 PM, Fri 8 PM, …).
Six Afters entries carry no `time` at all.

## The model

One festival = **sections**. A section has a `type`, and the type picks the
renderer. Today there are exactly two types; the shape leaves room for more.

```jsonc
"days": {                       // unchanged: grid days (stages × times)
  "Saturday": { "stages": [...], "artists": [...] }
},
"sections": {                   // NEW: non-grid sections, in display order
  "Afters": { "type": "events", "label": "AFTERS", "dates": "Sep 24–27",
              "nights": ["Thu", "Fri", "Sat", "Sun"] },
  "Folsom": { "type": "events", "label": "FOLSOM", "dates": "Sep 25–27",
              "nights": ["Fri", "Sat", "Sun"] }
},
"artists": [
  // an EVENT entry — structured, no more smashed strings:
  { "name": "Soulwax", "day": "Afters", "night": "Thu",
    "venue": "Regency Ballroom", "time": "8 PM" },
  { "name": "Horse Meat Disco", "day": "Afters & Folsom", "night": "Fri",
    "venue": "Public Works", "time": "9 PM - 3 AM" }
]
```

- `day` stays exactly as it is — it is the section key AND the notes key
  (`noteCount(…, 'day', day)`), and artist names stay the pick keys. **No
  frozen key changes; no migration of crew data.**
- `night` + `venue` replace the smashed `stage`. `venues[venue]` (the maps
  door) keys off `venue` byte-for-byte — same rule as today.
- `dayMeta.Afters` / `dayMeta.Folsom` fold into `sections.*` (one home).

## What the `events` renderer does

1. **Groups by night**, in `sections.X.nights` order, each night a sub-rule
   inside the section ("THURSDAY · SEP 24" — the same `dayLabelParts`
   vocabulary the day rules use).
2. **Sorts by start time inside a night** (parse "8 PM", "10 PM - 2 AM",
   "11 AM - 6 PM"; a post-midnight start like "1 AM" sorts after "11 PM";
   no time → end of the night, so the six timeless Afters entries don't
   vanish, they just sit last).
3. Each card: name · `night · time` on line one · venue on line two (what
   `renderLineupGroup` already does), the venue a **map door** where
   `venues[venue]` exists — the zoom's WHERE line already does this.
4. A combined `day` ("Afters & Folsom") lands in each section, as now.

This is a list, not a second timetable. Afters venues are scattered across
a city and nights, so venue-columns would be mostly empty; a night-grouped,
time-sorted list with map doors is the honest shape.

## What changes in code (M, one PR)

- `api/_lib/festival-rules.mjs` (validator): a `type: "events"` section
  requires `night` ∈ `nights` and `venue` on every entry; the smashed
  `"Thu · Venue"` shape becomes an ERROR for Portola (fully migrated) —
  no dual-shape support to rot.
- `wall.js extraSectionsOf` → reads `sections`; `renderLineupGroup` gains
  the night sub-groups + the sort; `card-facts.js factsFor` reads
  `night`/`venue` directly instead of splitting `stage`.
- `data/festivals/portola-2026.json`: 45 entries restructured (a script,
  not by hand), `sections` added, `dayMeta.Afters/Folsom` moved.
- `scripts/validate-festivals.mjs`, `docs/add-a-festival.md`,
  `docs/fest-update-runbook.md`, `tests/afters-events.test.mjs` +
  `tests/portola-2026.test.mjs` updated; `tests/fixtures/live-pick-keys.json`
  untouched (names don't change).

## Two calls for Kevin before building

1. **Night sub-headers inside AFTERS/FOLSOM** (one rule per night, like the
   grid days) — or one flat sorted list with the night shown on each card?
   The proposal above is sub-headers; it makes "what's on Friday night" a
   glance.
2. **Folsom Street Fair itself** (Sun 11 AM–6 PM, the street, not a club):
   in the Folsom section like everything else, or does it deserve its own
   `type` later (a fair with a route/map rather than a set time)? Proposal:
   same section for now; the model leaves the door open.
