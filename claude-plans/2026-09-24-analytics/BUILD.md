# v88 error capture: build log (2026-09-24 → 25)

**Branch:** `feat/error-capture`, cut from `origin/feat/now-jump` (v87,
`de41fec`), since merged up to `origin/main` (v87 live, `28f8c45`).
Worktree: `.claude/worktrees/analytics`. Upstream set to its own branch only,
so a push can never land on `feat/now-jump` or `main`.
**Scope:** DESIGN.md §4a's errors-only slice as its own release (Decision 7),
with Kevin's Decisions 3–5 applied and the Slack alert design's field
requirements (`slack-alert-design.md` §5, "What the fest error path should
send"). No usage or health events.
**Release shape (coordinator, 2026-09-25):** v88 ships from an integration
branch, `release/v88`, which combines this branch with `feat/event-links`
(PR #29). The coordinator does the final re-stamp there and opens the one PR
to main. This branch gets its own draft PR for review and is never merged to
main directly.
**Cut line:** green and independently reviewed by Fri Sep 25, 12:00 CT, or it
moves to the Sep 28 – Oct 1 gap.

## Where things stand

See "Log" at the bottom for the newest state.

## Where the project key goes

`index.html`, the `fn-report-key` meta, right beside `fn-canonical-host`:

```html
<meta name="fn-report-key" content="phc_…">
```

It now holds the "Festival Navigator" project's key (PostHog project 627900,
US cloud). It's a write-only ingestion key and public by design, so it ships
in the page like any analytics key. Only the `phc_` shape is ever used: a
personal `phx_` key (a real secret) pasted there by mistake is ignored.
Emptying it switches every phone's reports off; the Settings toggle
disappears and the journal behind Diagnostics keeps working. The jsdom shell
rig overwrites it (empty unless a test asks), so no test ever sends with the
real key, and the browser test swaps in a test key.

## Decisions made while building (and why)

1. **errlog.js stays a leaf module and learns the app's facts through
   `configureReports()`.** app.js hands it two functions at load: the
   context (festival id, the public pid, the person's name in the crew) and
   the device's secrets (every crew token it holds, the person token, the
   pending-absorb token, each read on its own so one broken source never
   costs the others). No storage key for tokens or names is copied into
   errlog.js, so nothing can drift.
2. **The one exception is the settings key.** Off and Stay offline have to
   hold even when the app's own modules never ran (a parse error on an old
   iPhone), so errlog.js reads `fn_settings_v1` itself. The key now lives in
   errlog.js and settings.js imports it: one value, one home.
3. **errlog.js is hooked from index.html in its own module script, before
   app.js.** A module graph that fails to parse (the classic WebKit-only
   break: syntax an older Safari doesn't know) never evaluates any of its
   modules, so a hook installed from app.js can never see the one crash that
   leaves a blank page. A separate inline module whose only import is
   errlog.js evaluates on its own. The same URL is the same module instance,
   so app.js's `hookGlobalErrors()` is a no-op second call (the browser test
   proves one error makes one event). A module that fails to LOAD fires on
   its `<script>`, not on window, so a capture listener catches that too
   (`kind: module-load`).
4. **Scrubbing, in order, on every string that can leave the phone** (the
   error message, each frame's function name and path, and the local journal
   too, since Diagnostics is pasted to Kevin by hand):
   a. the device's own secrets, exact match, longest first → `‹token›`;
   b. every URL keeps scheme, host and path; its `?query` and `#hash` go;
   c. any leftover `?x=` / `#x=` / `&x=` parameter → `‹param›`;
   d. email addresses → `‹email›`;
   e. JSON parse messages lose their quoted snippet → `"‹text›"` (V8 quotes
      a window of the bad input, and that input can be a crew doc with notes);
   f. any run of 20 or more `[A-Za-z0-9_-]` → `‹token›`.
   Rule f is TOKEN_RE's shape (`{20,40}`), unbounded above so a token glued
   to a key name (`fn_me_v3_<token>`) goes too. It needs no lookbehind, which
   old Safari can't parse. Stack lines that parse as neither V8 nor WebKit
   are dropped, never sent raw.
5. **PID-shaped runs (10–16) are not redacted.** Pushback on the brief's
   "anything shaped like PID_RE": the pid is public by design and Kevin
   chose to send it, and PID_RE's range is disjoint from TOKEN_RE's
   precisely so a pid can never pass as a token. Redacting 10–16 character
   runs would redact most identifiers in every message. The pid property is
   checked against PID_RE before it's sent, so a token can't ride in that
   slot either (tested).
