# City seasons: working notes on the model (2026-09-24, draft)

Banked while the sources study runs, so the thinking survives. Nothing here
is decided; the direction page is where Kevin picks. Updated as data lands.

## 1. A city is one rolling calendar; a season is a view of it

The brief imagines a season as a festival-shaped file ("Austin winter and
spring"). The app keys picks by festival id, so a file boundary is also a pick
boundary. A show that moves from Feb 28 to Mar 2 would cross from one season
file to the next and leave its picks behind. So: one calendar per city
(`austin`), with month tabs. "Winter" and "Spring" become labels over month
ranges, or just the months themselves. Past months fall off the tabs the way
a finished fest does.

What this reuses: MODEL-V4's dated sections already render a tab whose
entries carry `date`, with one room head per date and venue groups under it
(ACL's Late nights). A month is that, with the tab labelled by the month.
What changes: the head for a month section should read `FRI OCT 17`, not
`FRI OCTOBER` (today the head is weekday + section label), and the tab strip
holds months, not a dozen dates.

## 2. Picks need a show key, not an artist key

Today `doc.festivals[fid].selections[artistName][person] = level`, and the
card's name is the key. Inside a fest that is right: "I want to see Fcukers"
covers their Zilker set and their late night. In a city it is wrong twice:

1. The same artist plays Austin twice in a season (two nights at Stubb's, or
   October and April). A pick means "I'm going Friday", not "I like them".
2. Sources re-spell names ("MUNA", "Muna", "MUNA: Gets So Hot Tour"), and a
   refreshing feed cannot live under the pick-key freeze.

So a season card needs a stable show id that is not its display name. Sketch:

- A `shows` table (Neon) mints an opaque id the first time a show is seen:
  `s_<base32>`. The card shows the headliner; the pick key is the id.
- A `show_sources` table ties the id to each source's own event id and every
  spelling seen (Ticketmaster event ids survive reschedules, which helps).
- Identity on refresh: same source event id → same show. Otherwise same venue,
  same date, headliner match → same show. Otherwise new.
- Cancelled: keep the id, set status (prior art: `artists[].cancelled`).
  Moved date or room: keep the id if the source id carries over; the card
  moves tabs and the pick moves with it.
- Two ids later found to be one show: an alias row, old → new, applied at
  read time (the same trick as legacy level mapping). Crew docs are never
  rewritten.

Open: does the card render one per show (headliner, support as a sub-line)
or one per artist as the fest wall does? Per show is my lean: a month at 17
venues is roughly 150 to 250 shows, and splitting support acts into their own
cards would double that.

What the Codex review (2026-09-24) added, and my answers:

- **Early and late shows** share a venue, a date and sometimes a headliner.
  Identity needs the start time (an hour apart means two shows) or the
  source's own id; venue + date + headliner alone merges them.
- **A reschedule can arrive with a new source id.** Then the matcher sees a
  new show and the old one vanishes. Treat "same venue, same headliner,
  new date, old one gone" as a candidate move, confirmed by a second source
  before the pick moves with it.
- **Missing is not cancelled.** A show that drops out of one source's feed
  becomes "unverified", not cancelled; cancelled needs a source saying so,
  or every source dropping it for a few days in a row.
- **Aliases need ordering.** An old-id must and a new-id clear can't be
  reconciled at read time without knowing which came last, and the crew
  doc keeps no per-pick timestamps. So a merge should run once, server-side,
  in one atomic UPDATE (the same shape as the v3 to v4 migrate op): copy
  each person's level from the old id to the new id where the new id has
  none, and record the alias so clients rewrite old to new before they
  write. Offline writes to an old id then land through the rewrite.
- **Taste matches artists, not shows.** Keep an artist identity (normalised
  name plus source artist ids) separate from the show id, so "MUNA" in the
  taste list matches every MUNA show, including one billed as support.
- **The crew doc is capped at 256 KiB** (`api/_lib/crew-shared.mjs`). A
  season's picks are sparse (one entry per show someone picked), but they
  accumulate forever in a rolling calendar. Picks on shows more than a few
  months past need an archive rule before this ships.

## 3. The alert and the view ask different questions

The alert asks "is one of my few hundred artists coming to Austin?" (a lookup
by artist). The view asks "what's on in March?" (a lookup by city). Sources
are built for one or the other; the study grades both.

Alert shapes worth putting side by side:

1. A Slack DM the day a match is found, with the on-sale time, because hot
   shows sell at on-sale, not at the show.
2. A weekly digest: your artists first, then what's new at your rooms.
3. An in-app "yours" tab ahead of the months, shown only when something
   matches, the same pattern as v87's NOW tab.

Taste list: Spotify liked-song artists and followed artists (the app
already reads both: scopes `user-library-read user-follow-read` in
`js/spotify.js`; top artists would need one more scope, `user-top-read`),
plus picks across every fest, weighted (a must counts more than a 1).
Stored on the person record, never in a crew doc. The server needs it to
alert while the app is closed.

Matching (from the sources study and Codex's review): read every name on a
bill, support acts and festival lineups included, across an Austin radius,
whatever the calendar's venue filter says. Add a short watchlist of Kevin's
top artists checked through the artists' own feeds, for shows outside the
covered venues and presales that open before a venue lists the show.
Dedupe alerts per show, retry delivery, and alert again on a change that
matters (date, venue, cancelled, on-sale moved).

## 4. The venues themselves are a source

Emo's calendar is a Ticketmaster widget carrying schema.org JSON-LD. If most
rooms publish structured data on a handful of platforms, reading the venues
directly is a real option: the most accurate by definition, per-venue health
checks are natural, and money goes wherever the venue sells. The cost is a
parser per platform, not per venue. The study's `calendarTech` column
answers how many platforms that is.

## 5. The eval is also the health check

The ground truth and `score.mjs` can run on a schedule: each day, re-read two
venue calendars and grade the feed against them. Recall falling at a venue is
the earliest sign a source broke quietly. That is "self-checking from day
one" without a second monitoring system.
