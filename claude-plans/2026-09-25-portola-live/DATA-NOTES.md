# Folsom weekend: every verified party (data notes)

**2026-09-25, 10:45–11:15 PM PT.** Branch `data/folsom-all`. Input: the pick list
(`research/gay-events/pick-list.json` in the portola-live worktree, 68 parties Fri–Mon).
Every party was re-opened at its own page and, where one exists, at the venue's or
promoter's own calendar, and the sold-out check below was done then, once. There is
no rolling checker.

**Result:** 35 parties added (36 cards, because the GearedUp Alley Party runs two days).
18 more are verified and ready but held back (see "Held"). 4 skipped. 11 were already in
the file, and all 11 got the sold-out check.

## How the fields were chosen

1. **Names** are the title the party's own page prints: same case, punctuation and
   special characters. Only a date or year, a venue tag or a ticket-status tag is cut
   (e.g. PRIME's "2026 - Limited Tix at the Door!", CHUNK's "- 9/26"). Every name is now a
   frozen pick key (`tests/fixtures/live-pick-keys.json`).
2. **Night** is the night a person would look under. Small-hours starts belong to the
   night before (checked with `js/time.js` `activityMinutes`: before 9 AM counts as
   after midnight of the night the party is filed under). No Monday day or section exists.
3. **Times** are as posted. An end the page doesn't print stays unprinted.
4. **Tickets** stay off a party that is sold out with no resale, a **door-only** night
   (nothing left to sell online, whether by design or because online sold out and the door
   still sells, per `docs/add-a-festival.md`; Kevin's call via the coordinator, 2026-09-25),
   a party that is over, and a dead link. The page link always stays.

## Re-filed to the night before

| Party | Starts | Filed under | Resolves to |
|---|---|---|---|
| NOCTURNAL EXTREME | Mon Sep 28, 3 AM | Sunday night | Mon 03:00 PT, last card of Sunday |
| Aftershock (already in the file) | Sun Sep 27, 3 AM | Saturday night | Sun 03:00 PT, last card of Saturday |

## Added (in the file now)

| Party | Night | Time | Venue | Tickets | Status, 11 PM PT |
|---|---|---|---|---|---|
| GearedUp Alley Party | Fri | 12 PM – 6 PM | Mr. S Leather | none | $20 beer bust at the door |
| HUNGER | Fri | 6 PM – 1 AM | SVN West | Eventbrite | on sale |
| Perverts Put Out Does Folsom Street Fair! | Fri | 7 PM – 9:30 PM | Folsom Street Community Center | none | over, sales ended |
| Folsom Foreplay | Fri | 8 PM – 1 AM | Kink Store | none | **sold out** since Aug 17, waitlist only |
| FOLSOM FREAK FRIDAY | Fri | 9 PM – 4 AM | Power Exchange | Eventbrite | on sale, also at the door |
| CORAZON SF | Fri | 9 PM – 3 AM | Beaux | Eventbrite | on sale |
| Stank | Fri | 9 PM – 2 AM | Powerhouse | none | bar night |
| HIT IT - FOLSOM | Fri | 9 PM – 2 AM | QBar | Eventbrite | on sale |
| SayLove: Folsom Edition | Fri | 9 PM – 2 AM | TBA (SoMa), no map | none | ticket link now lands on Passline's home page |
| PRIME - The San Francisco MEAT | Fri | 10 PM – 4 AM | Club Six | none | **door only**: online sold out, limited tickets at the door |
| BOOF x SQUISH: FOLSOM | Fri | 10 PM – 4 AM | SF Mint | Shotgun | on sale |
| SUCH A GOOD GIRL | Fri | 10 PM – 2 AM | Jolene's | Jolene's | presale sold out, GA on sale |
| DAD FOLSOM FRIDAY | Fri | 10 PM – 3 AM | F8 | Eventbrite | on sale |
| Brunch Queens — Folsom Weekend | Sat | 11 AM – 4:30 PM | Mayes Oyster House | Eventbrite | on sale (two seatings) |
| GearedUp Alley Party | Sat | 12 PM – 6 PM | Mr. S Leather | none | $20 beer bust at the door |
| Folsom Street’s Miracle Mile walking tour | Sat | 12:30 PM – 2 PM | Leather District Monument | none | free RSVP |
| MILKED: Folsom Edition | Sat | 1 PM – 4 PM | Stopgap, no map | Forbidden Tickets | early and advance sold out, general on sale |
| NAKED SOCIAL FOLSOM SATURDAY | Sat | 3 PM – 7 PM | The Blackdoor | Heylo | tiered, register open |
| Twisted Windows: Folsom Gala | Sat | 7:30 PM – 12 AM | SOMArts | none | **sold out** since Sep 15, waitlist only |
| US! Folsom (Dark N Dirty) Edition | Sat | 9 PM – 2 AM | Beaux | Eventbrite | on sale |
| Zoomiez | Sat | 9 PM – 2:30 AM | SF Mint | none | **sold out**, all four tiers; no resale or door shown |
| LICK IT | Sat | 9 PM – 2 AM | Powerhouse | none | bar night |
| FOLSOM SLUT SATURDAY | Sat | 9 PM – 5 AM | Power Exchange | Eventbrite | on sale, also at the door |
| CHUNK FOLSOM - Bear Playground | Sat | 10 PM – 4 AM | F8 | CHUNK | early bird and tier 1 sold out, tiers 2–3 on sale |
| OFFICIAL KINK.COM FOLSOM PENTHOUSE PREVIEW | Sun | 10 AM – 12 AM | Kink.com Penthouse (1717 Mission) | Eventbrite | on sale |
| BOOF presents MCMLXXXV (Herrensauna) | Sun | 11 AM – 8 PM | The Foundry | Eventbrite | on sale, more at the door |
| Party On The Plaza: Folsom Edition | Sun | 12 PM – 7 PM | Eagle Plaza | none | free plaza party |
| FOLSOM SUNDAY | Sun | 1 PM – 8 PM | Oasis | none | cover at the door, no presales |
| CUMUNION - FOLSOM EDITION | Sun | 3 PM – 12 AM | Transform1060 | Eventbrite | on sale, also at the door |
| Hot Tea - Leather Edition | Sun | 3 PM – 9 PM | Audio | Eventbrite | on sale |
| Kinksters Paradise | Sun | 6 PM – 12 AM | Kink Store | Eventbrite | on sale |
| AFTER FOLSOM FREAK FEST | Sun | 6 PM – 3 AM | Power Exchange | Eventbrite | on sale, also at the door |
| DETOX @ Popper Slut Sundays | Sun | 7 PM – 2 AM | Beaux | Eventbrite | on sale |
| screw, nut, bolt | Sun | 9 PM – 2 AM | Lone Star Saloon | none | bar night |
| RATED X | Sun | 9 PM (no end printed) | City Nights SF | Eventim | general and VIP on sale |
| NOCTURNAL EXTREME | Sun (Mon 3 AM) | 3 AM (no end printed) | Halcyon | Eventim | general and VIP on sale |

## Already in the file: sold-out check

| Party | Tickets door | Status, 11 PM PT |
|---|---|---|
| BRUT SF | kept | on sale (DNA Lounge GA) |
| MÜLL | kept | on sale, RA final release; venue still "TBA - San Francisco" |
| Horse Meat Disco | **changed to Sickening** | under way; Bearracuda's own seller still sells three tiers online (listing titled "TIX AT THE DOOR", but not door-only). The Tixr page it pointed at sells nothing for this party; it stays as the page |
| Big Muscle: Bare Chest Calendar | none (unchanged) | **sold out**, DNA Lounge says no tickets at the door |
| Magnitude | kept | on sale |
| PERVERT XXL | **changed to XOXO** | on sale at xoxopresents.com; the Tixr page it pointed to now says "Sold elsewhere" |
| Aftershock | kept | presale sold out, general and VIP Ultra on sale |
| Folsom Street Fair | none | donation at the gate |
| DEVIANTS | kept | on sale |
| Real Bad 37 | none (unchanged) | **sold out**, realbad.org says no tickets at the door |
| Disco Daddy | none | door night |

## Held: verified, ready, not in the file yet

These 18 share a venue on the same night with another party. Today's model treats a
shared venue-night as one bill: one doors time, one page and one ticket link. The
validator and three tests enforce that, and separate parties with separate pages can't
pass without losing their own links. So they wait in
`claude-plans/2026-09-25-portola-live/folsom-shared-rooms.json`, ready to splice once the
by-time Folsom layout (v94) treats each party in that section as its own show. A dry-run
splice gives 0 errors and exactly the 9 shared-room warnings.

| Party | Night | Time | Venue | Tickets | Status, 11 PM PT |
|---|---|---|---|---|---|
| BARK BEFORE DARK | Fri | 5 PM – 9 PM | The Stud | none | over; online sold out, door |
| SF Queer Leather Happy Hour: Folsom Edition | Fri | 6 PM – 9 PM | SF Eagle | none | free, over |
| Folsom Friday Warm-Up: Boot Camp | Fri | 9 PM – 2 AM | SF Eagle | none | door |
| DIRTY BOOTS: FOLSOM FRIDAY | Fri | 10 PM – 2 AM | The Stud | none | no ticket link published |
| Fist Buds - Folsom Edition | Sat | 12 PM – 6 PM | Transform1060 | Humanitix | on sale, also at the door |
| DREAM HOUSE | Sat | 2 PM – 8 PM | The Stud | none | no ticket link published |
| Daddy Day Care Folsom Saturday | Sat | 3 PM – 8 PM | SF Eagle | none | $15/$20 cover at the door |
| LateXXX | Sat | 4 PM – 7 PM | Oasis | Eventbrite | on sale |
| CUMUNION + BEARUNION - FOLSOM EDITION | Sat | 8 PM – 2 AM | Transform1060 | Eventbrite | on sale, also at the door |
| GRUNT | Sat | 9 PM – 2 AM | The Stud | RA | **sold out**, RA resale queue active, tickets at the door |
| Folsom Saturday: Cell Blok | Sat | 9 PM – 2 AM | SF Eagle | none | door |
| FOLSOM Princess w/ CRYSTAL METHYD | Sat | 9:30 PM – 2 AM | Oasis | Eventbrite | on sale |
| SXTPS: Folsom | Sat | 10 PM – 2:30 AM | DNA Lounge | DNA Lounge | on sale (shares the night with Big Muscle) |
| AIRTIGHT | Sun | 2 PM – 9 PM | The Stud | none | $20 cash at the door |
| Shirts Off Sundays | Sun | 4 PM – 8 PM | Powerhouse | none | bar night |
| Carne Fresca | Sun | 4 PM – 8 PM | Powerhouse | none | bar night |
| Fan-Dumb | Sun | 9 PM – 2 AM | Powerhouse | none | bar night |
| LE FEMMES | Sun | 10 PM – 2 AM | The Stud | Eventbrite | on sale |

## Skipped

1. **Out of window (Thursday):** Kink.com x Twisted Windows, Live Music: Folsom Kickoff
   Party, TUFF SF: Folsom Street Kick Off, Bone.
2. **RUBBER KITTY Folsom St. Fashion Show:** its own Eventbrite says Postponed.
3. **GBU SF – Folsom Edition:** its calendar says "By Invite Only", with no public address. Not a public party.
4. **Funkytown SF:** Cat Club's monthly 70s/80s night. Its page doesn't bill it as queer
   or Folsom. It was dropped for the same reason the pick list dropped San Frandisco and Momentum.
5. **CODE at The Edge:** The Edge says CODE is "usually the 3rd or 4th Saturday … watch
   our Facebook". Only an aggregator's every-4th-Saturday rule dates it Sep 26. Add it if
   someone confirms the date.

## The pick list was wrong on these (fixed from the parties' own pages)

1. GearedUp Alley Party is **Fri + Sat** 12–6 PM (Mr. S Leather's events page), not Sat + Sun.
2. Fist Buds is **12–6 PM**. The 10 AM–12 PM slot is Fisting 101, which is sold out.
3. The Kink.com Penthouse Preview is at **Kink.com's new space, 1717 Mission St**, not the Kink Store.
4. Nocturnal Extreme is **3 AM** (the promoter's own site). Its Eventim listing says 2:30 AM.
5. Several ends the list called "not posted" are printed on the parties' own pages: HUNGER 1 AM,
   DAD 3 AM, SXTPS 2:30 AM, MILKED 4 PM, Naked Social 7 PM, CHUNK 4 AM, and The Stud's nights.

## Names I was unsure about (frozen now, so these are the ones to eyeball)

1. **CORAZON SF.** Eventbrite: "CORAZON SF FOLSOM WKND W/RPDR LATINA ROYALE STAR EVA BLUNT
   LIVE @BEAUX". Beaux: "EVA BLUNT (RPDR Mexico) @ Corazón (Latin Night)". I kept the party's
   own name.
2. **DAD FOLSOM FRIDAY.** Its title adds "- Sindri & Stefan Ways", the lineup.
3. **Kinksters Paradise.** The Eventbrite title is "Folsom 2026 Kinksters Paradise Party at The
   Kink Store", and the page names the 6 PM–12 AM party "Kinksters Paradise".
4. **HIT IT - FOLSOM.** The title is "HIT IT - FOLSOM - SAN FRANCISCO".
5. **BOOF x SQUISH: FOLSOM** is the promoter's own styling. Shotgun re-cases it as "Boof X Squish: Folsom @ Sf Mint".
6. **Folsom Street’s Miracle Mile walking tour** keeps the page's curly apostrophe (’).
   Settled: v91's search folds ’ to ', so a straight apostrophe finds it.
7. All-caps names (HUNGER, OFFICIAL KINK.COM FOLSOM PENTHOUSE PREVIEW, RATED X,
   NOCTURNAL EXTREME, …) are printed that way. Aftershock, already in the file, was title-cased
   by an earlier pass, so the Ky Martinez trio doesn't match in style.
8. Held, not frozen: the SF Eagle page prints "Folsom Friday Warm-Up **:** Boot Camp" (space before
   the colon). The fragment normalises it. The Stud's pages print "BARK BEFORE DARK" and "LE FEMMES",
   while their organisers' Eventbrite titles are "Bark Before Dark: Folsom" and "Le Femmes Folsom Edition".

## Rooms

1. **Party On The Plaza** has its own room, "Eagle Plaza". The page says the party is on the
   Eagle Plaza outside the bar, and Disco Daddy is inside the SF Eagle.
2. **SayLove** ("TBA (SoMa)") and **MILKED** ("Stopgap") publish only an area. The address goes to ticket
   holders, so their `venues{}` entry is `null`, the same as MÜLL's "TBA (SF)".

## Tests changed

1. The Folsom counts: `tests/events-model.test.mjs` (Fri 16, Sat 15, Sun 16) and
   `tests/day-image-sections.test.mjs` (Saturday's image 51 → 62). The day image pinned the
   last two cards as PERVERT XXL then Aftershock. CHUNK now shares PERVERT's 10 PM start, so it
   pins what the comment claims: Aftershock is last on Saturday and never on Sunday, and NOCTURNAL
   EXTREME is last on Sunday.
2. **Not a count, flagged:** three sub-cases in `tests/now-jump.test.mjs` assert NOW "before
   Portola's doors, nothing marked" at 12:40 PM Saturday. The brunch (from 11 AM) and the alley
   party (from noon) really are on then, so NOW now correctly points at them. Those sub-cases
   now hide Folsom (the render helper's existing `folded` option) and keep every assertion. One
   new assertion covers the new truth: with Folsom showing, a daytime party is NOW's answer.
3. **Not a count, flagged:** two real-browser tests (CI job `browser`) went red on the longer wall.
   Both were measuring too early, not catching an app bug. Main's data passes and this branch's
   failed, locally and in CI, and a trace showed the app does the right thing:
   a. `tests/browser/heads-contract.test.mjs`: a day tab waited a fixed 700 ms for its smooth
      scroll. Every tab still lands exactly at the chrome (6px), but a Friday hop is now ~2,900px
      (~1 s) and a Sunday one ~6,500px (~1.4 s). The test now waits until the day stops moving.
      The landing check is unchanged.
   b. `tests/browser/now-jump.test.mjs` (320, Ross): NOW's 460 ms pulse scales the card it lands
      on. On the longer wall it is still running when the scrolling stops, so the card read 3px
      past its row mid-pulse. At rest it sits exactly at the row's edge (163–306, row at 38 of 38).
      The test now measures once the pulse's scale is gone. The assertions are unchanged.

## Seen in passing, not added (not on the pick list)

Lone Star Saloon also lists Leather and Gear Happy Hour and Big Boy (Fri), Dad Vibes and
Noche de Ronda: Folsom (Sat), and Gettin Knit (Mon). Beaux lists Kitty Kat Drag Brunch (Sat)
and Babes Who Brunch (Sun). The Stud runs a Folsom Street Fair stage at 8th above Folsom (Sun 11 AM–7 PM).
Mr. S Leather has Meet Terry Miller (Sat–Sun 2–5 PM). Cat Club has a "Folsom Sunday" of its own.
