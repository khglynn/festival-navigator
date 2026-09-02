# Events build — Phase 1 (data model) — PROGRESS

*Branch `events-data`, cut from `notes-desktop-round` (c8542a2). Additive data
restructure only: no renames, the running app unaffected. Spec:
`claude-plans/2026-08-31-events-canvas/MODEL-V3.md` §1 (frozen-key law),
§5 (back-to-back runs), §6 (sizing). Append one dated line per step — if this
session dies, this file is the resume.*

## Log

- 2026-09-01 — branch `events-data` created from `notes-desktop-round` (c8542a2) in worktree `agent-a5951905ab8d0ae25`. Read MODEL-V3.md, portola-2026.json, festival-rules.mjs, validate-festivals.mjs, pick-keys.mjs, live-pick-keys.json, portola-2026.test.mjs, afters-events.test.mjs, wall.js (`extraSectionsOf`/`renderLineupGroup`), festivals.js.
- 2026-09-01 — GROUND TRUTH established before touching data:
  - 45 event entries (day `Afters` 37, `Folsom` 7, `Afters & Folsom` 1). Every one carries `stage` as `"<Night> · <Venue>"`; the renderer (`js/v3/wall.js` `renderLineupGroup`) splits on `' · '` — first bit night, rest venue. So `night`/`venue` duplicate a string the renderer already parses: additive, and the current UI keeps working untouched.
  - The freeze fixture (`tests/fixtures/live-pick-keys.json`, portola-2026, frozenAt 2026-08-27) holds all four Midway names (MGNA Crrrta, horsegiirL, VTSS, Two Shell) and the day labels `["Afters","Afters & Folsom","Folsom","Saturday","Saturday & Sunday","Sunday"]`. `frozenKeyProblems` freezes NAMES and DAY LABELS only — never times. Confirmed by grep: no test in the suite asserts an afters `time` for any of the four (`tests/portola-2026.test.mjs:66` asserts horsegiirL's *Sunday grid* time — a different entry, untouched).
- 2026-09-01 — SOURCE CHECK before entering guessed data (AXS event 1575408, scraped 2026-09-01, HTTP 200):
  - `Doors Open — Sun Sep 27, 2026, 10:00 PM` is printed and labelled DOORS. So `doors: "10 PM"` is SOURCED, and it explains why all four Midway entries already read "10 PM" — the file had transcribed the doors time into the set-time field.
  - **No close/end time is stated** on the AXS page or on portola-week. `close: "2 AM"` is OUR GUESS (four DJs, 10 PM doors, California last call). It ships marked `closeApprox: true` so the data never claims a source it does not have.
  - **Unsettled, for Kevin:** AXS bills the show as **horsegiirL** "with VTSS, MGNA Crrrta (DJ Set), Two Shell", poster image filed `horsegiirl-vtss-mgna-crrrta-two-shell`. On a "with" billing the title act usually CLOSES — which would put horsegiirL 4th, not 2nd. Kevin's poster re-read (Two Shell closes) is what shipped, entered as given and flagged `confirmed: false`. Changing it is one edit to `MIDWAY_RUN` in the migration script plus a re-run.
- 2026-09-01 — `scripts/migrate-portola-events.mjs` written and RUN. 45 event entries got `night`/`venue`; the Midway four additionally got guessed `time`, `approx`, `doors`, `close`, `closeApprox`, `order`. Script refuses to write if any name or day label moved. Idempotent (a second run reports "Already migrated — nothing to write"). `data/festivals/portola-2026.json` round-trips through `JSON.stringify(_, null, 2)` byte-for-byte, so the diff is exactly the added lines: 140 insertions, 10 deletions (the 10 are the four rewritten `time` values and their neighbours).
- 2026-09-01 — FIELD SHAPE settled (see PR body for the full rationale): flat `night`, `venue`, `approx`, `doors`, `close`, `closeApprox`, and nested `order: {seq, of, source, confirmed}`. `closeApprox` is the one field not in MODEL-V3 §5 — added because the close is a guess and the spec's own promise ("the venue's real window, so no invented clock in the zoom") would otherwise be broken silently.
- 2026-09-01 — validator teeth landed in `api/_lib/festival-rules.mjs` (`checkEventFields`, called from `validateFestivalDoc`). Rules: night in the weekday vocabulary; venue non-empty and ≤80; **night/venue must AGREE with `stage`** (error — the pair is a denormalization and drift is the whole risk); venue missing from `venues{}` is a warning (it only costs the map door); approx/closeApprox boolean; approx needs a time; closeApprox needs a close; doors/close a single clock time (not a range) that parses; close after doors; the set time inside [doors, close]; `order` shape (of ≥ 2, seq 1..of, https source, boolean confirmed). Cross-entry, grouped by day+night+venue: one `of`, no duplicate seq, doors/close agree across the room, and the clock must not contradict the numbering. Probed all 18 negative cases by hand — every one fires. `node scripts/validate-festivals.mjs`: 11 files, 0 errors, 1 pre-existing warning (empty Tomorrowland lineup).
- 2026-09-01 — `tests/portola-events.test.mjs` (new sibling of portola-2026.test.mjs, 38 tests). A sibling and not an extension because portola-2026.test.mjs pins the POSTER's invariants and imports `js/v3/card-facts.js`, which another agent is editing this session — different ground truth, and no merge conflict. It pins: the frozen-key law (via `namesAndDays`, exported from the migration script so the CLI guard and the test compare the SAME thing); a full round-trip (strip the migration off the shipped file, re-run the transform, get the shipped bytes back); idempotence; the §5 shape on all four Midway sets; the run inside its window with the clock agreeing with the numbering; grid entries untouched; 21 validator rejections; the venue-map warning; and the wall still rendering every event card.
- 2026-09-01 — MUTATION-TESTED my own tests (four mutants, all caught): dropping `night` from one event (3 fail), slipping a guessed time to 11:30 PM (4 fail), flipping `order.confirmed` to true (3 fail), and commenting out `out.venue = venue` in the transform itself (3 fail). The first attempt at mutant 1 was a FALSE PASS — `artists.find(a => a.name === 'Soulwax')` hits the Saturday grid billing, not the afters entry, so the delete was a no-op. Same trap broke two tests on their first run. **Rule for phase 2: in Portola, a name can be TWO artists[] entries (a grid billing and an event); never look one up by name alone.**
- 2026-09-01 — SW STAMP: not needed, and the brief's claim needs one correction. Per-festival JSONs live in `DATA_CACHE` (network-first, outside the version-keyed shell), so they are outside `ASSET_STAMP` — but **`/data/festivals/index.json` IS in APP_CORE**. This change touches only `portola-2026.json`, so the stamp is untouched and `tests/app-shell-complete.test.mjs` passes. If a future data change edits index.json (a new festival), that one DOES need `node scripts/sw-stamp.mjs`.
- 2026-09-01 — `docs/add-a-festival.md` gained an "Event fields" section (the two tables + the run rules), so a future data session learns the fields without reading a plan doc. `data/festivals/portola-2026.json`'s `meta.note` and `meta.sources` now carry the same provenance in the data itself (the migration appends it, idempotently).
- 2026-09-01 — GREEN: `node scripts/validate-festivals.mjs` = 11 files, 0 errors, 1 pre-existing warning. `npm test` = 355 tests, 354 pass, 1 skipped (pre-existing), 0 fail. Baseline before this branch was 317/316.
- 2026-09-01 — SHIPPED to a draft PR: https://github.com/khglynn/festival-navigator/pull/15 (base `notes-desktop-round`). Two commits — `3735e07` (data + migration script + docs + this log) and `894f85d` (validator rules + tests) — each green on its own, so history bisects. CI green in 40s: `npm test` 355/354 pass, the same again under `TZ=Asia/Tokyo`, and `node scripts/validate-festivals.mjs` clean. Vercel preview + staging both pass.
- 2026-09-01 — PHASE 2 (the UI) consumes: `night` → day tabs (union of grid days and event nights) + per-day section grouping; `venue` → the column set and the `venues{}` map door; `approx` → the tilde on the resting card plus ONE section-level whisper; `doors`/`close` (+`closeApprox`) → the zoom's `Sun · Runs 10 PM – 2 AM`; `order` → `Guessing they're 3rd of 4` as a door to `order.source`, losing the word "Guessing" when `confirmed` flips. §2's layout rule (E/V/R/T) is computable from `night` + `venue` + `time` with no prose parsing. Nothing in phase 1 changed a section, a tab or a card's shape — `renderWall` still emits SATURDAY / SUNDAY / AFTERS / FOLSOM.
- 2026-09-01 — MIDWAY ORDER FLIPPED (Kevin's decision): the ticket vendors (AXS event 1575408, Tixr) bill the Sunday Midway show as "horsegiirL with VTSS, MGNA Crrrta, Two Shell" — by Kevin's own rule the billed headliner closes, so `MIDWAY_RUN.sets` in `scripts/migrate-portola-events.mjs` reordered to MGNA Crrrta (seq 1, 10 PM, opens — unchanged), VTSS (seq 2, 11 PM), Two Shell (seq 3, 12 AM), horsegiirL (seq 4, 1 AM, closes). `confirmed: false` kept as-is (Kevin's call — still a data-entry read of two ticket pages, not a venue-issued time). Re-ran the migration: `git diff --stat` on `data/festivals/portola-2026.json` touched ONLY the three moved entries' `time` + `order.seq` (MGNA Crrrta needed no edit, it was already right); `name`/`day`/`stage` byte-identical, frozen-key guard green (108 names, 6 day labels untouched). Also checked for a "Kavari" name during the AXS/Tixr re-read: it turns up in a stale Tixr URL slug for this show but is NOT on the live bill (verified 2026-09-01) — not added, four sets stays four sets. Updated in step 2, separately from the migration run (so the entry diff above stayed clean): the script's `MIDWAY_RUN.sets` inline comments, the "UNSETTLED" block comment (now "ORDER, RESOLVED"), `META_NOTE`, and `data/festivals/portola-2026.json`'s `meta.note` (hand-replaced the old META_NOTE substring with the new one, so the migration stays idempotent) — all now read RESOLVED instead of flagging the AXS-vs-poster conflict, and record the Kavari finding. `tests/portola-events.test.mjs`'s seq/name/time table and the wall-render assertions updated to the new order, no assertion weakened. `npm test`: 355/354 pass, 1 pre-existing skip (same as baseline). `node scripts/validate-festivals.mjs`: 11 files, 0 errors, 1 pre-existing warning (Tomorrowland).

## Phase 2 — the day-first UI (branch `events-ui`, cut from `origin/events-data` 7a9bd32; PR base `main`)

*Fable teammate, 2026-09-01. Append one dated line per step; this file is the resume.*

- 2026-09-01 — branch `events-ui` created from origin/events-data in worktree `agent-a5d8b3d0ffdc99ed3`. Read in full: CLAUDE.md, MODEL-V3.md, build-v3.mjs + build.mjs (the design of record), phase-1 PROGRESS, portola-2026.json (45 events, the Midway run), migrate-portola-events.mjs, festival-rules.mjs, wall.js, app.js, filters.js, card-facts.js, time.js, now.js, overlap.js, aura.js, v3.css, v3-tokens.css, gallery.html, service-worker.js, sw-stamp.mjs, and every test that pins the wall's shape (wall-dom, afters-events, scheduled-sections, portola-2026, portola-events, wall-filters, now-line, two-weekend, day-image-sections, zoom-overlay). Baseline `npm test`: 355 tests, 354 pass, 1 skipped (pre-existing).
- 2026-09-01 — Coordinator correction received: the Midway run stays FOUR sets (Kavari was a stale ticket slug); only the ORDER changes on events-data (MGNA Crrrta 10, VTSS 11, Two Shell 12, horsegiirL 1 AM closes). Nothing here hardcodes the count, the names or the order; `git pull origin events-data` before finishing.
- 2026-09-01 — DESIGN DECISIONS taken before code (the spec is the floor; each of these is a place it was silent or fought the code):
  - **Scope of day-first.** The composition runs for a fest that has at least one section entry carrying a night (`night` field, or a `stage` whose first ` · ` bit is in the Mon…Sun vocabulary). Grid-only and section-less fests (EDC, Seismic, ACL, Lost Lands) take the EXISTING code path untouched — that is how "byte-for-byte as today" is guaranteed rather than hoped. Lost Lands WED is already a day rule + a wall-grid (tiles); the rule computed on it says tiles (E=0), pinned by a test. A fest whose day keys cannot all be placed on one weekday axis (two keys on one weekday, or a key like "Day 1") also falls back — the union of grid days and nights needs a common axis.
  - **Lineup fests get day-first too** (Portola spends weeks as a lineup fest before set times drop): in the grouped sorts (billing / day) each day renders its billing tiles as the fest's room, then its sections. The flat sorts (A → Z, my picks, most picked) keep today's flat list, where the old two-line "night · time / venue" sub-label still carries the night because no day implies it.
  - **New day keys** for night-only days are the full weekday name (`Thursday`, `Friday`) — additive under the frozen-key law, and the spelling a future grid day would use. Section notes stay keyed to the section (`Afters`): the ✎ chip on the section sub-rule points there on every day; the section's newest-note whisper shows under the FIRST day the section appears (once per scroll, not four times).
  - **Day order:** weekdays are placed relative to the first grid day (or first known day): up to three days before it read as "before", the rest follow — Thu Fri Sat Sun for Portola, Wed…Sun for a pre-party, Fri Sat Sun Mon for a Monday afterparty. Night-only days derive their date from any grid day's `iso` (THURSDAY · Thu · Sep 24) and carry `data-iso`, so the day-of open and the now line work on them.
  - **The fest accent stays in its four homes.** The canvas mocked bucket chips and the deck panel title in `--fest`; the build uses `--brand` for both (CLAUDE.md's rule with teeth). Venue heads on an events timetable ARE stage headers, so they keep the accent.
  - **Sticky strips scope per timetable** (`.tt-block` wrapper; position:sticky is bounded by its parent), each timetable is its own scroll-sync group (`data-sync`), and the main grid keeps its own group across days. In day-first mode `--jump-offset` drops the strip height (no strip sits above a day rule any more).
  - **Event time axis** is `activityMinutes` (time.js), not `timeToMinutes`: the Folsom Street Fair at 11 AM must sort at the top of Sunday, and `timeToMinutes` reads every AM as after-midnight.
  - **Open-ended events** ("10 PM") draw one hour (the canvas rule), not the main grid's next-set fill (which turns two 10 PM shows into two 30-minute slivers). A run member's end is the next member's start, and the last member's is `close`.
  - **The deck's face is not a pick.** A tap anywhere on the deck opens the panel; the face card is rendered through an inert ctx (no tap, no hover zoom, no long-press) and stays inert through `refreshCard`. Every card in the panel is a full wall card — pickable, zoomable, notes chip and all. The panel lives in a fixed layer INSIDE #wall-root so app.js's per-artist refresh reaches its cards, and a repaint restores an open deck the way it restores a zoom.
  - **Scroll does not close the deck panel.** The spec (written 08-31 morning) said "scroll puts it away like the zoom"; the zoom itself moved past that the same day (a 1px trackpad jiggle was killing it). The panel follows its deck and closes only when the deck leaves the viewport — the zoom's current law.
  - **Motion constants** live in a new `js/v3/motion.js` (the deck and the bucket toggle import them). card-facts.js's zoom keeps its own copies BELOW the banner I may not touch (PR #14 is editing there); a test pins that the two files agree, and the one-line follow-up after #14 lands is to make card-facts import them.
  - **The zoom's WHEN for a run member** is one `.f-sub.f-stack` element holding two lines (`Sun · Runs 10 PM – ~2 AM` then the order door) rather than two `.f-sub` siblings: the zoom's cascade and its refresh bookkeeping key on ONE `.f-sub`, and two siblings would collide in `partKey` — all without touching the mechanics. The tilde on the close is how `closeApprox` reads.
  - **Event columns are capped** at `minmax(150px, 240px)`: a two-venue Thursday must not become two 600px cards (the round-2 README's complaint); the strip shares the template so heads stay over their columns.
  - **Bucket toggles are a small event:** hiding fades the room out (opacity + a 4px lift, OUT_MS) before the repaint; showing lets the room arrive after it (CASCADE_MS, staggered). Instant under Low Power / reduced motion.
  - **Out of scope, noted:** the Day Image exporter (tools.js) still offers grid days + sections, not the day-first days — nothing breaks, and its test still pins that; a follow-up once Kevin decides what a "Thursday" image should hold.
- 2026-09-01 — BUILT `js/v3/events.js` (pure model: nightOf/venueOf/occOf, parseEventTime on the festival-day axis, earnsColumns + sectionModeOf, dayOrderKey, eventModelOf, timetableOf with lanes/deck/run, runFactsOf + ordinal, findEventEntry, sortForTiles), `js/v3/motion.js` (the shared constants + canAnimate), bucket persistence in `js/v3/filters.js` (`fn_buckets_v1_<fid>`, memory-first, blocked-store safe). Tests: `tests/events-model.test.mjs`, `tests/motion-shared.test.mjs`.
- 2026-09-01 — BUILT the wall: `wall.js` gained `dayFirstModelFor` / `dayNavOf` / `renderDayFirst` (rooms per day under `.sec-head` sub-rules, `.room[data-bucket]`), `renderEventsTimetable` (venue strip per `.tt-block`, capped columns, TIME TBA, the approx whisper), `renderEventTiles`, `bucketRow` + `hiddenWhisper`; `renderScheduledDay` split into header + `renderScheduledDayBody({strip})`; `renderLineupGroup` split into header + `renderCardGrid`; scroll sync + ephemera harvest grouped by `data-sync`; `refreshCard` keeps a deck face inert. `js/v3/deck.js` (the deck cell + the grown panel in a fixed layer inside the wall root; Escape/outside/leaving-viewport close; snapshot/restore). `card-facts.js` facts layer only: `factsFor` reads the run through `findEventEntry` (never by name), WHEN becomes the window, `grownBlock` renders one `.f-sub.f-stack` with `.f-when` + `a.f-order`. `app.js`: `bucketsOff` in ctx, `toggleBucketFlow` (rooms leave then repaint; arrive after), `renderDayNav` reads `dayNavOf`, `repaintWall` restores an open deck before the zoom, `measureStickyChrome` drops the strip height when strips are scoped. CSS block appended to `assets/v3.css` (brand tint on chips and the panel, never the accent); `.bucket-chip` joins the touch-floor opt-out list. APP_CORE lists events.js, deck.js, motion.js.
- 2026-09-01 — TESTS re-pinned to the new truth (each keeps its intent): afters-events (day-first lineup wall + the flat sort keeps the two-line label), portola-2026 (THU FRI SAT SUN; grid cells scoped to the fest room; the Friday afters Despacio is tall too), portola-events (the run is a vertical column — data-driven, no names), scheduled-sections (rooms per day), wall-filters (Afters DIMS as a clock; Folsom hides per room; solo touches grid strips only, venue heads are DIVs). New `tests/events-wall.test.mjs` (13 tests: composition, scoped strips + sync groups, TBA, untouched paths, buckets, the deck at rest/grown/keyboard/snapshot, the run's WHEN + door, a run in tiles). Smoke-rendered Portola in jsdom and eyeballed every day (`scratchpad/smoke.mjs`): matches the approved frames.
- 2026-09-01 — GREEN before the stamp: `npm test` = 388 tests, 386 pass, 1 skipped (pre-existing), 1 fail = the SW stamp (stamped last, on a clean tree, by the brief's rule). `node scripts/validate-festivals.mjs`: 11 files, 0 errors, 1 pre-existing warning. Gallery: `gallery.html` gained "THE EVENTS — day-first, live" (renderWall on a fixture fest holding every state; deck, run, buckets all live). README structure block + docs/add-a-festival.md updated.
- 2026-09-01 — REBASED onto origin/events-data 415aff1 (horsegiirL closes the Midway run). Two conflicts, both mine to resolve: the phase-1 wall test's block (kept the data-driven day-first version — it reads seq/time from the file, so the flip needed no edit) and this file's append point (kept both). Smoke render after the rebase: MGNA Crrrta ~10 PM, VTSS ~11 PM, Two Shell ~12 AM, horsegiirL ~1 AM — the code followed the data.
- 2026-09-01 — SELF-REVIEW found two real bugs before the stamp, fixed in 1ec90a8: (1) a search render clears #wall-root without repaintWall's snapshot/restore, leaving the deck module's `open` pointing at detached nodes — the next sync-echo repaint would have re-opened the deck uninvited; renderWallInner now closes the deck instantly before clearing (pinned in events-wall). (2) the events gallery called activateCrew and replaced the crew doc the zoom gallery renders from; it now joins that doc.
- 2026-09-01 — STAMPED last on a clean tree (f5a80b7, v71 → v72, stamp d8990cf6 → 45a8e5c1). `npm test` = 388 tests, 387 pass, 1 skipped (pre-existing), 0 fail. NOTE for the merge: PR #14 also bumps v71 → v72; whichever merges second re-runs `node scripts/sw-stamp.mjs`.
- 2026-09-01 — SHIPPED to a draft PR: https://github.com/khglynn/festival-navigator/pull/16 (base main). Commits on top of 415aff1: 6ae5703 (the events model + motion + bucket persistence, 19 tests), 274b7d2 (the day-first wall, the deck, the run's WHEN, app wiring, CSS, SW core, 5 suites re-pinned + events-wall 13 tests), de64e29 (gallery + README + docs + this log), 1ec90a8 (the two self-review fixes), f5a80b7 (the stamp).
- 2026-09-01 — WHAT THE WALKER MUST CHECK (real pointer input, phone then laptop, the PR body's numbered walk is the script): the deck's bloom and recede at ×4 slow motion and under Low Power; a trackpad micro-scroll with a panel open (it follows, never dies); a touch HOLD on a Midway card (the two-line WHEN, the order door opens the poster without picking); the bucket chips' fade-out then arrive, and that a hidden bucket survives a reload; the sticky venue strip inside each timetable on a long Friday scroll (leaves with its block; the Pier 80 strip never sits over an afters clock); THU/FRI day-tab jumps landing under the rail; that Lost Lands / ACL / EDC look exactly as before; the coarse-pointer 44px floor on the bucket chips and the deck.

### Review round (2026-09-01) — Codex + four Opus lenses with skeptic repros + a real-input walk

- 2026-09-01 — origin/events-data was still 415aff1 (already rebased onto it); nothing to rebase. 19 findings consolidated by the coordinator; worked in five groups, one commit each, a test with every P1, suite green after each group, the stamp last on a clean tree.
- 2026-09-01 — `675243e` THE DECK (P1 1, 2, 3, 4, 6; P3 15; the deck half of 8). The deck answers the people filter as one object (`deckPasses` / `.deck.dim`; the face is rendered through a filter-less ctx; `refreshDeckState` re-runs on a face refresh; the pile's pick state rides the aria-label). `wall.js cardFor()` is the one restore lookup (app.js + the gallery) and never returns a face — the preview-confirmed "every further tap does nothing". Escape yields to a sheet above (`#artist-sheet` / `.sheet-backdrop`). Focus goes home only for Escape / ✕ / a second tap, always `{ preventScroll: true }` (the scroll-away close had yanked the page back, confirmed in Chromium). `place()` reads offsetWidth/Height. The snapshot carries the focused card. The pill / name / panel title carry the tilde. Seven tests.
- 2026-09-01 — `c4f05e4` THE BUCKETS (P1 5; P2 10; P3 18). `filters.js applyBucketToggle` lands the setting in memory + storage before anything animates; app.js flips the chip's aria-pressed at once. Unknown stored keys are ignored on read and never named in the whisper. `memoryWins` after a write that did not land. Three tests.
- 2026-09-01 — `4ffe862` THE MODEL (P2 7, 11, 12; P3 16). `peakConcurrency()` decides the deck (a bridge chain is two lanes). `timetableOf` returns `loose` (timed, no venue) and the wall tiles it under VENUE TBA with its time. Only `seq === of` runs to the close; a member whose numbered successor is missing draws the hour. A night with nothing for the clock renders as tiles. Four tests.
- 2026-09-01 — `65f1cba` COPY + LABELS (P2 8, 9, 13). `lineupSubLabel` wears the tilde and `renderLineupGroup` adds the whisper when a list holds a guess (search results, flat sorts). Whisper = the locked copy, no period; the tilde on a guessed close and the curly apostrophe KEPT and written into MODEL-V3 §5's build notes (with §4's peak rule). `dayHeader({ dayKey })` shows a verbose key's weekday head. Three tests.
- 2026-09-01 — `fd51cf8` THE DAY IMAGE (P2 14). Contained: `tools.js` asks `dayFirstModelFor` at the device's weekend; choices = the tabs' days; a day exports the grid (stage · start), the billed-but-untimed, then each section's shows as `section · venue · time` with the tilde. Test re-pinned.
- 2026-09-01 — LEFT AS IS, with reasons: 17 (whisper once per night-room, not per section — a day tab lands mid-page, so a whisper on another day is invisible; "once, not per card" holds); 19 (HMD's "Afters & Folsom" is one occurrence in two rooms, as the pre-day-first wall rendered it — one pick key; the skeptic refuted it as a defect too).
- 2026-09-01 — GREEN: `npm test` = 403 tests, 402 pass, 1 skipped (pre-existing), 0 fail after the stamp (v72 → v73, stamp 45a8e5c1 → 3d350337, its own last commit). `node scripts/validate-festivals.mjs`: 11 files, 0 errors, 1 pre-existing warning. No browser driven; the walker's list from the first push still stands, plus: the deck under a people filter (lit whole / dimmed whole), a pick on a panel card followed by a sync echo (the grown card must still pick), Escape with a notes sheet over a panel, a scroll-away close (no page jump), two chips tapped fast.

### Round-2 walk (2026-09-01, v73) — the last P1

- 2026-09-01 — PASS from the walk: the deck × people filter, scroll-away without a jump, two fast chip taps surviving a reload, the tilde in search, the panel zoom's notes chip over the open deck, no page errors. ONE P1 live: "picks on a panel card do not advance after the first tap".
- 2026-09-01 — REPRODUCED the exact sequence in jsdom with app.js's handleTap / applyLocalPick / refreshCtx / refreshArtistCards / repaintWall mirrored (`scratchpad/repro-pick.mjs`): it cycles 1 → 2 → 3 → 4 → 0. So the cause is the real page's geometry. The rig (`claude-plans/2026-09-01-walk-rig/walk-events.cjs` L105–111) computes ONE target — the centre of `.zoom-card` — and clicks that coordinate for every follow-up. Arithmetic on the real CSS (name 22 · sub 14 · where 14 · chips 17 in a 132 px box): before the first pick the centre (y≈66) falls in the gap under the time → a pick; after it the `You` row arrives, the zoom re-centres content ~13 px up, and y≈66 lands on `Regency Ballroom` — `a.f-where`, a map DOOR whose click stops (placeDoor, 08-31) and opens a new tab. No pick, no error, the overlay stays. On the wall the rig clicked a grid card (venue = plain text) so it kept picking. NOT the deck, NOT the hover machinery — any card with a `venues{}` door (afters / Folsom tiles too) did this; a person resting the cursor mid-card after a pick would hit it.
- 2026-09-01 — FIXED in `171bb1d`: the grown card's who-row is ALWAYS rendered (`grownBlock`, the facts layer — above the banner) and the zoom reserves it at pill height while empty (`.zoom-card .f-who:empty { min-height: 20px }`), so the first pick lands pills in a row that already exists and no row above it moves; the sheet header hides the empty row (`display: none`) and keeps its look; the door keeps its job. Test: the walk's real sequence in jsdom (hover intent timer → overlay click → echo repaint → four clicks) with the overlay's rows pinned identical before and after every pick, both occurrences following, and the door never picking. NOTE FOR THE RIG: the overlay's centre now meets the venue door on the FIRST click (the venue line sits mid-card from frame one, visibly) — aim at `.f-name`, which is what a person clicks.
- 2026-09-01 — STAMPED v73 → v74 (7038bac3), its own last commit. `npm test` = 405 tests, 404 pass, 1 skipped (pre-existing), 0 fail.
- 2026-09-01 — REVERTED the reservation in `d8e9600` (stamp v74 → v75 in `bfe5779`). The coordinator's screenshot of the preview: every UNPICKED grown card carried a hole — on "Black Rave Culture" (Thu · 10 PM · Club Six) ~34 px of nothing between the venue door and "+ note" (the reserved pill height plus the two flex gaps around it). Most cards are unpicked, so that was the common view, and it read as broken space. The designed event is the pre-reservation one (CLAUDE.md: a pill arriving after a tap slides in and its neighbours make room), the state Kevin confirmed fixed on v71. The who-row renders only when there are people again; the `.f-who:empty` rules are gone; the test keeps the walk's real sequence and now pins the designed shape (no who-row while unpicked → the row arrives with the first pick → gone again when cleared). The rig aims at `.f-name` now. `npm test` = 404 tests, 403 pass, 1 skipped, 0 fail.
- 2026-09-01 — FOLLOW-UP for PR #14's territory (below the bloom banner in card-facts.js — not touched here): keep a resting hand's target still after the first pick WITHOUT a hole. Today `refreshZoomInner` re-runs `place()` after rebuilding the parts, and `place()` centres the overlay's box on the resting card, so when the who-row arrives every row above it shifts up by half the row's height and whatever sat under the cursor (the venue door, on an afters card) moves. The fix that respects both laws: on a REFRESH, anchor the overlay's TOP edge where the first `place()` put it (remember `slot.style.top` from the initial place, or the name's rect) and let growth run downward — `sizeSlot` still grows the box, the WHEN/WHERE/name rows stay put, the pills arrive below them and the chips slide down (the "neighbours make room" event, but only the neighbours below). Only a fresh zoom (a new card) centres. Clamp to the viewport's bottom edge as `place()` does. One paragraph of change in `refreshZoomInner` plus a jsdom test that pins `.f-name`'s and `.f-where`'s rects unchanged across a pick (stub rects) — and the walk's centre-click would then keep picking too.

### Round 3 — the one rule: a venue-night is one room (2026-09-01)

*Kevin on the preview: "our implementation of concurrent shows isn't our clean
stacking idea. it's a mix of all 3 ideas scattered around. wtf :(" — Sunday's
afters showed Public Works as a DECK, The Midway as a vertical RUN, The Great
Northern and Monarch as side-by-side LANES. Three treatments on one screen.
The fix is a subtraction. New builder, worktree `agent-a3056518a9eee6a70`,
branch `events-ui-runs` (the local name `events-ui` is held by the dead
builder's worktree; pushes go to `origin/events-ui` with `HEAD:events-ui`).*

- 2026-09-01 — GROUND TRUTH read before touching anything: MODEL-V3.md, the
  full phase-1 + phase-2 PROGRESS, `js/v3/events.js`, `renderEventsTimetable`
  in wall.js, motion.js and its users. Confirmed the 12 multi-artist
  venue-nights in `data/festivals/portola-2026.json` (29 venue-nights total,
  45 events): Fri Monarch 2, Fri Regency 3, Fri Great Northern 2, Sat Audio 2
  (no time), Sat Monarch 2, Sat Public Works 2 (no time), Sat Regency 2, Sun
  Monarch 2, Sun Public Works 3, Sun Rickshaw Stop 2, Sun Great Northern 2,
  Sun Midway 4 (already migrated). Every timed one lists all its artists at
  ONE time — the doors time, exactly as the Midway did. `js/v3/motion.js`
  STAYS: app.js's bucket toggle imports it too, so it is not deck-only.
- 2026-09-01 — THE DECK DELETED, live code only. `js/v3/deck.js` trashed;
  `renderDeck`/`faceCtxFor`/`decorateFace`/`panelTime`/`closeDeck`/
  `refreshDeckState` gone from wall.js (with the face branch in `refreshCard`,
  the `deckFace` filter in `cardFor`, `root.dataset.deckHost`, and the
  `closeDeck` in `renderWallInner`); `deckSnapshot`/`restoreDeck` gone from
  app.js's `repaintWall`; `.deck*` gone from `assets/v3.css`; the APP_CORE
  line gone from `service-worker.js`; the README structure line gone.
  `js/v3/motion.js` KEPT — app.js's bucket toggle imports it, so it was never
  deck-only, and `tests/motion-shared.test.mjs` still pins that the zoom's
  constants agree with it.
- 2026-09-01 — AMENDMENT from Kevin mid-flight: he likes the deck's grown
  PANEL and wants it in the back pocket "with a better styled ✕", in case a
  four-set run in a two-hour window gets tight. **The full deck lives in
  `c740388` on `origin/events-ui`** (face + ghosts + count pill + the grown
  panel + `deck.js` + its CSS + its tests) — that is the commit to revive it
  from. The picture stays visible in `gallery.html`'s new "THE BACK POCKET"
  section: a STATIC panel (real `renderCard` cards, no deck code) with the
  title row and a ✕ built from the app's own `.sheet-close`. Recorded in
  MODEL-V3 §4.
- 2026-09-01 — `timetableOf` REWRITTEN to the one rule. `peakConcurrency`,
  the `kind: 'deck'` cell and the `computeLanes` import are gone; there is now
  exactly one cell shape (`{venue, col, row, span, entry}`). A venue-night is
  one room: its sets sort by `order.seq` when EVERY set in the room carries
  one, else by start time then file order; a set ends where the next in the
  room begins, the last at the room's `close` when a file prints one (with the
  tilde when `closeApprox`), else an hour. Placement then walks DOWN the
  column — each card starts at its own time or where the one above it ended,
  whichever is later, and is at least 30 minutes tall. That cursor is what
  carries a room nobody has re-read yet: four sets all stamped with the doors
  time stack four-high instead of landing on top of each other. CHOSEN WHERE
  THE BRIEF WAS SILENT: when `order.seq` and the clock disagree the seq leads
  (the brief's words) and the cursor keeps the column readable; a HALF-numbered
  room falls back to the clock, because there is no run to read.
- 2026-09-01 — THE DATA. `scripts/migrate-portola-events.mjs` generalised from
  one `MIDWAY_RUN` to a `RUNS` table of 10 rooms + a `TIMELESS_ROOMS` list of
  2, with the guessed times DERIVED by an exported `runTimes()` rule rather
  than typed: spread evenly from doors to close where the close is known,
  an hour apart from doors where it is not, rounded to the half hour, never so
  wide that the closer starts at/after the close. The rule reproduces Kevin's
  Midway (10/11/12/1) exactly, so that room is both pinned and derived and a
  test asserts the two agree. Re-ran: 21 entries changed, 108 names + 6 day
  labels + 29 stages byte-identical, idempotent on a second run, validator
  11 files / 0 errors / 1 pre-existing warning. The script now also REFUSES to
  write if a multi-artist venue-night with any time is missing from both lists.
- 2026-09-01 — THE VALIDATOR gained the warning the brief asked for, in
  `checkEventFields`: an events venue-night with 2+ TIMED sets where not every
  set carries an `order`. It names the actual symptom — when every set says one
  time it reads "all N sets say "10 PM" — that reads as the room's DOORS time,
  not N set times", otherwise "N timed sets in one room and no running order".
  Probed all three shapes by hand (shared start, distinct starts, half
  numbered — the last double-warns with the existing partial-run rule, which is
  right, both are true). Fires ZERO times across the 11 shipped files.
- 2026-09-01 — ONE MODEL RULE I ADDED that the brief did not name, because the
  fallback looked bad without it: **when every set in a room prints the SAME
  time string, that string is the room's WINDOW, not a set time** — a doors
  time (or the room's hours) copied onto every act, which is exactly what all
  twelve Portola rooms looked like. Those sets divide the window equally.
  Without it a pre-migration room drew one hour-tall card and a row of 30-minute
  slivers (the "Overmono 4h then two slivers" shape); with it the column is N
  even slots. It never fires on migrated data (every room has distinct times).
- 2026-09-01 — ONE GUARD I KEPT against the brief's letter: the brief says
  "the last at the room's `close` when known". A half-entered numbered run
  (3 of 4 in the file) must NOT let its last-known set claim the end of the
  night — that was a reviewed decision this round (P2 12) and the cost of
  keeping it is one short card. So only a genuine closer (`seq === of`, or an
  unnumbered room's last set) runs to the close. The OTHER half of that old
  guard I dropped: a set now ends where the next set in the room begins even
  when a numbered successor is missing, because a hole in the column reads as
  broken and the room really is running.
- 2026-09-01 — TESTS. Deleted: every deck test (rest, grow, snapshot/restore,
  keyboard, place(), the people filter, the panel-card zoom restore, Escape
  layering, focus-home) and the deck branches in events-model. Added, all
  data-driven: `noLanesNoDecks()` in events-model and `assertRuns()` in
  events-wall assert the SHAPE — in one venue column no two cards share a row
  band, no card carries a lane width or offset, every card clears the 30-minute
  floor, and no `.deck*` node exists anywhere; every Portola venue-night on the
  wall passes them; the un-read fallback (three sets, one venue, one time, no
  order) stacks; the half-numbered room falls back to the clock; all 12
  venue-nights carry the run shape or are one of the two known timeless rooms;
  a single-act room never gets the shape; `runTimes()` reproduces every shipped
  room from its doors and close (and the Midway both pinned AND derived); the
  `wasTime` tripwire and the unrun-room guard both throw. The round-2 walk
  regression (picks cycling across a sync echo, the who-row arriving, the
  venue door never picking) moved from a panel card to a plain run card — the
  card a person actually meets now. `tests/motion-shared.test.mjs` kept and
  retitled (the zoom + the bucket toggle, not the deck).
- 2026-09-01 — GREEN before the rebase: `npm test` = 399 tests, 397 pass,
  1 skipped (pre-existing), 1 fail = the SW stamp (stamped last, on a clean
  tree). `node scripts/validate-festivals.mjs` = 11 files, 0 errors, 1
  pre-existing warning (Tomorrowland). `js/v3` went 8910 → 8551 lines across
  17 → 16 files — a net deletion of 359 lines even after the model rewrite.
- 2026-09-01 — REBASED onto `origin/main` (`056a983`, which carries PR #14's
  squash `66c3454`). Two content conflicts, both in `js/v3/wall.js`'s
  `refreshCard`, and both resolved in favour of BOTH sides:
  1. In the replayed phase-2 commit `75daba4`: #14's `{ onSwap }` signature and
     its insert-before-remove ordering, plus the deck's inert-face branch and
     the `height` placement prop (the deck still exists at that commit).
  2. In this round's own commit: #14's `{ onSwap }` + ordering kept, the deck
     branch dropped, and `height` removed from `PLACEMENT_PROPS` — it was
     added only for the deck face's `height: 100%`, and nothing else in the
     app sets an inline height on a card (grepped).
  FOUR intermediate SW-stamp commits (`f5a80b7` v71→v72, `0b25a35` v72→v73,
  `07fc37c` v73→v74, `bfe5779` v74→v75) were SKIPPED rather than resolved:
  main is already v73 and every one of them stamps a tree the rebase changed,
  so resolving them would have written four stamps that are wrong the moment
  they land. One fresh stamp goes on last, on a clean tree — which is what the
  phase-2 log already predicted ("whichever merges second re-runs sw-stamp").
  `npm test` after the rebase = 459 tests, 457 pass, 1 skipped, 1 fail = the
  stamp. Validator: 11 files, 0 errors, 1 pre-existing warning.
- 2026-09-01 — ALIGNED the EVENTS gallery's `eventsTap` with app.js's
  `refreshArtistCards` (the `onSwap` hand-off before the old node is removed).
  **FLAG for PR #14's owner, not touched here:** `gallery.html`'s ZOOM gallery
  (its own module, ~line 563) still does `refreshCard(...)` then
  `refreshZoom(fresh[zi])` afterwards — the pre-#14 ordering. The gallery
  claims to mirror app.js, so a session testing the zoom there will still see
  the blink production no longer has, and may "fix" the wrong file. One line,
  identical to the change app.js already carries; left alone because that
  module is #14's territory.
- 2026-09-01 — HOVER, FOR THE RECORD (step 7 of the brief). What I checked in
  the day-first paths, and what I found:
  1. **`cardFor` can return the wrong card, and there is exactly one case.**
     I rendered EVERY shipped festival in jsdom under all five sorts and
     listed every pair of cards sharing one `(data-artist, data-occ)`
     identity. Across 11 files × 5 sorts there is exactly ONE: Portola's
     **Horse Meat Disco**, day `"Afters & Folsom"`, which renders as a cell on
     Friday's afters clock AND as a Folsom tile, both carrying byte-identical
     `data-occ` (`{"day":"Afters & Folsom","stage":"Fri · Public Works",
     "time":"9 PM - 3 AM","weekend":null}`). That sameness is deliberate — one
     show, one pick key (review round finding 19) — but it means `cardFor`
     returned document order, so a zoom standing on the FOLSOM tile came back
     on the AFTERS cell after any repaint: the overlay jumps to another room,
     on another part of the page. That is a live mechanism for "hover shows
     some other random looking card", and it is on the current preview.
     FIXED here, small and outside the zoom module: `cardFor` takes an
     optional `{ room }` tie-break and `repaintWall` reads the zoomed card's
     room BEFORE the teardown. One match behaves exactly as before, a room
     that is no longer on the wall degrades to the old lookup rather than
     losing the zoom, and the grid billing of the same name is still a
     different occurrence. Test in events-wall.
  2. **A card replaced under a standing overlay** — that is `refreshCard`, and
     PR #14 now hands the zoom the fresh node through `onSwap` BEFORE removing
     the old one. Kept intact through the rebase; the events gallery was
     brought onto the same ordering (the zoom gallery still is not — flagged
     above).
  3. **The deck was the other candidate and it is gone**: its face cards were
     the only cards with no hover wiring, and its panel was the only surface
     whose cards could vanish from under a standing zoom. Nothing in the app
     renders a `.deck*` node now, and a test asserts that on the DOM.
  4. **Not reproduced, not fixed:** "hover sticks". Nothing I found in
     wall.js's day-first paths holds the hover open — the intent timers and
     the focusout guard all live in card-facts.js, which this round did not
     touch. If it survives this build it is #14's territory and needs a real
     browser, not the rig (the rig walked all 104 hoverable cards clean).
- 2026-09-01 — THE RESEARCH FILE NEVER ARRIVED. `…/3de364de-…/scratchpad/
  afters-billing.md` was still absent at the end of this round (checked five
  times across the build). So all nine non-Midway rooms use the brief's
  fallback: `confidence: 'low'`, `order.confirmed: false`, and
  `source: https://portolamusicfestival.com/portola-week/`. **One deliberate
  deviation from the brief's letter**, recorded here because it is the only
  place a reviewer would disagree: the brief said "file order with the FIRST-
  listed artist as the headliner who closes", which for a three-act bill
  [A, B, C] reads as B, C, A. I used the FULL REVERSE — C, B, A — because
  MODEL-V3 §5's own hierarchy rule is "the headliner closes, the other large-
  print act plays right before it, small print opens", and a bill is printed
  in descending size. The two readings differ only for the two three-act rooms
  (Fri Regency, Sun Public Works); for the eight two-act rooms they are
  identical. If the research lands, the fix is editing `order` in the RUNS
  table and re-running the script — the times follow automatically from
  doors/close.
- 2026-09-01 — PUSHED. `git push --force-with-lease origin HEAD:events-ui`
  (c740388 → 2d256ac, forced because of the rebase). PR #16 retitled and its
  body rewritten in Kevin's terms: the round-3 story with his words, the table
  of all ten runs with doors/close/order and their confidence, the two
  deliberately timeless rooms, how the guesses are made, the validator's new
  warning, the Horse Meat Disco find, a walk list whose step 5 IS Sunday's
  afters, and what I chose where the brief was silent. CI green in ~53 s
  (checks ×2, three Vercel deploys). Gallery module blocks syntax-checked
  (3/3) and its section tags balance.
- 2026-09-01 — SELF-REVIEW CAUGHT ONE BEFORE THE END: the back-pocket ✕ was
  not actually styled. `.sheet-close`'s base look (30px pill, card fill,
  hairline border, centred glyph) was scoped as `.sheet .sheet-close`, and the
  back-pocket panel is not inside a `.sheet` — so Kevin's "better styled ✕"
  would have rendered as a bare browser button, the exact thing he asked
  against. Fixed by UNSCOPING the base rule to `.sheet-close` in
  `assets/v3.css`, with the reason in a comment: the close is a component, and
  scoping its base to one container is why it could not be reused.
  `.sheet-card .sheet-close` still overrides placement and colour, and every
  `.sheet-close` the app renders (card-facts `sheetCard`, notes.js's sheet
  head, the gallery's notes-sheet demo) sits inside a `.sheet`, so nothing in
  the app looks different. What a jsdom suite CANNOT check is how it looks —
  that is one line on the walker's list (step 12: the gallery's BACK POCKET).
- 2026-09-01 — AND ONE MORE: the back-pocket cards were LIVE (renderCard wires
  `ctx.onTap` and `ctx.wireZoom`), so a tap on the picture would have recorded
  a real pick that never visibly cycled — a picture has no refresh loop, and
  half-working is worse than not working. They render through an inert ctx
  now (`onTap` a no-op, `wireZoom` null); the ✕ was already disabled. Cards
  still carry their real auras and pills, which is the point of the picture.
  `gallery.html` is not in APP_CORE, so no re-stamp. `npm test` = 460 tests,
  459 pass, 1 skipped, 0 fail.

### Round 3b — the billing, read (2026-09-01)

*The research landed after all: the coordinator read the eleven DoTheBay event
pages himself (DoTheBay carries Goldenvoice's official Portola Week listing).
File: `…/3de364de-…/scratchpad/afters-billing.md`.*

- 2026-09-01 — THE ORDER HELD. Every one of the ten rooms I had entered on the
  full-reverse fallback matches the billing on its own show page — including
  both three-act rooms, which is where my reading and the brief's literal
  wording disagreed. Nothing about who plays when had to move.
- 2026-09-01 — SOURCES ARE PER ROOM NOW. `order.source` was one programme URL
  for nine rooms; it is each room's own DoTheBay show page. The reason is worth
  keeping: portolamusicfestival.com/portola-week renders its show list
  client-side, so its static HTML is an image — it is the programme of record
  but not a citable door. It stays in `meta.sources`; `dothebay.com/portolaweek`
  joins it. The Midway keeps AXS 1575408. Confidence per room is now recorded
  from the research (6 medium / 5 high + the Midway's medium) and printed by
  the CLI on every run.
- 2026-09-01 — TWO NAMES CAME OFF THE BILL AND INTO THE FILE. **Buck Wilson**
  (Sun · Monarch, opens — he existed only as a line in `meta.note`'s
  supporting-roster list) and **Kaytree** (Sun · Public Works, second — she
  already had a Sunday grid billing, so this is the VTSS/Overmono shape: one
  name, two entries, picks unify). DoTheBay spells the fourth Public Works act
  "Erika b2b SFCowboy"; our lowercase `erika b2b sfcowboy` is KEPT, because it
  is a pick key and there is no rename path.
- 2026-09-01 — THE MIGRATION CAN CREATE A ROW NOW, and only a declared one.
  A run row carries `adds: [...]`; anything else in `order` must already exist
  or the transform throws rather than inventing a card. New rows are built
  through the same `runFieldsFor()` the mapped ones use (a test asserts a
  created entry has byte-identical keys to its room-mates) and are spliced
  directly after the last existing set of their room, so the diff stays local.
- 2026-09-01 — THE FROZEN-KEY GUARD IS ADDITION-AWARE. Positional equality
  cannot survive an insert, so `additionsOnly(before, after)` walks the new
  list and consumes the old one IN ORDER: every pre-existing name/day/stage
  must be met in sequence, byte-identical, and the leftovers are the additions
  — which the CLI then matches against exactly what `RUNS` declared, minus any
  a previous run already landed (that last clause is what keeps a re-run a
  no-op). A moved row throws with the row it expected.
- 2026-09-01 — TWO ROOMS STOPPED BEING TIME TBA. Sat · Audio (Airwolf
  Paradise → Max Styler) and Sat · Public Works (Chloé Caillet → Fcukers) print
  doors 10 PM on their show pages; our file had no time for either. They are
  runs now, `TIMELESS_ROOMS` is empty, and Portola has no timeless multi-artist
  room left — only two single-act rooms with no time (Groove Armada, Azzecca).
  Knock-on: **Saturday's afters now EARN columns on their own** (4 timed
  venues), where before they only had them by the consistency law. Nothing
  moved on screen; the test that pinned `[false, true, false, true]` now pins
  `[false, true, true, true]` with the reason.
- 2026-09-01 — CLOSES, LEFT ALONE ON PURPOSE. The research flags
  `closeSource: false` for Sat Monarch, Sun Monarch and Sun Public Works —
  DoTheBay does not print their end times. Those closes came from our own
  2026-08-23 research pass, so they are SOURCED, just not there; marking them
  `closeApprox` would put a tilde on the zoom's window line that overstates our
  doubt. Left as they are, with the distinction written into `meta.note` and
  the run rows' notes. **Flag for Kevin: if he wants only DoTheBay-printed
  closes to count as sourced, three rooms gain a tilde and it is a one-line
  change per row.** Fri · The Great Northern's 2 AM IS printed on its page.
- 2026-09-01 — NO SW STAMP THIS ROUND, deliberately. Nothing in APP_CORE
  changed (scripts, data and tests only), festival JSONs are served
  network-first so a data drop reaches an online phone on the next open, and
  `sw-stamp.mjs` bumps `CACHE_VERSION` unconditionally — running it would
  invalidate every install's shell cache for zero new bytes.
  `tests/app-shell-complete.test.mjs` is green, which is the check that decides.
- 2026-09-01 — GREEN: `npm test` = 463 tests, 462 pass, 1 skipped
  (pre-existing), 0 fail. `node scripts/validate-festivals.mjs` = 11 files,
  0 errors, 1 pre-existing warning. Migration: 31 entries changed, 2 added,
  110 pre-existing names / 6 day labels / 29 stages byte-identical, idempotent
  on a second run.
