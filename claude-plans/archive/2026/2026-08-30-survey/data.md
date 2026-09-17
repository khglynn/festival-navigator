# Dimension survey: festival data + its pipeline (2026-08-30)

Branch: `notes-desktop-round` (PR #13). Scope: `data/festivals/*`,
`scripts/validate-festivals.mjs`, `scripts/freeze-pick-keys.mjs`,
`tests/fixtures/live-pick-keys.json`, `js/festivals.js`,
`api/_lib/festival-rules.mjs`, `api/_lib/pick-keys.mjs`, `js/time.js`.

Ground truth checked: `npm test` → 274 pass / 1 skip, 0 fail.
`node scripts/validate-festivals.mjs` → 0 errors, 1 warning (Tomorrowland
Winter's expected empty lineup). Matches NOW.md's claim.

What this round (PR #13) actually touched in this dimension: two small,
already-Codex-gated diffs — `festival-rules.mjs` gained a control-character
check on artist names (`/[\x00-\x1f\x7f]/`), and `time.js`'s
`computeDayArtists` now carries `time`/`weekend` through on each resolved
artist for the new occurrence/zoom machinery to key off. Both read correct;
nothing to flag there. The real findings are in the festival DATA itself and
the small pieces of the pipeline nobody has re-touched since 2026-08-23/27 —
which is exactly what Kevin asked about.

---

## F-DATA-1 (P1) — Lost Lands' `dates` field is a 137-char run-on sentence built for no UI it actually appears in

**File:** `data/festivals/lost-lands-2026.json:7` and
`data/festivals/index.json` (the `lost-lands-2026` entry) — **byte-identical
strings**, confirmed with a diff:

```
"dates": "September 18–20, 2026 (main festival, Fri–Sun); a separately-billed \"Early Arrival\" pre-party runs Wednesday Sept 16 and Thursday Sept 17"
```

That's 137 characters. Portola's equivalent field is 21 (`"September
26–27, 2026"`). The only place this string renders is `.fest-row
.fest-dates` (`js/v3/tools.js:37` festRow, used by the F2 "pick your fests"
multi-select screen, and by `js/v3/settings.js:168` for Lost Lands whenever
it shows up as one of your OTHER boards) — and that class has a hard
`-webkit-line-clamp: 2` (`assets/v3.css:423-424`) with no exception for long
strings. At 10.5px in a row built for "September 26–27, 2026"-length text,
two lines hold roughly 80-100 characters. The clause that actually matters —
"...pre-party runs Wednesday Sept 16 and Thursday Sept 17" — sits past that
point and gets clipped. The pick-a-festival screen and the "your other
festivals" list both show a sentence that trails off mid-clause and never
delivers the one fact it was written to carry.

This is Kevin's own line verbatim: *"the lost lands description not getting
the cleaned up description for before/afters that we did to Portola."* It
also shows up as a second, separate gap in the underlying artist data: the
21 Early-Arrival pre-party performers (`lost-lands-2026.json:299-382`) carry
ONLY a `day` field (the same 44/43-char sentence fragment, e.g.
`"Wednesday, Sept 16 (Early Arrival Pre-Party)"`) — no `stage` (venue) or
`time` (hours) the way every one of Portola's 40+ Afters/Folsom entries
does (`portola-2026.json`, e.g. `{"name": "Black Rave Culture", "day":
"Afters", "stage": "Thu · Club Six", "time": "10 PM"}`). So today the
Early-Arrival section on the wall is two day-headers reading as full
sentences, over a list of bare names with no venue or set time at all —
compare to Portola's Afters cards, which carry a "Thu · Regency Ballroom /
8 PM" sub-label on every card.

**Field-by-field, what Lost Lands needs to match the Portola pattern
(same fields Kevin's question named — "afters" modeling):**

1. Shorten `dates` (both files) to the clean clause only:
   `"September 18–20, 2026 · Fri–Sun"` — drop the pre-party clause entirely;
   it moves to the section below.
2. Recast the two Early-Arrival days as an "Afters"-shaped section: keep
   `day: "Wednesday, Sept 16 (Early Arrival Pre-Party)"` (it's frozen — see
   the freeze fixture note below) but add `stage` (the venue, if the
   official page names one — often just "Legend Valley Campgrounds") and
   `time` to each of the 21 pre-party artists, exactly as Portola's Afters
   entries do, so the cards show a sub-label instead of a bare name.
3. Add a `dayMeta` entry per pre-party day with a short `date` (Portola's
   pattern: `"dayMeta": {"Afters": {"date": "Sep 24-27"}}`) — gives the
   day-rule strip a real short label to show instead of leaning entirely on
   the long `day` string.
4. `timezone`/`iso` are NOT required here — Portola's own Afters/Folsom
   sections skip both (no now-line on non-grid sections), so Lost Lands
   doesn't need them either unless a future Phase 2 adds real per-day set
   times to the 96-artist main bill (which the file's own `meta.note`
   explicitly says the official poster does not have: alphabetized, not
   ranked by day).
5. **Do this by editing the file, not by renaming the frozen day
   strings** — `tests/fixtures/live-pick-keys.json` already froze
   `"Wednesday, Sept 16 (Early Arrival Pre-Party)"` and
   `"Thursday, Sept 17 (Early Arrival Pre-Party)"` as day labels (real
   people may already have day-notes under them). Adding `stage`/`time` to
   existing artist objects is safe — it does not touch the frozen name/day
   strings.

## F-DATA-2 (P2) — ACL's set times are sitting ready to ingest; the renderer has been able to take them for a week and nobody has

**File:** `data/festivals/acl-2026.json` (`status: "lineup"`, no `days{}`,
no `timezone`, no `dayMeta`) + its own `meta.note`, last touched
2026-08-23 (`git log -1 --format=%cd -- data/festivals/acl-2026.json`).

Directly answers Kevin's *"idk if we ever built in / updated details for
seismic or acl"* — for ACL: **built, not dropped in.** The file's own note
says official set times for both weekends went live "the week of Aug 17"
(now 13 days ago as of today, 2026-08-30) and that "renderer/validator
support for the two-weekend scheduled shape shipped 2026-08-23... it is a
pure data drop now" — i.e. the code path (two-weekend `days{}` +
`weekend: W1/W2` tags, documented in `docs/add-a-festival.md`'s "Two-weekend
fests (ACL)" section) already exists and is tested
(`tests/scheduled-sections.test.mjs`, `tests/afters-events.test.mjs` both
pass today). What's missing is purely the transcription: someone with page
access to `aclfestival.com/schedule` (JS-rendered, so it needs a real
browser, not a search-snippet scrape) needs to paste the ~30-sets/day × 2
weekends grid into `days{}`. The note also flags one already-caught,
already-deferred loose end worth carrying forward: a single-sourced roster
move (Sienna Spiro → Fri W2, Laszewo → Sat W2, per theheartsounds.com
2026-08-17) that the note says explicitly to verify against the official
grid before applying — it has NOT been applied (checked: both names still
sit at their original slots). That's the file doing its job correctly
(flagging, not silently trusting one outlet) — not a defect, but worth
knowing when the ACL drop finally happens.

This matches NOW.md's own "Then:" line ("Seismic + ACL data on the Portola
pattern... `America/Chicago`, freeze pick keys the day people start
picking") — so this isn't a new discovery, it's a status confirmation with
the specific missing piece named: **the grid transcription is the only
remaining step; the timezone to use is `America/Chicago` (Austin, TX,
same as Seismic).**

## F-DATA-3 (P2, informational) — Seismic is correctly stale, not neglected

**File:** `data/festivals/seismic-9.json`, `researchedAt: "2026-07-07"`,
`announcementStatus: "lineup-only"` ("Phase One" — 33 billing lines, no
day/stage assignment at all). This is the OTHER half of Kevin's "idk if we
ever built in / updated details for seismic" question, and the honest
answer is: there is nothing to ingest yet. The file's own note cites the
2025/8.0 edition's precedent — Phase 2 (by-day split) landed ~Sept 19, about
8 weeks before that year's fest — and Seismic 9.0 is Nov 13-15, 2026, so a
2026 Phase 2 is not expected until roughly mid-September. Today is
2026-08-30, so this file is behaving correctly by staying `lineup`-only; it
just hasn't been re-checked in ~8 weeks (`researchedAt` is 54 days old).
Not a bug — flagging only so "we haven't touched Seismic" isn't read as
neglect. Worth a calendar nudge for a Phase-2 re-check in mid-September
(already implied by NOW.md's "Then:" line), same `America/Chicago` timezone
to use when it lands.

## F-DATA-4 (P2) — Portola's `dates` field disagrees with itself depending which UI reads it, and nothing catches the drift

**Files:** `data/festivals/index.json` (`"dates": "September 26–27,
2026"`) vs `data/festivals/portola-2026.json:7` (`"dates": "September
26–27, 2026 · doors 1 PM"`) — same festival, two different strings, and
BOTH are live in the running app depending on which surface reads them:

- `js/v3/app.js:184` (the wall header) and `js/v3/settings.js:82`
  (`currentFestCard`, the top card in Settings → Your festivals) read
  `state.fest()` → `js/state.js:93` → the fully-loaded
  `data/festivals/portola-2026.json` → shows the doors-time version.
- `js/v3/settings.js:168` (the "other boards" list just below it, for any
  OTHER (crew, fest) pair this device knows) and the F2 "pick your fests"
  screen (`js/v3/app.js:555` → `festRow`) both read `FESTIVAL_INDEX` →
  `data/festivals/index.json` → shows the no-doors version.

So on a device with two Portola boards (two circles, or Portola alongside
another fest), Settings shows "September 26–27, 2026 · doors 1 PM" in the
card at the top and "September 26–27, 2026" for the same festival two rows
down. Low real-world stakes (only the doors time is lost, and it's the less
common multi-board case) but it's a genuine single-source-of-truth gap: two
files carry the same fact with two different values and nothing — not the
validator, not `tests/docs-truth.test.mjs` — checks they agree. Two honest
fixes, either works: (a) put the doors clause in `index.json` too, so the
two files agree, or (b) accept that `index.json`'s `dates` is deliberately
the short form for list rows and stop also duplicating the long form
identically for fests like Lost Lands (see F-DATA-1) — right now the
convention is inconsistent even about which file is "the short one."

## F-DATA-5 (P2) — `defaultFestivalId()` trusts `index.json`'s array order, and nothing enforces that order

**File:** `js/festivals.js:84-87`:
```js
export function defaultFestivalId() {
  const active = FESTIVAL_INDEX.find((f) => f.status !== 'archived');
  return (active || FESTIVAL_INDEX[0]).id;
}
```
This is the fallback that decides which festival a brand-new device/session
lands on (`js/state.js:67`, `js/v3/app.js:1513`). It takes the FIRST
non-archived entry in `index.json`'s raw array order — not sorted by
`startsOn`. `docs/add-a-festival.md` and `data/festivals/README.md` both
tell a human/agent to "keep it ordered by date, archived last," but nothing
in `scripts/validate-festivals.mjs` checks that the array is actually in
that order — the validator only checks that each `startsOn` is a real date
(`validate-festivals.mjs:59-70`), never that the array's order matches it.
Right now the file happens to be correctly ordered (verified: ascending
`startsOn` for all 6 non-archived entries, most-recent-first for the 5
archived ones), so nothing is broken today. But the codebase already knows
better in one place and not the other: `js/v3/model.js`'s landing/Settings
sort (`sortKey`, ~line 201-209) computes order from `startsOn` directly and
is immune to array order — `tests/fest-first.test.mjs` even seeds its fixture
"deliberately NOT in date order" to prove that resilience. `defaultFestivalId`
has no such protection, and `tests/invite-context.test.mjs`'s own comment
says the quiet part: "seed it directly (ordered by date, like index.json —
first non-archived entry is the default)" — the test itself documents the
assumption rather than removing it. A future add that appends a
near-term festival at the end of the array (an easy mistake for an agent or
a rushed hand-edit) would silently misdirect every brand-new device to the
wrong "next upcoming" festival, with no test or validator catching it.
**Fix:** either add a validator rule asserting `index.json`'s non-archived
entries are ascending by `startsOn` (cheap, catches it at commit time), or
make `defaultFestivalId()` sort by `startsOn` itself instead of trusting
array position (removes the invariant instead of just enforcing it).

## F-DATA-6 (P3) — date-range punctuation is inconsistent across `index.json`

En dash (`–`) for Lost Lands, Portola, ACL, Tomorrowland Winter,
Lollapalooza; plain hyphen (`-`) for EDC Orlando, Seismic, Ubbi Dubbi,
Wicked Oaks, ACL 2025. Purely cosmetic, no functional impact, but visible
side-by-side in the same list (F2's fest-picker shows several of these
rows together). Worth a pass next time any of these files get touched
rather than a dedicated fix.

## Checked and clean (no finding)

- **Freeze fixture coverage:** every non-archived festival in `index.json`
  (`portola-2026`, `lost-lands-2026`, `acl-2026`, `edc-orlando-2026`,
  `seismic-9`, `tomorrowland-winter-2027`) has a `tests/fixtures/live-pick-keys.json`
  entry, matching `data/festivals/README.md`'s stated rule. No live festival
  is unfrozen.
- **`status` vocabulary vs. what it unlocks:** traced end to end.
  `lineup` → `js/v3/wall.js` `groupByDay`/`knownDaysOf` render the flat
  sortable list (day-less artists form "THE LINEUP" block, day-tagged ones
  get real day sections) — this is F4. `scheduled` requires non-empty
  `days{}` (enforced, `festival-rules.mjs:115-118`) and renders the
  stage-column grid — F5. `archived` skips the schedule-quality checks
  (`festival-rules.mjs:125`, since correcting old data would orphan real
  picks) and gets a muted "PAST" badge (`tools.js` `festRow`). All three
  read correctly against the code.
- **ACL 2026 lineup-phase data quality:** all 124 artists carry a
  `weekends` tag (`52 both / 36 W1 / 36 W2`), no artist's `day` string
  illegally suffixes "W1"/"W2" onto the day name (the documented
  anti-pattern) — clean.
- **`festival-rules.mjs` / `pick-keys.mjs`:** read whole. Rules are
  thorough and specifically defensive against the failure modes that have
  actually bitten this project before (control chars in names, case-only
  renames, stage-overlap slipped boxes, AM/after-midnight axis
  inconsistency, `constructor` as a festival id). The two lines this PR
  actually added (control-char check; `time`/`weekend` riding through
  `computeDayArtists`) are both correct and already Codex-gated per NOW.md.
- **`meta.note` fields are pipeline-only** — grepped every `js/` file;
  nothing renders `fest.meta` client-side. The extremely long research
  notes (Portola's is ~4,000 chars) are pure audit trail, never a UI risk.
- **Tomorrowland Winter's empty `artists: []`** is correct and intentional
  (no 2027 lineup announced anywhere as of research date) — the single
  validator warning it produces is expected, not a bug.
- **`npm test` / `validate-festivals.mjs`** both green on this branch,
  matching NOW.md's "Suite 274 pass / 1 env skip" claim.

## Skeptic

- **F-DATA-1 — CONFIRMED, P1 as stated.** Verified byte-identical: `data/festivals/index.json:8` and `lost-lands-2026.json:7` both carry the 137-char run-on `dates` string. `js/v3/tools.js:37-38` is the only place `f.dates` (or an equivalent joined `sub`) reaches the DOM, always via `subEl.className = 'fest-dates'`, and `assets/v3.css:423-424` clamps that class to 2 lines with no length exception anywhere. Confirmed the pre-party gap too: `lost-lands-2026.json` lines 299-382, all 21 pre-party entries carry only `"day"` (a sentence-fragment like `"Wednesday, Sept 16 (Early Arrival Pre-Party)"`), no `stage`/`time` — while every one of Portola's ~30 `"day": "Afters"` entries (checked `portola-2026.json:265-273` for two examples) carries both `stage` and `time` and gets the venue+time sub-label. One reinforcing point the reader didn't spell out: Settings' other-boards row (`settings.js:172`) builds `sub` by joining `meta.dates` with a pick-count/names suffix, and that joined string still gets routed through the same `fest-dates` class/clamp (`tools.js:38`) — so on that surface the picks-count suffix is what actually gets clipped off, an even worse outcome than the reader described for that one journey.

- **F-DATA-2 — CONFIRMED, P1 as stated.** `acl-2026.json:646`'s `meta.note` text matches verbatim what's quoted. `git log -1 --format=%cd -- data/festivals/acl-2026.json` → 2026-08-23; `status` is still `"lineup"` (line 9), no `days{}`, no `timezone` key anywhere in the file. Independently confirmed the "renderer/validator support shipped 2026-08-23" claim isn't just the note's own say-so: `git log --oneline --since=2026-08-20 --until=2026-08-25` shows commit `5521ff6 feat(schedule): two-weekend scheduled support — ACL's set-times drop is now a pure data drop`, and `api/_lib/festival-rules.mjs` genuinely has W1/W2 weekend-tag validation (lines 96, 144-180, 222-252) and dayMeta `isos: {W1, W2}` support. The finding's core claim — built, not dropped in — holds.

- **F-DATA-4 — CONFIRMED, severity right at P2.** `git grep '"dates"'` across `index.json` and `portola-2026.json` confirms the split: index has `"September 26–27, 2026"` (line 18), the full file has `"September 26–27, 2026 · doors 1 PM"` (line 7) — and this is the ONLY dates mismatch in the whole catalog (checked programmatically: every other fest's index `dates` byte-matches its full-file `dates`, Lost Lands included). Traced both consumers as claimed: `settings.js:70-71`'s `currentFestCard` reads `state.fest()` (→ `state.js:93` → the full file, doors clause shows), while `settings.js:168-172`'s other-boards list and `app.js:555` (F2 pick screen, via `festPickRow`→`festRow`) both read `FESTIVAL_INDEX` (no doors clause). Cosmetic-but-real inconsistency, P2 is fair — it's a policy gap (nothing enforces the two files agree), not a functional break.

- **F-DATA-5 — CONFIRMED, but the severity undersells what's ALREADY visibly broken (see Missed).** `js/festivals.js:84-86`'s `defaultFestivalId()` is exactly `FESTIVAL_INDEX.find(f => f.status !== 'archived') || FESTIVAL_INDEX[0]` — raw array-position, no `startsOn` sort. `scripts/validate-festivals.mjs` (76 lines, read whole) only checks `startsOn` is a real round-tripping ISO date (lines 59-70), never that array order agrees with it — confirmed no ordering assertion exists anywhere in the validator or `festival-rules.mjs`. `tests/invite-context.test.mjs:23-24`'s comment does say "ordered by date, like index.json — first non-archived entry is the default," matching the reader's read. And `model.js`'s `landingPairs` (lines 198-227) genuinely computes its own sort key from `startsOn` via plain string comparison, independent of array position — confirmed against `tests/fest-first.test.mjs`'s deliberately-scrambled fixture (line 10: "Deliberately NOT in date order — the sort must come from startsOn"), which passes. So the finding's mechanics are exactly right. P2 is reasonable for `defaultFestivalId()` in isolation (today's data happens to be correctly sorted, so it's a latent-only risk there) — but see Missed below for a second, currently-live instance of the same root cause that the reader's fix doesn't cover.

- **F-DATA-3 — CONFIRMED, P3 as stated (a "no bug" finding is correctly the low-severity option).** `seismic-9.json` meta (lines 111-122) matches verbatim: `researchedAt: "2026-07-07"`, `announcementStatus: "lineup-only"`, and the note's own reasoning — "for the 2025/8.0 edition, Phase 2 + by-day split landed ~Sept 19, ~8 weeks before the fest, so a 2026 Phase 2 is plausible around Aug-Sept 2026 but has NOT happened yet as of 2026-07-07" — genuinely supports "not yet due today (2026-08-30), check back in 2-3 weeks" rather than "neglected." No artist in the file carries day/stage/time, consistent with Phase-One-only. Correct read.

- **F-DATA-6 — CONFIRMED, P3 as stated.** Verified directly in `index.json`: en dash (`–`) on lost-lands (8), portola (18), acl-2026 (28), tomorrowland-winter (58), lollapalooza (108); plain hyphen (`-`) on edc-orlando (38), seismic-9 (48), ubbi-dubbi (78), wicked-oaks (88), acl-2025 (98). Purely cosmetic, nothing downstream parses this field for anything but display — P3 is right.

### Missed

- **`js/v3/app.js:591-599` (F2 "Add festivals" screen) has the SAME unenforced-array-order dependency as F-DATA-5's `defaultFestivalId()` — and unlike that one, it is already visibly broken today, not just latent.** Both the upcoming-fests list (line 591: `FESTIVAL_INDEX.filter(x => x.status !== 'archived')`) and the "Past festivals" disclosure fold (line 598: `.filter(x => x.status === 'archived')`) render rows by iterating `FESTIVAL_INDEX` in raw file order — no `.sort()` call anywhere in `renderCreate()`, and `disclosureFold` (`tools.js:67-83`) just appends rows in the order `buildRows` hands it, no sort inside either. The non-archived block in today's `index.json` happens to be hand-sorted ascending by `startsOn` (Lost Lands 09-18 → Portola 09-26 → ACL 10-02 → EDC 11-06 → Seismic 11-13 → Tomorrowland 2027-03-20), so that half renders correctly by luck — exactly F-DATA-5's point. But the **archived block is NOT sorted**: file order is Electric Forest (`startsOn: 2026-06-25`) → Ubbi Dubbi (`2026-04-24`) → Wicked Oaks (`2025-10-25`) → ACL 2025 (`2025-10-03`) → Lollapalooza (`2025-07-31`) — an already-scrambled sequence (Electric Forest, the most recent of the five, listed FIRST; Lollapalooza, the oldest, listed LAST). So today, on this branch, opening "Past festivals" on the F2 create screen shows archived fests in a genuinely wrong order (not most-recent-first, not chronological at all), while `model.js`'s `landingPairs`-driven surfaces (Settings' other-boards list) show the same festivals correctly sorted via their own `startsOn`-based key. This means the reader's proposed fix ("make `defaultFestivalId()` sort by `startsOn` itself") is necessary but not sufficient — `app.js`'s `renderCreate()` needs the same treatment, and a validator ordering-assertion would catch both at once. Worth folding into F-DATA-5 rather than filing separately, since it's the identical root cause with a live symptom the reader's evidence trail didn't reach.

- **No other index/full-file field mismatches exist beyond the two already reported.** Ran a full programmatic diff of `name`/`accent`/`location`/`year`/`status`/`dates` between every `index.json` entry and its corresponding full festival file — the only disagreement anywhere in the catalog is Portola's `dates` (F-DATA-4). Confirms the reader's data-pipeline read didn't miss a broader mismatch pattern; worth stating since the two dates findings (F-DATA-1, F-DATA-4) could read as "this happens a lot" when it's actually isolated to these two fests for two different reasons (run-on prose vs. an added doors clause).

- **All 13 `index.json` entries have a corresponding full file** (`ls data/festivals/*.json` — nothing missing), all sample weekday math in the `dates` strings checks out against the actual calendar (Lost Lands "Fri–Sun" for Sept 18-20 2026, EDC "Friday-Sunday" for Nov 6-8 2026, Seismic "Friday-Sunday" for Nov 13-15 2026, Portola's Sept 26-27 2026 is actually Sat-Sun despite no day-name being claimed) — no additional data-quality defect there worth flagging.
