# DEVLOG — festival-navigator

Newest first. One entry per meaningful unit of work.

## 2026-07-12 (late) — THE FINISH PASS: 86 findings, and what they were really about

A 12-agent audit against the taste rubric: 6 browser walkers (every surface at
390 and 1440, driving a seeded rig crew with deliberately messy data — 5 members
incl. a tombstone, picks at every level, notes at all three scopes) plus 6
code/test/doc dimensions. 86 findings, zero agent failures, 2.7M tokens.

**The pattern:** almost nothing was crashing. Nearly everything was the app
quietly saying something untrue, or quietly losing a tap. That is exactly the
class of bug a green test suite cannot see, and it is why the suite was green.

### Data loss (the only bug that really matters here)
- `saveLS()` swallowed every localStorage failure with a `console.warn`. Quota
  exceeded or private mode → the edit lives only in memory, and the push is 1.2s
  behind it. Lock the phone in that window and the pick is gone, silently. It
  reports now.
- The 1.2s debounce was a grave for a backgrounded tab. `flushOnHide()` beacons
  pending picks on pagehide; we keep pending afterwards (a beacon's reply is
  unreadable) and re-send next boot — safe precisely because the merge is
  idempotent. Sending twice is free; not sending once loses a pick.
- **A 400/413 permanently poisoned the pending queue.** The comment in sync.js
  said "the retry loop stops". It did not: `pollSync` saw `hasPending()` and
  re-armed `scheduleSync()` every 25s, re-POSTing the same doomed payload
  forever and blocking every *other* edit on that device behind it. We now
  remember the exact refused payload, stop asking, and let any NEW edit earn a
  fresh attempt — so there is no dead end to escape. New `blocked` sync state.
- `clearPending()` blind-wrote `'{}'`, re-opening on the clear path the exact
  last-writer-wins race `persistPending()` had been fixed to close. It now
  subtracts only the ACKED leaves, from memory and disk both.
- "Drew" and "drew" forked into two permanent identities. Each client checked
  for it against its own in-memory doc, which cannot see the other phone joining
  in the same breath. The invariant moved to the merge — the only place both
  writes are visible. Checked the live store FIRST: no existing crew holds such a
  pair, or the rule would have bricked every future write to it.

### The SQL was never tested
`jsonb_deep_merge` — the function every concurrency guarantee rests on — was
executed by ZERO tests. "6 of 6 concurrent merges survive" had been a comment,
not a fact, since July, and the suite tested a JS "reference twin" whose own
comments admit it is not what production enforces. The statements moved to
`api/_lib/crew-sql.mjs`; `tests/db-merge.test.mjs` runs **those exact bytes**
against real Postgres via **PGlite** (in-process, no server, no secrets, runs in
CI). 6-of-6 now proven. So is arrays-are-replaced-wholesale — which is *why*
notes must be keyed objects — and every WHERE-clause invariant.
Verified `sql.query()` returns rows the same shape as the tagged template, and
that both statements plan against the real production schema, before shipping the
call-shape change.

### Calibration: don't build on an agent's claim either
An agent called the 256KB doc cap "structurally guaranteed" to be hit and
recommended a compaction subsystem. Queried the live store: the busiest real crew
is **1,643 bytes — 0.6% of cap**. The failure mode was real; the stated cause was
not. No compaction built. Taking it on faith would have meant real complexity and
real risk, at ship time, to solve a problem 0.6% of the way to existing.

