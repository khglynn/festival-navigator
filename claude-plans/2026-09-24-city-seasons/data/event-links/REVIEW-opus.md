# Independent review — feat/event-links (v88), Opus

**Reviewed:** 2026-09-25, `git diff d4669bd...HEAD` in `.claude/worktrees/event-links`.
**Head reviewed:** `7854559`. The branch moved while I was reviewing (43c608a, then a merge of main 28f8c45 and two new commits: ee8f0c5 gives the Midway's three new Sunday names their links, 7854559 changes the data test). I reviewed the new commits too.
**What I ran:** `npm test` at 7854559: 829 tests, 828 pass, 1 skipped, 0 fail. Two jsdom probes (throwaway, deleted, worktree left clean). One headless Chromium page against `gallery.html` (not the browser suite) to measure where the doors sit under the hand. 13 live listing checks (DoTheBay and Do512 `.json`, one request at a time).
**Nothing edited in the repo.**

---

## Findings, ranked

### 1. MEDIUM (a design call for Kevin): the links row sits where a still hand clicks to pick, and a first pick can slide it under that hand

- **Where:** `js/v3/card-facts.js:445` (the row goes in right under WHERE). The re-centre after a pick is in `refreshZoomInner` → `place()`.
- **What I measured:** a headless Chromium page on `gallery.html`. I read `elementFromPoint` at 63 points spread over the resting card, which is where the hand is when the zoom grows. Same numbers at 390 and at 1280:

  | Card | Door points before this change | Door points now |
  |---|---|---|
  | Jyoty (no links; the baseline) | map 5 of 63 | map 5 of 63 |
  | Channel Tres | map 5 | **links 8** + map 5 = 13 of 63 |
  | Overmono (Late nights) | map 4 | **links 8** + map 4 = 12 of 63 |
  | MGNA Crrrta (a run member, like every Sun Midway card), after one pick at the card's centre | order 14 + map 8 | **links 10** + order 14 + map 8 = **32 of 63** |

- **How it fails:** take a phone on a Sun Midway card (VTSS, MGNA Crrrta). You hold the lower third and tap once, which picks. Your chip row arrives, and the zoom re-centres about 15px upward. MGNA's links row moved from y 448–464 to 433–449, right over the lower third of the resting card. You tap again in the same spot to go to two bars. That tap lands on "Tix @ AXS": AXS opens in a new tab, the pick doesn't move, and the person has left the app in the middle of the festival. A mouse gets the same result, since a click on a door never picks, by design.
- **Why it isn't a code defect:** the map door and the order door already behave this way (see the grownBlock comment, "the still-hand answer belongs to the zoom's placement"). The row roughly doubles the door area in that band, and its doors open other sites.
- **Fix options (pick one):**
  a. Keep the layout and make a door that just slid under a still pointer act as the card. After a `refreshZoom`, a door click with no pointer move since then falls through to the pick. This is the same shape as `handCard`.
  b. Move the row to the bottom, after `.f-chips`. That takes it out of the resting card's footprint, but the notes chip then rises into it, so this trades one door for another.
  c. Accept the risk, knowingly.

  I'd do (a) or (c). (b) only moves the problem.

### 2. LOW–MEDIUM: with no occurrence, a card shows another show's links (the question you asked about Overmono, Fatboy Slim and VTSS)

- **Where:** `js/v3/card-facts.js:95`. `linkEntry = entry || (!occ ? first named entry with links : null)`.
- **What happens:** with no `occ`, WHEN and WHERE come from the festival grid when the name is on it (lines 51–55). The links come from whichever named artists[] entry has links first. The two can be different shows. A jsdom probe of `factsFor(name, ctx, null)`, 2026-09-25:
  a. Overmono: "8:20 – 9:20 PM · Sun · Warehouse", with "Tix @ Tixr · Info @ DoTheBay" for the Public Works afters.
  b. Fatboy Slim: "Sat · Crane Stage", with the 888 Garage afters' AXS link.
  c. Parcels (ACL): "Sun · Miller Lite", with the Stubb's Late night's Ticketmaster link.
  d. At 7854559 the same mismatch shows up for 30 Portola names and 44 ACL names.
  e. A second case: with a live entry plus a cancelled entry that carries links, `find` can return the cancelled one. It then shows a Tix door for a cancelled show, because `cancelled` is false for this card. No data does this today.
- **How far it reaches today:** every `renderCard` call site passes `occ` (wall.js 774, 1229, 1509, 2200–2237). With an `occ`, all 141 linked entries (75 Portola, 66 ACL) resolve to their own links: 0 mismatches. None of the 588 grid occurrences in either festival resolves to links. So the no-occ path is reached only by the notes sheet header opened from a legacy route key (`sheet:notes:<plain name>`, before 2026-08-29), and by any future "list that only knows the name". That's rare, but the code is wrong when it runs.
- **Fix (one line):** `const linkEntry = entry;`. With no occurrence there is no show to link. If the fallback is worth keeping, take the links from the same artists[] entry that supplied WHEN and WHERE, and none when the grid supplied them. Add a test: `factsFor('Overmono', ctx)` with no occ carries no Public Works links.

### 3. LOW (data plus test gap): five ACL openers have no Tix door, though their headliner's card in the same room has one

- **Where:** `data/festivals/acl-2026.json`:
  a. The 4411, Emo's 10-01 (line 744): Palace has Do512 + Ticketmaster.
  b. Austin Ashtin, Concourse 10-01 (line 788): The Chainsmokers have Do512 + Eventim. Austin Ashtin's page is the venue homepage.
  c. Bambi, Devil May Care 10-02 (line 1040): Rebecca Black has Do512 + Eventim.
  d. Stefon Osae, Antone's 10-04 (line 1292): Rochelle Jordan has Do512 + Ticketmaster.
  e. Elijah Delgado, Antone's 10-08 (line 1476): World Famous Pets has Do512 + Ticketmaster.

  Each opener instead gets a generic page ("Info @ ACL Fest", "Info @ Antone's", "Info @ Concourse Project") and no tickets.
- **How it fails:** someone who picked the opener sees no way to buy a ticket to that very room and night. That contradicts the rule 7854559 just added to `docs/add-a-festival.md`: "a name added to a bill that already has a page takes the room's page and tickets too".
- **Test gap:** `tests/show-links.test.mjs:117-120` only checks that some page is present. It never checks that the room shares one page and one set of tickets, even though its own failure message says "copy its page and tickets". So all five pass. Portola is consistent: every Portola room shares one page and one tickets link.
- **Fix:** copy each headliner's `page` and `tickets` onto its opener, and have the test compare `page.url` and `tickets.url` across each room. One caveat: "one room on one night is one show" is false for venues with an early and a late show on the same night (Antone's, Stubb's). Key the room on the start time too, or let a room opt out.

### 4. LOW (public repo / data hygiene): the Overmono room's Tixr link carries a captured handoff URL, and the show is sold out

- **Where:** `data/festivals/portola-2026.json:929, 954, 979, 1004` (Overmono, Ben UFO, erika b2b sfcowboy, Kaytree). The URL is `…/overmono-dj-set-ben-ufo-presented-by-goldenvoice-203447?axssid=token_a5197d85aea7&locale=en-US&originalReferringURL=…%3F__cf_chl_tk%3D`.
- **What I verified:** this is exactly DoTheBay's own public `buy_url`. It is not from Kevin's session and it isn't a credential, so nothing secret leaked. It is still an AXS→Tixr handoff URL: an `axssid` session parameter, and an empty Cloudflare challenge parameter inside the referrer. Such URLs can go stale, and the value doesn't belong in data meant to last. DoTheBay also marks this show `sold_out: True`. Groove Armada and Fatboy Slim are sold out too, and both keep AXS links, which is fine because AXS has resale.
- **Fix:** replace it with the plain `https://www.tixr.com/groups/publicsf/events/overmono-dj-set-ben-ufo-presented-by-goldenvoice-203447` on all four entries.
- **Other public-repo checks:** none of these belong to Kevin. No crew token appears anywhere in the diff. The test token `showlinkstesttoken_0123456` is fake and stays in memory. The affiliate IDs (evyy `253185/264167/4272`, prf `camref:1011l3GdWo`, pxf `APvP5J`) are DoStuff's, as printed on public listing pages.

### 5. LOW (security hardening): LLM-researched custom festivals can now carry "Tix @ …" doors

- **Where:** `api/festival-add.js:109`. The research candidate is validated and then previewed. On confirm (line 84) the client sends the doc back and it is saved as-is.
- **How it fails:** `validateFestivalDoc` now accepts `page` and `tickets` on any artists[] entry. The prompt never asks for them, but grounded research reads untrusted pages. A prompt-injected page could make Gemini emit `tickets: {url: "https://look-alike.example", at: "Ticketmaster"}`. That passes validation, since https and 24 characters are the only checks. The crew's zoom then shows "Tix @ Ticketmaster" pointing at a phishing checkout.
- **Scope:** this only reaches one crew. `cancelled.source` and `order.source` already render as doors (v86), but "Tix @" is the one that invites payment details.
- **Fix (one line):** in the research path, remove `page` and `tickets` from `candidate.artists` before returning it. Better, keep only the fields the prompt asks for.

### 6. LOW (data completeness): The War on Drugs lost its buy link without a warning

- **Where:** `data/festivals/acl-2026.json:1416`, plus `prepare.py`'s `SELLERS` list.
- **What I found:** Do512 lists a buy link for the 10-08 Fair Market show, a Ticketmaster wrapper around `universe.com/destinationdefendermusicexperience-austin-tx`. That is likely a free sponsor registration. `tickets_of` returns None because `universe.com` isn't in `SELLERS`, and the report never mentions the drop.
- **Fix:** add `(r'universe\.com', 'Universe')` to `SELLERS`, or deliberately leave it off. Either way, `prepare.py` should print every buy URL it drops.

### 7. NIT: one comment says the opposite of what the page does

- **Where:** `assets/v3.css:1206`, "The row wraps rather than widening the zoom."
- **What happens:** `.zoom-slot` is `width: max-content`, so the row widens the zoom up to `MAX_W` (360) or the screen width minus 16, and only then wraps. Measured: Overmono's zoom is 226px wide against the 216px minimum. The browser test's `oneLine` assertion depends on that widening.
- **Fix:** "The row widens the zoom up to its max width, then wraps."

### 8. NIT: gaps between the tests, the docs and the code

- a. **The doc states a rule the validator doesn't enforce.** `docs/add-a-festival.md:215` says "festival grid sets never carry either field". `checkLinks` doesn't enforce it. Only `tests/show-links.test.mjs` checks it, for these two files.
  1. The failure it allows: links on a grid-day artists[] entry would show up through the no-occ fallback in finding 2.
  2. Fix: error in `checkLinks` when the entry's `day` is a grid day.
- b. **Nothing locks the refresh set to the grown rows.** No test checks that every direct child of `.f-grown` (other than `.f-who` and `.f-chips`) is in `REFRESH_PART_SEL`. The comment at card-facts.js:903-907 says a miss "fails with no test to say so". `.f-links` is in the set now; a cheap structural test would keep it that way.
- c. **`httpsUrl` is exported but unused.** events.js:536 exports it and nothing imports it. The three https checks also differ (`/^https:\/\//` at card-facts.js:87 against `/^https:\/\/[^\s]+$/`).
- d. **Some AXS links are malformed as printed by Do512.** Villanelle, Łaszewo, Left Lucid and Claire Rosinkranz (acl lines 875, 1515, 1531, 1643) use `?skin=3ten?cid=usaffdostuff`. The second `?` folds `cid` into `skin`, so DoStuff's referral may not register. This is exactly what Do512 prints, so leave it or fix it to `&cid=`.
- e. **Magnitude drops the listing's referral tag.** Its tickets (portola line 1432) use the bare Eventbrite URL. DoTheBay's `buy_url` is the `consumer.pxf.io/APvP5J?u=…` referral, and the doc says to keep referral tags.

---

## What held up (checked, no finding)

1. **Click, tap and Enter never reach the pick:**
   a. **Click:** `sourceDoor` stops the click at the anchor, so the zoom card's bubble listener never runs `onTap`.
   b. **Press:** `mousedown` skips `preventDefault` on its own controls. The anchor can take focus, and the resting card's focusout sees the anchor as inside the zoom, so nothing closes. Middle-click and Cmd-click fire `auxclick` or a click that is stopped, so neither picks.
   c. **Touch:** a touch zoom stays `pointer-events: none` until the lift's synthetic click has passed, so the lift can't land on a door.
   d. **Enter:** Enter on a focused door fires the anchor's click, which is stopped. The only Enter handler that picks sits on the resting card (wall.js:88), and the overlay isn't inside it.
   e. **Press-outside:** app.js's capture-phase "press outside" treats a door as inside the zoom.
2. **Keyboard reach matches the map door:** doors can't be reached from the zoom. Tab goes card → notes chip → next card (`onTabKey`), exactly as for the map door, the order door and the cancel door. They can be reached through the notes sheet header (chip → Enter → sheet → Tab past ✕ to the map door, then the links). The sheet's Tab trap doesn't list anchors, but they sit between its first and last stops, so the order stays correct.
3. **The refresh and the bloom are fine:**
   a. `partKey` gives the row the key `'links'`. The anchors are `.f-link`, not `.f-links`, so they're never matched on their own, and neither `tix` nor `info` collides with `notes` or `spot`.
   b. The row slides with the re-centre after a pick (measured: MGNA's row moved 15px as one piece).
   c. The bloom brings it in at +45ms, between WHERE (+35) and the chips (+55).
   d. The sheet header renders the same `grownBlock`.
4. **Placement still behaves:** the row adds about 23px. `place()` still clamps on the side edges, and on the floor and ceiling (measured: Overmono's zoom was pushed to 8px off the left edge at 390, with the row inside the zoom).
5. **Service worker stamp:** v88 / `200fcf37`. `card-facts.js`, `events.js` and `v3.css` are all in APP_CORE, and `app-shell-complete` passes. Festival JSONs are network-first, and v87 shells ignore the new fields: the client never validates festival files and has no unknown-field rule on artist entries. So the data can safely land before the app shell updates.
6. **Pick-key freeze:** no name was removed or renamed. The fixture only gains S.I.M, Espurr and New Nostalgia, from main's #28.
7. **Validator:** the https regex rules out `javascript:` and data URLs. `href` is set as a property and the text as `textContent`, so there's no injection. Unknown keys, a non-object, an empty `at`, over 24 characters and control characters are all errors, and the unit test covers each case.

## Data spot checks (13 live listings, 2026-09-25): each is the right night and venue

| Entry in the data | Listing says | Right? |
|---|---|---|
| Overmono · Portola Sun · Public Works | "Overmono (DJ Set) + Ben UFO", 2026-09-27, Public Works, sold out | yes (see 4) |
| Groove Armada · Sat · Great Northern | 2026-09-26, The Great Northern, sold out | yes |
| Fatboy Slim · Sun · 888 Garage | 2026-09-27, 888 Garage, sold out | yes |
| horsegiirL / VTSS / MGNA / Two Shell · Sun · Midway | 2026-09-27, The Midway | yes |
| Six Sex · Fri · Great American Music Hall | 2026-09-25, GAMH | yes |
| Magnitude · Folsom Sat · SVN West | 2026-09-26, SVN West | yes (see 8e) |
| Palace · ACL 10-01 · Emo's | 2026-10-01, Emo's; The 4411 not on the listing | yes (see 3) |
| The Chainsmokers · 10-01 · Concourse | 2026-10-01, Concourse Project; Austin Ashtin not listed | yes (see 3) |
| Villanelle · 10-02 · 3TEN | 2026-10-02, 3TEN; AXS link exactly as printed | yes (see 8d) |
| Rebecca Black · 10-02 · Devil May Care | 2026-10-02, DMC; Bambi not listed | yes (see 3) |
| Fcukers w/ Total Wife · 9-29 · Mohawk | 2026-09-29, Mohawk Austin | yes |
| Jess Williamson · 10-08 · Continental Club | 2026-10-08, The Continental Club | yes |
| The War on Drugs · 10-08 · Fair Market | 2026-10-08, Fair Market; the listing has a buy link the data dropped | yes (see 6) |

Things I couldn't verify:

1. The Hellp / Boys Noize "Info @ AXS" pages return a Cloudflare challenge to curl. They were hand-researched from the AEG feed.
2. The Overmono redirect chain suggests AEG's AXS pages hand off to Tixr. If so, "Info @ AXS" and "Tix @ Tixr" on those two nights open the same Tixr page. It's harmless, but it's two doors to one place.

## Verdict

**Ship after the listed fixes.**

1. Finding 2 is a one-line fix and should go in first.
2. Finding 1 is Kevin's decision before the promote: fix option (a), or accept the risk knowingly.
3. Findings 3, 4 and 6 are data changes that can go in as a data-only push. Finding 5 is a one-line API hardening.
4. Nothing in the diff leaks a secret.
