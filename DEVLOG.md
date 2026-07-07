# DEVLOG — festival-navigator

Newest first. One entry per meaningful unit of work.

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
