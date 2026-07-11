# DEVLOG — festival-navigator

Newest first. One entry per meaningful unit of work.

## 2026-07-11 (afternoon) — v3.1 discovery: audit-first, findings banked

- Kevin's morning pass found ~10 real problems the overnight gates missed
  (incl. a set-times vanish bug and broken Spotify OAuth) → run restructured
  audit-FIRST at his direction: "don't play whack-a-mole; robust, top to
  bottom." His findings became the calibration set for the machinery.
- Discovery engines: (1) 54-agent design-audit workflow — 3 Playwright walkers
  on prod at 390/768/1440 as throwaway crew "Audit Rig" + code finders +
  reviewer lenses + opus dedupe + adversarial verify → 34 confirmed findings
  in 8 classes (claude-plans/2026-07-11-v31-backlog-workflow.md); (2) blind Codex gpt-5.6-sol
  whole-repo UX pass → 51 findings (claude-plans/2026-07-11-codex-v31-ux-review.md).
- Calibration: 15/16 of Kevin's findings independently rediscovered. One
  structural miss (Spotify redirect — rig had no Client ID, walkers died one
  step early); lesson: Stage-4 re-run must seed a Client ID + walk offline.
- Cross-model headline: both engines independently flagged the same P0 —
  invites lose festival context on new devices (joiner lands on Lost Lands).
- Merged, re-judged, sequenced: claude-plans/2026-07-11-v31-backlog.md — 1 P0 / 24 P1 / 32 P2
  in 9 fix classes. Supporting docs shipped same run: docs/user-flows.md (the
  executable spec — mismatch is always a finding), design direction, fix-phase
  grounding (hg-save-it lens), frontend-design skill installed to hg-agents.
- Deliberate boundary: ZERO app-code edits this session — findings cite
  file:line against a stable tree; the fix phase starts from a cleared
  context reading the banked docs (NOW.md has the read order).

## 2026-07-10 (overnight) — v3 SHIPPED TO PRODUCTION (main)

- Full arc in one overnight run: P0 grounding -> P1 design system -> P2 data
  layer (Codex gate: 3 P0s fixed structurally) -> P3 all screens (walk gate)
  -> P4 festival-add API -> P5 SW v13 + living favicon -> P6 final gate +
  live migrate integrity -> merge to main -> production -> all three real
  crews pre-migrated to v4. Morning report:
  claude-plans/2026-07-10-v3-morning-report.md.
- Review economics that worked: bank-as-you-go reviewer files (two reviewers
  "vanished" from the registry but were merely slow — both delivered), gates
  at phase boundaries, every finding dispositioned same-night with the fix
  cited back to its finding number.
- The guard + classifier stack worked as designed: blocked a CREATE TABLE on
  an ON DELETE CASCADE word-match, then correctly refused a credential-
  materializing workaround — table creation deferred to Kevin rather than
  routed around. Layered defenses > my in-the-moment reasoning.

## 2026-07-10 (overnight) — v3 P3: THE WALL SHIPS (branch `v3-design`)

- index.html replaced wholesale with the v3 shell (landing 21a, join 21b,
  wall 21c). js/v3/app.js orchestrates boot -> join -> wall; js/v3/wall.js
  renders day sections of aura cards from live picks (model.js reads), owns
  the tap cycle (0-4-0 with undo toast on the 5th tap), search/sort, and the
  dock scrollspy (IntersectionObserver). Legacy person colors map onto the
  24-board deterministically (old palette position -> board slot, no writes).
- sync.js: sv:4 semantics declaration on every push; requestMigration() calls
  the server-side op; setSyncStatus feeds both dots. All doc-derived strings
  render via textContent (gate rule).
- LIVE-VERIFIED on the branch API (vercel dev :3111 + throwaway v4 crew):
  join -> claim -> 117-artist wall -> tap x5 = alpha ladder/must-pill/clear+
  toast in the DOM -> server doc shows level 4, v:4, sync online. The one
  test hiccup was the July-7 service worker still controlling old tabs —
  expected; skipWaiting converges on the second load.

