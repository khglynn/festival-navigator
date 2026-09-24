# Austin sources study (2026-09-24)

**What this is.** The first deliverable of the city-seasons project: which
sources can tell us about Austin shows, graded against what the venues
themselves list, plus where Spotify's concert listings come from, what
referral programs pay and to whom, and what each source's terms allow.
Everything was read on Thu 2026-09-24 and is one snapshot. The data, the
grading script and every agent's notes are in this folder, so the table can
be re-run later as an eval. Codex reviewed a first draft adversarially the
same afternoon; its corrections are folded in (last section).

## The answer

1. **Do512 is the base.** It had 84% of the 468 shows at our 16 venues, was
   wrong twice, carries a buy link on 96% of shows and an on-sale time where
   one exists, and serves clean JSON (`do512.com/venues/<slug>.json`, paged).
   It is an independent Austin company (DoStuff Media), and its buy links
   carry its own referral codes (`SharedId=DoStuff`), so a friend buying
   through them pays Do512. Its weakness is further out: 68% of shows after
   Nov 23.
2. **A second source covers that weakness; JamBase is the leading
   candidate.** JamBase alone is 74% (76% after Nov 23), and it fills
   Do512's weak rooms (Brushy Street, Antone's). Together they reach 93%,
   and 93% after Nov 23. JamBase has a real API with a free tier (1,000
   calls a month, six months ahead, attribution, non-commercial), and has
   been independent since 1998. Two cautions: JamBase was graded through its
   website, not the API; and the free tier's six-month window would have cut
   the pair's far coverage from 103 to 101 of 111. Test the API before
   deciding.
