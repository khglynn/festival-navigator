# Map — sheets, shelves, cards over the wall, dialogs, and the button family

**Written 2026-09-25 (CT evening) for the 2026-09-26 unified build.** Read-only map of
`.claude/worktrees/plan-base` (branch head v92 = v91 in production + the guest
first-open work, commit `abe7205`). Every claim carries `file:line` from that
worktree. Nothing there was edited.

Status: DONE (2026-09-25, late). Every `file:line` was read in plan-base;
the two runtime claims marked CONFIRMED were measured with
`probe-shelves-tokens.mjs` (this folder; `APP=<worktree> node
probe-shelves-tokens.mjs` re-runs it against any worktree). Sibling maps:
`map-input.md` (who decides what a tap/hover does) and `map-plan-now-dock.md`
(the dock, NOW, Our plan's logic) — not repeated here.

## 0. The short version

1. **Sheets are one CSS primitive with five hand-built openers.** Notes (×4
   scopes), share moment, add someone and the join shelf each re-type the
   backdrop + sheet + ids + dialog block; the join shelf also re-types the
   grabber drag and the Tab trap. The id pair `#sheet-backdrop` /
   `#artist-sheet` is a hidden contract with four readers (closeSheet,
   rememberOpener, the new-build `quiet()`, the join shelf). §1a, §1e.
2. **The welcome card and the bring-your-picks offer are one CSS component
   and two copied JS modules** (node helper, toast watcher, arrival, exit —
   line for line). Neither has a computer layout. §1d.
3. **Buttons: two colour classes, 31 sizings over 8 font sizes, and not in
   Inter.** `.btn-tonal`/`.btn-ghost` carry colour only; every one of ~60 call
   sites types its own size inline. They render in Arial/system-ui (measured).
   Four separate "text button" looks, four pill-button looks. §2.
4. **Motion is uneven across the family.** The zoom, the join shelf, the
   welcome/offer cards and the show menu follow "grow in with life, leave
   quick and plain". Notes/share/add sheets scale-fade in and vanish in place;
   toasts, toolbar strips, the sort popover and Settings pop. Motion values
   live in motion.js but CSS re-types them as literals (8 different
   durations). Reduce Motion / Low Power handling is consistent. §3.
5. **The 44px floor holds** on these surfaces, but seven opt-outs/upgrades
   now live outside the floor block, and computers have no floor at all. The
   new zoom row's reach must stay inside the zoom's padding and never overlap
   between thirds. §4.
6. **One existing bug (confirmed in a test page):** on a phone the Show menu
   opens *under* the welcome card, because the dock is a stacking context at
   z30. Our plan's peek would inherit it. §5c.1.
7. **The zoom only dodges `#dock`.** It will grow under Our plan's peek on a
   phone and under the corner card/panel on a computer unless `place()`
   learns the new chrome. §1f.
8. **Three design sources disagree on the zoom row's shape** (bare glyphs vs
   ghost circles vs the segmented pill that won the button study), and the
   study flips the button order to primary-left. Settle before styling. §5a.
9. **Proposal:** one `shelf.js` with two roles — *question* (modal; footer
   shelf on phones, centred dialog on computers) and *companion* (non-modal;
   above the dock on phones, bottom-right corner stack / 400px panel on
   computers); one button family (`.btn` + colour + size tokens, `font:
   inherit`); one field family; motion, z-index and "above the dock" as
   tokens. Ten migrations, each shippable alone, with touch lists. §5b, §6.
10. **Do first:** widen the accent guard test to every JS file
    (tests/finish-pass.test.mjs:115-119 skips welcome.js, join-shelf.js,
    crew-entry.js, card-facts.js and any new shelf module). §6 M1.

## 1. Inventory of every surface over the wall

### 1a. The sheet family (one CSS class, five hand-built openers)

The CSS primitive is `.sheet-backdrop` + `.sheet`, v3.css:451-489: backdrop
`rgba(0,0,0,.45)` z40; sheet z41, `--dock` ground, `--r-sheet` (20px top
corners), 16px padding, 12px gap, `max-height: 72vh`, arrives with
`sheetIn .15s ease` (opacity 0 + `scale(.98)` → none, v3.css:458-460). At
`min-width: 720px` the same element becomes a centred dialog (`translate:
-50% -50%`, `min(560px, 92vw)`, 20px all corners, grabber hidden,
v3.css:480-489). Chrome parts: `.grabber` (v3.css:461-463), `.sheet-title`
(v3.css:464-465), `.sheet-close` (unscoped on purpose, v3.css:466-474).

Every sheet is ONE DOM slot: `id="sheet-backdrop"` + `id="artist-sheet"`. That
id pair is a hidden contract read by four things:
1. `closeSheet()` / `teardownSheet()` — notes.js:802-806, 946-958.
2. `rememberOpener()` (only captures when no backdrop exists) — notes.js:796-798.
3. The new-build reload gate `quiet()` — index.html:329 (`#sheet-backdrop` or a
   zoom slot = not quiet, so no reload).
