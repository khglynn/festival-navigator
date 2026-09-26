# c — the moment ("Sunday at 2 — Folsom or Portola?")

*Started 2026-09-26 ~2:50 AM PT. Banked as I go; if this stops halfway, this file is what survives.*

## Direction (from the round)
Keep the list simple (rooms as time lists). Add one small lens: pick a moment (a time
on a day) and see what's on at that moment across every room, weighted by the crew —
a fork in the road, not a table. One gesture in, one out. 390 + 1280, plus the list it
sits on.

## Status (2026-09-26 ~4 AM PT): done — 15 frames, 4 sheets, all looked at
- [x] read rigs + app code (wall.js timeGroups/renderCard, events.js timeBandsOf, v3.css, tokens)
- [x] rig (`rig.mjs`) + proto (`proto.mjs`, `proto.css`) + crew (`crew.mjs`) + `frames.mjs` + `sheet.py`
- [x] frames (`frames/`, git-ignored) and sheets `sheet-1..4-*.png`
- [x] write-up below

## The idea (decided 2026-09-26 ~3:10 AM, before building)

**Tap a time, see the fork.** In the list, every time-band label ("2 PM") and the
NOW line are doors to *the moment*. Tap one and a shelf rises (the zoom/sheet's
vocabulary: the same dark surface, the same card) showing that minute across every
room of that date as **branches of a fork**: a thin line drops from the time and
splits into one branch per room that has anything on — PORTOLA, FOLSOM, AFTERS.
Each branch is:
1. its head — the room (header colour, never `--fest`) and where it is (Pier 80 /
   SoMa / around town), and the crew who'd be there, as faces;
2. what's on at that minute, as the real card, crew-weighted order, 2 at most, then
   a quiet "+4 more on";
3. **then** — what the crew picked in that room in the next few hours (time, name,
   faces). Reading the two "then"s side by side IS "what you'd give up".
The branch most of the crew is in wears `--brand` on its line ("most of us").
The room you tapped from is where you are: its branch's line is solid; the others
are dashed with "across town" — travel implied, no invented minutes.
One gesture in (tap a time), one out (tap outside / drag down / Esc). The time in
the shelf's head steps with bare − + (15 min), so the fork can be scrubbed without
leaving.

Data honesty: "on at the moment" = the printed range; a party with only a start
runs to its close, else is shown as "from 9 PM" and counted as on only after it
starts (no invented end); an afters act runs to the next act's start at its venue
or the room's close (the same rule the stacks' now window uses).

Crew: `crew.mjs` here is people-shelf's nine (Ana = you) with Sunday tuned so the
2 PM fork is a real one: Ana/Ben/Ivy lean Portola (Torren Foot, Kaytree, then
Channel Tres 3:30), Cy/Dot/Fay/Hal are at the Street Fair, Gus picked BOOF
(Herrensauna) and Eli picked both — torn, so he shows on both branches.


## What got built (the frames are the argument)

