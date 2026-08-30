# festival-navigator — agent notes

Non-inferable facts only (the code answers everything else — read it).

- **v3 design system**: static tokens in `assets/v3-tokens.css`, screen map +
  aura algorithm in `claude-plans/v3-inventory.md` — look values up, never
  invent them. UI vocabulary is exactly: picked / must / notes / fest. Pick
  levels are 0–4 (0 tombstone, 1–3 picked at alpha .5/.75/1, 4 must); legacy
  v3-doc levels map 1→1, 2→2, 3→4 at read time (old "Must See"=3 IS must —
  labels, not alphas, carry the semantics). Never a music-note glyph (Spotify is
  the green pill). Notes are stored as keyed objects, never arrays
  (jsonb_deep_merge replaces arrays — an array eats concurrent notes).

- **The festival accent (`--fest`) appears in exactly FOUR places**: the fest
  name, the active day tab, stage headers, and the current-fest border in
  Settings. Anything else that wants to look selected or "ours" uses `--brand`.
  This is a rule with teeth: the accent had crept into seven places by
  2026-07-12, including the loader shown while a crew is being CREATED — i.e.
  wearing a festival's colour before a festival had been chosen.

- **The 44px touch floor is applied to `button`, not to a list of selectors.**
  It used to name six, and the naming WAS the bug — every control added after
  those six (chips at 26px, the "+ ✎" note chip at 17px, every button in
  Settings) silently got nothing. If you add a control, it inherits the floor by
  being a button. Do not go back to enumerating. Cards are excluded on purpose
  (expanding them steals taps from neighbouring picks); the narrow *glyph*
  buttons get a wider horizontal upgrade, and that list only ever upgrades —
  forgetting to add to it still leaves a control safe.

- **The model is fests × circles × you (2026-07-14):** the UI is
  festival-first; a "crew" is internally a circle — one cluster, one link,
  the consent boundary — and the word barely surfaces. Two laws with teeth:
  (1) nobody ever sees people in circles they're not in — suggestions may
  rank what a person can already see, never expand it; (2) mute/hide is
  viewer-side only (device/person record), NEVER written to the shared doc.
  Direction doc: `claude-plans/2026-07-14-fests-circles-you-direction.md`.
- **The person token is a master key** (its doc lists every crew token): it
  travels ONLY in the `X-Person-Token` header — never a query param
  (platform logs), never in a crew doc (crew-readable). Crew docs carry the
  public `pid` only; PID_RE/TOKEN_RE length ranges are deliberately disjoint
  so one can never pass as the other.

- **Crew store is Neon Postgres**, project `floral-meadow-70237530` (Kevin's
  personal org). Merges MUST stay a single inline atomic `UPDATE` through
  `jsonb_deep_merge()` — a CTE-based read merges against a pre-lock snapshot
  and measurably lost 2/6 concurrent writes (2026-07-07). Schema source of
  truth: `db/schema.sql`.
- **The merge SQL lives in `api/_lib/crew-sql.mjs`, and that is deliberate**:
  `tests/db-merge.test.mjs` executes THOSE EXACT BYTES against a real Postgres
  (PGlite — in-process, no server, no secrets, runs in CI). Before 2026-07-12 the
  SQL sat inline in api/crew.js where only production could reach it, and the
  suite tested a JS "reference twin" that its own comments admit is NOT what
  production enforces. If you change the merge, change it there, and the test
  follows automatically. Never re-type the SQL into a test — a test against a
  copy passes through exactly the regression it exists to catch.
- **Active member names must be unique case-insensitively.** "Drew" and "drew"
  are one person to every human and two forever to the document, splitting their
  picks down the middle. Enforced in the merge's WHERE clause (the only place
  both concurrent writes are visible) as well as in validateMergedDoc.
- **Vercel Blob is banned for the crew doc.** Its read path is eventually
  consistent even with cache-busting query params; rapid merges lost writes
  outright (measured 2026-07-07). Old stores may still exist on the account.
- **Sync states are online / syncing / offline / error / blocked.** `offline` is
  gray because it is a state, not a fault (you are in a field; we expected this).
  `error` and `blocked` are red because a human is needed. `blocked` means the
  server understood us and said no — a deterministic rejection, so re-sending the
  same bytes is pointless; sync.js remembers the refused payload and waits for a
  NEW edit rather than re-POSTing forever.
- **Docs cannot lie any more, and that is enforced**: `tests/docs-truth.test.mjs`
  asserts the README's structure block points at files that exist, that no doc
  tells anyone to run an npm script that does not exist, that no doc presents
  Tailwind or Blob as part of the stack, and that the festival list lives ONLY in
  `data/festivals/index.json`. History files (DEVLOG, claude-plans) are exempt —
  they are supposed to talk about what we dropped.
- `vercel dev` does not serve files created after it starts, and can serve
  STALE copies of edited files too (measured 2026-07-12: an edited app.js
  served an old version until restart) — when in doubt, restart it, and
  verify with `curl | md5` against the local file. It also refuses to run if
  package.json has a `dev` script that calls `vercel dev` (recursion check),
  which is why there is no `dev` script. Local `vercel dev` pulls the REAL
  cloud env (DATABASE_URL included) — localhost /api hits the production
  Neon DB; treat writes accordingly.
