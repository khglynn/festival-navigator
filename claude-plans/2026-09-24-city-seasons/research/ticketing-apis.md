# Ticketing companies: developer access + referral programs (as of 2026-09-24)

Question this answers: where could a small personal app (festival-navigator, used by
Kevin + a handful of friends, non-commercial) get Austin concert listings with buy
links, and who gets paid when a friend buys through our link?

Status: **DONE — first pass complete.** Everything below was read 2026-09-24 unless
noted. APIs and affiliate terms move fast; anything I couldn't confirm on the
vendor's own current page is flagged "stale?" or "third-party, unverified."

Format per vendor: (1) public API + access path, (2) can it answer "all events in
Austin / at venue X" and "all events for artist Y", (3) rate limits, (4) terms that
bind a small non-commercial app, (5) affiliate/referral program, (6) notable
2025–2026 changes.

---

## Quick answer table

| Vendor | Public discovery API? | Access | Austin/venue query | Artist query | Affiliate program | Who gets paid |
|---|---|---|---|---|---|---|
| **Ticketmaster** | Yes (Discovery API) | Self-serve key, instant | Yes (`city`, `dmaId`, `venueId`) | Yes (`attractionId`, `keyword`) | Yes, via Impact | Affiliate account holder (business-oriented, but not gated to businesses on paper) |
| **Live Nation** | Same as Ticketmaster (one company, one API) | — | — | — | — | — |
| **AXS** | No public discovery API | Partner-only, contact sales | Unknown, not for consumer apps | Unknown | Not found | — |
| **SeatGeek** | Yes (Platform API) — but access is now gated | Google Form request, not instant | Yes (by city/venue) | Yes (by performer) | Yes, two programs (Partner Program direct + Impact/FlexOffers affiliate) | You (~$11/sale avg per SeatGeek's own number) |
| **Eventbrite** | Event *search* API killed in 2020 | Self-serve key, but only fetches events you already know the ID/venue/org for | No — can't search by city | Partial — only within a known organizer | Not found | — |
| **DICE** | No public API; GraphQL API exists but is partner-gated (ticket-holder/BI data, not discovery) | Partner-only | No | No | Not found on DICE's own site | — |
| **See Tickets** | No public discovery API found | Private, contact required (owned by CTS Eventim) | Unknown | Unknown | Not found | — |
| **Etix** | Seller/box-office API only (OAuth2, venue credentials) | Partner-only | No (not a discovery API) | No | Not found | — |
| **Prekindle** | No public consumer discovery API found (client-facing API is for their own ticketing clients) | Unclear / client-only | Unknown | Unknown | Not found | — |
| **Tixr** | API exists but scoped to organizers/venues/"approved technology partners" | Partner-only | Unknown | Unknown | Not found | — |
| **Front Gate Tickets** | Folded into Ticketmaster Discovery API as a content source | Same as Ticketmaster | Yes, via Ticketmaster | Yes, via Ticketmaster | Same Impact program (named explicitly) | Same as Ticketmaster |
| **TicketWeb** | Folded into Ticketmaster Discovery API as a content source | Same as Ticketmaster | Yes, via Ticketmaster | Yes, via Ticketmaster | Same Impact program (named explicitly) | Same as Ticketmaster |
| **StubHub** (resale) | Not researched (out of scope for API — affiliate only, see note) | — | — | — | Yes, via Impact/Partnerize-style networks | Third-party affiliate, not source/artist |
| **Vivid Seats** (resale) | Not researched (affiliate only) | — | — | — | Yes, via Impact | Third-party affiliate, not source/artist |

**Bottom line for the sources study:** the only vendor with a genuinely self-serve,
instant, free discovery API that can answer "everything in Austin" and "everything by
artist X" today is **Ticketmaster's Discovery API**, and it already covers Front Gate
Tickets + TicketWeb inventory as part of the same feed (those two are Ticketmaster-
family brands, not separate data sources). SeatGeek's API still exists and is
arguably richer for buy-link/pricing data, but access now goes through a request form,
not an instant key — that's a change worth re-verifying before committing to it as a
primary source. Everyone else on the list (AXS, DICE, See Tickets, Etix, Prekindle,
Tixr) is a seller/venue-facing platform with no consumer discovery API open to a
personal project.

---

## 1. Ticketmaster

### API access
Self-serve: register at the developer portal and you get instant access to the
Discovery and Commerce APIs via a Consumer Key (= your API key), no approval step.
> "Upon registration and obtaining your API key, you will be able to access the
> Discovery and Commerce APIs instantly."
Source: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/ — read 2026-09-24.

### Query Austin / venue / artist
Confirmed via the Discovery API v2 docs:
- City: `?city=Austin&stateCode=TX&countryCode=US`
- DMA (metro area): `?dmaId=324` (example given is LA; Austin has its own DMA id — look up before build)
- Venue: `?venueId={id}`
- Artist/attraction: `?attractionId={id}` or `?keyword=artistname`
Source: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ — read 2026-09-24.

### Rate limits
Default: **5,000 calls/day, 5 requests/second** (one FAQ page says "2 requests per
second" — see disagreement note below). Higher limits available on request if you
comply with ToS, branding guidelines, and "properly represent" Ticketmaster data.
> "5000 API calls per day" / rate limit "5 requests per second"
Source: https://developer.ticketmaster.com/products-and-docs/apis/getting-started/ — read 2026-09-24.
**Disagreement:** the FAQ page states "2 requests per second and 5000 requests per
day" instead of 5/sec.
Source: https://developer.ticketmaster.com/support/faq/ — read 2026-09-24.
→ Report both; confirm the real per-second cap empirically before building (rate-limit
headers on a live call are the ground truth here, not either doc).

### Pagination limit (matters for "get everything in Austin")
> "Deep Paging: we only support retrieving the 1000th item. i.e. (size * page < 1000)"
Source: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/ — read 2026-09-24.
So a single query can only ever return up to 1,000 events — fine for one city/season,
but means date-range or classification slicing is needed if Austin ever has >1,000
tracked events in a window (unlikely for a hand-curated "shows I love" app, but note
it).

### Terms for a small non-commercial app
- Caching: "Cache or store any Event Content other than for reasonable periods in
  order to provide the service you are providing." No fixed hour/day limit given —
  "reasonable" is undefined.
  Source: https://developer.ticketmaster.com/support/terms-of-use/ — read 2026-09-24.
- Must disclose data handling: "disclose in your application through a privacy
  policy or otherwise displayed in the footer of each page, how you collect, use,
  store, and disclose data."
  Source: same, read 2026-09-24.
- No explicit non-commercial exemption or ban found — the risk clause is a broad
  prohibition on replicating "the unique essential user experience of
  Ticketmaster.com," which a small personal listings+alerts app is very unlikely to
  trip, but it's a judgment call, not a bright line.
- FTC all-in pricing rule (effective **May 12, 2025**): Discovery/Top Picks/
  Availability APIs now return `allInclusivePricing: true` for all US events — total
  price including fees, which is actually good for us (no separate fee lookup
  needed).
  Source: found via WebSearch summarizing developer.ticketmaster.com release notes —
  read 2026-09-24, **medium confidence** (search-summarized, not the raw page text;
  worth a direct read of the Discovery Feed release notes before relying on the
  field name).

### Affiliate/referral program
- Network: **Impact** (`app.impact.com/campaign-campaign-info-v2/Ticketmaster-Affiliate-Programdirect.brand`).
  Source: https://developer.ticketmaster.com/partners/distribution-partners/affiliate-sign-up/ — read 2026-09-24.
- Covers North America, LATAM, EMEA, APAC, and explicitly includes **Ticketmaster,
  Ticketweb, Universe, Biletix, Front Gate Tickets, Moshtix, Veeps, Quicket** — i.e.
  Front Gate Tickets and TicketWeb inventory is the *same* affiliate program, not a
  separate signup.
  Source: same page, read 2026-09-24.
- Commission: reported by a third-party affiliate directory as **1% per sale**, with
  **no commission on presales or the first 24 hours of a public onsale**.
  Source: WebSearch summary of uppromote.com/getlasso.co — **low-medium confidence,
  third party, not Ticketmaster's own published rate** (Ticketmaster does not
  publish a rate on its own pages; rates are set per Impact contract). Needs
  confirmation inside the actual Impact application before treating as fact.
- Eligibility: the program's own framing is business/audience-oriented —
  > "targets platforms capable of driving 'distinct and unique audiences' and
  > generating sales — designed for business models, not non-commercial projects."
  Source: interpretive summary of developer.ticketmaster.com FAQ, read 2026-09-24 —
  **this reads more like an inference from tone than a hard rule; the actual
  application form is where eligibility gets decided, and Impact affiliate programs
  in general do accept small/individual publishers all the time.** Treat "personal
  app not eligible" as unconfirmed, not established.
- Display rule found: affiliate links use "your Impact publisher ID to wrap
  destination URLs in Impact click tracking," applied automatically once you have
  an affiliate ID paired with your API key.
  Source: https://developer.ticketmaster.com/support/faq/ — read 2026-09-24.

### 2025–2026 changes
- **US v. Live Nation / Ticketmaster — jury verdict April 15, 2026**: a Southern
  District of New York jury found Live Nation and Ticketmaster liable on all federal
  and state claims for unlawfully monopolizing primary ticketing and amphitheaters,
  and illegally tying amphitheater access to promotion services.
  Source: https://www.lexology.com/library/detail.aspx?g=26305af6-124f-461e-8855-e1338f6abf8d and https://ag.ny.gov/press-release/2026/attorney-general-james-and-coalition-states-win-trial-against-live-nation-and — read 2026-09-24.
- **DOJ settled separately, mid-trial, March 9, 2026** (Notice of Settlement), with
  a **Proposed Final Judgment filed June 12, 2026**. 33 states + DC continued to
  trial without the DOJ.
  Source: https://www.justice.gov/atr/case/us-and-plaintiff-states-v-live-nation-entertainment-inc-and-ticketmaster-llc — read 2026-09-24 (page lists filing dates; I could not read the PDF body itself, so the *content* of the data-access requirement below is via search summary, not the primary document text — **flag as medium confidence, re-read the actual PDF before quoting it anywhere durable**).
- **Data/API-relevant remedy** (per search-summarized reporting on the settlement):
  Live Nation is required to build technology letting major concert venues on
  Ticketmaster's back end sell/distribute primary tickets through **third-party
  marketplaces**, effectively opening up parts of the platform. Also: a $280M state
  settlement fund, divestiture of 13 exclusive amphitheater booking deals, and fees
  capped at 15% of face value.
  Source: search-summarized from federalregister.gov and thompsoncoburn.com, read
  2026-09-24 — **medium confidence**, needs a direct read of the Federal Register
  notice (docket 2026-13623) before treating exact terms as final; also under Tunney
  Act review and likely appeal, so "final" is years away (commentary estimates no
  resolution before 2028).
  → **This is the single most consequential 2025–2026 development for this project's
  data strategy**: if third-party marketplaces get real API-level access to
  Ticketmaster/Live Nation's back end as a remedy, that could eventually widen what a
  small app can plug into beyond the existing Discovery API — but it's not live yet
  and won't be for a while given the appeal timeline.
- FTC all-in pricing rule (May 12, 2025) — see above, already reflected in the API.
- Discovery Feed: XML format deprecated (CSV/JSON only going forward);
  `officialTicketer` field renamed to `officialSeller`; International Discovery API
  being consolidated into the main Discovery API.
  Source: WebSearch summary of developer.ticketmaster.com release notes, read
  2026-09-24 — medium confidence, not the raw changelog text.

---

## 2. Live Nation

Live Nation Entertainment is the parent company; **Ticketmaster is its ticketing
subsidiary and there is no separate "Live Nation API"** — Live Nation venue/show data
is what flows through the Ticketmaster Discovery API (and through the Live Nation
consumer site, which itself runs on Ticketmaster's ticketing tech). I found no
distinct Live Nation developer portal, consumer API, or affiliate program separate
from Ticketmaster's.
Source: general search across developer.ticketmaster.com and Wikipedia corporate
history — read 2026-09-24, **medium-high confidence** (well-established public
fact — Live Nation and Ticketmaster merged in 2010 — but I did not find one single
vendor page that says "these are the same API" in so many words; it's an inference
from Ticketmaster's docs referring to "Ticketmaster, Live Nation, and our other
brands" collectively).
→ **Practical answer: treat "Live Nation" and "Ticketmaster" as one row for API and
affiliate purposes.** The DOJ/states case above (which is against both entities
jointly) reinforces that they operate as a single ticketing business today.

---

## 3. AXS

- **Owned by AEG** (wholly owned subsidiary since AEG bought out Outbox's stake in
  Sept 2019) — independent of Ticketmaster/Live Nation, but not an independent
  *company* in the "small/scrappy" sense; it's the ticketing arm of the other major
  concert promoter (AEG Presents).
  Source: https://aegworldwide.com/press-center/press-releases/aeg-purchases-all-outstanding-shares-axs and https://en.wikipedia.org/wiki/AXS_(company) — read 2026-09-24.
- **No public consumer/discovery API.** AXS's developer-facing pages target box
  office/venue partners (access control, redemption), not general API consumers.
  > "AXS does not currently offer a public events discovery API... existing developer
  > tools are scoped to venue operator use cases such as access control and ticket
  > redemption."
  Source: WebSearch summary citing solutions.axs.com/us/partnerships-integrations —
  read 2026-09-24, **medium confidence** (search-summarized from a third-party
  MoEngage partner-guide page + AXS's own partnerships page, not a direct fetch of
  AXS's page itself — worth a direct read before finalizing).
- Access path if you wanted in: contact the AXS partnerships team directly for
  "bespoke API access" — this is a business-development conversation, not a
  self-serve signup.
- **No affiliate/referral program found.** Nothing on AXS's own site suggesting a
  publisher/affiliate program exists (unlike Ticketmaster, SeatGeek, StubHub, Vivid
  Seats, all of which run one through Impact or similar). Their partnership energy
  in 2026 is going toward the "Tickets for Good" charity-access program (expanded to
  UK Feb 2026, Germany later in 2026), which is unrelated to affiliate monetization.
  Source: https://solutions.axs.com/us/2026/02/25/axs-expands-tickets-for-good-partnership/ — read 2026-09-24.

---

## 4. SeatGeek

### API access — **this is the notable finding for SeatGeek**
The SeatGeek Platform API is real and well-documented in spirit ("canonical dataset
of live events... performer and venue information, seating maps, ticket pricing"),
but the current developer portal (`developer.seatgeek.com`, a Kong-hosted portal at
`portal.seatgeek.com`) is **not instant self-serve** — it requires either a login to
an existing developer account or a **"Get Access" Google Form** request:
> Portal front page: "View APIs" / "Get Access" (linking to a Google Form),
> last modified per page metadata 2026-04-06.
Source: https://portal.seatgeek.com/ — read 2026-09-24 (live fetch).
> Login page: "If you are unsure why you are on this page, have questions, or need
> access to the SeatGeek public platform APIs, please send an inquiry to
> tech-architecture@seatgeek.com"
Source: https://developer.seatgeek.com/ (redirects to the login page) — read
2026-09-24 (live fetch).
A third-party API cataloguer (api-evangelist) independently notes "**API V1 is
officially deprecated**."
Source: WebSearch summary of github.com/api-evangelist/seatgeek — read 2026-09-24,
**low-medium confidence** (third party, not SeatGeek's own changelog — but
consistent with the gated portal I fetched directly).
→ **This looks like a real 2025–2026-era shift** from the old, well-known "just grab
a client_id" SeatGeek API to something closer to an approval-gated model. Flag as
"stale? — confirm before assuming self-serve," but my own direct fetch of the
current portal supports it being gated *now*.

### Query Austin / venue / artist
Historically (and presumably still, once access is granted) the API supports
events-by-performer and events-by-venue/city queries — this is the whole point of
the "canonical dataset" pitch. I was not able to pull current parameter-level docs
(they sit behind the gated portal), so **treat query shape as likely-yes but
unverified at the parameter level** — re-check once/if access is granted.

### Rate limits, caching/display terms
Not retrievable without portal access — same gating problem. Flag as an open item if
SeatGeek becomes a real candidate.

### Affiliate/referral program — SeatGeek runs two, and they're different
1. **SeatGeek Partner Program** — direct monetization, described as earning money
   "every time one of your users buys tickets," with SeatGeek's own stated average:
   > "Current members earn an average of $11 per sale generated."
   Source: https://seatgeek.com/build — read 2026-09-24 (live fetch).
   Signup funnels through the same Impact program below (see next bullet) or an
   Impact-publisher-account email (`seatgeek_affiliate@newengen.com`).
2. **Affiliate program via Impact / FlexOffers** — standard cost-per-acquisition
   affiliate marketing, run by newengen.com on SeatGeek's behalf.
   > "please visit our affiliate provider Impact to sign up as a publisher"
   Source: https://seatgeek.com/blog/seatgeek-partner-program-instructions-info —
   read 2026-09-24 (live fetch). Note: this SeatGeek blog post is dated **March 12,
   2020** — old, but it's still the live page SeatGeek links from seatgeek.com/build
   today, so treat the *mechanism* (Impact signup) as current even though the page
   itself is stale.
   Cookie window reported elsewhere as **2 days** — **low confidence, third-party
   (uppromote.com), not confirmed on a SeatGeek page.**
- Who gets paid: **you** (the referring app/publisher), same as every affiliate
  program in this survey — not the artist, not the source venue.

### 2025–2026 changes
- The API-access gating (login/request-form model replacing an apparently more open
  older API) is the headline change, dated by page metadata to **April 2026** at the
  latest, though I can't pin exactly when it started. Worth a direct email to
  `tech-architecture@seatgeek.com` if SeatGeek becomes the pick — that's literally
  the instruction on their own login page.
- June 2025 SeatGeek/Philadelphia Union sports partnership announcement turned up in
  search but is not relevant to API or affiliate terms — noted only to explain why
  it appeared in results.
  Source: https://www.businesswire.com/news/home/20250617960607/en — read 2026-09-24, not otherwise used.

---

## 5. Eventbrite

### API access
Eventbrite's public **event search API was shut down years ago, not in 2025–2026** —
important to get the timeline right since the brief asked about 2025–2026 changes
specifically:
> "Effective December 12, 2019, Eventbrite removed public access to the Event Search
> API (GET /v3/events/search/). After February 20, 2020, all requests... were to be
> denied."
Source: WebSearch summary of github.com/Automattic/eventbrite-api issue #83 and
Eventbrite's own developer changelog — read 2026-09-24, **medium-high confidence**
(consistent across multiple independent threads/issues from the actual shutdown
period, though I did not pull Eventbrite's changelog page text directly — worth one
direct read of https://www.eventbrite.com/platform/docs/changelog before finalizing).
- **What remains**: get an event by known ID, list events by venue ID, list events
  by organization ID — i.e. you can only pull events you already know how to
  address, not search "everything in Austin."
- **For city-wide discovery, Eventbrite is a dead end** unless we're willing to
  scrape or use a third-party aggregator that already indexes Eventbrite listings.

### Affiliate/referral program
Nothing found. Eventbrite is a ticketing/registration platform for event *creators*
(mostly smaller/DIY events, not primarily the touring-artist concerts this project
cares about); I found no publisher affiliate program on Eventbrite's own site.

### 2025–2026 changes
None specific to 2025–2026 found — this is old news (2019–2020), correctly excluded
from "recent" by anyone reading Eventbrite's actual timeline. Flagging explicitly so
nobody later cites this as a *new* 2026 development.

---

## 6. DICE

### API access
DICE's only documented API surface is a **partner-gated GraphQL "Ticket Holders"
API** (`partners-endpoint.dice.fm/graphql`), authenticated with a MIO-issued Bearer
token, meant for **promoters/venues who already sell through DICE** to pull their
own attendee/sales data — not a consumer discovery API and not something a listings
app could use to find "what's playing in Austin."
> "DICE Ticket Holders is a GraphQL API that allows downstream systems to query...
> entities related to a partner's events" — "access is partner-gated."
Source: https://partners-endpoint.dice.fm/graphql/docs/index.html (via WebSearch
summary) — read 2026-09-24, **medium confidence**, page itself carries a July 5,
2026 modified date per the summary, so this is current, but I did not fetch it
directly (it's an authenticated docs surface).
- No public event-search endpoint found anywhere on dice.fm.

### Affiliate/referral program
**Not found.** DICE's whole brand positioning is anti-scalping / fair pricing / "no
bots," and its "Work With Us" pages target **artists, promoters, and venues**
(booking DICE as their ticketing provider), not publishers looking to earn a
referral cut. I looked specifically for a fan-facing "invite a friend" credit
program and a business affiliate program; found neither on DICE's own site. A
third-party listing for "Dice Affiliate Program" via FlexOffers turned out to be a
**different Dice** — Dice.com, the tech-jobs board — not dice.fm at all. Flagging
that mixup explicitly since it's an easy mistake to make searching "dice affiliate
program."
Source: https://www.flexoffers.com/affiliate-programs/dice-affiliate-program/ — read
2026-09-24 (confirmed it's the jobs site, not the ticketing company).

### 2025–2026 changes
Nothing notable found beyond the July 2026 partner-API docs update noted above.

---

## 7. See Tickets

- **Owned by CTS Eventim** (acquired June 2024) — a large European ticketing group,
  not independent.
  Source: WebSearch summary of Wikipedia/See Tickets acquisition coverage — read
  2026-09-24, medium confidence (not a primary CTS Eventim source, but well-attested).
- **No public discovery API.** Search results describe it as a private API —
  > "you need to contact Paylogic or SeeTickets to get access to it."
  (Paylogic is another CTS Eventim ticketing brand, which explains the joint
  reference.)
  Source: WebSearch summary of apitracker.io listing — read 2026-09-24, **low-medium
  confidence**, third-party API cataloguer, not See Tickets' own page — I could not
  find a See Tickets developer portal to confirm directly.
- **No affiliate program found.**

---

## 8. Etix

- **Seller/box-office API only.** Every endpoint requires OAuth2 password-grant
  using venue/box-office client credentials; even the nominally "public" namespace
  401s:
  > "Every endpoint requires OAuth2 password-grant with venue/box-office client
  > credentials (only GET /v3/timestamp is open; even /v3/public/* returns 401
  > unauthorized_request)."
  Source: WebSearch summary citing github.com/chrischall/etix-mcp docs — read
  2026-09-24, **medium confidence** (this is someone's independent MCP-server
  project documenting Etix's real API behavior from the seller side, which reads as
  credible technical detail, but it's not Etix's own marketing page).
- Etix does run an **"Event Discovery Network"** — but that's Etix distributing its
  own venues' events to *other* ticketing/discovery partners, not an API a small app
  can plug into.
  Source: https://hello.etix.com/etix-event-discovery-network/ — read 2026-09-24 (URL confirmed via search, page not directly fetched).
- **No affiliate program found.**

---

## 9. Prekindle

- Dallas, TX-based; used by a number of Texas indie/mid-size venues (relevant to
  Austin's local-show layer, not just touring-artist amphitheater shows).
- Prekindle advertises "an open API" — but the framing is about their own ticketing
  clients integrating third-party services (Stripe, WordPress, Spotify, Facebook,
  Intellitix, ToneDen) **into** Prekindle, not a public discovery feed **out of**
  Prekindle for third parties to consume.
  Source: WebSearch summary of prekindle.com/features — read 2026-09-24, medium
  confidence.
- I did not find a public events-search endpoint, developer portal, or terms page.
  A third-party ("ticketsdata.com") claims to scrape Prekindle event data — that's a
  scraping/aggregation business, not evidence of an official API.
- **No affiliate program found.**
- **Relevance flag for the sources study**: if Austin's smaller/indie venue layer
  (the shows most likely to be the ones Kevin "just misses," like a mid-size club
  booking) leans on Prekindle rather than Ticketmaster/AXS, city-wide discovery may
  need either (a) a manual per-venue watch list, or (b) a scraping approach —
  neither of which this vendor-API survey solves. Worth raising on the direction
  page.

---

## 10. Tixr

- API is **scoped to organizers, venues, and "approved technology partners"** —
  not a public discovery API.
  Source: WebSearch summary of stripe.partners/directory/tixr-2 and
  apitracker.io/a/tixr — read 2026-09-24, medium confidence.
- Has a developer portal (`tixr.com/developers`) and offers webhooks/integrations,
  but the framing throughout is B2B (embed *your own* ticketing, not discover
  *others'* events).
- Pay-per-use pricing model mentioned for the commerce side; not relevant to a
  read-only discovery use case even if access were granted.
- **No affiliate program found.**

---

## 11. Front Gate Tickets

**Not a separate vendor for our purposes.** Front Gate Tickets is a Ticketmaster-
family brand — its inventory flows through the Ticketmaster Discovery API as one of
the content sources, and it's explicitly named in the Ticketmaster affiliate
program's list of covered brands.
Source: developer.ticketmaster.com (Discovery API docs + affiliate sign-up page,
both read 2026-09-24 above under Ticketmaster). → See Ticketmaster section; no
separate access path or affiliate signup exists.

---

## 12. TicketWeb

**Same situation as Front Gate Tickets** — a Ticketmaster-family brand, folded into
the Discovery API and the same Impact affiliate program.
Source: same as above (Ticketmaster section). → See Ticketmaster section.

---

## 13. StubHub (resale)

Out of primary scope for the API question (resale marketplaces don't have "the"
event — they resell tickets already sold elsewhere), covered only for the affiliate
angle per the brief.

- Affiliate program exists, commission and cookie-window figures **disagree across
  third-party sources**:
  - One source: "3.2% commission... 30-day cookie window."
  - Another: "4% on all events except MLB (0.8%)."
  Source: both from WebSearch summary of uppromote.com/getlasso.co/flexoffers.com —
  read 2026-09-24, **low confidence, third-party only** — I did not find StubHub's
  own affiliate program page to resolve the disagreement; report both, don't pick
  one.
- Commissions paid "on the ticket price and StubHub fees, excluding discounts and
  taxes"; cancelled/refunded orders don't count.
  Source: same search summary, read 2026-09-24, low-medium confidence.
- **Kevin's values flag (per the brief): resale is a values question.** StubHub is a
  secondary marketplace — money from a StubHub affiliate link goes to StubHub (and
  the reselling ticket-holder), not the artist or the original small venue/box
  office. Worth surfacing explicitly on the direction page rather than quietly
  defaulting to "whichever pays best."

---

## 14. Vivid Seats (resale)

Same scope note as StubHub.

- Affiliate program runs through **Impact**, confirmed on Vivid Seats' own page:
  > "Sign Up to be a Partner" (via Impact) — "30-day traffic cookies."
  Source: https://www.vividseats.com/affiliates — read 2026-09-24 (live fetch).
- **Commission rate could not be confirmed on Vivid Seats' own page** (it wasn't
  stated in the fetched content) — third-party aggregators disagree wildly: 6%
  (one source), 0.8–1.6% (another), 2% flat (a third).
  Source: WebSearch summary of getlasso.co/taprefer.com, read 2026-09-24, **low
  confidence, third-party, materially disagreeing figures — do not use any single
  number without confirming inside the actual Impact program terms.**
- Same resale values-flag as StubHub applies.

---

## Open items / what a direct-code-access pass should confirm before building

1. **Ticketmaster's real per-second rate limit** — getting-started page says 5
   req/sec, FAQ page says 2 req/sec. Confirm empirically with a live key.
2. **SeatGeek's actual current access process** — direct portal fetch shows a
   gated "Get Access" form today; email `tech-architecture@seatgeek.com` if SeatGeek
   is still in the running after the direction page, since query-shape and rate-
   limit docs sit behind that gate.
3. **Read the actual DOJ Proposed Final Judgment PDF** (filed June 12, 2026, docket
   2026-13623 in the Federal Register) before citing specific API/data-access remedy
   language anywhere durable — everything above on that point is search-summarized,
   not read from the primary document.
4. **Austin's DMA id** for Ticketmaster's `dmaId` parameter — not looked up this
   pass; `city=Austin&stateCode=TX` is the simpler, already-confirmed query shape
   and is probably sufficient.
5. **Prekindle / small-venue coverage gap** — no API vendor in this survey solves
   discovery for Austin's smaller indie venues if they route through Prekindle,
   Etix, or Tixr rather than Ticketmaster/AXS/SeatGeek. This is a real gap for "never
   miss a show," not just a nice-to-have, and belongs on the direction page as its
   own open question (manual venue watchlist vs. scraping vs. accepting the gap).

## Citation confidence legend
- **Live fetch (high confidence)**: I directly fetched the vendor's own current
  page — marked "(live fetch)" above.
- **WebSearch summary of vendor page (medium-high)**: a search tool summarized a
  vendor's own page without me reading the raw text — flagged per-claim.
- **WebSearch summary of third party (low-medium)**: an affiliate directory,
  aggregator, or independent API cataloguer, not the vendor — flagged per-claim,
  generally the affiliate commission-rate numbers throughout this doc.
