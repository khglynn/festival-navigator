# Adding a festival

*Updated 2026-08-27 (set-times drop recipe + the pick-key freeze).*

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
     `portola-2026.json` for the full scheduled shape, with afters sections;
     `electric-forest-2026.json` for a four-day grid with activities) and flip
     `status` to `scheduled` in BOTH the file and `index.json`. Times are
     `"6:30 PM"` or `"6:30 PM - 7:30 PM"`; a missing end is filled from the
     next set on that stage. The validator enforces on any live grid: every
     grid name is an `artists[]` name **byte for byte** (a case-only match is
     an error — it would split the crew's picks), no two sets overlap on one
     stage, no set ends before it starts; and it warns when a lineup artist
     billed on a grid day has no set there (usually a missed box).
   - **Set-times drop, in order (the Portola recipe, 2026-08-27):**
     1. `node scripts/freeze-pick-keys.mjs <id>` BEFORE editing — it snapshots
        the festival id, every artist name and every day label into
        `tests/fixtures/live-pick-keys.json`; the validator AND
        `tests/live-pick-keys.test.mjs` fail if any of them later disappears,
        and every non-archived festival must be frozen (`--all-live` does them
        all). Renaming is then a visible fixture edit, never an accident.
        Two-minute version for whoever edits data: `data/festivals/README.md`.
     2. Transcribe the official poster into `days{}` using the EXISTING
        `artists[]` spellings; billing extras ("(DJ Set)", "(Live)",
        "(Skrillex + Boys Noize)") go in `meta.note`, never in the name.
        Read the poster more than once — two independent readings diffed
        box-by-box is the bar; the Portola drop used three.
     3. New names on the poster (Portola's Kaytree) get an `artists[]` entry too.
     4. Sections that are NOT grid days (Afters, Folsom) need nothing — a
        scheduled wall renders the grid days, then every remaining
        `artists[].day` group as card sections, then anything billed on a
        grid day but missing from the grid under EVERYTHING ELSE. The day
        tabs mirror that order.
     5. Validate, `npm test`, bump `CACHE_VERSION`, eyeball a real browser.
        Festival JSONs are fetched network-first by the service worker (a
        bounded wait, cache as the offline fallback), so a data drop reaches
        an online phone on its first open — not the one after.
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
delete the old key). The freeze in `tests/fixtures/live-pick-keys.json` is
what makes "knowingly" real: the rename shows up as a fixture edit in the diff.

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
