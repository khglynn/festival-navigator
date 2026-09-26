# v90 — Kevin's first Portola notes, the small ones (build log)

Started 2026-09-25 ~5:40 PM PT. Branch `live/v90`, worktree
`.claude/worktrees/v90` (off origin/main f88bad7, v89 live).
Builder: an Opus teammate. Orchestrator: the Portola live-ops session.

## Why this release exists

Kevin is at Portola with friends who use the app. He relays their notes from
his phone; we fold the small ones into a release tonight, safely, while
people are using it. Everything here must be boring to ship: visual and
client-only, no crew-data shape changes, no sync or merge changes, no
artist-name changes. If any of the three items below turns out to need one
of those, stop and write it down here instead.

## The three items (Kevin's words, then the ask)

1. **Line the stacks up.** "Sometimes on the timelines we have times on the
   left, and the items that don't have them don't line up. I'd like them to
   line up vertically all the way down — a little extra padding on the ones
   without a time, if there is a timed item in the stack. Small thing; don't
   stress if it's a pain." Find where this happens (venue stacks under
   MODEL-V4 — afters, Late nights, Folsom, sections — and anywhere else a
   time gutter sits beside some cards and not others), and make every card
   in a stack that has any timed card share the same left edge. The gutter
   scrolls with the content; it is not sticky. Stacks with no timed cards
   stay as they are. Check the two-line name, the tall set, the cancelled
   act and the card at the screen's edge.
2. **A taller notes button beside search.** "We just updated the search box
   at the very top; the notes thing to the right of it — the little tag with
   the outline — should be the same height, so it's just a little notes
   button. Same kind of shape, just taller. No search enter button needed."
   Match the search field's height and rhythm exactly (look the values up in
   `assets/v3-tokens.css` / `assets/v3.css`; never invent them). Check first
   whether the same component is used elsewhere (the zoom has a notes chip):
   change only the top one unless the shared change is clearly right.
3. **A way to get the latest version on a phone.** Kevin could not get his
   iPhone to load the newest build ("there's just a refresh button"); he had
   to use a private tab, which loses who he is. Add a small, quiet control
   (Settings or Diagnostics, wherever the build line already shows) that
   says which build this phone runs and, when tapped: asks the service
   worker to update, clears the app's caches (Cache Storage) — **never**
   localStorage, sessionStorage or IndexedDB, which hold the person token and
   picks — and reloads through the app's existing "nothing in progress"
   reload path. It must be safe offline (say so, do nothing destructive) and
   must follow the storage rules in CLAUDE.md (every storage touch in a try;
   no bare DOM globals stored as methods). Words: plain and short, in the
   app's voice. If there is already a control that does this, say so and
   make it findable instead.

## How to work

- Read CLAUDE.md (the laws) and NOW.md first. The motion and edge-case bar in
  "How this app moves" applies to all three items.
- Commit WIP on `live/v90` as you go (one concern per commit, scope-prefixed
  messages, never "wip"), and push the branch after each item — a branch push
  is a preview deploy only, never production. Do NOT open a PR, merge,
  stamp (`scripts/sw-stamp.mjs`), or touch `CACHE_VERSION`: the orchestrator
  stamps on a clean tree above main at release time.
- Scan before every commit for crew tokens (`#g=`) — the repo is public.
- Tests: add or update unit tests for the logic you touch (the update control
  especially). Run targeted tests while working; run the full `npm test` once
  at the end. The Mac is under heavy memory pressure: one test suite and one
  browser at a time, and kill anything you start.
- Look at what you built: render the affected states (gallery.html, the
  canvas rig in `claude-plans/2026-08-29-notes-desktop-canvas`, or Playwright
  screenshots at 390 px wide) before and after, and save them to
  `claude-plans/2026-09-25-portola-live/v90-shots/` (images are git-ignored
  by default; that is fine, they are for the orchestrator). Never load
  production with a crew link and never write to the production database;
  localhost /api and previews hit it.
- Bank as you go: keep this file's "Log" section current after each item.

## Done means

Each item committed and pushed, before/after screenshots saved, targeted
tests plus one full `npm test` green, and the Log below says what changed,
where (file:line), what you checked, and anything you were unsure about.

## Log

### Item 1 — stacks line up with the clock (commit 7491c9d)

