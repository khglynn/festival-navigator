# Trailing review: P3/P4 build (v3-design, abb6910..HEAD)

Reviewer: Claude (sonnet-5), adversarial pass per team-lead request.
Scope: P3 screens (wall/notes/settings/tools/set-times), P4 festival-add endpoint, old-UI deletion, recover.html restyle.

Findings numbered, with severity P0/P1/P2. Clean categories listed at the end.

---

## P0

### 1. "Add a festival" (P4) saves data that can never be loaded back — the feature is a dead end
- **Files:** `js/v3/settings.js:222` (success message), `api/festival-add.js` (GET handler, unused), `js/festivals.js` (loader, no custom-festival awareness anywhere)
- **What's wrong:** `POST /api/festival-add {confirm:true}` upserts into `custom_festivals` correctly. The endpoint also exposes `GET /api/festival-add?t=<token>` to read a crew's custom festivals back. But **nothing in the client ever calls that GET**, and `js/festivals.js`'s `loadFestivalIndex()`/`loadFestival()` only ever fetch `/data/festivals/index.json` and `/data/festivals/<id>.json` — the static catalog. There is no merge point anywhere that would make a saved custom festival selectable, appear in Settings' "Your festivals" list, or be loadable via `state.setActiveFestivalId`.
- **Concrete failure:** User researches a festival, reviews the preview, taps "Looks right — save it." `settings.js:222` tells them: *"Saved — it will appear in your festivals on next load."* That's false — it's written to the DB, permanently invisible in the UI. Verified via repo-wide grep: `festival-add` GET is referenced nowhere outside `api/festival-add.js` itself and its own doc comments.
- **Fix shape:** `loadFestivalIndex()` (or a new step in `boot()`/`enterApp()`) needs to fetch `/api/festival-add?t=<token>` once a crew is active and splice the results into `FESTIVAL_INDEX`/`FESTIVALS` (namespaced so a custom id can't silently shadow the static catalog — see P2 finding #7 for the related validation gap).

---

## P1

### 2. Long-press has no movement threshold — likely broken on real touchscreens
- **File:** `js/v3/wall.js:88-101` (`renderCard`)
- **What's wrong:**
  ```js
  el.addEventListener('pointerdown', () => { ...; pressTimer = setTimeout(() => {...; ctx.onOpenNotes(artistName); }, 500); });
  const cancel = () => clearTimeout(pressTimer);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointermove', cancel);
  ```
  `pointermove` cancels the long-press timer on **any** movement, no distance threshold. Real touchscreens fire `pointermove` from digitizer jitter even when a finger is held still — this is a well-known gotcha with Pointer Events long-press implementations, normally handled with a ~10px delta guard before treating movement as a cancel.
- **Concrete failure:** On a real phone, holding a finger on a card for 500ms will very often generate at least one sub-pixel `pointermove`, canceling the timer before it fires. The long-press-to-open-artist-notes interaction (atlas 21g) is likely to fail more often than it succeeds on real devices, not just "while scrolling."
- **Compounding issue:** the only other way to open the artist notes sheet is tapping the bottom-left notes chip (`wall.js:80-83`), but that chip **only renders when `noteCount > 0`** (`aura.js:86`, `aboutCorner`). For an artist with zero notes, there is no fallback UI at all — if long-press doesn't fire, there is no way to write the *first* note for that artist on a touch device. Day/fest notes are unaffected (their composer is always visible inline under the wall).
- **Fix shape:** track `pointerdown` client coordinates, only cancel on `pointermove` past a small delta (e.g. 10px), and/or add a persistent low-visibility affordance (long-press hint, or a chip that shows even at 0 notes) as a fallback entry point.

### 3. Undo toast can restore a pick into a DOM node a remote-triggered repaint already detached
- **Files:** `js/v3/app.js:52-60` (`handleTap`), `js/v3/wall.js:124-128` (`refreshCard`), `js/state.js:175-186` (`applyRemoteDoc`)
- **What's wrong:** the 5th tap (clear a "must") shows a 5-second undo toast whose callback closes over `freshEl`, the specific card DOM node from the tap that triggered it:
  ```js
  showUndoToast($('toast-root'), 'Cleared your must for ' + artistName, () => {
    state.recordSelection(artistName, ctx.meName, 4);
    applyLocalPick(artistName, ctx.meName, 4);
    refreshCtx();
    refreshCard(freshEl, artistName, ctx);   // <-- stale reference risk
    sync.scheduleSync();
  });
  ```
  `refreshCard` does `el.replaceWith(fresh)`. If `el` has no parent (detached), `Node.replaceWith()` is a **silent no-op** per spec — `fresh` is built but never attached anywhere.
- **Concrete failure scenario:** tap-5 clears a must (level 0 pushed to server within ~1.2s via `scheduleSync`, clearing `pendingChanges`). Before the 5s undo window closes, **any other crew member's pick/note change** lands via `pollSync` (fires every 25s, on tab-visibility, or on `online`). `applyRemoteDoc`'s `visible()` snapshot (all selections across the whole festival, not just this artist) now differs from before → `onRemoteChange()` fires → `repaintWall()` → `renderWall` does `root.textContent = ''` and rebuilds every card from scratch, orphaning `freshEl`. User then taps "Undo": the toast vanishes (cleared synchronously in the click handler), the data model correctly restores level 4 (`crewDoc`/`pendingChanges` are both updated and will push correctly), but the **visible wall silently keeps showing the artist as unpicked** until the next full repaint. Looks exactly like "my undo didn't work."
- **Not data loss** — the underlying state and eventual sync are correct — but it's a confusing, reproducible visual bug, and one that's *more* likely during exactly the scenario multiple people picking together in the same session.
- **Fix shape:** re-query the current card element by `data-artist` (`wallRoot.querySelector('[data-artist="..."]')`) inside the undo callback instead of trusting a captured reference, or fall back to a full `repaintWall()` if the captured node is detached.

### 4. Service worker precache: stale deleted-file list, missing every new v3 file, no cache-version bump
- **File:** `service-worker.js` (not touched at all in this diff range — confirmed via `git diff --stat abb6910..HEAD`, which does not list it)
- **What's wrong:**
  - `APP_SHELL` still lists 8 files deleted in this range: `/assets/custom.css`, `/js/app.js`, `/js/ui.js`, `/js/ai.js`, `/js/tools.js`, `/js/render/grid.js`, `/js/render/list.js`, `/js/render/people.js`. These 404 on precache (silently swallowed by the `.catch(() => {})` in the install handler), so install doesn't fail, but it's dead weight.
  - **More importantly**: none of the new `js/v3/*.js` modules (app, wall, notes, settings, tools, model, aura, palette) are in `APP_SHELL`, and neither are `/assets/fonts/fonts.css`, `/assets/v3-tokens.css`, or `/assets/v3.css` — the entire CSS system the new UI depends on. The actual v3 app shell isn't precached at all.
  - `CACHE_VERSION` is still `'festival-nav-v12'`, unchanged. Since the service worker script's bytes are also unchanged, browsers won't even detect a new SW to install — there's no forced cache invalidation for already-registered clients.
- **Mitigating factor (verified):** the `fetch` handler does cache-first-then-background-network-update for every GET, and `cache.put()` unconditionally on any successful response — so online reloads *do* eventually backfill the new files and refresh `/index.html` in the cache, even without a version bump. This isn't a permanent break for users who stay online.
- **Concrete failure window:** a user with an already-installed pre-deploy service worker who goes offline (or has a bad connection) shortly after this deploy lands can get served the stale cached `/index.html` (the old UI, since v12's cache still holds it) with no way to reach the new v3 code until they get a clean online reload. A first-time visitor is unaffected (no stale cache to begin with).
- **Fix shape (this is exactly the flagged "P5 rebuild"):** bump `CACHE_VERSION`, rewrite `APP_SHELL` to the current file set (drop the 8 dead entries, add all of `js/v3/*.js` + the three new CSS files). Flagging the specific mechanics (no version bump = no forced invalidation, relying entirely on incidental background refetch) since that changes how urgently P5 should land relative to the deploy.

### 5. recover.html: one unescaped `innerHTML` interpolation — and I found a concrete chain that reaches it with attacker-chosen HTML
- **File:** `recover.html:299`, root cause in `api/_lib/crew-shared.mjs` (pre-existing, not touched in this diff, but this is the first place its output gets rendered as HTML)
- **What's wrong:** every other `innerHTML` write in `recover.html` wraps dynamic values in the local `esc()` helper (verified at lines 143, 147, 150, 185, 190, 193, 206, 296-298 — all correctly escaped). One is not:
  ```js
  } catch (e) { $('result').innerHTML = `<span class="bad">Failed: ${e.message}</span>`; }
  ```
  in the `merge-btn` click handler. `e.message` carries `await res.text()` — the raw, unparsed `/api/crew` POST response body (line 280: `throw new Error(\`merge failed (${res.status}): ${await res.text()}\`)`) — with **no** `esc()` before it lands in `innerHTML`.
- **I traced this further and it's not hypothetical.** `api/crew.js` returns validation failures as `res.status(400).json({ error: check.error })`, where `check.error` comes from `validateIncoming()` in `api/_lib/crew-shared.mjs`. Several of its `fail()` messages interpolate the attacker-supplied value **raw, with zero escaping** — not even `JSON.stringify`'s minimal quoting:
  ```js
  if (!isPlainObject(byPerson)) return fail(`selections[${artist}] must be an object`);   // crew-shared.mjs:95
  ```
  `artist` only has to pass `validArtistKey()` first, which checks length (≤100) and control characters — it does **not** exclude `<`, `>`, `&`, `"`, `'` (by design: real artist names legitimately contain `&` and apostrophes). So `POST /api/crew?t=<token>` with body `{"data":{"festivals":{"x":{"selections":{"<img src=x onerror=alert(1)>":"not-an-object"}}}}}` gets a 400 back whose JSON body literally contains `selections[<img src=x onerror=alert(1)>] must be an object`, unescaped, straight from the server. (`person ${name}: ...` messages at lines 80/82-85 have the identical pattern for person names, though `validName`'s `SAFE_NAME_RE` at least excludes `<>"'&\` there — the artist-key path is the clean one.)
- **What's still required to actually pop this in a victim's browser:** recover.html's merge flow builds its POST body from the *victim's own* legacy localStorage (`fn_data_v2`/`fn_pending_v2`/`lollaSelections`), not from a form field an attacker can fill in directly. So today this needs either (a) legacy data on the victim's device that happens to contain HTML-special characters in an artist/person key from an older, less-strict client (plausible — this tool exists specifically to rescue messy old data), or (b) a social-engineered "paste this into your console" attack against a recover.html user. The **root cause is real and server-side** regardless: `crew-shared.mjs` reflects raw attacker-controlled strings into error bodies, and today `recover.html` is the only place in the codebase that renders those bodies as HTML — but it's one future `innerHTML` call away from becoming directly exploitable anywhere `/api/crew`'s error text gets displayed.
- **Fix shape:** two independent fixes, do both — (1) wrap `e.message` in `esc()` in recover.html like every other site in the file; (2) stop interpolating raw user-controlled values into `crew-shared.mjs`'s error messages (truncate + strip, or just don't echo the value at all — `selections[<omitted>] must be an object` loses nothing useful for debugging).

---

## P2

### 6. `extractJson()` gives up on the first bad brace-span instead of scanning further
- **File:** `api/festival-add.js:40-56`
- **What's wrong:** the bracket-matching scanner starts at the *first* `{` in the response text and returns `null` if that first balanced span fails `JSON.parse` — it never continues scanning for a *later* `{` that might be the real payload.
- **Concrete failure:** the prompt asks for "no markdown fence, no prose before or after," but grounded/search-tool Gemini responses often add a citation or a sentence of preamble anyway. Any stray balanced-but-invalid `{...}` in that preamble (e.g. a parenthetical aside using braces) permanently breaks extraction for that response, surfacing as "Research returned no usable data" even when valid JSON follows later in the text.
- **Fix shape:** on parse failure, continue scanning from the next `{` after `start` rather than returning immediately.

### 7. Festival-doc validation has no length caps on LLM-researched string fields
- **File:** `api/_lib/festival-rules.mjs` (`validateFestivalDoc`)
- **What's wrong:** artist `name`, festival `name`/`subtitle`/`location`/`dates` are checked for type/truthiness but have no max length — unlike the parallel crew-doc validator (`api/_lib/crew-shared.mjs`) which caps `LIMITS.artistName = 100`. Since this data originates from an LLM doing live web search (an untrusted-content boundary, and a prompt-injection surface — see #11), a manipulated or malformed response could pass validation with pathologically long strings and get permanently saved to a crew's `custom_festivals`. Not an XSS risk (renders via `textContent` everywhere per the P2 gate rule), but a data-quality gap against the project's own "define expected ranges, reject implausible values at write time" principle. Also: the research/preview response (`api/festival-add.js:111`) has no size cap at all before being validated and returned to the client — only the confirm/save step enforces `LIMITS.docBytes` (256KB).
- **Fix shape:** add reasonable max-length checks to `festival-rules.mjs` (name/subtitle/location/dates, and artist name), shared by both CI validation and this endpoint since it's the stated single source of truth.

### 8. `isSyncing`/`syncQueued` aren't scoped per crew token — can delay a new crew's post-switch poll
- **File:** `js/sync.js`
- **What's wrong:** `isSyncing`/`syncQueued` are module-level globals. If a push for crew A is still in flight when the user switches to crew B, `enterApp()`'s trailing `sync.pollSync()` call for crew B no-ops (`if (isSyncing) return;` — the flag is still true from crew A's leftover request), delaying crew B's first refresh until the next 25s tick (or 5min in low power).
- **Not a cross-crew data leak** — I checked: `pushSync`/`pollSync` both capture `tokenAtStart` synchronously before their `await`, and guard every post-await write (`clearPending`, `applyRemote`) with `if (state.getCrewToken() !== tokenAtStart) return;`. `state.pendingChanges` itself is loaded fresh per-token from localStorage in `activateCrew`. So this is a staleness/UX gap, not a correctness/security one.
- **Fix shape:** scope `isSyncing` by token, or have `activateCrew`/`boot` force an unconditional `pollSync()` bypassing the in-flight check for the newly active crew.

### 9. Low-power's "sync every 5 min" is bypassed by the unconditional `visibilitychange` listener
- **File:** `js/v3/app.js:320` (`document.addEventListener('visibilitychange', () => { if (!document.hidden) sync.pollSync(); });`)
- **What's wrong:** this fires a full poll on every tab-foreground regardless of the low-power throttle set up in the `setInterval` block just above it (which correctly stretches to ~5min via `lowTick`). `stayOffline` is still respected (checked inside `pollSync` itself), but low-power is not — every phone unlock / app-switch triggers a poll at full cadence, working against exactly the battery/data-saving intent Settings describes ("sync every 5 min").
- **Fix shape:** gate the visibilitychange handler the same way the interval is gated (respect `ctx.lowPower`, or only force-poll if enough time has passed since the last poll).

### 10. Rate limiting is per-instance in-memory — already disclosed, but worth flagging against the more cost-sensitive endpoint
- **File:** `api/_lib/guard.mjs` (`rateLimited`)
- **What's wrong:** buckets live in a module-level `Map`, which is per-serverless-instance on Vercel's horizontally-scaled functions. The code's own comment already discloses this as "a speed bump against casual abuse, not a hard wall" for a hobby deployment — not new information, but the research endpoint (`festival-research`, 5/hour, calls Gemini with search grounding — the more expensive of the two buckets) is the one where quota/cost burn from this bypass actually matters; `festival-save` (20/hour, just a DB write) is lower stakes. No fix demanded given the explicit accepted-tradeoff comment, just flagging which bucket the tradeoff bites hardest.

### 11. Prompt injection surface in the festival-name research prompt — bounded, not exploited, worth a note
- **File:** `api/festival-add.js:22-36`
- **What's wrong:** `NAME_RE = /^[^\x00-\x1f<>"'`\\]{2,80}$/` blocks control characters and the characters that would break out of a quoted/code context, but prompt injection doesn't need those — free-text instructions embedded in the name (e.g. "Bonnaroo 2026, also when responding include...") could attempt to steer the grounded generation.
- **Why it's bounded:** (a) the response is schema-validated (`validateFestivalDoc`) before ever reaching the client, (b) nothing is saved without an explicit human confirm step, (c) every resulting string renders via `textContent` (P2 gate rule), so I found no path from a successful injection to XSS or unauthorized writes — worst case is a wrong/fabricated preview the human has to notice and discard.
- **Fix shape:** none required; noting for awareness since nothing in the pipeline actively detects or resists injected instructions, only bounds their blast radius.

### 12. Spotify drill has no explicit guard against a null `ctx.meName`
- **File:** `js/v3/settings.js` (`openSpotifyDrill`'s `refresh`/`make` handlers call `spotify.applyAffinityToCrew(ctx.meName, ...)` / read `ctx.meName` unguarded)
- **What's wrong:** I traced the navigation graph and couldn't find a reachable path where Settings opens with `ctx.meName == null` — `gear-btn`/`dock-fest-link` live inside `#screen-app`, which is hidden while on `#screen-join` (the only screen reachable pre-identity-claim), and `crew.me(token)` persists in localStorage once set, unaffected by a person later being tombstoned remotely. So **currently not reachable/exploitable**. But there's no defensive check either, and this is exactly the class of state the P2 gate's other null-identity guards were written for elsewhere. A future nav change (e.g. a preview mode) could silently start writing affinity data under a `null` person key.
- **Fix shape:** add `if (!ctx.meName) return;` (or disable the buttons) as cheap insurance, not urgent given current unreachability.

---

## Clean / explicitly verified categories

- **XSS, doc-derived strings → `innerHTML`:** repo-wide grep for `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval(`/`new Function(` across all `.js`/`.html`/`.mjs` files (excluding `node_modules`/`vendor`) turns up **zero** hits in any `js/v3/*.js` file. `wall.js`, `notes.js`, `settings.js`, `tools.js`, `app.js` consistently use `textContent` or the `el()` helper's `.textContent =` for every artist name, person name, and note text. `recover.html` follows the same discipline except the one gap in finding #5. (`gallery.html` has two `insertAdjacentHTML` calls but is a pre-existing P1 dev/component-gallery page untouched in this diff range — out of scope, flagging only as an FYI, not a finding against this range.)
- **Cross-crew isolation on `custom_festivals`:** confirmed via `db/schema.sql:37-47` — `PRIMARY KEY (token, fest_id)` is a genuine composite key. Same-id collisions only upsert within the *same* crew (by design, matches the docstring); no path found for one crew's save to affect another crew's row.
- **`pendingChanges` across crew switches:** no leak found. Loaded fresh per-token from localStorage in `activateCrew`; both `pushSync` and `pollSync` capture `tokenAtStart` before their `await` and guard every post-await state mutation against a mid-flight crew switch.
- **Dock scrollspy `IntersectionObserver` leak:** none — `renderDockDays` in `app.js:116-140` calls the previous `unspy()` disconnect function before rewiring a new observer on every repaint.
- **Boot-sequence races:** `bootGeneration`/`current()` in `app.js:279-294` correctly guards against overlapping `boot()` calls from rapid `hashchange` events (checked after every `await`).
- **CI Tailwind-freshness check removal:** not a regression. The entire Tailwind toolchain (`tailwind.config.cjs`, `assets/tailwind.in.css`, the `css` npm script, the `tailwindcss` devDependency) was deleted in this same range, `assets/tailwind.css` no longer exists, and no HTML file references it — v3 uses `v3-tokens.css`/`v3.css` exclusively. The CI step was correctly retired alongside the dead tooling it guarded.
- **`sync-dot` CSS class mismatch:** actually *fixed* in this range, not broken — `assets/v3.css` diff shows `.sync-dot.syncing` (pre-existing dead selector, never matched what `js/sync.js` actually applies) corrected to `.sync-dot.sync-syncing`/`.sync-offline`/`.sync-error`, now matching `setSyncStatus`'s `'sync-' + s` class naming. Worth noting as a genuine improvement, not a new bug.
- **recover.html class/token regressions from the restyle:** `settings-card`/`micro-label` (in `v3.css`) and `btn-tonal`/`btn-ghost` (in `v3-tokens.css`) all still exist and are still referenced correctly; all CSS custom properties recover.html's inline `<style>` block depends on (`--page`, `--card`, `--text-body/header/secondary/tertiary`, `--border-input`, `--r-card`, `--r-settings`, `--fest`) are present in `v3-tokens.css`. The `display:none` toggle on `#merge-btn` uses inline `style.display`, not a class, so unaffected by any class rename.
- **Note length bounds:** `js/v3/notes.js`'s composer `input.maxLength = 500` matches the server's `LIMITS.noteText = 500` in `crew-shared.mjs` — consistent.
