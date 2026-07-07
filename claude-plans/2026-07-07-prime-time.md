# Festival Navigator — Prime Time (2026-07-07)

Multi-crew, multi-festival, per-person Spotify. Grounded in hg-ground-it's four docs; driven with hg-durable-build (banked state, phase gates, Codex reviews). Kevin has Fable through EOD — build to completion.

## Context

The app worked single-crew at Electric Forest 2026 but has **no group concept** (one world-writable Vercel Blob for every visitor), a **fragile write path** (delete-then-put, races), an **open LLM proxy** (`/api/gemini` accepts raw prompts on Kevin's key), Kevin-only Spotify badges baked at build time, no view for festivals whose stage schedules haven't dropped, and a public repo carrying ~160 files of unrelated music-app cruft. Goal state: a best-in-class, shareable, free-to-run PWA any crew can use for any festival.

## Decisions (locked with Kevin, 2026-07-07)

1. **Crews via capability links** — unguessable token URL = access; no accounts. A crew spans festivals (people persist; selections per festival).
2. **Spotify via PKCE, zero server secrets** — pick levels are the affinity signal (no redundant "hearts"). Kevin's crew uses his existing Spotify app's Client ID; other crew heads paste their own app's Client ID (public, PKCE ⇒ no client secret anywhere). Member tokens live only in their own localStorage. Spotify's 2026 cap: ≤5 users per new dev app, owner needs Premium — documented plainly in UI. Playlists are created under the *member's own account* client-side.
3. **Stay on Vercel** — harden in place. Hobby tier: worst case is pause, never a bill.

## Verified constraints

- Spotify (official migration guide, fetched today): new dev apps 5 users / 1 client ID / owner Premium; existing apps grandfathered at current counts, no expansion. Extended quota = registered business + 250k MAU.
- Vercel Blob Hobby (docs, today): ~5GB, 100K simple ops/mo, 10K advanced ops/mo (every `put`/`list` is advanced), 20/s & 15/s rate caps. → per-crew docs + debounced pushes + poll via GET keeps us far inside.

## Architecture (v3)

**Storage:** one private blob per crew: `crews/<token>.json` = `{v:3, meta:{name,createdAt}, spotify:{clientId?}, people:{name:{color,removed?}}, festivals:{<festId>:{selections:{artist:{person:level}}}}, affinity:{person:{artist:{songs?,followed?}}}}`. API `api/crew.js`: `POST /api/crew` (create, crypto-random token), `GET/POST /api/crew?t=<token>` (read / validated deep-merge write, atomic `put` with `allowOverwrite` — **no del-then-put**), schema validation + 256KB size cap + level∈{0,1,2,3} at write time (write-time validation per data-quality rules). Same-origin checks; CORS `*` removed. Legacy global doc migrated into Kevin's crew; old `/api/selections` retired.

**Festival data:** `data/festivals/index.json` + `data/festivals/<id>.json`, `status: lineup|scheduled|archived`; `artists[]` always present (list view source), `days{}` when schedule exists — same shapes the current renderer computes from. Client lazy-loads active festival. `scripts/validate-festivals.mjs` (schema, time parse, stage refs, dupes) + `scripts/import-festival.mjs` (raw lineup text → JSON). EF id remapped cleanly during crew migration (old id quirk retired; update project memory after).

**Views:** existing grid + **overlap-aware columns** (overlap cluster → side-by-side subcolumns; kills the reason "also happening" existed; activities list stays as data-driven non-stage programming). New **artist list view** (default for `lineup` status): sort by name / day / stage / my pick / crew heat / my Spotify; search filter; same tap-to-cycle picks; picks are artist-keyed so they carry over when the schedule drops.

**Spotify (js/spotify.js):** PKCE connect (scopes: user-library-read, user-follow-read, playlist-modify-public/private; static `/spotify-callback` redirect page) → paginated liked-tracks + follows scan → full artist map cached device-local → filtered to crew festivals → `affinity[person]` synced to crew doc. Badges per person (as today, but *yours*, not Kevin's). List view gets crew-affinity column. **Playlist builder:** picks (mine/crew × level × day) → track search → playlist on the connected member's account → share link.

**AI:** `/api/artist-info` keeps bounded input + 1h cache, adds per-IP rate limit + origin check. `/api/gemini` replaced by `/api/optimize` (structured `{festivalId, day, picks}` — server builds the prompt). Client BYO-key fallback stays.

**Structure:** slim `index.html` + native ES modules (`js/app.js`, `state.js`, `sync.js`, `crew.js`, `time.js`, `spotify.js`, `ai.js`, `tools.js`, `render/{grid,list,people}.js`) — no bundler. Tailwind precompiled via CLI to committed `assets/app.css` (deploy stays build-less); html2canvas vendored; SW precache list updated + version bump. `node --test` suite for pure logic (time math, merge, overlap clustering, bulk parser, name normalization, validators). GitHub Actions: tests + festival validation + `npm audit --omit=dev`; Dependabot. `@vercel/blob` bumped to current major.

## Phases

**P0 — Scaffolding & safety:** branch `prime-time` (pushes → preview deploys only; production promoted at the end with Kevin's nod). NOW.md / DEVLOG.md / this plan → `claude-plans/2026-07-07-prime-time.md`. Project `.claude/settings.json` compaction hooks (PreCompact bank-state reminder; SessionStart:compact re-ground pointer). Commit checkpoint.

**P1 — Repo hygiene:** move cruft dirs (`Music files`, `arhived_album-gridv2`, `media player references`, `Tracks not using right now`) → `~/DevKev/_archive/festival-navigator-cruft/` and `spotify-mcp/` → `~/DevKev/personal/spotify-mcp/` (own project; README pointer), then `git rm` (history preserves; no rewrite). New PWA icon (replace 351KB recordOS logo). Delete obsolete BACKEND_SETUP.md. Bump blob SDK. Dependabot + CI skeleton.

**P2 — Module split (no behavior change):** carve index.html into modules; precompiled Tailwind; vendor html2canvas; tests for extracted pure logic; SW v5. Verify: Playwright parity vs production (grid renders, picks cycle, sync round-trip). **Codex gate.**

**P3 — Crews & storage v3:** api/crew.js, landing (create/join/my-crews), hash routing `#g=<token>`, join = pick/add your name (device remembers), migrate legacy doc → Kevin's crew (print link), retire old endpoint. Verify: two isolated browser contexts create/join/sync; write-validation rejects garbage; offline queue drains. **Codex gate (blocking — everything builds on this).**

**P4 — Festival model & views:** JSON model + loader + validator + importer; list view; overlap-aware grid (EF data has the real overlap case to verify against); activities stay. **Lineup research fan-out (Workflow, sonnet agents):** ACL 2026 (W1/W2), Seismic Dance Event, Lost Lands 2026, EDC Orlando 2026, Portola 2026, Tomorrowland Winter 2027 — whatever is announced gets imported + validated; unannounced get `lineup`-status stubs. ACL W1-vs-W2 compare view if lineup shape supports it (stretch).

**P5 — Spotify:** PKCE flow + affinity import + per-person badges + playlist builder + crew Client-ID settings + "set up your crew's Spotify app" guide. Verify with Kevin's real account + his existing app (check its grandfathered allowlist in passing). **Codex gate.**

**P6 — AI hardening:** /api/optimize, rate limits, origin checks, retire raw endpoint, client updates.

**P7 — Prime time:** README truth pass, CLAUDE.md (non-inferable facts only), add-a-festival guide, onboarding polish, full triple-check + **Workflow review fan-out** (correctness / security / data-quality / UX dimensions, adversarial verify) + final Codex pass + Playwright E2E sweep + Lighthouse PWA check. Preview URL to Kevin → he promotes.

## Done-done-done

- Two fresh browsers: create crew → join via link → pick sets → cross-sync ≤25s; offline picks queue & drain.
- Lineup-only festival: sortable/searchable list, picks carry to grid when schedule lands.
- Overlapping same-stage sets render side-by-side (EF regression case).
- Spotify connect → my badges + playlist from picks on my account (Kevin-verified live).
- New festival = validated JSON + index entry, documented; importer assists.
- No secrets in repo; crew blobs private; writes validated/capped; AI endpoints structured + rate-limited; CORS locked.
- CI green (tests + validation + audit); truthful README; cruft gone; PWA installs with real icon.

## Non-goals (explicit)

Accounts/login, >5 Spotify connections per crew (API cap, documented), git history rewrite, billing/monetization (free Hobby; revisit if outgrown), native apps.

## Verification method throughout

Playwright against `vercel dev` + preview deploys; `node --test` in CI; write-time validators; data checked against known entities (Kevin's EF picks survive migration byte-for-byte); every phase ends with its own verify step before the next begins.
