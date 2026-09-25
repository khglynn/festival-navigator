# City seasons: build plan (draft, 2026-09-25)

**Status:** a plan for Kevin to read, not started. Nothing ships before Oct 11
(after ACL), and production promotion is Kevin's call. Built from his notes on
the direction page (`KEVIN-NOTES-ROUND1.md`) and the sources study
(`STUDY.md`). Where this plan and his words disagree, his words win.

## What we're building, in one screen

1. **Austin in the fest list.** One rolling Austin calendar you open like a
   fest. Month tabs (the current month first). Each month is the lineup view
   you already know: a responsive set of cards, one per artist, sorted by
   date and time, weekend dividers at most. The location, the date, the
   support acts and "Tix @ Ticketmaster · Info @ Do512" live in the zoom.
2. **A YOURS tab** ahead of the months, only for people who connected Spotify:
   Austin dates by artists in their Spotify likes and follows, or picked in any
   past fest.
3. **A morning Slack message** in Kevin's existing channel when one of his
   artists is announced in Austin, with the on-sale time and an add-to-calendar
   link.
4. **A feed that checks itself.** A daily read of Do512 and JamBase (plus
   Ticketmaster's API for on-sale times), a health record per source, and a
   daily spot-check against two venue calendars, with a Slack note when a
   source drops.

## Decisions already made (with who made them)

| Decision | Source |
|---|---|
| Month tabs; reuse the app's components | Kevin, kickoff |
| One card per artist, like the fest wall; an artist's two Austin nights share one pick | Kevin, note 5 |
| The lineup layout inside a month, not night rooms or venue stacks | Kevin, note 5 |
| "Location", not "room", everywhere a person reads it ("15 of 21 locations") | Kevin, note 9 |
| "Tix @ [seller]" and "Info @ [site]" | Kevin, note 7 (shipped for the fests in v88) |
| Slack, in an existing channel; add-to-calendar on the alert | Kevin, notes 6 and 10 |
| No emails to sources; free API keys only | Kevin, notes 2 and 4 |
| YOURS only for people with Spotify connected | Kevin, 2026-09-25 |
| Do512 base, JamBase second, Ticketmaster for timing | `STUDY.md` |

## Phases

Each phase ends with tests green, a real-browser walk, and Kevin's look.

### Phase 1 · The feed (no UI)

- **Where it runs:** a Vercel cron (daily, 9 AM CT) calling `api/season-refresh`,
  writing to the same Neon project. No new service.
- **Reads:** Do512's JSON for each covered location (`/venues/<slug>.json`,
  paged); JamBase's API for the Austin metro, six months out, under a hard cap
  of 600 calls a month (the free tier is 1,000, then 5¢ a call);
  Ticketmaster's Discovery API for presale and on-sale times at the rooms it
  sells.
- **Tables:** `season_shows` (one row per show: date, start time, location,
  headliner, support acts, page, tickets, on-sale, status),
  `season_sources` (which source said what, with its own id, first and last
  seen), `season_artists` (the canonical artist name that picks key on, plus
  every spelling seen), `season_runs` (each read: counts, changes, errors).
- **Identity:** picks key on the canonical artist name, and a canonical name
  never changes once anyone has picked it (the fests' freeze, applied to a
  feed). A new spelling ("Muna" for "MUNA") becomes an alias, never a rename.
  Shows are matched across sources by location, date and start time, so an
  early and a late show stay two. A show that drops out of one source is
  "unverified", not cancelled; cancelled needs a source saying so.
- **Health:** each run records per-source counts and changes; a run that sees
  a source's count fall by a third, or fail to parse, posts to Slack. Once a
  day the job re-reads two venue calendars and grades the feed against them
  with the study's scorer; recall falling at a venue is the earliest sign a
  source broke quietly.
- **Done when:** a week of daily runs lands, `season_runs` shows it, and the
  scorer run against the stored feed matches the study (about 93%).

### Phase 2 · The season view

- **The file:** `api/season?city=austin` returns a festival-shaped document
  (one dated section per month), built from `season_shows`, served
  network-first like the fest files.
- **The layout:** each month tab renders the lineup view (the same card, the
  same `--col-w` column), sorted by date and time. The zoom carries the date,
  the location, the support acts and the links row from v88.
- **YOURS:** a tab ahead of the months, shown only when the person has
  connected Spotify and something matches. It arrives the way the NOW tab
  does.
- **Locations filter:** the show menu lists the covered locations with a
  count each, "15 of 21 locations", and names the ones we don't cover yet.
- **Crew doc:** picks live under `festivals.austin` like any fest. A rolling
  calendar grows forever, so picks on artists whose last Austin show was more
  than six months ago move to an archive key (the crew doc is capped at
  256 KiB).
- **Done when:** Kevin opens Austin on his phone, picks a show in March, and
  a friend in his crew sees it.

### Phase 3 · The alert

- **Taste list:** Spotify liked-song artists and followed artists (the app
  already reads both), plus every artist picked in any past fest, weighted.
  Stored on the person record, never in a crew doc.
- **Matching:** every name on a bill (support acts included) against the
  taste list, after each morning's read. One message per morning, all
  matches batched. A change that matters (new date, new location, cancelled,
  on-sale moved) sends a follow-up.
- **Slack:** the personal Trimm workspace's bot (`SLACK_BOT_TOKEN_PERSONAL`),
  posting in the channel Kevin names. Each match: the artist, the date, the
  location, the on-sale time, "Tix @ …", "Open in Festival Navigator", and
  "Add to calendar" (an `.ics` link served by the app).
- **Done when:** a real announcement for one of Kevin's artists lands in
  Slack the next morning.

## What Kevin still owes

1. **The two API keys.** Paste them in the thread (the pages he left open show
   them masked, and this session can only read the screen).
2. **Which Slack channel.** Name the existing channel the alerts should go to.

## Parked, and why

- **Bandsintown** would add coverage (it feeds Spotify), but its API needs a
  partnership request, and Kevin said no emails unless we must.
- **The schedule-drop watcher** for fests reuses Phase 1's engine (read,
  diff, alert); build it after Phase 1 rather than twice.
- **Other cities** reuse everything; each needs its own sources study first.
