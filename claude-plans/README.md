# claude-plans

Specs, build logs and review notes. Most of it is history. The specs that
code, tests or AGENTS.md cite stay at this level; finished arcs move to
`archive/`. Updated 2026-10-19, after the 2026 season.

## Living specs

- `v3-inventory.md`: the v3 design system (screen map, aura algorithm,
  token values).
- `2026-07-14-fests-circles-you-direction.md`: the fests × circles × you
  model.
- `2026-09-16-wall-v4/MODEL-V4.md`: the wall. One rule for stage columns vs
  venue stacks, days are the days, sections fold, a declared by-time layout.
  The spec of record since v85; it replaced MODEL-V3 §2–§4.
- `2026-08-31-events-canvas/MODEL-V3.md`: the events model (day-first,
  back-to-back runs); §1 and §5 still stand under MODEL-V4.
- `2026-09-23-one-line-heads.md`: one line per room ("SAT PORTOLA",
  "SAT AFTERS") and the notes doors on the heads (MODEL-V4 §3c).
- `2026-09-24-now-jump-build.md`: NOW, the jump to what is playing
  (MODEL-V4 §3d).
- `2026-08-30-zoom-storyboard.md`: how the zoom moves ("the bloom").
- `2026-09-23-zoom-chips-motion.md`: the zoom's who-chips in motion.
- `2026-09-24-zoom-chrome-build.md`: where a grown card may stand against
  the dock, rail and stage strip (v87).
- `2026-09-23-meter-build.md`: your meter on the card (what you rated a
  pick), and how the two bottom corners give way.
- `2026-09-24-analytics/`: the one door out (`BUILD.md`), the dashboard and
  alerts (`DESIGN.md`).
- `2026-07-12-taste-rubric.md`: the judgment calls a surface is checked
  against before it counts as finished (draft).

## The 2026 season

- `2026-09-25-portola-live/`: live ops for Portola and ACL. `LEDGER.md` has
  every release, review and rollback target (closed as history
  2026-10-19; its open follow-ups moved to the root `BACKLOG.md`);
  `RUNBOOK.md` is how a release ships while people are using the app.
- `2026-09-26-unified-build/`: the v97–v105 build (List, the tap change,
  people, Our picks, Share), its briefs, rigs and designs. Closed.
- `2026-09-29-tuesday/`: ACL Late nights research and the v106 release.

## Next and banked

- `2026-09-29-native-apps-stack.md`: the iOS and Android app, Capacitor
  around the web app. The next big arc; not started.
- `2026-10-02-find-your-crew.md`: finding your crew on a new phone. Slice 1
  (the Invite sheet's QR) shipped in v115; slice 2 (a home-screen row) and
  slice 3 (crew codes) wait on Kevin.
- `2026-09-02-add-a-show.md`: adding a show the festival file doesn't know.
- `2026-08-27-schedule-drop-watcher-future-build.md`: catching a set-times
  drop and turning it into a data PR.
- City seasons (a whole city's shows by season, Austin v0) is not on main:
  it lives on the unmerged branch `seasons/austin-v0`.
- Discover, artist pages and players: Ray's (raypp2) fork is the source.
  It diverged in July and can't merge in directly; it is banked for the
  2027 tabs.

## Research and rigs you can re-run

- `2026-09-02-venue-profiles/`: the research behind `data/venues/index.json`.
- `2026-09-01-walk-rig/`: real-input browser walks as a plain process.
- `2026-08-29-notes-desktop-canvas/`: renders production walls in jsdom for
  a design canvas.
- `2026-09-23-rating-canvas/`: the "what did I rate" canvas the meter came
  from.

## archive/

`archive/2026/` holds the finished plans, audits and Codex reviews, the
2026-08-30 survey, NOW.md's history up to 2026-09-02, the Sep 27 test-flakes
notes, and the shipped build logs (events, zoom tests, the zoom
simplification review, cancelled acts, crew join, zoom chips, one-line
heads). A plan moves there once its arc has shipped and nothing living
cites it; search the repo for its name before moving it, and fix any path
NOW.md or AGENTS.md cites in the same commit (a test checks them).

Kevin's correspondence with Ray (the 2026-08-10 fork checkpoint and the
2026-08-30 reply drafts) lives in Kevin's own notes, not in this public
repo (moved 2026-10-19; the git history still has the old copies).
