# v93 — NOW beside the live day, "+ Add someone", a solid +3 ring (build log)

Started 2026-09-25 ~10:15 PM PT. Branch `live/v93`, worktree
`.claude/worktrees/v93`, based on v92's pushed head (abe7205) so it rebases
cleanly onto the final v92. Builder: an Opus teammate.

## Why

Kevin approved these on the review page (round 3/4 defaults, 2026-09-25):
the dock's NOW is pinned to the left, which pushes THU off at 390 and at 320
shrinks NOW to a dot and the days to slivers ("RI | SAT | S"); he called the
dot "a bit too clever" and asked for clean solutions. Design:
`claude-plans/2026-09-25-portola-live/design/ours-r2/BRIEF.md` (in the
portola-live worktree: /Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/claude-plans/2026-09-25-portola-live/design/ours-r2/),
section "The dock: D1 / D2", frames `frames/D0-*.png`, `frames/D1-*.png`.

## The three items

1. **D1 — NOW joins the day row.** While something is live, NOW is a tab in
   the scrolling day row right after the live day (`SAT · NOW`), brand violet
   with the live dot (never the festival accent — CLAUDE.md's four places).
   The row keeps that pair in view and never leaves a sliver at either edge:
   390 shows `FRI SAT NOW SUN`, 320 shows `SAT NOW`; nothing is pinned; the
   fest name never gives way. Motion: NOW fades in from 6px left while the
   tabs after it slide right (the existing tab FLIP); the row glides to
   centre the pair; when nothing is live NOW leaves quick and the next day
   slides back. `fitNowTab`'s dot and squeeze retire. The NOW jump's
   behaviour (stops, cycle, highlight, stack-row slide from v91) is unchanged
   — only where its tab lives. Desktop: the same row.
2. **"+ Add someone"** replaces "+ Add" in the people row (the words Settings
   already uses), so the plus says what it does. Check the row at 390 with six
   people and at 320.
3. **The +3 overflow on a card's crew corner gets a solid ring** instead of a
   dashed one, so dashed only ever means "add". Check the corner fit rules in
   `js/v3/aura.js` (GIVE_WAY) still hold.

## How to work

Same rules as v90–v92 (only this worktree; commit and push as you go on
`live/v93`, a preview only; no PR/merge/stamp; no crew-data, sync, merge,
artist-name or update-machinery changes; never load production with a crew
link or write to the production database; one suite and one browser at a
time). Tests: the dock/NOW unit and browser tests that pinned the old dot
behaviour change to pin D1 (name them in the Log); walk the dock at 320, 390,
430 and 1280 with something live and nothing live, a NOW tap, and a day
switch; screenshots into `v93-shots/`. One full `npm test` at the end.

## Log

- 22:25 PT — started. Read the brief, CLAUDE.md, the design (BRIEF.md "The dock: D1 / D2",
  frames D0/D1, docks.png). Baseline walk of the v92 dock: 320 = ringed dot + "RI | SAT | S";
  430 = a "HU" sliver of THU at the left edge.
- **D1 built** (cde8607, 3fc74f5). NOW is a tab in the day row after the day a tap would land
  on, in the dock and the rail; parked hidden just outside the row when nothing is live, and
  lifted out/put back around every rebuild (each repaint keeps the row's scroll, so a friend's
  pick on the poll moves nothing). Where a row rests is one pure rule, `wall.js restingLeft`:
  the day you are in whole > NOW whole > its day whole > those clear of the edge fades > no
  sliver at an edge (a tab past an edge shows <= 6px or is cut <= 6px) > closest to centring.
  Results (Portola, Chromium, 2x): 320 `SAT NOW` exactly; 375 `FRI SAT NOW`; 390 `FRI SAT NOW
  SUN` (the frame); 430 all five (see next); Sun live NOW is the last tab (`SAT SUN NOW` at 390);
  Thu live `THU NOW FRI SAT` (a day with no festival room); ACL 375/390 `SAT 3 NOW`.
  `fitNowTab`, `.now-tab.compact`, `.dock.squeezed` retired; the fest name never gives way.
- **A row that nearly fits, fits** (`fitDayRowGap`): its gaps tighten from `--gap` 24px down to
  `--gap-min` 16px before it scrolls. Portola's five at 430 (26px over) and four days at 375
  (16px over, nothing live) now show whole instead of a THU fragment. Measured against the real
  scroll range (the last tab's 2px touch reach counts).
- Found by measuring, fixed: (1) tab offsets are whole px while the range rounds, so NOW after
  SUN read 0.5px "not whole" and hid — 1px slack; (2) NOW's arrival transform shrank
  `scrollWidth` 2px mid-rest — the range is read from layout, and a zero-width end mark holds
  it while tabs slide; (3) a stale "overflowing" after a slide — edges marked from layout.
- **Motion**, filmed at 0.1x (CDP playback rate): NOW fades in 6px from the left in its own
  place a beat after the tabs start (first cut rode with SAT and started on top of SUN); the
  tabs FLIP from old screen place to new (instant re-rest + transforms, so each tab moves once);
  leaving, NOW fades quick and plain, then the room closes up crisp (EASE_SURFACE); the edge
  fades hold through the slide (`holdDayRowEdges`) so THU comes back out of a fade, not a hard
  cut. Reduce Motion: instant, 0 animations on the row.
- **+ Add someone / solid +n** (fbb7eb0). How it works row 2 draws and names the same chip
  (Kevin's sentence kept, label updated; MODEL-V4 §3a.4 + docs-truth pin follow). The welcome
  card's +n more is solid too. Chip is `white-space: nowrap`.
- **Show menu (coordinator, from Kevin)** (96c8593): stays up across toggles; closes on a tap
  outside (swallowed — never picks the card under it), Escape, the fest name again, Back; a
  router `menu:` layer, so history ends as it found it and Settings takes the entry over.
  Gear = the header's path at 12px in the check column, --text-secondary. Row :hover only
  under `(hover: hover)` (a finger left the tapped row grey). No hide-everything guard exists
  in the menu today; hiding all rooms shows the wall's notice — unchanged.
- Tests so far: `restingLeft` exercised through `tests/wall-filters.test.mjs` (its mocked row
  made consistent), `tests/router.test.mjs` +2 (menu layer), `tests/shell-v4.test.mjs` (menu
  stays up; four ways out + history; outside tap reaches no card; Settings takes the entry;
  the gear). Next: pure `restingLeft` cases, the browser NOW tests that pinned the dot.
- **Tests pinned** (30119ee): `tests/day-row.test.mjs` (new) — `restingLeft` in Chromium's
  numbers (390 FRI SAT NOW SUN, 320 SAT NOW, last day, Thursday, the day you are in outranks
  NOW, ACL 320, the half-pixel slack) plus a property check over every dock row 90-290px:
  whenever a place with no sliver is as whole, the rule picks one. It caught a wrong order
  (fade clearance above no-sliver); fixed: no sliver outranks clearance. The shell half boots
  the real app on a pinned Saturday night: NOW in the row after SAT (dock and rail), back in
  place after a repaint, parked outside the row when nothing is live, after SUN on Sunday.
  `tests/browser/now-jump.test.mjs`: "NOW sits before the days" -> "in the row after the live
  day"; the ACL-305 squeeze test -> "the fest name never gives way"; the 320 overlap test;
  the dot/word matrix -> the D1 matrix (Portola 430/390/375/320 exact rows, ACL contract, each
  also with Linux-wide glyphs); new: the clock brings NOW in and out (motion on: 6px fade-in
  and tab slides, transforms/opacity only; Reduce Motion: no animation). Tests wait for today
  lit and the row at rest (under the pinned clock the scrollspy lights late, then glides).
- **Add chip box** (674bbe2): 1px dashed + the name chip's padding, so alone on its line (six
  people at 390) it is 24px like the names (Chromium drew the 1.5px edge as 1px).
- **Show menu, second cut** (5f5162d, f332342) — two real bugs found in a browser and fixed:
  (1) popping the menu's history entry restored the page to where it stood at open (the wall
  scrolls behind the menu: Escape/Back/tap-outside yanked 2500 -> 1000, both engines); the menu
  tracks the page's place and holds it through the pop. (2) Swallowing every outside tap made
  the dock's + need two taps (v92 has since made a close-tap eat only a card's click), and a
  tap that opened a layer before the entry was gone would be popped by the menu's own Back.
  Now every way out takes the entry back first, holds the page, then gives the tap to its
  target (a card never hears it); Settings opens after, so Back from Settings lands where you
  were; a guest's + opens the shelf on one tap with its entry where the menu's was. Escape from
  a row returns focus to the fest name. Probed in Chromium and WebKit: every way out 2500 ->
  2500, FRI tab -> Friday in one tap, Settings -> Back -> 2500, history never grows past +1.
