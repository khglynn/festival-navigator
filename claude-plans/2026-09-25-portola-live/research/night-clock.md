# Night clock: do the suites stay green while Portola is live?

Research slice, 2026-09-25 (Fri, the day before Portola). Read-only. Worktree
`.claude/worktrees/portola-live` at 47a381c (origin/main at time of reading).

Status: DONE (2026-09-25 ~17:40 PT).

## Verdict (one screen)

1. **The suites stay green through the festival.** main @ 47a381c: unit suite
   887 pass / 0 fail / 1 skip (the DATABASE_URL-gated Postgres test, skipped
   by design) at Sat 14:00, Sat 21:30, Sun 23:50 and Mon 01:30 PT, under
   TZ=UTC and TZ=Asia/Tokyo (CI's two runs), plus a not-live control and the
   real clock right now. The clock-sensitive browser tests pass 34/34 at the
   same four instants.
2. **The measurement is real.** The same harness on the pre-fix code
   reproduces the 09-24 incident exactly: 48 failures, `getComputedStyle is
   not defined`. A probe confirms the booted shell shows NOW, the now line and
   live cards at every live instant on current main.
3. **What was fixed, and what wasn't.** The 09-24 fix was app-side only
   (`window.getComputedStyle`, commit daa9145). No test clock was pinned, and
   DEVLOG has no entry. 23 shell-booting test files still run on the machine's
   clock, so which path CI exercises still depends on the hour it runs. It is
   green now because the app code is right, not because the tests are
   deterministic.
4. **Optional hardening, CI and tests only:** scratchpad `night-clock.patch`
   adds `tests/helpers/night-clock.mjs` and one CI step that runs `npm test`
   pinned to Sat 21:30 PT on every push. It would have caught the 09-24 bug on
   the daytime push that introduced it (measured: 48 fails on pre-fix code,
   0 on main). About 45 s more per CI run; nothing reaches phones.
5. **Blind spot to know about:** jsdom only logs exceptions thrown inside
   event listeners (e.g. `visibilitychange` → `tickClock`), so a live-only
   throw there passes the unit suite. On main today there are none at any
   instant (§5), but the suite would not catch a new one.

## Question

A fix shipped at 11 PM on a festival night is useless if CI goes red because
the clock says a set is live. On 2026-09-24 at 11:42 PM PT, 48 jsdom boot
tests failed for exactly that reason. Was it fixed everywhere, and do the
suites pass when the process believes it is Sat/Sun night of Portola?

## Detail

### 1. What the 2026-09-24 fix actually changed (static reading)

- The incident: CI at 11:42 PM PT Thu 2026-09-24, 48 unit tests failed with
  `ReferenceError: getComputedStyle is not defined`. The NOW tab only renders
  while something is live, so `fitNowTab`/`seenBand` ran during boot only at
  night. Source: project memory `tests-that-pass-by-daylight.md`; commit
  `daa9145` (2026-09-24 23:54 PT).
- **DEVLOG.md has no entry for it** (grep for getComputedStyle / clock /
  daylight / 11:42 finds nothing). The only record is the commit message
  and project memory.
- The fix was on the app side only: 3 bare `getComputedStyle` calls became
  `window.getComputedStyle` (js/v3/app.js:482, :543, :551; js/v3/wall.js:2419).
  **No test got a pinned clock.** The memory rule's second half ("pin a fake
  clock in any new jsdom boot test") was never applied to the existing rigs.
- `tests/helpers/shell-rig.mjs` (`bootShell`) pins no clock. 25 test files boot
  the real shell through it; only 2 pin a clock (`errlog-boot-crash`,
  `errlog-settings-toggle`: `mock.timers` at 2026-09-10T17:00Z, a not-live
  time). `shell-v4.test.mjs:479-489` swaps `Date` only inside one helper.
  **So 23 shell-booting test files run on whatever the machine clock says.**
- App code reads now two ways: `ctx.now` (tests can pin; app.js:91 "tests pin
  the clock; null = new Date() at render") and bare `new Date()`, which is
  the only path at app.js:462 (`tickClock`), :822 (`dayOfScrollKey`), :831
  (the day-of open). A pinned `ctx.now` does not cover those, so a
  process-wide Date shift is the right way to test.
- Bare browser globals still in app code (these would throw under a rig that
  lacks them, if a live-only path reaches them): `CSS.escape` app.js:218,
  :325, :629, :779; `requestAnimationFrame` card-facts.js:849/1302/1399,
  notes.js:800, wall.js:2450; `ResizeObserver` wall.js:2465. The shell rig
  supplies `CSS`, `requestAnimationFrame`, `IntersectionObserver` on globalThis
  and `matchMedia`/`scrollTo` on window, but **not `ResizeObserver`**. Whether
  any live-only path reaches them is what the runs below measure.
- **The real clock is already live right now**: Fri 2026-09-25 17:01 PT falls
  inside Portola's Friday afters (Pier 80 loyalty invite 5 PM–11 PM, then club
  nights to 2–4 AM). From now until about 6 AM PT Monday, a CI run sees
  something live unless it falls on a morning between the last afters
  (about 4–6 AM) and doors (1:30 PM).

### 2. The preload (scratchpad, not committed)

`/private/tmp/claude-505/.../scratchpad/night-clock.mjs`. Offset-shift, not freeze:
`new Date()` and `Date.now()` read real + offset; `new Date(x)` untouched;
`Date.prototype` is the real one so `instanceof` holds; timers and
`performance.now()` untouched. `mock.timers` still overrides it and restores it.

Verified inside a `node --test` child (`verify-night-clock.test.mjs`):

```
TZ=UTC NIGHT_CLOCK=2026-09-26T21:00:00Z NODE_OPTIONS="--import <scratch>/night-clock.mjs" node --test <scratch>/verify-night-clock.test.mjs
# ... festivalClock={"iso":"2026-09-26","minutes":840} liveGridDays=[["Saturday",840]]
TZ=UTC NIGHT_CLOCK=2026-09-27T04:30:00Z ...
# ... festivalClock={"iso":"2026-09-26","minutes":1290} liveGridDays=[["Saturday",1290]]
```
Same test without the preload fails with "preload did not run in the test
child", so the check catches a missing shift. Local node is 26.9.0; CI is node 24.

### 3. Browser suite: which tests read the real clock (static reading)

Chromium reads the OS clock, not Node's `Date`, so the Node preload does not
reach the page. Each browser test either pins `page.clock.setFixedTime(...)`
before `goto` or runs on the real clock:

| file | clock | page | this weekend? |
|---|---|---|---|
| error-report | pinned 2026-09-10 10:00 PT (not live, on purpose) | app | safe |
| meter-contract, zoom-chips-contract, zoom-chips-burst, zoom-chrome-contract | pinned 2026-09-23 19:00 PT | app | safe |
| zoom-still-hand | pinned per case | app | safe |
| now-jump | pinned, deliberately live (Sat 22:30 / 23:45 / 21:15 / 19:00 PT) | app | safe, and already exercises live NOW |
| zoom-notes-chip | pinned Sat 15:00 PT (live) | app | safe |
| show-links (app part) | pinned Sat 22:30 PT (live) | app | safe |
| **heads-contract** | pinned ONLY when a case passes `now` (heads-contract.test.mjs:52). Cases at :80, :102, :116, :211 pass none | app, portola-2026 / every fest | **real clock** |
| **shell-contract** | never pinned | app, portola-2026 and acl-2026 | **real clock** |
| **hover-contract, strip-follow, touch-ghost-contract, show-links (gallery part)** | never pinned | gallery.html, `ctx.now: null` (gallery.html:556) | **real clock**, and the gallery fest is dated Sat 2026-09-26 / Sun 2026-09-27 America/Los_Angeles (gallery.html ~:833), i.e. the exact Portola weekend, plus Late nights Sep 29 – Oct 1 |

So the browser job is clock-sensitive this weekend: 4 gallery files, all of
shell-contract, and 4 heads-contract cases render whatever NOW the real clock
gives. `page.on('pageerror', e => { throw e })` is set in heads-contract:51 and
shell-contract:46, so a live-only throw in the page would fail those.

### 4. The harness reproduces the incident (canary)

To prove a green shifted run means something, I ran the pre-fix code
(`git archive daa9145^` = 5468d1e, extracted to the scratchpad, node_modules
symlinked) under the preload:

| code | instant | files | result |
|---|---|---|---|
| pre-fix 5468d1e | Thu 2026-09-24 23:42 PT (the incident) | crew-join-recognize + shell-v4 | **16/29 fail**, `ReferenceError: getComputedStyle is not defined` at `fitNowTab` app.js:482 |
| pre-fix 5468d1e | Sat 2026-09-26 09:00 PT (nothing live) | same | 29/29 pass |
| main 47a381c | Sat 2026-09-26 21:30 PT, TZ=UTC and TZ=Asia/Tokyo | same | 29/29 pass both |

Full suite, pre-fix code, with the committed-helper version of the preload
(`tests/helpers/night-clock.mjs` from the patch) at the patch's pinned
instant Sat 21:30 PT: **820 tests, 48 fail**, 25 `getComputedStyle is not
defined` lines, the incident's exact count. Same code at Sat 09:00 PT:
819 pass / 0 fail. Logs: scratchpad `runs/prefix-with-helper.log`,
`runs/prefix-quiet.log`.

So the preload does drive the live-only boot path, and the fix holds for
those two files. Side finding: even in the quiet pre-fix run the log carries
2 `getComputedStyle` ReferenceErrors that did NOT fail a test. They were thrown
inside a `visibilitychange` listener (app.js:434 → tickClock → paintNowTabs →
fitNowTab), and **jsdom only logs exceptions thrown in event listeners**, it
doesn't fail the test. So a green count can hide live-only errors: every full
run below is also grepped for ReferenceError/TypeError.

### 5. Unit suite at festival instants — ALL GREEN (main @ 47a381c)

Command (npm test's exact file set, run directly so concurrency can match
CI's 4-vCPU runner and spare this Mac's memory; logs in scratchpad `runs/`):

```
TZ=<zone> NIGHT_CLOCK=<instant> NODE_OPTIONS="--import <scratch>/night-clock.mjs" \
  node --test --test-concurrency=3 --test-reporter=spec tests/*.test.mjs
```

| instant (PT) | UTC instant | TZ=UTC | TZ=Asia/Tokyo | secs |
|---|---|---|---|---|
| Sat 09-26 09:00 (not live, extra control) | 2026-09-26T16:00Z | 887 pass / 0 fail / 1 skip | — | 43 |
| Sat 09-26 14:00 (task's "control"; sets ARE live) | 2026-09-26T21:00Z | 887/0/1 | 887/0/1 | 42 / 47 |
| Sat 09-26 21:30 (headliners) | 2026-09-27T04:30Z | 887/0/1 | 887/0/1 | 47 / 45 |
| Sun 09-27 23:50 (Sun afters) | 2026-09-28T06:50Z | 887/0/1 | 887/0/1 | 44 / 44 |
| Mon 09-28 01:30 (afters) | 2026-09-28T08:30Z | 887/0/1 | 887/0/1 | 47 / 50 |

888 tests; the 1 skip is `CONCURRENT MERGES on real Postgres`, skipped without
DATABASE_URL by design (also skipped in CI). **0 failures in 9 runs.**

Logged-but-uncaught errors (the jsdom blind spot from §4): every run carries
the same 3 lines — an intentionally unreadable crew doc (logged twice) and a
Spotify scan's "Failed to fetch" — with an identical fingerprint in all 9
runs including the not-live control (md5 of the normalized lines `0cf98d28`).
They come from test fixtures, not the clock. No `getComputedStyle` or any
other `is not defined`.

**Proof the live path really ran** (`probe-now-live.test.mjs`: the real
shell booted on a cached Portola crew, network hung, as in
tests/warm-open.test.mjs):

| instant (PT) | NOW tab shown | now lines | live cards | errors |
|---|---|---|---|---|
| Sat 09:00 | no | 0 | 0 | none |
| Sat 14:00 | yes | 1 | 0 | none |
| Sat 21:30 | yes | 1 | 2 | none |
| Sun 23:50 | yes | 0 | 10 | none |
| Mon 01:30 | yes | 0 | 10 | none |
| real clock, Fri 17:16 PT | yes | 0 | 1 (Fri afters) | none |

Identical under TZ=UTC and TZ=Asia/Tokyo (the festival clock reads the
fest's own `timezone`, so the device zone doesn't move it).

### 6. Browser suite at festival instants — ALL GREEN

`page-clock.mjs` (scratchpad) wraps playwright's `chromium/webkit.launch` so
every context gets an init script that offsets the page's `Date` (same shape
as night-clock; `page.clock.setFixedTime` still wins, verified). Verified in
`verify-page-clock.test.mjs`: at Sat 21:30 PT the gallery's page clock read
2026-09-27T04:30:01Z and drew 1 now line and 3 live cards, no page errors.

Ran the 6 files that read the real clock (§3), CI's env (`BROWSER_TEST_REQUIRED=1`,
UTC), one file at a time (`browser-at.sh`):

