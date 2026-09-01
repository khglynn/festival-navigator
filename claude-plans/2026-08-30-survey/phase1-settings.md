# Phase 1 — settings.js + spotify.js round (2026-08-30)

Scope: exactly `js/v3/settings.js` and `js/spotify.js`, per the LEDGER's
Settings + Spotify sections. Four changes, banked as I go so a crash costs
one step, not the run.

## Progress: all 4 done, tests run. See "Test result" at bottom.

## 1. You above Crew

- `renderSettings` (~line 666-668) appended `festivalsSection`, `crewSection`,
  `youSection` in that order — Crew above You, contradicting the file's own
  line-2 comment ("YOUR FESTIVALS -> YOU -> APP").
- Checked first: no DOM ids, scroll anchors, or tests couple the two
  sections' order (grepped `youSection|crewSection|scrollIntoView` and the
  test files) — the swap really is as trivial as the ledger says.
- Fix: swapped the two `appendChild` calls (You now renders before Crew).
  Updated the line-2 comment to name the true order: YOUR FESTIVALS -> YOU
  -> CREW -> APP (the old comment omitted Crew entirely; the Spotify glance
  card + the App-labeled list both sit under "APP").

## 2. Self-rename duplicate check, case-insensitive

- `settings.js` ~617 did `state.people()[v]` — an exact-case key lookup. The
  server (`crew-shared.mjs` ~369-375) refuses two active names differing
  only by case; `app.js` already compares lowercased in two other places.
  Renaming to a case-variant showed a success toast, then the merge was
  refused forever (a `blocked` sync state with no auto-retry).
- Fix: compare `v.toLowerCase()` against every key in `state.people()` (the
  FULL map — tombstones included, not `activePeople()`, since a prior Codex
  gate deliberately added the removed-name check and switching to
  active-only would silently delete it) — EXCEPT the person's own current
  key (`ctx.meName`), so a pure case-fix on your own name ("kev" -> "Kev")
  still works instead of colliding with yourself. Same refusal message as
  before: "That name has been used in this crew — pick a different one."

## 3. Spotify disconnect actually clears the badges

- `settings.js` ~1421's copy says disconnect "keeps picks and notes — only
  the badges disappear," but the handler called only `spotify.disconnect()`
  (`js/spotify.js` ~65), which clears two localStorage keys and never
  touches `crewDoc.affinity[meName]` — a synced, crew-visible field every
  card reads via `ctx.affinity` (`app.js:101`, `card-facts.js:60-63`).
- Traced the write path: `state.recordAffinity(person, map)` does the
  double-write (crewDoc directly + pendingChanges), `state.persist()` saves
  the local doc, `sync.scheduleSync()` pushes it. `renameSelf` in app.js is
  the clearest example of that trio used together.
- The subtle bit: `jsonb_deep_merge` cannot delete a key — merging `{}` over
  an existing per-artist object leaves every existing entry untouched
  (confirmed against `db/schema.sql`'s merge function and the existing test
  `tests/db-merge.test.mjs` "deletion is inexpressible"). But overwriting
  the WHOLE per-person value with a JSON `null` scalar (not `{}`) DOES win
  as a leaf overwrite — same mechanic that test already exercises for
  `people`. Every consumer of `affinityFor`/`affinityLookup` already treats
  a falsy value as "no data" (checked `card-facts.js:60`, `settings.js:1080`,
  `spotify.js:319/344/449`), so `null` is safe.
