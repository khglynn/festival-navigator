# NOW — the unified build (arc)

**last-updated: 2026-09-26 10:30 PM PT · mode: arc** · plan: `PLAN.md` beside this
(+ `REVIEW-1.md`, and Kevin's calls at the top of PLAN.md) · live-ops rules:
`claude-plans/2026-09-25-portola-live/RUNBOOK.md` · started as an hg-durable-build.

## Where it stands

- **Shipped 2026-09-26** (rows, reviews and rollback targets in the
  portola-live LEDGER): v97 List + menu bar (`LIST-BUILD.md`), data #56 ACL
  Late nights times (`ACL-PREP-LOG.md`), v98 the tap change (`TAP-BUILD.md`),
  v99 people menu + Invite (`PEOPLE-BUILD.md`), v100 the laptop left edge
  (`ALIGN-BUILD.md`), v101 Our picks (`OUR-PLAN-BUILD.md`), v102 playlist
  names, data #63 nine more ticket prices, and **v103 the Share for Our
  picks** (10:18 PM, `SHARE-BUILD.md`): up to five lines read from exactly
  the rows the plan just drew, a link opening that night's plan after the
  peek rises, the welcome ✕, "Share the crew link" in the Show menu. Cut
  from it after five Sol rounds: the model's stop-end cap and the v101 window
  catches (tag `back-pocket/window-catches`, banked in the plan-days
  DESIGN.md).
- **v104 is built and gated, held to Monday** (`live/v103`, head d226f70
  code; `V103-BUILD.md`): NOW first in the day row, the List filters by
  highlight (a run of empty Late-nights dates is one line), the crew
  playlist's top songs with Spotify rate limits honoured, a write never
  repeated blind, the playlist recorded once at the end, focus kept through
  a friend's repaint. Sol: three rounds + two targeted checks, all fixed;
  walker 8/8; CI browser green. Held because it moves NOW on phones and
  Portola's last day is Sunday (Kevin agreed, 2026-09-26 evening). Kevin's
  call on NOW at phone width: option a, as built.
- **Next build: Our picks across days** (`live/plan-days-design`, the
  sibling session; log `plan-days-design/BUILD.md`; Kevin approved every
  default on its design page, C6 included): P1–P5 built by an Opus builder
  and through an independent review (`plan-days-design/REVIEW-P1P3.md`,
  11 findings fixed) — Despacio as a drop-in room, the plan scrolling on
  through later days, both menus over it with a highlight filtering the
  route (one NOW kept under a highlight, Kevin's call), a short changeover
  standing as its own stop so no stop outlives its act, ACL goldens. Since:
  the CI glide fix, the short-plan default, the morning after, Sol's first
  round fixed (`plan-days-design/SOL-R1.md`), a real-input walk green on
  both engines (`plan-days-design/WALK-1.md`) and Sol's recheck
  (`plan-days-design/SOL-R2.md`; its close-and-repaint revival fixed in
  3f5a337); Sol's final check on af238e9 (`plan-days-design/SOL-R3.md`)
  found nothing blocking, and its two findings are queued. Two main fixes
  ride v104 on their own branches: `fix/composer-focus` (the composer
  flake) and `fix/test-clocks` (in build; the suites read the machine's
  clock and go red from 10 AM Sunday until 5 AM Monday on every branch).
  Next: Sol's two findings, merge v104 Monday, then CI three greens and the
  walk on the final head; SHA to the coordinator for ACL Late nights (Tue
  Sep 29).
- **Map for Kevin**: `claude-plans/2026-09-25-portola-live/maps/` (CSVs,
  `gen.py`, prices); a Google My Map in his personal account, link-shared.
  The in-app version is a Pen card (the 2027 reference tab).

## Order

Monday Sep 28: release v104 (merge main, stamp v104, a targeted Sol check on
the merge, CI both jobs, smoke). Then the plan-days build, gated the same way,
before ACL Late nights. After ACL: the LEDGER follow-ups (U0 nets first), the
Zilker headliners' ends, the shelf primitive with the banked numbered-history
work (`v93-BUILD.md`), a design session for the hour pin and the moment lens;
add-a-show (`claude-plans/2026-09-02-add-a-show.md`, its Pen card now carries
Kevin's "add an event" questions).

## Next step

Monday morning: cut `release/v104` from `live/v103`, merge main (v103), stamp
festival-nav-v104, run the targeted Sol check on the merge and CI, merge,
smoke, PostHog. Then take the plan-days SHA from the sibling when it's gated.
