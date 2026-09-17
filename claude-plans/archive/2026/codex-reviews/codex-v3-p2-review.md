# Codex Review — v3 P2 Data Layer (commit cc49fa4)

Blocking adversarial review. Findings banked as found.

## P0-1 — Legacy (pre-v4) client writes silently reinterpret "Must See" as "picked x3" once doc is stamped v4

Files: `api/_lib/crew-shared.mjs` (`validateSelections`, `validateVersion`), `js/v3/model.js` (`readLevel`), `js/state.js` (current production writer, confirmed via `grep -n "level\|selections" js/state.js`).

`js/state.js:114 recordSelectionFor()` is the CURRENT PRODUCTION client (outside `js/v3/`, no `v` awareness at all) and posts raw `selections[artist][person] = level` with `level` 0-3, 3 = "Must See" (`opacities = [0.5, 0.75, 1.0]` for levels 1-3). `validateSelections` (crew-shared.mjs:91-105) accepts 0-4 unconditionally — it never checks the CURRENT stored `doc.v` before accepting a write. Once any v4 client stamps a crew doc to v4 (via `migrationOverlay`), every v4-aware reader (`readLevel`, model.js:16-19) treats a raw `3` as "picked x3", not "must" — `docVersion(doc)===4` short-circuits straight to `return raw`. Nothing distinguishes "an old client meaning must" from "a new client legitimately writing picked-level-3" once the doc is v4, because the number alone is now version-ambiguous and the server has no way to know which client sent it.

This is not hypothetical: `js/state.js`/`js/app.js` is the live, currently-deployed app. The moment v3-design replaces it, or for as long as any already-open tab/PWA-installed-to-homescreen keeps running the old JS (very plausible for a multi-day festival companion app used over spotty venue wifi), that client can write a raw `3` straight into an already-migrated doc and silently downgrade someone's "Must See" pick to a mid-tier one, with no error, no signal, nothing to detect it after the fact. The commit brief itself asks "acceptable or handled?" — verified: neither. No code path mitigates this.

Fix directions: this can't be resolved at the data-model layer alone (the number is inherently ambiguous once mixed versions coexist) — needs either a forced-reload/cache-bust strategy for old clients at deploy time, or the server refusing raw (non-`v4`-tagged) selection writes of value 3 once `doc.v===4` unless the writer explicitly re-sends `v:4` alongside (i.e., require the client to prove v4-awareness on every write touching ambiguous values, not just at migration time).

## P0-2 — recover.html: stale in-memory `crewDoc` used for both migration overlay and "never lower" comparison at merge time

File: `recover.html` (lines 138-192 load, 219-277 merge handler).

`crewDoc` is fetched once in `loadCrew()` (triggered by the "Load crew" button or an auto-click on page load) and never re-fetched before the "Merge into crew" click, which can happen an arbitrary amount of time later — further delayed in practice by the merge handler's own sequential `await buildAffinity()` (fetches `data/festivals/index.json` + every festival JSON file one by one, awaited *inside* the merge handler, after the overlay is already computed from the stale snapshot).

Two concrete failure modes from the same root cause:
1. **Downgrade**: the "never lower" check (`readLevel(crewDoc, ...)`) compares the rescue candidate against the STALE snapshot's value, not the live server value. If a real crew member bumps a pick higher via the live app in the gap between recover.html's load and its merge-click, recover.html's stale `cur` can still read lower than the rescued legacy value, so it includes that leaf in the merge overlay and — because scalar leaves are last-write-wins in `jsonb_deep_merge` — silently overwrites the crew member's live, more-recent, higher pick back down to the recovered legacy one.
2. **Migration clobber**: if another client has already run `migrationOverlay` (and made further v4-native edits) in that same gap, recover.html's local `crewDoc` still evaluates as v3 (`docVersion(crewDoc)===3`), so its own `migrationOverlay(crewDoc)` fires again and resends the FULL mapped-leaf set for every festival/artist/person from the STALE pre-migration snapshot — clobbering every intervening v4-native edit crew-wide, not just the leaves recover.html actually cares about rescuing. (See P1-4 below — this is the general migrationOverlay staleness hazard, but recover.html is the specific, high-probability trigger site because it's the exact tool everyone will be using tonight, during the exact window when migration races are most likely.)

Fix: re-fetch the crew doc immediately before computing the overlay in the merge handler (right before or right after `buildAffinity()`, not reusing the load-time snapshot), so the staleness window shrinks to one round-trip instead of "however long the user sat on the page."

