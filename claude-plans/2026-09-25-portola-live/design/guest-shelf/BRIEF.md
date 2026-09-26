# Guest shelf and tap-to-look: design round

> **Superseded in part, later on 2026-09-25, by `buttons/BRIEF.md` (the button
> study).** Three changes:
>
> 1. The primary button is now on the LEFT: Pick shows | Look around, and
>    Join as Sam | Look around.
> 2. The shelf's field says "Add your name".
> 3. The zoom's − notes + row is one segmented pill. It replaces the circles
>    in the `h-member-*` frames and the separate Pick shows pill in the
>    `b-guest-zoom` frames.
>
> The buttons section there has the exact CSS. `proto.diff` carries the new
> order and placeholder. The frames in `frames/` are from before the study.

**2026-09-25, late (Portola Friday night).** A quick round on top of v92, which
is built but not shipped. It answers Kevin's notes on v92 ("How it works" should
say More info, the buttons don't line up, being slid into picking feels meh,
people will try to zoom rather than pick, footer shelves?) and his wider
follow-up: on a phone a tap opens the card for everyone, and you pick inside it
with − and + on either side of the notes button.

Every frame is the **production app**: a scratch copy of the v92 worktree with
this round's prototype applied (`proto.diff`), run in real Chromium with touch
at 2x. It uses made-up crews, answers `/api` from memory and never reaches
production or a database. Frames live in `frames/` and the contact sheets are
`sheet-1-guest.png`, `sheet-2-shelf.png` and `sheet-3-member.png`. All images
are git-ignored, so they exist only on this Mac.

## Recommendation

1. **Ship in v92** the fixed welcome card, a guest's tap opening the card with
   Pick shows inside it, and the join shelf. On top of v92 that is S plus M, it
   reuses today's join logic unchanged, and it covers every guest-path note.
2. **Build the change for everyone on a phone** (a tap opens the card; − notes +
   picks inside it) **after Portola, before ACL**. It is L, it rewrites the
   zoom's touch routing (the most fragile code in the app), and it changes
   "a tap picks" for friends who learned that on Thursday.

## 1. The welcome card, fixed (A)

Frames: `a-welcome-390.png`, `a-welcome-320.png`

1. **Two doors of the same width.** Look around is on the left, as an outline
   (the quiet way). Pick shows is on the right, filled (the tonal button, the
   way to pick). The row is identical at 320 and 390, so nothing wraps.
   Measured at 390: 27–191 and 199–363. At 320: 27–156 and 164–293. Both are
   44px tall.
2. **More info is the last two words of the explanation**, drawn as a link:
   "…the more of us want to go. **More info**". It is a real button, and the
   area around it takes the tap, so its target stays 44px. Why not a third
   button: at 320 three buttons can't sit on one line with these words, and
   the wrap was the misalignment Kevin saw. The card is also 40px shorter at
   320 than in v92.
3. **The words are Kevin's:** Look around · Pick shows · More info. More info
   opens the same page How it works did.
4. A guest's tap on the wall now takes the welcome card down. Touching the wall
   means they're engaged, so its words have done their job.

## 2. A tap looks; you pick inside the card (B, H)

Frames: `b-guest-zoom-*.png`, `h-member-zoom-{0,1,must}-{390,320}.png`,
`h-member-closed-must-*.png`

1. **On a phone, a tap on a card opens its zoom, for everyone.** A mouse click
   still picks, and desktop is unchanged. The deciding question is which kind
   of pointer made the last press, not how wide the screen is, so an iPad with
   a mouse behaves like a desktop. The prototype adds `tapOpensZoom()` to
   card-facts.js, beside the zoom's existing record of the last input.
2. **A member's row is − notes +.**
   a. The three buttons sit together as one control, with the circles next to
      the notes button.
   b. Each side is a whole third of the row and 56px tall, running out to the
      card's edge. Measured at 390: − covers 8–123, notes 123–188, + 188–303.
      Across the full width there is no gap that ignores a tap. Taps above or
      below the notes button also count as notes.
   c. + is the filled white circle (the way up) and − is an outline. They read
      on any colour wash.
3. **Levels.** Each + goes up one step: 0 → 1 → 2 → 3 → must. Each − goes back
   down to not picked. It never loops: today's tap cycle goes from must back to
   0, and that loop is gone on phones. At 0 the − dims; at must the + dims.
4. **How a level change reads** (all existing refresh motion, nothing new):
   a. Your "You" pill slides into the row of who's going at your level, and
      its neighbours make room. After the first +, it sits at the end with one
      bar. At must it moves to the front: "MUST You · Maya".
   b. The zoom's colour wash re-mixes to include your colour. It is the same
      blend the card behind uses (the must frame turns warm).
   c. When the zoom closes, the resting card's corner meter shows your level
      (frame `h-member-closed-must`: MUST, bottom left).
