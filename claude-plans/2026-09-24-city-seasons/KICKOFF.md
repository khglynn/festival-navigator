# City seasons — project kickoff

**Written 2026-09-24 (Thu, ~1:30 PM CT)** by the session that shipped v86 and
built v87 of festival-navigator, for the session that starts this project.
Nothing here is built yet. This is a brief to a partner, not a work order. It
carries Kevin's words and the lead session's words verbatim, the context you
would otherwise spend an hour rebuilding, and how Kevin likes to work. The
deciding is yours to do with him.

---

## Why this exists, in Kevin's words

Kevin, 2026-09-24, on his way to the gym (typed fast; read charitably:
"scrapping" is scraping, "seasonable" is seasonal, "muna" is the band MUNA,
"sothing" is sorting):

> Maybe this is a bad idea, but I'm off to workout and I wonder about - after
> we're launched securelty and slidely and ready for portola and ACL here I'd
> love to have a session on scrapping (or finding killer single or a small set
> of 2-3 robust reiable sources) to create seasonable views for cities.
> Starting with Austin Winter and Spring. Idea is: see and save shows with
> links to buy that levearge what we've built here. Reason: I just missed a
> muna show and I cann't have that happen again :cry cry: filters for what
> venues we're covering will be a nice way to show what we have or don't. probs
> need a scrape or souce health page and alert for slack since this is like a
> running check that refereshes. and I think sothing by... month only not
> venu? is smart? I'm sure there are a ton of considerations. a /design run in
> that work session would be smart but let's not break relationshiops and build
> some special snowflatke. we should stay in and even strengthn the component
> consistency across event or season views. it can genrally be like and even
> just with some extra considerations layered in. crazy to do after this? what
> else wer we kicking down the road? anything to roll into this?

And after reading the lead session's answer (below):

> I think you're plan and callouts for the season design are spot on. spotoify
> conmes to mind as an event sources too - the ones I use and see most. are
> they pulling from one of these or their own? Candidates to check: Do512,
> Ticketmaster's Discovery API, JamBase, Edmtrain and Bandsintown. if we can
> support small companies with good database through relferal links when we
> buy o support arists I'd rather do that […] (or the artists) I'd like that
> but if ticketmasters has the best database so be it.

He also asked that this kickoff be written "more in the vein of /hg-save it
than the directive formula handoffs we've been using lately. this is a project
kickoff."

## The lead session's answer, verbatim

This is what Kevin called "spot on". Treat it as a starting position you are
free to improve, not as settled.

> Not crazy. It's a good next project, and most of it is already built: ACL's
> Late nights already works like a small season, with dated shows at venues
> across two weeks. The new work is getting reliable data in and keeping it
> fresh, not the screens. I'd plan it between the fests and ship it after ACL.
> Friends will be using the app Oct 2–11, so during that window production
> gets data updates only.
>
> 1. **One change to the goal:** a seasonal view only saves you from missing
>    MUNA if you happen to open it.
>    a. The stronger feature is an alert. It builds a list of artists you like
>       from your Spotify top artists and your picks across fests, and tells
>       you when one of them is announced in Austin.
>    b. The seasonal view is where you browse and save. The alert is what
>       makes sure you never miss one.
>    c. I'd build the alert first, or at least design both together.
> 2. **Considerations I'd put first:**
>    a. **Keeping picks attached to the right show.** Picks are saved against
>       the artist's name, and names can never change. Scraped listings break
>       that: the same artist plays twice in a season, one source writes
>       "MUNA" and another "Muna", and shows move or get cancelled. A season
>       needs a stable ID for each show that survives a refresh. That's the
>       one real architecture decision, and it needs settling before any
>       screens.
>    b. **Month tabs, yes.** Your instinct is right for browsing. Within a
>       month the unit is a night: each date is a room heading ("FRI OCT 17"),
>       with the venue on each card. Venues work well as the coverage filter,
>       and there's already a venue list the app uses
>       (`data/venues/index.json`).
>    c. **Sources:** likely one broad Austin listings site plus one or two
>       ticketing APIs, with individual venue sites filling gaps. Candidates
>       to check: Do512, Ticketmaster's Discovery API, JamBase, Edmtrain and
>       Bandsintown. Those names come from what I already know, not today's
>       research, and their API access changes often, so the session should
>       start by confirming what's actually available.
>    d. **Health page and alerts:** a scheduled job that checks each source's
>       freshness and show counts and flags parse failures, plus a status
>       page. For the Slack alert, use a personal workspace, not Tecovas's,
>       since this is a personal project.
>    e. **Design:** agreed on a /design run, held to the same components: the
>       same card, column width and glow. A season view should look like the
>       fest wall with a few extra layers on top, not a separate app.
> 3. **Parked work that fits this project:**
>    a. **The schedule-drop watcher**
>       (`claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`).
>       It's the same "check on a schedule and alert" engine. Build it once
>       and it serves both fest set-time drops and city sources.
>    b. **An AI importer checked against the fests we already ship.** Turning
>       messy listings into the app's festival format is exactly that job.
>    c. **Add-a-show** (`claude-plans/2026-09-02-add-a-show.md`) covers "I
>       heard about a show the sources missed".
>    d. **Ray's discovery work.** He forked the app to build discovery and a
>       player, and "Discover" was parked until after ACL. Worth checking with
>       him first so the two don't overlap.

