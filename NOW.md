# NOW — festival-navigator: v3 SHIPPED (live in production)

**Updated:** 2026-07-10 ~03:45 CT · **Branch:** main (v3-design merged, fast-forward)
**Morning report:** `claude-plans/2026-07-10-v3-morning-report.md` · **History:** DEVLOG.md

## 🎉 v3 LIVE (2026-07-10, overnight build)

- **fest.kevinhg.com** · festival.kevinhg.com · crew.kevinhg.com — all serving
  the v3 redesign, SW v13, all three real crews pre-migrated to doc v4.
- Run docs archived in claude-plans/ (plan, grounding, inventory, gate reviews
  in .claude/codex-v3-*.md). Build guard removed at teardown; compaction hooks
  softened to generic project re-grounding.

## Kevin's morning list (full detail in the morning report)

1. CREATE TABLE custom_festivals (one command; unlocks festival-add saves).
2. Phone rescue for EF picks: fest.kevinhg.com/recover.html on your phone.
3. Rotate The Crew token (public-repo git history leak).
4. Neon debris cleanup (6 old test crews + 3 from tonight, listed in report).
5. Eyeball the live app.

## Standing facts

- Crew links in chat/scratchpad only — public repo, never commit a token
  (grep for #g= before committing docs).
- dev.fest.kevinhg.com staging still unpinned; preview env vars still unset.
