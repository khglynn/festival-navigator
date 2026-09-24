# City Seasons — listings/discovery sources research

**Date compiled:** 2026-09-24 (all citations read this date unless noted). Scope: LISTINGS/DISCOVERY companies, not ticket sellers, graded on ownership + who-gets-paid + access, per the brief in `../KICKOFF.md`.

Confidence key: **high** = read directly off the vendor's own current page; **medium** = vendor page + one clarifying search, or a well-corroborated third party; **low** = only third-party (Wikipedia/PitchBook/blog), no vendor primary source found, or facts read as stale/conflicting.

---

## 1. Do512 / DoStuff Media

- **What it is:** Do512 is the Austin-specific site; DoStuff Media LLC is the Austin-based parent that licenses the same listings platform to ~20 other city sites (do512-style network) across North America.
  Source: [Do512 — Wikipedia](https://en.wikipedia.org/wiki/Do512), read 2026-09-24: *"In 2009 Owens and Stewart launched a spin off company, DoStuff Media LLC., to license their event listing technology to similar websites outside of Austin."* Confidence: medium (Wikipedia, not vendor primary — the network-size claim of "21 cities" also came from a WebSearch synthesis, not directly quoted from a vendor page, so treat the exact city count as soft).
- **Ownership:** Independent, Austin-headquartered. No large media-company parent found (not owned by Live Nation/AEG/etc.). Funding is tiny — Crunchbase/Wellfound aggregate shows **$1.05M raised total**, investors listed as "Paycheck Protection Program and Mediatech Venture Collective" (i.e., a PPP loan, not real VC backing).
  Source: [DoStuff Media — Wellfound funding page](https://wellfound.com/company/dostuff-media/funding), read 2026-09-24 via search snippet. Confidence: low-medium — this is a startup-database aggregator, not DoStuff's own disclosure, and a PPP loan showing up as "investment" is a sign the underlying data quality is thin. Treat "independent, small, Austin-based" as the confident part; the funding number as soft color only.
- **API / data feed / partner program:** No public self-serve developer API found. There **is** a scraper-for-hire product (Apify's "DoStuff Media Scraper API") built by a third party against Do512's site — i.e., someone else had to scrape it because there's no official feed.
  Source: [DoStuff Media Scraper · Apify](https://apify.com/hoholabs/dostuffmedia-scraper/api), read 2026-09-24 (title/listing only — did not fetch full page). Confidence: low (didn't confirm what fields it exposes or its legality under Do512's own ToS — flag as unverified, don't build on it without re-checking Do512's actual robots.txt/ToS).
- **Ticket links / ticketing of its own:** Do512 runs its own perk/loyalty product, **DoMORE**, which is a comp/discount membership tied to Spotify + Bandcamp listening data — not a standard "click a ticket link, we get an affiliate cut" flow. It matches members to events an event's promoter wants to fill, using their streaming habits as a signal.
  Source: [DoStuff — DoMORE service page](https://dostuffmedia.com/service/domore), read 2026-09-24, quoted directly: *"Our inventory tool matches our members with your chosen event(s) based on their individual preferences, and likelihood of interest"* and *"additional data...pulled from their Spotify & Bandcamp listening habits."* The page does **not** disclose a revenue-share or commission structure. Confidence: high on what DoMORE is; **unknown** on whether standard Do512 event listings carry an affiliate-tagged ticket link to Front Gate Tickets, Ticketmaster, etc. — could not confirm this either way (the About/FAQ page 403'd for the fetcher; a Do512 venue page for Front Gate Tickets exists, suggesting a relationship, but no affiliate-tag evidence). **Flag: needs a live click-through test** (open a real Do512 event page, inspect the outbound ticket link's URL for `?aff=`/`utm_source` params) before ranking this source on referral economics.

**Bottom line for Kevin:** small, independent, Austin-native, no self-serve API — anything built on Do512 today means scraping (unconfirmed legality) or manual curation, not integration.

---

## 2. JamBase (JamBase Data)

- **Ownership:** Founded 1998 by Andy Gadiel and Ted Kartzman; still shows as a private company. No acquisition by a larger media/ticketing company found in this pass.
  Source: [JamBase — Wikipedia](https://en.wikipedia.org/wiki/JamBase) + search snippets, read 2026-09-24. Confidence: low — didn't find a vendor "about us" page confirming current ownership structure; Wikipedia + PitchBook/Crunchbase stub only. Treat "independent" as provisional.
- **Data source:** Aggregates from **60+ sources**, including direct partnerships/feeds from "official top-tier ticketing providers," venues, promoters and festivals — this is a real data-reconciliation company, not a scrape-only shop.
  Source: [JamBase Data — Data page](https://data.jambase.com/data/) via search synthesis, read 2026-09-24. Confidence: medium (search-engine synthesis of the page, not a direct quote — re-fetch if this matters for the direction doc).
- **API product, tiers and 2026 prices** (directly quoted off the pricing page):
  | Tier | Price | Calls | Notes |
  |---|---|---|---|
  | Developer (Free) | $0/mo | 1,000 calls/mo, then **$0.05/call** overage | 6 months future events only; **non-commercial use only** |
  | Startup | **$500/mo** or $6,000/yr (20% off annual) | 20,000 calls/mo, 7,200/hr rate limit | Unlimited future events window, external IDs + ticket pricing data |
  | Pro | **$1,500/mo** or $18,000/yr | 50,000 calls/mo, 18,000/hr | +3 years past events, 48hr support SLA |
  | Pro+ | **$2,500/mo** or $30,000/yr | 150,000 calls/mo, 36,000/hr | Full historical past events, 24hr SLA |
  | Enterprise | Custom | Custom | Dedicated account management |

  Source: [JamBase Data — Pricing](https://data.jambase.com/pricing), fetched directly 2026-09-24. Confidence: **high** — this is the vendor's live pricing page.
- **2025–2026 change:** JamBase relaunched as a **self-service data platform with a new MCP server** (so an AI agent can query it in natural language), announced via a JamBase newsroom article.
  Source: [JamBase — "JamBase Launches Self-Service Data Platform & MCP Server"](https://www.jambase.com/article/jambase-self-service-data-platform-mcp-server), fetched directly, dated **2026-05-05**. Confidence: high on the launch happening; the article itself doesn't restate pricing (that came from the separate pricing-page fetch above).
- **Referral / affiliate:** Not found in this pass — no affiliate program mentioned on the pricing or data pages. This looks like a straight B2B data-licensing product (you pay JamBase for API calls), not a referral/commission model. **Flag: unconfirmed** — did not check whether JamBase's own consumer-facing jambase.com site (as opposed to the data.jambase.com API product) carries affiliate-tagged ticket links to fans.

**Bottom line for Kevin:** the free tier (1,000 calls/mo, 6-month window) is plausible for a personal Austin-only app depending on call pattern — but it's "non-commercial use only," and $500/mo is the first paid step up. This is the most professional/complete data product of the bunch, and cash goes to JamBase, not artists.

---

## 3. Edmtrain

- **Ownership:** Independent, small — founded 2013 by Mike Udovic; Anthony Attia joined as co-owner in 2019. Two-person-ish operation by the look of the sourcing (a podcast interview, not a corporate filing).
  Source: search synthesis of [Edmtrain — About Us](https://edmtrain.com/about-us) and an iHeart podcast credit, read 2026-09-24. Confidence: medium.
- **Genre scope:** EDM/electronic-only by name and design — relevant to MUNA-style pop/indie discovery only at the margins (MUNA is not EDM). Flag this clearly for the direction doc: Edmtrain is probably NOT a fit for Kevin's actual need (he missed MUNA, an indie-pop act) unless Austin's EDM scene specifically matters to him.
- **API access terms** (directly quoted off the terms page):
  - Access: *"Upon acceptance of the Agreement, Edmtrain will assign you a client API key which will allow you to access their API."* No stated price; no stated approval gate described (reads as self-serve behind a signup + agreement-acceptance, but did not confirm the actual signup flow).
  - Rate limits: *"We may limit the number of API requests your Application can make in a given period. We may change these limits at our sole discretion."* — i.e., no published number, vendor's sole discretion.
  - Caching: *"If you are caching our Data, it should not be older than 24 hours old when it is displayed. Any of our Data for events that are no longer in the future should not be stored."*
  - Attribution: *"For each event displayed, you must provide your users with the event link from our API's response, unmodified."* If you don't display events, you must link to edmtrain.com somewhere prominent. Stylize the name as "Edmtrain", "edmtrain", or "EDMTRAIN".
  - Competing-service ban: *"you may not combine their events with other event sources to create a competing event discovery service"* — **this is a real constraint for city-seasons**, which by design blends multiple sources. Worth flagging hard: if Edmtrain's data is used, it likely cannot be merged into the same unified list as other sources without risking ToS violation; would need to keep it in its own lane or re-read the full terms for a merge exception.
  - No selling/leasing access to the data or to your app's integration of it.

  Source: [Edmtrain — API Terms of Use](https://edmtrain.com/api-terms-of-use), fetched directly, read 2026-09-24. Confidence: **high** — vendor primary, direct quotes.
- **Austin coverage:** Not directly confirmed this pass (didn't query Edmtrain's actual event data for Austin). Flag: unconfirmed, needs a live API test call.
- **Referral/affiliate:** No affiliate/referral program found in this pass.

**Bottom line for Kevin:** genuinely self-serve, free-reading terms, clean attribution rules — but it's an EDM-only database and its anti-merge clause is a real legal friction point for a multi-source blended calendar.

---

## 4. Bandsintown

- **Ownership:** Bandsintown Group (parent of Bandsintown LLC + Tonefuse LLC) traces back to a 2011 acquisition by Cellfish; search results describe it today as **"a subsidiary of Lagardère SCA,"** the French media conglomerate (Lagardère also owns Hachette, and used to own a big travel/retail arm).
  Source: search synthesis citing [Bandsintown Group — Dealroom](https://app.dealroom.co/companies/bandsintown_group) + [Bandsintown — Wikipedia](https://en.wikipedia.org/wiki/Bandsintown), read 2026-09-24. Confidence: **low-medium** — this is third-party aggregator language ("is a subsidiary of"), not a Bandsintown or Lagardère primary-source confirmation, and Lagardère's own ownership/divestitures have shifted a lot in recent years (Vivendi took a large stake in Lagardère in 2023). **Flag as "stale? needs a fresher confirmation"** per the citation rules — do not present "Bandsintown = owned by a big French conglomerate" as settled without a 2025/2026 primary source.
- **API access — this is the important finding:** Bandsintown's public "Data Applications" API is **artist-scoped, not city-scoped, and gated by approval**:
  - *"The Bandsintown Data Applications are meant to be used solely by artists, or people working in connection with or on behalf of artists."*
  - *"Unless you receive Bandsintown's written approval, commercial uses are not permitted for the Bandsintown Data Applications."*
  - Rate limiting is entirely discretionary: *"Bandsintown may, in its sole discretion, and without notice, monitor and restrict your use of the Bandsintown APIs at any time for any reason, including, without limitation, limiting the number of calls you may make."* Stacking multiple API keys to get around a limit is explicitly banned.
  - Caching allowed only session-based, with a duty to notify Bandsintown and purge removed data promptly.

  Source: [Bandsintown — Data Applications Terms of Use](https://corp.bandsintown.com/data-applications-terms), fetched directly, read 2026-09-24. Confidence: **high** on the quoted text.
  A companion help-center article confirms the practical gate: *"if you work with an artist, you can email support@bandsintown.com and they can create an App ID for you."* Source: [Bandsintown help center — "Can I have access to the API/an App_ID..."], read via search 2026-09-24, confidence medium (older-style help-desk URL, didn't fetch directly — **flag as possibly stale**, re-check before relying on it).
  **Could not confirm** whether the API supports querying by city/location at all (only by artist) — the public docs are gated behind a Google form and I could not find endpoint shapes. Flag: **unconfirmed, high-priority to resolve** since "query by city" is exactly what a city-seasons calendar needs, and everything found suggests Bandsintown's API is artist-first by design (fits its core "get alerted when an artist you follow is near you" product, which is the opposite direction from "show me who's playing near me").
- **Referral / affiliate:** Bandsintown runs **"Bandsintown Plus"** — a $2-per-signup affiliate program run through the AWIN affiliate network, where an artist or promoter shares a personal invite link and earns $2 per fan sign-up (whether or not the fan later pays), explicitly restricted to non-commercial personal sharing (no SEM, no posting on sites you don't primarily own).
  Source: search synthesis of [Bandsintown for Artists — Affiliate Program](https://artists.bandsintown.com/affiliate-program) and [Referral Program Rules](https://promoter.bandsintown.com/referral-program-rules), read 2026-09-24. Confidence: medium — didn't fetch either page directly, this is search-snippet synthesis; the $2/signup figure in particular should be re-verified against the live page before quoting to Kevin as a hard number.
- **Its role powering other apps' concert listings (very relevant to the brief):** Bandsintown is now the concert-data backbone behind **Spotify, Amazon Music, and Apple Music's** in-app "concerts near you" / artist-page ticket sections — and notably **took over from Songkick on Spotify** in 2026 when that 13-year partnership ended.
  Sources: [TechCrunch — "Amazon Music partners with Bandsintown for concert listings"](https://techcrunch.com/2026/04/22/amazon-music-partners-with-bandsintowns-for-concert-listings/), dated 2026-04-22; [Music Business Worldwide — "Spotify integrates Bandsintown listings, as its Songkick partnership comes to an end after 13 years"](https://www.musicbusinessworldwide.com/spotify-integrates-bandsintown-listings-as-its-songkick-partnership-comes-to-an-end2/). Read via search 2026-09-24, confidence **medium-high** (trade-press primary reporting, consistent across two independent outlets, dated within 2026). This is the single most important 2025–2026 change in this whole space: **Bandsintown effectively displaced Songkick as the streaming-platform concert-data default in 2026.**

**Bottom line for Kevin:** Bandsintown is now the industry's default concert-data layer (Spotify/Apple/Amazon all use it) — but its *public* API is artist-scoped and approval-gated, likely useless for "browse Austin's whole calendar" unless a broader partner tier exists that wasn't surfaced in this pass. Referral economics pay Bandsintown/AWIN per fan signup, not per ticket, and not artists directly (though artists are the ones sharing the link and presumably see it as promotion, not direct payout).

---

## 5. Songkick

- **Ownership:** Acquired by **Warner Music Group** in July 2017 for **$5 million** — WMG bought the concert-discovery app/website and the Songkick trademark, explicitly *not* the former ticketing business (Crowdsurge) or its Ticketmaster/Live Nation antitrust litigation. Now run under WMG's WEA (artist/label services) division.
  Sources: [Variety — "Warner Music Group Acquires Select Songkick Assets"](https://variety.com/2017/music/news/warner-music-group-acquires-select-songkick-assets-1202495937/); [Digital Music News — same](https://www.digitalmusicnews.com/2017/07/17/warner-music-group-songkick/); corroborated by an SEC 8-K filing. Read via search 2026-09-24, dated 2017 — **this is old (2017) but the acquisition fact itself doesn't go stale**; what's newer and matters more is the 2026 Spotify/Bandsintown replacement above, confirming Songkick has since lost its flagship streaming-platform integration even under WMG ownership.
- **API status for new applicants — directly quoted, current:**
  *"We are currently making some changes and improvements to our API. Whilst this work is ongoing, we are unable to process new applications for API keys."*
  Also: *"currently not approving API requests for student projects, educational purposes or hobbyist purposes."*
  And licensing: *"Use of the Songkick API will be subject to the standard terms of our partnership agreement and a license fee."*
  Source: [Songkick — API key request page](https://www.songkick.com/api_key_requests/new), fetched directly, read 2026-09-24. Confidence: **high** — vendor primary, direct quote, and it's a hard no for Kevin's use case (personal, non-commercial, hobbyist) even before the "applications closed" freeze.
- **Referral/affiliate:** none found — Songkick sold off its own ticketing arm in the WMG deal, and no affiliate program is visible on the developer page.

**Bottom line for Kevin:** dead end for this project on two independent grounds — owned by a major label (not the "small independent company" Kevin prefers), and its API explicitly refuses hobbyist/personal applicants right now, separate from the general "we're not processing anything" freeze.

---

## 6. Seated

- **Status/ownership:** Seated is an artist tour-date + direct-ticketing platform. It was sold to Sofar Sounds at some point, and per a company blog post, the **original co-founders bought it back**, making it **"an independent, founder-led company"** again as of the point of that post (co-founder/CEO David McKay, reported via Billboard).
  Source: search synthesis referencing [Seated blog](https://blog.seated.com/) and a Billboard mention, read 2026-09-24. Confidence: **low** — could not get an exact date for the buyback or confirm current 2026 ownership status directly off Seated's own site; the WebFetch to Seated's terms/API docs was not attempted this pass. **Flag: needs a direct fetch of seated.com or blog.seated.com before trusting "independent" as current.**
- **Artist revenue share:** Not directly confirmed this pass. Seated's known industry positioning (from general knowledge, not verified this session) is a fan-data-capture tool for artists (collect emails/texts in exchange for ticket presale access) rather than a per-ticket revenue-share affiliate product — but this is **unverified** and should not be repeated to Kevin as fact without a direct check of Seated's own artist-facing terms.
- **Relevance to Austin listings coverage:** Seated is primarily an artist CRM/marketing tool embedded on artist websites, not a browsable city calendar — likely low relevance as a *discovery* source for "what's playing in Austin this month," more relevant if Kevin wants artist-specific announcement alerts. Worth a second look specifically through that lens (alerting), not through the listings-calendar lens.

**Bottom line for Kevin:** under-researched this pass — flag for a follow-up read directly off seated.com before it's ranked at all.

---

## 7. Showlist Austin

- **Ownership/who runs it:** Independently owned and run by **Tyson Swindell** (with Reggie O'Farrell), a real local husband-and-wife/founder-led operation — not a franchise of a big company. The "Showlist" network also covers Portland, OR and Seattle, built on the same homegrown back-end.
  Source: search synthesis of [Voyage Austin — "Daily Inspiration: Meet Tyson Swindell"](https://voyageaustin.com/interview/daily-inspiration-meet-tyson-swindell/) and [Showlist network home](https://www.showlists.net/), read 2026-09-24. Confidence: medium (local-interest-blog sourcing, not a vendor "about" page — but internally consistent across two independent sources, and matches the domain structure `austin.showlists.net`).
- **How it's compiled:** *"listings compiled from venue calendars, artist announcements, promoter listings, community submissions, and other public sources."* Focus is strictly **live original music** — explicitly excludes comedy, theater, cover bands, and open mic/open jam nights.
  Source: search synthesis, read 2026-09-24, confidence medium (same sourcing as above).
- **API/terms:** No API or developer terms found — this reads as a pure human-curated listings site with a public submission form (`austin.showlists.net/submit/`), not a data product. Confidence: medium — did not directly fetch the site to confirm zero API surface; absence of evidence isn't proof of absence here.
- **Referral/affiliate:** None found — no ticketing or affiliate mechanism surfaced. It's a Patreon-supported labor-of-love calendar (Patreon page found: patreon.com/showlistaustin).

**Bottom line for Kevin:** exactly the kind of "small independent company with a good database" Kevin says he'd rather support — but it's a human-curated website, not an API, so using it means scraping (need to check its own ToS/robots.txt before doing that) or manual review, not clean integration. Good candidate for a direct email/partnership ask rather than a programmatic pull.

---

## 8. Resident Advisor (RA)

- **Ownership:** Not re-confirmed this pass (out of scope depth — flag as unconfirmed). RA is historically known as an independently-run electronic-music publication/ticketing platform; did not verify current 2026 ownership.
- **API:** RA **does not currently publish a general-purpose public developer API.** One old RA tweet (undated in the snippet, appears to be historical) mentions testing an events/charts API and inviting DJs to email for early access — this reads as an old, likely-dead signal, not a live program. All working "RA APIs" found (Apify scrapers, Parse.bot's "RA API") are **unofficial third-party scrapers wrapping ra.co**, not anything RA operates or endorses.
  Source: search synthesis of [Apify — Resident Advisor API](https://apify.com/augeas/resident-advisor/api), [Parse.bot — RA API](https://parse.bot/marketplace/b94a9801-8a5c-490a-9b42-7c41751ebf76/ra-co-api), and an old [RA tweet](https://twitter.com/residentadvisor/status/136804558566457344), read 2026-09-24. Confidence: medium-high on "no current official public API"; low on the old-tweet program ever having shipped broadly.
- **Austin coverage:** Not directly checked this pass. RA is strongest for club/electronic/DJ-driven events, which is a different lane from MUNA-style indie/pop touring shows — worth a direct site check for Austin volume before ranking.
- **Terms/scraping:** Not fetched this pass — RA's own ToS re: scraping is unconfirmed. Given no official API, any use would be scrape-based and needs its own ToS check before building on it.

**Bottom line for Kevin:** likely low-priority for this specific use case (genre mismatch with MUNA-style acts, no official API) — worth a light Austin-volume check but not a deep integration candidate.

---

## 9. 19hz

- **Who runs it:** Volunteer-run. Contact is a Gmail address (`19hzinfo@gmail.com`); the sources page credits "Avery" for technical work and "Kyle and David" for UI support — reads as a small volunteer crew, not a company.
  Source: [19hz — Sources page](https://19hz.info/sources.html), fetched directly, read 2026-09-24, quoted: *"the site is volunteer run"* and new geographic sections get added "when people are willing to put in time to review all the data that comes in." Confidence: high on "volunteer-run," but the page as fetched did **not** contain a terms-of-use, scraping policy, or API/feed mention at all — this is a real gap, not just a low-confidence guess. **Flag: no ToS surfaced — before scraping or building on 19hz, someone needs to look for a ToU/robots.txt directly, because none turned up in this pass.**
- **Texas/Austin coverage:** 19hz does have a dedicated Texas section (`19hz.info/eventlisting_Texas.php`, `pastEvents_Texas.php`) — but it is explicitly **electronic-music-focused** (same genre-scope caveat as Edmtrain and RA), so likely weak on MUNA-style indie/pop coverage specifically, though it may have broader Austin utility depending how the Texas page is organized (didn't fetch the actual listing page this pass to check breadth).
- **API/terms:** No API found; this is a hand-maintained HTML listings site. No terms-of-use page was found in this pass (see flag above).

**Bottom line for Kevin:** same shape as Showlist Austin (volunteer/independent, no API, scrape-or-manual only) but narrower in genre (electronic-focused) and with an unresolved terms gap that needs closing before any scraping.

---

## 10. Austin Chronicle events calendar

- **Ownership:** Austin Chronicle is the long-running local alt-weekly newspaper (independent, Austin-based) — its events calendar is a section of the paper's own site, not a separate company.
- **How listings work:** Free, submission-based, human-curated, printed weekly (Thursdays) on a space-available basis. *"Event submissions are due the Monday of the week prior to the issue in which you wish to have them published."* *"All standard listings are free and printed on a space-available basis... We cannot guarantee publication of any submission."* Reserves the right to reject anything outside Austin/Central Texas or that violates content standards.
  Source: search synthesis of [Austin Chronicle — Add Event](https://www.austinchronicle.com/event-submission/) and the calendar's add-event form, read 2026-09-24. Confidence: medium (search-snippet synthesis, not a direct fetch — didn't hit a 403 concern here but also didn't verify by direct fetch).
- **API:** None found. This is a submission-form + editorially-curated calendar with no developer surface at all.
- **Referral/affiliate:** None found — it's a free community calendar, no ticketing tie-in surfaced.

**Bottom line for Kevin:** solid human-curated local coverage (this is a real, respected local paper, not a content farm) but zero programmatic access — same scrape-or-manual bucket as Showlist Austin and 19hz, without even the small-company personality angle (it's a newspaper section, not a founder's labor of love).

---

## 11. setlist.fm

- **Purpose fit:** Historical/past-show verification only (what did a band actually play, and where/when) — exactly the "MUNA-style verification" use case named in the brief, **not** a forward-looking discovery source for upcoming Austin shows.
- **Terms** (directly quoted off the ToU page):
  - Rate limit: throttled, no back-to-back calls faster than a 3-second interval on transactional pages; **1,440 requests/day** on a standard key (16/sec throttle, 8 concurrent burst, up to 50,000/day on request for a higher limit).
  - **Non-commercial only**: *"You are permitted to use the API solely for non-commercial purposes"* — and explicitly, *"If the primary purpose of your application is to derive revenue, it is considered commercial."* A personal, free, non-monetized app like Kevin's should clear this bar, but flag it: if city-seasons ever adds any monetization (ads, paid tier, anything), setlist.fm access breaks.
  - **No persistent storage**: *"You must make direct server calls to the API... and distribute the...data to end users on your website immediately upon receipt"* — short-lived caching only, no local datastore. This matters for a "past shows this artist has played in Austin" feature: can't build a durable local archive from setlist.fm data, only live-query it each time.
  - Attribution: required on every page using the data, plus the per-setlist attribution link the API response carries must be used, not just a generic footer credit.

  Source: [setlist.fm — Terms of Use](https://www.setlist.fm/help/terms), fetched directly, read 2026-09-24. Confidence: **high** — vendor primary, direct quotes.

**Bottom line for Kevin:** clean, free, self-serve, well-documented — the right tool for "did this band play Austin before / verify past shows," genuinely fits a personal non-commercial app's terms, but explicitly cannot be used to build a stored local archive (must re-query live every time) and cannot be used for forward-looking discovery at all.

---

## 12. PredictHQ

- **What it is:** A large-scale global event-intelligence API (20M+ events, 30,000 cities, 18 categories including concerts) aimed at enterprise use cases like dynamic pricing and demand forecasting — not a consumer concert-discovery product.
  Source: [PredictHQ — Events product page](https://www.predicthq.com/products/events), search synthesis, read 2026-09-24. Confidence: medium (search synthesis, not direct fetch of that specific page).
- **Pricing:** Could not retrieve — the pricing page (`predicthq.com/pricing`) returned an HTTP 405 to the fetch tool (likely requires JS rendering or blocks the fetcher). **Flag: unresolved — needs a re-fetch via a JS-capable tool (e.g., firecrawl) or a manual look**, since PredictHQ is almost certainly priced as an enterprise/usage-based B2B product (the site's framing — "dynamic pricing," "revenue management" — strongly signals this is not built or priced for a hobbyist personal app), but that's an inference, not a confirmed fact this pass.
- **Austin/concert-specific depth:** Not verified this pass — PredictHQ is broad-and-shallow across event categories by design (it also does severe weather, airport delays, holidays), so its concert-specific Austin coverage relative to a music-focused source like JamBase is unconfirmed and could go either way.

**Bottom line for Kevin:** almost certainly wrong-shaped and wrong-priced for this project (enterprise demand-forecasting tool, not a music-listings product) — deprioritize unless the pricing re-check comes back surprisingly cheap.

---

## Cross-cutting notes / surprises

- **Genre-scope trap:** three of the twelve sources (Edmtrain, 19hz, and to a lesser extent Resident Advisor) are electronic/EDM-focused by design. None of them are a strong fit for the exact trigger event (MUNA, an indie-pop band) even though they look like general "concert listings" sources at a glance. Don't let raw source count make the comparison look more balanced than it is for Kevin's actual taste.
- **The single biggest 2025–2026 shift found:** Bandsintown displaced Songkick as Spotify's (and Apple's, and now Amazon's) concert-data backbone in 2026, ending a 13-year Spotify/Songkick partnership. This re-ranks the two relative to each other for *any* "what does the industry actually rely on" argument — but Bandsintown's own public API is still artist-scoped/approval-gated as far as this pass could confirm, so "industry-standard" doesn't automatically mean "usable by us."
- **Independent-company candidates that fit Kevin's stated preference** (small company, real database, not Ticketmaster) are the *hardest* to integrate programmatically: Do512, Showlist Austin, 19hz, and the Austin Chronicle are all human-curated sites with no API — supporting them means either scraping (unverified ToS/legality in three of four cases) or a direct relationship/manual curation, not a clean API pull. The sources with real APIs (JamBase, Edmtrain, Bandsintown-artist-only, setlist.fm, PredictHQ) are exactly the more corporate/commercial end of the list.
- **Two real legal/ToS friction points found**, both worth flagging before building anything: (1) Edmtrain's ToS bans combining its data with other sources into a competing discovery service — directly in tension with a blended multi-source city calendar; (2) setlist.fm bans any persistent local datastore, so it can only ever be a live lookup, never a cached archive.
- **Referral economics, summarized:** none of the twelve sources pay the *artist* directly for a ticket click that Kevin found evidence of. Bandsintown's $2-per-signup AWIN affiliate program pays whoever shares the invite link (could be an artist/promoter, but it's a signup bounty, not a ticket-sale commission). JamBase and PredictHQ are pure B2B data-licensing plays (you pay them, nobody downstream gets a cut of anything). Do512's DoMORE is a comp/discount perk system, not a referral-commission model. The independent/volunteer sites (Showlist, 19hz, Austin Chronicle) have no monetization mechanism at all. **If "send money to artists instead of Ticketmaster" is a real goal, none of these listing companies are actually the lever for that — the lever would be which *ticketing* link Kevin's app points to underneath each listing, which is a separate research question from this one** (this study covered listings/discovery companies only, per the brief).

## Open flags for next pass (don't treat as settled)

1. Bandsintown: confirm whether ANY tier of its API supports query-by-city (not just by-artist) — unresolved, high priority.
2. Do512: confirm live ticket-link affiliate tagging with an actual click-through test; the About/FAQ page 403'd this pass.
3. Seated: under-researched — needs a direct fetch of seated.com's own terms/ownership statement.
4. PredictHQ: pricing page didn't load for the fetch tool (405) — needs a JS-capable re-fetch (firecrawl) or manual check.
5. 19hz: no terms-of-use or scraping policy surfaced anywhere on the site in this pass — needs a direct look before any scraping is considered.
6. JamBase ownership: only Wikipedia/PitchBook-stub level sourcing — didn't confirm current 2026 ownership from a JamBase primary source.
7. Bandsintown ownership ("subsidiary of Lagardère SCA"): third-party aggregator language only, explicitly flagged stale — needs a fresher primary-source check.
