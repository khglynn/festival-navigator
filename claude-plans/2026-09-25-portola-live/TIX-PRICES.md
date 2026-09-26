# Ticket prices on the Tix door — working notes (2026-09-26)

Brief: `TIX-PRICES-BRIEF.md`. Branch `data/tix-prices`, based on `data/folsom-all`
(b4f562a). Kevin, from Portola, 12:25 AM PT: "I actually think we never need to
see the name of the site where the tix are sold. No necessary info. Just tix if
we don't know price or Tix $69 for example yeah?" — "some of these events are
expensive."

## Part 1 — the label (code)

Done. `linkOf`/`linksOf` in `js/v3/events.js` now render:
- `tickets` no price → `Tix`
- `tickets.price` ≥ 1 whole number → `Tix $NN`
- `tickets.price === 0` → `Tix free`
- `page` → `Info`

`at` stays in the data (required, provenance) but is no longer shown on the
card; `card-facts.js`'s `sourceDoor` folds it into the accessible label
instead ("Tix $69 — buy tickets at AXS").

Validator (`api/_lib/festival-rules.mjs` `checkLinks`) now accepts
`tickets.price` (integer 0–2000) and `tickets.checked` (real YYYY-MM-DD date),
always together — price without checked or vice versa is an error, same for a
non-integer/out-of-range price or a malformed date. `page` still only takes
`{ url, at }`.

Files touched: `js/v3/events.js`, `js/v3/card-facts.js`,
`api/_lib/festival-rules.mjs`, `api/festival-add.js` (comment only — it
already drops the whole `tickets`/`page` object), `docs/add-a-festival.md`,
`gallery.html` (Channel Tres now carries `price: 45, checked: 2026-09-26` —
one priced door; Overmono stays unpriced — one bare `Tix` door),
`tests/show-links.test.mjs`, `tests/events-wall.test.mjs`,
`tests/browser/show-links.test.mjs`.

