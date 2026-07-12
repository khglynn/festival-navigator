# Stage-4 audit re-run — findings + disposition (2026-07-12)

**Run:** 71 agents against the v31-polish preview (cc37d7d) with the
Client-ID-seeded Audit Rig + a dedicated offline prober. 159 raw → 42
confirmed after adversarial verification: **0 P0 · 4 P1 · 10 P2 · 28 P3**.
All 73 discovery-phase findings verified GONE (the anti-whack-a-mole proof —
nothing below re-reports a discovery item).

**Disposition (same session, commits after cc37d7d):** every P1 and P2 fixed,
and all P3s except the four judgment calls below. Highlights: the repaint
boundary now preserves scroll + composer drafts + focus (Class 1); the sort
popover clamps to the viewport (2.1); OAuth returns re-open the drill with
the banked error surfaced (6.1); transient Spotify failures no longer wipe
valid sessions (6.2); accessible names carry crew/notes/Spotify state (4.3);
the archived-fests disclosure is a real button (4.2); timetable bleeds
asymmetrically so columns fill the window while the left edge keeps the
shell's rhythm (3.2); FLOW-1 backfill heals pre-fix crews (7.1, 150c044).

**Deliberate non-fixes (Kevin's call or by-design):**
- 3.1 Settings 560px column: the design atlas documents it as intended
  ("Desktop is the same 560px column"). The drills-in-a-void critique has
  merit — flagged as a design decision for Kevin, not overridden unattended.
- 3.3 entry screens centered-narrow: the audit's own verifier called it
  conformance with the design system, not a violation.
- 12.2 in-app research provenance for saved fests: needs a designed surface;
  fast-follow.
- Leave-crew + browser-Back re-opening the left crew's join screen: coherent
  capability-model behavior (back = reopen the link); router hardened so
  stale history can never crash instead.

---

# Design audit — 2026-07-12 Stage-4 re-run (v31-polish preview cc37d7d)

Preview under audit: https://festival-navigator-git-v31-polish-kevinhg.vercel.app (branch `origin/v31-polish` @ `cc37d7d`). Audit crew: "Audit Rig" (throwaway). Spec: `docs/user-flows.md`.

**Severity counts:** P0 = 0 · P1 = 4 · P2 = 10 · P3 = 28 (42 confirmed findings).

Findings are grouped into 12 problem CLASSES named by root pattern. Classes are ordered by top-severity member (all P1 classes first). Within a class, findings run most-severe first.

---

## CLASS 1 — Remote-sync full repaint destroys (and inconsistently covers) live UI state
**Root pattern:** `onRemoteChange` → `repaintWall` → `renderWall` runs `root.textContent=''` (js/v3/wall.js:430) and rebuilds all of `#wall-root` on *every* remote doc change and on the 25s background poll, with no save/restore of ephemeral client state — scroll position, unsaved composer text, scrollspy highlight. The same repaint set is also inconsistent (the dock avatar is never repainted). This is the single largest root-cause cluster and the source of two of the four P1s. Trigger chain: `onRemoteChange` (app.js:904) → `repaintWall` (app.js:189-192) → `renderWall`, fired whenever `applyRemoteDoc` (state.js:202-216) returns true, from BOTH `pushSync`'s echo (sync.js:91) AND the 25s `pollSync` (sync.js:134). Fix once at the repaint boundary: preserve `scrollLeft`/`scrollTop`, keep the inline composers out of the torn-down subtree (as the notes SHEET composer already is), and reconcile the day-nav highlight + dock avatar instead of rebuilding blind.

### 1.1 — Tapping a set-times card silently resets the grid's horizontal scroll to 0 (contradicts F5.3)
- **Severity:** P1
- **Flow / viewport:** F5 · 390, 768 confirmed; 1440 untested for this exact interaction (see Coverage gaps)
- **Evidence:** Reported by 4+ sources. At 768, `.times-scroll.scrollLeft` measured 462→0 after a tap; the tapped card's x moved 367→829 (scrolled off-screen). Grep for `scrollLeft`/`scrollTop` across `js/` = zero hits — no save/restore exists anywhere.
- **Description:** The pick applies in-place, but ~1.2–2s later the crew-sync round-trip fires a full wall repaint that destroys and rebuilds every `.times-scroll` container (created in `renderScheduledDay`, wall.js:333-334; genuinely scrollable via `overflow-x:auto`, assets/v3.css:303) at `scrollLeft=0`. A user who scrolled several stage-columns in, taps a pick, and gets bounced to column 1 — the card they just tapped vanishes off-screen. Fires on the user's own tap echo AND on any other crew member's concurrent write (the primary live-event case; jsonb key-order re-serialization via `jsonb_deep_merge` makes even the own-tap echo pass the change guard). Directly violates F5.3 ("cycles the pick without the card moving or vanishing"). File: js/v3/wall.js:429-430 (+ app.js:189-192, 904; js/sync.js:43-46, 91).

### 1.2 — Any remote crew change wipes unsaved text in the inline wall note composers (day + festival scope)
- **Severity:** P1
- **Flow / viewport:** F6/F7/F8 interacting with F15 sync · all
- **Evidence:** Live-verified with two browser sessions as two devices on Audit Rig: Session A typed a draft in the Wednesday day-notes composer; Session B's unrelated pick synced; after Session A's own 25s poll fired, the composer input `.value` had reset to `""` (input still connected, contents gone). Reproduced cleanly when both sessions were on the same active festival.
- **Description:** The inline day-scope and festival-scope note composers rendered directly in `#wall-root` are destroyed by `renderWall`'s unconditional `root.textContent=''` on every repaint; they are recreated fresh with no draft persistence (composer at notes.js:145-166 has no localStorage/recovery). Silent, unrecoverable loss of typed input with no warning. The team already solved this for the notes SHEET composer (created once, outside `paint()`, notes.js:272) but never applied the same discipline to the inline composers. `openAllNotes` (notes.js:321) also recreates its composer inside `paint()`, so the family is slightly broader. File: js/v3/wall.js:430.

### 1.3 — Day-nav active-day highlight: blank on load, shows the WRONG day on deep scroll, torn down by sync, zero ARIA
- **Severity:** P2
- **Flow / viewport:** F9 · 390, 768, 1440
- **Evidence:** 2 detailed findings + walker 768. Live DOM: at 1440 all 4 tabs `active:false` immediately after nav and after scroll-to-bottom; at 390 bottom-scroll leaves the dock stuck on 'THU'/Day 1 while the Day 1 rule is at top=-5254px. 768: all 4 tabs share transparent border-bottom, no `aria-*`.
- **Description:** Fails the twice-named F9 "scrollspy highlights the day in view" in two ordinary cases. (1) Fresh load: no tab has `.active` even though Day 1 is on screen — the IO callback (wall.js:574-580) only ever ADDS `.active` inside a narrow `-10% 0px -80% 0px` band and never clears on exit, and the first day-rule sits under the sticky toolbar out of that band. (2) The trailing NOTES / EVERYTHING-ELSE headers reuse `dayHeader()` so they carry `data-day` (wall.js:250-251) and match the observer's selector — when one intersects, `day` matches no tab and `toggle('active', …)` de-highlights ALL tabs, or leaves the last real day stuck (the "wrong day" case). Compounded by `renderDayNav` rebuilding all tabs + recreating the observer on every `repaintWall`. Tabs are bare `<button class=day-tab>` (app.js:171-178) with no `aria-current`/`selected`/`pressed` at any time. Tab-CLICK nav is unaffected and self-corrects. File: js/v3/wall.js:566-583 (+ app.js:155-187, 904).

### 1.4 — Toolbar banners insert in reverse priority order when two appear in the same repaint
- **Severity:** P3
- **Flow / viewport:** F11 + F1/CT-1 · n/a
- **Evidence:** Code-evidenced (a live repro was aborted mid-test on an unrelated stray navigation). Mechanism unambiguous from source.
- **Description:** `updateMigrationBanner`, `updateWeekendRow`, `updateArchiveNote`, `maybeShowCoachMark` each insert via `#screen-app .toolbar`.after(bar) — always anchored to the toolbar, never chained off the prior banner. `element.after()` makes each new node the toolbar's immediate next sibling, so when `repaintWall` calls them Migration→Weekend→Archive→Coach and 2+ become newly needed in one pass (e.g. first-time device on a multi-weekend fest = weekend row + coach mark), DOM order ends up reversed — least-urgent on top. All banners cluster contiguously below the toolbar, so nothing is realistically scrolled out of view (finding's "scrolled out of view" is unsupported); purely a cosmetic ordering inversion. File: js/v3/app.js:198-201, 233, 271, 284, 314.

