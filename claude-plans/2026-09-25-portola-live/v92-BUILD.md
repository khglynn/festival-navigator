# v92 — first open, wall first (build log)

Started 2026-09-25 ~7:15 PM PT. Branch `live/v92`, worktree
`.claude/worktrees/v92` (off origin/main 257586e; v91 is in review and will
merge first — rebase onto it when it lands). Builder: an Opus teammate.
Orchestrator: the Portola live-ops session.

## Why

Kevin's friends open the crew link and don't know what the app is, or that
more color means more of the crew wants to go. Most of them just want to
find the group; some will add their own picks. Today the first screen is a
list of names that reads like a login, so a friend who only wants to look
taps somebody's name and their taps land as that person's picks; and the How
it works bar sits off-screen on festival days. The design round is
`claude-plans/2026-09-25-portola-live/design/first-open/BRIEF.md` — read it
whole (inventory with file:line, laws, the three directions, copy, share,
cold landing, edge cases, the build list in §9). Its frames are git-ignored
images in the main checkout's copy of that folder
(`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/claude-plans/2026-09-25-portola-live/design/first-open/shots/`);
look at `frames/F2a.png`, `F2c.png`, `F2d.png`, `sheet-F2.png`.

**Kevin chose F2, wall first** (review page, 6:27 PM): "Yeah F2 is the
cleanest. Let's add a left justified button in there to…" — the note was cut
off; the orchestrator is asking what the button is for and will relay it.
His other answers are pending; build with the brief's defaults and expect
messages that adjust them: copy C1, links carry the sharer's current view
(SD1), the creator's auto share sheet and the My link card move off the first
page, the welcome shows once to everyone, and the goal is to ship Saturday
morning before 1 PM doors if every check passes (otherwise it waits).

## What to build (the brief's §9 "tonight" list, adapted to wall-first)

1. **A crew link on a phone that doesn't know you opens the wall as a
   guest**, nobody selected, with the welcome card (F2a, C1 copy) above the
   dock instead of the "who are you" list. A phone that knows you, or
   recognizes you, behaves exactly as today. Remember guest per crew on the
   phone (device storage only, every touch in a try).
2. **The welcome card replaces the How it works bar** — once per phone, for
   guests and new joiners alike; "How it works" opens the existing page;
   the bring-your-picks offer waits for it the way it waits for sheets.
3. **A guest's first tap on an artist asks for a name** (today's join screen
   is fine for now; the sheet version is after Portola), saying which artist
   it is for; on join, that artist becomes their first pick through the
   ordinary pick path. The dock's empty "you" ring shows a dashed + for a
   guest and opens the same join.
4. **Share links carry the sharer's current view** (`&show=` in the hash
   beside `g=`), applied once on the receiving phone, never overriding a
   choice that phone already made, ignored if it would hide everything. The
   share sheet says so in one line. Both share calls get one line of text
   that explains the app.