| instant (PT) | shell-contract, heads-contract, hover-contract, strip-follow, touch-ghost-contract, show-links | secs |
|---|---|---|
| Sat 14:00 | 34 pass / 0 fail / 0 skip | 109 |
| Sat 21:30 | 34 / 0 / 0 | 108 |
| Sun 23:50 | 34 / 0 / 0 | 112 |
| Mon 01:30 | 34 / 0 / 0 | 111 |

The other 8 browser files pin `page.clock` before `goto`, so they cannot see
the real clock (several pin live Saturday times on purpose: now-jump,
show-links' app part, zoom-notes-chip). WebKit cases ran locally (0 skips);
CI installs only Chromium, so CI skips those.

### 7. CI's own history agrees (node 24, the CI version)

`gh run list --workflow CI` (read-only), converted to PT. After the fix
landed (Thu 09-24 23:54 PT), CI ran **green between Fri 00:19 and 00:48 PT**
while Thursday's afters were live (Club Six until 4 AM). Checked with
`git merge-base --is-ancestor daa9145 <sha>`: five of those green runs carry
the fix (feat/error-capture 93c905f run 36109433112, 790e1dc, 0ac6169;
feat/event-links ffd9614 run 36109146939, 7854559). Two `seasons/kickoff` runs
(f48cdcb, 0d91892) lack it and were green anyway, most likely because that
branch predates the NOW tab. Local runs here were on node 26.9.0,
with no node 24 available, so that history is the node-24 evidence. The
only red runs in the last 60 (`seasons/austin-v0`, Fri 16:47–16:49 PT)
are that branch's new season-contract browser tests timing out (a different
feature, before 5 PM so not live); the same branch was green at 17:13 PT.

