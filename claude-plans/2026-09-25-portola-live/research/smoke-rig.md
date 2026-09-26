# Post-ship prod smoke test — how to run it, and what it found

> **Current implementation (2026-09-25, later):** the committed smoke is `ops/prod-smoke.mjs` and the clock helper is `tests/helpers/night-clock.mjs`. They supersede the scratchpad scripts described below (which hard-coded v89 and wrote beside themselves); the run records below are kept as history.

**Slice:** a two-minute post-ship smoke test that proves production boots on
phones, without writing to the production database. Read-only throughout —
no push/merge/deploy/rollback, no DB writes, nothing typed in.

**Script:** `/private/tmp/claude-505/-Users-kevinhalladay-glynn-DevKev-personal-festival-navigator/ad85413b-2402-4df6-89fc-d9f0bc11c9d7/scratchpad/smoke/prod-smoke.mjs`
(single Node/Playwright script, ESM, no test framework — meant to be moved
into the repo, e.g. `scripts/prod-smoke.mjs`, later).

## What it checks

1. **`GET /service-worker.js` from all three production hosts** (fest.,
   festival., crew.kevinhg.com) — parses `CACHE_VERSION` and `ASSET_STAMP`
   out of the response text with a regex and reports whether each host
   matches an expected build string (default `festival-nav-v89`).
