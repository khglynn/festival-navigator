# The people menu + the Invite sheet — build log

**Branch** `live/people` (worktree `.claude/worktrees/people`), off `0d19e6e` (v97).
**Brief** `PEOPLE-BRIEF.md` beside this file; **design** `../2026-09-25-portola-live/design/people-shelf/BRIEF.md`
(frames on this Mac under `.claude/worktrees/portola-live/…/people-shelf/frames/`).
**Started** 2026-09-26 (Sat, Portola day 1), by an Opus builder. No stamp, no PR — the orchestrator releases it.

This file is the record if the build dies: read "Where it stands" first.

## Where it stands

1. Step 0 (this log, the storyboard, the plan) — done, before any code (`fbb59ff`).
2. Step 1 — the menu, the pill, the guest's route, the phone top, jump to top retired, Pick as
   someone else, the one Invite sheet (`cd4c54c`).
3. Step 2 — the motion walked in slow motion and fixed (the storyboard's C–E; see "What the slow
   motion caught"), the pill's disc cap, the crew-variant rig (`a804269`).
4. Step 3 — `tests/people-menu.test.mjs` (jsdom, 11) (`9904644`); `tests/browser/people-menu.test.mjs`
   (real input, Chromium + WebKit, 15) and the WebKit empty-tap fix both menus needed (`ef64dc1`).
5. `origin/main` (v97, `efeebd0`) merged in, clean (`0345d7b`). Stale docs swept (user-flows F2b/F9,
   comments).
6. Unit suite: green in UTC, Tokyo and the night clock except the SW stamp test, red on purpose (the
   brief: no stamp; the release stamps). Browser suite: see the log.

## What the slow motion caught (people-rig.mjs slowmo, a twentieth speed)

1. The avatar's ghost sat IN the flow, beside the pill (`.dock .you` is position: relative and out-
   ranked `.hl-ghost`) — the wrap widened mid-motion. Fixed with specificity.
2. The faces flying down from the menu's marks were invisible: clipped by the pill's own opening clip
   and painted under the fading menu (z 35). The pill's body is now a layer of its own (`.hl-bg`) —
   the clip is on the body only — and the pill stands at z 36.
3. The day tabs outran the pill's edge (the pill opened over GROW on ARRIVE, the tabs slid over
   CASCADE): FRI slid under the ✕ on a clear. The body's clip now runs on the tabs' own duration and
   curve (CASCADE; ARRIVE in, SURFACE out), so the edge and the row move as one; on a clear the ✕
   goes first (it is where the tabs are headed), the faces shrink to the circle, the body fades last.
4. Your letter lingered under the first landing face; it now leaves in 0.7 × OUT.

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

1. **The pill is the avatar's height (26px), not the frames' ~30px.** The dock must not change
   height when a highlight turns on: NOW's landing band, the welcome card's lift and the menu's
   own line are all measured from the dock's top. The faces are 20px, overlapping 6px.
2. **More than three highlighted: two faces and a +n** (the welcome card's solid +n — dashed means
   "add"), so the pill is never wider than three faces. The design said "up to three".
3. **The faces are in the crew's order** — the menu's row order, top to bottom → left to right —
   not the order they were tapped, so the pill reads the same however you got there.
4. **The laptop's rail gets the pill too.** One component, two positions (note 1.1); a laptop deep
   in the wall clears a highlight in one click without scrolling up to the people row.
