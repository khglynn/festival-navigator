# First open — what a friend sees when the link lands

**2026-09-25, Fri ~5:30–7 PM PT · design slice, no code shipped · v89 on main (47a381c)**

The problem, in the friend's words (via Kevin): *"it's not clear what this is or how
this works, or that all the colors mean a lot of people want to go."* This brief
covers the first open: a crew link on a new phone, a phone that knows you, and a bare
fest.kevinhg.com. It lays out three directions, three copy options, how a share link
can carry "just Portola" or "just Folsom", what the landing can offer, and a pick.

**How to look (on a phone, one image each):**

| Sheet | What |
|---|---|
| `shots/sheet-today.png` | today, 8 screens |
| `shots/sheet-F1.png` | F1 · the door |
| `shots/sheet-F2.png` | F2 · wall first (**the pick**) |
| `shots/sheet-F3.png` | F3 · three beats |
| `shots/sheet-shared.png` | the share sheet + the two landings |

Single frames are 390×844 at 2x in `shots/today/` and `shots/frames/`. PNGs are
gitignored in this repo, so they exist on this Mac only. Every frame is the **real
v89 app** (clean worktree, production CSS, real Portola data) booted with a made-up
crew. The new layer is drawn with production classes plus `rig/frames.css`. Cards
come from the app's own `aura.js`/`wall.js`, so they are real cards, not lookalikes.

---

## 0. The short version

1. **Today, a friend can't see anything until they pick a name.** Every crew link on
   a new phone goes to "Tap your name, or add yourself" (`js/v3/app.js:2756-2758`).
   That screen looks like a login and says nothing about what's inside.
2. **The How it works bar is off-screen on the days that matter.** On the day-of
   open the wall scrolls to today (measured: scrollY 835 on open, the bar at y=213).
   A friend opening a link this weekend never sees it (`shots/today/t4-*.png`).
3. **The recommendation is F2, wall first.** The link opens straight onto the wall
   with nobody selected. One welcome card sits above the dock and says what this is.
   The name is asked only when they tap an artist, and that artist becomes their
   first pick. It is Kevin's own sketch ("step into the map without being someone…
   if they tap, pop the create-a-profile thing").
4. **A share link can carry a starting view** (`&show=fest` = just Portola), in
   the hash beside `g=`. It applies once, on this phone only, and never overrides
   a choice the viewer already made.
5. **The cold landing can't list crews, and shouldn't.** It offers a paste box, the
   crews this phone knows, and the My link. It also says plainly that crews are private.

---

## 1. What happens today (v89) — inventory

Full notes with more line numbers: `inventory-notes.md`.

1. **Cold fest.kevinhg.com, nothing on the phone.**
   a. Pitch, then ADD A FESTIVAL, then "Your festivals: Nothing yet"
      (`index.html:118-135`, `renderLanding` `app.js:1940`).
   b. A friend who lost the link has nowhere to go. → `shots/today/t1-cold-landing.png`
2. **Crew link on a new phone → the join screen.**
   a. "You're invited to PORTOLA '26 / with The Portola Crew / Tap your name, or add
      yourself", then six name rows and a field (`index.html:170-188`,
      `renderJoin` `app.js:2210`).
   b. It gives no hint of what the crew picked and no way in without a name. So a
      friend who "just wants to see what we're doing" is pushed to tap *someone's*
      name, and their taps then land as that person's picks.
      → `shots/today/t2-join-new-device.png`
3. **A crew with nobody in it.** A lone field in the dark. → `shots/today/t3-join-empty-crew.png`
4. **A phone that knows you (pid match).** Straight in, with the toast
   "Welcome back, Kevin. · Not me" (`app.js:2082-2107`). Works well.
   → `shots/today/t8-recognized-welcome.png`
5. **Bring your picks.** A card above the dock, once per crew × fest
   (`app.js:2128`, `crew-entry.js`). Its anatomy is what F2's welcome card reuses.
