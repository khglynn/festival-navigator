# plan.js build log — the Our plan model (started 2026-09-26)

Builder: one Opus agent, brief `BRIEF-plan-model.md` beside this file. Worktree
`.claude/worktrees/plan`, branch `live/plan`.

## API changes from the brief (read this first, orchestrator)

Decided 2026-09-26 before the first line of code. Everything in the brief's API block exists
with the brief's names and arguments; these are the places where the brief left a choice open,
and the additions.

1. **`stop.place` is the Place OBJECT, as in the prototype** (map §1b), not a string. So UI code
   ported from `r3-proto.mjs` keeps working: `stop.place.place` is the stage or venue name,
   `stop.place.kind` the kind, `stop.place.acts` the acts. The brief's `placeKind` and `acts`
   are ALSO on the stop, as copies of `stop.place.kind` / `stop.place.acts`, so either reading
   works. Forks carry the same `place` object plus `placeKind`.
2. **Additions (all additive, nothing renamed):**
   - `stop.nightId` — the night the stop is in (what `alsoOf` compares against).
   - `plan.places` — every place of the week, hidden ones included, each with `shown: boolean`
     (the tests use it; the UI may ignore it).
   - `plan.folded` — the fold the plan was built with.
   - each night entry and each `night(id)` result carries `wd` ('Tue', from the ISO when there is
     one) — a Late-nights-only date has no week day to borrow a weekday from.
   - `playsAt` entries carry `play` (the rule-5 identity, decision 6) and `shown`.
   - `alsoAt` entries: `{ act, nightId, place, from, kind, play, shown }`.
   - each act carries `play` (its identity) and `section` (the section or extra key whose list
     gave its window; null for a grid set).
   - `peekOf(...).today` as the brief says; when it is false the UI reads the night's `iso`.
3. **When the crew is under three (`available: false`)**: `nights: []`, `night(id)` → null,
   `playsAt` an empty Map (not undefined), `places: []`.

Place shape: `{ id, nightId, kind: 'set'|'room'|'party', place, room, start, end, approx,
roomKeys: [...], shown, dayKey|null, acts: [...], doors?, close? }`. Act shape:
`{ name, from, to, time, approx, occ, play, section }` (`from`/`to` null for an untimed act in a
timed room — rule 4 then seats its pickers for the whole room, as the prototype did).

## Status

- Log created before any code (2026-09-26).
