# Button study: the zoom's row, and one family for tonight's buttons

**2026-09-25, late.** Kevin on the zoom's − · note · + (another designer drew it
as a round − circle, a square-cornered "+ note" pill and a ringed + circle,
`../../ours-r2/frames/Z-390.png`): "The buttons still need some love." Earlier
he had asked for "just a semi-transparent ghost button" with forgiving tap
areas, and said the welcome card's buttons didn't line up.

Every frame here is the production app: the scratch copy of v92 plus the
guest-shelf prototype, with `variants.css` added on top. It was rendered in
real Chromium with touch at 2x, using twelve made-up friends. Nothing reached
production or a database.

## The four variants (`sheet-variants.png`: rows are variants, columns are cards)

The four cards are a pale wash (Nimino: amber, yellow-green and sky at full
level), a dark wash (Tricky: deep hues at level 1), the busy card (Femme Jatale
b2b erika with twelve people, a run line and both doors) and an unpicked card
(Airwolf Paradise).

1. **A · one segmented stepper `[ − | + note | + ]`.** One pill, three equal
   thirds, hairline dividers between them. It is a single object on every
   wash: the dark see-through fill carries white type on the pale wash, and
   the hairline outlines it on the dark and unpicked cards. **Winner.**
2. **B · three equal ghost pills.** It works, but it reads as three buttons
   rather than one control. The 6px gaps look like dead space (the reach
   covers them, but the eye doesn't know that), and on narrow zooms the row
   gets busy.
3. **C · bare − and +, with only the note as a pill.** It's airy, but bare
   white glyphs go faint on the pale wash, the resting − (at 0) almost
   disappears, and nothing tells you the glyphs are tappable.
4. **D · A with words** ("− Unpick | + note | + More", with the + label
   changing to Pick, More or Must). The words help once, but on the
   narrow zooms (half-width cards) "Unpick" runs into "+ note". The label also
   changes under your finger as you tap, which fights the "nothing moves under
   the hand" rule.

## Why A

1. **It's one shape.** The mismatch Kevin saw (circle, square-cornered pill,
   ringed circle) can't happen because there is only one container.
2. **The tap areas are honest.** Each third is visibly its own door, and the
   hairlines show exactly where one ends and the next begins. The reach runs
   out to the card's edges and down to its bottom, so the whole row is three
   doors with no gaps.
3. **It's semi-transparent, as Kevin asked.** The fill is the page colour at
   .34 with a light blur, so the wash shows through but the type never fights
   it.
4. **A guest's row is the same pill, split 1:2:** `+ note | Pick shows`, with
   Pick shows filled white as the one strong action on a wash.
5. **Measured:**
   a. 390, busy card: − 23–133, notes 133–243, + 243–353.
   b. 320: − 23–114, notes 114–206, + 206–297.
   c. 1280 tablet: − 389–499, notes 499–609, + 609–719.
   d. The pill is 44px tall at every size.
   e. Guest row at 390: + note 181–243, Pick shows 243–367.

Frames:
1. `sheet-winner.png` (390, 320, a 1280 touch tablet)
2. `sheet-winner-states.png` (the four washes, pressed +, keyboard focus on −)
3. `frames/W-A-*.png`

## One button family (`sheet-family.png`)

**Every button tonight is the same object:** a pill (`--r-pill`), 44px tall,
a 1px line, Inter 700. Only the fill changes, and it changes with the ground
the button sits on:

| Ground | Role | Fill | Line | Type |
|---|---|---|---|---|
| App dark (welcome card, shelf) | primary | `--tonal-fill` | `rgba(var(--brand), .35)` | `--tonal-text` |
| App dark | secondary | none | `--border-input` | `--text-secondary` |
| A card's wash (zoom row) | the row | page at .34 + blur 8px | white at .34, dividers white at .22 | white |
| A card's wash | a guest's Pick shows | white at .92 | none | `--page` |

**Order is primary on the left** (Kevin): Pick shows | Look around on the
welcome card, Join as Sam | Look around on the shelf. Both are two equal
halves. Measured: welcome 27–191 | 199–363, shelf 16–191 | 199–374, all 44px.
The shelf's field says "Add your name" and is 44px, keeping its 8px text-field
corners (Kevin, 2026-09-25: text fields are not pills).

## The CSS, ready to apply

About the values: white-at-an-alpha and page-at-an-alpha are the same family
the wall's `.mark.ghost` already uses (`rgba(12, 10, 20, .55)`,
`rgba(255, 255, 255, .55)`); 12, 10, 20 is `--page`. Everything else is a
token. The selectors below outrank the phone rule `.zoom-card .f-chip`
(30px chips with a 7px reach) by specificity, so no `!important` is needed
except on focus, where the tokens' ring is itself `!important`.

