# Clear-eyed sweep — findings + synthesis (2026-07-12)

Kevin asked: "Is code clearly organized, clear, elegant, and bulletproof in
the wack low-signal messy multi-user situations we'll find ourselves in?"
Method: 5 Sonnet lens agents (structure, multiuser, resilience, timetable,
api-security) + adversarial verify on every P0/P1 + a recordOS Spotify
reader; synthesis in main loop after the Opus synthesis agent hit a schema
retry cap (results recovered from the workflow journal, run wf_6939fb9a-a88).

## The honest answer

The codebase has two faces. The **model/lib layer is genuinely elegant** —
`merge.js`, `overlap.js`, `time.js`, `name-rules.mjs`, `v3/model.js`,
`v3/palette.js`, `v3/aura.js`, `v3/router.js`, the sync engine core, and
`api/_lib/*` are small, single-purpose, why-commented, share single sources
of truth across client/server, and carry 89 green tests. The **server merge
core is earned confidence**: deny-by-default key allowlists, atomic single
UPDATE, tombstones, zero innerHTML anywhere (grep-confirmed). The
**screen-assembly layer is where it frays**: app.js (1015 lines) renders 5
screens its own header comment says live elsewhere, settings.js (890)
bundles 6 sub-screens, helpers are duplicated while `util.js` sits entirely
dead, and ~61 static inline styles bypass the CSS system. Lens grades: B-,
B-, B-, B-, C+ (timetable rendering — where both of Kevin's screenshots
live). **Bulletproof in messy multi-user situations: the write path yes, the
client edges not yet** — five concrete gaps below, all fixable this arc.

## Confirmed findings (adversarially verified or re-judged in main loop)

### Timetable (the C+ — root causes of Kevin's notes 3, 4, 1.2)
- **P0 · Lane bleed (Kevin note 3):** no `box-sizing: border-box` exists
  anywhere; wall.js sets lane width/margin as percentages assuming
  border-box, so `.card.cell` padding+border (18px) push split cards past
  their column edge. `js/v3/wall.js:408-412` + `assets/v3.css:22-26,52`.
- **P0 · Top clipping (Kevin note 4):** `scrollIntoView({block:'start'})`
  puts the day header under the sticky day-rail — no `scroll-margin-top`
  anywhere. `js/v3/app.js:169` + `assets/v3.css:152-160`.
