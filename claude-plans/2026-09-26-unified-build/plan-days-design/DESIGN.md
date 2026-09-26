# Our picks: across the days, a drop-in room, and the menus while open (design round, 2026-09-26)

Branch `live/plan-days-design`, cut from the Share build's head (fc86005). Brief: `BRIEF.md`
beside this. Status: **in progress** — this file is banked early and grows as the round goes.

## What I found before designing (evidence, 2026-09-26 afternoon)

1. **The made-up crew reproduces Kevin's afternoon.** `crew-despacio.mjs` is round two's
   nine plus Despacio picked by seven (Ana 1, Ben 1, Cy 2, Dot 1, Fay must, Gus must,
   Ivy 1). `node print-route.mjs despacio` on today's model gives Saturday as:
   Despacio 2:45–5:40 PM NOW (6), Tove Lo with "or Despacio", Despacio again 6:30–7:10,
   Robyn, Despacio again 8:10–9, Dog Blood… Gelli Haha, Tricky, Groove Armada, DJ Shadow,
   Kettama and Fatboy Slim all fall out of the route. Sunday is worse (Despacio twice as
   MOST, once more at 10 PM, and as an "or" under Mochakk).
2. **Why:** rule 3 seats a person at their highest-level live pick, ties to where more of
   the crew is. Despacio is live all afternoon, so every tie goes there and it snowballs;
   the two musts anchor it. This is exactly the brief's reading.
3. **A second, hidden Despacio: Friday.** A pick is keyed by NAME, and "Despacio" has three
   plays: the Saturday and Sunday grid sets AND an Afters entry, "Pier 80 (loyalty
   invite)", Friday 5–11 PM. Rule 5 counts a pick at every play, so today the seven are
   also a MOST stop on Friday, 5–9:30 PM, at an invite-only event. Kevin's real crew
   would see the same thing on Friday's plan.
4. **The shape rule misfires on real data.** A stage whose whole day is one set appears in
   our files four times: Portola's Despacio (Sat, Sun) and Lollapalooza 2025's Bonus Tracks
   (a 30-minute set), Toyota Music Den (30 min) and Fountain (2 h). Only Despacio is a room
   people drift through. The shape rule also cannot see Friday's invite (a section room,
   not a stage).
5. **Both menus already close the open plan.** The people menu opens through the Show
   menu's own `openShowMenu`, whose second line is `closePlan()`. The buttons ARE
   reachable with the plan open on a phone: the shelf stands on the dock (fixed,
   `bottom: var(--dock-h)`, z29 under the dock's z30) and never covers it; on a laptop the
   panel sits under the day rail.
6. **v103's predicate is `passesPeople` in `js/v3/filters.js`.** `origin/live/v103`
   (4b7f92d) names it "the ONE predicate for 'did the highlighted people pick this': the
   Board's dim, the List's filter and Our picks' route ask it and nothing else", and adds
   `thinnedWords(people, meName)` in wall.js for the quiet line ("nothing Ross picked").
   The function itself already exists on this branch unchanged; the plan can call it now.

(Recommendations, rules, edge cases and questions follow as they are settled.)
