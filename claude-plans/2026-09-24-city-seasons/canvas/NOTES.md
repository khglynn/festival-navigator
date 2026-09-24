# City seasons canvas — working notes (2026-09-24)

Brief: `BRIEF.md` beside this file. Exemplar rig forked from
`claude-plans/2026-09-23-rating-canvas/` (build.mjs, entry.mjs, runtime.js,
body.html, canvas.css).

Build: `ESBUILD=~/DevKev/personal/ynai/node_modules/esbuild node build.mjs`
(from this folder, or give the full path) -> `canvas.html`, one file.

## Status (bank — update as steps land)

- [ ] 1. Rig forked, builds, artboard 0 renders (today's code, Austin fed in)
- [ ] 2. Shared grammar layer: month tabs, `FRI OCT 16` heads, zoom lines
      (support acts, tickets), taste seed
- [ ] 3. A · The month (phone + desktop + Slack DM)
- [ ] 4. B · Yours (tab arrives like NOW, on-sale whisper, digest + 48h DM)
- [ ] 5. C · This week (week tab, day-before + on-sale reminders)
- [ ] 6. Coverage filter (show menu: covered rooms with counts, uncovered named)
- [ ] 7. Edge cases (96-char name, nine-show night, three-show month,
      cancelled, no doors, door-only)
- [ ] 8. Browser checks at 390 and 1280, fixes, honest read

## Plan (written before building)

Frames are whole app screens, not wall slices: header, toolbar, the day rail
(desktop) or dock (phone), and the wall, inside a frame that scrolls on its
own (390x780 phone, 1280x800 desktop scaled to fit). Tabs jump inside the
frame; a canvas-side scrollspy re-hosts production's geometry rule on the
frame's scroller (production's listens to the window).

- Artboard 0 is `renderWall` untouched, with the season file registered as a
  festival. Its tabs are `dayNavOf`'s. What it shows: dock tabs `SEPTE OCTOB`,
  heads `THU SEPTEMBER  Sep 24`, the show menu listing months.
- Directions compose the wall from the exported production pieces
  (`venueGroups`, the room-head DOM, `.day-block`), which is renderExtra's own
  recipe with one change: the head names the date (`FRI OCT 16`).
- Zoom additions come in through the grown-block hook: support acts under the
  name (from `billedAs`), and `Tickets · Ticketmaster` as a door after WHERE.
- Alerts are drawn for MUNA's real timeline (research/muna-timeline.md) as
  each direction would have delivered them, so each direction answers
  "would this have saved MUNA?"

## Seeds (say so on the canvas)

- Spotify affinity for Kevin, and a few past-fest picks (Portola, ACL).
- Announce and on-sale times: none of the sources carries them; seeded for
  a few shows. MUNA's are real.
- One cancellation (the file has none), only in the edge-case specimens.

## Log
- 2026-09-24: read the brief, the rating canvas rig, MODEL-V4 §1-3c/§6,
  events.js, wall.js (renderCard, venueGroups, roomHead, renderExtra,
  renderComposed, dayNavOf, scrollspy), card-facts.js (factsFor, grownBlock),
  app.js (day tabs, show menu, fold flow, person chips), the v87 NOW tab on
  `feat/now-jump` (arrival motion + CSS), the season data, ground truth.
