> **ARCHIVED 2026-07-14 — EXECUTED.** Phase 1 shipped to staging as v32
> (two Codex gate rounds; see NOW.md + DEVLOG). The "who's this with?" step
> it specifies was then superseded the same night by the fests-circles-you
> pivot — see `2026-07-14-fests-circles-you-direction.md`. The Phase 2
> section (library summary on the person record, client-composed) remains
> the banked design and still applies under the circle model.

# Me-link identity (Phase 1) + landing/share UX — festival-navigator

**Drafted 2026-07-13 (plan mode). Supersedes the v3.1 audit plan that lived in
this file (executed + banked in DEVLOG; archive to claude-plans/ on ship).**

## Context

Kevin's primary use case: *"I am me, friends are friends, and we mix and match
across crews."* Today identity is per-crew-per-device — nothing links "Kevin in
EF 26" to "Kevin in Amish ACL," restoring a new browser means re-opening every
crew link, and the landing page actively teaches the wrong model (the hero
"ADD A FESTIVAL →" creates a *crew*; the list is headed "YOUR FESTIVALS" but
rows are crews — which is how Kevin ended up with four single-fest crews).
He wants to share the app with friends soon; the landing/share UX is co-equal
with the plumbing. No accounts: identity stays link-based, same trust model as
crew links. Email/phone attach is explicitly Phase 3 (needs verification infra
+ changes the no-PII posture) — not in this build.

**Kevin's decisions (2026-07-13):** landing CTA becomes fest-first → "who's
this with?" (existing crew or new). Build Phase 1 now; Phase 2 designed here
but banked for a fresh session.

## Design (settled)

### Person record
- New `persons` table (db/schema.sql, idempotent):
  `id TEXT PK` (public, 12 chars base64url — safe to stamp into crew docs) ·
  `token TEXT UNIQUE` (secret credential, 20-byte base64url like crew tokens) ·
  `doc JSONB` · created/updated timestamps.
- Person doc v1: `{ v:1, name, crews: { <crewToken>: { name, crewName } } }`.
  `crews` is a keyed object (merge religion — never arrays). Per-crew `name`
  allows legacy divergence (Ross/Rosss); top-level `name` is the default.
  `crewName` is a display cache so restore renders instantly; refreshed on
  each crew open (stale-tolerant).
- **The person token is a master key** (holds every crew token). It must NEVER
  appear in a crew doc — crews get only `people.<Name>.pid` (the public id).
  The me-link copy carries the consequence, not a lecture (see YOU card).

### API — api/person.js (sibling of api/crew.js, same guards)
- `POST /api/person` (no `t`) → create `{name}` → `201 {token, id, doc}`.
  Rate-limited (reuse `rateLimited`, 10/hr). `crossSite` guard.
- `GET /api/person?t=<token>` → doc + id. `Cache-Control: no-store`.
- `POST /api/person?t=<token>` `{data}` → validated atomic merge, returns doc.
  Merge SQL lives in api/_lib/crew-sql.mjs as `PERSON_MERGE_SQL` (same
  jsonb_deep_merge, size cap only — no people invariants) **so
  tests/db-merge.test.mjs can run the exact bytes** (repo rule).
- crew-shared.mjs: `LIMITS.personDocBytes = 32768` (Phase 2 revisits),
  `validatePersonIncoming` (name via name-rules, crew-token keys via TOKEN_RE,
  crewName ≤40, forbidden-keys defense), and `validatePeople` extended to
  accept `pid` (`/^[A-Za-z0-9_-]{8,24}$/`).

### Client — js/crew.js person helpers + js/v3/app.js hooks
- js/crew.js: `myPersonToken()/myPersonId()` (localStorage `fn_person_v1`),
  `ensurePerson(name)` (create-if-missing, silent), `stampPersonCrew(crewToken,
  name, crewName)` (merge into person doc), `personFromHash()` (`#p=<token>`),
  `meLink()` (`${origin}/#p=…`).
- **Stamping** (all idempotent, offline-tolerant — failures never block the
  flow, retry on next open):
  - createCrewFlow (app.js:459): after `setMe` → ensurePerson + stamp + queue
    `people.<name>.pid` through normal pending merge.
  - renderJoin (app.js:889): both claim paths (tap + type) → same stamping.
  - enterApp (app.js:1000): backfill — if person exists and this crew isn't in
    the person doc (or pid missing from crew doc), stamp. This migrates
    Kevin's four existing crews one open at a time; no big-bang.
  - renameSelf (app.js:806): also update person doc's entry for this crew.
- **Restore**: boot() (app.js:1144) routes `#p=` before `#g=`: fetch person
  doc → for each crews entry `rememberCrew(token, crewName)` + `setMe(token,
  name)` (union with local, never removes) → store person token →
  renderLanding. Malformed/gone person link → reuse renderBadLink pattern.