**Where it happened.** The only "times on the left" in the app is a grid
day's hour rail (40px). Inside a venue stack the time sits in the card under
the name, so no stack has a gutter of its own. On Portola Saturday at 390px
the grid's cards start at x=54, but Skepta's cancelled card (the festival
room's leftover stack under the grid, "Crane Stage") and every SAT AFTERS /
SAT FOLSOM stack started at x=14. Same on desktop (grid 140, afters 100 at
1280), and the grid's track gap is 4px where stacks used 6/7px, so on desktop
the columns drifted further apart the further right you looked.

**What changed.**
- `js/v3/wall.js:1499-1503` — `venueGroups` takes `clock` and writes
  `data-clock` on the `.venue-grid`; `:1997-2040` — `renderComposed` passes
  `'room'` for the clock's own leftovers and `'day'` for the other rooms on a
  day that actually drew a clock; `renderScheduledDayBody` now returns
  whether it drew one (a grid day with no set times draws none).
- `assets/v3-tokens.css:100-107` — `--hour-rail-w: 40px`, `--clock-gap: 4px`
  (the existing values, named); `assets/v3.css:693,712,764` — the rail, the
  grid and the strip's spacer read them.
- `assets/v3.css:1219-1237` — `[data-clock="room"]` steps in by the rail and
  takes the clock's gap at every width; `[data-clock="day"]` only from 720 up.
- `tests/clock-stacks.test.mjs` — Portola's tags per day and room, the fold
  (hide the festival → no tags), a no-set-times grid day, and the CSS shape.

**Checked.** Before/after at 390 and 1280 (`v90-shots/before-sat-portola-end.png`,
`after-sat-portola-end.png`, `after-1280-sat-join.png`): Skepta now sits at
x=54 under the first column; at 1280 SAT/SUN AFTERS columns land exactly on
the grid's (140/320/500/680). Thu/Fri unchanged (14 phone, 100 desktop). No
horizontal page scroll at 390/768/1024/1280. ACL: no leftovers, Late nights
are their own blocks (untouched). Two-line names and tall sets unchanged
(card widths never change). Targeted tests + `tests/browser/strip-follow`
and `tests/browser/meter-contract` green.

**Calls for the orchestrator / Kevin.**
1. On a PHONE the afters/Folsom stacks do NOT step in. Their two columns
   fill the shell exactly (`--col-w`), so the 40px rail would drop SAT
   AFTERS to one column — twice the scroll on the busiest nights. Only the
   clock's own room (Skepta) moves on a phone. If Kevin wants the afters
   lined up on his phone too, the choices are one column, or a sideways
   scroller like the grid; both are bigger than tonight.
2. Desktop cost: between 720 and ~1100 a clock day's afters lose a column
   to the inset (768: 4→3, 1024: 5→4); they wrap, nothing clips.
3. Electric Forest (archived) has two activity stacks under each day's
   clock; on a phone they now sit one above the other at x=54 instead of
   two across at x=14 (`after-ef-390-activities.png`). Portola and ACL have
   at most one such stack, so no shipped live fest pays this.
4. Skepta's "Crane Stage" stack lines up with the FIRST column (Pier
   Stage), not with the Crane Stage column. Putting a leftover under its own
   stage's column is a different, bigger idea; not done.

### Item 2 — the notes button beside search (commit decd632)

**Shared or not.** `.notes-chip` is only the toolbar's button (`index.html:209`)
and its replica in `gallery.html:178`. The zoom's notes chip is a different
component (`.chip-notes` / `.f-chip`), so it is untouched.

**What changed.** `assets/v3.css:295-307` — the chip keeps its outline,
colour, type, padding and the `--r-bubble` corner (8 8 8 2); a new
`.toolbar .notes-chip { align-self: stretch }` takes the field's height on
their shared line. `assets/v3.css` coarse-pointer block — `.notes-chip` left
the three borrowed-space lists (min-height 0, position relative, the ::after
hit area), so on a phone it wears the 44px floor as REAL height, exactly the
`.search-pill`'s `min-height: 44px`. That is the floor rule's own default
("REAL HEIGHT is the default... borrowed space is the exception for
controls where 44px would wreck the design"); it no longer would.

**Checked.** Measured in Chromium: phone 390 (touch, six-person crew)
field 44 / notes 44, same top (was 44 / 26); desktop 1280 field 33 /
notes 33 (was 33 / 26). Shots: `v90-shots/before6-portola-2026-390-top.png`
→ `after6-portola-2026-390-top.png`, `before-1280-toolbar-crop.png` →
`after-1280-toolbar-crop.png`. New browser contract
`tests/browser/shell-contract.test.mjs:359` pins height + top + shape at
both widths; the whole file is green (7/7).

**Notes.**
1. With a two-person crew on a phone the notes button wraps onto its own
   line under the field (it did before too); it is 44px there as well.
2. Pre-existing, not touched: when the toolbar wraps on a phone, the thin
   divider between the chips and the field starts the second line, a stray
   tick left of the field (visible in the six-person shots). Tiny; flagging
   rather than widening this item.