4. The join shelf reuses the ids on purpose — join-shelf.js:31-32 ("closeSheet,
   quiet() and the waiters know it").
Any new shelf/panel primitive must either keep this id pair or update all four.

The openers, each building backdrop + sheet by hand (the same 8 lines copied):

| Surface | Opener | Chrome | Body styling |
|---|---|---|---|
| Artist notes (header = grown card) | notes.js:831-929 `openScopeSheet('artist')` | `grabberOnly` (notes.js:770-775) + `sheetCard` with the ✕ in its corner (card-facts.js:489, 511; v3.css:996-1003) | wrap gap inline `14px` (notes.js:876) |
| Day / section notes | same fn, `scope='day'` | `sheetChrome` title + ✕ (notes.js:731-766) | same |
| Festival notes | same fn, `scope='fest'` | `sheetChrome` | same |
| All notes | notes.js:963-~1100 `openAllNotes` | `sheetChrome('ALL NOTES')` | body gap inline `10px` (notes.js:993) |
| Share moment | app.js:1789-1855 `openShareMoment` | `sheetChrome('ONE LINK MAKES IT A CREW')` | 6 inline cssText strings: sub, link row, link input, Copy, Share, Later (app.js:1805-1848) |
| Add someone (+ its success state) | app.js:1863-2027 `openAddMember` | `sheetChrome('ADD SOMEONE')`, re-chromed on success (app.js:1927) | 14 inline cssText strings incl. a second copy of the share row (app.js:1875-1964) |
| Guest join shelf (v92) | join-shelf.js:50-262 `showJoinShelf` (§1e) | own class `.sheet.join-shelf` (v3.css:1319-1367), its own grabber | classed, not inline |

Duplication:
1. The backdrop+sheet+ids+dialogize block is written out 5 times
   (notes.js:835-841, 966-972; app.js:1792-1798, 1866-1872; join-shelf.js:53-55).
   notes.js exports `sheetChrome` and `dialogize` but not a "make me a sheet"
   function, so app.js re-types the skeleton.
2. The "link row + Copy + Share + Later/Done" block exists twice, the same
   structure and styles with only its words differing (app.js:1816-1851
   share moment; app.js:1932-1967 add-member success).
3. Five different input looks for one "text field" idea: link box
   (`--card` ground, 10px 12px, 12px type — app.js:1822, 1938), name field
   (`--page` ground, 11px 12px, 14px type — app.js:1883), the join shelf field
   (`--page`, 46px tall, 16px type — v3.css:1347-1349), plus the entry
   screens' inline `border-radius: 9px` fields (index.html:160, 185, 273) — 9px
   is not a token (`--r-card` is 8px). And `.n-field` (v3.css:434-442) is a
   fourth. `.search-pill` (v3.css:263-267) was re-shaped 2026-09-25 to "wear the
   text fields' shape"; that shape exists only as copies.

### 1b. Toasts (one component, two functions)

`showToast` / `showActionToast`, wall.js:2432-2464. One slot (`#toast-root`,
index.html:290), class `.undo-toast` (v3.css:837-847): fixed, centred with
`transform: translateX(-50%)`, `bottom: calc(64px + safe-area)`, z50, `--dock`
ground, `--border-emphasis` hairline, `--r-row`, shadow `0 6px 24px
rgba(0,0,0,.5)`. The action is `.undo-btn` (v3.css:846-847) — a text button in
`--tonal-text`. Class names still say "undo" though the undo toast was dropped
2026-09-25 (wall.js:2445-2446). **No motion at all**: a toast is inserted and
`textContent = ''` removes it — it pops in and vanishes in place, which
breaks "nothing pops, nothing vanishes in place". ~25 call sites in app.js
(grep `showToast(` / `showActionToast(`). `.undo-toast` also has no ≥720 rule:
on a desktop it floats 64px above a dock that does not exist.

### 1c. Toolbar strips (three, all inline-styled)

`insertStrip` (app.js:1432-1437) stacks bars under `.toolbar`, in call order.
1. Archive note — app.js:1421-1426, inline: `--card`, `--border-card`, `--r-row`, 12px.
2. Migration banner — app.js:1442-1471, inline: amber `rgba(245,158,11,.35)`
   border + `.08` fill (the `--sync-syncing` hue, hard-coded), Try now =
   `.btn-tonal` with inline `11.5px / 7px 13px`.
3. New-build strip — app.js:1478-1493, inline: `--card`, `--border-emphasis`,
   `--r-row`; Refresh = `.btn-tonal` with the same inline `11.5px / 7px 13px`.
Same anatomy three times (message + optional tonal action), zero CSS classes,
no arrival motion (they appear in place). Settings reads the new-build strip
by id (settings.js:975) — keep `#new-build-strip`.

### 1d. The two cards above the dock: welcome (v92) and bring-your-picks

Both use `.bring-offer` (outer fixed box, z38, `bottom: calc(64px + safe)`,
`left/right: 12px`, centred `max-width: 440px`) + `.bring-card` (`--dock`
ground, `--border-emphasis`, `--r-row`, 12px 14px padding, shadow) —
v3.css:184-200. The welcome adds `.welcome-offer` / `.welcome-card` /
`.welcome-head` (v3.css:201-224). They are **one component in CSS but two
modules in JS** with the same code written twice:
1. `node()` helper — welcome.js:93-98, crew-entry.js:210-215, join-shelf.js:35-40 (three copies).
2. `watchToasts` / `unwatchToasts` (step up by the toast's height via a
   MutationObserver on `#toast-root`) — welcome.js:119-135 vs
   crew-entry.js:219-237, line for line.
3. Arrival — welcome.js:171-186 (rise 12px) vs crew-entry.js:264-273 (rise
   14px): same curve and delay (`ARRIVE_DELAY_MS = 360` defined twice,
   welcome.js:86, crew-entry.js:203), 2px apart for no stated reason.
4. Exit — `dismissWelcome` welcome.js:205-218 vs `dismissBringOffer`
   crew-entry.js:324-337, identical but for the id.
5. Each keeps its own module-level `toastWatch`; the comment at welcome.js:116-118
   relies on "the two are never up at once" — a runtime promise, not a
   structure. A shared "above-dock companion" slot would make it structural.
No ≥720 rule for either: on a computer they float 64px above a dock that is
`display: none` (v3.css:670), centred, 440px — the design moves companions to
the bottom-right corner stack.

### 1e. The join shelf (v92)

join-shelf.js:50-262. The production sheet ids and classes + `.join-shelf`
(v3.css:1314-1368). It is the only sheet that (a) animates with WAAPI
(join-shelf.js:243-250 in, 185-200 out) — so it sets `animation: none` to
cancel `sheetIn` (v3.css:1320); (b) has an exit animation at all; (c) rides
the keyboard via `visualViewport` (join-shelf.js:158-173); (d) owns its own
history entry (`history.pushState({ joinShelf: true })`, app.js:516) instead
of the router's `sheet:` kind (app.js:3330-3341); (e) re-implements the
grabber drag (join-shelf.js:211-225, copy of notes.js:735-750, with a
`busy` guard and try/catch the original lacks) and the Tab trap
(join-shelf.js:228-236, copy of `dialogize` notes.js:814-822 minus
`textarea`). The two-halves action row is written twice, two ways:
`.js-actions` is `grid-template-columns: 1fr 1fr` (v3.css:1354) and
`.welcome-card .bring-actions` is `grid-auto-flow: column; grid-auto-columns:
1fr` (v3.css:218, which also handles the one-door member card) — one idea,
and the second form covers both.

### 1f. The zoom (the card over the wall)

`#zoom-layer` fixed, z36, pointer-events none (v3.css:1109); `.zoom-slot`
(shadow from frame 0, v3.css:1110-1117) > `.zoom-card` (v3.css:1121-1127).
Built by card-facts.js:836-917; placed by `place()` card-facts.js:771-792,
which keeps the zoom off exactly two things: the phone dock (`dockTop()`,
card-facts.js:728-733 — reads only `#dock`) and the sticky chrome above
(`chromeCeiling()`, 744-756 — rail + this block's stage strip). **It does not
know about anything else at the bottom**: the welcome card and bring offer
(z38 > zoom 36) sit ON TOP of a zoom grown near the bottom, and toasts (z50)
too. Our plan's peek row will be new bottom chrome: `dockTop()` must become
"top of the bottom chrome stack" (dock + peek, and the companion card when
it is up), or a zoom will grow under the peek. On desktop the corner card /
400px panel is new chrome on the RIGHT: `place()` clamps only to
`innerWidth - 8` (card-facts.js:784), so a zoom will grow under the panel.
The guest row today: `.f-guest-row` + `.f-pick` (card-facts.js:307-315;
v3.css:1373-1377) — the white "Pick shows" pill the decided − · note · + row
replaces.

### 1g. Popovers

`.sort-pop` (v3.css:282-318) serves two menus: the sort chip
(sort-control.js:44) and the show menu (app.js:1295-1327). The show menu
animates (rise 4px `CASCADE_MS` in, app.js:1257-1260; fall 4px `OUT_MS` out,
1244-1248); the sort chip's popover, the same component, just flips
`display` (sort-control.js:80) — it pops. On the dock it opens upward
(v3.css:318). NOTE for Our plan: the dock's show menu opens upward into the
space the peek row will occupy, but it paints inside the dock's stacking
context (z30), so anything above the dock at a higher z covers it — measured
today with the welcome card (§5c.1). The peek's z and the menu's must be
decided together.

### 1h. The Spotify scan pill

`.spot-pill` (v3.css:167-173; built settings.js:1384): fixed, z35, `bottom:
calc(70px + safe)` — 70, where the toast and cards use 64 — and `16px` at ≥720.
Non-interactive. It will collide with the peek row (it sits right where the
peek goes) and, on desktop, with the corner stack (bottom-right, 16px in).

### 1i. Settings (a screen, not a sheet)

`#screen-settings` (index.html:253-261), swapped in by `show()` (app.js:1497-1502)
— a display toggle, no motion either way. Drill pages use `subviewHead`
(tools.js:57-64). settings.js has 31 direct `style.cssText` lines, and on
top of those sizes its 26 tonal/ghost buttons through `el('button', '<inline
css>')` (the helper sets cssText, tools.js:10-15) — table in §2a. "More info" on the welcome card opens How it works
here and hides the wall; the welcome card survives because it lives inside
`#screen-app` (welcome.js:193-196). Not part of the shelf family in the
decided design, but it is the largest consumer of the button family.

### 1j. Layers and "above the dock" offsets (the numbers a shelf family must own)

| Layer | z | File:line |
|---|---|---|
| stage strip | 24 | v3.css:775 |
| day rail (≥720) | 25 | v3.css:396 |
| dock (<720) | 30 | v3.css:493 |
| spot pill, sort popover | 35 (the dock's popover is 35 INSIDE the dock's z30 context, so 30 to the page) | v3.css:169, 283 |
| zoom layer | 36 | v3.css:1109 |
| welcome / bring offer | 38 | v3.css:185 |
| sheet backdrop / sheet | 40 / 41 | v3.css:451, 453 |
| toast | 50 | v3.css:839 |

Bottom offsets that mean "just above the dock", all hand-typed:
`64px` (toast v3.css:839, offer v3.css:186), `70px` (spot pill v3.css:168),
`84px` (shell padding, index.html:81), `8px` gap from the toast
(welcome.js:126, crew-entry.js:228). The dock's own height is never named:
9px + a 26px avatar + 9px + safe area (v3.css:495, 498), which is why the
44px floor has to opt the dock's buttons out (v3.css:578-580).
No z-index or offset is a token.

## 2. Button styles

### 2a. The two "family" classes carry colour only

`.btn-tonal` and `.btn-ghost` live in the TOKENS file (v3-tokens.css:210-211),
not v3.css. They set background, border, colour, weight (700 / 600), pill
radius and cursor — and **no font-size, no padding, no font-family, no
line-height**. Every use supplies size inline. Result, counted per call site
(font-size / padding, from the per-line list; windowed regexes mis-pair these,
so this was read line by line):

**Tonal: 18 distinct sizings**
| font / padding | where |
|---|---|
| 11.5 / 7 13 | app.js:1455 (migration Try now), 1488 (new-build Refresh) |
| 11.5 / 8 13 | settings.js:550, 588 |
| 11.5 / 8 14 | settings.js:1153 |
| 12 / 9 | settings.js:143, 311 (flex:1) |
| 12 / 8 14 | settings.js:509, 708 |
| 12 / 9 14 | app.js:2297 (My link), settings.js:1254 |
| 12 / 9 15 | app.js:1826, 1942 (Copy), notes.js:723 (Save), settings.js:255 |
| 12 / 9 16 | tools.js:133, 187, settings.js:1803 |
| 12.5 / 7 13 | app.js:1908 ("+ Drew" chips — a tonal button used as a chip) |
| 12.5 / 9 16 | settings.js:647; CSS `.bring-actions .btn-tonal` v3.css:199 |
| 12.5 / 10 16 | settings.js:1545, 1619 |
| 13 / 11 | app.js:1838, 1954 (Share, flex:1) |
| 13 / 11 12 | CSS `.welcome-card .bring-actions` v3.css:219-220 |
| 13 / 11 18 | settings.js:1304 (Connect my Spotify) |
| 13 / 11 20 | app.js:1886 (Add) |
| 13.5 / 12 12, min-h 46 | CSS `.join-shelf .js-actions` v3.css:1355-1357 |
| 14 / 12 24 | index.html:161, 186, 274, 285 (entry screens) |
| 15 / 13 24, w100% | app.js:1551 (create go) |

**Ghost: 13 distinct sizings**
| font / padding | where |
|---|---|
| 11 / 5 11 | settings.js:1220, 1222 |
| 11 / 6 12 | settings.js:1122 |
| 11.5 / 6 12 | settings.js:494, 669 |
| 11.5 / 8 12 | settings.js:223 |
| 11.5 / 8 13 | settings.js:1551 |
| 12 / 8 14 | index.html:147, 164, 277, 286; settings.js:1766, 1848 |
| 12 / 9 14 | wall.js:2422 (+ Add a note), settings.js:175, 337; CSS `.bring-actions .btn-ghost` v3.css:200 |
| 12 / 9 15 | notes.js:701 (Add yourself to write a note) |
| 12 / 9 16 | settings.js:1730 |
| 12 / 11 16 | app.js:1848 (Later), 1964 (Done) |
| 12.5 / 10 18 | index.html:190 (Look around on the join screen) |
| 13 / 11 12 | CSS welcome card, v3.css:219-220 |
| 13.5 / 12 12 | CSS join shelf, v3.css:1355-1357 |

**31 sizings over 8 font sizes (11, 11.5, 12, 12.5, 13, 13.5, 14, 15)** for
what reads as two button kinds. On a phone the vertical padding is mostly moot
— `@media (pointer: coarse) { button { min-height: 44px } }` (v3.css:564)
floors every one of them to 44px — so the drift shows as width and type size
on phones, and as height too on computers (no floor there: a Settings 11px /
5px ghost is ~23px tall on a desktop).

**Font family — CONFIRMED (harness, 2026-09-25):** neither class sets
`font-family`, and there is no global `button { font: inherit }` (grep of
v3.css, v3-tokens.css, index.html). Measured with
`probe-shelves-tokens.mjs` (this folder: the production stylesheets + fonts on
a file:// page, no server): `.btn-tonal`, `.btn-ghost` and `.undo-btn`
compute to **Arial in Chromium and system-ui in WebKit**; `.chip-notes`
(which sets `font-family: inherit`) and plain text compute to Inter. So
tonal/ghost buttons, `.undo-btn`, `.seg`, `.back-btn`, `.dashed-row`,
`.person-chip`, `.sheet-close` and the day-rail `.now-tab` are not drawn in
the app's typeface today (on an iPhone: SF, which is why nobody noticed). Classes that DO set it: `.chip-notes`
(v3.css:84), `.sort-pop [role=option]` (294), `.room-head` (356, `font:
inherit`), `.f-chip` (1078), `.zoom-card` (1124), `.welcome-more` (222),
`.dock .day-tab` (525), `.n-door` (969), `.f-pick` (1376, `font:` shorthand).
Fix: one `button { font: inherit }` line (or `font: inherit` on the `.btn`
base) covers all of them. It changes glyph widths, so walk the tight spots
(§6 M3). The meter width table in aura.js (which mirrors v3.css) is
unaffected: the only buttons on a resting card are `.chip-notes`, which
already inherit.

### 2b. Every other button look (one-offs)

| Class | Look | Where defined | Notes |
|---|---|---|---|
| `.hero` | aura-blob link, Anton label | v3-tokens.css:167-190 | a link, not a button; landing only |
| `.seg` / `.seg.active` | outlined pill, active = brand .14 fill | v3.css:864-866 | a THIRD pill-button family (border `--border-input` like ghost, `600` weight like ghost) — used 2× |
| `.dashed-row` | full-width dashed "+ add" row | v3.css:716-719 | `--r-settings`; landing + settings |
| `.person-chip.add` | dashed pill "+ Add" | v3.css:251-252 | same idea as `.dashed-row`, pill-shaped, and as `.you-avatar.guest` (dashed brand ring, v3.css:667-668) |
| `.undo-btn` | tonal-text link-button in the toast | v3.css:846-847 | a text button like `.welcome-more` and `.note-action` |
| `.welcome-more` | inline link-button, `--tonal-text`, borrowed 44px via `::after inset -14px -8px` | v3.css:221-224 | third copy of the "text button" idea |
| `.note-action` | underlined tertiary 10px | v3.css:475-477 | fourth text-button look (plus `.n-head .note-action` v3.css:923 un-underlines it) |
| `.sheet-close` | 30px round ✕ | v3.css:471-474; overridden on the card v3.css:1001-1002 | the one "icon button" |
| `.back-btn`, `.gear-btn` | bare glyph | v3.css:861; index.html:110-111 (inline `<style>`) | gear-btn's rule lives in index.html, not v3.css |
| `.f-pick` | solid WHITE pill, dark text, 40px, `::after inset -8px -6px` | v3.css:1375-1377 | the guest zoom's "Pick shows" — the only white-fill button. Its fate is unsettled (§5a.1): the task brief gives a guest the same − · note · + row, the button study keeps a white Pick shows as the guest row's right two-thirds |
| `.f-chip.notes` | violet bubble, 17px (30px on coarse in the zoom) | v3.css:1076-1080, 616-618, 1374 | the zoom's note chip; stays in the new − · note · + row |
| `.chip-notes` | card-corner violet bubble, 13px | v3.css:80-85 | a real `<button>` inside the card; coarse floor opts it out (v3.css:577-585, 623) |
| `.notes-chip` | outlined violet bubble in the toolbar | v3.css:319-333 | third notes-button look (card chip / zoom chip / toolbar chip) |
| `.sort-chip` | `--card` pill, 700 | v3.css:270-277 | fourth pill-button: `--card` ground + `--border-card` |
| `.fest-link` | Anton fest name, `--fest` | v3.css:659-662 | one of the accent's four homes |
| `.now-tab` | brand word + breathing dot; `.compact` = 17px ring | v3.css:632-655 | decided design moves NOW into the day row |
| `.you-avatar` / `.guest` | white ring / dashed brand ring + "+" | v3.css:663-668 | |
| `.n-door` | full-width wash row, real 44px | v3.css:967-978 | |
| `.room-head` (button) | reset to look like text | v3.css:354-357 | |
| `.toggle` | 40×24 switch | v3-tokens.css:195-207 | uses the pulse gradient when on |
| `.fest-row`, `.list-row` | row buttons/divs | v3.css:688-704 | tools.js:71 builds a fifth row-button look inline |

### 2c. What a button family expressed as tokens would look like

Proposal (colour stays in the two classes, size becomes a scale):
1. Size tokens in v3-tokens.css: `--btn-fs-sm: 11.5px; --btn-pad-sm: 7px 13px;`
   `--btn-fs-md: 12.5px; --btn-pad-md: 9px 16px;` `--btn-fs-lg: 13.5px;
   --btn-pad-lg: 12px 20px;` (numbers are the medians of what exists, not new
   design — Kevin should see the three side by side before they land).
2. `.btn` base in v3.css: `font: inherit; font-weight: 700; line-height: 1.2;
   border-radius: var(--r-pill); cursor: pointer; white-space: nowrap;` +
   modifiers `.btn-tonal / .btn-ghost` (colour) and `.btn-sm / .btn-lg` (size;
   md is default). Keep the old class names as the colour modifiers so the
   ~60 call sites change only by dropping their cssText.
3. Layout stays at the call site but as classes, not inline: `flex: 1`,
   `flex: none`, `align-self: center | flex-start`, `width: 100%` recur — a
   `.btn-grow` / `.btn-row` (the two-halves grid the welcome card and join
   shelf both need, written two ways today: v3.css:218 vs 1354, §1e).
4. The four text-buttons (`.undo-btn`, `.welcome-more`, `.note-action`,
   `.n-fieldbar .note-action`) collapse to one `.btn-text` with a size and a
   tone (`--tonal-text` vs `--text-tertiary`); borrowed 44px reach is already
   the floor's job for `.note-action`, and `.welcome-more` hand-rolls it.
5. Move `.btn-*` and `.toggle` out of v3-tokens.css into v3.css — the tokens
   file's own header (v3-tokens.css:5-6) says it holds "everything static",
   and components there are invisible to anyone reading v3.css for buttons.
   Checked: 404.html loads only fonts.css + v3-tokens.css and uses only
   `.hero*` and `.pulse-text`, so `.btn-*` and `.toggle` can move safely.

## 3. Motion and Reduce Motion

### 3a. How each surface arrives and leaves today

| Surface | In | Out | Law check ("nothing pops, nothing vanishes in place") |
|---|---|---|---|
| Notes / share / add sheets (phone) | CSS `sheetIn` .15s `ease`: fade + `scale(.98)` (v3.css:458-460). Backdrop: no fade, full .45 at once (v3.css:451) | none — `teardownSheet()` removes both nodes (notes.js:802-806) | pops (scale-fade, not a rise from the edge); vanishes in place. Grabber drag past 70px also removes it mid-drag; short of 70px the sheet snaps back (`transform = ''`, no transition — notes.js:746) |
| Same sheets (≥720 dialog) | same `sheetIn` (composes with `translate: -50% -50%`, v3.css:483) | none | vanishes in place |
| Join shelf (phone) | WAAPI rise `translateY(100%)→none`, `GROW_MS` `EASE_ARRIVE`; backdrop fades in; head, names, field, actions cascade 6px at `STAGGER_MS` (join-shelf.js:243-250) | WAAPI drop to `translateY(100%)` `OUT_MS` `EASE_LEAVE`, backdrop fades (join-shelf.js:185-200) | the one sheet that follows the law. Drag snap-back is instant (join-shelf.js:221) |
| Join shelf (≥720) | the same WAAPI rise, now composed with the dialog's centring translate: the dialog rises from one own-height below centre | same drop | UNVERIFIED in a browser: a dialog dropping by its own height mid-screen with no fade likely reads as vanishing part-way. Every other dialog scale-fades in. Two dialog arrivals on one screen size |
| Welcome card | rise 12px + fade `GROW_MS` `EASE_ARRIVE` after 360ms; faces cascade, then buttons (welcome.js:171-186) | fall 8px + fade `OUT_MS` `EASE_LEAVE` (welcome.js:213-217) | follows the law |
| Bring offer | rise 14px + fade, same timing (crew-entry.js:264-273); "done" state shrinks height `GROW_MS` `EASE_SURFACE` (crew-entry.js:291-320) | same fall 8px (crew-entry.js:332-336) | follows; height animation is layout on one small card (acceptable, but note it) |
| Welcome/offer stepping up for a toast | CSS `transition: transform .24s cubic-bezier(.2,1.15,.35,1)` (v3.css:188) — `GROW_MS` + `EASE_ARRIVE` re-typed as literals | same | follows; literals drift-prone |
| Toast | none (inserted, wall.js:2439) | none (`textContent = ''`, wall.js:2441, 2463); a new toast replaces the old instantly | pops and vanishes |
| Toolbar strips (3) | none (app.js:1432-1437) | migration banner `.remove()` (app.js:1444); new-build strip never leaves | pops |
| Zoom | bloom scale `GROW_MS` `EASE_ARRIVE` + cascade (card-facts.js:887-915) | recede + fade `OUT_MS` `EASE_LEAVE` (card-facts.js:1112-1138) | the model citizen |
| Show menu | rise 4px `CASCADE_MS` (app.js:1257-1260) | fall 4px `OUT_MS` (app.js:1244-1248) | follows |
| Sort popover (same component) | none (sort-control.js:80) | none | pops |
| Settings screen | none (`show()`, app.js:1497-1502) | none | pops (a screen change — maybe acceptable, never discussed) |
| Boot loader | fade in after 400ms (app.js:1521-1523) | removed on first `show()` (app.js:1498) | vanishes |

### 3b. Motion values: one JS home, many CSS copies

The JS home is motion.js (plan-base js/v3/motion.js): `GROW_MS 240`,
`CONTENT_FADE_MS 90`, `OUT_MS 130`, `CASCADE_MS 170`, `STAGGER_MS 30`,
`REFRESH_MS 300`, `EASE_ARRIVE cubic-bezier(.2,1.15,.35,1)`, `EASE_LEAVE
cubic-bezier(.4,0,1,1)`, `EASE_SURFACE cubic-bezier(.4,0,.2,1)`. CSS has no
motion tokens; it re-types values or uses the keyword `ease`:
1. `.bring-offer` .24s + EASE_ARRIVE literal (v3.css:188).
2. `.n-acts` .14s EASE_SURFACE + EASE_ARRIVE literals (v3.css:930-931); `.n-door` .14s EASE_SURFACE (971).
3. `.card > *` .09s `ease` = CONTENT_FADE_MS — the only one a test holds in
   sync (tests/motion-shared.test.mjs:20).
4. `sheetIn` .15s `ease` (v3.css:458), `.js-name` .18s `ease` (1339),
   `.toggle-knob` .15s `ease` (v3-tokens.css:201), `.sort-chip .caret` .12s
   (v3.css:276), `.scan-tile` .25s (137), `.scan-bar-fill` .4s (143).
CSS durations in use: .09 .12 .14 .15 .18 .24 .25 .4s. Proposal: `--t-grow`,
`--t-out`, `--t-cascade`, `--t-fade`, `--ease-arrive`, `--ease-leave`,
`--ease-surface` in v3-tokens.css, and extend motion-shared.test.mjs to assert
motion.js equals the tokens (the pattern it already uses for CONTENT_FADE_MS).

### 3c. Reduce Motion and Low Power — consistent, one gap to watch

1. CSS kill rules: `prefers-reduced-motion` (v3-tokens.css:140-143) and
   `.low-power *` (v3-tokens.css:214-215), both `!important` on `*`. They stop
   `sheetIn`, every CSS transition above, the now-tab's breathing dot, the
   eq loader, the pulse gradients. The strip follower is the one sanctioned
   exception (v3.css:825-828).
2. WAAPI is gated in code by `canAnimate(node, ctx)` (motion.js), which
   checks reduced motion AND `ctx.lowPower`. Every shelf/card call site passes
   `ctx` today (app.js:488, 510-515, 2473-2479, 2584; join-shelf.js default
   `ctx = null` means a future caller that forgets it loses Low Power, not
   Reduce Motion — make `ctx` required in the shared primitive).
3. Redundant local reduce rules (harmless, removable once tokens exist):
   v3.css:144-147 (scan), v3.css:1158 (`.card > *`).
4. What the new shelf needs from this: the Our plan drag is direct
   manipulation (follows the finger) — like the strip follower it must keep
   working under Reduce Motion; only the settle/drop-back animation goes
   instant (ours-r2 BRIEF.md:84-89 says "jumps open and shut"). Don't
   implement the drag as a CSS transition, or the kill rule freezes the
   settle and the release snaps.

## 4. The 44px floor (as it applies to these surfaces)

The floor: `@media (pointer: coarse) { button { min-height: 44px } }`
(v3.css:562-624), with a named opt-out list that takes borrowed `::after`
space instead (v3.css:577-611), and `.card button::after { content: none }`
(v3.css:623). The law (CLAUDE.md): the floor lives on `button`; the opt-out
list only ever upgrades.

Where these surfaces meet it:
1. **Opt-outs and upgrades living OUTSIDE the floor block** (the drift the law
   warns about, in a milder form — each is safe, but the "one place to look"
   is no longer one place):
   a. `.welcome-more` — `min-height: 0` + `::after inset -14px -8px`, not
      coarse-scoped (v3.css:221-224).
   b. `.n-head .n-acts .note-action::after inset -16px -14px` (v3.css:958-960, coarse).
   c. `.join-shelf .js-name` real 36px + `::after inset -4px` (v3.css:1337, 1367).
   d. `.f-pick` real 40px + `::after inset -8px -6px`, not coarse-scoped (v3.css:1375-1377).
   e. `.zoom-card .f-chip` 30px + `::after inset -7px` (v3.css:616-617, inside the block).
   f. `.join-shelf .js-actions` buttons real 46px (v3.css:1356).
   g. `.n-door` real 44px on both platforms (v3.css:967).
2. **Computers have no floor at all** (it is coarse-only), so the 31
   button sizings of §2a show as 23-46px tall buttons on a desktop.
   The button study's family (buttons/BRIEF.md:65-67: "a pill, 44px tall, a
   1px line, Inter 700") makes 44px the DESIGN height, not just the touch floor —
   at which point the floor stops doing work for family buttons and keeps
   doing it for everything else.
3. **The toast's action**: `.undo-btn` takes 44px real height on a phone, so
   an action toast is ~64px tall and a plain toast ~38px (v3.css:837-847) —
   the welcome card steps up by whichever it gets (welcome.js:124-127).
4. **The new − · note · + row** (the most delicate one):
   a. It lives in `.zoom-card`, which is NOT `.card`, so the card rule
      `.card button::after { content: none }` does not reach it — its reach
      works. Good.
   b. The button study's reach (buttons/BRIEF.md:133-138) runs − out to the
      zoom's left edge and + to its right, the note in between, "no gaps" —
      each third owns its own strip. Keep them non-overlapping: the
      later-painted sibling wins an overlap (the Settings "Stay offline" →
      "Bulk paste" mis-tap, v3.css:555-560), and here a wrong third is a
      wrong pick level under your name.
   c. `.zoom-card` has no `overflow: hidden` (only `.z-surface` clips,
      v3.css:1125), so an `::after` that reaches past the zoom's edge takes
      taps on the wall beside it — including the tap-outside that closes the
      zoom. The study's insets stop at the card's padding (−14px = the 14px
      side padding, v3.css:1123) — keep that bound.
   d. `.zoom-card .f-chip` gets `height: 30px` + `min-height: 0` on coarse
      (v3.css:616); the stepper's selectors must out-rank it (the study says
      its selectors do, by specificity — buttons/BRIEF.md:87-89).
5. **Buttons inside shelves** get the floor automatically (they are buttons).
   A shelf's text field is not a button: `.js-field` sets its own 46px
   (v3.css:1347), the add-member and share fields set none (app.js:1822, 1883,
   1938 — ~38-42px). A field family should carry 44px itself.

## 5. Duplication and the one-primitive proposal

### 5a. The design conflicts the builder must settle first (not mine to decide)

1. **The zoom row's shape.** Three sources disagree:
   a. The task brief for this build: a bare "−" at the zoom's left edge and a
      bare "+" at its right, "no button shape", the note chip in the middle.
   b. ours-r2 BRIEF.md:124-132 (round three): ghost CIRCLES, 36px phone /
      32px desktop, + with a brighter ring.
   c. guest-shelf/buttons/BRIEF.md:21-38 (the latest file, 21:56): variant A,
      one segmented pill `[ − | + note | + ]`, "Winner"; bare glyphs were
      variant C and lost because they "go faint on the pale wash" and "nothing
      tells you the glyphs are tappable" (buttons/BRIEF.md:29-31).
   The DOM is the same row in all three (three buttons in `.f-chips`); only
   CSS differs. The GUEST row also differs: the task brief gives a guest the
   same − · note · + row ("any tap opens the join shelf"); the button study
   gives a guest `+ note | Pick shows`, split 1:2, Pick shows white
   (buttons/BRIEF.md:49-50, 103, 121). Ask the orchestrator/Kevin which is
   final before styling.
2. **Button order.** buttons/BRIEF.md:76-78: "Order is primary on the left
   (Kevin): Pick shows | Look around … Join as Sam | Look around". v92 code
   has the opposite: quiet left, filled right (v3.css:212-217;
   welcome.js:157-162 appends yes then join; join-shelf.js:100-102 look then
   go). A flip touches welcome.js, join-shelf.js and 2 test files
   (bring-actions / js-actions order).
3. **Field words and height.** buttons/BRIEF.md:79-80: the shelf's field says
   "Add your name" at 44px; code says "New here? Your name" at 46px
   (join-shelf.js:24; v3.css:1347).

### 5b. One shelf primitive

What exists is ONE CSS primitive (`.sheet`) with five hand-built openers, a
second CSS primitive for companions (`.bring-offer`/`.bring-card`) with two
hand-built openers, and three strip builders. The decided design has exactly
two roles, and the code already half-has them:

| Role | Phone (<720) | Computer (≥720) | Today's members | New members |
|---|---|---|---|---|
| **Question** (modal: dimmed wall, focus trapped, one at a time) | footer shelf rising from the bottom edge, `--r-sheet`, grabber | centred dialog (the existing ≥720 `.sheet` rule, v3.css:480-489) | notes (artist/day/fest/all), share moment, add someone, join shelf | — |
| **Companion** (non-modal: the wall stays live) | footer shelf ABOVE the dock (today's `.bring-offer` slot) | bottom-right corner stack, "one right edge, 10px apart, newest on top" (ours-r2 BRIEF.md:115-119); Our plan grows into a 400px right panel (BRIEF.md:105-111) | welcome card, bring-your-picks offer | Our plan peek / corner card / panel; maybe the new-build notice (question 5c.3) |

Proposed module `js/v3/shelf.js` (one home for what is copied today):
1. `node()` (3 copies → 1).
2. **Question**: `openQuestion({ label, chrome: 'title'|'card'|'none', title,
   body, ctx, historyKey, onClose, rideKeys })` → builds backdrop + sheet with
   the existing ids (`sheet-backdrop` / `artist-sheet` — four readers depend on
   them, §1a), `dialogize`, the grabber drag (one implementation, with the
   join shelf's `busy` guard and try/catch), Escape, and ONE way to own Back
   (either the router's `sheet:` kind or a pushState, not both — today notes
   use the router, the join shelf pushes its own entry, app.js:516 vs
   3330-3341). Returns `{ el, close({instant}), setBusy, say }` — the join
   shelf's handle, generalised.
3. **Close vs re-render must stay two paths.** `openScopeSheet` tears down and
   rebuilds the sheet on every note add/delete (notes.js:833-834) — that must
   stay instant and keep the opener (`rememberOpener`, notes.js:796-798). Only
   a real close animates, and it must drop the ids at the START of its exit
   (as join-shelf.js:189-190 already does), or `quiet()`, `rememberOpener()`
   and a re-open during the exit see a sheet that is leaving.
4. **Companion**: `mountCompanion(key, { el, ctx, arrive, onDismiss })` into
   one container (e.g. `#companion-stack` inside `#screen-app`, so Settings
   still hides it with the wall — the property welcome.js:193-196 and
   crew-entry.js:201 rely on). ONE toast watcher steps the whole stack up
   (replacing welcome.js:119-135 + crew-entry.js:219-237). The "never both at
   once" ordering (app.js:2468, 2508) becomes a stack policy.
5. **Bottom-chrome geometry, exported once**: `bottomChromeTop()` (dock + the
   companion stack on a phone) and `rightChromeLeft()` (the corner stack /
   panel on a computer), read by the zoom's `place()` (card-facts.js:771-792,
   today `dockTop()` only), the toast, the spot pill, and the shell's bottom
   padding (index.html:81's `84px` must grow by the peek's height or the
   wall's last row hides under the peek).
6. `ctx` required (Low Power gate, §3c).

CSS: `.shelf` base (ground `--dock`, `--border-emphasis`, shadow) +
`.shelf-question` / `.shelf-companion`, and tokens: `--shelf-radius:
var(--r-sheet)`, `--above-dock: calc(<dock height> + 20px +
env(safe-area-inset-bottom))` replacing the 64/70px literals, `--z-*` for the
§1j table, `--scrim: rgba(0,0,0,.45)`. The grabber, `.sheet-title`,
`.sheet-close` stay as they are (already shared, v3.css:461-474).

### 5c. Reframes and questions this map surfaces (one line each)

1. **Existing v92 bug — CONFIRMED in the harness (Chromium + WebKit, 390
   wide):** the dock is `position: fixed; z-index: 30` (v3.css:493), which
   makes it a stacking context, so its upward show menu (`.dock .sort-pop`,
   z35 inside it, v3.css:283, 318) paints at 30 — under the welcome card and
   bring offer (z38, full width on a phone, v3.css:185). Probe: menu box
   y 618-806, welcome card y 630-780, and `elementFromPoint` in the overlap
   returns the welcome card in both engines. Tapping the fest name while the
   welcome card is up opens the Show menu behind it; `openShowMenu`
   (app.js:1251) does not dismiss or yield to the card. Caveat: the harness
   uses the production CSS and the index.html dock markup (index.html:239-249)
   with a 150px stand-in card, not a live app; a real-phone tap is the last
   check. Our plan's peek, if it sits above the dock at a higher z, inherits
   this. Fix belongs in the companion stack's z policy.
2. **Font family — CONFIRMED in the harness:** the button family renders in
   Arial (Chromium) / system-ui (WebKit), not Inter (§2a). One line fixes it;
   it changes widths.
3. **The new-build strip may have the problem the welcome card was moved to
   escape:** it is a toolbar strip (app.js:1492), and the toolbar is scrolled
   out of sight by the day-of open (the reason given at welcome.js:7-8 and
   crew-entry.js:196-198). Should the "Updated — Refresh" notice become a
   companion above the dock? Product call — the law says "a persistent strip,
   never a toast"; a companion is persistent too.
4. **Toasts on a computer** float 64px above a dock that does not exist
   (v3.css:839, no ≥720 rule) — with the corner stack arriving, where do
   they sit? (Suggest: above the corner stack, same right edge.)
5. **Settings' dense buttons** (11px / 5px-6px padding, §2a) are outside
   "tonight's" family (buttons/BRIEF.md:65 scopes it to tonight). A `.btn-sm`
   for Settings rows is a design call Kevin has not seen.

## 6. What each migration touches

Each is independently shippable; order is a suggestion (lowest risk first).
"Tests" = files that pin the names (grep of tests/ and gallery.html).

| # | Migration | Code touched | Tests / pins | Risks and must-walks |
|---|---|---|---|---|
| M1 | **Accent guard covers every file** | tests/finish-pass.test.mjs:115-119 (the fixed list omits welcome.js, join-shelf.js, crew-entry.js, card-facts.js, index.html and any new shelf.js) | itself | none; do it first so the build cannot leak `--fest` into a shelf |
| M2 | **Motion tokens** (`--t-*`, `--ease-*`) + CSS literals → tokens | v3-tokens.css; v3.css:188, 458, 930-931, 971, 1156, 1339; v3-tokens.css:201 | tests/motion-shared.test.mjs (extend) | none visible; bump SW stamp |
| M3 | **Button family**: `.btn` base (`font: inherit`, 44px design height for tonight's surfaces), size modifiers, move `.btn-*`/`.toggle` from tokens file to v3.css (404.html uses only `.hero*`/`.pulse-text` — safe) | 58 call sites: app.js ×12, settings.js ×26, index.html ×9, notes.js ×2, tools.js ×2, wall.js ×1, welcome.js ×2, crew-entry.js ×2, join-shelf.js ×2; v3.css:199-200, 218-220, 1354-1358; gallery.html `.zoom-controls button` | first-open-guest, notes-dates, first-open-welcome (class names kept → selectors survive; order tests if 5a.2 flips) | font change moves every button's width: walk the welcome halves and join shelf at 320, Settings rows at 390, the share row with a long crew link. aura.js width table unaffected (card chips are not `.btn`) |
| M4 | **Field family** `.field` (44px, `--r-card`, `--page`, `--border-input`, 16px on phones) + `.field-link` (read-only, `--card`) | index.html:160, 185, 273 (the 9px radius goes); app.js:1822, 1883, 1938; v3.css:1347-1351 (`.js-field`), 263-269 (`.search-pill` keeps its own row role), 434-448 (`.n-field` shares tokens, stays a growing textarea); tools.js:132, 185 | first-open-guest (js-field) | iOS zoom: index.html:15-22 sets maximum-scale on iOS; a 16px field is the belt, keep both |
| M5 | **Text-button** `.btn-text` for `.undo-btn`, `.welcome-more`, `.note-action` | v3.css:221-224, 475-477, 846-847, 923, 987-989 | first-open-welcome (welcome-more) | `.note-action` borrowed reach (v3.css:596, 958-960) must survive |
| M6 | **Toast** gets arrival/exit + a ≥720 position; rename `.undo-toast` → `.toast` | wall.js:2432-2464; v3.css:228, 837-847 | crew-join-recognize (undo-toast) | exit means the node lingers `OUT_MS`: `showToast` replacing a leaving toast must sweep it (the zoom's `exitingSlots` pattern, card-facts.js:552, 843-844); the companion watcher reads `#toast-root.firstElementChild` height |
| M7 | **Strip family** `.strip` (+ `.strip-warn` for the amber migration hue) | app.js:1421-1493 (three builders → one) | shell-glue, browser/shell-contract (`#new-build-strip`), first-open-guest (`#migration-banner`) — keep ids | settings.js:975 reads `#new-build-strip` |
| M8 | **Question primitive** (shelf.js `openQuestion`) | notes.js:731-958; app.js:1789-2027 (share, add — also dedupes the link row, app.js:1816-1851 vs 1932-1967); join-shelf.js:50-262; app.js:480-530 (join history) + 3330-3341 (router kind); router.js; index.html:329 (`quiet()`); card-facts.js:480-511 (`sheetCard` chrome) | 9 files pin `#artist-sheet`, 2 `#sheet-backdrop` (incl. new-build-reload), 3 `.join-shelf`; finish-pass focus-return tests (a no-op close must not forget the opener) | close ≠ re-render (5b.3); ids dropped at exit start; ONE desktop dialog arrival (today scale-fade vs the join shelf's rise, §3a); focus return; keyboard riding generalised from join-shelf.js:158-173; walk: open notes, add a note (re-render, no animation), close (animation), reopen mid-exit |
| M9 | **Companion stack** (welcome + offer now; Our plan peek next) | welcome.js, crew-entry.js (merge the duplicated halves, §1d); v3.css:184-224 → `.shelf-companion`; app.js:2456-2560 (ordering), 2821-2822 (crew switch), 415, 488; card-facts.js:728-733, 771-792 (zoom clearance); v3.css:167-173 (spot pill); index.html:81 (shell padding) | 6 files pin `#bring-offer`, 4 `.welcome-card`, 2 `.bring-actions` | the dock-popover stacking bug (5c.1); a zoom grown near the bottom must clear the stack; Settings must still hide it; desktop corner stack is new CSS (no ≥720 rule exists today) |
| M10 | **The zoom row** (− · note · +; the guest row per §5a.1) | card-facts.js:293-322 (`factChips`, `PICK_SHOWS`), 807-810 (guest), 913-914 (the cascade animates `.f-chip` from the left — − and + are not `.f-chip`, decide their arrival), 944-952 (`REFRESH_PART_SEL`/`partKey`: the row must be matched across a pick or it re-arrives on every pick); v3.css:616-618, 1373-1377; gallery.html states | first-open-guest, first-open-tap-welcome (`.f-pick`) | reach insets bounded by the zoom's padding (§4.4c); the row changes `disabled` on every pick — no layout shift allowed ("nothing moves under the hand", buttons/BRIEF.md:164-167). Input routing (who opens the zoom, what a tap on the zoom body does now) is map-input.md's slice |

Every migration that changes CSS or JS: `node scripts/sw-stamp.mjs` on a
clean tree (the project memory note: the stamp races parallel agents).
