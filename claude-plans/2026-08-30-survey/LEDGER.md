# The 2026-08-30 survey ledger

**Branch:** `notes-desktop-round` (PR #13) · **Written:** 2026-08-30
**Inputs:** ten dimension readers, each re-checked by a skeptic; two research passes
(comment-thread UI, festival data). Every line number below was cited by a reader and
re-verified by that reader's skeptic; the handful I re-checked by hand are marked.

---

## Where we are

The notes-and-desktop round is built and sitting in PR #13. The survey says don't merge yet.
Its headline feature — the card that grows on hover or hold — has two real bugs, exactly the
two you felt. One: once a card has grown, clicking its body no longer picks, because a guard
meant to protect the notes chip protects the whole grown area. Two: the grow writes a new width
and height onto a card that is still a live grid cell, so the row inflates and neighbours shove;
the shrink-back animates those same numbers, which is the jitter. Both are fixable without
redesigning the morph. Beyond that: Settings really does put Crew above You,
Lost Lands' date line is a 137-character run-on that gets clipped, ACL's set times were
published as images only and never entered, and Seismic has nothing to ingest until
mid-September. Nothing found is data loss.

**Counts:** 55 findings across ten dimensions. 44 CONFIRMED, 11 PLAUSIBLE, 0 refuted. One P0,
fourteen P1. Plus 25 additional items the skeptics found that their readers had missed — folded
into the sections below.

---

## First visit & adding fests

### CONFIRMED · P1
- **Lost Lands' date line is a two-clause run-on that gets clipped mid-sentence.**
  `data/festivals/index.json` (and the identical string in `lost-lands-2026.json:7`) carries
  137 characters — "September 18–20, 2026 (main festival, Fri–Sun); a separately-billed
  \"Early Arrival\" pre-party runs Wednesday Sept 16 and Thursday Sept 17" — against Portola's
  21. The one render path (`js/v3/tools.js:37` → `.fest-dates`) has a hard 2-line clamp
  (`assets/v3.css:423`), so the clause naming the actual pre-party dates is the part that gets
  cut. *Fix:* shorten to "September 18–20, 2026 · Fri–Sun" in both files; the Early Arrival
  detail moves onto the fest's own wall where it has context. (Note: the reader's claim that
  the text "just wraps with no line-length awareness" is wrong — the clamp is deliberate and
  working; the defect is that the sentence reads badly even inside its intended budget.)

### CONFIRMED · P2
- **The same `dates` field lives in two files and has already drifted.** `index.json` says
  "September 26–27, 2026" for Portola; `portola-2026.json:7` says "…· doors 1 PM". The wall
  header and the current-fest card in Settings read the per-fest file (`js/v3/app.js:184`,
  `js/v3/settings.js:70-82`); the other-boards list and the pick-fest screen read the index
  (`settings.js:168`, `app.js:555`). So a single Settings screen shows both strings. A full
  field diff across all 13 catalog entries found this is the **only** divergence anywhere —
  two isolated causes, not a systemic rot. *Fix:* pick one convention (index = short form) and
  add a validator assertion so the next drift fails at commit. The `-webkit-line-clamp:2` is
  also hand-duplicated (`v3.css:423` and an inline copy at `settings.js:82`) — fold that into
  the same pass.

### CONFIRMED · P3
- **Onboarding copy still teaches "Hold for notes"** (`js/v3/app.js:445`, and the identical
  line in the How-it-works page at `js/v3/settings.js:369`). Hold now opens the zoom; notes is
  one tap further. NOW.md already tracks the app.js line as your wording call — the settings.js
  twin is untracked and should be reworded in the same breath.
- **"MUST SEE" contradicts the project's own vocabulary rule** (`app.js:445`,
  `settings.js:360`). CLAUDE.md names "Must See" as the retired legacy term; the canonical
  label is `Must` (`js/parse.js:20`). A grep confirms these are the only two live UI hits.
- **Archived fests render in raw file order in the "Past festivals" fold**
  (`js/v3/tools.js:67-83`, no internal sort) — Electric Forest (2026-06-25) above Lollapalooza
  (2025-07-31). Same root cause as the default-fest item under *Festival data* below.

---

## Picking on the wall

### CONFIRMED · P0 — the one that must not ship
- **Once a card is hovered or held, clicking its body no longer picks.**
  `js/v3/wall.js:212` (verified by hand): `if (e.target !== el && e.target.closest('.facts-grown, .chip-notes, .chip-spotify')) return;` runs *before* `ctx.onZoomTap` is ever consulted,
  so it applies to mouse and touch alike. `.facts-grown` is a real child of the card covering
  `top:38px` to `bottom:10px`, left and right inset 8px (`assets/v3.css:624`, verified) — the
  visible bulk of a 132px zoomed card. Only the notes chip inside it is actually interactive;
  the sub-line, the filler, the picker pills are inert and would happily bubble a pick.
  Reproduced live in jsdom: click on `.f-spring` and `.f-who` → `onTap` never fires; click on
  `.name` (outside the block) → fires correctly. This directly contradicts `app.js:75-77`'s own
  comment and `docs/user-flows.md:110`. **This is your "multiple taps no longer increase pick
  intensity."** *Fix:* give `.facts-grown` `pointer-events: none` and its one real button
  `pointer-events: auto` — or narrow the guard to `closest('button')`. Four independent readers
  reached this same line by four different routes.
  - *Same bug, touch half:* the documented "tap the zoomed card's body to put it away" also
    never fires, for the same reason — the guard returns before `onZoomTap`. On touch, a tap on
    a held card's body currently does **nothing at all**: not pick, not dismiss.

### CONFIRMED · P1
- **Lost Lands' day headers shout the raw day string.** Artists carry
  `"day": "Wednesday, Sept 16 (Early Arrival Pre-Party)"` and the fest has no `dayMeta`, so
  `renderLineupGroup` (`js/v3/wall.js:345`) uppercases the whole sentence as the section rule.
  Meanwhile `app.js:366` already strips that exact parenthetical for the day-rail *tab* — so
  the tab reads "WEDNESDAY, SEPT 16" and the section it jumps to reads the full sentence.
  **This is your "Lost Lands not getting the cleaned-up before/afters treatment we did to
  Portola."** *Fix:* add `dayMeta` entries for the pre-party days (Portola's Afters pattern),
  and route `dayHeader`'s label through the same stripping helper so any future verbose day
  degrades gracefully in the wall too, not just in the tab.

