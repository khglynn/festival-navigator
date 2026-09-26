# People behind your avatar — the Highlight menu (design brief)

**Status:** design done, nothing built, 2026-09-25 late night PT, on v92
(unreleased; this worktree also holds another session's uncommitted v92 work,
which this folder does not touch). 16 phone frames from the production app,
five contact sheets, three questions at the bottom.

**Look at these first:**

1. `frames/symmetry-390.png` and `frames/symmetry-320.png` — the two menus
   side by side (left open, right open), highlight on, and the dock with a
   highlight on, deep in the wall.
2. `frames/flows.png` — Pick as someone else → the claim step, and a guest.
3. `frames/top-before-after.png` — the top of the wall, v92 and after.

PNGs are gitignored in this repo, so they live on this Mac only.

## Kevin's ask (voice, lightly trimmed)

"How does using names as filters work on mobile now? … On mobile on the
right, if you click the name of the festival, you filter which locations
you're seeing. On the left, I think you should be able to tap the little
avatar for yourself — and rather than it scroll you to the top, it opens a
little menu with the people and you can click to filter them. Or at the top
there's a button like 'pick as someone else', and that opens our little
bottom shelf. With that we could remove the people along the top on mobile.
On desktop it's still nice to have the people along the top. … If you're
scrolled to a specific part and want to filter, you don't want to go all the
way to the top. Our lists are long." Then: the left menu should look and
behave like the right one, "pretty similar, so it's clear it has a similar
action pattern": a small **Show** label on the right, a small **Highlight**
label on the left, a clear way into Our plan, and Pick as someone else
opening the claim shelf he already liked.

## The design

### 1. Two menus, one component

| | Right: the fest name | Left: your avatar |
|---|---|---|
| Label | `SHOW` (already there in v92: 10px caps, tertiary) | `HIGHLIGHT`, the same style |
| Rows | Portola · Afters · Folsom, ✓ when shown | **Everyone** (✓ when nobody is highlighted), then the crew, one row each |
| Mark | ✓ in the check column | the same column: the person's colour as a ring, filled with a ✓ when highlighted; Everyone keeps the plain ✓ |
| Selected row | brand text | brand text |
| After a divider | Settings › | **Our plan ›** (tonal text: the other way into where we'll be) · **Pick as someone else ›** · **+ Add someone** |
| Anchor | right edge on the fest name's right edge (16px from the screen) | left edge on the avatar's left edge (16px from the screen) |
| Bottom | 8px above its door | on the same line as the right menu's (measured: 803px at 390 and at 320) |

The left menu is the Show menu's own component (`.sort-pop`, its head, its
row buttons with their 44px floor, divider and chevrons from `v3.css`); the
prototype adds only its anchor and the colour mark (`proto.css`). Rows are
44px apart on both sides. "you" sits after your name on its baseline.

**One difference on purpose:** a tap on a person keeps the menu open (it is
multi-select, and the wall dims live behind it; the menu covers little of
it), where the Show menu closes after a tap because each fold moves whole
days. A tap outside, on the avatar again, or Escape closes it.

Words: **Highlight** is the right verb: a highlight dims everyone else, it
never hides (MODEL-V4 §3b.2), so "filter" would promise the wrong thing.
**Everyone** replaces v92's `everyone ✕` chip as the clear state.

### 2. The dock while a highlight is on

