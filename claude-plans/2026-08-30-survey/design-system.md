# Design-system survey — CSS, tokens, accent rule, dead styles, motion cost

Branch: `notes-desktop-round` (PR #13). Scope: `assets/v3.css`, `assets/v3-tokens.css`,
`index.html`, `gallery.html`, `claude-plans/v3-inventory.md`, `js/v3/aura.js`, plus
`js/v3/card-facts.js` and `js/v3/wall.js` where the CSS geometry and JS click/layout
logic are one mechanism (the zoom).

Read whole: v3.css (671 lines), v3-tokens.css (182 lines), aura.js (104 lines),
v3-inventory.md, index.html, gallery.html. Diffed `main..notes-desktop-round` on
assets/v3.css to separate what this round touched from pre-existing debt.

---

## FINDING 1 — P0 — the zoom's own click-guard swallows the taps that are supposed to cycle the pick

**Kevin's words:** "multiple taps no longer increases pick intensity."

**File/lines:** `assets/v3.css:624-626` (`.facts-grown`) + `js/v3/wall.js:212`
(the card's click handler).

**Evidence:**
```css
.facts-grown { position: absolute; left: 8px; right: 8px; top: 38px; bottom: 10px; z-index: 1;
               display: flex; flex-direction: column; gap: 7px; text-align: center; }
```
This box covers essentially the entire card body (the card is ~64-70px tall at
rest; `.facts-grown` starts 38px down and ends 10px from the bottom — only the
top ~28px strip, where `.card.zoom .name` sits, is outside it). Meanwhile:
```js
el.addEventListener('click', (e) => {
  // Belt over the chips' own stopPropagation (the research's Ant Design
  // lesson): anything inside the grown block or the corner chips is its own
  // control, never a pick.
  if (e.target !== el && e.target.closest && e.target.closest('.facts-grown, .chip-notes, .chip-spotify')) return;
  if (ctx.onZoomTap && ctx.onZoomTap(el)) return;
  ctx.onTap(artistName, el);
});
```
The guard treats the *whole* `.facts-grown` container as "its own control" and
bails before `ctx.onTap` (the pick-cycle) ever runs. But most of what lives
inside `.facts-grown` is inert display content, not a control: the `.f-sub`
time/day/stage line, the blank `.f-spring` filler, and the non-button `.f-pill`
who-avatars (only the notes/Spotify chips at the very bottom are real
`<button>`s with their own `stopPropagation`, which is what the comment is
actually worried about).

**Failure scenario:** hover a card on desktop for the 350ms intent delay (or
long-press it on touch) — it zooms, and `.facts-grown` now covers nearly the
whole card. Every further click/tap that lands anywhere in that region (i.e.
almost the entire card, since the container is centered and the guard doesn't
distinguish "on a pill" from "on the blank space between pills") is silently
dropped before it reaches the pick-cycle. Once a card is zoomed, the *only*
remaining ~28px strip that still cycles a pick is the name line. A user trying
to tap a card 1→2→3→4 (must) while it's zoomed — which is the natural thing to
do, since hovering to see facts and picking are the same gesture everywhere
else in the app — gets one pick registered and then nothing, because the zoom
grew under their cursor/finger between taps.

**Fix direction:** narrow the guard to the actual interactive descendants
(`e.target.closest('button')` inside the card, or a `data-control` marker on
just the notes/Spotify chip buttons) instead of the whole `.facts-grown`
container, so a click on the sub-line, the spring, or a who-pill falls through
to the same `ctx.onTap` a resting card would get.

---

## FINDING 2 — P0 — the zoom resizes the whole grid row, not just the one card

**Kevin's words:** "the whole row animates and resizes when only the one card
should (centered over its original spot) like it's just punching out."

**File/lines:** `assets/v3.css:509-511` (`.wall-grid`, no `align-items` and no
`grid-auto-rows` override — default is `stretch` / content-sized auto rows) vs.
`js/v3/card-facts.js:374-378` (the zoom sets `el.style.minHeight = '132px'`
directly on the grid item) vs. `js/v3/wall.js:547,715` (`.times-grid` gets an
explicit `grid.style.gridTemplateRows` set on every render — fixed row
heights).

**Evidence:**
```css
.wall-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
@media (min-width: 720px) { .wall-grid { grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 7px; } }
```
No `align-items`, no `grid-auto-rows` — CSS Grid's defaults apply: rows
auto-size to the tallest item in the row, and items `stretch` to fill that
row's height.
```js
// card-facts.js zoomCard()
el.style.width = `${target}px`;
el.style.marginLeft = `${Math.round(shift)}px`;
el.style.minHeight = '132px';   // resting card min-height is 64px (v3.css:18)
```
Setting one grid item's `min-height` to 132px on a grid with no fixed row
template grows *the whole row's track* to 132px, and every sibling in that row
stretches to match it (default `align-items: stretch`) — visibly resizing cards
that were never touched, and pushing every row below down, all in one
synchronous layout pass with no transition of its own (a hard "punch," not a
morph — the morph only animates the zoomed card's own pieces).

The set-times grid (`.times-grid`) doesn't have this problem, because
`wall.js` gives it an explicit `gridTemplateRows` (fixed 20px-per-15-min rows)
on every render — a card zooming there overflows its own fixed-height cell
(intentional, `overflow: visible` on `.card.zoom`) instead of resizing the
track. That's presumably why this reads as fine on a scheduled fest's timetable
but breaks on a lineup-only wall (unscheduled fests, F4) or the flat/searched
grid, where `.wall-grid` is what's actually rendering the cards.

**Fix direction:** keep the zoomed card out of the row's height calculation —
either give `.wall-grid` a `grid-auto-rows` floor matched to the resting card
height plus `align-items: start` (so growth doesn't stretch neighbors and
doesn't inflate the track), or take the zoomed card out of grid flow entirely
(the grid keeps a same-size placeholder cell; the visible grown card is an
absolutely-positioned overlay anchored to that cell's rect, the way the
existing `sheet-card` already floats free of any grid). The second option also
sidesteps the marginLeft/width juggling `zoomCard` currently does to clamp
against the scrollport.

---

## FINDING 3 — P1 — Low Power is documented to silence the zoom's motion but the code never checks it

**File/lines:** `js/v3/card-facts.js:132` (comment) vs. `card-facts.js:194-195`
(`canAnimate`) vs. `js/v3/wall.js:108` (the correct pattern, for contrast).

**Evidence:**
```js
// card-facts.js:131-132
// The sheet header: the grown card once more, larger, breathing only when the
// card would (.animated — reduced-motion and low-power still win globally).
...
const canAnimate = (el) => typeof el.animate === 'function'
  && !(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
```
`canAnimate` — the single gate every zoom/unzoom/hop animation in this file
checks before calling `.animate()` — tests only `prefers-reduced-motion`. It
never looks at `ctx.lowPower` or `document.body.classList.contains('low-power')`,
even though `zoomCard(el, artistName, ctx, ...)` already receives `ctx` (which
carries `lowPower`) as its third argument. Compare `wall.js:108`, which *does*
gate the resting card's CSS `gradShift` animation correctly:
```js
if (animated && !ctx.lowPower) { el.classList.add('animated'); ... }
```
Low Power is documented in `v3-tokens.css:180` as the thing that "kills
motion" app-wide (`.low-power * { animation: none !important; transition: none
!important; }`) — but that selector only ever matches CSS `animation`/
`transition` properties. The zoom's grow/shrink/hop sequence runs entirely
through the Web Animations API (`el.animate(...)`), which that CSS rule cannot
touch, and `canAnimate()` is the only other place motion could be turned off —
and it doesn't check Low Power.

**Failure scenario:** a person on an older phone (exactly who reaches for Low
Power) turns it on expecting "no animation," then hovers or long-presses a
card — it still runs the full 350ms clip-path reveal, the per-piece FLIP hops,
and (on close) the 260-300ms shrink-and-fade, unabated. The comment right above
`canAnimate` claims the opposite of what the code does.

**Fix direction:** thread `ctx.lowPower` (or read `document.body.classList
.contains('low-power')`, matching how `wall.js` checks it) into `canAnimate`,
or into every call site, so Low Power short-circuits to the same instant-apply
path reduced-motion already uses (`if (instant || !canAnimate(el)) { ... return
facts; }` already exists — it just needs the right condition feeding it).

---

## FINDING 4 — P1 — the note-action row: three unrelated intents rendered as one undifferentiated button style

**Kevin's words:** "there's too many options in the top row of a comment...
figure out an elegant way to nest delete option in the UI of edit and maybe to
have replies not be a button."

**File/lines:** `js/v3/notes.js:96-179` (`mkAction`, and every action wired
through it) + `assets/v3.css:559-563` (`.n-head`, `.note-action`).

**Evidence:** every action on a note — Edit, Delete, Reply, the "N replies"
disclosure toggle, and Pin/Unpin — is built by the same `mkAction(label, cls)`
helper and gets the identical `.note-action` class:
```js
const mkAction = (label, cls = '') => {
  const b = document.createElement('button');
  b.className = 'note-action' + (cls ? ` ${cls}` : '');
  b.textContent = label;
  return b;
};
```
```css
.note-action { background: none; border: none; padding: 0; cursor: pointer;
               color: var(--text-tertiary); font-size: 10px; font-weight: 700;
               text-decoration: underline; text-underline-offset: 2px; }
```
On your own root note that has replies, the head line can render up to five of
these in a row (`Edit`, `Delete`, `Reply`, `N replies`, `Pin`/`Unpin`), each
separated by a literal `·` character (`dot()`), all the same size, weight, and
color, all in one `flex-wrap` line next to the timestamp. Nothing in the CSS
(or the markup) distinguishes:
- a **destructive, irreversible** action (Delete — which does have a
  two-tap "Sure?" arm baked into the JS, but no visual difference from Reply),
- a **compose** action (Reply — opens the shared composer), and
- a **disclosure toggle**, not an action at all (the "N replies" button, which
  only ever expands what's already there — literally Kevin's "have replies not
  be a button" complaint, confirmed: it's built by the exact same `mkAction`
  and carries the exact same underline-link look as a real command).

**Fix direction (design call, not a one-line patch):** give the row real
hierarchy instead of five co-equal underlined links — e.g. Reply stays the one
visible primary action in the head line; Edit/Delete collapse behind a single
affordance on your own notes (a small kebab, or Edit's own inline state
surfacing "Delete" as a sub-option once you're already editing — Kevin's own
suggested direction); the reply-count becomes a plain disclosure marker (a
chevron + count, no underline, `aria-expanded` on the row) rather than a
`.note-action`.

---

## FINDING 5 — P2 — dead class: `.n-note.pinned` has zero CSS

**File/lines:** `js/v3/notes.js:82,84` vs. `assets/v3.css` (no rule).

**Evidence:** `notes.js` adds a `pinned` class to the note row —
`row.className = 'n-note' + (opts.reply ? ' n-reply' : '') + (opts.pinned ? ' pinned' : '')`
— but grepping `assets/v3.css` for `pinned` turns up only two unrelated prose
comments (about a UI pattern and about the timetable), never a
`.n-note.pinned` (or bare `.pinned`) selector. The actual "pinned = a stronger
wash" effect the design calls for is delivered entirely through the inline
`--wash` custom property one line below (`opts.pinned ? 0.46 : ...`), so the
class does nothing visually. Low-severity (nothing breaks), but it's exactly
the kind of dead hook a future pass reads, assumes is load-bearing, and either
leaves alone forever or "fixes" by writing a second, conflicting rule.

**Fix direction:** drop the class (the inline `--wash` already carries the
whole effect), or, if a future visual treatment wants a real `.pinned` rule
(a border, an icon), give it one now while the two are still next to each
other in the diff.

---

## FINDING 6 — P2 — the picked-card motion cost at rest scales with pick count, and Low Power doesn't touch the sticky-blur cost

**Files:** `assets/v3.css:25` (`.card.animated`), `assets/v3-tokens.css:59-60`
(`--grain`), `assets/v3.css:159` (`.card-grain`), `assets/v3.css:208,489`
(`backdrop-filter: blur(10px)` on `.day-rail` and `.stage-strip`).

**Evidence:** every *picked* card on the wall (this is pre-existing, from the
aura engine, not new to this round — flagging it because the brief specifically
asks about "100+ cards at rest") gets:
```css
.card.animated { background-size: 180% 180%; animation: gradShift 12s ease-in-out infinite; }
```
plus a `.card-grain` overlay (`mix-blend-mode: overlay`, per `v3-inventory.md`
turn 21 spec) sitting on top of that same, continuously-shifting
`background-position`. `background-position` is a paint-triggering property
(not compositor-only like `transform`/`opacity`), and `mix-blend-mode` forces
the browser to recompute the blend against whatever is under it — here, a
layer that's already repainting every frame. On a big lineup (150+ artists)
where a crew has picked most of it, that's not one or two animated gradients,
it's dozens-to-a-hundred-plus running at once, all the time the wall is open,
with no visibility-based (off-screen) pause — this is a real, measurable
battery/thermal cost on the "phone in a field with one bar" case the brief
calls out, even though the OS/network signal isn't the bottleneck here. It IS
covered by `prefers-reduced-motion` and the in-app Low Power toggle (both
correctly freeze it — confirmed via `wall.js:108`'s `!ctx.lowPower` check and
the tokens.css `.low-power` rule) — so this is a cost that exists by default,
not a violation, but it's a candidate root-cause contributor to the "too
heavy" feeling Kevin described, compounding whatever the zoom itself costs
(Findings 1–3) on top.

Separately: `.day-rail` and `.stage-strip` both carry
`backdrop-filter: blur(10px)` and are `position: sticky` — a well-known
expensive combination (the compositor has to keep re-rendering the blurred
region as content scrolls underneath a fixed element), on every scroll frame,
on every device including whatever Low Power was meant to protect. Low Power's
own definition (`v3-tokens.css:180-182`) only kills `animation`/`transition`
and hides grain — it never drops `backdrop-filter`. So a person who explicitly
told the app "I'm on a slow device" still pays the sticky-blur cost on every
scroll.

**Fix direction:** consider a visibility-gated pause for `.card.animated` (an
`IntersectionObserver` that removes/re-adds the `animated` class off-screen —
CSS alone can't do this), and/or add `backdrop-filter: none; background:
var(--dock)` (or similar solid fallback) to the `.low-power` rule for
`.day-rail`/`.stage-strip`, matching the "kills motion" promise to what
actually costs the most on a weak device.

---

## Accent audit (`--fest`) — clean, no violations found

Grepped every `var(--fest)` / `--fest` reference in `assets/v3.css`,
`assets/v3-tokens.css`, and every `js/v3/*.js` + `index.html` + `gallery.html`.
Every hit maps to one of the four documented homes:

| Where | File:line | Verdict |
|---|---|---|
| `.day-rail .day-tab.active`, `.dock .day-tab.active` | v3.css:224,383 | active day tab — OK |
| `.fest-link .fest-name`, app-header `.title`, landing/join fest-name spans, settings fest-name span | v3.css:388; index.html:31,119; app.js:1256,1338; settings.js:75 | fest name — OK |
| `.settings-card.current` | v3.css:406 | current-fest border in Settings — OK |
| `.stage-head`, `.stage-head[aria-pressed="true"]` | v3.css:472,648 | stage headers — OK |
| "How it works" teaching-card demos (a mini stage-head, a mini fest-name pill) | settings.js:371,385 | illustrating the same two real surfaces above, not a fifth place — OK |
| `document.body.style.setProperty('--fest', ...)` | app.js:181 | this *sets* the variable per-fest; not a "use" — OK |
| `gallery.html` body attr + a fest-name span | gallery.html:29,140 | dev-only style-guide page exercising the fest-name case — OK |

No new usage in this round's own files (`card-facts.js`, the new threads/zoom
CSS block in `v3.css:544-630`) reaches for `--fest` anywhere — the round kept
the rule clean; `.stage-head[aria-pressed]`'s ring and the sort-popover's
`aria-selected` color both correctly reach for `--brand` instead where the
thing being marked isn't one of the four (confirmed by the comment at
v3.css:173-174).

## Dead CSS selectors — none found

Extracted every class selector in `v3.css` (151 total) and grepped `js/v3/*`,
`js/*.js`, `index.html`, `gallery.html` for each. Five came back as apparent
misses on a bare-substring pass (`eq-loader`, `kb-active`, `sort-pop`,
`sort-wrap`, `sync-blocked`) — all five turned out to be false positives from
an incomplete first grep (they're set in `js/v3/tools.js` and
`js/v3/sort-control.js`, which weren't in my first file list) or built by
string concatenation (`'sync-' + status` in `js/sync.js:54`). Re-verified each
individually; all are live. `.note-row` / `.bubble` / `.pin-btn` (the pre-round
boxed note anatomy) were correctly removed from `v3.css` in this diff along
with their last JS consumers — good cleanup, explicitly commented
(`v3.css:227-229`).

## Desktop intentionality

The pre-existing desktop treatments (day rail replacing the dock, the
timetable going full-bleed, `wall-grid`'s `auto-fill` column density, the sheet
becoming a centered dialog) all still hold and none of them regressed in this
diff. The round's new surfaces (`.n-list`/`.n-thread`/`.n-note` threads,
`.day-whisper`, `.sheet-card`/`.facts-grown`) carry **zero** `@media` rules of
their own — but that reads as intentional, not an oversight: they all live
inside the `.sheet`, whose width is already capped (`min(560px, 92vw)`) and
centered at ≥720px by the pre-existing dialog rule, so the same narrow-column
sizing that works on a phone sheet is also the right width for a desktop
dialog. No stretched-mobile smell here.

## Stale comments

None found describing code that no longer matches — checked every comment
touching this round's changed regions (the person-chip touch-callout comment,
the removed `.note-affordance`, the `.stage-head`/day-whisper accent-usage
comments, the "WAREHOUSE" demo, the `✎` day-rule chip) against current
behavior; all are accurate. The one comment that reads as accurate-but-false
is Finding 3 above (`card-facts.js:132`), which is less "stale" (describing
removed code) than "aspirational" — it describes what the author intended to
build, not what `canAnimate()` actually checks.

## Skeptic

Verified each finding against the cited lines plus the surrounding guards
(`app.js`'s zoom wiring, the keyboard path in `wall.js`, `aura.js`'s
`animated` condition, the low-power CSS block). Verdicts below, then what the
walk turned up that the survey didn't report.

### css-1 — CONFIRMED, P0 (mouse only — keyboard is fine, and that split matters)

The guard is exactly as quoted: `wall.js:212`'s
`e.target.closest('.facts-grown, .chip-notes, .chip-spotify')` runs and
returns *before* `ctx.onZoomTap` is ever consulted. `.facts-grown`'s only
interactive descendant is the notes button (`card-facts.js:104-108`); the sub
line, `.f-spring` filler, `.f-who` pills, and (when there's no Spotify
affinity) even the whole chips row are inert — so the guard is swallowing
clicks on content that was never a control.

What raises this past "most of the card is dead space": `app.js:73-74`'s own
comment states the intended contract in plain words — *"A mouse zoom is just
hover — clicking still picks."* `onZoomTap` (`app.js:77-80`) is written to
match that: it only intercepts on `source === 'touch'`, returning `false` for
a mouse zoom so the tap falls through to `onTap`. But the `wall.js:212` guard
never gets that far — it fires on `e.target`, not on zoom `source`, so a
**mouse** click anywhere in `.facts-grown` (which is the visible bulk of a
hover-zoomed card — `left/right:8px, top:38px, bottom:10px` per
`v3.css:624`) is dropped before the source check that was specifically
written to let it through. The one documented desktop behavior this round
added — hover to preview, click to still pick — does not work for most of the
card's surface. Confirmed as filed, P0.

### css-2 — CONFIRMED, but P1 not P0 (visual only, self-heals, `.times-grid` correctly immune)

Verified `.wall-grid` (`v3.css:509-511`) sets `grid-template-columns` only —
no `align-items` or `grid-auto-rows`, so CSS Grid's defaults apply: rows
auto-size to content and items stretch cross-axis by default. `card-facts.js`
sets `el.style.minHeight = '132px'` directly on the `.card` grid item
(`card-facts.js:378`), which is a hard floor on that row's auto-sized track —
every sibling in the same row stretches to match. Traced the counter-example
too: `.times-grid` gets an explicit **fixed** `grid-template-rows` (`repeat(N,
20px)`, `wall.js:704/714`) every render, and a *fixed* track can't grow to
accommodate an oversized item — the zoomed cell just overflows visually
(`.card.zoom { overflow: visible }`) without moving its neighbors. So the
reader's "why `.times-grid` is fine but `.wall-grid` isn't" claim holds up
exactly as argued.

Downgrading to P1: this is a pure layout-stretch during an already-transient
hover/hold state, not a broken interaction — `unzoom()` restores
`el.style.minHeight` from the stashed `prev` value (`card-facts.js:262-264`),
so nothing is left stretched once the zoom ends. It's a real "feel" defect
(rows visibly balloon under your cursor while previewing a neighbor) but nothing
breaks or persists, which is the P0/P1 line on this project.

### css-3 — CONFIRMED as filed, P1

`canAnimate()` (`card-facts.js:194-195`) checks only
`prefers-reduced-motion`. Traced the low-power path all the way through:
`document.body.classList.toggle('low-power', ...)` (`app.js:995`) drives
`.low-power * { animation: none !important; transition: none !important; }`
(`v3-tokens.css:181`) — and that rule is a dead end for this file specifically,
because `Element.animate()` (Web Animations API) instances aren't CSS
`animation`s or `transition`s at all; the `!important` CSS property reset has
zero effect on a WAAP-driven sequence. So low-power's only working mechanism
against this file is the resting card's `.card.animated` gradShift, which
*is* plain CSS (`wall.js:108`'s `if (animated && !ctx.lowPower)` gate is the
correct, separate control for that). The zoom's grow/shrink morph has no
low-power gate of any kind, contradicting `card-facts.js:132`'s own comment
("low-power still wins globally"). Filed severity (P1) is right — WAAP here
animates GPU-cheap properties (opacity, clip-path, transform) on the
morph itself, so it's a broken-promise/battery issue, not a jank one on its own
(see "missed," below, for where a *different* WAAP call in this same file
does animate a layout property).

### css-4 — PLAUSIBLE, downgrade P1 → P2 (real gap, one detail in the evidence is wrong)

Confirmed the core claim: `mkAction()` (`notes.js:96-100`) is one undifferentiated
builder, and Edit/Delete/Reply all get plain `class="note-action"` — no `cls`
argument is ever passed for Reply or Delete, so nothing distinguishes the
destructive action from the compose action. But the evidence overstates one
detail: they are **not** rendered as "underlined text links." The base
`.note-action` rule (`v3.css:257-258`) does say
`text-decoration: underline`, but every actual use is inside `.n-head`, which
overrides it back to `text-decoration: none` (`v3.css:562`) — confirmed by
grep, `.note-action` never appears outside a `.n-head` context in this
codebase. So in practice these already render as plain, muted
(`--text-tertiary`), non-underlined text, not links — the hierarchy problem
is real, but it's "same look, no color/weight cue," not "styled as links."
Delete also already carries its own protection independent of color: the
two-tap "Sure?" arm (`notes.js:152-159`) means a stray tap can't destroy a
note. Net: real finding, softer than filed — P2, cosmetic hierarchy rather
than a safety gap.

### css-5 — CONFIRMED, downgrade P2 → P3

`.n-note.pinned` (`notes.js:82`) has no CSS rule anywhere in `v3.css` —
confirmed by grep, the only two `pinned` hits are unrelated prose comments.
The pinned visual treatment is carried entirely by the inline `--wash`
custom property (`notes.js:84`). Pure dead code with zero user-visible
effect — P3 (cleanup, not a bug), since nothing renders wrong and nothing
depends on the class.

### css-6 — CONFIRMED as filed, P2 (one file:line in the evidence is wrong)

`aura.js:24/34` confirmed: `animated: true` fires for *any* nonzero pick
count, matching "every picked card," not some subset. The `.low-power`
block (`v3-tokens.css:181-182`) confirmed to have no `backdrop-filter`
override, so `.day-rail`/`.stage-strip`'s sticky blur (`v3.css:208,489`)
survives low-power exactly as claimed. No `IntersectionObserver` anywhere
in `js/` gates `.card.animated` by viewport visibility (the only
`IntersectionObserver` in the codebase, `wall.js:1019`, drives the day-tab
scrollspy — unrelated). One citation error: `.card-grain`'s
`mix-blend-mode: overlay` is defined at **`v3-tokens.css:159`**, not
`v3.css:159` as filed (coincidentally the same line number, wrong file) —
doesn't change the substance. Confirmed at filed severity (P2): real,
pre-existing (not a regression of this round, as the reader itself notes),
proportionate to "large heavily-picked wall" rather than everyday use.

## What the survey missed

**1. The touch half of the same bug is worse than the mouse half filed as
css-1.** `app.js:73-74`'s comment: *"A touch-born zoom is a preview: tapping
its body puts it away."* That's implemented as `onZoomTap` returning `true`
for `source === 'touch'`, calling `dismissZoom()`. But per css-1's own
evidence, the `wall.js:212` `.facts-grown` guard fires *before* `onZoomTap`
is ever reached — for touch exactly as for mouse. And the capture-phase
`document.addEventListener('pointerdown', ...)` in `app.js:82-86` only
dismisses when the tap lands *outside* the zoomed card
(`!z.contains(e.target)`) — a tap inside `.facts-grown` is still inside the
card, so that global listener doesn't fire either. Net effect: on a phone,
long-pressing a card to preview it, then tapping anywhere in the grown
body that isn't the notes chip — the documented "tap the body to dismiss"
affordance — does **nothing at all**. Not a pick, not a dismiss, just a dead
tap. The only way to close a touch zoom by tapping *on* the card is to hit
the ~28px name strip above `.facts-grown`, or the notes/Spotify chips
themselves (which open notes, not dismiss). This is the same root cause as
css-1 (the guard is source-blind) but a distinct, and arguably more visible,
symptom on the platform this round's zoom explicitly designed for
(long-press is touch-first). Same fix as css-1 covers both: gate the guard
on whether `e.target` is itself inside an *interactive* control, not on
whether it's inside `.facts-grown` at all.

**2. The unzoom (shrink-out) animation animates a layout property every
frame, not just paint — a second, more expensive motion-cost hit in the same
file the survey already flagged for cost.** `card-facts.js:274-279`: the
"way out" animation is `el.animate([{width, minHeight, marginLeft}, {width,
minHeight, marginLeft}], {duration: 260, easing: EASE})` run on the `.card`
grid item itself. `width`, `min-height`, and `margin-left` are all
layout-affecting properties — unlike the resting card's `background-position`
gradShift (paint-only, no layout) or the grow/shrink morph's `clipPath`
(compositor-only), animating these forces the browser to recompute layout
for the surrounding grid on every frame of a 260ms WAAP animation, on a card
that is *by definition* sitting inside `.wall-grid` or `.times-grid` next to
however many sibling cards are on the wall. This is a stronger version of the
survey's own css-6 "N animations doing real paint work" complaint —
reflow is strictly more expensive than paint, and it's the round's own new
code, not a pre-existing condition. Worth its own line: **P1**, same file
(`card-facts.js`) as css-2/css-3, same "motion cost" theme the survey
explicitly set out to check, but a distinct code path (the unzoom exit, not
the grow-in or the row-stretch) that wasn't named anywhere in the findings.

**3. Delete's two-tap "Sure?" arm has no assistive-tech announcement.**
`notes.js:152-159`: the button's `textContent` flips from `Delete` to `Sure?`
in place, with no `aria-live` region, no `aria-label` update, nothing that
tells a screen-reader user the control's meaning just changed under their
cursor/focus. A sighted user sees the label change instantly; a screen
reader user who activates "Delete" once has no guaranteed signal that a
second activation is now a real delete rather than a re-trigger of the same
button. Adjacent to css-4 (same action row, same file) but a distinct axis
(assistive tech, not visual hierarchy) that the survey's note-thread walk
didn't check. P2 — real gap, but the 3-second window and the fact that a
screen reader typically re-announces a focused control's updated accessible
name on some interaction models limits the blast radius.