5. **A guest has the same row with Pick shows** (a white pill) next to + note,
   in the place where − and + would be. Pick shows opens the join shelf,
   naming the artist. A tap on the card's body does nothing on a phone zoom,
   so reading never records a pick by accident.
6. **Closing.**
   a. Tap outside the card.
   b. Scroll or swipe the wall (this already closes it today).
   c. Escape on a keyboard.
   d. New rule, found in the frames: on a dense wall, "outside" is almost
      always another card. The first render's close-tap opened Airwolf
      Paradise's zoom instead of closing. So a finger's close-tap that lands
      on a card is used up: it only closes. A drag that turns into a scroll
      sends no click, so nothing is swallowed.
7. **The long-press is no longer needed on touch.** I recommend removing it,
   so a phone has one way into the zoom. That also deletes the hold's
   "wait for the lift before listening" block, the most delicate code in the
   zoom. Keep `-webkit-touch-callout: none` so a hold never raises the iPhone's
   own menu. A hold then release should act like a tap; confirm that on a real
   iPhone.
8. **The cost of two taps.** A plain pick goes from 1 tap to 2, and a must from
   4 taps to 5. Worse is changing it mid-festival for 6+ friends who learned
   "tap lights it" on Thursday and Friday. Their first tap after the update
   opens a card they expected to light up. That is a surprise, not damage,
   because looking writes nothing. It is still the costliest change at the
   worst moment. Hence the default in question 1: ship after Portola, and
   give the one release that changes it a one-time line: "A tap opens the
   card now — pick with + inside."
9. **Until then (v92 as recommended), guests and members differ.** A guest's
   tap looks and a member's tap picks. A friend who joins switches from one
   to the other. The welcome card they get after joining already says "Tap
   any artist to add yours."

## 3. The join shelf (C, D, E, F, G)

Frames: `c-shelf-new-{390,320}.png`, `d-shelf-returning-390.png`,
`e-shelf-keyboard-390.png`, `f-shelf-12-long-320.png`,
`f2-shelf-12-keyboard-320.png`, `g-shelf-offline-pickshows-390.png`

