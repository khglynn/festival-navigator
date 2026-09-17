# v3 design build — overnight autonomous run

**Created:** 2026-07-09 ~23:50 CT · **Driver:** self-pacing /loop in the live session
**Design source:** `~/Downloads/Festival navigator v2.zip` → extracted at scratchpad
`design/design_handoff_festival_navigator/` (Screens.dc.html = source of truth;
Handoff.dc.html = rules card + decisions; README.md = spec). Claude Design project
`c9cc17f1-6e30-48d1-ae2f-a12d3ce538fc` has the full history if a screen needs
disambiguation.
**Skills governing the run:** hg-partner (latitude), hg-durable-build (state files,
hooks, gates, guard, teardown), hg-ground-it (deep-read the 4 foundation docs in P0).

## The goal state ("done done done")

A pixel-faithful implementation of the Screens atlas on the existing
vanilla-JS/no-build architecture, live on a preview deploy, with:
1. Every screen in the atlas working: landing, join/claim, wall (lineup-only +
   set-times + empty states), day notes + local pins, artist notes sheet, Spotify
   drill page, ONE Settings (two doors), How-it-works, 404, invite-email template.
2. Data layer evolved to doc v4 (picks 0–4 with 4=must, merge-safe notes, per-person
   Spotify block, colorIndex on the 24-board) with version-aware readers — **zero
   bulk mutation of live crew docs; legacy docs render correctly unmigrated.**
3. Festival-add via LLM (Gemini 2.5 Flash + search grounding) producing validated
   festival JSON into a crew-scoped Neon store, merged with the static catalog.
4. Offline story intact: SW bumped, low-power + stay-offline toggles per design,
   canvas favicon, all 11 static festivals + customs load offline once visited.
5. Verified: validator + tests green AND read; Playwright pass over every screen at
   mobile (390×844) + desktop (1280×800); Codex gates passed; data-integrity check
   against live crew docs (The Crew, Lolla 2025, Amish ACL render correctly).
6. State banked (NOW/DEVLOG/plan updated), guards torn down, morning handoff
   report written.

## Decisions made now (veto anytime)

- **Architecture stays buildless** vanilla ES modules + precompiled Tailwind is
  DROPPED for v3 screens — the design's CSS is bespoke (tokens, auras, grain);
  Tailwind adds nothing to it. New `assets/v3.css` (hand-written from the atlas)
  + component JS modules. Tailwind stays only if removal costs more than it saves;
  decide in P1, not dogmatically.
- **Level mapping (legacy → v4):** 1→1, 2→2, 3→4 (old "Must See" IS the new
  "must"; old alpha ladder .5/.75/1.0 maps to taps 1/2/3). Read-time mapping via
  doc version flag; writes normalize per-artist on next touch. recover.html gets
  the same mapping so phone rescue stays correct.
- **Notes storage is keyed-object, not array**: `notes[scope][targetId][noteId] =
  {author, ts, text}` (noteId = author+ts+nonce) because jsonb_deep_merge
  replaces arrays — an array would eat concurrent notes. Server caps text length,
  requires author ∈ people.
- **Design open questions** (README says decide at build): tap-5 gets an undo
  toast (5s, then clear commits) · merge-two-groups deferred (out of scope, noted
  in backlog) · notes bubble shows total count (unseen needs read-tracking =
  sync surface; not tonight) · member removal gets confirm + undo toast.
- **Custom festivals** (LLM-added) are crew-scoped in Neon (`custom_festivals`
  table), not global and not repo commits — no moderation surface, offline-cache
  per crew. Repo JSON stays canonical for big shared festivals.
- **Invite email is a template** (static HTML in repo, copy-able) — no sending
  infrastructure tonight.
- **Branch:** `v3-design` cut from `rescue-and-archives` (includes the 3 archived
  fests + recover.html). Production untouched all night.

## Phases (each: build → verify → commit → bank state → gate)

- **P0 — Ground + rig (L).** Deep-read the four hg-ground-it docs (~45k tokens,
  really read). Extract the Screens atlas source → derive `tokens.css` + component
  inventory doc (checked into claude-plans/v3-inventory.md). Write grounding doc;
  install PreCompact + SessionStart:compact hooks (apostrophe-free commands!);
  install Neon destructive-op PreToolUse guard; cut branch. Paste the Handoff
  rules card (turn 16a) into CLAUDE.md per the design's own instruction.
- **P1 — Design system (L).** tokens/type/grain/gradients/24-board, then
  components: artist card (aura engine), who-corner chips, about-corner, letter
  avatars, pills/toggles/buttons/hero, dock, sheets. `gallery.html` renders every
  component × states for visual QA (and becomes the regression surface).
  GATE: self-verify against atlas + screenshot diff pass.
- **P2 — Data layer (L).** Doc v4 schema + server validation (picks 0–4, notes,
  spotify, colorIndex), version-aware state.js readers, merge tests incl.
  concurrent notes, recover.html mapping update, API tests green AND read.
  GATE: Codex review (blocking — screens build on this).
- **P3 — Screens (XL).** Atlas order: wall first (it's the app), then landing,
  join/claim, settings + how-it-works, notes surfaces, Spotify drill, 404, email
  template. Old UI replaced wholesale on the branch; commits per screen.
  GATE: Playwright walk of every screen, both viewports; trailing Codex review.
- **P4 — Festival-add via LLM (M).** `/api/festival-add`: Gemini + grounding →
  candidate JSON → validate-festivals rules → user preview → save to Neon custom
  store; loader merges catalogs; rate-limited per IP + token.
- **P5 — Offline/perf/a11y (M).** SW precache updates + version bump, low-power
  (kills animation+grain+favicon), stay-offline (suppresses network), canvas
  favicon, focus/keyboard pass, contrast check on the 24-board vs #141021.
- **P6 — Verify + ship (L).** triple-check skill over the whole build; final
  Codex gate; live-data integrity (all three real crews render + a scripted
  concurrent-merge test against a throwaway crew, then deleted); push branch →
  Vercel preview; morning handoff report with per-screen screenshots; teardown
  (guards out, NOW.md closed to shipped state).

## Standing constraints

- Real crew docs: additive writes only, and only through the app's own API paths
  under test; the Neon MCP guard blocks UPDATE/DELETE/DROP/ALTER/TRUNCATE/MERGE.
- No tokens in committed files (public repo — grep `#g=` before each docs commit).
- Workflow/fan-out agents: Sonnet/Haiku only, never the frontier model.
- Loop pacing: 60–270s while units are shipping; notify only on true blockers.
- Every claim in the morning report grounded in a tool result from the run.

## Kevin's answers (2026-07-09 ~23:57 — the run is fully unblocked)

1. **Deploy: all the way.** "No one is using this app yet we can go all the way" —
   when P6 passes fully, merge to main and promote fest.kevinhg.com. This
   supersedes the standing promote-is-Kevin's-call gate for THIS run only.
2. **Keep** Download-as-PNG and Export-likes (tucked into Settings → APP).
   **Optimizer stays cut** — Kevin: "the optimizer became too much of a rabbit
   hole and 90% of the use cases are solved by the grid and notes."
3. **Gemini** (already deployed) powers festival-add.