- **P1 · No canonical cross-day stage order (Kevin note 1.2's prerequisite):**
  each day's `stages` array is authored independently; same stage sits in
  different columns on different days (confirmed in lollapalooza-2025 data).
  `js/v3/wall.js:335,400`.
- **P2:** `.stage-head` has no truncation/wrap guard (32px hard row).
- **P2:** explicit-end-time sets bypass the 30-min duration floor
  (`js/time.js:55`) → cards shorter than their own padding.
- **P3:** a scheduled day with zero sets → NaN/Infinity in grid rows.

### Multi-user / sync edges

**Disposition (cluster C, same day):** 413/poll-race/create-caps/mrkdwn/
cross-tab all FIXED (tests in sync-hardening.test.mjs); artist-info.js
deleted (zero client callers — grep-verified, guards were present but the
endpoint was dead Gemini spend). ACCEPTED with rationale: colorIndex
collision on simultaneous joins (visual-only, self-heals when either member
picks a color; a server-assigned index would unfreeze the doc schema for a
cosmetic edge) and the rename-vs-pick orphan (orphaned picks are invisible
everywhere — every reader filters removed people; the loss is one pick not
following a rename, only when a second device wrote it mid-rename).
- **P1 · 413 dead-end:** doc-size/people-cap rejection is treated as a
  transient error — pendingChanges accumulate forever, dot shows generic
  error, no recovery path. `js/sync.js:64-103` + `api/crew.js:124-142`.
- **P1 · Poll/push race:** pollSync doesn't set `isSyncing`; a slow poll GET
  resolving after a push completes applies the pre-push doc — visible
  rollback until the next poll (~25s). `js/sync.js:50-62,125-141`.
- **P1 · Crew creation bypasses caps:** POST create never runs
  `validateMergedDoc` (people cap / doc size enforced only on merge).
  `api/crew.js:34-46` vs `:124-142`.
- **P1 · Slack mrkdwn injection:** `api/access.js:28,79` — loose EMAIL_RE
  interpolated unescaped into the owner-facing Slack approval message.
- **P2 (re-judged from REFUTED — refuter tested the wrong timeline):**
  two live tabs clobber each other's pending blob in localStorage;
  loss window = offline + both tabs edited + one closes before pushing.
  Fix cheap (storage event merge). `js/state.js:84-85`.
- **P2:** concurrent joiners can get the same colorIndex (visually
  indistinguishable members). `js/v3/app.js:722-728`.
- **P2:** self-rename racing a pick from a second device orphans the pick
  under the removed identity with no UI to reclaim it.
- **P2:** `api/artist-info.js` — unauthenticated Gemini-spending endpoint,
  apparently unused. Verify dead → delete (Comment Traps rule), else gate.
- **P3:** client clocks order the shared note timeline (accepted; document).
- **P3:** sv:4 declared for stale offline edits recorded pre-update
  (accepted; migration path already heals).

### Structure / legibility (per the ground-it legibility guide)
- `js/util.js` is 100% dead (zero importers; only cache-manifest mention) —
  yet the localStorage read/write idiom it should own is hand-rolled 5x
  (state, crew, spotify, notes, settings). Delete-or-become-real.
- `el()` DOM helper defined twice verbatim (settings.js:24, tools.js:8);
  `subviewHead()` in tools.js defined and never called while the pattern is
  hand-rolled 4x in settings.js.
- app.js header comment lies about where screens live (Mode-1 doc drift).
- `parse.js` keeps the superseded parseBulkLine beside V4 with no legacy
  marker; `model.js` noteOverlay() unused while state.js reimplements it.
- ~61 static inline `style.cssText` across v3 JS instead of classes.
- SW version skew: one-load window of new-HTML+old-JS right after a deploy
  (accepted as designed; CACHE_VERSION discipline covers it — noted, no fix).

### Verifier quality notes (for future runs)
One verifier returned REFUTED while its own reasoning said CONFIRMED
(util.js); two verifiers claimed "no test/ directory" (tests live in
`tests/`, plural). Verify-agent enum discipline + a repo-layout crib line in
the prompt next time.

## recordOS Spotify pattern (feeds Kevin note 7)

Shared client ID is a **hardcoded exported constant** (PKCE — safe public),
NOT env/config; no BYO door exists in recordOS at all. Request-access flow:
LoginModal email capture → `api/request-access.js` → Neon `access_requests`
upsert (idempotent) → Slack Block Kit message with "Approve" button →
`api/approve.js` validates static APPROVE_SECRET, flips status, 302s Kevin
STRAIGHT to the Spotify dashboard users page to add the email to the
app allowlist. **festival-navigator's `api/access.js` + production env vars
(SLACK_WEBHOOK_URL, APPROVE_SECRET, OWNER_SPOTIFY_CLIENT_ID,
PUBLIC_BASE_URL) are already this backend** — note 7 is mostly client-side
drill rework: bake the shared client ID as default, add the request-access
door, demote BYO client ID to an advanced/fork path. Gap flagged by reader:
recordOS's `access_requests` table has no schema file in its repo (created
ad hoc) — festival-navigator's version should be in `db/schema.sql`.

## Execution plan (merged with Kevin's 8 notes)

1. **Cluster A — timetable** (notes 1, 1.1, 1.2, 3, 4 + the two P0s + three
   P2/P3 render edges): border-box reset, within-column lanes, scroll-margin,
   canonical cross-day stage order, shared horizontal scroll, sticky stage
   headers, unified header/dock, name wrapping, stage-head guard, short-set
   floor, empty-day guard.
2. **Cluster B — nav + crew** (notes 2, 5): back-button history semantics,
   add-member-from-header + settings, back-to-fest-list affordance.
3. **Cluster C — sync/backend hardening** (the "rock solid" brief): 413
   recovery, poll/push race, create-path caps, mrkdwn escape, cross-tab
   merge, colorIndex reservation, rename-orphan sweep, artist-info.js
   disposition.
4. **Cluster D — product** (notes 6, 7, 8): festival notes surface, Spotify
   three-door drill, past-fests weight rebalance.
5. **Cluster E — legibility** (woven through + dedicated commit): dead-code
   deletions, helper consolidation, comment truth, inline-style cleanup
   where touched.

Gates per grounding doc: tests per fix (extend `tests/`), Codex review at
cluster boundaries, staging walk (stage.fest.kevinhg.com) before declaring
the arc done.

## Codex arc-gate results (end of arc, same day)

Full diff review (9af902b..e260853): 2 confirmed P1s, both FIXED same
session — (1) the 2-row display floor could stack time-disjoint short sets
(lane math now runs on display extents, regression-tested); (2) add-member
applied its async result without a crew-switch guard (tokenAtStart bail
added, both branches). One P3 fixed: base-card border-box silently shrank
lineup-mode card floors ~29px — border-box now scoped to `.card.cell`, the
only place lane math needs it. **One product call flagged for Kevin:** after
'‹ back to fest list', a hard REFRESH on the bare URL cold-start-resumes the
crew you just left (PWA resume philosophy vs. explicit-leave intent — Codex
says design-coherent, wants your sign-off). One informational fast-follow:
a permanently-invalid pending leaf (future client bug) would ride every
push forever — a quarantine path would be nice-to-have; today's behavior
(visible reason, no thrash) is strictly better than the old silent spin.