## P1-3 — Note authorship/content is not protected at all; "author-only tombstone" claim in the code comment is false

File: `api/_lib/crew-shared.mjs` `validateNote` (lines 117-132), `validateNoteMap` (134-142).

`validateNote` only checks the SHAPE of an incoming note overlay (author is a syntactically valid name, ts parses, text ≤500 non-control-char chars, `deleted` only `true`). It never has access to — and never checks against — the EXISTING stored note at that `noteId`. Because `jsonb_deep_merge` merges objects field-by-field (not whole-note atomic replace), any crew member can send an overlay at an EXISTING noteId with a different `author`, different `text`, and no `deleted` flag at all, and it will silently overwrite that field on the stored note — full content takeover and reattribution under an author name of the attacker's choosing, not just tombstoning. E.g. `noteOverlay(fid, 'artist', target, {author:'Kevin', ts:newTs, text:'totally different message'}, existingMayaNoteId)` passes `validateNote` cleanly and replaces Maya's note text while relabeling it as Kevin's.

The code comment at crew-shared.mjs:108 ("A note may be tombstoned by its author via `deleted:true`") states a protection that does not exist anywhere in the validator — there is no author-match enforcement at all. `makeNoteId`'s ID format (`${safeAuthor}.${safeTs}.${nonce}`) embeds the author as a prefix, which hints at an intended invariant ("you may only touch notes whose id starts with your own sanitized name") that is never actually checked.