### PLAUSIBLE · P1
- **A repeat tap can land on a shifted neighbour mid-gesture.** Because the grow inflates the
  row (next section), the card under your finger moves between taps. `wall.js:212` and
  `app.js:122-143` make this mechanically possible, but nobody confirmed it with real pointer
  coordinates — and the P0 above explains the same symptom without needing a coincidence.
  Treat as a second-order effect that the P0 and the row fix both dissolve. **UNVERIFIED** in a
  real browser.

### CONFIRMED · P2/P3
- `docs/user-flows.md:83` still names the retired sort label "Crew favorites"; the shipped
  label is "Most picked" (`js/v3/sort-control.js:12`, with a comment saying so). P2, one-line
  doc fix.
- Dead sort branch: `wall.js:939` tests `ctx.sort === 'day'`, a value no UI can produce
  (`sort-control.js:8-13`, `app.js:35`). Six test files hard-code it as their fixture. P3 —
  drop the branch, move the fixtures to `'billing'`.
- No-op object spread at `wall.js:916` (`{ ...fest, dayMeta: fest.dayMeta }`). P3.

---

## The zoom (hover / hold)

### CONFIRMED · P1
- **The grow writes width, marginLeft and minHeight onto a live grid item, so the whole row
  inflates.** `js/v3/card-facts.js:374-379` (verified by hand) sets those three properties
  directly on the card, which is still a normal in-flow item in `.wall-grid` — a grid with no
  `grid-template-rows` and no `align-items` (`assets/v3.css:509`, verified), so rows auto-size
  to their tallest item and siblings stretch to match. A 64px card becoming 132px doubles the
  row. The set-times grid is immune only because `wall.js:704/715` pins its rows at an explicit
  `repeat(n, 20px)`. **This is your "the whole row animates and resizes when only the one card
  should."** *Fix, narrow:* stop writing `minHeight` (the skeptic's read: that write alone is
  the row-growth cause, since `.facts-grown` is absolutely positioned and contributes no
  height; the horizontal overflow reads as an intentional spotlight). *Fix, deep:* leave a
  same-size placeholder in the grid cell and switch the same DOM node to `position:fixed`
  anchored at its measured resting rect, animating only `transform` and `clip-path`. The deep
  fix is what makes it "centered over its original spot" and is what item three below needs
  anyway. On phones (`<720px`, a bare `repeat(2, 1fr)` whose implicit minimum is intrinsic) the
  `width` write may grow the *column* track too — both axes, where desktop sees only rows.
- **The shrink-back animates layout properties, forcing a full reflow every frame.**
  `card-facts.js:276-280` runs `el.animate()` over `width` / `minHeight` / `marginLeft` for
  260ms — layout-triggering properties, not compositor-only ones, and coupled to the row above,
  so it is the whole row reflowing 60 times a second. Separately, a realistic card (sub-line,
  2-3 picker pills, Spotify, a weekend tag) fires roughly 13-15 concurrent Web Animations on
  the way in and a similar count on the way out, none pooled. **This is your "the animation
  seems to slow and make the site jitter — too heavy for the lightweight we always want."**
  *Fix:* the transform-only overlay above makes the shrink compositor-only. Worth also asking
  whether the sub-line, pills and chips need individual hops at all versus fading as one group.
- **Low Power is documented to silence the zoom's motion, and doesn't.** `card-facts.js:132`'s
  own comment says "reduced-motion and low-power still win globally," but `canAnimate()`
  (`card-facts.js:194`) checks only `prefers-reduced-motion`. The `.low-power` CSS rule
  (`v3-tokens.css:181`) resets CSS `animation`/`transition`, which has **zero** effect on
  `Element.animate()` — so the zoom has no low-power gate at all. `wall.js:108` shows the
  correct pattern (`animated && !ctx.lowPower`). *Fix:* thread `ctx.lowPower` into
  `canAnimate()`; the instant-apply branch already exists.

### CONFIRMED · P2
- **A crew-mate's edit silently kills your open zoom.** `repaintWall()` (`js/v3/app.js:374`)
  starts with an unconditional `unzoom()` then rebuilds every card node. It is the callback for
  every remote change the 25-second poll sees (`app.js:1724`, `:1818`) — any pick or note from
  anyone. The self-pick path (`refreshArtistCards`, `app.js:126-143`) deliberately re-grows the
  same zoom instantly; the remote path doesn't. Worse, a stationary mouse gets a synthetic
  `pointerenter` on the fresh node, restarting the whole 350ms morph from scratch. *Fix:*
  capture and re-grow the zoom the way the self-pick path already does.
- **On touch, the tap right after a hold dismisses instead of picking.** This is
  spec-compliant (`docs/user-flows.md` F6, `app.js:74-80`) — but it produces the same felt
  symptom as the P0, on phones. Your call, not a bug. See Open questions.
- **Zero test coverage for the zoom.** `grep -rln "zoomCard|wireCardZoom|facts-grown|onZoomTap" tests/`
  returns nothing. `wall-dom.test.mjs:40` stubs `onTap` and never dispatches a click;
  `nextTapLevel` is unit-tested in isolation only (`tests/v3-model.test.mjs:58`). This is
  precisely the gap that let the P0 ship past 275 tests, three Codex gates and a pointer walk.

### CONFIRMED · P3
- `refreshArtistCards` picks the re-grow target with `fresh.find(el => el.matches(':hover')) || fresh[0]`
  (`app.js:141`) — `:hover` never matches keyboard focus, so for an artist playing twice, an
  Enter-to-pick can re-grow the *first* occurrence's card while showing the *right* occurrence's
  facts.
