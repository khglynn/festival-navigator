# Folsom weekend events Kevin's friends are sharing

> **Corrected when shipped (2026-09-25, PR #40):** Aftershock is filed under **Saturday** night as `3 AM - 10 AM` — under `night: "Sun"`, `3 AM` resolves to Monday 3 AM, because any time before 9 AM counts as after midnight of its night. MÜLL has a posted end: RA and 19hz print **11 PM – 6 AM**. The shipped names are `MÜLL`, `Big Muscle: Bare Chest Calendar` and `Aftershock`; MÜLL's venue is `TBA (SF)` with a null maps entry.

**2026-09-25, ~5:30 PM PT.** Kevin's raw list, voice-dictated: *"mull,
pervert, aftershock, real bad (from JC), big muscle (from Wolf)."* Two of
the five are already in the app. Three are new. Robert's house parties are
not addable (no public page). Full findings below; the draft JSON fragment
is in `folsom-events.proposed.json` in this same folder — **nothing here has
been applied to the live data yet.**

## The one-line answer

| Kevin said | Real event | Date | Time | Venue | Official Folsom Street Events party? | Confidence | In the app already? |
|---|---|---|---|---|---|---|---|
| "pervert" | **PERVERT XXL** (Matinée Pervert XXL, XOXO Entertainment × Cecil Russell × Matinée) | Sat Sep 26 | 10 PM – 6 AM (posted) | The Midway | No — independent circuit promoter | Certain | **Yes, already there** |
| "real bad (from JC)" | **Real Bad 37** (Grass Roots Gay Rights Foundation) | Sun Sep 27 | 8 PM – 5 AM (posted) | 1015 Folsom | No — independent charity party, 37 years running | Certain | **Yes, already there** |
| "mull" | **MÜLL** (queer underground techno party, residents Fawks + Kudeki) | Fri Sep 25 | 11 PM start (posted); no end printed | **TBA — genuinely unannounced as of this research**, address goes out to ticket-holders day-of | No — independent promoter | High on identity, **low on venue** (see Q1) | No — new |
| "big muscle (from Wolf)" | **Bare Chest Calendar: Charity Event** (Big Muscle + Big Muscle Bears' 26th annual Folsom charity event, benefiting Bare Chest Calendar & PRC) | Sat Sep 26 | 1 PM – 7 PM (posted) | DNA Lounge | No — independent charity/community party | High on identity, **open Q on which name to use** (see Q2) | No — new |
| "aftershock" | **AFTERSHOCK** — 30th anniversary (Ky Martinez Events) | Sun Sep 27 | 3 AM start (posted by promoter); 10 AM close (secondary source only) | City Nights SF (715 Harrison St) | No — independent promoter, longest-running Folsom afterhours | High | No — new |

**None of these five are produced by Folsom Street Events (the nonprofit
that runs the actual street fair Sunday 11 AM–6 PM)** — they're all
independent parties that cluster around the fair, same as everything
already in the Folsom section of the app (BRUT SF, Magnitude, Deviants,
Disco Daddy). That's normal for this weekend; the fair itself is the only
"official" event and it's already in the data as "Folsom Street Fair."

## What's already in the app (no action needed)

Checked `data/festivals/portola-2026.json`'s Folsom section before doing
any web research, per the doc's instructions:

- **PERVERT XXL** — `day: "Folsom", night: "Sat", venue: "The Midway"`,
  10 PM–6 AM. This is Kevin's "pervert." Matches.
- **Real Bad 37** — `day: "Folsom", night: "Sun", venue: "1015 Folsom"`,
  8 PM–5 AM. This is Kevin's "real bad (from JC)." Matches.

Both are also already in the pick-key freeze
(`tests/fixtures/live-pick-keys.json`), so nothing to touch there either.

## The three new ones, in detail

### 1. "mull" → MÜLL (Fri Sep 25)

Voice dictation flattened the umlaut and the party's actual style (MÜLL,
always capitalized) into the plain word "mull" — an easy mishearing, one
syllable, no context clues in speech.

- **What it is:** a recurring queer underground techno night based in SF,
  residents Fawks and Kudeki, "all trash, no class." This edition is their
  Folsom-weekend kickoff, guests Rene Wise + Jen Cardini (both
  Portugal-based), plus Markie, Del, Mexican Jihad.
- **Date/time:** Friday, Sep 25, 2026. RA's own event schema prints a start
  of **11:00 PM** (`startDate: 2026-09-25T23:00:00`). No end time is
  printed anywhere — MÜLL's own copy just says "we will be going late...
  simply poor etiquette to stop the party without a cute ass sunrise,"
  which is vibes, not a clock.
  Source: https://ra.co/events/2479736 (Resident Advisor event page,
  checked the page's own JSON-LD schema.org data, not just the prose)
- **Venue: genuinely unknown.** RA still lists the location as **"TBA - San
  Francisco"** with no street address, as of this research (the day of the
  show). This is normal for this specific promoter — every past MÜLL event
  on their RA promoter page (Pride edition, Year 3, the Juliana Huxtable
  night, the Pornceptual night) also shows "TBA - San Francisco" even after
  the fact, meaning they never even backfill the address publicly. Address
  release is almost certainly done privately to ticket-holders (email/text)
  day-of.
  Source: https://ra.co/promoters/120252 (MÜLL's full RA event history —
  6 of 6 past events show "TBA")