### The lies (rubric 8)
Archived-fest banner froze on the *first* archived fest's name (`if (existing)
return`) — the screen calmly saying Electric Forest while showing Lollapalooza.
The day-tab scrollspy watched a 10%-band and any big scroll cleared it in one go,
so the tab said Thursday while you stood in Sunday. Export promised "paste-ready
for Bulk paste" while emitting removed members' picks that Bulk paste refuses.
Search survived a fest switch → "No artists match" over a full lineup. The sync
dot painted `error` gray while the Settings label painted it red.

### The touch floor was a list nobody edits
Three walkers found it in three places, which is the tell it was never three
bugs. The 44px rule NAMED six selectors — and the naming was the bug: every
control added since (chips 26px, "+ ✎" 17px, all of Settings, the whole desktop
day rail) got nothing. It applies to `button` now, so new controls inherit it by
being what they are. Tuned against real geometry afterwards: -5px horizontal made
neighbouring chips (5px apart) overlap across the whole gap — a tap swallowed by
the wrong person's chip is worse than the small target it fixed.

### Docs that cannot lie
The README described an app that had not existed for two releases: a deleted
`js/render/`, an `npm run css` Tailwind step for a framework v3 dropped, removed
API endpoints, the pre-v3 pick vocabulary. `VERCEL_SETUP.md` was a confident
setup guide for **Vercel Blob** — the backend we BANNED for losing writes ("Vercel
Blob is perfect!" it said). Deleted. The durable half is
`tests/docs-truth.test.mjs`: paths must exist, no doc may name an npm script that
does not exist, no doc may present Tailwind/Blob as current, and the festival list
lives ONLY in index.json. All six failed against the docs as they were.

`.gitignore` claimed to ignore `.claude/` while git tracked seven files inside it
— a rule that read as protection while providing none. Codex reviews moved to
`claude-plans/codex-reviews/`; `*.png` now denied by default (a walker run dumped
50 screenshots into the repo root, and audit artifacts can carry crew tokens).

### The Codex gate found two P1s — and shot down my best test
Full write-up: `claude-plans/2026-07-12-codex-finish-gate.md`.

- **The touch-target fix was a hazard.** Settings rows stack with no gaps, so a
  universal `button::after { inset: -15px }` grew every row's hit area 15px into
  its neighbours, and the later-painted sibling wins an overlap. A tap near the
  bottom of "Switch crew" could arm the destructive "Forget this crew". A touch
  fix that hands you a destructive mis-tap is not a fix. Default inverted: real
  `min-height: 44px` (cannot overlap) unless a control opts out; borrowed space
  only where there is room. Verified in-browser — zero overlaps, 31 controls.
- **The sync block never lifted.** The toast promised "they'll sync as soon as the
  crew has room" and nothing ever retried unchanged pending bytes, so a phone
  stayed stuck even after another member freed up room. The app was making a
  promise it had no mechanism to keep. A poll seeing a CHANGED remote doc now
  clears the refusal (bounded: one retry per real change).
- **My concurrency test was a rubber stamp, and Codex proved it empirically** — it
  swapped in the banned pre-lock CTE, reran the six-way Promise.all 50 times, and
  lost zero writes. PGlite is one connection; Promise.all serialises. The real
  test (`tests/db-concurrency.test.mjs`) uses Neon's HTTP driver — one independent
  session per request — and carries a CONTROL asserting the banned CTE *does* lose
  writes there, so the harness is provably able to see a lost write. Without that
  control we would just be trusting a green tick a second time.

And one P0 I caught in my own new code before Codex got to it: `subtractLeaves`
recursed into note objects, so editing a note mid-push sent back `{text}` with no
author/ts — which the server rejects, which the brand-new refusal guard then turns
into a permanently blocked device. Two correct-looking fixes combining into
something worse than either solved. Notes travel whole now.

### Three lessons for next time
1. **The service worker lies to you after a deploy.** Every fix read as "not
   applied" in the browser while `curl | md5` proved the server had the new bytes:
   the old SW was serving its stale cache. It fooled me twice. Unregister +
   `caches.delete()` before believing any browser check.
2. **Green tests are necessary, not sufficient.** The focus-restore fix was
   complete and correct across three files, all tests passed — and it was still
   broken live, because `closeSheet()` nulled the opener it had just been handed.
   jsdom has no real focus model to break. Only the actual browser found it.
3. **A test you cannot fail is a test you cannot trust.** Two of the best things
   here came from proving a test could FAIL: reverting a fix to watch its
   regression test go red, and the CTE control that proves the concurrency harness
   can see a lost write. A green tick is evidence of nothing until you have seen
   it go red for the right reason.

Tests 95 → 136 (+1 skipped in CI: the Neon concurrency test). Rig crew and both
walker-created crews deleted at teardown; no real crew was ever written to.

## 2026-07-12 (evening) — round-2 review + copy pass + finish-pass approved

- Kevin's staging review round: cells re-centered (safe-center keeps the
  clip-proof fallback), person chips switch identity via two-tap confirm
  (pick for who you just added, no settings trip), canonicalHopUrl inverted
  from allowlist to hop-everything-but-canonical (staging OAuth sent Spotify
  a stage redirect URI), one disclosureFold for past fests both places,
  fest-notes strip removed (Notes chip owns it), eq-loader wait states,
  near-opaque sticky chrome, resize re-mirrors the timetable scrollers.
- Spotify Feb-2026 policy landed in the model: 5 authorized users, ONE
  dev-mode app per account, Premium required, endpoint cuts postponed for
  existing apps. The in-app own-app guide (spotifyAppSteps) now teaches the
  real flow incl. User Management; NO staging redirect URI needed by design.
  Kevin's one dashboard task: add fest.kevinhg.com/spotify-callback to MCP HG.
- Copy pass (Opus teammate): full string inventory, zero lying strings,
  "genuinely close" verdict. Tier-1 applied (Export/Bulk paste PICKS —
  vocabulary rule; flavored indeterminate waits; one "How it works") +
  Kevin approved; "Rescan my Spotify" + 404 "YOUR FESTIVALS" applied as
  recommendations; manifest "plan" + Portola example deliberately kept.
- Taste rubric written and APPROVED (claude-plans/2026-07-12-taste-rubric.md)
  — the finish pass closes every surface against it; that arc is next.

## 2026-07-12 — Kevin's notes arc: all 8 notes + sweep, staging born, memory explainer

- **Staging is live: https://stage.fest.kevinhg.com** — its own Vercel
  project (`festival-navigator-staging`) whose PRODUCTION branch is
  v31-polish, so the URL is public (Standard Protection exempts production
  custom domains) while the main project's preview protection stays intact.
  Only v31-polish builds there (ignore-command); Cloudflare A record,
  unproxied. Discovered on the way: custom domains on preview branches AND
  custom environments stay SSO-protected; the per-env `deploymentProtection:
  "disabled"` field stores but the edge ignores it (add-on-gated). The
  dedicated-project pattern is the reliable public-staging recipe.
- **Clear-eyed sweep** (5 Sonnet lenses + adversarial verify + main-loop
  synthesis after the Opus agent hit a schema retry cap; results recovered
  from the workflow journal): honest verdict + findings in
  claude-plans/2026-07-12-v31-sweep-findings.md. Lens grades B-/B-/B-/B-/C+;
  model layer elegant, screen-assembly layer frayed, timetable was the C+.
- **All 8 of Kevin's notes shipped in 5 clusters** (each committed + tested +
  staged): (A) canonical cross-day stage columns + ONE sticky stage strip +
  mirrored horizontal scroll; lane splits contained by border-box; clipped
  names killed (real cause: flex-shrink squeezing the name box — measured
  live); day-rail unified with the dock (avatar + fest name + sync dot).
  (B) back-button truth (bootTokenFor: resume only on cold start), heading ‹
  to the fest list, add-member-on-their-behalf with personal &me= claim
  links + case-insensitive claiming (Drew scenario verified end-to-end on
  staging). (C) sync hardening: 413/400 stop retrying + speak, pushGen kills
  the stale-poll rollback, create-path caps, Slack mrkdwn escape, two-tab
  pending merge; dead artist-info.js deleted. (D) Spotify three-door access
  model (owner app from /api/access?config=1 = main path; request-access
  door; BYO in a fold — api/access.js was already the recordOS-style
  backend), fest-notes strip at the wall top, past-fests weight rebalance.
  (E) legibility per the ground-it guide: util.js became the real shared
  home (5 hand-rolled LS pairs consolidated, unguarded writes fixed),
  el/subviewHead shared, legacy parseBulkLine deleted, comment lies fixed.
- Codex arc gate caught a real P1: the 2-row readability floor could stack
  two time-disjoint short sets — lane math now runs on display extents
  (regression test added).
- Tests 89 → 95. SW v16 → v19. Memory explainer published as a Claude
  artifact (the link/device/cloud story, built in the app's own tokens).
- Browser-walk gotchas banked: the Playwright MCP's evaluate runs in an
  isolated world (page fetch stubs need browser_run_code_unsafe +
  page.evaluate), goto to the same URL+hash is a same-document navigation
  (modules keep state — go via about:blank to truly reload), and SW-origin
  requests bypass page.route.

## 2026-07-12 — Stage-4 audit re-run PASSED + full response pass

- The gate's proof landed: 71-agent re-run (3 viewport walkers + offline
  prober + code finders → review lenses → adversarial verify) against the
  cc37d7d preview found **0 P0 and ZERO of the 73 discovery findings** —
  whack-a-mole broken. 42 new findings (4 P1 / 10 P2 / 28 P3), full list +
  disposition: claude-plans/2026-07-12-v31-stage4-audit-backlog.md.
- Response pass (this session): the repaint boundary now preserves ephemeral
  state — timetable scrollLeft per day, composer drafts (value+focus+caret),
  keyboard focus through card refresh — so a crew member's sync can never
  yank your scroll or eat your half-typed note; scrollspy only observes real
  day headers, defaults to day one, and carries aria-current; sort popover
  clamps to the viewport; OAuth returns land back IN the drill with the
  banked error shown; transient Spotify 5xx no longer nukes valid sessions;
  card accessible names carry crew picks/notes/Spotify; archived disclosure
  is a real button; asymmetric timetable bleed fills wide windows; join gets
  the wordmark; misses/sources/plurals/copy all report honestly; data +
  validator + docs hygiene (Lolla dayMeta, dead fields dropped, activities
  time format enforced, stages[] doc corrected).
- Three infra lessons banked to memory the hard way: workflow args can
  arrive as a JSON string (script now fails fast), Vercel share links die on
  every new deployment (mint after the last push), and preview needed
  DATABASE_URL added to its env scope.
- Deliberate non-fixes flagged for Kevin in the banked backlog: settings
  column width (atlas says 560 on purpose), entry-screen composition, saved-
  fest provenance surface.

## 2026-07-12 — Codex ship gate: fix-first verdict, all 7 findings addressed

- Verdict was 0 P1 / 4 P2 / 3 P3 (clean on data-loss, cross-crew writes, XSS,
  SW core list, OAuth leakage). Fixed: renameSelf now TOMBSTONES the old
  name's picks (Export Likes ghosts + reused-name double-render); rename
  blocks previously-used names entirely (merge can't delete tombstones);
  Spotify setup is open to any member — "lead" is copy flavor, never a gate
  (the first-position heuristic broke when the founder renamed themselves);
  sort control's first arrow press opens without advancing, and the popover
  closes on focusout; join-with-a-formerly-removed-name resurrects explicitly
  (removed:false) instead of entering invisible; wall.js tidies.
- DELIBERATE non-fix (Codex P2-4): switchCrew/leaveCrew leave stale history
  entries; Back after leaving re-opens that crew's link (the join screen).
  That's coherent capability-model behavior (back = reopen the link), and the
  "real" fix needs async history collapse with worse failure modes. Instead
  the router's reconcile is hardened: every layer open/close is individually
  guarded, so a stale key from any old entry can never crash the app.
- Audit re-run infra: preview env lacked DATABASE_URL (the NOW.md standing
  fact, finally connected) — added to Preview scope; server 500s no longer
  render as "you're offline" (13ef1ce). Workflow args once arrived as a JSON
  string (walkers got literal "undefined" prompts) — the rerun script now
  parses string args and FAILS FAST on missing values.

## 2026-07-12 (early) — PWA/SYNC honesty + first-run content

- **PS-3/4/5**: the dot goes gray the instant the radio does (offline event);
  every sync fetch carries a 20s AbortSignal timeout so a hung request can
  never jam isSyncing forever; sync state is ONE observable (sync.syncState())
  — the settings label reads it instead of recomputing from hasPending (which
  lied offline) and shows synced/syncing/offline/sync-error honestly.
- **PS-6**: every hot-path localStorage write in state.js + crew.js goes
  through a quota-guarded saveLS — a full store degrades to memory-only +
  console warning, never a throw mid-tap.
- **PS-7**: manifest orientation lock dropped (landscape timetable reading is
  legit); theme/background colors corrected to the v3 --page (#0C0A14 — they
  still carried the pre-v3 gray).
- **CT-1**: one-time dismissible coach mark on the first wall (pick mechanic +
  long-press + a link into How-it-works). CT-2: research preview shows the
  FULL lineup behind a review fold, source hostnames only when real (no more
  "0 sources"), discard clears state and refocuses, error copy stops promising
  a manual path that doesn't exist. CT-3: empty-state sweep.
- (PS-1/PS-2 shipped with the Spotify commit — same SW file.)

## 2026-07-12 (early) — SPOTIFY: five states, one OAuth origin, honest SW

- **The drill is a state machine now (SPOT-2)**: five explicit states, each
  one sentence + one action. Not-set-up members are pointed at the likely
  crew lead; the lead gets the one-time setup with a how-to fold (redirect
  URI + dev-mode limits); ready state explains what's read and what's never
  posted; connected state keeps stats/refresh/playlist/disconnect; failures
  land IN the app with the reason and a retry — spotify-callback.html banks
  the error and bounces home instead of dead-ending (state 5).
- **One OAuth origin (SPOT-1)**: PKCE runs only on fest.kevinhg.com; the prod
  aliases show "Continue on fest.kevinhg.com" which hops WITH crew + fest +
  an sp=1 flag that reopens the drill after landing (sessionStorage is
  per-origin — the dance can't span hosts). ⚠️ Kevin action queued in NOW.md:
  register https://fest.kevinhg.com/spotify-callback in the Spotify dashboard.
- **Config is correctable (SPOT-3)**: the crew app row shows the masked id
  with Change + two-tap Clear in both ready and connected states.
- **SW honesty (SPOT-4 + PS-1/PS-2, pulled forward)**: cross-origin requests
  are no longer touched (cache-first api.spotify.com made every re-scan one
  scan stale); core shell install is ATOMIC (addAll — no more offline-ready
  claims over a half-cached shell); navigations are network-first with cache
  fallback so a stale shell can't pin. v14 → v15.
- **Badges follow the library, not the fest (SPOT-5)**: applyAffinity MERGES
  (a per-fest apply used to wipe other fests' badges locally) and fest
  switches auto-badge from the cached scan — no rescan. Playlists keep the
  UI's one-track-per-artist promise (SPOT-7). SPOT-6 (access requests)
  consciously parked — dashboard allowlisting is Kevin's fast-follow.

## 2026-07-12 (early) — NOTES + SET-TIMES: the experience classes

- **Notes**: one scope sheet serves artists AND days (NT-2 — day headers carry
  a ✎ chip with count); notes are editable and deletable through the tombstone
  model (edit keeps id+ts so order holds; the server's id-prefix rule already
  means only your own) (NT-3); pins work in every surface (NT-4); sheets get a
  real close ✕ and the grabber actually swipes down to close (NT-5). The
  all-notes view is the notes HOME (NT-1): festival composer first — present
  even (especially) in the empty state.
- **Set-times**: the below-grid activity list died — activities and any set
  with an unknown stage (previously silently DROPPED) live in one neutral
  "EVERYTHING ELSE" column, chronological (ST-2). Day rules show real dates
  from dayMeta (ST-4). Archived fests carry a memory banner (ST-5).
- **Weekends (ST-3)**: fests with W1/W2 artists get a Weekend view (Both/One/
  Two, persisted per fest per device); W1/W2-only artists carry a quiet tag in
  Both view so a wrong-weekend must can't sneak in. Verified live on ACL.
- **Data honesty (ST-6)**: Lolla '25 got its year + dates back (file + index);
  the validator now warns on archived fests missing either, and on combined
  day strings that won't split (comma dropped from the separator set — commas
  live inside single-day labels like Lost Lands' pre-party days).

## 2026-07-11 (night) — FLOWS 5–13: joins that can't strand, settings with two doors

- **FLOW-5**: js/name-rules.mjs is now the ONE name rule — client forms and
  the server validator import the same module (drift impossible; parity test
  probes 17 names incl. the classic O'Brien). Join's first write happens
  BEFORE entry: the server's answer reaches the joiner as form copy, never as
  a forever-gray sync dot; offline falls back to local-first join.
- **FLOW-9/13**: create is two real steps (pick → NOW YOU with chosen-fest
  chip in accent border; past fests reachable in a muted section with PAST
  badges). Enter submits every entry form.
- **FLOW-10**: the join screen names the FESTIVAL (from &f= or the doc stamp),
  in the fest's accent, with "with <crew>" under it — verified live.
- **FLOW-7/12**: post-create share moment (dialog with the URL VISIBLE +
  copy + native share); settings share falls back to clipboard on non-abort
  failures; the crew door prints the invite link permanently.
- **FLOW-8**: person chips are presence display only — identity switching is
  an explicit Settings action with a toast.
- **FLOW-6/11**: settings has the spec's two doors. CREW: rename (validated),
  members, visible link, Switch crew (landing), two-tap Forget-on-this-device
  (device-local; back can undo it via history — that's honest). YOU: switch
  identity, self-rename (new person + tombstone + picks/affinity migrate
  through additive merges; old notes keep the old byline), 24-board color
  picker with taken colors disabled.

## 2026-07-11 (late evening) — DESKTOP + A11Y foundations: the app gets a desktop body

- **Tokens** (design-direction doc): fluid type scale --fs-display/screen/day/
  card/body/micro, --shell-max 960→1080 @1100, --sp-gutter clamp. AX-3 contrast
  retune COMPUTED (scratchpad script, WCAG math): --text-tertiary #5D5578
  (2.84:1) → #877FA4 — same hue/sat, ≥4.5:1 on all three surfaces (worst 4.61).
  aura.js subColor follows (text legibility, not gradient math). Taste-pass
  note: tertiary now sits near secondary — watch the gray ladder.
- **A11Y layer**: cards are role=button + tabIndex + Enter/Space + pick level
  in the accessible name (AX-1); one :focus-visible language, inline
  outline:none purged (AX-2); sheets are real dialogs w/ focus trap + restore
  (AX-4); labels on every input (AX-5); 44px coarse-pointer hit areas via
  ::after + dock tabs scroll-safe centering (AX-6); settings rows/toggles are
  named buttons (AX-7). prefers-reduced-motion rides the low-power path.
- **Desktop body**: sticky day rail ≥720 (YOU ↑ + Anton micro tabs, shared
  scrollspy with the dock — one observer, two containers) (DT-1); sheets
  become centered dialogs ≥720, 150ms fade+scale, reduced-motion kills it
  (DT-2); wall grid auto-fills ~176px columns (DT-3); entry screens center
  via margin-block:auto overflow-safe (DT-4); the timetable goes FULL-BLEED
  ≥720 with rail aligned to the shell edge — body overflow-x:clip makes
  horizontal page scroll structurally impossible (DT-5); hover ✎ chip on
  fine pointers, keyboard-reachable (DT-6); native select replaced by
  js/v3/sort-control.js — chip + popover listbox, arrows/Enter/Esc/typeahead
  (DT-7).
- Verified live at 1440 + 390 on the Audit Rig crew (localhost vercel dev,
  which — correction to earlier note — has FULL cloud env: /api works against
  real Neon; the "deleted crew" toasts in smoke were genuinely-deleted test
  crews, correct behavior). Browser-back closed an open dialog in the real
  browser with the #g= link intact (FLOW-2 live check).

## 2026-07-11 (evening) — CORE class (18) + FLOW-2/3/4 + ST-1: the broken-behavior sweep

- **Cards**: refreshCard now reproduces the original render exactly — placement
  styles copied, render opts stashed in dataset (CORE-1: set-times vanish);
  renderCard renders its time line (CORE-3); long-press hardened with
  pointercancel + isConnected (CORE-15); a pick repaints every sibling card of
  a multi-day artist. groupByDay splits "Saturday & Sunday" into real days
  against known day names — wall sections and dock tabs share the logic (ST-1).
- **Set-times**: hour rail moved OUTSIDE the horizontal scroller (sticky-in-grid
  is a no-op — a grid item's containing block is its own area), rail + grid
  share one rows template (CORE-2). Search in a scheduled fest renders per-day
  chronological results with stage · time on each card (CORE-4); the sort
  control hides in timetable view rather than silently no-op (CORE-5 — a
  timetable has one true order; search results sort by time).
- **Sync honesty**: applyRemoteDoc's visible slice now includes notes + meta
  (CORE-6); open sheets repaint on remote change (CORE-16). NEW from smoke
  testing: crew-gone now requires the API's own JSON 404 — a platform/routing
  404 (broken deploy, stale SW) must never wipe remembered crews.
- **Navigation (FLOW-2)**: js/v3/router.js — history-backed layer stack
  (settings / drills / sheets), back closes top layer, forward re-opens,
  refresh restores, Escape = universal back, #g= survives. Pure diff logic
  unit-tested with a simulated session history.
- **Lost states**: bad/expired links get a real screen with paste-a-link
  recovery; dead crews are forgotten with a toast (FLOW-3). Boot has an error
  boundary + global no-screen-visible net (FLOW-4). Offline fest-switch loads
  before persisting; boot falls back to a loadable fest with a toast (CORE-12).
- **Tools**: bulk paste is an integrity gate — strict level labels, lineup-only
  artists recorded under canonical spelling, migration-gate blocks the whole
  batch, every skip reported (CORE-8). Day image rebuilt: offscreen fixed-width
  render per day, real error surfacing (CORE-7 — old path shipped 0-byte PNGs).
  Pick counts use picksFor, dropping tombstones (CORE-13).
- **Misc**: custom fests can't shadow canonical ids (client guard at save +
  read — server-side guard deliberately skipped: token holders only hurt their
  own crew's view, and read-time canonical-wins makes shadowing impossible)
  (CORE-9); empty-lineup fests keep the notes composer (CORE-10); add-festival
  save try/catches (CORE-11); Spotify Client-ID save double-writes + re-renders
  the drill (CORE-14); honest no-button toast + migration banner w/ retry
  (CORE-17/18).
- Tests 63 → 87 (jsdom added as devDependency for DOM regressions).

## 2026-07-11 (evening) — v3.1 fix phase begins: FLOW-1 (the P0) on v31-polish

- Branch `v31-polish` off main. FLOW-1 fixed per the decided hybrid: share
  links now carry `&f=<festId>` (crewLink + festFromHash, captured at boot
  before enterApp's replaceState strips it), and `meta.inviteFestId` — the one
  carve-out from the doc-shape freeze — is stamped at crew creation and
  refreshed on Share invite, through the normal validated merge path.
- activateCrew takes the hint only when the device has no saved fest for that
  crew (returning devices keep their own context); unknown ids fall through to
  the old default. Validator: meta accepts exactly name + inviteFestId.
- 7 regression tests in tests/invite-context.test.mjs, incl. an end-to-end
  check that recordInviteFest's overlay passes validateIncoming. 63/63 green.

## 2026-07-11 (afternoon) — v3.1 discovery: audit-first, findings banked

- Kevin's morning pass found ~10 real problems the overnight gates missed
  (incl. a set-times vanish bug and broken Spotify OAuth) → run restructured
  audit-FIRST at his direction: "don't play whack-a-mole; robust, top to
  bottom." His findings became the calibration set for the machinery.
- Discovery engines: (1) 54-agent design-audit workflow — 3 Playwright walkers
  on prod at 390/768/1440 as throwaway crew "Audit Rig" + code finders +
  reviewer lenses + opus dedupe + adversarial verify → 34 confirmed findings
  in 8 classes (claude-plans/2026-07-11-v31-backlog-workflow.md); (2) blind Codex gpt-5.6-sol
  whole-repo UX pass → 51 findings (claude-plans/2026-07-11-codex-v31-ux-review.md).
- Calibration: 15/16 of Kevin's findings independently rediscovered. One
  structural miss (Spotify redirect — rig had no Client ID, walkers died one
  step early); lesson: Stage-4 re-run must seed a Client ID + walk offline.
- Cross-model headline: both engines independently flagged the same P0 —
  invites lose festival context on new devices (joiner lands on Lost Lands).
- Merged, re-judged, sequenced: claude-plans/2026-07-11-v31-backlog.md — 1 P0 / 24 P1 / 32 P2
  in 9 fix classes. Supporting docs shipped same run: docs/user-flows.md (the
  executable spec — mismatch is always a finding), design direction, fix-phase
  grounding (hg-save-it lens), frontend-design skill installed to hg-agents.
- Deliberate boundary: ZERO app-code edits this session — findings cite
  file:line against a stable tree; the fix phase starts from a cleared
  context reading the banked docs (NOW.md has the read order).

## 2026-07-10 (overnight) — v3 SHIPPED TO PRODUCTION (main)

- Full arc in one overnight run: P0 grounding -> P1 design system -> P2 data
  layer (Codex gate: 3 P0s fixed structurally) -> P3 all screens (walk gate)
  -> P4 festival-add API -> P5 SW v13 + living favicon -> P6 final gate +
  live migrate integrity -> merge to main -> production -> all three real
  crews pre-migrated to v4. Morning report:
  claude-plans/2026-07-10-v3-morning-report.md.
- Review economics that worked: bank-as-you-go reviewer files (two reviewers
  "vanished" from the registry but were merely slow — both delivered), gates
  at phase boundaries, every finding dispositioned same-night with the fix
  cited back to its finding number.
- The guard + classifier stack worked as designed: blocked a CREATE TABLE on
  an ON DELETE CASCADE word-match, then correctly refused a credential-
  materializing workaround — table creation deferred to Kevin rather than
  routed around. Layered defenses > my in-the-moment reasoning.

## 2026-07-10 (overnight) — v3 P3: THE WALL SHIPS (branch `v3-design`)

- index.html replaced wholesale with the v3 shell (landing 21a, join 21b,
  wall 21c). js/v3/app.js orchestrates boot -> join -> wall; js/v3/wall.js
  renders day sections of aura cards from live picks (model.js reads), owns
  the tap cycle (0-4-0 with undo toast on the 5th tap), search/sort, and the
  dock scrollspy (IntersectionObserver). Legacy person colors map onto the
  24-board deterministically (old palette position -> board slot, no writes).
- sync.js: sv:4 semantics declaration on every push; requestMigration() calls
  the server-side op; setSyncStatus feeds both dots. All doc-derived strings
  render via textContent (gate rule).
- LIVE-VERIFIED on the branch API (vercel dev :3111 + throwaway v4 crew):
  join -> claim -> 117-artist wall -> tap x5 = alpha ladder/must-pill/clear+
  toast in the DOM -> server doc shows level 4, v:4, sync online. The one
  test hiccup was the July-7 service worker still controlling old tabs —
  expected; skipWaiting converges on the second load.

## 2026-07-10 (overnight) — v3 P0+P1+P2: grounding, rig, design system, data layer (branch `v3-design`)

- **P2**: doc v4 semantics (picks 0-4, keyed-object notes, spotifyStats,
  colorIndex) + version-aware client reads. Codex gate (blocking) found 3
  P0s; all fixed STRUCTURALLY: migration moved server-side (?op=migrate, one
  atomic SQL transform, v never client-writable), note ids must carry their
  author prefix, sv:4 semantics declarations with SQL choosing the mapped
  delta for stale clients. 56/56 tests incl. concurrent-notes both-orders.
- **P4 core**: /api/festival-add — Gemini search-grounded research ->
  validated candidate + sources -> user-confirm -> crew-private upsert.
  Festival rules extracted to api/_lib/festival-rules.mjs (single source of
  truth with CI validator). custom_festivals DDL deferred to Kevin (guard
  false-positive on ON DELETE CASCADE; classifier rightly blocked the
  workaround).

- **P0**: four foundation docs deep-read → distillation in the grounding doc;
  compaction hooks + Neon destructive-op guard installed and behavior-tested;
  design atlas read in full → `assets/v3-tokens.css` + `claude-plans/
  v3-inventory.md`; @vercel/blob + migrate-legacy.mjs deleted (prod deps = 1);
  Anton/Inter self-hosted (Inter as one variable woff2); CI now runs on all
  branch pushes.
- **P1**: `js/v3/palette.js` (24-board from the design project's 12a AURA,
  canonical first four; stable colorIndex) + `js/v3/aura.js` (pure-function
  port of the atlas renderVals — 9 tests pin the EXACT gradient strings) +
  `assets/v3.css` (every component: cards/cells, corners, chips, toolbar,
  sheet, dock, settings, notes, segmented, toggles) + `gallery.html`
  exercising the production stylesheet with atlas-verbatim data. Verified in
  Playwright: computed backgrounds match the engine, self-hosted fonts load,
  full-page screenshot eyeballed against the atlas.
- Palette nuance worth remembering: slot 3 is the README's curated green
  hsl(150,70%,50%), NOT the board's naive 150-bright — greens at 90% sat fail
  the 0.5-alpha-on-#141021 legibility rule.

## 2026-07-09 — Data archaeology + archive fests (branch `rescue-and-archives`)

- **Root-caused the "missing EF saves"**: the legacy blob was clobbered to 402
  bytes at 09:10:14 on Jul 7 — sixty seconds before `migrate-legacy.mjs` ran —
  so the migration's byte-for-byte verify faithfully copied an already-emptied
  doc. The 3 surviving picks were all that reached Neon. (The Blob write-loss
  failure mode, again; it destroyed real data before the ban was written.)
- **Recovered Lollapalooza 2025**: two independent survivors — `lollaSelections`
  in Chrome Profile 2's LevelDB (10 artists/17 picks, read via classic-level on
  a copy) + the Aug-2025 blob (4 more artists). Union validated against the
  shipped lineup (0 orphans), written as new crew "Lolla 2025" (6 people,
  21 picks, verified leaf-by-leaf). Token in chat only — repo is public.
- **recover.html**: self-serve rescue page for device localStorage (all key
  generations: `fn_data_v2`/`fn_pending_v2`, `lollaSelections`,
  `fn_spotify_libmap_v1`). Preview → merge via existing `/api/crew` → read-back
  verify; EF id remap, tombstone drop, unknown-people skip, never-lower rule.
  E2E-tested with Playwright against a throwaway prod crew (then deleted via
  Neon). Exists because phones that synced at EF still hold the crew's picks.
- **Three archived festivals** researched + adversarially verified (6-agent
  workflow, ~766K tokens): `ubbi-dubbi-2026` (50 acts; Day 2 weather-cancelled
  mid-event), `wicked-oaks-2025` (68 acts; 4 announced-but-cut excluded),
  `acl-2025` (124 acts, day + W1/W2 flags; final performed lineup incl. Killers
  headliner swap). Principle: final published set times are truth.
- **Learned the level semantics**: 1=Nice to See, **2=Highlight, 3=Must See**
  (`js/ai.js:84`, tap cycle `js/app.js:423-425`) — don't assume 2=Must.
- **Security**: The Crew's token is in this public repo's git history (NOW.md).
  Removed from HEAD; rotation queued as Kevin's decision. New rule in project
  memory: grep for `#g=` before committing docs.
