# The unified build: one hand, one shelf, one button family, Our plan

> **Status 2026-09-25 late:** drafted from the three maps beside it and reviewed once by Codex (`REVIEW-1.md`: bulk/bring need a person-aware batch writer, the plan cache must invalidate on picks, the join shelf's history cases, a real-iPhone gate for the tap change, liveWindowOf as its own gated PR, search/desktop visibility for the peek, the Show-menu fix already in v92, and rollback wording). Revise before U0. Kevin's order call (2026-09-25, ~10:50 PM PT): "don't twist into pretzels to release the right things first vs last — release in the order that makes the most sense for the quality of the build." So the order is the engineering order below, revised with REVIEW-1's simplifications (U2+U3 as one gesture release; U1's visual normalization outside the pre-ACL gesture window), not tied to festival dates.

> **Kevin's calls after the plan (2026-09-25, ~11:45 PM PT) — fold into the revision:**
> 1. **Phone: a tap opens the card as a shelf, with its notes inside.** "If we're going full width on first tap, the only difference from the notes view is the notes underneath — so go straight into the shelf with the notes." On touch, a tap on a card opens one bottom shelf: the card's details, the − · + row, and the notes thread underneath; the separate note button disappears on phones. Desktop keeps hover → the smaller zoom → the note button to go deeper. This reshapes U3 (the tap change) and U5 (questions: notes) into one phone surface.
>    *Confirmed and sharpened 2026-09-26 ~2:50 AM PT:* "a tap on mobile (the one that replaced our long hold) show[s] the notes shelf (with full controls) rather than a zoom with a notes button. On desktop we should keep hover with the notes button. Clicking that opens the notes shelf — with no notes button." So ONE notes shelf: the card's facts, the − · + controls and the thread; reached by a tap on a phone and by the zoom's notes button on a desktop; it never carries a notes button of its own. It applies in the List view too (design round 2026-09-26).
> 2. **People get a menu of their own, the twin of Show (design round approved, 2026-09-26 ~12 AM PT: "Those designs are great").** Left of the dock: your avatar pill (with ✕ while a highlight is on) opens a **Highlight** menu shaped like the right side's **Show** menu — the crew to highlight (multi-select), an Our plan row, "Pick as someone else" (opens the claim shelf), and "+ Add someone", which opens the Add someone shelf: the crew link first (Copy / Share), then a name, then the other fests. The top people row goes away on phones; desktop keeps it plus the avatar dropdown. Frames and brief: `claude-plans/2026-09-25-portola-live/design/people-shelf/`. Three defaults stand unless Kevin says otherwise: a guest's + opens the same menu with "Join the crew"; jump-to-top gets no door; desktop keeps the people row. Slots in after U4 (the shelf primitive).
> 3. **Zoom text:** never break inside a statement ("Tix @" / newline); wrap only between items; a narrower centred content column — shipping in v92.


**Written:** the night of Fri 2026-09-25 PT, for the build starting Mon 2026-09-28.
**Status:** plan only. Nothing built, nothing edited outside this folder.
**Inputs:** the three maps beside this file (`map-input.md`, `map-shelves-tokens.md`,
`map-plan-now-dock.md`, all written against plan-base `abe7205`); the design rounds in
`../2026-09-25-portola-live/design/` (`ours-r2/BRIEF.md` round three, `ours-r2/ours-model.mjs`,
`guest-shelf/BRIEF.md`, `guest-shelf/buttons/BRIEF.md`); `live/v92` and `live/v93` as they stood at 22:30 PT;
the Portola `RUNBOOK.md` (ship recipe, undo, red lines).

## In one screen

1. **Yes, it is all shared components.** One codebase serves every festival file, so every phase below reaches
   Portola, ACL and the lineup-only fests in the same deploy. What differs between fests is the shape of the data:
   one weekend or two, sections by weekday or a dated Late nights tab, a clock or no clock. So every walk in this
   plan covers one festival of each shape (§3, "The fest matrix").
2. **The code moved while the maps were written.** v92 now ships the zoom's − · note · + row for everyone, and a
   builder started D1 (NOW in the day row) on v93 at 22:25. This plan starts after both (§1).
3. **The target is six single decisions, each made in one place** (§2):
   a. one hand (`hand.js`);
   b. one write path for a pick (`setLevel`);
   c. one shelf with two roles, question and companion (`shelf.js`);
   d. one button family as tokens;
   e. one floor line for the bottom of the screen (`--foot-h`);
   f. one week and one live window (`week.js`, `liveWindowOf`), under Our plan (`plan.js`).
   One sentence holds them together: **width decides layout, the hand decides behaviour, and nothing decides both.**
4. **Ten phases, U0 to U9**, each one PR that can ship and roll back alone (§3):
   U0 nets (S) → U1 buttons (M) → U2 one hand, as a pure refactor (M) → U3 a tap opens the card (M, the most
   care) → U4 companions and the floor line (M) → U5 questions (M) → U6 the week and the plan model, pure (M,
   can run in parallel) → U7 Our plan on phones (L) → U8 Our plan on computers (M) → U9 sweep (S).
5. **Timing** (§4): nothing from this train during Portola. U0 to U3 go in the gap before ACL Weekend 1, so the
   gesture changes once, before ACL. Our plan goes in the gap between the ACL weekends, for Weekend 2 (Q1).
6. **Five questions for Kevin, each with a default** (§5).

---

## 1. The base: what already landed, and what this plan does not redo

The maps describe plan-base `abe7205`. Since then (verified with `git log abe7205..live/v92|live/v93`, 22:23 PT):

1. **`live/v92` @ `963e599` includes `6737a87`**, "zoom: the door row for everyone". It changes 12 files and moves
   `card-facts.js` by about 213 lines. It covers:
   a. a bare − and + on the zoom's edges, with the notes chip between them, for members and guests, in finger
      zooms and in hover zooms (`stepRow`, `stepFor`, `doorsOf`);
   b. `stepPick` in app.js: 1→2→3→must, no wraparound, − down to 0;
   c. a guest's doors open the join shelf, and only + carries the pick through;
   d. the Tab walk through the row's doors;
   e. a step holds the zoom by its floor, a finger's zoom takes the screen width, and the who-row wraps
      (`contain: inline-size`). **map-input's Q2 (the row moving under the finger) is solved;**
   f. the welcome card and the join shelf put the main action on the LEFT, and the shelf says "Add your name".
      **map-shelves §5a's two design conflicts are settled.** Kevin on the button study: "just − + no button
      shape". The study's segmented pill and its token CSS were dropped.
   g. **Not done:** a tap on a RESTING card still cycles as in v91, the long-press is still in, and gallery.html
      still types its own copy of the routing (`live/v92:gallery.html` 578, 587, 609, 642, 981).
   The v92 worktree also has uncommitted edits (v3.css, `tests/browser/zoom-door-row.test.mjs`, the walk script).
2. **`live/v93` @ `e1dc2ef`** holds a build brief (`v93-BUILD.md`) and an Opus builder working on D1 (NOW as a tab
   beside the live day, retiring `fitNowTab`, the dot and the squeeze), "+ Add someone", and a solid ring on +3.
   It is based on `abe7205`. At 22:23 it had no code edits yet.
