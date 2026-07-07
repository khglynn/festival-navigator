# DEVLOG — festival-navigator

Newest first. One entry per meaningful unit of work.

## 2026-07-07 — Prime-time build kickoff (P0)

- Grounded in hg-ground-it four-doc pass; plan at `claude-plans/2026-07-07-prime-time.md`.
- Verified external constraints from primary sources: Spotify dev-mode = 5 users/app + owner Premium (Mar 2026); Vercel Blob Hobby = ~5GB / 100K simple / 10K advanced ops per month, pause-not-bill.
- Decisions locked with Kevin: capability-link crews (no accounts), Spotify via PKCE with per-crew client IDs (zero server-held secrets, playlists on the member's own account), stay on Vercel.
- Known defects to fix (found in code read): del-then-put data-loss window + write race in `api/selections.js`; world-writable global doc, CORS `*`; `/api/gemini` = open LLM proxy; Kevin-only baked Spotify affinity; no lineup-only view; grid cannot render same-stage overlaps (the real reason the "also happening" list exists).
- Branch `prime-time` created; durable-build state files + compaction hooks installed.