- `wireCardFocusZoom`'s `focusout` (`card-facts.js:466`) unzooms unconditionally with no
  source guard, so a click-then-Tab can kill a mouse zoom whose pointer never moved. Its
  `focusin` also skips the `dismissedEl` check the mouse path has, so an Escape-dismissed
  keyboard zoom re-opens on re-focus.

---

## Notes & threads

### CONFIRMED · P1
- **No way to reply to a reply, and the composer names the wrong person.** The reply-render
  loop (`js/v3/notes.js:254-266`) passes no `onReply`, so a reply row never carries a Reply
  affordance; the only one is the root's, sitting *above* the whole reply list, and
  `setReply()` always writes "Replying to <root author>" even when your attention was on the
  last reply by someone else. On a thread with several replies, adding to the conversation
  means scrolling back up past everything you just read. **This is your "clicking reply under
  an existing reply is so strange."** The data model already handles it safely —
  `notes.js:466/535` resolves `replyTo.re || replyTo.id`, so a UI that lets you reply to a
  reply still writes a flat, one-level note. (That flattening line has zero test coverage.)
- **Your own root note stacks up to seven tokens in one wrapping line.** Four independent `if`
  blocks (`notes.js:141` Edit, `:151` Delete, `:165` Reply, `:176` Pin) plus the reply-count
  disclosure (`:169`) each append a `.note-action` with a `·` separator. Own pinned root with
  replies renders: who · time · Edit · Delete · Reply · N replies · Pin. **This is your "too
  many options in the top row."**
- **Editing a note has no Cancel.** `mountEditor()` (`notes.js:110-138`) wires only Save;
  `doSave` no-ops on empty text without ever discarding the draft. The sheet's Escape handler
  (`app.js:1851`) closes the entire notes sheet, not the inline editor. *Fix:* a Cancel beside
  Save calling `editing.delete(note.id)`.

### CONFIRMED · P2
- **500-character notes go into a single-line `<input>`** (`notes.js:114`, `:282`) — no wrap,
  no counter, no cue when the browser silently stops accepting characters. On a phone sheet
  the field is under 300px. *Fix:* a short auto-growing textarea, or at minimum a counter near
  the cap.
- `dayWhisper`'s comment undersells itself — `wall.js:955` also calls it for the fest whisper
  (`notes.js:587`). Rename to something scope-neutral.

### PLAUSIBLE · P2
- **Replying to a folded pinned thread leaves it folded** (`notes.js:239`; the save paths at
  `:466` and `:535` never touch `expandedPinned`). The reply-count text does increment, so it
  is subtle feedback rather than none. *Fix:* expand the target root on save.
- **Reply is unavailable for day and artist threads from the All-Notes home**
  (`notes.js:559` hardcodes `scope === 'fest'`), with no comment explaining why — the only
  scope-conditional choice in the file without one. A workaround exists (open that artist's own
  sheet, where reply works for every scope), so it is a missing shortcut, not a missing
  capability.

### CONFIRMED / PLAUSIBLE · P3
- The deleted-root stub says "Kevin removed this note" where the rest of the file says "you"
  (`notes.js:197` vs `:93`). The composer's "Replying to <author>" label (`notes.js:302`) has
  the same gap. NOW.md already lists the stub's copy as an un-picked default.
- `setReply` silently re-aims an already-typed draft at a different root with no confirmation
  (`notes.js:295`). The 44px floor's deliberately narrow horizontal expansion on `.note-action`
  (`v3.css:353-360`) already narrows this, so it needs a fairly tight layout.
- Delete's two-tap "Sure?" arm is closure-local (`notes.js:152-162`) and silently resets if any
  repaint lands inside its 3-second window — and it swaps `textContent` with no `aria-live`, so
  a screen-reader user is never told the control's meaning changed under focus.
- **Once a root is deleted, its thread can never receive another reply**, permanently — the
  stub row (`notes.js:251-253`) wires no `onReply`. Not flagged as a decision anywhere.

