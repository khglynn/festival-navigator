# NOW — the unified build (arc)

**last-updated: 2026-09-26 6:50 AM PT · mode: arc** · plan: `PLAN.md` beside this
(+ `REVIEW-1.md`, and Kevin's calls at the top of PLAN.md) · live-ops rules:
`claude-plans/2026-09-25-portola-live/RUNBOOK.md` · started as an hg-durable-build.

## Where it stands

- **Phase 1 — List view + menu bar: SHIPPED** as v97 (6:42 AM PT, PR #54;
  log `LIST-BUILD.md`). Two Sol nits and the Board's in-room fold are LEDGER
  follow-ups.
- **Tap change** (`live/tap`, `TAP-BRIEF.md` / `TAP-BUILD.md`): built, walked,
  Opus-reviewed; Sol found a VoiceOver route, the composer's ride over the iOS
  keyboard and a one-time-line nit — fixing. Then a preview with a demo crew for
  Kevin's iPhone; ships alone after his OK.
- **People menu + Invite sheet** (`live/people`, `PEOPLE-BRIEF.md`): building
  (Opus); leaves a slot for Our plan's row.
- **Our plan** (`live/plan`, sibling session, `OUR-PLAN-HANDOFF.md`, log
  `OUR-PLAN-BUILD.md`; afternoon): shipping as "Our picks" in PR #60 (v101),
  held on Linux WebKit browser reds. Cause: a loaded CI runner starts
  animations late, so tests measured the panel mid-move — and one real app
  flaw, the window popping when grabbed mid-settle. Both fixed, plus Kevin's
  peek note (NOW level with the name), at `live/plan` 2b14fdf; Sol clean but
  the stamp; with the coordinator to merge, stamp, CI and ship. Kevin has
  answered the Share calls (review-page comments, logged in
  `OUR-PLAN-BUILD.md`): the Share build starts from main after v101, with the
  arrival/redraw catch banked there.
- **ACL prep** (`data/acl-prep`, `ACL-PREP-BRIEF.md`, round two
  `ACL-PREP-ROUND2.md`): Late nights times; round two makes sure no guess is
  later than the show and fixes `guess-run-times` for date-keyed sections. The
  Zilker headliners' ends print nowhere — a code rule, decided separately.

## Order (Kevin: "smart dev order please")

Before Portola ends (Sun Sep 27): v97 (List), the tap change (after his
iPhone OK), the people menu + Invite sheet, Our plan — each only on a clean
gate. After Portola, for ACL (Late nights from Sep 29, Zilker Oct 2): U0 nets
(the LEDGER's follow-ups) and ACL prep, the shelf primitive with the banked
numbered-history work (v93-BUILD.md), then a design session for the hour pin
and the moment lens; add-an-event stays banked (`claude-plans/2026-09-02-add-a-show.md`).

## Next step

Tap: Sol's round → merge main → preview + demo crew → Kevin's iPhone test.
People and Our plan: gate each as it lands, release in the order they come
clean. ACL: review round two's rooms before merging the data.
