# b — One river (list view, 2026-09-26)

*Written 2026-09-26, 3–4 AM PT, during Portola weekend (Sunday is the last day).
Every frame is the production v95 app (design-app worktree, read-only) with
`proto.mjs` + `proto.css` layered on top, a made-up crew, no network, no
database. Commit nothing here; the coordinator commits.*

## The idea in one line

In List view a day is **one timeline**: Portola's sets, the afters and the Folsom
parties all sit in start order under shared hour dividers, and each card carries
a small grey word saying which of the three it belongs to (PORTOLA, AFTERS,
FOLSOM).

## How it answers "Sunday at 2 — Folsom or Portola?"

The answer comes from the layout itself (`sheet-1-sunday-at-2.png`). Under the
**2 PM** divider you see:

1. A single **ALL HOUR** line: `FOLSOM  BOOF · Folsom Street Fair · Party On
   The Plaza … 5 ›`. These are the long parties that started earlier and are
   still going at 3.
2. Everything that starts between 2 and 3, from both sides of town: AIRTIGHT
   (Folsom, 2–9) next to Mind Enterprises, Azzecca, Silva Bumpa and riria
   (Portola).
3. The crew's colours on each card, same as on the board. Cy and Fay are on
   AIRTIGHT; Ana, Cy and Ivy are on Mind Enterprises. The choice is right
   there on one screen.

Tap the ALL HOUR line and the five names open into real cards
(`sun-2pm-open-390`). You then have the full picture of 2 PM on about one and a
half phone screens. On today's board, Folsom-at-2 is a separate room roughly
4,000 px further down.

When it is actually Sunday at 2:10 (`sun-live-390`), the list starts at the
current hour. Hours that are already over fold behind a gradient with a
single **↑ EARLIER** button. Sets that are still playing move down into the
current hour and wear the production "now" ring. A brand-coloured now line
with a `2:10` pill divides what is playing from what is about to start.

## The rules that keep it "easy breezy" at 78 events (Sunday: 32 + 25 + 21)

1. **Hour dividers.** Friends liked the Folsom view's broad bands (DAYTIME,
   EVENING, 9 PM…). Here the dividers are hourly, because 45-minute sets
   live at hour resolution and "2 PM" is the question being asked. An hour
   with nothing starting in it draws no divider. Events with no time go
   under TIME TBA at the end. The divider is production's band head: it sticks
   to the top while its hour is on screen, and the next hour pushes it off.
2. **A long party (e.g. 10 AM – midnight) gets one card, at its start.**
   After that it shows up only as a name in later hours' ALL HOUR line. That
   is how it avoids swamping the 45-minute sets without disappearing from the
   afternoon. The rule is based on the event's own times, not a length
   cut-off: an event goes in the line when it (a) has a **printed** end,
   (b) had already been on for 30 minutes or more when the hour began, and
   (c) is still on when the hour ends.
   a. The printed-end condition means an afters DJ never gets carried,
      because their "end" is really just the next DJ's start time.
   b. The 30-minute condition means a set whose card sits directly above
      the divider (riria at 2:55) isn't repeated under 3 PM.
   c. In the live current hour the 30-minute exemption is switched off. The
      hours above are folded away, so this line has to list everything that
      is on.
3. **The line is grouped by room.** Each group starts with its room word
   (`PORTOLA Despacio  FOLSOM CUMUNION · Hot Tea …`) so it says where things
   are as quietly as a card does. Names the crew picked are brighter; the
   rest are tertiary grey. A party's subtitle is trimmed for the line only
   ("Party On The Plaza: Folsom Edition" → "Party On The Plaza"). The card
   keeps the full name, because names are pick keys.
