# Design round — Our picks across the days, a drop-in room, and filters while open (2026-09-26)

You are the design partner for the next round of "Our picks", the shelf in Festival
Navigator that says where most of a friend group will be. Kevin (the designer who owns
this app; he is remote today and reviews through a web page) looked at the live app this
afternoon, liked it, and raised three things. Your job is to think them through properly,
prototype the answer in production code on a design branch, render frames, and write a
review page he can decide from. You are not shipping anything: the build comes after his
calls. Push back where you disagree with the direction below — the direction is signal,
not spec.

## Kevin's words (verbatim, 2026-09-26 ~3 PM PT)

> "Checked out the live of now and it's ver nice, but despacio is a weird edge case I think
> we need to design around. see how much it's crowding out the list? not sure what to do.
> thoughts? … it is technically true that folks may be there now / they picked it but like..
> hmmmm and then I'd expect our picks shelf to 1) yes focus on today but scroll to all future
> days and incude our expand past days show option. and 2) support filter menus while the
> shelf is open. filtering while viewing the picks view is just as valid as in the grid /
> list views. for the 'highlight people' choice while picks shelf is open. the math should
> be slightly different - we should think through how to 'highlight' (see: filter to because
> of how the picks view works) the right things."

His two screenshots (not available as files; described):
1. Phone, the open plan on Portola Saturday afternoon with his real crew: **Despacio**
   (2:45–9:45 PM, 7 picked) is the NOW row; then Despacio comes back as "or Despacio" under
   Tove Lo, as a stop at 6:30 (6 picked), as "or Despacio" under Dog Blood at 9 PM, and as a
   stop at 9:25. Five appearances of one room in one afternoon.
2. Laptop grid: the Despacio column is one tall card from 2:45 to 9:45, and the plan's corner
   card says Despacio NOW.

Despacio is 2manydjs + James Murphy's soundsystem room: one continuous seven-hour block on
its own stage (Sat 2:45–9:45 PM, Sun 3:30–10:30 PM, `data/festivals/portola-2026.json`,
`days.*.stages` and `days.*.artists`). People drift in and out between the sets they
actually plan around. Why it eats the route: rule 3 in `js/v3/plan.js` seats each person at
their highest-level live pick and breaks ties toward where more of the crew is, so a room
that most people picked at level 1 wins every tie against a real set picked at the same
level, all afternoon.

## The three questions

