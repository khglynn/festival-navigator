# v3 build — grounding doc (read in full on every resume/compaction)

**Created 2026-07-09 late night. This doc exists to restore rigor that compaction
strips. If you are reading this mid-build: read it all, then the plan
(`2026-07-09-v3-design-build.md`), then NOW.md, then continue.**

## The failure modes this run must refuse

1. **Doing the minimum.** Post-compaction instances drift toward small, safe,
   incomplete units. The job is the pixel-faithful, complete build — Kevin
   authorized the full swing ("no one is using this app yet we can go all the
   way"). Stopping short is the failure, not breaking things on a branch.
2. **Building from priors instead of the atlas.** The design source of truth is
   the extracted handoff at the scratchpad path in NOW.md (re-extract from
   `~/Downloads/Festival navigator v2.zip` if the scratchpad was cleaned; the
   README.md inside is the spec). Never invent a token, color, or radius —
   look it up.
3. **Touching live crew data.** The three real crew docs (The Crew, Lolla 2025,
   Amish ACL) are additive-only, and only through app API paths under test.
   The Neon MCP guard (in `.claude/settings.json`) blocks mutating SQL — do not
   disable it; if a legit migration op is needed, STOP and ask Kevin.
4. **Green-but-unread tests.** Run them AND read the output. Playwright walks
   must actually be looked at (snapshots/screenshots), not just exit-0.
5. **Leaking tokens.** Public repo. Crew tokens (`#g=...`) never enter committed
   files. Grep before docs commits.

## Non-negotiable build facts (learned, verified, or decided — do not re-litigate)

- Architecture: buildless vanilla ES modules. v3 CSS is hand-written
  (`assets/v3.css` + tokens); Tailwind is being retired from the new screens.
- Level mapping legacy→v4: 1→1, 2→2, 3→4. v4 picks are 0–4 (0=cleared
  tombstone, 4=must). Doc version flag governs read mapping; no bulk rewrites.
- Notes are keyed objects (`notes[scope][targetId][noteId]`), NEVER arrays —
  `jsonb_deep_merge` replaces arrays and would eat concurrent notes.
- Crew store: Neon, single inline atomic UPDATE through `jsonb_deep_merge()`.
  No CTE reads (lost 2/6 writes, measured 2026-07-07). Vercel Blob is banned.
- Optimizer is cut (notes replace it). Download-as-PNG and Export-likes SURVIVE
  into Settings → APP (Kevin's explicit keep).
- Gemini (deployed key) powers `/api/festival-add`; custom fests live in a
  crew-scoped Neon table; repo JSON stays canonical for shared festivals.
- Design open questions were decided: tap-5 undo toast · group-merge deferred ·
  notes bubble = total count · member removal confirm + undo.
- The dock is mobile-only. Desktop has no dock. One Settings page, two doors.
- Vocabulary in UI copy: picked / must / notes / fest. Never a music-note glyph.

## Environment gotchas (each cost real time once)

- `vercel dev` does not serve files created after it starts — restart it.
- The Write tool has twice serialized literal `\x00` into this repo — after
  writing regexes/escapes, byte-check with python3.
- Hook command strings must stay apostrophe-free; `bash -n` after any edit.
- `npm run css` freshness is CI-enforced while Tailwind remains; if a legacy
  page still uses it, recompile before commit.
- SW precache: bump CACHE_VERSION on ANY cached-asset change.
- Commit messages via quoted heredoc (backticks in `-m` get shell-evaluated).
- Playwright full-page screenshots stall on the animated gradients — freeze
  animations with injected CSS first, or shoot elements.

## Cadence contract (per loop firing)

Re-ground (this doc if fresh context → plan → NOW.md) → do ONE clean unit from
NOW.md's next-step → verify it honestly → commit (scoped, secret-scanned) →
update NOW.md (+ DEVLOG on meaningful units) → reschedule. Notify Kevin ONLY on
a true blocker (guard trip, gate failure that resists two fix attempts, credential
need). Morning report at P6 teardown regardless.

## Gates

- P2 (data layer) → blocking Codex review before screens build on it.
- P3 → Playwright walk of every screen, both viewports; trailing Codex.
- P6 → triple-check skill + final Codex gate + live-data integrity + promote.
- Codex hangs sometimes: past ~3 min, kill it and verify another way; a flaky
  reviewer is never a reason to skip review.

## P0 distillation appendix (deep read done 2026-07-10 ~00:15; all four docs read in full)

**From codebase legibility — the lying-code discipline:**
- CLAUDE.md additions are non-inferable facts ONLY (ETH: LLM-expanded context
  files measurably hurt; greppable facts do not earn a line). The design rules
  card (Handoff 16a) gets filtered through this before pasting: tokens,
  vocabulary, chip spec = non-inferable, keep; anything re-derivable from
  v3.css or the atlas = leave out.
- DELETE removed features outright, never comment out or disclaim (defective
  code in context → 58% defect rate; prompts to ignore it barely help). The
  optimizer cut means `api/optimize.js` + its client code + UI + tests all GO.
  Same for Tailwind if retired: full removal, not a stranded stylesheet.
- Verify by outcome, not claim: after touching a symbol, grep for every other
  usage before calling the unit done. Tests must pass AND their output be read.
- The festival validator is our fitness function — extend it: a crew-doc-v4
  shape validator with tests becomes the schema fitness gate in CI.
- Provenance travels with the value: LLM-researched festivals store their
  source URLs + fetched-at; a date Gemini cannot source stays absent, never
  guessed (NULL over silent default).

**From dependency security:**
- `@vercel/blob` gets REMOVED from package.json (banned store, drained, only
  importer is the one-time migrate-legacy script — retire script to
  claude-plans/archive note, drop the dep). Target prod dep count: 1
  (@neondatabase/serverless).
- CI gains: `npm ci` (frozen installs) + `npm audit --omit=dev
  --audit-level=high` as a blocking step.
- Fonts: self-host Anton + Inter woff2 in assets/fonts (deliberate deviation
  from the README's "Google Fonts" line — the app's own pitch is "works with
  no signal"; a CDN font breaks that AND adds supply-chain surface. Spirit
  over letter; note it in the handoff report).

**From running-off-laptop:**
- The five operational questions, answered for v3: starts = user action /
  Vercel request; runs = Vercel functions + static; remembers = Neon (crew
  docs + custom fests) + device localStorage; human approval = festival-add
  shows a PREVIEW the user confirms before anything is saved (agent-inbox
  pattern, smallest form); output-stayed-good = validator in CI + sync status
  dot + morning Playwright walk.
- Lethal-trifecta check on `/api/festival-add`: it reads untrusted web content
  (Gemini grounding), can write to the crew store, and is publicly reachable —
  so ALL THREE mitigations are mandatory, not optional: schema validation
  reusing validate-festivals rules; explicit user preview-approve before save;
  per-IP + per-token rate limits. LLM output never executes, only data.
- Idempotent writes: custom-festival save is an upsert keyed (token, festId);
  retries are safe.

**From memory-systems:**
- P13 governs: the right sophistication is what is debuggable on a bad
  Tuesday. jsonb crew doc + atomic deep-merge stays; no event sourcing, no
  CQRS, no separate audit infrastructure tonight.
- Notes are append-only by design (nobody deletes others' notes) and keyed-
  object stored — this satisfies "append-only where irreversibility hurts"
  without any new machinery.
- Untrusted-content boundary: note text and artist names are user content —
  escape on render everywhere, cap lengths server-side, and NEVER interpolate
  crew-doc content into LLM prompts (festival-add takes only the user's typed
  festival name).
- custom_festivals columns include provenance: `source_urls jsonb`,
  `created_by`, `created_at`, `model`. Files stay canonical for human-edited
  festivals; DB holds the machine-ingested ones. Do not invert.
