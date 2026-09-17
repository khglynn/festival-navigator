# Survey — Threaded notes UI (2026-08-30)

Branch: `notes-desktop-round` (PR #13). Files walked whole: `js/v3/notes.js`
(614 lines), `js/v3/model.js` (273 lines, notes/threads section closely),
`docs/user-flows.md` (F6/F7/F8), `tests/notes-threads.test.mjs`,
`tests/notes-round.test.mjs`, `api/_lib/crew-shared.mjs` (note + `re`
validation), relevant `assets/v3.css` rules (composer, `.n-*`, `.day-whisper`,
44px-floor block). `npm test` run read-only: 274 pass / 1 skip, 0 fail —
matches NOW.md's claim.

Journeys walked (against docs/user-flows.md F6/F7/F8): open an artist's
notes from the card; read a thread (root + replies, pinned fold/unfold);
reply to a root; look for a reply-to-a-reply path; edit your own note
in place, including mid-edit while a simulated remote repaint fires; delete
a root that has replies (the stub) and a reply (no stub, just gone); pin/
unpin; the empty state before any note exists; the day whisper and the fest
whisper; the all-notes home's per-scope sections and its own composer;
server-side `re`/note validation (`api/_lib/crew-shared.mjs`); a note
authored by someone no longer active in the crew (color falls back to a
name hash in `wall.js:colorIndexOf`, no crash, no broken avatar).

## The layout today, precisely (for the redesign)

One note row (`.n-note`, `noteRow()` in notes.js) is a 2-column CSS grid:
20px avatar (16px for a reply) + body. The body's head line
(`.n-head`, flex-wrap) is built by four **independent, unconditional**
`if` blocks in `noteRow()` (lines 139–179), each appending its own
`· ` separator and a `.note-action` (an underlined 10–10.5px text button,
no icon):

1. `Edit` — only if `note.author === ctx.meName` AND `opts.onEdit` exists.
2. `Delete` — only if `note.author === ctx.meName` AND `opts.onDelete`
   exists (own-note delete has a two-tap arm: "Delete" → "Sure?" → fires).
3. `Reply` — only if `opts.onReply` exists. **Root notes only** — see
   finding NT-4; a reply row is built with no `onReply` key at all
   (`renderThreads`, lines 254–266), so no reply ever carries this button.
4. A collapsed-pinned root's `N replies` counter-as-button (mutually
   exclusive with the live reply list for that render).
5. `Pin`/`Unpin` — on **every** root, own or not, whenever `opts.onPinToggle`
   exists (unconditional — not gated on authorship at all).

So the worst case — your own root note, which has replies, unpinned — shows
**who · time · Edit · Delete · Reply · Pin**: six inline tokens, four
` · ` separators, in a `flex-wrap` row at 10–12.5px type. That is the row
Kevin is calling "too many options." A reply of your own shows four tokens
(who · time · Edit · Delete, no Reply/Pin). Someone else's root shows four
(who · time · Reply · Pin). Someone else's reply shows two (who · time,
no actions at all).

The composer (`composer()`, lines 274–325) is one `<input maxlength="500">`
plus a Save button, with a reply-mode toggle (`setReply`) that shows a small
`Replying to <author>` label and a ✕ cancel — but that label always names
whoever `onReply` was called with, which (per the point above) is always a
**thread's root author**, never the specific reply the person was just
reading.

## Findings

### NT-1 (P1) — Editing a note has no way out except abandoning the whole sheet
- **File:** `js/v3/notes.js:110-149` (edit-mode wiring)
- **Evidence:** `mountEditor()` wires only `save.addEventListener('click', doSave)`
  and `Enter` on the input. `doSave` is `if (!v) return;` on empty text —
  it never calls `editing.delete(note.id)` except on a successful non-empty
  save. There is no Cancel button anywhere in the editor. The sheet's global
  Escape handler (`app.js:1851`, `if (e.key === 'Escape' && !router.requestClose()) closeSheet();`)
  closes the **entire notes sheet**, not just the inline editor — confirmed
  by tracing `router.requestClose()` (router.js:88) which pops the whole
  sheet layer via history.