The avatar's slot becomes one pill: the highlighted faces (up to three,
overlapping, in their colours) and a **✕**. The faces reopen the menu; the ✕
clears the highlight in one tap, from anywhere in the wall. At 320 the pill
(about 70px against the avatar's 26px) leaves the day row one tab (SAT) at
11 AM. With NOW live as well, today's pinned NOW would squeeze it further.
That is one more reason for D1, NOW moving into the day row (OURS round two).
Frames: `frames/pill-390.png`, `frames/pill-320.png`.

### 3. Pick as someone else → the claim step

It opens the join shelf itself (`showJoinShelf`, the same component), with
a member's words where a guest's would be: "Pick shows as…" · "Tap a name,
then confirm." · your chip marked "you" · after a tap, **I'm Ben** beside
**Stay Ana** (the guest's "Look around"). Claiming stays two taps, the rule
that stopped friends picking as each other. Frames: `frames/pickas-390.png`,
`frames/pickas-320.png`. **+ Add someone** opens v92's existing add-someone
sheet (Kevin approved the words).

### 4. The top of the wall on a phone

The people row leaves; the search field and Notes move up and the search
field now starts on the left gutter (v92 had a divider stub before it).
Frames: `frames/top-before-390.png` → `frames/top-after-390.png`, and the 320
pair; the four in one image: `frames/top-before-after.png`.

### 5. Jump to top: no door

The avatar's old job was the jump, and the jump's real job was reaching the
people row, which now lives behind the avatar. What is left at the top of the
wall: the title and dates, Settings (also the last row of the Show menu),
Notes (also every room head and every card) and search. Search is the one
thing that loses a quick door; on an iPhone a tap on the status bar still
scrolls to the top (Safari and home-screen apps), and the day tabs land on
each day. If search needs a door from deep in the wall, its home is a row in
the Show menu, not a revived jump.

### 6. A guest

The dashed + opens **the same menu**: Highlight works for a guest (they can
see the crew; it writes nothing), and the actions are **Our plan** and
**Join the crew ›** (the join shelf). There's no "you" and no Add someone. This
changes v92's route (the + went straight to the join shelf): joining from
the + is one tap longer, and joining's main doors (a card's Pick shows, the
welcome card's Pick shows) are unchanged. Frames: `frames/guest-390.png`,
`frames/guest-320.png`.

### 7. Desktop

Keep the people row at the top (Kevin likes it there, and the wide toolbar
has room). One change: the rail's avatar opens the same Highlight menu as a
dropdown under it, the mirror of the rail's Show menu, which already drops
from the fest name. Then a desktop user deep in the wall can highlight too.
Not drawn.

### Motion

The menu arrives the way the Show menu does (a 4px rise with the beat) while
the avatar's ring turns brand; a tap fills that person's mark and their name
turns brand while the wall's non-matching cards step back (the existing dim).
Closing with a highlight on: the menu drops quick and plain, and the chosen
faces slide from their marks down into the avatar's slot, which widens into
the pill while the day tabs slide aside (the existing tab FLIP). The ✕: the
faces shrink into the slot, your letter grows back, the dim lifts. Pick as
someone else: the menu closes and the join shelf rises on its own motion.
Reduce Motion and Low power: instant.

### Cost

**M** in all, most of it tests and a real-input walk. The menu (the Show
menu's component plus a colour mark), the pill, the claim step's member
words, removing the phone's people row and the guest's route are each XS-S.

## Frames (390 x 844 and 320 x 844, 2x)

| Frame | What |
|---|---|
| `L-390`, `L-320` | the Highlight menu open, nobody highlighted |
| `R-390`, `R-320` | the Show menu open (production, opened by a real tap) |
| `LH-390`, `LH-320` | Ben and Cy highlighted: the checks, the wall dimmed live |
| `pill-390`, `pill-320` | menu closed in the Saturday afters: the faces and ✕ |
| `pickas-390`, `pickas-320` | the claim step, Ben chosen |
| `guest-390`, `guest-320` | a guest's + opening the same menu |
| `top-before-*`, `top-after-*` | the top of the wall, v92 and after |

Re-run: `node frames.mjs` (one headless Chromium, the made-up crew of nine,
the API stubbed, no network, no database), then `python3 sheet.py` as in
the commands above.

## Questions for Kevin (reply like "2: no")

1. **A guest's + opens the same menu** (Highlight, Our plan, Join the crew)
   instead of going straight to the join shelf, so guests can highlight too?
   *Default: yes.*
2. **Jump to top retires with no door** (the iPhone status-bar tap covers it;
   search is the one thing that loses a quick door)? *Default: yes.*
3. **Desktop keeps the people row on top, and the rail's avatar opens the
   same Highlight menu as a dropdown?** *Default: yes.*
