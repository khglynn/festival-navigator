# Survey: sync, offline, service worker, server merge — 2026-08-30

Branch: `notes-desktop-round` (PR #13). Scope: js/sync.js, js/state.js,
service-worker.js, scripts/sw-stamp.mjs, api/crew.js, api/_lib/crew-sql.mjs,
api/_lib/crew-shared.mjs, db/schema.sql, tests/db-merge.test.mjs,
tests/app-shell-complete.test.mjs, tests/sw-*.test.mjs.

Ground-truth checks run: `npm test` → 275 tests, 274 pass / 1 skip, 0 fail
(matches NOW.md's claim). `node scripts/sw-stamp.mjs --check` → fresh
(19da3c20), so the stamp ritual is honestly current on this branch — not a
finding.

## Journeys walked (this dimension's slice of them)

- Pick offline → reconnect: recordSelection/applyLocalPick write local +
  pending synchronously; `online` event fires `sync.pushSync()` directly
  (js/v3/app.js:1844); `offline` event flips the dot immediately
  (js/v3/app.js:1847); 25s poll + visibilitychange + pagehide/beacon cover
  the rest. No gap found.
- A blocked (413/400) payload → the next edit: `sync.js`'s refusedPayload/
  refusedFor pair remembers the exact bytes refused, per-crew; a NEW local
  edit changes the payload signature and retries on its own; a remote
  change also clears the refusal (comment + code agree, and
  tests/sync-hardening.test.mjs exercises it). No gap found.
- Two phones editing the same artist's notes: note ids embed the author,
  so two people can never collide on one id (validateNoteMap's
  "id must begin with its author" rule) — verified against
  tests/db-merge.test.mjs's "a note from each of two people survives both
  writes" and the real SQL. No gap found.
- Deleting a note (tombstone, not removal): `deleteNote` writes
  `{author, ts, text:'', deleted:true}` over the SAME id — the map key
  never disappears, so a reply's `re` pointing at a tombstoned root still
  resolves; notes.js renders a stub row for the tombstoned root and keeps
  the reply visible one gutter in (tests/notes-round.test.mjs, "a deleted
  root leaves a stub…", and tests/notes-threads.test.mjs). Confirmed
  correct for THIS shape — see Finding 1 for the shape it does NOT handle.
- The `re` key's server validation: shape-only (string, NOTE_ID_RE,
  not self-referential) — deliberately does not require the target to
  exist yet (sync can deliver a reply before its root) and deliberately
  does NOT require the target to be a root. See Finding 1.
- Arrays-never rule: confirmed in three places that must agree and do —
  `db/schema.sql`'s `jsonb_deep_merge`, `api/_lib/crew-shared.mjs`'s JS
  twin, and `js/merge.js`'s client twin — proven by
  tests/db-merge.test.mjs "the JS merge twins agree with the SQL, arrays
  included" (this is the exact regression class that bit the playlist
  ledger in 2026-07-13; still closed).
- Stale SW after a deploy / the stamp ritual: `scripts/sw-stamp.mjs
  --check` is clean on this branch (stamp 19da3c20 matches APP_CORE), and
  `tests/app-shell-complete.test.mjs` walks the real static-import graph
  from `js/v3/app.js` and would fail if a module were added without being
  cached — card-facts.js (new this round) IS in APP_CORE. No gap found.
- Festival JSON network-first + 4s budget: `tests/sw-data-network-first.test.mjs`
  runs the REAL service-worker.js source in a vm sandbox and asserts a
  live answer wins, a dead network falls back to cache within the budget,
  a late answer still lands (held open by waitUntil), and the activate-time
  rescue never deletes a device's only offline copy of festival data on a
  failed rescue. No gap found — this is the most thoroughly tested file in
  the dimension.
- Migration path for old (v3) docs: server-only, atomic, idempotent
  (`api/crew.js` `?op=migrate`); client gates writes behind
  `ctx.migrationPending` (handleTap, bulk paste) and retries the op every
  25s while online plus once on the `online` event; `js/v3/model.js`'s
  `LEGACY_MAP` passes 4 through so a v4-semantics write landing in the
  migrate-race window isn't eaten. No gap found.
- Storage getters that throw: `js/util.js` guards every localStorage
  touch (`loadJSON`/`getLS`/`saveLS`/`removeLS`) in try/catch, and a write
  failure is reported via `onStorageWriteFail` → a toast (wired in
  js/v3/app.js:1747), not swallowed. No gap found.

## Findings

### Finding 1 (P1) — a reply-to-a-reply renders as "removed this note" for a note that was never deleted

**Files:** `js/v3/model.js` (`threadsFor`, lines 146–170, the stub branch at
158–167) and `api/_lib/crew-shared.mjs` (`validateNote`, lines 138–160,
specifically the `re` branch at 148–155).

**Evidence.** `crew-shared.mjs`'s own comment says the quiet part out loud:
> "One-level depth is a client rule (the composer always passes the root's
> id); the server guarantees only the shape."