## What I'd add now, with a day's more thought

These are the lead session's further thoughts, for you to weigh.

- **Grade sources against ground truth before trusting any of them.** Kevin's
  data rule (global CLAUDE.md, "Backend data quality") exists because "one
  skipped spot-check burned a full day". So pick a sample you can verify by
  hand: the next ~60 days at ten Austin venues Kevin actually goes to, read
  off each venue's own calendar. Score each candidate source on recall (did it
  have the show?), precision (did it invent or keep dead shows?), freshness
  (how soon after the announcement?) and whether it has a buy link. That table
  is the decision; it's also the first version of the eval the banked "AI
  import graded by an eval" idea wanted. MUNA is your first test case: find
  the show Kevin missed and ask of every source whether it listed it, and
  when.
- **Spotify's concert listings are a real question, not an assumption.**
  Kevin sees them most, so they set his bar for coverage. Find out where they
  come from today (a partner feed, ticketing integrations or their own), and
  cite what you find with a date. If Spotify just shows another provider's
  data, that provider moves up the list.
- **Kevin's values on money flow, stated plainly:** he'd rather send referral
  money to a small company with a good database, or to the artists, than to
  Ticketmaster. But coverage wins: "if ticketmasters has the best database so
  be it." So report coverage and referral economics side by side, and let the
  data make the call.
- **The alert is taste plus a feed plus a channel.** Taste can come from
  Spotify top artists (the app already has a Spotify connection; note its
  seat limits in memory `spotify-seats.md`) and from picks across every fest
  Kevin has used this app for. The channel is the design question: Slack,
  email or a push. Keep the taste list viewer-side and private. It must never
  land in a shared crew doc (CLAUDE.md's "mute/hide is viewer-side only" law
  is the same instinct).
- **A season is one festival-shaped thing with no grid.** MODEL-V4
  (`claude-plans/2026-09-16-wall-v4/MODEL-V4.md`) already says the data's
  shape picks the presentation: no stage grid means stacks of cards. ACL's
  Late nights (`date`-keyed sections running Sep 29–Oct 10) is the closest
  existing thing to a season. Start from how that renders before designing
  anything new; it may already be most of the answer. What's new is scale:
  months of nights, not two weeks. The day tabs won't hold 120 dates, which is
  where Kevin's month idea comes in.
- **Scraped data will change underneath picks.** Today a festival file is
  hand-curated and its artist names are frozen by CI
  (`tests/fixtures/live-pick-keys.json`). A refreshing feed can't live under
  that freeze. Design the identity layer (a stable show ID, a rename or merge
  path, cancelled and moved shows) so a friend's saved show survives the
  source spelling it differently next week. The cancelled-acts pattern
  (`artists[].cancelled`, "Cancelled acts" in `docs/add-a-festival.md`) is
  prior art for "keep the key, change the state".
