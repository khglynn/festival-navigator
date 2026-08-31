# Afters + Folsom — the events canvas (2026-08-31)

`canvas.html` — open it from the repo root over http (`python3 -m http.server 8455`,
then <http://localhost:8455/claude-plans/2026-08-31-events-canvas/canvas.html>).
It links the app's real `assets/v3-tokens.css` + `assets/v3.css` and uses the real
class names, so every card, rule, stage head and sort chip is the production
pixel. All 45 Portola event entries are in it, with a plausible crew (you, Nhu,
Kat, Ross) picking so the frames aren't a wall of flat cards.

Each frame is an **iframe**, so the app's 720px / 1100px breakpoints see the
*frame's* width — a 390px phone frame really renders phone rules inside a
1500px browser window. `build.mjs` regenerates the page from
`data/festivals/portola-2026.json`; nothing here is hand-transcribed.

**Nothing here is built.** It's a picture of the two calls in
`claude-plans/2026-08-31-events-model.md`.

---

## The frames

**A · venue columns, desktop (1440).** Your picture, exactly: per night, a
timetable whose columns are venues, with the main grid's grammar — stage strip
in the fest accent, 15-minute rows at 20px, hour rail on the left, `.card.cell`
in the columns, same-venue overlaps splitting into lanes. It is honest about
what the data does to it: **Thursday is two columns holding one card each**,
stretched to ~600px wide by the grid's `minmax(150px, 1fr)`, with three hours of
air between them. Friday's Regency column splits into three lanes because Channel
Tres, Jyoty and Gelli Haha all start at 8 PM, and Despacio (5–11 PM) draws as a
seven-hour tall cell. The six timeless entries sit in a quiet **TIME TBA** row
under their night — never with invented times.

**A · venue columns, phone (390).** The columns hold their 150px floor, so
Sunday's seven venues scroll sideways under the strip. That gesture is right on
the Sat/Sun grid, where sideways means "another stage 200 metres away." Here it
means "another club across San Francisco," and on four of the nights you're
swiping past mostly-empty columns to find the one show you care about.

**B · night-grouped list, desktop (1440).** The written proposal. Night
sub-headers in the `day-rule` vocabulary (THURSDAY · SEP 24, with the day-notes
chip), time-sorted inside a night, each card carrying `night · time` on one line
and the **venue as a map door** on the next. Ties break alphabetically; the
timeless entries fall to the end of their night reading "time TBA" rather than
disappearing. Every card is the same size whether a night has two shows or
fifteen — Thursday costs two cards, not a screen of empty clock.

**B · night-grouped list, phone (390).** Two columns, thumb-scroll, nothing
sideways. The whole of Thursday is one thumb-length. What you give up is
overlap: the list tells you every start time but never draws how two shows
stack against each other.

**C · venue swim-lanes, desktop (1440).** My third option. Per night, one row
per venue — venue name (with its map door) where a stage head would be, its sets
laid left-to-right in time order. It keeps the "venues are the axis" reading you
wanted from A without paying for an empty clock: a one-show venue costs one row,
not one 600px column. It's the compromise shape — but it is a new layout
vocabulary the app doesn't have yet, and it reads as neither grid nor list.

**C · venue swim-lanes, phone (390).** Below 720 the lane head stacks over its
sets and each lane scrolls its own short row. At that width it has quietly
become a list with venue headers — which is a hint about what it really is.

**FOLSOM · sorted by time / sorted by venue (1440).** The lineup wall's own
`sort-chip` + `sort-pop` (drawn open so both states are visible at once) with
the app's four options plus the two an events section needs: **By time** and
**By venue**. By time groups by night and runs chronological — the Street Fair
lands at the top of Sunday, 11 AM, where it belongs. By venue groups by door and
answers "what's on at SVN West" in a glance, losing the night's shape.

---

## What I'd build

**B as the shape, with C's venue reading demoted to a sort — and the same sort
control on Afters that Folsom gets.** One `events` renderer, two sorts.

The reasoning, honestly:

**The grid's value is answering "can I do both?", and Afters can't ask that.**
A timetable earns its complexity when stages are 200 metres apart and set times
are staggered, so the overlap picture is a real decision. Afters is 16 venues
scattered across San Francisco and — look at the data — almost every show starts
at **8 PM or 10 PM**. You are not hopping between Public Works and The Midway at
1 AM. You pick one door and stay. The question a phone gets asked at midnight is
*"where am I going tonight?"*, and a list answers it in one screen while a grid
makes you read a mostly-empty clock to find out.

**The sparseness isn't a rendering nit, it's most of the nights.** Thursday: two
venues, two shows. Saturday: only four of nine shows have a time at all. Frame A
spends a full screen of vertical air on Thursday to say something two cards say.

**Your instinct about venues is still right — it's a sort, not an axis.** "Show
me by venue" is a real question ("I'm already at Monarch, who else is on?"), and
frame C shows it reads fine. But it's the *second* question, and paying for it
with a whole second layout engine is the expensive way to answer it. Put **By
time** and **By venue** in the sort chip on both Afters and Folsom, and the
venue view costs a grouping function instead of a timetable.

**And it's the cheaper build by a lot.** B + a sort is one renderer, one sort
function, no new geometry. A is a second timetable engine that has to solve
problems the real grid never had: per-night venue columns break the app's *one*
sticky stage strip (the strip assumes one stage set for every day — with venue
columns, every night needs its own), and open-ended times ("8 PM", no end) have
to be drawn as an invented hour block.

**Folsom's default sort: By time.** The Street Fair is the anchor of the weekend
and it's the only 11 AM event in the section — time sorting puts it at the top
of Sunday on its own. By venue buries it under "F".

**On call 2 (the Street Fair):** keep it in the section. Both Folsom frames show
it sitting happily next to the clubs, and it's the most-picked card in the
canvas. If it ever wants a route or a map of the street, that's a new section
`type` later — the model already leaves the door open.

**If you still want the grid:** build B first (it's the same data plumbing —
`night` + `venue` instead of the smashed `"Thu · Venue"` string), and add the
timetable as a **view toggle on nights that earn it**. Sunday, with seven venues
and fifteen shows, is a real grid. Thursday never will be.
