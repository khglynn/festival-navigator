# Survey — Tests, docs truth, repo hygiene (notes-desktop-round / PR #13)

Run 2026-08-30. Dimension owner: this subagent. `npm test` = 275 tests, 274
pass / 1 env-skip, matches NOW.md's claim — suite is currently green.

## Test inventory (what each file covers)

- `afters-events.test.mjs` — Portola-style afters/Folsom section rendering
- `app-shell-complete.test.mjs` — every static-import module is in the SW's
  APP_CORE list; SW stamp matches cached assets (the sw-stamp ritual)
- `bulk-v4.test.mjs` — bulk paste import (F14)
- `crew-links.test.mjs` — share-link minting/shape
- `crew-validate.test.mjs` — server-side crew doc validation
- `data-loss.test.mjs` — merge/tombstone data-loss regressions
- `day-grouping.test.mjs`, `day-image-sections.test.mjs` — day splitting, PNG export day sections
- `db-concurrency.test.mjs`, `db-merge.test.mjs` — the real-Postgres jsonb_deep_merge (PGlite)
- `docs-truth.test.mjs` — README/CLAUDE.md/AGENTS.md vs code (scope detailed below)
- `error-text.test.mjs` — errorText() plain-language mapping
- `fest-first.test.mjs` — fests×circles×you model (F1)
- `finish-pass.test.mjs` — misc finish-pass regressions
- `invite-context.test.mjs` — F3 join-via-link context
- `live-pick-keys.test.mjs` — frozen pick-key byte-identity (artist names)
- `merge.test.mjs` — client/server deep-merge agreement
- `name-rules.test.mjs` — name validation (client+server shared)
- `notes-edit.test.mjs` — pre-round note edit/tombstone (legacy, still relevant)
- `notes-round.test.mjs` (NEW, 2026-08-29) — whisper (F7), sheet-header-is-the-card,
  Reply writes `re`, pinned-root fold/expand, deleted-root stub. Real jsdom DOM,
  click-driven. **Only exercises a thread with 0 or 1 existing reply — never
  clicks Reply on a root that already has a reply rendered under it.**
- `notes-threads.test.mjs` (NEW) — pure model: server accepts/refuses replies,
  out-of-order sync, threadsFor grouping, pinned-root sort, tombstoned-root stub,
  orphaned-reply-as-root, reply counts. All logic-only, no DOM.
- `now-line.test.mjs` — today's now-line positioning/timezone
- `overlap.test.mjs` — same-stage lane math
- `person.test.mjs`, `person-client.test.mjs` — me-link (F17)
- `portola-2026.test.mjs` — Portola fixture sanity
- `router.test.mjs` — layer stack, back/forward, notes-sheet route-key tagging (F10)
- `scheduled-sections.test.mjs` — set-times grid sectioning
- `spotify-flow.test.mjs`, `spotify-playlist.test.mjs` — F13
- `state-sync.test.mjs`, `sync-hardening.test.mjs` — offline/sync (F15)
- `storage-blocked.test.mjs` — storage-blocked device boot
- `sw-data-network-first.test.mjs` — SW cache strategy for /api and festival JSON
- `sw-stamp.test.mjs` (NEW) — CACHE_VERSION/ASSET_STAMP hashing
- `time.test.mjs` — time parsing/flooring
- `two-weekend-schedule.test.mjs` — W1/W2 weekend filtering
- `v3-aura.test.mjs`, `v3-model.test.mjs` — pure model/aura logic incl. the
  **`tap cycle 0->1->2->3->4->0` test — this is `model.nextTapLevel()` only,
  never the DOM click handler in `wall.js` or the zoom-interaction guard in
  `app.js`.**
- `wall-dom.test.mjs` — card render/refresh DOM shape (grid placement, lane split)
- `wall-filters.test.mjs` — pure filter helpers, scheduled-grid people/solo
  filtering, scrollspy re-sync, rail labels. **117 lines were deleted from
  this file on this branch — see finding below; verified NOT a coverage gap.**

## FINDING 1 (P0) — The zoom (this round's headline feature) has ZERO test coverage, and jsdom structurally cannot catch the layout bug Kevin is reporting

