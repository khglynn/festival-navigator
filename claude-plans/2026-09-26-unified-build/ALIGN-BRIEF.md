# The wall's left edge — banked brief (Kevin, 2026-09-26 ~10:30 AM PT, from the live app on his laptop)

Building now (Kevin, ~10:45 AM PT: "would be nice if it's small") as its own small release, after the tap change and the people menu ship. The EARLIER line is yours too: decide centred in its rule vs on the shared left edge, frame both, say why.

## Kevin's words

"the left alignment to line up with the sections with a time bar only seems to happen after
your first time grid. the ones before are still fully left justified. I think the move is to
remove most special logic and just always have the left justify in a bit so things are lined
up. we can also move the titles for those dates - sat portola [location] over to line up with
the cards - or shift the times a little to the left of both. but goal is - alignment straight
down the left with the cards and titles. it'll look nice yeah if we can also scootch the times
to the left a bit to give us breathing room for all the other info since times will be the
only thing tucked into that left space"

And: "if you want to center the 'earlier' text in the line to make it not stack other text on
desktop I'm open".

## What he saw (Board, laptop)

1. A stage-grid room (SAT PORTOLA) indents its stage heads and cards past a time gutter
   (1 PM, 2 PM…), but its room head sits at the far left.
2. Rooms before the first grid — Folsom by time (bands "10 PM", "LATE"), the Afters stacks —
   start fully left, so the cards jump right the moment a grid begins.
3. The EARLIER · THU · FRI line sits at the far left too, reading like a second room head.

## The goal

One left edge straight down the wall: every card column, every stage/venue head and every
room head (SAT PORTOLA · SEP 26 · PIER 80) starts at the same x. The left gutter holds only
times — the grid's hour marks and a by-time section's band labels ("10 PM", "LATE") — nudged
further left than today so the cards get room. Remove the per-presentation special cases
rather than adding another one. Check the List view (560px column) and phones (the grid's
narrow gutter, Folsom's two columns) keep or gain the same rule, and frame 1280, ~900, 390
and 320 before and after. Kevin's screenshots: kevin-align-0..3.png beside this file (local
only; images are git-ignored).

## Where and how

Worktree `.claude/worktrees/align`, branch `live/align` off main (v97 + the ACL data release).
Other branches are open at the same time: the tap change (sheets, card-facts), the people menu
(the header: it removes the toolbar divider stub and the rail's hairline — not yours), Our plan
(the dock/peek). Keep to the wall's left edge: v3.css rules for room heads, band labels, the
time gutter, the past line; wall.js only where a presentation sets its own offset. Law check:
one card column token (`--col-w`) — the gutter and the new left edge are ONE token each, defined
once, with a comment saying why. Real-browser frames, looked at. `npm test` in UTC, Tokyo and the
night clock; `npm run test:browser`; commit + push after each step; no stamp, no PR. Log:
`ALIGN-BUILD.md` beside this, started first.
