# The people menu + the Invite sheet — build log

**Branch** `live/people` (worktree `.claude/worktrees/people`), off `0d19e6e` (v97).
**Brief** `PEOPLE-BRIEF.md` beside this file; **design** `../2026-09-25-portola-live/design/people-shelf/BRIEF.md`
(frames on this Mac under `.claude/worktrees/portola-live/…/people-shelf/frames/`).
**Started** 2026-09-26 (Sat, Portola day 1), by an Opus builder. No stamp, no PR — the orchestrator releases it.

This file is the record if the build dies: read "Where it stands" first.

## Where it stands

1. Step 0 (this log, the storyboard, the plan) — done, before any code (`fbb59ff`).
2. Step 1 — the menu, the pill, the guest's route, the phone top, jump to top retired, Pick as
   someone else, the one Invite sheet (`cd4c54c`).
3. Step 2 — the motion walked in slow motion and fixed (the storyboard's C–E; see "What the slow
   motion caught"), the pill's disc cap, the crew-variant rig (`a804269`).
4. Step 3 — `tests/people-menu.test.mjs` (jsdom, 11) (`9904644`); `tests/browser/people-menu.test.mjs`
   (real input, Chromium + WebKit, 15) and the WebKit empty-tap fix both menus needed (`ef64dc1`).
5. `origin/main` (v97, `efeebd0`) merged in, clean (`0345d7b`). Stale docs swept (user-flows F2b/F9,
   comments) (`a1612a0`).
6. The review round (below): four fixes (`449a838`); Codex's re-review of `449a838`: no findings.
7. **Done, for the release to take** (head `f9dca00` or later). Final numbers on that head:
   a. `npm test` — 1,134 tests, 1,132 pass, 1 skipped, 1 fail in UTC, `TZ=Asia/Tokyo` and the night
      clock alike: the SW stamp test, red on purpose (no stamp here; the release stamps).
   b. `npm run test:browser` — 253/253 (17 of them `tests/browser/people-menu.test.mjs`, Chromium +
      WebKit, finger and mouse).
   c. Frames: `people-shots/` (git-ignored; `node claude-plans/2026-09-26-unified-build/people-rig.mjs
      frames` and `… slowmo 390|320` rebuild them). Contact sheets: `sheet-390.png`, `sheet-320.png`,
      `sheet-1280b.png`, `sheet-edges.png`, `sheet-flows.png`; slow motion: `slow-*-390.png`,
      `slow-*-320.png`.

## CI's Linux fonts (2026-09-26, after the handback)

CI's browser job went red on `f9dca00` / `c99a2ae`: two Chromium-320 cases asserted the Mac's disc
counts, and Linux draws Inter wider, so at 320 the pill fit ONE disc (the bare count "2") where the Mac
fit two — the app doing exactly what call 13 says. Reproduced here first with the dock's glyphs 0.7px
wider (now-jump's trick; red with the same `faces: ["2"]` CI printed). The 320 cases now assert the
rule, not a count, at the Mac's widths and at Linux's: the discs and +n add up to the people
highlighted, faces first in the crew's order; the day you are in is whole; NOW and its day are whole
wherever they could be beside the bare avatar; one to three discs; the pill as wide as `pillWidth`
says; more room never yields fewer discs; and the pill takes the room it has (one more disc would break
the promise). Both the refit and the cap still fail their tests when removed. The harness now stubs the
worker's `register()` as now-jump does, so the page's update check no longer throws there.

**Second CI round (run 36248232574, on `350d4d7`):** the widened variants went red on CI itself —
Linux's already-wide Inter plus the 0.7px widening. Two real design faults came out of it, not test
tolerance: (a) where not even one disc and its ✕ left NOW its room, the pill still took 47px and
pushed NOW (and on ACL, the day you are in) out; (b) the cap promised NOW only where it could fit
beside the bare avatar, so it was not monotonic — ACL showed two discs at 320 and one at 360.
Now (call 17): while NOW is live its room is always asked for, and where one disc and a ✕ do not fit,
the pill **folds to the avatar's own 26px** — one disc in the brand ring (the face, or the count),
no ✕; Everyone in the menu clears. A highlight then costs the row nothing the avatar did not. A width
sweep (320 → 430, Portola and ACL, Mac and wide glyphs, each step a real resize) holds the rule: the
promise at every width, and never fewer discs for more room. Frame: `people-shots/sheet-compact.png`.

**Third CI round (run 36249092116, on `4a6b57c`):** two test faults, reproduced locally with the
glyphs widened 1.4px (a Mac drawing like CI's Linux plus its 0.7px): the first test cleared with the
✕, which a folded pill does not carry (it now clears through Everyone when folded — a path worth
having under test anyway); and "whole" was read from fractional rects at 1px where the row's own rule
(restingLeft) allows a pixel in whole-pixel layout positions — ACL at 320 sat 1.2px past the edge
with the pill folded to exactly the avatar's width, so the row was as it is with no highlight at all.
The tolerance is now the row's own (two pixels in rects).

## Sol's release review of `b78b274` (2026-09-26)

1. **IMPORTANT — two adds could race** (carried over from the old add sheet): Add waited for its
   answer, but a chip or Enter started a second POST, and out-of-order answers could let the older one
   replace the crew view and the success sheet show the wrong person's link. Fixed: one add at a time —
   the button, Enter and every chip wait for the answer (the field goes read-only, not disabled, so it
   keeps focus and the keyboard). `tests/people-menu.test.mjs` holds the POST open and tries chip →
   Enter → chip, and typed name + Enter → chip → Add: one POST, the first one's link, the other never
   added — and fails without the guard (a second POST).
2. **A night-clock flake** (guest menu "the menu is open", passed alone and on a rerun): the popstate
   from the previous test's "Look around" (the shelf pops its own history entry) landed after the next
   test tapped the +, and closed the menu it had just opened — menus go with the page on any popstate,
   by law. Reproduced exactly by not waiting for that traversal. Harness-only: the traversal is one task
   after the tap on Look around, far inside a human's next tap, and the app adds no history special case
   mid-release (CLAUDE.md, "Browser history is shared state"). The tests now wait for the traversal
   to land (`lookAround`, `historySettled`), never a fixed time; 3× under the night clock with eight
   CPU hogs, unit and browser guest cases, all green.

## Sol's re-review of `1b678c0` (P1) and two test waits

1. **P1 — the one-add guard lived in the sheet**, so closing and reopening the Invite sheet reset it:
   two POSTs, and the older answer landing last replaced the crew doc and the newer person vanished
   on this phone. Fixed at the mechanism: `addPerson` in app.js keeps **one add in flight per crew
   for the page** (`addInFlight`); a freshly opened Invite sheet reads it — "Adding Mo…", every way in
   waiting — and takes the success state when it lands. And an add's answer is applied **whole only
   if nothing newer has reached this phone since it left** (`state.remoteGeneration()`, counted in
   `applyRemoteDoc` — a poll, a push, another add); otherwise only the person it added is written in,
   so a late answer can never take anyone away. Tests (`tests/people-menu.test.mjs`): add Mo → close
   → reopen (the new sheet waits on Mo; Enter and Add for Nia send nothing) → Mo's answer lands on the
   reopened sheet with Mo's link → Nia added after, her link; one POST at a time, both present. And
   out of order both ways: another phone adds Quin and a poll brings him while Pat's answer is in
   transit, Pat's lands last — Pat and Quin both present; Ria's lands first, then Sol's poll —
   everyone present. Each test fails without its half of the fix.
2. `tests/view-menu.test.mjs`'s fixed 40 ms wait after Back (the List build's test) now waits for
   Settings to leave and the router's entry to go.
3. `tests/people-menu.test.mjs`: every wait is for a state — the menu open, history still, a sheet and
   its entry gone — never a fixed settle (the "menu gained Zed" case failed once at 10 ms under load
   25). 4 runs of the touched files under the night clock with 12 CPU hogs: green.

## Cut, not patched: third round on the add answer (Sol's re-review of `bcaacb3`)

Sol found two more P1s in the same place — (1) a poll or push that left before the add could answer
after it and replace the doc (sync orders polls against pushes, not against Invite adds); (2) with the
generation moved, the late answer still replaced the whole person entry, undoing a newer removal,
colour or pid — and a P2: the add request had no deadline, so a hang held the page-level guard. Three
rounds on one mechanism: the add path writing its own server answer into this phone's crew doc,
beside the sync engine and outside its ordering (the old add sheet did it since July). Cut:

1. The add stays **server-first** (its POST is what answers the people cap and "name taken"), but its
   answer is **never written into the local doc**. On success the sheet takes only the name it sent;
   the personal link is built from it.
2. The doc comes **the one ordered way**: `sync.afterServerWrite()` (new, `js/sync.js`, the smallest
   entry point) treats the add like a completed push — any poll already out carries an older snapshot
   and is set aside (`pushGen`) — and polls now, or right after a push that is out (so no answer that
   left before the write has the last word). The menu and people row repaint when it lands
   (`onRemoteChange` → `repaintFromRemote`), like any other remote change.
3. **A deadline** (the join flow's 12 s): a hung add is let go with "Didn’t reach the crew — try
   again.", and the page-level guard is released. Offline is unchanged: a local pending edit, pushed by
   sync.
4. `state.remoteGeneration()` and its counter are gone (nothing else read them).

**Everything that read the add's local doc, and how each is served now:**

| Reader | Needs | Served by |
|---|---|---|
| The success sheet ("MO IS IN", Share, Copy) | the name and their personal link | the name the request sent; `inviteLink(name)` builds the link — at once |
| The laptop's people row (`renderPersonChips`) | the person in `state.activePeople()` | the ordered poll → `repaintFromRemote` |
| The Highlight menu's rows | the same | the same (`paintHighlight` from `renderPersonChips` / `renderYou`); every open also re-reads the crew |
| Pick as someone else (picking for the new person) | the person in `activePeople()` (and its still-in-the-crew check) | the ordered poll — typically well before a person can close the success sheet and open the shelf |
| The Invite sheet's own checks ("already in this crew", the next person's colour) | people the server has that this phone does not yet | `addedNotYetHere` — memory of names answered, pruned when the poll lands; never written to the doc |
| "From your other fests" chips | who is already here | `state.people()`; a just-added one still showing is caught by the check above |
| The invite-festival stamp | `meta.inviteFestId` | read at sheet open; untouched by adds |
| Sync's pending overlay | — | an online add never touches it; offline and Stay-offline adds go through it (`recordPerson`, after the people-cap check); an add whose answer lands after Stay offline went on queues nothing |
| Settings → Crew (member chips, their links) | `activePeople()` | read when Settings renders (as for any remote change) |
| The wall (marks, auras) | picks | a new person has none |

**Tests** (`tests/people-menu.test.mjs`, each red without its part): a poll that left before the add
and answers after it cannot take the new person away (red without the `pushGen` bump); another phone's
removal and recolour, arriving while the add's answer is in transit, are not undone (the fresh poll held
so the answer's own effect is seen alone — red if the answer is applied); a hung request is let go at the
12 s deadline (stubbed short) with the plain word and a free guard for a reopened sheet (red without the
deadline); plus every earlier add test, now waiting for the ordered poll instead of reading the answer.

## Sol's re-review of `58e75fe`: Stay offline, and a removed member brought back

The cut held (no ack, retry, blocked-state or poll-ordering fault from the `pushGen` bump; the fresh
poll still overlays pending edits; the server keeps the submitted key, so the link names the stored
person). Two left, both fixed:

1. **P1 — Stay offline.** The add still POSTed under the setting, said IS IN, and the ordered poll
   never ran (polls stop under it), so the server had the person and this phone did not. The setting
   means *this phone sends nothing*: under it the add takes the **offline path** — no POST, a local
   pending edit through sync, like a real offline add — and the success line says the crew hears once
   the phone is online again ("Send Vic this link. Opening it makes the picks theirs — once this phone
   is online again."). An add already out when the setting goes on keeps the person here as a pending
   edit when its answer lands (idempotent with the server's copy), so the view is never left behind.
   `sync.stayingOffline()` (new, one line) is the page's own truth for the setting. Tests: an add under
   Stay offline sends nothing, is here at once and pending, and sync sends it once the setting is off;
   the setting switched on mid-flight keeps the person here. Both red without their fix.
2. **P2 — `addedNotYetHere` pruned on any local entry**, and a removed member being brought back
   already has one (`removed: true`), so a sheet reopened before the poll landed let the same add go
   twice. It prunes only when the local entry is the active person. Test: bring back a removed member,
   reopen before the poll — "Mo is already in this crew.", no second POST (red without the fix).

## Sol on `0e51b06`, and the release rule: no worse than production, cheap and certain fixes, the rest banked

Production's add today (`main`, `openAddMember`) applies the server's doc directly, POSTs under Stay
offline, and its offline branch writes a local person keyed by the local copy's casing with no cap
check. So several late findings are pre-existing flaws of the offline add path — sync-engine design
work, not this release's. The rule the coordinator set: the add path must be no worse than production
anywhere; fix what is cheap and certain; bank the rest with acceptance tests.

1. **P1, cut (it came from the mid-flight instruction of the round before):** when Stay offline goes on
   while an add is out and the add SUCCEEDS, nothing is queued here any more — a pending copy could
   bring back a person another phone then removes, or undo a newer colour. The server has the person;
   the sheet shows the same "once this phone is online again" line, and the ordered path brings them
   when sync resumes (switching the setting off pushes, and the push's answer is the crew doc). The
   local write that REPLACED an entry (dropping an existing pid) now merges into it. Tests: the
   mid-flight success queues nothing and a later removal by another phone stands; a local-only add of a
   removed member keeps their pid. Each red without its fix.
2. **P2, cheap:** a local-only add (offline, Stay offline) checks the active count against the people cap
   first and says "This crew is full (24 people max)." — the server's words — instead of promising a
   link. The cap is now one shared number, `ACTIVE_PEOPLE_MAX` in `js/name-rules.mjs`, which the server's
   `LIMITS.activePeople` reads (the same way the name rules are shared). Test: a full crew under Stay
   offline — the words, nothing queued, the entries live again (red without the check).
3. **P1 about casing — BANKED (pre-existing):** an offline add of "drew" while the server already has
   "Drew" queues `people.drew`; the merge refuses two names that differ only by case (400, "Someone in
   the crew already has that name"), sync.js treats that as a deterministic refusal, and the phone's
   sync is **blocked** until a new edit. **Today's production has the same exposure** — confirmed in
   `origin/main` `js/v3/app.js` (`openAddMember`'s catch: `state.recordPerson(canonical, person)` with
   `canonical` from the local copy's casing, no reconciliation), and `api/crew.js` returns that 400.
   Not redesigned now.

## Follow-ups (banked, with acceptance tests)

1. **A pending add whose name matches a server person case-insensitively reconciles to the server's key
   and never blocks sync.** `tests/offline-add-casing.test.mjs` — written, runs as a TODO (it fails today,
   reproducing the block: pending `drew`, sync blocked), and does not fail the suite. The fix is in the
   sync engine (reconcile a pending person against the server's names before or on a 400), not the
   Invite sheet.

## For whoever merges this with live/tap and live/plan

1. `js/v3/app.js`: `shelfOpener()`'s last lines (one line changed here; live/tap edits a line
   nearby), and the avatar wiring in `init()` (the jumpTop/youTap lines were replaced; live/plan's
   search-field hunk sits just above them). `openShowMenu` gained an `onClose` option and
   `catchStrayTaps(true)` — live/plan adds `closePlan()` at its top; both belong.
2. `js/v3/join-shelf.js`: additive (a `me` option and member words); live/tap changes the backdrop's
   settle and the rise curve — no overlap in lines, but the same function.
3. Tests touched by both: `first-open-guest`, `first-open-shelf-close`, `show-menu-stacking`,
   `now-jump` (its phone `highlight()` helper now uses the menu).
4. **Our plan's row**: `peopleMenuPlanRow()` in app.js returns null; return
   `people-menu.js menuActionRow({ label: 'Our plan', chev: true, act: 'plan', cls: 'plan' })` wired
   to open the plan, and it lands above Pick as someone else / Join the crew (tonal text is the
   design's — add `.hl-pop .hl-act.plan { color: var(--tonal-text); }`).

## Follow-ups (not blocking)

1. index.html's new-build check calls `reg.update()` on every page show; with the worker blocked (the
   browser harnesses) there is no `reg`, and it throws. Harness-only (people-menu's browser test now
   stubs `register()` as now-jump does); a `reg &&` would quiet every other harness too.
2. How it works: Kevin's row "Tap their name. Switch who you pick as in Settings." is still true but no
   longer where a phone looks first — suggest "Tap your avatar, then their name." (his words to change).
3. A real-iPhone check of the empty-space tap (call 14): WebKit in Playwright reproduces the missing
   click and the fix; Safari on a phone is the one that matters.

## The review round (Codex, on `a1612a0`, 2026-09-26)

An independent Codex review (read-only tree at the head, `npm test` run there: 1,131 pass, the stamp
test the one expected failure; it could not run the browser files — no browser in its sandbox).
Five findings, four fixed, one declined:

1. **P2 Pick as someone else could switch to someone removed while the shelf was up** — fixed: the
   chosen name must still be active (`tests/people-menu.test.mjs`, fails without the fix).
2. **P2 NOW arriving after a three-disc pill could not be whole at 320** (the "known limit" of call
   13) — fixed: the pill refits whenever the day row's tabs change (NOW comes or goes, a repaint) and
   on a turned phone (`refitPill`; browser test: two discs, then three when NOW leaves — fails
   without it).
3. **P2 a menu's rows stayed live through its 130 ms fade** — a quick second tap still moved a
   highlight, and in the Show menu a room — fixed in the shared close: a closing menu takes no
   pointer (browser test, Highlight and Show).
4. **P2 the guest's Join the crew handed focus back to a hidden menu row** — fixed: the menu closes
   (focus back on the +) before the shelf asks where to return (`first-open-shelf-close` now focuses
   the row first, as Chromium does; fails without the fix).
5. **P3 "member mode keeps the guest prompt, Pick shows as…"** — declined: the approved design gives
   the member's shelf exactly that line ("Pick shows as…" · "Tap a name, then confirm.").

## What the slow motion caught (people-rig.mjs slowmo, a twentieth speed)

1. The avatar's ghost sat IN the flow, beside the pill (`.dock .you` is position: relative and out-
   ranked `.hl-ghost`) — the wrap widened mid-motion. Fixed with specificity.
2. The faces flying down from the menu's marks were invisible: clipped by the pill's own opening clip
   and painted under the fading menu (z 35). The pill's body is now a layer of its own (`.hl-bg`) —
   the clip is on the body only — and the pill stands at z 36.
3. The day tabs outran the pill's edge (the pill opened over GROW on ARRIVE, the tabs slid over
   CASCADE): FRI slid under the ✕ on a clear. The body's clip now runs on the tabs' own duration and
   curve (CASCADE; ARRIVE in, SURFACE out), so the edge and the row move as one; on a clear the ✕
   goes first (it is where the tabs are headed), the faces shrink to the circle, the body fades last.
4. Your letter lingered under the first landing face; it now leaves in 0.7 × OUT.

## The plan (one commit per working step, each pushed)

1. **Markup + module.** The avatar in the dock and the rail each get a wrap (`#dock-you-wrap`,
   `#rail-you-wrap`, a `.sort-wrap` like the fest name's) holding the avatar, the pill and the menu.
   The menu's rows, the pill and the slot's motion live in a new module, `js/v3/people-menu.js`, so
   app.js only wires them (it is shared with the tap and Our plan builds).
2. **The Highlight menu** from the Show menu's own component: `.sort-pop`, `.menu-label`, a row per
   button (the 44px floor comes from being a `button`), `.pop-div`, `.chev`. It opens and closes
   through the SAME `openShowMenu` / `closeShowMenu` (one `openMenu` at a time, one outside-tap rule,
   one Escape, no history entry, the shared `show-menu` busy flag), with an `onClose` hook for the
   pill's motion. Stays open across taps; closes on a tap outside, the avatar again, Escape.
3. **The highlight stays viewer-side**: filters.js `savePeopleFilter` (sessionStorage per fest, per
   tab), never the crew doc. A tap dims the wall IN PLACE (the same `passesPeople` rule wall.js uses at
   render), so the cards can step back with a transition instead of a repaint's cut.
4. **The pill** (avatar slot → faces + ✕) in the dock and the rail. ✕ clears in one tap; the faces
   reopen the menu.
5. **The phone's people row goes**: CSS only, under 720px. Desktop keeps it.
6. **Pick as someone else ›** opens the join shelf in member words (`showJoinShelf({ me })`); two taps
   (a name, then **I'm Ben**) → `switchIdentity`. **Join the crew ›** for a guest (the + opens the menu).
7. **Jump to top retires** (no door).
8. **One Invite sheet**, crew link first → a name → your other fests. Replaces the share moment AND
   the add-someone sheet.
9. Unit tests, browser tests with real input, frames at 390 / 320 / 1280 in `people-shots/`.

## Storyboard (written before the motion code)

Numbers are motion.js's: GROW 240 · OUT 130 · CASCADE 170 · STAGGER 30 · ARRIVE (4% overshoot) ·
LEAVE (quick, plain) · SURFACE (crisp). Transforms, opacity and one clip only; Reduce Motion and
Low Power: every step instant (canAnimate), nothing skipped or broken.

**A. Open (tap the avatar, nothing highlighted).** t0: the menu rises 4px and fades in (CASCADE,
ARRIVE) — the Show menu's own open, same code. t0: the avatar's ring turns brand (120ms CSS, the
fest glyph's transition). The dock stands above the companion cards while it is up (`.menu-up`).

**B. Tap a person (menu open).** t0: their mark fills with their colour and the ✓ grows in (scale .4→1,
CASCADE, ARRIVE); their name turns brand; Everyone's ✓ fades (OUT). t0: every card whose dim changes
steps back or forward (opacity, GROW, SURFACE) — the wall is dimmed in place, not repainted, so it
moves live behind the menu. Untapping reverses it; Everyone clears all of them at once.

**C. Close with a highlight on.** t0: the menu drops (4px, OUT, LEAVE — the Show menu's close).
t0: the slot swaps avatar → pill in layout; the day row re-rests at its new width; every day tab
slides from where it was (the existing tab FLIP, `slideTabs`, CASCADE, ARRIVE). t0: the pill's body
opens from the avatar's circle to its full width (a clip from the left, GROW, ARRIVE). t0 + i×STAGGER:
each face travels from its mark in the menu to its place in the pill (translate + scale .55→1, GROW,
ARRIVE). t0 + GROW/2: the ✕ fades in from 4px left (CASCADE). The avatar's letter leaves as a
ghost where it stood (scale →.6, fade, OUT).

**D. ✕ (clear).** t0: the highlight clears and the wall's dim lifts in place (GROW, SURFACE). t0: the
slot swaps pill → avatar; the tabs slide back into the room (CASCADE, SURFACE — the way out). t0: a
ghost of the pill collapses into the slot's circle (the clip closes to 26px, faces shrink toward the
left edge, fade — OUT, LEAVE). t0 + 2×STAGGER: your letter grows back (scale .6→1, GROW, ARRIVE).
Keyboard focus that was on the ✕ lands on the avatar.

**E. Faces (reopen).** The reverse of C: the slot swaps pill → avatar (tabs slide back), the menu
opens (A), and each highlighted person's mark travels up from where their face was (translate +
scale 1.8→1, GROW, ARRIVE), the pill's ghost closing as in D.

**F. From anywhere else** (a desktop people-row chip, a crew-mate removed on a poll): the same slot
morph, the faces growing from the slot itself (no source to travel from). Things grow from where
they are.

**G. Pick as someone else › / + Invite someone / Join the crew ›.** The menu closes (its normal close,
C if a highlight is on — under the sheet's backdrop) and the shelf or sheet rises on its own motion.

## Product calls (with reasons) — the design did not cover these

1. **The pill is the avatar's height (26px), not the frames' ~30px.** The dock must not change
   height when a highlight turns on: NOW's landing band, the welcome card's lift and the menu's
   own line are all measured from the dock's top. The faces are 20px, overlapping 6px.
2. **More than three highlighted: two faces and a +n** (the welcome card's solid +n — dashed means
   "add"), so the pill is never wider than three faces. The design said "up to three".
3. **The faces are in the crew's order** — the menu's row order, top to bottom → left to right —
   not the order they were tapped, so the pill reads the same however you got there.
4. **The laptop's rail gets the pill too.** One component, two positions (note 1.1); a laptop deep
   in the wall clears a highlight in one click without scrolling up to the people row.
5. **A crew of one has no "Pick as someone else"** — there is nobody to be. Invite someone stays.
6. **The member's Pick-as shelf has no name field.** The frame kept the guest's "Add your name"
   field, but a member already has a name, so it asks the wrong question; someone new comes in
   through **+ Invite someone**, the next row down, and two doors for adding people would drift.
   Your chip says "· you" and choosing it chooses nobody (you are already you); the filled button
   reads **Switch** (disabled) until a name is tapped, then **I'm Ben**; the way out is **Stay Ana**;
   no offline line (switching is this phone's own choice, nothing is sent).
7. **The wall dims in place, not by a repaint**, so the cards step back live behind the open menu
   (a repaint is a cut). Same rule wall.js renders with (`passesPeople`); a standing zoom takes
   the repaint path, which already knows how to keep it.
8. **A long crew scrolls inside the menu**, capped to the room above the dock (below the rail on a
   laptop); **a long name wraps inside its row** (the row grows) and the menu never runs past the
   screen's gutters.
9. **The Invite sheet is the one sheet everywhere**, including right after a crew is made (the
   brief asked me to decide): after create it keeps the moment's title, "ONE LINK MAKES IT A CREW",
   and its "Later"; from + Invite someone it says "INVITE SOMEONE" and "Done". The name field is
   NOT focused on open (the old add-someone sheet did): a phone's keyboard would cover the crew
   link, which is first. A guest (Settings can open the link) sees the link only — no name to add,
   no invite-festival stamp. Kevin's short copy is kept word for word ("Pick for them until they
   open their link."; `tests/share-copy.test.mjs` holds it).
10. **Switching who you pick as grows the new letter in** (the + becoming you already did).
11. **How it works keeps Kevin's words** ("Tap their name. Switch who you pick as in Settings." —
    both still true: the names are in the menu, and Settings → You still switches). Suggested,
    not made: "Tap your avatar, then their name." (`tests/docs-truth.test.mjs` holds his rows.)
12. **The laptop's people row drives the same highlight**, and its chips now dim the wall in place
    too; the rail's pill appears with the faces growing in the slot.
13. **The pill holds only as many discs as leave the day row its promise** (wall.js restingLeft rules
    1–2: the day you are in whole, NOW whole beside its day). Measured at 320 with NOW live: three
    discs left 92px of row for SAT · NOW's 101, and NOW slid out — so two there (a face and +n).
    ACL's long name at 320: two (the day you are in whole; NOW cannot be whole there even beside the
    bare avatar, today); at 360 one. One disc for several people is their bare count. `pillCap` in
    app.js measures it at every paint; `pillWidth` is held to the drawn pill by the browser test.
    Known limit: the cap is judged when the slot is painted, so NOW arriving later (the minute tick)
    with three discs up can clip NOW until the next paint — the day you are in stays whole.
14. **A tap on the wall's empty space closes a menu in WebKit too — Show's included.** Found on the
    walk: WebKit (so an iPhone) sends a tap's click only where something listens, and both menus'
    outside tap is a document listener, so a tap on a gutter or the time rail left either menu open
    (Chromium closed it). While a menu is up the wall listens (`catchStrayTaps`), with its tap
    highlight off so a closing tap never flashes the wall grey. Shipped Show since v93 this way;
    worth Kevin knowing it was broken on his phone.
15. **The Invite sheet's lone Done stays small** where there is no share sheet (a laptop); with Share
    the row is [Share the link][Done].
17. **At the tightest dock the pill folds to the avatar's size** (26px: one disc — the face, or the
    count — in the brand ring, no ✕; Everyone in the menu clears). Reached only where one disc and a
    ✕ would take NOW's room or the day you are in (ACL's long name at 320; Linux-wide glyphs at 320).
    The ✕ comes back when there is room.
16. **Faces open the menu from the pill with its own label** ("Highlighting Ben and Cy. Open
    Highlight"); the ✕ says "Stop highlighting: show everyone's picks". The avatar's label names you
    and the menu ("Ana: highlight people's picks"; a guest's: "…, or join the crew").

## Disagreements with the brief

1. The member's shelf without the field (call 6) departs from the approved frame; flagged here so
   Kevin can put it back if he meant the field to add-and-switch in one go.

## Log

- 2026-09-26: read the brief, the design brief + frames, LEDGER call 8, PLAN item 2; mapped app.js
  (Show menu 1657–1910, people row 964–1028, avatar 1530–1560, share moment 2425, add someone 2499,
  wiring 4063–4105), join-shelf.js, filters.js, v3.css (dock, sort-pop, floor), the rig. Checked the
  sibling branches: `live/tap` touches askToJoin / openJoinShelf / join-shelf.js's backdrop, `live/plan`
  touches openShowMenu (closePlan) and the lines around jumpTop — both kept in mind so this build's
  edits there stay one-line and marked.
