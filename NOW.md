# NOW — festival-navigator: v3.1 AUDIT-FIRST RUN (ACTIVE, unattended)

**Updated:** 2026-07-11 ~13:25 CT · **Branch:** main (fixes will branch)
**Plan:** `claude-plans/2026-07-11-v31-audit-first-plan.md` · **History:** DEVLOG.md
**Kevin's brief (verbatim):** "build a kick-ass app that has a knock-you-back-
stunning UI, a thoughtful and no page or user flow neglected UX, and a rock
solid won't leave folks stuck and lost in the middle of a festival backend."
Kevin is away; run autonomously per hg-durable-build. Production promote stays
Kevin's call — build on a branch, verify on preview.

## Engines running (background, notify on completion)

- **Codex 5.6-sol blind UX review** → banking to `.claude/codex-v31-ux-review.md`
  (teammate session monitors for stalls, auto-relaunches once).
- **Design-audit workflow** (run wf_4de3ff40-804): 3 Playwright walkers on prod
  (390/768/1440) as throwaway crew "Audit Rig" + 4 code finders → 11 reviewers →
  opus dedupe → adversarial verify → ranked backlog at scratchpad/audit/backlog.md.

## EXACT NEXT STEP

When BOTH engines land: calibration check (did machinery independently
rediscover Kevin's A1–I2 list in the archived plan? misses = strengthen +
re-run), then merge Kevin+Codex+workflow into ONE ranked backlog at
`.claude/v31-backlog.md`, rescue scratchpad artifacts into the repo, then
**Kevin clears the session** and the fix phase starts fresh.

**POST-CLEAR READ ORDER (fix-phase session starts here):**
1. `claude-plans/2026-07-11-v31-fix-phase-grounding.md` — the brief + spirit +
   gates (read in full, it exists to survive the clear)
2. This file (live state)
3. `claude-plans/2026-07-11-v31-design-direction.md` — the design decisions
4. `.claude/v31-backlog.md` — the merged findings (floor, not ceiling)
5. `docs/user-flows.md` — the spec
Grounding + design-direction done this session (ground-it legibility read,
frontend-design lens loaded — reload that skill for UI work).

## Hard rules for this run

- **No app-code edits until the audit workflow completes** — reviewers cite
  file:line against the current tree; editing mid-audit invalidates findings.
- Fixes are display/UX-layer; NO crew-doc shape changes, NO destructive DB ops.
  (Build guard not reinstalled — nothing in scope mutates data. The one
  teardown DB action: delete the "Audit Rig" crew, explicit and single.)
- Audit Rig crew token: scratchpad/audit/crew-token.txt (never in repo).
- Public repo: grep for `#g=` before committing any doc.
- vercel dev doesn't serve files created after start; Chrome heuristic-caches
  modules (fetch cache:'reload' + reload); Write-tool control-byte check after
  regex-heavy writes.

## Done this run

- docs/user-flows.md (the spec the audit walks) — committed 1f83288.
- Audit Rig crew created + seeded (2 people, picks, notes ×3 scopes) — verified
  via live GET.
- frontend-design skill installed to hg-agents (80431aa) + symlinked, live.
- Plan approved-in-spirit (Kevin exited plan mode + gave the go-forth brief).

## Post-run queue (Kevin-gated, unchanged)

Spotify scan (blocked on I1 redirect fix + Spotify-dashboard registration —
Kevin action), EF-app saves import, token rotation decision, fast-follows.

## Standing facts

- dev.fest.kevinhg.com staging unpinned; preview env vars unset.
- Crew links in chat/scratchpad only — never commit a token.