The server's `re` check only verifies it's a well-formed note-id string and
not self-referential — it never checks that the note `re` points to is
itself a ROOT (i.e., has no `re` of its own). I verified this is exploitable
by construction, not theory:

```
$ node -e '... validateIncoming({ ... "Ben.3.n0009": {author:"Ben", ts:..., text:"same here", re:"Ava.2.n0005"} ...})'
{ ok: true }   // Ava.2.n0005 is ITSELF a reply (re: "Cleo.1.n0000"), not a root
```

The server accepts this "nested reply" doc cleanly. On the client,
`threadsFor` in `js/v3/model.js` only ever treats notes with no `re` as
roots (`roots = live.filter(n => !n.re)`, line 151). A reply whose `re`
points at another REPLY (not a root) falls into the exact same code path as
a reply whose root was **tombstoned or never arrived** (lines 160–166):

```js
if (rootIds.has(n.re)) { byRoot.get(n.re).replies.push(n); continue; }
if (!stubs.has(n.re)) {
  const gone = map[n.re];
  const t = { root: null, stubAuthor: (gone && gone.author) || null, replies: [] };
  ...
```

`gone` here is Ava's live, undeleted reply — `stubAuthor` becomes `"Ava"`,
and `notes.js`'s `stubRow()` renders `"${author} removed this note"`
(js/v3/notes.js:197). I ran `threadsFor` directly against a constructed doc
(root: Cleo → reply: Ava → nested reply: Ben) and got exactly this: Ava's
note renders normally under Cleo's thread, and Ben's note gets its own
orphan thread captioned **"Ava removed this note"** — while Ava's note is
sitting right there, undeleted, one thread up.

**Why this matters now, not just in theory.** Project memory
(`ray-perfetti-contributor.md`) records that this app already has a second
developer forking it and building against the same crew-doc shape. The
server was deliberately built to accept a shape the shipped client happens
not to write ("the server guarantees only the shape") — which means the
one-level-deep invariant has exactly one enforcement point (the composer's
`replyTo.re || replyTo.id` normalization in `js/v3/notes.js`), and any
second client — including a stale build served from a longer-lived SW
cache mid-rollout, or Ray's fork — can produce this shape without doing
anything wrong by ITS OWN validation contract.

**Not a data-loss bug** (nothing is tombstoned, nothing is lost — this is
purely a false statement rendered to users: "X removed this note" about a
note that is alive), which is why it's P1 and not P0. It also doesn't
reproduce with the shipped client's own UI today (Reply is only wired to
`t.root`, never to a reply row — see `js/v3/notes.js` line 246 vs. 254–264),
so nobody has hit it through normal use yet; that's exactly the "still
there, intentionally" kind of gap this project's own history (Codex gate
notes throughout `crew-shared.mjs` and `state.js`) treats as worth closing
before it's someone's actual bug report.

