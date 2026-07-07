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
   - When set times drop, add `stages`, `dayMeta`, and `days{}` (see
     `electric-forest-2026.json` for the full scheduled shape) and flip
     `status` to `scheduled`. Times are `"6:30 PM"` or `"6:30 PM - 7:30 PM"`;
     a missing end is filled from the next set on that stage.
   - Optional `activities{}` for non-stage programming (workshops, silent
     disco) — renders as a time-sorted list under the grid.

2. **Add an entry to `data/festivals/index.json`** (keep it ordered by date,
   archived last — the first non-archived entry is the default festival).

3. **Validate:** `node scripts/validate-festivals.mjs` — errors block CI.
   `scripts/import-festival.mjs` helps convert pasted lineup text.

Picks are keyed by artist name, so keep names stable between the lineup and
scheduled phases (fixing capitalization is safe — lookups are exact by name,
so a spelling change orphans existing picks for that artist).