- **Rebasing onto v92** — v92 has moved past abe7205 and reworked the same functions, so it is
  no longer a clean rebase. My `git rebase` was refused by the harness as destructive; I did
  not force it. Final read-only `git merge-tree` against v92 head 3f40a4f: five hunks, all in
  `js/v3/app.js` (v3.css and index.html merge clean). Resolution — keep v92's menu-exit
  machinery (`menuExit`/`settleMenuExit`/`hideShowMenu`/`dropShowMenu`, which supersedes v93's
  simpler reopen-mid-fade `hide` guard) and add v93's few lines:
  1. `askToJoin(artist, { intent })`: v93's guard first —
     `if (openMenu) { leaveShowMenu(() => askToJoin(artist, { intent })); return; }` — then
     v92's `const opener = shelfOpener();`.
  2. `closeShowMenu`: v92's body, with v93's two lines right after
     `link.setAttribute('aria-expanded', 'false');` —
     `if (document.body.dataset.busy === 'show-menu') delete document.body.dataset.busy;` and
     `if (pop.contains(document.activeElement)) link.focus({ preventScroll: true });` — then
     v92's `settleMenuExit();` and the rest. Drop v93's `hide`.
  3-4. `paintShowMenus` (both branches):
     `if (existing) { if (openMenu && openMenu.pop === existing) leaveShowMenu(); dropShowMenu(existing); }`
  5. Escape: `if (openMenu) { leaveShowMenu(); return; }` then v92's
     `if (leaveShelf('escape')) return;`.
  `openShowMenu` auto-merges (v92's bar lift, then v93's scroll hold, busy flag and
  `router.push`); so do the row toggle and `.menu-label`. v92's
  `tests/browser/show-menu-stacking.test.mjs` should pass as written: its synthetic
  `dock-you.click()` is held, the menu's entry goes, then the + opens the shelf. Re-run the
  full unit and browser suites after the merge.