Test results: `npm test` — 926 pass, 1 skipped, 1 expected fail
(`tests/app-shell-complete.test.mjs`'s asset-stamp check — expected per the
brief, since `events.js`/`card-facts.js` changed and `scripts/sw-stamp.mjs`
is deliberately NOT run here). `node scripts/validate-festivals.mjs` — 0
errors, 2 pre-existing warnings (unrelated: Flight by Nothing's Sunday
billing, tomorrowland-winter-2027's empty lineup). `npm run test:browser` —
191 pass, 0 fail, including every WebKit case (WebKit 390 NOW cases, WebKit
touch-tap, WebKit mouse/keyboard ceiling cases, WebKit notes-chip case) and
the new door-text cases at 390px/1280px. No WebKit failure to report.

## Part 2 — the prices

One row per show. "Show" = one bill (room + night/date + doors time) — a
price applies to every name on that bill per the existing rule.

Status legend: **on sale** (priced, tickets link kept) · **tier N sold out**
(priced at the cheapest tier still available) · **sold out → removed**
(every tier gone, no resale — `tickets` deleted, page-only door) · **door
only** (venue says so — `tickets` was already absent or removed) · **no
price found** (left as bare `Tix`, tickets link kept).

Research was dispatched as 5 parallel agents (`tix-portola-sat`,
`tix-portola-sun`, `tix-acl-a/b/c`), each scraping seller/listing pages. I
then spot-checked every sold-out claim, every price ≥$100, and the two
flagged ambiguous rows myself with fresh scrapes before applying anything —
see **Methodology corrections** below for what changed and why. The tables
below are the FINAL, applied numbers (not the agents' raw first drafts).

### Portola — Saturday Sep 26 (15 shows)

| Show | Room · time | Price | Source | Status |
|---|---|---|---|---|
| Fcukers (DJ Set) + Chloé Caillet | Public Works · 10 PM | — | DoTheBay | **Sold out** → tickets removed (page-only) |
| Parcels + Velvet Trip | Regency Ballroom · 9 PM | — | DoTheBay | **Sold out** → removed |
| Groove Armada + Ben Sterling | The Great Northern · 10 PM | — | DoTheBay | **Sold out** → removed |
| Max Styler + Airwolf Paradise | Audio SF · 10 PM | — | DoTheBay | **Sold out** → removed |
| jigitz + Clearcast | Monarch · 10 PM | — | DoTheBay | **Sold out** → removed |
| Boys Noize | 888 Garage · 10 PM | — | none | No reliable price (Tixr canvas-rendered; AXS listing Cloudflare-blocked) |
| Magnitude | SVN West · 9 PM | **$111** | Eventbrite (seller) | On sale — "From $110.92" |
| PERVERT XXL (XOXO/Matinée) | The Midway · 10 PM | **$154** | XOXO (seller) | On sale — GA $130 + mandatory 18% fee ($23.40) = $153.40 all-in; Presale tiers sold out |
| Aftershock | City Nights SF · 3 AM | — | none | No reliable price (Eventim walled; listing has no price) |
| Brunch Queens — Folsom Weekend | Mayes Oyster House · 11 AM | **$18** | Eventbrite (seller) | On sale — $17.85 |
| MILKED: Folsom Edition | Stopgap · 1 PM | **$39** | Forbidden Tickets (seller) | On sale — GENERAL $38.53; Early Bird/Advance sold out |
| NAKED SOCIAL FOLSOM SATURDAY | The Blackdoor · 3 PM | — | none | No reliable price (Heylo's sequential tiers $20–$60 conflict with its own "Free–$60.68" summary — ambiguous) |
| US! Folsom (Dark N Dirty) Edition | Beaux · 9 PM | — | none | No reliable price (see flag below) |
| FOLSOM SLUT SATURDAY | Power Exchange · 9 PM | **$24** | Eventbrite (seller) | On sale — "From $23.18" |
| CHUNK Folsom — Bear Playground | F8 · 10 PM | **$60** | CHUNK (seller) | On sale — Tier 3 GA active; Early Bird/1/2 sold out |

Priced 6 · sold out (removed) 5 · no price found 4.

### Portola — Sunday Sep 27, incl. Folsom (17 shows)

| Show | Room · time | Price | Source | Status |
|---|---|---|---|---|
| Overmono (DJ Set) + Ben UFO | Public Works · 10 PM | — | DoTheBay | **Sold out** → removed |
| horsegiirL + VTSS + Two Shell + MGNA Crrrta + S.I.M + Espurr + New Nostalgia | The Midway · 10 PM | — | none | No reliable price (AXS Cloudflare-walled; DoTheBay shows an active "Buy Tickets," not sold out) |
| SG Lewis + Puffie + Starfari | The Great Northern · 10 PM | — | none | Same (AXS walled, active listing) |
| Fatboy Slim + riria | 888 Garage · 10 PM | — | DoTheBay | **Sold out** → removed |
| Silva Bumpa + Dean Turnley + Buck Wilson | Monarch · 10 PM | — | DoTheBay | **Sold out** → removed |
| Azzecca + Ahadadream + Sara Afshar | Audio SF · 9:30 PM | — | none | No reliable price (AXS walled, active listing) |
| JT + Naisha + Michael Milano | Rickshaw Stop · 10 PM | — | none | Same |
| DEVIANTS | SVN West · 7 PM | **$54** | Eventbrite (seller; page IS tickets) | On sale — $53.37–$100, ceil low end |
| OFFICIAL KINK.COM Penthouse Preview | Kink.com Penthouse · 10 AM | **$85** | Eventbrite (seller) | On sale — "From $84.99" |
| BOOF presents MCMLXXXV (Herrensauna) | The Foundry · 11 AM | **$18** | Eventbrite (seller) | On sale — $17.98 |
| CUMUNION — Folsom Edition | Transform1060 · 3 PM | **$45** | Eventbrite (seller) | On sale — $44.52 |
| Hot Tea — Leather Edition | Audio SF · 3 PM | **$34** | Eventbrite (seller) | On sale — "From $33.85" |
| Kinksters Paradise | Kink Store · 6 PM | **$28** | Eventbrite (seller) | On sale — "From $27.24" |
| After Folsom Freak Fest | Power Exchange · 6 PM | **$24** | Eventbrite (seller) | On sale — "From $23.18" |
| DETOX @ Popper Slut Sundays | Beaux · 7 PM | **$0 (free)** | Eventbrite (seller) | On sale — GA free; page describes a separate paid VIP Meet & Greet upsell (see flag) |
| RATED X | City Nights SF · 9 PM | — | none | No reliable price (Eventim walled, Ky Martinez page has no price) |
| Nocturnal Extreme | Halcyon · 3 AM | — | none | Same |

Priced 8 · sold out (removed) 3 · no price found 6.

### ACL Late Nights, Sep 29 – Oct 10 (39 shows with a tickets link)

| Date | Show | Room | Price | Source | Status |
|---|---|---|---|---|---|
| 9/29 | Fcukers + Total Wife | Mohawk Austin | — | none | No price (Etix link dead; only resale marketplaces reachable — not trusted, see methodology) |
| 10/1 | Brandon Flowers + Jess Williamson | Stubb's | — | none | Ticketmaster walled; not trusted (see methodology) |
| 10/1 | Palace + The 4411 | Emo's | — | none | Same |
| 10/1 | Montclair | Stubb's Indoors | — | none | Same |
| 10/1 | The Chainsmokers + Austin Ashtin | The Concourse Project | — | Eventim (seller) | **Sold out** → removed — GA Tier 4 + VIP both sold out on Eventim itself |
| 10/2 | Finn Wolfhard + Malcy | Historic Scoot Inn | — | none | TM walled; not trusted |
| 10/2 | Bleachers + This Is Lorelei | Stubb's | — | none | Same |
| 10/2 | Villanelle | 3TEN | — | none | AXS shows no price at all; honest null |
| 10/2 | BUNT. + Sarah Pederzani | Emo's | — | none | TM walled; not trusted |
| 10/2 | Hunx and His Punx + CorMae | Brushy Street Commons | **$29** | Eventim (seller) | On sale — Advance GA $28.87 |
| 10/2 | Night Tapes + Alice Rivers | Antone's | — | none | TM walled; not trusted |
| 10/2 | Steve Aoki + Elephante + Riot Ten | The Concourse Project | **$70** | Eventim (seller) | On sale — GA Tier 4 $69.85 |
| 10/2 | Grocery Bag | Stubb's Indoors | — | none | TM walled; not trusted |
| 10/2 | Rebecca Black + Bambi | Devil May Care | — | Eventim (seller) | **Sold out** → removed — Eventim itself: "Tickets are not available" |
| 10/3 | CMAT + Fancy Hagood | Historic Scoot Inn | — | none | TM walled; not trusted |
| 10/3 | Parcels + Velvet Trip | Stubb's | — | none | Same |
| 10/3 | Levity + Untitld | Emo's | — | none | TM walled; spot-checked — 3 independent sources gave 3 different numbers ($71/$81/$84), none trusted |
| 10/3 | It's Murph + Nate Band + Dazzle Camouflage | The Concourse Project | — | Eventim (seller) | **Sold out** → removed — GA + VIP both sold out |
| 10/3 | Underscores + Directress + 1x333 | Brushy Street Commons | — | Eventim (seller) | **Sold out** → removed — "no tickets currently available" |
| 10/3 | Almost Heaven | Stubb's Indoors | — | none | TM walled; not trusted |
| 10/4 | Ryan Beatty | Historic Scoot Inn | — | none | TM walled; an unverifiable "not available" claim — left the tickets link in place rather than remove on unconfirmed evidence |
| 10/4 | Rochelle Jordan + Stefon Osae | Antone's | — | none | TM walled; not trusted |
| 10/4 | Suki Waterhouse | Emo's | — | none | Same |
| 10/5 | Saint Motel + The 4411 | Historic Scoot Inn | — | none | Same unverifiable "not available" caution as Ryan Beatty |
| 10/5 | LP | Brushy Street Commons | **$54** | Eventim (seller) | On sale — GA $53.09 |
| 10/6 | Lola Young + Leon Knight | Stubb's | — | none | TM walled; not trusted |
| 10/6 | Annie DiRusso | Stubb's Indoors | — | none | Same |
| 10/8 | The War on Drugs | Fair Market | — | none | Universe link 404s; do512 no price |
| 10/8 | Arcy Drive + Common People | Brushy Street Commons | **$32** | Eventim (seller) | On sale — Advance GA $31.44 |
| 10/8 | World Famous Pets + Elijah Delgado | Antone's | — | none | TM walled; not trusted |
| 10/8 | Sunday (1994) | Stubb's Indoors | — | none | Same |
| 10/8 | Łaszewo + Left Lucid | 3TEN | — | none | AXS checkout gated (429); honest null |
| 10/8 | ¥ØU$UK€ ¥UK1MAT$U | The Concourse Project | **$65** | Eventim (seller) | On sale — GA Tier 2 $64.10, lowest of 3 |
| 10/8 | Jess Williamson | The Continental Club | **$37** | Eventbrite (via affiliate wrapper) | On sale — $36.18 for this exact date/time |
| 10/9 | Noga Erez | Historic Scoot Inn | — | none | TM walled; not trusted |
| 10/9 | BUNT. + DJ Bad Apple | The Concourse Project | — | Eventim (seller) | **Sold out** → removed — GA + VIP both sold out |
| 10/9 | Rodrigo y Gabriela | Emo's | — | none | TM walled; not trusted |
| 10/10 | Claire Rosinkranz | 3TEN | — | none | AXS checkout stuck on a spinner; honest null |
| 10/10 | Don West + Kesmar | Antone's | — | none | TM walled; not trusted |

Priced 6 · sold out (removed) 5 · no price found 28.

### Already page-only (no `tickets` link in the data — nothing to research)

Portola (12): Big Muscle: Bare Chest Calendar (DNA Lounge), Folsom Street Fair
(Folsom St), Real Bad 37 (1015 Folsom), Disco Daddy (SF Eagle), GearedUp Alley
Party (Mr. S Leather), Folsom Street's Miracle Mile walking tour, Twisted
Windows: Folsom Gala (SOMArts), Zoomiez (SF Mint), LICK IT (Powerhouse), Party
On The Plaza: Folsom Edition (Eagle Plaza), FOLSOM SUNDAY (Oasis), screw/nut/
bolt (Lone Star Saloon).

ACL (1): Fcukers at Devil May Care, Oct 10 — page-only (Devil May Care's own
site), no ticket link in the data already.

## Grand totals

Priced: 6 (Sat) + 8 (Sun) + 6 (ACL) = **20 shows**. Sold out → tickets
removed: 5 + 3 + 5 = **13 shows**. No price found (left as bare `Tix`,
tickets link kept): 4 + 6 + 28 = **38 shows**. Already page-only, no research
needed: 13. Total shows in scope: 20+13+38+13 = 84 (matches 71 researched
rows from the 5 agents + 13 already-page-only).

## Methodology corrections (spot-checked before applying)

The 5 research agents' first drafts were NOT applied as-is. I spot-checked
every sold-out claim, every price ≥$100, and both rows the coordinator
flagged, with my own fresh scrapes, and found two real problems:

1. **Resale/aggregator prices were being used as if they were face value.**
   For Ticketmaster-linked ACL shows (TM is 100% walled — confirmed by every
   batch and by my own direct check just now, a 403 "Your Browsing Activity
   Has Been Paused"), the agents had fallen back to third-party resale sites
   (Event Tickets Center, Gametime, TickPick) or aggregator snippets (Jambase,
   a "TM own page via search cache") to still produce *a* number. I
   spot-checked one of these — Levity + Untitld at Emo's, Oct 3 — against
   three independent sources and got three different prices: $71, $81, $84.
   That's not noise, that's proof the method doesn't reliably recover face
   value. **I reversed every ACL row sourced this way back to "no price
   found"** rather than show a friend a number that might be a scalper markup
   or an unrelated resale listing. This dropped ACL from ~30 "priced" rows in
   the first drafts to 6 genuinely trustworthy ones — a big change, but the
   6 that remain are all direct scrapes of the actual named seller (Eventim,
   Eventbrite), which held up consistently everywhere I checked them.
   Jambase/SeatGeek/Gametime/TickPick/Event-Tickets-Center are legitimate
   sites, just not primary box office, and this app's promise is "the
   cheapest ticket you could buy" — not a resale estimate.
2. **A displayed sticker price wasn't the all-in price.** PERVERT XXL
   (XOXO/Matinée, The Midway, Sat) lists GA at "$130.00" with a separate
   "+$23.40 FEES" line right below it (an 18% surcharge, applied uniformly
   across every tier on that page) — the checkout total is $153.40, not
   $130. Corrected to **$154** (ceil). Everywhere else, sellers either showed
   one already-inclusive number (Eventbrite's "From $X" bar, Eventim's ticket
   price) or didn't show a total at all.

Two "sold out" claims I did NOT apply, out of the same caution: **Ryan
Beatty** and **Saint Motel** (both Ticketmaster-linked). An agent reported
TM's own page saying "not currently available online," but since TM is
walled to me directly too, I can't confirm that claim came from TM's real
page rather than an inference from an empty resale listing (which would NOT
mean sold out — most primary tickets never show up on secondary markets at
all). Removing the tickets link is a bigger, more consequential action than
just not showing a price, so both were left as "no price found" with the
tickets link intact rather than risk hiding a real purchase path.

Every OTHER "sold out → removed" call (13 of them) came from the actual
named seller's own page (Eventim saying "tickets are not available" or
showing every tier sold out, or DoTheBay's own ticket-link literally reading
"Sold Out" in place of "Buy Tickets") — all independently re-verified by me
with fresh scrapes for the 8 Portola ones, all direct-seller reads for the 5
ACL ones.

## Flags

- **8 Portola shows are genuinely sold out tonight/tomorrow** (Fcukers,
  Parcels, Groove Armada, Max Styler, jigitz — Sat; Overmono, Fatboy Slim,
  Silva Bumpa — Sun). All reconfirmed live by me minutes before applying —
  worth telling the crew before they show up expecting to buy at the door.
- **AXS and Ticketmaster are effectively unscrapable.** AXS renders a normal
  200 page but never shows price (checkout-only, dynamic); Ticketmaster
  403s every direct hit with a Cloudflare "Your Browsing Activity Has Been
  Paused" page. This isn't new to this task but is worth a durable note for
  future pricing passes — see `helper/guides/` if a similar exercise recurs.
  do512.com, unlike dothebay.com, never carried a price line for ANY ACL
  Fest Nights show in this pass (all 39 were checked) — dothebay does for
  many Portola/Folsom shows sold via Tixr/Eventbrite/etc.
- **Two ambiguous $0 Eventbrite rows, two different calls**: DETOX (Beaux,
  Sun) kept as free — the page's own copy describes a separate paid VIP
  Meet & Greet add-on, which explains why GA reads $0 on the same platform
  that also shows a $23 top-end; US! Folsom (Beaux, Sat) left unpriced — no
  such explanatory copy, and the sub-agent's specific "arrive before 10 PM
  $7.18" tier claim could not be found anywhere in the page's raw HTML
  (Eventbrite's ticket tiers are loaded by a client-side call our scrapes
  don't reach), so I couldn't confirm whether $0 there is the plain GA or a
  narrower conditional tier. Per the coordinator's steer: when in doubt,
  don't show a price that might surprise a friend at the door.
- **Nothing in the final, trusted data exceeds $150** except PERVERT XXL's
  corrected $154 (see above) — every other row is under $150 or unpriced.
- Two Tixr pages (Boys Noize, Sat 888 Garage; the ACL/Portola Overmono link
  before it sold out) render as an unreadable canvas to text scraping —
  noted for any future pass, not actionable here.

## Screenshots (390px, gallery.html)

- `screenshots/tix-price-390-channel-tres-priced.png` — Channel Tres zoom:
  "Tix $45 · Info" (gallery.html's own fixture price, unrelated to the
  research above).
- `screenshots/tix-price-390-overmono-bare-tix.png` — Overmono zoom:
  "Tix · Info" (bare, no price on the gallery fixture).

Both confirm the label logic from Part 1 renders correctly in a real
browser.

## After the merge with v94 (coordinator, 2026-09-26 ~1:50 AM PT)

- **The War on Drugs (ACL, Oct 8, Fair Market): tickets removed.** Its link resolves (through Ticketmaster's affiliate wrapper) to `universe.com/destinationdefendermusicexperience-austin-tx`, which answers 404 — a dead link, so the Info door (Do512) is the only door (the docs' rule).
- **Fcukers + Total Wife (ACL, Sep 29): kept.** The Etix link resolves to the Etix event page (HTTP 202, Etix's bot answer — not a 404), so it is live; it just has no readable price.
- v94 added nine Saturday/Sunday Folsom parties after this pass's base (the shared-room parties). They get their own check below.