**A. Despacio (and any room like it).** What should the plan do with a room people drift
through? My starting recommendation, for you to test and beat: the festival data
**declares** it (a flag on the grid set, e.g. `"dropIn": true` — find the right word), never a
duration threshold (the house law: presentations are chosen by the data's shape or declared,
never by a threshold — CLAUDE.md, the wall's two presentations). Then: (1) in seating, a
drop-in yields to any real live pick of that person whatever the levels (seven hours means
you can always drop in later), so it only fills real gaps; (2) it is never an "or" fork;
(3) it appears once per day as a quiet line ("Despacio all afternoon, 2:45–9:45 PM, 7 of us
drift through" — words yours), and a gap it fills reads as between-sets, not a full stop
with a grown card; (4) the peek never calls it NOW while a real set clears the bar;
(5) the grid is unchanged; (6) the validator nudges a data author when a stage's day is one
set (a shape) and it is not declared. Alternatives worth showing against it: a shape rule
(a stage whose whole day is one set is a drop-in room — a shape, not a threshold, but it
misfires on a one-set special stage), and a lighter touch (only kill the forks and merge
its repeats). Show what the crew's afternoon reads like under each.

**B. The open plan across the days.** It lands on today (as now), and scrolling continues
into every future day of the festival, each under its own day head; the days before today
(and today's stops already over) fold behind one line using the wall's own past-fold
pattern and words (`js/v3/wall.js` pastOf / foldPast; the List's "Earlier" line). The peek
stays today's one row. Decide: what the Share at the foot sends once you have scrolled to
Sunday (I lean: the day at the top of the view, and the button says so — "Share Sunday's
picks"), how a day head reads, how a day with no plan reads, whether the laptop panel does
the same, and whether ACL (two weekends, dated Late nights between) still reads well.

**C. The menus while the plan is open.** Today opening the Show menu or the people menu
closes the plan (`closePlan()` in app.js `openShowMenu`); find out for yourself what the
people menu (`hlPop`, the dock's / rail's "you" button) does with the plan open, and whether
the open plan even leaves those buttons reachable on a phone. Kevin:
filtering while the plan is open is as valid as on the Board or the List. So both menus open
over the open plan, and the route re-plans live as rooms hide (rule 8 already takes rooms
out) and as the view changes. Then the highlight: today it only dims rows the highlighted
people are not in (`hasAny`, `peekOf`). Kevin wants it to FILTER to the right things,
"because of how the picks view works". My starting point: a highlight plans over only the
highlighted people — their picks, rule 3 on them — with a bar that makes sense for a small
group (one person: their own day, their conflicts as "or"; two or three: bar 1, top = where
most of them are, "2 of 3"; larger: something principled — work it out and justify it), and
the rows say who. The coordinator building v103 in parallel added a List filter where a
highlight filters rows to the highlighted people's picks; the build must reuse v103's
picked-by-highlighted predicate so the List and the plan never disagree about who picked
what. v103 is not merged yet — prototype with a local predicate and name, in DESIGN.md,
exactly where the build will switch to v103's. Also decide what Share sends under a
highlight (today: only stops the highlighted people are in; still no names).

## Where things are

- Your worktree: `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/plan-days`,
  branch `live/plan-days-design`, cut from the Share build's head (fc86005). Work only here.
- The model: `js/v3/plan.js` (read its header rules 1–8 first), rows and the share text:
  `js/v3/plan-rows.js`, the shelf and its motion: `js/v3/plan-shelf.js`, wiring:
  `js/v3/app.js` (`planAnswer`, `paintPlan`, `openShowMenu`, the people menu), styles:
  `assets/v3.css` (`.plan-*`), tokens `assets/v3-tokens.css` (look values up, never invent).
- The build's history and Kevin's earlier calls on this shelf:
  `claude-plans/2026-09-26-unified-build/OUR-PLAN-BUILD.md`, `SHARE-BUILD.md`, and
  `our-plan/plan-model-log.md` (search, don't read whole).
- The frame rig (production code in headless Chromium, a made-up crew, /api answered in the
  page, every write refused, no network): `claude-plans/2026-09-25-portola-live/design/ours-r2/rig.mjs`
  (+ its `crew.mjs`), used by `claude-plans/2026-09-26-unified-build/our-plan/frames.mjs`.
  The browser tests' harness is `tests/browser/plan-share.test.mjs` `open()`.
- The made-up crew: `tests/fixtures/plan-crew-nine.json` (Ana, Ben, Cy, Dot, Eli, Fay, Gus,
  Hal, Ivy). Only Gus picked Despacio there. Make a variant crew for this round in your
  design folder where 7 of the 9 pick Despacio (mixed levels, a couple as must) on top of
  their other picks, so the frames reproduce Kevin's afternoon. Never edit the shared
  fixture.

## Laws that bind this round (CLAUDE.md has the rest; read it)

- The vibe: a designer's passion project; delight, taste, flow, edge cases as design.
  Nothing pops, appears from nowhere or vanishes in place. Kevin rejected an earlier canvas
  for "no elegance": no boxes, no pill stacks; distinct directions on distinct axes when you
  offer alternatives. `--fest` appears in exactly four places; anything "ours" uses `--brand`.
  UI vocabulary is picked / must / notes / fest; never a music-note glyph.
- One body, one place, and nobody ever sees people outside their circles. The share text
  never names people. A highlight is viewer-side only, never written to the crew doc.
- Browser history: a menu takes no history entry (CLAUDE.md, "Browser history is shared
  state"); the plan's open/close and Back are already designed — don't add entries.

## Hard rules

1. Made-up crews only. Never load a real crew link, production (fest.kevinhg.com), a
   preview URL, or `vercel dev` (it uses the production database). No database writes.
2. Don't stamp (`scripts/sw-stamp.mjs`), don't open a PR, don't merge, don't touch `main`.
3. Commit to `live/plan-days-design` as you go (scope-prefixed messages like
   `design: …`, never "wip"), and push the branch. Before each commit scan for a crew token:
   `! git diff --cached | grep -qE '#g=[A-Za-z0-9_-]{16,}' && git commit …` (`&&`, never
   `;`). Build any test token from a variable, never a literal. End commit messages with:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
   `Claude-Session: https://claude.ai/code/session_01SDyAPRJqh1hbG9viUb2qKA`.
   Screenshots are git-ignored by the repo's allowlist — keep them in `plan-days-design/shots/`
   and don't force-add them.
4. Bank as you go: write `plan-days-design/DESIGN.md` early (your understanding and plan),
   grow it as you learn, commit it each time it changes meaningfully. If you die mid-round,
   the file is what survives.
5. Do not spawn other agents or teammates.

## Deliverables (all in `claude-plans/2026-09-26-unified-build/plan-days-design/`)

1. `DESIGN.md`: for A, B and C — the recommendation, one or two real alternatives with
   their tradeoffs, the exact model rules in plan.js terms (what changes in seating, the
   route, the peek, forks, the share text), edge cases (a drop-in that is someone's only
   pick; a must on Despacio; a highlight of one person with no picks today; a day with
   nothing; ACL's two weekends; the laptop panel; Reduce Motion), and the questions only
   Kevin can answer, each with your default.
2. A prototype on this branch good enough to render every frame from production code
   (it can be rough where no frame looks; say where).
3. Frames at 390×844 (touch) and 1280×800 (mouse): Kevin's Saturday afternoon today vs
   each Despacio option (same clock, same variant crew — ~3:15 PM and ~6:45 PM); the open
   plan scrolled across Sat → Sun with the past folded, and unfolded; the Show menu open over
   the open plan and the plan after a room is hidden; the people menu over the open plan and
   the plan filtered to one person and to three; the Share button's words per day. Run
   `node` on your frames script and check every frame's report line says it showed what you
   meant (a frame that silently showed nothing has happened before).
4. `review.html`: one self-contained page for Kevin (no external requests; frames referenced
   as `shots/<file>.png`), leading with the three decisions in plain words, then the frames
   side by side per question, then each question he must answer with your default. Short
   sentences, no invented jargon, numbered so he can reply "A2: yes". I will publish it.

Your final message: what you recommend for A, B and C in a few lines each, the questions for
Kevin with your defaults, the frame list, the branch head SHA, and anything you think I have
wrong.
