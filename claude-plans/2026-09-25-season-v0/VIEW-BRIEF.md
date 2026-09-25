# Brief: the Austin season view (2026-09-25)

You're building how the app draws a city season, so Kevin can show it off
this week from a preview link. Read this, then `PLAN.md` beside it (the data
contract and the safety rules), then CLAUDE.md's laws. The city-seasons
session owns the feed and the data file; you own the view. Where you think
something here is wrong, say so in your notes and build the better version
beside it.

## Why

Kevin missed MUNA in Austin: a show on sale for four months that nothing put
in front of him. A season is Austin's upcoming shows inside the app he
already uses for festivals: browse a month, pick what you'd go to, see who in
your crew picked it, tap through to tickets.

## What Kevin decided (his words from the direction page, 2026-09-24)

- "per artist … a simple set of cards, sorted by date and time but just a
  responsive set of cards with details like location on hover. … I don't
  think splitting by name and location in the grid is necessary. if anything
  just do by weekend." So each month is the lineup view: cards in date and
  time order, no room per night, no venue stacks. Weekend dividers are
  allowed if they earn their place.
- Month tabs (agreed at kickoff). Past months drop off; the current month
  comes first; opening the season lands on today.
- "yours tab is good but just plan to not show if they don't have spotify":
  a YOURS tab ahead of the months, only for people who connected Spotify,
  listing the season's shows by artists with Spotify affinity or picked in
  any past fest, soonest first. It arrives the way v87's NOW tab does.
- "Let's call this location … in pretty much every context": user-facing
  words say location, not room.
- The zoom already carries "Tix @ AXS · Info @ Do512" (v88's links row, from
  each entry's `page` and `tickets`). Keep it.

## The data

`data/festivals/austin.json`: `kind: "season"`, no grid (`days: {}`), every
show an `artists[]` entry with `day` = its month ("December"), `date`,
`venue`, and optionally `time`, `doors`, `with` (support acts), `page`,
`tickets`, `onSale`, `billedAs`. 425 shows today (seed from the study); the
live feed will replace it with more and fresher shows, so nothing in the view
may depend on the seed's specifics. One entry per show; the pick key is the
name, so an artist's two nights are two cards sharing one pick.

Today's code renders these as dated sections: one tab per section with a room
head per date and venue stacks (`js/v3/events.js` `eventModelOf`,
`js/v3/wall.js` renderExtra and friends, MODEL-V4 §2/§3c). Your change: when
the fest is `kind: "season"`, each month tab renders as a lineup grid sorted
by date and time instead. Festivals must render exactly as they do now; the
browser contract suite (`npm run test:browser`) is how you prove it.

## The bar

CLAUDE.md "How this app moves" and the memories
`design-feel-over-completeness.md` and `motion-is-designed-not-patched.md`
(in `~/.claude/projects/-Users-kevinhalladay-glynn-DevKev-personal-festival-navigator/memory/`).
The same card, the same `--col-w` column, the same zoom. Edge cases are
design: a month with three shows, a night with nine, a 96-character name, a
cancelled show, a show with no time. The canvas from 2026-09-24
(`claude-plans/2026-09-24-city-seasons/canvas/` on branch `seasons/kickoff`)
has prior art for the date on a card and the YOURS arrival; reuse what fits.

## Constraints

- Work in your own worktree on branch `seasons/view`, cut from
  `seasons/austin-v0` (9c59ccb). Commit as you go ("season view: …"). You may
  push `seasons/view` so a preview builds. Never merge to main, never
  promote.
- The preview shares the production database: test with a throwaway crew
  whose name starts `zz-season-`, list its token only in your final report,
  and delete nothing you didn't create.
- This Mac is short on memory and about ten sessions share this login's
  budget: one headless browser at a time, closed as soon as you've looked;
  no dev server or watcher left running; don't fan out agents.
- jsdom boot tests see real time; pin a clock in any new one (memory
  `tests-that-pass-by-daylight.md`).
- After any cached-asset change, `node scripts/sw-stamp.mjs --keep` (the
  branch is already v89).
- Keep `claude-plans/2026-09-25-season-v0/VIEW-NOTES.md` current as you go:
  what's built, what you checked and at which widths, what's weakest, what
  you'd ask Kevin.

## Done means

1. A season month renders as a date-sorted lineup grid at 390 and 1280, with
   the date on each card, the location and links in the zoom, past months
   gone, today's month first.
2. YOURS appears only with Spotify affinity and something matching, and
   arrives like NOW.
3. `npm test` and `npm run test:browser` green, festivals unchanged, new tests
   for the season layout.
4. A walk in a real headless browser with real input at both widths, noted in
   VIEW-NOTES.md, and a preview URL for Kevin.