6. **The cost of rule f, accepted:** a long identifier in a message
   (`getBoundingClientRect is not a function`) reads `‹token› is not a
   function`. No camelCase exemption, because a random token can be all
   letters (about 7 in 100,000 27-character tokens would pass a camelCase
   test). Nothing is lost for debugging: every frame carries its file, line
   and column, and there's no bundler, so `/js/v3/app.js:2488:12` at a known
   build is the exact line.
7. **Build and stamp come from the service worker that controlled the page
   when it loaded.** errlog asks `navigator.serviceWorker.controller` over
   `postMessage`; the worker answers with its `CACHE_VERSION` and
   `ASSET_STAMP`. The page's JavaScript came out of that worker's cache, so
   that's the build that threw, even after a newer worker takes over (the
   "v75 shell judging v76 code" case). With no controller, or a pre-v88
   worker that never answers (3 s), it falls back to the cache names and
   says `sw: none` / `controlled`. Reports queued before the answer are
   patched with it before they can be sent.
8. **The rewrite is exact: `/fn-i/batch` → `https://us.i.posthog.com/batch`.**
   DESIGN §2a suggested `/fn-i/:path(.*)`, which would make this domain a
   general proxy to PostHog's ingestion host. Only one path is used, so only
   one is proxied. `tests/brand-assets.test.mjs` pins that a rewrite may only
   proxy to that one host, and that nothing may be created at `fn-i`.
9. **The service worker passes `/fn-i/` through even for GET.** Reports are
   POSTs, which it never handles (`request.method !== 'GET'` returns first);
   the path is named anyway so no future GET there is answered from a cache.
10. **The hide beacon always goes after the crew's own.** Both share the
    browser's 64 KB keepalive budget, and a pick outranks a crash report.
    visibilitychange bubbles from the document to the window (HTML: "bubbles
    attribute initialized to true"), so errlog listens on `window` and runs
    after app.js's document listener whatever order they were wired in. The
    first cut relied on wiring order and a test caught it running first when
    the hook ran after `load`. pagehide fires at the window itself, so that
    one is wired at `load`, after app.js. The beacon body is capped at 16 KB
    and uses `text/plain` (CORS-safelisted everywhere; PostHog reads the
    JSON regardless, checked with a probe).
11. **A beacon's reports stay queued, marked, and the next fetch sends them
    again with the same uuid and timestamp.** A beacon's answer can't be
    read. PostHog's documented idempotency is "send the same uuid"; its
    ClickHouse dedupe is eventual and not guaranteed, so a report that went
    out by beacon AND fetch may count twice. A lost report is worse than a
    double-counted one, and an issue alerts once either way.
12. **Queue:** one localStorage key (`fn_telemetry_q_v1`), read fresh on
    every change (two tabs share it); memory holds it when storage is
    refused or a write fails (a full store reads fine and refuses writes:
    the first cut would have quietly reset to empty there; a test pins it).
    300 entries / 96 KB, usage events evicted before errors, errors expire
    after 7 days. A repeat folds into this page load's unsent report
    (`count` grows); folding never crosses page loads, since an earlier
    load's report may be another build's. One page load queues any one error
    at most 5 times. 2xx drops the batch; 400/413 drop it too (refused for
    good, would stall the queue); anything else keeps it. `flushReports()`
    never rejects, because an unhandled rejection from the reporter would be
    recorded by the reporter.
13. **Sends:** after a successful sync (`fn:synced`, dispatched by sync.js on
    a push or poll that got through), on the browser's `online`, and by
    beacon on hide. Never on a timer. Stay offline blocks all of them; Low
    power allows only the after-sync send (DESIGN §2e.3).
14. **The Settings toggle only appears when a key is set.** A build with no
    key sends nothing, so it offers nothing to switch, and a fork that
    empties the key doesn't show "Send crash reports to Kevin". Off clears
    what was waiting. The copy follows the list's existing voice (lowercase
    sub-line, `·` separator): "Send crash reports to Kevin" / "with your
    name and phone type · never notes or crew links".
15. **Noise dropped outright:** `ResizeObserver loop …` (a benign browser
    notice) and a stackless `Script error.` (a cross-origin script's error
    with nothing in it). Neither would tell Kevin anything, and both would
    page him.
16. **`sync:blocked` is recorded** (a deterministic 400/413 refusal of a
    push) with the status and the server's reason. Every `fail()` message in
    `api/_lib/crew-shared.mjs` was read: they name people, paths and limits,
    never note text.
