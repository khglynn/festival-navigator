# Settings dimension — survey findings (2026-08-30, notes-desktop-round / PR #13)

Scope: js/v3/settings.js (whole), settings wiring in js/v3/app.js (openSettingsLayer,
openSettings, goToFestList, festRow/festPickRow, router registerKind), index.html
settings markup. Cross-checked against CLAUDE.md, NOW.md, docs/user-flows.md F11-F13/F17.

---

## F1 (P1) — "You" still renders BELOW "Crew"; Kevin explicitly asked to swap them

Kevin's words: "Let's move 'You' above 'Crew' in the settings."

`renderSettings()` in js/v3/settings.js (lines 666-668) appends sections in this
order:
```
main.appendChild(festivalsSection(ctx, actions));   // "Your festivals"
main.appendChild(crewSection(ctx, actions));        // "Crew"
main.appendChild(youSection(ctx, actions));         // "You"
```
So the live order is Your festivals -> Crew -> You -> Spotify -> App — the
opposite of what was asked. Minimal fix: swap the crewSection/youSection calls
so You renders second, Crew third.

Bonus: the file's own top-of-file comment (line 2) already says the *intended*
order is "YOUR FESTIVALS -> YOU -> APP" — i.e. You-before-Crew was the stated
design intent all along, the code just never matched it (and the comment
itself omits Crew and Spotify entirely, see F1b below).

## F1b (P2) — stale/incomplete order comment, drifted from the code it describes

js/v3/settings.js line 2:
```
// Order: YOUR FESTIVALS -> YOU -> APP. Desktop is the same 560px column.
```
Actual rendered order (once F1 exists as a bug, and even after it's fixed) is
five sections: Your festivals -> Crew -> You -> Spotify -> App. The comment
never mentions Crew or Spotify at all. Fix alongside F1: update the comment to
name all five sections in true order, so the next person editing this file
isn't steered by a comment that already doesn't match reality.

## F2 (P1) — self-rename dedupe check is case-SENSITIVE; every other name check in
the app is case-insensitive; the server enforces case-insensitive uniqueness

CLAUDE.md: "Active member names must be unique case-insensitively... Enforced
in the merge's WHERE clause... as well as in validateMergedDoc." Confirmed in
api/_lib/crew-shared.mjs lines 369-375 — the merge validator rejects two
active names that differ only by case:
```js
const key = name.toLowerCase();
if (seen.has(key)) return fail(`two crew members named "${...}" ... must differ by more than capitalization`);
```
Every OTHER place in the client that checks for a name collision already does
this correctly — js/v3/app.js lines 935, 940, 1389 all compare via
`n.toLowerCase() === name.toLowerCase()` (join screen, add-member screen).

But Settings -> You -> "Rename me" (js/v3/settings.js, `doSave` inside
`youSection`, line 617) does a bare, case-sensitive object-key lookup:
```js
if (state.people()[v]) { status.textContent = 'That name has been used in this crew — pick a different one.'; return; }
```
Walk: I'm "Kat", another active member is "Drew". I rename myself to "drew".
`state.people()['drew']` is undefined (the real key is "Drew"), so the client
sees no collision, calls `actions.renameSelf('drew')`, which immediately:
tombstones "Kat" locally, makes "drew" my active local identity, shows the
toast "You're drew now — picks came with you," and schedules a sync push.
The server's merge validator then rejects that payload outright (case-only
collision with "Drew"). Per CLAUDE.md, `blocked` is a *deterministic*
rejection — sync.js remembers the refused payload and does not retry it; it
waits for a NEW edit. Net result: the device is now permanently, silently
stuck believing it is "drew" (an identity the shared doc never actually
accepted), sync sits `blocked`/`error`, and nothing in the You screen surfaces
why or offers a way back — the user would have to notice the sync dot, dig
into "Crew" for the sync label, and figure out on their own that their rename
never landed.
Fix: make the Settings rename-dupe check `.toLowerCase()`-compare against
`state.activePeople()`, matching the pattern already used at app.js:935/940/1389.

## F3 (P1) — Spotify scan ticker's animation check ignores the app's own "Low
power" setting; only respects OS-level prefers-reduced-motion

js/v3/settings.js line 1251, inside `openSpotifyDrill`'s connected-but-not-yet-
scanned branch:
```js
const noMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
```
This is the ONLY gate on the album-cover flicker ticker (`tile.classList.add/
remove('find')`, an `<img>` swap at most every 350ms, each one a real network
fetch of a cover image, for the whole multi-minute duration of a library
scan). `openSpotifyDrill(ctx, actions)` already receives `ctx` — the same
object that carries `ctx.lowPower` — so checking it would cost one `||`.

