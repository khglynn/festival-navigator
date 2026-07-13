# Codex production finish gate — 2026-07-12

Review target: `git diff 7dedf07..3045b6e` on `v31-polish` (`3045b6e` was `HEAD` when the review began; the branch advanced concurrently afterward).

Status: **NO-GO for the reviewed snapshot.** Findings below were banked only after tracing a concrete failure through the pinned code.

## P0 — confirmed

### Mid-flight note edits are reduced to invalid fragments that permanently block all later sync

- **Code:** `js/merge.js:29-48`, called from `js/state.js:203-215`; note overwrite shape at `js/state.js:134-145` and `js/v3/notes.js:56-63`; server validation at `api/_lib/crew-shared.mjs:121-135`; refusal persistence at `js/sync.js:91-119`.
- **Failure sequence:** A complete note `{author, ts, text:"old"}` is pending and frozen into an in-flight push. Before the response returns, the author edits that same note ID; `recordNote()` replaces the pending note with `{author, ts, text:"new"}`. On ACK, `subtractLeaves()` recursively descends into the note object, removes unchanged `author` and `ts`, and leaves only `{text:"new"}`. The next push sends that fragment. `validateNote()` requires `author`, `ts`, and `text`, so the API returns 400. `refusedPayload` then remembers the invalid queue. Every later pick changes the signature and earns another request, but the invalid note fragment remains in every payload, so every request is rejected again; all subsequent picks and notes are trapped locally behind it. A local cache loss/reinstall turns that permanent sync wedge into actual data loss.
- **Fix:** Treat each note record as an atomic leaf for ACK subtraction: if the complete current note differs from the pushed note, retain the complete current note; if identical, drop it whole. Do not recursively subtract required fields from schema-atomic records. Add edit-during-flight and delete-during-flight tests that run the residual through `validateIncoming()` and a subsequent successful `pushSync()`.

## P1 — confirmed

### `clearPending()` preserves another tab's edit on disk but strands it outside the sync queue

- **Code:** `js/state.js:189`, `js/state.js:203-215`; success scheduling at `js/sync.js:131-135`; beacon guard/payload at `js/sync.js:160-171`.
- **Failure sequence:** Tab A records pick A and starts a push. Tab B records pick B, which `persistPending()` merges into the shared localStorage blob, then Tab B is closed/offline before its debounce or beacon succeeds. Tab A's request ACKs A. `clearPending(pushed)` correctly leaves B in `onDisk`, but subtracts A from Tab A's independent in-memory object to `{}` and never merges the disk residual back into memory. `state.hasPending()` therefore returns false, no next push is scheduled, `flushOnHide()` also returns false, and the UI can report online while B remains indefinitely unsynced on disk. A direct probe against the current modules produced `memory:{}`, `disk:{...Stranded:{B:4}}`, `hasPending:false`. Only a later crew reactivation/reload imports that residual; ordinary future edits keep merging it to disk while pushes continue serializing memory only.
- **Fix:** After subtracting the ACKed payload from both snapshots, reconcile the disk residual into the live pending queue with an explicitly defined same-leaf conflict policy, persist that reconciled queue, and let `hasPending()` schedule it. Add an end-to-end test in which the second tab disappears and the surviving tab actually POSTs the residual.

### Refused-payload state can suppress a different crew, and cannot recover when server state changes

