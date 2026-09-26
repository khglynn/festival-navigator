# Import picks from the Portola app — build log (live/import, off v95 75ccf2f)

Brief: `IMPORT-BRIEF.md` beside this file. Builder: one Opus session in
`.claude/worktrees/import`. Newest state at the top of each section; the
story at the bottom.

## Where it stands

- [ ] 1. Matcher (pure) + tests — `js/v3/import-match.js`, `js/fold.mjs`
- [ ] 2. Endpoint + `callGemini` image part + tests — `api/import-schedule.js`
- [ ] 3. Real-model extraction of both samples
- [ ] 4. The flow (sheet from Settings) — `js/v3/import.js`
- [ ] 5. Browser tests (Chromium + WebKit) + frames at 390 / 1280 into `v97-shots/`
- [ ] 6. Second-door proposal frame (not built)
- [ ] 7. Three clocks + report

## Product calls (mine, for the coordinator to confirm or overturn)

1. **The endpoint requires a crew.** (Reasoning filled in as built.)

## Pushback on the brief

(Filled in as found.)

## Log

- 2026-09-26 ~3:30 AM PT — read the brief, CLAUDE.md, RUNBOOK, tools.js,
  settings.js, festival-add.js, guard.mjs, the card/meter code. Looked at
  both samples (locally only). Plan above.
