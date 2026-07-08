# NOW — festival-navigator prime-time build: SHIPPED to preview

**Updated:** 2026-07-07 ~11:15 CT · **Branch:** `prime-time` (pushed; production untouched)
**Plan:** `claude-plans/2026-07-07-prime-time.md` · **History:** DEVLOG.md

## 🎉 LIVE (2026-07-08)

Shipped to production and serving on the custom domains:
- **fest.kevinhg.com** · festival.kevinhg.com · crew.kevinhg.com (all 200, SSL provisioned)
- dev.fest.kevinhg.com = staging (pin it to the `staging` branch in Vercel when ready)
- Cloudflare DNS migration done + verified; recordOS + email intact.
- Kevin's migrated crew: `/#g=F4hUPis4l4NfuVMb-UVqUgi2_Zo` ("The Crew").

## Loose ends (all optional / post-launch)
- Slack access flow: needs SLACK_WEBHOOK_URL on prod (Kevin ran it) — verify a request pings Slack.
- Preview/staging env vars: the CLI "Git branch?" prompt only set Production; set Preview via the
  Vercel dashboard (Settings → Env Vars → Preview, blank branch) when you want staging fully live.
- Delete stray empty Vercel project `festivals`; unused blob stores `festival-navigator-crews` + `test-HG`.
- Future: dedicated Spotify app for clean Slack attribution (currently reuses recordOS's webhook).
