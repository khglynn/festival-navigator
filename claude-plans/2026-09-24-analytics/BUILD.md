# v88 error capture: build log (2026-09-24)

**Branch:** `feat/error-capture`, cut from `origin/feat/now-jump` (v87,
`de41fec`). Worktree: `.claude/worktrees/analytics`. Upstream unset on
purpose, so a bare push can never land on `feat/now-jump`.
**Scope:** DESIGN.md §4a's errors-only slice as its own release (Decision 7),
with Kevin's Decisions 3–5 applied. No usage or health events.
**Cut line:** green and independently reviewed by Fri Sep 25, 12:00 CT, or it
moves to the Sep 28 – Oct 1 gap.

## Where things stand

Written as the build goes. The newest state is at the bottom of "Log".

## Decisions made while building (and why)

1. **errlog.js stays a leaf module and learns the app's facts through
   `configureReports()`.** app.js hands it two functions at load: the
   context (festival id, the public pid, the person's name in the crew) and
   the device's secrets (every crew token it holds, the person token, the
   pending-absorb token). No storage key for tokens or names is copied into
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
   so app.js's `hookGlobalErrors()` becomes a no-op second call.
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
   old Safari can't parse.
5. **PID-shaped runs (10–16) are not redacted.** Pushback on the brief's
   "anything shaped like PID_RE": the pid is public by design and Kevin
   chose to send it, and PID_RE's range is disjoint from TOKEN_RE's
   precisely so a pid can never pass as a token. Redacting 10–16 character
   runs would redact most identifiers in every message. The pid property is
   checked against PID_RE before it's sent, so a token can't ride in that
   slot either.
6. **The cost of rule f, accepted:** a long identifier in a message
   (`getBoundingClientRect is not a function`) reads `‹token› is not a
   function`. No camelCase exemption, because a random token can be all
   letters (about 7 in 100,000 22-character tokens would pass a camelCase
   test). Nothing is lost for debugging: every frame carries its file, line
   and column, and there's no bundler, so `/js/v3/app.js:2488:12` at a known
   build is the exact line.
7. **Build and stamp come from the service worker that controlled the page
   when it loaded.** errlog asks `navigator.serviceWorker.controller` over
   `postMessage`; the worker answers with its `CACHE_VERSION` and
   `ASSET_STAMP`. The page's JavaScript came out of that worker's cache, so
   that's the build that threw, even after a newer worker takes over (the
   "v75 shell judging v76 code" case). With no controller, it falls back to
   the cache names, and reports `sw: none`.

## Open questions

(none yet)

## PostHog-side setup (not this build's job; Kevin or the alerts agent)

(filled in as the build goes)

## Log
