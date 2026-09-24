# Where do Spotify's concert listings come from? (researched 2026-09-24)

Status: IN PROGRESS — grown as evidence lands. Evidence ranked: Spotify-owned 2025–26 pages > vendor press releases > trade press > blogs.

## Question
Kevin sees Spotify's concert listings more than any other surface. If Spotify just shows another provider's data, that provider moves up our list for the Austin city-seasons feed.

## Findings log
(appended below as found)

### F1 — Spotify's own help page: 46 ticketing feeds, auto-imported, NO Songkick, no manual entry (CONFIRMED)
Source: https://support.spotify.com/us/artists/article/concerts/ ("Adding concerts to Spotify"; page JSON `updatedAt` 2025-12-08; fetched 2026-09-24).
Verbatim: "To display your concerts on Spotify, they need to be listed with one of our ticketing partner sites. We automatically import concerts from these ticketing sites. New concerts typically appear on Spotify within 24 hours."
Partner list (verbatim order): 24tix, AXS, Bandsintown, Biletinial, BookMyShow, Bubilet, Bugece, Ciaotickets, DICE, eBilet, Enterticket, Eplus (Japan only), Etix, Eventbrite, Eventim, FNAC, Fourvenues, Freshtix, Getin, Gigantic, Humanitix, iTicket, Lawson, More, Nortic, Passline, Posh, Reservix, Resident Advisor, Seatgeek, See Tickets, Shotgun, Skiddle, Stager, Tickeri, Ticketek, Ticketmaster, Tickster, Tixr, Vivaticket, Webtickets, Weeztix, WeGotTickets, Wegow, Xceed, Zaiko.
"Note: We don't display events from Songkick." · Required fields: artist name, start time, venue name, event name. · "We don't display virtual events."
Recommendation: "We recommend concerts to fans based on where they live, who they follow, and who they listen to."
Companion page https://support.spotify.com/us/artists/article/concerts-missing-from-spotify/ (updatedAt 2025-09-17): fix wrong date/venue by contacting "the ticketing partner"; missing concerts → contact Spotify with links. No self-serve add path in Spotify for Artists.

Read for us: Spotify is an AGGREGATOR of primary ticketers + Bandsintown (the one artist-self-serve path: an artist can hand-enter a date in Bandsintown for Artists and it flows to Spotify). No single upstream provider "is" Spotify's data. The US-relevant feeds: Ticketmaster, AXS, SeatGeek, DICE, Eventbrite, Etix, See Tickets, Tixr, Freshtix, Posh, Humanitix, Bandsintown.

### F2 — Songkick powered Spotify ~2011–Feb 2024, then was cut; Bandsintown replaced it (CONFIRMED)
- Trade press: Music Business Worldwide, 2024-02-14 (metadata verified) — "Spotify's 13-year partnership with Warner Music Group's Songkick ... has come to an end", Bandsintown "event listings are now directly integrated into Spotify". https://www.musicbusinessworldwide.com/spotify-integrates-bandsintown-listings-as-its-songkick-partnership-comes-to-an-end2/
  CAVEAT: the same article also says Spotify "continues to share Ticketmaster, Eventbrite, Songkick, and AXS listings" — contradicts itself and Spotify's own page; treat the "Songkick" in that sentence as an error.
- Artist tweet dated 2024-02-05 (decoded from X status id 1754565462191476979) quoting Spotify support: "After 13 years Spotify's partnership with SongKick has come to a mutual end." https://x.com/heyitsfrog/status/1754565462191476979
- Spotify newsroom concerts-hub posts from 2020-09-15 and 2023-03-08 still named "Songkick and Ticketmaster" as partners (2023: "over 840,000 concert listings"). https://newsroom.spotify.com/tag/concerts-hub — i.e. Songkick was a named feed until early 2024.
- Spotify for Artists blog "Concerts 101" (2024-05-08): Spotify works with "ticketers, promoters, and aggregators"; "Artists can also manually add or edit their performance schedules through our integration with Bandsintown". https://artists.spotify.com/en/blog/concerts-101-effortless-listing-and-discovery
- Implication: any old article (2015–2023) saying "Spotify concerts = Songkick" is stale. Songkick's own data is NOT a proxy for what Kevin sees on Spotify today.