This directly contradicts the pattern already established elsewhere in this
exact codebase: js/v3/card-facts.js line 132 ("`.animated` — reduced-motion
and low-power still win globally"), js/v3/wall.js line 108
(`if (animated && !ctx.lowPower)`), and app.js's own boot-time comment
(line 1814): "prefers-reduced-motion rides the same path as Low power (quality
floor)." The Settings screen one scroll up literally labels the Low-power
toggle "no animation · sync every 5 min" (settings.js line 690) — a promise
this same screen's own Spotify drill breaks two clicks later.

Concretely: someone who explicitly turns ON "Low power" in Settings -> App
(without having OS-level reduced-motion on, which is the common case — most
people never touch that OS setting) still gets the flicker animation AND its
underlying image downloads firing throughout their Spotify connect flow. This
is exactly the "phone user in a field with one bar" scenario the audit brief
calls out, and it's Kevin's own stated principle ("too heavy for the type of
lightweight we always want this app to work") landing in a different animation
than the one he was pointing at, but the same violation.
Fix: `const noMotion = ctx.lowPower || window.matchMedia?.(...).matches;`

## F4 (P2) — "My link" (the person-restore link + its consequence warning) has
no path from Settings -> You at all; it lives only on the landing screen

docs/user-flows.md F17.2: "Landing YOU card -> 'My link' copies `#p=<token>`
— the personal restore link. Its copy carries the consequence: sharing it
makes someone else you." Confirmed: this button + warning text exist only in
js/v3/app.js `renderLanding()`, lines 1221-1234 (`copyBtn.textContent = 'My
link'`, `hint.textContent = 'Open your link on a new phone...Sharing it makes
someone else you, so don't.'`).

Settings -> You (`youSection`, js/v3/settings.js lines 543-649) has switch /
rename / color-change, and nothing else — no way to reach your own restore
link while inside a fest board. The only route back to it is Settings ->
Crew -> "Switch crew" (`actions.switchCrew`, app.js line 1062), which resets
the router and dumps you all the way out to the landing screen just to find a
button that, semantically, has nothing to do with switching crews.

This isn't contradicted by user-flows.md (F11 doesn't require it), but it's a
real gap: the ONE link that rebuilds your whole identity on a new phone —
arguably the single most consequential link in the app — is not reachable
from the screen whose entire job is "your identity, your settings," while a
strictly less-important link (the crew invite) gets not one but two exposed
copies (Share invite card + the always-visible Crew-section input+Copy row,
per FLOW-12). Recommend surfacing "My link" + its warning inside Settings ->
You directly (reuses the exact same landing-card component/copy).

## F5 (P2) — "Your festivals" never shows a pick count for boards in a
DIFFERENT circle, though user-flows.md says every row does, and the data to
do it is already loaded one line above

docs/user-flows.md F11.2: "Your festivals: current fest marked; other catalog
fests switchable in one tap; ... each row shows the crew's pick count."

js/v3/settings.js `festivalsSection()`, lines 160-178:
```js
const pairs = model.landingPairs(crew.knownCrews(), state.cachedDoc, FESTIVAL_INDEX)...
for (const p of pairs) {
  const sameCrew = p.token === state.getCrewToken();
  const picks = sameCrew ? Object.keys(model.picksFor(state.crewDoc, p.fid)).length : 0;
  const names = p.people.map((x) => x.name);
  wrap.appendChild(festRow(meta, { ...
    sub: [meta.dates,
          sameCrew && picks ? `${picks} artist${picks === 1 ? '' : 's'} picked` : '',
          !sameCrew && names.length > 1 ? names.slice(0, 3).join(', ') : ''
         ].filter(Boolean).join(' · '),
```
For any board that belongs to a circle other than the one currently open
(`!sameCrew`), the pick count is hard-zeroed and the row falls back to
listing member names instead — even though `model.landingPairs` was called
with `state.cachedDoc` one line above specifically so it CAN read any known
circle's cached doc (that's exactly how `p.people` gets populated for
`!sameCrew` rows). The fix is cheap and uses data already in hand:
`state.cachedDoc(p.token)` instead of `state.crewDoc` when `!sameCrew`, feeding
`model.picksFor` the other circle's own cached doc. Either fix the code to
match the doc, or (if member-names-instead is the actual intended UX for
other-circle rows) correct user-flows.md F11.2 to say so.

---

## Checked, found CLEAN (worth recording so it isn't re-litigated)

