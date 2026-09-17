# Phase 1 walk — the zoom overlay, tap-to-pick, Settings, Lost Lands (2026-08-30)

For a Sonnet walker with real pointer input (never `element.click()`), on the
preview of `notes-desktop-round` after the Phase 1 push. Previews share the
PRODUCTION database: create ONE throwaway crew named `zz-walk-<date>` and
touch nothing else; list its token and person id in the report so the lead
can delete them after you confirm you are finished.

Bank findings to `claude-plans/2026-08-30-survey/phase1-walk.md` as you go —
one line per check, PASS / FAIL / BLOCKED, with the measured value.

## Desktop (1440 × 900, a real mouse)

1. Hover a lineup card and rest for 400 ms. **Expect:** a grown card appears
   centred on the resting card (measure: the grown card's centre within 4 px
   of the resting card's centre unless it sits at a viewport edge). **Measure
   the neighbours:** the `getBoundingClientRect()` of the two cards beside it
   and the card below it, before and during the zoom — every value identical.
   The grown card lives in `#zoom-layer` (a `<body>` child), not inside the
   wall.
2. While it is grown, click its body (not the notes chip) five times, ~400 ms
   apart. **Expect:** your level cycles 1 → 2 → 3 → 4 → 0 (the You pill
   appears, gains MUST at four, disappears at the fifth) and the grown card
   stays up the whole time — no flicker, no re-grow, no reflow of neighbours.
3. Click the notes chip inside the grown card. **Expect:** the notes sheet
   opens with the card as its header; the grown card is gone; Escape closes
   the sheet only.
4. Move the mouse off the grown card. **Expect:** it shrinks back into the
   resting card within ~300 ms + 220 ms and the resting card looks exactly as
   before (opacity 1, no leftover class `zoom-source`, no leftover
   `.zoom-slot` in the layer).
5. Hover, then press Escape. **Expect:** it closes and does NOT grow back until
   the mouse leaves the card and returns.
6. Hover, then scroll the wheel one notch. **Expect:** it closes.
7. Performance: with DevTools Performance (or `PerformanceObserver` on
   `longtask`), record 10 hover-in / hover-out cycles across different cards.
   **Expect:** zero long tasks over 50 ms attributable to the zoom, and no
   layout of `.wall-grid` children during the morph (Layout events should
   touch only `#zoom-layer` nodes). Report the numbers.
8. Keyboard: Tab to a card (a focus ring shows). **Expect:** it grows. Tab
   again → focus is on the notes chip inside the grown card; Tab again → the
   next card, and the zoom is gone; Shift+Tab from the chip → back on the
   card. Enter on a grown card picks.
9. Search: type a letter in search while a card is grown. **Expect:** the zoom
   is gone and no `.zoom-slot` remains.
10. The timetable (Portola, a scheduled fest): hover a cell in a lane at the
    right edge of `.times-scroll`. **Expect:** the grown card is clamped
    inside the visible scroller, never clipped, never off-screen.

## Phone (390 × 844, real touch via CDP `Input.dispatchTouchEvent`)

11. Press and hold a card ~600 ms, lift. **Expect:** the grown card appears
    and lifting the finger does NOT pick (your level unchanged).
12. Tap the grown card three times. **Expect:** your level advances three
    times; the grown card stays.
13. Tap outside it. **Expect:** it closes. Scroll the wall with a flick while
    one is grown. **Expect:** it closes.
14. Neighbours never move during a hold-zoom (same rect measurement as 1).

## Settings

15. Open Settings. **Expect:** order is Your festivals → You → Crew.
16. In You, rename yourself to a case-variant of an existing member's name
    (e.g. `drew` when `Drew` exists). **Expect:** refused with a message; no
    toast of success.
17. The How-it-works page and the wall's coach mark both say "4 taps = MUST.
    Hold for a closer look." — no "MUST SEE", no "Hold for notes".

## Lost Lands

18. Open the Lost Lands board. **Expect:** the day rules read as weekdays
    (WEDNESDAY / THURSDAY with "Early Arrival Pre-Party" in the sub line, not
    shouted in the header); the day tabs read WED / THU / FRI / SAT / SUN.
    The date line on the pick-fests screen and in Settings is short.
19. Open a pre-party day's notes sheet. **Expect:** the title is the weekday,
    the sub line carries the date and the aside.

## Console
20. Zero app errors in the console across the whole walk (third-party noise
    excluded — say what it was).