4. **Past (Kevin's second ask).** With "What's over" unchecked, hours that
   started before the current one leave the list. You see only the faded
   tail of the last row and `↑ EARLIER · 43 over`, or `from 10 AM` when
   nothing is actually over yet. It isn't a long scroll back.
5. **Rooms become filters.** The Show menu's room checks now add or remove a
   room's cards from the single list. When only one room is left, the
   room word disappears from cards and lines.

## Room heads and note doors when the rooms are mixed together

The day gets **one** head: `SUN  PORTOLA · AFTERS · FOLSOM  SEP 27`.

1. The weekday is secondary grey, like today's heads.
2. Each room word is its own button (the 44px touch floor comes from it being
   a button) and opens that room's notes for that date:
   a. PORTOLA opens the date (`2026-09-27`), the same thing SUN PORTOLA
      opens today.
   b. AFTERS and FOLSOM open `2026-09-27|Afters` and `2026-09-27|Folsom`.
3. "A note is written where you are standing" still holds: the word you tap
   is the room you're standing in.
4. Each room's newest note sits under the head, labelled with the door it
   came from (`PORTOLA you …`, `FOLSOM Dot …`).
5. Nothing rolls up, no note keys change, and nothing is migrated.

## The Show menu (`menu-390`)

Production's menu, with two rows added under the rooms, in the same visual
style as the existing rows:

1. `List · Board`: one row, the chosen word in brand colour.
2. `What's over`: an ordinary check row.

Both are saved per device and per fest, and ride along in share links and
reloads the way the fold does.

## Motion

1. **Opening ALL HOUR.** Each name grows into its card from where the word
   sits (FLIP from the word's rectangle, 30 ms apart). The hour's own cards
   slide down to make room. Closing is quick and plain, in reverse.
2. **Room switched off** (`filter-mid-390` is frozen at t = 0.3, then
   `filter-after-390`). The room's cards fade and shrink 6% where they stand
   (quick). The rest travel to their new slots, along with the dividers and
   ALL HOUR lines, so the reader's hour stays in place.
   **Finding from the mid frame:** in a two-column list a reflow sends cards
   diagonally across each other (Mind Enterprises and Azzecca swap columns
   and overlap mid-flight). Fix to build: cards travel **vertically only**,
   and a card that changes column does a quick in-place cross-fade instead
   of sliding across. That is still the app's rule: nothing pops, and the
   sideways move is just the short part.
3. **Board ↔ List.** Each card travels from its board slot to its list slot.
   The three room heads merge into the single head (each room word moves to
   its spot in the row of doors). Hour dividers draw in from the left.
4. **The hour turns** (live). Finished cards slide up under the gradient,
   still-playing ones slide down into the new current hour, and the now line
   moves once a minute with the ticker (no repaint).
5. With Low Power or Reduce Motion, all of these are instant, never broken.

## Frames (`frames/`, 2x PNG) and sheets

| Sheet | What |
|---|---|
| `sheet-1-sunday-at-2.png` | today's board at 2 PM · the list at 2 PM · ALL HOUR opened · live at 2:10 |
| `sheet-2-the-day.png` | the single head with its doors and notes · tonight live with the past folded · 11 PM (afters + Folsom + last sets) · Show menu |
| `sheet-3-folsom-off.png` | before · Folsom leaving, mid-motion · settled |
| `sheet-4-whole-sunday.png` | all 78 events, 10 AM to TIME TBA, stitched |
| `sheet-5-320.png` | the head, 2 PM, ALL HOUR open, at 320 |
| `sheet-6-desktop.png` | 1280: the list wraps five across; the ALL HOUR line is mostly readable in full |

Run it again with `node frames.mjs [id-prefix]` from this folder (APP defaults to
the design-app worktree). The only write the page attempts is `POST /api/person`,
and the rig refuses it (`rig-report.txt`).

## Risks and open questions

1. A day is long: Sunday is about 5,700 CSS px at 390. Folding the past
   helps in the moment. For planning ahead, scrolling a long list is the
   trade-off.
2. The afters' running order gets split up: Public Works' four DJs land in
   three different hours. That is correct for "what's on at 12:30?", but
   the board is still better for "who plays Public Works?". The List/Board
   toggle covers both.
3. The ALL HOUR line repeats the same names hour after hour on Folsom's
   long day (BOOF leads from 12 to 7 because Ana picked it). It's quiet, but
   worth watching on a real phone.
4. Some Folsom names are all capitals and wrap to five lines on a card
   (OFFICIAL KINK.COM …). That is the data, not this design, but it stands
   out more in a mixed list.
5. The "30 minutes" in the carry rule is a judgement call.
