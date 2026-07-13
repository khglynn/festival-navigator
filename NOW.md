# NOW — festival-navigator: v3.1 PROMOTED + Spotify polish live (v29)

## 2026-07-13 — PROMOTED TO PRODUCTION + Spotify live-tested + polish shipped

- **v31-polish merged to main** (Kevin's go): prod went v14 → v28 → v29 on all
  three domains, verified by served CACHE_VERSION each time. 145/146 tests.
- **Spotify OAuth verified LIVE end to end** — Kevin registered the redirect
  URI, connected, scanned 6,180 artists, EF badged 38. The one flow no session
  could verify is now proven on production.
- **Polish batch (Kevin's first-connect feedback, all shipped same day):**
  scan ticker (real counter + bar + album covers, fest-find highlights, wall
  pill when you leave the drill, reduced-motion safe) · playlist card rebuilt
  (name-first input, inline progress/success/errors, Open-in-Spotify link —
  its old status line rendered BELOW the Advanced fold, invisible) ·
  Everyone-playlists are collaborative + recorded in crew doc
  (spotify.playlists, validated; later-connecting members auto-join their
  picks; "Add new picks" top-up) · affinity glow (followed + 5+ songs = green
  corner mini-aura; followed-only artists now chip at all) · spotifyStats
  write restored (dropped in the 07-12 rebuild).
- **Dead BLOB_READ_WRITE_TOKEN removed** from all three Vercel envs.
- **UNVERIFIED, next live test:** the collaborative auto-join path needs a
  SECOND member's account (Spotify dev-mode may refuse cross-user adds even
  on collab playlists — the drill reports and offers retry if so). Also the
  "Electric Forest 26"/"Portola 26" crews are Kevin's own (with Ross) — keep.
- **Still Kevin's call:** The Crew token rotation (public git history) ·
  refresh-after-back sign-off · dev-mode 5-user allowlist vs The Crew's 6
  members · rotate the screenshotted client secret.

## SPOTIFY FLOW REBUILD (2026-07-12 — superseded by the above; kept for context)

Kevin's live screenshots showed the Spotify connect flow was broken end to end:
OAuth `redirect_uri: Not matching configuration`, a two-step hop with a second
"Connect" button on a sparse page showing raw plumbing (`CREW APP · ...d26734`),
and the gear icon stranded alone on the far left under Lost Lands' long date
string. His model — "connect once, all my fests fill in; add a fest later and
Spotify should just pull" — was correct; the app didn't do that.

**Shipped and verified:**
- **Gear pin fix** (`index.html`): the header wraps on long date strings, and a
  `≥720px` rule was stripping the gear's `margin-left: auto`, parking it far-left
  alone. Now `order: 3; flex: none`, pinned right at every width. **Verified live
  on staging on Lost Lands itself** — the exact festival from Kevin's screenshot.
- **One-press connect** (`js/spotify.js` `canonicalHopUrl({autoConnect})`,
  `js/v3/app.js` boot): the hop to `fest.kevinhg.com` now carries `sp=connect`
  and auto-continues on arrival — no second "Connect" button on a second screen.
- **Badge every festival, one write** (`js/spotify.js` `badgeAllCrewFests`,
  `artistNamesOf`): connecting reads the library once and badges every festival
  the crew has, in a single `recordAffinity` call — not the one-fest-at-a-time
  "Open other fests to badge them too" chore it was. A festival added later
  self-badges via the existing `switchFestival` path (now calling the same
  shared `artistNamesOf`), no reconnect needed.
- **Drill rebuilt** (`js/v3/settings.js`): every not-yet-connected state now
  shares one `connectCard` that says what connecting does; the raw client-ID row
  moved behind an "Advanced" fold (also holds the exact redirect URI string for
  whoever owns the app); the connected state shows a per-festival badge count
  instead of telling you to go do more work.
- **5 new unit tests** (`tests/spotify-flow.test.mjs`) prove: badging reaches a
  NON-active festival, a newly-added festival self-badges from the cached
  library, badging one fest never wipes another's badges, the whole sweep is one
  write not N, and the hop URL carries `sp=connect` + the crew token.
- Full suite: 141 passing + 1 correctly skipped (Neon-only concurrency test).
  Fork/BYO drill path (the only one exercisable on staging — see below) visually
  confirmed clean, no naked client-ID plumbing outside the fold.

**NOT verified — could not be, not skipped by choice:**
- The main "Connect my Spotify" 3-door flow (owner app / request access / BYO)
  is what Kevin will actually hit in production, but **staging has no Spotify
  env vars** (`SLACK_WEBHOOK_URL` etc. are Production-only — confirmed earlier
  this session), so that exact card only renders on `fest.kevinhg.com`. And the
  real OAuth round-trip needs Kevin's own Spotify login, which nothing here can
  simulate. Code-reviewed + unit-tested, not eyeballed live.
- **The one thing that was never a code bug**: `redirect_uri: Not matching
  configuration` is Spotify refusing because `https://fest.kevinhg.com/spotify-callback`
  isn't registered in the app's dashboard. That's a field only Kevin can edit —
  see "KEVIN ACTIONS QUEUED" below, unchanged from earlier in this session.

**If Kevin hits anything else in the Spotify flow**: the natural next move is a
Codex pass on `js/spotify.js` + the `openSpotifyDrill` function in
`js/v3/settings.js` specifically, since that's the one surface this session
could not fully browser-verify.

## CURRENT STATE (2026-07-12, late)

The finish pass ran and is **complete**. A 12-agent audit (6 browser walkers
across every surface at 390 and 1440, 6 code/test/doc dimensions) produced **86
findings**; everything that mattered is fixed, tested, deployed to staging, and
verified in a real browser. Tests **95 → 131**. Branch `v31-polish`, live at
https://stage.fest.kevinhg.com (SW v25).

**The honest headline:** almost nothing here was crashing. Nearly everything
found was the app *quietly saying something untrue* — or quietly losing a tap.

### The four ways a pick could vanish (all closed)
1. `saveLS()` swallowed every localStorage failure with a `console.warn`. A full
   or private-mode store meant the edit lived only in memory, and the push is
   debounced 1.2s behind it. Lock the phone in that window — the single most
   ordinary thing anyone does at a festival — and the pick was gone, with nothing
   on screen ever having said so.
2. That 1.2s debounce was itself a grave: a backgrounded tab gets reaped and an
   in-flight `fetch()` dies with it. `sync.flushOnHide()` now beacons pending
   picks out on pagehide — the one send the browser promises to finish.
3. A 400/413 **permanently poisoned the pending queue**. The code comment claimed
   "the retry loop stops"; it did not — `pollSync` re-armed it every 25s, forever
   re-POSTing the same doomed payload and blocking every *other* edit on that
   device behind it. It now remembers the refused payload and waits for a new one.
4. `clearPending()` blind-wrote `'{}'`, erasing a second tab's un-pushed edits —
   re-opening on the clear path the exact race `persistPending()` had been fixed
   to close.

Plus: two members named "Drew" and "drew" forked into two permanent identities,
splitting their picks down the middle. Now refused *in the merge* — the only
place both concurrent writes are visible.

### The thing that should have scared us most
`jsonb_deep_merge` — the SQL function every concurrency guarantee in this app
rests on — **was executed by zero tests.** "6 of 6 concurrent merges survive" had
been a comment, not a fact, since July. The SQL now lives in
`api/_lib/crew-sql.mjs` and `tests/db-merge.test.mjs` runs *those exact bytes*
against real Postgres (PGlite — in-process, no server, no secrets, runs in CI).
The 6-of-6 claim is now **proven**, along with arrays-are-replaced-wholesale
(which is *why* notes must be keyed objects) and every WHERE-clause invariant.

### Calibration worth keeping
An agent claimed the 256KB doc cap was "structurally guaranteed" to be hit. I
checked the live store: the busiest **real** crew is 1,643 bytes — **0.6% of the
cap**. The failure mode was real; the stated cause was not. No compaction was
built. (Verify before building on a claim, including an agent's.)

### The Codex gate (independent review, after all of the above)

It found two P1s and a P2 — and its best finding was aimed at the test I was
proudest of. Full write-up: `claude-plans/2026-07-12-codex-finish-gate.md`.

- **My touch-target fix could have armed "Forget this crew."** Settings rows stack
  with no gaps, so a universal `button::after { inset: -15px }` grew every row's
  hit area 15px into its neighbours — and the later-painted sibling wins. A tap
  near the bottom of "Switch crew" could hit the destructive Forget. Fixed by
  inverting the default: real `min-height: 44px` (which cannot overlap) unless a
  control opts out, and borrowed space only for small controls with room around
  them. **Verified in-browser: zero overlaps across all 31 Settings controls.**
- **A sync block never lifted.** The toast promises "they'll sync as soon as the
  crew has room" — but nothing retried unchanged pending bytes, so if another
  member DID free up room, that phone stayed stuck. A poll that sees a changed
  remote document now clears the refusal. (It also leaked across crews. It no
  longer does.)
- **My concurrency test was a rubber stamp.** Codex *proved* it: it swapped in the
  banned pre-lock CTE — the shape that lost 2/6 writes in production — reran my
  six-way `Promise.all` for 50 rounds, and lost zero writes. PGlite is a single
  connection; `Promise.all` just serialises. `tests/db-concurrency.test.mjs` is
  the real one (Neon, independent sessions, 8/8 survive) and it carries a
  **control** asserting the banned CTE *does* lose writes — so we know the harness
  can see a lost write instead of trusting another green tick.

And one P0 I found in my own new code before Codex did: `subtractLeaves` recursed
into note objects, so editing a note mid-push sent back a `{text}` fragment
without `author`/`ts` — which the server rejects, which the new refusal guard then
turns into a permanently blocked device. Notes travel whole now.

## ⚠️ KEVIN'S CALL

1. **Promote to production.** Walk staging first:
   `https://stage.fest.kevinhg.com` — then
   `git checkout main && git merge v31-polish && git push`
   (Vercel auto-deploys main; SW v25 force-refreshes every installed client.)
2. **Spotify dashboard (still queued, unchanged):** add redirect URI
   `https://fest.kevinhg.com/spotify-callback` to the MCP HG app at
   developer.spotify.com/dashboard. The code side is done — every non-canonical
   host now hops to fest.kevinhg.com, so this one URI covers staging too.
   Note the Feb-2026 rules: dev-mode apps are capped at **5 authorized users**,
   **one dev-mode app per developer**, owner needs Premium.
3. **`BLOB_READ_WRITE_TOKEN` is live in all three Vercel environments and read by
   zero lines of code.** Vercel Blob is banned here. It is a dead write
   credential — say the word and I will remove it.
4. **The Crew's token rotation** — still pending from the 2026-07-09 NOW.md leak.
   Unrelated to this arc; your call.
5. **Refresh-after-back** — after "‹ back to fest list", a hard refresh on the
   bare URL cold-start-resumes the crew you just left. Codex called it
   design-coherent (PWA resume philosophy) and wants your sign-off.
6. **Two crews in the store I did not create and did not touch:** "Electric Forest
   26" (2 people) and a second "Portola 26" (2 people), both from ~19:30 today —
   before this session started. They look like test crews from the earlier arc,
   but they are not mine to delete. Say the word and they go. (Everything I DID
   create — the audit rig and two crews the walkers made — is deleted. No real
   crew was ever written to.)

## Deliberately NOT done (and why)

- **Splitting app.js / settings.js.** They are 1,272 and 1,032 lines. The audit's
  own verdict was that file length is not the real pain — one 184-line, 6-branch
  Spotify state machine is — and a split at ship time trades a legibility problem
  for a circular-import problem. The duplicated *components* (festRow, sheet
  chrome) were extracted instead, which is where the actual bugs lived.
- **Doc compaction.** See the calibration above: 0.6% of cap.
- **Wiring Spotify env vars into staging.** `enabled()` needs all four, and a
  test there would fire a real Slack message at you. Production has them; the
  fork-deployment fallback (BYO client ID only) is what staging correctly shows.

## Standing facts

- Rig crew for this audit: **deleted at teardown** (see DEVLOG). Real crews were
  never written to.
- The service worker will serve you a STALE app after a deploy — unregister it
  and delete its caches before believing any browser check. Cost me a full round
  of "the fix didn't work" today.
- Token scans GATE commits (`&&`, never `;`). `.gitignore` now denies `*.png` by
  default — a walker run dumped 50 screenshots into the repo root.

**Updated:** 2026-07-12 late · **Branch:** `v31-polish` (pushed) ·
**History:** DEVLOG.md · **Rubric:** `claude-plans/2026-07-12-taste-rubric.md`
