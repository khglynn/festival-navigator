# Phase 2 — the comment thread, Direction A (2026-08-30)

Banked before the first edit, per the brief. Branch `notes-desktop-round`, no commits
from this seat. Owned files: `js/v3/notes.js`, `js/v3/model.js` (thread helpers only),
`api/_lib/crew-shared.mjs` (the `re` check only), the notes tests, and the NOTES region
of `assets/v3.css`.

Sources read first: `CLAUDE.md` (the "How this app moves" note is the bar),
`LEDGER.md` → *Notes & threads* + *Comment-thread redesign*, `research-comments.md`
(15 products, A recommended), `2026-08-30-clean-round-plan.md` decision 3 / Phase 2,
then `notes.js` whole, `model.js`, the notes CSS, and the three notes tests.

---

## What the note becomes

```
[av]  Drew · 12m                 ← at rest: name, time, words. Nothing else.
      rail crew assemble
      3 replies                  ← at rest ONLY on a folded thread (real info, not an action)
      · Reply · Pin              ← fades up on hover / hold / focus
```

Your own note reveals `Edit · Reply · Pin`. Edit turns the words into a growing
textarea in place and the same line becomes `Save · Cancel · Delete`. Delete has no
other door. Pin rides the line for everyone.

---

## Decisions I made, and why

**1 · The cue line reserves its space; it never grows the note.**
The obvious build — a cue line that appears and pushes the notes below it down — makes
a desktop list shove content under the cursor every time the mouse crosses a note. That
is the opposite of "nothing pops." So `.n-cue` is a permanent ~15px row inside the
note's body and only its *contents* fade (opacity + a 2px lift, 140ms). The note's
bottom padding drops 9px → 5px (replies 7 → 4) so the net gain is ~11px per note, and
in a no-boxes typographic list that reads as air, not as an empty slot.

**Why the row is not dead air:** the reply count moved into it. `3 replies` is
information, not an action, so it lives there at rest on a folded thread — and that is
one more token gone from the head line Kevin called crowded.

**2 · The inline composer opens at the FOOT of the thread you pressed into, not
directly under the pressed row.**
The brief says "directly under the note you pressed — root or reply." I built the foot
of that thread instead, and this is the one place I departed. Reason: a note always
posts at the end of its thread. If you press Reply on a root that already has three
replies and the composer opens *above* them, you type, you save, and your words appear
four rows lower — a smaller version of the exact jump Kevin called "so strange." At the
foot, where you type is where it lands. For a root with no replies (the common case)
the foot *is* directly under the note you pressed, so the two designs are identical
there. GitHub's PR threads and Figma's pin modal both put the field at the foot of the
thread for the same reason. **Worth Kevin's yes or no.**

**3 · `@Name ` prefills only when it carries information.**
Replying to a reply prefills `@Author `, caret at the end (Instagram/YouTube). Replying
to a root does not — there is only one person it could be aimed at. Replying to your
own reply does not — you do not @ yourself.

**4 · The bottom composer loses its reply state entirely.**
`Replying to <name>`, the `✕` cancel, and `setReply()` are gone; the sheet's bottom box
is for new root notes only. That deletes the P3 finding where an already-typed draft got
silently re-aimed at a different root. `.reply-to` and `.composer .cancel` CSS retire
with it.

**5 · A deleted root's thread can be replied to again.**
Ledger P3, not on the brief's list, two lines to fix: the stub row now carries a cue
line with `Reply`. A conversation does not end because someone removed the first thing
said in it.

**6 · Both composers become auto-growing textareas; the counter only appears near the
cap.** 500 characters in a single-line `<input>` was the defect. Enter saves,
Shift+Enter is a newline (chat-standard). The counter is hidden until 60 characters
remain, then reads `60 left` and turns `--danger` at 0 — quiet until it matters.

**7 · Delete's two-tap arm survives a repaint and announces itself.**
The armed flag moved into the per-open `editing` draft map, so a remote sync landing
inside the 3-second window no longer silently disarms it. The button carries
`aria-live="polite"` so a screen reader is told the label changed under focus.

**8 · Server: a reply may not target another reply — checked where both are visible.**
`validateNoteMap` gets a second pass: if a note's `re` names an id *in the same map* and
that note itself carries `re`, reject. Existence stays deliberately unrequired (sync can
deliver a reply before its root), so a payload holding only the reply still passes — the
rule bites exactly where the evidence is present. This is Ray Perfetti's fork's guardrail.

---

## Motion

| Moment | What happens | Gate |
|---|---|---|
| Cue line reveals | opacity 0→1, translateY(-2px)→0, 140ms | CSS transition; `.low-power` and reduced-motion already kill it globally |
| Inline composer opens | its own height 0→measured, contents lift in, 220ms `EASE_ARRIVE` | `canAnimate()` — a local twin of `card-facts.js`'s (that one isn't exported) |
| A note arrives | rises 6px with a soft overshoot, opacity 0→1, 260ms | same |
| A note is deleted | thins out (opacity + height → 0, 180ms) then commits | same; commits immediately when motion is off |

`canAnimate` is duplicated, not imported, because `card-facts.js` does not export it and
that file is not mine this round. **Worth folding into a shared motion module later** —
two copies of a gate is exactly the drift this repo's own history warns about.