3. **Ticketmaster's Discovery API is the third leg, for timing and its own
   rooms.** Ticketmaster sells roughly 41% of these shows (Moody Center,
   Moody Amphitheater, Stubb's, Emo's, Scoot Inn, Antone's, Germania) and
   none at ACL Live (AXS), Mohawk (Etix), Concourse or Brushy (See
   Tickets/Eventim). Its free API is the structured place to read presale
   and on-sale times. Not measured yet: it needs a key.
4. **The alert should match a city feed against a taste list, plus a small
   watchlist.** Matching the whole feed daily against Kevin's artists covers
   most of it. The feed match should read full lineups (support acts and
   festival bills, not only headliners) across an Austin radius, whatever
   the calendar's venue filter says. A short watchlist of his top artists,
   checked through the artists' own feeds, catches what the city feed can't:
   shows outside covered venues, and artist presales that open before a
   venue lists the show.
5. **MUNA was an alert problem, not a data problem.** Announced Fri May 8,
   presales May 12–13 (one was a Spotify presale), general sale May 14,
   never sold out: 134 days of notice. JamBase published it at 10:22 AM CT
   that day and Ticketmaster had it by evening; Do512's photo for the listing
   was uploaded at 12:21 PM, which strongly suggests the listing existed then
   (an inference, not proof). Showlist Austin only picked it up in its
   ~90-day window (by Sep 12) and the Chronicle the day before the show
   (`research/muna-timeline.md`).
6. **Spotify imports 46 ticketing and listing feeds, Bandsintown among them,
   and not Songkick** (Spotify's own help page, checked by hand today).
   Bandsintown is the broad one behind Spotify, YouTube, Apple Music, Shazam,
   Google and Amazon Music, and it graded well here (81%, 88% for Jan–May).
   But its API is for one artist's own site ("Each API Key is linked to a
   single artist unless authorized otherwise"), anything else needs a
   partnership, and its pages sit behind a Cloudflare challenge. So it is
   out unless Bandsintown agrees, and asking costs one email.
7. **Referral money is pennies at our size; whose link we show is the
   choice.** A few friends buying a few dozen tickets a year earns single
   dollars under any program (Ticketmaster pays about 1% through Impact per
   third-party reports, and nothing on presales). Do512's and JamBase's own
   links already pay them. We found no listing source that pays artists per
   ticket (Seated's artist revenue share is unverified). The direct way to
   back a small company is to pay it (Showlist Austin runs on Patreon) or to
   ask Do512 for a proper arrangement: robots.txt allowing a path is not
   permission to reuse the listings.

## The grading table

Truth: every show on each venue's own calendar from Sep 24, 2026 through
May 31, 2027, read by four agents, plus 42 shows those first reads missed,
found by adjudicating every listing the reads did not confirm (below).
Comedy, sports and other non-concerts are left out. "Near" is through Nov
23; "far" is Nov 24 to May 31; "Jan–May" is the spring itself, only 34
shows today, so read that column loosely.

| Source | Listed | All | Near | Far | Jan–May | Big rooms | Clubs | Electronic | Precision | Wrong | Noise | Buy link |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Do512 | 417 | 84% | 89% | 68% | 74% | 96% | 83% | 68% | 100% | 2 | 6 | 96% |
| Bandsintown | 478 | 81% | 80% | 82% | 88% | 80% | 81% | 81% | 98% | 8 (+6 unjudged) | 19 | redirect |
| JamBase | 360 | 74% | 73% | 76% | 85% | 73% | 76% | 71% | 99% | 3 | 0 | affiliate |
| Songkick | 378 | 71% | 73% | 64% | 74% | 79% | 59% | 83% | 97% | 11 (+3 unjudged) | 5 | redirect |
| Showlist Austin | 345 | 58% | 62% | 46% | 0% | 60% | 75% | 17% | 84% | 54 | 0 | 100% |
| SeatGeek | 305 | 58% | 61% | 47% | 50% | 77% | 59% | 29% | 99% | 4 | 20 | resale |
| Austin Chronicle | 312 | 57% | 71% | 12% | 9% | 57% | 57% | 54% | 99% | 3 (+7 unjudged) | 5 | 91% |
| Ticketmaster (website) | 213 | 39% | 50% | 5% | 3% | 53% | 38% | 22% | 98% | 3 (+7 unjudged) | 7 | 100% |
| Edmtrain | 79 | 16% | 16% | 14% | 15% | 6% | 3% | 55% | 100% | 0 | 0 | affiliate |
| 19hz | 58 | 10% | 12% | 5% | 3% | 4% | 3% | 37% | 91% | 5 | 0 | 100% |
| Resident Advisor | — | — | — | — | — | — | — | — | — | — | — | — |

How to read it:

- **Precision** counts a listing right if it matches the truth or was judged
  real on adjudication, and wrong if it was stale, on the wrong date, at the
  wrong venue, marked on when the venue says cancelled (or the reverse), or
  not found anywhere. **Noise** is a duplicate (a support act listed as its
  own show) or a non-concert (Moody Center's Longhorns games); it is not in
  the precision figure. "Unjudged" listings stopped matching after the
  matcher was tightened and were never adjudicated.
- **Best combinations:** Bandsintown + Do512 95%; Do512 + JamBase 93% (93%
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
| ACL Live | 57/60 | 34/60 | 37/60 |
| 3TEN | 31/37 | 29/37 | 29/37 |
| Antone's | 39/56 | 43/56 | 50/56 |
| Brushy Street (was the Parish) | 28/46 | 39/46 | 39/46 |
| Concourse Project | 30/33 | 30/33 | 30/33 |
| Continental Club | 14/15 | 0/15 | 2/15 |
| Emo's | 38/39 | 36/39 | 32/39 |
| Germania | 4/4 | 4/4 | 4/4 |
| Kingdom | 11/18 | 3/18 | 12/18 |
| Mohawk | 38/50 | 35/50 | 42/50 |
| Moody Amphitheater | 13/14 | 12/14 | 12/14 |
| Moody Center | 33/35 | 28/35 | 34/35 |
| Scoot Inn | 26/27 | 27/27 | 26/27 |
| Stubb's | 28/28 | 25/28 | 26/28 |
| Vulcan Gas Co. | 1/6 | 1/6 | 2/6 |

## What adjudication found

230 listings from the sources were not on the first calendar reads. Three
agents re-read every venue and checked each one (`data/adjudication/`):

| Verdict | Count | Meaning |
|---|---|---|
| The venue lists it; the first read missed it | 110 | Antone's paginates past its month widget; Moody Center's page renders 12 of 35 shows (its WordPress API has all of them); Concourse's list stops at "load more" and missed Seismic entirely. Many are support acts the venue bills under the headliner. |
| Real, ticketed, not on the venue's own page | 25 | Third-party promoters at Moody Amphitheater and Stubb's; a third They Might Be Giants night at Emo's |
| Not a concert | 33 | Mostly Longhorns games |
| Duplicate | 30 | Support acts listed as separate shows |
| Wrong date | 10 | Showlist, 19hz |
| Stale (cancelled, moved) | 8 | Songkick 4; Jane Remover moved from Emo's to Stubb's |
| Wrong venue | 4 | ACL Live and 3TEN share one website |
| No trace anywhere | 10 | Six on Bandsintown |

Of the 135 judged real, 42 joined the truth: one per venue and night that
had no show yet. The rest share a night with a show already in the truth
and are mostly support acts (Barrington Levy under Shyne, August Burns Red
under Underoath), so adding them would blame every headliner-only source
for a miss. The cost is that a real second show on a night (an early and a
late show) is undercounted.

The lesson is about the venues themselves: reading 15 venue calendars
directly meant twelve different platforms (Ticketmaster widgets, Prekindle,
WordPress, Webflow, Squarespace, See Tickets embeds), and the first pass
still missed about one show in five. So the venues make a poor feed but a
good spot-check: a daily job that re-reads two venue calendars and grades
the feed against them is the health check (THINKING.md §5).

## Freshness (measured on two cases, not guaranteed)

- **MUNA:** JamBase and Ticketmaster on announcement day, Do512 very likely
  the same day, the venue calendar by May 16, Showlist not before late June,
  the Chronicle the day before the show.
- **This week:** seven newly announced shows go on sale Fri Sep 25 at 10 AM
  (Spoon's New Year's Eve at ACL Live, The Interrupters, Poi Dog Pondering
  and four more). Do512 7/7, JamBase 7/7, Songkick 7/7, Bandsintown 6/7,
  Showlist 3/7, SeatGeek 2/7, the Chronicle 1/7.
- **What that implies, and what it doesn't:** a daily refresh would have
  caught both cases within a day, and MUNA's first presale opened four days
  after announcement. A day's lag can still miss a same-day presale or an
  artist-list signup deadline, which is why the watchlist in answer 4
  exists. Re-reading the sources in a week would measure first-seen times
  properly.

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
| Do512 | Undocumented JSON on every page; robots.txt allows it; DoStuff's terms of service (dostuffmedia.com/terms-of-service) cover use of the site and say nothing specific about automated reads. Ask them. | DoStuff Media, independent, Austin | Do512's own referral codes on Ticketmaster, Etix and Eventbrite links |
| JamBase | Free API tier: 1,000 calls a month, 6 months ahead, attribution, non-commercial | Independent since 1998 (ownership not confirmed on their own page) | JamBase's Ticketmaster referral link |
| Ticketmaster | Free Discovery API, instant key, 5,000 calls a day | Live Nation | Ticketmaster's program via Impact, about 1%, not on presales; pays the publisher |
| Bandsintown | API is per artist; anything else needs a partnership | Bandsintown Group | About $2 per Bandsintown Plus signup, not per ticket |
| Songkick | API closed to new applicants | Warner Music Group | None found |
| SeatGeek | Developer access now behind a request form | Independent | Partner program, resale-heavy |
| Showlist Austin | No API; one page with embedded data | Independent, runs on Patreon | None (links go straight to venues) |
| Resident Advisor | robots.txt refuses AI agents | Independent | Not researched |
| Edmtrain | API whose terms forbid combining it with other sources | Two-person independent | Affiliate |

Details and citations: `research/ticketing-apis.md`, `research/aggregators.md`.

## What this study can't tell us yet

1. **The APIs.** JamBase was graded through its website and Ticketmaster
   through a capped website; both APIs need keys (Kevin's accounts) and a
   run of this scorer against what they return.
2. **Freshness over time.** Two cases. A second read of the sources in a
   week would give first-seen times per source.
3. **Spring.** Venues announce two to four months out, so Jan–May holds 34
   shows today. The far and Jan–May columns are the ones to re-run monthly.
4. **Venues we don't cover.** Empire Control Room's site is down (DNS) and
   Summit has closed. Hole in the Wall, Radio/East, Cheer Up Charlies,
   Elysium and the Paramount are not in the study.
5. **The truth is built partly from the sources.** Adjudication only
   examined what some source listed; a show every source and the first read
   missed is invisible. The four "no source had it" shows are the known
   floor.
6. **Taste.** The study grades coverage, not whether these are shows Kevin
   wants. That is the alert's job.

## Codex's review (2026-09-24, read-only, head 172ebfa)

Codex reproduced the tables and found real problems, all now addressed or
stated above:

1. **Distinct shows collapsed in the truth.** Stubb's Oct 1 Brandon Flowers
   and Montclair shared the "Official 2026 ACL Nights" prefix and were merged
   into one show. Fixed: series prefixes and generic words no longer count as
   a shared name, and two listings with start times an hour or more apart
   stay two shows.
2. **Matching depended on listing order.** Fixed: every candidate pair is
   scored and the strongest are assigned first.
3. **Precision flattered some sources.** The first-read mode counted
   one-day-off dates as right, and status disagreements were ignored. Fixed
   in both modes.
4. **"Far" barely tests spring.** Added the Jan–May column and its sample
   size.
5. **JamBase and Ticketmaster were judged through websites, not APIs,** and
   JamBase's free tier looks six months ahead. Stated in answers 2 and 3.
6. **Overstated sentences.** "Every source that had MUNA had it on
   announcement day", "a daily refresh sees an announcement within a day",
   "no listing source pays artists per ticket" and "46 feeds plus
   Bandsintown" were each stronger than the evidence; rewritten above.
7. **The alert and identity design** (full lineups, a radius, a watchlist,
   early and late shows, rescheduled shows with new ids, alias conflicts,
   the 256 KiB crew-doc limit) are carried into THINKING.md.

Codex also proposed adding every adjudicated real show to the truth. Tried,
and it added 86 shows, 31 of them support acts on nights already in the
truth, so it was reverted to one per empty night (see "What adjudication
found").

## Re-running it

```
node claude-plans/2026-09-24-city-seasons/score.mjs          # graded with adjudication -> data/scores.json
node claude-plans/2026-09-24-city-seasons/score.mjs --raw    # against the first reads only -> data/scores-raw.json
node claude-plans/2026-09-24-city-seasons/score.mjs --unmatched do512   # what one source had that the truth didn't
```

Inputs: `data/ground-truth/` (venue calendars), `data/sources/` (each
source's listings), `data/unconfirmed-clusters.json` and `data/adjudication/`
(the 230 disputed listings and their verdicts).