- **"Show" label** (43f80d1, coordinator from Kevin): the menu's head becomes one reusable
  class, `.menu-label` — 10px/800/`--track-label`/uppercase in `--text-secondary`, lined up
  with the check column — for the Highlight menu to wear too. Shots: `menu-open-390.png`,
  `menu-open-320.png`, `sheet-menu-label.png`.
- **Verified** (on 43f80d1's code, before the label): full `npm test` 990/992 in local time,
  with `NIGHT_CLOCK=2026-09-27T05:30:00Z`, and in `TZ=Asia/Tokyo` — the one failure each time
  is the asset stamp (the orchestrator's; a temporary `--keep` restamp passes
  app-shell-complete + sw-stamp, then restored from a copy), one skipped. `npm run
  test:browser` 190/191: the one failure is `zoom-notes-chip` "WebKit: after a pick, one click
  on the zoom's notes chip…", which fails identically on v92's abe7205 (an exported copy) and
  passes on v92's current head b29aac0 — pre-existing, fixed upstream. The NOW "card is
  replaced mid-glide" case flaked once under full-suite load and passes on its own.
- Walk (`node claude-plans/2026-09-25-portola-live/v93-walk.mjs [rest|motion|tap|menu|people]`,
  shots in `v93-shots/`, git-ignored): rest at 320/375/390/430/1280 for Sat live, nothing live,
  Sun live, Thu live, ACL; motion arrive/leave at 390/320 filmed at 0.1x plus Reduce Motion;
  NOW tap + day switch at 390/320/1280; the menu at 390/320/1280; the people row + Robyn's +n
  at 390/320; the welcome card's +4 (guest).
- **Independent review** (Opus, read-only) — one must-fix and three should-fixes, each checked
  in a real engine first, then fixed (a61144a): the day row's scroll clipped every tab's 44px
  reach (NOW and the days answered a finger only on their text; now +/-12px in both engines,
  dock still 45px); the replayed tap threw on an icon's `<svg>` (desktop gear); the zoom's
  grown card was not treated as a card (a close-click could pick); an open menu did not hold a
  new build's reload (now `body[data-busy]`, index.html untouched), and a refresh reopened it.
  Nits fixed: a menu whose popover goes takes its entry; NOW keeps keyboard focus through a
  repaint; the hold keeps scrollX; the gap fit is read from layout (19a261d). Also found
  myself and proved in Chromium: a double way out before the popstate took two entries back
  and left the app (bd04a2c) — pinned in the browser contract.
- **Caret + How it works** (8242f72, from Kevin): `.menu-caret` (reusable; `.down` for the
  rail), after the fest name, part of the button, --text-secondary, hidden where the name
  opens no menu (EDC Orlando). It costs the day row 8px, and the final sheet showed what
  that did — Sunday at 390 left a fragment of FRI at the edge — so the dock's three parts now
  sit 10px apart (was 14), which gives exactly the 8px back: every D1 frame is back to its
  pre-caret numbers, and ACL at 320 keeps SAT 3 whole where Inter draws wide. `--gap-min`
  is 15 (the near-fit floor). How it works: nine rows, each
  "feature. how." (MODEL-V4 §3a.4 and the docs-truth pin follow); the dot's own row draws the
  real `.sync-dot` in its three states. Shot: `how-it-works-390.png` (and 320).
- **Final verification** (19a261d; the dock gap commit after it re-ran the dock and shell
  browser contracts 66/66 and `npm test` 993/994, the stamp only): `npm test` 993/994 — the stamp only (one run of three also
  flaked `shell-v4` "hiding the last room" under full-suite load; 5/5 alone, 0 in the other
  runs); with `NIGHT_CLOCK` the same. `npm run test:browser` 194/195 — only the pre-existing
  WebKit notes-chip case, fixed on v92's head. The whole walk re-run (40 scenarios, no page
  errors).
