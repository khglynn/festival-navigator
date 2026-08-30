# Wall survey — sections, filters, day rule, whisper, now line

Dimension: js/v3/wall.js (whole, minus renderCard internals owned by the
cards/zoom walker), js/v3/filters.js, js/v3/sort-control.js, js/v3/now.js,
js/v3/aura.js, js/v3/palette.js, wall-related parts of js/v3/app.js.
Branch: notes-desktop-round (PR #13). Today: 2026-08-30.

Grounded first in CLAUDE.md, NOW.md top, docs/user-flows.md (whole),
then read every assigned file in full. `npm test` run read-only: 274 pass /
1 skip, matches NOW.md's claim — no regression at the unit level (the bugs
below are interaction/layout bugs a unit suite wouldn't catch).

---

## F-1 (P0) — the zoom inflates the WHOLE `.wall-grid` row, not the one card
(root-causes Kevin's #1 and #2 complaints: "multiple taps no longer
increases pick intensity" and "the whole row animates and resizes when
only the one card should... like it's just punching out... too heavy")

**Evidence, read directly:**
- `assets/v3.css:509` — `.wall-grid { display: grid; grid-template-columns:
  repeat(2, 1fr); gap: 6px; }` — no `grid-template-rows`, so CSS Grid falls
  back to implicit/auto row sizing: a row's height is the tallest item in
  it, by spec.
- `assets/v3.css:17-18` — `.card { position: relative; min-height: 64px;
  ... }` — the resting card is normal in-flow content, not taken out of
  flow.
- `js/v3/card-facts.js:374,377-379` — the zoom's grow sets
  `el.style.width = \`${target}px\`;`, `el.style.marginLeft =
  \`${Math.round(shift)}px\`;`, `el.style.minHeight = '132px';`,
  `el.style.zIndex = '30';` directly on the SAME element that is still a
  live grid item in `.wall-grid` — no `position: absolute`/`fixed` is ever
  set, so the element never leaves the grid's row-sizing calculation.
  64px → 132px is more than double the base card height.
- Contrast, and why the scheduled timetable doesn't show this: `js/v3/
  wall.js:704` — `const rowsTemplate = \`repeat(${rows}, 20px)\`;` — the
  `.times-grid` used for scheduled/set-times fests has EXPLICIT fixed row
  tracks, so the same inline `minHeight` on a timed card only overflows
  visually (`.card.zoom { overflow: visible; z-index: 30 }`,
  assets/v3.css:620) without moving any row track. The bug is specific to
  every LINEUP-style grid: Lost Lands' whole wall, ACL's lineup view, any
  search-results grid, and — on a scheduled fest like Portola — the
  Afters/Folsom sections, because `extraSectionsOf`'s output renders
  through the exact same `renderLineupGroup` → `.wall-grid` path
  (`js/v3/wall.js:876-878`).
- The repeat-tap jitter: `js/v3/app.js:122-143` (`refreshArtistCards`) —
  while a card is zoomed, EVERY pick tap goes through the `keepZoom`
  branch and calls `zoomCard(target, artistName, ctx, { ..., instant:
  true })` again (line 142) on the freshly-rendered node. That means the
  full-row reflow this causes is not a one-time cost when you first
  hover/hold — it fires again on every single tap while zoomed, which
  matches "the animation seems to slow and make the site jitter" far
  better than a one-shot layout bug would.
- Best-guess mechanism for "multiple taps no longer increases pick
  intensity" (medium confidence — I did not instrument a live pointer to
  confirm coordinates): the first tap zooms the card, the row height jumps
  ~68px, and everything below/beside it shifts under the pointer in the
  same frame the tap's `click` event is still being dispatched. A second
  tap in the same physical spot can now land on a neighbor card that slid
  into that position, or on the zoomed card's own `.facts-grown`/
  `.chip-notes` region (both explicitly excluded from picking by the
  click handler at `js/v3/wall.js:212`) rather than the card body. Either
  way the visible symptom is "I tapped four times and it's still not
  MUST" even though `model.nextTapLevel` (js/v3/model.js:83-86) and
  `handleTap` (app.js:146-168) are themselves correct — I read both fully
  and found no logic bug in the pick-cycle itself. The regression is a
  layout side-effect of the grow, not a state bug.

**Journey:** F4 (lineup wall tap-to-pick + zoom), F6 (notes via the zoom) —
this is the single most-used interaction in the whole app.

**Fix direction:** take the zoomed card out of the row's height
calculation — e.g. `position: absolute` (sized/positioned via the already-
measured `rect()`/FLIP math card-facts.js already computes) with the
resting grid keeping a normal-height placeholder in its place, or give
`.wall-grid` fixed-height rows the way `.times-grid` already has them, or
have card-facts.js render the grown state into an OVERLAY node instead of
resizing the in-flow grid item. The two grids solve overlap two different
ways today (fixed rows vs. min-height-on-the-item); only one of those ways
survives contact with an auto-sizing grid.

---

## F-2 (P1) — Lost Lands' day headers shout the raw, unformatted day string
(and this is very likely Kevin's "the lost lands description not getting
the cleaned up description for before/afters that we did to Portola")

**Evidence:**
- `data/festivals/lost-lands-2026.json` — 21 artists carry `"day":
  "Wednesday, Sept 16 (Early Arrival Pre-Party)"` / `"Thursday, Sept 17
  (Early Arrival Pre-Party)"` verbatim, and the file has NO `dayMeta` at
  all (`python3 -c "print(json.load(open(...)).get('dayMeta'))"` → `None`).
- `js/v3/wall.js:263-272` (`knownDaysOf`) treats any day string with no
  `& + /` or " and " as an atomic day — these two full sentences qualify,
  so they become real day-groups.
- `js/v3/wall.js:345-352` (`renderLineupGroup` → `dayHeader(header || day
  || 'THE LINEUP', ...)`) renders that raw string, uppercased, as the
  section header — there is no dayMeta for these keys, so `dayRuleSub`
  returns `''` (no clean sub-date either). The wall literally prints
  "WEDNESDAY, SEPT 16 (EARLY ARRIVAL PRE-PARTY)" as a shouting rule, where
  Portola's equivalent early-arrival concept (Afters/Folsom) gets a short
  header plus a clean `dayMeta`-driven date sub ("Sep 24-27").
- The app ALREADY has the cleanup logic Lost Lands needs — it's just not
  applied to the wall's own header. `js/v3/app.js:366`: `const railLabel =
  meta?.wd ? ... : day.replace(/\s*\(.*\)\s*$/, '');` strips the
  parenthetical for the desktop day-RAIL tab. So today, the tab reads
  "WEDNESDAY, SEPT 16" (clean) while the section it scrolls you to reads
  the full raw sentence (dirty) — the tab and the header it represents
  visibly disagree.

**Journey:** F4 (lineup-only fest by day) + F9 (day navigation) — walked
Lost Lands specifically per the brief.

**Fix direction:** two independent, both worth doing — (a) data: give Lost
Lands a `dayMeta` entry for these two pre-party days the same way Portola's
Afters/Folsom got one (short label + a real date sub); (b) code: `dayHeader`
should never print a raw unbounded day string verbatim — route it through
the same parenthetical-stripping (or a shared "clean day label" helper) app.js
already uses for the rail tab, so the NEXT lineup fest with a verbose day
string degrades gracefully instead of shouting the source data. Right now
the cleanup exists in exactly one of the two places it's needed.

---

## F-3 (P2) — docs/user-flows.md still uses the retired word "favorites"
that CLAUDE.md's own vocabulary rule and the shipped code both forbid

- `docs/user-flows.md:82-83` (F4): "sort (Billing / A→Z / My picks / Crew
  favorites) reorders" — this is the doc the audit is supposed to trust.
- `js/v3/sort-control.js:12`: `{ value: 'crew', label: 'Most picked' }, //
  vocabulary is picked/must/notes/fest — never 'favorites'` — the code
  comment is explicit that "favorites" was deliberately retired.
- Project CLAUDE.md: "UI vocabulary is exactly: picked / must / notes /
  fest." The doc is the stale side here, not the code — per the walk
  brief's own rule, a mismatch is always a finding. Update the doc's F4
  step 3 to say "Most picked."

---

## F-4 (P3) — dead sort value: `ctx.sort === 'day'` is unreachable from the UI

- `js/v3/wall.js:939-941`: `const grouped = ctx.sort === 'billing' ||
  ctx.sort === 'day' ? groupByDay(...) : ...`
- `js/v3/sort-control.js:8-13` (`OPTIONS`) only ever produces `billing`,
  `az`, `mine`, `crew` — never `'day'`. `js/v3/app.js:35` initializes
  `ctx.sort = 'billing'`. No user action can set `'day'`.
- Six test files hard-code `sort: 'day'` as their wall-ctx fixture
  (tests/afters-events.test.mjs, now-line.test.mjs, portola-2026.test.mjs,
  scheduled-sections.test.mjs, two-weekend-schedule.test.mjs,
  wall-filters.test.mjs) — harmless (billing produces the identical
  grouping), but they're exercising a branch a real user can never reach,
  and the `|| ctx.sort === 'day'` half of the condition in wall.js is dead
  weight. Worth a quick simplify pass: drop the `'day'` branch from
  wall.js, and change the test fixtures to `sort: 'billing'` so the tests
  describe what a user actually does.

---

## F-5 (P3) — a no-op spread in the scheduled-search extra-sections call

- `js/v3/wall.js:916`: `renderLineupGroup(root, day, matches, ctx, {
  ...fest, dayMeta: fest.dayMeta }, ...)` — spreads `fest` then
  re-assigns `dayMeta` to the exact value already carried in the spread.
  Reads like it was meant to override/merge something and doesn't; either
  drop the redundant key or the object literal should be plain `fest`
  (renderLineupGroup only reads `fest.dayMeta` and `fest.artists`, per its
  signature, so this is inert either way — confirmed by reading
  `renderLineupGroup`, wall.js:343-352, which only touches `fest.dayMeta`).

---

## Journeys walked (per the brief) and what I found

- **Portola by day (scheduled, set-times)** — `days.Saturday/Sunday`,
  `dayMeta` with real ISO dates, `timezone: America/Los_Angeles`. Clean;
  the now-line/rollover math (`js/v3/now.js`) and the shared-stage-strip
  scroll sync (`wireTimesScrollSync`) read correctly against the code.
  No findings here beyond F-1's cross-cutting zoom bug.
- **Lost Lands (lineup-only, no `days`/`dayMeta`)** — F-2 above. Also
  confirmed the 96 undated main-bill acts render first as "THE LINEUP"
  and the two Early-Arrival pre-party day-groups trail at the end
  (`groupByDay`'s `''` key is always inserted before the known-day loop,
  wall.js:290-294) — chronologically backwards (the pre-party happens
  BEFORE the main bill) but I'm treating this as an intentional "main
  bill leads" choice, not a bug, since the code comment right above
  `groupByDay` half-describes it ("Groups follow known-day order first,
  then first appearance") — that comment doesn't actually match what the
  code does (unscheduled-artist group is unconditionally first), which is
  itself a small stale-comment nit but not worth its own finding entry.
- **Filter by one person, several, yourself** — `filters.js`'s
  `passesPeople`/`togglePerson`/session-storage fallback all read
  correctly; verified the documented dim-vs-hide split (scheduled grid
  dims via a class the renderCard always computes, lineup lists hide by
  pre-filtering the array before render, `wall.js:69` vs `wall.js:360-361`)
  matches both the code comments and `docs/user-flows.md`. No bug.
- **Solo a stage** — `filters.js columnsTemplate`/`railLabels` and
  `wall.js stageHead`/`renderStageStrip` correctly fall back to "no solo"
  for an unknown/renamed stage; folded stage AND folded everything-else
  columns both correctly render as blank reserved-width space with no
  cards, matching the strip's rail label above them. No bug.
- **ACL's two weekends** — ACL is `status: "lineup"`, not scheduled, so it
  runs through `applyWeekend` (wall.js:450-453) and the `updateWeekendRow`
  segmented control (app.js:390-430), not the scheduled two-weekend branch
  (`scheduledWeekendOf`) — that branch (and its "'all' maps to W1" rule)
  is currently untested against any REAL data set, since no fest in
  `data/festivals/` is both `scheduled` and two-weekend yet. It has direct
  test coverage (`tests/two-weekend-schedule.test.mjs`), so I'm not
  flagging it as a bug, just noting it's about to get its first real
  workout once ACL's set times land (already tracked in NOW.md's "Then:"
  section — not a new finding).
- **The now line on festival day** — `now.js` read whole: rollover-hour
  math, the festival-timezone read via `Intl`, the once-per-festival-day
  scroll claim, and the `nowOffsetPx` off-grid guard all check out against
  their own doc comments. No bug found.
- **Afters / events sections** — `extraSectionsOf`'s three-way grouping
  (grid-day loose sets, named non-grid days, truly-unscheduled) and the
  activities-only / genuinely-empty day fallbacks in `renderScheduledDay`
  (wall.js:670-686) both read correctly; verified against real duplicate-
  name data (Fatboy Slim, Soulwax, etc. — main set + Afters set, same
  artist name, 27 such duplicates in Portola's file) that the `occ`
  payload wall.js builds for each occurrence differs (different `day`
  key), so the zoom/sheet/route-key machinery that depends on it (per
  NOW.md) has distinct occurrences to key off — consistent with the "one
  artist, one pick, cards in both places" comment at wall.js:304, since
  picks AND notes are both keyed by artist name only (by design, matches
  CLAUDE.md's "artist names are pick keys" rule) — not occurrence-scoped.
  Worth a mention, not a finding: a note written from the Afters card's
  sheet is NOT distinguishable from a note about the main set, so "let's
  meet at 10pm for the afters" and a note about the main-stage set share
  one pool. This is consistent with how the whole system already treats
  artist identity (state, jsonb_deep_merge, Spotify affinity all key on
  name only), so I'm surfacing it as an open question rather than a
  defect — flagging it in case it's a design gap nobody's decided on
  purpose yet.
- **The whisper at a day's door + fest whisper foot** — `notes.js
  dayWhisper` (called from wall.js) correctly picks the true newest note
  by timestamp (`model.notesFor` sorts ascending, `list[list.length-1]`),
  including replies (a reply is just a note with a `re` key, still in the
  same map) — matches NOW.md's "newest note (root or reply)" claim. The
  fest-whisper-foot's gating (`festNotesFoot`, wall.js:950-963: nothing
  renders unless fest-scoped notes exist OR the fest has zero artists) is
  exactly what `docs/user-flows.md` F8 specifies — verified line by line,
  not a bug.
- **Search / list views** — walked both the scheduled-fest search
  fallback (chronological per day, weekend-aware, CORE-4) and the
  lineup-fest search (reuses the normal day-grouped render). Both read
  correctly against their own code comments and doc F4/F5. No bug found
  beyond F-3/F-4 above.
- **An artist who plays twice** — see the Afters/events note above
  (Portola's 27 duplicate-name pairs); occurrence identity is correctly
  distinguished in the `occ` payload wall.js constructs.
- **Empty states** — a fest with zero artists (Tomorrowland Winter,
  `"artists": []`) correctly falls into the `!artists.length` branch
  (wall.js:929) and shows "Lineup coming soon — notes work now." plus the
  invite-variant fest-notes-foot ("+ Add a note") — matches F8's
  lineup-less-fest spec exactly. "No picks here from X" under a people
  filter (wall.js:380-385) and "No artists match — try fewer letters."
  under search (wall.js:918-923, wall.js:932) both render correctly for
  their respective triggers. No bug found in any empty state I walked.

---

## Not re-reported (already tracked elsewhere, not new findings)

- The coach-mark's "Hold for notes." line (app.js:445) — Kevin's own line,
  already an OPEN decision in NOW.md ("leave or reword"), verified still
  present and unresolved but not re-flagged here since it's already
  tracked.
- ACL / Seismic set-times and afters/big-events data — already tracked as
  NOW.md's explicit next-round work ("Then:" section), not a code defect
  in this dimension.

---

## Skeptic

Re-opened every cited file at every cited line; grepped for guards the
reader might have missed. Verdicts below, then what the same files hold
that the reader didn't report.

### F-1 (P0) — zoom inflates the whole `.wall-grid` row — **CONFIRMED, P0**

Read `assets/v3.css:509-511` (`.wall-grid` — no `grid-template-rows`),
`assets/v3.css:17-18` (`.card` — in-flow, `position: relative`), and
`js/v3/card-facts.js:300-380` (`zoomCard`) in full. No `position:
absolute`/`fixed` is ever set on the zoomed element anywhere in
card-facts.js (`grep -n position js/v3/card-facts.js` finds only the
off-screen measurement probe at line 335, which is a *different*,
detached node). `el.style.width/minHeight/marginLeft/zIndex` land
directly on the live grid item. Confirmed the contrast case too:
`wall.js:704/714-715` gives `.times-grid` an explicit `repeat(${rows},
20px)` row template, and `extraSectionsOf`'s output really does route
through `renderLineupGroup` → `.wall-grid` (`wall.js:876-878`,
`wall.js:363`), so Afters/Folsom sections on an otherwise-scheduled fest
are not exempt. The reasoning holds end to end; nothing elsewhere in the
two files intercepts or repositions the zoomed element. P0 is right —
this is the core pick/zoom interaction on every lineup-style grid.

### F-1b (P0) — reflow-shift as the mechanism for missed taps — **PLAUSIBLE, downgrade to P1**

The cited mechanics are real (`app.js:122-143` does call `zoomCard(...,
{instant:true})` on every tap while zoomed; `wall.js:212`'s
`e.target.closest('.facts-grown, .chip-notes, .chip-spotify')` guard is
real) and the reader flagged their own confidence correctly ("not
confirmed with live pointer coordinates"). But tracing the actual click
path further turned up a much more direct, non-speculative explanation
for the same complaint — see **Missed #1** below — which makes the
row-reflow-shifts-the-pointer theory a secondary, unverified contributor
rather than "the" mechanism. Real risk, real P0-complaint context, but
the specific claim in this finding is the weaker of two explanations
for the same symptom, so P1 (unconfirmed hypothesis) is the honest
severity; don't let it stand in as the fix target — Missed #1 is.

### F-2 (P1) — Lost Lands day headers print the raw string — **CONFIRMED, P1**

Verified `data/festivals/lost-lands-2026.json` really has no `dayMeta`
and every artist's `"day"` is the full sentence (`"Wednesday, Sept 16
(Early Arrival Pre-Party)"`, checked lines 301-377+). `knownDaysOf`
(`wall.js:262-270`) has no `&+/`/`and` delimiter in that string so it
passes through as an atomic day untouched. `renderLineupGroup`
(`wall.js:343-345`) headers it with the raw `day` value with no
stripping. Confirmed the asymmetry too: `app.js:366` strips the exact
same `(...)`-suffix pattern for the desktop rail tab and nothing in
wall.js/notes.js applies the same treatment to the in-wall header. Fix
suggestion (data + code both) is sound.

### F-3 (P2) — stale "Crew favorites" doc label — **CONFIRMED, P2**

`docs/user-flows.md:82-83` reads exactly as quoted;
`js/v3/sort-control.js:12` reads exactly as quoted, comment and all.
Trivial doc fix, correctly scoped at P2.

### F-4 (P3) — dead `sort === 'day'` branch — **CONFIRMED, P3**

`wall.js:939` reads exactly as quoted. `sort-control.js`'s `OPTIONS`
(lines 8-13) only ever produce `billing/az/mine/crew`; `app.js:35`
initializes `ctx.sort = 'billing'`; grepped for any other assignment to
`ctx.sort` or `state.sort` and found none that could produce `'day'`
from the UI. All six named test files really do hard-code `sort: 'day'`
in their fixtures. Harmless-but-confusing dead code, correctly P3.

### F-5 (P3) — no-op spread — **CONFIRMED, P3**

`wall.js:916` reads exactly as quoted; `renderLineupGroup`'s signature
(`wall.js:343`) only reads `fest.dayMeta`/`fest.artists`, so
`{ ...fest, dayMeta: fest.dayMeta }` is inert. Correct and trivial.

---

### Missed

**1. (P0, supersedes F-1b as the real mechanism) A hover-zoomed card's
click handler excludes the ENTIRE `.facts-grown` block from picking —
not just the notes/Spotify chips — which covers ~64% of the zoomed
card's height and directly contradicts the code's own stated intent for
mouse zooms.**

`js/v3/wall.js:212`:
```
if (e.target !== el && e.target.closest && e.target.closest('.facts-grown, .chip-notes, .chip-spotify')) return;
```
`.facts-grown` (`assets/v3.css:624-626`) is `top: 38px; bottom: 10px`
inside a 132px-tall zoomed card (`card-facts.js:378`,
`minHeight = '132px'`) — i.e. it covers roughly y=38 to y=122, about
84 of 132px, minus 8px left/right insets. That block holds the sub-line,
people pills, and fact chips — not "controls" in any real sense except
the two chips already named separately in the selector. Yet the comment
directly above (`wall.js:209-211`) says "anything inside the grown
block ... is its own control, never a pick," treating the whole
container as excluded by design.

This directly contradicts `app.js:74-80`'s own documented intent for a
**mouse** zoom: `onZoomTap` only intercepts `source === 'touch'`
zooms, with the explicit comment "A mouse zoom is just hover — clicking
still picks." But `wall.js:212`'s check runs *before* `onZoomTap` is
even reached, and it doesn't distinguish mouse from touch — so for a
mouse-hovered card (`ZOOM_IN_MS = 350`ms, `card-facts.js:178`,
`source: 'mouse'` at `card-facts.js:436`), clicking anywhere in that
84px-tall info band silently does nothing: no pick, no dismiss, nothing.
Only clicking the ~38px name strip at the top, the bottom 10px, or the
8px left/right margins reaches `el` directly and cycles the pick.

This is a materially better fit for Kevin's "multiple taps no longer
increases pick intensity" complaint than F-1b's row-reflow theory: it
requires no scroll/reflow coincidence at all — a completely stationary
mouse, hover long enough to zoom (the natural gesture before clicking to
read details, then pick), then click the card's own body, and roughly
two-thirds of that body eats the click with no feedback. It's also worse
for touch: since the exclusion check runs before `onZoomTap`, a touch
tap landing inside `.facts-grown` neither dismisses the preview (which
the code intends touch taps to do) nor picks — it's a dead zone with no
recovery except tapping the narrow strips outside it.

No test file references `.facts-grown` in a click/pick context
(`grep -rn facts-grown tests/*.mjs` — empty), so this gap is invisible
to `npm test`; it needs a real-browser walk (per this repo's own
documented lesson about hover/click sequences the unit suite can't see).

Fix: narrow the exclusion to the two chip selectors that are real
controls (`.chip-notes, .chip-spotify`) and let clicks on `.f-sub`,
`.f-pill`, and the grown block's own background bubble through to the
pick — or, for mouse zooms specifically, drop the `.facts-grown`
ancestor check entirely and rely on the two chips' own
`stopPropagation()` (which the comment says already exists) to protect
just themselves.

**2. Minor: `railLabels` (`js/v3/filters.js:77-92`) can theoretically
collide beyond its own documented 2-fallback chain.** The function's own
comment plans for "BL"/"BLB" then "BL"/"BL2" as the worst case for two
clashing stages, but the `used[label]` counter has no bound — a third
stage sharing both the same first-word-prefix AND the same initials
would get `${label.slice(0,3)}${used[label]+1}` = a 4-char label
indistinguishable from a coincidentally-named fourth stage, and nothing
guarantees the *numbered* labels themselves stay unique from each other
(e.g. three colliding stages could in principle produce "BL2" twice if
`used[label]` for the truncated 3-char key collides with a separately-
counted run). Given real festival stage lists (checked Portola, Lost
Lands, ACL — none has three stages this close in name), this is
currently unreachable, so I'm not raising it above informational: worth
a code comment noting the assumption ("no fest has 3+ stages this
close") rather than a fix.

**3. Not a bug, but worth flagging alongside F-2: the day-rail's
parenthetical-stripping regex (`app.js:366`,
`/\s*\(.*\)\s*$/`) is greedy and anchored to end-of-string, so it would
also silently eat a second, unrelated trailing parenthetical if one ever
existed on a day string (e.g. `"Friday (Pre-Party) (VIP only)"` →
`"Friday"`, not `"Friday (Pre-Party)"`).** No current festival file hits
this (checked all `data/festivals/*.json` for multi-paren day strings —
none), so it's latent, not live. Same fix that resolves F-2 (giving
Lost Lands' pre-party days a real `dayMeta` entry so the header uses
`dayRuleSub` instead of the raw string) sidesteps this too, since it
stops relying on regex-stripping a free-text day label at all — the more
durable fix, not just the equivalent one.