- **Official?** No — independent promoter, not Folsom Street Events.
- **Tickets/page:** Resident Advisor is both the bill and the ticket seller
  here — https://ra.co/events/2479736
- **Confidence: high on "this is the right event," low on venue.** The
  name match to "mull" is about as clean as phonetic mishearings get, and
  the "your Folsom weekend kickoff" framing plus the Friday date line up
  exactly with what a friend would share. The venue gap is real, not a
  research shortcoming — the promoter has never published one.

### 2. "big muscle (from Wolf)" → Bare Chest Calendar: Charity Event (Sat Sep 26)

- **What it is:** the 26th annual charity party thrown by **Big Muscle**
  (BigMuscle.com) and **Big Muscle Bears** — this year's official title on
  both DNA Lounge's own calendar and DoTheBay is "Bare Chest Calendar:
  Charity Event." It benefits the Bare Chest Calendar and PRC (Positive
  Resource Center). Community description: "our big meet and greet before
  Folsom Sunday... we keep the music to background sounds so you can
  actually talk to the people." DJ Euro Steve, plus sets in the Main Room
  and Above DNA.
- **Date/time:** Saturday, Sep 26, 2026, **1:00 PM – 7:00 PM**. Posted
  identically on both primary sources.
  Sources:
  https://www.dnalounge.com/calendar/2026/09-26a.html (venue's own page —
  this is also where the GA-sold-out status below comes from)
  https://dothebay.com/events/2026/9/26/bare-chest-calendar-charity-event-tickets
  (metadata: `startDate: 2026-09-26T13:00-0700`, `endDate:
  2026-09-26T19:00-0700` — same window, independently confirmed)
- **Venue:** DNA Lounge, 375 11th St, SF — already registered in the
  file's `venues{}` map from the existing BRUT SF entry, so no new map
  link needed.
- **Official?** No — independent community/charity party, not Folsom
  Street Events.
- **Tickets:** GA is **sold out** and DNA Lounge's own page says "NO
  tickets will be available at the door" — per `docs/add-a-festival.md`'s
  rule ("leave `tickets` off... a sold-out one with no resale link"), the
  draft correctly has no `tickets` field, only `page`.
- **Confidence: high on the event, open question on the name** — see Q2
  below.

### 3. "aftershock" → AFTERSHOCK, 30 Year Anniversary (Sun Sep 27, early AM)

- **What it is:** the longest-running Folsom afterhours party, thrown by
  **Ky Martinez Events**, celebrating its 30th anniversary this year.
  DJ: Abel Aguilera. Ky Martinez also throws two OTHER parties the same
  weekend (RATED X, Sep 27 9 PM; NOCTURNAL EXTREME AFTERHOURS, Sep 28
  3 AM) — I confirmed AFTERSHOCK specifically is the one Kevin's friends
  mean (30th-anniversary billing matches every secondary source).
