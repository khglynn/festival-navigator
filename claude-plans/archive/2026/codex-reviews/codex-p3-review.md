# Codex P3 Review — commit ac27cd1 (branch prime-time)

Crew system: api/crew.js + api/_lib/crew-shared.mjs (Neon-backed capability store),
client sync (js/sync.js + js/state.js), boot/join flows (js/app.js), token handling
(js/crew.js). Live Neon project `festival-navigator` (floral-meadow-70237530) queried
directly to ground-truth the SQL side (jsonb_deep_merge function body, crews table DDL,
and an empirical TOAST-compression test) rather than trusting the commit message's claims.

## Findings

### [MEDIUM] Wrong-crew "crew gone" handling on a switch-mid-flight race
`js/sync.js:65` (`pushSync`) and `js/sync.js:86` (`pollSync`) both correctly capture
`tokenAtStart` and guard `applyRemote`/`clearPending` against a crew switch that lands
mid-request (`js/sync.js:57`, `js/sync.js:81` — good, verified sound). But the
`CrewGoneError` branch in both calls `onCrewGone()` with **no token argument**, and the
handler registered in `js/app.js:296` acts on `state.getCrewToken()` — the *currently
active* crew, not the one that actually 404'd:
```js
onCrewGone: () => { crew.forgetCrew(state.getCrewToken()); showLanding('That crew no longer exists.'); }
```
Reachable: the 20s poll interval (`js/app.js:348`) runs continuously against whatever
crew was active when it started; if the user switches crews (`onCrewSelect`,
`js/app.js:125`) while a request against crew A is in flight and A 404s, the app forgets
crew B (the new, perfectly healthy active crew) and dumps the user to the landing screen
with a false "no longer exists" message.
Fix: thread `tokenAtStart` through to `onCrewGone(tokenAtStart)` and have the handler
compare against/act on that token, not the live one.

### [LOW / defense-in-depth] Reserved-key gap lets `__proto__`/`constructor`/`prototype` pass name validation
`SAFE_NAME_RE` (`api/_lib/crew-shared.mjs:24`) and its client mirror `NAME_RE`
(`js/app.js:17`) reject control chars and HTML-hostile chars but never blocklist the JS
reserved property names. Combined with the classic-vulnerable-shape `deepMerge`
(`for (const k in overlay) out[k] = deepMerge(out[k], overlay[k])` —
`api/_lib/crew-shared.mjs:26-32` and `js/merge.js:5-11`), `"__proto__"` can be used as a
person/artist/festival-selection-person key and passes `validateIncoming` (people,
affinity's person key, and both sides of selections all route names through the same
permissive `validName`; only `festivals`' fid regex — no underscore allowed — happens to
exclude it).

Traced actual exploitability carefully rather than assuming the worst:
- **Production crew-to-crew merges never touch the vulnerable JS code.** They run
  entirely through the SQL `jsonb_deep_merge()` function (pulled the live definition from
  Neon — pure `jsonb_object_agg` + `FULL OUTER JOIN jsonb_each`, no JS prototype concept
  at all). So a person literally named `"__proto__"` CAN be persisted via the normal
  merge-write path (`POST /api/crew?t=...`) — validation allows it — but that's inert on
  the SQL side.
- The vulnerable JS `deepMerge` is reachable in exactly one place: crew **creation**
  (`api/crew.js:63`, merging `body.people` into a fresh `newCrewDoc()`).
- Traced the exact JS semantics of the exotic `__proto__` accessor here: because this
  `deepMerge` always rebuilds `out` via `{...base}` (a *copy*), never mutates `base` in
  place, the classic "read `__proto__` off a shared object, then write onto that live
  reference" global-pollution chain does **not** fire — the mutation lands on a
  throwaway per-call copy, and `JSON.stringify` (own-enumerable-only) never serializes it.
  **No global `Object.prototype` pollution is reachable here.**
- What *is* reachable: naming yourself `"__proto__"` when creating a crew (typed into
  "Your name" on the create-crew form, which only client-validates against the same
  permissive `NAME_RE`) makes `deepMerge` hijack the fresh `doc.people` container's own
  prototype instead of adding a real entry. The stored/returned doc ends up with
  `people: {}` — **the crew creator silently isn't a member of their own crew**, while
  `crew.setMe()` still points `me` at the nonexistent `"__proto__"` identity, and
  `state.isActivePerson(state.people()["__proto__"])` in `js/app.js:95` reads
  `Object.prototype` (a real object, truthy, no `.removed`) and treats it as an active
  selected person. Real, reachable (self-triggered, no attacker needed), low-severity
  data-integrity bug — not a security hole, but a silent-data-loss footgun.
