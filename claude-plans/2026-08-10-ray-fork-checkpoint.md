# Ray's fork — checkpoint notes (saved 2026-08-10)

**Who:** Raymond "Ray" Perfetti · ray@yoray.com · GitHub `raypp2`.
Found festival-navigator while prepping to publish his own single-file
festival planner (he'd just attended Tomorrowland W1, and had previously
built a Miami Music Week 2026 dashboard). Rather than publish a fourth
planner into the world, he forked ours.

**Thread:** "Forked festival-navigator", hello@kevinhg.com ↔ ray@yoray.com,
Jul 24 → Aug 6, 2026. Ball is in Kevin's court (Ray sent the last message).

> ⚠️ Ray's demo link includes a crew token (`#g=…`) for **his** deployment.
> This repo is public, so the token is deliberately NOT in this file — the
> full clickable link lives in the Gmail thread. His fork runs on his own
> Vercel + his own database; that token grants access to his demo crew,
> not to anything of ours.

## The arc of the thread

1. **Jul 24 — intro + roadmap.** Kind words about the app (called out the
   share-link access model, artist-keyed picks, offline design). Announced
   the fork and listed what he plans to build (below). Explicitly deferential:
   "merge whatever you want" / "completely fine if you'd rather not."
2. **Jul 25 — Kevin: green light.** "Open whatever PRs and I'll take a look."
   Flagged that pushback, if any, will be about keeping the UX simple.
3. **Jul 27 — concept artifacts** (design-phase links, listed below).
4. **Aug 3 — Kevin: keep me in the loop.**
5. **Aug 6 — WORKING CHECKPOINT.** Live demo on his Vercel, review list below.
   This is the email that prompted these notes.

## His roadmap (from the Jul 24 email, his ordering)

1. **Discovery / artist sampling** — the headline feature for him. Sample
   tracks & sets from Spotify (produced tracks) + SoundCloud/YouTube (live
   sets). Surfaces as a "For you" ranking on the artist wall AND a dedicated
   Discover feed.
2. **Recommendation engine** feeding that ranking.
3. **Cross-festival taste profile + seen-log** — hung off the person record
   (not the board) so it travels between festivals; visible to crew through
   circle membership, same consent boundary as picks. Optional Claude mining
   of Bandsintown / Spotify follows / email for the profile.
4. **Artist page** — one place per artist: who picked them, genres, listen
   sources, notes.
5. **"Not for me"** — a real negative signal, distinct from never-engaged
   (today a cleared artist and a rejected artist look identical; a
   recommender needs to tell them apart).
6. **Planning aids** — transit/travel conflicts between stages, per-festival
   walk-time tuning, local PWA notifications for picked sets.
7. **AI festival authoring via import** — Claude produces festival data, the
   app validates, a human confirms. Builds on `scripts/import-festival.mjs`
   + the Settings paste path (NOT replacing `api/festival-add.js`).
8. **Citywide / multi-venue schema** — Miami Music Week / Burning Man shape:
   many venues, city locations, ticketed events, travel between them. He
   flagged this one himself as the most likely to pull against our design
   direction.

## Concept artifacts (Jul 27)

- Discovery use flow + screens — https://claude.ai/code/artifact/f0621700-3bc6-434a-b99b-2f2aec1d1e73
- Player functional testing — https://player-research-nine.vercel.app/06-player.html
- Style guide — https://claude.ai/code/artifact/8f7be7b8-2647-45f0-986f-d73ad47d5eef
- Player UI design — https://claude.ai/code/artifact/dd435d3f-3228-4db6-8d29-2c2da8622a02
- Swipe mobile interaction mock w/ animations — https://claude.ai/code/artifact/372b82f3-ffce-48c9-80a2-d1818007cfe9
- Exploration (he marks it OLD) — https://claude.ai/code/artifact/4048695e-342c-4e5b-86df-d9f8f24cc990
- Specifications draft — https://claude.ai/code/artifact/14d03de9-c350-4f34-b492-f85150a6adc8

## The Aug 6 checkpoint — what's live now

Demo host: `https://festival-navigator-raypp2.vercel.app` (crew link with
token is in the email; loads Electric Forest 2026 with `me=Kevin`).

**He says is good for review:**
- Discover interface, iOS + Desktop
- Artist pages, iOS + Desktop
- Player (YouTube, SoundCloud, Spotify) — YouTube autoplays after a
  selection/swipe on Discover
- Updated approach to picks — iconography & control bar
- Top menu system

**He says is still rough:**
- Player track selection is wonky sometimes (acapellas, small artists, no
  live sets available)
- Android untested/unoptimized
- "My Day" is concept-only, logic not thought through (tbd keeping)
- "Clash decide" experience is concept (tbd keeping)
- General polish + bugs before user testing
- His Add-Festival automation pipeline is broken

## What GitHub shows (checked 2026-08-10)

- **Fork:** `raypp2/festival-navigator`, last push **2026-08-09**. His
  `main` is **77 commits ahead / 1 behind** our `main`.
- **Zero PRs opened** against our repo. Everything lives in the fork.
- **One OPEN issue on our repo: [#6](https://github.com/khglynn/festival-navigator/issues/6)**
  (filed Jul 24, no replies yet). `CANONICAL_HOST = 'fest.kevinhg.com'` is
  hardcoded in `js/spotify.js:26`, so any fork has Spotify broken until they
  find and edit that line. He agrees the canonical-host + hop architecture
  is right; he only wants the *value* moved to one config spot (meta tag or
  fetched config), with user-facing strings deriving from it. Also notes
  `api/access.js` `HOST_ALLOW` has the same shape (matters less —
  `PUBLIC_BASE_URL` overrides). **He offered to open the PR — it's
  effectively written in his fork already.**
- **Commit themes Aug 5–9** (~20 commits in five days): a playback "probe"
  system that adjudicates whether an embed can actually carry audio
  (Spotify pretends), a YouTube data backfill run in daily quota tranches
  until every artist that can have a video has one, genres backfilled from
  Last.fm then MusicBrainz fixes, discovery-deck state bugs, a mutual-overlap
  clash definition fix. His fork's service worker is at **v78** (ours: v35)
  — that's the pace he's iterating at.
- Branches beyond main: `staging`, `v3-design`, `spike/clash-lead-split`,
  `rescue-and-archives`, several `claude/*` working branches, dependabot.

## How the mechanics work (for the record)

His fork is a full independent copy under his GitHub account, deployed on
his own Vercel with his own database. Nothing he does there can touch our
repo, our prod, or our data. Work only lands here if he opens a PR and we
merge it. "Previewing his build" = visiting his URL like any website.

## Suggested next moves (Kevin's calls)

1. **Reply to Ray** — the Aug 6 email is unanswered and he shipped something
   real. Even "saw it, diving in soon" keeps the loop warm.
2. **Answer issue #6** — cheapest goodwill available: it's a real papercut,
   he's right about the fix shape, and he's offering the PR. Saying "yes,
   PR welcome" costs one sentence.
3. **Actually walk the demo** — Discover, artist pages, player, on phone +
   desktop. His link with the token is in the Gmail thread.
4. **Decide the merge appetite** — his list splits roughly into
   (a) aligned-with-our-model work (person-record taste profile, "not for
   me", artist page — all fit the fests × circles × you model), and
   (b) direction-pulling work (citywide/MMW schema), which he himself
   suggested might belong in the fork.
