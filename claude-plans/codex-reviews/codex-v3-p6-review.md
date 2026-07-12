# P6 Gate Review — v3-design branch (final blocking review before production promote)

Scope: abb6910..HEAD primary focus (P3 screens, P4 endpoint, old-UI deletion, recover
restyle, P5 SW+favicon), plus anything promote-blocking anywhere on the branch.

Reviewer: Claude (in-team teammate), started 2026-07-10.

Status: COMPLETE.

**Bottom line: one P0 with a fix already written but NOT YET COMMITTED
(Finding 1 — commit it before promote), one P1 worth a fast follow
(Finding 2 — broken new-crew onboarding, doesn't touch existing crew data),
one P1 worth a fast follow (Finding 3 — cross-crew leak on rapid crew switch,
narrow window, atypical navigation), and a handful of P2 hardening/cleanup
notes. Everything else I checked came up clean — see "Confirmed clean"
below.**

---

## ⚠️ SCOPE NOTE: HEAD moved mid-review, and there's an uncommitted fix in progress

When I started, HEAD was `0bcdbf9`. Partway through, two more commits landed
(`843f778`, then `8523148 fix(v3): Codex P3 trail findings — customs wired into
the catalog + P1s`), and `js/v3/app.js` currently has an **uncommitted** working-tree
change (`git status`: `M js/v3/app.js`) that adds a `ctx.migrationPending` gate —
explicitly labeled in its own comment as fixing **"Codex P6 gate, finding 1"**,
i.e. the exact bug I wrote up below as Finding 1, apparently found independently
by a parallel Codex review running tonight. I verified the uncommitted diff by
hand (`git diff -- js/v3/app.js`) and it looks correct: `handleTap` and
`recordPick` both now bail out (with a toast) while `ctx.migrationPending` is
true, `enterApp()` awaits `requestMigration()` *before* `show('screen-app')`,
and the 25s poll loop retries the migration and clears the gate once it lands
(covers the offline-at-open case). **This is not yet committed** — someone needs
to commit it before promote, and I'd still want a second pair of eyes to confirm
`git diff` matches what's below once it lands, since I'm reading a moving target.

Given the fix's own comment cites this finding, I'm leaving Finding 1 below
as originally written (it documents the bug precisely, for the record and in
case the uncommitted diff gets lost) but flagging its status as **FIX WRITTEN,
NOT YET COMMITTED** rather than open.

I re-checked everything I'd already read (`recover.html`, `js/v3/wall.js`,
`js/v3/settings.js`, `js/festivals.js`, `api/_lib/crew-shared.mjs`) against the
current `HEAD` (`8523148`) plus this uncommitted diff before writing up findings
below, so the rest of this document reflects the current true state, not the
stale `0bcdbf9` snapshot. Two things `8523148` already fixed that I would
otherwise have flagged, for the record: **custom festivals were saved but never
loaded** (P0, now fixed via `js/festivals.js:loadCustomFestivals`), and
**long-press false-cancel on touchscreen jitter** (P1, now fixed via a 10px
movement threshold in `js/v3/wall.js`).

---

## Finding 3 — P1 (fix before morning): rapid crew-switch can attribute a tap on the still-visible OLD crew's card to the NEW crew's pendingChanges

Files: `js/v3/app.js:261-280` (`enterApp`), `js/v3/wall.js:52-121` (`renderCard`'s
click handler reads the module-level singleton `ctx`), `js/state.js:52-64`
(`activateCrew` — synchronous global swap of `crewToken`/`pendingChanges`/
`activeFestivalId`/`crewDoc`).

`state`, `crew`, and the view `ctx` object in `js/v3/app.js` are all
module-level singletons — there is exactly one `pendingChanges`, one
`activeFestivalId`, one `ctx.meName` for the whole page, regardless of which
crew's DOM is currently on screen. `enterApp(token, doc)` does the following,
in order:

```js
crew.setActiveCrew(token);
crew.rememberCrew(token, ...);
await loadCustomFestivals(token);      // <-- await point; OLD crew's DOM still on screen
state.activateCrew(token, doc);        // <-- SYNCHRONOUS: swaps pendingChanges/crewToken/
                                        //     activeFestivalId/crewDoc to the NEW crew, right here
await loadFestival(state.activeFestivalId);  // <-- another await point
show('screen-app'); ...; repaintWall();      // <-- only NOW does the DOM catch up
```