- **Code:** `js/sync.js:24-26`, `js/sync.js:91-96`, `js/sync.js:115-119`, `js/sync.js:197-213`; crew activation at `js/state.js:51-55`.
- **Failure sequence (crew switch):** Crew A has pending delta `X`; POST returns 400/413, so `refusedPayload` becomes `JSON.stringify(X)`. The user switches to Crew B; `activateCrew()` swaps the token/doc/pending state but nothing resets or scopes `refusedPayload`. If Crew B's pending delta serializes identically to `X` (easy for the same person's same pick on the same festival), `pushSync()` returns at the refusal guard before making a request. A direct current-module probe recorded only Crew A's POST and left Crew B `blocked` with its delta pending. The race is worse when Crew A's rejection arrives after the switch: the 400/413 branch records the refusal and fires the blocked UI before the token-change guard, which exists only on the success path at `js/sync.js:124-126`.
- **Failure sequence (server recovery):** A delta is refused because the candidate crew doc is over the size cap. Another member removes enough notes (or otherwise resolves a transient merged-document invariant). Polling fetches the smaller remote doc and repeatedly schedules a push because pending remains, but every `pushSync()` exits at `isRefused(payload)`. The UI promises it will sync "as soon as the crew has room," yet unchanged pending bytes have no retry path; only an unrelated local edit or a full reload clears the module variable.
- **Fix:** Scope the refusal signature to the crew token and clear it on crew activation/switch. Also provide a bounded retry/revalidation path after a successful poll observes a changed remote document (or store the refused candidate condition/version and retry once when remote state changes), rather than treating all 400/413 responses as permanently deterministic.

### Universal `button::after` expands already-large buttons into neighboring actions

- **Code:** `assets/v3.css:294-303`; concrete stacked controls at `js/v3/settings.js:647-660` and `js/v3/settings.js:473-497`.
- **Failure sequence:** On a coarse pointer, every button receives a pseudo-element extending 15px above and below regardless of its existing height. The Settings `App` list stacks `How it works`, two toggle rows, `Bulk paste picks`, `Export picks`, and `Day image` with no gaps. The later `Bulk paste picks` button's hit box therefore reaches 15px upward into visible pixels belonging to the preceding `Stay offline` row; as the later painted sibling, it can win that hit and open Bulk Paste when the user tapped Stay Offline. The same geometry applies to the adjacent `Switch crew` / `Forget this crew` buttons, allowing a tap near the bottom of Switch Crew to arm the destructive Forget action instead. `overflow:hidden` on `.settings-list` clips only the outer container, not overlap between children.
- **Fix:** Enforce a 44px minimum on `button` without unconditional expansion of buttons already at/above the floor (for example, real `min-height: 44px` plus the documented card exception, with targeted width upgrades for narrow glyph controls). If preserving layout via pseudo-elements is mandatory, suppress expansion on full-row/full-size buttons and prove non-overlap for every stacked/adjacent control; the current unconditional 30px growth is not a floor.

### The claimed 44px button floor still leaves many controls far under 44px wide

- **Code:** baseline expansion at `assets/v3.css:297-303`; narrow Edit/Delete controls at `assets/v3.css:243-245` and `js/v3/notes.js:82-128`; 12-column color buttons at `js/v3/settings.js:591-603`.
- **Failure sequence:** The generic pseudo-element adds only 2px per horizontal side. A note's `Edit` button has zero padding and roughly text-width geometry, so its effective target remains roughly 20–30px wide; `Delete` and the Undo action have the same class of miss. The color picker puts 12 aspect-ratio buttons plus eleven 6px gaps into one phone-width Settings card, producing roughly 22px dots at 390px; the pseudo-element makes them only ~26px wide. These controls are explicitly cited as beneficiaries of the new floor, but they remain well below the project's 44×44 requirement and are still hard to hit with a thumb in the field.
- **Fix:** Make the floor two-dimensional. Give compact text actions a real/effective `min-inline-size: 44px`, and reflow dense controls such as the color board into fewer columns on phones so each target can actually reach 44×44 without overlapping its neighbor.

## P2 — confirmed

### Festival accent scoping is still violated by generic focus and personal-link selection

- **Code:** `assets/v3-tokens.css:99-102`; `js/v3/app.js:927-931`.
- **Failure sequence:** After an active festival sets `--fest`, keyboard focus on any button/input/link gets that festival's color even though focus is app chrome. On the join screen, a personal `&me=` link also paints the matched person's row border and "this link is yours" label with `--fest`. These are two semantic uses outside the documented four (fest name, active day tab, stage headers, current-fest Settings border), despite this diff adding `--brand` specifically to remove such leakage.
- **Fix:** Use `rgba(var(--brand), ...)` for the global focus ring and the personal-link row/label. Keep `--fest` only on the four enumerated surfaces.

## Weak-test callouts