- **The service worker will serve you a stale app while you are testing.** After
  deploying, a browser that already has the old SW keeps serving the OLD cached
  JS/CSS even though the server has the new bytes — verified live 2026-07-12,
  where every fix read as "not applied" until the SW was unregistered and its
  cache deleted. `curl | md5` says the server is right; the browser is lying.
  Unregister + `caches.delete()` + hard reload before believing a browser check.
  And bump `CACHE_VERSION` on every asset-changing commit. **Even with the SW
  gone, hash-only navigations (`#g=…` → `#new`) keep the page's module map —
  edited JS only reloads on a REAL document load (hop via about:blank), and
  the ES-module cache also survives `Network.clearBrowserCache`** (burned a
  test cycle 2026-07-14).
  **After any cached-asset change run `node scripts/sw-stamp.mjs`** — it bumps
  `CACHE_VERSION` and writes `ASSET_STAMP` (a hash of every APP_CORE file);
  `tests/app-shell-complete.test.mjs` recomputes it, so a stale stamp is a red
  build (the gate-round fixes once shipped under an unbumped v43, 2026-08-29).
- **Staging (stage.fest.kevinhg.com preview deploys) shares the PRODUCTION
  DATABASE_URL** — verified empirically 2026-07-14 (a person row created on
  staging was deleted through the prod Neon connection). Staging writes are
  prod writes; test with throwaway crews/persons and delete them after.
- Styling is hand-written CSS in `assets/v3-tokens.css` (tokens) and
  `assets/v3.css` (components) — no build step, no framework. (Tailwind was
  dropped in v3; there is no `npm run css`.)
- Hook command strings in `.claude/settings.json` must stay apostrophe-free
  (a `'` closes the shell quote and silently breaks compaction).
- The Write tool has serialized literal control bytes (`\x00`) into files in
  this repo twice when escape sequences were intended — after writing
  regexes/tests with `\xNN`, verify with `python3 -c "open(...,'rb')"`.
- **Node tests are blind to two browser rules** (both bit on 2026-08-27,
  three Codex rounds and 256 green tests deep): (1) WebIDL receivers — a DOM
  global stored on an object or record and called as a method
  (`hold.clearTimer(id)`) throws "Illegal invocation" in every browser and
  nothing in Node; store arrow wrappers, never the bare function. (2)
  Storage GETTERS throw — Chrome with site data blocked raises SecurityError
  from `window.sessionStorage` itself, and `typeof sessionStorage` does not
  guard it; every touch of a storage object, the getter included, sits in a
  try. The suite carries receiver-strict and throwing-getter stubs now, but
  the defence with teeth is a real-browser walk (a Sonnet teammate, real
  pointer input, never `element.click()`) before any promote.
- **This repo is PUBLIC.** A crew token (`#g=…`) IS the credential for that
  crew's data. Never commit one; scan before every commit with `&&` (never `;`,
  which runs the commit even when the scan trips). `.gitignore` denies `*.png`
  by default and allowlists the three icons that ship, because an audit run once
  dumped 50 screenshots into the repo root.
- Deploy is gated: branch pushes = preview only; production promote is
  Kevin's call, always.
- Adding a festival: `docs/add-a-festival.md`. Validate with
  `node scripts/validate-festivals.mjs` before committing — CI enforces it.
- **Artist names in a live festival file are pick keys, and there is no
  rename path.** `tests/fixtures/live-pick-keys.json` freezes them
  (`node scripts/freeze-pick-keys.mjs <id>` — run it the day real people
  start picking in a fest, and before any set-times edit); a name that
  disappears fails CI. Grid names must match `artists[]` byte for byte —
  the validator makes a case-only match an ERROR because it would split
  the crew's picks between two spellings forever (2026-08-27).
- **Festival JSONs are served network-first by the service worker** (4 s
  budget, persistent cache as the offline answer). They used to be
  cache-first in the persistent data cache, which meant a set-times drop
  reached an online phone one open LATE (found 2026-08-27). If a data drop
  "isn't showing", the SW is the first suspect — see the stale-SW note above.

- **How this app moves (Kevin, 2026-08-30 — the vibe, not the mechanics; the
  code carries those).** This is a designer's passion project, and the bar is
  delight: taste, flow, and the little things. Things grow from where they
  already are and every piece travels to where it is going — nothing pops,
  nothing appears from nowhere, nothing vanishes in place. A state change
  is a small event: a pill arriving after a tap slides in and its neighbours
  make room; the way in has a little life (a beat between arrivals, a curve
  with a touch of overshoot), the way out is quick and plain. Motion is
  light — transforms and opacity, never a layout the whole wall has to
  redo — and Low Power or reduced-motion makes it instant, never broken.
  Edge cases are part of the design, not afterthoughts: the card at the
  screen's edge, the two-line name, the tall set, the card with nothing on
  it yet. A session that treats these as nits will have a rough time here;
  a session that walks the states in a real browser before showing Kevin
  will not. The zoom gallery in `gallery.html` is where every state lives.
