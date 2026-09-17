# P2 Module Split Review — commit 941b82b (branch prime-time)

Reviewing: js/*.js, js/render/*.js vs pre-refactor index.html (git show 941b82b~1:index.html, 911 lines).

Status: DONE

## Method
Read every module (js/*.js, js/render/*.js) in full and diff'd each against
the matching section of `git show 941b82b~1:index.html` (911 lines) by hand.
Cross-checked every `import { x } from './y.js'` against y.js's actual
`export` list (no typos/missing bindings). Ran `npm test` (29 tests, all
pass — 4 bulk + 6 merge + 7 time from this commit; the other 12 come from an
uncommitted, out-of-scope tests/crew-validate.test.mjs already sitting in the
working tree for in-progress P3 work).

## Findings

### IMPORTANT — service-worker.js not updated; stale precache list, mismatched commit claim
`service-worker.js` (repo root) was **not touched** by 941b82b (absent from
`git show --stat 941b82b`). Its `APP_SHELL` array (service-worker.js:8-15)
still lists the two CDN URLs index.html no longer loads:
```
'https://cdn.tailwindcss.com',
'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
```
and does **not** list any of the new locally-hosted assets that replaced
them: `/assets/tailwind.css`, `/assets/custom.css`, `/vendor/html2canvas.min.js`,
or any of the 11 `/js/**/*.js` module files. `CACHE_VERSION` is still
`festival-nav-v5` (last bumped in 9cd6455, an ancestor of this commit) —
unchanged despite the file's own header comment: "Bump CACHE_VERSION
whenever you change cached static assets."
The commit message for 941b82b claims "SW no longer caches cross-origin
opaques" but no service-worker.js line changed to make that true — it's
either a forgotten follow-up or an inaccurate commit message.
Practical effect: not a hard break — the fetch handler's cache-first +
background-network-update logic will opportunistically cache the new
module/CSS/vendor files the first time they're fetched over the network
regardless of the precache list, so any user who loads the app online even
once self-heals. But a genuinely offline-first install (service worker
installs, user goes offline before ever completing one online load of every
module) would precache dead CDN entries and miss the real app shell.
Recommend updating APP_SHELL to the new asset list and bumping
CACHE_VERSION to v6 in the same PR as the module split, or as an immediate
follow-up before this ships.

### MINOR — dead export
`js/state.js:73` exports `bumpEditSeq()` but nothing in the codebase imports
or calls it (grepped all of js/). Leftover from the refactor; not wired to
anything, not a bug, just unused surface.

### MINOR — package.json missing "type": "module"
Causes `node --test` to reparse js/parse.js, js/merge.js, js/time.js as ESM
on the fly for every test run (`MODULE_TYPELESS_PACKAGE_JSON` warning ×3).
Cosmetic/perf only — browsers ignore package.json "type" for
`<script type="module">`, and all 29 tests pass regardless.

## Verified clean (no drift found)
- `deepMerge` (js/merge.js) — byte-identical to old index.html:221-227.
- `timeToMinutes` / `absMinToLabel` / `activityMinutes` / `computeDayArtists`
  (js/time.js) — byte-identical logic to old index.html:305-356, 503-514;
  computeDayArtists is a faithful extraction of the old getDayArtists' body
  minus the dayCache memoization (memoization now lives in
  state.js:getDayArtists, which wraps computeDayArtists — same caching
  behavior, just relocated).
- `recordSelection`/`recordPerson`/`ensureFestivalState` (js/state.js) —
  including the temporary `activeFestivalId` swap-and-restore inside
  ensureFestivalState used to seed a new festival's default crew — reproduces
  old index.html:230-261 exactly, including that the temp swap does NOT go
  through the exported `setActiveFestivalId` setter (so it correctly skips
  the `localStorage.setItem` side effect during the internal seed step, same
  as the original).
- `addPerson`/`removePerson` tombstone semantics (js/app.js) — matches old
  index.html:269-298 exactly (removed:false revive path, level-0 zeroing of
  picks, selectedPerson clear-on-remove).
- `handleArtistClick` level cycle 0→1→3→2→0 (js/app.js:56-70) — matches old
  index.html:548-562 exactly.
- `renderDay`/`renderActivities`/`updateArtistHighlight`
  (js/render/grid.js) — matches old index.html:436-546 exactly, including
  the gridBaseMin trim-lead-time math and the Spotify-affinity badge markup.
  **Confirmed `renderDay(day)` calls `state.setCurrentDay(day)` as its very
  first line** (grid.js:17) — this exactly mirrors the original's
  `currentDay = day;` as renderDay's first statement. I initially flagged
  app.js's `switchFestival()`/`init()` calling
  `renderDay(Object.keys(state.fest().days)[0])` without a preceding
  `setCurrentDay` call as a possible ordering regression, but traced it
  through: it's not a bug, since renderDay sets currentDay internally before
  doing anything else, exactly as before.
- `renderPeople`/`renderLegend` (js/render/people.js) — matches old
  index.html:383-412, 493-501 exactly.
- `pushSync`/`pollSync`/`scheduleSync` race-guard (js/sync.js) — the
  editSeq-based "did a new edit land during the round-trip" guard
  (seqAtStart capture, compare-after-await, re-schedule-if-changed) matches
  old index.html:602-640 exactly. `state.getEditSeq()` correctly encapsulates
  the private `editSeq` counter (not exported as a raw `let`, unlike
  allData/pendingChanges/etc.) — same protection as the original closure.
- `parseBulkLine` (js/parse.js) — matches the regex + level-mapping logic in
  old index.html:792-806 exactly (greedy-group + end-anchor for parenthetical
  artist names, "must see"→3, "highlight"/"new discovery"→2, else→1).
- `downloadSchedule`/`handleBulkAdd`/`exportLikes` (js/tools.js) — matches
  old index.html:752-835 exactly.
- Event wiring in js/app.js:init() — every `addEventListener`/`onclick`
  assignment from old index.html:840-861 is present and wired to the same
  handler; order relative to rendering is preserved (wiring happens before
  or interleaved with rendering, same as original, no handler fires before
  its target function is defined).
- `assets/custom.css` — byte-identical to the old inline `<style>` block
  (old index.html:18-57).
- `tailwind.config.js` content glob (`./index.html`, `./js/**/*.js`) covers
  every file where Tailwind utility class strings now live — no risk of the
  precompiled CSS purging classes that moved into the split modules.

## Live-binding check (ES module `let` exports)
All of state.js's exported `let`s (`allData`, `pendingChanges`,
`activeFestivalId`, `currentDay`, `selectedPerson`) are consumed everywhere
via `import * as state from './state.js'` (namespace import — always live).
The one named (non-namespace) import of a mutable binding is
`import { geminiApiKey } from './ui.js'` in js/ai.js — also correct, because
(a) ES named-import bindings are live references per spec, not snapshots,
and (b) the only reassignment (`geminiApiKey = key`) happens inside ui.js's
own `wireModals()` click handler, i.e. the module that owns the binding is
the one mutating it. Checked every cross-module reference (not just a
sample) via a grep of all `export`/`import {...}` pairs — no missing
bindings, no typos, no stale-copy risk found.

## html2canvas global-vs-module boundary
js/tools.js:23 calls `html2canvas(...)` as a bare global identifier from
inside an ES module. Verified vendor/html2canvas.min.js is a standard UMD
bundle that attaches to `globalThis`/`self` (checked for
`typeof exports`/`typeof define`/self-assignment in the minified source).
Verified classic `defer` scripts and non-async `type="module"` scripts share
the same "run after full document parse, in document order" execution
queue per the HTML spec, so `/vendor/html2canvas.min.js` (classic, defer,
declared in `<head>`) finishes executing before `/js/app.js`'s module graph
evaluates — and downloadSchedule() is only ever invoked later, from a user
click. No load-order bug.
