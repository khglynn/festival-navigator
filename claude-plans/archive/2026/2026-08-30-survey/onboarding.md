# Onboarding survey — first visit / add fests / join / share / add people

Dimension: F1–F4 + share/me-link (docs/user-flows.md). Branch `notes-desktop-round`
(PR #13). Walked 2026-08-30 against `git diff main..notes-desktop-round`.

Files read whole: `js/v3/app.js` (all 1861 lines), `js/crew.js`, `js/v3/router.js`,
`api/access.js`, `api/person.js`, `api/festival-add.js`, plus the parts of
`js/v3/tools.js`, `js/v3/model.js`, `js/v3/settings.js` needed to trace fields
and confirm/deny each finding. `npm test` green (274/275, 1 env skip) before
and unaffected by this read-only pass.

---

## Findings

### 1. [P1] Settings still renders CREW above YOU — Kevin's explicit ask not done on this branch

- **File:** `js/v3/settings.js:666-668`
- **Evidence:**
  ```js
  main.appendChild(festivalsSection(ctx, actions));
  main.appendChild(crewSection(ctx, actions));
  main.appendChild(youSection(ctx, actions));
  ```
  Kevin, verbatim, in this review's kickoff: *"Let's move 'You' above 'Crew' in
  the settings."* The order today is Festivals → Crew → You — CREW still comes
  first. Worth noting: the file's own top-of-file comment (`settings.js:2`,
  `// Order: YOUR FESTIVALS -> YOU -> APP.`) doesn't even mention Crew, so the
  code has drifted from its own stated intent independent of Kevin's new ask —
  Crew was added into the middle at some point and the order comment was never
  updated.
- **Journey:** F11 (Settings, one page two doors) — not a broken journey, but a
  named, unambiguous product decision that isn't reflected in the code Kevin is
  being asked to approve.
- **Fix:** swap the two `appendChild` calls (`youSection` before `crewSection`),
  and update the line-2 comment to `YOUR FESTIVALS -> YOU -> CREW -> APP` so it
  stops lying about its own order.

### 2. [P1] Lost Lands' onboarding date line is a two-clause run-on that wraps to two lines — exactly the screenshot Kevin flagged

- **File:** `data/festivals/index.json` (the `dates` field), rendered via
  `js/v3/tools.js:37` (`festRow`), used by `js/v3/app.js` `renderCreate()` (the
  PICK YOUR FESTS screen) and by Settings → Your festivals.
- **Evidence:** `index.json`'s `dates` field, per festival:
  - `lost-lands-2026`: `"September 18–20, 2026 (main festival, Fri–Sun); a
    separately-billed \"Early Arrival\" pre-party runs Wednesday Sept 16 and
    Thursday Sept 17"` — one long sentence, two independent clauses joined by a
    semicolon, with an embedded quoted phrase. This is what `festRow`'s
    `.fest-dates` sub-line renders verbatim (`tools.js:37`:
    `sub !== undefined ? sub : (f.dates || '')`) — there's no truncation, no
    line-length awareness, it just wraps.
  - `portola-2026`: `"September 26–27, 2026"` — one clean date range, renders
    on one line.
  This is the exact contrast in Kevin's screenshot ("LOST LANDS with a
  two-line date sentence, PORTOLA with a clean one"). The field and the file
  are `dates` in `data/festivals/index.json` — not the per-fest JSON (see
  finding 3, which is the *other* `dates`).
- **Journey:** F2 (PICK YOUR FESTS) and F11 (Settings → Your festivals) — both
  read the same index and both wrap the same way; a batch-add screen with
  wildly uneven row heights is the first thing a new device sees.
