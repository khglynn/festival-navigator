# Walk brief: live/v103 (ships as v104), real input, independent of the builder

You are an independent walker. The builder already filmed and tested this; your
job is to use it like a person would, with REAL input, and report what breaks.

## Where
Worktree `.claude/worktrees/v103` (branch `live/v103`, head bfcf621). Build log:
`claude-plans/2026-09-26-unified-build/V103-BUILD.md` (read "Calls" so you know
what is intended). Use the builder's rig as your base:
`claude-plans/2026-09-26-unified-build/v103-rig.mjs` exports `openRig({engine})`
(a local static server over this worktree, /api answered from memory with two
invented crews, every write refused and counted, every other host aborted, the
service worker blocked). Write your own walk script beside it
(`v104-walk.mjs`), importing openRig; do not edit app code or the rig.

Never production, never a preview URL, never a real crew link. If you need a
clock, pin it the way the rig does. Screenshots go to `v103-shots/walk-*.png`
(git-ignored).

## Input rules
Real input only: `page.mouse`, `page.touchscreen` / CDP touch for a finger,
`page.keyboard`. Never `element.click()` or dispatchEvent. Run each phone check
in Chromium with a touch context AND in WebKit.

## Walk these (each: PASS / FAIL / UNSURE + one line + a screenshot for any FAIL)
1. NOW in the day row, Portola Sat 10:30 PM, `sparse` crew: at 1280 NOW is the
   first item; at 390 and 320 the day you are in (SAT) is fully visible; a
   finger swipe right on the row reveals NOW; tapping NOW jumps the wall to
   what is on now; switching to SUN and back never moves NOW's position in the
   row.
2. NOW when Our picks' peek carries it (`design` crew): the dock has no second
   NOW (one-NOW rule); highlight one person (avatar menu) → NOW returns to the
   day row.
3. List + highlight (`design` crew, List view via the Show menu): highlight one
   person → only their rows remain, empty rooms read "nothing <Name> picked";
   add a second person → rows return with a stagger; clear → all rows back;
   EARLIER counts change with the filter; Board with the same highlight only
   dims.
4. Pick while filtered to yourself: un-pick a row → it dims in place and leaves
   on the next repaint, nothing jumps under your finger.
5. Our picks open + highlight, both orders, at 390 and 1280: nothing stuck,
   Escape / close works, the wall filters.
6. ACL Late nights (acl-2026, a date in Sep 29–Oct 10 after 9 PM) at 390: NOW
   row behaviour and a highlighted person with no late-night picks (how many
   "nothing … picked" lines appear).
7. Reduce Motion (emulate prefers-reduced-motion): the filter change is
   instant, nothing broken.
8. Rig counters: the number of refused writes at the end (should be 0 for
   highlight/filter actions — the highlight is viewer-side only).

Spotify: do not walk against Spotify. Read `v103-spotify-walk.mjs` and run it
once if it runs offline; report its result.

## Bank as you go
Create `claude-plans/2026-09-26-unified-build/V104-WALK.md` first and append each
result as you finish it. Do not spawn agents. Final message: the table of
results, anything FAIL/UNSURE with its screenshot path, and the write counter.