- **--fest accent, 4-places rule**: within Settings, `rgb(var(--fest))` /
  `rgba(var(--fest), ...)` appears only as (a) the fest name in
  `currentFestCard` (settings.js:75) and (b) the current-fest card border
  (v3.css:406, `.settings-card.current`) — both are two of the CLAUDE.md's
  four sanctioned places. The How-it-works tutorial (settings.js:371, :385)
  draws small demo copies of "stage header" and "fest name" components for
  teaching purposes, not new live surfaces. `festRow()` (tools.js:34) colors
  every listed festival's name in that FESTIVAL's OWN static `f.accent`
  metadata (not the live `--fest` var) — a different, legitimate pattern
  (each fest keeps its own identity color in a list), not the "device is
  currently themed as this festival" accent the CLAUDE.md rule is about. No
  violation found.
- **44px touch floor**: every real `<button>` in Settings gets it for free via
  the base `button { min-height: 44px }` rule (v3.css:328); `.list-row` rows
  get it too so tapping toggle labels works; the only opt-outs
  (`.person-chip`, `.back-btn`, `.fest-link`, `.toggle`, etc., v3.css:342-347)
  match the documented narrow-glyph/chip exceptions and use borrowed-space
  `::after` hit areas, not zero. The `.card button { min-height: 0 }` opt-out
  targets wall/artist cards (class `card`, wall.js:64) and does NOT match
  `.settings-card` (a different class name) — no accidental floor loss for
  Settings buttons.
