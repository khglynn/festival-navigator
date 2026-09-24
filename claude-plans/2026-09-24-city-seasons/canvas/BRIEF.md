# Brief: the city-seasons direction canvas (2026-09-24)

You're building the design canvas Kevin will use to pick how Austin's "city
season" and its alert should feel. Read this whole file first, then the
files it points at. You own the canvas build; the lead session (me) owns the
direction choices below and will review your work before Kevin sees it.
Where you think a direction is wrong or weaker than it could be, say so in
your notes and build the better version beside it. Don't quietly swap it.

## Why this exists

Kevin missed MUNA at Moody Amphitheater on Sat Sep 19, 2026. The show was
announced May 8, went on sale May 14, and never sold out: he had 134 days of
notice, and no surface he uses told him in a way he noticed. So the project
has two halves designed together: a **season view** (browse Austin's shows by
month, pick them, tap through to buy) and an **alert** (tell Kevin when an
artist he loves is announced in Austin). The view is useless if you don't
open it; the alert is what makes sure you never miss one.

Kevin's own words, 2026-09-24: "see and save shows with links to buy that
leverage what we've built here… filters for what venues we're covering will
be a nice way to show what we have or don't… sorting by month only not venue
is smart… let's not break relationships and build some special snowflake. We
should stay in and even strengthen the component consistency across event or
season views. It can generally be like [the fest views] and even just with
some extra considerations layered in."

What Kevin said is agreed: month tabs, reusing the app's components, and
designing the alert and the view together.

## The exemplar and the rig

`claude-plans/2026-09-23-rating-canvas/` is the canvas Kevin liked most
recently. It bundles the production modules (esbuild, read-only against the
repo; esbuild lives at `~/DevKev/personal/ynai/node_modules/esbuild`, pass it
as `ESBUILD=`) into ONE self-contained HTML file that renders the real wall,
cards, aura, meter and zoom in the browser, with phone (390px) and desktop
frames on one page and media queries rewritten into frame scopes. Read its
`NOTES.md`, `build.mjs`, `entry.mjs`, `runtime.js`, `body.html` and
`canvas.css`. Fork it into this folder (`claude-plans/2026-09-24-city-seasons/canvas/`)
rather than starting over, and keep its discipline: every card, head, stack
and zoom is production code; anything new is layered on through the same
kind of hooks or DOM additions using the app's own tokens and classes.

Memories that bind this work (read them in
`~/.claude/projects/-Users-kevinhalladay-glynn-DevKev-personal-festival-navigator/memory/`):
`design-feel-over-completeness.md` (a canvas that covers every ask still
fails if new surfaces stack boxes and pills; "no elegance" was the verdict
once), `design-canvas-fidelity-rig.md`, `motion-is-designed-not-patched.md`.
And CLAUDE.md's "How this app moves" and the festival-accent rule (the fest
accent appears in exactly four places).

## The data

`claude-plans/2026-09-24-city-seasons/data/season-austin.json` is real:
425 shows at 15 Austin venues, read off each venue's own calendar on
2026-09-24, shaped as a festival file with one dated section per month
(`day: "October"`, `date`, `venue`, `doors`, `billedAs`, `tickets`,
`source`). Rebuild it with `node claude-plans/2026-09-24-city-seasons/build-season.mjs`.
Month counts: Sep 55 (the last week), Oct 178, Nov 100, Dec 59, Jan 10,
Feb 6, Mar 8, Apr 6, May 3. The thin spring is real, not a bug: venues
announce two to four months out, so in September the spring is nearly
empty. That fact belongs in the design (it is why the alert matters), not
hidden.

