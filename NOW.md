# NOW — festival-navigator: v3.1 AUDIT-FIRST RUN (ACTIVE, unattended)

**Updated:** 2026-07-11 ~13:25 CT · **Branch:** main (fixes will branch)
**Plan:** `claude-plans/2026-07-11-v31-audit-first-plan.md` · **History:** DEVLOG.md
**Kevin's brief (verbatim):** "build a kick-ass app that has a knock-you-back-
stunning UI, a thoughtful and no page or user flow neglected UX, and a rock
solid won't leave folks stuck and lost in the middle of a festival backend."
Kevin is away; run autonomously per hg-durable-build. Production promote stays
Kevin's call — build on a branch, verify on preview.

## Discovery COMPLETE (2026-07-11 PM) — safe to clear

Both engines landed; findings merged, calibrated (15/16 rediscovered; the one
miss was structural — see backlog's calibration section), committed. Scratchpad
artifacts rescued: walk-logs → `screenshots/audit-2026-07-11/` (gitignored,
machine-local), workflow backlog + Codex review + merged index + the audit
workflow script itself → `claude-plans/` (all dated 2026-07-11).
Audit Rig token → `~/.claude/plans/v31-audit-rig-token.md` (keep the crew —
the Stage-4 re-run reuses it; seed a Spotify Client ID into it first).

## EXACT NEXT STEP

**Fix phase, fresh session.** Branch `v31-polish` off main. Work
`claude-plans/2026-07-11-v31-backlog.md` in its sequencing order (FLOW-1 first). The backlog
is the floor — the grounding doc carries the actual brief.

**POST-CLEAR READ ORDER (fix-phase session starts here):**
1. `claude-plans/2026-07-11-v31-fix-phase-grounding.md` — the brief + spirit +
   gates (read in full, it exists to survive the clear)
2. This file (live state)
3. `claude-plans/2026-07-11-v31-design-direction.md` — the design decisions
4. `claude-plans/2026-07-11-v31-backlog.md` — the merged findings (floor, not ceiling)
5. `docs/user-flows.md` — the spec
Grounding + design-direction done this session (ground-it legibility read,
frontend-design lens loaded — reload that skill for UI work).

## Hard rules for this run

- (Discovery's code-freeze is OVER — the audit completed against tree
  b0fde34..73a74bf. Fix-phase edits happen on branch `v31-polish`.)
- Fixes are display/UX-layer; NO crew-doc shape changes, NO destructive DB ops.
  (Build guard not reinstalled — nothing in scope mutates data. The one
  teardown DB action: delete the "Audit Rig" crew, explicit and single.)
- Audit Rig crew token lives ONLY at `~/.claude/plans/v31-audit-rig-token.md`
  (outside the repo — never write a token anywhere under the project tree).
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