`card-facts.js` exports `zoomCard`, `unzoom`, `wireCardZoom`, `wireCardFocusZoom`,
`dismissZoom`, `zoomedCard`, `zoomSource` — none of these names appear in any
test file (`grep -rln "zoomCard\|wireCardZoom" tests/*.mjs` → empty).
`notes-round.test.mjs` tests the *sheet* (which reuses the same facts
component) but never touches the wall-card zoom path itself.

Kevin's report: *"the whole row animates and resizes when only the one card
should... the animation seems to slow and make the site jitter."* Reading
`card-facts.js:370-379` (`zoomCard`):

```js
zoomed = { el, artist: artistName, source, grown, anims: [], rest, ... };
el.appendChild(grown);
el.classList.add('zoom');
el.style.width = `${target}px`;
el.style.marginLeft = `${Math.round(shift)}px`;
el.style.minHeight = '132px';
el.style.zIndex = '30';
```

The zoomed card is a **grid item that grows in place** — no
`position: fixed/absolute` is applied to `el` itself (only a hidden
off-screen `.zoom-probe` uses `position: absolute`, line 335). Growing one
cell's `min-height`/`width` inside a shared CSS Grid row (`.times-grid` /
`.wall-grid`, `grid-auto-rows`) resizes that row's track for every card in
it — which is exactly "the whole row... resizes." And in `app.js:139-143`
(`refreshArtistCards`), **every pick tap while a card is zoomed re-runs
`zoomCard(...)` on the fresh post-refresh node**:

```js
const fresh = [...els].map((el) => refreshCard(el, artistName, ctx));
if (keepZoom && fresh[0] && fresh[0].isConnected) {
  const target = fresh.find((el) => el.matches(':hover')) || fresh[0];
  zoomCard(target, artistName, ctx, { ..., instant: true });
}
```

`refreshCard` (`wall.js:227-244`) does `el.replaceWith(fresh)` — a brand-new,
un-zoomed DOM node — and then `zoomCard(..., instant:true)` re-applies the
grow. So **every single tap on a card you're hovering (desktop) re-triggers
the full grow sequence**, which is the row "punching out" repeatedly and the
jitter Kevin describes. `instant: true` is meant to skip the FLIP morph, but
it does not change that `el.style.width/minHeight` are being set fresh each
time on a grid item — the reflow cost is paid every tap regardless.

