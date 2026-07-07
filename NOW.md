# NOW — festival-navigator prime-time build: SHIPPED to preview

**Updated:** 2026-07-07 ~11:15 CT · **Branch:** `prime-time` (pushed; production untouched)
**Plan:** `claude-plans/2026-07-07-prime-time.md` · **History:** DEVLOG.md

## State: build COMPLETE, awaiting Kevin's three items

All phases P0–P7 done. 13 commits on `prime-time`, CI green, preview deployed.
Four independent review passes (2× Codex, 1 background security scan, 1 four-dimension
workflow fan-out with adversarial verification) — every confirmed finding fixed same-day.

## Whose move — Kevin (consolidated 2026-07-07 evening; nothing else blocks)

NEW since the last list: Slack access-request flow shipped (needs SLACK_WEBHOOK_URL +
APPROVE_SECRET + OWNER_SPOTIFY_CLIENT_ID envs); staging rig built (Neon branch
br-delicate-smoke-ajexourx = preview DATABASE_URL; git branch `staging` pushed;
dev.fest.kevinhg.com attached — pin it to the staging branch in Vercel dashboard);
Cloudflare zone import file on Desktop (incl. dev.fest); env one-liners staged in
scratchpad (dburl.txt, dburl-staging.txt, approve-secret.txt).

1. **`vercel env add DATABASE_URL`** (prod/preview/dev) — one-liner in chat. Deployed API
   500s without it.
2. **DNS at Squarespace** (domains.squarespace.com → kevinhg.com → DNS): three A records —
   hosts `fest`, `festival`, `crew`, each → `76.76.21.21`. (Vercel side already attached
   to the project, 2026-07-07.)
3. **Spotify dashboard** (app "MCP HG", already the crew's clientId in the doc): add
   redirect URIs `https://fest.kevinhg.com/spotify-callback`, `https://festival.kevinhg.com/
   spotify-callback`, `https://crew.kevinhg.com/spotify-callback`; add crew members' Spotify
   emails under User Management.
4. **Merge `prime-time` → `main`** — the custom domains serve PRODUCTION, so they show the
   old app until this merge. Then connect + scan + playlist to test the Spotify last mile.
5. Cleanup (non-urgent): stray empty Vercel project `festivals`; unused blob stores
   `festival-navigator-crews` (empty) + `test-HG` (legacy doc — after confirming migration);
   `.env.legacy-snapshot` locally; optionally rotate the Spotify client secret (it appeared
   in chat/screenshot; the app never uses it — PKCE — so rotation breaks nothing here).

## If resuming later

Compaction hooks in `.claude/settings.json` still point here — fine to leave until the
branch merges, then remove them + archive the plan per hg-durable-build teardown.
Key invariants live in CLAUDE.md (Neon atomic merge — never a CTE read; Blob banned for
crew docs; vercel dev restart-after-new-files; apostrophe-free hook strings).