- The new subtraction tests cover only primitive pick leaves. None covers a schema-atomic note object changing during flight, so they remain green while subtraction manufactures an API-invalid pending delta and wedges every future write.
- `tests/data-loss.test.mjs:97-123` asserts only that the other tab's edit remains in localStorage. It never asserts that the surviving tab adopts or pushes it. `tests/data-loss.test.mjs:125-140` says "in memory as well as on disk" but checks only memory and `hasPending()`. Both stay green while a disk-only edit is permanently omitted from the live sync queue.
- The refused-payload tests use only one active crew and only recovery via a new local edit. They remain green if refusal state leaks across crews and if a server-side size recovery can never unblock unchanged pending data.
- `tests/db-merge.test.mjs:177-194` does not exercise concurrent database sessions. Its six `Promise.all` calls share one PGlite instance/connection, which serializes them. I replaced the inline UPDATE in a probe with the specifically banned pre-lock CTE shape and ran the same six-way `Promise.all` for 50 rounds: it lost 0 writes, so the new test stays green through the exact concurrency regression it claims to catch. A real concurrency test needs independent connections/sessions to the same database (or an integration test against Postgres/Neon), synchronized so snapshots overlap before the row lock resolves.
- The DB helper at `tests/db-merge.test.mjs:38-41` passes the same JSON string for `$2` and `$3`. It therefore cannot detect swapped v4/legacy placeholders or a wrong CASE branch, even though production intentionally passes different `deltaV4` and `delta` values. Add a v3 stored-doc and v4 stored-doc test with deliberately different parameter values and assert each selects the correct one.
- There is no touch-floor regression test at all in the 131-test snapshot. Nothing renders a coarse-pointer layout or hit-tests adjacent real controls, so the suite stays green while expanded pseudo-elements route taps to the wrong Settings action.

## Verification

- Read every hunk in `git diff 7dedf07..3045b6e`, including surrounding call sites and the pre-refactor API statement.
- `npm test` on an archived `3045b6e` snapshot: **131 passed, 0 failed**.
- `git diff --check 7dedf07..3045b6e`: clean.
- Direct subtraction probe: an edited complete note became `{text:"new"}` and `validateIncoming()` rejected it with `bad author`.
- Direct two-crew sync probe: only Crew A POSTed; Crew B inherited `blocked` with its valid identical delta still pending.
- Direct multi-tab clear probe: after ACK, memory was `{}`, disk still held the other tab's pick, and `hasPending()` was false.
- CTE regression-strength probe: the known-bad pre-lock CTE passed the test suite's single-PGlite-instance six-way `Promise.all` shape in all 50 rounds, confirming that test does not reproduce database-session concurrency.

## Scrutinized and found sound

- Primitive ACK subtraction handles same-value re-sets correctly: if a user taps away and back to the exact ACKed final value, dropping that pending leaf is correct because the server now holds the intended value. Level-0 pick tombstones and identical `removed:true` tombstones also subtract cleanly; a change to `removed:false` survives. Empty branches are pruned correctly.
- Beacon re-sends are document-idempotent for every recorder-backed payload shape in this snapshot: pick levels/tombstones, complete keyed notes, people/color/removal leaves, affinity, Spotify client ID, crew name, and `meta.inviteFestId`. Pending is deliberately retained because the beacon response is unreadable.
- Production SQL placeholder order is correct for both MERGE and DIAGNOSE calls (`token`, v4 delta, original delta, limits), and the installed Neon 1.1 driver documents `sql.query()` returning row arrays by default, matching every consumer. All values remain parameters; the refactor adds no injection surface.
- The duplicate-name SQL excludes `removed:true` members as intended, matching `validateMergedDoc()`. Mechanically, the new WHERE clause would reject every future write to an already-existing crew that already contains an active case-only duplicate. The reviewed snapshot asserts in a code comment that live data was checked first, but contains no reproducible evidence; a read-only production query is what would resolve that deployment prerequisite conclusively.
- No existing button rule in the reviewed code uses its own `::after`, so the new universal pseudo-element does not overwrite another button-specific pseudo-element. The problems are target overlap and undersized width, described above.
