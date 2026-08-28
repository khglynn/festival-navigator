# data/festivals — read this before editing a live festival file

*Written 2026-08-27, the night Portola's set times shipped. Full authoring
guide: `docs/add-a-festival.md`. This file is the two-minute version for
whoever (or whatever) is about to edit a file in this folder.*

Real people have picks and notes in these festivals. A crew's data references
a festival file by exactly three strings, and the crew doc cannot rename a key
(its merge only ever adds). So:

1. **An artist's `name` is a pick key.** Change one byte — capitalization
   included — and every pick and note under it is orphaned for every crew.
   When set times drop, copy the spellings that are already in `artists[]`
   into `days{}`; put billing extras ("(DJ Set)", "(Live)") in `meta.note`.
2. **A day label is a day-note key.** `days{}` keys must equal the
   `artists[].day` values the lineup phase used ("Saturday", never "Sat" or
   "Saturday W1"). Combined labels ("Saturday & Sunday") are fine — they
   split on render.
3. **The festival `id` is the board key.** Never rename one.

These are enforced, not advisory: `tests/fixtures/live-pick-keys.json`
freezes every live festival's id, names and day labels, and both
`node scripts/validate-festivals.mjs` and `npm test` fail when a frozen
string disappears — the message says what to do. Every non-archived festival
in `index.json` must have a freeze entry.

The routine for any data change:

```
node scripts/freeze-pick-keys.mjs <id>    # BEFORE editing (also adds new names after)
# ...edit data/festivals/<id>.json...
node scripts/validate-festivals.mjs       # structure + set-time rules + frozen keys
npm test
```

If you truly must rename a string, delete it from the fixture by hand in the
same change — that edit is the decision, visible in the diff — and know that
the picks under the old string are gone for good.

Adding a festival: `docs/add-a-festival.md`. Set-times drop recipe: same doc,
"Set-times drop, in order". Worked example with afters sections:
`portola-2026.json`.
