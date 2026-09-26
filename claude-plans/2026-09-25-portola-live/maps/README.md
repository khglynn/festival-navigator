# Portola Weekend — Folsom & Afters map layers

Built 2026-09-26 from `data/festivals/portola-2026.json` on main (v102) by
`gen.py` beside this file; re-run it after a data change. 130 importable rows
across Thu Sep 24 – Sun Sep 27, 2026, San Francisco, plus 3 TBA-venue parties
listed separately below. (A first pass read a stale local checkout that
predated the Folsom weekend and found 10 Folsom entries instead of 64; read
festival data from `origin/main`, not whatever a checkout has.)

## How to import into Google My Maps

1. On a laptop (import is desktop-only), go to **mymaps.google.com** → **Create a new map**.
2. For each CSV below, click **Import** on a layer (the first layer is
   created for you; click **+ Add layer** for each additional file).
3. When asked which columns to use: pick **Address** for "position on map"
   (not Venue — Address has the full geocodable street address) and
   **Name** for the title/placemark label.
4. Rename each layer to the file's name (Google defaults to the file name
   anyway, so this is usually automatic) — e.g. "Fri Afters", "Sat Folsom".
5. Repeat for all 7 files. That's 7 layers on one map, well under Google
   My Maps' 10-layer limit.

To color pins by time of day: on each layer click **Uniform style** → **Style by data column: Time band**.

On your phone the finished map opens in the Google Maps app (**You → Maps**, signed in to the same Google account).

Once imported, click any pin to see Start/End time, the Time band, and a
link to the event page (tap the link text to open it).

## The files (7 CSVs, one per night + type)

| File | Rows | What |
|---|---|---|
| `Thu Afters.csv` | 7 | Thu Sep 24 afters (Portola Week kickoff night — Soulwax, Club Six lineup) |
| `Fri Afters.csv` | 21 | Fri Sep 25 afters (incl. Horse Meat Disco @ Public Works, also a Folsom event — see below) |
| `Fri Folsom.csv` | 18 | Fri Sep 25 Folsom-weekend parties |
| `Sat Afters.csv` | 15 | Sat Sep 26 afters |
| `Sat Folsom.csv` | 23 | Sat Sep 26 Folsom-weekend parties |
| `Sun Afters.csv` | 25 | Sun Sep 27 afters |
| `Sun Folsom.csv` | 21 | Sun Sep 27 Folsom Street Fair + parties |
| **Total** | **130** | |

**Horse Meat Disco** (Public Works, Fri 9 PM–3 AM) is billed as both an
afters party and a Folsom event in the source data (`day: "Afters & Folsom"`),
so it appears once in `Fri Afters.csv` and once in `Fri Folsom.csv` — not a
duplicate, that's one party wearing two hats.

**Two entries land on a Saturday/Sunday file by clock time that reads
"wrong" — this is intentional, straight from the source data's own
convention:** Aftershock (Sat Folsom, 3 AM–10 AM) and NOCTURNAL EXTREME (Sun
Folsom, starts 3 AM) are both actually the small hours of the *next*
calendar day (Aftershock is really Sunday morning; NOCTURNAL EXTREME is
really Monday morning), but the festival data files them under the night
they're the after-party FOR, and the app's own clock rolls the "day" over
at 5 AM rather than midnight for exactly this reason. Left them exactly as
the source files them.

