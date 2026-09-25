# The zoom and the chrome — build log (2026-09-24, v87)

Where a grown card stands relative to the app's fixed and sticky chrome, and
what may grow one. Three changes on `fix/zoom-dock`, all in
`js/v3/card-facts.js`; the contracts are `tests/zoom-geometry.test.mjs`
(jsdom), `tests/browser/zoom-chrome-contract.test.mjs` and
`tests/browser/zoom-still-hand.test.mjs` (real engines).

## 1. The dock is a floor

Kevin, on a narrow desktop window under a mouse: "can we keep this from
happening easily — where the cards don't cover the footer? nbd, not worth
hurting our carefully crafted cards". Under 720px the dock is fixed at the
bottom and the zoom layer (z 36) sits over it (z 30), so a card grown near
the bottom hung across the day tabs. `place()` now reads the dock's real box
(`dockTop()`) and moves a zoom that would come within 8px of it UP — never
shrinks or reshapes it. The bloom still grows from the card's own centre:
`originFor` takes the moved box, as it always did at the side edges.

## 2. Content sliding under a still mouse is not the hand arriving

The v87 review: click NOW, the page glides, and whatever card slid under the
resting pointer grew over the rail — the next click on NOW picked it (Skepta,
cancelled). The engines report such a card with boundary events at the
pointer's own pixel (Chromium before it reports the scroll; WebKit with a
pointermove at that pixel). The rule (`handCard`): an entry at the pixel the
mouse last MOVED to grows only the card the hand was already on; any other
card waits for a real move.

## 3. The sticky chrome is a ceiling (Kevin, on v87)