- **Fix:** this is a product/copy call, not a code bug — shorten Lost Lands'
  (and ACL's, which has the same run-on shape) `index.json` `dates` field to a
  single clean range matching Portola's pattern, and move the Early
  Arrival/afters detail somewhere a user encounters it in context (the fest's
  own wall header, or a day-section label) rather than the dense multi-pick
  list where every other row is one line.

### 3. [P2] `dates` is duplicated across two files with no drift check — already diverged for Portola

- **Files:** `data/festivals/index.json` (`dates` per entry) vs. the per-fest
  file, e.g. `data/festivals/portola-2026.json` (its own `dates` field),
  surfaced via `js/v3/app.js:184` in `applyFestTheme()`:
  `$('fest-sub').textContent = [fest.subtitle, fest.dates].filter(Boolean).join(' · ')`
  (`fest` here is `state.fest()`, the loaded per-fest doc — NOT the index).
- **Evidence:** `index.json` → Portola `dates`: `"September 26–27, 2026"`.
  `portola-2026.json` → Portola `dates`: `"September 26–27, 2026 · doors 1 PM"`.
  Same field name, same festival, two different values, already out of sync —
  and nothing catches it: `tests/docs-truth.test.mjs` only enforces that the
  festival *list* lives solely in `index.json`, not that a shared field stays
  consistent between the index and the per-fest doc. `scripts/validate-festivals.mjs`
  doesn't cross-check either (confirmed via a run: 0 errors, 1 unrelated warning).
- **Journey:** cuts across F1 (landing rows), F2 (pick-your-fests), F11
  (Settings), and F4/F5 (wall header) — a person could plausibly see three
  different "when is this" strings for the same festival across three screens
  as more fests get "doors 1 PM"-style detail added to their own file but not
  the index (or vice versa).
- **Fix:** either rename one of the two fields so they're honestly different
  things (e.g. `index.json`'s stays `dates` — the short list-view string — and
  the per-fest file's becomes `datesDetail` or similar for the wall header), or
  derive the index's `dates` from the fest file at build/validate time so
  there's one source of truth. At minimum, add a validator check that flags
  when a catalog fest's index `dates` and fest-file `dates` disagree.

### 4. [P2] Onboarding copy still teaches "hold = notes" in two places; hold now zooms first

- **Files:** `js/v3/app.js:445` (first-wall coach mark) and
  `js/v3/settings.js:369` (the coach mark's own "How it works" page, opened by
  the coach mark's "How it works" link — `app.js:449-454`).
- **Evidence:**
  - `app.js:445`: `msg.append('Tap artists to add your color. 4 taps = MUST
    SEE. Hold for notes. Tap a name or a stage to see just that. ');`
  - `settings.js:369`: `}, 'Hold a card for notes.', 'Violet = crew notes;
    pin one to keep it on top. Green = it's in your Spotify (connect in
    Settings).'));`
  Per NOW.md's own 2026-08-29 decision record: "the hover/hold ZOOM is the
  card itself growing... the existing notes button is the one door to
  comments and rides along in the zoom" — i.e. hold now opens the zoom, and
  notes is a second, deliberate tap on the zoom's notes chip (matches
  `docs/user-flows.md` F6: "hold a card (~500ms) → the card ZOOMS in place...
  Tap its notes chip → artist sheet"). Both onboarding surfaces still tell a
  brand-new user that holding *is* how you get to notes, which is one step
  short of true today.
- **Journey:** F6 (notes via the zoom) as taught by F1's first-wall coach mark
  — this is literally the sentence a first-time user reads to learn the app's
  core gesture vocabulary, and it undersells what actually happens (a card
  grows first) while overselling how many taps notes takes.
- **Note:** NOW.md already flags the coach-mark line as open for Kevin's
  wording call ("leave or reword"), but only names the one line in app.js —
  the identical staleness is duplicated verbatim in the "How it works" drill
  the coach mark itself links to, so fixing one without the other leaves the
  contradiction standing right behind the "learn more" link.
- **Fix:** reword both to something like "Hold a card to see who's going —
  tap its notes chip to write one." (or whatever phrasing the desktop-hover
  round settles on), and change either line without the other.

### 5. [P3] "MUST SEE" copy contradicts the project's own stated vocabulary

- **Files:** `js/v3/app.js:445` (`"4 taps = MUST SEE."`) and
  `js/v3/settings.js:360` (`"Four taps = I MUST SEE THIS."`).
- **Evidence:** CLAUDE.md: *"UI vocabulary is exactly: picked / must / notes /
  fest... old \"Must See\"=3 IS must — labels, not alphas, carry the
  semantics."* — "Must See" is named explicitly as the retired legacy label.
  The current canonical label, used everywhere else in code, is `LEVEL_LABELS_V4
  = { ..., 4: 'Must' }` (`js/parse.js:20`), and `js/v3/wall.js:81` lower-cases
  it to `'must'` for its own aria text. Two onboarding copy lines still say
  "MUST SEE" — the exact legacy term the rule calls out.
- **Journey:** F1/F6 — the two places a new user is taught the pick-cycle
  vocabulary both use the deprecated word.
- **Fix:** "4 taps = MUST." / "Four taps = I MUST GO." (or similar) — align
  both lines to "must," not "must see."

---

## Journeys walked (against docs/user-flows.md)

- **F1 First visit** — landing (YOU card gating, FESTIVAL rows date-sorted via
  `model.landingPairs`, avatar clusters, "just you" solo copy, uncached-crew
  fallback row, blocked-storage guard on row tap) — matches spec. No findings
  beyond #2/#3 above (the row's date sub-line).
- **F2 Add festivals (multi-pick)** — `renderCreate` → `createStepName` (once
  per device) → `batchCreateFlow` (single-fest → wall + share moment;
  multi-fest → landing + toast; mid-batch failure reporting; 8-fest rate-limit
  guard; selection surviving the name step; apostrophe-stripped crew names) —
  matches spec. Findings #2/#3 above are the only defects found in this flow.
- **F2b Add people (+ Add)** — `openAddMember` (recurring-people chips via
  `model.otherFestPeople`, case-insensitive existing/removed-member handling,
  crew-switch-mid-flight guards, offline fallback, minted `&me=` link on
  success) — matches spec exactly, including the approved copy
  ("Send X this link. Opening it makes the picks theirs."). No findings.
- **F3 Join via shared link** — `renderJoin` (fest context from `&f=`/doc
  stamp, `&me=` hint floats + marks the matching row, case-insensitive
  returning-member claim by tap or by typing, server-first join with offline
  fallback) — matches spec. No findings.
- **F11 (touched only for the Kevin ask)** — `crewSection`/`youSection` order
  and content: member-chip linked-vs-placeholder line matches spec exactly;
  only the section *order* is wrong (finding #1).
- **F12 Add a festival (Gemini research)** — `openAddFestival` +
  `api/festival-add.js` (research → full-lineup-reviewable preview → sources
  cited or honestly absent → save/discard, id-collision suffixing against the
  real catalog only) — matches spec well; no findings.
- **F17 Me link** — `crew.js` (`myPerson`, `meLink`, `personFromHash`,
  `hashHasBrokenPersonLink`, `ensurePerson`, `mayStampPerson`,
  `stampPersonCrew`) + `app.js` (`restoreFromMeLink`, `absorbPersonDoc`,
  `boot()`'s synchronous hash-strip before any await, the canonical-host-hop
  absorb via `sessionStorage`) — matches spec, including the union-never-
  removes contract, the broken/deleted/offline copy differentiation, and the
  person token traveling only via `X-Person-Token` header (`api/person.js`,
  never a query param). No findings.
- **Share moment / share sheet** — `openShareMoment` copy
  ("Opens straight into {fest}. No accounts needed.") matches the exact
  2026-08-29-approved copy in NOW.md. No findings.
- **api/access.js** — Spotify allowlist request flow (Slack notify, HMAC
  approve links, host allowlist) — read for completeness; not an onboarding
  journey per se, no findings relevant to this dimension.

## Adjacent observation (not this dimension, flagging for whoever owns it)

Kevin's report *"multiple taps no longer increases pick intensity"* very
plausibly traces to the new hold-to-zoom gesture racing the tap-to-cycle
gesture: `ctx.onZoomTap` (`js/v3/app.js:77-80`) makes a tap on an
already-zoomed touch card *dismiss the zoom instead of picking* — if a fast
double/triple tap gets misread as a hold-then-tap by the browser's touch
timing, the second tap would dismiss rather than cycle, breaking the "4 taps =
must" rhythm. I did not read `card-facts.js` (owns the actual timing/threshold)
so this is a lead, not a confirmed root cause — it belongs to whoever is
walking the wall/pick-mechanic/zoom dimension.

---

## Skeptic

Re-opened every cited file at the cited line and re-derived each claim from
the code itself (plus one independent JSON diff across all 12 catalog fests
for finding 3's scope). `git log` on `settings.js` and NOW.md were also
checked to corroborate the two copy-decision findings (4, 5) rather than
taking the reader's paraphrase on faith.

### 1. [P1] Settings still renders CREW above YOU — CONFIRMED

`settings.js:666-668` reads exactly as quoted: `festivalsSection` →
`crewSection` → `youSection`. Kevin's kickoff line ("Let's move 'You' above
'Crew' in the settings") is unambiguous and unmet. The line-2 comment really
does say `YOUR FESTIVALS -> YOU -> APP` with Crew absent, so the drift claim
is also real. Checked `youSection`/`crewSection` for any hidden coupling
(shared DOM ids, scroll anchors, order-dependent state) that would make the
swap non-trivial — found none; both are self-contained functions appended
independently. Independently corroborated by `settings.md`'s own F1 finding
in the same survey batch, written from a different file (settings.js is the
shared surface both reviewers hit). Fix is exactly as trivial as claimed.

### 2. [P1] Lost Lands' run-on date line — CONFIRMED, with one correction and one added nuance

The JSON and the rendering path are exactly as cited. But the finding's
evidence line "there's no truncation, no line-length awareness, it just
wraps" is factually wrong: `assets/v3.css:423-424` puts `-webkit-line-clamp:
2; overflow: hidden` on `.fest-dates`, and `settings.js:68-83`
(`currentFestCard`) carries an inline duplicate of the same 2-line clamp with
a comment explaining WHY: *"ACL runs two weekends and its date string says
so; clipping it to 'October 2-4, 20...' with a title= tooltip... could never
show the second weekend."* So the 2-line wrap is deliberate, working,
load-bearing design, not an accidental overflow — the real defect is that
Lost Lands' semicolon-joined, quote-embedded sentence is worse copy than the
budget was built for, not that the budget doesn't exist. This doesn't change
the severity: Kevin's own screenshot (`NOW.md` line 576, "the gear icon
stranded alone on the far left under Lost Lands' long date") independently
confirms this exact contrast was already flagged by a human, before this
survey ran — so P1 holds on real evidence, just correct "no truncation" to
"clamped at 2 lines by design, and the run-on still reads badly inside that
budget."

### 3. [P2] `dates` duplicated across index.json / per-fest file — CONFIRMED, scope verified, but the "Settings reads the index copy" claim is incomplete (see Missed #1)

Ran a full field-diff of all 12 catalog fests' `index.json` entries against
their per-fest JSON files (name/year/status/location/accent/dates) — Portola
is the *only* current divergence, exactly as the finding states (not
overstated, not understated). `app.js:184`'s per-fest read via `state.fest()`
is confirmed (`js/state.js:93: fest() { return FESTIVALS[activeFestivalId]; }`,
and `FESTIVALS[id]` is populated by `loadFestival()` fetching the per-fest
file — `js/festivals.js:21-28` — never the index). `tests/docs-truth.test.mjs`
and `scripts/validate-festivals.mjs` were both checked; neither cross-checks
the two `dates` values. Severity P2 is right — cosmetic, no functional
breakage, but real and unguarded.

### 4. [P2 as filed → P3] Coach-mark copy teaches "hold = notes" — PLAUSIBLE, severity overstated

Both quoted lines are real and accurately transcribed (`app.js:445`,
`settings.js:369`), and `NOW.md`'s "2026-08-29 notes/desktop round" entry
(line 66) confirms hold now opens the zoom first, notes is a further tap.
But `NOW.md` line 63 already lists this exact `app.js:445` line under **"Open,
Kevin's calls"** as a wording decision Kevin himself is aware of and hasn't
resolved ("his line — hold now zooms, notes one tap further; leave or
reword") — this is not an unnoticed bug, it's a tracked, deliberate open
item awaiting a product call. The finding's own body (not the condensed
summary I was handed) already says as much in its "Note" — good, that's the
right caveat — but the severity tag (P2) doesn't reflect it: half of this
finding is "known and pending," and the genuinely new contribution is
narrower than P2 implies (a second, untracked copy of the same staleness in
`settings.js:369`'s help page). Correct severity: **P3** — cosmetic coach-mark
copy, functionally harmless, majority already flagged.

### 5. [P3] "MUST SEE" contradicts stated vocabulary — CONFIRMED

`grep -rn "MUST SEE\|Must See\|must see" js/` returns exactly the two cited
hits (`app.js:445`, `settings.js:360`) plus three unrelated legacy-parser
comments/strings that correctly label "Must See" as a retired input format
(`parse.js:4,12`, `sync.js:114`) — so the finding's scope is precise, not
cherry-picked. `LEVEL_LABELS_V4[4] = 'Must'` and `wall.js:81`'s
lower-cased `'must'` aria text confirm the canonical label. CLAUDE.md's
vocabulary rule is unambiguous on this exact term. P3 is right-sized: pure
copy/vocabulary drift, no functional impact, not already tracked anywhere
(unlike #4).

### Missed

1. **`settings.js:68-83` (`currentFestCard`) is a THIRD, uninventoried render
   site for `dates`, and it undercuts finding 3's framing.** Finding 3 says
   Settings reads "the index copy" of `dates` — true only for *other* boards
   in the festivals list (which go through `festRow(meta, …)` with
   `meta = FESTIVAL_INDEX.find(...)`, i.e. the index). But the CURRENT
   festival's own card at the top of "Your festivals" — the very first thing
   in Settings — is `currentFestCard`, which reads `state.fest().dates`, the
   **per-fest file**, same source as the wall header (`app.js:184`). So on
   a single Settings screen, the active fest's dates and every *other*
   fest's dates already come from two different files today — not "across
   three screens" as finding 3 frames it, but visibly within one screen, one
   scroll. If Portola is your active fest, Settings shows "September 26–27,
   2026 · doors 1 PM" in the top card and (once any other board diverges the
   same way) a different string for a fest lower in the same list. This
   makes finding 3 slightly undersold, not overstated — worth folding into
   its fix as an explicit third call-site, not just index vs. per-fest in
   the abstract.
2. **The 2-line clamp is applied redundantly, not shared.** `.fest-dates`
   (tools.js/v3.css) and `currentFestCard`'s inline style
   (`settings.js:82`) hand-duplicate the identical
   `-webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`
   declaration rather than sharing a class. Not a bug (both currently agree),
   but a second place someone could edit the clamp and silently diverge it
   from the shared component the way `dates` itself already diverged —
   worth a one-line note for whoever picks up finding 3's fix.
3. No other vocabulary drift found beyond "MUST SEE": checked for "Highlight"
   / "Nice to See" leaking into onboarding-facing copy (coach mark, How-it-
   works, landing) — both only appear in the legacy-parser context
   (`parse.js`), correctly scoped as historical import formats, not live UI
   labels. Confirms finding 5 didn't miss a sibling instance.
4. Confirmed no hidden order-dependency would make finding 1's swap unsafe:
   `youSection`/`crewSection` share no DOM ids, no shared mutable closures,
   and nothing elsewhere (`app.js`, `router.js`) scrolls or anchors to either
   section by position — the one-line swap is exactly as safe as both
   findings say.
