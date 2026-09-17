# Design audit — Festival Navigator

**Run date:** 2026-07-11 · **Repo:** khglynn/festival-navigator · **Live:** kevinhg.com
**Spec walked:** `docs/user-flows.md` (F1–F16) · **Viewports:** 390 / 768 / 1440
**Method:** three parallel walkers drove the live app + audit crew "Audit Rig", each finding
verified against source and screenshots. Severities below are post-verification (several were
adjusted down from the walkers' first calls; the rationale is preserved in each finding).

## Severity summary

| Sev | Count | Meaning as applied here |
|-----|-------|-------------------------|
| P0  | 0 | Core-flow-blocking / data-destroying / crash-for-everyone. **None survived verification** — every candidate had a working fallback, self-heal, or was pointer-path-intact. |
| P1  | 13 | Serious, well-evidenced break of a spec invariant or a whole capability (an AT class, a viewport class, a Lost state), but recoverable and not universal data-loss. |
| P2  | 21 | Real, user-visible, code-verified spec/UX defect; degraded not broken, with a workaround. |
| P3  | 0 | — |

The findings are grouped into **eight problem classes**, each named by the *root pattern* that
produced it, not the symptom. Within a class, findings are ranked P1 before P2. The classes
themselves are ordered by how much of the core experience they compromise.

---

## Class A — Accessibility was never implemented (a sighted-pointer build)

**Root pattern:** the app assumes a mouse/touch user with full vision. There is no keyboard
route to any card, no focus indicator anywhere, no dialog/label/ARIA semantics, and the
smallest text and controls sit below WCAG floors. These are not scattered oversights — the
entire accessibility layer is absent, so every AT/keyboard/switch/low-vision user is blocked
or degraded on the core task. One systemic decision, six manifestations.

### A1 · Artist cards are keyboard-unreachable with zero ARIA — the core pick interaction is pointer-only
- **Severity:** P1 · **Flow:** F4/F5 (pick cycle), F6 (notes) · **Viewport:** 390/768/1440
- **File:** `js/v3/wall.js:53-129`
- **Evidence:** `renderCard` builds a plain `<div class="card">` whose only activation is a
  `click` listener (127) plus pointerdown/up long-press (97–108). Grep confirms zero
  `tabindex`/`role`/`aria-*`/`keydown` on cards; the only keydown handlers are notes-input
  Enter (notes.js:79) and document Escape (app.js:431), neither delegating to cards.
- **What is:** a keyboard/switch/voice user cannot tab to a card, see a focus ring, cycle a
  pick, or open notes on any viewport — a complete WCAG 2.1.1 (A) + 2.4.7 (AA) failure of the
  primary interaction. P1 not P0: this is a touch-first mobile-primary PWA already live to a
  small known crew whose dominant tap path works for effectively the entire real user base.

### A2 · Every text input strips `outline:none` with no replacement focus style
- **Severity:** P1 · **Flow:** F2/F3/F6–F8/F12/F13 · **Viewport:** 390/768/1440
- **File:** `assets/v3.css:61,98`; `index.html:74,93`; `js/v3/settings.js:176,399`; `js/v3/tools.js:84`
- **Evidence:** all 7 inputs (create-name, join-name, search-pill, note composer, add-festival
  name, Spotify Client ID, bulk-paste textarea) set `outline:none`; grep for `:focus` /
  `:focus-visible` / `:focus-within` across every CSS/HTML file (incl. compiled
  `tailwind.css`) returns zero. The only focus listener (app.js:400) merely hides the dock.
- **What is:** keyboard/switch/low-vision users get no visible focus indicator anywhere,
  including the crew-join name-entry gate — a system-wide WCAG 2.4.7 (AA) failure.

### A3 · `--text-tertiary` (#5D5578) fails WCAG AA contrast everywhere it carries real copy
- **Severity:** P1 · **Flow:** system-wide (F1, F5, F6–F8, F11) · **Viewport:** 390/768/1440
- **File:** `assets/v3-tokens.css:24`; `assets/v3.css:82,91,92,100,126,144,155-156,165,167,181`
- **Evidence:** independently recomputed WCAG contrast — #5D5578 on `--page` #0C0A14 =
  **2.84:1**, on `--card` = 2.70:1, on `--dock` = 2.87:1, all below the 4.5:1 AA floor (and
  below even the 3:1 large-text floor). Used in ~30+ declarations (12 in v3.css, ~20 inline in
  js/v3 + index.html) for real content at 9.5–12.5px: dates, note author/timestamp, inactive
  day tabs, section headers, list subtext, fest dates, set-times hour labels, composer
  placeholder. None qualify as WCAG "large text," so 4.5:1 applies throughout.
- **What is:** a systemic 1.4.3 (AA) failure on primary content, amplified by the real context
  — an outdoor PWA read in festival daylight, where low contrast is even more punishing.

### A4 · Bottom sheets have no dialog semantics or focus management
- **Severity:** P2 · **Flow:** F6, F8 · **Viewport:** 390/768/1440
- **File:** `js/v3/notes.js:93-129,137-173`
- **Evidence:** the `.sheet` appended to `document.body` has no `role="dialog"`, `aria-modal`,
  or `aria-labelledby`; no focus is moved in on open or restored on close; no focus trap /
  `inert` on the background. **Correction to the walker's headline:** Escape *does* close both
  sheets (document-level handler at app.js:431, missed by a notes.js-scoped grep), and
  backdrop-click dismisses — so it is not a trap. Downgraded P1→P2 for that reason.
- **What is:** SR users get no overlay announcement; a keyboard user can Tab into the still-live
  background behind the semi-transparent backdrop. Real but with two working dismissal paths.

### A5 · No `<label>` anywhere — identity, search, composer, and Client ID fields are placeholder-only
- **Severity:** P2 · **Flow:** F2, F3, F6–F8, F13 · **Viewport:** 390/768/1440
- **File:** `index.html:73-74,92-93`; `js/v3/notes.js:65-66`; `js/v3/settings.js:396`
- **Evidence:** repo-wide zero `<label>` elements; create-name, join-name, note composer, and
  Spotify Client ID carry only a placeholder, no `aria-label`/`aria-labelledby`/`title`. A
  1.3.1/3.3.2 (A) labeling gap. (Nuance: placeholder is a defined fallback accessible name most
  AT announces on focus, and one text input — search, index.html:119 — *is* correctly labeled,
  showing the gap is inconsistency not total absence — which is why P2 not P1.)

### A6 · Systemic mobile touch targets well under 44px, and dock day-tab labels clip mid-character at 390px
- **Severity:** P2 · **Flow:** F9, F11, F6 · **Viewport:** 390
- **File:** `assets/v3.css:117-134,28-37`; `index.html:110-111`
- **Evidence:** dock "jump to top" avatar 26×26 (v3.css:123), header gear ~27×27 (index.html:36),
  dock day tabs text-only ~15px tall (v3.css:125-128) — all real interactive controls under the
  44px target (day tabs under even the 24px AA floor). Separately, at 390 a wide `.fest-link`
  pill squeezes the center-justified `overflow-x:auto` `.days` container so THU/SUN labels clip
  to `IU`/`SI` (reproduced in two full-viewport shots: 390/F9-01, 390/F9-01c).
- **What is:** small targets plus unreadable day-nav labels on the flagship mobile width. (One
  bundled sub-claim corrected: on-card note/Spotify chips are plain non-interactive spans, not
  touch targets — notes open via long-press on the ≥64px card.)

---

## Class B — Desktop is stretched mobile; the spec's viewport-specific designs were never built

**Root pattern:** the spec's governing rule is "desktop (≥720px) is a designed experience, not
stretched mobile," with explicit desktop clauses per flow. The build ships one mobile column
re-centered on a wider canvas: no desktop day rail, no centered notes dialog, no type scale, no
grid densification, no hover affordance. Each item below is the same missing decision at a
different surface.

### B1 · Desktop (≥720px) has no day navigation at all — the spec's sticky day rail was never built
- **Severity:** P1 · **Flow:** F9 · **Viewport:** 768/1440
- **File:** `assets/v3.css:136`
- **Evidence:** the only day-nav is `.dock`, killed by `@media (min-width:720px){.dock{display:none}}`;
  the desktop `.header-right` holds only fest pill + sync dot (no day tabs); grep shows zero
  `position:sticky` anywhere; `wireScrollspy` targets `dock-days` inside the hidden dock. Deep-scroll
  shots at 768/F9-01 and 1440/F9-01 show zero persistent nav chrome. Violates F9 ("desktop: sticky
  day rail under the toolbar + jump to top; scrollspy" / "every viewport has day navigation").
- **What is:** a whole day-navigation subsystem is missing at a whole viewport class — a
  multi-day desktop user can only navigate by manual scroll.

### B2 · The notes sheet is a full-width bottom-pinned strip at every viewport, including desktop — the exact pattern F6 forbids
- **Severity:** P1 · **Flow:** F6, F8 · **Viewport:** 768/1440
- **File:** `assets/v3.css:104-110`; `js/v3/notes.js:93-129,137-173`
- **Evidence:** `.sheet { position:fixed; left:0; right:0; bottom:0 }` with no `max-width` and no
  `@media` override; neither notes function branches on viewport. At 1440 it renders as a
  1440px-wide strip glued to the bottom edge with a mobile drag-handle (1440/F6-02/04, F8-01;
  768/F6-01). F6 explicitly says "desktop = centered dialog (never a full-width strip pinned to
  the bottom of a wide viewport)."
- **What is:** the doc's core "not stretched mobile" anti-pattern realized literally, across both
  notes surfaces at every desktop width.

### B3 · Desktop is stretched mobile — type never scales, the wall grid caps at 4 columns, screens are a fixed-width column with dead space
- **Severity:** P2 · **Flow:** F1, F4, F11 · **Viewport:** 768 vs 1440
- **File:** `assets/v3.css:15,184-185`; `index.html:20,26`
- **Evidence:** exactly one font-size changes at any breakpoint (`.app-header .title` 26→34px);
  no `clamp`/`vw`/`rem` type sizing exists. `.wall-grid` caps at 4 columns inside `.shell`
  `max-width:960px`, leaving ~240px dead margin each side at 1440 while card names stay static
  13.5px. Landing/create/join are a ~436px center column; settings a 560px column. Contradicts
  F1 ("type scales up on desktop"), F4 ("grid density and type scale to the viewport, no vast
  dead space"), and the line-11 principle.

### B4 · Desktop hover-to-note affordance never built — mouse-only users can't add the first note on any artist
- **Severity:** P2 · **Flow:** F6.1 · **Viewport:** 768/1440
- **File:** `js/v3/wall.js:93-109`; `js/v3/aura.js:84-95`
- **Evidence:** F6.1 requires "desktop: hover reveals a note affordance; click opens the same
  surface." No hover path exists — zero `:hover` rules, zero `mouseenter` listeners; the only
  trigger is a 500ms pointerdown long-press. The one visible click affordance (note chip) only
  renders once `noteCount>0` (aura.js:86) — a chicken-and-egg for the *first* note. (P2 not P1:
  the long-press pointer handler *does* fire for a mouse held 500ms, so it's a discoverability
  failure, not a hard block; day/fest composers are fully usable on desktop.)

### B5 · Not-connected Spotify drill is a "floating button in a void" with unexplained jargon and no setup guidance
- **Severity:** P2 · **Flow:** F13 · **Viewport:** 390/768/1440
- **File:** `js/v3/settings.js:392-416`; `js/spotify.js:1-6`; `assets/v3.css:146-148`
- **Evidence:** both not-connected sub-states render bare into the flex column (no `.settings-card`
  wrapper — which the *connected* branch does use, so the fix pattern is in the same file) over
  ~800px of empty dark screen — the exact anti-pattern F13 names ("not a floating button in a
  void"). The copy asks a non-technical crew lead for a "Crew Spotify app Client ID" with no
  explanation, no Developer-Dashboard link, and no mention of the 5-user allowlist / owner-Premium
  requirement — even though spotify.js:5 claims "the setup guide in the UI spells this out." It
  does not exist (grep: those terms appear only in code comments).

### B6 · Landing, create, and join screens never vertically center — large dead space below content on tall viewports
- **Severity:** P2 · **Flow:** F1, F2, F3 · **Viewport:** 390/768/1440
- **File:** `index.html:34,45,65,84`
- **Evidence:** F1 requires "content vertically centered on tall viewports." `.center-col` uses
  `margin:40px auto 0` (top-pinned); `body` sets `min-height:100vh` with no centering ancestor;
  `show()` only flips display. Content ends ~40% down with the lower half empty
  (390/F1-01-landing-empty.png). Notably the 404 page **is** correctly full-viewport centered
  (404.html:12-13 flex) — the fix pattern already exists in the codebase.

---

## Class C — Failures resolve to a blank/stale/silent screen (no error or lost-state boundaries)

**Root pattern:** the app has no top-level error boundary, no history/overlay integration, and
its writes/fetches are unguarded — so every failure mode (a thrown exception, a dead invite
token, a hidden-DOM export, a hung network, a back gesture, a full localStorage) resolves the
same way: a blank page, a stale screen, or a silent no-op with no user-facing acknowledgment.
Two of the spec's Lost states (F16.2, F10) were never built at all.

### C1 · Uncaught exception in boot()/enterApp() crashes to a permanently blank page with no fallback
- **Severity:** P1 · **Flow:** F15 (first visit offline), F3 (join), F16
- **File:** `js/v3/app.js:337-385,432`; `js/state.js:59`; `js/festivals.js:20-27,75-78`
- **Evidence:** only `loadFestivalIndex()` is guarded; `enterApp()`/`boot()` have no try/catch and
  there is no `window.onerror`/`unhandledrejection`/`.catch` anywhere (grep clean). All 5 screens
  start `display:none`, so any throw before the first `show()` yields a blank white page — not the
  404, not F16's lost state. Two throw sites precede `show('screen-app')`: `defaultFestivalId()` →
  `FESTIVAL_INDEX[0].id` (TypeError on empty index) and `loadFestival()` (throws on failed
  festival-JSON fetch).
- **What is:** a real error-boundary gap producing a spec-violating unrecoverable blank page under
  realistic-but-conditional failure (flaky festival wifi on an uncached fest). P1 not P0: the
  common returning-user path (fest already SW-cached) does not crash.

### C2 · A bad/expired `#g=` invite token silently falls through to the landing screen — F16.2 "link didn't work" was never built
- **Severity:** P1 · **Flow:** F16 · **Viewport:** 390/768/1440 + live
- **File:** `js/v3/app.js:369-391`; `js/crew.js:49-54`
- **Evidence:** `fetchCrew()` returns `null` (not throw) on a real 404, so `boot()` routes
  "confirmed deleted" and "offline, no cache" to the *same* `renderLanding()` — broken token left
  in the URL, zero error copy, landing even reading "Got a link? Just open it." No "link didn't
  work" string exists anywhere. Live nav to `#g=totallyBogusToken` → console 404 → landing.
  Secondary: `onCrewGone` never calls `forgetCrew` (drops the token it's handed), so a
  server-deleted crew persists as a remembered landing row; the bad-token path also fails to clear
  `location.hash`.
- **What is:** the invite link is the app's entire distribution mechanism (F3); bad/expired/rotated
  links are a foreseeable common case with no acknowledgment and no path forward. Directly violates
  F16.2.

### C3 · "Download day image" produces a 0-byte PNG and fails silently
- **Severity:** P1 · **Flow:** F14 · **Viewport:** 390/768/1440
- **File:** `js/v3/tools.js:98-106`; `js/v3/settings.js:367-370`; `js/v3/app.js:162-166,236-239`
- **Evidence:** the handler runs html2canvas against `#wall-root`, which lives inside `#screen-app`
  that `show('screen-settings')` has already set to `display:none`. An element under `display:none`
  has a 0×0 rect → html2canvas yields a 0×0 canvas → `toDataURL()` returns `data:,` → a 0-byte PNG
  saves with the correct name, no toast/spinner/error (the catch only guards html2canvas being
  absent). Deterministic at every viewport (390/F14-03 0 bytes; 768 `file` reports empty).
  Contradicts F14 "PNG is legible on a phone share sheet."
- **What is:** a tertiary export tool fully broken and silent. P1 not P0 — no data loss, no core-flow
  impact.

### C4 · Browser back with Settings or any sheet open ejects the user from the app (blank page / stale screen)
- **Severity:** P1 · **Flow:** F10 · **Viewport:** 390/768/1440 + live
- **File:** `js/v3/app.js:236-262,429`
- **Evidence:** opening Settings or any sheet never `history.pushState`s (grep: zero pushState /
  popstate in all of js/; the only listener is `hashchange`). So a back gesture — the reflexive way
  to close an overlay — unwinds to the last real navigation: `about:blank` at 768
  (768/F10-04-BLANK), or the stale `#new` create screen with leftover form text at 390/1440
  (F10-02). Directly violates F10 ("browser back NEVER dumps the user out of the app while layers
  are open").
- **What is:** systemic across every overlay and viewport; no overlay↔history integration exists.
  P1 not P0: recoverable via forward button / localStorage re-entry, core flow intact with working
  in-UI close + Escape. (Strongest P0 argument: an installed PWA where the app URL is the sole
  history entry — system-back to close Settings would close the whole app.)

### C5 · No fetch timeout / AbortController in sync.js — a hung request permanently jams the sync pipeline
- **Severity:** P2 · **Flow:** F15
- **File:** `js/sync.js:36-42,48-86,107-123`
- **Evidence:** `fetchRemote`/`pushSync`/`pollSync`/`requestMigration` set no timeout or
  `AbortSignal`. `pushSync` sets `isSyncing=true`, cleared only in `finally`; on a hung connection
  (captive portal, TCP-accept-but-never-respond) the fetch never resolves, `isSyncing` never clears,
  and every later `scheduleSync` just sets `syncQueued=true` and returns. Picks/notes queue locally
  but nothing reaches the server until a full reload; the sync dot shows "syncing" forever with no
  error transition and no cancel/retry.

### C6 · localStorage writes are unguarded — a QuotaExceededError silently kills tap-to-pick and note-save mid-handler
- **Severity:** P2 · **Flow:** F4, F6/F7
- **File:** `js/state.js:71-72,124-136`; `js/v3/app.js:45-80`; `js/crew.js:24,28-31,34,37`
- **Evidence:** every localStorage *read* is try/catch-wrapped but every *write* is bare. In
  `handleTap`, `recordSelection` bumps in-memory state before `persistPending()` throws, so a throw
  aborts before `applyLocalPick`/`refreshCard`/`scheduleSync` — pick half-recorded, card never
  repaints, nothing syncs, no error shown (no global handler). Notably festivals.js:55 already wraps
  its write `/* quota */`, proving the dev treated quota as real but left the hot path unguarded. P2
  not P1: the headline "Safari Private = quota 0" trigger is stale (fixed 2017+); the realistic
  trigger is storage disabled entirely (iOS Block-All-Cookies / locked webviews), a niche population.

---

## Class D — Cache-first service worker has no freshness strategy for dynamic content

**Root pattern:** the SW fetch handler forces network only for `/api/` and serves everything else
`cached || network`. That single policy makes both the app *shell* and the *Spotify Web API*
responses go stale, because the Cache API keys purely by URL and ignores `Cache-Control`.

### D1 · Service worker cache-first serves stale Spotify Web API responses — Scan/Refresh can silently return old library data
- **Severity:** P1 · **Flow:** F13
- **File:** `service-worker.js:71,78-90`; `js/spotify.js:91-105`
- **Evidence:** the force-network guard is `pathname.startsWith('/api/')`; Spotify GETs hit
  `api.spotify.com/v1/…` (pathname `/v1/…`) so they dodge it and fall to cache-first. `api()` issues
  plain GETs with no `cache:'no-store'` and no cache-buster; Spotify sends no `Vary:Authorization`.
  So a repeat "Scan library"/"Refresh" on `/me`, `/me/tracks`, `/me/following` returns the
  byte-identical cached response. Worse than transient: the background fetch only updates the cache
  for the *next* scan, so each re-scan is perpetually one scan stale, silently — defeating the
  refresh affordance on a headline feature.

### D2 · A stale service worker can serve an old UI showing a different crew's real data on returning devices
- **Severity:** P2 · **Flow:** F1 / F3 · **Viewport:** 390 / 768
- **File:** `service-worker.js:3,63-88`
- **Evidence:** cache scope `festival-nav-v14` = `CACHE_VERSION`; the shell (`index.html`, `js/v3/*`)
  is served cache-first with only next-load revalidation, and SW git history confirms a real
  v1/v2→v3 shell transition. A device whose registration predates a deploy serves its old shell on
  first paint. **Unreproduced live** — the corroborating screenshot was overwritten, so this rests
  on walk-log prose; the *mechanism* is code-confirmed. **Not a data-boundary breach:** crew data is
  share-by-token with no per-device authz, and the "old UI showing The Crew" is most consistent with
  the persistent Playwright profile retaining its own prior SW+cache+token, not another user's data.
  Downgraded P1→P2. Recommend a deliberate stale-SW re-test and a network-first-for-navigation fix.

---

## Class E — Incremental repaint diverges from first paint; derived surfaces go stale

**Root pattern:** the render pipeline has a full first paint that stamps positioning and derived
state, and cheaper targeted paths (`refreshCard`, single-node undo, save handlers) that mutate one
node without re-applying what the full paint established or without re-rendering the sibling/derived
surfaces. Because a solo user's own push produces no remote diff, `applyRemoteDoc` reports "nothing
changed" and no repaint fires to heal it — so the divergence persists until an unrelated full paint.

### E1 · Tapping a set-times card strips its grid position — the card vanishes off-canvas
- **Severity:** P1 · **Flow:** F5.3 · **Viewport:** 390, 768 (reproduced live)
- **File:** `js/v3/wall.js:132-136` vs `229-244`
- **Evidence:** `refreshCard()` does `el.replaceWith(fresh)` rebuilding the card via `renderCard({cell})`
  and re-applies none of the `gridColumn/gridRow/minHeight/width/marginLeft` that
  `renderScheduledDay` stamps only at first build. The fresh card has no grid placement, so CSS
  auto-placement drops it into the 40px hour-rail column, off the left edge. Live at 390: tapping
  "Midnight Generation" → post-tap rect `{x:-30,w:40}` with empty grid styles. Directly contradicts
  F5.3 ("cycles the pick without the card moving or vanishing").
- **What is:** fires on every tap of a *non-topmost* card in the set-times grid of both flagship
  real-data fests (Electric Forest, Lollapalooza). (The topmost column-2 card re-lands in its own
  just-vacated cell — the one lucky exception the auto-placement scan predicts, which is why some
  passes reported it "working.") P1 not P0: pick is recorded correctly (no data loss), self-heals on
  any repaint (day/sort/search/crew-mate edit), confined to the set-times grid.

### E2 · Spotify Client ID save silently dead-ends — the open drill never re-renders the Connect button
- **Severity:** P2 · **Flow:** F13 · **Viewport:** 768 (confirmed stuck); 1440 reached Connect
- **File:** `js/state.js:90,153-156,175-186`; `js/v3/settings.js:392-416`; `js/v3/app.js:260`
- **Evidence:** the save handler only sets `msg.textContent` and never re-invokes `openSpotifyDrill`;
  `onRemoteChange` re-renders the *wall*, not settings. So "Saved — connect below once it syncs"
  promises an inline Connect button that never appears in that view (768/F13-04 and F13-05
  byte-identical across 35s / 2 reloads). **Corrections to the walker:** the "server-side data-loss"
  claim does not hold (a single well-formed save lands via `jsonb_deep_merge`; the "missing save" was
  two concurrent audit walkers clobbering a crew-wide singleton — a test artifact), and it
  self-heals: backing out and reopening the drill *does* surface Connect. Downgraded P0→P2. The
  actual fix is a missing re-render after save, not the two mechanisms the finding named.

### E3 · "N artists picked" counts go stale after an undo while Export Likes stays correct
- **Severity:** P2 · **Flow:** F14 (bug is in F11 pick-count chrome) · **Viewport:** non-viewport-conditional
- **File:** `js/v3/settings.js:104-105,127-128` vs `js/v3/model.js:32-43`
- **Evidence:** the two Settings count labels compute `Object.keys(selections).length` off the raw
  doc, which retains a key once any level is set (undo zeroes the value, never deletes the key).
  Every other surface — wall aura, Export (tools.js:25), playlist — routes through
  `picksFor()`→`readLevel()` which drops `<1` tombstones. So solo-pick-then-fully-unpick → Settings
  reads "1 artists picked" while Export reads "No picks yet." (Finding's prose overreaches — there is
  no *wall* count; the wall is correct.)

### E4 · Repaint-during-interaction glitches: long-press orphaned by a poll repaint, and multi-day sibling cards go stale on tap/undo
- **Severity:** P2 · **Flow:** F6.1 × F15; F4/F4.2
- **File:** `js/v3/wall.js:93-109,132-136`; `js/v3/app.js:56,66-68,154-159,411-424`; `js/sync.js`
- **Evidence:** (1) long-press listeners are el-scoped with no `pointercancel` handler; a 25s
  `pollSync`→`repaintWall` does `root.textContent=''` mid-press, detaching the el so `pointerup`/`leave`
  never cancel and the 500ms timer still opens the sheet for a card the user may no longer touch.
  (2) `refreshCard` mutates only the tapped node and the undo re-query is first-match-only, so a
  multi-day artist's other `.card[data-artist]` instances keep the pre-tap aura until an unrelated
  repaint. Confirmed multi-instance in shipped data (electric-forest-2026.json: 21 multi-day
  artists). **Elevating detail:** `handleTap` reads the *model* not the DOM, so a user who sees a
  stale sibling and re-taps *advances* their pick level on already-correct data (can cycle a must
  4→0) — a real footgun, which supports P2 over cosmetic.

---

## Class F — The scheduled/set-times renderer is incomplete versus F4/F5

**Root pattern:** the set-times/lineup renderer never implements several F5 requirements — the time
axis is hidden, per-card start times are dropped, unscheduled acts sit outside the grid, and
multi-day day-strings aren't split. The data is present and correct; the renderer just doesn't read
or place it as specified.

### F1 · The hour rail (time axis) is permanently invisible on every viewport
- **Severity:** P1 · **Flow:** F5.1 · **Viewport:** 390/768/1440
- **File:** `assets/v3.css:174-176,180-181`
- **Evidence:** `scroll-snap-type:x` on `.times-scroll` + `scroll-snap-align:start` on `.stage-head`
  *only* — the 40px hour-rail column (grid col 1) is never a snap target, so on load the container
  auto-snaps `scrollLeft` to 44 (rail + gap), pinning the rail behind the overflow clip
  (verified 390/768/1440). Separately `.hour-label` is `position:relative` not `sticky`, so the axis
  also drops out when scrolling to later stages. Aggravating: `renderScheduledDay` passes
  `time:a.startStr` into `renderCard`, which never reads `opts.time` — so per-card times are dropped
  too, making the hidden rail the *only* absolute-time reference.
- **What is:** the set-times view — whose entire purpose is showing *when* artists play — shows no
  time axis. P1 not P0: `proximity` (not `mandatory`) snap lets a user drag the rail into view, and
  cards still render chronologically with overlaps/headers — a major degradation, not an unusable
  screen. (See also F2 below and E1 — three defects converge on this one view.)

### F2 · Unscheduled programming is a below-grid list, not the far-right "everything else" column, and per-card set-time labels never render
- **Severity:** P2 · **Flow:** F5.4 / F5 · **Viewport:** 390/768/1440
- **File:** `js/v3/wall.js:248-269,232,53-129`; `assets/v3.css:16`
- **Evidence:** (1) stage-less acts are appended as a plain flex list (`root.appendChild(list)`)
  *outside* `.times-scroll`/`.times-grid` — below the horizontally-scrolling grid, not the far-right
  integrated column F5.4 requires; a user scanning stage columns won't discover it. EF-2026 has real
  stage-less items so it manifests (1440/F5-05, 390/F5-03). (2) `.card .time` is styled and
  `{time:a.startStr}` is passed, but `renderCard` reads only `opts.cell` and drops `opts.time`, so no
  textual start time ever renders on a scheduled card — time is inferable only from vertical position.

### F3 · Multi-day artist renders in a forbidden combined "Saturday & Sunday" section and produces duplicate indistinguishable SAT dock tabs
- **Severity:** P2 · **Flow:** F4 · **Viewport:** 390/768 (1440 same code path)
- **File:** `js/v3/wall.js:141-149,312`; `js/v3/app.js:135-143`; `data/festivals/portola-2026.json:257-259`
- **Evidence:** Portola's Despacio ships `day:"Saturday & Sunday"` as one string; `groupByDay()` keys
  on the raw string, manufacturing a third `SATURDAY & SUNDAY` section (with a bogus "Add a note for
  Saturday & Sunday" scope) — the exact anti-pattern F4 forbids by name ("appears under EACH day,
  never a combined Day X & Day Y section"). `renderDockDays` dedups on the full string then
  `.slice(0,3).toUpperCase()`, so "Saturday" and "Saturday & Sunday" both render `SAT` → dock tabs
  SAT/SUN/SAT, two identical, routing to different content. The validator places no constraint on
  `artist.day`, so it passes CI. Narrow blast radius (one act, one fest), card fully pickable → P2.

---

## Class G — Secondary flows shipped as flat simplifications of their spec

**Root pattern:** Settings, the create/join entry, add-a-festival, and the sort control each shipped a
reduced version of what the flow spec describes — one flat screen where two steps/doors are
specified, a native control where a designed one is required, a preview missing its spec'd elements,
composers/affordances omitted. The spec's own rule ("a mismatch is always a finding") makes each a
build↔spec divergence.

### G1 · Notes surfaces don't match spec: the ALL NOTES home has no composer, day headers have no notes affordance, and notes aren't pinnable in two of three places
- **Severity:** P1 · **Flow:** F6.2, F7.1, F8 · **Viewport:** 390/768/1440
- **File:** `js/v3/notes.js:52-58,118,137-173,161,169,203`; `js/v3/wall.js:151-165`
- **Evidence:** (a) `openAllNotes()` never calls `composer()` for any scope — the ALL NOTES sheet
  (the spec's "notes HOME") shows sections but zero input, and its empty-state "long-press an artist
  or write under a day" is meaningless to pointer-only users (F8.2 requires "always ADD a festival
  note right there, including from the empty state"). (b) `dayHeader()` is a static div with no click
  handler or count badge — F7.1's day-header affordance doesn't exist; day notes are reachable only
  by scrolling past the whole day. (c) `noteRow()` renders a Pin only when passed `onPinToggle`, which
  `openArtistSheet`/`openAllNotes` don't — so artist-scope and all-notes notes are never pinnable
  (F6.2). Three explicit Expected-clause violations across F6/F7/F8; each has a scroll-to workaround,
  hence P1 not P0.

### G2 · F11 Settings doesn't implement the spec's "two doors": no CREW door (rename/danger zone), no YOU door (rename self/color), archived fests in forbidden fine-print
- **Severity:** P2 · **Flow:** F11 · **Viewport:** 390/768/1440
- **File:** `js/v3/settings.js:115,144,310-324,340`
- **Evidence:** F11.1 promises a YOU door (name/color/Spotify) + CREW door (members, crew name,
  festivals, share link, danger zone). Shipped Settings has three flat sections (Your festivals / You
  / App); grep for `danger`/`rename`/`leave`/`delete`/`remove-member` returns nothing — no CREW
  section, no danger zone. The `youCard` has no click listener and there's no color picker, so a
  typo'd name/color is permanent. The Archived row is `color:tertiary` 11.5px behind a `▸` caret — the
  exact fine-print F11.2 forbids by name. **Correction that strengthens it:** crew-rename was added to
  the *old* `js/app.js` (db814bc) which was then deleted wholesale (bd659ca), so the shipped
  `js/v3/app.js` never wires `recordCrewName` — the app has **no** crew rename at all.

### G3 · F2/F3 entry flow doesn't match spec: one flat screen not two steps, no past-festival section, and the join screen never names the festival (and lands on the wrong fest)
- **Severity:** P2 · **Flow:** F2, F3 · **Viewport:** 390/768/1440
- **File:** `js/v3/app.js:170-204,176,296-298`; `index.html:64-80,87`; `js/state.js:57-59`; `js/festivals.js:75-78`
- **Evidence:** (1) `renderCreate` mounts fest list + name + Create + Back all at once; selecting a
  fest only adds a border + caption — no chip, no step-2 (F2.2). (2) the picker filters
  `status!=='archived'`, so 5 past fests never appear even as a secondary section (F2.1). (3)
  `renderJoin` sets its only headline from `doc.meta.name` — the *crew* name (`#join-fest-name` is a
  misnomer) — with no fest name/dates/location (F3.1 requires "crew + fest context"). (4) **the
  load-bearing one:** a joiner on a fresh device has no `LS.fest(token)` key, so `activateCrew` falls
  to `defaultFestivalId()` = first non-archived = Lost Lands (empty). The crew doc carries no
  current-festival pointer, so most joiners land on an empty wall with none of the crew's picks —
  recoverable only via Settings (which keeps it P2).

### G4 · F12 add-a-festival: preview never shows sources, the screen stacks on top of Settings, and the research pathway can't produce scheduled fests
- **Severity:** P2 · **Flow:** F12 / F5 · **Viewport:** 390/768/1440
- **File:** `js/v3/settings.js:140,207-208,228-230`; `api/festival-add.js:24-37`; `api/_lib/guard.mjs:49-51`
- **Evidence:** (a) `openAddFestival` is the one Settings subview opener that never hides `main`
  (every other calls `sub2()`), so ADD A FESTIVAL and SETTINGS mount simultaneously in one scroll
  (DOM-confirmed sibling nodes at all viewports). (b) the preview renders at best a "· N sources"
  count (never links/names), and a live Coachella run returned zero sources — contradicting F12.1's
  required "sources." (c) `researchPrompt()` requests only `lineup|archived` status with no
  days/stages/dayMeta, so a researched fest can never be an F5 set-times fest — though the spec does
  *not* require it to (a scope note, not a violation). (d) Discard clears only the preview, leaving
  stale name text. The two confirmed items (a, b) each justify P2; (c)/(d) ride along and should be
  split out or downgraded.

### G5 · Sort control is a native `<select>` with no styled menu and no dropdown caret
- **Severity:** P2 · **Flow:** F4 · **Viewport:** 390/768/1440
- **File:** `index.html:121`; `assets/v3.css:68`
- **Evidence:** F4 requires "sort control is a styled menu (not a native select)." The live control is
  `<select id="sort-select" class="sort-chip" style="appearance:none">` (accessibility role
  `combobox`). `appearance:none` strips the OS arrow, and the only `.sort-chip .caret` rule targets a
  `<span>` that exists solely in `gallery.html`'s demo — a `<select>`'s children are `<option>`s, so
  that caret can never render in production. Result: a plain pill with no dropdown affordance
  (390/F4-04, 768/F4-03, 1440/F4-03). Keyboard-accessible (native selects are), so that half of F4 is
  met — hence P2.

---

## Class H — Latent functionality with no UI surface

**Root pattern:** capability exists in data or code but nothing in the UI reveals it — the wall never
teaches its own core mechanic, and an imported, schema-validated data field drives no renderer. The
gap is a missing surface, not a broken one.

### H1 · First-time users get no onboarding — the pick mechanic is invisible on the wall and the only explanation is buried in Settings
- **Severity:** P2 · **Flow:** F4, F11 · **Viewport:** 390 (768 structurally)
- **File:** `js/v3/wall.js` (card render); `js/v3/settings.js` (How it works)
- **Evidence:** post-join you land on a dense grid of plain-text cards with nothing signaling they're
  tappable, what a tap does, what the faint aura/corner sliver means, or that a 4th tap escalates to
  "must." Pick feedback is a subtle radial gradient + a few-pixel corner; who-corner marks render at
  `fontSize:0px` as unlabeled slivers. The one clear legend ("Tap an artist 1–3×… 4th tap = must…
  violet bubble = crew notes") lives only in Settings → App → How it works (~3 taps deep) with nothing
  on the wall pointing to it. No onboarding/coach-mark/tooltip anywhere. Affects 100% of new users; the
  differentiating aura/crew/must semantics are un-inferable. (Design-opinion finding — the spec doesn't
  mandate onboarding — but in scope for a UX audit.)

### H2 · ACL weekend flag (W1/W2/both) is validated and imported but no UI surface ever reads it
- **Severity:** P2 · **Flow:** F4
- **File:** `data/festivals/acl-2025.json`, `acl-2026.json`; `api/_lib/festival-rules.mjs:49`; `scripts/import-festival.mjs:32-37`
- **Evidence:** all 124 ACL artists carry a schema-validated `weekends` value produced by a dedicated
  importer; ACL runs two only-partly-overlapping weekends (2026 Skrillex W1-only / Kings of Leon
  W2-only). `grep -rni weekend js/` returns nothing — no badge, filter, sort, or grouping consumes it.
  Understated by the finding: `docs/add-a-festival.md:31` documents this field as "enables the weekend
  filter" — a documented feature never built — and acl-2026 is a **live** fest. A crew attending one
  weekend can mark a single-weekend artist as a must-see for the wrong weekend with zero wall-level
  signal. (Unspecced at the flow level — F-docs never mention weekends — so it's an omission, not a
  misstatement, hence P2.)

---

## Coverage gaps

**F15 · Offline / PWA — skipped by all three walkers (390, 768, 1440).** No walker exercised real
offline, network-throttling, or installed-PWA behavior; the offline-toggle tool wasn't loaded in any
session. Consequences for this backlog:

- Every SW/offline/sync finding in **Class C** (C1, C5, C6) and **Class D** (D1, D2) was reached by
  **static code trace only**, not live offline observation. The mechanisms are code-confirmed but the
  *runtime* behavior F15 specifies is unverified: SW cache-shell load, crew-doc last-synced fallback,
  the visible sync-status dot, stay-offline + low-power modes, and additive reconnection merges
  without loss.
- **C1 (blank-page crash on first-visit-offline)** in particular hinges on an SW-cache/localStorage
  divergence that was reasoned about, not reproduced. A deliberate offline/airplane-mode pass is the
  single highest-value follow-up.
- **D2 (stale-SW serving old UI)** was explicitly *unreproduced* (its screenshot was overwritten) and
  needs a scripted stale-SW re-test to confirm or retire.

**Thin coverage (verified but shallow):**
- **F8 (all-notes view)** — 1 pass at 390 and 768, 2 at 1440. Adequate for the G1 finding but the
  populated-state ALL NOTES layout at desktop widths is lightly walked.
- **F14 (export/tools)** — only 1 pass at 1440; the 0-byte-PNG (C3) and stale-count (E3) findings are
  well-evidenced at 390/768 but the desktop export surface is thin.
- **Bulk-paste import (F14.2, v4 semantics)** — noted in the spec, not exercised by any walker; no
  finding either way. Untested.
- **F13 OAuth round-trip (F13 step 1–2, PKCE callback across production domains)** — the connect/scan
  drill was reached, but a real Spotify OAuth redirect + callback + library scan was not completed live
  (D1/E2/B5 cover the surrounding surfaces via code + partial walks). The redirect-from-every-domain
  guarantee (F13.2) is unverified.

All other flows (F1–F4, F5–F7, F9–F12, F16) have live coverage at all three viewports.