- **Suite**: `npm test` — 275 tests, 274 pass, 1 env skip, 0 fail (matches
  NOW.md's "274 pass / 1 env skip"). No regressions from this walk's reads.
  Note: `tests/finish-pass.test.mjs` references settings.js only for a
  static/banned-pattern scan — there is no functional test coverage at all
  for the You/Crew rename, color, or ordering logic, which is consistent with
  how F1/F2 shipped unnoticed.

## Open questions (not findings — flagging for Kevin's call)

- **No "remove a member" anywhere.** Crew section has "Forget this crew on
  this device" (wipes the WHOLE crew locally) and a person can only remove
  THEMSELVES via self-rename (tombstones their own old name). There is no way
  for anyone to remove a *different* member's name from the crew. Given the
  additive-merge/no-delete doc model (jsonb_deep_merge, CLAUDE.md), this may
  be a deliberate architectural constraint rather than an oversight — worth
  a one-line confirmation from Kevin either way, since the task brief
  explicitly asked "remove a member" be walked and it doesn't exist.
- **Settings stays a fixed 560px column on desktop** (no responsive
  reflow at all — confirmed zero `@media` rules touch `.settings-card` /
  `.settings-list` / `#settings-root`). This reads as a deliberate "centered
  utility panel" choice rather than "stretched mobile," and is explicitly
  called out as an invariant in the file's own top comment, so I'm not
  flagging it as a defect — but noting it since user-flows.md's general
  desktop principle ("a designed experience, not stretched mobile") doesn't
  carve out an explicit exception for Settings.

## Skeptic

Verified each finding by opening the cited lines plus the neighboring code
(dependency helpers, the server-side validator, and the app.js action wiring
each render function closes over). All five hold up as real; one severity
gets corrected down, and the fix proposed for F2 is itself wrong in a way
worth flagging before anyone applies it.

**F1 — CONFIRMED, P1.** Read settings.js:666-668 directly: the three
`main.appendChild(...)` calls are festivals, crew, you, in that order, and
line 2's own comment already states the intended order as
"YOUR FESTIVALS -> YOU -> APP." Cross-checked Kevin's quote against the two
sibling survey files from this same round (`spotify-tools.md:145`,
`onboarding.md:25`) — both independently cite the identical verbatim
instruction, so this isn't a reader fabrication riding on one file's say-so.
Trivial fix, correctly scoped.

**F2 — CONFIRMED, P1** on the bug itself, but **the reader's proposed fix
reintroduces a different, already-fixed bug and should not be applied as
written.** settings.js:617 is exactly as described — a bare, case-sensitive
`state.people()[v]` lookup — while app.js:935/940/1389 and
crew-shared.mjs:369-375 all normalize case. The failure chain (false-success
toast -> local identity flip -> server `blocked` -> no explanation surfaced
in Settings) checks out against sync.js:106/128 (`isRefused` -> `blocked`,
no retry) and renameSelf's actual body (app.js:1097-1129), which does
exactly what the write-up says: tombstone the old name, adopt the new one
locally, `crew.setMe(...)`, toast success, *then* push to the server.
However: the reader's suggested fix —
`state.activePeople().some(([n]) => n.toLowerCase() === v.toLowerCase())`
— silently drops the removed-name check the *current* code deliberately
keeps. `state.activePeople()` (state.js:113) filters to
`!p.removed` only; `state.people()[v]` (the code as it stands) checks
*every* key, active or tombstoned, which is exactly what the comment two
lines above the check (settings.js:611-613, "Removed names stay blocked
too... reusing it would tangle identities, Codex ship gate") says it exists
to do. Swapping in `activePeople()` would let a rename reuse a *removed*
name's case-exact spelling again — the bug that comment was written to
prevent — while merely adding case-insensitivity on top. The correct fix
compares against `state.people()` (or equivalently `Object.keys(state.people())`),
not `state.activePeople()`:
```js
const vLower = v.toLowerCase();
if (Object.keys(state.people()).some((n) => n.toLowerCase() === vLower)) { ... }
```
This doesn't change the finding's verdict (the case-sensitivity bug is real
and P1), just the fix that ships with it.

**F3 — PLAUSIBLE, downgrade to P2.** The code claim is exactly right:
settings.js:1251's `noMotion` checks only `matchMedia`, `ctx.lowPower` is in
scope (confirmed live at app.js:29-36/994-997, and threaded into
`openSpotifyDrill(ctx, actions)` at settings.js:718/1119), and the
established pattern elsewhere (card-facts.js:132, wall.js:108) does
OR the two checks together. But P1 overstates it: this flicker+fetch only
runs during a user-initiated, one-time-per-connect library scan that is
*already* far more network-heavy (paginating the whole Spotify library) than
the marginal cost of album-cover images swapping every 350ms — it is not a
continuous background drain, and reduced-motion (which most affected users
in the "weak signal" scenario the finding invokes will not have set) already
suppresses it for anyone motion-sensitive. Real inconsistency with a stated
setting, worth the one-line fix, but P2: a polish/consistency gap in an
infrequent flow, not a P1-grade break of core function or the Low-power
promise's main cases (scroll behavior, sync cadence, wall animation — all of
which do respect it correctly, per wall.js:108 and app.js:1793/1821/1834).

**F4 — CONFIRMED, P2.** Read renderLanding() at app.js:1195-1234: the
My-link card (with the "sharing it makes someone else you" hint) is gated
entirely behind `if (person) { ... }` inside the landing render and has no
counterpart in youSection (settings.js:543-649, confirmed switch/rename/
color only, no `meLink` reference anywhere in settings.js). Confirmed
`actions.switchCrew` (app.js:1062-1065) does exactly what the finding says:
`router.reset()`, replace the URL to `/`, and re-render the landing screen
from scratch — there's no lighter path back to that card from inside a
board. P2 is right: annoying and worth fixing, but not destructive (the
crew token is still in local storage, so "switch crew" isn't data loss, just
an unnecessary round trip to reach an unrelated button).

**F5 — CONFIRMED, P2.** Traced `model.landingPairs` (model.js:198-224): the
`doc = docFor(c.token)` call already resolves through `state.cachedDoc`
(state.js:318) for every known circle, which is precisely how `p.people`
gets populated for `!sameCrew` rows one line above the hard-zeroed
`picks` — so `model.picksFor(state.cachedDoc(p.token), p.fid)` is a real,
already-available one-line fix, not a "would need new data" situation.
Confirmed `model.picksFor` (model.js:32) takes any `(doc, fid)` pair, so it
composes directly. P2 matches: a display-completeness gap, not broken
functionality.

### Missed

- **js/v3/settings.js:611-620 / the F2 fix itself** — see above: applying
  the reader's suggested `state.activePeople()` fix as written would
  reintroduce the removed-name-reuse bug that the surrounding comment says
  was deliberately closed. Any patch for F2 needs to keep checking
  `state.people()` (all names, active or tombstoned), just case-insensitively.
- **js/v3/settings.js:166-176 (extends F5)** — the same fix should also
  cover the case where an other-circle row has zero or exactly one known
  person: today `!sameCrew && names.length > 1` is the only condition that
  puts anything in the sub-line for those rows, so a different circle with
  a single member currently renders with no pick count AND no name — just
  the bare date string, indistinguishable from a fest with no cached data
  at all. Not a separate bug so much as the same root cause showing a second
  symptom; worth folding into the same fix rather than filing separately.
- **js/v3/settings.js:1349-1352 ("Just mine" playlists aren't remembered)**
  — `state.recordSpotifyPlaylist(fid, {...})` at settings.js:1350 only fires
  `if (!mineOnly)`; a personal ("Just mine") playlist is never persisted to
  `spotifyPlaylistFor`, so reopening the Spotify drill after making one shows
  a bare "Make playlist" button again with no link back to the one just made
  — the success toast (`plStatus.replaceChildren(done, link)`) is the only
  place that link ever appears. This may be a deliberate "personal playlists
  are ephemeral, re-derivable, and per-device" design choice rather than a
  bug (unlike the "everyone" playlist, a personal one has no crew-shared
  home to write it to), so flagging as a question rather than a finding —
  worth a one-line confirmation from Kevin either way, since it's a
  real loss of the "did that work?" answer the F13 rework was built around.
