# NOW — festival-navigator: v3 SHIPPED (live in production)

**Updated:** 2026-07-10 ~03:45 CT · **Branch:** main (v3-design merged, fast-forward)
**Morning report:** `claude-plans/2026-07-10-v3-morning-report.md` · **History:** DEVLOG.md

## 🎉 v3 LIVE (2026-07-10, overnight build)

- **fest.kevinhg.com** · festival.kevinhg.com · crew.kevinhg.com — all serving
  the v3 redesign, SW v13, all three real crews pre-migrated to doc v4.
- Run docs archived in claude-plans/ (plan, grounding, inventory, gate reviews
  in .claude/codex-v3-*.md). Build guard removed at teardown; compaction hooks
  softened to generic project re-grounding.

## Morning follow-ups (2026-07-10 AM — items 1+4 DONE, list updated)

- DONE: custom_festivals table live; 9 test crews/rows deleted (DB = exactly
  The Crew, Lolla 2025, Amish ACL). recover.html deleted (its EF-rescue
  mission was void — the app was never live at EF; git history keeps it).
- NEXT (post-compaction): Kevin's app notes from his eyeball pass; fresh
  Spotify scan via Settings -> Spotify -> Refresh my likes (replaces any old
  libmap); import Kevin's saves from the OFFICIAL Electric Forest app (he
  will share them — bulk-paste or a small converter); token rotation decision
  (The Crew's #g= share link is in this public repo's git history — rotating
  = new link to re-share with the crew); fast-follows list in the morning
  report.

## Standing facts

- Crew links in chat/scratchpad only — public repo, never commit a token
  (grep for #g= before committing docs).
- dev.fest.kevinhg.com staging still unpinned; preview env vars still unset.
