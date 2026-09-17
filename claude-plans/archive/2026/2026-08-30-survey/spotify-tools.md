# Survey dimension: Spotify, tools, the green pill
Branch: notes-desktop-round (PR #13). Surveyed 2026-08-30.
Files walked whole: js/spotify.js, js/v3/tools.js, spotify-callback.html, js/v3/card-facts.js,
js/v3/aura.js (aboutCorner), js/state.js (affinity slice), js/v3/settings.js (Spotify drill,
~lines 660-1430), js/v3/wall.js (renderCard's spotify chip block), js/v3/app.js (ctx.affinity wiring).

---

## F1 — Disconnect's own promise is false: badges never disappear, and they're crew-visible

**File:** js/v3/settings.js:1418-1422, cross-checked against js/spotify.js:65 and js/state.js:97/173.

The Disconnect button's caption reads:
> "Disconnect keeps picks and notes — only the badges disappear."

But `dis.addEventListener('click', () => { spotify.disconnect(); rerenderDrill(); });` calls only
`spotify.disconnect()`, which is:
```js
export function disconnect() { removeLS(LS_AUTH); removeLS(LS_LIBMAP); }
```
That clears the local OAuth token and the local library cache. It never touches
`crewDoc.affinity`, which is what the wall actually renders from:
`ctx.affinity = state.affinityLookup(ctx.meName)` (app.js:105), read by every card
(`wall.js:130 const aff = ctx.affinity ? ctx.affinity[artistName.toLowerCase()] : null`).
`state.affinityFor`/`recordAffinity` never get called by disconnect — nothing subtracts
the person's name from `crewDoc.affinity`.

**Failure scenario:** connect, scan, disconnect. Every green-glow/bookmark badge you had is
still on every card, for you AND for every crew-mate viewing the wall (affinity is a
crew-doc field, synced to the server) — indefinitely, with no UI path to clear it short of
reconnecting and running a fresh scan (which itself only adds, see F2). The one sentence
the drill uses to explain what Disconnect does is wrong about the one thing a privacy-minded
person disconnecting would care about.

**Fix:** either make it true — clear `crewDoc.affinity[meName]` (via a new
`state.recordAffinity(meName, {})`/removal path) on disconnect — or change the copy to
something honest ("badges you've already earned stay until your next scan overwrites them").
Given Spotify data lives in a shared, synced doc, the safer default is clearing it.

Severity: P1 (a UX defect — the app's own stated behavior is false, and the wrong direction
is "your data persists longer than promised," not shorter).

---

## F2 — Affinity only grows, never shrinks: unfollow/unlike an artist and the badge is permanent

**File:** js/spotify.js:311-348 (`badgeAllCrewFests`), 434-452 (`applyAffinityToCrew`).

Both badging paths start from the person's *existing* affinity map and only ever add or
overwrite entries where the fresh scan found a hit:
```js
const merged = { ...(state.affinityFor(myName) || {}) };   // badgeAllCrewFests, L319
...
if (!aff) continue;                                          // L333 — no fresh hit? leave the OLD entry alone
merged[name] = aff;
```
```js
const merged = { ...(state.affinityFor(myName) || {}), ...out };  // applyAffinityToCrew, L449
```
There is no code path anywhere in spotify.js/state.js that removes an artist from a
person's `crewDoc.affinity` entry when a fresh scan no longer finds them in the library.

**Failure scenario:** you like 5 GRiZ songs and follow them (green glow), later unfollow and
delete the likes (maybe you soured on them, or fat-fingered a follow). Hit "Read it again" —
the scan re-runs, finds nothing for GRiZ, and `affinityOf` returns `null` for that artist —
but `merged[name] = aff` is skipped (line 333: `if (!aff) continue`), so the STALE entry from
the last scan survives untouched. The green glow and "in your Spotify" badge for that artist
never go away, ever, for the life of the crew doc.

Severity: P2 (quality/correctness gap — badges are a one-way ratchet, contradicts "Read it
again" reading as a real re-sync; not data loss, but silently wrong and permanent).

**Fix:** `badgeAllCrewFests` should build the merged map by first zeroing out entries for
every artist name it actually checked (`artistNamesOf(fest)` for every fest it's iterating),
then re-adding hits — so a scan that finds nothing for an artist it *did* check removes the
stale badge, rather than only ever adding for artists it happens to still find.

---

## F3 — Spotify affinity matching is exact-string-only; real shipped lineup names guarantee misses

**Files:** js/spotify.js:350-357 (`affinityOf`), 434-452 (`applyAffinityToCrew`); grounded
against data/festivals/*.json.

`affinityOf`/`applyAffinityToCrew` look up `lib.artists[artistName.toLowerCase()]` — a single
exact lowercase string match against the lineup's artist name. Real, shipped lineup data
routinely encodes information Spotify's artist catalog never will:

- b2b sets — Spotify has no artist named the combo:
  - `data/festivals/portola-2026.json`: "Beltran b2b Ben Sterling", "erika b2b sfcowboy"
  - `data/festivals/seismic-9.json`: "Cole Knight b2b Dreya V"
  - `data/festivals/edc-orlando-2026.json`: "Excision B2B Space Laces"
- Parenthetical annotations — Spotify's artist is named without the suffix:
  - `data/festivals/lollapalooza-2025.json`: "Chachi (DJ Set)", "Goo (DJ Set)"
  - `data/festivals/electric-forest-2026.json`: "Party Pupils (Late)"

**Failure scenario:** a crew member has followed and has 20 saved songs by Excision — the
Spotify feature's whole promise ("every artist you already listen to gets badged"). At EDC
Orlando their lineup entry is "Excision B2B Space Laces". `"excision b2b space laces"` never
equals `"excision"` in the lookup, so this card NEVER gets a badge, silently, with no
indication to the user that the match failed rather than that they simply don't listen to
that artist. This isn't a rare edge case for this app's actual festival roster — bass/EDM
festivals (Lost Lands, Seismic, EDC) lean heavily on b2b sets, and Lollapalooza/Electric
Forest both carry parenthetical suffixes in the same file already in the repo.

Severity: P2 (degrades silently — no crash, no wrong data shown — but it's a structural gap
in the app's signature Spotify feature, on real data already in the repo, not a hypothetical).

**Fix:** when a lineup name doesn't match directly, try splitting on common combo markers
(` b2b `, ` B2B `, ` x `, ` X `, ` & `, ` vs `, ` vs. `) and stripping trailing parentheticals
(`\s*\([^)]*\)\s*$`), then affinity-match each resulting name and take the best hit (or union
song counts / OR the `followed` flags). Even a partial match ("you follow Space Laces") is a
truer signal than a permanent silent miss.

---

## F4 — Playlist track search can pull unrelated songs for the same combo/annotated names

**File:** js/spotify.js:472-498 (`findTrackUris`).

For a b2b/annotated artist name, the artist-filtered search legitimately returns zero hits
(`hits.length` is 0, since no Spotify artist is literally named "Cole Knight b2b Dreya V"),
so the code falls back to whatever Spotify's plain-text search returns for that string:
```js
const top = (hits.length ? hits : (search.tracks?.items || [])).slice(0, tracksPerArtist)...
```
Spotify's free-text search over a string like "Excision B2B Space Laces" can return
loosely-matching or unrelated tracks (anything whose title/artist text fuzzy-matches the
query), which then get pushed into the crew's "Made with Festival Navigator" playlist with
no artist-identity check at all — the exact case F3 says will occur on shipped data.

Severity: P3 (playlist quality nit, not a correctness/data-risk issue — it can only add a
handful of wrong songs, never break the picks/notes data).

**Fix:** when using the free-text fallback, split the combo name (same helper as F3's fix)
and search each artist separately, unioning results — rather than searching the raw combo
string as if it were one artist.

---

## F5 — Not my dimension, but verified in the files I read: "You" still renders BELOW "Crew"

**File:** js/v3/settings.js:666-668, cross-checked against section labels at :400 and :545.

Kevin, this session's brief: *"Let's move 'You' above 'Crew' in the settings."* The render
order in `renderSettings` is:
```js
main.appendChild(festivalsSection(ctx, actions));
main.appendChild(crewSection(ctx, actions));   // microLabel('Crew') — settings.js:400
main.appendChild(youSection(ctx, actions));    // microLabel('You')  — settings.js:545
```
Crew renders before You. This branch (notes-desktop-round) does not contain the reorder
Kevin asked for in this same conversation — it's still the pre-existing order. Flagging
because I read the exact lines while tracing where the Spotify glance card sits (it renders
right after `youSection`, so this section's position also decides where "Spotify" lands
relative to "You").

Severity: P1 (explicit, stated intent from this session, unaddressed on the branch under
review — trivial one-line fix: swap the two `appendChild` calls).

---

## Journeys walked (my dimension)

1. **Connect on a phone** — PKCE, `js/spotify.js:74-96`. Client secret never leaves the
   crew's Spotify app; verifier/challenge/state stashed in `sessionStorage` under
   `fn_spotify_pkce`, consumed once by `completeAuth`. Correct PKCE shape (S256, no secret).
2. **The callback page** — `spotify-callback.html`. Both the success and the `?error=` path
   route back into the app via `pkceReturn`/`returnTo` rather than dead-ending on
   accounts.spotify.com's domain; failures are banked to `sessionStorage.fn_spotify_error`
   and read back by `spotify.lastError()` in the Settings drill (`settings.js:1131,1143`) —
   matches user-flows.md F13's "a failed OAuth shows a recoverable in-app message."
3. **Affinity fetch (liked songs + follows) and its lookup shape** — `scanLibrary`
   (spotify.js:199-281) paginates `/me/tracks` then `/me/following?type=artist`, builds
   `{artists: {lowerName: {songs, followed}}}` plus a capped `trackUris` map for fest-only
   artists. Lookup is case-folded but otherwise exact-string (see F3).
4. **The green pill / glow on cards, and "12 liked songs · following" in the zoom** —
   traced `aura.js:aboutCorner` → `wall.js:renderCard` (resting corner chip) and
   `card-facts.js:factChips`/`factsFor` (zoomed sheet). Both correctly gate on
   `songs > 0 || followed`; "hot" glow correctly requires `followed && songs >= 5`
   (matches user-flows.md F13.4 verbatim). Bookmark icon sits left of "following" in the
   zoomed line, per NOW.md's decision. No dead CSS — `.chip-spotify`, `.spot-glow`,
   `.f-chip.spot`, `.scan-tile`/`.scan-bar` all have live rules in assets/v3.css.
5. **Disconnect** — see F1 (broken promise).
6. **Token expiry mid-fest** — `accessToken()` (spotify.js:137-163) refreshes on expiry;
   only a 400/401/403 refresh failure disconnects (a REJECTED token), a transient 5xx/429
   during the refresh call itself is surfaced as a retryable error without wiping the
   session — matches the documented audit-6.2 intent in the file's own comment, and I
   confirmed the code actually does what the comment claims (no drift here).
7. **Rate limits** — `api()` (spotify.js:166-185) retries up to 5 times honoring
   `Retry-After` on 429, then gives up with a plain-language error. Reasonable.
8. **An artist name that differs from Spotify's** — see F3/F4 (real, grounded gap).
9. **What a crew-mate who never connected sees** — nothing extra and nothing broken: per-card
   affinity is loaded only for `ctx.meName` (`app.js:105`), so the Spotify badge is
   inherently a "your own library" signal, never shown for someone else's connection. This
   matches the copy ("in YOUR Spotify") and isn't a bug — flagging only so it's clear I
   checked it, since a naive reading of "crew-wide affinity object in the doc" could suggest
   cross-member leakage and it does not leak (each person's slice stays keyed to their own
   name and is only read under their own identity).
10. **Identity switch (Settings → You, pick-as) repaints the Spotify badge correctly** —
    `switchIdentity` (app.js:284) → `repaintWall()` → `refreshCtx()` recomputes
    `ctx.affinity` for the newly-active name before the wall re-renders. No stale-identity
    badge bug found.

## Open questions
- Is the one-way affinity ratchet (F2) an intentional design call ("badges are a record of
  what you once listened to, not a live mirror") or an oversight? The code comments never
  say either way — worth Kevin's call before "fixing" it into a destructive re-sync.
- Should F3's combo-name splitting also feed into the crew playlist "everyone" auto-extend
  path (`syncEveryonePlaylists`), or just the badge/glow display? Splitting for playlists
  changes what tracks get added to a shared, already-created playlist — more invasive than
  a read-only badge fix.

## Skeptic

**F1 — CONFIRMED, P1.** Traced `dis.addEventListener` (settings.js:1419) →
`spotify.disconnect()` (spotify.js:65) → `removeLS(LS_AUTH); removeLS(LS_LIBMAP)` only.
Grepped every call site of `disconnect(` in the repo — settings.js:1419 is the only one.
Grepped every call site of `recordAffinity(` — state.js:173 (the writer) and
app.js:1122 (rename migration) are the only two; neither runs on disconnect. Confirmed
the read side has no gate either: `wall.js:130`, `card-facts.js:54` read `ctx.affinity`
directly with no `spotify.isConnected()` check, and `ctx.affinity` is set every
`refreshCtx()` (app.js:105) straight from `state.affinityLookup(ctx.meName)` — a pull
from the synced `crewDoc.affinity`, untouched by disconnect. So the copy's claim ("only
the badges disappear") is false in the strongest sense: they don't even disappear
locally, let alone crew-wide. Reader's severity and fix direction both hold.

**F2 — CONFIRMED, P2.** Read `badgeAllCrewFests` (spotify.js:319–345) and
`applyAffinityToCrew` (spotify.js:441–453) in full. Both build `merged` by spreading the
person's *existing* affinity map and only ever assign fresh hits into it — no artist name
present in `artistNamesOf(fest)` for this pass is ever deleted from `merged` when the scan
comes back empty for it. Confirmed no code path anywhere calls `recordAffinity` with a
map that has had an entry removed. Agree with P2: it's a real, silent one-way ratchet, but
its blast radius is cosmetic (a stale "hot" glow / stale song count survives an unfollow),
not a data-integrity or privacy problem — P2 is right, not higher.

**F3 — CONFIRMED, P2.** Verified both halves independently. (a) `affinityOf`
(spotify.js:350) does exactly one op: `lib.artists[artistName.toLowerCase()]` — no
splitting, no normalization beyond case. (b) Read `scanLibrary` (spotify.js:199–210):
`lib.artists` is keyed from `item.track.artists[].name` — Spotify's own API returns each
b2b co-headliner as a **separate** artist object on a track, so the *scanned* library can
never contain a compound key like "beltran b2b ben sterling" in the first place — only
"beltran" and "ben sterling" individually. That makes the miss not just plausible but
structurally guaranteed for every combo slot. Cross-checked the reader's grounding
directly: `grep -n "b2b\|B2B" data/festivals/*.json` turned up the same portola-2026.json
and seismic-9.json hits, plus more the reader didn't cite (edc-orlando-2026.json has at
least 8 B2B slots, lost-lands-2026.json and electric-forest-2026.json one each). Real,
grounded, and probably worse in raw count than the reader's citation suggested. P2 is
fair — it's a missed-badge bug, not data corruption, but it likely affects a meaningful
fraction of EDM lineup slots (double digits on some of these lineups), which nudges it
toward the upper end of P2 rather than the low end.

**F4 — CONFIRMED, P3.** Read `findTrackUris` (spotify.js:472–495) in full. Confirmed:
when the artist-filtered `hits` array is empty (guaranteed for every F3 combo name), `top`
falls through to the raw `search.tracks.items` with zero identity filtering, and those
URIs get pushed into `uris`/`combined` and ultimately into the shared/collaborative
playlist via `pushTracks`. Agree this is a real downstream consequence of F3, correctly
scoped as P3 (playlist quality, not correctness of picks/notes data) since it only fires
on names that already fail F3, and only degrades an opt-in curated playlist rather than
mutating any of the sync-critical crew doc.

**F5 — PLAUSIBLE, but re-scope severity.** The code fact is exactly as stated: verified
`main.appendChild(festivalsSection...)`, `crewSection...`, `youSection...` in that literal
order at settings.js:666–668, and confirmed `crewSection`'s `microLabel('Crew')`
(settings.js:400) sits above `youSection`'s `microLabel('You')` (settings.js:545) in
source too, so it isn't a CSS-reorder situation — the DOM order is the render order. What
I can't confirm from the repo is the load-bearing part of the finding: "Kevin's explicit
ask this session." I have no visibility into anything outside these files, so I can't
verify that instruction existed. Taking the code fact alone, with no confirmed explicit
request behind it, this is a pure information-architecture preference with zero functional
impact (nothing reads or depends on section order) — that alone would be P3, not P1. If
the explicit-ask premise is true, P1 is Kevin's call to make (an unshipped explicit request
sitting live in front of every user for one more review cycle is a legitimate P1), but the
severity should be conditioned on confirming that request happened, not asserted as a
Spotify-dimension P1 on the strength of the code alone. Also worth naming plainly: this
finding has nothing to do with Spotify, tools, or the green pill — it rode in on a
Spotify-dimension survey because the author noticed it while reading adjacent code, and
that's a fine catch, but it's mis-severity'd if evaluated as if it belonged to this
dimension's stakes.

### Missed — real issues not in the reader's list

**M1. A reused/renamed name inherits the PREVIOUS holder's Spotify badge — this is the
worse sibling of F2 and reaches the reader's own "no cross-member leakage" journey.**
`renameSelf` (app.js:1094–1129) migrates affinity forward — `state.affinityFor(old)` then
`state.recordAffinity(newName, aff)` (app.js:1121–1122) — but never clears
`crewDoc.affinity[old]`. The old name is tombstoned in `people` (`removed: true`) but the
`affinity` map is a *separate* top-level object keyed purely by name string with no
`removed` awareness (confirmed: `state.affinityFor` at state.js:97 is a bare
`(crewDoc.affinity || {})[person] || null`, no cross-check against `people[person].removed`).
Confirmed via `tests/db-merge.test.mjs:223` ("a removed member frees their name for
re-use in another case") that a tombstoned name is explicitly designed to be reusable —
by a genuinely different physical person, not just the same person renaming back. So the
sequence: Person A connects Spotify, gets badged, later renames to a new name (or leaves
and is removed) → the old name is now free → a completely different Person B joins the
crew and claims that exact name (case-insensitive match, so even an unrelated new member
typing a common name like "Alex" could collide with a long-gone "alex") → Person B's cards
instantly show Person A's stale liked-song counts and "following" glow, attributed to
Person B, without Person B ever touching Spotify. This is a real cross-person data leak
(misattributed listening history), which is a strictly worse case than F2's same-person
staleness and directly contradicts the reader's verified "no cross-member badge leakage"
journey — that journey held for the *simultaneous* case (a never-connected crew-mate sees
nothing extra) but not for the *sequential* reuse case. Suggest P2, same family as F2 but
worth flagging separately since the fix is different: clearing/tombstoning
`crewDoc.affinity[old]` at both `renameSelf` and at removal, not just de-duplicating a
live scan.

**M2. `runFullSync`'s mid-scan guard protects against a crew switch but not an identity
rename within the same crew.** `tokenAtStart`/`meAtStart` are captured once
(settings.js:1031–1032) and compared only via `state.getCrewToken() !== tokenAtStart`
(settings.js:1037) before writing `recordSpotifyStats(meAtStart, ...)` and
`badgeAllCrewFests(meAtStart)`. A rename via `renameSelf` mid-scan (same crew, several
minutes into a large library scan) leaves `ctx.meName` pointing at the new name while the
scan still finishes and writes stats/affinity under `meAtStart` — the just-tombstoned old
name. Narrow window (requires opening Settings → You mid-scan), so I'm not assigning it a
severity above P3, but it's the same class of bug the file's own comments show the team is
alert to for the crew-switch case, and the guard is one line short of covering the sibling
case.

**Nothing else load-bearing found.** Re-walked token expiry (spotify.js:132–163), 429
handling (spotify.js:166–185), and the "crew-mate who never connected" journey myself;
all matched the reader's account and I found no additional defect in those three.