2. **A phone-shaped browser boot with no crew link.** WebKit (`devices['iPhone 14']`
   — 390×664 CSS px, Safari UA, real touch) if installed, else Chromium with
   the same device descriptor. Navigates to the base URL with **no `#g=...`
   hash**, so the app can only reach the crew-less landing screen
   (`#screen-landing` in `index.html` — "FESTIVAL NAVIGATOR / Pick artists
   with your people... ADD A FESTIVAL / YOUR FESTIVALS: Nothing yet"). This
   is the most meaningful no-crew, no-write screen: `js/festivals.js` and the
   app boot only call `GET /data/festivals/index.json` here, never
   `/api/crew` or `/api/person` (confirmed empty `blockedWrites` on every
   clean run — the guard never even had to fire).
3. Collects: `console` messages of type `error`, `pageerror` events, `requestfailed`
   events, a screenshot, whether the service worker registered
   (`navigator.serviceWorker.getRegistration()` → `active`/`installing`/`none`),
   and a 400-char text sample of the rendered body (cheap "did real copy
   render, not a blank div" check).
4. **Write guard (belt + suspenders):** a Playwright route handler aborts and
   logs any **non-GET request to `/api/*`**, and separately aborts any
   request to `/fn-i/*` (the PostHog telemetry relay defined in
   `vercel.json`) — a synthetic smoke run has no business writing real
   events into Kevin's production PostHog project mid-festival. Both are
   reported in `blockedWrites`, which factors into pass/fail.
5. Writes `report-<timestamp>.json` (full detail) and
   `screenshot-<host-slug>.png` per run into the script's own directory.

Exit code 0 only if every host matches the expected build **and** the
browser check had zero console errors, zero page errors, zero failed
requests, zero blocked-write attempts, and the landing screen actually
became visible.

## How to run it

```
cd <the smoke script's directory>   # needs a `playwright` node_modules next to it
node prod-smoke.mjs [baseURL] [expectedBuild]
# defaults: baseURL=https://fest.kevinhg.com, expectedBuild=festival-nav-v89
```

For this run, since the script lives outside the repo (in the session
scratchpad) but Playwright is a devDependency of the worktree, I symlinked
`node_modules` from the worktree into the scratchpad smoke folder so the
script's `import { chromium, webkit, devices } from 'playwright'` resolves:
```
ln -sf <worktree>/node_modules <scratchpad>/smoke/node_modules
```
Once the script moves into the repo proper this symlink is unnecessary — it
will resolve `node_modules/playwright` normally.

**Playwright engines installed** (checked `~/Library/Caches/ms-playwright/`
and `node_modules/.bin`): `playwright@1.58.2`, with **both Chromium
(1208/1223/1234) and WebKit (2248/2311) installed** — the script prefers
WebKit for the most realistic iPhone-Safari signal and only falls back to
Chromium if the WebKit launch throws.

Reused from the existing rig rather than reinvented:
- `claude-plans/2026-09-01-walk-rig/README.md` — the pattern of a detached,
  bank-as-you-go script hitting real production with a made-up/no crew,
  and the "the SW gate needs a hard reload, not a hope" lesson.
- `tests/helpers/browser.mjs` — confirms the repo's own convention for
  launching a browser with a chromium→chrome-channel fallback (I mirrored
  the shape but added the WebKit-first preference since this slice is
  specifically about the iPhone signal).
- `tests/browser/zoom-chrome-contract.test.mjs` — confirms the pattern for
  routing `**/api/**` in Playwright (last-registered route wins, so a
  catch-all must be handled carefully — not an issue here since this smoke
  test's guard is a single route across the whole context, not a stack of
  fixtures).

## Results — run against production just now (2026-09-25, ~5:04–5:05 PM PT)

### Run 1 — `https://fest.kevinhg.com` (the live alias, what real people hit)

- **Wall clock: 8.0s total** (3 sequential SW fetches ~0.3–0.5s each + one
  browser boot ~6.5s including WebKit launch).
- All three hosts: `CACHE_VERSION=festival-nav-v89`, `ASSET_STAMP=4ad32b2f`,
  matches expected build. **This matches NOW.md's recorded v89/4ad32b2f
  exactly** — production is serving what the docs say it's serving.
- Browser: `navOk=true`, `landingVisible=true`, `swRegistered="active"`,
  **zero** console errors, page errors, failed requests, and blocked writes.
- Body sample confirms real rendered copy: *"FESTIVAL NAVIGATOR / Pick
  artists with your people. Works with no signal. ADD A FESTIVAL → / Add
  your fests, then your people. Got a link? Just open it. / YOUR FESTIVALS /
  Nothing yet — add a festival or open a link someone shared."*
- Screenshot: clean, on-brand landing screen, no layout breakage at
  390×664 (`screenshot-fest.kevinhg.com.png`).
- **RESULT: PASS.** Production boots clean on a phone-shaped browser right
  now, with zero errors. This is a real, positive finding, not a null result
  — the app genuinely reached a fully-rendered no-crew screen with an active
  service worker in about 5 seconds of navigation-to-settle time.

### Run 2 — the unique URL of the current production deployment

`vercel ls --prod` (read-only) in the worktree shows the most recent
production deployment as `dpl_Cr5mNCTXNNSXsgRe5dYK7XBsKSFw`,
`https://festival-navigator-ox2oa516m-kevinhg.vercel.app`, created ~17 min
before this check, target=production, status=Ready. `vercel inspect` on that
URL (read-only) confirms its aliases are exactly the live custom domains
(`crew.kevinhg.com`, `fest.kevinhg.com`, `festival.kevinhg.com`, plus
`dev.fest.kevinhg.com` and three `*.vercel.app` names) — **so it is the
same build as Run 1**, not a different, untested one.

- **Wall clock: 27.2s total** (SW fetches ~0.2–0.3s each; browser check
  ~26s — much longer than Run 1).
- `curl -o /dev/null -w '%{http_code}'` on `<url>/service-worker.js` directly
  returned **302 Redirecting...** — not the app's SW at all.
- The WebKit browser landed on **`vercel.com`'s own login page** ("Log in to
  Vercel" — Continue with Email/Google/GitHub/ChatGPT/SAML SSO/Passkey),
  confirmed by both the body-text sample and the screenshot
  (`screenshot-festival-navigator-ox2oa516m-kevinhg.vercel.app.png`).
- `pageErrors` picked up a stray `ResizeObserver loop completed with
  undelivered notifications.` and two Beacon-API-blocked console errors —
  **these are Vercel's own login page's telemetry failing under
  automation, not a festival-navigator bug.**
- The write guard correctly fired three times and aborted: two POSTs to
  `vercel.com/api/stream/internal` and `vercel.com/api/jwt` (Vercel's own
  session/analytics calls) and one POST to a Sentry ingest endpoint under
  `o205439.ingest.sentry.io` — **that Sentry project is Vercel's own
  dashboard's error reporting, not festival-navigator's** (this repo's only
  telemetry door is `js/errlog.js` → PostHog; it has no Sentry SDK — grepped
  `js/` and found none). None of these are festival-navigator writes; the
  guard did exactly what it was built for and nothing reached `/api/crew`,
  `/api/person`, or any real app endpoint.
- **RESULT: FAIL — but not an app failure.** The raw unique `.vercel.app`
  production deployment URL is gated behind **Vercel's own account-level
  Deployment Protection** (a login/SSO wall on the ephemeral URL), separate
  from festival-navigator entirely. This is expected Vercel behavior when
  Deployment Protection is set to cover all deployments including
  production, not just previews — it is not something this read-only slice
  can fix or verify further (no login attempted, per the ground rules).

### What this means for the smoke script going forward

- **For a real post-ship check, run the script against the aliased custom
  domains (`fest.kevinhg.com` etc.), not the raw `.vercel.app` deployment
  URL** — the aliases work headless with zero auth friction and are exactly
  what real phones hit.
- If a future session wants to smoke-test a *brand-new* deployment **before**
  it's promoted/aliased (e.g., to catch a broken preview before flipping
  traffic), the unique URL will need a **Deployment Protection bypass
  token** (Vercel project setting → "Protection Bypass for Automation",
  sent as `?x-vercel-protection-bypass=<token>` or the matching header).
  That's a dashboard setting change, out of scope for this read-only slice —
  flagging it as a possible one-time setup Kevin could do from his phone if
  he wants pre-promotion smoke checks later.
- `dev.fest.kevinhg.com` showed up as a 4th alias on the same deployment,
  beyond the three hosts named in the brief — FYI only, not checked here.

## What a crew-level smoke would need (not built, not run)

To smoke-test past the landing screen — actually opening a crew, seeing the
festival wall, a pick rendering — would need a **real crew token that exists
in the production Neon DB**, since `GET /api/crew?t=...` 404s/empty-states
for an unknown token rather than fabricating one. That means:

1. **Deliberately creating** a `zz-`-prefixed demo crew via `POST /api/crew`
   (per the repo's own Neon-cleanup convention — `Neon test-row cleanup`
   memory note: single-member, clearly-named test crews are Kevin's to make
   and clean up) — a real write, which this slice was told not to do.
2. Driving the join flow, adding one demo person, picking an artist or two,
   confirming the wall renders and a pick round-trips through
   `jsonb_deep_merge` correctly.
3. **Deliberately deleting** that crew/person row afterward so it doesn't
   linger in production data (the repo's cleanup convention again).
4. Never using a real friend's crew token for this — per CLAUDE.md, "Staging
   writes are prod writes; test with throwaway crews/persons and delete them
   after," and the same logic applies to any crew-level prod smoke.

This is a reasonable **next slice**, but it is a write-capable one and needs
either Kevin's go-ahead in chat before the session that builds it runs, or
to run in a session explicitly scoped to do that create+verify+delete cycle
end-to-end in one pass (never leaving a demo crew behind between runs).

## Permission/tooling notes

- No tool calls were denied by the permission classifier during this slice.
- `vercel whoami` confirmed the CLI is authenticated as `kevinhg` in this
  worktree; `vercel ls --prod` and `vercel inspect <url>` were used
  read-only (no `--prod` deploy, no `vercel deploy`, no `vercel promote`,
  no `vercel rollback`).
- No secret values were printed. The PostHog project id (627900, from
  NOW.md) and the Sentry DSN project id seen in Run 2's blocked URLs
  (`o205439`/`1323670`, `sentry_key=d00780d432ac4ccf882f60dd02062e14`) are
  **Vercel's own dashboard's public DSN**, not festival-navigator's — shown
  here because they're not secrets (a Sentry `sentry_key` in a browser
  envelope URL is a public client key by design, same as PostHog's project
  API key already being public in `index.html`'s `fn-report-key` meta) and
  because they're evidence for the finding above, not credentials to this
  app.
