# v3 inventory — screens, components, and the aura algorithm

**Extracted 2026-07-10 from the design atlas (`Festival Navigator
Screens.dc.html`, read in full) + handoff README. Static tokens live in
`assets/v3-tokens.css`. The atlas file stays on disk at the scratchpad path in
NOW.md — re-read the relevant turn before building each screen; this doc is
the map, not the territory. Rules-card note: the Handoff page (turns 16–20) is
decision *history*; its operative content is distilled in the bundle README and
the atlas intro, which this build treats as the rules source (README: "Where
the two pages disagree, the Screens page wins").**

## The aura card engine (atlas `renderVals()`, turn 21 script — port verbatim)

Given a card's picks `{person: level}` where level 1–3 = picked, 4 = must:

1. Order: musts first, then picks (this drives both gradient anchors and chips).
2. Alpha: must → 1.0; picks → `[0.5, 0.75, 1.0][level-1]`.
3. Layer per person, anchor cycling `20% 120%`, `85% -20%`, `-15% 30%`,
   `115% 70%` (index mod 4):
   `radial-gradient(130% 130% at ANCHOR, hsla(H,S%,L%,a) 0%, hsla(H,S%,L%,a*.5) 45%, transparent 78%)`
4. Compose: `layers.join(', ') + ', #1C1731'`; empty → flat `#1C1731`.
   Picked cards also get `background-size:180% 180%; animation:gradShift 12s`
   + grain overlay .3; unpicked cards get neither.
5. Name color: picked `#fff`, unpicked `#B9B3CC`. Sub/time line: picked
   `rgba(255,255,255,.75)`, unpicked `#5D5578`.
6. Tinted stroke for a person: YOU → `#fff`; else `hsl(H, min(S,85)%, 82%)`.

## Who-corner (bottom-right) + about-corner (bottom-left)

- Must pill: 24×12px, r999, fill hue@.5, 1px tinted stroke, white letter
  7.5px/800. Pick tick: 4×12px, same fill/stroke, no text. Gap 3px between
  marks; corner insets ~4px bottom / 5-6px side. Caps: 2 musts + 2 ticks then
  ghost `+n`. Duplicate initials get two letters.
- Notes chip: height 13px, pad 0 6px, radius `8px 8px 8px 2px`, notes
  fill/stroke, count 8.5px/800 white. Spotify pill: height 12px, r999, spotify
  fill/stroke, liked count + bookmark SVG `M1 1h8v11l-4-3-4 3z` (7×9) when
  followed. Grid cells shrink both by ~1px (12/11px heights, 8px font).

## Person chips / avatars

- Wall person chip: pill, pad 5px 12px, 11.5px, fill hue@.5, 1px tinted
  stroke; YOU: white stroke + weight 700 (others 600). Add chip: `+` dashed
  1.5px `#3A3354`, text `#8E86A8`.
- Letter avatar (everywhere): 17px circle, hue@.5 fill, tinted stroke, white
  8px/800 initial, overlap margin-left -5px. Join rows: 30px. Dock you-chip:
  26px with 1.5px stroke. Email: 34px, solid hue fill, 3px `#F3F0E9` ring.

## Screens (atlas turn → build notes)

- **21a Landing** (desktop 920 grid `1fr 340px` gap 48 / mobile 390): Anton
  62px/42px FESTIVAL + pulse-text NAVIGATOR; pitch `#8E86A8` 15/13px; hero
  52/48px; YOUR FESTIVALS rows (r12 `#141021` + `#2B2440`): fest name Anton
  16/15px in fest color + `'YY` at .65em/.75op, dates 10.5px/600 `#5D5578`,
  avatar cluster, `›`. Micro-label 10px/800/.12em.
- **21b Join/claim**: label `YOU'RE INVITED TO` 11px/800/.14em `#5D5578`; fest
  name Anton 48/40px in fest color; member rows (r12): 30px avatar + name
  15px/700 white + meta 11px/600 `#5D5578`; "I'm someone new…" input (r9,
  border `#322A4D`) + tonal Join pill. Desktop: 2-col grid 480px wide.
- **21c Wall**: header = fest name Anton 34/26px + venue·dates + (desktop
  only) fest pill + sync dot, gear 19px (ONLY header icon). Toolbar: person
  chips + add · search pill (r999 `#141021`/`#2B2440`) · `Billing ▾` chip ·
  outlined Notes chip (bubble radius, `#8B7BFF`/`#A99BFF`, count badge
  `rgba(139,123,255,.25)`). Day header: Anton 16px `#EDEAF4` + date 10px/700
  `#5D5578` + hairline rule. Card grid: 4-col desktop / 2-col mobile, gap
  7/6px, min-height 64/60px, pad `9px 11px 20px`. Fest-wide notes section at
  wall end (`NOTES · {FEST}` Anton 14px). Mobile dock (pinned bottom,
  `#0A0812`, border-top hairline, pad 9px 16px): you-chip 26px · day tabs
  (12px/800, active = fest color + 2px underline, inactive `#5D5578`;
  scrollspy; >4 days add date digits + h-scroll) · fest name Anton 13px + 7px
  sync dot (deep-links Settings#festivals). Dock hides while typing/keyboard.
  Desktop: NO dock.
- **21d Data states**: lineup-only = `THE LINEUP` + `BILLING ORDER` label,
  flat wall, no animation on unpicked; set-times = CSS grid `40px repeat(N
  visible stages, 1fr)`, 20px rows = 15min, gap 4px, stage headers Anton
  12.5px fest color on `#141021` r8, hour labels 9.5px/600 `#5D5578`
  right-aligned (top:-7px), cells = same cards + time line (9px/600), 2
  stages visible mobile, swipe for more.
- **21e Day notes + pins**: under each day's cards. `PINNED BY YOU` label;
  note row = 22px avatar + bubble (body 12.5px `#C6CBD6` on `#141021`, bubble
  radius; PINNED = notes-stroke tinted border) + author·age 10px/600 tertiary
  + Pin/Unpin TEXT buttons (`#D8B4FE` when active, `#5D5578` idle). Composer:
  input r8 + tonal Save. Pins device-local, never synced.
- **21f Spotify drill**: back `‹` + `SPOTIFY` Anton 18px + `connected as
  {user}` green; Library card (r12): stats line, `synced Xh ago`, tonal
  "Refresh my likes"; Playlist card: fest selector pill + segmented
  Everyone/Just mine (active = fest-tinted `rgba(fest,.14)` + lighter text),
  hint 11px, tonal "Make playlist"; footer: reassurance line + ghost
  Disconnect (keeps picks/notes, drops badges only).
- **21g Artist notes sheet**: bottom sheet `#0A0812` r`20 20 0 0`, shadow `0
  -8px 30px rgba(0,0,0,.5)`, grabber 36×4 `#2B2440`; artist name Anton 19px;
  note rows + composer as 21e (no pins here). Long-press mobile (~500ms,
  callout suppressed); desktop opens via notes bubble click (hover shows
  empty bubble when none). Anyone adds, nobody deletes others'.
- **21h Settings** (ONE page, 560px column both platforms; doors: gear +
  dock fest name → #festivals): YOUR FESTIVALS (current = r12 card with
  1.5px `rgba(fest,.55)` border, members as chips, tonal Share invite +
  ghost pick-count; others = landing-style rows; `+ Add a festival` dashed;
  `Archived · N ▸` collapsed) → YOU (avatar+name row `Change name or color ›`;
  Spotify glance card → 21f) → APP (list card r12, hairline dividers: How it
  works ›, Low power + toggle, Stay offline + toggle, Bulk paste likes ›;
  v3 keeps: Export likes ›, Download day image › — Kevin's keeps, live here).
- **21i How it works**: first card in Settings; teaches with REAL components
  (3-swatch tap ladder, chips, corner badges, PINNED chip, dock chip). No
  on-wall explainer exists.
- **21j 404 + email**: 404 = pulse-text `WYA?` Anton 72px + line + MY
  FESTIVALS hero (240px). Email (light `#F3F0E9`, static gradients): banner
  88px hero-bg + white square 11px + `FESTIVAL NAVIGATOR` Anton 16px/.08em;
  avatar trio 34px; `MAYA ADDED YOU TO {FEST}.` Anton 34px `#191621`; body
  14px `#5B5468`; OPEN THE FESTIVAL hero 260×50; plain-link fallback mono;
  footer hairline `#E2DDD2` + 10.5px `#8B8496`/`#B4AEC0`.

## Component build list (P1)

tokens (done) · aura engine + card (the atom) · corner chips · person
chip/avatar · hero button · pulse text · search/dropdown/notes-chip toolbar ·
day header rule · note row + composer · bottom sheet · dock · settings cards +
toggle + list rows · gallery.html rendering all of the above in all states.

## Deliberate deviations (spirit over letter — flag in morning report)

- Fonts self-hosted (offline-first + supply chain) vs README's Google Fonts.
- Segmented-active tint shown fest-blue in atlas (Portola context) →
  implemented as `rgba(var(--fest), .14)` so it follows the active festival.
- v3 keeps Export-likes + Download-day-PNG (Kevin's explicit keeps) as
  Settings → APP rows; atlas omits them (it predates the decision).
