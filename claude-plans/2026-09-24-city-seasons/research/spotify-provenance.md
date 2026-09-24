# Where do Spotify's concert listings come from? (researched 2026-09-24)

Status: DONE 2026-09-24 (Verdict + Implications at the bottom). Evidence ranked: Spotify-owned 2025–26 pages > vendor press releases > trade press > blogs.

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

### F6 — Measured provider mix of Spotify's Austin list: Bandsintown is the long tail, Ticketmaster is the headliners (CONFIRMED for this sample, 2026-09-24)
Method: headless Chromium, logged out, loaded the Austin page and pressed "Load more" 12×, collecting 347 unique concert links (25 in the "Popular concerts" rail + 322 in "All events" — the All-events list only reached **Sep 26**, i.e. ~110 events/day in Spotify's Austin radius). Visited every 2nd one (80) and read the seller label + outbound link. Script: scratchpad sp3.mjs (not committed).
| Surface | n | Bandsintown | Ticketmaster | See Tickets | Etix |
|---|---|---|---|---|---|
| Popular rail | 13 | 0 | 13 | 0 | 0 |
| All events | 67 | 59 (88%) | 2 | 5 | 1 |
| Total | 80 | 59 | 15 | 5 | 1 |
Popular-rail TM events: USHER (Alamodome), sombr (Moody Center), ACL Fest W1, Lil Wayne, Teddy Swims, Steve Lacy (Moody Amphitheater), KATSEYE, Metallica, Journey, Trippie Redd, beabadoobee (Germania Amp), ADÉLA (Emo's). Non-BIT in All-events: See Tickets (Meanwhile Brewing, Cheatham Street, Brushy Street Commons, Paper Tiger, Concourse Project), TM (Jungle @ Moody Center, Phil Wickham @ H-E-B Center), Etix (Buck's Backyard, Buda).
Caveats: (1) Spotify shows ONE seller per event; an event that exists in both Bandsintown and a ticketer is deduped, so "Bandsintown" here means "the link Spotify chose", not "only Bandsintown knew it". (2) Bandsintown itself ingests ticketer feeds + artist-entered dates, so BIT's share is partly re-served ticketer data. (3) Near-term sample (Sep 24–26); winter/spring announced shows skew to bigger ticketed events, where TM/AXS/DICE share will be higher. (4) No AXS or DICE hit in 80 — Austin's AXS/DICE rooms (if any) not sampled.
Read for us: to match "what Kevin sees on Spotify", the two feeds that matter are **Bandsintown** (breadth, artist-entered long tail, and the one partner with a public-ish artist events API) and **Ticketmaster Discovery API** (the big rooms Spotify promotes). See Tickets/Etix/DICE/AXS fill specific rooms.

### F6b — MUNA check (2026-09-24)
https://open.spotify.com/artist/6xdRb2GypJ7DqnWAI2mHGn/concerts (logged out) lists 27 upcoming MUNA dates (Philadelphia Sep 25 → Berlin Nov 27; incl. All Things Go, Forest Hills, Red Rocks Oct 21). The Sep 19 Austin (Moody Amphitheater) show has already rolled off, so we cannot verify after the fact that Spotify listed it — but the tour's first date checked (Philadelphia) is Ticketmaster-fed, and Moody Amphitheater shows are Ticketmaster (Steve Lacy Nov 7 above). Very likely Spotify showed it; the miss was an ALERT problem (announce → notify), not a coverage problem. Unknown: whether Spotify ever pushed Kevin a notification.

### F7 — Who feeds the other surfaces (the "structurally broadest" question)
| Surface | Feed(s) | Evidence (date) | Grade |
|---|---|---|---|
| Spotify | ~46 ticketers + Bandsintown; not Songkick | support.spotify.com concerts page, updatedAt 2025-12-08; measured Austin mix 2026-09-24 | CONFIRMED |
| Apple Music | Bandsintown AND Ticketmaster | Apple Music for Artists support 5469 (undated, fetched 2026-09-24): "By keeping your concert details up to date in Bandsintown…" + "If your concerts are available on Ticketmaster, they may also appear…" https://artists.apple.com/support/5469-make-concerts-discoverable-fans · Bandsintown PR 2026-03-31 (iOS 26.4) https://tools.prnewswire.com/en-us/live/20823/release/20260331EN20814 · TechCrunch 2026-03-24 "Apple Music partners with Ticketmaster…" (same day Apple also partnered with Bandsintown) https://techcrunch.com/2026/03/24/apple-music-partners-with-ticketmaster-to-power-its-concert-discovery-feature/ | CONFIRMED |
| Shazam / Apple Maps / Spotlight | Bandsintown ("for years") + Ticketmaster (TechCrunch: TM "already powers other event listings across the Apple ecosystem, including Maps, Spotlight…") | same two sources | CONFIRMED |
| YouTube | Bandsintown only — sole supported ticketer; YouTube dropped its earlier ticketer set (TM 2017, Eventbrite 2018) | YouTube Help 7570245 (fetched 2026-09-24) https://support.google.com/youtube/answer/7570245?hl=en ; trade coverage Mar 2025 | CONFIRMED |
| Google Search event cards | schema.org Event structured data on any page + participating "third-party event platforms"; Bandsintown lists Google as a distribution partner (up to 30 h); Ticketmaster markets its schema/inventory feeds into Google AI Mode | Google Search Central Event doc, last updated 2026-09-08 https://developers.google.com/search/docs/appearance/structured-data/event ; Bandsintown help (dated 2026-04-22) https://help.artists.bandsintown.com/en/articles/10518205-distribution-to-spotify-google-apple-shazam-and-amazon-music ; Ticketmaster Business 2025-11-20 https://business.ticketmaster.com/ticketmaster-x-google-powering-live-event-discovery-with-agentic-capabilities-in-ai-search/ | CONFIRMED (mechanism); partner roster UNKNOWN |
| Amazon Music | Bandsintown (up to 12 h) | Bandsintown help 2026-04-22 | CONFIRMED (vendor-side) |
| Instagram | No evidence found of a native concert-listings feed on Instagram profiles in 2026. Meta's Muse AI agent added Ticketmaster as its first music "connector" 2026-09-10 (Music Ally). | https://musically.com/2026/09/10/ticketmaster-is-first-music-partner-for-metas-muse-ai-agent/ | UNKNOWN / likely none |

Bandsintown distribution (vendor page dated 2026-04-22): Spotify, YouTube, Google, Apple (Music/Maps), Shazam, Amazon Music; shares "event name, artist lineup, location, date/time, venue, ticket link(s), and event image"; latency Spotify ≤48 h, YouTube ≤48 h, Google ≤30 h, Apple ≤48 h, Shazam ≤48 h, Amazon ≤12 h. Its 2026-03-31 PR also names Microsoft Bing.

## Verdict (2026-09-24)
1. **Confirmed:** Spotify is not a single-provider mirror. It auto-imports from ~46 ticketers plus Bandsintown, and has explicitly NOT shown Songkick since Feb 2024. There is no public Spotify concerts API. The Austin city page is publicly viewable logged out, and every event names the feed it came from.
2. **Confirmed (measured):** In Spotify's Austin list, Bandsintown supplies the long tail (88% of an 67-event all-events sample) and Ticketmaster supplies the headliner rail (13/13 of the "Popular" sample).
3. **Structurally broadest provider: Bandsintown.** It is the ONLY feed that reaches all of Spotify, YouTube (exclusive), Apple Music/Shazam/Maps, Google, Amazon Music, and Bing. Ticketmaster is second (Spotify, Apple, Google, Meta Muse) and owns Austin's big rooms (Moody Center, Moody Amphitheater, ACL Live, Stubb's, Emo's).
4. **Likely:** Bandsintown's own corpus already includes most Ticketmaster events (it ingests ticketers), so Bandsintown alone approximates Spotify's Austin list; Ticketmaster Discovery API is the belt-and-braces for on-sale/presale timing on the big rooms.
5. **Unknown:** exact Spotify dedupe/merge rules when an event exists in several feeds; whether Spotify's Popular rail has a bias toward Ticketmaster (affiliate) inventory; Instagram's feed (probably none); Google's full partner roster; whether AXS/DICE rooms in Austin show up proportionally (none in our sample).

## Implications for the sources study
- Move **Bandsintown** to the top of the candidate list (it is the common upstream of Spotify's long tail, YouTube, Apple, Shazam, Google). Next check: what Bandsintown's API actually allows a non-artist app to query in 2026 (the classic `rest.bandsintown.com/artists/{name}/events?app_id=` is per-artist, not per-city) — that shape suits the ALERT ("is an artist Kevin loves playing Austin?") better than the CITY VIEW.
- Keep **Ticketmaster Discovery API** (city + date-range queries, public key) as the headliner/big-room source and for on-sale dates.
- **Songkick is demoted**: no longer a Spotify feed, so it is not a proxy for Kevin's bar.
- Spotify's own city page is a valid **ground-truth yardstick** to grade other sources against (render logged out, read each event's seller) — but not a data source (private API, ToS).
