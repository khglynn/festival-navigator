# Austin sources study (2026-09-24)

**What this is.** The first deliverable of the city-seasons project: which
sources can tell us about Austin shows, graded against what the venues
themselves list, plus where Spotify's concert listings come from, what
referral programs pay and to whom, and what each source's terms allow.
Everything was read on Thu 2026-09-24 and is a single snapshot. The data,
the grading script and every agent's notes are in this folder, so the table
can be re-run later as an eval.

## The answer

1. **Do512 is the base.** It had 84% of the 467 shows at our 16 venues, was
   wrong twice, carries a buy link on 96% of shows and an on-sale time where
   one exists, and serves clean JSON (`do512.com/venues/<slug>.json`). It is
   an independent Austin company (DoStuff Media), and its buy links carry its
   own referral codes, so friends buying through them pays Do512.
2. **JamBase is the second source.** 73% alone, but it fills Do512's weak
   rooms (Brushy Street, Antone's, Mohawk), and the two together reach 93%,
   the same 93% for Dec–May. It has a real API with a free tier: 1,000 calls
   a month, six months ahead, non-commercial use. Also independent (since
   1998).
3. **Ticketmaster's Discovery API is the timing source, not the coverage
   source.** Ticketmaster sells about 41% of these shows (Moody Center, Moody
   Amphitheater, Stubb's, Emo's, Scoot Inn, Antone's, Germania) and none at
   ACL Live (AXS), Mohawk (Etix), Concourse or Brushy (See Tickets/Eventim).
   Its free API is the structured place to read presale and on-sale times,
   which is what an alert has to beat. Not yet measured; it needs a key.
4. **The alert should read the city feed, not artist pages.** Every source
   that had MUNA had it on announcement day. So the alert is the season feed
   matched against Kevin's taste list, run daily. Artist pages proved the
   wrong tool: Songkick's and Bandsintown's pages only show an artist's next
   eight or so dates, so a show four months out is usually off the page even
   when the data exists.
5. **MUNA was an alert problem, not a data problem.** Announced Fri May 8,
   presales May 12–13 (one was a Spotify presale), general sale May 14,
   never sold out, 134 days of notice. Ticketmaster, JamBase and Do512 all
   listed it that first day (`research/muna-timeline.md`).
6. **Spotify shows 46 ticketing companies' feeds plus Bandsintown, and no
   Songkick** (Spotify's own help page, checked by hand today). Bandsintown
   is the broad one behind Spotify, YouTube, Apple Music, Shazam, Google and
   Amazon Music, and it graded well here (79%, the best at Dec–May). But its
   API is for one artist's own site ("Each API Key is linked to a single
   artist"), and anything else needs a partnership. Scraping its pages means
   going through a Cloudflare wall. So it is out unless Bandsintown agrees.
7. **Referral money is pennies at our size.** A few friends buying a few
   dozen tickets a year earns single dollars under any program (Ticketmaster
   pays about 1% through Impact, per third-party reports, and nothing on
   presales). What matters is whose link we show: Do512's and JamBase's
   links already pay them. No listing source pays artists per ticket. The
   direct way to back a small company is to pay it (Showlist Austin runs on
   Patreon) or to ask Do512 for permission, which is the courteous move
   anyway.

## The grading table

Truth: every show on each venue's own calendar from Sep 24, 2026 through
May 31, 2027, read by four agents, plus 42 shows those first reads missed,
found by adjudicating every listing the reads did not confirm (below).
Comedy, sports and other non-concerts are left out. "Near" is through Nov
23; "far" is Nov 24 to May 31, the winter and spring this project is for.

| Source | Listed | All | Near | Far | Big rooms | Clubs | Electronic | Precision | Wrong | Noise | Buy link |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Do512 | 417 | 84% | 88% | 68% | 96% | 83% | 68% | 100% | 2 | 6 | 96% |
| Bandsintown | 478 | 79% | 79% | 81% | 78% | 80% | 80% | 98% | 9 | 22 | redirect |
| JamBase | 360 | 73% | 73% | 75% | 72% | 75% | 71% | 99% | 3 | 0 | affiliate |
| Songkick | 378 | 70% | 73% | 62% | 78% | 59% | 83% | 98% | 8 | 5 | redirect |
| Showlist Austin | 345 | 59% | 63% | 44% | 63% | 76% | 17% | 85% | 50 | 0 | 100% |
| SeatGeek | 305 | 58% | 61% | 47% | 77% | 58% | 29% | 99% | 3 | 21 | resale |
| Austin Chronicle | 313 | 57% | 71% | 12% | 57% | 57% | 54% | 99% | 3 | 6 | 92% |
| Ticketmaster (website) | 213 | 39% | 49% | 5% | 53% | 38% | 22% | 100% | 1 | 8 | 100% |
| Edmtrain | 79 | 16% | 16% | 14% | 6% | 3% | 55% | 100% | 0 | 0 | affiliate |
| 19hz | 58 | 10% | 12% | 5% | 4% | 3% | 37% | 91% | 5 | 0 | 100% |
| Resident Advisor | — | — | — | — | — | — | — | — | — | — | — |

How to read it:

- **Precision** counts a listing right if it matches the truth or was judged
  real on adjudication, and wrong if it was stale, on the wrong date or at the
  wrong venue, or could not be found anywhere. **Noise** is a duplicate (a
  support act listed as its own show) or a non-concert (Moody Center's
  Longhorns games).
- **Best combinations:** Bandsintown + Do512 94%; Do512 + JamBase 93% (93%
  far); Do512 + JamBase + Showlist 97%.
- **Ticketmaster's row is its website**, which shows 20 events a venue. The
  API has no such cap and would do far better at its own rooms.
- **Resident Advisor was not read.** Its robots.txt names Claude's crawlers
  among the AI agents it refuses. The reader honoured that, and so should
  any pipeline.
- **Showlist Austin dates 40 shows a day late**, all at Ticketmaster rooms
  (Emo's, Stubb's, Scoot Inn). Its own embedded data says Jane Remover plays
  Stubb's Sep 30; the venue, Ticketmaster and six other sources say Sep 29.
  It also only looks about 90 days ahead.

Per venue, Do512 and JamBase cover each other's gaps (hits / truth):

| Venue | Do512 | JamBase | Bandsintown |
|---|---|---|---|
| ACL Live | 57/60 | 33/60 | 36/60 |
| 3TEN | 31/37 | 28/37 | 28/37 |
| Antone's | 39/56 | 43/56 | 49/56 |
| Brushy Street (was the Parish) | 28/46 | 39/46 | 39/46 |
| Concourse Project | 30/33 | 30/33 | 29/33 |
| Continental Club | 14/15 | 0/15 | 2/15 |
| Emo's | 38/39 | 36/39 | 32/39 |
| Germania | 4/4 | 4/4 | 4/4 |
| Kingdom | 11/18 | 3/18 | 12/18 |
| Mohawk | 38/50 | 35/50 | 42/50 |
| Moody Amphitheater | 13/14 | 12/14 | 12/14 |
| Moody Center | 33/35 | 28/35 | 32/35 |
| Scoot Inn | 26/27 | 27/27 | 26/27 |
| Stubb's | 27/27 | 24/27 | 25/27 |
| Vulcan Gas Co. | 1/6 | 1/6 | 2/6 |

## What adjudication found

230 listings from the sources were not on the first calendar reads. Three
agents re-read every venue and checked each one (`data/adjudication/`):

| Verdict | Count | Meaning |
|---|---|---|
| The venue lists it; the first read missed it | 110 | Antone's paginates past its month widget; Moody Center's page renders 12 of 35 shows (its WordPress API has all of them); Concourse's list stops at "load more" and missed Seismic entirely |
| Real, ticketed, not on the venue's own page | 25 | Third-party promoters at Moody Amphitheater and Stubb's; a third They Might Be Giants night at Emo's |
| Not a concert | 33 | Mostly Longhorns games |
| Duplicate | 30 | Support acts listed as separate shows |
| Wrong date | 10 | Showlist, 19hz |
| Stale (cancelled, moved) | 8 | Songkick 4; Jane Remover moved from Emo's to Stubb's |
| Wrong venue | 4 | ACL Live vs 3TEN share one website |
| No trace anywhere | 10 | Six on Bandsintown |

The lesson is about the venues themselves: reading 15 venue calendars
directly took twelve different platforms (Ticketmaster widgets, Prekindle,
WordPress, Webflow, Squarespace, See Tickets embeds) and still missed about
one show in five on the first pass. So reading the venues directly makes a
poor feed but a good spot-check. A daily job that re-reads two venue
calendars and grades the feed against them is the health check (THINKING.md
§5).

## Freshness

- **MUNA:** Ticketmaster, JamBase and Do512 listed it on announcement day;
  the venue calendar by May 16; Showlist not before late June (90-day
  window); the Chronicle the day before the show.
- **This week:** seven newly announced shows go on sale Fri Sep 25 at
  10 AM (Spoon's New Year's Eve at ACL Live, The Interrupters, Poi Dog
  Pondering and four more). Do512 7/7, JamBase 7/7, Songkick 7/7,
  Bandsintown 6/7, Showlist 3/7, SeatGeek 2/7, the Chronicle 1/7.
- So a daily refresh of Do512 + JamBase sees an announcement within a day,
  ahead of the presales (MUNA's first presale opened four days after the
  announcement).

## Where Spotify's concerts come from

Spotify's help page for artists (read 2026-09-24): "We automatically import
concerts from these ticketing sites", then 46 names including Ticketmaster,
AXS, DICE, Eventbrite, Etix, See Tickets, SeatGeek, Tixr, Resident Advisor
and Bandsintown, and "Note: We don't display events from Songkick"
(https://support.spotify.com/us/artists/article/concerts/). Songkick fed
Spotify from about 2011 until February 2024 (Music Business Worldwide,
2024-02-14). In a logged-out sample of Spotify's Austin page on Sep 24,
Ticketmaster supplied the "Popular" row and Bandsintown supplied 59 of 67
events in "All events". Spotify has no public concerts API, and its web page
runs on a private API we should not use. Full notes:
`research/spotify-provenance.md`.

## Access, terms and ownership

| Source | Access for us | Owner | Money when a friend buys |
|---|---|---|---|
| Do512 | Undocumented JSON on every page; robots.txt allows it; no terms page found (privacy policy only, updated Jan 14, 2026). Ask them. | DoStuff Media, independent, Austin | Do512's own referral codes on Ticketmaster, Etix and Eventbrite links |
| JamBase | Free API tier: 1,000 calls a month, 6 months ahead, non-commercial | Independent since 1998 (ownership not confirmed on their own page) | JamBase's Ticketmaster referral link |
| Ticketmaster | Free Discovery API, instant key, 5,000 calls a day | Live Nation | Ticketmaster's program via Impact, about 1%, not on presales; pays the publisher |
| Bandsintown | API is per-artist; anything else needs a partnership | Bandsintown Group | Pays about $2 per Bandsintown Plus signup, not per ticket |
| Songkick | API closed to new applicants | Warner Music Group | None found |
| SeatGeek | Developer access now behind a request form | Independent | Partner program, resale-heavy |
| Showlist Austin | No API; one page with embedded data | Independent, runs on Patreon | None (links go straight to venues) |
| Resident Advisor | robots.txt refuses AI agents | Independent | Not researched |
| Edmtrain | API with terms that forbid combining it with other sources | Two-person independent | Affiliate |

Details and citations: `research/ticketing-apis.md`, `research/aggregators.md`.

## What this study can't tell us yet

1. **Ticketmaster's API coverage.** Needs a free key (Kevin's account).
2. **Freshness over time.** One snapshot plus MUNA plus this week's seven.
   Re-running the source reads in a week would measure first-seen per source.
3. **Spring.** Venues announce two to four months out, so Dec–May holds 111
   shows today and will grow. The far column is the right one to watch.
4. **Venues we don't cover.** Empire Control Room's site is down (DNS) and
   Summit has closed. Hole in the Wall, Radio/East, Cheer Up Charlies,
   Elysium and the Paramount are not in the study.
5. **Taste.** The study grades coverage, not whether the shows are ones
   Kevin wants. That is the alert's job.

## Re-running it

```
node claude-plans/2026-09-24-city-seasons/score.mjs          # graded with adjudication
node claude-plans/2026-09-24-city-seasons/score.mjs --raw    # against the first reads only
node claude-plans/2026-09-24-city-seasons/score.mjs --unmatched do512   # what one source had that the truth didn't
```

Inputs: `data/ground-truth/` (venue calendars), `data/sources/` (each
source's listings), `data/unconfirmed-clusters.json` and `data/adjudication/`
(the 230 disputed listings and their verdicts). Output: `data/scores.json`.