5. Tests for each (the brief's §9 item 7 list), and the laws: the link is
   the consent boundary (a guest sees what any link holder already could);
   nothing new is written into a crew or person doc (a guest writes
   nothing until they join, and joining uses today's path); the update
   machinery is untouched; every new control is a button.

**Red line:** this changes what every new visitor sees first, during a live
festival. If any part needs a crew-doc or person-doc shape change, a sync or
merge change, or touches index.html's reload glue, stop and write it in the
Log instead of building it. Keep the old join path reachable, so nothing a
person could do yesterday becomes impossible.

## How to work

Same rules as v90/v91: only this worktree; commit and push as you go on
`live/v92` (preview only); no PR, merge or stamp; never load production with
a crew link or write to the production database (localhost /api and previews
hit it — serve with /api answered locally, as the v90/v91 walk rigs in this
folder do); one test suite and one browser at a time. Walk every state in a
real browser with real touch at 390 and 320 (a new link, a returning member,
a recognized member, a crew with nobody in it, a guest's first tap, the
share link with and without `show`), screenshots into
`claude-plans/2026-09-25-portola-live/v92-shots/` (git-ignored). Motion per
"How this app moves": the card arrives, it doesn't pop; Reduce Motion makes
it instant. Targeted tests while working, one full `npm test` at the end.

## Log

**~8:10 PM — read everything, built the core (commit 1).** What landed and
why, in the order a friend meets it:

1. **Boot routing** (`app.js` boot, cold path). A phone with no name in the
   crew and no recognition now enters the wall as a guest (`enterApp` with no
   name — the nameless paths it already had). Two cases still go to today's
   join screen first: a personal link (`&me=` — it names who it is for), and
   a phone whose person IS in the crew but ambiguously (`crew.personInCrew`:
   its pid on two members, or its mirror naming another member). Walking that
   phone in as a guest would read as the app forgetting it. Recognized and
   claimed phones are untouched.
2. **No persisted guest flag — on purpose.** The brief asks to "remember
   guest per crew". In wall-first it has no job: every unknown phone lands on
   the wall anyway, and "guest" is exactly "holds the link, no name here"
   (`crew.me(token)` empty) — a second stored fact could only disagree with
   that. The one place it could have mattered ("Not me" then "Just looking",
   next open recognizes again) behaves exactly as today, which the brief
   asks for. Flag this if you want it anyway.
3. **Welcome card** (`js/v3/welcome.js`, new, added to APP_CORE). The
   offer's anatomy (`.bring-offer/.bring-card`), crew faces + name, C1 copy
   as the F2a/F2d frames drew it, "Got it" · "How it works". Once per phone
   (`fn_welcome_v1`, raw guarded write + memory — a refused marker must not
   raise the "storage is full" toast that exists for picks). Everyone sees it
   once (10.5 default). It waits for an open sheet (the create flow's share
   moment); the bring-picks offer now never asks before the welcome has been
   read — "Got it" asks it. How it works opens the existing page and leaves
   the card for "Got it" when they come back.
4. **Coach mark removed** (`maybeShowCoachMark`, `fn_coach_v1`). Test
   setups that set `fn_coach_v1` now set `fn_welcome_v1` instead.
5. **Guest tap** → `askToJoin(artist)`: unzoom, close the show menu, mark the
   welcome seen, remember where they were standing (page Y + each timetable's
   sideways scroll — a hidden wall can forget both), today's join screen with
   a new "Pick Robyn as…" line and a new "Just looking" button (on every join
   screen, so the old paths get a way out too). On any join (tap a name, type
   a name, new person, offline join) `finishJoin` restores the place and makes
   the artist their pick through `handleTap` — only from level 0 (a member who
   taps their own name in keeps what they had), only if picks are writable
   and the card is still on the wall. It never throws into the join's own
   error path (the offline branch would record the person twice).
6. **Dock "you" slot**: a dashed + in brand for a guest (`.you-avatar.guest`),
   opens the join; one soft pulse after "Got it"; the letter grows in on join.
7. **`&show=`** (`crew.showFromHash`, `crewLink(…, show)`, filters.js
   `roomSlug/showOf/foldFromShow/showLabel`). Seeded once
   (`fn_fold_seeded_v1_<fid>`) BEFORE the first paint, only when: the link's
   `&f=` is the festival that opened, this phone has never shown that
   festival (no known crew saved on it — "showing everything" stores no fold,
   so the fold alone can't tell), no fold of its own, and the view hides
   something but not everything. Toast "Opened on Folsom. · Show all";
   "Show all" is the fold flow's way back for every room (`unfoldAll`).
8. **SD1**: every link handed out (share moment, Share invite, the invite box,
   personal links, add-someone) carries the view; the share moment and
   Settings' crew card say "Opens on Portola + Afters — what you're showing
   now." when it's partial. Both invite shares send one `text` line
   (`crew.inviteText`).
9. **A guest writes nothing** — gated what the wall-first guest can now
   reach: Share invite / share moment don't stamp `inviteFestId` for a guest;
   Settings hides Rename, "Research + add it", the Spotify card and Bulk paste
   for a guest; You says "You're just looking…" with an "Add yourself" button.
   A guest with no `&f=` and no `inviteFestId` lands on the crew's busiest
   festival (activation records an empty festival membership for a fest the
   crew doesn't have — the catalog default would have done that).

**~9:05 PM — tests, the walk, and what the walk changed.**

1. **Tests added** (all jsdom shell, the real app): `tests/first-open-guest.test.mjs`
   (guest boot writes nothing; the + ring; the welcome in C1; tap → "Pick
   Robyn as…" → Just looking back; + and Settings "Add yourself" open the
   same join; a notes sheet's door; join as Sam = one join POST and Kettama
   is Sam's first pick; next open walks Sam in; claiming Kevin keeps his 2;
   a guest's Share invite stamps nothing; empty crew; a personal link still
   asks first and Just looking walks in), `first-open-show.test.mjs` (slugs,
   showOf/foldFromShow, crewLink/showFromHash, unknown and all-rooms views do
   nothing, a fold of its own is never overridden, a fresh phone seeds before
   the first paint + Show all, a phone that has shown the fest is never
   re-folded), `first-open-welcome.test.mjs` (a recognized member gets the
   member copy and the offer waits for Got it; empty/no-pick copy),
   `first-open-after-share.test.mjs` (create: share moment → welcome → offer,
   never two at once). Mutation-checked the two load-bearing guards (the
   "only from level 0" pick and the guest's invite stamp): both tests go red.
2. **Existing tests**: the offer tests (`crew-join-recognize`,
   `bring-picks-after-share`, `bring-picks-guards`) and every browser test
   that set `fn_coach_v1` now set `fn_welcome_v1` — the offer waits for the
   welcome by design, and those files aren't about it.
3. **Full `npm test`: 942 tests, all pass except the asset stamp** (expected —
   stamping is the orchestrator's; a temporary `--keep` restamp made
   app-shell-complete and sw-stamp pass, then reverted). **`npm run
   test:browser`: 180/180.**
4. **The walk** (`v92-walk.mjs`, real Chromium, hasTouch + isMobile, taps via
   the touchscreen, /api answered from memory, SW blocked, clock pinned to
   Sat 3:15 PM PT except where noted). Report: `v92-shots/walk.txt`; shots in
   `v92-shots/` (git-ignored). At 390 and 320:
   a. New link → wall + welcome, zero writes; card 19px above the dock, fits
      at 320, both buttons 44px. Got it → card leaves, + pulses, seen.
   b. Guest tap (Kettama, grid scrolled sideways, page scrolled down) → join
      "Pick Kettama as…" → Just looking → back at the SAME scrollY and
      scrollLeft (2820/219 at 390, 3283/184 at 320), still zero writes →
      tap again → join as Sam → same place, Kettama `{Sam: 1}`, the + is "S".
      Writes, in order: the join POST, person mint, person stamp, the pick
      push (with Sam's pid) — today's join path, nothing else.
   c. Empty crew and nothing-picked crew: the brief's empty lines.
   d. Returning member (claimed, had dismissed the old strip): member copy.
      Recognized: "Welcome back, Kevin · Not me" and the card steps up 74px.
   e. `&show=folsom` → only Folsom rooms, toast "Opened on Folsom. · Show
      all" → Show all brings Portola and Afters back. No `show` → nothing.
   f. Settings as a guest: no Rename, You says "You're just looking…" + Add
      yourself. A member with Folsom hidden: invite link ends
      `&show=fest,afters`, line "Opens on Portola + Afters — what you're
      showing now."
   g. Motion: the card arrives (opacity 0 at mount, 9 animations: card,
      faces, buttons); Reduce Motion: opacity 1 at mount, 0 animations.
   h. 1440: rail + ring, card bottom-centre 440px; rail + opens the join.
   i. Hold a card as a guest (real touch, 700 ms) → zoom → tap the grown card
      → join "Pick Tove Lo as…", no zoom left behind, zero writes.
   j. Real clock (Fri 7:42 PM PT): lands on FRI AFTERS with the card up.
5. **Also fixed on the way**: a Spotify hop (`&sp=connect`) whose person
   absorb failed would now land as a guest and auto-open the Spotify drill;
   it waits for a name (and joining resumes it). `docs/user-flows.md` F3
   rewritten for wall first (the design audit walks that spec).

**Left out, on purpose (after Portola, per the design brief §9):** the ADD
YOURSELF sheet over the wall (F2c — tonight is today's join screen), the short
How it works sheet (F2b), share-sheet room chips (SD2), the creator's first
page without the auto share sheet and the My link card moved down (10.4 —
defaults say yes, but the brief's tonight list doesn't carry them and the
creator's only share door would be Settings until + Add opens S1), the
personal-link card ("Kevin added you as Drew"), CL1/CL2, the paste boxes
keeping the whole hash, QR, and warm open for returning guests.

**Known, accepted:** a new build's reload (index.html glue) can land while a
guest reads the join screen with an empty name field — the page reloads onto
the guest wall and the waiting tap is gone (they tap again). Marking that
busy would touch the update machinery, which this build leaves alone.

**~9:25 PM — Kevin's button (relayed 7:55 PM note).** "Let's add a right
justified button in there to pick with the crew." Built: **Pick with the
crew**, `btn-tonal`, the last child of the card's action row with
`margin-left: auto` — Got it · How it works stay on the left as F2a drew them.
Guests only: a member is already picking, so their card has no such door.
It is `askToJoin(null)` — the ordinary join screen, nothing waiting, the
welcome marked read. Measured in the walk: at 390 all three sit on one row
(Pick with the crew 223–363 in a card ending at 378); at 320 the row wraps and
the button sits alone on the second line, still right (153–293 of 308); all
three 44px. Tests: the guest file checks it is the right-hand door and opens
the join with nothing waiting and no writes; the member test checks a member
has none; the copy test covers the empty crew.

**~9:55 PM — independent review (Opus, read-only, on the branch as of
2751c62): no blockers; 11 findings, each checked against the code.**

Fixed (with tests):
1. *A guest could record an empty festival row in the crew.* With no `&f=`,
   no invite stamp and no picks, a guest fell to the catalog default (Portola)
   and activation's `ensureFestivalState` queued `festivals.<default>` for
   push. Now a guest falls back to any festival the crew already holds
   (`guestFestOf`). Test: an ACL-only crew opens on ACL, nothing queued.
2. *A guest on a legacy v3 doc asked for the one-shot migration* (a POST).
   Now only a named phone asks; a guest's `migrationPending` stays false (no
   banner either), and joining re-enters `enterApp`, which runs it. Test.
3. *History/refresh could open a member-only drill for a guest* (`sub:bulk`,
   `sub:spotify`, `sub:add-fest`, `sheet:add-member`) — reachable via "Not
   me" inside a restored Settings stack. The router openers now land a guest
   on Settings itself. Test.
4. *"Just looking" during an in-flight join* would show the wall, then the
   join landed anyway and dropped the waiting pick. It is disabled while the
   join POST is out.
5. *"Show all" acted on whatever festival was current* when tapped. Bound to
   the crew and festival it was said about.
6. *The join screen could name the stamp's festival* rather than the one the
   guest is looking at. `askToJoin` passes `ctx.fid`; the offline-join branch
   uses the same festival. Test (the ACL crew's join says ACL).
7. *A creator was told about themselves in the third person* ("Kevin started
   this plan…" to Kevin). A lone member reading their own plan now gets
   "Your plan for Portola is ready. Nobody's picked yet." Test.
8. *The welcome could skip a visit* when a refresh restored Settings over the
   wall. `closeSettings` now offers it (idempotent; the offer still waits for
   Got it, so no existing offer flow changes).
11. The first-open extras (the view seed, the welcome) run inside `safely()`:
    a throw is recorded and the wall opens without them, never the fatal
    screen.

Accepted and noted (not changed tonight):
- 1(a)/(c): a link's `&f=` naming a festival the doc doesn't hold yet (the
  sharer's own membership push is in flight — same idempotent write), and
  the offline fallback festival (a guest's first open needs the network).
- 9: `&show=` treats "this phone has shown the festival" as "a known crew is
  saved on it"; a crew opened with no festival hint, then forgotten, doesn't
  count. Portola crews all carry an invite stamp, so they are saved.
- 10: system Back on the join screen leaves the app (no history entry) — "Just
  looking" is the way back; the post-Portola sheet fixes it properly.
- Found while testing 1: **sync.js pushes the ACTIVE crew's pending changes
  when a debounce scheduled on the previous crew fires after a switch** — for
  a guest that is `{data: {}}`, which the merge leaves unchanged. Pre-existing,
  content-free, and sync is off-limits tonight; worth a one-line guard in
  `pushSync` (bail on empty pending) after Portola. The guest tests assert
  "no content written" with that noted.

Re-verified after the fixes: first-open tests 34/34; full `npm test` 945/946
(only the asset stamp, expected); `npm run test:browser` 180/180; the whole
walk again at 390/320/1440 — every scenario, zero page errors.

**For the orchestrator:** (1) stamp after the rebase; (2) when v91 lands,
rebase: the only conflict is adjacent import lines at the top of `app.js`,
and `wallPlace`/`restorePlace` should then also carry v91's sideways stack
rows (`.stack-scroll`, keyed by v91's exported `stackRowKey`) so "back where
you were" covers the afters rows on a phone too.

**~10:20 PM — rebased onto main after v91 landed (91d6ad3).** One conflict,
the adjacent import lines at the top of `app.js` (v91's `stackRowKey`, v92's
filters/motion names) — merged by hand. The rebase delta is exactly v91's
files. `service-worker.js` merged clean: v91's `festival-nav-v91` + its stamp,
plus v92's `welcome.js` in APP_CORE (the stamp is now stale — the
orchestrator's to run). Then:
1. "Back where you were" carries v91's sideways stack rows too
   (`wallPlace`/`restorePlace`, keyed by wall.js's exported `stackRowKey`,
   the repaint boundary's own key). Walked: an afters row at scrollLeft 38 on
   a 390 phone, tap a card in it, Just looking → 38, page Y kept.
2. v91's new `tests/browser/stack-row.test.mjs` set `fn_coach_v1`; it now
   sets `fn_welcome_v1` like the rest.
3. On the rebased branch: full `npm test` 960/961 (the stamp only; a temporary
   `--keep` restamp passes app-shell-complete and sw-stamp, reverted);
   `npm run test:browser` 191/191.


**~10:55 PM — Kevin's review-page answers (relayed on top of 315ecab).
v92 does not ship until he has seen it and we are aligned.**
1. **The welcome card is for new people only.** Kevin: "people that have
   already connected to a person in the fest should just go to now / the top /
   their filter selected." A guest (no name in this crew here) and someone who
   has just joined through the join screen see it (`welcomeHere`, set per
   entry in `enterApp`; the join paths pass `joined: true`). A phone that
   knows its name, a recognized phone and a creator see no card, and the
   bring-your-picks offer asks for them exactly as in v91 (it waits only for a
   card that is up or due). **Proved against v91** by running the same walk
   on an export of main: a returning member lands at scrollY 2847 in both
   builds; a recognized phone lands at 2959 in v91 and 2847 in v92 — the 112px
   is v91's How it works strip (present there, gone here) — and the now line
   sits at viewport y 279 in all four runs. The member offer tests
   (`crew-join-recognize`, `bring-picks-guards`, `bring-picks-after-share`)
   are back to v91's exact setup, no welcome marker, and pass.
2. **The two paths read as a choice** (provisional words, his to pick):
   left **Just looking** (was Got it; same behaviour), **How it works**, right
   **Join to pick** (was Pick with the crew). A guest's line: "Every friend has
   a color — the more color on a card, the more of us want to go. Look around,
   or join to add your own picks." A member who has just joined gets "Got it"
   and "Tap any artist to add yours", no join. **Every word is in one table**,
   `WORDS` in `js/v3/welcome.js` — a swap is one edit there.
3. Moving the creator's share sheet and the My link card: left out, as asked.
Verified: first-open + member offer tests 68/68; full `npm test` 960/961
(the stamp only); walks at 390/320 for guest, returning member, recognized.

**~11:20 PM — Kevin picked the words.** Left **Look around** (dismiss and
look), **How it works** beside it, right-aligned **Pick shows** (the join).
The buttons say the choice, so a guest's body is one line: "Every friend has
a color — the more color on a card, the more of us want to go." All in
`WORDS` (`js/v3/welcome.js`); the join screen's way back now reads
`WORDS.look` too ("Look around", was "Just looking"), so the two never drift.
A member who has just joined keeps "Got it" and "Tap any artist to add
yours" (no choice to make). Settings' "You're just looking… Add yourself"
row describes a state rather than offering the choice, so it stays.
Fit (walk): 390 — one row, Look around 27–135, How it works 143–247, Pick
shows 263–363 in a card ending at 378; 320 — Pick shows wraps to its own row,
right-aligned (193–293 of 308). All 44px.
**Recording**: `v92-shots/v92-guest-first-open-390.mp4` — 8 s, 390×844, 25
fps, motion on, Saturday 3:15 PM: land → the card rises, the faces arrive one
by one, then the buttons → tap Fcukers (a recording-only ring shows the
finger) → "Pick Fcukers as…" → Look around → back on the wall. Made by the
walk's `390 13` scenario (Playwright video + ffmpeg). Note for the motion
review: with six faces the buttons land ~0.84 s after mount, about a quarter
second after the card itself — the "beat between arrivals" as designed.
