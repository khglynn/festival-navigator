# The tap change — build log (branch `live/tap`)

**Started:** 2026-09-26 ~5:00 AM PT. Brief: `TAP-BRIEF.md` beside this. Builder: one Opus session in the
`shelves` worktree. Nothing here is stamped, PR'd or deployed; the coordinator owns those.

## What ships, in one screen

1. **Phone (a finger):** a tap on any card opens ONE shelf from the bottom: the card (name, when, where,
   the doors out), the − · + step row along the card's floor, the thread, the composer. No zoom, no notes
   button. For a member, − / + step the level (never a wraparound). For a guest, − / + and the composer's
   place ask who they are (the join shelf, naming the artist); only + carries the pick through.
2. **Desktop (a mouse):** unchanged. Hover grows the zoom with its − · note · + row; the note door opens the
   SAME shelf, which has the − · + row and no notes door of its own. A click on a card or on the zoom's
   body still cycles the pick.
3. **Keyboard:** unchanged (focus grows the zoom; Enter picks; Tab walks − · note · +; the note door opens
   the shelf).
4. **The long-press goes.** A hold is a slow tap: iOS sends the click on release (`-webkit-touch-callout:
   none` stays). Where an engine turns a hold into `contextmenu` instead (Android Chrome, Chromium's touch
   emulation), a finger's `contextmenu` on a card opens the same shelf and eats that gesture's click.

## Product calls made here (each is Kevin's to overrule)

1. **The step row's middle is YOUR METER** — the resting card's own corner chip (bars, then MUST, in your
   colour), drawn larger: `−  ▮▮▯  +`. "Each + fills a bar" is then literally what the finger sees.
   With nothing picked it is three hollow bars; a guest sees the same hollow meter. (Alternative framed:
   an empty middle, the bare − and + on the edges only.)
2. **The row is the card's floor, and it never moves under the finger.** The who-row sits above it; when a
   first + makes the who-row appear, the card grows UPWARD (the sheet's top rises; in a tall, scrolled
   sheet the sheet scrolls by the same amount) — the zoom's floor rule, carried into the shelf.
3. **The shelf arrives like the join shelf** (rises from the bottom edge on the arrival curve, the wall
   dims, the lines land a beat apart) and **leaves quick and plain** (drops to the edge). On a desktop the
   dialog keeps its scale-fade and fades out. Every notes sheet gets this — they are one sheet.
4. **The long-press goes** (above).
5. **A guest's − / + / note door take over the shelf's history entry** instead of stacking a second one,
   so "Look around" and the system Back land on the wall, never on a dead step.
6. **Copy** — the plan's Q2 defaults, adapted to the shelf (Kevin edits on the review page):
   a. How it works row 3: "Add your color to an artist." / "Tap it, then +. Each + fills a bar. 4 = must see."
   b. How it works row 5: "Details and notes." / "Tap the card. Violet = crew notes; …" (the rest unchanged).
   c. Welcome (member): "Tap any artist, then + to add yours."
   d. A one-time line, inside the first shelf a returning member opens (someone who has picked before, so
      learned "tap lights it"): "A tap opens the card now — pick with + here." Device-local flag,
      try-wrapped, never in the crew doc.
   e. The empty all-notes line: one sentence for every hand, no media query.

## What I took from U0 and U2, and what I skipped (and why)

Took:
1. **U0 item 2 — WebKit real in CI** (`ci.yml` installs `chromium webkit`; `BROWSER_TEST_REQUIRED=1` makes a
   missing WebKit fail). The tap contract's WebKit half is the proof that WebKit's tap sends a touch-type
   `pointerdown` before its mouse-shaped ghosts; without it the phone route is only proven on this Mac.
2. **U2's write path, the part the tap needs:** one `setLevel` under the tap cycle, the zoom's step and the
   waiting pick — so `applyWaitingPick` never goes through the routing (after this change the routing asks
   the hand, and a finger as the last hand would open a shelf instead of making the promised pick).
3. **The hand, renamed for what it now decides:** `tapOpensZoom` → `fingerHand()` (the tracker stays in
   card-facts.js).

Skipped:
1. U0's accent guard, motion/z tokens, the `.btn` move — nothing in the tap change needs them.
2. U2's `hand.js` module, `wireCardInput`, gallery.html importing the shipping routing — a refactor of the
   most fragile module in a festival week buys this change nothing it needs: the tap contracts here drive
   the REAL APP (index.html), not the gallery's copy, so the net tests the routing that ships.
