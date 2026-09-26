# The people menu + the Invite sheet — build log

**Branch** `live/people` (worktree `.claude/worktrees/people`), off `0d19e6e` (v97).
**Brief** `PEOPLE-BRIEF.md` beside this file; **design** `../2026-09-25-portola-live/design/people-shelf/BRIEF.md`
(frames on this Mac under `.claude/worktrees/portola-live/…/people-shelf/frames/`).
**Started** 2026-09-26 (Sat, Portola day 1), by an Opus builder. No stamp, no PR — the orchestrator releases it.

This file is the record if the build dies: read "Where it stands" first.

## Where it stands

1. Step 0 (this log, the storyboard, the plan) — done, before any code.

## The plan (one commit per working step, each pushed)

1. **Markup + module.** The avatar in the dock and the rail each get a wrap (`#dock-you-wrap`,
   `#rail-you-wrap`, a `.sort-wrap` like the fest name's) holding the avatar, the pill and the menu.
   The menu's rows, the pill and the slot's motion live in a new module, `js/v3/people-menu.js`, so
   app.js only wires them (it is shared with the tap and Our plan builds).
2. **The Highlight menu** from the Show menu's own component: `.sort-pop`, `.menu-label`, a row per
   button (the 44px floor comes from being a `button`), `.pop-div`, `.chev`. It opens and closes
   through the SAME `openShowMenu` / `closeShowMenu` (one `openMenu` at a time, one outside-tap rule,
   one Escape, no history entry, the shared `show-menu` busy flag), with an `onClose` hook for the
   pill's motion. Stays open across taps; closes on a tap outside, the avatar again, Escape.
3. **The highlight stays viewer-side**: filters.js `savePeopleFilter` (sessionStorage per fest, per
   tab), never the crew doc. A tap dims the wall IN PLACE (the same `passesPeople` rule wall.js uses at
   render), so the cards can step back with a transition instead of a repaint's cut.
4. **The pill** (avatar slot → faces + ✕) in the dock and the rail. ✕ clears in one tap; the faces
   reopen the menu.
5. **The phone's people row goes**: CSS only, under 720px. Desktop keeps it.
6. **Pick as someone else ›** opens the join shelf in member words (`showJoinShelf({ me })`); two taps
   (a name, then **I'm Ben**) → `switchIdentity`. **Join the crew ›** for a guest (the + opens the menu).
7. **Jump to top retires** (no door).
8. **One Invite sheet**, crew link first → a name → your other fests. Replaces the share moment AND
   the add-someone sheet.
9. Unit tests, browser tests with real input, frames at 390 / 320 / 1280 in `people-shots/`.

## Storyboard (written before the motion code)

Numbers are motion.js's: GROW 240 · OUT 130 · CASCADE 170 · STAGGER 30 · ARRIVE (4% overshoot) ·
LEAVE (quick, plain) · SURFACE (crisp). Transforms, opacity and one clip only; Reduce Motion and
Low Power: every step instant (canAnimate), nothing skipped or broken.

**A. Open (tap the avatar, nothing highlighted).** t0: the menu rises 4px and fades in (CASCADE,
ARRIVE) — the Show menu's own open, same code. t0: the avatar's ring turns brand (120ms CSS, the
fest glyph's transition). The dock stands above the companion cards while it is up (`.menu-up`).

**B. Tap a person (menu open).** t0: their mark fills with their colour and the ✓ grows in (scale .4→1,
CASCADE, ARRIVE); their name turns brand; Everyone's ✓ fades (OUT). t0: every card whose dim changes
steps back or forward (opacity, GROW, SURFACE) — the wall is dimmed in place, not repainted, so it
moves live behind the menu. Untapping reverses it; Everyone clears all of them at once.

**C. Close with a highlight on.** t0: the menu drops (4px, OUT, LEAVE — the Show menu's close).
t0: the slot swaps avatar → pill in layout; the day row re-rests at its new width; every day tab
slides from where it was (the existing tab FLIP, `slideTabs`, CASCADE, ARRIVE). t0: the pill's body
opens from the avatar's circle to its full width (a clip from the left, GROW, ARRIVE). t0 + i×STAGGER:
each face travels from its mark in the menu to its place in the pill (translate + scale .55→1, GROW,
ARRIVE). t0 + GROW/2: the ✕ fades in from 4px left (CASCADE). The avatar's letter leaves as a
ghost where it stood (scale →.6, fade, OUT).

**D. ✕ (clear).** t0: the highlight clears and the wall's dim lifts in place (GROW, SURFACE). t0: the
slot swaps pill → avatar; the tabs slide back into the room (CASCADE, SURFACE — the way out). t0: a
ghost of the pill collapses into the slot's circle (the clip closes to 26px, faces shrink toward the
left edge, fade — OUT, LEAVE). t0 + 2×STAGGER: your letter grows back (scale .6→1, GROW, ARRIVE).
Keyboard focus that was on the ✕ lands on the avatar.

**E. Faces (reopen).** The reverse of C: the slot swaps pill → avatar (tabs slide back), the menu
opens (A), and each highlighted person's mark travels up from where their face was (translate +
scale 1.8→1, GROW, ARRIVE), the pill's ghost closing as in D.

**F. From anywhere else** (a desktop people-row chip, a crew-mate removed on a poll): the same slot
morph, the faces growing from the slot itself (no source to travel from). Things grow from where
they are.

**G. Pick as someone else › / + Invite someone / Join the crew ›.** The menu closes (its normal close,
C if a highlight is on — under the sheet's backdrop) and the shelf or sheet rises on its own motion.

## Product calls (with reasons) — the design did not cover these

(filled in as they are made)

## Disagreements with the brief

(filled in as they come up)

## Log

- 2026-09-26: read the brief, the design brief + frames, LEDGER call 8, PLAN item 2; mapped app.js
  (Show menu 1657–1910, people row 964–1028, avatar 1530–1560, share moment 2425, add someone 2499,
  wiring 4063–4105), join-shelf.js, filters.js, v3.css (dock, sort-pop, floor), the rig. Checked the
  sibling branches: `live/tap` touches askToJoin / openJoinShelf / join-shelf.js's backdrop, `live/plan`
  touches openShowMenu (closePlan) and the lines around jumpTop — both kept in mind so this build's
  edits there stay one-line and marked.