### 1.5 — Mobile dock "you" avatar doesn't repaint on remote sync — can show a stale color for your own identity
- **Severity:** P3
- **Flow / viewport:** F9/F11 · n/a
- **Evidence:** Code-evidenced; not live-reproduced.
- **Description:** `renderDockYou()` paints the bottom-dock avatar from `state.people()[meName].colorIndex`. Every LOCAL identity/color change calls it, but `onRemoteChange` calls only `repaintWall`/`renderPersonChips`/`refreshOpenSheet`, and `repaintWall` never calls `renderDockYou`. `renderPersonChips` DOES recompute from live state, so if your own `colorIndex` changes via a remote merge (change color on one device while a second polls), the second device shows the old dock color while the top 'you' chip has updated — two disagreeing 'you' indicators. This is the coverage-gap inverse of the same repaint system. File: js/v3/app.js:139-148.

---

## CLASS 2 — Fixed sizing/positioning overflows the viewport with no collision handling or recovery
**Root pattern:** elements sized/anchored with absolute or fixed dimensions without checking window bounds; the page's `html,body{overflow-x:clip}` (index.html:21) then turns any spill into genuinely unreachable content (no scroll recovery). Fix: clamp/flip popovers against `window.innerWidth`; give fixed-width demo grids `@media`/`overflow` containment.

### 2.1 — Sort menu overflows off the left edge at 390px — over half the menu (including the selected option) unreachable
- **Severity:** P1
- **Flow / viewport:** F4 · 390px (NOT reproduced at 768/1440)
- **Evidence:** 3+ sources + walker 390. Live `getBoundingClientRect`: listbox `left:-95.9, right:84.1, width:180` vs viewport 390. Screenshot `audit-390/F4-03-sort-open.png` shows only "…orites" visible.
- **Description:** The sort control has correct ARIA (role=listbox/option, keyboard support) but its popup is unconditionally right-anchored: `.sort-pop { position:absolute; right:0; min-width:168px }` (assets/v3.css:112-117) with no viewport-collision check anywhere in sort-control.js (all 116 lines read — only toggles display+ARIA). At 390 the toolbar flex-wraps and the sort chip lands at the LEFT of its row, so anchoring the ~180px popup's right edge to the chip pushes most of it off the left edge; `overflow-x:clip` makes the clipped portion non-scrollable — genuinely gone. Only a sliver of "Crew favorites" is tappable; "Billing" (with its selection checkmark), "A→Z", and part of "My picks" render entirely off-canvas. At 768/1440 the chip sits at the RIGHT so `right:0` keeps it on-screen. A fresh regression from the DT-7 native-select→listbox replacement. Fix: clamp/flip against `window.innerWidth` on open. File: assets/v3.css:112-117.

### 2.2 — gallery.html has no responsive containment — its demo grids can overflow the page horizontally
- **Severity:** P3
- **Flow / viewport:** N/A (internal dev tool) · ≤700px
- **Evidence:** Code-evidenced. Zero `@media` queries and zero overflow rules (grep confirms none).
- **Description:** Unlike index.html (which inlines `html,body{overflow-x:clip}`), gallery.html supplies its own `<style>` with no page-level guard and inherits none from v3.css. `.grid4 { repeat(4,170px) }` (~701px of fixed tracks + 56px padding = 757px, non-shrinking) and a hardcoded `width:390px #timegrid` force horizontal page overflow below their fixed widths. Dev-only (noindex, referenced nowhere in app code), so negligible real-user impact — but it's the only named CSS-hunt file with zero breakpoint/overflow coverage. File: gallery.html.

---

