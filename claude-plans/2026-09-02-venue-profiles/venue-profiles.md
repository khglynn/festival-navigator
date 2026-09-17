# Portola Week venues — what each room usually does (researched 2026-09-02)

**Why this exists.** Twelve of Portola Week's club nights print doors and a
bill, not set times. The app guesses each act's slot (tilde on the card,
"Runs 10 PM – ~2 AM" in the zoom). Kevin (2026-09-01): ground those guesses
in what the *venue* typically does. Fourteen Sonnet researchers profiled the
rooms with sources; fourteen refuters tried to knock each profile down;
this file and `data/venues/index.json` are what survived. Raw material:
`research-raw.json` beside this file.

## The rooms

| Venue | Kind | Routine close | Late ceiling (observed) | Doors → first act | Headliner set | Confidence |
|---|---|---|---|---|---|---|
| Regency Ballroom | hall | not published | — | 60 min (venue FAQ) | — | unknown |
| Great American Music Hall | hall | not published | — | 60 min | — | unknown |
| Monarch | club | 2 AM (Fri/Sat 2:30 AM) | 3 AM | — | — | medium |
| The Great Northern | club | 2 AM | — | — | — | medium |
| Audio | club | 2 AM | — | — | — | high |
| Public Works | club | 2 AM | 3 AM | — | 120 min | high |
| Rickshaw Stop | club | 2 AM | — | 60 min | — | high |
| The Midway | club | 2 AM | 4 AM | — | — | high |
| 888 Garage | club | 2 AM | 4 AM | 15 min | — | medium |
| DNA Lounge | club | 2 AM | 3 AM | 15 min | 105 min (support 65) | high |
| 1015 Folsom | club | 3 AM | 5 AM | 0 (the DJ starts at doors) | — | low |
| SVN West | club | 2 AM | 5 AM | 60 min | 70 min (support 50) | medium |
| SF Eagle | bar | 2 AM (Fri/Sat) | — | 0 | — | high |
| Club Six | club | 4 AM | — | — | — | high |

A dash means nobody could find it; the guesser falls back per kind (club
2 AM, hall 12 AM, 30/60-minute gaps, 90-minute closer) and marks the result
as a guess with the reason. Every number in the registry carries its
source and a verbatim quote.

## This week, specifically

- **The Midway, Sun Sep 27** — 19hz lists the night as **10pm–3am**; the
  Midway's own Tixr page prints doors 10 PM and no end. Recorded as an
  evidenced guess (`close: 3 AM`, tilde kept, 19hz as the source).
  https://19hz.info/eventlisting_BayArea.php
- **The Midway bill is four names today.** 19hz still lists KAVARI fifth;
  the venue's Tixr page and AXS both bill horsegiirL, VTSS, MGNA Crrrta,
  Two Shell (the Tixr URL slug is a fossil of an earlier bill). Not added.
  https://www.tixr.com/groups/midwaysfgv/events/goldenvoice-presents-horsegiirl-vtss-mgna-crrrta-two-shell-kavari-203629
- **Regency Ballroom, Sat Sep 26 (Parcels / Velvet Trip)** — AXS's dedicated
  "Doors Open" field says **9:00 PM**; its banner and DoTheBay say 10.
  Taken (doors 9 PM); the order door now points at AXS.
  https://www.axs.com/events/1573671
- **Regency Ballroom, Fri Sep 25 (Channel Tres)** — RA's page says doors
  7 PM; DoTheBay, AXS, Songkick, Shazam all say 8 PM. Kept 8 PM (four
  sources to one). https://ra.co/events/2520991
- **The Great Northern, Fri Sep 25** — the only Portola Week page that
  prints a close (2 AM). Kept as printed.
- **Monarch Sat/Sun** — our file's 3 AM closes are printed on the listings;
  kept.

## What we could not find

- A published close for either hall (Regency, GAMH): not on their sites,
  riders, or any of ~20 listings. Hall default (12 AM) applies, marked.
- Headliner or support set lengths for most rooms. Only Public Works (a
  documented two-hour closer), DNA Lounge and SVN West had a citable
  pattern. Everything else takes the kind default and says so.
- Any Portola Week page that prints set times. None do.

## How the registry is used

`scripts/guess-run-times.mjs <fest>` reads doors from the event; a PRINTED
close is kept as printed, an evidenced guess (a close with a tilde and a
source URL) is kept next, and otherwise the registry answers by weekday,
then by routine close, then by kind default — every non-printed close is
written with `closeApprox: true` and a `closeSource`. The first act goes on
at doors + the venue's gap, the closer ends at the close, the rest spread
evenly, everything on the quarter hour, nobody under thirty minutes, and a
long closing set gives way before any support drops under forty-five.
`--write` records the plan on every run member; the diff is the review.