## 2026-07-10 (overnight) — v3 P0+P1+P2: grounding, rig, design system, data layer (branch `v3-design`)

- **P2**: doc v4 semantics (picks 0-4, keyed-object notes, spotifyStats,
  colorIndex) + version-aware client reads. Codex gate (blocking) found 3
  P0s; all fixed STRUCTURALLY: migration moved server-side (?op=migrate, one
  atomic SQL transform, v never client-writable), note ids must carry their
  author prefix, sv:4 semantics declarations with SQL choosing the mapped
  delta for stale clients. 56/56 tests incl. concurrent-notes both-orders.
- **P4 core**: /api/festival-add — Gemini search-grounded research ->
  validated candidate + sources -> user-confirm -> crew-private upsert.
  Festival rules extracted to api/_lib/festival-rules.mjs (single source of
  truth with CI validator). custom_festivals DDL deferred to Kevin (guard
  false-positive on ON DELETE CASCADE; classifier rightly blocked the
  workaround).

- **P0**: four foundation docs deep-read → distillation in the grounding doc;
  compaction hooks + Neon destructive-op guard installed and behavior-tested;
  design atlas read in full → `assets/v3-tokens.css` + `claude-plans/
  v3-inventory.md`; @vercel/blob + migrate-legacy.mjs deleted (prod deps = 1);
  Anton/Inter self-hosted (Inter as one variable woff2); CI now runs on all
  branch pushes.
- **P1**: `js/v3/palette.js` (24-board from the design project's 12a AURA,
  canonical first four; stable colorIndex) + `js/v3/aura.js` (pure-function
  port of the atlas renderVals — 9 tests pin the EXACT gradient strings) +
  `assets/v3.css` (every component: cards/cells, corners, chips, toolbar,
  sheet, dock, settings, notes, segmented, toggles) + `gallery.html`
  exercising the production stylesheet with atlas-verbatim data. Verified in
  Playwright: computed backgrounds match the engine, self-hosted fonts load,
  full-page screenshot eyeballed against the atlas.
- Palette nuance worth remembering: slot 3 is the README's curated green
  hsl(150,70%,50%), NOT the board's naive 150-bright — greens at 90% sat fail
  the 0.5-alpha-on-#141021 legibility rule.

## 2026-07-09 — Data archaeology + archive fests (branch `rescue-and-archives`)

- **Root-caused the "missing EF saves"**: the legacy blob was clobbered to 402
  bytes at 09:10:14 on Jul 7 — sixty seconds before `migrate-legacy.mjs` ran —
  so the migration's byte-for-byte verify faithfully copied an already-emptied
  doc. The 3 surviving picks were all that reached Neon. (The Blob write-loss
  failure mode, again; it destroyed real data before the ban was written.)
- **Recovered Lollapalooza 2025**: two independent survivors — `lollaSelections`
  in Chrome Profile 2's LevelDB (10 artists/17 picks, read via classic-level on
  a copy) + the Aug-2025 blob (4 more artists). Union validated against the
  shipped lineup (0 orphans), written as new crew "Lolla 2025" (6 people,
  21 picks, verified leaf-by-leaf). Token in chat only — repo is public.
- **recover.html**: self-serve rescue page for device localStorage (all key
  generations: `fn_data_v2`/`fn_pending_v2`, `lollaSelections`,
  `fn_spotify_libmap_v1`). Preview → merge via existing `/api/crew` → read-back
  verify; EF id remap, tombstone drop, unknown-people skip, never-lower rule.
  E2E-tested with Playwright against a throwaway prod crew (then deleted via
  Neon). Exists because phones that synced at EF still hold the crew's picks.