6. **The How it works bar (the "coach mark")** (`app.js:1116-1147`).
   a. One dismissible toolbar strip, once per device (`fn_coach_v1`), shown only
      after you have a name.
   b. Five lines on a phone. On the day-of open it sits above the fold.
      → `shots/today/t4-first-wall-coach-mark.png` (what you see) and
      `t4b-first-wall-top.png` (where it actually is)
   c. The full page behind it is good content, but two taps deep in Settings.
      → `shots/today/t6-how-it-works.png`
7. **"A link to share on the very first page"**, which is two things today:
   a. After creating a single-fest crew, the "ONE LINK MAKES IT A CREW" sheet opens
      over the creator's first wall (`app.js:1445`). → `shots/today/t5-share-moment.png`
   b. On a returning phone, the My link card (the master key, with its warning) is
      the first card on the home page. → `shots/today/t7-landing-returning.png`
8. **The share link carries only the festival.**
   a. Its shape is `/f/<fid>#g=<token>&f=<fid>[&me=<name>]` (`crew.js:78-109`).
   b. Parsers: `tokenFromHash` 44, `festFromHash` 66, `meFromHash` 115. All three
      tolerate an extra `&show=…`, and old builds ignore it.
   c. The room filter already exists as "the fold": device-local, per festival,
      never in the doc (`filters.js:91-116`, key `fn_fold_v1_<fid>`). Portola's rooms
      are `:fest` "Portola", `Afters`, `Folsom` (probed live from `roomsOnWall()`).
9. **A nameless viewer is already mostly supported:**
   a. Notes go read-only with "No notes yet." (`notes.js:563-575`).
   b. Settings says "Open your crew link to claim a name." (`settings.js:628`).
   c. "+ Add" hides (`app.js:429`), and bring-picks and the bar skip.
   d. **The one hole:** a tap on a card does nothing, silently (`app.js:347`).
   e. The dock's "you" slot would be an empty white ring (`.you-avatar`,
      `v3.css:631`; read from the CSS, not measured).
10. **"Add events anytime in Settings" does not exist.**
    a. Settings can add a *festival*: from the catalog, or an AI-researched custom
       one (`settings.js:207-218`).
    b. A single show is `claude-plans/2026-09-02-add-a-show.md`, not built (NOW.md
       lists it after Oct 11). No copy below promises it.
11. **Side finding from the rig:** entering a crew tries `POST /api/person` to mint
    an identity. A guest in F2 would never do that, which means fewer orphan person rows.

---

## 2. What someone needs to know when the link lands