- **Journey:** F6, "edit your own note."
- **Fix:** add a small Cancel action beside Save in `mountEditor()` that does
  `editing.delete(note.id)` and repaints locally (`onChange({ localOnly: true })`),
  the same pattern `onPinToggle`/`onToggleReplies` already use for local-only
  UI state.

### NT-2 (P1) — Replying to a pinned/collapsed thread gives no visible confirmation it landed
- **File:** `js/v3/notes.js:239-250` (fold logic) × `js/v3/notes.js:465-469`
  and `534-538` (composer save paths)
- **Evidence:** `const collapsed = pinned && t.replies.length && !expandedPinned.has(t.root.id);`
  — `expandedPinned` is a per-sheet-open `Set` that only the `N replies`
  counter's own click handler (`onToggleReplies`) ever adds to. The
  composer's `onSave` → `addNote(...); paint(); onChange();` path never
  touches it. So replying to a folded pinned thread adds the note, but the
  thread **stays folded**; the only observable change is the counter text
  ticking from e.g. "3 replies" to "4 replies," which the person who just
  typed and hit Save has no reason to be looking at.
- **Journey:** F6, "pin/unpin, folded pinned root," combined with reply.
- **Fix:** when the reply target's root is currently folded, auto-add its id
  to `expandedPinned` before the repaint (or otherwise surface the new reply)
  so the person sees their own words land.

### NT-3 (P1) — Reply is unavailable on day/artist threads from the All Notes home; no comment explains why
- **File:** `js/v3/notes.js:548-564` (`openAllNotes`'s `section()` helper)
- **Evidence:** `onReply: box && scope === 'fest' ? (root) => box.setReply(root) : null`
  — day and artist sections (`section(day, 'day', day)`, `section(artist, 'artist', artist)`)
  get `onReply: null` unconditionally. `onEdit`/`onDelete`, by contrast, are
  wired identically for every scope (they live inside `renderThreads`'s own
  closures, not gated by scope at all). Every other scope-conditional choice
  in this file carries an explanit comment (see the pinned-root comment at
  line 204, the whisper comment at 587); this one has none, which reads as
  an oversight rather than a decision.
- **Journey:** F8, "the all-notes view is the notes HOME" — reading a day's
  or an artist's thread there and trying to add to it.
- **Fix:** generalize the composer's reply wiring (it currently hardcodes
  `addNote(ctx, 'fest', null, text, ...)` at line 535) so day/artist sections
  can reply too, or — if the fest-only limit is deliberate — say so in a
  comment and give the day/artist sections a "open this artist's notes to
  reply" affordance instead of a silently missing button.

### NT-4 (P1) — Matches Kevin's "reply under an existing reply is so strange": there is no reply-near-a-reply path at all, and the composer's label doesn't track what you were reading
- **File:** `js/v3/notes.js:254-266` (replies rendered with no `onReply` key)
  and `295-305` (`setReply`, `replyLabel.textContent = 'Replying to ${note.author}'`)