### PLAUSIBLE · P2 — server side
- **A reply pointing at another reply renders as "X removed this note" over a live note.** The
  server validates only `re`'s shape, never that its target isn't itself a reply
  (`api/_lib/crew-shared.mjs:138-185`, whose own comment says "the server guarantees only the
  shape"). `model.threadsFor` (`js/v3/model.js:146-170`) then buckets such a note into the same
  branch as a tombstoned root and uses the *live* target's author as `stubAuthor`. Confirmed
  end to end against a constructed doc. **Not reachable from the shipped UI** — but Ray
  Perfetti's fork is exactly the second client this is waiting for, and any fix to the reply
  UX above walks nearer to it. *Fix:* in `validateNoteMap`, reject a note whose `re` target is
  itself carrying `re`.

---

## Settings

### CONFIRMED · P1
- **"You" still renders below "Crew."** `js/v3/settings.js:666-668` (verified by hand) appends
  festivals, then crew, then you. The file's own line-2 comment already claims the intended
  order is "YOUR FESTIVALS → YOU → APP." No shared state, DOM ids or scroll anchors couple the
  two sections — the swap is exactly as trivial as it looks. **This is your ask, verbatim.**
- **Self-rename's duplicate check is case-sensitive, and everything else isn't.**
  `settings.js:617` does a bare `state.people()[v]` lookup. The server rejects two active names
  differing only by case at merge time (`crew-shared.mjs:369-375`), and `app.js:935/940/1389`
  already compare lowercased. Renaming to a case-variant shows a success toast, then the server
  permanently refuses the merge — a `blocked` state that by design never auto-retries, leaving
  the device silently desynced with nothing in Settings saying so. *Fix:* compare
  case-insensitively **against `state.people()`, not `activePeople()`** — the full map
  including tombstones, since a prior Codex gate deliberately added the removed-name check the
  reader's own suggested fix would have deleted.

### CONFIRMED · P2
- **"My link" has no path from Settings → You.** The person-restore link and its warning exist
  only on the landing screen (`app.js:1221-1234`). The only route back is Settings → Crew →
  Switch crew, which resets the whole app to landing (`app.js:1062-1065`). *Fix:* a My-link row
  inside You, reusing the landing card's copy.
- **Cross-circle festival rows never show a pick count**, though `docs/user-flows.md` F11.2 says
  every row does. `settings.js:166` hard-zeroes it for other circles — while `model.landingPairs`
  one line above already resolved that circle's cached doc for its people list.
  `model.picksFor(state.cachedDoc(p.token), p.fid)` composes directly. Also means a row with
  zero or one known person shows neither a count nor names, just a bare date.

### PLAUSIBLE · P2
- **The Spotify scan's album-cover flicker ignores the app's own Low Power toggle**
  (`settings.js:1251` checks only `prefers-reduced-motion`, though `ctx.lowPower` is in scope) —
  an image swap plus a real network fetch roughly every 350ms for a multi-minute scan, on the
  device that opted out of exactly this. One-line fix. Downgraded from P1 because it is a
  one-time user-initiated scan already far more network-heavy than the image swaps.

---

## Festival data (Lost Lands / ACL / Seismic vs the Portola pattern)

Research pass of 2026-08-30 is banked at `claude-plans/2026-08-30-survey/research-festival-data.md`.
**Before touching any of these three files, run `node scripts/freeze-pick-keys.mjs --all-live`** —
all three are live and pickable, and the doc requires it.

### CONFIRMED · P1
- **ACL is built, not dropped in.** `data/festivals/acl-2026.json:646`'s own meta note says
  official set times for both weekends went live the week of 2026-08-17 and the two-weekend
  scheduled renderer shipped 2026-08-23 (commit 5521ff6, and `festival-rules.mjs` really does
  carry W1/W2 + `isos` support). The file was last touched 2026-08-23 and is still
  `status: "lineup"` with no `days{}` and no `timezone`. **Answering your "idk if we ever built
  in details for ACL": the code is ready, the data was never entered.** *Blocked on:* the
  schedule lives as six images at aclfestival.com/schedule — re-confirmed 2026-08-30, no JSON,
  no text, no automated path. A human has to read the posters.
  - *Free groundwork now:* add `timezone: "America/Chicago"`.
  - *Resolved, no data change:* the file's open Sienna Spiro / Laszewo flag — a second source
    (KVUE, 2026-08-30) confirms the file's current day assignment is right; the single-sourced
    "move" appears not to have happened. Update the note to say so.
  - **UNVERIFIED:** an official "ACL Fest Nights" aftershow series (Oct 2-13, $40-70, several
    lineup artists reappearing — the Portola unify-by-name case) is real per search snippets,
    but do512.com/aclfestnights 403'd on direct fetch twice. Gates times (Fri noon, Sat/Sun
    11am) are likewise secondhand. Both need one direct browser look before they are written in.
- **Lost Lands: day tags dropped 2026-08-21 and we don't have them.** Friday / Saturday / Sunday
  splits for the ~96 main-bill artists are confirmed across a press wave and JamBase's
  day-grouped list, cross-checked against the official poster. This is the one clearly
  actionable lineup improvement available today. Keep `status: "lineup"` — no stage/time grid
  exists yet, and on 2025's precedent (times landed ~4 days out) expect that around Sept 14-16.
  Also: the 21 pre-party artists (`lost-lands-2026.json:299-382`) carry only a `day` fragment,
  no `stage` or `time`, unlike every Portola Afters entry. Add the fields; **do not rename the
  frozen day strings** — `tests/fixtures/live-pick-keys.json` freezes them.

### CONFIRMED · P2/P3
- **Portola's `dates` disagrees between the two files** (see *First visit* above). P2.
- **`defaultFestivalId()` trusts raw array order for "next upcoming festival"**
  (`js/festivals.js:84`) — takes position, never `startsOn`. Both `add-a-festival.md` and
  `data/festivals/README.md` say "keep it ordered by date" and nothing enforces it
  (`validate-festivals.mjs:59-70` only checks each date parses). `model.landingPairs` is immune
  (it sorts). Correct today only because the file happens to be hand-sorted — and the archived
  block already **isn't** (see *First visit*). P2. *Fix:* a validator rule asserting ascending
  `startsOn`, which catches both symptoms at commit time.
- **Seismic is correctly stale, not neglected.** `seismic-9.json` is Phase One only (33 of a
  promised more, the official page still says "+MORE TBA"), `researchedAt: 2026-07-07`. The 8.0
  edition's Phase Two landed 2025-09-18, eight weeks before its festival — so the equivalent
  checkpoint for 9.0 (Nov 13-15) is around **2026-09-18**. **Answering your "idk if we ever
  updated Seismic": there is genuinely nothing to ingest yet.** Three artists have informal
  day/stage hints buried in promo bios; 30 of 33 have none. Use `America/Chicago` when it lands.
  P3, no change now — but it needs a standing reminder, not a memory.
- Date-range punctuation in `index.json` mixes en dashes and hyphens across ten entries. P3,
  cosmetic, fix in passing.
- **Name check:** no pick-key renames found in any of the three files; even the oddly-stylized
  names byte-match today's sources. One soft flag — Seismic's own page capitalises "Horsegiirl"
  in a section heading where the file (and the rest of that page) uses lowercase. Almost
  certainly heading style; confirm before ever re-freezing seismic-9's keys.

---

## Sync, offline & the service worker

Independently walked end to end: `js/sync.js`, `js/state.js`, `js/merge.js`, `api/crew.js`,
`api/_lib/crew-sql.mjs`, `service-worker.js`, `js/util.js`. **No defects found.** The debounce,
the refused-payload signature matching, the push-generation race guard, the `sendBeacon` flush
on hide, the atomic inline merge, the network-first festival data with its activate-time cache
rescue, the storage-getter guards, and `makeNoteId`'s author-prefixed collision-proofing all
behave as documented. `node scripts/sw-stamp.mjs --check` is clean on this branch.

The one server-side finding (a reply-to-a-reply rendering as a false tombstone) is filed under
*Notes & threads* above, since that is where it surfaces.

---

## Design system & motion cost