Today's production code already renders a dated section as its own tab
with one room head per date (ACL's Late nights: `TUE LATE NIGHTS  Sep 29`)
and venue stacks under it (`js/v3/events.js` `eventModelOf`,
`claude-plans/2026-09-16-wall-v4/MODEL-V4.md` §2 and §3c). So feeding the
season file straight in is the honest baseline: **artboard 0 is "what the
app draws today with Austin in it"**, unmodified. Show it first.

## The shared grammar (all three directions)

1. **One Austin calendar**, entered like a fest (it sits in the fest
   switcher). Month tabs: only months with shows; the current month first.
2. **A night is a room.** One head per date, reading like the fest heads do
   (`FRI OCT 16`, not `FRI OCTOBER`). Under it, the existing venue stacks,
   in doors order. A card is a show: the headliner is the name; support acts
   live in the zoom (from `billedAs`).
3. **The coverage filter.** Kevin wants the venue filter to show "what we
   have or don't". Design it inside the app's existing filter language: the
   covered rooms as toggles with a show count, and the rooms we don't cover
   yet named plainly (for the canvas: Empire Control Room, Hole in the Wall,
   Radio/East, Cheer Up Charlies, Elysium, Paramount Theatre).
4. **Buying.** The zoom carries the buy link as a fact line (`Tickets ·
   Ticketmaster`, `Tickets · Etix`, `Door only`), from `tickets`.
5. **Taste.** The app already shows Spotify affinity in the zoom ("12 liked
   songs · following", `card-facts.js`). "Yours" in the season means an
   artist with affinity, or one you picked in any past fest. Seed a
   believable affinity map for Kevin from the season's real names (indie,
   pop, electronic leaning, e.g. Steve Lacy, Bonobo, Jungle, Sylvan Esso,
   Bob Moses, Slow Magic, The Aces, Modest Mouse, Gorillaz, SOMBR, Tyla) and
   say on the canvas that it is seeded.

## The three directions (what the season opens on, and how the alert reaches Kevin)

These differ on one axis each, on purpose: the door into the season.

- **A · The month.** Browse-first. Opens on the current month, scrolled to
  tonight's room (the same day-of open the fest uses). Alert: a Slack DM per
  new match, the moment it's found. In the app, a newly announced show
  wears a small "new" whisper for a week.
- **B · Yours.** Alert-first. A `YOURS` tab sits before the months and exists
  only when something matches (the same "shown only when true" pattern as
  v87's NOW tab, `claude-plans/2026-09-24-now-jump-build.md` if present on
  main, else read the NOW bullet in NOW.md): every Austin date by an artist
  you love, soonest first, each in its night room, with the on-sale time as a
  whisper when it's in the future. Alert: a weekly Slack digest, plus an
  immediate DM only when an on-sale is within 48 hours.
- **C · This week.** Going-out-first. A `THIS WEEK` tab (the next seven
  nights) sits first; months follow. Alert: a reminder the day before a show
  you picked, and on-sale reminders for yours.

For each direction: a phone frame and a desktop frame from production code,
with its extra layer applied, plus the alert itself drawn as it would land
(a Slack message: use Slack's real message anatomy, the app's name, the
card's facts, one "Open in Festival Navigator" link; no fake Slack chrome
beyond what makes it legible). Put the three side by side under one
explanation each, in plain words, and a one-line note on what each costs to
build.

## Feel

Directions are judged on feel first. No boxes in boxes, no rows of pills
under rows of chips, nothing that pops in from nowhere. The YOURS and THIS
WEEK tabs arrive the way the NOW tab does. Edge cases are design: the
96-character show name (Don Was & the Pan-Detroit Ensemble…), a night with
nine shows, a month with three, a cancelled show, a show with no doors time,
a door-only show with no buy link. Show them. Motion should be live in the
frame (the rating canvas has a slow-motion toggle; keep it).

## Constraints

- **Memory.** This Mac kernel-panicked from memory today (16 GB, heavy
  swap). One headless browser at a time, closed as soon as you've looked;
  never leave a dev server or watcher running. Do not use Kevin's own Chrome
  (the claude-in-chrome tools) at all.
- **The repo is public.** No crew tokens anywhere. The canvas uses a fake,
  in-memory crew like the rating canvas does.
- **Never write to the repo's own app files.** The bundle reads them; your
  files live only in `claude-plans/2026-09-24-city-seasons/canvas/`. Commit
  your folder on the current branch (`seasons/kickoff`) as you go, with
  scope-prefixed messages (`canvas: …`), never anything outside it. Do not
  push; the lead session pushes.
- **Don't publish** the canvas as an artifact; the lead session will, after
  review.
- **Bank as you go.** Keep `canvas/NOTES.md` current (what's built, what's
  left, what you'd change, open questions for Kevin), and commit WIP at each
  working step. If you die mid-build, the next session should be able to pick
  up from NOTES.md and the last commit.

## Done means

1. `canvas/build.mjs` builds `canvas/canvas.html`, one self-contained file,
   opening on phone and laptop.
2. Artboard 0 (today's code, unmodified, with Austin in it), then A, B, C,
   each phone + desktop + its alert, then the coverage filter, then the edge
   cases.
3. You looked at every frame in a real (headless) browser at 390px and
   1280px, fixed what looked wrong, and wrote in NOTES.md what you checked.
4. NOTES.md ends with your honest read: which direction you'd pick and why,
   what is weakest in each, and anything in the shared grammar you'd change.