3. **So this plan starts on the head that ships v92 + v93.** Before building each phase, re-read every
   `file:line` below on that head. Citations marked `cf92` / `app92` are from `live/v92`. Unmarked citations are
   from plan-base, as the maps give them. v93's D1 will move app.js and wall.js again.

## 2. The target architecture, in plain words

### 2.1 One hand: where the kind of input is decided, and what each surface asks

**Today.** The hand is tracked in one place, `card-facts.js` (`lastInput`, `lastPointerType`, `touchAt`,
cf92:622-690). It is asked in five places, three different ways:
1. app.js imports `tapOpensZoom` to route a guest's tap (app92:22, 416).
2. wall.js decides the long-press from `e.pointerType` (wall.js:144-180).
3. app.js's document `pointerdown` decides the close-tap (app92:161).
4. gallery.html and `tests/helpers/zoom-rig.mjs` each type their own copy of the routing. The gallery's copy has
   drifted (map-input §2), so the browser contracts test a copy, not what ships.

**Target:**
1. **`js/v3/hand.js`** (new, no imports, about 80 lines). The document capture listeners move here verbatim from
   card-facts.js. It exports:
   a. `hand()` returns `'finger'` (the last press was touch or pen), `'mouse'`, or `'keyboard'` (the last input
      was a key that is not a lone modifier). The default is `'mouse'`, so a bare `click()` keeps today's meaning.
   b. `isGhost(e)`: the WebKit ghost rule (`touchAt`), unchanged.
   c. `mouseAt()` and `onMouseMove(fn)`: the still-hand reads.
   **The rule:** an event that carries its own pointer (`pointerenter`/`move`/`leave`/`down`) answers for
   itself, plus `isGhost`. A `click` or a `focus` asks `hand()`, because WebKit's click after a finger says
   "mouse", and a script `focus()` inherits `:focus-visible` (the CLAUDE.md zoom-modality law).
2. **card-facts.js owns what a press on a card means:**
   a. `wireCardInput(el, artist, ctx, occ)` is the only wiring a card gets: click → `pressCard`, Enter/Space on
      the card's own focus → `ctx.onPick`, hover intent, and the keyboard focus zoom. It replaces `ctx.wireZoom`,
      `ctx.onPeek` and wall.js:83-89 and 144-192. A render with `ctx.interactive === false` (the export render,
      the gallery's inert grid) gets none of it.
   b. `pressCard`: a finger opens this card's zoom (or does nothing if this card is the one zoomed). A mouse or
      a key calls `ctx.onPick`.
   c. The zoom's body: a finger does nothing. A mouse or a key calls `ctx.onPick`, keeping the door-settle
      capture (cf92:1351-1365) for those two only. **The mouse zoom's body must keep picking:** hover opens the
      zoom 200ms after the mouse arrives, so nearly every desktop click lands on the zoom, and "click on the wall
      picks" depends on it.
   d. The door row calls `ctx.onStep`, as in v92.
   e. `installZoomDocumentRules()` moves app.js's document rules here (outside-press close, the finger close-tap,
      Escape). It is idempotent, and app.js and gallery.html both call it.
   f. The zoom's `source` values become the hand's own words: `'finger' | 'mouse' | 'keyboard'`. `'touch'` (the
      hold) and `'tap'` (v92) go.
3. **Diagnostics gets one line:** `hand: finger · zoom: finger`. It is the input twin of the strip's
   `data-follow` line, so the next "my tap picked" report carries its own evidence.
4. **What stays keyed to the device:** the 44px floor on `button` stays a `(pointer: coarse)` media query (it
   is about the device, and it is the law). Layouts at 720px and up stay width queries. **Copy never branches by
   device:** notes.js:1072-1078's `(hover: hover)` read goes.

### 2.2 One write path for a pick

**Today, four sites write a pick** (`live/v92` app.js): `handleTap` (app92:430), `stepPick` (:453), bulk paste's
`recordPick` (:2136-2138) and `bringPicksHere` (:2600). `applyWaitingPick` (:574-581) reaches the first one by
calling `handleTap` with no element. The migration gate is typed in at least three of them.

**Target:**
1. `setLevel(artist, level)` in app.js is the one path. It holds the migration gate, then `recordSelection` →
   `applyLocalPick` → `refreshCtx` → `refreshArtistCards` → `scheduleSync`.
2. `ctx.onPick(artist)`: a member moves to `nextTapLevel`; a guest gets `askToJoin(artist, {intent:'pick'})`.
3. `ctx.onStep(artist, dir)`: a member moves to `stepLevel(current, dir)`; a guest gets `askToJoin` with that
   door's intent.
4. `stepLevel` sits beside `nextTapLevel` in model.js.
5. `applyWaitingPick` calls `setLevel(artist, 1)` directly. After U3, a call through the routing with a finger as
   the last hand would open a zoom instead of making the pick the guest was promised.
6. The bulk and bring paths call `setLevel`. If they batch their sync, add a `{ batch: true }` option that skips
   the per-pick `scheduleSync`, rather than keeping a second copy. Check this at build time.
7. No sync or merge change: `setLevel` calls the same state and sync functions in the same order.

### 2.3 One shelf with two roles

| Role | Phone (<720) | Computer (≥720) | Surfaces |
|---|---|---|---|
| **Question** (modal: wall dimmed, focus trapped, one at a time) | a footer shelf rising from the bottom edge; grabber; drag down to close | the centred dialog `.sheet` already becomes (v3.css:480-489) | notes (4 scopes), all notes, share moment, add someone, join shelf |
| **Companion** (not modal: the wall stays live) | stacked on the dock's top edge, inside `#screen-app` | the bottom-right **corner stack**: one right edge, 10px apart, newest on top (ours-r2 BRIEF §3); Our plan grows into a 400px right panel | welcome card, bring-your-picks offer, Our plan |