- **Date/time:** the promoter's own site prints **"SEPT 27 • 03:00 AM"**
  for AFTERSHOCK specifically (distinct from its sister parties on the same
  page) — this is a posted time, not a guess.
  Source: https://www.kymartinezevents.com/ (read the full homepage, not
  just a search snippet — it lists all three of their Folsom-weekend
  parties with three different times, so getting the right one mattered)
  A secondary aggregator additionally prints a **10 AM close**
  ("3:30 am to 10 am... note - on the Sunday morning BEFORE the fair") —
  not on the promoter's own site, so the draft marks this `closeApprox:
  true` with that page as `closeSource`, per the docs' rule for a close
  that's sourced but not primary.
  Source: https://www.gaytravel4u.com/event/folsom-aftershock/
- **Venue:** City Nights SF, 715 Harrison St, San Francisco — confirmed
  independently by the venue's own site (sfclubs.com), Wikipedia, Yelp, and
  circuitpartyinfo.com's venue card (all four agree on the address).
  Sources: https://sfclubs.com/ ·
  https://en.wikipedia.org/wiki/715_Harrison ·
  https://www.circuitpartyinfo.com/event/aftershock-folsom-30-year-anniversary/
- **Official?** No — independent promoter, not Folsom Street Events.
- **Tickets:** GA presale shows sold out on Eventim, but the ticket page
  is still live with other price tiers (this is "Limited Tickets," not a
  fully closed sale) — kept `tickets` in the draft, but flagging that a
  friend checking today should verify availability before counting on a
  door sale.
  Source: https://www.eventim.us/event/AFTERSHOCK-30-Year-Anniversary-Limited-Tickets/677997
- **Confidence: high**, both on identity and on every field in the draft.

## Rules that bind this (from `docs/add-a-festival.md` and CLAUDE.md)

- **Artist/event names are pick keys forever.** Once these are merged and
  `freeze-pick-keys.mjs portola-2026` is run, the spelling is locked —
  there is no rename path, only orphaning. That's why Q1/Q2 below matter
  enough to ask rather than guess.
- **Folsom is a `date`-anchored... actually `night`-anchored section, per
  entry.** Every existing Folsom entry uses `night` (Fri/Sat/Sun) + `venue`,
  not `date` — the section itself spans a date range in `dayMeta` (`Sep
  25-27`), but each entry says which single night it's on. All three new
  entries follow that same pattern (matches BRUT SF/PERVERT XXL/Real Bad
  37 exactly), not the `date`-anchored pattern ACL's Late Nights uses.
  Aftershock's 3 AM Sunday start is tagged `night: "Sun"` — same convention
  the file already uses for PERVERT XXL (10 PM Sat, running to 6 AM) and
  Real Bad 37 (8 PM Sun, running to 5 AM): the night an entry is tagged
  with is whichever calendar day the party **starts** on.
- **Guessed times get `approx`/`closeApprox` + a `closeSource` that names
  the rule or cites the page** — never silently folded into a clean-looking
  range. Aftershock's close is the one field in this drop that isn't a
  primary-source print, so it's the one field carrying that machinery.
  MÜLL has no close at all rather than a made-up one, per "a show with no
  time at all is fine."
- **Nothing here invents a fact a source didn't state.** Where a source was
  ambiguous or missing (MÜLL's venue, the exact spelling to use for two of
  the three), that's called out as an open question below instead of
  guessed.

## Robert's house parties — confirmed they don't fit

Kevin: *"Robert also knows about house parties for Friday and Saturday
night but I don't think those fit our app."* Agreed, and I didn't find
anything to change that: a house party has no public event page, ticket
link, or fixed venue to register — everything else in this data model
(including the two "no tickets" cases above) still has at least one public
page. Nothing to add here; flagging per the task's ask to confirm rather
than silently drop it.

## Open questions (need Kevin, or whoever applies this draft)

**Q1 — MÜLL's venue is unknown. Ship it anyway with `venue: "TBA (SF)"`
(my draft's default), or hold this one entry until someone at Folsom gets
the address tonight and can confirm it?**
Shipping now means the app can at least show the name/time/tickets link
right away (useful — tonight's the night), but the place line won't open a
map until someone edits it in. Holding means one less card on the wall
until confirmed. My lean: ship it as `TBA (SF)`, since the alternative is
friends not seeing it in the app at all tonight, and the validator only
warns (doesn't error) on a venue with no map entry.

**Q2 — What name goes in for "big muscle"?**
The official 2026 event title (both DNA Lounge's own page and DoTheBay,
independently) is **"Bare Chest Calendar: Charity Event"** — that's what
I put in the draft, since that's literally what the primary sources print,
matching how e.g. "PERVERT XXL" and "Magnitude" are named after what their
own promoters/venues call them, not a generic community nickname. But
Kevin and his friends know it as **"Big Muscle"** — that's the name Wolf
would search for, and the app has no secondary "aka" field to bridge the
two. My lean: use the official title as drafted (matches house style, and
it's what any future search of DNA Lounge's calendar will always confirm),
but a reasonable alternative is a hybrid like **"Big Muscle: Bare Chest
Calendar"** so the searchable name contains what people actually call it.
Either way, whichever name is picked is the one that's locked in forever
once picks start landing on it — worth a second look before merging.

**Q3 — MÜLL's own stylization uses an umlaut (Ü).** The draft uses "MÜLL"
verbatim (matches the promoter's Instagram, RA, and site branding exactly).
That's technically correct but means typing/searching for it from a phone
needs the special character. Plain "MULL" would be easier to type and
search but isn't how the promoter spells it. My lean: keep "MÜLL" — it's
what's actually printed everywhere and this repo's search doesn't fold
diacritics as far as I saw, so an ASCII "MULL" might not even match a
search for "mull" any better than "MÜLL" would.

## Sources consulted (full list)

- https://ra.co/events/2479736 — MÜLL Folsom event page (RA, incl. its
  schema.org JSON-LD for the start time)
- https://ra.co/promoters/120252 — MÜLL's full RA promoter history (used to
  confirm the "TBA" venue pattern is consistent across every past event,
  not a one-off gap)
- https://www.instagram.com/mull.party/?hl=en — confirms handle/branding
  ("MÜLL... Queer Underground Techno... All trash, no class")
- https://andymatic.substack.com/p/folsom-street-fair-party-guide-2026 —
  independent Folsom party guide; found the MÜLL entry and its RA link here
  first, cross-checked against RA directly rather than trusting the guide
  alone
- https://www.dnalounge.com/calendar/2026/09-26a.html — DNA Lounge's own
  page for Bare Chest Calendar: Charity Event (official name, time, DJs,
  sold-out status)
- https://dothebay.com/events/2026/9/26/bare-chest-calendar-charity-event-tickets
  — independent confirmation of name/time/venue
- https://www.gaywhere.app/folsom and
  https://www.instagram.com/p/DcL_f96jPTd/ and
  https://outxout.com/event/big-muscle-party-dore-2026 — secondary
  confirmations that "Big Muscle" is the community name for this same DNA
  Lounge event (used only to confirm identity, not as the sourced name/time
  in the draft)
- https://www.kymartinezevents.com/ — Ky Martinez Events' own site;
  read the full homepage (not a search snippet) to distinguish AFTERSHOCK
  from their two other same-weekend parties (RATED X, NOCTURNAL EXTREME)
- https://www.gaytravel4u.com/event/folsom-aftershock/ — secondary source
  for Aftershock's close time (3:30/10 AM); promoter's own site only prints
  the start
- https://www.eventim.us/event/AFTERSHOCK-30-Year-Anniversary-Limited-Tickets/677997
  — ticket page, GA-sold-out status
- https://www.circuitpartyinfo.com/event/aftershock-folsom-30-year-anniversary/
  — venue address + producer confirmation (incl. its own schema.org data)
- https://sfclubs.com/ , https://en.wikipedia.org/wiki/715_Harrison ,
  https://m.yelp.com/biz/city-nights-san-francisco — City Nights SF address
  and routine hours, cross-checked across 3 independent sources
- https://www.circuitpartyinfo.com/folsom-san-francisco/ — general Folsom
  weekend party list; used to sanity-check nothing else on Kevin's list was
  missing, and confirmed PERVERT XXL / Real Bad 37 are the same events
  already in the app
- https://www.folsomstreet.org/ — the actual Folsom Street Fair page,
  confirming none of Kevin's five events are run by Folsom Street Events
  itself