Run: `APP=<design-app worktree> node frames.mjs [id-prefix]` then `python3 sheet.py …`
(the commands are in this file's history; rig defaults APP to the design-app worktree).
Clock pinned to **Sun Sep 27, 1:50 PM PT**. Every card is `renderCard` from v95.

| Frame | What it shows |
|---|---|
| `1-list-sun-{390,1280}` | The list: SUN PORTOLA as a time list, hourly bands, each card saying its stage the way a Folsom card says its venue. The band NOW is in reads **NOW 1:50 PM** in brand violet; its cards wear the now ring. |
| `2-list-folsom-{390,1280}` | Same day further down: SUN FOLSOM, same bands, same card. |
| `3a-…-mid60`, `3b-…-mid300` | Tap "2 PM": the band label lights, the shelf rises (60ms); the fork draws and the branches arrive a beat apart (300ms — Portola's cards in, Folsom's faces mid-fade). Desktop: the lens grows from the band's corner. |
| `4-moment-2pm-{390,1280}` | **Sunday at 2.** PORTOLA · Pier 80 — you + 3 (A E B I) — Kaytree, Torren Foot, "+2 more on", THEN 3:30 Channel Tres · 3:30 Despacio · 4:30 SG Lewis. FOLSOM · SoMa · across town — **6 of us** (brand) — Folsom Street Fair, BOOF (Herrensauna), "+4 more on", THEN 8:00 Real Bad 37. The line to Folsom is dashed (a trip) and violet (most of us). Eli shows on both branches: he picked both. |
| `5-moment-345-{390,1280}` | After + to 3:45: Portola re-reads (Channel Tres, Despacio; THEN SG Lewis, Ben UFO, Mochakk); Folsom keeps the crowd. |
| `6-moment-1030pm-{390,1280}`, `6b-…-swiped-390` | Sun 10:30 PM, three ways: Portola's closers (you + 6, most of us, solid violet), Folsom (2), Afters ("none of us yet", but THEN 11:15 Kaytree · 12:00 Ben UFO …). A phone shows two branches and the third peeks; swiped, Folsom + Afters. |

## The design, stated plainly

1. **The list stays plain.** Every room is a Folsom-style time list with hourly bands
   (Folsom's own coarse bands — Daytime/Evening — would lump a whole Portola afternoon
   into one band, so the list here uses hours everywhere; that is a real choice for
   direction A to weigh). Nothing is added to a card.
2. **One gesture in:** tap a band's time ("2 PM") — or the NOW band ("NOW 1:50 PM"),
   which is the same door at the current minute. The label is a real button with
   borrowed hit space (the chips' opt-out pattern), so the band keeps its rhythm.
   While the lens is open the label stays lit, a door that is open.
3. **The lens is a fork, not a table.** A stem drops from the time and curves to one
   branch per room with anything on at that minute. The room you tapped from is first
   and its line is solid ("here"); every other room's line is dashed and its sub says
   "across town" (travel implied, no invented minutes — the data has no coordinates).
   The branch with strictly the most of the crew gets the violet line and a violet
   count: "where most of us will be". No boxes around branches; the fork is the frame.
4. **Crew weighting:** faces are everyone who picked something on in that room at that
   minute (you first, then by level); cards are ordered by the sum of pick levels;
   at most two cards, then "+n more on".
5. **What you'd give up** is read across the two THEN lists — the crew's next picks in
   each room, the rest of that day, three at most, yours in white.
6. **Scrub without leaving:** bare − / + step 15 minutes. The time rolls; cards that
   stay don't move; new cards and new THEN rows slide in.
7. **One gesture out:** tap the dimmed list, drag the grabber, or Esc. Tapping a branch
   head is the second way out: it closes the lens and lands you on that room's band at
   that time (not rendered).
8. **Desktop** — the lens is a popover that grows from the band's corner (the zoom's
   "grow from where you are"), up to three branches side by side at `--col-w` with a
   32px gap for the fork to breathe. Falls back to centred if the band isn't on screen.

### Laws kept
`--fest` nowhere new (branch heads are header-colour, the "most" signal is `--brand`);
the one card at `--col-w` (phone: the two branches ARE the list's two columns, edge to
edge in the same gutter); avatars are the notes avatar's recipe; the 44px floor comes
from being buttons (steppers, branch heads) or borrowed space (band labels); a note
still lands on the room head it always did — the lens adds no note targets.

### Motion (in `proto.css`)
- **In (lively):** label lights (140ms colour) → shelf rises 260ms on the app's overshoot
  curve `cubic-bezier(.2,1.15,.35,1)` (desktop: scale .96→1 + 6px from the band's
  corner) → fork strokes draw 220ms from 120ms (dashed lines fade in rather than
  draw) → each branch's head, faces, cards, THEN arrive 6px up + fade, 50ms between
  branches and 35ms between rows.
- **Scrub:** the time rolls up 160ms; unchanged cards untouched; arriving cards/rows
  slide in; the violet "most" line recolours over 200ms.
- **Out (quick, plain):** 160ms drop (desktop: fade + .98), label unlights.
- **Reduce Motion / Low Power:** all instant, nothing broken.
Transforms and opacity only; nothing asks the wall to re-layout.

### Data honesty
On-at-the-minute = `from ≤ t < to` on the festival-day axis (`parseEventTime`), with
windows from the app's own `timeBandsOf` (a printed end wins; a run ends at the next
act; else the room's close). A start-only party is never given a made-up end by this
lens — it inherits exactly the window the list's now ring already uses.

## Risks (honest)
1. **Discoverability.** A band label that opens something is invisible until someone
   taps it. The NOW band ("NOW 1:50 PM", violet) is the likeliest first tap; a one-time
   whisper under it ("tap a time to see every room") or a Show-menu entry may be needed.
2. **Height on a phone.** Full cards make the shelf ~60% of an 844 screen; with a
   three-line name (BOOF … (Herrensauna), the Kink.com penthouse) a branch gets tall. A
   compact variant (names + faces, no card) would be shorter but breaks "the same card".
3. **"Most of us" is a head-count.** It ignores levels, and a person who picked both
   rooms (Eli) counts on both branches. Honest, but a tie shows no violet at all.
4. **"Across town" is coarse.** The venue registry has map links, no coordinates, so
   there is no travel time; afters venues are all "around town".
5. **Band rule.** This list uses hourly bands everywhere; v94's shipped Folsom list uses
   Daytime/Evening/9 PM/… — direction A and this one need one rule.
6. The lens ranks what you can already see (crew picks only) — law (1) of the circles
   model holds; it never surfaces people outside the crew.

## Questions for Kevin
1. The door: the band's time label (as built), a long-press on NOW, or a "What's on at…"
   row in the Show menu?
2. In the lens: full cards (as built, consistent) or compact name rows (shorter shelf)?
3. Should someone torn between rooms (picked both) look different from someone who's
   only in one?
4. Worth adding coordinates to `data/venues/index.json` so "across town" can become
   "~15 min"? (Data work, not render time.)
