# NOW — festival-navigator

**last-updated: 2026-10-03 6:23 PM PT (v113 live; v114 = ACL Sun W1 re-timed, merged; PR #80 = v115, waits on Kevin) · mode: live (ACL Oct 2–4, 9–11)**

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md.

## Live on production

- **v113, from `main`** (PR #81, merged 2026-10-03 4:17 PM PT) on fest /
  festival / crew.kevinhg.com, all three serving festival-nav-v113 /
  07aea7f0: ACL's W1 Saturday re-timed from the revised poster after the
  mud delay (Left Lucid, Fightmaster, Fakemink cancelled on W1; picks
  kept), and a cancelled card folds with its finished room (wall.js
  `roomPast`), so the 11 PM open lands on Late nights. Numbered v113:
  PR #80's previews used v109–v112, so #80 re-stamps above it. Rollback:
  Vercel dpl_8apj1YNu9gYg3B4gvj5BL5e6aB86 (v108 + docs). v108 (Oct 2):
  usage through errlog.js's one door. Rows, reviews, rollback targets:
  the LEDGER.
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), triggered by error-tracking issues only, and one usage
  rule: 3+ phones red on sync in an hour ("Fest: 3+ phones can't sync").
- **Read it:** the pinned PostHog dashboard "Festival health" (2163278):
  errors and phones by build, opens, speed, sync, features, devices.

## Now: watch ACL weekend 1 on "Festival health"

Built 2026-10-02 (DESIGN §2g). Look after each festival day: errors by
build, a stale build still in use, red sync, and how often an open lands
with no crew (`landing` in "How opens begin" — the find-your-crew question;
three ideas offered to Kevin, no answer yet).

**ACL, 2026-10-03 (v113):** mud delayed Saturday's doors to 2 PM; W1 Saturday
is re-timed from ACL's revised poster (Left Lucid, Fightmaster, Fakemink
cancelled on W1; LeTrainiump added), and a cancelled card now folds with
its finished room (it held Saturday on the wall till 5 AM).

**In flight: v114, branch `data/acl-sun-w1`** — W1 Sunday (Oct 4) re-timed
from the Oct 2 poster (v10.02-B): the T-Mobile / Miller Lite run from 4:30
about 10 minutes earlier, Britton to Snapchat 3:30, Flight by Nothing to W1,
Rubio → Vinny Tovar and Paloma Morphy → girlsweetvoiced (both cancelled on
W1, picks kept); W2 byte for byte. Next step: unit and browser pins (The xx
8:35, plan-model counts 247/181), `npm test`, a browser walk of Sunday W1,
PR, CI, an independent review, merge, verify the three hosts serve
festival-nav-v114. Still to re-read after that: all of W2 (Sat/Sun 9.30,
Fri 10.01) — W2 in the file is the Aug 27 posters (LEDGER follow-up 51).

## Also: PR #80, the Invite sheet (draft, v115) — waits on Kevin

Find your crew, slice 1 (`claude-plans/2026-10-02-find-your-crew.md`) and
Kevin's Oct 3 asks: the crew link as a QR in the app's own look (the
hero's aura, a light panel, deep brand ink — never "My link"), a card to
keep when saved (crew and fest names, no link text), the friend part as
one quiet row opening a step that keeps the section's old words, short
fest names (ACL, Seismic; ids and URLs unchanged), share links on
fest.kevinhg.com, and the dock row's gaps giving before it rests on a
sliver. Main (v113, v114) is merged in, so it stamps v115. Kevin's: a
real-iPhone check (Camera scans it; long-press Save keeps the card; clear
the preview's site data first), then his OK → merge, verify all three
hosts. The branch `diag/qr-fold-webkit` needs deleting on GitHub.

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

Festival-navigator loose ends (LEDGER follow-ups 38–53): the Linux day-row
probe, a pid-keyed redo of the offline name fix, three product calls.

## Open with Kevin

- Crew codes (find your crew, slice 3): a code he can type or a shuffled
  three-word combo ("sunburnt two step"), fun over strength; needs a
  DB-backed rate limit and a crew_codes table (additive). The v1 word list
  went to him Oct 3 with three small calls; the build waits on his go.
- Slice 2 (a quiet home-screen row in Settings) waits on his iPhone test.
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

0. Follow-ups: the LEDGER's list (1–53).
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
