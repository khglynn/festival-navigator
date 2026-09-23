# Adding a festival

*Updated 2026-09-23 — a cancelled act keeps its entry and says so
(`cancelled`, below). 2026-09-16 — MODEL-V4: a section entry says `night` or
`date`; one rule for guessed times; doors go in `doors`.*

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
     `status` to `scheduled` in BOTH the file and `index.json` (the validator
     errors when they differ). Times are
     `"6:30 PM"` or `"6:30 PM - 7:30 PM"`; a missing end is filled from the
     next set on that stage. The validator enforces on any live grid: every
     grid name is an `artists[]` name **byte for byte** (a case-only match is
     an error — it would split the crew's picks), no two sets overlap on one
     stage, no set ends before it starts; and it warns when a lineup artist
     billed on a grid day has no set there (usually a missed box — unless the
     act is cancelled, see **Cancelled acts** below).
   - **Set-times drop, in order (the Portola recipe, 2026-08-27):**
     1. `node scripts/freeze-pick-keys.mjs <id>` BEFORE editing — it snapshots
        the festival id, every artist name and every day label into
        `tests/fixtures/live-pick-keys.json`; the validator AND
        `tests/live-pick-keys.test.mjs` fail if any of them later disappears,
        and every non-archived festival must be frozen (`--all-live` does them
        all). Renaming is then a visible fixture edit, never an accident.
        Run it again after adding names: the validator fails with "not frozen
        yet" until the freeze holds every name and day label.
        Two-minute version for whoever edits data: `data/festivals/README.md`.
     2. Transcribe the official poster into `days{}` using the EXISTING
        `artists[]` spellings; billing extras ("(DJ Set)", "(Live)",
        "(Skrillex + Boys Noize)") go in `meta.note`, never in the name.
        Read the poster more than once — two independent readings diffed
        box-by-box is the bar; the Portola drop used three.
     3. New names on the poster (Portola's Kaytree) get an `artists[]` entry too.
     4. Sections that are NOT grid days (Afters, Folsom, Late nights) each
        say where they go — `night` or `date`, and always `venue` (see
        **Event fields** below). A weekday section renders inside that day,
        under the festival's own room; a dated one takes a tab of its own
        after the days. Anything the festival bills with no set on the grid
        stays on its day too, as a stack rather than a column.
     5. Validate, `npm test`, bump `CACHE_VERSION`, eyeball a real browser.
        Festival JSONs are fetched network-first by the service worker (a
        bounded wait, cache as the offline fallback), so a data drop reaches
        an online phone on its first open — not the one after.
   - **Two-weekend fests (ACL), scheduled:** keep the SAME three day keys
     ("Friday"/"Saturday"/"Sunday" — never "Friday W1"; day notes key on the
     label) and tag each set with `weekend: "W1"|"W2"` — untagged or
     `"both"` plays every weekend, and an artist whose times differ across
     weekends is simply two entries. A scheduled two-weekend fest gets SIX
     dated tabs, one per date in `dayMeta[...].isos` (FRI 2 · SAT 3 · SUN 4 ·
     FRI 9 · SAT 10 · SUN 11); each tab draws its own weekend's sets, and an
     untagged set plays on both. A lineup-only two-weekend fest never had a
     grid to split, so it shows both weekends on one wall with the W1/W2 tags
     on the cards. Give each `dayMeta` entry
     `dates: { "W1": "Oct 2", "W2": "Oct 9" }` so the day rule shows the
     selected weekend's real date. Keep `weekends` tags on the top-level
     `artists[]` — they drive the picker's presence and the search extras.
     The two spellings never cross (`weekend` on a grid set, `weekends` on
     `artists[]`): the validator errors on either one in the wrong place, and
     on a W1/W2 lineup over a grid with no W1/W2 set.
   - Optional `activities{}` for non-stage programming (workshops, silent
     disco) — renders as a time-sorted list under the grid.
   - **Give each grid day its calendar date** in `dayMeta`: `iso:
     "2026-09-26"` (two-weekend fests: `isos: { "W1": "2026-10-02", "W2":
     "2026-10-09" }`). That is what the "now" line and the day-of auto-scroll
     key on — a phone opened on that date (5 AM to 5 AM, festival time)
     draws the line at the festival's clock and lands on it once per open.
     No `iso`, no line, no guess. The validator rejects a date that isn't
     real.
   - **Give the file its `timezone`** (IANA, e.g. `"America/Los_Angeles"`,
     ACL/Seismic: `"America/Chicago"`) — required as soon as `dayMeta`
     carries dates. "Now" is read in that zone, so a friend checking from
     another city sees the line where the crew actually is, and the day-of
     open lands on the right day. The validator rejects an unknown zone.

2. **Add an entry to `data/festivals/index.json`** (keep it ordered by date,
   archived last — the first non-archived entry is the default festival).
   Every index entry needs `startsOn: "YYYY-MM-DD"` (the festival's first
   day) — it drives the landing's date sort and its "Sep '26" labels; the
   validator rejects entries without it.

3. **Validate:** `node scripts/validate-festivals.mjs` — errors block CI.
   `scripts/import-festival.mjs` helps convert pasted lineup text.

4. **Render its link preview:** `npm run brand`. It writes
   `assets/og/<id>.jpg` — the card people see when the crew link is pasted into
   iMessage or Slack — from the name, accent, location and `startsOn` you just
   added, and regenerates the app icons from `assets/mark.svg` while it is
   there. Commit the new `.jpg`. Skip this and the festival's link unfurls as a
   blank grey card with no error anywhere; `tests/brand-assets.test.mjs` fails
   the build instead, which is the only reason anyone would ever find out.

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
party): give it its night and its room (below) and the wall renders it as a
card in that room's stack. A same-name entry on a *different* day
is a reappearance (a lineup artist playing an afters show) — picks, auras and
notes unify by exact name on purpose, and the validator only flags same-day or
day-less duplicates. See `portola-2026.json` (the Afters/Folsom sections) for
the worked example.

### Cancelled acts (2026-09-23)

When a festival calls an act off, **never delete its `artists[]` entry** —
the name is a pick key, and a card that vanished would leave everyone who
picked it planning around a set that is not happening (Skepta, Portola
Saturday, called off 2026-09-21 with three of the crew's picks on him). Mark
the entry instead, and take its set off the grid:

```json
{ "name": "Skepta", "day": "Saturday", "venue": "Crane Stage",
  "cancelled": { "on": "2026-09-21", "source": "https://www.sfchronicle.com/…",
                 "note": "No replacement. The earlier Crane Stage sets run longer." } }
```

| Field | What |
|---|---|
| `cancelled.on` | The real `YYYY-MM-DD` date it was announced. The zoom says "Announced Sep 21". |
| `cancelled.source` | An `https` link to where it was announced — that line is a door to it. |
| `cancelled.note` | Optional. One short line (140 chars at most) about what happened around it: a replacement, sets that moved. |

Keep the entry's `day`. Give it a `venue` when it had a stage — the card lands
in the festival's own room under that stage's name, below the grid; without
one it lands under the festival's site. It works the same on an afters or
dated section entry, which keeps its `night`/`date` and `venue`.

What the app does with it: the card stays (struck through, "Cancelled" where
the time goes, the crew's marks still on it), sorts last in its room, is never
lit as playing now, answers a search as cancelled, is marked in the day
image, and never goes into a playlist made from picks. Tapping it picks like
any card. Re-time the sets around it from the new poster the same day, and
add a dated line to `meta.note`.

The validator errors on a malformed `cancelled` (not an object, an unknown
key, `on` not a real date, `source` not https, a note that is long or
multi-line), on a cancelled name that still has a set on a grid day its entry
names, and on `cancelled` written on a grid set. It does not warn that the act
has no set on the grid, or that its venue has no map.

### Event fields — where a section goes (MODEL-V4 §6)

A SECTION is an `artists[].day` label that is not one of the grid's days:
Portola's AFTERS and FOLSOM, ACL's LATE NIGHTS. Its entries carry the room
and the night as data rather than as prose, and that is what places them.
Every section entry says where its section sits with **exactly one** of
`night` or `date`, plus `venue`.

| Field | What |
|---|---|
| `night` | `Mon`…`Sun` — the night it plays. The section renders inside that day, under the festival's own room, and the day tabs are the union of the grid days and these nights. Must equal the part of `stage` before ` · `. |
| `date` | `YYYY-MM-DD`, a real calendar date. The section takes a tab of its own after the days, ruled by date. Use it when a section runs longer than a week, where one weekday would mean two different nights — ACL Fest Nights runs Sep 29 to Oct 10, so "Fri" would be both Oct 2 and Oct 9. |
| `venue` | The room. The wall stacks the section's cards under it, in play order. Must equal the part of `stage` after ` · `, and wants an entry in `venues{}` so the card's place line opens a map. |

`night` and `date` are two different places on the screen, so an entry never
carries both, never neither, and one section's entries never disagree — the
validator errors on all three. The pre-2026-09-01 `stage: "Thu · Regency
Ballroom"` string answers both questions on its own and still does, so no
existing file has to be rewritten; `stage` also stays authoritative where it
is present, which makes `night`/`venue` a denormalization of it, and a
disagreement between them an ERROR.

A dated section carries its own range and its sub line in `dayMeta`, keyed
by the section's label:

```json
"dayMeta": { "Late nights": { "date": "Sep 29 – Oct 10", "sub": "around Austin" } }
```

A dated entry renders under its date, not under the section label, so one
artist playing two nights is two cards and one pick. Only the same name on
the same date is a duplicate.

**A venue-night is ONE ROOM, and its artists play IN SEQUENCE** (Kevin,
2026-09-01). The wall draws every room as a vertical run — stacked in the time
bands, each set its own tappable card, never side by side. So a room with two
or more shows needs to say who is on when; if it does not, the validator warns
(and names the shared start, because a time repeated on every act is a DOORS
time somebody transcribed into the set-time field). The run is recorded as
data, never guessed at render time (MODEL-V3 §5):

| Field | What |
|---|---|
| `time` | This set's start — the venue's, or our guess. |
| `approx` | `true` when that time is our guess, not the venue's. |
| `doors` / `close` | The room's window, each a single clock time (`"10 PM"`, never a range). |
| `closeApprox` | `true` when the CLOSE is our guess — `approx` scopes to `time` only, and the two are separate because a poster usually prints doors and not an end. |
| `order` | `{ seq, of, source, confirmed }` — position in the run (1…`of`), an `https` link to where the order came from, and whether the venue has posted it or it is still our read. |

The validator holds a run together: every set sharing a day + night + venue
must agree on `of`, `doors` and `close`, claim a distinct `seq`, sit inside
the window, and run in the same direction on the clock as in the numbering.
Never merge the sets into one card — artist separation is law, because a
combined card eats the crew's picks.

**Guessing the times and the order**, when the page prints neither:

- **A printed doors time goes in `doors`, never in `time`** — a show page
  prints doors, not a set, and a time in `time` reads as a set start. A room
  with one act may carry `doors`, a `close` and a guessed `time`, but no
  `order`.
- **The order follows the billing:** the billed headliner closes and the rest
  run in descending print. Record it as `order` with `confirmed: false` until
  the venue posts it.
- **The clocks are `node scripts/guess-run-times.mjs <id>`** — one rule, a
  dry-run diff, `--write` to record. For every room with an `order` it lays
  the bill from `doors` to the close (the printed close; else one a listing
  printed for that night, `closeApprox` with its https `closeSource`; else the
  venue's routine close from `data/venues/index.json`) and marks each guess
  `approx: true`. A set with a time and no `approx` is posted and never
  touched, so re-run it whenever a room or the registry changes. A show with
  no `time` at all is fine — it is a card with no clock in its venue's stack.