17. **Not done in this slice:** `api` 5xx reports from the client. The
    service worker answers a failed `/api/` fetch with a synthetic 503, so a
    client can't tell "offline" from "server error" without guessing. The
    server-side reporter (DESIGN §2c, full build) sees real 5xx at the
    source.
18. **Following the alert design** (coordinator, 2026-09-25):
    a. frames: `platform: "custom"`, `lang: "javascript"`, `function: "?"`
       when unknown, crash site LAST;
    b. device in PostHog's own keys and posthog-js's values: `$device`
       (`iPhone`/`iPad`/`Android`), `$device_type`, `$os` (`iOS`, `Mac OS X`
       …), `$os_version` (major, as a string), `$browser` (`Mobile Safari`,
       `Chrome iOS` …), `$browser_version` (major, a number). A home-screen
       app's user agent has no `Version/`, so its Safari major is iOS's.
       `engine` stays (every iPhone browser is WebKit). The user agent itself
       never leaves;
    c. `$issue_name` for vague kinds only: `zoom-close-after-click` → "Zoom
       closed right after a click", `sync:blocked` → "Server refused a sync",
       `module-load` → "App code didn't load", and any network failure
       (`Failed to fetch`, `Load failed`, …) → "Network request failed".
       Never for `boot`;
    d. `build`, `screen`, and `member_name` (the name in the crew) as Eachie
       names them;
    e. nothing is pre-formatted: every value is plain text.
19. **Stamp: a real bump to v88, then `--keep`.** v87 was live when this
    branch stamped (`curl` on fest.kevinhg.com: v87, `63f88365`). `--keep`
    would have shipped the new errlog.js under v87's version, and phones
    already holding v87 would never fetch it. Later re-stamps on this branch
    use `--keep` (v88 is unreleased). The coordinator re-stamps again on
    `release/v88`.

## What changed from DESIGN.md, and why

| DESIGN said | Built | Why |
|---|---|---|
| §2a rewrite `/fn-i/:path(.*)` | exact `/fn-i/batch` | not a general proxy (decision 8) |
| §2b device fields `engine`/`os`/`os_major` | PostHog's `$device`, `$os`, `$os_version`, `$browser`, `$browser_version`, `$device_type`, plus `engine` | the shared Slack template and PostHog's own filters (decision 18b) |
| §2c "situation" names `name` | `member_name` | Eachie's name for it (decision 18d) |
| §2d.2b redact member names | names ride along; not redacted | Kevin's Decision 3 |
| §2d.2c redact `#g=`, `?t=`, `me=`, `f=` values | every URL's query and hash dropped, every `?x=`/`#x=`/`&x=` parameter, plus any token-shaped run | "never a URL hash or query string" from the brief, by construction |
| §2d.4 pid not sent | pid sent, PID_RE-checked | Kevin's Decision 3 |
| §2e.3b hide via `fetch(keepalive)` | `sendBeacon`, ordered after the crew's beacon | the brief; ordering (decision 10) |
| §2e.5 Diagnostics line "n waiting / all sent" | the Diagnostics JSON carries `reports` and `reportsWaiting`; no new on-screen line | the brief left it out of this slice; the paste still answers "did Kevin get it" |
| §2c.3 kind `api` (5xx) | not built | decision 17 |
| §4b.4 toggle "crash reports and usage", plus a line in How it works | "Send crash reports to Kevin", Settings only | Kevin's Decision 4; usage isn't in this slice |
| §4b.6 CLAUDE.md law after ACL | added now, one bullet | the rule applies from v88; a session adding an SDK would silently undo the privacy design |
| (not in DESIGN) | module-load capture, the early inline-module hook, the worker's build answer | decisions 3 and 7 |
| §2f rule 4 "within 30 minutes" | "within the hour" | insight alerts check hourly at best on this plan (slack-alert-design §3) |

## PostHog-side setup (not this build's job)

Done by the coordinator (2026-09-25): the "Festival Navigator" project (627900,
US cloud, America/Chicago), "Discard client IP data" ON, session recording,
autocapture, console-log and performance capture OFF.

Still needed:

1. **Connect Slack in project 627900** (Settings → Integrations; Kevin's
   consent screen). Integrations don't carry over from Eachie.
2. **Error-tracking alerts** with the shared Hog source (slack-alert-design
   §5–§6), channel `C0A2CDKCZP1`: new issue (a `kind = boot` issue reads 🔴
   "App won't open"), and issue reopened. Consider filtering
   `$exception_level = warning` (the zoom-close journal) out of the
   new-issue alert, or letting it through deliberately.
3. **Insight alert "3+ phones can't sync"** is not possible yet: this slice
   sends no `sync_state` events (health events come in the gap before ACL).
   It checks hourly at best on this plan.
