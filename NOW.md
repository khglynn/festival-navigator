# NOW — festival-navigator prime-time build

**Updated:** 2026-07-07 ~10:45 CT
**Branch:** `prime-time` (NOT yet pushed; production untouched)
**Plan / grounding doc:** `claude-plans/2026-07-07-prime-time.md` — read in full if fresh/post-compaction.

## Live state

- **P0–P6 COMPLETE and committed** (9 commits on prime-time): hygiene, module split,
  crews (capability links + Neon atomic-merge store), festival JSON model + list view +
  overlap grid + 6 researched lineups, Spotify PKCE, AI hardening, all review fixes.
- **P7 in progress.** Remaining: CI gets test+validate steps → README truth pass →
  repo CLAUDE.md → add-a-festival guide → memory update (EF id remap) → final Workflow
  review fan-out + Playwright sweep → push branch (preview deploy) → Kevin checks preview
  → promote → teardown (hooks out, close NOW).

## Blockers / Kevin's move

- **DATABASE_URL is NOT in Vercel envs yet** (classifier denied my `vercel env add`; Kevin's
  one-liner still pending). Preview/production API will 500 without it. Value = Neon project
  `floral-meadow-70237530` connection string (in `.env.legacy-snapshot`-adjacent scratch;
  also retrievable via `vercel env pull` won't have it — get from Neon MCP get_connection_string).
- Kevin cleanup list (end of session): delete stray empty Vercel project `festivals`
  (accidental, my bad-cwd vercel dev); decide fate of old public blob store `test-HG`
  (legacy doc preserved there) + empty private store `festival-navigator-crews` (unused after
  the Neon pivot); register redirect URI + client ID for his Spotify app; run the Spotify
  connect flow live (only thing I could not verify without his account).

## Do-not-lose facts

- **Kevin's migrated crew token: `F4hUPis4l4NfuVMb-UVqUgi2_Zo`** ("The Crew", 5 people,
  EF-2026 picks + Kevin's 37-artist affinity, verified byte-for-byte, twice).
- Neon: project `floral-meadow-70237530`, table `crews`, function `jsonb_deep_merge`
  (source now tracked in `db/schema.sql`). Merge = single inline atomic UPDATE — a CTE
  version LOST 2/6 concurrent writes; inline survives 18/18. Never reintroduce a CTE read.
- Vercel Blob was dropped for crew docs: eventually-consistent reads lost writes
  (measured 3/6 stale, 1 write gone). Blob has NO role anymore.
- Local dev: `vercel dev` on :3112 needs `export DATABASE_URL=$(cat <scratchpad>/dburl.txt)`.
  vercel dev does NOT serve files created after it starts — restart after adding files.
- Spotify: 5-user cap on new dev apps (Mar 2026), owner needs Premium. PKCE, zero server
  secrets, per-crew clientId, tokens in member localStorage only.