1. **It is the production bottom sheet** (the notes sheet's family): the grab
   handle, 20px top corners, the dock's dark ground, and the wall dimmed at .45
   behind it. It is sized to its content. The wall underneath never moves:
   scrollY was measured the same before and with the shelf (2820 → 2820 at
   390), so a join lands the pick on a card you can still see.
2. **Top to bottom, one column on one 16px margin:**
   a. "Pick **Tove Lo** as…" (from the welcome card's Pick shows:
      "Pick shows as…").
   b. "Tap your name, or add yourself."
   c. The crew's names, using the wall's own person chips a size up, each in
      the person's colour.
   d. A text field with the placeholder "New here? Your name".
   e. The same two halves the welcome card ends on: Look around, then the
      answer.
3. **The answer button tells you what will happen:**
   a. Nothing chosen: "Join", dimmed.
   b. A name tapped: "I'm Maya". The chosen chip gets a white ring and the
      others fade.
   c. A new name typed: "Join as Sam".
   d. An existing name typed (any capitalisation): that chip lights up and the
      button says "I'm Maya". That is the returning-member-on-a-new-phone path
      when they type instead of tap.
4. **Claiming a name takes two steps: tap the name, then "I'm Maya".** v92's
   original problem was friends tapping somebody's name and picking as them.
   One tap to claim is how that happened.
5. **The keyboard** (frames E and F2; the keyboard is drawn in, because
   Chromium has none):
   a. The names fold into one sideways line with a fade at the edge, the same
      height for 6 or 12 people. The field and both buttons stay above the
      keys.
   b. The shelf rides on top of the keyboard. In the build, a
      `visualViewport` listener sets its bottom edge.
   c. Measured at 390 with a 336px keyboard: the field sits at 388–434 and the
      wall still shows above. At 320 with a 260px keyboard: the shelf spans
      21–308 and the field 188–234.
6. **Personal links (`&me=`) keep today's full-screen join.** That screen names
   who the link is for, and it is a different moment.
7. **Motion:**
   a. The wall dims as the shelf rises from the bottom edge on the arrival
      curve (240ms with its small overshoot). The line lands, the names arrive
      one after another left to right, then the field and the buttons.
   b. Look around, a tap on the dimmed wall, or dragging the handle down: the
      shelf drops quickly and plainly (130ms) and the dimming lifts.
   c. On join: the shelf drops, the dock's dashed + grows into your initial
      (v92's existing motion), and the card you tapped lights with your first
      pick.
   d. From the zoom: the zoom shrinks back into its card as the shelf rises.
   e. With Reduce Motion or Low Power, all of it is instant.

## 4. Edge cases designed

1. **A crew of 12:** names wrap to 3½ rows, with the half row showing there
   are more, and scroll inside the shelf (frame F).
2. **A long artist name:** "Pick Ranger Trucco b2b Alisha as…" wraps to two
   balanced lines (frame F). A long typed name truncates with "…" inside
   "Join as …", since names are capped at 24 characters.
3. **A small phone (320×568):** the welcome card, the shelf, the stepper and
   the keyboard state all fit (frames A, C, F, F2, H at 320).
4. **Offline (frame G):** the line reads "You're offline — join anyway, it
   sends when you're back." with the grey offline dot. Joining still works on
   the phone, and the waiting pick is kept (v92's offline branch, unchanged).
   Existing behaviour: if someone else took the same name meanwhile, the
   server's one-name rule refuses the join when it syncs and the dot goes red.
5. **Desktop guest:** a click opens the same shelf, drawn as the centred
   dialog `.sheet` already becomes at 720px and wider.

## 5. What it costs on top of v92

1. **Welcome card fix: XS.** It changes the words table, the button row and
   one CSS block. Done when both halves line up at 320 and 390, More info
   opens the page, and the welcome tests are updated.
2. **Guest tap opens the card, with Pick shows: S.** It adds the guest branch
   in `handleTap`, the Pick shows button in the zoom, and `occ` passed through
   from the wall.js click. Done when a guest's tap opens the zoom, Pick shows
   opens the shelf, and the zoom never writes anything. Rewrite the guest
   tests in `first-open-guest` to match.
3. **Join shelf: M.** Move renderJoin's answer code (claim, join, the offline
   branch, one answer at a time, the waiting pick) into one function that both
   the screen and the shelf call. Move it; don't rewrite it. Also:
   a. the sheet itself;
   b. the keyboard listener;
   c. drag-to-close;
   d. a history entry, so system Back closes the shelf (v92 noted Back on the
      join screen leaves the app);
   e. marking the page busy while a typed name is in the field, so a new
      build's reload waits.
   Done when every v92 join test passes through the shelf, plus a real-touch
   walk at 390 and 320.
4. **Tap opens the card for everyone, with − notes +: L**, one focused session
   with review. It touches the zoom's touch code:
   a. a new "tap" way into the zoom, active at once (the hold's version waits
      for the finger to lift; reusing it would drop the first tap on + onto
      the card underneath);
   b. the card body stops picking on phone zooms;
   c. the rule for links that just slid under your finger is off for phone
      zooms;
   d. the close-tap is used up on cards;
   e. the long-press is removed;
   f. one fixed width for phone zooms (it shifted about 12px as the "You" pill
      arrived);
   g. the zoom's error report: "zoom-close-after-click" fired on every close
      within 1s of a − or + press in the rig, and would fill PostHog with
      false warnings.
   Tests: 11 browser test files drive touch, and 5 unit-test files (jsdom,
   long-press and touch zoom) assume a tap picks or a hold opens. Done when
   the real-browser checks cover tap → zoom → − / + at every level, the close
   rules, and an iPad with a mouse picking on click.

## 6. Questions for Kevin (each has a default)

1. **When does the everyone-on-a-phone change ship?** Default: after Portola,
   before ACL (Oct 2). v92 ships with items 1–3 of section 5 plus the guest's
   tap-to-look.
2. **Claiming a name on the shelf: tap then "I'm Maya", or one tap?** Default:
   two steps, because one tap is how friends ended up picking as someone else.
3. **With a card open, a tap on another card: only close, or jump to that
   card?** Default: only close. It is predictable, and jumping makes the zoom
   feel like it won't let go. The cost is a second tap to open the next card.

## Files (this folder)

1. `frames/` holds 19 PNGs at 2x (the `a`–`h` prefixes match the sections
   above). `sheet-1-guest.png`, `sheet-2-shelf.png` and `sheet-3-member.png`
   are the contact sheets.
2. `rig.mjs` renders every frame: `APP=<scratch copy> node rig.mjs [filter]`.
   One browser, closed at the end. `rig-report.txt` has the measurements.
3. `proto.diff` is the prototype: `join-shelf.js` (new), plus welcome.js,
   app.js, card-facts.js, wall.js and v3.css. It is against the v92 working
   tree as of 40a2a47 plus its uncommitted edits. v92 has since moved to
   1c1bf37 (review round 2), so apply it by hand. It is a design prototype,
   not the build: the shelf's buttons don't join anyone yet (that is
   renderJoin's code, to be moved), and it has no tests.