- SW cache v11→v12 (tailwind.css grew recover.html's classes).

## 2026-07-07 — Prime-time build (P1–P7, one session)

- **Crews shipped**: capability-link model (160-bit token = access), landing/join flows,
  per-device "me", crew switcher + share button. Legacy global doc migrated into Kevin's
  crew (verified byte-for-byte, twice) and `/api/selections` retired with a 410.
- **Storage pivoted mid-build, on evidence**: Vercel Blob (plan A) measurably lost writes —
  eventually-consistent reads even with cache-busting (stress test: 3/6 stale, 1 write gone
  permanently). Rebuilt on Neon Postgres: single inline atomic `UPDATE` via
  `jsonb_deep_merge()` (source: `db/schema.sql`). A CTE draft lost 2/6 concurrent merges
  (snapshot-before-lock); inline survives 18/18. Do not reintroduce a CTE read.
- **Festival model v3**: per-festival JSON + validator + importer; sortable artist list view
  for lineup-only festivals (ACL weekend filter); overlap-aware grid lanes replace the
  "also happening" workaround (activities list stays, data-driven). Six 2026-27 festivals
  researched from official sources and loaded.
- **Spotify via PKCE**: per-crew Client ID, zero server secrets, tokens device-local,
  library scan → per-person badges, playlist-from-picks on the member's own account.
  Verified to the OAuth boundary; live round-trip needs Kevin's allowlisted app.
- **AI hardening**: raw-prompt `/api/gemini` deleted; structured `/api/optimize`; shared
  per-IP rate limits + same-origin checks; AI HTML passes a tag whitelist.
- **Reviews**: two Codex passes (first hung, respawn delivered) + a background security
  review + a final 4-dimension workflow fan-out. All confirmed findings fixed same-day:
  prototype-pollution key handling, compressed-vs-text size gate, outgoing-crew flush on
  switch, boot re-entrancy guard, offline-join cache fallback, escaping gaps.
- **Gotchas that cost time**: `vercel dev` doesn't serve files created after start (restart
  it); the Write tool serialized literal `\x00` bytes twice when regex escapes were meant;
  old CLI's `--yes` created a stray project from a wrong cwd (cleanup: Kevin deletes
  `festivals` project in Vercel dashboard).

## 2026-07-07 — Prime-time build kickoff (P0)

- Grounded in hg-ground-it four-doc pass; plan at `claude-plans/2026-07-07-prime-time.md`.
- Verified external constraints from primary sources: Spotify dev-mode = 5 users/app + owner Premium (Mar 2026); Vercel Blob Hobby = ~5GB / 100K simple / 10K advanced ops per month, pause-not-bill.
- Decisions locked with Kevin: capability-link crews (no accounts), Spotify via PKCE with per-crew client IDs (zero server-held secrets, playlists on the member's own account), stay on Vercel.
- Known defects to fix (found in code read): del-then-put data-loss window + write race in `api/selections.js`; world-writable global doc, CORS `*`; `/api/gemini` = open LLM proxy; Kevin-only baked Spotify affinity; no lineup-only view; grid cannot render same-stage overlaps (the real reason the "also happening" list exists).
- Branch `prime-time` created; durable-build state files + compaction hooks installed.
