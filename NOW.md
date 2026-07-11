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

While engines run: (1) ground-it read of the codebase-legibility doc, (2) write
the v3.1 design-direction spec (frontend-design lens: type scale, breakpoints,
sheet dialog, sort menu, day rail) into claude-plans/. When BOTH engines land:
calibration check (did machinery independently rediscover Kevin's A1–I2 list in
the plan? misses = strengthen + re-run), then merge Kevin+Codex+workflow into
ONE ranked backlog, then fix by class on branch `v31-polish`.

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