## Rejected

- **Direction B (a permanent `···`)** — the documented fallback. Rejected because it
  fails both halves of the ask and parks a glyph on every note forever.
- **A cue line that grows the note on hover** — jitter under the cursor (see decision 1).
- **Long-press with `preventDefault`/`touch-callout: none`** — it would buy a clean hold
  gesture at the cost of ever copying a note's text. The hold is timing-only and never
  cancels the browser's own selection; worst case both happen, which is harmless.
  Flagged for the real-browser walk.
- **Renaming `dayWhisper`** (ledger P2) — the export is consumed by `wall.js`, which is
  not mine this round. Its comment is corrected in place instead.

---

## The real-browser walk (2026-08-30, Chromium, real pointer input)

Rig: `screenshots/notes-walk.html` (gitignored, left in place to re-walk) served on
`:8137`, seeding state the way `tests/notes-round.test.mjs` does and opening a real
artist sheet against the real modules. Screenshots: `screenshots/notes-1-resting.png`,
`-2-revealed.png`, `-3-replying.png`, `-4-editing.png`, `-6-phone.png`.

**Confirmed in the browser, not in Node:** hover reveals and *nothing below moves* (a
reply sits at y=451 in both the resting and revealed frames); keyboard focus reveals the
line (`opacity: 1`, `pointer-events: auto`) — the required non-optional fallback;
press-and-hold reveals on touch, a drag past the slop does **not** (so scrolling is
safe), a mouse never arms the hold, and only ever one note is revealed; the counter
appears at "45 left" and turns red at 0; the field grows to its 132px cap; the three
motions run at their intended timings (unfold 220ms, arrival 260ms with the overshoot,
thin-out 180ms) and Low Power makes every one of them zero — transition `0s`, no
animations, the note still lands. Phone at 390px: nothing overflows its column.

**Two things the walk caught that Node could not:**

1. **The inline field's right border was invisible.** This file has no global
   `box-sizing: border-box`, so a `width: 100%` field with 12px side padding overflowed
   its column by 26px and `.n-inline`'s `overflow: hidden` (there for the unfold) ate the
   border. Fixed on `.n-field`; `flex: 1` also moved to `.composer .n-field` only, since
   in a column layout it stretched the field's *height* and fought the auto-grow.
2. **The editor needed air.** A bordered field 2px under the name read as cramped where
   plain text did not. `.n-text > .n-field { margin-top: 3px }`.

**One harness note for the next walker:** Playwright's `click()` hit-tests before the
pointer arrives, and the cue line is deliberately `pointer-events: none` until revealed —
so a cold `click()` on a cue action reports "`.n-cue` intercepts pointer events" forever.
A real mouse is already there by the time it presses, so this is not a user-facing bug;
hover first, or drive the row directly.

## Two bugs found in self-review, both fixed and covered

- **A repaint could steal the caret.** You can edit note A while a reply composer is open
  on thread B; the focus restore simply took the first live edit draft, so a crewmate's
  note landing mid-sentence yanked the caret into the editor. `ui.focusOwner` now records
  which field you last touched. Guarded by *"a live repaint leaves the caret in the field
  you were typing in"* — verified to fail without the fix.
- **A hold whose row was torn down mid-press** cleared `.revealed` off the live list,
  taking the reveal off the note actually under the finger. Now it bails if the row is
  detached.

## Handed on (files that are not mine this round)

- **`docs/user-flows.md` F6 was lying about this surface** ("Reply lives in a root's head
  line"). Rewritten in place — a surgical edit to those clauses only, because another
  session has that file open for the F6 zoom grammar. Worth a glance for a collision.
- **`wall.js`'s composer-draft harvest is dead code** (`wall.js:814`/`:831`): it looks for
  `.composer input[data-draft-key]`, but `composer()` has never been called with a
  `draftKey`, so the attribute was never written — and both composers live in sheets
  appended to `document.body`, not inside `#wall-root`. It was already dead before this
  round; it is now also aimed at the wrong element type (the field is a `<textarea>`).
  Not mine to delete.
- **`gallery.html` still hands a note `.n-note.pinned`**, a class `noteRow` no longer
  emits and CSS never styled. Harmless (the gallery sets `--wash` inline) — flagged
  because the round's plan lists dropping it.
- **`model.js` needed no change.** `threadsFor` already keyed threads correctly and
  bucketed stub threads; the redesign reads it, it does not reshape it.

## For Kevin

1. Decision 2 — composer at the foot of the thread rather than under the exact row.
2. Decision 1 — every note is ~11px taller so the cue never shoves the list.
3. Decision 5 — a removed root's thread stays open for replies (wasn't on the list).

Two smaller things worth knowing, not worth a decision unless you disagree:
**Pin appears only on roots**, not on replies — pins fold a thread by its root, so a Pin
on a reply would be a word that does nothing. And **the sheet re-centres** when the inline
composer opens: at desktop widths it is a centred dialog, so growing it moves the whole
surface. That is existing sheet behaviour on any content change (`.sheet` is shared with
Settings and not this round's file), but it is the one place the surface still "pops."
