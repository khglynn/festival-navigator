# claude-plans

Specs, session plans and review logs. Most of it is history. The few living
specs that code, tests or CLAUDE.md cite stay at this level; finished arcs
live in `archive/`.

## Living specs

- `v3-inventory.md`: the v3 design system (screen map, aura algorithm,
  token values).
- `2026-07-14-fests-circles-you-direction.md`: the fests × circles × you
  model.
- `2026-09-16-wall-v4/MODEL-V4.md`: the wall, simplified — one rule for
  stage columns vs venue stacks, days are the days, sections fold. Proposed
  2026-09-16; supersedes MODEL-V3 §2–§4 once Kevin picks it.
- `2026-08-31-events-canvas/MODEL-V3.md`: the events model (day-first, the
  layout rule, back-to-back runs). Spec of record for PR #16 as built.
- `2026-08-30-zoom-storyboard.md`: how the zoom moves ("the bloom").
- `2026-07-12-taste-rubric.md`: the judgment calls a surface is checked
  against before it counts as finished (draft).

## The current arc (PR #16)

- `2026-09-01-events-build/`: PROGRESS.md (the build log) and the first
  review round.
- `2026-09-02-venue-profiles/`: the research behind `data/venues/index.json`.
- `2026-09-01-zoom-simplification-review.md`: what in card-facts.js can be
  simplified, and what the skeptics refuted.
- `2026-09-01-zoom-tests-first/`: shipped as PR #14.

## Rigs you can re-run

- `2026-09-01-walk-rig/`: real-input browser walks as a plain process.
- `2026-08-29-notes-desktop-canvas/`: renders production walls in jsdom for a
  design canvas.

## Banked, not built

- `2026-09-02-add-a-show.md`
- `2026-08-27-schedule-drop-watcher-future-build.md`

## archive/

`archive/2026/` holds the finished July and August plans, audits, Codex
reviews, the 2026-08-30 survey, and NOW.md's history up to 2026-09-02. A plan
moves there once its arc has shipped and nothing living cites it; grep the
repo for its name before moving it.
