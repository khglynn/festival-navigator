# NOW — festival-navigator prime-time build: SHIPPED to preview

**Updated:** 2026-07-07 ~11:15 CT · **Branch:** `prime-time` (pushed; production untouched)
**Plan:** `claude-plans/2026-07-07-prime-time.md` · **History:** DEVLOG.md

## State: build COMPLETE, awaiting Kevin's three items

All phases P0–P7 done. 13 commits on `prime-time`, CI green, preview deployed.
Four independent review passes (2× Codex, 1 background security scan, 1 four-dimension
workflow fan-out with adversarial verification) — every confirmed finding fixed same-day.

## Whose move — Kevin (nothing else blocks)

1. **`vercel env add DATABASE_URL`** (prod/preview/dev) — the one-liner in chat; without it
   the deployed API 500s. Then tell the session (or push any commit) to trigger a redeploy.
2. **Open the preview** (link in chat; Vercel-auth-protected, opens for Kevin's browser)
   and poke it. Crew link with the real migrated data: `/#g=F4hUPis4l4NfuVMb-UVqUgi2_Zo`.
3. **Spotify last mile** (only thing not verifiable without his account): in his Spotify app
   dashboard add redirect URI `https://<domain>/spotify-callback`, paste the Client ID into
   the app's Spotify panel, connect, scan, make a playlist.
4. **When happy: merge `prime-time` → `main`** (= production deploy; old installed PWAs
   self-heal to the new shell on their next online load).
5. Cleanup (non-urgent): delete stray empty Vercel project `festivals`; delete unused blob
   stores `festival-navigator-crews` (empty) and — after confirming the migration — `test-HG`
   (holds the legacy doc); delete `.env.legacy-snapshot` locally after that.

## If resuming later

Compaction hooks in `.claude/settings.json` still point here — fine to leave until the
branch merges, then remove them + archive the plan per hg-durable-build teardown.
Key invariants live in CLAUDE.md (Neon atomic merge — never a CTE read; Blob banned for
crew docs; vercel dev restart-after-new-files; apostrophe-free hook strings).
