# festival-navigator — agent notes

Non-inferable facts only (the code answers everything else — read it).

- **v3 design system**: static tokens in `assets/v3-tokens.css`, screen map +
  aura algorithm in `claude-plans/v3-inventory.md` — look values up, never
  invent them. UI vocabulary is exactly: picked / must / notes / fest. Pick
  levels are 0–4 (0 tombstone, 1–3 picked at alpha .5/.75/1, 4 must); legacy
  v3-doc levels map 1→1, 2→2, 3→4 at read time (old "Must See"=3 IS must —
  labels, not alphas, carry the semantics). Festival accent color appears ONLY
  on: fest name, active day tab, stage headers, current-fest border in
  Settings — everything else neutral. Never a music-note glyph (Spotify is
  the green pill). Notes are stored as keyed objects, never arrays
  (jsonb_deep_merge replaces arrays — an array eats concurrent notes).

- **Crew store is Neon Postgres**, project `floral-meadow-70237530` (Kevin's
  personal org). Merges MUST stay a single inline atomic `UPDATE` through
  `jsonb_deep_merge()` — a CTE-based read merges against a pre-lock snapshot
  and measurably lost 2/6 concurrent writes (2026-07-07). Schema source of
  truth: `db/schema.sql`.
- **Vercel Blob is banned for the crew doc.** Its read path is eventually
  consistent even with cache-busting query params; rapid merges lost writes
  outright (measured 2026-07-07). Old stores may still exist on the account.
- `vercel dev` does not serve files created after it starts — restart it.
  It also refuses to run if package.json has a `dev` script that calls
  `vercel dev` (recursion check), which is why there is no `dev` script.
- Tailwind is precompiled and committed (`assets/tailwind.css`); run
  `npm run css` after changing classes or CI fails the freshness diff.
- Hook command strings in `.claude/settings.json` must stay apostrophe-free
  (a `'` closes the shell quote and silently breaks compaction).
- The Write tool has serialized literal control bytes (`\x00`) into files in
  this repo twice when escape sequences were intended — after writing
  regexes/tests with `\xNN`, verify with `python3 -c "open(...,'rb')"`.
- Deploy is gated: branch pushes = preview only; production promote is
  Kevin's call, always.
- Kevin's crew token (real data, migrated from EF 2026): see NOW.md while the
  prime-time build is active; never commit tokens to the repo.
- Adding a festival: `docs/add-a-festival.md`. Validate with
  `node scripts/validate-festivals.mjs` before committing — CI enforces it.