Context: the crew model has no per-person auth (single shared capability token = full crew read/write, per `api/crew.js`'s own header comment), so *some* degree of "anyone can act as anyone" is already true for selections. But selections-overwrite is a low-stakes, expected collaborative action; silently rewriting someone else's free-text note content while claiming a different author is a materially bigger trust violation, worth at minimum: (a) requiring the note's `author` field match the noteId's author-prefix segment (closes cross-person noteId collisions), and, if actually enforcing per-author edit/delete rights matters for tonight, (b) a SQL-side guard in `api/crew.js` (same pattern as the byte-size/people-count WHERE-clause invariants) that rejects the merge if a noteId already exists with a different `author` than the incoming write. At minimum, fix the misleading comment so it doesn't imply protection that isn't there.

## P1-4 — `migrationOverlay` is not clobber-safe under concurrent v4-native edits (general case, beyond recover.html)

Files: `js/v3/model.js` `migrationOverlay` (lines ~33-47), no test coverage for this interleaving.

`migrationOverlay(doc)` always re-sends EVERY existing selection leaf from the caller's local (possibly stale-by-the-time-it-POSTs) snapshot, mapped via `LEGACY_MAP`, bundled with `v:4`. This is fine for the single-client, no-concurrency case the tests cover (`tests/v3-model.test.mjs:43-58`). But consider two clients, Alice and Bob, both loading the same v3 doc snapshot S0 at ~t0. Alice's client migrates first (doc → v4, leaves = map(S0)). Before Bob's client gets a chance to notice the doc is now v4 (i.e. before Bob refreshes/refetches), a third client Carol — now v4-native, reading the post-Alice doc — bumps an existing leaf that was already present in S0 (e.g. increases her own pick from 1→2). Bob's client, still holding stale S0 in memory, fires its own `migrationOverlay(S0)`, which re-sends `LEGACY_MAP`-mapped values for every leaf that existed in S0 — including Carol's leaf, using S0's OLD value — and silently reverts Carol's just-made edit. The overlay isn't a true no-op/idempotent operation under concurrency the way notes are (notes only ever touch the one note's own key); migration touches the entire selections tree from a point-in-time snapshot with no way to express "only touch what actually still needs mapping."

Not tested: the "CONCURRENT NOTES SURVIVE" test (v3-model.test.mjs:64-82) proves notes are race-safe; there is no equivalent test proving migration overlays are race-safe against intervening v4-native edits, and in fact they are not. See P2-9 below on the false-confidence angle.

## P1-5 — `validateFestivals` never checks `fid` against `FORBIDDEN_KEYS`, unlike every other name/key validator in the file

File: `api/_lib/crew-shared.mjs` `validateFestivals` (lines 163-179) vs. `validName` (66-69) and `validArtistKey` (71-74), both of which explicitly do `&& !FORBIDDEN_KEYS.has(v)`.

`FESTIVAL_ID_RE = /^[a-z0-9-]{1,64}$/` has no underscore in its charset, so `__proto__` is blocked by charset alone — but `constructor` and `prototype` are both all-lowercase-letter strings that pass `FESTIVAL_ID_RE` cleanly and are never checked against `FORBIDDEN_KEYS` anywhere in `validateFestivals`. A payload like `{festivals: {constructor: {selections: {...}}}}` passes `validateIncoming` and gets persisted via `jsonb_deep_merge` (which has no prototype-pollution concept server-side, so the *storage* isn't corrupted in the classic sense) — but the resulting doc now has an own property `festivals.constructor` holding attacker data. Any client code that does `Object.entries(doc.festivals)` (own-enumerable, so it WILL show up) and treats every key as a real festival id — e.g. looking up `data/festivals/constructor.json` for metadata — breaks. Cheap, mechanical fix: add the same `!FORBIDDEN_KEYS.has(fid)` check used everywhere else in this file to `validateFestivals`.

## P1-6 — Note `text` has no HTML-metacharacter restriction; landmine for tonight's UI

File: `api/_lib/crew-shared.mjs` `validateNote` (lines 117-132) vs. `SAFE_NAME_RE` (line 29, used for `author`/person names via `validName`).

Person/author names go through `SAFE_NAME_RE` which explicitly blocks `<>"'`&\`` and control chars. Note `text` is validated with only `/[\x00-\x08\x0b-\x1f]/` (control-byte) filtering — angle brackets, quotes, ampersands are all allowed through. `recover.html` consistently uses an `esc()` helper before any `innerHTML` interpolation for the fields it does render, so this file itself has no live injection today (it doesn't render notes at all yet) — but since screens are being built on top of this tonight, any future notes UI that uses `innerHTML` instead of `textContent`/an equivalent escaper for `note.text` (or `note.author`, which IS safe-charset, so less of a risk) will have a stored-XSS hole scoped to the crew. Worth flagging loudly to whoever builds the notes screens tonight, since the validator gives no signal that this field is HTML-unsafe.

## P2-7 — Server never structurally enforces that `v:4` is bundled with its migration leaves

File: `api/_lib/crew-shared.mjs` `validateVersion` (238-243).

`validateVersion` accepts `v:4` on its own, with no requirement that a `festivals` migration payload accompany it. Today both call sites (`js/v3/model.js`'s own migration path and `recover.html`) always bundle `v:4` with the full mapped-leaf `festivals` overlay when there's anything to migrate (verified: `migrationOverlay` only omits `festivals` when there was nothing to map in the first place, which is safe). But this "always bundled" discipline lives entirely in client-code convention, not in anything the server enforces — a future bug/code path that ever separates the two into two POSTs, or races them, permanently and silently scrambles the meaning of every un-migrated level-3 leaf, with no way to detect or repair it after the fact (since `v` is one-way and level-3-on-a-v4-doc looks like valid data, not corrupted data). Not urgent to fix tonight given today's two call sites are correct, but worth a comment/test documenting this as a load-bearing invariant so nobody breaks it unknowingly.

## P2-8 — No idempotency key for note creation retries

File: `js/v3/model.js` `makeNoteId` / `noteOverlay`.

`makeNoteId` generates a random nonce by default when no explicit `id` is passed. A network retry after a timeout (client never learns whether the first POST landed) that doesn't reuse the same generated id will create a genuine duplicate note rather than a harmless no-op. Minor UX robustness gap, not a data-corruption risk.

## P2-9 — Test suite proves notes are race-safe; gives no equivalent proof (or coverage) for the migration/selections path, which is not race-safe

Files: `tests/v3-model.test.mjs`.

The suite's own framing ("Tests: 54/54 — the load-bearing one proves two concurrent note writers both survive... in both commit orders") is accurate for notes but could read as broader reassurance about concurrency safety generally. There is no test exercising: a legacy raw write landing on an already-migrated v4 doc (P0-1), a stale `migrationOverlay` clobbering an intervening v4-native edit (P1-4), or recover.html's stale-snapshot merge (P0-2). Worth adding at least one test encoding the P1-4 scenario so it's caught by CI once someone attempts a fix.

## P2-10 — Minor style nit

File: `api/_lib/crew-shared.mjs` `validateSpotifyStats` (230): `validName(v, 64)` for the `user` field uses a bare literal `64` instead of a named `LIMITS.*` constant, unlike every other bound in this file. Cosmetic only.