**`js/v3/shelf.js`** holds what is copied today:
1. `node()`: three copies become one (welcome.js:93-98, crew-entry.js:210-215, join-shelf.js:35-40).
2. `openQuestion({ label, chrome, title, body, ctx, key, onClose, rideKeyboard })` returns
   `{ el, close({instant}), setBusy, say }`. It:
   a. **keeps the `#sheet-backdrop` / `#artist-sheet` id pair.** Four readers depend on it: `closeSheet`,
      `rememberOpener`, the join shelf and index.html's `quiet()` (index.html:325-329). Keeping it leaves the
      reload glue untouched (RUNBOOK red line 6);
   b. animates a real close, keeps a re-render instant (notes.js:833-834 rebuilds on every note), and drops the
      ids at the START of the exit (join-shelf.js:189-190 already does this);
   c. has **one Back owner**, the router's `sheet:` stack (router.js:19, 71-77). The join shelf registers as
      `sheet:join`, and its own `pushState` plus the second `popstate` listener (app.js:516-525, 3345-3347) go;
   d. has one grabber drag (the join shelf's hardened copy, with its busy guard) and one keyboard ride
      (`visualViewport`, from join-shelf.js:158-173);
   e. requires `ctx`, so Low Power can never be forgotten (map-shelves §3c).
3. `mountCompanion(key, { el, ctx, arrive, onDismiss })` puts companions in one `#companion-stack` inside
   `#screen-app`, so Settings still hides them with the wall (welcome.js:193-196). One toast watcher steps the
   whole stack. The "never both at once" promise (welcome.js:116-118) becomes the stack's policy instead of a hope.

### 2.4 One button family, as tokens

This is unification, not a restyle: the colours stay `.btn-tonal` / `.btn-ghost` as they are today (v92 dropped
the button study's restyle).
1. **`.btn` base:** `font: inherit` (measured today: tonal and ghost buttons draw in Arial in Chromium and
   system-ui in WebKit, not Inter; map-shelves §2a), weight 700, `--r-pill`, a line-height, `nowrap`.
2. **Three sizes from tokens:** `--btn-fs-sm/md/lg` and `--btn-pad-sm/md/lg`, set at the medians of today's 31
   sizings (11.5px / 7px 13px, 12.5px / 9px 16px, 13.5px / 12px 20px).
3. `.btn-row`: the two-halves grid. Today it is written two ways (v3.css:218 vs 1354); it becomes one rule for
   the welcome card and the join shelf.
4. `.btn-text` replaces the four text-button looks (`.undo-btn`, `.welcome-more`, `.note-action`,
   `.n-fieldbar .note-action`).
5. `.field`: 44px, `--r-card` (8px) corners, 16px type on phones. The 9px radius in index.html is not a token
   and goes.
6. **Motion tokens** `--t-grow/out/cascade/fade` and `--ease-arrive/leave/surface`, equal to motion.js, with a
   test that asserts they match. **z-index tokens** `--z-*` for the stacking table in map-shelves §1j.
7. `.btn-*` and `.toggle` move out of the tokens file and into v3.css (404.html uses only `.hero*` and
   `.pulse-text`).
8. **A guard test:** no call site may give a `.btn-*` an inline font-size or padding, so the 31 sizings cannot
   grow back. It works like the accent guard.

### 2.5 One floor line, and the stacking order

1. **`--foot-h`** is the measured height of everything on a phone's bottom edge: the dock, plus any companion
   sitting on it, including Our plan's peek. It is written the way `--rail-h` is (`measureStickyChrome`,
   app92:1181), on repaint, resize and companion change.
2. Everything that clears the dock reads it, and every hand-typed number goes:
   a. `.shell`'s 84px bottom padding (index.html:81);
   b. `seenBand` (app92:830);
   c. the zoom's floor `dockTop` (cf92:764), which becomes `footTop()`;
   d. the 64px under the offer and the toast (v3.css:186, 839);
   e. the spot pill's 70px (v3.css:168);
   f. the two browser contracts that measure `#dock` (zoom-chrome-contract:89-90, 172-180; stack-row:277-290),
      through one shared helper.
3. On a computer, `--panel-w` (0 or 400px) and `rightChromeLeft()` are read by the zoom's `place()` (cf92:810,
   which today clamps only to `innerWidth - 8`) and by the NOW landing's sideways seen band.
4. **The stacking bug:** the Show menu opens UNDER the welcome card today. This was confirmed in Chromium and
   WebKit (map-shelves §5c.1): the dock is a stacking context at z30, so its menu paints at 30, under z38. The
   fix is to move the dock's popover into one top-level layer at `--z-popover`, above the companions. Our plan's
   peek would otherwise inherit the bug.

### 2.6 Our plan: the data, then the UI

**The data (pure, no DOM, unit-testable in Node):**
1. **`js/v3/week.js`.** `wallPlanFor`, `roomsOf`/`roomsIn`, `weekendsOf`, `weekendRoom`, `groupByDay`,
   `knownDaysOf`, `splitDays` and the pure half of `dayNavOf` are lifted out of wall.js (wall.js:1313-1473), and
   wall.js re-exports them, so every import keeps working. The day tabs, the Show menu and the plan then share
   one reader of "which days exist, on which date, in which rooms".
2. **`liveWindowOf` in events.js**, beside `parseEventTime`: one rule for when a set with no printed end is
   over. The grid (wall.js:1183, and `data-now-to` 1257), the stacks (events.js:249-258) and the plan all use it.
   Today there are three rules, so the peek could say "NOW till 10:15" while the wall's glow ended at 10:00 (Q3).
3. **`js/v3/plan.js`**, ported from `design/ours-r2/ours-model.mjs`: `barFor`, `usOf`,
   `planOf(week, fest, picks, members, {folded})`, `planAt`, `peekOf`, `headlinersOf`, `forkFor`. The port
   fixes the model's four ACL bugs (map-plan §5b) by reading the week:
   a. nights come from the week's days (a day key, or the ISO date for a dated extra), ordered by ISO date,
      never by weekday. This gives ACL six dated nights plus its Late nights;
   b. grid sets are filtered by `a.weekend`;
   c. room keys are the Show menu's own keys (`weekend:W1/W2` on ACL, `:fest` on Portola, section labels);
   d. members are `state.activePeople()`, so a departed member's picks never count.
   `shareTextOf` is not ported ("Tell a friend" is dropped).
4. **Cache:** build the model in `repaintWall` (app92:1391) when picks, members or the fold change. The minute
   ticker (`tickClock`, app92:724) only calls `planAt` / `peekOf`.

**The UI, `js/v3/plan-shelf.js` (a companion):**
1. **The phone peek** sits on the dock's top edge under a grabber. It is one row: the node, the artist (17px/800
   for a "most" stop, 14.5px/700 for "some") with the place under it, the NOW/NEXT tag with its time under it
   just left of the count, then "n of us". There is one second-line style (Inter 12px/600, secondary).
2. **Dragging it up is direct manipulation:** transforms driven by pointer events, never a CSS transition (the
   Reduce Motion and Low Power kill rules would freeze a transition). Past a third of the way, it settles open
   (`GROW_MS`, `EASE_ARRIVE`); short of that, it drops back (`OUT_MS`, `EASE_LEAVE`). A tap opens it too. With
   Reduce Motion or Low Power it jumps open and shut.
3. **Open, it is the day:** `SAT OUR PLAN` in the wall's head grammar, the stops in the same row, "Earlier
   today: n stops", and the live card blooming from its row (`sheetCard`). A row tap grows its card in place,
   and the rows below make room (FLIP).
4. **On a computer:** a corner card, 380px wide and 20px in from the edges. The whole card is one `<button>`
   with "Open ⌃" drawn as a span, which avoids a button inside a button and gets the floor and Enter for free.
   Open grows it into a 400px right panel from under the rail to the bottom, with no backdrop and a Close ⌄.
   Escape closes it.
