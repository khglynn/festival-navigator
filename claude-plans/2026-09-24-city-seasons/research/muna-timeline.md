# MUNA, Moody Amphitheater, Sat 2026-09-19: when could Kevin have known?

**Researched 2026-09-24 (CT). Status: DONE for this test case.**
The first ground-truth case for the city-seasons sources study. Numbered
findings with sources are in the log below; this top section is the verdict.

## The answer in plain words

1. **The show was public for 134 days.** MUNA announced the Gets So Hot
   Tour, with Austin on it, on Fri 2026-05-08 (the day their album *Dancing
   on the Wall* came out). The show was Sat 2026-09-19.
2. **Tickets went on sale within a week and never sold out.** Artist
   presale Tue May 12, then Spotify / venue / Live Nation presales Wed May
   13, general sale Thu May 14, all 10 AM CT. Ticketmaster still showed
   "not sold out, not limited" the morning of Sep 18, and the venue's own
   day-before copy said "Still need tix? Grab yours now". So there was no
   sell-out; a ticket was buyable for four straight months, up to the day
   before.
3. **Every big source had it on announcement day.** Ticketmaster (listed
   between May 7 21:22 UTC and May 9 00:22 UTC), JamBase (page published
   May 8 10:22 AM CT), Do512 (event photo uploaded May 8 12:21 PM CT),
   the venue's own calendar (by May 16 at the latest, and absent on May 3).
   Songkick very likely by May 23. Showlist Austin only shows about 90
   days ahead, so it could not have carried it before late June. The Austin
   Chronicle printed it the day before.
4. **So this was never a data problem. It was an alert problem.** Any of
   four sources would have told Kevin in May. Nothing pushed it to him.
5. **Spotify was in the loop and still didn't land it.** Ticketmaster's
   record for this show lists a "Spotify Presale" (Wed May 13). Spotify
   says presale emails go to an artist's top fans "and/or anyone who follows
   the artist", and its concert pushes need location set, push on, and the
   artist followed. Spotify's own feed for concerts is Ticketmaster plus
   Bandsintown, and this was a Ticketmaster show. So a MUNA follower in
   Austin was plausibly shown this date and possibly emailed; whether Kevin
   was, only his inbox can say (search Gmail for "MUNA" around May 8–13).

## Timeline

| When (CT) | What | Evidence | Confidence |
|---|---|---|---|
| 2026-05-03 | Venue calendar has no MUNA (Sep 12 then Sep 22) | Wayback moodyamphitheater.com/events-tickets 20260503195714 | high |
| 2026-05-07 4:22 PM | Ticketmaster artist page has no Austin date | Wayback TM artist 2197571 @ 20260507212242 | high |
| 2026-05-08 (Fri) | Tour + Austin date announced, album out same day | JamBase, Far Out, Exclaim, Vice (all May 8) | high |
| 2026-05-08 10:22 AM | JamBase show page published | JSON-LD datePublished 2026-05-08T15:22:25Z | high |
| 2026-05-08 12:21 PM | Do512 event image uploaded (event exists) | Cloudinary v1778260864 on Do512 event 17325831 | medium-high |
| by 2026-05-08 7:22 PM | Ticketmaster lists event 3A0064A7C59AF73A | Wayback TM artist page @ 20260509002229 | high |
| 2026-05-11 11:59 PM | Artist-presale signup closes (Laylo, whereismuna.com/tour) | Vice, May 8 | high |
| 2026-05-12 10 AM | Artist presale | TM event state presaleDates | high |
| 2026-05-13 10 AM | Spotify, venue, Live Nation presales | TM event state presaleDates | high |
| 2026-05-14 10 AM | General on-sale | TM onsaleDate 2026-05-14T15:00:00Z | high |
| by 2026-05-16 | Venue homepage: MUNA "BUY TICKETS" | Wayback moodyamphitheater.com @ 20260516180938 | high |
| by 2026-05-23 | Songkick has the tour (42 upcoming) | Wayback Songkick artist page | medium (inferred) |
| ~late Jun | Enters Showlist Austin's ~90-day window | Showlist horizon measured on 4 snapshots | medium (inferred) |
| 2026-09-12 | Showlist Austin lists it | Wayback austin.showlists.net @ 20260912210541 | high |
| 2026-09-18 | Chronicle print pick; TM soldOut:false; venue "still need tix?" | Chronicle PDF; TM @ 20260918151144; Do512 JSON | high |
| 2026-09-19 (Sat) | Show happened | setlist.fm; Daily Texan photo gallery Sep 20 | high |