### Landing redesign (implements the unbuilt 21a spec from v3-inventory.md)
- **YOU card** (only when a person exists): 30px avatar (existing `.avatar.lg`
  atom) + name + "My link" copy button (existing clipboard pattern) + micro
  copy in the app's consequence-forward voice: **"Open it on a new phone and
  everything comes back — every crew, every pick. Sharing it makes someone
  else you, so don't."** (Final wording gets Kevin's eyeball on staging with
  the rest of the copy pass.)
- **YOUR CREWS** (micro-label renamed from "Your festivals"): each row = crew
  name (display font) + fest line (resolve `cachedDoc.festivals` keys via
  FESTIVAL_INDEX; unknown/custom ids fold into "+N more") + 17px avatar
  cluster (-5px overlap, per spec) + chevron.
- Helper copy rewrite: teach crew-holds-fests-and-people; "Got a link? Just
  open it — that's joining" stays.

### Create flow — "who's this with?" step (Kevin's pick)
- Step 1 (pick fest — unchanged) → **new step 1.5** when the device knows ≥1
  crew: rows for each crew (name + members line) + "+ a new crew". Fresh
  users skip it entirely.
  - Existing crew → server-first merge `festivals.<fid>: {selections:{}}`
    (join-flow's server-first pattern), set active fest, enterApp. Offline
    fallback mirrors join's.
  - New crew → today's step 2 (your name) → createCrewFlow, unchanged.
- Share-moment + settings copy audit: crew invite = "brings a friend into
  THIS crew"; me link = "brings YOU back" — two sentences, no new surfaces.

### Docs + hygiene
- docs/user-flows.md: F1 (landing) + F2 (create) updated; new **F17 · Me-link
  restore**. README structure block gains api/person.js (docs-truth enforces).
- service-worker.js CACHE_VERSION → v32. Hook strings stay apostrophe-free.
- Run the new schema on Neon (idempotent schema.sql re-run) before staging
  verify — via Neon MCP `run_sql` against project floral-meadow-70237530.

## Phase 2 — BANKED design (do NOT build this session)

Goal: badges appear in crews you never opened; new fests badge for everyone
instantly. Person doc gains `library: { artists: { <lower>: {songs,
followed} }, likedCount, user, scannedAt }` — derived summary only (never
OAuth tokens or trackUris; those stay device-local). Cap raised (~384KB).
After scanLibrary, device POSTs the summary to its person record.
**Compose client-side, not in crew GET**: the server doesn't hold fest artist
lists (repo JSON + custom_festivals), so a new endpoint returns member
summaries for a crew (auth = crew token; server verifies requested pids are
members of that crew's doc) and the client matches against fest artists it
already has. Crew GET hot path stays untouched. Open detail to settle then:
summary staleness display + re-scan nudge.

## Out of scope
Email/phone attach (Phase 3) · picks migration between crews (superseded —
the landing groups crews under you) · member management · Spotify allowlist
scaling (Spotify's wall, tracked separately).

## Files touched
db/schema.sql · api/person.js (new) · api/_lib/crew-shared.mjs ·
api/_lib/crew-sql.mjs · js/crew.js · js/v3/app.js · index.html ·
assets/v3.css · docs/user-flows.md · README.md · service-worker.js ·
tests/db-merge.test.mjs + tests/person.test.mjs (new) + validator tests.

## Verification
1. `npm test` — new: PERSON_MERGE_SQL against PGlite (exact bytes), person
   validators, jsdom tests for stamping (create/join/rename), restore union,
   pid in crew merge; docs-truth stays green.
2. `vercel dev` (restart-fresh; it hits the REAL Neon DB — use throwaway
   crews/persons) + Playwright: fresh-user create (no step 1.5) · existing-
   crews create with step 1.5 both branches · me-link restore into a cleared
   profile (all crews + names return) · landing you-card + clusters at
   390/768/1440.
3. Codex gate on the full diff (blocking).
4. Secret scan before every commit (`#g=`/`#p=` patterns, `&&` never `;`).
5. Push v31-polish → **staging** verify by served CACHE_VERSION → Kevin
   eyeballs → **prod promote is Kevin's call**.
6. Live sanity: Kevin's device opens each of his four crews once (backfill
   stamps), then me link on a second browser restores all four.

## Sizing
L — multiple deliverables (schema+API, client identity, landing redesign,
create-flow step, docs/tests), one review checkpoint before prod.

**Approving this plan starts the build immediately** (schema + API first,
then client identity, then UX, then tests/docs — committed in small scoped
commits on v31-polish, staged for your review; nothing hits prod without
your promote).
