# Codex Review — commits ac27cd1 + 5b91332 (branch prime-time)

Reviewing crews (capability tokens, Neon storage, atomic JSONB merge) and the
festival JSON model / list view / overlap grid. Findings appended incrementally
below as found, severity-tagged with file:line.

---

## Priority 1: api/crew.js + api/_lib/crew-shared.mjs

### [MEDIUM] `__proto__`/`constructor`/`prototype` pass name validation; both deepMerge impls use the vulnerable `for...in` + bracket-assign shape

`api/_lib/crew-shared.mjs:24` (`SAFE_NAME_RE`) and `validName()` (`:52-54`) only exclude
`\x00-\x1f<>"'`&\` — the literal strings `__proto__`, `constructor`, `prototype` contain
none of those and pass validation as person names (`validatePeople`), affinity person
keys (`validateAffinity`), and crew names (`validateMeta`). Artist keys in
`validateSelections` (`:70-82`) have *no* char-based check at all beyond length + control
chars, so `__proto__` passes there too.

Both `deepMerge` implementations — `api/_lib/crew-shared.mjs:26-32` and the client twin
`js/merge.js:5-11` — are the textbook prototype-pollution shape:
```js
for (const k in overlay) out[k] = deepMerge(out[k], overlay[k]);
```
With `k === '__proto__'` and `out` not already owning that key, `out[k] = <object>` invokes
the inherited `Object.prototype.__proto__` setter and rebinds `out`'s `[[Prototype]]` to
attacker-supplied data (traced through both the JS-merge create path in `crew.js:63` and
the client `state.js:56/151` call sites).

**Exploitability today is narrow, not absent:** every real call site passes remote/stored
data as `base` (1st arg) and only ever-local data (`pendingChanges`, or `body.people` on
create) as `overlay` (2nd arg) — `state.js:56`, `state.js:151`, `crew.js:63`. Since the
`for...in` loop walks the *overlay's* keys, this is reachable via `body.people` on crew
creation (server-side, attacker-controlled request body) and via a user's own
`pendingChanges` client-side. Confirmed by hand-trace: `POST /api/crew` with
`{"name":"x","people":{"__proto__":{"color":"1, 2, 3"}}}` passes `validateIncoming` and
reaches `deepMerge`, corrupting the in-memory `out.people` object's prototype for that
request (contained — doesn't reach global `Object.prototype`, and `JSON.stringify` before
the `INSERT` only serializes own-enumerable props, so the corruption doesn't visibly
persist — but it's undefined behavior a validator should reject outright, not rely on
downstream JSON.stringify to neuter).

The production **merge write** path (`crew.js:79-108`) uses the SQL `jsonb_deep_merge`
function instead of this JS `deepMerge`, so JSONB storage itself isn't prototype-pollutable
(Postgres has no prototype chain) — but a poisoned `__proto__`/`constructor` key would
still be stored as a literal JSONB key and later re-fetched by every crew member's browser,
where `js/merge.js`'s identical vulnerable shape runs again. Today's call graph (remote
always `base`, never `overlay`) limits blast radius to self-corruption, but it's a latent
landmine: one future refactor that flips argument order, or any code path that merges
server data as an *overlay*, turns this into real cross-user prototype pollution in every
viewer's tab.

**Fix:** deny `__proto__`, `constructor`, `prototype` explicitly in `SAFE_NAME_RE`/
`validName` (and add an artist-key char-class check — see XSS finding below), *and*
harden both `deepMerge` bodies with an own-property + dangerous-key guard, e.g.:
```js
for (const k of Object.keys(overlay)) {
  if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
  out[k] = deepMerge(out[k], overlay[k]);
}
```
`Object.keys`/`Object.entries` alone doesn't fix it (both are own-property-based already
via `for...in` here on plain JSON objects, so the risk is the *assignment*, not the
enumeration) — the explicit skip is what closes it. No test in
`tests/crew-validate.test.mjs` exercises `__proto__`/`constructor` today; worth adding.

### [NOTE] `jsonb_deep_merge()` Postgres function has no source in the repo

`api/crew.js:95-100` calls `jsonb_deep_merge(doc, ...)` as the sole production merge path
and the comment (`:10-14`) attributes the race-freedom and size/people invariants to it,
but there is no `.sql` file, migration script, or `scripts/*.mjs` that defines this
function anywhere in the tree (checked `find -iname "*.sql"`, `grep -rn jsonb_deep_merge`).
It must have been created out-of-band directly against Neon. Two consequences: (1) its
actual merge semantics (type-mismatch handling, e.g. merging an object onto what's
currently an array or scalar field, recursion depth, null handling) can't be reviewed or
diffed against the JS reference (`deepMerge` + `validateMergedDoc`) that the comment says
it mirrors; (2) there's no way to reproduce the database schema from scratch (new env,
disaster recovery, CI) — the function is invisible to source control. Recommend
committing its `CREATE OR REPLACE FUNCTION` as a tracked migration file.

### [MEDIUM] `pg_column_size` size gate measures compressed bytes, not the JSON-text bytes the limit is meant to bound

`api/crew.js:97` enforces the 256KB doc cap with
`pg_column_size(jsonb_deep_merge(doc, ${delta}::jsonb)) <= ${LIMITS.docBytes}`. Postgres's
`pg_column_size()` reports the (potentially TOAST-compressed) storage size of the value,
not the logical/uncompressed size. The JS "reference" invariant it's meant to mirror
(`validateMergedDoc` in `crew-shared.mjs:159-165`, unused in production but described in
the comment at `crew-shared.mjs:156-158` as enforcing "same limits, SQL-side") measures
true JSON-text bytes via `Buffer.byteLength(JSON.stringify(doc))`. These are not
equivalent measures: a payload built from many structurally-similar/repetitive entries
(e.g. thousands of `selections` leaves with the same handful of person names and 0-3
levels, which the leaf validators happily allow with no cap on the number of festivals or
selections per festival) can compress far below its logical size under pglz/lz4 TOAST
compression, so a document many times the intended 256KB in actual JSON text — which is
what gets shipped to every crew member on every `GET`/sync poll and parsed client-side —
could still satisfy the SQL-side gate. This defeats the stated purpose of the cap (bound
storage + transfer + client memory) and means the "256KB" invariant is not actually the
same invariant on both sides despite the comment's claim. Recommend either measuring true
octet length server-side (`octet_length(doc::text)` instead of `pg_column_size`) or adding
an explicit cap on cardinality (max festivals, max selections per festival) since nothing
currently bounds those counts beyond the per-leaf name/value checks.

The `editSeq`/`pendingChanges` push-race guard itself (`js/sync.js:39-72`, `js/state.js:41,
109-140`) traced clean: `seqAtStart`/body capture happen synchronously before the only
`await`, `state.getCrewToken() !== tokenAtStart` is checked *before* the `editSeq`
comparison so a crew switch mid-flight is caught first (sync.js:57) and both push and poll
correctly refuse to `applyRemoteDoc` a different crew's response onto the (by-then) wrong
active state. `editSeq` is a single global (not per-crew) counter, but that's safe here
specifically because the token-mismatch check gates first.

---

## Priority 2 (continued) / Priority 3: js/app.js crew switching — pending edits of the outgoing crew are abandoned mid-flight

`onCrewSelect` (`js/app.js:129-138`) and `enterApp` (`js/app.js:90-111`) switch the active
crew via `state.activateCrew()` with **no flush of the outgoing crew's queued push**.
`scheduleSync()` (`js/sync.js:20-23`) is a single **module-level** `setTimeout` (not
per-crew): if a user edits crew A (which calls `scheduleSync()`, arming a 1200ms debounce
timer) and then switches to crew B before that timer fires, `state.activateCrew(B, ...)`
swaps `state.crewToken` and `state.pendingChanges` to crew B's. When the stale timer
eventually fires, `pushSync()` reads `state.getCrewToken()`/`state.pendingChanges` fresh —
now crew B's — so crew A's edit is **not pushed by that timer at all**. It isn't lost (it's
already durably in `localStorage` under crew A's own key via `persistPending()`, per
`state.js:119`/`:72`), but it now has **no scheduled push**, and the 20s background poll
(`app.js:464`, `setInterval(... pollSync ...)`) only ever polls the *currently active*
crew — so crew A's edit sits un-synced, invisible to A's other crew members, until the
user happens to reopen crew A via the crew-select dropdown (`enterApp`'s
`if (state.hasPending()) scheduleSync()` at `app.js:110` is what finally re-arms it).
For a user who hops between multiple crews (the crew-select dropdown exists specifically
for that), a pick made right before switching crews can go unsynced for an arbitrarily
long time with no user-visible indication (the sync-status dot reflects only the *active*
crew). Recommend flushing (`await pushSync()`/a direct one-shot fetch) for the outgoing
crew before/while switching, or tracking scheduled-sync state per-crew-token instead of a
single global timer.

### [MEDIUM] `boot()` has no re-entrancy guard — rapid hash changes can let a stale crew fetch win and overwrite the newer active crew

`js/app.js:439-442`: `window.addEventListener('hashchange', ...)` calls the full,
un-awaited `boot()` (`app.js:382-406`) again whenever the hash token changes. `boot()` is
async and ends by calling `enterApp(hashToken, doc)` unconditionally — there's no
generation counter / staleness check comparable to `sync.js`'s `tokenAtStart` guard. If the
hash changes twice in quick succession (e.g. browser back/forward between two previously
opened crew links, or two link taps close together), two overlapping `boot()` calls are in
flight; each does its own `await loadFestivalIndex()` + `await crew.fetchCrew(token)`, and
whichever `enterApp()` call's promise chain resolves **last** wins and calls
`state.activateCrew()`, regardless of which hash change happened last chronologically. A
slower first request finishing after a faster second one would silently swap the active
crew (and rendered view) back to the *stale* one the user already navigated away from.
Doesn't corrupt server data (each crew's own doc stays correct), but shows the wrong
crew's state without any indication, until the user notices and re-triggers a switch.
Recommend a monotonic boot-generation token checked before `enterApp()` is called, mirroring
the `tokenAtStart`/`getCrewToken()` pattern already used in `sync.js`.

### [LOW-MEDIUM] Offline "join" flow uses a hardcoded empty stub instead of the locally-cached doc, and can overwrite a real cached doc with it

`js/app.js:388-399` (in `boot()`) and `js/app.js:129-137` (`onCrewSelect`): when
`crew.fetchCrew(token)` fails (offline / transient error) but the crew is still "known"
(`crew.knownCrews()` — populated by `rememberCrew` the moment a fetch *ever* succeeds, at
`app.js:397`, independent of whether the user actually finishes joining), both call
`showJoin(token, doc || { meta: {}, people: {} })` — a bare empty stub — rather than
attempting `state`'s own cached copy (`localStorage` key `fn_crew_doc_v3_<token>`, which
`state.js` already knows how to load via `loadJSON(LS.doc(token), null)` inside
`activateCrew`, but that path is never reached here because `showJoin`'s "add" handler
(`app.js:74-87`) calls `state.activateCrew(token, doc)` with the *stub itself* — truthy, so
it short-circuits `state.js:54`'s `doc || loadJSON(...)` fallback and never even tries the
cache). Concretely: a crew that's `rememberCrew`'d (dropdown-known) but never fully joined
on this device (e.g. the user saw the join screen once online but didn't pick a name, or
`fn_me_v3_<token>` was cleared/evicted independently of the doc cache) shows an empty
"this crew" join screen with no people listed when offline, and if the user adds their
name anyway, `state.persist()` immediately writes that near-empty doc over whatever richer
document might already be cached locally — showing no crew name, no other members, no
prior selections until the next successful `pollSync`/`pushSync` round-trip re-fetches and
re-merges the real remote doc. Not a server-side data-loss bug (the sync push only ever
sends the true `pendingChanges` delta, so the merge on the server is unaffected and
correct), but for an app whose entire pitch is offline-first, silently showing (and
persisting) a blanked-out crew when a real cached copy might exist is a real, user-visible
correctness gap. Recommend trying the `state`-level cache before falling back to an empty
stub, and passing `null` (not a truthy stub) into `activateCrew` so its own cache-fallback
logic can do its job.

---

## Priority 4: js/render/list.js + js/overlap.js + grid lane wiring

### [LOW-MEDIUM] `weekends` badge is the one festival-JSON field rendered without `escapeHtml`

`js/render/list.js:89-90`:
```js
const wk = r.weekends && r.weekends !== 'both'
  ? `<span class="...">${r.weekends} only</span>` : '';
```
Every other field sourced from the same "semi-trusted, comes from research" festival JSON
in this file goes through `escapeHtml` — artist `name` (`:97,99`), the joined `day`/`stage`/
`time` (`meta`, `:100`), even the search box's echoed value (`:60`). `r.weekends` alone is
interpolated raw. Today it's constrained to an enum by `scripts/validate-festivals.mjs:49`
(`['W1','W2','both']`) — but that's a lint script run manually before committing new
festival data, not a runtime/serve-time guard, so it's the only field here relying entirely
on out-of-band discipline rather than defense-in-depth escaping at render time like its
siblings. A future hand-edited or partially-validated festival JSON with a stray
`"weekends": "<img src=x onerror=...>"` would render unescaped in every crew member's grid
view. Trivial fix: wrap with `escapeHtml(r.weekends)`.

**Verified clean / by-design, not reported as findings:**
- `js/overlap.js` lane math: traced the chain-overlap clustering + greedy lane reuse
  (`overlap.js:17-43`) by hand against `tests/overlap.test.mjs` — a set that shares a
  cluster only transitively (via a middle overlapping set) can render at less than its
  locally-optimal width for the portion of its span where it's actually alone. This is the
  standard, intentional trade-off of fixed-width-per-connected-component calendar layout
  (same approach most calendar-grid UIs use) and is explicitly encoded by the "chain
  overlap forms one cluster; lane reuse after a set ends" test — not a bug.
- List sort comparators (`billing`/`name`/`day`/`mypick`/`crew`, `list.js:49-56`): each has
  a sane tiebreaker chain ending in stable `billing` order; no correctness issues found.
- Selection keys that don't correspond to a real festival artist (e.g. an attacker-chosen
  string submitted as a crew "pick") are inert in the rendering paths that matter: both
  `render/list.js` and `render/grid.js` iterate `fest.artists`/`computed` (the trusted
  festival data) and look up `selections[name]`, never the reverse, so a bogus selections
  key is simply never rendered. `render/grid.js:98-99`'s `updateArtistHighlight` uses
  `cssEscape()` for the `data-artist` selector match, so no selector-injection there either.
  (`tools.js:exportLikes` does iterate selections keys directly, but the output only ever
  lands inside an `escapeHtml`-wrapped, read-only `<textarea>`, so no XSS — just potential
  cosmetic garbage lines if someone submits a bogus "artist" name.)

---

## Summary

Two MEDIUM-severity gaps worth fixing before wider rollout: the `__proto__`/`constructor`
name-validation hole shared by both `deepMerge` implementations (contained today by the
current call graph, but a latent landmine), and the `pg_column_size`-vs-actual-JSON-bytes
mismatch in the doc size cap (the compressed-size check can under-count a highly
compressible oversized document). Two MEDIUM correctness/sync gaps in the client: crew
switching abandons a scheduled-but-unfired push for the crew you're leaving, and `boot()`
has no re-entrancy guard against rapid hash changes. One LOW-MEDIUM each on: the offline
join flow's empty-stub-over-cache behavior, and the one unescaped `weekends` field in the
list view. The core atomic-merge design (single inline `UPDATE ... jsonb_deep_merge`,
token-scoped `WHERE`, parameterized `neon()` tagged-template queries — no string-built SQL
found anywhere in `api/crew.js`) is sound and race-free as claimed; no cross-crew corruption
path found. The `jsonb_deep_merge()` SQL function itself has no source committed anywhere
in the repo, which is a reproducibility/audit gap independent of any specific bug.