Even if a test existed here, **jsdom's `getBoundingClientRect()` always
returns all-zero rects** — `rect(el)` in `card-facts.js` would return
`{width:0, height:0, ...}` for every element in Node, so `target`, `growth`,
and `shift` all compute against zeros. A Node/jsdom test can verify classes
and inline style *strings* got set, but it can never observe the actual
row-reflow Kevin is seeing on a phone — this is the *same class of blind
spot* CLAUDE.md already documents ("Node tests are blind to two browser
rules," 2026-08-27) recurring in a brand-new subsystem that shipped through
3 Codex gates and a Sonnet walk anyway. **Recommend**: pin the zoomed card
out of grid flow (e.g. `position: absolute`/`fixed` over a placeholder that
holds the grid cell's size) rather than resizing the grid item itself — that
is a design/CSS fix outside this dimension, but the *test-coverage* fix
within this dimension is: add at minimum a jsdom shape/regression test that
asserts `zoomCard` does NOT mutate `el.style.width/minHeight` on the grid
item directly (only on a wrapper), so this class of bug cannot silently
return — and treat any zoom/grid interaction as requiring the real-browser
walk CLAUDE.md already mandates before every promote.

## FINDING 2 (P1) — F4's tap-to-cycle-pick journey has no DOM-level test at all

`docs/user-flows.md` F4: *"Tap a card → pick cycle 0→1→2→3→must→0."* The
only test that exercises this is `tests/v3-model.test.mjs:58`, `'tap cycle
0->1->2->3->4->0'` — this calls **`model.nextTapLevel()` directly**, a pure
function. Nothing in the suite drives an actual `click` event through
`wall.js`'s card click handler (`wall.js:208-217`) or through
`app.js`'s `handleTap`/`onZoomTap` wiring. That handler chain is exactly
where Kevin's "multiple taps no longer increases pick intensity" symptom
would live — e.g. `ctx.onZoomTap(el)` (app.js:77-80) swallowing a tap when
`zoomSource() === 'touch'`, or the re-zoom-on-every-tap behavior in Finding
1 masking/mangling the tap. No test in the repo would fail if either of
those regressed. This is the second load-bearing journey this round shipped
with only pure-function coverage over the interactive path that actually
broke.

## FINDING 3 (P1) — `docs-truth.test.mjs` does not check `docs/user-flows.md`, the one doc explicitly billed as canonical

`docs-truth.test.mjs`'s `CURRENT_DOCS = ['README.md', 'CLAUDE.md', 'AGENTS.md']`
(line 24). `docs/user-flows.md` opens with: *"This is the canonical inventory
of what a user can do and what correct looks like... a mismatch is always a
finding"* and project `CLAUDE.md`/the doc's own footer say it's "maintained
as part of every design/UX change." None of that is enforced by CI — only a
manual browser walk (the design-audit workflow) catches drift, and that
workflow was NOT run for this round (NOW.md records Codex + a Sonnet
real-click walk, not the F1–F17 audit walk). In this specific round the doc
was hand-updated correctly (F6/F7/F11 verified against code below — no drift
found), so this is a **structural gap, not an active lie** — but it means
the doc's only defense against silent rot is human diligence, exactly the
failure mode `docs-truth.test.mjs`'s own header comment says it exists to
end ("Docs that CAN drift eventually DO drift"). Recommend at minimum a
cheap smoke check — e.g. every screen-name/flow-id user-flows.md references
(F1..F17) still has a matching entry point in the router/app, so a fully
orphaned flow at least fails loudly.

**Verified NOT drifted this round** (so this is a process gap, not a doc
lie today): F6 zoom description matches `card-facts.js`/`wall.js` behavior;
F7 whisper matches `notes.dayWhisper`; F11 "pick-as lives in Settings → You
ONLY" matches `filters.js:112-114`'s explicit comment that the chip
hold/arm/hover-door mechanism "is gone with it."

## FINDING 4 (P2, resolved as non-issue on inspection) — the deleted 117 lines of `wall-filters.test.mjs` are retired coverage for a retired feature, not a lost gap

`git diff main..notes-desktop-round -- tests/wall-filters.test.mjs` removes
two tests: the chip-gesture hold/arm/switch state machine, and its
WebIDL-receiver regression test ("the default timers survive being called
as a method"). Both covered the **hold-a-member-chip-to-pick-as-them**
gesture. `filters.js:112-114` (current code) states outright: *"who they
pick as; a hold + arm + confirm dance on the wall, and a hover door... is
gone with it."* `grep` confirms no `chipGesture`/`armedName`/`cancelHold`
call sites remain anywhere in `js/`. This matches Kevin's 2026-08-29
decision recorded in NOW.md ("pick-as lives in Settings → You ONLY... the
chip hold, the arm and the hover door are gone"). So: **the coverage was
correctly retired alongside the feature it tested — nothing needs to move.**
One residual note: the WebIDL "Illegal invocation" regression stub (a
documented CLAUDE.md lesson with teeth) no longer exists anywhere in the
suite. I checked every new timer call site in this round
(`card-facts.js:430-448`, `wall.js:173/978/995`, `app.js:1777`) — all call
`setTimeout`/`clearTimeout` as bare global functions, never stored on an
object and invoked as `obj.method()`, so none are at risk of the same bug.
No action needed today, but if a future round stores a timer handle as an
object property and calls it as a method again, nothing in the suite would
catch it — the generic defense is real-browser walks, which CLAUDE.md
already mandates.

## FINDING 5 (P2) — the reply composer is single-instance/shared state, and the one case Kevin flagged ("reply under an existing reply is so strange") is exactly the untested case

`notes.js:289` — `let replyTo = null;` inside `composer()`: **one composer
per sheet**, retargeted by `setReply(note)` (line 295-306), which only
changes a text label (`Replying to ${note.author}`) and the input's
placeholder — the composer itself does not move to sit near the thread.
`notes-round.test.mjs`'s Reply test (line 65-96) only covers a **root with
zero existing replies**: it clicks Reply once, types, saves, and checks the
result. No test clicks Reply on a root that *already has a visible reply*
rendered under it (the reply lives in `.n-replies`, one gutter in per F6),
which is precisely the scenario Kevin describes — the Reply affordance
lives only on the root's head line (`renderThreads` in notes.js:246,
`onReply: onReply ? () => onReply(t.root) : null` — replies never get their
own Reply action, by the one-level-deep design), so clicking Reply while
your eyes are on the existing reply at the bottom of the thread reopens a
composer scoped to the root above it, with only a small text-label as the
cue. Design fix is outside this dimension; the coverage gap is in it: add a
test with an existing reply present, click Reply on the root, and assert
what a person actually sees (label text, composer position/scroll, whether
the existing reply stays visible) before this UI is reshaped.

## FINDING 6 (P2) — Lost Lands festival data is stale exactly the way Kevin says, and nothing in CI could catch it

Kevin: *"the lost lands description not getting the cleaned up description
for before/afters that we did to Portola."* Confirmed via direct file
inspection:

- `data/festivals/portola-2026.json` `meta.researchedAt: "2026-08-27"`,
  `meta.note` is a long, current methodology narrative — sourcing, per-stage
  cross-checks, an explicit "Afters"/"Folsom" section design, a
  weekend-conflict map for planning. It has `days`, `dayMeta`, and
  `timezone` keys.
- `data/festivals/lost-lands-2026.json` `meta.researchedAt: "2026-07-07"`
  (seven weeks earlier, before the Portola-style afters research pattern
  existed) and its `meta.note` is a plain bill-tier explainer with no
  before/afters sourcing narrative at all. It has **no `days`, `dayMeta`, or
  `timezone` keys** despite `meta.announcementStatus: "lineup-with-days"` —
  the only day information is a bare `day` string on 21 of 117 `artists[]`
  entries (`"Wednesday, Sept 16 (Early Arrival Pre-Party)"` /
  `"Thursday, Sept 17 (Early Arrival Pre-Party)"`), the rest `undefined`.
- `scripts/validate-festivals.mjs` (76 lines) only checks JSON validity,
  presence of `id`/`name`/`status`, `startsOn` date format, index/file
  parity, and the frozen-pick-key rule — it has and can have no concept of
  "is this festival's research as deep as its peers," so this class of
  drift is invisible to CI by construction, not by oversight. This is a
  content-freshness problem, not a schema-validity one — flagging here
  because it is squarely "docs/data truth" and because Kevin named it
  directly; the actual re-research is festival-data work, not a code fix.

## Repo hygiene checks (clean unless noted)

- **No secrets/tokens leaked**: `git grep` for `#g=` across all tracked
  files turns up only code (`js/crew.js`, `js/spotify.js`, `js/v3/app.js`,
  `js/v3/router.js`) and doc *placeholders* (`badtoken1234567890123456` in
  two audit-workflow scripts, `#g=…` ellipsis in the canvas build script).
  No real crew token found in any tracked file.
- **Nothing sensitive is tracked that shouldn't be**: `screenshots/`,
  `.env*`, `.DS_Store`, `.playwright-mcp/`, `.remember/` are all present on
  disk but confirmed untracked (`git ls-files` returns zero hits for each) —
  `.gitignore` is doing its job.
- **`package.json`**: `test` script (`node --test tests/*.test.mjs`) matches
  what CI and README actually run. `build` is an intentional no-op comment,
  matches "no build step" claims everywhere else. Dependencies match usage
  (`@neondatabase/serverless` prod; `jsdom` + `@electric-sql/pglite` dev).
  No stale/removed-tech references.
- **`.github/workflows/ci.yml`**: runs `npm test` twice (once under
  `TZ=Asia/Tokyo`, a deliberate anti-regression per its own comment),
  `scripts/validate-festivals.mjs`, and `npm audit --omit=dev
  --audit-level=high`. Matches every claim NOW.md/CLAUDE.md make about CI
  gates. No gaps found.
- **`README.md`**: passes every `docs-truth.test.mjs` assertion (verified by
  running the suite); manually re-checked the pick vocabulary
  (`picked ×1 → ×2 → ×3 → must → clear`, matches CLAUDE.md's 0-4/must
  model), the structure block (spot-checked several paths, all exist), and
  the festival count claim (11, matches `index.json`). No mention of the
  notes/desktop round's zoom or threading — acceptable at README's level of
  detail (it's a feature overview, not exhaustive), not a finding.
- **`gallery.html`**: diff shows it was correctly updated for the whisper +
  threaded-notes pattern this round (day-rule → `day-whisper` button → `n-list`/
  `n-thread`/`n-replies`, and the sheet's `.sheet-card` header). It is *not*
  stale — and it independently corroborates Kevin's "too many options in the
  top row of a comment" complaint: the demo markup shows a root's `.n-head`
  literally containing name · timestamp · Reply · Unpin as one text line
  (`gallery.html`, the day-rule section) — the real UI Kevin is reacting to,
  faithfully mirrored.
- **`claude-plans/`**: no `archive/` subfolder exists (the workspace
  convention in `~/DevKev/CLAUDE.md` calls for moving plans older than the
  current quarter into `claude-plans/archive/YYYY/`). 24 loose top-level
  files span 2026-07-07 through 2026-08-29; most are within the current
  quarter so this is low urgency (P3), but `v3-inventory.md` (a *live*
  reference the project's own CLAUDE.md cites as canonical token/algorithm
  source) sits undifferentiated next to pure one-off session history
  (`2026-07-12-v31-stage4-audit-backlog.md`, 55 KB) — worth a pass next time
  a plan gets archived anyway, not urgent on its own.
- **`NOW.md`**: 47 KB / long, but it is genuinely a live handoff, not a
  wall — the top ~230 lines read as a coherent narrative (what shipped, what
  Kevin decided, what's open) and older entries below are clearly
  chronological history a reader can stop reading once oriented. Matches the
  "good handoff" bar; no restructuring needed.
- **`AGENTS.md`** is a symlink to `CLAUDE.md` (verified) — no drift risk
  between the two by construction.

## Journeys walked (docs/user-flows.md) and their test status

- F1 First visit — tested (`fest-first.test.mjs`)
- F2/F2b Add festivals / add people — tested (`fest-first`, `invite-context`)
- F3 Join via link — tested (`invite-context.test.mjs`)
- F4 Wall lineup + tap cycle — **model-only tested, DOM path untested (Finding 2)**
- F5 Set-times view — tested (`scheduled-sections`, `wall-dom`, `two-weekend-schedule`)
- F6 Notes — artist scope / the zoom — **notes DOM tested well; the zoom itself untested (Finding 1)**
- F7 Notes — day scope / the whisper — tested (`notes-round.test.mjs`)
- F8 Notes — festival scope / all-notes — logic tested (`notes-threads`), no dedicated DOM test for the ALL NOTES view assembly found
- F9 Day navigation — not directly unit-tested (scrollspy tested at the filter level in `wall-filters.test.mjs`)
- F10 Browser navigation — tested (`router.test.mjs`)
- F11 Settings — pick-as-in-Settings-only — verified against code (Finding 4), no dedicated settings.js DOM test found for the switch itself
- F12 Add a festival (AI) — not covered by this test suite (server-side Gemini call; expected, hard to unit test)
- F13 Spotify — tested (`spotify-flow`, `spotify-playlist`)
- F14 Export/share — tested (`bulk-v4`, `day-image-sections`)
- F15 Offline/PWA — tested (`sw-data-network-first`, `sync-hardening`, `state-sync`, `storage-blocked`)
- F16 Lost states — not directly found in this pass (likely covered by the manual audit walk, not unit tests)
- F17 Me link — tested (`person`, `person-client`)

## Open questions for Kevin / other dimensions

- Finding 1 (the zoom's grid reflow) is the strongest, most directly
  evidence-backed match to Kevin's literal bug report. The fix is a CSS/
  layout decision (pull the zoomed card out of grid flow) that belongs to
  whichever subagent owns visual/interaction design — flagging the
  connection here since it explains WHY the test suite has nothing to say
  about it.
- Finding 6 (Lost Lands) is a content/data-research gap, not a code bug —
  surfacing it here because Kevin named it directly and it was easy to
  confirm, but the actual fix is festival research work.

## Skeptic

Verified against the actual files/lines for all six findings by reading the
cited code directly (not re-deriving from the writeup). Verdicts below;
"missed" section follows.

### F1 (P0, the zoom's grid reflow) — CONFIRMED, P0 stands, with one scope correction

`grep -rln "zoomCard|wireCardZoom" tests/*.mjs` reproduces empty, confirming
zero coverage. `card-facts.js:370-379` (`zoomCard`) reproduces exactly as
quoted — no `position:` set on `el` itself, only `.card.zoom { overflow:
visible; z-index: 30; }` in `assets/v3.css:620` (no position change there
either). `app.js:139-143` (`refreshArtistCards`) reproduces exactly: every
`handleTap` (line 146) calls `refreshArtistCards`, which `unzoom()`s and
re-`zoomCard(..., instant:true)`s on the fresh node on every tap while
zoomed — confirmed by reading `handleTap` at app.js:146-168.

One correction to the reasoning, not the verdict: the finding treats
`el.closest('.times-grid, .wall-grid')` (card-facts.js:343) as one
uniform risk, but the two grids behave differently. `.wall-grid`
(assets/v3.css:509) sets no `grid-template-rows`/`grid-auto-rows`, so its
rows size to content — a card's `minHeight: 132px` growing there **does**
enlarge the shared row for every sibling, exactly as described. `.times-grid`
(the F5 set-times timetable) gets an **explicit fixed row template**,
`grid.style.gridTemplateRows = repeat(${rows}, 20px)`, set in
`js/v3/wall.js:709` and `:715` — fixed-length tracks don't grow from a
child's content or explicit size; the zoomed card would instead overflow
visually within the fixed rows (which `overflow: visible` on `.card.zoom`
permits), not resize the row track. So "resizes the shared row for every
sibling" is accurate for the wall/lineup view (F4) and not for the set-times
timetable (F5) — the finding's own journey tag ("F6 Notes — artist scope")
is also off; the zoom lives on the wall (F4) and is reused as a static
header in notes, per card-facts.js's own top-of-file comment. None of this
changes severity: the wall-grid case is real, reproducible from the code
alone, and independently corroborated by two other survey dimensions this
round (`design-system.md:69-94`, `zoom.md:90-129`) quoting the same Kevin
complaint and reaching the same root cause — that's real signal, not
double-counting, since each dimension traced it independently through
different code paths (grid semantics vs. the tap-refresh path).

### F2 (P1, tap-cycle only pure-function tested) — CONFIRMED

Line citations check out exactly: `wall.js:208` opens the card's `click`
listener (`el.addEventListener('click', (e) => {`), and its body through
line 217 matches the quoted `onZoomTap`/`onTap` dispatch. `app.js:77-80`
(`onZoomTap`) reproduces verbatim. `tests/v3-model.test.mjs:58` is exactly
`test('tap cycle 0->1->2->3->4->0', ...)` calling `model.nextTapLevel()`
with no DOM. `grep` for a click-driven pick-cycle test anywhere in
`tests/*.mjs` confirms none exists.

### F3 (P1, docs-truth.test.mjs doesn't watch user-flows.md) — CONFIRMED, minor line-citation error

`CURRENT_DOCS = ['README.md', 'CLAUDE.md', 'AGENTS.md']` is real, but lives
at `tests/docs-truth.test.mjs:28`, not line 24 (line 24 is a blank line
inside the file's opening comment block) — the substance is unaffected.
`docs/user-flows.md:9-11` reproduces the "canonical inventory... a mismatch
is always a finding" language exactly. Cross-checked against NOW.md: this
round's verification really was a Sonnet real-click walk (NOW.md:80,
"Sonnet walker's final report: A–E all PASS"), not the F1–F17 audit walk —
confirms the "not run this round" claim rather than taking it on faith.

### F4 (P2, reply composer is single-instance / untested nested-reply case) — CONFIRMED

`notes.js:289` (`let replyTo = null`) and `setReply` (opens at notes.js:294,
finding says 295 — off by one, immaterial) reproduce as described.
`renderThreads` (notes.js:206-268): root rows get `onReply` (line 246);
reply rows (rendered in the `.n-replies` loop, lines 257-263) are built with
only `onEdit`/`onDelete` — no `onReply` key at all — so `noteRow`'s `if
(opts.onReply)` gate (notes.js:164) can never fire for a reply. Confirmed a
Reply action can only ever exist on the root, never on a reply itself.
`notes-round.test.mjs`'s only Reply test (line 65) creates a root with zero
existing replies, replies once, and asserts the write — it never renders a
thread with an existing reply first. The exact case is untested, as claimed.

### F5 (P2, Lost Lands stale) — CONFIRMED

Direct JSON inspection matches exactly: `lost-lands-2026.json` `meta.
researchedAt` is `"2026-07-07"`, no `days`/`dayMeta`/`timezone` keys despite
`announcementStatus: "lineup-with-days"`; `portola-2026.json` `meta.
researchedAt` is `"2026-08-27"` and does carry `days`/`dayMeta`/`timezone`.
`scripts/validate-festivals.mjs` has no depth/freshness concept — confirmed
by reading it; it checks shape only.

### F6 (P3, deleted chip-gesture tests correctly retired) — CONFIRMED, no action needed

`git diff main..notes-desktop-round -- tests/wall-filters.test.mjs` shows
exactly 117 deletions, 0 insertions. `filters.js:109-113`'s comment states
the hold/arm/hover-door mechanism "is gone with it" — confirmed, and `grep`
for `chipGesture|armedName|cancelHold|armFor|HOLD_MS|ARM_MS` across `js/`
returns zero hits. Checked every `setTimeout`/`clearTimeout` call site added
this round (`card-facts.js:430-448`, `wall.js:173/978/995`, `app.js:1777`)
myself — all are bare global calls, none stored on an object and invoked as
a method, so the WebIDL-receiver risk the retired regression test guarded
against is genuinely absent today. Assessment holds.

### Missed

1. **`tests/db-concurrency.test.mjs` — the one test that would catch a
   regression to the BANNED pre-lock-CTE merge (the exact bug that lost 2/6
   concurrent writes in production, per the test's own header comment and
   CLAUDE.md) — never runs in CI, and the survey's "274 pass/1 env-skip"
   framing doesn't say so.** `db-concurrency.test.mjs:27-28` gates on
   `process.env.DATABASE_URL`; `.github/workflows/ci.yml` sets no such
   secret anywhere in the workflow (checked the whole file). So CI's green
   checkmark for this PR verified merge *semantics* (`db-merge.test.mjs`,
   which the file's own comment calls "a rubber stamp" for concurrency) but
   never re-ran the actual concurrency proof — that only happens if a human
   manually exports `DATABASE_URL` to a scratch Neon branch and runs it by
   hand. Grepped NOW.md/DEVLOG for any sign it was run this round: no
   mention, only the historical 2026-07-12 record. This is the single
   highest-severity documented regression class in the project (verified in
   `db/schema.sql`'s neighborhood and CLAUDE.md's "Crew store" section) and
   its only real test is silently CI-invisible on every PR including this
   one. Worth a line in the survey's hygiene section, not just a word
   ("env-skip") in the intro stat.

2. **The reply-flattening logic that's supposed to enforce "one level deep"
   has zero test coverage at any layer**, which is a sharper version of
   Finding 4's point. `notes.js:466` and `:535` call
   `addNote(ctx, scope, target, text, replyTo ? (replyTo.re || replyTo.id) :
   null)` — the `replyTo.re || replyTo.id` is the actual code that would
   collapse a reply-to-a-reply onto the true root, matching model.js:139-141's
   comment ("replying to a reply attaches to the root"). Today it's dead
   code from the UI's perspective (`onReply` in `renderThreads` only ever
   passes `t.root`, never a reply — confirmed above), but it's real
   production logic protecting the one-level-deep invariant the rest of the
   thread UI assumes (pinned-root collapse, `.n-replies` rendering). `grep`
   for `replyTo.re` or any nested-reply scenario across
   `tests/notes-round.test.mjs` and `tests/notes-threads.test.mjs` returns
   nothing — if a future refactor ever wired a reply's own Reply action (an
   easy next step given Kevin's UX complaint in Finding 4), this is the line
   that would need to keep working, and nothing would catch it breaking.

3. Minor: `AGENTS.md` is a symlink to `CLAUDE.md` (`ls -la` confirms), so
   `docs-truth.test.mjs`'s `CURRENT_DOCS` list checks the same file's
   content twice under two names. Harmless (not a bug, no wasted assertions
   fail differently), but worth knowing if `CURRENT_DOCS` is ever used to
   reason about "how many docs are covered."
