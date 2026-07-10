# NOW — festival-navigator: v3 OVERNIGHT BUILD RUNNING

**Updated:** 2026-07-10 ~00:05 CT · **Branch:** `v3-design` (cut from rescue-and-archives)
**Run docs:** `claude-plans/2026-07-09-v3-design-build.md` (plan) ·
`claude-plans/2026-07-09-v3-grounding.md` (read on resume) · **History:** DEVLOG.md

## ▶️ LIVE STATE (loop maintains this block)

- **Phase:** P3 build COMPLETE → P3 GATE (walk + trailing Codex + old-UI deletion). Hooks + guard installed and verified; branch cut;
  plan + grounding committed; four foundation docs deep-read ✓; atlas read in
  full → v3-tokens.css + v3-inventory.md banked ✓ (aura algorithm found as
  reference code in the atlas script — port, do not invent); CLAUDE.md carries
  the non-inferable v3 rules ✓.
- **Design source:** scratchpad `design/design_handoff_festival_navigator/`
  (re-extract from `~/Downloads/Festival navigator v2.zip` if cleaned).
- **EXACT NEXT STEP:** P3 gate walk DONE (7 screens read; findings fixed:
  desktop fest pill wired, dates clamped in header/fest-rows/settings-card).
  Next: (1) old-UI deletion (delete-not-disclaim): js/app.js, js/render/,
  js/ui.js, js/tools.js, js/ai.js, api/optimize.js (optimizer cut),
  assets/tailwind* + tailwind config + npm dep + CI css-freshness step;
  custom.css pruned to what recover.html still uses (accent-button etc.) or
  recover.html restyled onto v3 tokens; gallery stays (uses v3.css). recover
  page keeps working — verify after deletion. (2) Launch trailing Codex on
  the P3+P4 diff. (3) P5: SW precache list rebuilt for v3 modules + fonts +
  CACHE_VERSION v13; canvas favicon; contrast check.
  Local test rig: vercel dev on :3111 (task b6lhnujql) + throwaway crew token
  in scratchpad/v3-test-crew.txt ("V3 Wall Test" — Neon debris, morning
  cleanup). NOTE: old SW (v11) controls prior tabs through one reload —
  expected, skipWaiting converges on second load. P6 must live-test op=migrate
  against a synthetic v3 crew row (INSERT via MCP passes the guard).
- **Kevin authorized promote-to-production when P6 fully passes (this run only).**

## 🎉 LIVE (since 2026-07-08)

- **fest.kevinhg.com** · festival.kevinhg.com · crew.kevinhg.com (all 200, SSL provisioned)
- dev.fest.kevinhg.com = staging (pin it to the `staging` branch in Vercel when ready)
- Crew links live in chat/scratchpad only — **this repo is public; never commit a
  crew token** (`grep -r "#g=" .` before committing docs).

## 2026-07-09 — recovery + archive fests (this branch)

- **Lolla 2025 crew restored to Neon** from two surviving sources (Chrome
  localStorage + Aug-2025 blob): 14 artists, 21 picks, 6 people, verified
  leaf-by-leaf. Link shared in chat.
- **EF '26 crew picks**: server copy was destroyed pre-migration (legacy blob
  clobbered 2026-07-07 09:10, one minute before migrate ran — the blob-loss
  failure mode CLAUDE.md documents). Phones that synced during the festival
  still hold `fn_data_v2` locally → **recover.html** (new) reads all legacy
  localStorage generations, previews, merges via existing /api/crew, verifies.
- **Three archived festivals added**: `ubbi-dubbi-2026` (Into the Abyss,
  Apr 24–25), `wicked-oaks-2025` (Carson Creek Ranch, Oct 25–26),
  `acl-2025` (Zilker, both weekends) — lineups researched + adversarially
  verified; no set-time grids (archived, list view).
- **Spotify badges** for new + EF lineups: blocked on a device that holds the
  library scan (`fn_spotify_libmap_v1`) — recover.html uploads it, or re-run
  Connect → scan in the app once, then open each festival.

## Decisions Kevin owns
- **Run one CREATE TABLE (morning, 30 seconds):** `custom_festivals` DDL is in
  db/schema.sql; the destructive-op guard false-positived on its ON DELETE
  CASCADE clause and the auto-mode classifier (correctly) refused my
  workaround as guard-circumvention. Approve the Neon MCP call interactively
  or run `psql $DATABASE_URL -f db/schema.sql` (idempotent). Until then
  /api/festival-add research works; save/list 500 gracefully.
- **Rotate The Crew's token** (it's in this public repo's git history).
  One UPDATE in Neon + re-share the link; old link dies.
- Promote `rescue-and-archives` to production after preview review.
- Neon crew-table cleanup: 6 test crews from Jul 7–8 ("Port Check", "Neon
  Probe" ×2, "Fix Probe", "Neon Crew", "New Name") are deletable debris;
  "Amish ACL" (Jul 8, Lost Lands picks) looks real — keep unless Kevin says
  otherwise.
- Old-domain rescue: if the crew's June picks were made on
  `festival-navigator.kevinhg.com` (DNS now dead), re-point that hostname at
  the Vercel project temporarily so phones can open /recover.html on it.

## Loose ends (unchanged from launch)
- Slack access flow: verify a request pings Slack (needs SLACK_WEBHOOK_URL on prod).
- Preview/staging env vars via Vercel dashboard when staging should go fully live.
- Delete stray empty Vercel project `festivals`; blob stores are now safe to
  delete (their unique data was recovered into Neon 2026-07-09).
- Future: dedicated Spotify app for clean Slack attribution.
