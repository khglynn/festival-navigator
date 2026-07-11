# v3.1 — Audit-first: find everything, then fix by class

**Drafted 2026-07-11 (plan mode, rev 2).** Rev 1 rooted only in Kevin's feedback;
he redirected: *"not only rooted in my feedback — do a full audit and think
through where opportunities exist… I found half a dozen problems in a quick
pass. I don't wanna play whack-a-mole."* This plan leads with discovery
machinery; Kevin's findings become the **calibration set** — if our audit can't
independently rediscover what he found in one quick pass, the audit gets
strengthened before we trust anything it says.

## Context

v3 shipped overnight 2026-07-10 and is live. Its review gates checked
correctness, not experience: nobody walked EF's scheduled view, desktop got
"mobile but wider," Spotify connect was never end-to-end tested on the prod
domains. Kevin's two quick passes found ~10 real problems including a P0
(tapping an artist in set-times makes it vanish) and a functional break
(Spotify OAuth redirect mismatch). The job: audit the whole app top-to-bottom
with machinery we can re-run, fix by problem-class, and prove the fixes by
re-running the same machinery — so "done" means the harness says so, not Kevin.

## Stage 1 — DISCOVER (before fixing anything)

1. **`docs/user-flows.md` first.** Canonical inventory of every flow: first
   visit → create → share → join → pick (lineup AND scheduled views) → notes ×3
   scopes → settings (all doors) → Spotify connect→scan→playlist → add-festival
   → past/archived fests → export/download → offline → back/forward nav. Each
   flow: steps, expected state at each step, per-viewport notes. This doc
   DRIVES the audit; staleness self-corrects because audit runs diff against it.
2. **Codex full UX pass (Kevin's ask, new 5.6 model).** Give codex-rescue
   Kevin's original v3 kickoff framing ("take a beat, understand where we are…
   fully complete, live and hosted") plus a UX/user-flows lens over the whole
   repo + live app. Read-only, bank-as-you-go findings file. Kicked off FIRST so
   it trails while the workflow audit runs (independent, no code built on it).
3. **Design-audit workflow (ultracode).** Playwright walks every user-flows.md
   flow at 390/768/1440 against a local build with a seeded test crew,
   screenshotting each step; fan-out reviewer agents per flow × lens (visual
   design, interaction/affordance, responsiveness, copy, navigation/history,
   error+empty+offline states); adversarial verify pass dedupes and confirms;
   plus code-side finders (event-handler bugs like refreshCard, data-render
   mismatches like activities, dead CSS, a11y). Output: ranked findings.
4. **Calibration gate.** The machinery must independently rediscover Kevin's
   known findings (list below). Misses = audit blind spots → strengthen lenses
   and re-run before trusting the rest of its output.
5. **Synthesize** Kevin's findings + Codex + workflow into ONE ranked backlog,
   grouped by problem class, banked in the run's state files.

## Kevin's findings = the calibration set (verbatim-faithful, causes verified)

**Class A — Desktop responsiveness & scale**
- A1 Short pages float to top ("feel really small"; wants breakpoint scale steps).
  Cause: `.center-col` fixed `margin: 40px auto 0` (`index.html:34`); ONE 720px
  breakpoint in the whole app; all type fixed px, zero clamp()/rem.
- A2 Note sheet on desktop = full-width strip at viewport bottom. Cause: `.sheet`
  `left:0;right:0;bottom:0` with no desktop mode (`assets/v3.css:104-110`).
- A3 Wide content (EF stage columns) clipped by the 960px `.shell`; wants
  Notion-full-width (headings capped, content full-bleed).
- (Found in exploration, not by Kevin: **dock hidden ≥720px with NO desktop day
  nav replacement**, `v3.css:136`.)

**Class B — Unstyled controls**
- B1 Sort menu is a native `<select>` (`index.html:121-126`; dead `.caret` CSS).

**Class C — Create/pick flow**
- C1 Past fests unpickable at create. Cause: `app.js:176` hard filter
  `status !== 'archived'`. C2 name entry reads as a festival option → multi-step.
- H3 Archived fests findable only via "tinnnnyyy archive text line" in Settings.

**Class D — Notes IA**
- D1 Notes chip should show all notes + add-festival-note; today read-only with
  an empty state that points elsewhere (`notes.js:166-171`).
- D2 Bring back per-day notes button at each day header.
- D3 Keep festival/day/artist levels legible.

**Class E — Day model**
- E1 "SATURDAY & SUNDAY" combined section is wrong; artist appears under BOTH
  days. Cause: `groupByDay` keys raw day string (`wall.js:141-149`); Despacio's
  data is `"day": "Saturday & Sunday"`.

**Class G — Navigation/history**
- G1 Browser back doesn't work (in-UI back does). Cause: screens/sheets shown
  via `show()`/DOM append with only `replaceState` + one `hashchange` listener
  (`app.js:363,407,429`) — no history entries, no popstate routing.

**Class H — Scheduled (set-times) view**
- H1 **P0:** tapping an artist in EF's set-times makes it disappear. Cause
  CONFIRMED: `refreshCard` (`wall.js:132-136`) `replaceWith`s a fresh node that
  lacks the inline `gridColumn/gridRow/width/marginLeft` that
  `renderScheduledDay` applied after building it (`wall.js:233-241`).
- H2 The "other stuff" list below the grid "looks like poo." Kevin: those items
  HAVE stage+time — the list was a dodge to avoid overlap layout. Fix direction:
  schedule-place anything with stage+time (computeLanes already handles
  same-time overlap); a far-right column ONLY for genuinely
  unscheduled/stage-less items. (Data check: EF `days{}` have no activities;
  top-level `activities{}` keyed by day feeds the list, `wall.js:250-269`.)

**Class I — Spotify connect**
- I1 FUNCTIONAL BREAK: `redirect_uri: Not matching configuration` from Spotify.
  Cause: `js/spotify.js:13` sends `${location.origin}/spotify-callback`; the
  Spotify app dashboard doesn't have the kevinhg.com prod domains registered.
  ⚠️ Needs a Kevin action (Spotify developer dashboard) — code can canonicalize
  to one domain to minimize the registration list.
- I2 The drill is confusing + ugly: bare "Connect my Spotify" floating top-left;
  crew-lead Client-ID step reads as user-facing config. Rework the flow's UX:
  states (no client id / lead setup / ready to connect / connected / scanning),
  plain-language copy, and Class-A layout treatment.

**Class F — Process (the real ask)**
- F1 Audit machinery so Kevin isn't QA-of-last-resort (this plan's Stage 1+4).
- F2 Install Anthropic's `frontend-design` skill into `hg-agents/skills/generic/`
  + `setup-skills.sh` (verify upstream source at execution; if unavailable,
  distill our own and say so).

