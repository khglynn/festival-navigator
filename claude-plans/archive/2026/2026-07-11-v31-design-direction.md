# v3.1 design direction — desktop-grade, same soul

**Written 2026-07-11 (run doc for the v3.1 polish pass).** v3's identity is
right and stays: night-dark surfaces, Anton as the lineup-poster voice, Inter
for everything read at length, and the **people-aura gradients as the one
signature** — the thing you remember. v3.1's job is to give that identity a
desktop body and to bring the neglected surfaces (sheets, sort, Spotify drill,
set-times, entry screens) up to the same intentionality as the wall. Nothing
here changes the crew-doc shape.

**Subject check (frontend-design lens):** the app is a crew's shared map of a
festival. Its world's artifacts — the lineup poster, the laminated set-times
grid, stage signage — are the design vocabulary. Desktop should read as a
poster wall / timetable pinned flat, not a phone zoomed in.

**The one aesthetic risk:** the set-times view goes full-viewport on desktop —
a real festival timetable wall, hour rail pinned left, stage columns using the
whole window, day headers staying at reading width. Justified because it IS the
subject's own artifact, and it directly solves Kevin's A3.

**Anti-default check:** the AI-default "near-black + single acid accent" trap
doesn't apply — v3's darkness carries a 24-hue people system + per-fest
accents; distinctiveness lives in the auras. No cream, no serif, no
border-radius-zero broadsheet. Existing accent discipline stands (fest accent
ONLY on: fest name, active day tab, stage headers, current-fest border).

## Tokens (add to v3-tokens.css; fluid between 390 and 1440)

```
--fs-display:  clamp(26px, 4.5vw, 40px)   /* app-header fest title (was 26/34) */
--fs-screen:   clamp(30px, 5vw, 44px)     /* PICK THE FEST etc (was 34/40)     */
--fs-day:      clamp(16px, 1.6vw, 19px)   /* day-rule headers (was 16)         */
--fs-card:     clamp(13.5px, 1.2vw, 15px) /* card names (was 13.5)             */
--fs-body:     clamp(12.5px, 1.1vw, 13.5px)
--fs-micro:    11px                        /* micro-labels stay fixed           */
--shell-max:   960px; ≥1100px → 1080px
--sp-gutter:   clamp(14px, 2.5vw, 28px)
```

Breakpoints: **720px** (structure flips: dock→day-rail, sheet→dialog, grid
densifies) and **1100px** (wide: shell-max 1080, gaps 7→9, gutters up). Only
these two; everything else scales fluidly via clamp.

## Component specs

**Entry screens (landing/create/join):** wrapper gets `min-height:100svh;
display:flex; flex-direction:column` and `.center-col { margin-block:auto }` —
short content centers, tall content scrolls (overflow-safe). `.center-col`
max-width 480→560 at ≥720. Fest rows in the picker: padding scales with
--sp-gutter; names at --fs-day size. The landing brand keeps its pulse.

**Create flow, two steps:** Step 1 = pick (upcoming prominent; "Past
festivals" divider + muted rows with year badge, same row anatomy). Step 2 =
"NOW YOU": chosen-fest chip (fest accent border — allowed, it's the
current-fest border rule), name input, Create, ‹ back to step 1. Helper copy:
step 1 "Pick the fest."; step 2 "Your name becomes your color."

**Sheets → dialogs ≥720px:** `.sheet { inset:auto; left:50%; top:50%;
translate:-50% -50%; width:min(560px, 92vw); max-height:80vh; border-radius:
20px }`, backdrop unchanged. Motion: 150ms fade+2%-scale in, `@media
(prefers-reduced-motion: reduce)` kills it. Mobile bottom-sheet unchanged.

**Sort control:** chip (existing .sort-chip skin) + live caret + popover
listbox: surface #141021, radius 12px, 1px border var(--line, existing token),
items 13px Inter 600, hover = 8% white wash, selected = check + fest-accent
text (active-day-tab rule extends to "active choice"). role=listbox,
aria-expanded, Enter/Space/arrows/Esc/typeahead. Rendered createElement-only.
Options stay: Billing / A → Z / My picks / Crew favorites.

**Day rail (desktop day nav):** ≥720px sticky row under the toolbar (top:0
within .shell, backdrop-blur over page bg): "YOU" chip (jump to top) + day
tabs — Anton, --fs-micro letterspaced caps, active = fest accent (the active
day tab rule), scrollspy shared with the dock's existing wiring. Mobile dock
unchanged.

**Set-times, the timetable wall:** `.times-scroll` full-bleed ≥720
(`width:100vw; margin-inline:calc(50% - 50vw); padding-inline:
max(var(--sp-gutter), calc(50vw - var(--shell-max)/2))` so column 1 aligns
with the shell's left edge). Hour rail `position:sticky; left:0` inside the
scroller with a bg fade so times stay readable mid-scroll. Stage headers
sticky-top within the scroller. **"Everything else" column**: far-right column
(same .stage-head anatomy, neutral tint) for genuinely stage-less/time-less
items ONLY; anything with stage+time is placed in the grid via the existing
computeLanes overlap machinery. The below-grid flex list dies.

**Cards:** hover (pointer-fine only) reveals a top-right ✎ chip (never a music
note — reserved) that opens the artist notes surface; focus-visible ring for
keyboard. Tap targets unchanged on touch.

**Spotify drill, state-driven card:** one centered card (entry-screen
anatomy), five explicit states, each = one sentence + one action:
1. *No client ID (member view):* "Spotify isn't set up for this crew yet — ask
   your crew lead." (no dead-end: shows who the lead likely is = first member)
2. *No client ID (lead view):* "One-time crew setup: paste your Spotify app's
   Client ID." + input + Save + a "how to get one" details fold.
3. *Ready:* "Connect my Spotify" primary + one line: "We read your liked songs
   and follows to badge artists — nothing is posted."
4. *Connected:* stats glance (liked count, follows, last scanned) + Refresh my
   likes / Make a playlist / Disconnect.
5. *Error (incl. OAuth failure):* say what happened + the retry action.
   OAuth callback failures land IN the app with this state, never a dead
   browser page.
Copy rules: active voice, the action keeps its name through the flow
("Connect my Spotify" → "Connected").

**Empty states (writing pass, all of them):** invitation to act, never a
redirect-only. All-notes empty: composer present + "No notes yet — add the
first, or long-press any artist." 404 keeps WYA?. Bad token: "That link didn't
work — it may have been retyped. Ask your crew for a fresh one." + paste box.

## Quality floor (unannounced, everywhere)

Responsive 390→1920, visible keyboard focus on every interactive element,
prefers-reduced-motion respected (aura animation already has low-power mode —
wire the media query to the same path), touch targets ≥44px on touch, no
horizontal body scroll ever (wide content scrolls inside its own container).

## Restraint list (things NOT to do)

No new hues outside the 24-board + fest accents. No second signature — the
auras stay the only loud thing; dialogs/menus/rails are quiet surfaces. No
numbered structural markers, no decorative dividers beyond the existing
day-rule anatomy. Chanel check per screen before calling it done: remove one
thing.
