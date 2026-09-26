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
- **Share for Our picks** (`live/share`, the sibling session; log
  `SHARE-BUILD.md`): the text share (at most five picks, "Full rundown:" and a
  link with `&plan=open`), the welcome card's ✕, "Share the crew link" in the
  Show menu, and the two touch-timing catches banked from v101. Gated at
  f7a3d25 and cut as `release/share` (v103). The coordinator's Sol pass found
  a stale "now" (a stop outlasting its set, live since v101 for up to 10
  minutes after a set), a plan link that forgets its day, and a highlight's
  share naming the whole crew's acts; the sibling is fixing them on
  `live/share`, each with a failing test first. Next for the sibling, Kevin's
  new set in a design round on `live/plan-days-design`: Despacio crowding the
  route, the open plan scrolling on to future days, the menus while it is open.
- **Map for Kevin**: `claude-plans/2026-09-25-portola-live/maps/` (CSVs per
  night and type, `gen.py`); a private Google My Map is being built from them.
  The in-app version is banked for the reference tab (2027).

## Order

Before Portola ends (Sun Sep 27): v103, then the Share — each only on a clean
gate. After Portola, for ACL (Late nights from Sep 29, Zilker Oct 2): the
LEDGER follow-ups (U0 nets first), the Zilker headliners' ends, the shelf
primitive with the banked numbered-history work (`v93-BUILD.md`), then a
design session for the hour pin and the moment lens; add-an-event stays
banked (`claude-plans/2026-09-02-add-a-show.md`).

## Next step

Read the v103 builder's hand-back → Sol review on its head → walk → release.
Then the Share head from the sibling → release. Then wrap: worktree cleanup,
`/save-session`.