## Stage 2 — DESIGN fixes by class (post-audit, pre-seeded)

Class designs already drafted (rev 1, still valid — the audit ADDS to them,
they don't cap scope):
- **A:** clamp()-based type/spacing tokens in `v3-tokens.css`; second breakpoint
  ~1100px; `margin-block:auto` centering (overflow-safe) for short screens;
  `.wall-grid` → `auto-fill minmax(150px,1fr)` ≥720px; `.shell` max-width token
  (960→1080 wide); `.sheet` → centered dialog ≥720px (`min(560px,92vw)`);
  `.times-scroll` full-bleed (`margin-inline: calc(50% - 50vw)`) with headings
  staying shell-width; sticky `#day-rail` day tabs ≥720px sharing dock scrollspy.
- **B:** custom popover listbox (keyboard + ARIA), createElement-only, added to
  gallery.html.
- **C:** two-step create (pick fest → name); past-fests section at step 1;
  Settings "archived" line gets real visual weight (H3).
- **D:** all-notes sheet gains fest-note composer + clear scope sections + empty
  state keeps composer; day-header notes chip opens day-scoped sheet; hover ✎ on
  cards for pointer-fine devices (desktop long-press is invisible).
- **E:** `groupByDay` splits multi-day strings against the fest's known day
  names; artist renders in each group; validator warns on unknown day strings.
- **G:** minimal history router: pushState entries for screen/sheet/drill
  transitions, popstate closes/navigates in reverse, `#g=` token hash preserved
  (never leaks into history-visible URL beyond what exists today).
- **H1:** refreshCard preserves positioning (copy inline placement styles to the
  fresh node, or re-render via the day renderer). Regression test.
- **H2:** promote stage+time activities into the grid columns; far-right
  "everything else" column for stage-less items only.
- **I:** canonicalize Spotify OAuth to one domain + Kevin registers redirect
  URI(s); drill redesigned as a stated flow with Class-A layout.
- **F2:** skill install (separate hg-agents commit).

Fixes that survive audit-synthesis get built; audit-discovered classes get the
same treatment (design → build → verify), not spot patches.

## Stage 3 — FIX

Coupled UI/CSS edits in the main loop (one mind holds the invariants);
parallelizable independents (tests, docs, gallery, validator) via workflow
agents. Small scoped commits, secret-scanned, state banked per class. New unit
tests: groupByDay split, refreshCard-in-grid regression, history router
transitions, notes composer scopes.

## Stage 4 — PROVE (re-run the machinery)

- `npm test` (existing 56 + new), output read.
- **Re-run the design-audit workflow** — same flows, same lenses, against the
  fixed build. Pass = prior findings gone, no new criticals.
- Codex gate on the full diff (blocking, bank-as-you-go).
- Live-data integrity: real crew docs untouched by any of this (display-layer
  work; no doc-shape changes anywhere in this plan).

## Stage 5 — SHIP

Branch → push → **preview** deploy → verify preview on real devices → Kevin
promotes (production promote stays his call). NOW.md closed to shipped state,
DEVLOG updated, user-flows.md + audit workflow committed as permanent repo
tooling, morning-report-style summary.

## Files touched (main)

`index.html` · `assets/v3-tokens.css` · `assets/v3.css` · `js/v3/app.js` ·
`js/v3/wall.js` · `js/v3/notes.js` · `js/v3/settings.js` · `js/spotify.js` ·
`gallery.html` · `data/festivals/index.json` (lolla empty dates) · `tests/*` ·
`scripts/validate-festivals.mjs` · new `docs/user-flows.md` + audit workflow
script · `hg-agents/skills/generic/frontend-design/` (separate repo).

## Out of scope (stays on the queue)

Fresh Spotify library scan + EF-app saves import (need Kevin, and blocked on I1
anyway — fixing Spotify connect UNBLOCKS the scan), token rotation (Kevin's
call), member-management UI unless the audit ranks it load-bearing.