```css
/* ---- the zoom's row on a finger's zoom: one segmented pill ------------------ */
.zoom-card .f-grown:has(.f-step-row, .f-guest-row) { align-self: stretch; }
.zoom-card .f-chips.f-step-row,
.zoom-card .f-chips.f-guest-row {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0;
  align-self: stretch; margin: 4px 0 0; height: 44px; box-sizing: border-box;
  background: rgba(12, 10, 20, .34);              /* --page at .34 */
  border: 1px solid rgba(255, 255, 255, .34);
  border-radius: var(--r-pill);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.zoom-card .f-chips.f-guest-row { grid-template-columns: 1fr 2fr; }
.zoom-card .f-chips.f-step-row > button,
.zoom-card .f-chips.f-guest-row > button {
  position: relative; box-sizing: border-box; height: 100%; min-height: 0; margin: 0; padding: 0;
  display: flex; align-items: center; justify-content: center;
  background: none; border: 0; border-radius: 0;
  color: var(--text-primary); font: 700 13px/1 var(--font-ui); letter-spacing: 0; cursor: pointer;
  -webkit-tap-highlight-color: transparent; transition: background-color 80ms ease;
}
.zoom-card .f-chips > .f-step.minus,
.zoom-card .f-chips.f-guest-row > .f-chip.notes { border-radius: var(--r-pill) 0 0 var(--r-pill); }
.zoom-card .f-chips > .f-step.plus,
.zoom-card .f-chips.f-guest-row > .f-pick   { border-radius: 0 var(--r-pill) var(--r-pill) 0; }
.zoom-card .f-chips.f-step-row > .f-chip.notes  { border-inline: 1px solid rgba(255, 255, 255, .22); }
.zoom-card .f-chips.f-guest-row > .f-chip.notes { border-right: 1px solid rgba(255, 255, 255, .22); }
.zoom-card .f-step-dot { font-size: 22px; font-weight: 500; line-height: 1; }  /* the − and + glyphs */
.zoom-card .f-step:disabled { cursor: default; }
.zoom-card .f-step:disabled .f-step-dot { opacity: .32; }                    /* − at 0, + at must */
.zoom-card .f-chips.f-guest-row > .f-pick { background: rgba(255, 255, 255, .92); color: var(--page); font-weight: 800; }

/* pressed: the third lights, nothing moves */
.zoom-card .f-chips.f-step-row > button:active:not(:disabled),
.zoom-card .f-chips.f-guest-row > .f-chip.notes:active { background: rgba(255, 255, 255, .16); }
.zoom-card .f-chips.f-guest-row > .f-pick:active { background: rgba(255, 255, 255, .78); }

/* keyboard focus: WHITE, inside the third. The app's ring is --brand violet
 * and vanishes on a violet wash; in the zoom the wash is the ground. */
.zoom-card .f-chips.f-step-row > button:focus-visible,
.zoom-card .f-chips.f-guest-row > button:focus-visible { outline: 2px solid var(--text-primary) !important; outline-offset: -4px; }

/* reach: out to the card's edges (zoom padding 12px 14px) and down to its bottom */
.zoom-card .f-step.minus::after,
.zoom-card .f-chips.f-guest-row > .f-chip.notes::after { content: ''; position: absolute; inset: -6px 0 -12px -14px; }
.zoom-card .f-step.plus::after,
.zoom-card .f-chips.f-guest-row > .f-pick::after       { content: ''; position: absolute; inset: -6px -14px -12px 0; }
.zoom-card .f-chips.f-step-row > .f-chip.notes::after  { content: ''; position: absolute; inset: -6px 0 -12px; }

/* ---- the family on the app's dark ground (welcome card, join shelf) --------- */
.welcome-card .bring-actions,
.join-shelf .js-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } /* primary first = left */
.welcome-card .bring-actions > button,
.join-shelf .js-actions > button {
  box-sizing: border-box; height: 44px; min-height: 44px; padding: 0 16px; border-radius: var(--r-pill);
  font: 700 13.5px/1 var(--font-ui); letter-spacing: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background-color 80ms ease;
}
.welcome-card .bring-actions > .btn-tonal,
.join-shelf .js-actions > .btn-tonal { border: 1px solid rgba(var(--brand), .35); }        /* fill + type: .btn-tonal */
.welcome-card .bring-actions > .btn-ghost,
.join-shelf .js-actions > .btn-ghost { border: 1px solid var(--border-input); color: var(--text-secondary); }
.welcome-card .bring-actions > .btn-tonal:active,
.join-shelf .js-actions > .btn-tonal:not(:disabled):active { background: rgba(var(--brand), .24); }
.welcome-card .bring-actions > .btn-ghost:active,
.join-shelf .js-actions > .btn-ghost:active { background: rgba(255, 255, 255, .06); color: var(--text-body); }
.join-shelf .js-go:disabled { opacity: .5; cursor: default; }
.join-shelf .js-field { height: 44px; border-radius: var(--r-card); }   /* a text field keeps its 8px corners */
/* focus on the dark ground: the app's own ring (v3-tokens.css :focus-visible), unchanged */
```

## States

1. **Pressed:** the third you're touching lights to white at .16 (the guest's
   white Pick shows dims to .78). There is no scale and no movement, since the
   finger is still on it and anything that moves under the hand misleads
   (`frames/W-A-pressed-plus.png`). On the dark ground, the tonal button
   deepens to brand at .24 and the clear one takes a white .06 wash.
2. **Focus (keyboard):**
   a. In the zoom: a 2px white ring inside the third, following its rounded
      ends (`frames/W-A-focus-minus.png`).
   b. On the dark ground: the app's violet ring, unchanged.
3. **Resting:** − at 0 and + at must drop their glyph to .32. The third stays
   in place and outlined, so the row never changes shape.
4. **Guest:** `+ note | Pick shows`, the same pill split 1:2.

## Notes for the builder

1. The notes door is plain words in the row ("+ note", "2 notes"). A small
   violet bubble mark was tried and read as a stray dot beside the "+", so it
   was dropped.
2. At 1280 the frame is a **touch** tablet. A desktop mouse still picks on
   click and its hover zoom keeps today's chips. Whether a mouse zoom should
   also show this row is open. It would be harmless, and consistent.
3. The study's own files, all in this folder:
   a. `variants.css`: all four variants plus the family, scoped to
      `html[data-btn]` and `html[data-family]` for rendering side by side.
   b. `rig.mjs`: `APP=<scratch copy> node rig.mjs study` renders every
      variant on the four cards; `... winner A` renders the winner and the
      family.
   c. `sheets.py`: builds the contact sheets.
   d. `rig-report-*.txt`: the measurements.