3. U4/U5's shelf primitive (`shelf.js`, `openQuestion`) — the brief says reuse the notes sheet's anatomy.
   The arrival/exit added here is written so U5 can lift it whole.

## Rollback (the coordinator's condition, Kevin 2026-09-26: "as long as we bank and are prepped to maybe roll back those parts of the code (tap)")

This ships as its OWN release, never bundled with the List view or anything else, so it reverts alone.
1. **The exact revert:** `git revert -m 1 <the tap release's merge commit on main>` through a PR, then the
   ship recipe (stamp on a clean tree, gate, merge, prod-smoke). The server rolls back at once with
   `vercel rollback <the deployment before the tap release>`; phones follow on their next open (a busy
   phone shows the refresh strip — the reload glue is untouched).
2. **What reverts cleanly with it (everything is in the one merge):** the routing (app.js, wall.js,
   card-facts.js), the shelf (notes.js, v3.css), the copy (welcome.js, How it works in settings.js, the
   all-notes empty line), the docs (README, CLAUDE.md, MODEL-V4 §3a.4) and docs-truth's rows, the tests,
   and CI's WebKit install. Nothing outside the merge depends on it. Reverting CI only means WebKit
   contracts skip on Linux again, as before.
3. **What a phone sees after a rollback:** the v96-era gesture — a finger's tap on a card picks (the v91
   cycle), a hold grows the zoom, a guest's tap grows the zoom. No data changes either way: no crew-doc
   or person-doc key, no sync or merge change, no service-worker strategy change.
4. **New persisted state:** one device-local key, `fn_tap_news_v1` (localStorage, "this phone has seen the
   one-time line"). An old build never reads it; it sits unused and harmless. A re-ship after a rollback
   reads it and does not show the line twice.

## Steps (commit + push after each)

1. [x] This log (e700c10).
2. [x] Design: a frame rig (production app, a made-up crew, writes refused), phone shelf frames at 390 and
   320 (member, guest, doors out, long thread, keyboard up), the desktop path at 1280. Paths to the
   coordinator.
3. [x] The shelf (877d336, WIP): the step row in the sheet card; header refresh with the zoom's who-row motion; the
   arrival and exit; the guest's doors.
4. [x] The route (877d336, WIP): a finger's tap / hold opens the shelf for everyone; the long-press and the finger-zoom
   code go; `setLevel`; the welcome goes on the first tap.
5. [ ] Copy + docs (README, CLAUDE.md, MODEL-V4, How it works, gallery hint) with docs-truth.
6. [ ] Tests: unit (delete long-press; tap-shelf; first-open; zoom-overlay/ghost/hover-grace renames),
   browser (the tap contract in Chromium + WebKit; the rewritten finger routes), CI WebKit.
7. [ ] Gate: `npm test` × 3 clocks, `validate-festivals`, `test:browser`; a real-input walk of every tap
   path including the WebKit ghost cases.

## Log

- **05:00** Read TAP-BRIEF, PLAN (§2.1–2.3, U0, U2, U3, U5, §4, §6), REVIEW-1, map-input, the repo
  CLAUDE.md. Baseline `npm test`: 1043 pass, 1 fail — the SW stamp (expected: the branch is not stamped;
  the coordinator stamps).
- **05:40** Baseline browser suite: 218/219 — one pre-existing red in now-jump ("390, Dee at 7 PM: a
  repaint keeps the cycle…"), on the base before any edit here.
- **06:30** 877d336: the shelf + the route, WIP. The rig (`tap-design/rig.mjs`: the production app, a
  made-up crew, writes refused) with REAL touch taps in Chromium and WebKit: the tap opens the shelf in
  both engines (WebKit's tap reads as a finger), + steps 0→1→…→must, the row's y never moves (0px; the
  sheet's top rose 29px when the who-row appeared), a guest's + raises the join shelf on the notes shelf's
  own history entry. Frames + contact sheets in `tap-design/frames/` (gitignored), sent to the coordinator.
  Two calls added while looking at frames: the composer sticks to the shelf's bottom edge (a long thread
  hid it a whole scroll away), and the card's tap-highlight flash is off.
- **06:45** Coordinator: calls a–h stand for now (Kevin decides on the preview). Ship as its own release;
  the Rollback section above.