- **Evidence:** the reply-list render loop passes `{ reply: true, editing,
  onEdit, onDelete }` — no `onReply` — so **no reply row, ever, carries a
  Reply button** (own or someone else's). The only Reply affordance in a
  thread is the root's, which sits **above** the entire reply list. On a
  thread with several replies, continuing the conversation means scrolling
  back up past everything you just read to find the one Reply link, and the
  composer that opens always says "Replying to `<root's author>`" — even
  when your eye and your reply are really responding to the *last* reply,
  possibly written by someone else entirely. That mismatch between where
  your attention is and who the composer says you're replying to is very
  likely the "so strange" feeling.
- Note: the underlying data model is already built for a reply-to-reply
  affordance to attach correctly to the root — `addNote(ctx, scope, target,
  text, replyTo ? (replyTo.re || replyTo.id) : null)` (line 466/535) already
  resolves through `.re` — so a UI fix here is data-safe.
- **Journey:** F6, threads with 2+ replies.
- **Fix direction (Kevin's own line, "maybe replies not be a button?"):**
  one reply doorway per thread, positioned **after** the last reply (where
  the eye actually is when someone decides to add to the conversation), with
  copy that names the thread/subject rather than implying a 1:1 reply to a
  specific person (e.g. "Add to this thread" rather than "Reply").

### NT-5 (P1) — The crowded top row Kevin flagged, quantified
- **File:** `js/v3/notes.js:139-179`; `assets/v3.css:559-563` (`.n-head`,
  `.note-action`)
- **Evidence:** see "The layout today, precisely" above — own root w/
  replies renders 6 inline tokens (who · time · Edit · Delete · Reply ·
  Pin). Four independent `if` blocks each own their own `· ` separator, so
  nothing currently limits how many stack.
- **Journey:** every thread with an own root note.
- **Fix direction (Kevin's own line, "nest delete option... in the UI of
  edit"):** move Delete inside the inline editor (opened via Edit) instead
  of the steady-state row — drops the worst case to who · time · Edit ·
  Reply · Pin (5) — and give Pin an icon instead of an underlined word,
  since it's the one action present on literally every root regardless of
  authorship and currently reads identically to Edit/Delete/Reply.

### NT-6 (P2) — The deleted-root stub breaks the file's own "you" convention
- **File:** `js/v3/notes.js:188-201` (`stubRow`) vs. line 93
  (`who.textContent = note.author === ctx.meName ? 'you' : note.author;`)
- **Evidence:** `stubRow(author)` renders `${author} removed this note`
  with the raw author string always — it never checks `ctx.meName`.
  Deleting your OWN root (a normal, common action per F6) produces a stub
  reading e.g. "Kevin removed this note" instead of "you removed this
  note," the one place in this file that breaks the pattern every other
  author label follows. NOW.md flags the stub's copy as one of two things
  "not picked by Kevin (defaults shown on the canvas, easy to swap)" — this
  is the natural moment to fix it.
- **Fix:** thread `ctx.meName` into `stubRow` (or format at the call site
  in `renderThreads`) and substitute "you."

### NT-7 (P2) — Single-line `<input maxlength="500">` for up to-500-char notes, no wrap, no counter
- **File:** `js/v3/notes.js:282-284` (composer input), `114-117` (edit
  input); `assets/v3.css:230-235` (`.composer input`)
- **Evidence:** both the add-composer and the inline editor use `<input>`,
  not a textarea. On the mobile sheet (full-width minus 32px padding, minus
  the Save/Cancel buttons) the visible input is well under 300px wide with
  no wrapping — typing near the 500-char cap means scrolling text
  horizontally inside a tiny box with no character counter and no feedback
  when the browser's `maxlength` silently stops accepting more input. This
  is exactly the kind of thing a phone user in the field (one bar, glancing
  down) trips on when trying to leave a real coordination note ("gate opens
  at X, meet by Y stage, bring cash for Z").
- **Fix:** a textarea (even a short auto-growing one), or at minimum a
  small counter that appears as the note nears the cap.

### NT-8 (P2) — Reply-target can be silently swapped mid-compose
- **File:** `js/v3/notes.js:295-305` (`setReply`)
- **Evidence:** clicking a different root's Reply while text is already
  typed calls `setReply(newRoot)`, which only updates the small `.reply-to`
  label — the typed text is kept, but now aimed at a different note, with
  no confirmation. Combined with NT-5's crowded, closely-spaced action row,
  a mis-tap on a neighboring root's Reply link would silently retarget an
  already-composed reply.
- **Fix:** confirm before overwriting a non-empty draft's target, or lock
  retargeting until Cancel is pressed.

### NT-9 (P3) — Stale/incomplete comment on `dayWhisper`
- **File:** `js/v3/notes.js:587-590`
- **Evidence:** the block comment says "the day whisper... replaces the
  inline bars," but the same function renders the **fest** whisper too
  (`wall.js:955`, `dayWhisper('fest', null, ctx, ...)` — what NOW.md calls
  "the fest whisper foot"). Function name and comment both undersell the
  actual scope.
- **Fix:** broaden the comment (or rename to something scope-neutral like
  `noteWhisper`).

## What's solid (no finding, worth recording so it isn't re-litigated)

- Thread grouping (`model.threadsFor`), the tombstone-stub-for-a-deleted-root
  behavior, and reply-counts-as-notes are all correctly implemented and
  covered by `tests/notes-threads.test.mjs` / `tests/notes-round.test.mjs` —
  matches F6/F7/F8 exactly, including replies-before-their-root over sync.
- Own-note delete requires a two-tap arm (mis-tap protection) and is
  enforced BOTH client-side (`note.author === ctx.meName` gate on rendering
  the Delete button) and server-side (`crew-shared.mjs` id-prefix-must-match-
  author rule) — real defense in depth, no path to delete someone else's note.
- Mid-typed drafts (both the add-composer and inline edits) correctly
  survive a live remote-sync repaint — the composer element lives outside
  `paint()`, and the `editing` Map is explicitly reconciled against live
  notes so a note tombstoned mid-edit doesn't strand its editor.
- `colorIndexOf` falls back to a deterministic name-hash when a note's
  author has no `people[name]` entry (e.g. someone removed from the crew) —
  no crash, no broken avatar, just a stable fallback color.
- Server-side `re` validation is exactly as generous as it needs to be
  (existence not required, since sync can deliver a reply before its root)
  while still rejecting self-replies and malformed ids — `NOTE_ID_RE`,
  `crew-shared.mjs:148-159`.
- The all-notes empty state correctly differentiates hover-capable pointers
  ("hover any artist and tap its note chip") from touch ("hold any artist")
  — a nice touch matching F6's hover/hold split.

## Skeptic

Re-opened every cited line in `js/v3/notes.js`, `js/v3/wall.js`,
`app.js` (Escape handler), `js/v3/model.js` (`threadsFor`/`togglePin`),
`api/_lib/crew-shared.mjs` (note/`re` validation), `assets/v3.css`
(touch-floor block + `.composer`/`.n-*`/`.day-whisper` rules), and
`NOW.md`/`design-system.md` for the two "Kevin's own words" quotes. All
nine findings are real code, not invention. Verdicts below; three are
downgraded from the P1 the reader gave them, for reasons stated inline.

**NT-1 — CONFIRMED, P1.** `mountEditor()` (110-138) wires only Save
(click + Enter); `doSave` returns silently on empty text without ever
calling `editing.delete`. No Cancel exists anywhere in the editor. Traced
the Escape path myself: `app.js:1851` — `if (e.key === 'Escape' &&
!router.requestClose()) closeSheet();` — is the sheet-level handler, and
nothing in `mountEditor`/`noteRow` intercepts Escape first, so it closes
the whole modal. P1 is right: this is a real dead end with no graceful
exit short of abandoning the sheet.

**NT-2 — PLAUSIBLE, downgrade to P2.** Confirmed mechanically: `collapsed
= pinned && t.replies.length && !expandedPinned.has(t.root.id)` (239), and
neither composer save path (466-469, 535-538) ever touches
`expandedPinned`. But "no confirmation the reply landed" overstates it —
the collapsed root's counter button text does change (e.g. "3 replies" →
"4 replies"), which is real, if subtle, feedback that something happened.
The gap is real (it should auto-expand so the person sees their own words),
but it isn't a silent void the way the finding frames it.

**NT-3 — PLAUSIBLE, downgrade to P2.** Confirmed at line 559:
`onReply: box && scope === 'fest' ? (root) => box.setReply(root) : null`
— day/artist sections get `onReply: null` unconditionally, and I found no
comment nearby explaining it (grepped the whole file for `onReply`/`NT-3`/
`scope-agnostic`). But there's a real workaround the finding doesn't
mention: the person can still open that artist's or day's own scope sheet
(`openArtistSheet`/`openDayNotes`, which DO wire reply for every scope,
line 475) and reply from there. It's a missing shortcut in the aggregator,
not a missing capability — P2 fits better than P1.

**NT-4 — CONFIRMED, P1.** The reply-render loop (254-266) passes no
`onReply` key, so `noteRow`'s `if (opts.onReply)` (164) never fires for a
reply row — structurally zero reply-to-reply affordance. `setReply` (302)
always renders `Replying to ${note.author}` where `note` is only ever a
root (the only caller is `onReply: onReply ? () => onReply(t.root) : null`,
246 and 475). Verified the "Kevin's own words" quote is real and sourced —
it's the same quote pulled from `design-system.md`'s FINDING 4 ("nest
delete option... and maybe to have replies not be a button"), not
fabricated for this finding. P1 is right; this is structural, matches
Kevin's own stated direction, and touches every thread with 2+ replies.

**NT-5 — CONFIRMED, P1 — and understated.** The four `if` blocks (Edit
141, Delete 151, Reply 164, Pin 175) are exactly as independent and
unconditional as described. But the stated worst case ("six tokens") is
actually low: `collapsedReplies` (169) is a FIFTH independent block, and
critically it is not mutually exclusive with Reply — `renderThreads`
(240-249) passes `onReply` AND `collapsedReplies` to the same `noteRow`
call regardless of collapse state. So a note that is your own root, has
replies, AND is pinned-and-collapsed renders who · time · Edit · Delete ·
Reply · "N replies" · Pin — **seven** tokens, not six. See "Missed" below.

**NT-6 — PLAUSIBLE, downgrade to P3.** `stubRow` (188-201) does render
`${author} removed this note` with no "you" substitution, unlike `noteRow`
line 93 — confirmed, and there's even a test pinning the exact string
(`tests/notes-round.test.mjs:120`, `'Drew removed this note'`). But
`NOW.md` (line 32-33) explicitly lists "the deleted-root stub" as a
default shown on the canvas that is "not picked by Kevin... easy to
swap" — this isn't a slipped-through oversight, it's a tracked open
decision. Real, worth fixing, but P3 not P2: it's already flagged as
unfinished, not silently wrong.

**NT-7 — CONFIRMED, P2.** Both inputs (114, 282) are `<input>`, no
textarea, no counter; `.composer input` (v3.css:231-234) is plain
flex:1 with no wrap affordance. Checked the desktop path too
(`@media (min-width:720px) .sheet` → 560px dialog, v3.css:262-269) — at
that width the input is comfortably wide, so this is correctly scoped to
mobile as the finding says. P2 is right.

**NT-8 — PLAUSIBLE, downgrade to P3.** `setReply` (295-305) confirmed to
silently retarget with no confirm. But traced the actual geometry: the
44px-floor CSS (v3.css:357-360) gives `.note-action` a hit-area `inset:
-14px -2px` — 2px horizontal specifically "so one chip cannot swallow the
tap meant for its neighbour" (v3.css:353-356), which already narrows the
cross-thread mis-tap window the finding worries about. A genuine mis-tap
is still possible (14px vertical bleed between two short, tightly-packed
threads), but it needs a fairly specific layout, not the routine case NT-5
describes — P3, not P2.

**NT-9 — CONFIRMED, P3.** Verified `wall.js:955` calls
`dayWhisper('fest', null, ctx, ...)` — the reader's citation is exact.
Severity as stated is fine.

## Missed

1. **A live `re`-chain deeper than one level renders a false "removed"
   stub over a note that is fully alive and visible elsewhere** —
   `js/v3/model.js` `threadsFor` (146-170) × `api/_lib/crew-shared.mjs`
   (148-154). The server's own comment admits it: *"One-level depth is a
   client rule... the server guarantees only the shape."* Nothing client-
   or server-side stops a reply's `re` from pointing at another REPLY's id
   instead of a root's. Trace it: root X, reply A (`re: X.id`), reply B
   (`re: A.id`). `threadsFor` groups A correctly under X (`rootIds.has(A.re)`
   is true). For B, `rootIds.has(B.re)` is false (A isn't a root), so B
   falls into the stub branch (160-166), which does `map[n.re]` — finds A
   itself (undeleted, `deleted` not set) — and renders a whole second
   top-level thread reading **"[A's author] removed this note"** with B
   nested under it, even though A is sitting untouched in thread 1. This
   isn't hypothetical crafting-required paranoia to invent: the crew token
   is a single shared secret every member holds (per this repo's own
   documented trust model — "a member can still FORGE an author... same
   trust model as person names"), so any member's client, buggy or
   malicious, producing a chain the UI itself never generates, would show
   every other member a false "note removed" message over content that
   is still there. Worth a server-side guard (`re`'s target, if present
   and not itself tombstoned, must not itself carry `re`) even though the
   comment frames it as an accepted client convention rather than an
   enforced one.
2. **The "you" convention (`noteRow` line 93) is missing from the reply
   composer too, not just the stub NT-6 flagged** — `setReply` (302):
   `replyLabel.textContent = \`Replying to ${note.author}\`;` always uses
   the raw name. Replying to your own root note (nothing stops this) reads
   "Replying to Kevin" instead of "Replying to you." Same pattern as NT-6,
   different location the reader didn't cite.
3. **The reply composer's target has none of the remote-sync protection
   the file gives everything else** — `renderThreads` (211-215) explicitly
   purges `editing` drafts whose note vanished mid-repaint (the exact bug
   class the 2026-08-29 Codex gate fixed for inline edits), but `composer`'s
   `replyTo` closure variable (289, set by `setReply`) has no equivalent.
   If a remote sync tombstones the root someone is actively replying to,
   `replyTo` stays stale; hitting Save calls `addNote(..., replyTo.re ||
   replyTo.id)` and attaches the reply to a now-dead id, landing it under
   an orphan stub with no warning that the thread the person was answering
   is gone. Same bug shape the team already fixed once, recurring in the
   one place that fix didn't reach.
4. **A deleted root's thread can never receive a new reply, forever** —
   once a root is tombstoned, `notesFor` (107-112) drops it from `live`, so
   it's no longer in `roots`/`rootIds`; its surviving replies land in a
   stub thread (`root: null`, 251-253) which is rendered by `stubRow`
   alone — a static text block with no `onReply` wiring of any kind. The
   conversation is permanently frozen the moment its root note is deleted,
   even though the replies (and the ability to keep discussing them) stay
   visible. Worth deciding whether that's intended (a dead root really
   should end the thread) or an oversight — nothing in `NOW.md` calls it
   out as a decision, unlike the stub-copy question NT-6 raises.
5. **The Delete "Sure?" arm silently resets on any repaint inside its
   3-second window** — `noteRow`'s `armed` (152-162) is a closure-local
   variable; `renderThreads` rebuilds every row from scratch
   (`host.textContent = ''`, 207) on every `paint()`, including the
   `onChange()` a remote sync triggers. A person who taps Delete once (arms
   it), then has any crew member's edit sync in during the following 3
   seconds, gets a fresh, disarmed "Delete" button with no indication the
   arm was lost — they'd need to tap twice again, silently. Narrow window,
   low stakes (it fails safe, toward not-deleting), but real and unnoted.
