# v3 overnight build — morning report

**Written 2026-07-10 ~03:40 CT. The run Kevin kicked off at ~23:50 with "go
forth and fable" is complete: the full redesign is LIVE ON PRODUCTION.**

## What shipped (live on fest.kevinhg.com / festival.kevinhg.com / crew.kevinhg.com)

- **The complete v3 design** from your handoff atlas, pixel-sourced: landing,
  create-a-crew flow, join/claim, the wall (lineup + set-times clock views),
  aura cards with the exact atlas gradient math (pinned by tests), who/about
  corners, notes in all three scopes with device-local pins, artist bottom
  sheet, all-notes view, ONE Settings with two doors, How-it-works, Spotify
  glance + drill (connect/scan/playlist/disconnect), 404 WYA?, invite email
  template (docs/), living canvas favicon, low-power + stay-offline modes.
- **Data layer v4**: picks 0–4 (4 = must), keyed-object notes with
  author-prefixed ids, per-person Spotify stats, colorIndex on the 24-board.
  Migration is SERVER-side, atomic, idempotent — and I pre-migrated all three
  real crews after promote (The Crew, Lolla 2025, Amish ACL are v4 now; the
  Lolla crew's 3 musts are exactly the 3 recovered "Must See" picks — the
  semantics survived recovery AND migration).
- **Festival-add via Gemini** (search-grounded research → validated preview →
  crew-private save). The API is live; **saving needs one command from you**
  (below). Old UI deleted outright: optimizer, Tailwind toolchain, 8 modules.
- Earlier same night: Lolla 2025 crew recovered (21 picks), recover.html
  rescue page, 3 archived festivals (Ubbi Dubbi, Wicked Oaks, ACL 2025).

## How it was kept honest

- 4 review passes: Codex P2 gate (blocking; 3 P0s fixed structurally),
  P3 both-viewport Playwright walk (every screen read), Codex P3 trail
  (12 findings — incl. a real P0: customs were saved but never loaded),
  Codex P6 final gate (migration race P0 + dead create-flow P1 + 5 P2s; its
  full clean-section list is in .claude/codex-v3-p6-review.md).
- Live-data integrity on real Postgres: synthetic v3 crew → migrate op →
  3→4 both fests, idempotent, stale-write mapping verified both directions.
- 56/56 tests; every screen verified against the real branch API in a real
  browser before promote.

## Your morning list (in order of value)

1. **One command, 30s:** create the custom_festivals table so festival-add
   saves work: approve the Neon MCP call interactively, or
   `psql $DATABASE_URL -f db/schema.sql` (idempotent). The guard
   false-positived on its ON DELETE CASCADE; I did not route around it.
2. **Phone rescue (EF picks):** open
   `fest.kevinhg.com/recover.html#g=<The Crew link>` on your phone (and the
   crew's phones). If phones used the old dead domain in June, say the word
   and I'll walk you through the 2-minute Cloudflare re-point.
3. **Token rotation** (public-repo leak, queued since last night): one Neon
   UPDATE + re-share the link.
4. **Neon debris cleanup** (needs the guard lifted or your approval): 6 old
   test crews + tonight's: "V3 Wall Test" (MckTlU--…), "Portola 26"/Zed
   (GmP9H94rRa…), synthetic row migratetest0000000000eeeee.
5. Eyeball the live app — your crew links all work as before, now in v3.

## Deliberate deviations + drops (flagged, not hidden)

- Fonts self-hosted (offline promise + supply chain) vs README's Google Fonts.
- Segmented-control active tint follows the active fest accent (atlas showed
  it in Portola blue only because that was the mock's context).
- "Request access" Spotify-allowlist flow was NOT ported into the v3 drill
  (api/access.js remains server-side; say the word to re-add the button).
- Overlap lanes rewired as a guard; no current data triggers them (verified
  under production end-fill semantics — my earlier "7 overlaps" claim used
  naive 60-min defaults and was wrong).
- Design open questions decided: tap-5 undo toast · notes bubble = total ·
  member-removal confirm pattern (removal UI itself is a fast follow) ·
  group-merge deferred.

## Fast follows worth a session

Member management UI (rename/remove/color change), the festival-add flow on
the landing hero for existing crews, request-access re-add, gallery.html into
the SW shell, deleting stale Vercel blob stores + the `festivals` project.
