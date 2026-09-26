# ACL prep — working log (2026-09-26)

Branch `data/acl-prep`, worktree `.claude/worktrees/acl-prep`. Following
`ACL-PREP-BRIEF.md` in this folder. This log is grown step by step and
committed after each step (scope `data:`), pushed after each commit.

## Step 0 — freeze pick keys

`node scripts/freeze-pick-keys.mjs acl-2026` — 148 names, 4 day labels frozen,
0 new names (re-stamped `frozenAt` 2026-09-23 → 2026-09-26 only; no rename, no
add/remove). Safe to proceed with time edits.

## Gap 1 — Late nights (66 artists[] entries, 12 venues, 40 distinct event
pages)

Working venue by venue. For each show: read the `page.url` already recorded
on the artist entries (mostly Do512 listings) for a printed set/show time;
if the page prints one, it goes straight into `time` with no `approx`. Then
research each venue's routine (close, doors-to-first-act, headliner/support
set length) into `data/venues/index.json`, then run the guesser.

### Venue notes (research into `data/venues/index.json`)

_(filled in below per venue)_

### Printed-time findings (per show)

_(filled in below per venue)_

## Gap 2 — Zilker weekend headliner ends

_(filled in after Gap 1)_

## Commits

- (pending)