## CLASS 3 — Desktop is a centered/capped mobile layout, not a designed composition
**Root pattern:** fixed max-width columns and reading-width caps applied uniformly across viewports, so wide desktop canvases show a small card/column in a large void. The spec explicitly demands the opposite for the flagship surfaces ("desktop is a designed experience, not stretched mobile"; F13's "Class-A layout, not a floating button in a void"). The main wall (F4) fills the full viewport at the same widths, proving the pattern is achievable in-repo. This is the largest visual cluster in the audit.

### 3.1 — Settings and every sub-drill (Spotify, Add-a-Festival, Export Likes, Day Image) lack any desktop layout
- **Severity:** P2
- **Flow / viewport:** F11/F12/F13/F14 · 1440 (most severe), also 768
- **Evidence:** ~7 findings + all 3 walkers across Spotify / Add-a-Festival / Export-Likes / Day-Image drills and the Settings hub. Screenshots (1440): F13-01 Spotify = a "Connect my Spotify" pill in a card pinned top with ~700px void below (literally F13's named "floating button in a void"); F14-01, F14-02, F12-01 show the identical void. F11-01 Settings home overflows past the fold (dense home fills, short drills don't). The 768 walker's prose called Spotify a pass but its own screenshot shows the same void — visual evidence wins.
- **Description:** `#settings-root` (index.html:169) is inline `max-width:560px; margin:0 auto` with no min-height, vertical centering, or `@media` step at any breakpoint — grep finds ZERO CSS rules for settings-root/screen-settings anywhere, so that inline style is the complete layout, shared by the dense Settings home (which fills it) and every short sub-drill (which don't). `--shell-max` is 960/1080px vs settings' 560px, so the wall fills ~2× the canvas the drills leave empty. Reads as unfinished/broken; the single spec-named-verbatim desktop violation. Files: index.html:169 (+ js/v3/settings.js, js/v3/tools.js drill scaffolds).

### 3.2 — Desktop set-times grid is not full-bleed — CSS re-caps content near shell-max, forcing avoidable horizontal scroll
- **Severity:** P2
- **Flow / viewport:** F5 · 1440
- **Evidence:** 3 sources. `.times-scroll` clientWidth measured 1040px inside a 1440px viewport, re-measured on both Electric Forest and Lollapalooza. Screenshot `1440/F5-03-ef-wall-top-settimes-grid.png` shows six stage headers with a 7th column clipped at the scroll boundary and obvious unused page margin both sides.
- **Description:** `.times-wrap` breaks out to `width:100vw` then pads back with `padding-inline: max(--sp-gutter, calc(50vw - --shell-max/2))` (assets/v3.css:308-315). Once the viewport exceeds `--shell-max` (1080px) the second term wins and pins the content box at exactly shell-max regardless of window width. Worked example at 1440: content box = 1080px, `.times-scroll` = 1040px. Electric Forest = 6 stages + EVERYTHING ELSE = 7 columns at `minmax(150px,1fr)` (~1074px) — so it scrolls even though 7 columns fit comfortably in a 1440px window. The wrapper background bleeds edge-to-edge but the usable grid does not; forces ~188px of scroll to reach EVERYTHING ELSE despite ~304px unused margin. Contradicts F5 ("desktop shows as many columns as fit the window"). The CSS comment flags this as "DT-5, the run's one aesthetic risk" — plausibly an idiom-collision bug as much as a deliberate call. Files: assets/v3.css:305-315 (+ v3-tokens.css:71,77 `--shell-max`).

### 3.3 — Onboarding/entry screens (landing, create, join) are centered-narrow, not composed for width
- **Severity:** P3
- **Flow / viewport:** F1/F2/F3 · 1440 (primary), 768
- **Evidence:** 2 findings + all 3 walkers unprompted. At 1440 the F2 "Pick the fest" list is clipped (ACL '25 cut off at the bottom edge, more past fests below → scroll) while 768 shows the whole 11-row list with room to spare — same column width.
- **Description:** Landing, Create, and Join share `.center-col`, capped at `max-width:480px`, bumping only to 560px at ≥720px (index.html:42-44) — a ~17% width increase across the full 390→1440+ range, leaving ~460px empty margin each side at 1440. **Verifier caveat (kept faithfully):** this is partly conformance, not a violation — the design system documents the centered-column + fluid-type treatment as the intended desktop direction (v3-tokens.css:63-64), the per-flow spec endorses a centered column for F1/F2/F3, and the "no dead space" demand is scoped only to F4/F5. Type does scale (headline `clamp(30px,5vw,44px)`, +47%). So this is a genuine design-DIRECTION opportunity worth surfacing (esp. the minor F2 clip-at-1440), not a compliance bug — hence P3. File: index.html:42-44.

---

## CLASS 4 — Keyboard & assistive tech can't reach or perceive what mouse/sighted users can
**Root pattern:** interactivity and rich visual state are expressed only via mouse and pixels — non-semantic elements given click handlers, focused nodes replaced without focus restoration, and crew/notes/Spotify state never folded into accessible names or state. Largest a11y cluster; three of these are P2. WCAG 1.1.1 / 1.3.1 / 2.1.1 / 4.1.2.

### 4.1 — Keyboard pick-cycling destroys focus on every keypress — the card node is replaced, not patched
- **Severity:** P2
- **Flow / viewport:** F4/F5 · all
- **Evidence:** Code-traced (single source); not live keyboard-tested this run (no walker exercised real Tab+Enter). `handleTap`'s second `el` arg is passed but unused; `el.replaceWith(fresh)` is the last step with no `focus()` call.
- **Description:** Enter/Space on a focused card cycles the pick correctly, but `refreshCard` rebuilds the accessible name via `el.replaceWith(fresh)` (wall.js:183-195) with no focus restore anywhere in the tap path (the only `.focus()` in app.js is line 399, unrelated). When a focused element is removed, the browser moves focus to `<body>` — so a keyboard-only user loses focus after every keypress: reaching 'must' (4 taps) requires re-Tabbing from page top four times per artist, and the aria-label state change goes unannounced. Affects both grids (shared `renderCard`/`handleTap`/`refreshCard`). Defeats the code's explicit AX-1 keyboard-first design. Mouse/touch unaffected — P2 on blast radius. File: js/v3/wall.js:183-195 (+ app.js:61-89).

### 4.2 — "Archived · N" festival-disclosure toggle has no interactive semantics — keyboard/SR users can't reach any scheduled or archived festival
- **Severity:** P2
- **Flow / viewport:** F5/F11 · 390, 768
- **Evidence:** 4 sources; both 390 and 768 walkers confirmed via accessibility-snapshot/DOM inspection that it's a plain div, not a `role=button` with `aria-expanded`.
- **Description:** In Settings, the only path to scheduled/archived fests (Electric Forest, Lollapalooza — the app's own set-times demos, both `status:archived` with real 4-day schedules) is a disclosure row built as a plain `<div>` with a click handler and `cursor:pointer` (settings.js:169-182) — no `role=button`, no `tabIndex`, no `aria-expanded`; the `el()` helper adds no attributes. The archived rows render only inside a `display:none` list (stripped from the a11y tree). Net: keyboard/SR users can neither operate the toggle nor reach what it reveals — a hard dead-end, and it gates the entire set-times switcher for these users. Notably the lone plain-div interactive element in a file where `linkRow`/`festRow`/`toggleRow` are all real `<button>`s ("A real button (AX-7)" comment) — an isolated regression, not a taste call. Also excluded from the 44px coarse-pointer expansion (~19px effective). File: js/v3/settings.js:169-182.

### 4.3 — Artist-card accessible name conveys only YOUR own pick level — crew who-picked, note count, Spotify badges invisible to AT
- **Severity:** P2
- **Flow / viewport:** F4 · all
- **Evidence:** Code-evidenced. Cross-referenced wall.js:64-65 (label) vs :101-116 / :158-172 (visual-only corners) and aura.js:49-97.
- **Description:** `renderCard`'s aria-label is built entirely from the current user's own selection (wall.js:64-65: `${artist} — ${myLevel}`). The card is `role=button` with an explicit aria-label (overrides name-from-contents) and carries ARIA Children-Presentational, so the who-corner of other members' pills/ticks, the note-count chip, and the Spotify-affinity chip are all stripped from the accessibility tree — none folded into the accessible name or `aria-describedby`. For an app whose core value is seeing your crew's picks alongside your own, a screen-reader user hears only their own status per card ("2 crew have this as a must" / "this artist has notes" are inaudible without opening every sheet). The only partial mitigation, the pencil affordance, announces "Notes for <artist>" but never a count or crew data. File: js/v3/wall.js:64-65.

### 4.4 — Note-count badge is a click target with no button semantics, unlabeled, nested inside another interactive element
- **Severity:** P3
- **Flow / viewport:** F6 · all
- **Evidence:** Code-evidenced.
- **Description:** When a card has notes, its count chip becomes clickable to open that artist's notes sheet (wall.js:110-114) on a plain `<span>` — no `role=button`, no `tabIndex`, no `aria-label`, no `title`; its only content is a bare number, and the card's explicit aria-label overrides child text, so even the number is unannounced. Nested inside the card's own `role=button`. Not a hard blocker — the pencil `.note-affordance` (correct aria-label, `:focus-visible`) and mobile long-press reach the same sheet — but this specific shortcut is a dead end for keyboard/AT. File: js/v3/wall.js:110-114.

---

## CLASS 5 — Computed failure/status/provenance info is dropped at the UI boundary
**Root pattern:** the code computes misses / sources / error causes and then the handler discards or mis-labels them before the user sees them — violating the app's own codified "report every skip" principle (bulk paste explicitly reports unknownPeople/unknownArtists/badLines, tools.js:63-90). Fixes are mostly one-line surfacing of already-computed values.

### 5.1 — F12 research preview never shows sources — the grounding-citation feature is silently absent in production
- **Severity:** P2
- **Flow / viewport:** F12 · 390, 768, 1440
- **Evidence:** 3 audit runs + 2 fresh verification runs = 5/5 zero-source (Coachella 2025: 145 artists/0 sources; Primavera 2026: 109/0). 768 confirmed via `body.innerText` (substring "source" absent); 1440 independently confirmed.
- **Description:** Spec F12 requires the preview to show "name, year, dates, sample artists, sources." The client renders a "Sourced from …" line only when `body.sources` is non-empty (settings.js:262-268, intentional — "0 sources as a trust marker was worse than nothing"); the server extracts sources from Gemini grounding metadata (guard.mjs:49-51). In every live run, zero sources came back, so the line never renders — and because the UI shows nothing (rather than "0 sources"), it reads as a working feature while the "grounded research, verify before you trust it" promise is non-functional every time. Could be a Gemini-grounding gap or a code issue; either way the required content is consistently missing. Files: js/v3/settings.js:262-268 (+ api/_lib/guard.mjs:28-52).

### 5.2 — Playlist creation silently drops the 'misses' count — the UI never reports artists it couldn't find a track for
- **Severity:** P2
- **Flow / viewport:** F13 · n/a
- **Evidence:** Code-evidenced. `playlistFromPicks` (spotify.js:200-233) returns `{ url, trackCount, misses }`; the sole caller (settings.js:855) doesn't capture the return and shows a flat "Playlist created in your Spotify." (:860); grep finds no other consumer of `.misses`.
- **Description:** A crew with 12 picks where 3 artists had no searchable track gets a flat success message with no indication 3 picks are missing. The `throw` at spotify.js:216 guards only the all-miss case, so partial misses fall through silently. Breaks the app's own "skips are always reported" principle; one-line fix to surface an already-computed value. File: js/v3/settings.js:845-863.

### 5.3 — Join screen's fallback error "try a different name" is shown for any server failure, not just name conflicts
- **Severity:** P3
- **Flow / viewport:** F3 · n/a
- **Evidence:** Code-evidenced. Verified against api/crew.js: every app-generated error path (403/500/400/404/413) sets a JSON `error` field, so the fallback fires only when the response is non-ok AND the body isn't the handler's JSON.
- **Description:** `renderJoin`'s join-add handler does `status.textContent = body.error || "Couldn't join — try a different name."` (app.js:718-729) with body from `res.json().catch(()=>({}))`. The fallback only fires on Vercel platform failures (504 timeout, 502, crash) returning HTML/text — a plausible cold/slow Neon function timeout — where the name is irrelevant, so "try a different name" is wrong advice in 100% of cases it fires. (A true network throw hits the outer offline-first catch, not this line.) Narrow, transient, fully recoverable → P3. Fix: branch on `res.status` or use neutral "try again" copy. File: js/v3/app.js:718-729.

### 5.4 — Create-crew flow surfaces raw fetch/browser error text instead of the app's plain-language error style
- **Severity:** P3
- **Flow / viewport:** F2 · n/a
- **Evidence:** Code-evidenced.
- **Description:** `createCrewFlow()` on failure sets `status.textContent = String(e.message||e)` (app.js:428). `crew.createCrew()` wraps the server's JSON error only for non-ok responses (crew.js:88-91); a genuine network failure (offline, DNS, CORS) makes `fetch()` reject with raw jargon like "Failed to fetch" shown in `#create-status`. The festival-add sibling (settings.js:306-310) shows plain language — but so do the Spotify handlers use the identical raw pattern, so this is one of two coexisting styles, not a lone outlier. Cosmetic, non-blocking (finally re-enables the button), network-failure-only → P3. File: js/v3/app.js:402-432.

---

## CLASS 6 — Spotify auth flow is fragile at its edges
**Root pattern:** the OAuth return path loses its re-open flag and never surfaces banked errors on the canonical domain, and the token-refresh path doesn't discriminate transient from fatal failures — so the app's stated in-app failure handling and self-healing posture don't hold in the ordinary cases. Bounded to an optional feature, recoverable by manually reopening → all P2/P3.

### 6.1 — Spotify OAuth return (success AND failure) doesn't reopen the drill or surface the banked error on the primary domain
- **Severity:** P2
- **Flow / viewport:** F13 · n/a
- **Evidence:** Live-reproduced: navigated `/spotify-callback?error=access_denied` with Audit Rig active → landed on the plain wall, hash bare `#g=`, `sessionStorage fn_spotify_error='access_denied'` present but never surfaced (no toast/banner; screenshots/spotify-error-silent.png). Success-path gap confirmed symmetrically by code.
- **Description:** `connect()` stamps `returnTo=location.href` (spotify.js:62), but on the canonical domain `enterApp` has already `replaceState`'d the URL to bare `/#g=<token>` (app.js:812) and the router never re-adds `sp=1`, so `returnTo` carries no `sp=1`. `spotify-callback.html` success does `replace(returnTo||'/')` and failure `replace('/')` unconditionally, so `pendingSpotifyOpen` (=`/[#&]sp=1/`, app.js:873) is false on both branches and the auto-reopen (app.js:818-824) never fires. On failure, `spotify.lastError()` is read only inside `openSpotifyDrill` (settings.js:732) — never at boot — so the reason is banked but never shown. Contradicts F13 and the callback's own stated intent (spotify-callback.html:20-22). The auto-reopen-on-return actually fires on no path, so the defect is broader than "kept only for the alias-hop flow." File: js/spotify.js.

### 6.2 — A transient Spotify token-refresh failure (5xx/rate-limit) permanently disconnects a valid session instead of allowing a retry
- **Severity:** P2
- **Flow / viewport:** F13 · n/a
- **Evidence:** Code-evidenced. `spotify.js:103` `if(!res.ok){ disconnect(); throw ... }` branches only on `!res.ok`, no status-code discrimination.
- **Description:** `accessToken()` (spotify.js:94-111) treats ANY non-ok response from the token-refresh endpoint as fatal, wiping localStorage's auth record (and, via `disconnect()`, the cached library scan `LS_LIBMAP`) even for transient 5xx/429 — throwing away a perfectly valid, unexpired refresh_token and forcing the full PKCE dance + a full re-scan. Since refresh is routine (any session returning >~59min after last grant), during any Spotify auth-service blip every returning crew member in that window is permanently disconnected despite holding a valid token. (A true network throw doesn't reach line 103 — only HTTP 5xx/429 responses do.) Correct fix: disconnect only on 400/401; surface a retryable error on 5xx/429. No crew doc data at risk → P2. File: js/spotify.js:94-111.

### 6.3 — Service worker's offline fallback for /spotify-callback can't match the real OAuth-redirect request (query-string mismatch)
- **Severity:** P3
- **Flow / viewport:** F13 · n/a
- **Evidence:** Code-evidenced. SW:45 caches `/spotify-callback` with no query; SW:104 offline fallback uses `caches.match(request)` (exact-URL, no `ignoreSearch`).
- **Description:** The real return request `/spotify-callback?code=…&state=…` fails exact-URL match, falls through to `caches.match('/')`, and boots the plain shell instead of running `completeAuth()` — the OAuth code is abandoned with no error shown. Very narrow (SW installed AND network dropping exactly during the redirect leg), and even a "fixed" path can't succeed offline (`completeAuth`'s cross-origin token fetch fails offline) — the real benefit is only a better failure message. File: service-worker.js:45.

---

## CLASS 7 — Join screen under-communicates to the cold invitee (the realistic first surface)
**Root pattern:** the join view — reached via a shared link, the first screen most invitees see — omits both fest context (for links minted before the FLOW-1 fix, which is not yet deployed) and app identity/trust framing. F3 is a P0-elevated flow; "one crew spans many fests" makes the degradation recurring for any distributed link.

### 7.1 — Join screen shows only the crew name — no festival context — for any already-circulating invite link (FLOW-1 fix not deployed)
- **Severity:** P1
- **Flow / viewport:** F3 · 390, 768, 1440
- **Evidence:** 2 sources; every walker at every viewport hit the fallback on the actual audit link (`#g=…`, no `&f=`): join reads only "YOU'RE INVITED TO / Audit Rig" with no fest name/color/dates. Re-verified with a localStorage-cleared fresh navigation.
- **Description:** Spec F3 requires "crew + fest context." `renderJoin()` (app.js:655-671) renders fest name/color/dates only when the URL carries `&f=` OR the crew doc has a fresh `doc.meta.inviteFestId`; that stamp is written only at crew creation or Share-invite (app.js:454-458 / settings.js:104-116), never backfilled and not kept in sync on fest switch. **Key correction:** a backfill DOES exist but only in local HEAD `150c044` ("fix(FLOW-1): heal pre-fix crews", committed today 00:15) — one commit AHEAD of and unpushed to `origin/v31-polish` (@ cc37d7d, the branch the preview serves), which contains NO backfill. So the actionable item is **push + redeploy**, not "write a backfill." Residual after deploy: a fresh invitee never triggers the heal (`crew.me` false on a fresh device), so a never-healed cold doc still renders the fallback — a much narrower edge than the current all-pre-fix-crews-broken state. (Could not read the live doc's `inviteFestId` directly — preview behind Vercel SSO; see Coverage gaps.) File: js/v3/app.js:655-671.

### 7.2 — Join screen carries no app identity/branding — a cold-linked stranger has no trust signal
- **Severity:** P3
- **Flow / viewport:** F3 · 390, 768, 1440
- **Evidence:** Compared F1 landing (wordmark + tagline, index.html:58-60) vs F3 join (no app name/logo/tagline, index.html:105-121) across all viewports.
- **Description:** The landing screen shows a full "FESTIVAL NAVIGATOR" wordmark + tagline; the join screen — realistically the first surface for a link-invited stranger — shows only the fest name (present), crew, invite frame, and a name prompt on a bare dark background, with no app wordmark, logo, or tagline. For someone opening a link from a text/Slack message, nothing establishes what the app is or that it's safe/free/accountless. (Faithful correction: the finding's "tells a first-timer almost nothing" overstates it — fest context IS shown; what's genuinely absent is app identity/trust framing.) Chrome-level `<title>`/favicon are unreliable in a mobile webview. Additive brand-consistency + onboarding-trust polish → P3. File: index.html:104-121.

---

## CLASS 8 — Hardcoded literals bypass the v3 token & fluid-scale system (several are stale AX-3 misses)
**Root pattern:** color/size literals or static tokens used instead of context-aware tokens or the fluid `clamp()` scale, against the project's "look values up, never invent them" rule — and in two cases the literal was simply missed by the AX-3 accessibility sweep. All one-line fixes.

### 8.1 — Ghost overflow '+n' badge is the one card element left non-aura-aware; its contrast fails against bright auras
- **Severity:** P3
- **Flow / viewport:** F4 · all
- **Evidence:** Code + computed-contrast evidence.
- **Description:** `.mark.ghost` (v3.css:77-78) uses static `color:var(--text-secondary)` (#8E86A8) on a transparent background; wall.js:162-168 deliberately skips the inline scrim that musts/picks get. The '+n' badge only appears when `overflow>0` (3+ pickers), which guarantees a saturated multi-layer aura beneath it (aura.js:22-24) — yet every other card text flips to white (`nameColor`/`subColor`) for exactly this reason (AX-3 history in a comment). Computed contrast of #8E86A8 on a real 'must'-alpha fill like `hsl(42,90%,62%)` is ~2.06:1 (drops to ~1.4:1 over a composited half-alpha), under the 3:1 floor. Fix: make the ghost white/scrimmed like the other marks. (Two harmless description nits: trigger is 3+ not "5+"; the dark dashed border is high-contrast on bright fills, not near-invisible.) File: assets/v3.css:77-78.

### 8.2 — Day-image PNG export hardcodes the AX-3-retired, contrast-failing color #5D5578
- **Severity:** P3
- **Flow / viewport:** F14 · all (offscreen 1080px canvas)
- **Evidence:** Code-evidenced. `tools.js:158` is the ONLY remaining *use* of #5D5578 in the repo (grep); the sibling in aura.js:82 was correctly migrated to #877FA4.
- **Description:** `tools.js:158` hardcodes `color:#5D5578` on the credit line of the html2canvas export node (bg #0C0A14). v3-tokens.css:24-27 documents #5D5578 as the pre-AX-3 value at "2.84:1 on --page — failed AA," superseded site-wide by `--text-tertiary` #877FA4. Because html2canvas can't resolve CSS custom properties, tools.js hardcodes literals — and this one was never updated when AX-3 shipped, so every shared Day-image PNG ships its credit line at 2.84:1. Affected element is a de-emphasized footer attribution ("CREW · FESTIVAL NAVIGATOR"), the lowest-priority text on the artifact → P3. Fix: #5D5578 → #877FA4. File: js/v3/tools.js:158.

### 8.3 — Boot-error screen's headline is the one place `.brand`'s fluid clamp is overridden to a fixed 34px
- **Severity:** P3
- **Flow / viewport:** F16 · all, most visible ≥720px
- **Evidence:** Code-evidenced. The only headline in index.html with an inline `font-size` override.
- **Description:** `.brand` is `clamp(42px,5.5vw,54px)` (index.html:47); `#screen-error` reuses `.brand` but pins `font-size:34px` inline (index.html:191), frozen 390→1440+. At wide widths the error headline stays 34px while siblings reach 44px (`.screen-headline`) and 54px (`.brand`) — the smallest, non-scaling entry-screen headline, on the one screen that most needs legibility. (Faithful nits: "smaller than siblings on mobile" is half-wrong — at 390 it's larger than the 30px-floor `.screen-headline`; and 34px may be a deliberate fit for the two-line "WELL, THAT / WASN'T THE PLAN" copy.) Cosmetic, rarely-seen boot-error screen, one hardcoded magic px against the "look values up" rule → P3. File: index.html:191.

---

## CLASS 9 — Single-line truncation with no recovery path
**Root pattern:** `nowrap`/ellipsis (or line-clamp) applied with no `title` tooltip, tap-to-expand, or width validation — so text is clipped and the rest is permanently unreadable. Full names/dates are preserved in `aria-label`/data, so these are sighted-user legibility nits.

### 9.1 — Current-fest date/description text truncates mid-word with no way to read the rest
- **Severity:** P3
- **Flow / viewport:** F11 · 390, 768, 1440
- **Evidence:** Visible at all three viewports (differing only in how much text survives).
- **Description:** The current-fest card's dates span (settings.js:81, `nowrap`/`overflow`/`ellipsis`, `flex:1; min-width:0`, no `title`) clips mid-word — e.g. Lost Lands' `dates` (130+ chars) truncates its "separately-billed Early Arrival pre-party runs Wed Sept 16 and Thu Sept 17" clause. Persists at 1440 because `#settings-root` is capped at 560px (index.html:169), giving the span ~340px vs the ~780px needed; no `title` or tap-to-expand. Non-current fests below use `-webkit-line-clamp:2`, so the prominent current-fest card truncates harder than the secondary rows. Supplementary info, long-dates-strings only → P3. File: js/v3/settings.js:81.

### 9.2 — Same-stage lane-split cards (real time overlaps) truncate artist names hard at ~91px, legible only via aria-label
- **Severity:** P3
- **Flow / viewport:** F5 · 1440 verified; same at 390/768
- **Evidence:** Live-verified on Lollapalooza (4 `calc(50%-2px)` cards; screenshots/F5-lanes-lollapalooza.png) — closed a coverage gap no walker's fest exercised (see Coverage gaps).
- **Description:** F5.2 same-stage overlap lane-splitting (overlap.js `computeLanes`, wall.js:370-387) works correctly, but at ~91px (half a ~184px column) `.card.cell .name` (v3.css:53, nowrap/ellipsis) truncates e.g. "The Droptines" → "The Dropt…". Full name is preserved in aria-label, so it's a sighted-user nit, not data loss. (Faithful nit: on a narrow viewport the column floors at the 150px `minmax` minimum → ~73px lane, marginally worse on mobile, not equal.) File: assets/v3.css:53.

---

## CLASS 10 — Client-side screen transitions don't reset/cancel prior-screen state
**Root pattern:** `show(screen)` hides screens via `display:none` (app.js:323-327) without clearing `document.title` or cancelling pending gesture timers, so prior-screen state leaks across an in-app transition (no full reload to reset it).

### 10.1 — Browser tab title goes stale on the bad-#g=-token lost state when reached via in-app navigation
- **Severity:** P3
- **Flow / viewport:** F16 · 390 (live test)
- **Evidence:** Live-verified via Playwright.
- **Description:** The only `document.title` assignment (app.js:108, inside `applyFestTheme`) is gated to a successful fest render; `renderBadLink` (app.js:833) never resets it. When an already-rendered wall's `#g=` token stops resolving without a full reload (hashchange → boot → renderBadLink), the "HMM. THAT LINK DIDN'T WORK" content renders but the tab keeps "<previous fest> — Festival Navigator". A cold load of the same bad token correctly shows the generic title (static `<title>`). Reachable via URL-fragment edit or tapping a since-deleted remembered crew. Cosmetic/a11y (tab title + SR tab announcement), niche mid-session trigger → P3. File: js/v3/app.js:108.

### 10.2 — Long-press note-sheet timer isn't cancelled by a screen change — a held finger can pop a notes sheet over Settings/Landing after the fact
- **Severity:** P3
- **Flow / viewport:** F6/F10/F13 · n/a
- **Evidence:** Code-evidenced; not live-reproduced (needs multi-touch or winning the async `onCrewGone` race).
- **Description:** The card long-press (wall.js:137-146) starts a 500ms timer on pointerdown guarded only by `if(!el.isConnected)return` — which covers node DETACHMENT (the repaint/refreshCard path) but NOT the `display:none` screen-hide path. If a transition happens mid-gesture (most plausibly `onCrewGone` → `renderLanding`, an async network race, which runs no `repaintWall` and no timer clear), the timer fires at 500ms and appends a `position:fixed` notes sheet + backdrop over the landing screen, plus a phantom `router.push('sheet:notes:…')` history entry. Non-destructive, dismissible, corner-of-a-corner trigger → P3. File: js/v3/wall.js:137-146.

---

## CLASS 11 — Static copy not conditioned on count/device/audience
**Root pattern:** strings written for one state (plural, touch, festival insider) rendered unconditionally in all states.

### 11.1 — Pick-count copy is never pluralized — reads "1 artists picked"
- **Severity:** P3
- **Flow / viewport:** F11 · 768, 1440 (visible when a fest's count was 1)
- **Evidence:** 3 sources; 768 via accessible name, 1440 on-screen.
- **Description:** Two call sites build `${count} artists picked` with a hardcoded plural and no `===1` branch: settings.js:130-131 (current-fest pill, renders unconditionally) and settings.js:153-154 (other-fest rows). A fest with exactly one pick reads "1 artists picked" on the highlighted current-fest card. Purely cosmetic grammar paper-cut → P3. File: js/v3/settings.js:130-131,154.

### 11.2 — ALL NOTES empty-state copy tells every viewport to "long-press any artist" — a gesture desktop pointer-fine users don't have
- **Severity:** P3
- **Flow / viewport:** F8 · desktop
- **Evidence:** Code-evidenced (no device branching).
- **Description:** The ALL NOTES empty state reads unconditionally "No notes yet — add the first above, or long-press any artist." (notes.js:354-356). Long-press is the explicit mobile idiom (wall.js:129); desktop pointer-fine users get a hover ✎ pencil (gated by `@media (hover:hover) and (pointer:fine)`) and a clickable count chip the copy never mentions — contradicting the app's own DT-6 intent. (A desktop mouse held 500ms technically does fire it, so it's non-idiomatic/undiscoverable rather than strictly absent.) Primary CTA is present → copy/context polish, P3. File: js/v3/notes.js:354-356.

### 11.3 — Wall opens on "Billing" / "Billing order" jargon with no inline definition
- **Severity:** P3
- **Flow / viewport:** F4 · 390, 1440
- **Evidence:** Screenshots show the label with no tooltip and no "Billing" entry in the legend.
- **Description:** The default sort is "Billing▾" (app.js:28) and, for a dayless lineup fest, the subheading reads "THE LINEUP · BILLING ORDER" (wall.js:506) — both on the first wall a joiner sees. "Billing order" is festival-industry terminology (poster prominence) outside the sanctioned UI vocabulary (picked/must/notes/fest); the "HOW IT WORKS" legend (settings.js:316-366) teaches badges/pins/chips but never the sort term, and the chip carries no `title`. Strong deflator (kept faithfully): the default sort works with zero comprehension — a user who doesn't know the term just sees a sensible poster order and never opens the menu → floor P3. The robust universal instance is the "Billing▾" chip (the subheading string is conditional on a dayless fest). File: js/v3/app.js.

---

## CLASS 12 — Data, schema, validator, authoring-contract & standards hygiene
**Root pattern:** catalog files, docs, and app config carry dead, unread, un-validated, or nonconforming fields, and write-time validation has gaps — mostly invisible to users (a couple have minor visual symptoms). Groups the festival-data/schema hygiene findings plus the one web-standards config gap. All P3; low-to-no real-user impact, but each is a real code/data-verifiable inconsistency worth a hygiene pass.

### 12.1 — add-a-festival.md instructs authors to write a dead top-level `stages[]` on every scheduled festival
- **Severity:** P3 · **Flow:** F5 (authoring contract) · n/a
- **Evidence:** grep of js/*.js + api/*.mjs returns only per-day `dayData.stages`/`day.stages` usages; both EF and Lolla JSON carry a byte-identical dead top-level `stages` key.
- **Description:** docs/add-a-festival.md:32 says "add stages, dayMeta, and days{}" as parallel top-level siblings, but the renderer (wall.js:311 `dayData.stages`) and validator (festival-rules.mjs:81/86 `day.stages`) only ever read the PER-DAY nested `fest.days.<day>.stages[]`. `dayMeta` and `days` ARE legitimately top-level — only `stages` is misplaced, and it's baked into the doc + example file so every future scheduled fest repeats it. File: docs/add-a-festival.md.

### 12.2 — fest.meta research provenance (sources, note, announcementStatus) is invisible for every already-saved catalog festival
- **Severity:** P3 · **Flow:** F12 · n/a
- **Evidence:** `loadFestival()` keeps `meta` in memory but no renderer reads `.meta.sources/.note/.announcementStatus`; provenance surfaces only in the live add-preview (settings.js:263) and a separate `source_urls` DB column.
- **Description:** 6 of 11 committed festival files carry a top-level `meta` with `announcementStatus`, `researchedAt`, `sources[]`, and a free-text `note` of corrections/caveats (e.g. ACL 2026's KVUE OCR-typo correction). Once a candidate graduates into `data/festivals/*.json`, its sources and research caveats are permanently inaccessible in-app. Reads as maintainer authoring metadata by design → latent provenance-hygiene, P3. (Faithful correction to the finding: `fest.status` IS read extensively — the "redundant with status, also never read" parenthetical is wrong; the drift concern stands.) File: data/festivals/*.json.

### 12.3 — `isScheduled()` is dead code whose logic disagrees with the renderer's own inline check
- **Severity:** P3 · **Flow:** F4/F5 · n/a
- **Evidence:** grep for `isScheduled` across the repo returns ONLY the definition.
- **Description:** `js/festivals.js:70-74` exports `isScheduled(fest)` gated on `status==='archived'||'scheduled'` AND non-empty days, with zero call sites. The renderer computes its own notion inline with no status check: `const scheduled = fest.days && Object.keys(fest.days).length` (wall.js:432, duplicated at tools.js:177, app.js:161, app.js:196). The validator enforces the days{} block only when `status==='scheduled'`, so a `lineup`-status doc carrying a populated days{} passes validation and renders the grid while `isScheduled()` returns false — a latent trap for whoever wires it in. File: js/festivals.js:70-74.

### 12.4 — Validator doesn't check `activities[].time` format, but the renderer's sort assumes the exact H:MM AM/PM shape
- **Severity:** P3 · **Flow:** F5 · n/a
- **Evidence:** `validateFestivalDoc` applies `TIME_RE` to scheduled-artist times (festival-rules.mjs:87) but only checks truthiness for activities times (line 99); `activityMinutes` (time.js:27) has no NaN guard.
- **Description:** Any string passes activities validation ("Sunrise", "All day"); the "everything else" column sorts by `activityMinutes(...)` which yields NaN for non-conforming times, scrambling order with no validation error and no crash. Current data is clean (all 34 EF activities conform). Reachability is narrower than stated — the research prompt never requests activities, so they enter only via committed static JSON (validated by this same gap-having validator) or an arbitrary client body. A genuine write-time validation gap (per CLAUDE.md's "validate at write time"), symptom cosmetic and not currently manifesting → P3. File: api/_lib/festival-rules.mjs:95-102.

### 12.5 — lost-lands-2026: 96 of 117 artists have no day; the 21 that do use long uncapped sentence labels, and the validator never caps `artists[].day`
- **Severity:** P3 · **Flow:** F4 · n/a
- **Evidence:** day-value counts confirmed; festival-rules.mjs:28 cap list omits `day`; wall.js:254 uppercases with no truncation; `.day-rule .day` (v3.css:139) has no nowrap/ellipsis/max-width.
- **Description:** Only the 21 pre-party acts carry a day, each a 44-char sentence like "Wednesday, Sept 16 (Early Arrival Pre-Party)"; the other 96 land in the ''/"THE LINEUP" bucket. The source looks intentional (poster doesn't day-split the main bill), but the validator's length caps bound name/year/subtitle/location/dates/accent and never bound `artists[].day`, and `dayHeader()` uppercases with no truncation on a strip designed for short weekday names — so a ~350px all-caps label wraps to 2-3 lines and collapses the flex hairline on mobile. Cosmetic (text wraps, no overflow, grouping/picks still work) → P3. File: data/festivals/lost-lands-2026.json.

### 12.6 — lollapalooza-2025 has no dayMeta, so its day headers show blank dates — inconsistent with the sibling scheduled festival
- **Severity:** P3 · **Flow:** F5 · n/a
- **Evidence:** EF dayMeta complete; Lolla has no dayMeta key; `dayRuleSub(undefined)` returns '' (wall.js:275-278).
- **Description:** electric-forest-2026 shows "Thu · Jun 25"; lollapalooza-2025 (the only other days{}-based fest, `status:archived`, rendered via the days-presence gate at wall.js:432 and reachable through the F11 fest-switcher) shows just "THURSDAY"/"FRIDAY" with a blank date line. Nothing synthesizes dayMeta from the weekday keys; no validator rule requires dayMeta for a days-bearing fest (the scheduled-validation block is gated on `status==='scheduled'`, which archived Lolla skips entirely — the real reason it goes unvalidated). Day label is still identified; only the date is missing → cosmetic P3. File: data/festivals/lollapalooza-2025.json.

### 12.7 — `dayStartHour` — a top-level field on 2 of 11 festival files — is referenced nowhere in code or docs
- **Severity:** P3 · **Flow:** F5 · n/a
- **Evidence:** Repo-wide case-insensitive grep = zero code reads; js/time.js hardcodes the 9 AM boundary instead of reading the field; validate-festivals.mjs runs clean.
- **Description:** electric-forest-2026 and lollapalooza-2025 carry a top-level `dayStartHour` read by no renderer, checked by no validator, unmentioned in docs — an orphaned leftover from a pre-v3 schema. User-invisible dead data → P3. File: data/festivals/electric-forest-2026.json.

### 12.8 — portola-2026's one stage-tagged artist is dead data because the fest is `lineup`, not `scheduled`
- **Severity:** P3 · **Flow:** F4 · n/a
- **Evidence:** Full-catalog audit: portola-2026 is the ONLY lineup-status fest with a stage-tagged artist.
- **Description:** **Description correction (important):** the stage:"Warehouse" belongs to **Tiësto** (line 142), NOT Despacio — the source finding conflated two entries. Despacio has `day:"Saturday & Sunday"` and no stage. Underlying defect is genuine: portola has no `days` object so `renderWall` takes the lineup path, where `applySort`/`applyFilter`/`groupByDay`/`renderCard` never read `.stage` (stage is only consumed via `computeDayArtists(fest.days[day])` and tools.js, both gated on `fest.days`). So Tiësto's stage tag is 100% inert. Data-hygiene wart → P3; the fix targets Tiësto, not Despacio. File: data/festivals/portola-2026.json.

### 12.9 — Missing standard `mobile-web-app-capable` meta tag — Chrome/Android deprecation warning on every page load
- **Severity:** P3 · **Flow:** F16 · 390 (live test)
- **Evidence:** index.html:12 has `apple-mobile-web-app-capable`; repo-wide grep for `name="mobile-web-app-capable"` returns zero matches. manifest.json is valid (installability unaffected).
- **Description:** index.html includes only the iOS-specific `apple-mobile-web-app-capable` tag; the standard `mobile-web-app-capable` tag Chrome/Android now expects is missing, producing a console-only deprecation warning on every load. Also explains 2 of the 3 console errors the 1440 walker flagged on the bad-token page (the 3rd is the expected `/api/crew` 404 for the fake token; a Vercel-insights 404 is preview-only). Console-only, never user-visible, one-line fix → P3. Grouped here as the app-config sibling of the schema-hygiene gaps. File: index.html:12-13.

---

## Coverage gaps

Flows or interactions that a walker skipped, could not exercise, or logged a false pass on this run:

1. **F15 (crew sync / offline) — skipped by all three walkers** (390, 768, 1440), each deferring to "a dedicated offline prober." Remote-sync *effects* were caught out-of-band via two-session live tests (findings 1.1, 1.2) and SW code-trace (6.3), but the F15 walker flow itself has **zero screenshot coverage at any viewport** — confirm the offline prober actually ran, or F15 has no evidence.

2. **Keyboard / screen-reader operation — not driven live this run.** No walker exercised real Tab+Enter or AT (all used click / DOM-query). The four a11y findings (4.1 keyboard focus, 4.2 Archived toggle, 4.3 artist-card aria, 4.4 note-count badge) and the day-nav aria gap (1.3) are code-traced, not live-AT-tested. A dedicated keyboard + VoiceOver/NVDA pass is recommended.

3. **Scroll-reset (finding 1.1) at 1440 — FALSE PASS.** The 1440 walker happened to tap a set-times card already at `scrollLeft=0`, so it did not exercise the bug and logged a pass. The scroll-then-tap interaction is unverified at 1440 (confirmed at 390 and 768; same code path applies).

4. **F9 scrollspy at 1440 — zero screenshots.** The 1440 walker logged F9(0). The day-nav highlight defects at 1440 rest on live-DOM queries, with no captured shots.

5. **F7 inline day/fest note composer at 390 — no dedicated screenshots.** The 390 walker skipped F7 shots, relying on the incidental F4-02 capture + an accessibility-snapshot text read. 768 and 1440 each have 1 F7 capture.

6. **F5.2 same-stage overlap / lane-split — no walker's test fest had a genuine time overlap.** Finding 9.2 was closed post-hoc on Lollapalooza only (screenshots/F5-lanes-lollapalooza.png); the primary walkers never exercised the overlap path.

7. **Live server state for finding 7.1 (`inviteFestId`) unreadable.** The deployed Audit Rig crew doc's `meta.inviteFestId` could not be read — the preview is behind Vercel SSO deployment protection (`/api/crew` 302-redirects to vercel.com/sso-api). The join-context defect is confirmed from deployed source (`origin/v31-polish` @ cc37d7d has no backfill), not from the live doc's actual stamp.

8. **Cross-viewport parity for the desktop-layout class (Class 3) at 768.** The 768 walker's prose called the Spotify drill a pass while its own screenshot showed the void; the void was weighted from the image. Worth an explicit 768 re-shot pass of all Settings sub-drills to confirm the intermediate breakpoint.
