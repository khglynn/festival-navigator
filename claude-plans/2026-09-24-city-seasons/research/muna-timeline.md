# MUNA, Moody Amphitheater, Sat 2026-09-19: when could Kevin have known?

**Started 2026-09-24 (CT). Status: in progress — findings banked as they land.**

The first ground-truth test case for the city-seasons sources study.
Known: MUNA "Gets So Hot Tour", Sat Sep 19 2026, Moody Amphitheater at
Waterloo Park, Austin, support Hemlocke Springs.

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
