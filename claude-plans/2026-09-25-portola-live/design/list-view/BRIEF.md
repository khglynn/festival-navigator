# List view, the past, and "Folsom or Portola at 2?" — design round brief

*Written 2026-09-26 ~2:30 AM PT by the live-ops coordinator, for the design round
that follows the v94/v95 releases. Frames are git-ignored PNGs; briefs and rigs are
committed.*

## Kevin's words (from Portola, after a night of friends using the app)

> "a bunch of folks like the vertical view of events in the Folsom app. Easy breezy
> scrolling. Basically I'm thinking that our menu that holds the locations 'show'
> options gets a few more things — view as list vs board (share and reload saves that
> selection). Hide vs show stuff that's past — like a scroll to the top cuts off with a
> gradient not a long way back.
>
> And then we need a design for the list view. I think there are some clean solid
> options but I won't steer you too much.
>
> I think the big thing in my head is how to answer a question like: Sunday at 2 — do I
> want to be at Folsom or Portola? It's not a huge use case. Idk we can do it
> elegantly, but maybe worth some exploration. Again I have some ideas but let's see
> what you got."

Reference he sent (Portola's official app; "don't overindex — very different app"):
`ref-portola-official-app.png` beside this file — a single column of sets in start
order under dotted time dividers ("2:00PM ·······"), each row: image, name, time
range, stage; a floating list/board toggle at the bottom.

## What "the Folsom view" is (live since v94, 2026-09-26 1:44 AM)

The FOLSOM section declares `"layout": "by-time"`: each night's parties in start order
under quiet fixed time bands (Daytime, Evening, 9 PM, 10 PM, Late, After-hours, Time
TBA), two cards across on a phone, the same card as everywhere, each card saying its
own place. That is what friends liked. Code: `js/v3/wall.js` (timeGroups, the by-time
renderer), `assets/v3.css` (.time-list / .time-band / .band-grid), MODEL-V4 §3e
(`claude-plans/2026-09-16-wall-v4/MODEL-V4.md`). The other presentations today: the
stage GRID on a clock (Portola Sat/Sun, ACL days) and venue STACKS (Portola AFTERS,
ACL Late nights). "Board" = those; "List" = a by-time list for everything.

## The app's laws that bind any design (CLAUDE.md — read it)

- The festival accent `--fest` appears in exactly four places; anything else that
  wants to look chosen uses `--brand`. Look tokens up in `assets/v3-tokens.css`,
  never invent values.
- One card column width, `--col-w`. The card, its aura (crew colours), its meter
  (your level), its crew corner, its zoom (hold/hover), the − · note · + row and the
  notes doors are the app's vocabulary — a list view reuses the card, it doesn't
  invent a second one unless the direction argues for it out loud.
- Room heads (`SAT PORTOLA`, `SAT AFTERS`, `SAT FOLSOM`) are note doors (a note is
  written where you are standing). A list that interleaves rooms must still let a
  note land on the right room and date.
- 44px touch floor on buttons. Motion: things grow from where they are and travel to
  where they're going; nothing pops; Low Power / Reduce Motion instant, never broken.
- NOW: the NOW jump and the now ring exist; a list must keep NOW meaningful.

## Kevin's taste (memory — read before designing)

- 2026-08-29, on a design round that covered every ask but looked assembled: "the
  ideas are okay but the design has no elegance … so many shapes and colors stacked …
  boring and basic and uninspired." No bubbles-in-bubbles, no rows of pills stacked
  under rows of chips, no dead air between related things. Motion alive in the frame.
- "Clean solid options" and "easy breezy scrolling" are the brief tonight.
- Buttons: bare glyphs over shaped buttons when it reads clearly ("I like the left
  and right just − + no button shape").

## How to render frames (production code, never production data)

Use the rig pattern in `../folsom-by-time/rig.mjs` + `../folsom-by-time/fixture.mjs`
(a local static server over the production app, `/api` answered from memory with a
made-up crew, writes refused, `/fn-i` swallowed, the service worker blocked, a pinned
clock) and the prototype-overlay pattern in `../people-shelf/` (`proto.css` +
`proto.mjs` injected over the real app, so the app worktree is never edited). The app
to render is the read-only worktree
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/design-app`
(main at 75ccf2f = v95, live) — `APP=<that path>`. Never edit files in it. A made-up
crew with placeholder names lives in `../people-shelf/crew.mjs` (reuse or copy).
The Show menu as it will look after v93 (stay-open, "Show" label, caret, gear) is on
branch `origin/live/v93` — read it with `git show origin/live/v93:js/v3/app.js` etc.;
do not check it out.

Never load a real crew link, never touch production or a preview URL, never write to
the database, never commit a crew token.

## Where things go

Your own subfolder under this one (named in your task). Write your `BRIEF.md` first and
grow it as you go (if you stop halfway, the file is what survives), then your rig /
proto files, then `frames/*.png`, and one composite sheet PNG per direction that a
phone can read (sheet.py in the sibling folders shows how). Commit nothing — the
coordinator commits.