5. **A crew of one has no "Pick as someone else"** — there is nobody to be. Invite someone stays.
6. **The member's Pick-as shelf has no name field.** The frame kept the guest's "Add your name"
   field, but a member already has a name, so it asks the wrong question; someone new comes in
   through **+ Invite someone**, the next row down, and two doors for adding people would drift.
   Your chip says "· you" and choosing it chooses nobody (you are already you); the filled button
   reads **Switch** (disabled) until a name is tapped, then **I'm Ben**; the way out is **Stay Ana**;
   no offline line (switching is this phone's own choice, nothing is sent).
7. **The wall dims in place, not by a repaint**, so the cards step back live behind the open menu
   (a repaint is a cut). Same rule wall.js renders with (`passesPeople`); a standing zoom takes
   the repaint path, which already knows how to keep it.
8. **A long crew scrolls inside the menu**, capped to the room above the dock (below the rail on a
   laptop); **a long name wraps inside its row** (the row grows) and the menu never runs past the
   screen's gutters.
9. **The Invite sheet is the one sheet everywhere**, including right after a crew is made (the
   brief asked me to decide): after create it keeps the moment's title, "ONE LINK MAKES IT A CREW",
   and its "Later"; from + Invite someone it says "INVITE SOMEONE" and "Done". The name field is
   NOT focused on open (the old add-someone sheet did): a phone's keyboard would cover the crew
   link, which is first. A guest (Settings can open the link) sees the link only — no name to add,
   no invite-festival stamp. Kevin's short copy is kept word for word ("Pick for them until they
   open their link."; `tests/share-copy.test.mjs` holds it).
10. **Switching who you pick as grows the new letter in** (the + becoming you already did).
11. **How it works keeps Kevin's words** ("Tap their name. Switch who you pick as in Settings." —
    both still true: the names are in the menu, and Settings → You still switches). Suggested,
    not made: "Tap your avatar, then their name." (`tests/docs-truth.test.mjs` holds his rows.)
12. **The laptop's people row drives the same highlight**, and its chips now dim the wall in place
    too; the rail's pill appears with the faces growing in the slot.
13. **The pill holds only as many discs as leave the day row its promise** (wall.js restingLeft rules
    1–2: the day you are in whole, NOW whole beside its day). Measured at 320 with NOW live: three
    discs left 92px of row for SAT · NOW's 101, and NOW slid out — so two there (a face and +n).
    ACL's long name at 320: two (the day you are in whole; NOW cannot be whole there even beside the
    bare avatar, today); at 360 one. One disc for several people is their bare count. `pillCap` in
    app.js measures it at every paint; `pillWidth` is held to the drawn pill by the browser test.
    Known limit: the cap is judged when the slot is painted, so NOW arriving later (the minute tick)
    with three discs up can clip NOW until the next paint — the day you are in stays whole.
14. **A tap on the wall's empty space closes a menu in WebKit too — Show's included.** Found on the
    walk: WebKit (so an iPhone) sends a tap's click only where something listens, and both menus'
    outside tap is a document listener, so a tap on a gutter or the time rail left either menu open
    (Chromium closed it). While a menu is up the wall listens (`catchStrayTaps`), with its tap
    highlight off so a closing tap never flashes the wall grey. Shipped Show since v93 this way;
    worth Kevin knowing it was broken on his phone.
15. **The Invite sheet's lone Done stays small** where there is no share sheet (a laptop); with Share
    the row is [Share the link][Done].
16. **Faces open the menu from the pill with its own label** ("Highlighting Ben and Cy. Open
    Highlight"); the ✕ says "Stop highlighting: show everyone's picks". The avatar's label names you
    and the menu ("Ana: highlight people's picks"; a guest's: "…, or join the crew").

## Disagreements with the brief

1. The member's shelf without the field (call 6) departs from the approved frame; flagged here so
   Kevin can put it back if he meant the field to add-and-switch in one go.

## Log

- 2026-09-26: read the brief, the design brief + frames, LEDGER call 8, PLAN item 2; mapped app.js
  (Show menu 1657–1910, people row 964–1028, avatar 1530–1560, share moment 2425, add someone 2499,
  wiring 4063–4105), join-shelf.js, filters.js, v3.css (dock, sort-pop, floor), the rig. Checked the
  sibling branches: `live/tap` touches askToJoin / openJoinShelf / join-shelf.js's backdrop, `live/plan`
  touches openShowMenu (closePlan) and the lines around jumpTop — both kept in mind so this build's
  edits there stay one-line and marked.
