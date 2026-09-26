# Where Folsom-weekend gay events get announced

Built 2026-09-25 while merging four research sweeps into `PICK-LIST.md`. This is a seed for a future
watcher/scraper, not a finished tool — one line each on what it's good for and how it behaved this pass.

## Best single sources (checked live, updated nightly/frequently)

- **GayWhere — https://gaywhere.app/folsom** — the single best aggregator found this pass: a
  purpose-built "every Folsom party" page, live-pulled, with time/venue/price/ticket-link per event and a
  same-day view (Fri/Sat/Sun/warm-ups). It's the marketing page for the GayWhere iPhone/Android app
  (`gaywhere.app`), which appears to cover SF and LA generally, not just Folsom.
- **TheGayCalendar — https://thegaycalendar.com/f/folsome-street-fair** — community-submitted, gives
  exact ISO start/end timestamps per event (most other sources only print a start), plus a "heat" score.
  Good second opinion when GayWhere and a promoter's own page disagree on a time. Occasional data-entry
  mismatches (one listing's description text didn't match its own title this pass).
- **Circuit Party Info — https://www.circuitpartyinfo.com/folsom-san-francisco/** — best for the
  marquee circuit-party brands specifically (Pervert, Real Bad, Aftershock, Hot Tea, Magnitude): narrative
  write-ups, promo codes, and a venue map. Thinner on the smaller bar-night side of the weekend.
- **Eventbrite's own event pages** — the single most reliable per-event source once you have the link:
  every one scraped this pass carried exact `event:start_time` / `event:end_time` metadata, which is how
  most of the times in `pick-list.json` were pinned down (not just what the promoter's marketing copy
  says). Eventbrite's own "Folsom Street Events" collection page
  (`https://www.eventbrite.com/d/ca--san-francisco/folsom-street-events/`) auto-refreshes.

## The two official channels

- **folsomstreet.org** — the nonprofit's own site. Only carries its own three productions: the fair
  itself (`/folsom-street-fair`), Deviants Adult Arcade (`/deviants`), and — per Magnitude's own Eventbrite
  page — a benefit relationship with Magnitude, though Magnitude's own page lives on Eventbrite, not here.
  `/fs-events-calendar` was showing stale prior-year dates as of this research; don't trust it for current
  listings without cross-checking the date.
- **Venue calendars, read directly** — the most authoritative source for anything happening at a fixed
  venue, and worth reading before any aggregator when one venue matters: `sf-eagle.com/events/`,
  `dnalounge.com/calendar/`, `sfcatclub.com`, `studsf.com` (JS-rendered — needs a browser-driven read, a
  plain scrape returns an empty shell), `realbad.org`, `kymartinezevents.com` (the one page for
  Aftershock/Rated X/Nocturnal — it lists all three with three different times, so read the whole page).

## Promoter sites and ticket platforms worth knowing

- **Resident Advisor (ra.co)** — best for the underground/techno side (MÜLL and its neighbors). Its own
  promoter pages show a promoter's full event history, which is how this pass confirmed MÜLL's venue is
  genuinely always "TBA" (not just this year).
- **Forbidden Tickets (forbiddentickets.com)** — Twisted Windows' and Dual Demons' ticketing platform;
  their event pages print exact schedules and clearly state sold-out/postponed status (caught one
  postponed event, Rubber Kitty's fashion show, this way).
- **Instagram** — fastest for day-of changes (address drops, lineup swaps) but not independently
  scrapable for verification; several raw leads that traced only to an Instagram post were dropped this
  pass for lack of a checkable page, even though the events are probably real.

## For a future watcher

If this becomes a recurring scrape: GayWhere + TheGayCalendar together would likely catch ~90% of what
showed up here, with Eventbrite's own collection page catching most of the rest and giving the most
precise times. The gaps this pass hit were: JS-rendered venue calendars (Stud), age-gated sites with no
visible listings (HorseMarket), and Instagram-only announcements — none of which a plain HTTP scrape
handles, so a browser-driven fetch (Playwright) would close most of the remaining gap.
