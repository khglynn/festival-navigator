# Fest-update runbook — written for a small agent (2026-08-30)

The job: bring one festival's JSON up to date (a set-times drop, day tags, a
phase-two lineup) without orphaning a single pick. A Sonnet-class agent
following this runbook end to end is the intended operator; Kevin reviews the
diff, never the transcript. Exemplar of the finished form:
`data/festivals/portola-2026.json` (timezone, dayMeta with weekday codes,
days{} with stages + times, afters/events as data, a meta.note that reads
like a lab notebook).

## The law (CLAUDE.md, with teeth)
1. Artist names and day strings in a live file are PICK KEYS. Never rename,
   re-case, or "fix" one — `tests/fixtures/live-pick-keys.json` freezes them
   and CI fails on any disappearance. A name the official source now spells
   differently gets a note in meta.note, not an edit.
2. Freeze BEFORE touching: `node scripts/freeze-pick-keys.mjs <fest-id>`.
3. Grid names must match `artists[]` byte for byte; the validator makes a
   case-only mismatch an ERROR.

## The loop
1. Read the current file whole, and `docs/add-a-festival.md`.
2. Research with sources you can cite: the festival's own site first, one
   independent cross-check (JamBase, a local paper). Posters are usually
   images — read them visually and say so in meta.note. Never invent a
   stage or time; absent data stays absent.
3. Freeze (law 2). Edit: `days{}` on the Portola shape for a schedule,
   `artists[].day` for day tags, `dayMeta` (wd + date, `isos` {W1,W2} for a
   two-weekend fest), `timezone` (IANA), afters/events with stage
   "Thu · Venue" + a time. `status`: lineup → scheduled ONLY with a real
   grid. Update meta.researchedAt and write the sourcing story in meta.note.
4. Gate: `node scripts/validate-festivals.mjs` (0 errors),
   `npm test` green, `git diff` shows zero changed name/day lines.
5. If any cached asset changed (it usually did not — data files are not in
   APP_CORE), the lead runs the stamp; say so rather than running it.
6. Hand back: files touched, sources with dates, what remains unknown and
   when it is expected (prior years' drop timing).

## Standing dates (2026)
- Lost Lands: day tags droppable now (2026-08-21 sources in meta.note);
  full set times expected ~Sept 14–16. Eight pre-party reappearances noted
  in the file — land them WITH the day tags.
- ACL: set times are live as six schedule images (aclfestival.com/schedule);
  ingest = visual transcription of all six, W1/W2 shape, before Oct 2.
- Seismic 9.0: nothing to ingest before ~Sept 18 (8.0's phase-two timing).