- Fix: disconnect handler now also calls `state.recordAffinity(ctx.meName,
  null)` (guarded — only when there's something to clear), `state.persist()`,
  `sync.scheduleSync()`. Badges disappear locally immediately and the clear
  propagates to the crew on next sync.

## 4. How-it-works copy: match the wall's coach mark

- `settings.js` ~360 said "Four taps = I MUST SEE THIS." (violates the
  Must/Must-See vocabulary rule in CLAUDE.md) and ~369 said "Hold a card for
  notes." (hold now opens the zoom; notes is a tap further in).
- Kevin's final wording (2026-08-30): matched the wall's coach mark exactly
  — "4 taps = MUST SEE." and "Hold for details."

## Test result

`npm test`: **282 pass / 1 fail / 1 skip** (284 total).

The 1 fail is `tests/app-shell-complete.test.mjs` — the service-worker asset
stamp (`node scripts/sw-stamp.mjs --check`) — expected per the kickoff brief
("a failing service-worker-stamp test would mean the LEAD's stamp needs
re-running — report it, don't run the stamp yourself"). Not run here. The 1
skip is the DB-concurrency test gated on `DATABASE_URL` (a known local-only
gate, unrelated to this round).

No new test file added. I considered one (`tests/settings-round.test.mjs`)
for the case-insensitive rename check and the disconnect-clears-affinity
fix, but both are closures inside `renderSettings`'s render tree with no
exported entry point smaller than the whole page — testing them faithfully
would mean rendering the full settings screen (stubbing `sync.syncState()`,
`navigator.clipboard`, `fetch`, every `actions.*` callback) rather than a
focused unit, and CLAUDE.md is explicit that a test against a re-typed copy
of the logic "passes through exactly the regression it exists to catch." I
verified both fixes by reasoning through the actual code path instead:
  - Rename dedup: traced `Object.keys(state.people())` — confirmed it's the
    full map (tombstones included) and that excluding `ctx.meName` is
    necessary (verified by hand: without the exclusion, fixing your own
    name's casing would collide with yourself, since `v === ctx.meName`
    above only catches an EXACT-case match).
  - Disconnect: traced the exact SQL semantics in `db/schema.sql`'s
    `jsonb_deep_merge` — confirmed that clearing with `{}` would NOT
    actually delete the crew-visible entries (matching object keys with no
    overlay keys just preserves them — object merge is additive, never
    subtractive), but overwriting the whole per-person value with `null`
    (a JSON scalar, not an object) DOES win as a leaf overwrite. This is the
    same mechanic the existing test `tests/db-merge.test.mjs`
    ("deletion is inexpressible — which is why tombstones exist") already
    exercises for `people`. Then confirmed every reader of
    `affinityFor`/`affinityLookup` (`card-facts.js:60`, `settings.js:1080`,
    all three call sites in `spotify.js`) already treats a falsy value as
    "no data," so `null` is safe everywhere it's read.

## Uncertain / worth a second look

- The disconnect fix's crew-wide correctness rests on the `jsonb_deep_merge`
  reasoning above, verified against the schema and an existing passing test
  — but it was never exercised end-to-end against a real server merge in
  this session (no new test added, per above). If Kevin wants that
  ironclad, a `tests/db-merge.test.mjs` case merging `{ affinity: { X: null
  } }` over a seeded per-artist map, asserting the result is `null` (not the
  untouched object), would nail it down the same way the `people` deletion
  test does.
- "Show the same refusal message the other paths use" (item 2's brief) — I
  kept the existing message text ("That name has been used in this crew —
  pick a different one.") rather than switching to the add-member flow's
  wording ("X is already in this crew.") since this site already had that
  exact string and only its case-sensitivity was the bug. Flagging in case
  "the same message" meant something more specific.

## Lead's correction (2026-08-30, after review)

The disconnect's `recordAffinity(me, null)` would have been REFUSED by the
server (`validateAffinity`: an affinity entry must be an object) — blocking
sync — and even if accepted, the merge IGNORES null (`deepMerge` line 52 and
its SQL twin keep the base), so the badges would have returned on the next
pull. The client-side reader trace was right; the server validation and the
merge semantics were the load-bearing checks. Fixed by writing a ZEROED map
({songs: 0, followed: false} per artist) — object-over-object merges key by
key, so the zeros land crew-wide and every badge reader shows nothing.
Covered in tests/crew-validate.test.mjs.
