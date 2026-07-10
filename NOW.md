# NOW — festival-navigator: v3 OVERNIGHT BUILD RUNNING

**Updated:** 2026-07-10 ~00:05 CT · **Branch:** `v3-design` (cut from rescue-and-archives)
**Run docs:** `claude-plans/2026-07-09-v3-design-build.md` (plan) ·
`claude-plans/2026-07-09-v3-grounding.md` (read on resume) · **History:** DEVLOG.md

## ▶️ LIVE STATE (loop maintains this block)

- **Phase:** P0 — ground + rig. Hooks + guard installed and verified; branch cut;
  plan + grounding committed.
- **Design source:** scratchpad `design/design_handoff_festival_navigator/`
  (re-extract from `~/Downloads/Festival navigator v2.zip` if cleaned).
- **EXACT NEXT STEP:** deep-read the four hg-ground-it reference docs (~45k
  tokens, really read), append the build-relevant distillation to the grounding
  doc appendix, then extract the Screens atlas → `claude-plans/v3-inventory.md`
  (every screen, component, token, with source line refs) + first-pass
  `assets/v3-tokens.css`.
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