Two kinds of friend (Kevin's split), and what each needs:

1. **Lookers.** They "just want to find our group" and won't pick.
   a. This is **our crew's plan** for Portola.
   b. **Each friend has a color, and more color on a card means more of us want to go.**
   c. Tap a name to see just that person's picks.
   d. It opens on today, and no sign-up is needed.
2. **Pickers.** They'll add themselves. Everything above, plus:
   a. Tap an artist to add your color; each tap is brighter; 4 taps = must.
   b. Hold an artist for times, details and notes.
   c. Tap the fest name to show or hide parts of the week (the afters, Folsom).
   d. It works with no signal.

The first screen carries 1a, 1b and the invitation to pick. Everything else goes in "More".

---

## 3. The laws this keeps

1. **The link is the key and the consent boundary.** A guest holds the link, so they
   are in the circle and see exactly what the join screen shows today. No screen here
   lists a crew the phone or person doesn't already hold, and there is no directory.
2. **Views are viewer-side.** `&show=` lives in the hash (never sent to a server). It
   seeds this phone's own fold and is never written to the crew doc.
3. **The person token stays in the header.** Nothing here touches it. Guests never
   mint a person record.
4. **`--fest` in four places.** New pieces (room chips, the join ring, progress dots,
   the welcome card) use `--brand`. The only accent in the frames is the fest name.
5. **44px floor.** Every new control is a `<button>`, so it inherits the floor.
6. **Vocabulary** is picked / must / notes / fest. Copy says "pick", "must", "notes",
   "the fest name". It says "want to go", not "going", because a pick is interest,
   not a ticket.

---

## 4. The directions

Each covers: link open → understand → look as a guest → tap to pick → add yourself.

### F1 · The door — one welcome screen that is also the join screen

**Pitch:** the join screen becomes a real front door. It uses the crew's own data
(who's here, the three most-picked sets as real cards) plus two lines of "what this
is", and offers three exits: LOOK AROUND, tap your name, "+ I'm new".

**Frames**
1. `shots/frames/F1a.png` · the door
2. `shots/frames/F1b.png` · a crew nobody has picked in yet (Kevin just sent it)
3. `shots/frames/F1c.png` · a guest on the wall after LOOK AROUND, with Kevin tapped
   and the link opened on Portola only

**Flow**
1. Open the link → the door.
2. LOOK AROUND → the wall, nobody selected (this phone remembers "guest" for this crew).
3. Tap an artist → back to the door with "Pick Robyn as…".
4. Your name → in, and Robyn is your first pick. The next open goes straight to the wall.

**Before Sunday: M.**
1. Rework `renderJoin` into the door.
2. Add the guest boot branch.
3. Compute the top 3 picks (a small model helper).
4. Remember a pending pick across the join.

**Risks**
1. The join screen is the most-used screen this weekend; rebuilding it Friday night
   is the riskiest edit of the three directions.
2. One more screen stands between the friend and the colorful wall that explains
   itself.

**Motion.** The preview cards breathe (the wall's own gradShift). LOOK AROUND fades
the door; the wall's first day block arrives from 6px below with the arrival curve,
and the name chips follow in order.

### F2 · Wall first — walk straight in; the name is asked on the first tap (recommended)

**Pitch:** the link opens the wall as a guest, on today, with nobody selected. A
welcome card above the dock (the bring-your-picks card's anatomy) says what this is.
The first tap on an artist asks "who are you?" in a sheet, and that artist becomes
their first pick.

**Frames**
1. `shots/frames/F2a.png` · first open, the welcome card
2. `shots/frames/F2b.png` · the "More" (How it works, short, as a sheet)
3. `shots/frames/F2c.png` · a guest taps Robyn, and the ADD YOURSELF sheet opens
4. `shots/frames/F2d.png` · a crew nobody has picked in yet

**Flow**
1. Open the link → the wall, with the welcome card.
2. "Got it" → the card leaves; the dock's "you" slot is a dashed **+** (the standing
   door to join).
3. Tap a name → only their picks are lit (works today, unchanged).
4. Tap an artist → ADD YOURSELF: tap your name, or type a new one and Join, or
   "Just looking".
5. On Join → your color fills that card, and the next open goes straight in.
6. A personal link (`&me=Drew`) shows the card as "Kevin added you as Drew ·
   That's me / Not me", which claims in one tap.

**Before Sunday: S tonight, M in full.** Tonight's slice is in §9 and reuses the
join screen instead of the new sheet.

**Risks**
1. It touches boot routing. Keep the guest branch narrow: warm open stays
   name-only, so a guest always takes the cold path.
2. The welcome card covers the bottom third until "Got it".
3. The card and the bring-picks offer must take turns (the offer already waits
   for sheets; it should wait for the card too).

**Motion**
1. The card rises 12px with the offer's overshoot curve a beat after the wall
   settles; the avatars arrive one by one.
2. "Got it": the card leaves quick and plain, and the dock's + ring gives one soft
   pulse so the eye learns where the door is.
3. On Join: the sheet drops, then the tapped card's color fades in and your meter
   chip slides in from the left corner. Your name chip slides into the row while
   its neighbours make room, and the dock's + morphs into your avatar (dashed to
   solid, letter crossfades).
4. Reduced motion / Low Power makes all of it instant.

### F3 · Three beats — a short story, then the wall

**Pitch:** three tap-through cards teach the one thing a friend didn't get:
1. who's here;
2. more color means more of us (the same Robyn card gaining glows: 1 → 3 → 6);
3. tap to pick, hold for more.

**Frames**
1. `shots/frames/F3a.png` · who
2. `shots/frames/F3b.png` · the colors
3. `shots/frames/F3c.png` · how to pick

**Flow:** link → beat 1 → 2 → 3 → LOOK AROUND (guest wall, as F2) or "I'm in the
crew — pick my name". "Skip to the wall" is on every beat.

**Before Sunday: L.** Three new screens, a pager, and choreographed motion. Not before Sunday.

**Risks**
1. People skip stories.
2. Three taps before any value.
3. The most to build and walk.

**Motion.** Beats slide 24px with the overshoot. On beat 2 the one card literally
gains its glows in sequence; on beat 3 the four meters fill as if tapped.

**Why F2 over F1 and F3**
1. The colorful wall is the best explanation of itself, and F2 puts it first.
2. Lookers get there in zero taps; pickers in one tap plus a name, and that tap
   was the pick they wanted anyway.
3. The card is fixed to the screen, so the day-of scroll can't hide it (it does
   hide today's bar).
4. It is the smallest new surface: it reuses the offer card, the sheet, the join
   logic and the How it works rows.
5. F3's beat-2 animation is worth stealing later as the header of the "More" sheet.

---

## 5. Copy

The frames use C1 on the door and on the welcome card. All three fit either surface.
The door's headline goes on the door; the card uses its first line in bold instead.

**C1 · "See what we're seeing"** (viewer-first, warm) — *recommended*
1. Headline: **SEE WHAT WE'RE SEEING**
2. Lines:
   a. "This is The Portola Crew's plan for Portola."
   b. "Every friend has a color — the more color on a card, the more of us want to go."
   c. "Look around. Tap any artist when you want to add yours."
3. Buttons: **Look around** · How it works

**C2 · Kevin's sketch, tightened** (explainer)
1. Headline: **FESTIVAL NAVIGATOR**
2. Lines:
   a. "Your crew picks sets here, together."
   b. "More colors on a card = more friends want to go."
   c. "Tap an artist to add yours. Hold one for times and notes."
3. Buttons: **Got it** · More

**C3 · Name-forward** (for people who'll pick)
1. Eyebrow + headline: "You're invited to" / **PORTOLA '26** (the fest name, in its accent)
2. Lines:
   a. "Kevin, Maya, Jonah and 3 more are picking Portola sets here."
   b. "Their colors show who wants to see what."
   c. "Just looking? Go ahead. Picking too? Tap your name."
3. Buttons: **Look around** · the name chips

**Empty-crew lines** (any variant)
1. People but no picks: "Kevin started this plan for Portola. Nobody's picked yet." /
   "Every friend gets a color, and a card lights up with everyone who picks it. Tap
   any artist to be first."
2. Nobody at all: "Nobody's in this crew yet. Tap any artist to be first — you'll
   pick a name as you do."

**"More" — How it works, short** (`shots/frames/F2b.png`; each row has a real component drawn small)
1. **More color, more of us.** Every friend has a color; a card glows with everyone who picked it.
2. **Tap an artist to add yours.** Each tap is brighter — 4 taps = must.
3. **Tap a name up top** to see just their picks.
4. **Hold an artist** for times, details and notes.
5. **Tap the fest name** to show or hide parts of the week, like Folsom or the afters.
6. **Works with no signal.** Picks sync when you're back.
7. **Spotify, optional:** link it in Settings to see which acts you already play. It asks for your email first.
8. **Settings:** add another festival, change your name or color.
9. Footer: "No accounts. The link is the key — keep it in the crew."

**A second opinion.** An independent Codex copy pass on the same brief
(`copy-codex-sol6.md`, run cx-20260925-172716, found in this folder) landed in the
same place:
1. Look first; the name is asked on the first tap.
2. Spotify only "if your account has access".
3. "Adding individual events isn't available yet."
4. Its best line to borrow is the headline **"Find your people"** (it leads with why a
   friend opened the link). Its colour line is also more precise: "More fill means more
   of the crew picked that set."
5. Either can replace C1's headline or line b without changing anything else.

**Changes from Kevin's sketch, and why**
1. "Long press for notes" became "Hold an artist for times, details and notes":
   hold opens the zoom, and notes are one chip inside it.
2. "Add events anytime in settings" became "add another festival": single events
   don't exist yet (§1.10).
3. Spotify moved off the first screen: each crew's Spotify app seats 5 people
   (project memory, 2026-09-23), so pushing it to every friend would hit the cap.

---

## 6. Share: a starting view in the link

**The mechanics (every option shares them)**
1. **Link:** `…/f/portola-2026#g=<token>&f=portola-2026&show=fest,afters`
   a. `show` is a positive list of room slugs: `fest` = the festival's own room;
      any other room = its label, lowercased, spaces to `-`.
   b. Positive, because Kevin's ask is "just Portola" / "just Folsom".
   c. Hash only: the token rule already keeps it off the path, so no server or log
      ever sees it.
2. **Boot:** capture it beside `festFromHash` at `app.js:2640`, before `enterApp`'s
   `replaceState` strips the hash (`app.js:2452`).
3. **Apply once per phone per fest.**
   a. Only if this phone has no fold of its own for that fest, and not already seeded
      (a new marker, `fn_fold_seeded_v1_<fid>`).
   b. Write through `saveFolded` (`filters.js:112`): viewer-side, never the doc.
4. **Ignore bad input:** unknown slugs are ignored, and a list that would hide
   everything is ignored.
5. **Say it on arrival:** toast "Opened on Portola. · Show all" (the real action
   toast — `shots/frames/F1c.png`). "Show all" runs the existing fold flow.
6. **Personal links** (`&me=`) carry it too.
7. **The paste boxes** (bad-link today, the landing's new one) should keep the whole
   hash. Today's bad-link reopen keeps only `g=` (`app.js:2607-2609`).

**The options**
1. **SD1 · "Send what I'm looking at"** (automatic). The link carries the sharer's
   current show-menu state; the sheet adds one line, "Opens on Portola + Afters".
   **S.** Risk: someone who hid Folsom for themselves sends it hidden. The line and
   the toast cover it.
2. **SD2 · Choose on the share sheet** (`shots/frames/S1.png`). "IT OPENS ON" room
   chips, preset to the sharer's current view; the link text updates live, and the
   last chip can't be unticked. **M.** Clear and explicit. *Recommended after Portola;
   SD1 tonight.*
3. **SD2b · One choice instead of toggles** (from the Codex pass): "Portola ·
   Portola + afters · Everything". **S–M.**
   a. Simpler to read than chips, but it only offers the combinations someone thought of.
   b. A fine first cut of SD2 for Portola; chips generalize to ACL's two weekends.
4. **SD3 · A link per room** in Settings ("Folsom link", "Portola link"). **S** to
   build, but it multiplies links and clutters Settings. Not recommended.

**The message explains the app before the link is opened.** This is the cheapest fix
for "not clear what this is".
1. `navigator.share` sends only `{ title, url }` today (`app.js:1524`,
   `settings.js:158`). Add a `text` line, e.g. "Come see what we've picked for
   Portola. You can just look, or add yourself and pick with us." (Codex's wording,
   trimmed).
2. The chat bubble then says what this is, beside the preview image. **XS.**

**S1 also answers "a link on the very first page"**
1. The creator's first page stops opening the share sheet (`app.js:1445`).
2. The creator gets the welcome card instead: "Your Portola board is ready. Pick a few
   sets, then + Add sends your crew the link."
3. "+ Add" opens S1, which holds both "send the link" and "or add someone by name".
   One door for getting people in.

---

## 7. Cold landing and "find my crew"

What can be offered without breaking the consent boundary:

1. **CL1 · Say what it is, plus a paste box** (`shots/frames/L1.png`). **S.**
   a. The pitch in two lines, then "GOT A LINK FROM A FRIEND?" with a paste box and
      Open (reuses the bad-link parser).
   b. "Crews are private — their link is the only way in. Ask whoever invited you to
      send it again."
   c. START A CREW (renamed from ADD A FESTIVAL), and a quiet row: "Used this on
      another phone? Open your My link here and all your crews come back."
2. **CL2 · What this phone already knows** (`shots/frames/L2.png`). **S.**
   a. Your festivals first, then "+ Add a festival", the paste box, and the My link
      moved down to a quiet row.
   b. The master key stops being the first thing on the page.
3. **For Kevin's many unlinked devices,** the working answer exists: the **My link**
   (`#p=`) restores every crew your person record holds (`app.js:1918`
   `restoreFromMeLink`).
   a. Open it once on each device, copied from the main phone (home → My link).
   b. Caveat: each device that joined on its own minted its own person record (the
      "duplicate person rows" item banked in NOW.md), so pick one phone's link as
      the canonical one.
4. **CL3 · Short, memorable crew codes. Not now; a candid note.**
   a. Today's tokens are 20–40 random characters, unguessable in practice.
   b. A code people can say out loud is guessable by design: four random words from
      a 2,048-word list is about 44 bits (fine with strict rate limits, bad without),
      and a vanity name like "kevins-portola" is effectively public.
   c. A code is also a second credential. It needs revoking and server-side rate
      limits, and it must stay out of paths (logs).
   d. If it's ever wanted: make it short-lived (24 h) and view-only, minted from the
      share sheet.
5. **CL4 · Ask to join, approved by text or Slack. Rejected.**
   a. To ask, you must first *find* the crew, which means a directory, and that
      breaks the first law.
   b. It also needs an identity for the asker, notifications, and server state.
      Kevin's "overkill" is right.
6. **CL5 · A QR code on the share sheet. Later, and a good fit.**
   a. At Pier 80, a friend scans your phone; being there in person is the consent.
   b. Needs a small QR encoder vendored under `vendor/` (no runtime CDN). **S–M.**
      After Portola.

---

## 8. Edge cases, designed

1. **Crew with nobody in it:** the welcome card says so (§5 empty lines). ADD YOURSELF
   shows only "New here?".
2. **People but no picks:** `F1b.png` / `F2d.png`. Flat cards, "Be the first."
3. **A personal link (`&me=Drew`):**
   a. The card says "Kevin added you as Drew", with That's me / Not me.
   b. The join screen's "this link is yours" row is kept as the fallback.
4. **Recognized (pid match):** unchanged. Straight in, "Welcome back", Not me.
5. **A guest who later wants in:** the dock's +, any artist tap, a Notes sheet
   ("Add yourself to write a note"), and Settings → You ("Add yourself" instead of
   "Open your crew link to claim a name").
6. **People cap / name taken / offline join:** the same server-first POST and the
   same messages as today's join (`app.js:2261-2315`). Reuse it; don't rewrite it.
7. **Desktop:** the card sits bottom-centre at 440px max (the offer card's rule) and
   the sheets become centred dialogs. No new breakpoints.
8. **Guest + Stay offline / bad network:** the first open needs the network (as joining
   does today). Later opens go cold for a guest, because warm open stays name-only.
   A known cost: canOpenWarm had four review rounds and shouldn't move tonight.
9. **Seen it before:** the card shows once per phone (a new key, `fn_welcome_v1`).
   So friends who dismissed the old bar see the new explainer once.

---

## 9. Recommendation, and the build list

**Pick F2, staged, with C1 copy, SD1 tonight / SD2 after, and CL1 + CL2 for the landing.**

**Tonight, before Saturday doors (1 PM).** Each item is small and reversible; the join
screen stays as the fallback.

1. **Welcome card replaces the How it works bar.** **S.**
   a. The same `.bring-offer`/`.bring-card` anatomy, C1 copy, once per phone
      (`fn_welcome_v1`), for guests and new joiners alike.
   b. "How it works" opens the existing page (`settings.js:377`).
   c. Removes `maybeShowCoachMark` (`app.js:1116-1147`), and with it the bar that
      scrolls off-screen.
   d. The bring-picks offer waits for the card, as it already waits for sheets
      (`app.js:2156`).
2. **"Just look around" on the join screen** → `enterApp` with no name. **S.**
   a. Remember guest per crew on the phone (e.g. `fn_guest_v1_<token>`).
   b. Boot: `!crew.me(token) && !recognized && isGuest(token)` → `enterApp`
      (`app.js:2756-2761`).
   c. Add C1's two lines above the names.
3. **Guest tap → the join screen, "Pick Robyn as…"; on join, Robyn becomes pick 1.**
   **S.** `handleTap` stops returning silently (`app.js:347`). Hold the pending
   artist in memory, and apply it through the ordinary pick path after `enterApp`,
   only if migration isn't pending.
4. **The dock's empty "you" ring shows a dashed + for a guest** and opens the join
   screen (`renderYou` `app.js:853`). **XS.**
5. **`&show=` parse + seed-once + "Opened on Portola · Show all", plus SD1** (the
   link carries the sharer's current view, with one line on the share sheet). **S.**
6. **Share text:** add a one-line `text` to both `navigator.share` calls
   (`app.js:1524`, `settings.js:158`), so the message explains the app. **XS.**
7. **Tests to add:**
   a. boot as guest (cold, and a second open);
   b. guest tap → join → first pick lands;
   c. `&show=` seeds once and never overrides an existing fold;
   d. an everything-hidden `show` is ignored;
   e. welcome card vs bring-offer ordering.
8. **Gates:** a real-browser walk (touch) before promote, and a `sw-stamp` run.

**After Portola (before ACL, Oct 2)**
1. ADD YOURSELF as a sheet over the wall (F2c) instead of the join-screen round trip.
2. The short How it works sheet (F2b), with a "How it works" row in the fest-name show menu.
3. Share sheet room chips (S1/SD2), merged with + Add.
4. The creator's first page without the auto share sheet.
5. Landing CL1/CL2.
6. The personal-link card ("Kevin added you as Drew").
7. QR (CL5).
8. Warm open for returning guests.

---

## 10. Decisions for Kevin (reply like "10.2: C2")

1. **Direction:** F2 wall first, staged as §9? *Default: yes.*
2. **Copy:** C1, C2 or C3? *Default: C1.*
3. **Tonight's share:** SD1, where the link carries what you're looking at?
   *Default: yes; the chips (SD2) come after Portola.*
4. **"A link on the very first page"**, meaning the creator's share sheet and the My
   link card. Move both off the first page? *Default: yes to both.*
5. **Show the new welcome once to everyone,** including friends who dismissed the old
   bar? *Default: yes.*

---

## 11. How the frames were made (re-runnable)

1. **The rig is `rig/`.**
   a. `rig.mjs` serves the clean worktree statically, blocks the service worker,
      answers `GET /api/crew` with an invented crew, and **aborts every non-GET
      `/api` call and every `/fn-i`** (no production writes are possible; the static
      server has no `/api` anyway).
   b. `today.mjs` draws today's screens. `frames.mjs` draws the proposals (`node
      frames.mjs F2a` for one). `frames.css` + `fo-lib.js` hold the new layer.
      `sheets.py` builds the contact sheets.
2. **The clock** is pinned to Sat Sep 26, 3:15 PM PT for the wall frames. Today's
   screens use the real clock (Fri 5:30 PM PT).
3. **Guest frames borrow a name that isn't in the crew,** then strip its traces. v89
   has no nameless boot, which is exactly the gap F2 fills.
4. **Crew names are invented.** No crew token, person token or secret appears anywhere
   in this folder; the token in the rig is an obviously fake, parser-shaped string.
