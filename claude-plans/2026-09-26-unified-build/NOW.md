# NOW — the unified build (arc)

**last-updated: 2026-09-26 3:30 PM PT · mode: arc** · plan: `PLAN.md` beside this
(+ `REVIEW-1.md`, and Kevin's calls at the top of PLAN.md) · live-ops rules:
`claude-plans/2026-09-25-portola-live/RUNBOOK.md` · started as an hg-durable-build.

## Where it stands

- **Shipped today** (details and rollback targets in the portola-live LEDGER):
  Phase 1 List + menu bar as v97 (6:42 AM, `LIST-BUILD.md`); ACL Late nights
  times as data #56 (8:42 AM, `ACL-PREP-LOG.md`); the tap change as v98
  (11:05 AM, `TAP-BUILD.md`, after Kevin's iPhone test on a preview); the
  people menu + Invite sheet as v99 (12:05 PM, `PEOPLE-BUILD.md`); the laptop
  wall's left edge as v100 (12:17 PM, `ALIGN-BUILD.md`); Our plan, renamed
  **Our picks**, as v101 (2:37 PM, `OUR-PLAN-BUILD.md`); the Spotify playlist
  names as v102 (2:56 PM).
- **v103** (`live/v103`, Opus builder, `V103-BRIEF.md` on that branch):
  NOW first in the day row and fixed there across days (the one-NOW rule
  kept); the List filters to highlighted people's picks; the crew playlist
  searches every picked artist's top songs with a backoff for Spotify's rate
  limit, and reports artists that got none. Gate: Sol → Sonnet real-input
  walk → merge main → stamp above main → CI both jobs → merge → smoke.
- **Share for Our picks** shipped as v103 (PR #64, 10:18 PM PT; log
  `SHARE-BUILD.md` items 1–20). The v101 window catches stay banked at the tag
  `back-pocket/window-catches` and in the plan-days DESIGN.md.
- **Our picks across the days** (`live/plan-days-design`, the sibling session;
  plan and log `plan-days-design/BUILD.md`): Kevin approved every default on
  the design page (Despacio as a drop-in room, the plan across the days, the
  menus over it). Main at v103 is merged in (0b82dfa), and an Opus builder is
  on P1–P3 (the prototype made the product, the days in one list, the menus
  over the open plan). Next: review its handback; merge v104 the day it lands
  (Mon Sep 28) and re-run the suites first; P4–P5 (where a stop ends, ACL
  ready); then the Share's gate and the SHA to the coordinator, aimed at ACL
  Late nights from Tue Sep 29.
- **Map for Kevin**: `claude-plans/2026-09-25-portola-live/maps/` (CSVs per
  night and type, `gen.py`, prices from the festival file); a Google My Map
  in Kevin's personal account, link-shared, built from them. The in-app
  version is banked for the reference tab (2027).

## Order

Before Portola ends (Sun Sep 27): the Share (as v103), then `live/v103` (as
v104) — each only on a clean gate. After Portola, for ACL (Late nights from Sep 29, Zilker Oct 2): the
LEDGER follow-ups (U0 nets first), the Zilker headliners' ends, the shelf
primitive with the banked numbered-history work (`v93-BUILD.md`), then a
design session for the hour pin and the moment lens; add-an-event stays
banked (`claude-plans/2026-09-02-add-a-show.md`).

## Next step

The Share: stamp v103 on `release/share`, Sol on the release head, CI, Kevin's
look, merge, smoke. Then `live/v103`'s hand-back → Sol → walk → release as v104. Then wrap: worktree cleanup,
`/save-session`.