4. **Ingestion transformation** that drops `$current_url`, `$referrer`,
   `$pathname`, `$el_text` if they ever arrive (DESIGN §2d.6), a second
   layer for a future session that adds an SDK without reading CLAUDE.md.
5. **Test-account filter**: `host` in (`local`, `preview`, `stage`) marks
   Kevin's own testing; `host` = `fest`/`festival`/`crew` is the field.
6. **The first real report**: send one deliberate test error from a real
   phone on a preview deploy, then read the issue page (does PostHog group
   the hand-built `custom` frames sensibly; does it show build, device and
   the crash site) before trusting it. The coordinator will run this once
   Slack is connected, so it also exercises the message. Ask first.
7. **The "Festival health" dashboard** (DESIGN §2g) waits for the usage and
   health events.
8. Note: a wrong-but-well-formed key gets `{"status":"Ok"}` (200) from
   PostHog and is dropped later (probed with a bogus key), so the client
   can't detect a bad key. Step 6 is the only real check.

## Open questions

1. Kevin: the toggle copy is my call ("Send crash reports to Kevin" / "with
   your name and phone type · never notes or crew links"). Change freely.
2. Kevin: `zoom-close-after-click` was a bug-hunt journal entry (a named
   close right after an overlay press). It now reaches PostHog as a
   `warning`. Keep it in Slack, or filter it out (setup item 2)?
3. A page that fails to parse (old Safari) is still a blank page; this slice
   only makes sure Kevin hears about it. A static fallback screen in
   index.html would be the follow-up.

## Tests

1. `tests/errlog-scrub.test.mjs`: 1,000 fresh server-shaped tokens in 13
   contexts each (no 10-character piece survives), a no-digit camelCase
   token, exact-match secrets below the shape length, the pid passing
   through, URLs, JSON snippets (paired and lone quote), emails, real V8 and
   WebKit stacks with tokens in the URL and the function name.
2. `tests/errlog-queue.test.mjs`: no key, a `phx_` key, the full payload
   shape, the pid/name shape checks, fold + per-session cap, bounds, usage
   evicted first, expiry, survives a reload (same uuid), offline then
   `online`, failed/refused sends, Stay offline, toggle off, a throwing
   storage GETTER, a store that refuses writes, a sender that throws
   synchronously, the beacon with a receiver-strict `sendBeacon` (marks,
   no double beacon, same-uuid resend), a refused beacon, Low power, the
   crew-beacon-first ordering, the worker's build answer patching queued
   reports, the hooks (uncaught, rejection, module-load, a parse error keeps
   its file), the device keys across 8 user agents, `$issue_name`.
3. `tests/errlog-boot-crash.test.mjs`: the real shell; a crash this test
   writes on purpose (the crew doc's `people` getter throws with a crew link
   and the person token in its words) reaches the error screen, the
   journal, the queue (fatal, pid, member_name, scrubbed) and exactly one
   scrubbed request on `online`.
4. `tests/errlog-settings-toggle.test.mjs`: the real shell; on by default,
   the line says the name goes, same component as its neighbours, off saves
   to the device and clears the queue without touching the crew doc, back
   on, no key → no toggle.
5. `tests/sw-data-network-first.test.mjs`: `/fn-i/` passes through for GET
   and POST; the build answer.
6. `tests/brand-assets.test.mjs`: the external rewrite host is pinned.
7. `tests/browser/error-report.test.mjs`: a real page, a real engine, a
   thrown error from a page script → exactly one request to `/fn-i/batch`,
   no token in the bytes, one event (the early hook and app.js share one
   reporter). Two harness traps found and written into the test: a throw
   inside `page.evaluate` never reaches window's error event, and under
   Playwright's pinned clock a throw inside `setTimeout` never escapes.
   Jsdom tests that boot the app pin `Date` (coordinator's rule: at night
   NOW renders during boot).

## Log

- 2026-09-24 evening: BUILD.md banked; errlog, the worker's build answer,
  the rewrite, the shell (early hook, meta, dead Vercel Analytics tag
  removed), sync, app, settings committed in scoped commits. Merged
  origin/main (v87 released with the night-time `getComputedStyle` fix, which
  had failed 50 jsdom tests at night on the `de41fec` base). Stamped v88 (a
  real bump). First push; CI run 36105874795 green.
- 2026-09-25 early: the alert design's fields, the project key, the tests,
  the browser test; merged origin/main (`28f8c45`, data only); re-stamped
  `--keep` (`b15a4a5d`). Unit suite locally: 862 tests, 861 pass, 1
  pre-existing skip.