- **Three archived festivals** researched + adversarially verified (6-agent
  workflow, ~766K tokens): `ubbi-dubbi-2026` (50 acts; Day 2 weather-cancelled
  mid-event), `wicked-oaks-2025` (68 acts; 4 announced-but-cut excluded),
  `acl-2025` (124 acts, day + W1/W2 flags; final performed lineup incl. Killers
  headliner swap). Principle: final published set times are truth.
- **Learned the level semantics**: 1=Nice to See, **2=Highlight, 3=Must See**
  (`js/ai.js:84`, tap cycle `js/app.js:423-425`) — don't assume 2=Must.
- **Security**: The Crew's token is in this public repo's git history (NOW.md).
  Removed from HEAD; rotation queued as Kevin's decision. New rule in project
  memory: grep for `#g=` before committing docs.
- SW cache v11→v12 (tailwind.css grew recover.html's classes).

## 2026-07-07 — Prime-time build (P1–P7, one session)

- **Crews shipped**: capability-link model (160-bit token = access), landing/join flows,
  per-device "me", crew switcher + share button. Legacy global doc migrated into Kevin's
  crew (verified byte-for-byte, twice) and `/api/selections` retired with a 410.
- **Storage pivoted mid-build, on evidence**: Vercel Blob (plan A) measurably lost writes —
  eventually-consistent reads even with cache-busting (stress test: 3/6 stale, 1 write gone
  permanently). Rebuilt on Neon Postgres: single inline atomic `UPDATE` via
  `jsonb_deep_merge()` (source: `db/schema.sql`). A CTE draft lost 2/6 concurrent merges
  (snapshot-before-lock); inline survives 18/18. Do not reintroduce a CTE read.
- **Festival model v3**: per-festival JSON + validator + importer; sortable artist list view
  for lineup-only festivals (ACL weekend filter); overlap-aware grid lanes replace the
  "also happening" workaround (activities list stays, data-driven). Six 2026-27 festivals
  researched from official sources and loaded.
- **Spotify via PKCE**: per-crew Client ID, zero server secrets, tokens device-local,
  library scan → per-person badges, playlist-from-picks on the member's own account.
  Verified to the OAuth boundary; live round-trip needs Kevin's allowlisted app.
- **AI hardening**: raw-prompt `/api/gemini` deleted; structured `/api/optimize`; shared
  per-IP rate limits + same-origin checks; AI HTML passes a tag whitelist.
- **Reviews**: two Codex passes (first hung, respawn delivered) + a background security
  review + a final 4-dimension workflow fan-out. All confirmed findings fixed same-day:
  prototype-pollution key handling, compressed-vs-text size gate, outgoing-crew flush on
  switch, boot re-entrancy guard, offline-join cache fallback, escaping gaps.
- **Gotchas that cost time**: `vercel dev` doesn't serve files created after start (restart
  it); the Write tool serialized literal `\x00` bytes twice when regex escapes were meant;
  old CLI's `--yes` created a stray project from a wrong cwd (cleanup: Kevin deletes
  `festivals` project in Vercel dashboard).

## 2026-07-07 — Prime-time build kickoff (P0)

- Grounded in hg-ground-it four-doc pass; plan at `claude-plans/2026-07-07-prime-time.md`.
- Verified external constraints from primary sources: Spotify dev-mode = 5 users/app + owner Premium (Mar 2026); Vercel Blob Hobby = ~5GB / 100K simple / 10K advanced ops per month, pause-not-bill.
- Decisions locked with Kevin: capability-link crews (no accounts), Spotify via PKCE with per-crew client IDs (zero server-held secrets, playlists on the member's own account), stay on Vercel.
- Known defects to fix (found in code read): del-then-put data-loss window + write race in `api/selections.js`; world-writable global doc, CORS `*`; `/api/gemini` = open LLM proxy; Kevin-only baked Spotify affinity; no lineup-only view; grid cannot render same-stage overlaps (the real reason the "also happening" list exists).
- Branch `prime-time` created; durable-build state files + compaction hooks installed.
