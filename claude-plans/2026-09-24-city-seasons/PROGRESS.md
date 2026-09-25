# City seasons: progress

**last-updated: 2026-09-25 ~3:30 PM PT · status: your move (two asks)**

*(Times are Pacific, from this Mac's clock.)*

## For Kevin: where this stands (Fri Sep 25, ~3:30 PM PT)

1. **Austin season v0 is built and on a preview**, all on branch
   `seasons/austin-v0` (the view branch is folded in). CI green (unit and
   real-browser suites). Plan and rules: `claude-plans/2026-09-25-season-v0/`
   there (PLAN.md, UX.md, VIEW-NOTES.md).
   a. The feed: 752 Austin shows at 70 locations from Do512, JamBase and
      Ticketmaster (`scripts/season-feed.mjs`), every merge rule tested.
   b. The view: months as lineups cut into weeks, YOURS for Spotify people,
      a location filter, the zoom with Tix/Info, on-sale in CT.
   c. The alert (`scripts/season-alert.mjs`): 7 shows for you today; the bot
      is in #dont-miss.
   d. An independent review found no festival regressions; its fixes are in.
2. **Live usage:** production stays on v89 through Portola. The preview is
   shown with the demo crew only: opening Austin in a real crew there
   confuses that crew on production (UX.md, "Live usage").
3. **Promotion window:** Mon Sep 28 – Thu Oct 1, on your word, before ACL.

## Need from you

1. **Say go** for the one-time Austin digest in #dont-miss.
2. **Your word on promoting** in the Mon–Thu window, after Portola.

## My read-back

1. **Where we are.** v86 is live, v87 (the NOW jump) is being built in
   another session, and friends use the app for Portola (Sep 26–27) and ACL
   (Oct 2–4 and 9–11). Production gets data updates only until Oct 11. This
   project ships after that.
2. **Why this exists.** You missed MUNA. The show was Sat Sep 19, 2026 at
   Moody Amphitheater at Waterloo Park (Gets So Hot Tour, with Hemlocke
   Springs), sold through Ticketmaster and listed on Do512
   ([Do512](https://do512.com/events/2026/9/19/muna-gets-so-hot-tour-tickets),
   [Ticketmaster](https://www.ticketmaster.com/muna-gets-so-hot-tour-austin-09-19-2026/event/3A0064A7C59AF73A),
   [setlist.fm](https://www.setlist.fm/setlist/muna/2026/moody-amphitheater-austin-tx-7b7fb240.html)).
   So the data existed in at least two big places. The open question is when
   it appeared and why nothing put it in front of you.
3. **Where we're going.** A season view of Austin shows (winter and spring
   first) where you browse by month, save shows, and tap through to buy,
   built from the same cards and walls as the fest app. Plus an alert that
   tells you when an artist you love is announced in Austin. Agreed so far:
   month tabs, reuse the app's components, and design the alert and the view
   together.
4. **What comes first.** A sources study graded against ground truth: take
   what ten-plus Austin venues list on their own calendars, and score each
   candidate source on whether it had each show, whether it lists shows that
   aren't real, how soon after announcement it lists them, and whether it
   carries a buy link. Plus where Spotify's concert listings come from, and
   what referral programs pay and to whom. Then a short direction page for
   you with two or three ways this could feel. Then you pick.

**One reframing I'll test in the study.** The alert and the season view ask
different questions. The alert asks "is any of my few hundred artists
coming to Austin?", which is a lookup by artist. The view asks "what's on in
Austin in March?", which is a lookup by city. Sources are built for one or
the other: Bandsintown and Songkick are organised around artists, Do512
around the city, Ticketmaster does both. So the study grades each source on
both questions, and the best answer may be two different sources, one per
job. MUNA's show was on sale for months (the study will find exactly how
long), which suggests the miss was about nothing telling you, more than about
missing data.

## Earlier questions (defaults were used; the page's "Your call" replaces them)

1. **Which Austin rooms do you actually go to?** The study's ground truth is
   built from venue calendars, so the venue list shapes the answer.
   a. Default set: Moody Amphitheater, Moody Center, ACL Live (Moody
      Theater), Stubb's, Emo's, Mohawk, Scoot Inn, Antone's, The Parish,
      Empire, Concourse Project, Kingdom, Summit, Germania/Q2 amphitheater.
   b. Add or strike any. Name the ones you'd be sad to see missing.
2. **All music, or your lanes?** Your fests lean electronic plus indie and
   pop. If the season should cover your lanes only, electronic-specific
   sources (Edmtrain, Resident Advisor, 19hz) matter more and big country or
   jazz bills matter less. Default: all music, graded separately for
   electronic.
3. **Taste list for the alert.** OK to build it from your Spotify top and
   followed artists plus your picks across every fest, kept on your side only
   (never in a shared crew doc)? Default: yes, and I'll only design it now.
4. **Where should an alert land?** Slack DM in your personal Trimm
   workspace, email, or a phone push. Default: Slack, since the analytics
   design (today, another session) is routing app alerts there through
   PostHog, and two alert paths is one too many.
5. **API accounts in your name.** Ticketmaster, SeatGeek, JamBase, Edmtrain
   and Bandsintown each want a developer account. Default: the study reads
   their public pages and documented API terms; I'll hand you a short signup
   list once we know which ones matter, not before.

## The sources study, as planned

1. **Ground truth.** Every show each venue lists on its own site from today
   forward, tagged near (the next ~60 days, through Nov 23) and far (Dec 2026
   to May 2027, the winter and spring the project is for).
2. **Candidates.** Do512, Ticketmaster, JamBase, Edmtrain, Bandsintown,
   Songkick, SeatGeek, Showlist Austin, Resident Advisor, 19hz, Austin
   Chronicle, and anything the landscape pass turns up.
3. **Scoring.** Recall and precision per source, near and far, big rooms vs
   clubs; buy-link coverage and which ticketer; a matching script does the
   joins so the table can be re-run later as an eval.
4. **Side questions.** Spotify's concert-data provenance (cited, dated);
   referral economics per source; each source's terms and rate limits; the
   MUNA timeline (announce date, on-sale date, first listing per source).

## Log

- 2026-09-24 ~2:15 PM PT: worktree `.claude/worktrees/city-seasons` on
  branch `seasons/kickoff` from origin/main (9d6a2a3). Brief moved in from
  the main checkout (the original went to the Trash, identical copy verified).
- 2026-09-24 ~2:20 PM PT: MUNA located (above). ACL's Late nights already
  source 60 of 66 dated shows from Do512, so Do512 is the incumbent.
  The venue registry (`data/venues/index.json`) holds 14 San Francisco rooms
  and no Austin ones yet.
- 2026-09-24 ~2:20 PM PT: two research runs started (Workflow, journaled).
  Wave 1: four Sonnet readers take 17 venue calendars as ground truth
  (`data/ground-truth/`), two Sonnet catalogers cover ticketing APIs and
  listing sites, two Opus investigators take Spotify's provenance and the
  MUNA timeline (`research/`). Wave 2: nine Sonnet readers take what each
  candidate source lists at the same venues (`data/sources/`).
  `score.mjs` grades them (self-tested on a synthetic fixture: headliner
  matching, the one-day-off bucket, precision limited to dates a venue's
  calendar was read to, best pairs and triples).
- 2026-09-24 ~2:20 PM PT: first ground-truth file in: Emo's lists 39 shows
  through Nov 27 on a Ticketmaster widget with schema.org JSON-LD, so at
  Live Nation rooms Ticketmaster's data IS the venue's word. The study has to
  read independents separately for that reason.
- 2026-09-24: Ray's fork (raypp2) last pushed 2026-08-09; its work is the
  artist preview player and YouTube backfill, not city listings. No overlap
  with seasons yet; his player could later preview a month's artists.
- 2026-09-24: SeatGeek source study done — `data/sources/seatgeek.json`,
  334 event rows across 14 of 17 venues (empire, continental, summit, vulcan
  show live pages but zero listed events). Plain curl is fully blocked
  (DataDome CAPTCHA on every path, even robots.txt); firecrawl_scrape with
  the default "basic" proxy got through cleanly — no stealth/enhanced mode
  needed. Findings worth carrying into scoring: (1) SeatGeek's own venue
  page for 214 E 6th St is titled "Brushy Street Commons (Formerly The
  Parish)" — our "parish" and "brushy" venue slugs are the SAME room on
  SeatGeek, events duplicated under both, de-dupe before totaling; (2) three
  events carry bogus far-future placeholder dates baked into the event URL
  itself (2206, 2031, 2036) — recorded as null rather than guessed; (3)
  every buy link stays on seatgeek.com (it's the marketplace, not a
  redirect), so primary-vs-resale per event isn't visible from the listing
  page alone — flagged, not guessed; (4) coverage horizon varies wildly by
  venue on SeatGeek itself (Germania: 4 shows, nothing past mid-Oct; Emo's:
  nothing past Nov 27; ACL Live: runs to mid-2027) — this may be a real
  Austin data-quality trait for scoring, not a study miss.
- 2026-09-24 ~2:40 PM PT: waves 1 and 2 done. First grading (`score.mjs`,
  425 music shows at 16 venues, Parish merged into Brushy Street): Do512
  recall 87% / precision 93% (before adjudication) / buy link 96%;
  Bandsintown 82% / 80%, strongest far out (Dec–May 82%) and on electronic;
  JamBase 75%; Songkick 75%; Showlist and the Chronicle 60%; the Ticketmaster
  website read is capped at 20 shows a venue, so its 41% is not the API's
  number. Best pair Do512 + Bandsintown 97%.
- Verified by hand: Spotify's help page lists 46 ticketing feeds including
  Bandsintown and says "We don't display events from Songkick"; Do512's
  venue JSON works (`/venues/<slug>.json`, paged) and carries
  `ticket_onsale_time`, stable event ids and doors; Do512's buy links carry
  DoStuff's own affiliate ids (`SharedId=DoStuff`, `pubref:dostuff`), which
  corrects the wave-2 reader who said they were untagged; Showlist Austin's
  own data dates 41 Ticketmaster-venue shows a day late (Jane Remover is
  Sep 29 at Stubb's everywhere else, Sep 30 on Showlist).
- MUNA timeline (`research/muna-timeline.md`): announced Fri May 8, presales
  May 12–13 (one was a Spotify presale), on sale May 14, never sold out; 134
  days of notice. Ticketmaster, JamBase and Do512 had it on announcement day.
  The miss was an alert problem, not a data problem.
- ~2:50 PM PT: wave 3 started (artist-page lookups for 37 headliners across
  five surfaces; adjudication of 230 listings the venue calendars didn't
  confirm). The canvas builder (Opus, one agent) started from
  `canvas/BRIEF.md`.
- ~3:10 PM PT: wave 3 done. Adjudication of the 230 disputed listings:
  110 were on the venue's own calendar and the first read missed them
  (Antone's pagination, Moody Center's page shows 12 of 35), 25 real but
  off-calendar, 33 not concerts, 30 duplicates, 32 genuinely wrong. Artist
  pages (Bandsintown, Songkick, Ticketmaster) only show an artist's next
  eight or so dates, so the alert should read the city feed, not artist
  pages. Bandsintown's API is one-artist-per-key by its own help page.
- ~3:15 PM PT: `STUDY.md` written. Codex (read-only, head 172ebfa) reviewed
  it adversarially: distinct shows merged on the "Official 2026 ACL Nights"
  prefix, order-dependent matching, flattering precision, thin spring
  sample, and four overstated sentences. All fixed in the scorer and the
  study; its identity and alert points are answered in THINKING.md. One
  suggestion (add every adjudicated real show to the truth) was tried and
  reverted: it added 31 support acts as if they were separate shows.
- Final numbers: Do512 84% (68% after Nov 23), Bandsintown 81%, JamBase 74%;
  Do512 + JamBase 93% (93% after Nov 23); Do512 + Bandsintown 95%.
- ~6:30 PM PT: the canvas builder (Opus) finished: `canvas/canvas.html`
  built from production code, checked in headless Chromium at 390 and
  1280, no console errors, no page overflow. Its honest read is in
  `canvas/NOTES.md`. It then stopped on a usage limit after reporting;
  nothing was lost (its six commits are on the branch).
- ~6:40 PM PT: I looked at the phone sections once (intro, A, B, "Your
  call"), softened one freshness line to what was measured, and published
  the page as https://claude.ai/artifact/HsB9FmNeWgAiKRXJkoLYbL (owned by
  kevn.hg@gmail.com; `build.mjs` now also writes a wrapper-free publish
  copy outside the repo).
- ~11:00 PM PT: Kevin's ten notes on the direction page, pieced together
  from his screenshots: `KEVIN-NOTES-ROUND1.md` (the page's login had
  switched away from this session). At ~12:05 AM he said go: event links
  split with the pre-Portola session (this session builds, that one
  releases); the season becomes A's month tabs in the lineup layout, one
  card per artist, A's next-morning Slack alert, and a YOURS tab only for
  people with Spotify connected.
- ~12:05 AM PT Fri: signup pages for the Ticketmaster and JamBase developer
  keys opened in Kevin's Kevn Chrome profile; he created both accounts. The
  keys are masked on screen and this session can only read the screen, so
  saving them to `~/.env` waits for him to paste them.
- ~1 AM PT: event links built on branch `feat/event-links` (worktree
  `.claude/worktrees/event-links`, from main after v87 merged as d4669bd):
  every Portola afters/Folsom night (72) and ACL Late night (66) carries
  `page`, and 120 carry `tickets`; the zoom shows "Tix @ AXS · Info @
  DoTheBay" under the place line; the validator and
  `docs/add-a-festival.md` cover the fields; 829 unit tests green. Link
  sources and the prep script: `data/event-links/`.
- ~1:00 AM PT Fri: PR #29 (event links) opened, reviewed and made ready.
  Codex refused with a usage limit (until Sep 30), so an Opus reviewer ran
  the review: two fixes (a door that a pick slides under the finger now
  picks for 700 ms; a name-only card borrows no links) and five small ones
  (five ACL openers share their headliner's links, cleaned buy links,
  research never writes links, festival sets can't carry them, The War on
  Drugs' Universe link). CI green at ffd9614; handed to the pre-Portola
  session for v88. `BUILD-PLAN.md` written for the season.
- 2026-09-25 ~12:40 PM PT, after Kevin's restart: nothing of this session's
  was left running. The pre-Portola session is integrating v88 on
  `release/v88` (local, last commit 12:37 PM PT), which merges #29 at its
  final head ffd9614 and the error-capture work; production still serves
  v87. The keys, the Slack channel and Kevin's read of `BUILD-PLAN.md` are
  still open; none of them blocks the weekend.
- 2026-09-25 ~1 PM PT: Kevin pasted the Ticketmaster and JamBase keys in the
  thread (never in the repo). Both work, one call each for Austin from Dec 1
  within 15 miles: JamBase `api.data.jambase.com/v3/events` (Bearer auth,
  query by `geoLatitude`/`geoLongitude`/`geoRadiusAmount`; `geoCityName` is
  not a parameter) returned 113; Ticketmaster Discovery returned 70 music
  events, including ACL Live, with presale names and on-sale times (a
  `1900-01-01` on-sale means unknown and must read as null). `~/.env` is
  protected by a hook, so Kevin adds the keys there himself.
- Slack: the personal bot `claudecodebridge` in the Trimm workspace has
  `chat:write` (not `chat:write.public`), so it posts only where it is a
  member; `#dont-miss` isn't visible to it yet (private or not joined), and
  it isn't in `#hg-agents`. Plan: show alerts in `#dont-miss`, feed-health
  notes in `#hg-agents`; Kevin runs `/invite @claudecodebridge` in each. The
  Slack CLI (not installed here) can now log in from inside Slack
  (`/slackauthticket`) and manage apps and manifests from the terminal.
