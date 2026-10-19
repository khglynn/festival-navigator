# NOW — festival-navigator

**last-updated: 2026-10-19 · mode: off-season** (Portola and ACL are done;
the next festivals friends have crews for are EDC Orlando, Nov 6–8, and
Seismic, Nov 13–15: full by-day lineups, no set times yet)

Where things stand, on one screen. Change stale lines in place; the story of
how we got here belongs in DEVLOG.md, and the long list in BACKLOG.md.

## Live on production

- **Live:** v116 from `main` on all three hosts, checked 2026-10-19.
- **v116** (PR #96, 2026-10-19): Portola and ACL are archived, so a
  newcomer lands on EDC Orlando and an old crew reads "this wall is the
  memory"; Settings opens at the top; and a phone whose saved copy cannot
  start asks its worker to repair it from the network, proved against the
  build's own stamp, before reloading. Rollback: Vercel
  dpl_DEi98ibDvwomqPvfSeo9tpzGfpue (v115 + the Oct 19 deps and data).
  The season's releases and reviews: the LEDGER,
  `claude-plans/2026-09-25-portola-live/LEDGER.md` (closed as history).
- **The same pass:** server functions on Node 24 with neon 1.2 (#93); a
  Dependabot cooldown and, on npm 11.10+, a 7-day wait for new
  resolutions (#89); EDC Orlando and Seismic by day (#92);
  Dependabot on Thursdays (#88); the docs and README (#94). No open
  license: Kevin declined MIT (#91 closed, #98).
- **Smoke check for a release:** `node ops/prod-smoke.mjs` (all three hosts,
  build and asset stamp).
- **Alerts:** PostHog → Slack for a new error and one that came back
  (`ops/posthog/`), plus one usage rule: 3+ phones red on sync in an hour.
- **Read it:** the pinned PostHog dashboard "Festival health" (2163278):
  errors and phones by build, opens, speed, sync, features, devices.

## Off-season: what still moves

- **Set-time drops.** EDC Orlando (expected around the last week of
  October) and Seismic (around Nov 9) have crews with picks. When a
  festival posts its times, it is a data-only push under the standing OK
  (validator + freeze + tests): `docs/fest-update-runbook.md`. Nothing
  watches for the drop yet; a phone left open picks it up when it comes
  back to the app (v116).
- **ACL's weekend 2** ran on the Aug 27 posters; it was never re-read. It
  is history now.

## Next: the iOS app

The plan is `claude-plans/2026-09-29-native-apps-stack.md`: Capacitor around
this app, TestFlight for the crew. Not started (the Mac session planned for
Oct 1 never ran). Kevin's side, as of Sep 29: Apple Developer approved and
Play identity verified; still to do, a Mac with Xcode 26 and Android Studio
(~30 GB free) and Developer Mode on his iPhone. Then paste this into a fresh
session on that Mac:

> This is a fresh session stepping into work we grounded in one research chat (a claude.ai cloud session, Sep 28–29, 2026: the stack comparison, Capacitor research, Apple and Play rules). Run the re-entry ritual first: festival-navigator's AGENTS.md, then NOW.md, then `claude-plans/2026-09-29-native-apps-stack.md` (the stack decision, the native pieces, the decisions and runbook; its dates have passed, its steps have not; the stack comparison is finished, don't redo it) and the chat itself at "~/Documents/HG Main/0.2 Clips + Social + AI/Agentic Research/misc/2026-09-29-festival-ios-tech-stack-chat.md" (Kevin's vault, outside this repo; it stays out of the public repo). Decisions already made, build on them, and reopen one only with new evidence: (1) Capacitor wraps the existing web app, no rewrite; (2) TestFlight and Android internal testing or a direct install first, no store listing yet; (3) over-the-air web updates with the web bundle shipped inside the app and a self-hosted updater, never loading fest.kevinhg.com remotely; (4) Buy Me a Coffee stays a link out, no in-app purchases. Still open, talk before building: the widget / Live Activity (Kevin, 2026-09-29: "not convinced about a widget"), the app ID (com.kevinhg.festival?) and the home-screen name. The deliverable is the Capacitor shell running today's app in the iOS Simulator and on Kevin's iPhone (`apiBase()` pointing server calls at fest.kevinhg.com, the offline data fallback), then a TestFlight build for the crew, with the release discipline of v103–v115 (red-first tests, CI green including Linux WebKit, an independent review, a real-input walk, never production data). Check Kevin's side first (Apple Team ID, Play's identity check, Xcode 26 and Android Studio installed, Developer Mode on his iPhone) and link every site or step you send him to. Before doing any work, echo back where we are and where we're going, and ask your questions.
>
> launch-pad: 3e80501e-f950-812d-ac9f-faea1a54b83b
> (leave this line in — pasting it clears this entry's handoff automatically)

## Open with Kevin

Each has a default; "3: yes" is enough.

1. **Staging** (stage.fest.kevinhg.com, a July build on the production
   database): retire it (Kevin, 2026-10-19). Pausing the Vercel project
   needs his hand, since the auto-mode checker refuses it from an agent:
   vercel.com/kevinhg/festival-navigator-staging/settings, then Pause; then
   drop AGENTS.md's staging bullet.
2. **Two List-view calls from Oct 4, never recorded** (his ring note and
   Pen checklist): "Default to list", and "in the List, highlighting should
   still just highlight" plus an always-reachable Picks view, which would
   reverse v104's rule that the List filters by highlight. Default: keep
   Board as the default and the List filter as shipped until he says.
3. **Crew codes** (find your crew, slice 3): a code he types or a shuffled
   three-word combo; the word list went to him Oct 3. Default: build the
   three-word combo once he OKs the list. Slice 2 (a home-screen row in
   Settings) waits on his test: Share → Add to Home Screen, open the icon:
   the board, or an empty start page?
   (`claude-plans/2026-10-02-find-your-crew.md`, Part A question 3).
4. **Product calls offered in September, no answer yet** (LEDGER 22–24):
   pinned notes as the room head's whisper (default: not now); a second
   import door in the just-joined welcome (default: yes); How it works
   without "White stroke = you" (default: keep it dropped); a tap on a
   grown card in Our picks (default: leave as is).
5. **v116 on his iPhone**, the first real phone on it: opening it lands on
   the app (no Try again screen); Settings opens at the top; Settings →
   Diagnostics says v116 from the worker; and v115's unconfirmed checks
   (Camera scans the Invite QR; long-press Save keeps the card; Pick for a
   friend → add a name). Default: whenever convenient.
6. **Ray's email**: the reply is a draft in Gmail (thread "Forked
   festival-navigator"); the September draft beside it can go.
7. **Housekeeping (Kevin: yes, 2026-10-19).** Done: no open license (#91
   closed, `UNLICENSED`), GitHub Pages off, branch auto-delete on, the
   `browser` job required beside `checks`, email addresses redacted on the
   kept `seasons/kickoff` and `live/plan-share` branches, and 91 merged and
   throwaway branches deleted (six kept as `archive/*` tags; left: main,
   `seasons/*`, `live/plan-share`, the open Dependabot branch). Still to do:
   the `hg-vibe-code-test-festival-nav` Vercel project in the codercom team
   (his login); in Neon, the test-walk crews, duplicate person rows and older
   backups (production data: a backup branch, then a reviewed plan).
8. **Dependabot #97** (pglite, jsdom, Playwright) came in red on its first
   run; the required checks keep it from merging. Look before it does.

## Next, when there is time

1. `BACKLOG.md`, real fixes first: the offline "drew"/"Drew" reconcile
   keyed on pid, and the crew playlist kept as keyed rows, not an array.
2. Add a show (`claude-plans/2026-09-02-add-a-show.md`) and the merged wall
   for two crews at one festival.

## Where the rest lives

- Rules: AGENTS.md. History: DEVLOG.md (search it; do not read it whole).
  The long list: BACKLOG.md. Specs and plans: `claude-plans/README.md`.
  Forking: `docs/fork-setup.md`.
- Backups: dated Neon branches (`backup-2026-09-23-prefest`,
  `backup-2026-09-26-pre-v101` and later ones), JSON exports outside the
  repo.
- NOW before 2026-09-16:
  `claude-plans/archive/2026/now-history-2026-07-07-to-2026-09-02.md`.