Kevin asked for the dock's floor "for the sticky headers too": at 430 a card
near the top grew over the pinned stage strip, and on a desktop over the day
rail and strip (the v87 review's finding 1, option b). This retires the old
law "the top never moves it — a card by the day rail grows where it is"; the
design stated that law to protect the bloom's "grows from its own centre"
illusion, and the true transform-origin already protects it, as at the side
edges.

**The ceiling** (`chromeCeiling(card)`) is the lowest bottom edge ON SCREEN
of the desktop day rail (`#day-rail`, ≥720, sticky at 0) and the card's OWN
timetable's stage strip (`.tt-block > .stage-strip`, sticky under the rail),
pinned or still at its natural spot over the grid — read from real boxes,
never from `--rail-h`. Another timetable's strip is never this card's
ceiling. A stack card (the afters) has only the rail on a desktop and
nothing at all on a phone: no ceiling is invented there, and the screen's
own top edge still moves nothing.

**The rule**: centre on the card; if a dock shows and the zoom would come
within 8px of it, move it up; if the chrome above would be within 8px, move
it down — the ceiling applied LAST.

### (a) Taller than the band between ceiling and floor: the ceiling wins

Three options were on the table: leave it where the arithmetic put it (the
dock rule's answer when there is no ceiling), let the dock win, or let the
ceiling win. The ceiling wins, for two reasons:

1. **It is one continuous rule**, `top = max(min(centred, dock − 8 − h),
   ceiling + 8)`. "Leave it where it was when it does not fit" is a step: a
   zoom kept open while the page scrolls (follow) sees the ceiling move as
   the strip rides up to its pin, so a zoom near the threshold would jump
   between "clamped" and "centred" mid-scroll. A max-of-min never jumps.
2. **It looks right** (walked at 667×240, a landscape phone with its
   browser bars, a crew of fifteen on Robyn: the zoom 169 tall, the band
   143): the zoom sits 8px under the stage names with its own name at the
   top, and its bottom hangs 18px over the top of the dock. The dock is the
   thing to give way — it is navigation you use after closing the zoom, and
   the zoom draws over it — while the stage names are the context for the
   column the card lives in, which is exactly what Kevin asked to keep
   readable. The dock rule already made the dock the one that gives way.

With no ceiling (a stack card on a phone), the dock rule is unchanged: a zoom
too tall for the whole space above the dock stays where the arithmetic put it.

### (b) follow(): glides, holds, then closes when its card is gone under the chrome

`follow()` re-places the zoom once per frame while the page scrolls. Traced
frame by frame at 430 in Chromium with a wheel (the zoom on Robyn, 70px
under the pinned strip): the zoom followed its card a frame behind (the
existing rAF throttle), reached 44 (the strip's 36 + 8) and held that exact
pixel for every later frame — no jitter, never flipping back. The card went
on sliding under the strip, and before this change the zoom then stood
alone below the strip over a card nobody could see, until the card left the
screen entirely. Now a card that has gone ENTIRELY under the sticky chrome
(its bottom at or above the ceiling) — or entirely under the dock — closes
its zoom, exactly as if it had left the screen: to the eye it has. A card
still partly showing keeps its zoom. (WebKit scrolls a focused card out from
under a sticky header by itself a moment after focus — seen at 430 in the
gallery; the zoom follows.)

### (c) A card tucked under the pinned strip: the first bloom frame

The zoom clears the strip and grows from the card's TRUE centre (which may
sit just under the strip's edge). Frame by frame at 430 (Chromium, the card's
top 34px under the strip): at t=0 the scaled box starts right under the
strip, a little lower than the card's hidden top, and grows down and out to
its place; the resting card's own name, cut by the strip's edge, shows above
the box for the first two frames while its content steps back (the same
~90ms fade every bloom has — in an ordinary bloom the box covers the name,
here the strip half-covers it). By 90ms it is gone. It reads as the card
growing out from under the strip, not as a jump; an ordinary bloom shows the
same kind of peek for those frames — the resting card's edges beside the
box, which starts at 70% of the zoom's width, narrower than the card.

## The still-hand walk under load (2026-09-24) — a real trap, closed by the ceiling

The NOW builder measured "NOW glides the wall under a still mouse" failing
under parallel load (six copies at once): 7 of 24 on its build before its
last round, 9 of 24 after — a Skepta zoom opened and the second click on NOW
picked Skepta. It passed alone and in CI. The question was whether a slow
machine hits a real race.

1. **CPU throttling of the page does not reproduce it** (Chromium's
   `Emulation.setCPUThrottlingRate` at 6x, 4 runs: 0 failures). The slowness
   that matters is not the page's but the hand's.
2. **A slow hand does, every time.** The test moves the mouse from the wall
   up to NOW in six steps. Loaded, those steps come slower, and the pass
   dwells on the card under the pointer longer than the hover intent — so
   that card's zoom rightly grows (the timeline shows the real
   `pointermove`s at new pixels that arm it; nothing in the still-hand rule
   misfired). Before the ceiling, that zoom grew UP over the rail and covered
   NOW, and the click aimed at NOW landed on the zoom: a pick of Skepta, a
   cancelled act. Six steps 70ms apart, no load: **3 of 3 fail on the build
   before the ceiling (`a95e782`), 0 of 3 on this branch**. A person moving
   a mouse unhurriedly from a card to NOW does exactly this.
3. **The ceiling closes it at the root**: a zoom never covers the rail or the
   stage strip now, so the click reaches NOW, the zoom closes on the hand
   leaving it, and nothing is picked. Six copies at once, 4 rounds: **5 of
   24 fail on `a95e782`, 2 of 24 on this branch before the test fix** (both
   "not vacuous: after the glide the still pointer is over a card" — the
   test checked 1500ms after the click, and a loaded glide was still moving),
   **0 of 24 after it**; the whole file six at once, twice: 12 of 12.
4. **The test now waits on state**: the glide has ended when scrollY holds
   for ten frames; a negative ("nothing grew") gets the hover intent's
   window from there; a standing zoom is waited out (`zoomGone`) rather than
   slept past. And the slow hand is its own case — the pass grows the card,
   the zoom never covers the rail, the click lands on NOW — red on
   `a95e782` ("a standing zoom never covers the rail: top 6, rail bottom
   45"), green here, in Chromium and WebKit.

Two other load flakes turned up while running the whole suite with other
sessions loading this Mac (load average 40–100 on 12 cores) and were fixed
the same way: the cold-open loader's "after a beat" is now the fade's own
recorded delay, not the wall clock (`shell-contract`), and the meter's tap
walk reads what each tap started, recorded as it starts, instead of
sampling what still runs after a fixed 400ms (`meter-contract`).

## Walked

Chromium and WebKit; mouse, a real touch hold (Chromium; WebKit via
synthetic pointer events in the walk only), the keyboard (a key, then
focus); 390, 430 and 1280; a Saturday grid card under the strip (half under,
just below), a Sunday-afters stack card near the top. Every case clears
ceiling + 8 exactly (36 + 8 on a phone; rail + strip 81 + 8 on a desktop;
the rail alone 45 + 8 for a desktop stack card), a phone stack card stays
centred, and every bloom origin is the card's centre. `gallery.html`'s
events wall has a button for the state ("Zoom a card tucked under the
strip").

## Tests

- jsdom (`zoom-geometry`): moved down exactly to ceiling + 8 for a strip,
  for rail + strip, and nothing for a strip still clear above; no ceiling
  for a stack card on a phone, another timetable's strip ignored, the rail
  alone for a stack on a desktop; too tall — the ceiling wins over the dock
  (sized past the whole space above the dock, where the old guard would have
  left it centred); follow holds at the ceiling and closes once the card is
  entirely under it. Each fails without its change (no ceiling: 4 red; the
  dock's old guard with a ceiling: 1; no close under the chrome: 1).
- Browser (`zoom-chrome-contract`, was `zoom-dock-contract`): dock and
  ceiling for the mouse, a touch hold and the keyboard in Chromium, the mouse
  and keyboard in WebKit, at 430×760 and 1280×800; no ceiling invented for a
  stack card; nothing else moves; the follow trace (monotonic, holds at
  ceiling + 8, closes). Without the ceiling 12 of 18 go red; without the
  close, the follow case.