## Notice

1. Announcement to show: **134 days**. General on-sale to show: **128
   days**. Spotify presale to show: 129 days.
2. On-sale to sell-out: **no sell-out**, so no number. Tickets were on
   sale for 128 days.
3. Resale floor near show time was about $76 (SeatGeek, per a search
   summary; not verified first-hand).

## What this case says about sources (for the study)

1. **Speed:** Ticketmaster, JamBase and Do512 were all same-day. None of
   them beats the others on this case; any would have served an alert.
2. **Buy link:** Ticketmaster is the buy link itself. Do512 carried none
   (`actions.buy:false`). JamBase pointed at the venue homepage. The venue
   pointed at the right Ticketmaster event.
3. **Horizon:** Showlist Austin's ~90-day window disqualifies it for the
   alert (it would have fired in late June, not May), though it's fine for
   a "this month" view.
4. **Archive reach:** Ticketmaster's *artist* pages are archived well even
   though its event pages are not. That makes TM artist pages the best
   tool for grading future test cases' "first seen" dates.
5. **Unverified:** Bandsintown (no archive, API closed to unregistered
   apps); SeatGeek (live tour ids in one block, 18230731–18230761, which
   suggests one batch import; no archive); AXS (not involved: Moody
   Amphitheater sells through Ticketmaster).

## Findings log (appended as found)