### 8. Recommendations

1. **Apply `night-clock.patch` when a release goes out anyway** (tests + CI only,
   so it is safe mid-festival and follows the normal PR + CI + review gate).
   It makes the live path a fixed part of every CI run instead of an accident
   of the hour. Pinned to Portola's own data, so it stays meaningful after
   the weekend.
2. **During the weekend, CI mostly tests the LIVE path** (Sat/Sun 1:30 PM to
   about 6 AM PT). The not-live path (before-doors landing, "nothing on")
   only gets real-clock coverage 6 AM–1:30 PM. Until the patch lands, a
   fix touching the day-of open or the before-doors landing should also be
   run once locally at a quiet instant:
   `TZ=UTC NIGHT_CLOCK=2026-09-26T16:00:00Z NODE_OPTIONS="--import <helper>" npm test`.
3. **If CI goes red at night on a diff that didn't touch the failing area**,
   check the clock first: rerun locally with NIGHT_CLOCK at the CI run's
   timestamp. That reproduces it in about 45 s.
4. **Add a DEVLOG line for 09-24** (the incident lives only in a commit
   message and project memory today).
5. Later, not this weekend: have `tests/helpers/shell-rig.mjs` pass a
   `VirtualConsole` that fails the test on a jsdom "Uncaught" error, closing
   the listener blind spot (§4). Check first that no test relies on a swallowed
   listener error; today's logs show none.

### Files (scratchpad = /private/tmp/claude-505/-Users-kevinhalladay-glynn-DevKev-personal-festival-navigator/ad85413b-2402-4df6-89fc-d9f0bc11c9d7/scratchpad)

- `night-clock.mjs`: Node Date-offset preload; `verify-night-clock.test.mjs` proves it
- `page-clock.mjs`: browser page Date-offset preload; `verify-page-clock.test.mjs` proves it
- `probe-now-live.test.mjs`: boots the shell, reports NOW / now lines / live cards
- `run-at.sh`, `browser-at.sh`: the runners; `runs/*.log`: every log
- `prefix/`: `git archive` of 5468d1e (pre-fix), used for the canary
- `patchwork/`: HEAD plus the patch, where the proposed CI step was run
- `night-clock.patch`: optional hardening (`git apply --check` clean on the worktree)

Process notes: waited for another session's browser suite (season-view
worktree, pid 15079) to finish before starting full runs (swap was 11.3 GB of 12 GB).
No push, merge, deploy, or DB access. Nothing tracked in the worktree was
edited; the only new files are this report (untracked).
