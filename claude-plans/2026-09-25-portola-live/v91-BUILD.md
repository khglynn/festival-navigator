# v91 — the phone afters line up, and search ignores accents (build log)

Started 2026-09-25 ~6:40 PM PT. Branch `live/v91`, worktree
`.claude/worktrees/v91` (off origin/main 6687289, v90 live).
Builder: an Opus teammate. Orchestrator: the Portola live-ops session.
v90's build log (`v90-BUILD.md` beside this file) is the context: read it
first, especially item 1 and "For you to decide".

## Why

Kevin is at Portola; friends use the app at night, mostly for the afters.
v90 lined the stacks up with the timetable on desktop, but on a phone the
afters still start at the shell's edge while the timetable's columns start
past the 40px hour rail — the case Kevin actually sees. His words, about
exactly this: "just adding a little bit of extra padding that obviously
scrolls away if you left scroll … if there is a timeline item in the stack."
So the answer he described is a sideways scroller: the stacks under a clock
start where the timetable's columns start, and that lead space scrolls away
when you swipe, the way the timetable itself behaves.

## The two items

1. **The phone afters line up with the timetable.** On a clock day at phone
   widths, the day's other rooms (afters, Folsom, Late nights — the stacks
   v90 tagged `data-clock`) start at the same x as the timetable's first
   column and keep their full `--col-w` card width; the block scrolls
   sideways when it is wider than the shell, with the lead gutter scrolling
   away. At rest it should look like the timetable above it (the right-hand
   column may run off the edge, as the timetable's does). Decide the unit
   that scrolls (one scroller per day's stacks is the likely answer; say why
   if not). Laws that bind this (CLAUDE.md): `--col-w` is the one card width;
   anything that mirrors or restores scroll positions must not grab this new
   scroller by accident (see `isStripScroller` and the day-to-day scroll
   code); the sticky stage strip is a follower of the timetable only; the
   zoom must still open over a card inside the new scroller at the screen's
   edge and after a sideways scroll; motion stays transform/opacity. Check
   320, 390 and 430 wide, a day with one afters room, a day with three,
   a day whose stacks fit without scrolling, and a day with no timetable
   (unchanged). If a horizontal scroller nested in the vertical page makes
   vertical swiping feel sticky on touch, say so with evidence.
2. **Search ignores accents.** Typing "mull" finds "MÜLL", "chloe" finds
   "Chloé Caillet", and the reverse. Fold diacritics on both sides of the
   match only (never change stored names — they are pick keys). Cover it with
   a unit test using real names from the Portola file.

## How to work

Same rules as v90: work only in this worktree; commit and push as you go on
`live/v91` (a branch push is a preview only); no PR, merge or stamp; no
crew-data, sync, merge, artist-name or update-machinery changes; never load
production with a crew link or write to the production database; one test
suite and one browser at a time. Real-browser checks of the new scroller with
real touch input at 390 (the builder's walk rig from v90 is in this folder),
screenshots before/after into `claude-plans/2026-09-25-portola-live/v91-shots/`
(git-ignored). Targeted tests while working, one full `npm test` at the end
(the stamp test will fail until the orchestrator stamps).

## Log

(builder writes here)

### Item 2 — search ignores accents

**What was wrong.** There were two searches. A lineup fest's
(`applyFilter`) already folded diacritics; a scheduled fest's — Portola's,
every fest with set times — matched `name.toLowerCase().includes(q)`, so
"mull" never found MÜLL and "chloe" never found Chloé Caillet.

**What changed.** `js/v3/wall.js` "search / sort / weekend": one
`searchFold` (lowercase, NFD, drop the combining marks, then the letters NFD
leaves whole — ø ł đ ð ħ ı ß æ œ þ — and a curly ’ to ', which iOS Smart
Punctuation types) and one `searchMatches(name, query)` that folds BOTH
sides. `applyFilter` and the scheduled search's `wanted` both call it. Stored
names are never touched; the card still carries the file's exact bytes.

**Checked.** `tests/search-fold.test.mjs` (7) with Portola's real names:
"mull"/"MÜLL" → Friday MÜLL (and the tab list is just Friday); "chloe" /
"Chloé" → both Chloé Caillet cards (Saturday grid + Public Works afters);
"tiesto", "adela"; "ovérmono" finds the plain Overmono (the reverse); the
file is byte-identical after searching; CØNTRA / Łaszewo / Høldën fold. The
three render tests fail against the old `wanted` line (checked by
reverting it). Neighbouring suites green (104).

**Not done, on purpose.** Stylised names (¥ØU$UK€ ¥UK1MAT$U, half•alive,
"Me n ü") still need their own punctuation typed; folding $→s or ignoring
spaces is a different kind of forgiveness and a product call.