The two P0/P1 items — the `.facts-grown` click guard and the `.wall-grid` row inflation — are
filed under *Picking on the wall* and *The zoom*; three dimensions reached them independently.

### CONFIRMED · P2
- **Every picked card runs an infinite paint-triggering animation with no off-screen pause.**
  `.card.animated` (`v3.css:25`) shifts `background-position` on a 12s loop, under a
  `mix-blend-mode: overlay` grain layer (`v3-tokens.css:159`) — paint work, not compositor
  work, on every picked card continuously while the wall is open. `aura.js:24/34` sets
  `animated: true` for any nonzero pick count, and no IntersectionObserver gates it (the one in
  the codebase, `wall.js:1019`, drives the day-tab scrollspy). Pre-existing, scales with wall
  size. Separately, `.day-rail` and `.stage-strip` (`v3.css:208`, `:489`) combine
  `backdrop-filter: blur(10px)` with `position: sticky` — and the `.low-power` rule
  (`v3-tokens.css:181-182`) never drops `backdrop-filter`, so the most expensive thing on the
  page survives on exactly the devices Low Power exists to protect. *Fix:* viewport-gate
  `.card.animated`; add `backdrop-filter: none` to `.low-power`.

### PLAUSIBLE · P2
- **Edit / Delete / Reply / Pin / reply-count all render as identical `.note-action` tokens**
  (`notes.js:96-100`, one builder, no variant argument) — nothing distinguishes the destructive
  one from the compose one from the disclosure toggle. (Correction to the reader's evidence:
  `v3.css:562` removes the underline, so they read as plain muted text, not links.) This is the
  design half of the comment-row redesign below.

### CONFIRMED · P3
- Dead class: `.n-note.pinned` (`notes.js:82`) has no CSS rule anywhere. The pinned effect comes
  entirely from the inline `--wash` value set one line below. Drop it or give it a rule now.

---

## Spotify

### CONFIRMED · P1
- **Disconnect's own copy is false.** "Disconnect keeps picks and notes — only the badges
  disappear" (`settings.js:1421`), but the handler calls only `spotify.disconnect()`
  (`js/spotify.js:65`), which removes two localStorage keys and never touches
  `crewDoc.affinity` — a **synced, crew-visible** field that every card reads on the next
  `refreshCtx()` (`app.js:105`, `wall.js:130`, `card-facts.js:54`, none gated on
  `isConnected()`). The badges stay, locally and for the whole crew. *Fix:* clear
  `crewDoc.affinity[meName]` on disconnect — given the data is shared, clearing is the safer
  default; changing the copy is the alternative.

### CONFIRMED · P2
- **Affinity only grows, never shrinks.** `badgeAllCrewFests` (`spotify.js:319-345`) and
  `applyAffinityToCrew` (`:441-453`) both spread the existing map and only add fresh hits — an
  artist you unfollowed keeps its badge forever. *Fix (your call, see Open questions):* zero out
  every artist name actually swept before re-adding hits.
- **Affinity matching is exact-string-only and structurally guaranteed to miss b2b sets.**
  `affinityOf` (`spotify.js:350`) does one lowercase lookup, and Spotify's API returns each
  co-headliner as a separate artist, so the scanned library can never contain a compound key.
  Real shipped names: "Beltran b2b Ben Sterling", "erika b2b sfcowboy", "Cole Knight b2b Dreya
  V", "Excision B2B Space Laces" (edc-orlando alone has 8+), "Chachi (DJ Set)", "Party Pupils
  (Late)". *Fix:* split on ` b2b ` / ` x ` / ` & ` / ` vs ` and strip trailing parentheticals,
  then union the hits.

### CONFIRMED · P3
- **Playlist search falls back to unfiltered free text** when the artist-filtered search returns
  nothing (`spotify.js:485`) — guaranteed for every combo name above — so loosely-matched tracks
  can land in the crew's shared playlist. Same splitting fix.
- **A reused name inherits the previous holder's Spotify badge.** `renameSelf`
  (`app.js:1121-1122`, `state.js:97`) migrates `crewDoc.affinity[old]` to the new name but never
  clears the old key, and `tests/db-merge.test.mjs:223` confirms a tombstoned name is
  deliberately reusable by a different physical person. A new member claiming a freed name
  inherits someone else's liked-song counts with no Spotify connection of their own. Small
  window, real cross-person leak — worth fixing alongside the disconnect fix.
- `runFullSync`'s mid-scan guard (`settings.js:1031-1037`) compares only the crew token, not the
  identity, so a rename mid-scan writes the finished stats under the tombstoned name.
- "Just mine" playlists are never persisted (`settings.js:1349-1352` only records when
  `!mineOnly`), so reopening the drill shows a bare "Make playlist" with no link back. Possibly
  intentional — there is no crew-shared home for a personal playlist.

---

## Tests, docs & hygiene

### CONFIRMED · P1
- **The pick-cycle is tested only as a pure function.** `tests/v3-model.test.mjs:58` calls
  `model.nextTapLevel()` directly; nothing ever dispatches a click through `wall.js:208-217` and
  `app.js:77-80/146-168`. That is precisely where the P0 lives. *Fix:* a jsdom test that renders
  a real card with real `ctx` wiring and dispatches repeated clicks — plus the zoom-specific
  version (hover, advance past the intent timer, click inside the grown block, assert `onTap`
  fires). The survey's own repro script is directly reusable.
- **`docs/user-flows.md` — the canonical UX spec — is not in the CI doc gate.**
  `tests/docs-truth.test.mjs:28` lists only README / CLAUDE.md / AGENTS.md. The doc's own header
  says "a mismatch is always a finding… that rule is what keeps this doc from rotting," and the
  only enforcement is a manual walk that did not run this round. Its F4 and F6 text is drifted
  today (the "Crew favorites" label; "click still picks"). *Fix:* at minimum a structural check
  that every flow's referenced screen still exists. (Aside: `AGENTS.md` is a symlink to
  `CLAUDE.md`, so that list checks one file twice.)

