# Handoff: finish the ACL set times on a local machine

*Written 2026-08-23, at the end of a remote (cloud) session. This doc is the
session export — read it first, then NOW.md, then go. Kevin shouldn't have to
re-explain anything.*

## What Kevin asked for, in his words

> "The lineups have dropped for ACL with timing, and we now have a bunch more
> information on the afters for Portola. Also, Folsom is happening during
> Portola... my crew wants to go to the horse something disco."

> "We should really make sure that all of the syncing and the friend work and
> all of that is just top notch... that any principal developer would be proud
> of it and that it will work as people go in and out of good and bad
> networks. We have usage from a couple dozen friends across different
> festivals and groups."

"Horse something disco" = **Horse Meat Disco**, and it's found: Bearracuda
Folsom Street party, Fri Sept 25, Public Works, 9 PM–3 AM, 21+. Already on
the Portola board.

## What's already done (don't redo it)

All on branch `claude/festival-lineup-integration-zs0s8l`, 5 commits, CI
green, triple-checked in a real browser. Full story in DEVLOG 2026-08-23.

- **Portola board**: AFTERS section (all 21 official Portola Week shows) +
  FOLSOM section (the fair + its big parties). Researched, cross-verified,
  every caveat written into portola-2026.json's meta.note. Don't re-research
  this — it was verified against ticketing pages on 2026-08-23.
- **The whole two-weekend schedule machine**: weekend-tagged sets, One/Two
  picker, per-weekend dates, day notes preserved. Tested (191 tests) and
  walked in Chromium. ACL's grid needs ONLY data now.
- **Hardening**: an 18-finding adversarial gate over sync/offline; the two
  worst (a sync-wedge and SW updates wiping offline festival data) are fixed
  with regression tests. Six deeper findings deferred — list in the DEVLOG
  entry. The merge-SQL ones want their own gated session; don't fold them
  into this run casually.

## Why this run has to be local

The remote container's network only reaches package registries. ACL's set
times live on https://www.aclfestival.com/schedule — a JS-rendered page —
and in the ACL phone app. Search snippets only carry the evening headliners
(~6 of ~30 sets per day), and shipping a mostly-empty grid would lie to the
crew. A local session has real network and real browser tools; this becomes
a fetch-and-paste job.

## The job, in order

1. **Get the ACL grids.** aclfestival.com/schedule, all six days (W1 Oct
   2–4, W2 Oct 9–11), every artist with stage + start time. Playwright or
   Claude for Chrome can read the rendered page; worst case Kevin opens the
   ACL app and pastes text.
2. **Ingest into `data/festivals/acl-2026.json`.** The exact recipe is the
   "Two-weekend fests" section of `docs/add-a-festival.md`. The load-bearing
   rules and the WHY: day keys stay "Friday"/"Saturday"/"Sunday" (day notes
   are keyed by those labels — rename them and every note the crew wrote
   disappears), artist names must match the existing lineup byte-for-byte
   (picks are keyed by exact name), sets get `weekend: "W1"|"W2"` (untagged
   plays both).
3. **Cross-check before trusting.** acl-2026.json's meta.note carries
   verified anchor sets (Turnstile T-Mobile 6:15 W1 Fri, Charli xcx AmEx
   8:40 both Fridays, Kings of Leon replacing Skrillex W2, RÜFÜS 8:30 W1
   Sat...). If your scrape disagrees with an anchor, figure out which is
   wrong before shipping. Two known wrinkles: the Sienna Spiro ↔ Łaszewo
   weekend swap is single-sourced (theheartsounds.com) — confirm it against
   the official grid; and only AmEx/T-Mobile/Miller Lite/Snapchat/Honda are
   confirmed 2026 stage names — record the rest exactly as the official page
   prints them.
4. **Validate and prove it**: `node scripts/validate-festivals.mjs`, then
   `npm test`, then eyeball the grid in a real browser (the weekend toggle,
   a W2-only artist absent from W1). Bump CACHE_VERSION (currently v38).
   CLAUDE.md's service-worker and vercel-dev warnings are real — read them
   before believing any browser check.
5. **Run `/codex-run` over the whole branch diff** (`git diff main...HEAD`).
   It doesn't exist in remote containers — that's half the reason for this
   local run. The branch has had adversarial agent review + a browser walk,
   but not a true Codex pass.
6. **Push to the same branch.** Merging to main deploys production — that's
   Kevin's call, always.

Nice-to-haves if there's time (each is optional, none blocks the ACL work):
- Portola set times — probably not out until mid-September; check.
- Unofficial Portola afters + the Folsom fair's stage DJs — both unannounced
  as of 2026-08-23, both expected to appear closer in.
- ACL Fest Nights (official late shows, Oct 2–13, do512.com/aclfestnights) —
  fits the same Afters pattern Portola uses, if Kevin wants it.

## If the world doesn't match this doc

Trust what you see. Times move, pages change, single-sourced claims turn out
wrong. When reality disagrees with this handoff, follow reality — and write
what you found into the data file's meta.note, the way this repo already
does everywhere.

One hard line that never moves: this repo is PUBLIC and a crew token IS the
credential. Scan before every commit, `&&`-gated, never `;`.