**Fix, either layer works (pick one, not both — don't duplicate the rule):**
- Server: in `validateNoteMap` (api/_lib/crew-shared.mjs), when a note has
  `re`, require the target (if present in the same map) to itself have no
  `re` — reject a reply whose `re` points at another reply. This makes the
  one-level-deep invariant real instead of a comment.
- Client: in `threadsFor` (js/v3/model.js), when `n.re` resolves to a LIVE
  note that itself has `re`, walk up to that note's `re` (its root) instead
  of treating it as a missing/deleted root. This makes the renderer
  correct even if a shape like this ever lands.

I'd default to the server fix — it matches this codebase's stated
philosophy ("reject implausible values at write time so garbage never
reaches the stored doc") and closes the gap for every future client, not
just this one's renderer.

## Open questions / handoff

- Kevin's complaint "click reply to comment under an existing reply is so
  strange" doesn't match what `js/v3/notes.js` currently does — Reply is
  wired ONLY on thread roots (line 246), never on a reply row (the loop at
  254–264 passes no `onReply`), so there is no way to literally reply to a
  reply in the shipped UI today. Two readings: (a) he's describing the
  *visual* disconnect of hitting Reply on a root that already has replies
  underneath it — the composer lives at the bottom of the whole list, not
  attached to the thread you clicked from — which is a notes.js/UI-layer
  question, not a sync/data one, or (b) he saw an earlier build during the
  Codex-gate rounds where Reply DID appear per-row. Either way this is
  notes.js rendering/interaction, outside this dimension's file list —
  flagging so whichever pass owns card-facts.js/notes.js UI picks it up.
- Kevin's "multiple taps no longer increases pick intensity" and "the
  whole row animates/resizes" complaints: I traced the plain tap path
  (`handleTap` → `state.recordSelection` → `applyLocalPick` →
  `refreshCtx()` re-derives `ctx.picks` from `state.crewDoc` synchronously
  before the next tap) and it's correct — no state/sync bug there. The
  likely culprit is the ZOOM's own tap/click handling in
  `js/v3/card-facts.js` (not in this dimension's file list), which I did
  not audit. Flagging for the cards/zoom dimension.
- Lost Lands description content, Seismic/ACL data completeness: these are
  `data/festivals/*.json` content questions, not sync/merge/SW code — out
  of this dimension, presumably covered by a data-content pass.

## Skeptic

### sync-1 — nested-reply stub misrenders a live note as "removed"

**Verdict: PLAUSIBLE (real bug, severity overstated — P2, not P1).**

Checked every piece of the evidence chain directly and it holds exactly as
described:

- `api/_lib/crew-shared.mjs:138-159` (`validateNote`) and `:174-185`
  (`validateNoteMap`) — confirmed the server checks only that `re` is a
  well-formed, non-self-referential id (`NOTE_ID_RE` shape + `note.re ===
  noteId` guard). Nothing checks whether the target note itself carries `re`.
  The comment at line 148-153 says so outright: "One-level depth is a client
  rule... the server guarantees only the shape." No hidden guard elsewhere —
  grepped the whole repo for "depth"/"one-level"/"nested repl" and the only
  hits are this comment and unrelated `depth` counters in router.js/festival-add.js.
- `js/v3/model.js:146-170` (`threadsFor`) — confirmed `roots` is built from
  `!n.re` notes only (line 151), so a note whose `re` points at a live REPLY
  (not a live root) falls into the same `stubs` branch as a genuinely-gone
  root (lines 160-166), and `gone = map[n.re]` there is looked up with no
  `deleted` check — it will happily return a live note and use its `.author`
  as `stubAuthor`.
- `js/v3/notes.js:186-201` (`stubRow`) — confirmed it renders `"${author}
  removed this note"` whenever `stubAuthor` is truthy, with no way to say
  "this note is actually still here, just nested." Reader's repro (a
  constructed doc with Ben's note replying to Ava's reply, which itself
  replies to Cleo's root) is exactly the shape that trips this.

Where I land differently is severity. Two structural facts push this down
from P1:

1. **The shipped client cannot produce this shape at all, and it's not a
   thin guard — it's doubled.** `renderThreads` (`js/v3/notes.js:206-268`)
   only wires `onReply` onto root rows (line 246: `onReply(t.root)`); the
   reply-row loop at 254-264 passes no `onReply` at all, so there is no
   button in the shipped UI that lets anyone reply to a reply. And even if
   that wiring existed, `addNote`'s caller (line 466)
   flattens with `replyTo.re || replyTo.id` — so a reply-to-a-reply, if
   somehow initiated, would still write with the ROOT's id, not the
   intermediate reply's. Reaching this bug requires a second client or a
   hand-crafted payload, not just a state a normal user can wander into.
2. **The failure mode is a false label, not lost or corrupted data.** No
   note is tombstoned, no doc is malformed, no other person's data is
   touched — it's exactly one stub row's text being wrong in a case that
   (per point 1) nobody hits through the app itself today.

That combination — real, confirmed, present in code the reader read
correctly, but requiring an external/non-standard writer to trigger, and
costing only a misleading string when it does — is a clean P2, not P1
(reserve P1 for gaps a normal user can hit through the shipped app, or ones
whose consequence is data loss/exposure; this is neither). The reader's own
write-up already flags the non-reachability ("it also doesn't reproduce
with the shipped client's own UI today") and argues P1-not-P0 on the
data-loss axis, but that argument only rules out P0 — it doesn't establish
P1 over P2. Given the project's own `ray-perfetti-contributor.md` memory
(a second real client exists), I'd call this worth fixing before it's a
real bug report, but at P2 urgency, and I agree with the reader's
server-side fix (extend `validateNoteMap` to reject `re` pointing at
another `re`-bearing note) as the right layer — it turns a comment into an
enforced invariant for every future client, not just this one's renderer.

### What the reader didn't miss (verified, not re-reported)

Walked the same file set independently and didn't find anything the
reader's map missed:

- `js/sync.js` (all of it) — debounce, refusedPayload/refusedFor signature
  matching, `pushGen` race guard, `flushOnHide`'s sendBeacon path, and the
  migrate op all match the reader's description and the inline comments'
  claimed histories. No new gap found.
- `js/state.js` — `pendingChanges` overlay, `persistPending`'s disk-merge
  (not blind overwrite), `clearPending`'s leaf subtraction with the
  NOTE_IS_ATOMIC/PLAYLIST_IS_ATOMIC atomic-subtree guards, and
  `applyRemoteDoc`'s "visible slice" repaint-diffing all check out.
- `js/merge.js` — `deepMerge`/`subtractLeaves` match the SQL twin's
  array-replaces-wholesale and FORBIDDEN_KEYS behavior the reader cited.
- `api/crew.js` + `api/_lib/crew-sql.mjs` — the inline (non-CTE) atomic
  UPDATE, the v3→v4 migrate statement, and the DIAGNOSE_SQL "why was this
  refused" path all read as described; `MERGE_SQL` is exactly what
  `tests/db-merge.test.mjs` would need to exercise the real bytes.
- `service-worker.js` — network-first data fetch with the 4s race,
  activate-time rescue-before-delete of pre-v37 festival data, and the
  APP_CORE cache-first shell all match; the `fetchAndStore`/
  `dataNetworkFirst` waitUntil sequencing is correct (a late network
  success still lands in the persistent cache even after the 4s timeout
  wins the race).
- `js/util.js` — `loadJSON`/`getLS`/`saveLS`/`removeLS` guard every
  storage touch including the getter itself, matching the CLAUDE.md note
  about storage-getter throws; `onStorageWriteFail` wiring is a plain
  callback with its own try/catch so a failing reporter can't eat the
  write-fail signal.
- `makeNoteId` (`js/v3/model.js:92-98`) — confirmed collision-proofing:
  author-prefixed id plus a 6-char base36 random nonce, not just a
  timestamp, so two rapid notes from the same author in the same
  millisecond still can't collide. Reader's "structurally impossible"
  claim holds.

No additional findings to add — the one real gap in this file set is the
sync-1 nested-reply stub, and I've re-scored it above rather than
duplicating it.
