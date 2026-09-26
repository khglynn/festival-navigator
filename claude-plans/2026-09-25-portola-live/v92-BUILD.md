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
