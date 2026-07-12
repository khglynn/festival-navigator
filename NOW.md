# NOW — festival-navigator: v3.1 FIX PHASE (ACTIVE, unattended)

**Updated:** 2026-07-11 late evening · **Branch:** `v31-polish` (off main)
**Plan:** `claude-plans/2026-07-11-v31-backlog.md` (the floor) + fix-phase
grounding doc (the brief) · **History:** DEVLOG.md
**Kevin's brief (verbatim):** "build a kick-ass app that has a knock-you-back-
stunning UI, a thoughtful and no page or user flow neglected UX, and a rock
solid won't leave folks stuck and lost in the middle of a festival backend."
Kevin is away; run autonomously per hg-durable-build. Production promote stays
Kevin's call — build on a branch, verify on preview.

## Fix-phase progress — ALL 7 FIX CLASSES DONE, gates in progress

- ✅ FLOW-1 (P0) hybrid fix (b92fdb8) · CORE 1–18 + FLOW-2/3/4 + ST-1
  (ff85c3b) · Codex-review fixes incl. confirmed router P1 (331517d) ·
  foundations: tokens/a11y/desktop body (8081f64) · FLOWS 5–13 (4f50c4b) ·
  NOTES+SET-TIMES (4a1df15) · SPOTIFY + SW honesty (fa37184) · PWA/CONTENT
  (3623465). Tests 63 → 88, all green. SW v14 → v15.
- Codex trailing review of the first two commits: landed, 1 P1 (reproduced)
  + 2 P3 — ALL fixed with a new regression test.
- 🔄 NOW: the 5 gates, in order (grounding doc): tests ✓ → push branch for
  preview → audit re-run (seed Client ID into Audit Rig, walk F13 + offline)
  → Codex blocking diff gate → taste pass 390/1440 → NOW.md promote note +
  teardown (delete Audit Rig crew, remove stale CLAUDE.md tailwind fact).
- ⚠️ KEVIN ACTION queued: register https://fest.kevinhg.com/spotify-callback
  as the redirect URI in the Spotify developer dashboard (SPOT-1). The app
  now canonicalizes all OAuth to fest.kevinhg.com.

**POST-COMPACTION READ ORDER:**
1. `claude-plans/2026-07-11-v31-fix-phase-grounding.md` (in full)
2. This file
3. `claude-plans/2026-07-11-v31-design-direction.md`
4. `claude-plans/2026-07-11-v31-backlog.md`
5. `docs/user-flows.md`
frontend-design + hg-partner + hg-durable-build skills reload on resume.

## Session facts (this run)

- Local `vercel dev` on :3111 has NO api env (DATABASE_URL unset) — /api 404s
  locally; walk data flows on the Vercel preview, not localhost.
- CLAUDE.md's "Tailwind precompiled, npm run css" fact is STALE (no
  tailwind.css, no css script since v3) — fix CLAUDE.md at teardown.
- jsdom is a devDependency now (DOM regression tests).

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