Between the synchronous `state.activateCrew(token, doc)` call and the
`repaintWall()` several lines later (spanning the `loadFestival` await — a
network-or-cache fetch that's fast when cached but not instant, especially on
a cold load of a festival that hasn't been opened before), the **DOM still
shows the previous crew's wall**, fully interactive, with click handlers
closed over the *previous* render's `artistName` — but those handlers call
`ctx.onTap` → `handleTap` → `state.recordSelection`, which reads the
now-already-swapped **global** `state.activeFestivalId`/`pendingChanges` and
the singleton `ctx.meName` (which itself hasn't been refreshed yet either,
since `refreshCtx()` runs later in the same sequence).

**Concrete failure scenario:** a user viewing crew C's wall opens a different
crew via a saved link/bookmark (`/#g=<tokenA>`) while crew C's cards are still
on screen. If they tap a crew-C card in that window, the write lands in crew
A's `pendingChanges` (and, once persisted, crew A's `crewDoc`), keyed by
whatever crew C's `ctx.meName` still says — a phantom selection for an artist
that may not even exist in crew A's festival, attributed to the wrong person,
pushed to crew A's real server document.

This requires an atypical sequence (switching to a **different** crew via a
direct link/bookmark while another crew's wall is live and tapping in a
narrow window), not the common single-crew flow, so I'm not calling it
promote-blocking — but the three real crews are exactly the kind of
multi-device, multi-crew-link household where this is plausible (e.g. someone
holding two crew links, tapping while a page navigates). Recommend either: (a)
extend the existing `bootGeneration`/`current()` guard (already used in
`boot()`) into `enterApp()` so a superseded `enterApp` call no-ops instead of
finishing its tail and repainting stale data, and (b) make the wall
non-interactive (or literally clear `wall-root`) at the very start of
`enterApp()`, before the first await, so stale click handlers can't fire
during a crew switch at all.

---

## Finding 2 — P1 (fix before morning): "ADD A FESTIVAL →" on the landing screen is a dead link — new crew creation has no UI path in v3

Files: `index.html:49-52` (`#landing-add`), `js/v3/app.js` (`boot()`/`renderLanding()`),
`js/crew.js:56-66` (`createCrew`, unused).

The landing screen's primary CTA is `<a class="hero" href="/#new" id="landing-add">ADD A
FESTIVAL →</a>` (`index.html:49`). There is no click handler on `#landing-add`
anywhere in `js/v3/*.js`, and `boot()` never special-cases the `#new` hash —
`crew.tokenFromHash()` only matches `#g=<token>` (`js/crew.js:36-39`), so for
`#new` it returns null, `boot()` falls through to `renderLanding()` again. The
button is a no-op.

`js/crew.js:56` still exports `createCrew(crewName, myName, color)` (POSTs to
`/api/crew` with no token to create a brand-new crew document), but nothing in
`js/v3/*.js` imports or calls it — confirmed by grep across the v3 tree. The
pre-rebuild UI (`js/app.js`, deleted whole in `bd659ca`) had a `render('new')`
screen that called exactly this function
(`git show 4348445:js/app.js` — `render('new')` at old line 324, `crew.createCrew(...)`
at old line 578); the v3 rebuild dropped the screen and never rewired the
entry point.

**Concrete failure:** a brand-new user with zero saved crews (no `#g=` link
in hand) opens the site, sees the landing screen, taps "ADD A FESTIVAL →",
and lands back on the exact same landing screen with no feedback and no way
to proceed. There is currently no UI path in v3 to create a crew from
scratch — the only way in is opening someone else's `#g=<token>` share link.

Doesn't touch the three real crews' existing data (they already have tokens),
so it's not a data-loss risk, but it's a confirmed regression of a
previously-working core flow and the most visible thing a first-time visitor
can click. Recommend either wiring `#new` (or the button) to a lightweight
create-crew screen/modal calling `crew.createCrew()` before promote, or — if
new-crew creation is intentionally out of scope for this release — changing
the CTA's label/behavior so it doesn't look actionable while nonfunctional.

---

## Findings 4-8 — P2 (note, non-blocking)