5. **Colour:** brand only, never `--fest` (the accent's four places).
6. **When it does not appear:** a lineup-only fest (no clock) gets no plan and no peek. Fewer than 3 people with
   picks gets none. A guest sees the crew's plan (the crew link is the consent boundary).

### 2.7 The dock at the end, and the one-NOW rule

1. **The phone dock** is you · days (with v93's NOW tab beside the live day) · fest name. The desktop rail is the
   same row.
2. **The one-NOW rule, as code** (in `paintNowTabs`, app92:741): the tab shows only while `nowLanding()` is
   non-null AND the peek is not showing a NOW row.
   a. Once Our plan carries NOW, the tab leaves.
   b. It stays as the fallback door when there is no plan today (a solo, a new crew, fewer than 3 pickers), and
      per Q4 when a set is live that is not a plan stop.
3. Every NOW function in wall.js (`nowLanding`, `nowStops`, `nowStep`, `landingTarget`, `nowSaid`) stays. Only
   the doors change.

### 2.8 What gets deleted (and in which phase)

| Goes | Where | Phase |
|---|---|---|
| `tapOpensZoom` and its import | cf92:628, app92:22 | U2 |
| gallery.html's typed routing: `handleTap`, outside-close, `onPeek`, local `onStep` | live/v92 gallery.html 578, 587, 609, 642, 981 | U2 |
| the zoom rig's typed tap cycle | tests/helpers/zoom-rig.mjs:55-78 | U2 |
| `stepPick` and `handleTap` as separate write paths; `ctx.onTap`, `ctx.wireZoom` | app92:111, 142-150, 408-458 | U2 |
| the long-press and its click swallow | wall.js:144-180 | U3 |
| the finger overlay's arming (wait for the lift) | cf92:1299-1330 | U3 |
| `ctx.onPeek`; the `'touch'` and `'tap'` sources | app92:150; cf92:923, 1303, 1376 | U3 |
| `tests/long-press.test.mjs` | tests/ | U3 |
| "hold" copy; the notes copy's device media query | settings.js:456, notes.js:1072-1078, gallery.html:76, README.md:59, CLAUDE.md zoom paragraph | U3 |
| the welcome card's and bring offer's twin code (node, toast watcher, arrival, exit, `ARRIVE_DELAY_MS` ×2) | welcome.js:86-218, crew-entry.js:203-337 | U4 |
| three toolbar-strip builders (they become one) | app.js:1421-1493 | U4 |
| the 64 / 70 / 84px "above the dock" numbers | v3.css:168, 186, 839; index.html:81 | U4 |
| five hand-built sheet skeletons, the duplicated link row, the join shelf's own grabber, Tab trap and Back | notes.js:835-841, 966-972; app.js:1792-1798, 1816-1851 vs 1932-1967, 1866-1872; join-shelf.js:53-55, 211-236 | U5 |
| 31 inline button sizings over 58 call sites, the 9px field radius, four text-button looks | map-shelves §2a, §6 M3 | U1 |
| the rail's and the dock's NOW as the everyday door | app.js `NOW_TABS` | U7 / U8 |
| `fitNowTab`, the ringed dot, the squeeze | app92:762 | v93, not this plan |

---

## 3. The release train

### What every phase does (the RUNBOOK's recipe, not repeated in each phase)

1. **Ship:** follow `../2026-09-25-portola-live/RUNBOOK.md` §Ship 1-9:
   a. its own worktree and `live/vNN` branch;
   b. record the rollback target;
   c. stamp on a clean tree (`node scripts/sw-stamp.mjs`, one stamper at a time: the stamp races parallel
      builders);
   d. the local gate at three clocks, plus `validate-festivals` and `test:browser`;
   e. a PR, with CI's `checks` AND `browser` jobs read by name;
   f. a Sol 6 review on the exact head;
   g. a real-input walk by a Sonnet teammate (never `element.click()`);
   h. merge it yourself, run `ops/prod-smoke.mjs`, watch errors for 15 minutes, and send Kevin one line.
2. **Undo:** RUNBOOK §Undo. `vercel rollback <recorded target>`, then a revert through a PR. Phones follow on
   their next open; a busy phone shows the refresh strip.
3. **Safety every phase keeps:**
   a. no new key in a crew or person doc;
   b. no sync, merge, validator or database change;
   c. no change to service-worker.js's strategies or index.html's reload glue. Adding a module to the
      `APP_CORE` list is the routine entry (v92 did it for join-shelf.js), not a change to how it is handled;
   d. device storage only through try-wrapped reads and writes.
4. **Docs move with the code in the same PR.** `tests/docs-truth.test.mjs` holds the present-tense docs to the
   code.
5. **The fest matrix, for every walk:**
   a. Portola: one weekend, a clock day, plus the Afters and Folsom stacks;
   b. ACL: two weekends, the dated Late nights tab, the long `ACL MUSIC FESTIVAL '26` label;
   c. one lineup-only fest (Seismic 9 or Electric Forest), which has no clock;
   d. at 320, 390 and 1280 wide, by finger (Chromium touch and WebKit touch), mouse and keyboard.

### U0 — Nets first (nobody sees anything) · S

**What ships:**
1. The accent guard reads every file in `js/v3/` plus index.html, instead of the fixed list at
   `tests/finish-pass.test.mjs:115-119`, which skips welcome.js, join-shelf.js, crew-entry.js and card-facts.js.
   No later phase can then leak `--fest` into a shelf.
2. **WebKit becomes real in CI.** `.github/workflows/ci.yml:49` installs `chromium webkit`. Under
   `BROWSER_TEST_REQUIRED=1`, a missing WebKit fails the run instead of skipping. Today all seven browser files
   that use WebKit (touch-ghost, zoom-notes-chip, zoom-chrome, stack-row, shell, now-jump, zoom-still-hand)
   skip themselves in CI and run only on this Mac.
3. Motion and z-index tokens at today's exact values. Only literal copies of motion.js values are swapped
   (v3.css:188's .24s + EASE_ARRIVE; the EASE_SURFACE copies at 930-931 and 971).
   `tests/motion-shared.test.mjs` asserts that each token equals motion.js.
4. `.btn-*` and `.toggle` move from v3-tokens.css:195-211 into v3.css.

**Files:** tests/finish-pass.test.mjs, .github/workflows/ci.yml, the WebKit skip lines in 7 tests/browser files,
assets/v3-tokens.css, assets/v3.css, tests/motion-shared.test.mjs.

**Tests:** the widened guard, motion-shared, and WebKit required. Before and after, a computed-style diff of ten
surfaces in gallery.html (generalise `probe-shelves-tokens.mjs` in this folder) must show no value change.

**Walk:** none beyond prod-smoke. No computed value changes.

**Kevin sees:** nothing.

**Risk:** Linux WebKit is not iOS Safari, so a case green on Mac WebKit can flake on Linux. Contain it by
running the branch's CI twice. Any case that diverges gets a named, dated reason in the test, never a silent
skip. CI gains a minute or two.

**Rollback:** revert. **During a festival:** safe any morning.

### U1 — One button family (a tiny visible change) · M

**What ships:** the `.btn` base, the size tokens, `.btn-row`, `.btn-text` and `.field` (§2.4). The 58 call sites
lose their inline sizing (app.js ×12, settings.js ×26, index.html ×9, notes.js ×2, tools.js ×2, wall.js ×1,
welcome.js ×2, crew-entry.js ×2, join-shelf.js ×2; map-shelves §6 M3). The join shelf's field goes from 46 to
44px with 8px corners (buttons BRIEF). No colour or shape changes.

**Files:** assets/v3-tokens.css, assets/v3.css, index.html, js/v3/{app, settings, notes, tools, wall, welcome,
crew-entry, join-shelf}.js, gallery.html (`.zoom-controls`).

**Tests:**
1. New `tests/button-family.test.mjs`: the inline-sizing guard.
2. New browser cases in shell-contract:
   a. every `.btn` computes `Inter` in both Chromium and WebKit (map-shelves' measured finding, made a test);
   b. no button label overflows (`scrollWidth <= clientWidth`) on the entry screens, the welcome card, the join
      shelf, and the share and add sheets at 320. This runs with the widened-glyph variant too, because Linux
      draws Inter wider (project memory, "Browser harness traps").
3. `first-open-guest`, `first-open-welcome` and `notes-dates` keep passing, because the class names are kept.

**Walk:** the welcome halves and the join shelf at 320 and 390 (finger, WebKit), Settings at 390 and 1280
(mouse), the share row with a long crew link, and the entry screens. Kevin gets a before/after contact sheet
from the gallery before merge.

**Kevin sees:** buttons drawn in the app's typeface (today they are SF on his iPhone and Arial in Chrome), and
Settings buttons at one height on a computer. Nothing moves.

**Risks:**
1. Inter's widths wrap a label at 320. Contained by the overflow assertion and the walk.
2. Snapping to three sizes shifts some buttons by up to 1px of type or 2px of padding. It is shown on the sheet
   first, and it is not a redesign.

**Rollback:** revert. **During a festival:** safe on a morning, but recommended in a gap (it is worth little
mid-festival).

### U2 — One hand, one write path (a refactor: nothing behaves differently) · M

**What ships:**
1. `hand.js`; `wireCardInput`, `pressCard` and `installZoomDocumentRules` in card-facts.js; `setLevel` and
   `stepLevel` (§2.1, §2.2).
2. gallery.html and `tests/helpers/zoom-rig.mjs` import the shipping wiring and supply only a local `setLevel`.
3. The Diagnostics hand line.
4. **`pressCard`'s finger branch keeps today's split exactly:** a guest's tap opens the card, and a member's tap
   picks (the v91 cycle). The flip is one line in U3. That split is what makes U2 provable: the whole suite must
   pass unchanged.
5. **One deliberate behaviour change (a fix):** while the close-tap's click-eat moves (app92:161-190), it is
   hardened. It disarms on `pointercancel` and eats only a click whose target is a card. Today, with a zoom open,
   it eats the first click anywhere for 700ms, so a flick that starts on a card followed by a quick tap on a day
   tab loses the tab tap. That hits guests today, and would hit everyone after U3.

**Files:** js/v3/hand.js (new); js/v3/card-facts.js (the tracker out, cf92:622-690; wiring in); js/v3/wall.js
(`renderCard` calls `wireCardInput`; 83-89 and 182-192 go; the long-press stays until U3); js/v3/app.js
(`onTap`/`wireZoom` → `onPick`/`onStep`; `setLevel`; `applyWaitingPick`; the document rules out); js/v3/model.js;
js/v3/settings.js (Diagnostics); gallery.html; tests/helpers/zoom-rig.mjs; service-worker.js (the `APP_CORE`
entry for hand.js).

**Tests:**
1. New `tests/hand.test.mjs`: finger after touch or pen, mouse after mouse, keyboard after a real key, a lone
   modifier changes nothing, and the ghost filter is unchanged.
2. `tests/v3-model.test.mjs` gains the `stepLevel` table.
3. New `tests/set-level.test.mjs`: every write goes through `setLevel`; the migration gate shows its toast; a
   guest goes to the shelf; the waiting pick lands at level 1 even when the last hand was a finger.
4. `tests/zoom-app-glue.test.mjs` points at `installZoomDocumentRules` and gains "a flick, then a day-tab tap,
   is not eaten".
5. **Every other test stays green unchanged. That is the proof that U2 is a refactor.**

**Expect some browser contracts to go red at first.** The gallery now runs the real outside-close (with `meant`
for fingers and the guest's click-eat) where it used to run a drifted copy. Each such change is a finding about
the old net. Record it in the PR, and fix the test's premise, not the code.

**Walk:** a regression pass only. At 1280 a mouse hovers and clicks, and the pick cycles. The keyboard Tabs and
Enters. A member's finger tap still picks; a guest's opens the card. Chromium and WebKit.

**Kevin sees:** nothing but a Diagnostics line.

**Risk:** a refactor of the most fragile module. Contain it:
1. behaviour stays the same by construction;
2. the whole net must stay unchanged, and it now tests the routing that ships;
3. Sol 6 is asked specifically for any change in behaviour.

**Rollback:** revert. **During a festival:** never; in a gap only, because it touches every pick.

### U3 — A tap opens the card, for everyone (the behaviour change; the most care) · M

**What ships:**
1. `pressCard`: a finger opens this card's zoom, members included (the flip). A member's first finger tap takes
   the welcome card down too (app92:417 widened).
2. A finger zoom's body writes nothing, for anyone (cf92:1376 widened). The door-settle capture applies to mouse
   and keyboard zooms only. A finger's close-tap only closes, for members too.
3. The long-press goes (wall.js:144-180), along with `ctx.onPeek`, the finger arming (cf92:1303-1330) and the
   `'touch'` / `'tap'` sources (now `'finger'`). `-webkit-touch-callout: none` stays on `.card` (v3.css:30).
4. **The copy that teaches the old gesture moves in the same release** (Q2 has the words):
   a. the welcome card (welcome.js:57-63);
   b. How it works rows 3 and 5 (settings.js:446, 456), changed together with `tests/docs-truth.test.mjs:178-185`
      and MODEL-V4 §3a.4;
   c. the empty all-notes line (notes.js:1072-1078: one sentence for every hand, no media query);
   d. README.md:28 and :59;
   e. CLAUDE.md's zoom-modality paragraph (the long-press sentence goes; the ghost rule stays);
   f. the gallery hint.
5. **A one-time line** for members who learned "tap lights it": default inside the first finger zoom a returning
   member opens (Q2). A device-local seen flag, try-wrapped, and never a crew-doc key.
6. If the walk shows Android firing `contextmenu` and no click after a hold, add a `contextmenu` preventDefault
   on cards for touch. Not a new timer.

**Files:** js/v3/{card-facts, wall, app, welcome, settings, notes}.js, README.md, CLAUDE.md,
`claude-plans/2026-09-16-wall-v4/MODEL-V4.md`, gallery.html, assets/v3.css (any finger-only rule left),
tests/docs-truth.test.mjs.

**Unit tests** (map-input §3 has every case):
1. Delete `tests/long-press.test.mjs`.
2. New `tests/tap-zoom.test.mjs`:
   a. a finger tap opens the card for a member and for a guest; a pen does the same;
   b. a mouse click picks, and Enter picks;
   c. the body of a finger zoom writes nothing;
   d. with a zoom open, a finger tap on another card only closes it, for members and guests;
   e. a hold then a release equals a tap.
3. zoom-overlay :151 is replaced by "a finger zoom is live at once: the first + steps".
4. zoom-touch-ghost :158 changes.
5. zoom-hover-grace :242 renames its source.
6. The first-open tap tests widen to members.
7. pick-cycle gains a finger twin.

**Browser tests:**
1. touch-ghost-contract is rewritten for Chromium and WebKit:
   a. a tap opens the zoom; + gives 1; + again gives 2;
   b. nothing else grows, and the doors do not move;
   c. a card scrolled under the lift point does not grow.
2. zoom-chrome-contract's route becomes a tap (touchStart + touchEnd), plus a WebKit tap route.
3. zoom-chips-contract and zoom-chips-burst open by tap, and the burst alternates + and −.
4. stack-row opens by tap; a sideways swipe still opens nothing.
5. show-links :132 inverts: in a finger zoom, a door is a door from the first frame.
6. meter-contract is driven by mouse and Enter, plus a finger case: + in the zoom, close, and the resting meter
   reads the new level.
7. zoom-notes-chip gains a − / + twin for Safari's press grace.
8. **New contracts:**
   a. an iPad with a mouse: `hasTouch` plus a mouse; a finger opens; a mouse hover replaces it; a mouse click on
      the wall picks;
   b. a hold then a release: CDP touchStart, 700ms, touchEnd gives one zoom, no pick and no callout;
   c. a flick, then a day-tab tap.

**Merge gate:** the WebKit tap contract is green in CI (made possible by U0). It is the only proof that WebKit
sends a touch-type `pointerdown` before its mouse-shaped ghosts. If it ever sent a mouse-type one, the hand would
read "mouse" and the tap would pick.

**Walk** (a Sonnet teammate, real input):
1. WebKit and Chromium touch at 390 and 320: tap, then + four times to must (+ dims), then − four times to 0.
2. Close by a tap outside, by a scroll, and by a tap on another card.
3. A guest: + opens the shelf, they join, and the level-1 pick lands.
4. The iPad shape.
5. A 1280 mouse: hover, click on the wall, click on the zoom's body.
6. The keyboard's Tab walk.
7. The fest matrix.
8. Kevin on his own iPhone, against the unique deployment URL (not the alias; CLAUDE.md, "read the build line").
9. One Android phone, if a friend has one.

**Kevin sees:** a tap on a card opens it, and − and + inside pick. A computer is unchanged.

**Risks, and how each is contained:**
1. WebKit's hand at click time. The CI WebKit contract is the gate.
2. The click-eat swallowing a real tap. U2 hardened it, and the flick-then-tab contract holds it.
3. Android's hold. The walk, plus the `contextmenu` fallback.
4. Friends' muscle memory. Ship before a weekend, never in the middle of one, with the one-time line.
5. The new-build reload waits more often, because a zoom is up more often (`quiet()` is unchanged). This is the
   intended cost.
6. False alarms in the zoom journal (`zoom-close-after-click`, guest-shelf BRIEF §5.4g). Check the walk's
   journal stays quiet.

**Rollback:** revert U3 alone and you are back on U2's routing, which is v91's gesture. The only thing stored is
the one-time flag, which is harmless.

**During a festival:** never during a weekend. It lands at least a full day before the next weekend's first
doors, or it waits for the next gap.

### U4 — The shelf, part 1: companions and the floor line · M

**What ships:**
1. `shelf.js` core: `node()`, `mountCompanion`, the stack, and one toast watcher.
2. The welcome card and the bring-your-picks offer move onto it, with one arrival, one exit and one
   `ARRIVE_DELAY_MS`.
3. On a computer, the **corner stack**: bottom-right, 20px in, 10px apart, newest on top. Today both cards
   float 64px above a dock that is `display: none` there (v3.css:670).
4. `--foot-h` and `footTop()` replace every "above the dock" number (§2.5).
5. **The stacking fix:** the dock's Show menu moves into a top-level layer.
6. Toasts slide in and out, get a position at 1280 above the corner stack, and `.undo-toast` becomes `.toast`.
7. Three strip builders become one `.strip`. The ids `#new-build-strip` and `#migration-banner` are kept,
   because settings.js:975 reads the first.

**Files:** js/v3/shelf.js (new); js/v3/welcome.js; js/v3/crew-entry.js; js/v3/app.js (companion ordering near
app92:2493-2540, the strips, `seenBand`, `measureStickyChrome`, the Show menu); js/v3/card-facts.js
(`footTop`); js/v3/wall.js (toasts); assets/v3.css; index.html (`.shell` reads `--foot-h`; the reload script is
not touched); service-worker.js (the `APP_CORE` entry).

**Tests:**
1. New `tests/companion-stack.test.mjs`: mount, dismiss and order; one watcher; Settings hides the stack; Low
   Power is instant.
2. Update the selectors that pin `#bring-offer` (6 files), `.welcome-card` (4), `.bring-actions` (2) and
   `.undo-toast` (1).
3. A guard: no `64px`, `70px` or `84px` "above the dock" number is left in the CSS.
4. Browser, in shell-contract:
   a. "the Show menu paints above the welcome card" (`elementFromPoint` in the overlap, in Chromium and
      WebKit). This is the confirmed v92 bug;
   b. "at 1280 the welcome card is in the bottom-right corner".
5. zoom-chrome-contract and stack-row measure the floor through one helper.

**Walk:**
1. On a phone: the welcome card and the offer arrive, step up for a toast, and leave.
2. The Show menu opened with the welcome card up.
3. A zoom grown near the bottom.
4. The corner stack at 1280 and 1440.
5. Settings open, then back.
6. The fest matrix.

**Kevin sees:**
1. On a computer, the welcome card sits in the bottom-right corner.
2. Toasts slide in and out.
3. The Show menu opens above the welcome card instead of under it.

**Risks:**
1. Every place that clears the dock must read `--foot-h`; if one is missed, a row hides (map-plan §7d lists
   them all). Contained by the guard and the shared helper.
2. A leaving toast lingers for `OUT_MS`. A new toast must sweep it, the way the zoom's `exitingSlots` does.

**Rollback:** revert (device-only state). **During a festival:** in a gap.

### U5 — The shelf, part 2: questions · M

**What ships:**
1. `openQuestion`. Notes (4 scopes plus all notes), the share moment, add someone (its duplicated link row
   becomes one) and the join shelf move onto it.
2. One Back owner (the router's `sheet:` stack).
3. One grabber drag and one keyboard ride.
4. A real close animates: on a phone the shelf drops to the edge. **Every dialog arrives one way** at 720 and
   up: the scale-fade the other dialogs use. The join shelf's rise composed with the centring translate was
   never verified in a browser (map-shelves §3a).
5. Re-renders stay instant. The ids drop at the start of the exit and are otherwise kept, so `quiet()` is not
   touched.

**Files:** js/v3/shelf.js; js/v3/notes.js (731-958 and 963-~1100); js/v3/app.js (share app92:1814, add :1888,
the join shelf's history 516-525, `popstate` 3342-3350); js/v3/join-shelf.js (shrinks to the join body);
js/v3/router.js; js/v3/card-facts.js (`sheetCard`'s chrome); assets/v3.css.

**Tests:**
1. New `tests/shelf.test.mjs`:
   a. open;
   b. a re-render with no animation keeps the opener;
   c. close animates;
   d. reopening mid-exit;
   e. the ids are gone at the exit's start;
   f. Back closes exactly one question;
   g. Escape;
   h. the Tab trap;
   i. Low Power is instant.
2. The 9 files that pin `#artist-sheet`, the 2 that pin `#sheet-backdrop` (including new-build-reload), and the
   3 that pin `.join-shelf`.
3. finish-pass's focus-return cases.

**Walk:**
1. Open notes, add a note (no animation), close (animates), reopen mid-exit.
2. Share, and add someone with a long link.
3. The join shelf from a zoom's + and from the welcome card.
4. The system Back on each.
5. Desktop dialogs.
6. The iOS keyboard.
7. The fest matrix.

**Kevin sees:** every sheet rises from the bottom and leaves quick and plain, and dialogs on a computer arrive
one way.

**Risk:** Back and focus-return behaviour. Contained by the tests above.

**Rollback:** revert. **During a festival:** in a gap. Nothing depends on U5, so it may slip past ACL with no
cost.

### U6 — The week, one live window, the plan model (pure; can be built in parallel from U0) · M

**What ships:**
1. `week.js` lifted out of wall.js and re-exported.
2. `liveWindowOf`, adopted by the grid and the stacks, **in its own commit**: the one visible part, Q3.
3. `plan.js`, not yet wired to any UI.

**Files:** js/v3/week.js (new); js/v3/wall.js (the move out, around 1313-1473); js/v3/events.js; js/v3/plan.js
(new); service-worker.js (both `APP_CORE` entries); `tests/fixtures/plan-crew.mjs` (made-up names only: this
repo is public).

**Tests:**
1. Every existing wall, NOW and events test stays green. That proves the lift is pure.
2. New `tests/live-window.test.mjs`, plus a jsdom check that a grid cell's `data-now-to` equals the plan's stop
   end for the same set.
3. New `tests/plan-model.test.mjs`, on Portola with the made-up nine (design `ours-r2/crew.mjs`):
   a. the bar is 3 for nine people and 4 for thirteen;
   b. Saturday's spine: Tove Lo 6, Robyn 7, Dog Blood 8, Soulwax 5, Public Works 6 from 10:30 PM;
   c. hiding Folsom changes only Sunday afternoon, and Mochakk stays at 5;
   d. Thursday's Regency stop is 5 of us, "also Sat";
   e. a departed member is not counted;
   f. fewer than 3 pickers gives no plan.
4. The same file on ACL:
   a. six dated nights plus the Late nights dates;
   b. no two sets overlap on one stage;
   c. hiding Weekend 1 removes only Weekend 1's stops;
   d. rule 5 as Q5 decides.
5. A lineup-only fest gives an empty plan.
6. Clocks are pinned (project memory: "tests that pass by daylight").

**Walk:** none for the pure parts. The live-window commit gets a NOW-line check on an ACL grid day whose closers
print only a start.

**Kevin sees:** nothing, except where Q3 changes when a set's glow ends.

**Risks:**
1. The lift touches imports across the app. The re-export keeps them working.
2. The live window moves the NOW line. It gets its own commit and its own review.

**Rollback:** revert. **During a festival:** the pure parts any morning; the live-window commit on a morning
only.

### U7 — Our plan on phones · L

**What ships:**
1. `plan-shelf.js` (§2.6): the peek, the drag into the day, the rows, "Earlier today", the live card's bloom and
   a row tap that grows its card.
2. The model cached in `repaintWall`, with `planAt` / `peekOf` on each tick.
3. The peek joins `--foot-h`, so the zoom, `seenBand`, the shell and the toasts clear it with no further code
   (that is U4's payoff).
4. Focusing the search hides it.
5. The one-NOW rule in `paintNowTabs`.
6. Q4's defaults for the undrawn states.
7. A dated rewrite of MODEL-V4 §3d.
8. Gallery states: the peek at NEXT, the peek at NOW, and the plan open, at 390 and 320.

**The motion is storyboarded before any code,** watched in slow motion, and pushed as one build (project
memory: "motion is designed, not patched").

**Tests:**
1. New jsdom `tests/plan-peek.test.mjs`:
   a. the peek shows only when there is a plan;
   b. NOW vs NEXT at pinned clocks (Sat 11 AM and 9:40 PM);
   c. the one-NOW states table (map-plan §7a);
   d. hidden rooms stay hidden;
   e. a guest sees the plan;
   f. a lineup-only fest shows none;
   g. fewer than 3 pickers shows none, and the D1 tab is present.
2. New browser `tests/browser/plan-shelf.test.mjs`, in Chromium and WebKit touch:
   a. a drag past a third settles open;
   b. a short drag drops back;
   c. a tap opens it;
   d. with Reduce Motion it jumps;
   e. the zoom never grows under the peek;
   f. the wall's last row can be reached above the peek.
3. The now-jump browser suite (982 lines) moves its door to the peek or the fallback tab.

**Walk:**
1. A phone at 390 and 320, in WebKit and Chromium, at fake clocks.
2. Folsom hidden.
3. ACL Weekend 1, Weekend 2 and Late nights.
4. Seismic (no peek).
5. Low Power.
6. Kevin on his iPhone against the preview.

**Kevin sees:** Our plan above the dock; drag it up for the day.

**Risks, each contained by an earlier phase:**
1. The peek's geometry, by U4's `--foot-h`.
2. The model on ACL, by U6's tests.
3. Three end-time rules, by U6's `liveWindowOf`.
4. `renderDayNav` rebuilds the rows on every poll and keystroke, by v93's silent insert of the NOW tab.
5. The cost of the 5-minute sweep, by caching per repaint.
6. The kill rules freezing the drag, by using pointer-driven transforms.

**Rollback:** revert (device-only). **During a festival:** in a gap.

### U8 — Our plan on computers · M

**What ships:**
1. The corner card in the companion stack, and the 400px panel.
2. The rail's NOW leaves when the plan carries NOW.
3. `place()` clamps to `rightChromeLeft()`.
4. The NOW landing's seen band stops at the panel's left edge.
5. The spot pill moves (v3.css:167-173), and toasts sit above the corner stack.

**Tests:** new browser `tests/browser/plan-desktop.test.mjs` at 1280 and 1440, by mouse and keyboard:
1. Enter opens the card, and Escape closes the panel.
2. The whole card is one button.
3. The zoom never grows under the panel.
4. A NOW landing frames to the left of the panel.
5. Focus order.

**Walk:** 1280 and 1440 by mouse and keyboard, the welcome card stacked on the plan card, and the fest matrix.

**Kevin sees:** the corner card and its panel.

**Risk:** the grid under the panel. Contained by the landing and zoom assertions.

**Rollback:** revert. **During a festival:** safe on a morning (computers are little used at a fest), but
recommended in a gap.

### U9 — Sweep · S

1. **CLAUDE.md laws, in hg-save-it form, dated:**
   a. `hand.js` is the only place the hand is decided;
   b. width decides layout, and the hand decides behaviour;
   c. anything over the wall is a question or a companion (`shelf.js`);
   d. `--foot-h` is the floor;
   e. one live window.
2. README and NOW.md.
3. A final grep for no `'touch'` / `'tap'` source, `onTap`, `onPeek` or `tapOpensZoom`.
4. The gallery holds every new state.

The design folder's model and prototypes stay where they are, as the record.

### Dependencies at a glance

1. **U0 → U3:** WebKit must be real in CI before the tap change.
2. **U2 → U3:** the flip is one line on top of U2.
3. **U4 → U7:** the peek is a companion on the floor line.
4. **U6 → U7:** the peek needs the model.
5. **U7 → U8.**
6. U1 goes first because U4 and U5 edit the same welcome, shelf and sheet CSS.
7. U5 depends on nothing and nothing depends on it.
8. U6 can be built by a second builder in its own worktree from day one. It touches wall.js's week (around
   1313-1473), and U2 and U3 touch wall.js's card wiring (83-192), so the rebase is small.

## 4. Timing: which phases are safe during a live festival

**The calendar:**
1. Portola: Sat–Sun Sep 26–27.
2. ACL Late nights: every night from Sep 29 to Oct 10, so evenings in the gaps have users too.
3. ACL Weekend 1: Fri–Sun Oct 2–4.
4. ACL Weekend 2: Fri–Sun Oct 9–11.
5. On festival days, the safe window is the morning, before doors (RUNBOOK).

**Three rules of thumb:**
1. During a festival weekend, ship only what cannot change how a pick, a note or a sheet behaves: U0, U6's pure
   parts and U8. Mornings only.
2. Anything that changes how a card is pressed (U2, U3), how a sheet opens (U4, U5), or adds the peek (U7) lands
   in a gap, at least one full day before the next weekend's first doors. That way Kevin can try it on his phone,
   and a rollback happens in daylight.
3. The gesture changes once, before ACL Weekend 1, never between the weekends, so friends learn it one time.

| When | Recommended |
|---|---|
| Sat–Sun Sep 26–27 (Portola) | v92 and v93 (the live-ops session's releases). Nothing from this train. |
| Mon Sep 28 | U0, then U1 |
| Tue Sep 29 | U2. U6 starts in parallel. |
| Wed Sep 30, morning | U3, if its walk and Kevin's phone check are clean by Tuesday night. If not, it waits for Mon Oct 5, and ACL Weekend 1 runs on v91's gesture. |
| Thu Oct 1 | Buffer: fixes to U3. U6's pure parts may merge. |
| Fri–Sun Oct 2–4 (ACL Weekend 1) | Fixes only; U6's live-window commit on a morning if Q3 wants it for Weekend 1 |
| Mon Oct 5 – Wed Oct 7 | U4, then U7 (merged by Wednesday morning for Weekend 2) |
| Thu Oct 8 | U8, or buffer |
| Fri–Sun Oct 9–11 (ACL Weekend 2) | Fixes only |
| After Oct 11 | U5, U9, and anything that slipped |

**On capacity, honestly:** the four gap days before Weekend 1 hold U0 to U3 with room for a fix. Putting Our plan
(U4 + U6 + U7, which is M + M + L) in front of Weekend 1 as well would mean the gesture change and the plan
landing in the same week, with U7 merging on Thu Oct 1 and no buffer. That is Q1.

## 5. Questions for Kevin (reply like "3: b")

1. **Before ACL Weekend 1 (Oct 2), which comes first: a tap opens the card (U2–U3), or Our plan (U4, U6, U7)?**
   Both before Weekend 1 means both big changes in one week, with no buffer.
   *Default: the tap change before Weekend 1, and Our plan between the weekends, for Weekend 2.*
2. **The words for the tap change.** These are your pinned How it works rows, so they need your words.
   a. Row 3 today: "Tap an artist to add your color. / Your bars fill each tap. 4 taps = must see."
   b. Row 5 today: "Hold for details."
   c. The welcome card today: "Tap any artist to add yours."
   d. A one-time line for friends who learned "tap lights it".
   *Default:*
   a. row 3: "Tap an artist to open it. / Each + fills a bar. 4 = must see.";
   b. row 5: "Tap for details." (its second line unchanged);
   c. the welcome card: "Tap any artist, then + to add yours.";
   d. "A tap opens the card now — pick with + inside.", shown once inside the first card a returning friend
      opens.
   You edit them on a review page before U3 ships.
3. **One rule for when a set with no printed end is over** (the grid's glow, the stacks, Our plan). Today the
   grid says the start plus 60 minutes, and the plan model says "until the next set on that stage, else 60
   minutes". *Default: the next set on the same stage, else 60 minutes, everywhere. Plus add the published end
   times for ACL's closers to the festival file (data only, which the validator and the freeze allow), since a
   closer has no next set.*
4. **NOW once Our plan is up. Three states are not drawn:**
   a. a set is live but it is not a plan stop;
   b. nobody is highlighted and you want the wall to glide to now;
   c. a friend is highlighted ("Ross's now").
   *Default:*
   a. the NOW tab stays beside the peek's NEXT;
   b. a tap on the live card inside the open plan glides the wall to it;
   c. U7 ships without a highlighted peek, and a highlight keeps today's Ross story on the NOW tab until that row
      is drawn.
5. **ACL's two weekends in Our plan.** An ACL set with no weekend tag plays both weekends, and picks are per
   artist, so "an artist who plays twice counts at both" would put "also Oct 9" on nearly every stop.
   *Default: the same set on the other weekend (same stage, same time) does not count as playing twice; only a
   different place does. Also accepted as-is: the plan cannot know who goes which weekend, so a crew split
   across weekends looks bigger on each.*

**Calls this plan makes without asking** (say so if any is wrong):
1. A mouse click on a card, and on a hover zoom's body, keeps cycling the pick (v92 already ships the − · note ·
   + row in hover zooms beside it).
2. The router's `sheet:` stack owns Back for every question.
3. Every dialog arrives by scale-fade.
4. The Show menu moves to a top-level layer.
5. Buttons snap to three sizes at today's medians, in today's colours.

## 6. For whoever builds this: the fragile places

1. **Re-read before you cut.** The citations are to plan-base or `live/v92`. v93 will move app.js and wall.js.
   `cf92` and `app92` above mean `git show live/v92:js/v3/card-facts.js` and `…/app.js`.
2. **The gallery is the net.** Until U2 lands, a green browser suite proves the gallery's copy of the routing,
   not the app's. Do not trust any browser result on input behaviour from before U2.
3. **WebKit in CI is new in U0.** When a WebKit case goes red on Linux only, suspect the engine difference first,
   and prove it at the lowest level (log the real `pointerType` sequence) before changing the app. Never mute it
   silently.
4. **The ids `#sheet-backdrop` / `#artist-sheet` are a contract with index.html's reload glue.** Keep them, or
   stop and ask, because that is RUNBOOK red line 6.
5. **Motion is designed, not patched** (project memory, 2026-08-30). For U4, U5 and U7, write the storyboard
   first and watch it in slow motion.
6. **Serialize the stamp.** If U6 runs in parallel, only one builder stamps at a time, on a clean tree above the
   newest main.
7. **This repo is public:** made-up crew names only in fixtures, and never a crew token (`#g=`) anywhere. Scan
   before every commit with `&&`.
