# NOW — festival-navigator

**last-updated: 2026-10-01 4:10 PM PT (v106 live, v107 in review) · mode: live (ACL Oct 2–4, 9–11)**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v106, from `main`** (PR #71, merged 2026-09-29 4:45 PM PT) on fest /
  festival / crew.kevinhg.com — `ops/prod-smoke.mjs` PASS (festival-nav-v106 /
  73ab3696): ACL's Late nights fixes, Zilker headliners run to the 10 PM
  close, the day row's first paint, the laptop List un-pick, error reports
  that name their build. v105 (Sep 27): Our picks across the days. v104:
  NOW first in the day row, the List filter, the playlist fix. v103: the
  Share. Rows, reviews, rollback targets: the LEDGER.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), each saying what the error means in plain words.

## In flight: v107 (PR #76, branch `release/v107`)

Opens on bad signal — the two live ACL failures in PostHog: an iPhone fatal
(the fallback fetched Portola over the same dead network and saved it) and
an Android black page (one module never arrived on a first visit). No
fallback fetch; a held festival stands in for one open without being saved;
a calm "can't be reached" screen that retries itself; an inline watchdog for
the black page. Reviews done: Sol 6.1 via Eachie (2 rounds), a Claude
three-lens review with skeptics; a final-gate review and CI (both engines)
pending. **Next:** fix what they confirm → merge → verify all three hosts
serve festival-nav-v107 → update the two PostHog Slack functions from
`ops/posthog/slack-alert.hog` (staged as drafts; Kevin publishes) → DEVLOG +
LEDGER. Rollback: Vercel dpl_8UgomsbYZ7tC6HYCnsgMeHfaa9aV (b8a89a9); Neon
backup branch `backup-2026-10-01-pre-v107`. Eachie cap: $1/run, $5 session
(spent ≈$0.06), no Astra/Fable. **Then v108:** the full usage tracking
(DESIGN §2b, Kevin 2026-10-01: "do it now"), and find-your-crew from a bare
fest.kevinhg.com (three ideas offered, no answer yet).

## Next: the iOS app

The plan is `claude-plans/2026-09-29-native-apps-stack.md` (Capacitor around
this app; TestFlight this year). Apple approved and Play verified Sep 29
(Team ID and the rest in the plan's "Before Thursday"). Still Kevin's: a Mac
with Xcode 26 and Android Studio (~30 GB free), Developer Mode on his iPhone.
Then paste this into a fresh session on that Mac:

> This is a fresh session with a clear mind stepping into work we grounded in one research chat (a claude.ai cloud session, Sep 28–29, 2026: the stack comparison, Capacitor research, Apple and Play rules, a Thursday runbook). Run the re-entry ritual first — festival-navigator's AGENTS.md, then NOW.md (its top "Live on production" and "Next" blocks win), then the work's own grounding: `claude-plans/2026-09-29-native-apps-stack.md` (the stack decision, the native pieces, "Decisions and the Thursday runbook" — the stack comparison is finished, don't redo it) and the chat itself at "~/Documents/HG Main/0.2 Clips + Social + AI/Agentic Research/misc/2026-09-29-festival-ios-tech-stack-chat.md" (Kevin's vault, outside this repo) (Kevin's own words and the account steps; it stays out of the public repo). Decisions already made — build on them; reopen one only with new evidence, and say you are: (1) Capacitor wraps the existing web app — no rewrite (2026-09-29, the plan's "Why Capacitor fits"); (2) TestFlight and Android internal testing or a direct install this year, no store listing (2026-09-29, chat turn 2); (3) over-the-air web updates with the web bundle shipped inside the app and a self-hosted updater, never loading fest.kevinhg.com remotely (2026-09-29, the plan's runbook); (4) Buy Me a Coffee stays a link out, no in-app purchases (chat turn 2). Still open — talk before building: the widget / Live Activity (Kevin, 2026-09-29: "not convinced about a widget"), the app ID (com.kevinhg.festival?) and the home-screen name. The deliverable is the Capacitor shell running today's app in the iOS Simulator and on Kevin's iPhone — `apiBase()` pointing server calls at fest.kevinhg.com, the offline data fallback — then a TestFlight build for the crew, same discipline as the festival-navigator releases v103–v106 (red-first tests, CI green including Linux WebKit, an independent Codex Sol review, a real-input walk, never production data). Check Kevin's side first: Apple Developer enrollment approved (his Team ID), Play's identity check, Xcode 26 and Android Studio installed, Developer Mode on his iPhone — and link every site or step you send him to. Before doing any work: echo back your understanding of where we are and where we're going, clearly and crisply, and ask questions. Big brain, great work, tight communication. Let's go.
>
> launch-pad: 3e80501e-f950-812d-ac9f-faea1a54b83b
> (leave this line in — pasting it clears this entry's handoff automatically)

Festival-navigator loose ends (LEDGER follow-ups 38–41): the Linux day-row
probe, a pid-keyed redo of the offline name fix, three product calls.

## Open with Kevin

- Ray: the Sep 1 reply is still in Gmail drafts — send it now, or fold it
  into one email after ACL (its Pen card asks; the draft still says Discover
  "after ACL", now 2027).
- Pinned notes shown on the wall (a pinned festival or day note as the room
  head's whisper): offered, no answer yet.
- Import: a second door in the just-joined welcome, and Portola-only — his
  "all those changes seem chill" probably covers it; confirm, then build.
- Small call with a default: How it works dropped "White stroke = you" (you
  are never in the crew corner now).
- If a phone tap ever grows a card on a real iPhone: gate hover arming on
  `(any-hover: hover)` — card-facts.js deliberately avoids media queries.

## Next, after the live lane

0. Follow-ups: the LEDGER's list (1–41).
1. ACL before Oct 2: the Zilker headliners' ends (a code rule — they print
   only a start), the dock's FRI flash on open.
2. After Portola: self-recovery when a phone boots stale cached modules
   beside new ones (seen again today: `roomOf` not found, 11:00 AM); a guard
   against a sync push to the wrong crew.
3. Data-only pushes as drops land (standing OK: validator + freeze + tests).
4. After Oct 11: the merged wall for two crews at one fest, add-a-show
   (`claude-plans/2026-09-02-add-a-show.md`), the staging site (fix or
   retire), email Ray (raypp2) — the Sep 1 draft never went out (Pen card).

## Banked, not built

- In Kevin's Pen (2026-09-26): the 2027 tabs (Discover, Our picks, a
  reference tab with the grounds and venue maps and everyone's notes); city
  seasons leaving out festival-only artists, and combining cities; list-view
  swipes; the in-app venue map; emailing Ray. The schedule-drop watcher
  (`claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`). An AI
  festival import graded by an eval.
- A sticky member-chip row · duplicate person rows for Portola crew members
  (an idempotent claim fixes it) · the deferred sync and merge hardening list
  in DEVLOG 2026-08-23 · day-to-day grid scroll mirroring only on scroll end
  (needs Kevin's yes).

## Where the rest lives

- Rules: AGENTS.md. History: DEVLOG.md (search it; do not read it whole).
  Specs and plans: `claude-plans/README.md`.
- Backups: Neon branches `backup-2026-09-23-prefest` and
  `backup-2026-09-26-pre-v101`, JSON exports outside the repo.
- NOW before 2026-09-16:
  `claude-plans/archive/2026/now-history-2026-07-07-to-2026-09-02.md`.