- **Gear glyph** (coordinator): How it works' last row draws the header's own gear SVG instead
  of "⚙" (iOS can render the glyph as a colour emoji). `gearIcon(size)` moved to
  `js/v3/tools.js` (already in APP_CORE) and serves the Show menu's Settings row too.
  `shell-v4` 28/28; shot `how-it-works-390.png`. Standing by: the coordinator rebases onto
  main once v92 lands, using the "Rebasing onto v92" notes above (note: `gearIcon` now lives
  in tools.js, so the resolution's app.js hunks are unchanged).
- **Merged with v92** (the coordinator's 245cd26: v92 a73df70 merged in, the five hunks as
  written). Post-merge: v92's `tests/show-menu-fade.test.mjs` assumed a synchronous close
  from the fest name; since v93 that close lands with the popstate, so its two cases now wait
  for it (ec89117, same assertions).
- **"+ Invite someone"** (dc67f5c, Kevin 2026-09-26 "invite, not add"): the chip, its label,
  the sheet's head (INVITE SOMEONE) and dialog name, How it works' picture and row ("Invite
  your people." / "Tap + Invite someone, or share the crew link — …"), Settings' crew card,
  MODEL-V4 §3a.4, the docs-truth pin, docs/user-flows F2b, the gallery. The sheet's own
  button still says **Add** (it adds their name, then hands over their link) — Kevin's call
  if it should say Invite too. Fits: one line everywhere, 24px tall, 390 alone on its line,
  320 beside two names, Settings' card at both widths, How it works' cell with no clipping.
  Shots: `final-invite-chip.png`, `people-390.png`, `people-320.png`,
  `settings-crew-390.png`, `settings-crew-320.png`, `invite-sheet-390.png`,
  `how-it-works-390.png`, `how-it-works-320.png`.
- **Verified on the merged head:** `npm test` 1014/1015 twice, the stamp the only failure.
  `npm run test:browser` 207/207 on the second run, including the WebKit zoom-notes-chip case
  v92 fixed. The first run had three load flakes (the guest-tap-route shelf Escape in both
  engines, show-links' door-under-pointer); each passes alone. The walk's people, menu and
  how scenarios were clean at 390/320/1280.

