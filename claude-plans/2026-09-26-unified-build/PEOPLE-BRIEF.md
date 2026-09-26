# The people menu + the Invite sheet (build brief, 2026-09-26 ~6 AM PT)

Kevin wants this before Portola ends (Sun Sep 27): "5. The people menu and
Invite sheet, with the crew link first." It is the left twin of the Show menu.
Branch `live/people`, off `live/list` at 0d19e6e (v97: the List view, the folded
past, the menu bar — releasing now). Ships as the release after v97 if its gate
is clean; otherwise right after Portola.

## Why (Kevin, 2026-09-25, trimmed)

"On mobile on the right, if you click the name of the festival, you filter which
locations you're seeing. On the left, I think you should be able to tap the little
avatar for yourself — and rather than it scroll you to the top, it opens a little
menu with the people and you can click to filter them. … If you're scrolled to a
specific part and want to filter, you don't want to go all the way to the top. Our
lists are long." The left menu should "look and behave like the right one … so
it's clear it has a similar action pattern." Approved 2026-09-26 ~12 AM PT: "Those
designs are great."

## The spec

The design is `claude-plans/2026-09-25-portola-live/design/people-shelf/BRIEF.md`
(read it whole; its frames are on this Mac under that folder's `frames/`, and
`frames.mjs` re-renders them) plus Kevin's call 8 in
`claude-plans/2026-09-25-portola-live/LEDGER.md` and item 2 at the top of
`claude-plans/2026-09-26-unified-build/PLAN.md`. The design was drawn on v92.
What has moved since, which the design did not know:

1. **The dock (v97)** reads `sync dot · FEST NAME '26 · ☰` on the right, and NOW
   is a tab in the scrolling day row (v96). The avatar (`#dock-you`) still sits
   at the left and still jumps to the top — that jump is what this replaces.
2. **The Show menu (v96)** is a popover that stays open across ticks and takes
   **no browser history entry** (CLAUDE.md, "Browser history is shared state";
   four review rounds were lost giving a menu its own entry). The Highlight menu
   is the same: stays open across taps (it is multi-select — the design already
   said so), closes on a tap outside, the avatar again, or Escape, and takes no
   history entry. Build it from the Show menu's own component, so the two cannot
   drift.
3. **"Invite someone", not "Add someone"** (Kevin, v93). The menu's row is
   **+ Invite someone**.
4. **Our plan** is being built in a sibling session on `live/plan` and may ship
   before or after this. Build the menu without an Our plan row, and leave one
   clearly marked place where a row slots in above Pick as someone else (a
   function the plan branch can fill); I'll hand that to the Our plan session.

### What to build

1. **The Highlight menu** behind the avatar (phone dock and the laptop rail's
   avatar, as a dropdown under it — design §7): HIGHLIGHT label, Everyone
   (✓ when nobody is highlighted), the crew one row each with a colour-ring mark
   that fills with ✓ when highlighted, "you" after your name; a divider; **Pick as
   someone else ›** (opens the join shelf in its member words — design §3, two
   taps to claim) and **+ Invite someone**. A highlight is viewer-side state:
   keep today's storage for it (filters.js, per fest, per tab) — never the crew
   document (CLAUDE.md, fests × circles × you, law 2).
2. **The dock pill while a highlight is on** (design §2): up to three faces
   overlapping and a ✕; faces reopen the menu, ✕ clears in one tap. Check 320
   with NOW live in the day row — the design flagged the squeeze; the day row
   must still show the live day.
3. **The phone's people row at the top goes away** (design §4); the search field
   and Notes move up. **Desktop keeps its people row** (default 3).
4. **A guest's avatar (the dashed +)** opens the same menu with Highlight and
   **Join the crew ›** (the join shelf); no "you", no Invite (default 1).
5. **Jump to top retires** with no door (default 2).
6. **The Invite sheet, crew link first.** Today there are two sheets: the share
   moment ("ONE LINK MAKES IT A CREW": the crew link, Copy, Share the link) and
   `openAddMember` ("INVITE SOMEONE": a name → their personal link, plus "From
   your other fests" chips) in `js/v3/app.js`. Kevin's order for the one sheet
   behind + Invite someone: **the crew link first (Copy / Share)**, then **a
   name** (Add → the success state with their personal link, as today), then
   **the people from your other fests**. Keep the server-first add, the people
   cap answer, the offline fallback, and the rule that only a member stamps the
   invite festival (a guest writes nothing). Where the share moment is opened on
   its own today (after creating a crew, and anywhere else), decide whether it
   becomes this sheet too, and say which you did.

### Motion (design "Motion", and CLAUDE.md "How this app moves")

The menu arrives like the Show menu; a tap fills a mark and dims the wall live;
closing with a highlight on, the chosen faces travel down into the avatar's slot
as it widens into the pill while the day tabs slide aside (the existing tab
FLIP); the ✕ reverses it. Reduce Motion / Low Power: instant. Nothing pops.
Storyboard it before building (memory: motion is designed, not patched).

## Laws and traps

The fest accent in exactly four places (the menus use `--brand`); the 44px floor
lives on `button` — be a button; storage getters in a try; WebIDL receivers
(store arrow wrappers); no history entry for a menu; no crew-doc writes from a
highlight; pick keys and note targets untouched; the SW stamp only at release
(don't stamp); the public repo (scan every diff for `#g=` + a long token with &&
before committing). Browser-test traps: under `page.clock` hold until the zoom
stands; a CDP flick ends with the finger still before a quick tap.

## Where and how

- Worktree `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/people`,
  branch `live/people`. Commit after each working step (scope-prefixed, no "wip"),
  push after each commit (a preview deploy only). Log `PEOPLE-BUILD.md` beside
  this file, started before code, grown as you go — if you die, it is the record.
- Rig for frames and walks: `claude-plans/2026-09-26-unified-build/list-rig.mjs`
  (local server, in-memory /api with a made-up crew of nine, writes refused and
  counted, SW blocked). Never production, a preview, `vercel dev`, or a real crew
  link — they all write the production database.
- This Mac is shared with other agents' browser runs (the tap change, walkers).
  Run the browser files you touch while building; run the full suite at the end;
  if a failure looks flaky, rerun that file alone before chasing it.
- Merge (never rebase) `origin/live/list` or `origin/main` in when I tell you
  they moved.

## Done means

- The menu, pill, guest route, phone top, desktop dropdown and Invite sheet
  match the design and this brief at 390, 320 and 1280, in Board and List, with
  a highlight on and off, deep in the wall — frames in `people-shots/`
  (git-ignored), looked at.
- Unit tests: highlight stays viewer-side (no sync call, nothing in the crew
  doc); the menu takes no history entry; the Invite sheet's order; a guest's
  menu; the claim step stays two taps.
- Browser tests with real input: open/close the menu (outside tap, avatar,
  Escape), multi-select, the pill's ✕ and faces, Pick as someone else → claim,
  Invite someone → Copy / Share / Add; Back unaffected by the menu.
- `npm test` in UTC, `TZ=Asia/Tokyo` and the night clock
  (`NIGHT_CLOCK=2026-09-27T04:30:00Z NODE_OPTIONS="--import ./tests/helpers/night-clock.mjs"`);
  `npm run test:browser`.
- Report: SHAs, test results, frame paths, every product call you made.
  Don't stamp, don't open a PR — I release it.