- **Errors and usage analytics are being designed separately** on 2026-09-24
  for the fest app (Kevin: "yes I'd like analytics well designed especially
  for errors but also for usage"). A season feed will want the same health
  signals, so check what that work landed before you build a second
  monitoring path.

## What's already built that this should lean on

Read the code; these are pointers, current as of 2026-09-24 (v86 is on
production, v87 is about to ship).

- The wall's two presentations and the date-keyed section model:
  `claude-plans/2026-09-16-wall-v4/MODEL-V4.md`, with `js/v3/events.js` and
  `js/v3/wall.js`.
- Run-time guesses for listings that only print doors (a guess is data-entry
  judgment, recorded per event, never computed at render):
  `scripts/guess-run-times.mjs`, `data/venues/index.json`,
  `claude-plans/2026-08-31-events-canvas/MODEL-V3.md`.
- Crews, picks, notes and sync (Neon Postgres, one atomic merge):
  `api/_lib/crew-sql.mjs`, `db/schema.sql`, and the CLAUDE.md bullets on the
  merge.
- The card, the aura, the meter, the zoom, and the design tokens:
  `assets/v3-tokens.css`, `assets/v3.css`, `js/v3/card-facts.js`,
  `js/v3/aura.js`, with every zoom state in `gallery.html`.
- Adding a festival and validating it: `docs/add-a-festival.md`,
  `scripts/validate-festivals.mjs`.
- The NOW jump (v87), which a season's "what's on tonight" will want:
  `claude-plans/2026-09-24-now-jump-build.md`.

## How Kevin likes to work (the parts that matter most here)

Your CLAUDE.md files load all of this. These are the lines most likely to
decide whether this project goes well.

- **"Contribute, don't just execute."** Kevin's direction is signal, not spec.
  He said "I'm sure there are a ton of considerations" and "I may be missing
  nuance". He wants you to find them and bring your view, including where you
  disagree with him or with this brief.
- **"Default to deep, durable work… Kevin is very rarely in a rush."** A
  refreshing data pipeline is the kind of system that rots quietly. Make it
  self-checking and observable from day one; that's what the health page and
  the Slack alert are for.
- **Align before building.** Plan mode, a small page he can react to on his
  phone, a /design run: whatever makes the choice easy. The
  `hg-review-pages` skill has patterns that have worked. On this app,
  "New surfaces are judged on feel, not coverage" (memory
  `design-feel-over-completeness.md`: the round-1 canvas on 2026-08-29 got
  "no elegance"), and design canvases are rendered by production code
  (memory `design-canvas-fidelity-rig.md`).
- **"How this app moves"** (CLAUDE.md, last bullet) is the bar: taste, flow,
  nothing popping in from nowhere, edge cases treated as design. Walk states
  in a real browser before you show him.
- **Data quality is yours, not his** (global CLAUDE.md): define expected
  ranges first, validate at write time, prefer a visible gap to a silent
  default, keep every shown value traceable to its source, and ground-truth
  every API against the vendor's own site before trusting it.
- **Search before you state anything fast-moving** (API access, pricing,
  referral terms, who powers Spotify's listings), and cite links with dates.
- **Summaries for a person coming back after days:** plain words, numbered
  and lettered so he can answer "2b: yes", and a clear "rolling" or "your
  move" at every pause.

## Walls that don't move

- **Festival windows.** Portola is Sep 26–27 (afters from Sep 24); ACL is Oct
  2–4 and 9–11. Friends are using production in those windows. Production
  gets data-only updates then, and new surfaces ship after Oct 11 unless
  Kevin says otherwise.
- **Production promotes are Kevin's call, always.** Branch pushes are preview
  deploys only.
- **This repo is public.** Crew tokens (`#g=…`) are credentials: never in a
  commit, a doc, a test or a PR body. Scan before every commit.
- **localhost `vercel dev` and staging both use the production database.**
  Friends' real picks live there. Test with throwaway crews and delete them
  afterwards; never write to a real crew.
- **This is a personal project.** Use personal accounts and a personal Slack
  workspace. Codex was signed in as kevin@trimm.co (personal) at 13:13 CT on
  2026-09-24, with fresh usage.
- **This Mac has 16 GB, and on 2026-09-24 at about 12:55 PT it
  kernel-panicked from memory with nine Claude sessions open.** Run one
  browser at a time, stop dev servers and watchers as soon as you're done,
  and prefer a Workflow's journaled agents over many live ones.
- **Never run Fable in a workflow or fan-out without Kevin's explicit
  permission in the session.** Name every agent's model.

## Questions worth answering early

Not a checklist; these are the forks the lead session could see.

1. Which 2–3 sources, by the ground-truth table? Where do Spotify's listings
   come from? What do referral programs actually pay, and to whom?
2. Show identity: what's the stable key, and how do renames, merges,
   cancellations and moves keep a friend's saved show attached?
3. Alert first, view first, or both together? Where does the taste list come
   from, and where does the alert land?
4. Does a season live in this app's festival model (a festival-shaped file
   with date-keyed sections) or beside it? What changes in the day tabs,
   heads and filters at 120 dates?
5. Where does the refresh run (a Vercel cron and Neon are already in place),
   and what do the health page and the Slack alert show?
6. Scraping etiquette: each source's terms, rate limits, and what a personal,
   small-crew project may reasonably do.
7. Ray (memory `ray-perfetti-contributor.md`): his fork has a Discover feed
   and planned an import pipeline. Talk to him before building a duplicate.

## A first deliverable that would earn the next step

A sources study: the ground-truth table, the Spotify answer and referral
economics, with links and dates, banked in this folder as you go. Then a
short direction page for Kevin with two or three ways the season and the
alert could feel, built with the app's real components. Build nothing into
production code until he has picked a direction. If you think a different
first step is better, say so and why.

## Escape hatches

- If the code or production disagrees with this brief, trust what you see,
  and say what was stale.
- If a closed-sounding idea here (month tabs, alert first, this repo) turns
  out wrong once you look at real data, reopen it out loud with the evidence.
- If Kevin redirects, his words win over this document.

---

## The kickoff paste

> This is a fresh session starting a new project on festival-navigator: city
> seasons, beginning with Austin's winter and spring shows, so Kevin never
> again misses a band he loves (he just missed MUNA). Read the repo's
> CLAUDE.md and NOW.md first, then this project's brief in full:
> `claude-plans/2026-09-24-city-seasons/KICKOFF.md`. It carries Kevin's words
> and the lead session's thinking verbatim; commit it on your first branch.
> Nothing is decided except what the brief marks as agreed (month tabs,
> reusing the app's components, alert and view designed together), and new
> evidence reopens any of it, out loud. The first deliverable is a sources
> study graded against ground truth, then a direction page for Kevin. Before
> doing any work, echo back your understanding of where we are and where
> we're going, clearly and crisply, and ask your questions. Big brain, great
> work, tight communication. Let's go.