### F3 — 2026 changes: SeatGeek added (Feb), Reserved w/ Live Nation (May) (CONFIRMED)
- SeatGeek press release, Business Wire 2026-02-18: SeatGeek primary inventory into Spotify's event discovery. https://www.businesswire.com/news/home/20260218544068/en/SeatGeek-Expands-Concert-Discovery-Through-Spotify-Integration · TechCrunch same day https://techcrunch.com/2026/02/18/seatgeek-and-spotify-team-up-to-offer-concert-ticket-sales-inside-the-music-platform/ — coverage says initially ~15 US partner venues, mostly sports stadiums (AT&T Stadium etc.). MBW 2026-02-18 (metadata verified): Spotify has "helped artists generate more than $1 billion in ticket sales"; partners named incl. Ticketmaster, Eventbrite, AXS, Bandsintown, ZAIKO, Skiddle, Stager; "over 40 ticketing partners".
- Spotify newsroom 2026-05-21 (metadata verified) "Introducing Reserved": "more than 40 ticketing partners"; discovery surfaces named: Concerts Near You playlist, Venue Search, Live Events Feed; ">$1.5 billion in ticket sales" driven. Reserved launch partner Live Nation (Ticketmaster checkout), US+Canada Premium. https://newsroom.spotify.com/2026-05-21/investor-day-reserved-launch/

### F4 — Spotify's public Web API has NO concerts/events endpoint in 2026 (CONFIRMED)
- Fetched https://developer.spotify.com/documentation/web-api on 2026-09-24: the reference nav lists ~95 endpoints (albums, artists, audiobooks, categories, chapters, episodes, genres, markets, player, playlists, search, shows, tracks, users). Zero contain "concert" or "event" (grep count 0).
- Search endpoint `type` allowed values (fetched 2026-09-24): "album", "artist", "playlist", "track", "show", "episode", "audiobook" — no event type. https://developer.spotify.com/documentation/web-api/reference/search
- Long-standing unanswered requests: https://github.com/spotify/web-api/issues/1379 , https://community.spotify.com/t5/Spotify-for-Developers/Concerts-API/td-p/4908529
- The web player fetches concerts from `api-partner.spotify.com/pathfinder/v2/query` (private GraphQL, observed in network log 2026-09-24). Not a public/licensed API; relying on it = scraping Spotify against its Developer Terms. Not a candidate source.

### F5 — Austin concerts ARE visible on open.spotify.com logged out (CONFIRMED, observed 2026-09-24 ~2:30 PM CT)
- https://open.spotify.com/concerts/location/4671654-Austin-TX-US rendered in a clean headless Chromium (no cookies, no login): heading "Austin Concert Tickets", filters "Select dates / This weekend / Next weekend", a "Popular concerts" rail (USHER Alamodome Oct 5; sombr Moody Center Oct 20; ACL Fest weekends; Steve Lacy Moody Amphitheater Nov 7; Gorillaz Moody Center Oct 15; Tyla Moody Center Dec 11; Alan Walker ACL Live Jan 21; Metallica Alamodome May 22 …) and an "All events" chronological list with "Load more" (Sep 24: Louisiana Surf Department @ Hole In the Wall, Sarah Sharp @ Elephant Room, Gwar @ Radio/East, ADÉLA @ Emo's, Grocery Bag/Mugger @ Meanwhile Brewing …). "Austin" radius includes San Antonio, New Braunfels, Pflugerville, Del Valle.
- Plain curl gets only the JS shell (no SSR data) — it must be rendered. Logged-out it is not personalized ("for you" in the title but same list).
- Every concert page names its feed. Observed 2026-09-24:
  | Concert | Venue | "Tickets available on" | Outlink |
  |---|---|---|---|
  | Casii Stephan | Holiday Inn | Bandsintown | bandsintown.com/e/108888846?app_id=spt_feed |
  | Louisiana Surf Department | Hole In the Wall | Bandsintown | bandsintown.com/t/…?app_id=spt_feed |
  | Gwar | Radio/East | Bandsintown | bandsintown.com/e/108637956?app_id=spt_feed |
  | Steve Lacy | Moody Amphitheater | Ticketmaster ("Sold out") | ticketmaster.evyy.net affiliate → ticketmaster.com |
  | ADÉLA, Zoe Gitter | Emo's | Ticketmaster | ticketmaster.evyy.net affiliate |
  | Grocery Bag, Mugger… | Meanwhile Brewing | See Tickets | prf.hn affiliate → seeticketsusa |
  Footer on each: "Spotify earns commissions from ticket sales on our platform." (affiliate links — Impact/evyy for TM, Partnerize/prf.hn for See Tickets).