### CONFIRMED · P2
- **The one test that guards the merge-concurrency rule never runs in CI.**
  `tests/db-concurrency.test.mjs:27-28` gates on `DATABASE_URL`, which `.github/workflows/ci.yml`
  never sets. That is the test standing between us and a regression to the pre-lock-CTE merge
  that measurably lost 2 of 6 concurrent writes in production. "274 pass / 1 env skip" is the
  skip. Nothing in NOW.md or DEVLOG shows it was run by hand this round. *Fix:* run it against
  PGlite in CI, or state loudly in the test's own header that it is a local-only gate.
- **The reply-to-a-reply case Kevin flagged is the one thread case with no test.**
  `tests/notes-round.test.mjs:65-96` exercises Reply only on a root with zero existing replies.
  `notes.js:466/535`'s `replyTo.re || replyTo.id` flattening — the actual enforcer of the
  one-level rule — has no coverage anywhere. Establish that baseline before reshaping the UI.
- **Lost Lands is stale in a way CI structurally cannot catch.** `researchedAt: 2026-07-07`, no
  `days`/`dayMeta`/`timezone` despite `announcementStatus: "lineup-with-days"`, and a meta note
  with no sourcing narrative — against Portola's `2026-08-27` with all three keys and a full
  methodology note. `validate-festivals.mjs` (76 lines) checks shape only; it has no concept of
  research freshness, and shouldn't. This is a calendar problem, not a code problem.

### CONFIRMED · P3
- The 117 deleted chip-gesture test lines are correctly-retired coverage for a correctly-retired
  feature — no gap. One residual: the WebIDL "Illegal invocation" regression stub went with them.
  Every new timer call site this round (`card-facts.js:430-448`, `wall.js:173/978/995`,
  `app.js:1777`) calls bare globals, so none are at risk today; the pattern is worth remembering.

**Hygiene:** clean. No crew tokens in tracked files; `.gitignore` correctly denies screenshots,
`.env`, `.playwright-mcp`; CI runs the suite twice including a non-UTC timezone plus festival
validation and a high-severity npm audit.

---

## Comment-thread redesign

Full notes with dated sources: `claude-plans/2026-08-30-survey/research-comments.md` (15
products surveyed: GitHub, Linear, Figma, Notion, Slack, Instagram, YouTube, Reddit, Substack
Notes, Bluesky, Threads, iMessage/Apple Notes, Are.na, Basecamp, Discourse).

**What every mature product does that we don't:** collapse reply/edit/delete/pin behind **one**
disclosure whose trigger shape never changes between your notes and other people's — only the
menu *contents* vary. None of them keeps a permanent multi-token row that gets wider when the
note is yours. That is exactly our bug. Pin is overflow-only everywhere it exists. Delete
confirmation everywhere is "open a menu, then confirm" — never a label-swap on a standing
button, so our existing two-tap arm is fine; only *where its first tap lives* needs to change.
"Edit owns delete" has partial precedent: Linear, Notion and Basecamp put Edit and Delete as
siblings in the same menu; nobody makes delete reachable *only* from inside an active edit.

### Direction A — press reveals plain-text cues; delete lives only inside Edit
**At rest:** nothing but name and text, on every note, yours or not. The only direction where
the row genuinely disappears.
**Reply:** press-and-hold (mobile) or hover (desktop) on any note fades in one line of plain
words under the text — someone else's: `Reply · Pin`; your own: `Edit · Reply · Pin`. Reply
opens the composer **inline, directly beneath the note you pressed** — root or reply — never at
the sheet's bottom. Replying to a reply pre-fills `@Name `. The note still posts flat, appended
at the thread's end; the `@Name` carries "who I'm answering," not indentation.
**Edit + delete:** Edit turns the note's own text into an editable field in place and the cue
line becomes `Save · Cancel · Delete`. Delete is visible *only* because you are editing; there
is no other path. Keeps the existing two-tap arm.
**Pin:** rides the same reveal, for everyone.
**Parity:** one interaction — press-and-hold and hover reveal the identical line and open the
identical inline composer; only the trigger differs.
**Risk:** on your own note, press has to disclose a small menu rather than doing one thing, so
it isn't literally "the note IS the reply button" for own notes — only for others'. Long-press
can fight the browser's native text-selection gesture on mobile, and hover reveals nothing for
keyboard and switch-control users: a visible-on-focus fallback is required, not optional.

### Direction B — one overflow dot per note; composer inline under the thread
**At rest:** name, text, and one small persistent `···` (plain characters, not an icon) at the
note's trailing edge, muted.
**Reply:** tapping `···` opens a tiny stacked-text menu — no border, a soft colour-matched wash
a shade darker than the note, floating just below it. Same `@Name`-prefix, flat-append reply
behaviour as A.
**Edit + delete:** two lines in the *same* `···` menu — siblings, the Linear/Notion/Basecamp
pattern. Lighter and more conventional, but does **not** literally nest delete inside edit.
**Pin:** also a line in the menu, for anyone.
**Parity:** the strongest of the three — `···` is always visible and always tappable, so touch
and mouse are identical and no hover state is needed anywhere.
**Risk:** a small piece of permanent chrome on every note forever. Far lighter than today's
row, but it satisfies neither half of the ask literally.

### Direction C — swipe on phone, hover on desktop; edit is a mode that owns delete
**At rest:** clean, both platforms — identical to A.
**Reply:** mobile, swipe the note slightly left to reveal the word "Reply" behind it (iOS Mail's
pattern), release to open the inline composer; long-press is the fallback list. Desktop, hover
fades in the same cue. Same `@Name` flat-append behaviour.
**Edit + delete:** long-press (mobile) or hover-click (desktop) on your own note enters a real
editing mode — the wash intensifies as a mode signal, text becomes editable, and the only
controls are `Save`, `Cancel` and a small trash mark. Delete reachable exclusively through this
mode — the same literal nesting as A, via a different gesture.
**Pin:** rides the same reveal as Reply.
**Parity:** deliberately different primary gestures per platform, with long-press/click as the
shared fallback — two things to design, build and test, in exchange for each feeling native.
**Risk:** a horizontal swipe is easy to trigger during ordinary scrolling (a diagonal scroll can
register), so it needs real distance/velocity thresholds and cancel-on-release-outside. The
platform split is structurally two code paths that drift — this repo's own history (the 44px
floor naming six selectors, the WebIDL and storage-getter gaps) is a record of exactly that.