1. **Tour + Austin date announced Fri 2026-05-08.** JamBase (published
   May 8, 2026: https://www.jambase.com/article/muna-tour-dates-fall-2026),
   Far Out (Fri May 8, 2026, full date list incl. "19 — Austin, TX, Moody
   Amphitheatre": https://faroutmagazine.co.uk/muna-announce-the-gets-so-hot-tour-for-late-2026/),
   Exclaim! (May 8, 2026, lists Sep 19 Austin Moody Amphitheater:
   https://exclaim.ca/music/article/muna-announce-2026-tour). Also covered by
   Vice and Alternative Press (altpress 403'd to our fetcher).
2. **Presale Tue 2026-05-12 10 AM local (artist presale); general on-sale
   Thu 2026-05-14 10 AM local** (JamBase; Exclaim gives May 14 without time).
3. **Do512 event page first Wayback capture: 2026-06-19 15:51 UTC** (status
   403 — the archiver was blocked, but the URL existed by then). Upper bound
   only; Do512 very likely had it earlier.
4. **moodyamphitheater.com calendar (`/events-tickets`) bracket:**
   absent on the 2026-05-03 19:57 UTC snapshot (lists Sep 12 NEEDTOBREATHE
   then Sep 22 Dominic Fike, nothing on Sep 19), present on the 2026-05-25
   03:38 UTC snapshot ("Sat Sep 19 Gets So Hot Tour MUNA with Hemlocke
   Springs … Doors at 7:00 pm BUY TICKETS"). Consistent with a May 8
   announcement; no capture in between to narrow it.
   The event page `/events/muna` first captured 2026-06-08 23:01 UTC; BUY
   TICKETS links to `ticketmaster.com/event/3A0064A7C59AF73A`. On the
   2026-09-18 19:39 UTC capture (day before the show) both the event page and
   the calendar still said BUY TICKETS, with no sold-out marker.
5. **Ticketmaster event page, JamBase show page, setlist.fm: no Wayback
   captures at all** (CDX returned empty). Ticketmaster blocks archiving
   broadly, so this says nothing about when TM listed it; the venue page's
   BUY TICKETS pointed at this exact TM event id by 2026-06-08.
6. JamBase show page (live, 2026-09-24): no sold-out marker; 8:00 PM start.
   A web-search summary claimed "the concert sold out" with no citable
   source; unverified so far.
7. **Do512 had it on announcement day (strong evidence).** Do512's own
   JSON (`/events/2026/9/19/muna-gets-so-hot-tour-tickets.json`, fetched
   2026-09-24 with a browser user-agent; plain WebFetch gets 403) gives event
   id 17325831 and an event photo stored as Cloudinary
   `v1778260864/event-17325831.jpg`. Cloudinary's version number is the Unix
   upload time: 1778260864 = **2026-05-08 17:21 UTC (12:21 PM CT)**, the
   announcement day. So the Do512 listing existed within hours of the
   announcement (inference from the image timestamp; the event record could
   in principle predate the image, not postdate it).
   Same JSON: `sold_out: false`, `ticket_info: ""`, `actions.buy: false`
   (Do512 carried **no buy link of its own**), 9 going, venue id 107.
   Description is the venue's day-before copy: "TOMORROW 9/19 … Still need
   tix? Grab yours now at the link in bio!" So **it did not sell out**:
   tickets were still on sale on Sep 18.
   Recommended on Do512 by Paradigm Agency (MUNA's booking agency), FLOOD,
   VINYLMNKY, LGBTQ+ in Austin.
8. **MUNA's official tour page (https://whereismuna.com/tour/)** renders its
   dates in a Laylo embed (`embed.laylo.com?dropId=…`), so the archived HTML
   holds no dates; Laylo is the artist's own SMS/email "drop" list, and Vice
   (May 8, 4:02 PM) says the artist presale required signing up there by
   midnight Mon May 11. Wayback captures exist May 9 00:22 UTC and May 10,
   but the dates are not in the static HTML, so no bracket from it.
9. **Showlist Austin (now https://austin.showlists.net/; showlistaustin.com
   301s there).** The homepage embeds `window.upcomingShows` (JSON). Its
   horizon is only about three months: snapshot 2026-04-12 reached Jul 11,
   05-12 reached Aug 11, 05-29 reached Aug 29, 06-17 reached Sep 16. MUNA
   is absent from all four (Sep 19 was beyond the horizon each time), and
   present in the 2026-09-12 21:05 UTC snapshot as
   `{"date":"20260919","title":"MUNA","venueName":"Moody Amphitheater"}`.
   Showlist's ids are regenerated each build (NEEDTOBREATHE was 1320694 in
   June, 1384223 in September), so they cannot date the entry. Read: a
   ~90-day window means Showlist can't serve an early alert for a show
   announced four months out; it surfaced MUNA from roughly late June at
   the earliest (window-bound inference) and by Sep 12 at the latest (fact).
10. **Songkick.** Live site (2026-09-24) shows the tour with concert ids in
    a tight block (Philadelphia 43205779, Pittsburgh 43206512, Stanford
    43206529), consistent with all dates being entered in one batch. The
    Austin page has already dropped off the artist/venue pages (past).
    Wayback: artist page captured 2026-05-23 shows "42 upcoming events"
    (only the first 10 rendered in HTML: May album shows and summer
    festivals); 42 is about what the 27 tour dates plus 7 album-release
    shows plus summer festivals add up to, so the tour was very likely in
    Songkick by May 23 (inference, not a direct sighting of Austin). The
    venue-page captures (May 21, Jul 29) are Wayback error shells, unusable.
11. **Bandsintown.** Artist page https://www.bandsintown.com/a/863632-muna
    (live: 28 upcoming, e.g. Pittsburgh event 1038952965). No Wayback
    captures of the artist, venue or event pages; the public REST API now
    denies unregistered app_ids ("explicit deny"). No timing evidence.
12. **Austin Chronicle.** The print issue dated Thu 2026-09-18
    (https://www.austinchronicle.com/wp-content/uploads/issues/2026-09-18/chronicle.pdf)
    runs MUNA as a weekend pick ("MUNA MUSIC — SATURDAY 19, MOODY
    AMPHITHEATER — Calling all girls, gays, and theys! …") and in the
    Saturday listings ("MOODY AMPHITHEATER MUNA, Hemlocke Springs (8pm)").
    The 2026-09-11 issue has no MUNA mention. No Wayback captures of the
    Chronicle's venue page or an event page. The Chronicle is a week-of
    surface: useful for "what's on this weekend", useless for an early alert.
13. **JamBase had it the morning of the announcement (strong evidence).**
    The show page https://www.jambase.com/show/muna-moody-amphitheater-20260919
    (JamBase show id 16253319) carries WordPress/Yoast metadata
    `"datePublished":"2026-05-08T15:22:25+00:00"` = **10:22 AM CT, May 8**,
    an hour before JamBase's own tour article (published 16:23 UTC). Its
    schema.org offer points to `https://www.moodyamphitheater.com/?utm_source=jambase`
    (the venue homepage, not the Ticketmaster event). eventStatus stayed
    EventScheduled; no sold-out marker. (Raw HTML fetched through Firecrawl
    2026-09-24; plain curl got a 17 KB bot shell.)
14. **Ticketmaster: bracketed to announcement day, plus the full sale
    schedule (strongest evidence in the file).** The TM artist page
    https://www.ticketmaster.com/muna-tickets/artist/2197571 is archived
    often. The **2026-05-07 21:22 UTC** capture has no Austin/Moody/event id;
    the **2026-05-09 00:22 UTC** capture lists event `3A0064A7C59AF73A`
    ("MUNA: Gets So Hot Tour | Saturday, Sep 19, 2026, 8:00 PM | Moody
    Amphitheater, Austin"). So TM listed it inside a ~27-hour window that
    contains the May 8 announcement. The page's embedded event state gives
    the sale schedule (UTC in the source, CT here):
    a. Artist Presale: Tue May 12, 10:00 AM CT (15:00Z)
    b. Spotify Presale: Wed May 13, 10:00 AM – 11:59 PM CT
    c. Waterloo Greenway Venue Presale: Wed May 13, 10:00 AM – 11:59 PM CT
    d. LIVE NATION PRESALE: Wed May 13, 10:00 AM – 11:59 PM CT
    e. General on-sale: Thu May 14, 10:00 AM CT (`onsaleDate
       2026-05-14T15:00:00Z`; JSON-LD `validFrom 2026-05-14T10:00:00`)
    The **2026-09-18 15:11 UTC** capture (the day before the show) still
    says `"soldOut":false,"limitedAvailability":false`, JSON-LD availability
    `InStock`. **It never sold out**, as far as the record shows; the
    question "days from on-sale to sell-out" has no answer because there
    was no sell-out. (The web-search summary claiming a sell-out was wrong.)
    Note the **Spotify Presale** by name: Spotify ran a presale for this
    exact show.
15. **Venue homepage 2026-05-16 18:09 UTC** (Wayback): "Gets So Hot Tour
    MUNA with Hemlocke Springs September 19, 2026 BUY TICKETS", next to
    Chance the Rapper "ON SALE 5/21 AT 10 AM".
16. **Spotify.** (See `spotify-provenance.md` for where Spotify's listings
    come from: Ticketmaster + Bandsintown + ~44 other ticketers, not
    Songkick.)
    a. Ticketmaster's event record names a **"Spotify Presale"**, Wed
       2026-05-13 10:00 AM – 11:59 PM CT (finding 14).
    b. Spotify support, "Presale and merch emails"
       (https://support.spotify.com/us/article/presale-and-merch-emails/,
       undated, fetched 2026-09-24): "Emails are sent to listeners who our
       data shows are the artist's top fans and/or anyone who follows the
       artist on Spotify." Requires "Spotify News and Offers" email on.
    c. Spotify newsroom, 2025-03-20
       (https://newsroom.spotify.com/2025-03-20/our-new-concerts-near-you-playlist-makes-it-fun-and-easy-to-discover-touring-artists/):
       "Have push notifications turned on to receive reminder messages for
       your favorite artists", "Make sure your location is up-to-date via the
       'Live Events' section", "Follow your favorite artists on the app to
       get their latest show updates."
    d. Spotify notification settings
       (https://support.spotify.com/us/article/notification-settings/):
       categories include "concert recommendations, artist updates".
    e. Wayback captures of MUNA's Spotify concerts page
       (open.spotify.com/artist/6xdRb2GypJ7DqnWAI2mHGn/concerts) on
       2026-06-23 and 2026-09-17 are JS shells with no dates, so there is
       no archived proof the Austin date was shown. Inference: a
       Ticketmaster-sold show at a Ticketmaster venue, with a named Spotify
       presale, was very likely on MUNA's Spotify concerts tab from May.
       Whether Kevin received the presale email or a push is checkable only
       in his Gmail / phone (search "MUNA" May 8–14, 2026).
17. **setlist.fm** confirms the show happened
    (https://www.setlist.fm/setlist/muna/2026/moody-amphitheater-austin-tx-7b7fb240.html);
    The Daily Texan ran a photo gallery 2026-09-20
    (https://thedailytexan.com/2026/09/20/photo-gallery-muna-at-moody-amphitheater/).
