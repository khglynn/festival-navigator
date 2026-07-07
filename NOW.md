# NOW — festival-navigator prime-time build

**Updated:** 2026-07-07 (session start)
**Branch:** `prime-time` (pushes = Vercel preview deploys only; production promotes at the end with Kevin's nod)
**Plan / grounding doc:** `claude-plans/2026-07-07-prime-time.md` — read it in full before acting if you are a fresh or post-compaction instance.

## Live state

- Phase: **P0 scaffolding** (state files + hooks being written)
- Next exact step: commit P0 checkpoint, then start P1 (repo hygiene — cruft move + git rm, PWA icon, blob SDK bump, CI skeleton)

## Phase board

| Phase | Status |
|---|---|
| P0 scaffolding | in progress |
| P1 repo hygiene | pending |
| P2 module split + tests | pending — Codex gate |
| P3 crews + storage v3 | pending — BLOCKING Codex gate |
| P4 festival model + views + lineup research | pending |
| P5 Spotify PKCE | pending — Codex gate |
| P6 AI hardening | pending |
| P7 polish + review fan-out + preview | pending — final gates |

## Do-not-lose facts

- Locked decisions: capability-link crews · Spotify PKCE zero-server-secrets (per-crew clientId; 5-user cap on new Spotify apps is an external constraint, document in UI) · stay on Vercel.
- Kevin nixed manual hearts — pick levels ARE the signal.
- `api/selections.js` legacy global blob `festival-data-v2.json` must be MIGRATED into Kevin's crew before retiring the endpoint (his real EF picks live there — verify byte-for-byte survival).
- EF festival id `electric-forest-2025` intentionally holds 2026 data; id gets remapped during migration; update project auto-memory after.
- Kevin's Spotify app creds live in `~/DevKev/personal/festival-navigator/spotify-mcp/.env` (gitignored) — folder moves to `~/DevKev/personal/spotify-mcp/` in P1; check grandfathered allowlist in P5.
- Deploy pushes are previews (branch). NEVER promote to production without Kevin.