**4. `festival-rules.mjs` reflects raw LLM/attacker-influenced strings into
error messages; `crew-shared.mjs` got the sibling fix, this file didn't.**
`api/_lib/crew-shared.mjs` added `safeKey()` this session specifically to stop
attacker-controlled field values (artist names, which are deliberately allowed
to contain `<>&"'` — see `validArtistKey`, `festival-rules.mjs` has no
character blocklist either, only length caps) from riding raw into JSON error
strings ("Codex P3 trail, finding 4"). `api/_lib/festival-rules.mjs` —
used by the exact same LLM-researched-candidate path in `api/festival-add.js`
— has several of the identical pattern that weren't touched: `festival-rules.mjs:31`
(`` `accent must be "R, G, B" (got ${fest.accent})` ``), `:47-48` (`` `artists[${i}] (${a.name}): ...` ``
twice), `:60-65` (multiple `${a.name}`/`${a.stage}`/`${label}` in the
`scheduled` branch). Currently not exploitable — I traced every place these
error strings land (`js/v3/settings.js:199,221` — both `status.textContent =`)
and confirmed they're textContent-rendered, so this is defense-in-depth, not
a live XSS — but it's the same class of bug that was just fixed one file over
and would be a two-line fix to close for consistency (reuse/import `safeKey`).

**5. Dead files in the SW precache list.** `service-worker.js`'s `APP_SHELL`
still lists `/js/access.js` and `/js/overlap.js`. Neither is imported by
anything reachable from `js/v3/app.js` anymore (confirmed via a full import
graph walk — `js/access.js` was the old Spotify-allowlist client, `js/overlap.js`
the old schedule-overlap renderer). Both paths exist so install doesn't fail,
just wasted precache bytes. Harmless; worth a cleanup pass.

**6. `recover.html`'s `<select id="aff-person">` still carries dead Tailwind
utility classes.** `bg-gray-700 rounded p-1 text-white` (`recover.html:189`) —
Tailwind was fully removed from this branch (`assets/tailwind.css`,
`tailwind.config.cjs`, the `npm run css` script, and the CI freshness check
are all deleted per this diff), and `recover.html` doesn't link any
tailwind.css. The affinity-person dropdown in the merge preview will render
with plain browser-default `<select>` styling against the dark v3 theme —
a leftover from an earlier version of the page, not restyled in the "recover
restyle" pass. Cosmetic only.

**7. `recover.html:147`'s `raw.libmap.fetchedAt` is the one interpolation
into `innerHTML` that skips the file's own `esc()` helper.** Every other
doc-derived value in this file is consistently escaped (`esc(fid)`, `esc(p)`,
`esc(...)` on join results, error messages, etc.) — this one date string
isn't. It's local-device-only data written exclusively by `spotify.js` as
`new Date().toISOString()` in the normal flow (not otherwise reachable without
already having write access to this origin's localStorage, at which point XSS
here is moot), so not a live risk, but worth wrapping in `esc()` for
consistency with the rest of the file's discipline.

**8. Dock scrollspy can go stale after a search-then-blur.** `renderDockDays()`
(which re-wires `wireScrollspy` against fresh `.day-rule` elements) only runs
from `repaintWall()`. The search input's own `input` handler
(`js/v3/app.js:307`) calls `renderWall(...)` directly, bypassing
`renderDockDays()`. The dock itself is hidden while search is focused
(`dock.classList.add('hidden')` on focus), so this is invisible during
active typing — but if the user blurs the input with text still present, the
dock reappears watching `.day-rule` elements that a search-filtered render may
have already replaced/detached, and the active-day highlight freezes until
the next full `repaintWall()`. Minor UX nit, not data-affecting.

---

## Finding 1 — P0 (blocks promote): un-migrated v3 doc is interactive before migration completes; a genuine "picked x3" tap can be silently corrupted to "must"

Files: `js/v3/app.js:261-280` (`enterApp`), `js/v3/model.js:19` (`LEGACY_MAP`), `api/crew.js:58-84,92-136` (migrate op + write-time `declaresV4` branch).

`enterApp()` calls `show('screen-app')` and `repaintWall()` — making the wall fully
interactive — *before* it awaits `sync.requestMigration()`:

```js
show('screen-app');
applyFestTheme();
refreshCtx();
renderPersonChips();
renderDockYou();
repaintWall();                              // <-- cards are tappable NOW
history.replaceState(null, '', `/#g=${token}`);
if (model.needsMigration(state.crewDoc)) {
  await sync.requestMigration();            // <-- migration is still in flight
  repaintWall();
}
```

`model.js`'s own comment acknowledges the race exists ("a v4-semantics write can
land on a not-yet-migrated doc in the migrate-race window") but the fix
(`LEGACY_MAP` passing `4` through unchanged) only protects raw level **4** ("must")
from being read as `0` (invisible). It does **not** protect raw level **3**.

Level 3 is the one genuinely ambiguous value between doc versions: v3 semantics
say `3` = "Must See"; v4 semantics say `3` = "Picked ×3" (not must). The server's
migrate op (`api/crew.js:58-84`) permanently rewrites every stored `3` it finds to
`4` — it cannot tell a legacy "Must See" from a freshly-written v4 "Picked ×3".
And the regular write path (`api/crew.js:92-136`) does nothing to prevent a
`sv:4`-declared write from landing raw, unmapped, on a still-v3 row: `declaresV4`
being true makes `incomingForV4 === incoming`, so the `CASE WHEN doc->>'v'='4'`
branch picks the *same* (unmapped) payload regardless of the row's actual
version — a `3` just gets merged straight into the v3 row.

Concrete failure scenario, live against the three real (still-v3) crews the
moment this branch promotes:
1. A real crew member opens the app. `enterApp()` shows the wall and it's
   already tappable while `requestMigration()` is still in flight (a second
   network round-trip after the initial doc fetch — easily >1s on a cold
   Vercel/Neon connection right after a fresh promote).
2. They tap a card three times fast (a completely normal action — the whole
   point of the tap cycle is quick repeated taps): `nextTapLevel` goes
   0→1→2→3, writing raw `3` into `pendingChanges` and the local `crewDoc` via
   `applyLocalPick`, intending "Picked ×3".
3. `sync.scheduleSync()` debounces 1200ms then POSTs `{data, sv:4}`. If that
   POST reaches the server before (a) `requestMigration()`'s own request has
   completed, or (b) if `requestMigration` failed/was offline and never
   migrated the row at all, the `3` is merged verbatim into the still-v3 row.
4. Whenever the migrate op *does* eventually run against that row (this boot,
   a later boot, or a teammate's boot), it converts that `3` to `4` —
   silently turning the user's "Picked ×3" into "Must", permanently and
   undetectably. This is data corruption, not just a transient display glitch.

Even without the corruption completing, every read of that pending `3` before
migration finishes (`readLevel` via `LEGACY_MAP`) displays it as "Must" to
everyone, which is at minimum a confusing flash of wrong state on production
data mid-promote.

**Fix recommendation:** don't let the wall become interactive (or at least
don't let `handleTap`/`recordPick` fire) while `model.needsMigration(state.crewDoc)`
is true and migration hasn't resolved — either await `requestMigration()` before
`show('screen-app')`/`repaintWall()` in `enterApp()`, or gate `handleTap` in
`js/v3/app.js:44` and `recordPick` in `js/v3/app.js:185` on migration having
completed (queue/disable taps, or block with a brief "syncing…" state) until
`state.crewDoc.v === 4`. Given real production docs are in this exact state
tonight, this is promote-blocking.

Same raw-`3`-on-unmigrated-doc exposure also exists through Bulk paste
(`js/v3/tools.js:60-74` → `actions.recordPick` → `state.recordSelection`,
wired in `js/v3/app.js:185-188`) — lower likelihood (requires navigating to
Settings first, more time for migration to land) but same root cause, same fix
covers it.

---


## Confirmed clean (checked, no finding)

**1. XSS audit.** Every doc/API-derived string render in `js/v3/wall.js`,
`notes.js`, `settings.js`, `tools.js`, `favicon.js` goes through
`textContent`/`createElement` — no `innerHTML` anywhere in the v3 JS tree
(verified by grepping the whole tree for `innerHTML|outerHTML|insertAdjacentHTML|
document.write`; the only hits outside `recover.html` are `gallery.html`
(unchanged since P1, out of scope) and `vendor/html2canvas.min.js` (third-party,
untouched)). `recover.html` does use `innerHTML`, but consistently through its
own numeric-entity `esc()` helper (one minor gap noted as Finding 7). Server
validation (`api/_lib/crew-shared.mjs`) rejects `<>"'` `` ` `` and control
chars in person/crew names outright (`SAFE_NAME_RE`, backed by a passing test:
"person names: HTML-dangerous and control chars rejected"). Artist names are
deliberately *not* character-restricted (real bands use `&`, `'`, etc.) —
the security model there is 100% output-encoding, not input-sanitization, and
I traced every current render path to confirm it holds (see Finding 4 for the
one inconsistency in how validation *errors* for these fields get built,
which is defense-in-depth only, not a live hole).