### Recommendation
**Direction A, with the own-note ambiguity resolved by always showing the cue line** — never
skipping straight to an action, so the gesture means the same thing on every note. The reasoning
is the same one that earned this repo the "44px on `button`, not a list of selectors" rule: a
rule that always discloses is legible and hard to get wrong later, where "press does something
different depending on whose note it is" is the implicit special-casing this codebase has been
burned by before. Over B and C, specifically:

1. It is the closest literal answer to both halves of the ask. Only A and C give you delete
   reachable *only* from inside editing; "replies not a button" is best honoured by A/C's
   nothing-at-rest over B's permanent `···`.
2. It fits the no-boxes rule furthest. A's revealed cue line is more of the same typographic
   material the note is already made of — words on a wash. No icon, no bordered menu, no glyph
   competing with the colour wash forever whether or not anyone taps it.
3. It is one interaction to build, not two. C forks into swipe-vs-hover with its own edge cases;
   for an app this thin on hands, one well-tested path beats two.
4. **The reply-to-a-reply fix is free and shared across all three — ship it whichever chrome
   you pick.** The composer opens wherever you pressed Reply, pre-fills `@Name` when the target
   is a reply, and the note still posts flat. That alone kills the "so strange" jump-to-root.

**Fallback if built-A reads too indirect:** Direction B is the documented second choice — the
strongest parity and the most precedent, at the cost of the permanent glyph.

**Before promoting either:** a focus-visible fallback for the reveal, and a real pointer-input
walk (not `element.click()`), per this repo's own standing lesson that Node tests are blind to
browser gesture behaviour.

---

## Proposed build order

### On this branch, before PR #13 can merge in good faith
Your asks, in your order, each tied to what solves it.

**1 · "Multiple taps no longer increase pick intensity" — XS**
Narrow the `wall.js:212` guard (`.facts-grown` → `pointer-events: none`, its one button
`auto`; or `closest('button')`). Restores click-picks-anywhere on desktop *and* restores the
documented tap-to-dismiss on touch, both of which are dead today.
→ *Ledger items:* the P0 under **Picking on the wall**.

**2 · "The whole row animates and resizes… like it's just punching out" — M**
Take the zoomed card out of grid flow: placeholder in the cell, the same node switched to
`position: fixed` at its measured resting rect, growing by `transform` + `clip-path` centred on
its original spot. The narrow interim (drop the `minHeight` write only) is an XS if you want the
row settled before the deeper morph work, but item 3 needs the deep version anyway.
→ *Ledger items:* the two P1s under **The zoom**, first one; the P1 under **Picking on the wall**.

**3 · "The animation slows and jitters — too heavy for the lightweight we want" — S**
Falls out of item 2 (the shrink becomes compositor-only). Plus: thread `ctx.lowPower` into
`canAnimate()`; consider fading the sub-line, pills and chips as one group instead of 13-15
individual hops; preserve the zoom across a remote repaint instead of replaying the morph.
→ *Ledger items:* the layout-keyframe P1, the Low-Power P1, and the remote-repaint P2 under
**The zoom**.

**4 · "Lost Lands not getting the cleaned-up description" — S**
Shorten `dates` in both files to the short form; add `dayMeta` for the two pre-party days; add
`stage` + `time` to the 21 pre-party artists on the Portola Afters pattern; route `dayHeader`'s
label through the same parenthetical-stripping helper the day-rail tab already uses. Freeze pick
keys first; do not rename day strings.
→ *Ledger items:* the P1 under **Picking on the wall**, the P1 under **First visit**, the Lost
Lands P1 under **Festival data**.

**5 · "Did we ever build in details for Seismic or ACL?" — XS on this branch**
The answer is in the ledger, not in code: ACL's renderer shipped 2026-08-23 and the data was
never entered (blocked on a human reading six schedule images); Seismic has nothing to ingest
until roughly 2026-09-18. On this branch, do only the free, zero-risk parts: add
`timezone: "America/Chicago"` to ACL, and resolve its stale Sienna Spiro / Laszewo note. The
ingests themselves are follow-on work below.

**6 · "Move You above Crew in Settings" — XS**
Swap two `appendChild` calls at `settings.js:666-668` and correct the line-2 order comment.
While in the file: the case-insensitive rename check (against `state.people()`, tombstones
included) is a second XS and prevents a silent permanent desync.
→ *Ledger items:* both P1s under **Settings**.

**7 · The comment-thread redesign — L**
Direction A as specced above. Two pieces that can land independently: the reply-placement fix
(composer opens under the note you pressed, `@Name` prefix, flat append) is the free half and
kills the "so strange" complaint on its own; the press-reveal chrome with delete nested in edit
is the larger half. Add Cancel to the editor as part of it, and the textarea-plus-counter for
long notes.
→ *Ledger items:* the three P1s and the P2s under **Notes & threads**; the action-row P2 under
**Design system**.

**8 · Cover the gap that let all this through — S**
A jsdom test that dispatches real clicks through the card handler and asserts the pick advances
0→1→2→3→4→0, plus the zoomed variant; a thread test with an existing reply already rendered.
Then a real-pointer browser walk of hover, hold, tap-while-zoomed and the new thread UI before
promoting — the last walk was 9/11 clean and still missed the P0.
→ *Ledger items:* the zero-coverage P2 under **The zoom**; both P1s and the thread P2 under
**Tests, docs & hygiene**.

**9 · Cheap correctness while the files are open — XS each**
Spotify disconnect actually clearing `crewDoc.affinity[meName]` (the copy is false today, and
the data is crew-visible); `docs/user-flows.md`'s "Crew favorites" → "Most picked" and its
"click still picks" line; drop the dead `sort === 'day'` branch and the `.n-note.pinned` class.