**Row-count check:** the live JSON has 67 Afters + 64 Folsom + 1 combo
("Afters & Folsom") = 132 entries matching this task's filter. 3 of those
have no venue address (see TBA list below) and are excluded from their
CSV; the 1 combo entry appears in two files. 132 − 3 + 1 = 130, matching
the total row count above (verified against every file's `wc -l`).

## Columns

- **Name** — the party or artist/act name, exactly as the source (and, for
  Folsom-weekend parties, the party's own event page) prints it.
- **Price** — the cheapest ticket on sale when it was checked (the festival
  file's `tickets.price` and `checked` date; most were checked early Sat Sep 26,
  so a price can have moved since). "Sold out" comes from `TIX-PRICES.md`
  beside this folder (a sold-out show had its tickets link removed). "Tix,
  price not found" means a tickets link exists but no price could be read;
  "No online tix" means there is no tickets link at all (often door or free).
  Acts in one show share its price.
- **Venue** — venue name.
- **Address** — street address for geocoding (source noted below).
- **Start** — the app's start time; a leading `~` means the source data
  flags it as approximate (`approx: true`), same convention the app uses.
- **End** — closing time; `~` means the source's `closeApprox` flag is set.
  Blank means no close time is published for that entry (2 cases this
  round: RATED X and NOCTURNAL EXTREME — the source note says these are
  the only two Sunday Folsom entries with no printed end, and it stays
  unprinted rather than guessed).
- **Time band** — for **Folsom** rows: one of six bands based on start
  time — Daytime (starts 11 AM–5:59 PM), Evening (6–8:59 PM), 9 PM, 10 PM,
  Late (11 PM–12:59 AM), After-hours (1–5:59 AM). This matches the live
  file's own `dayMeta.Folsom.layout: "by-time"` flag — Folsom is meant to
  be read as a by-time list, and these are the same six words. For
  **Afters** rows: the literal start hour instead (e.g. "10 PM", "1 AM") —
  afters already have precise times, so a vague band would throw away
  information; this column just gives you the hour to sort/color pins by.
- **Link** — the event's ticket/info page, when the source data has one.

## Addresses — sources

All 42 venues used across these 132 entries start from the `venues{}`
map-link baked into `the festival file` (researched 2026-09-16, and
independently re-confirmed for several of these exact venues by the file's
own very detailed meta note as the Folsom-weekend parties were added
2026-09-25 — e.g. it explicitly names Aftershock's address and says the
Kink.com Penthouse party is "at Kink.com's new space at 1717 Mission St"
and that "Party On The Plaza is on the Eagle Plaza outside the SF Eagle").
I independently re-verified every one of the 39 addressable venues against
the venue's own site, Yelp, Facebook, or (for public spaces) a city/BID
page via web search 2026-09-26, and picked up ZIP codes along the way:

**Original 18 (carried over, all still verified):**
DNA Lounge 375 11th St · SVN West 10 South Van Ness Ave · The Midway /
888 Garage 900 Marin St · 1015 Folsom 1015 Folsom St · SF Eagle
398 12th St · City Nights SF 715 Harrison St · Audio 316 11th St · Club
Six 60 6th St · Great American Music Hall 859 O'Farrell St · Monarch
101 6th St · Pier 80 (loyalty invite) 401 Cesar Chavez St · Public Works
161 Erie St · Regency Ballroom 1300 Van Ness Ave · Rickshaw Stop 155 Fell
St · The Great Northern 119 Utah St — all San Francisco, CA.

**New in the live file (Folsom-weekend expansion):**

| Venue | Address | Source |
|---|---|---|
| Mr. S Leather | 385 8th St, SF 94103 | mr-s-leather.com |
| Folsom Street Community Center | 1286 Folsom St, SF 94103 | folsomstreet.org/center (its own lease announcement) |
| Kink Store | 224 6th St, SF 94103 | dothebay.com venue page |
| Power Exchange | 220 Jones St, SF 94102 | powerexchange.com/location |
| Beaux | 2344 Market St, SF 94114 | beauxsf.com + Yelp |
| Powerhouse | 1347 Folsom St, SF 94103 | powerhousebar.com |
| QBar | 456 Castro St, SF 94114 | qbar-sf.com |
| SF Mint | 88 5th St, SF 94103 | thesanfranciscomint.com |
| Jolene's | 2700 16th St, SF 94103 | jolenessf.com |
| F8 | 1192 Folsom St, SF 94103 | feightsf.com |
| Mayes Oyster House | 1233 Polk St, SF 94109 | mayessf.com |
| Leather District Monument | 82 Ringold St, SF 94103 | see doubtful note below (it's an alley memorial, not a street address) |
| The Blackdoor | 288 7th St, SF 94103 | not independently confirmed — see doubtful note |
| SOMArts | 934 Brannan St, SF 94103 | somarts.org/visit-us |
| Kink.com Penthouse | 1717 Mission St, SF 94103 | SF Chronicle / SFist coverage of the building sale, corroborated by this file's own meta note |
| The Foundry | 1425 Folsom St, SF 94103 | thefoundry.club + Yelp |
| Eagle Plaza | 398 12th St, SF 94103 | somawestcbd.org + eagleplaza.org — same address as SF Eagle, since the plaza sits right outside it (confirmed by this file's own meta note) |
| Oasis | 298 11th St, SF 94103 | sfoasis.com |
| Transform1060 | 1060 Folsom St, SF 94103 | transform1060.org |
| Lone Star Saloon | 1354 Harrison St, SF 94103 | lonestarsf.com |
| Halcyon | 314 11th St, SF 94103 | Yelp + halcyon-sf.com |
| The Stud | 1123 Folsom St, SF 94103 | studsf.com (its current, reopened-2024 location — worth double-checking if you already had an older Stud address memorized) |

Not independently re-verified (unchanged from the first pass, taken as-is
from the map link, no reason to doubt it): **Folsom St, 8th-13th** — Folsom
St & 9th St, San Francisco, CA 94103 (the street fair itself, a closed
street segment, not a single building).

## TBA / missing addresses — not in any CSV (3, up from 1 last pass)

- **MÜLL** — Fri Folsom, venue "TBA (SF)", 11 PM–6 AM
  (https://ra.co/events/2479736). No venue announced.
- **SayLove: Folsom Edition** — Fri Folsom, venue "TBA (SoMa)", 9 PM–2 AM
  (https://www.gracetowers.com/say-love). Source prints only "SoMa" —
  address goes to ticket holders.
- **MILKED: Folsom Edition** — Sat Folsom, venue "Stopgap", 1 PM–4 PM
  (https://forbiddentickets.com/events/guerilla-wellness/accacd7d8a).
  Source prints only "near Mission & 9th" — same deal, address to ticket
  holders only.

All three have `null` map links in the source `venues{}` on purpose (per
the file's own meta note) — nothing to geocode, so nothing guessed. Add
by hand once a promoter announces.

## Doubtful / lower-confidence items

- **Leather District Monument** is a public art memorial along Ringold
  Alley (between 8th and 9th), not a numbered building — "82 Ringold St"
  drops a pin in the right block but won't resolve to a storefront, same
  caveat as the Folsom Street Fair's own address.
- **The Blackdoor** — I could not independently confirm 288 7th St via web
  search (it has thin web presence; general searches surfaced an unrelated
  restaurant and a music festival of the same name). It IS a real, current
  venue — a 2026 Folsom party guide (andymatic.substack.com) names "Naked
  Social at The Blackdoor" for this exact weekend — so I kept the source
  file's map-link address, just flagging it as the one address in this
  batch I couldn't cross-check myself.
- **Folsom Street Community Center address discrepancy** — the org's own
  page (folsomstreet.org/center) says they signed a lease at 1286 Folsom
  Street, matching the source file's map link, which is what I used. A
  different site (somawestcbd.org, a neighborhood business district
  directory) lists "145 9th Street" for the same org — likely a stale or
  satellite listing. Went with the org's own statement.
- **City Nights SF ZIP** (carried over from last pass) — street address
  confirmed (715 Harrison St), ZIP 94103 is a same-block best guess, not
  independently confirmed.
- **888 Garage house number** (carried over) — its own venue page
  (themidwaysf.com) says 900 Marin St (shared with The Midway next door);
  its Instagram bio says "888 Marin Street." Went with the official page;
  same industrial block either way.
- **Four Afters entries with no published set time** (unchanged from last
  pass) — Start uses doors time instead, marked `~`:
  S.I.M, Espurr, New Nostalgia (Sun Afters, The Midway) and Boys Noize
  (Sat Afters, 888 Garage).
- **RATED X and NOCTURNAL EXTREME** have no End time — not a gap in my
  extraction, the source data itself has no `close` for either (confirmed
  in its meta note: "an end the page does not print stays unprinted").
