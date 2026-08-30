# Phase-1 tests + docs pass — working notes

Scope (per lead's brief): new files under `tests/`, and `docs/user-flows.md` only.
No edits to `js/`, `assets/`, or `data/` — other agents own those in parallel.
The lead's `tests/zoom-overlay.test.mjs` already covers the ZOOM click-picks
paths (confirmed on disk, 203 lines, already exercising the P0 fix). My
pick-cycle test stays on the RESTING (unzoomed) card only, to avoid duplicating
that coverage.

## 1. tests/pick-cycle.test.mjs

Drives `renderCard` from `js/v3/wall.js` with a real, dispatched `click` event
(not a called function) through a hand-rolled `onTap` that mirrors
`js/v3/app.js`'s `handleTap` (lines 136-158) + `applyLocalPick` (161-166):
`state.recordSelection` (pending) + a direct `crewDoc.festivals[fid].selections`
mirror + `state.persist()`, then `refreshCard` every matching DOM node — the
same two-write shape app.js uses, minus migration-guard/undo-toast/sync (not
relevant to the click-reaches-onTap question this test exists to answer).

Status: WRITTEN, PASSING.

## 2. tests/notes-reply-flattening.test.mjs

Notes-on-approach: `addNote` (the client write helper) and the flattening
formula `replyTo.re || replyTo.id` are NOT exported from `js/v3/notes.js` —
they live inline in the composer's `onSave` closure inside `openScopeSheet`.
No Reply affordance renders on a REPLY row today (`renderThreads` passes no
`onReply` into the `replies` loop) — that's exactly the bug this baseline is
meant to catch before the "comments" agent's redesign lands.

To exercise the REAL save path (not a reimplementation of the formula) without
depending on a Reply-trigger UI that doesn't exist yet, the test reaches the
composer's own public `.setReply(note)` — a method the composer factory
attaches directly onto the returned DOM node (`wrap.setReply = setReply`,
notes.js ~296) precisely so callers can aim it. This calls `openArtistSheet`
(exported) to build the sheet, then drives `.setReply(replyNoteObject)` +
fills `.composer input` + clicks the `.composer` Save button — the same
`.composer input` / `.composer button` surface `tests/notes-round.test.mjs`
already depends on. Flagging per the brief: this DOES touch the notes.js DOM
(the composer's public surface), because there's no exported hook to reach the
enforcer any other way; kept to `openArtistSheet`/`closeSheet` (exported) plus
that one attached method rather than any internal function.

Asserts: the resulting note's `re` equals the ROOT's id (never the reply's),
and `model.threadsFor` flattens it under the same one thread — a second
thread/stub appearing would mean the enforcer regressed (the note would look
like a reply to a *deleted* note, the server-side P2 the ledger flags).

Status: WRITTEN, PASSING.

## 3. docs/user-flows.md

Three fixes:
- "Crew favorites" → "Most picked" (line ~83; shipped label per
  `js/v3/sort-control.js:12`).
- F6 zoom grammar rewritten to the 2026-08-30 decided grammar: hover-with-intent
  (mouse) / hold (touch) shows the zoom as an overlay, never a reflow; a
  tap/click on the zoomed card picks (cycles, pills update live, zoom stays);
  tap-outside / Escape / scroll dismisses; the notes chip is the door to the
  sheet.
- Swept for any other line still saying a tap on a held card's body dismisses
  (the old, now-wrong grammar) and fixed those too.

Status: DONE.

## Test run

`npm test`: 285 tests, 283 pass, 1 skipped, 1 fail.

The one fail is `tests/app-shell-complete.test.mjs:65` (service-worker stamp
mismatch: `75f4c94a` vs `3f77755d`) — expected per the brief, this is the
lead's; not touched, `node scripts/sw-stamp.mjs` not run.

The one skip is the DATABASE_URL-gated `tests/db-concurrency.test.mjs`
(pre-existing, unrelated to this pass).

All new tests pass: `tests/pick-cycle.test.mjs` (2/2),
`tests/notes-reply-flattening.test.mjs` (1/1).

## Files touched

- `tests/pick-cycle.test.mjs` (new)
- `tests/notes-reply-flattening.test.mjs` (new)
- `docs/user-flows.md` (edited: F4 sort label, F6 zoom grammar)
- `claude-plans/2026-08-30-survey/phase1-tests.md` (this file, new)

No files under `js/`, `assets/`, or `data/` touched.

## Doubt / flags for the lead

1. `notes-reply-flattening.test.mjs` reaches the composer's `.setReply(note)`
   method directly (attached to the `.composer-wrap` DOM node by
   `js/v3/notes.js`'s `composer()` factory) rather than clicking a
   Reply-on-a-reply UI trigger — because no such trigger exists in the
   on-disk file yet (`renderThreads`'s replies loop passes no `onReply`).
   This is deliberate per the brief ("if you must touch the notes.js surface,
   keep it to the exported functions") — it uses only `openArtistSheet`/
   `closeSheet` (exported) plus that one attached method, not `addNote` or
   any inline closure. If the "comments" redesign removes `.setReply` from
   the composer's public surface, or restructures composer entirely, this
   test's precondition assert (`typeof box.setReply === 'function'`) will
   fail loudly and name exactly what changed — it won't fail silently.
2. Did not runtime-mutate `js/v3/notes.js` to adversarially confirm the test
   catches a broken enforcer (would have meant editing a file another agent
   owns, live). Verified by code reading instead: if `mine.re` were wrongly
   set to the reply's id instead of the root's, `model.threadsFor` would
   bucket it into a stray stub thread (since the reply's id isn't in
   `rootIds`) — my assertions `after.length === 1` and
   `after[0].replies.length === 2` would both fail. Confident this is a real
   regression trap, not a tautology, but flagging that I reasoned rather than
   ran it.
3. `pick-cycle.test.mjs`'s notes-chip test seeds a note for a SECOND artist
   (`Rezz`) on the same fest rather than reusing `GRiZ` from the first test —
   deliberate, to keep the two tests independent or ordering-safe (no shared
   mutable card state between them), not an oversight.