**2. Data loss — the rest of the checklist.** `state.recordNote`'s
double-write (`pendingChanges` + `crewDoc`) is synchronous and atomic, no
window for a partial write. `applyRemoteDoc`'s `deepMerge(remote, pendingChanges)`
always keeps local edits on top. `pushSync`'s pending-clear is correctly
gated on both the crew token *and* the edit-sequence number, so a mid-flight
crew switch or a new edit arriving during the round-trip can't drop pending
work. "Stay offline" only suppresses network attempts (`setSyncStatus`
early-returns) — it never touches `pendingChanges`, and flipping it back off
immediately calls `pushSync()` to flush the backlog. Undo-toast now re-queries
its card by `data-artist` (via `CSS.escape`, safe against special characters
in artist names) instead of holding a stale element reference, so a remote
repaint during the 5s window degrades to a full `repaintWall()` instead of a
silent no-op (fixed in `8523148`, verified correct).

**3. Touch handling.** Long-press vs. scroll-drag: `.card` has no
`touch-action` override anywhere in `assets/v3.css`, so it's `auto` —
standard browser behavior (iOS Safari / Android Chrome) suppresses the
synthesized `click` after a touch is consumed as a scroll/pan, and
`pointermove` cancels the pending long-press timer independently as a second
layer. The 10px jitter threshold added in `8523148` fixes real-device false
cancels without weakening the scroll-cancels-longpress behavior. `longPressed`
is a per-render closure variable reset on every `pointerdown` (and now also
reset right after use in the capture-phase click handler) — no leak across
taps or across re-renders (`refreshCard` builds an entirely new element/closure
each time). Capture-vs-bubble ordering on the same element resolves in
registration order at the target phase, so the long-press guard's
`stopImmediatePropagation()` reliably beats the plain `onTap` bubble listener
when it needs to. Dock scrollspy: `unspy()` is called before every
`wireScrollspy()` re-wire in `renderDockDays()`, so there's no observer leak
across repaints (one narrow staleness case during search-then-blur noted as
Finding 8, cosmetic).

**4. festival-add.** `extractJson` does real brace-depth/string-aware
parsing (not a naive regex), safely extracts the first top-level JSON object
from adversarial/grounded text. The confirm path fully re-validates
server-side via the same `validateFestivalDoc` used for research-preview
output — a tampered client payload gets no more trust than a fresh LLM
response. Custom festivals are stored keyed `(token, fest_id)` and every
read/write in `api/festival-add.js` is scoped by `token`, checked against
`crews` first — no cross-crew leak at the DB layer. I also chased down a
*client-side* cross-crew concern (whether one crew's loaded custom festival
could stay visible in another crew's catalog via the shared `FESTIVALS`/
`FESTIVAL_INDEX` module singletons) — it doesn't leak, because `boot()` calls
`loadFestivalIndex()` (which fully replaces `FESTIVAL_INDEX`) before
`loadCustomFestivals()` re-merges the *current* crew's customs, on every
crew switch.

**5. Service worker (v13).** Every path in `APP_SHELL` resolves to a real
file (verified all 34 entries against the filesystem) — no install-time 404s.
Two dead entries (`js/access.js`, `js/overlap.js`) are wasted bytes, not
bugs (Finding 5). `CACHE_VERSION` was correctly bumped to v13 for this
redesign, so the stale-shell risk (browsers skip the install/activate cycle
entirely if `service-worker.js`'s bytes are unchanged) doesn't apply to *this*
deploy — flagging only as a standing process dependency for future changes,
not a bug now. `/api/` requests bypass the cache entirely (network-only,
graceful 503 JSON fallback offline) — confirmed intact.

**6. The three real (still-v3) crews.** `colorIndexOf` correctly resolves
both legacy `color` (12-palette RGB string) and v4 `colorIndex` (24-board
int) on the same person object, including a brand-new member joining a v3
crew via the join flow with a fresh `colorIndex` sitting alongside legacy
members' `color` strings (schema-valid on both client and server, confirmed
in `crew-shared.mjs`). Affinity data isn't versioned by doc `v` at all, so
it's unaffected by migration state. `readLevel`'s `LEGACY_MAP` correctly
passes every level through for a v4 doc and remaps 1→1/2→2/3→4 for a v3 doc —
verified by the existing test suite (56/56 passing, including "legacy read
mapping," "v4 docs read raw," and "LEGACY_MAP passes 4 through"). The one
real gap in this whole area is Finding 1 (the interactive-before-migration
window), which is a *write-time* race, not a read-mapping bug — the
read-mapping logic itself is solid.