### Follow-on branch
- **ACL set-times ingest — M.** Blocked on a human transcribing six schedule images. Then
  `days{}` in two-weekend shape with W1/W2 tags, `dayMeta` with `isos`, `status: scheduled`,
  freeze keys, validate, test, real screenshot check (the scheduled two-weekend path has test
  coverage but no real data has ever exercised it). Do the **UNVERIFIED** ACL Fest Nights
  aftershow section and the gates times in the same pass, after one direct browser look.
- **Lost Lands day tags — S.** Add Fri/Sat/Sun to the ~96 main-bill artists from the
  2026-08-21 splits. Keep `status: lineup`. Full set times expected around Sept 14-16.
- **Seismic Phase Two — S, not before ~2026-09-18.** Needs a real calendar reminder, or it
  becomes another "idk if we built that in" in a month.
- **The transform-only zoom overlay**, if item 2 ships as the narrow interim instead.

### Backlog
- Server-side one-level-deep enforcement for `re` (`validateNoteMap`) — not reachable from our
  UI, but Ray Perfetti's fork is the second client it is waiting for.
- Spotify combo-name splitting (b2b / parentheticals) for badges, and separately for the
  playlist search fallback. Affinity ratchet, pending your call below.
- The affinity-inherited-by-a-reused-name leak, and the mid-scan rename guard.
- "My link" row in Settings → You; pick counts on cross-circle rows.
- `defaultFestivalId()` / archived-fests ordering, plus a validator rule asserting ascending
  `startsOn` in `index.json`.
- Viewport-gating `.card.animated`; `backdrop-filter: none` under `.low-power`.
- `docs/user-flows.md` in the CI doc gate; `db-concurrency.test.mjs` running in CI.
- The `dates` field's two homes — one derived field or two honestly-different names.
- Duplicate person rows for Nhu/Pegah/HG (already on NOW.md), and the walker's three throwaway
  Neon rows.

---

## Open questions — genuinely yours

1. **Touch: should a tap on a held card pick, or dismiss?** Today it dismisses, by design
   (`docs/user-flows.md` F6). Once the P0 is fixed, mouse will pick-and-keep-the-zoom. Making
   touch match — tap picks, keeps the zoom, repeated taps cycle while you preview; Escape and
   tap-outside dismiss — is a small change and would make one grammar across both. Your taste.
2. **Comment redesign: A, B or C** — and within A, whether pressing someone else's note should
   jump straight to Reply with no cue line, or always show the same line. The research
   recommends always showing it; the alternative is more direct and less consistent.
3. **Deleted-root stub copy** — NOW.md already has this as an un-picked default. Decide the
   wording and the "you" substitution together rather than patching the pronoun in isolation.
4. **Spotify badges: a record, or a mirror?** Should a rescan clear badges for artists you no
   longer follow, or is "what you once listened to" the intent? Clearing is destructive; both
   are defensible.
5. **ACL's six schedule images need a human with a browser.** No automated path exists —
   confirmed again 2026-08-30. Who does it, and is it worth doing before Oct 2?
6. **Should "remove a member" exist?** Only self-rename and forget-the-whole-crew do today. It
   may be a deliberate consequence of the additive merge model, or a real gap.
7. **Settings is a fixed 560px column at every viewport** — deliberate exception to the
   "desktop is designed, not stretched mobile" principle, or worth revisiting in this round?

*Resolved by the code or the docs, so not asked:* whether you can reply to a reply today (you
cannot — there is no affordance; the strangeness is the composer sitting at the sheet's bottom
naming the root); whether ACL's renderer exists (it does, since 2026-08-23); whether Seismic was
missed (it wasn't — nothing has been published); and Settings' order (your ask, just do it).

---

## Appendix — refuted and corrected

**Nothing was refuted.** All 55 findings survived the skeptic pass as CONFIRMED or PLAUSIBLE.
What the skeptics *did* correct is worth keeping:

- **Severity down:** the `.wall-grid` row stretch P0→P1 (`unzoom()` fully restores the stashed
  height, so nothing persists). The nested-reply false tombstone P1→P2 (not reachable from the
  shipped UI). The reply-target retarget P2→P3 (the 44px floor's narrow horizontal expansion
  already guards it). The stub's missing "you" P2→P3 (already a tracked open decision in
  NOW.md). The Spotify scan's Low-Power gap P1→P2 (one-time scan, already network-heavy). The
  undifferentiated action row P1→P2. The dead `.n-note.pinned` class P2→P3. The "Hold for
  notes" coach mark P2→P3 (already tracked). "You above Crew" filed at P1 by three readers and
  P3 by one who could not verify the owner's ask from code alone — it is P1.
- **Evidence corrected, conclusion intact:** the Lost Lands date line does *not* wrap
  unbounded — `-webkit-line-clamp:2` is deliberate and working; the defect is that the sentence
  reads badly within its budget. The note actions are *not* underlined (`v3.css:562` removes
  it). `.card-grain`'s blend mode is at `v3-tokens.css:159`, not `v3.css:159`. `CURRENT_DOCS`
  is at `docs-truth.test.mjs:28`, not `:24`.
- **A proposed fix that would have caused a regression:** the case-insensitive rename fix must
  compare against `state.people()` (all names, tombstones included), **not** `activePeople()` —
  swapping to active-only would silently delete the removed-name check a prior Codex gate
  deliberately added.
- **Two claims narrowed:** the `dates` divergence is visible *within a single Settings screen*
  (current-fest card reads the per-fest file; other-board rows read the index), not merely
  across screens — undersold, not oversold. And the row-inflation is lineup-wall-only; the
  set-times grid pins its rows, so a zoomed card there overflows visually instead.
- **Checked and clean:** a full 13-fest field diff (name/year/status/location/accent/dates)
  found Portola's `dates` as the only mismatch anywhere. No pick-key renames in any live
  festival file. Every new timer call site this round uses bare globals (no WebIDL receiver
  risk). The whole sync/merge/service-worker layer walked end to end with zero findings. The
  117 deleted chip-gesture test lines are correctly-retired coverage, not a lost gate.
