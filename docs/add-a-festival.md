# Adding a festival

*Updated 2026-07-07.*

Two files, one command:

1. **Create `data/festivals/<id>.json`** — id is a lowercase slug like
   `acl-2026`. Minimum viable (lineup announced, no set times yet):

```json
{
  "id": "my-fest-2026",
  "name": "My Fest",
  "year": "'26",
  "subtitle": "Some Venue",
  "location": "Austin, TX",
  "dates": "October 2-4, 2026",
  "accent": "16, 185, 129",
  "status": "lineup",
  "artists": [
    { "name": "Headliner" },
    { "name": "Support Act", "day": "Friday" }
  ]
}
```

   - `status`: `lineup` (no set times yet — app shows the sortable artist
     list), `scheduled` (full grid), or `archived` (past).
   - `artists[]` is always required (it feeds the list view). Optional per
     artist: `day`, `stage`, `time`, `weekends` (`"W1"|"W2"|"both"`, for
     two-weekend festivals — enables the weekend filter).
   - When set times drop, add `dayMeta` and `days{}` — each day carries its own `stages[]`; there is no top-level stages field (the renderer and validator only read `fest.days.<day>.stages`) (see
     `electric-forest-2026.json` for the full scheduled shape) and flip
     `status` to `scheduled`. Times are `"6:30 PM"` or `"6:30 PM - 7:30 PM"`;
     a missing end is filled from the next set on that stage.
   - **Two-weekend fests (ACL), scheduled:** keep the SAME three day keys
     ("Friday"/"Saturday"/"Sunday" — never "Friday W1"; day notes key on the
     label) and tag each set with `weekend: "W1"|"W2"` — untagged or
     `"both"` plays every weekend, and an artist whose times differ across
     weekends is simply two entries. The wall renders one weekend at a time
     (the weekend picker loses "Both" in scheduled mode; a stored "Both"
     shows Weekend One). Give each `dayMeta` entry
     `dates: { "W1": "Oct 2", "W2": "Oct 9" }` so the day rule shows the
     selected weekend's real date. Keep `weekends` tags on the top-level
     `artists[]` — they drive the picker's presence and the search extras.
   - Optional `activities{}` for non-stage programming (workshops, silent
     disco) — renders as a time-sorted list under the grid.

2. **Add an entry to `data/festivals/index.json`** (keep it ordered by date,
   archived last — the first non-archived entry is the default festival).
   Every index entry needs `startsOn: "YYYY-MM-DD"` (the festival's first
   day) — it drives the landing's date sort and its "Sep '26" labels; the
   validator rejects entries without it.

3. **Validate:** `node scripts/validate-festivals.mjs` — errors block CI.
   `scripts/import-festival.mjs` helps convert pasted lineup text.

Picks are keyed by artist name, and lookups are EXACT — case included
(`picksFor`/`noteCount` do no folding; only the Spotify affinity map is
case-insensitive). So keep names byte-stable between the lineup and scheduled
phases: ANY spelling change, capitalization included, orphans existing picks
and artist notes for that artist. If a name must change, accept the orphaning
knowingly — there is no migration path in the doc model (additive merge can't
delete the old key).

Day notes are keyed by day LABEL the same way. When set times drop and you
flip `lineup` → `scheduled`, keep the `days{}` keys byte-identical to the day
strings the lineup phase used in `artists[].day` ("Friday", not "Fri" or
"Friday W1") — renamed day keys silently strand every day note the crew has
written.

An `artists[]` entry can also be an EVENT (an afterparty, a street-fair
party): give it the venue in `stage` and the hours in `time` and the lineup
wall renders them as a card sub-label. A same-name entry on a *different* day
is a reappearance (a lineup artist playing an afters show) — picks, auras and
notes unify by exact name on purpose, and the validator only flags same-day or
day-less duplicates. See `portola-2026.json` (the Afters/Folsom sections) for
the worked example.