- Recommend, as defense-in-depth + correctness fix (cheap, no behavior change for real
  names): blocklist `__proto__`, `constructor`, `prototype` explicitly in
  `validName`/`SAFE_NAME_RE` (both copies) and add an explicit key skip in both
  `deepMerge` implementations. Zero test coverage for this today in
  `tests/crew-validate.test.mjs` — add a case alongside the fix.

## Verified sound (no finding, noted so it isn't re-litigated)

- **Atomic UPDATE race-freedom claim (api/crew.js:93-101) — checks out.** Pulled the live
  `jsonb_deep_merge` definition and the `crews` table DDL from Neon directly. Postgres's
  READ COMMITTED `EvalPlanQual` mechanism re-evaluates the *entire* target list and WHERE
  clause (not just the quals) against the freshly-committed row when a blocked UPDATE's
  target row was concurrently modified — so all three `jsonb_deep_merge(doc, delta)`
  evaluations in one statement always see the same, current `doc`. Same class of pattern
  as `UPDATE t SET x = x+1 WHERE ...` under concurrent writers. The CTE-based draft's data
  loss (mentioned in the commit message) is explained by exactly this: a CTE's `SELECT`
  reads a pre-lock snapshot instead of re-evaluating post-lock. No bug found.
- **SQL injection surface — closed.** `token`, `delta`, and both LIMITS constants are all
  passed through the Neon tagged-template `sql\`...${x}...\`` parameter-binding
  mechanism, never string-concatenated into query text.
- **256KB doc-size invariant via `pg_column_size()` (api/crew.js:97) — theoretical
  TOAST-compression bypass, empirically ruled out.** `pg_column_size()` reflects
  compressed storage size, not logical JSON length, and there's no cap on the *number* of
  distinct festival/artist/affinity keys (only on person count + per-name string length),
  so a highly-compressible payload could in theory smuggle more logical JSON past the
  256KB gate. Tested this directly against the live DB with a payload shaped like the
  real schema (thousands of long near-duplicate keys, small fixed-shape values):
  compressed size came out *larger* than logical text length (ratio 1.115) — JSONB's
  per-entry offset/length overhead and the schema's low-entropy small values leave pglz no
  room to help. Not an effective bypass for this data model; no action needed. (Soft cap
  on key counts would still be reasonable for legitimate-growth/perf reasons, not
  security.)
- **CSRF gate (`crossSite`, api/crew.js:36-40) — sound.** `Origin` (browser-set,
  unspoofable by script) vs `Host` comparison is a legitimate defense for the browser
  threat model; only non-browser clients bypass it, and that's the accepted/by-design
  token-is-the-gate model.
- **Legacy retirement (api/selections.js) — clean.** Flat 410, no data exposure.
  `scripts/migrate-legacy.mjs` writes exclusively through the same public,
  validated API (create + merge) — no direct-DB bypass of schema invariants — and
  re-verifies every migrated selection leaf byte-for-byte after the merge.
  `.env.legacy-snapshot` / `.env.local` (real Blob/Gemini tokens) are `.gitignore`'d
  (`.env*` pattern) — confirmed untracked, no secret leak in this commit.
- **Tombstone / level-0 "carries through merge" semantics — correct.** Both `deepMerge`
  copies short-circuit on `undefined`/`null` only, so `removed: false` and level `0`
  (falsy but not nullish) correctly overwrite prior tombstones/picks rather than being
  treated as "no value." Matches the state.js/app.js comments' claims.
- **Join-add "double activateCrew" (js/app.js:72-86, brief's flagged concern) — redundant
  but not harmful.** The pre-emptive `state.activateCrew(token, doc)` inside `showJoin`'s
  handler is actually necessary (not a bug): without it, `state.people()` would mutate a
  *different*, previously-active crew's doc if the user opens a new join link while
  another crew is loaded. `enterApp`'s subsequent `activateCrew` call re-merges the same
  already-persisted `pendingChanges` — idempotent, just one wasted round-trip.
  Tombstone-revive (`removed: false` explicit) is handled correctly on rejoin.

## Minor / style (not blocking)

- Array-handling divergence between the two `deepMerge` implementations: the server copy
  (`api/_lib/crew-shared.mjs:29`) treats an array `base` as "not a plain object" and
  discards it in favor of a fresh `{}`; the client copy (`js/merge.js:8`) preserves arrays
  via spread and merges element-wise. Currently dormant — nothing in the validated schema
  ever stores an array — but the two copies claim to be "the same shape" and would
  silently diverge the day an array leaf is added.
- `js/app.js:129` — `const cached = null;` in `onCrewSelect` is a dead/misleading
  variable name; the comment does the explaining, the variable doesn't need to exist.

## Bottom line

No cross-crew data corruption, no prototype-pollution escape to global scope, no SQL
injection, no atomicity bug in the merge UPDATE. One real MEDIUM (wrong-crew "gone"
race) worth fixing before this ships further. The reserved-key gap is worth a
defense-in-depth fix but isn't a live vulnerability as currently reachable.
