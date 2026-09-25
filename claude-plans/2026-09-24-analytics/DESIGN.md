# Errors and usage analytics: design (2026-09-24)

**Status:** a design to decide from. No app code was written and nothing was
committed. Every claim about today's app was checked against `main` (v86,
`e907f68`) and the live hosts on 2026-09-24. Sources and account reads are
in §6.

**Kevin's ask (2026-09-24):** "what would analytics capture that we don't
have now? yes I'd like analytics well designed especially for errors but
also for usage? figured we had this."

## Decisions (Kevin, 2026-09-24 ~4:15 PM CT)

Kevin: "I'm good with your calls on all of those." Where he added more, his
words decide:

1. **PostHog**, a new project. Slack alerts go to **the channel Eachie's
   PostHog already posts to** ("you can use the slack channel eachie uses").
2. **Eachie's PostHog is part of this work.** Kevin: "we've neevverrr had
   posthog eachie look/work well. the messages have always been garbled
   trash… both have improved. I'd love if we could fix theirs as we build
   ours and not repeat mistakes but make it the best possible build we can."
   So the Slack message design is shared, and Eachie's alerts get audited
   and rebuilt alongside ours.
3. **Names may ride along.** Kevin on question 5: "linking to the name is
   fine… it's just a nickname they choose right? nbd." Error and usage
   events may carry the person's public `pid` and their crew display name.
   Crew tokens, the person token and notes text still never leave the
   phone. This supersedes the "device only" lean and the "strip member
   names" rule in §2d, which now apply to tokens and free text only.
4. **Disclosure lives in Settings, not How it works.** Kevin: "a setting for
   name and switch is fine. doesn't need to be in how it works… just
   settings by the toggle." One toggle (on by default), with a line beside
   it saying what's shared, including your name.
5. **The dead Vercel Analytics tag goes** (the lead's call).
6. **The health events land before ACL** (the lead's call).
7. **Timing (the lead's call, changing §4a):** v87 ships as it stands.
   It's fully reviewed, and friends should have it for tonight's afters.
   Error capture goes out as **v88**, under the same cut line: green and
   independently reviewed by **Fri Sep 25 noon CT**, or it moves to the
   Sep 28–Oct 1 gap before ACL. Phones updating twice in two days is cheap
   (the idle-reload rule), and restarting v87's review for new outbound
   code isn't worth it.

## 0. The short version

1. **What we have is smaller than we thought.** The Vercel Analytics tag in
   `index.html` returns a **404 on every open**, because Web Analytics was
   never switched on. Server errors stay in Vercel's logs for **one day**.
   Phone errors sit in a 20-entry journal that only leaves the phone if a
   friend copies it and pastes it to you. And the worst failure, a boot
   crash, **never reaches that journal at all.**
2. **Recommendation: one outbound path that we own, with PostHog storing
   the data.** Grow `js/errlog.js` into the app's only way to send data
   out. It sends errors and a short allowlist of usage events. It holds them
   in a queue on the phone while there's no signal, and sends them once a
   sync succeeds. The destination is a new PostHog project, reached through
   a same-origin Vercel rewrite. There is **no third-party script on the
   page**, so nothing gets recorded automatically that we'd have to scrub
   later. PostHog does the grouping, the Slack alerts (your personal
   "Trimm" Slack is already connected there), the dashboards and the SQL,
   and the PostHog MCP worked in this session. Cost at this scale: $0.
3. **Why not Sentry, which is the better error tool on paper?** Three
   reasons, all checked today. Your Sentry is on the free plan, so alerts
   only go to email; Slack needs Team at $26/mo. Its free quota is already
   shared by eachie, list-maker and record-os. And the no-build CDN bundle
   **can't queue errors offline**: the offline transport isn't in it (the
   v11.0.0 bundle was checked). Its automatic capture also sends the page
   URL with the crew token, the referrer, and click trails that include
   friends' names. That can be scrubbed, but it's four hooks you'd have to
   keep right forever.
4. **Before Portola:** ship the errors-only slice, but only as part of the
   v87 release, so friends' phones update once and not twice. It's the same
   code the full design keeps, not a throwaway. Cut line: if it isn't
   reviewed and green by **Fri Sep 25, noon CT**, v87 ships without it, and
   it goes out in the gap between Portola and ACL (Sep 28 – Oct 1).
5. **After ACL:** the full event list, a session summary, server-side error
   reports, the dashboard, an off switch for friends, and a line in the
   Diagnostics panel saying what has been sent.

## 1. What we can see today vs what we can't

### What was believed, and what is actually true

| Belief | True? | What the code and the platform say |
|---|---|---|
| Neon holds crews, picks and notes, so usage can be counted afterwards | **Partly** | The crew doc holds each person's *current* pick level per artist (0–4) and every note with its own `ts`. It does **not** record when a pick was made, any history of changes, app opens, views, or who was last active. Timestamps exist only for the whole crew row (`created_at` / `updated_at` in `db/schema.sql`). So you can count "how many musts does Ross have now", but never "when did people use it". |
| Vercel function logs catch server errors | **Yes, for one day** | `api/crew.js`, `api/person.js`, `api/festival-add.js` and `api/access.js` all `console.error` when they throw, so a 500 appears in the runtime log. The team is on **Pro**, where runtime logs are kept for **1 day**. No log drain is set up. A refused merge or a rate limit (4xx) doesn't log a line at all. The log detail also shows each request's search params, which means **crew tokens from `?t=` are sitting in those logs** (see finding 2 below). |
| There's an in-app Diagnostics panel with a build line and recorded events | **Yes** | `js/errlog.js` keeps the last **20** entries in `localStorage` (`fn_errlog_v1`). They come from the global `error` / `unhandledrejection` hooks (`hookGlobalErrors`, wired at the top of `js/v3/app.js`) and from three deliberate `record(...)` calls in `js/v3/card-facts.js`: the zoom airbag (`zoom:<where>`) and `zoom-close-after-click`. Settings → App → Diagnostics copies a JSON dump containing the build (the service worker's cache name), user agent, viewport, online state, the motion facts and the errors. It only leaves the phone if a friend taps it and pastes it to you. |
| There's an analytics tag in index.html, but Vercel Web Analytics is off | **Yes, and the tag 404s** | `index.html` loads `/_vercel/insights/script.js` (the last line). The project API reports `features.webAnalytics: false`, and `curl` on that path returns **404 on fest, festival and crew.kevinhg.com**. So every open fires one failed request and records nothing. Speed Insights *is* switched on for the project (its script answers 200), but the page never loads it, and the project reports `hasData: false`. The service worker already skips caching anything under `/_vercel/`, which is right for either script. |

### Three things nobody listed

1. **A boot crash is never journaled.** When boot throws, `js/v3/app.js`
   catches it, calls `console.error('boot failed', e)` and shows the "WELL,
   THAT WASN'T THE PLAN" screen. It never calls `record(...)`, and a
   *caught* error never reaches the global hooks. So the worst failure the
   app can have is the one Diagnostics can't see. The same goes for the two
   `console.warn('warm open: …')` catches.
2. **The crew token travels in a query string on every sync.** `js/sync.js`,
   `js/crew.js`, `js/spotify.js`, `js/v3/app.js` and `js/v3/settings.js`
   all call `/api/crew?t=<token>` or `/api/festival-add?t=<token>`. That's a
   known, accepted trade-off: `api/person.js` says the `?t=` exposure "is
   scoped to one crew". But it means Vercel's request logs already hold
   crew tokens, for a day. For analytics it matters more: **every error
   SDK records fetch URLs as breadcrumbs by default**, so an unconfigured
   Sentry or PostHog would send crew tokens to a third party on the first
   sync error. It also argues against switching on Vercel's 30-day log
   retention (§3) without first moving the token out of the query string.
3. **A Slack webhook already exists.** `api/access.js` posts Spotify access
   requests to `SLACK_WEBHOOK_URL`, which is set on the project. I didn't
   check which workspace it points to, because reading the value means
   decrypting a secret.

### The plain-words table

| Question you might ask during a festival | Can we answer it today? | How, or why not |
|---|---|---|
| Did the app crash on someone's phone? | **Only if they tell you** | Only the 20-entry journal on that phone, pasted by hand, and boot crashes aren't even in it. |
| Which build is each friend actually running? | **Only if they paste Diagnostics** | Nothing reports the build back. |
| Is the server throwing errors? | **For the last 24 hours, if you go and look** | Vercel runtime logs (Pro, 1 day). No alert. |
| Is sync failing for someone (the red dot)? | **No** | That state only lives on their screen. |
| Is the service worker serving someone a stale app? | **No** | The build line exists, but it never leaves the phone. |
| How many people opened the app today? | **No** | No usage events. Web Analytics is off and its tag 404s. |
| Who picked what, and at what level? | **Yes, as it stands right now** | Query the crew doc in Neon. There's no history of changes. |
| When were notes written? | **Yes** | Each note carries its own `ts`. |
| Does anyone use NOW, the zoom, Spotify, the day image? | **No** | Nothing counts feature use. |
| Did the warm open work (painting from what's saved on the phone)? | **No** | The phone decides, and reports it nowhere. |
| How fast does the app open on a festival network? | **No** | Nothing measures it. Speed Insights is enabled but never loaded. |

## 2. Recommended design

### 2a. Which tool for errors, which for usage: the same one

**One outbound path that we own, with PostHog as the store.**

1. **The path.** `js/errlog.js` grows from a crash journal into the app's
   only door for outbound data, and it keeps its name and its existing job.
   It exposes two calls:
   a. `record(kind, err)`: exists today. It gains scrubbing, stack
      parsing and queueing.
   b. `track(name, props)`: new. It only accepts event names and property
      values from a fixed allowlist (§2b). An unknown name, an unknown key,
      or a value outside its allowed set gets dropped, and the drop is
      counted. This is the project's "validate at write time" rule applied
      to analytics, so nothing free-text can ever travel.
2. **The store.** A new PostHog project called `festival-navigator` in your
   `KHG` organisation. That org is on a paid, pay-as-you-go plan and
   can hold 6 projects; it has 1 today. Events go to PostHog's documented
   capture endpoint as plain JSON, and errors go as `$exception` events, so
   PostHog's error tracking groups them into issues.
3. **The route.** A same-origin rewrite in `vercel.json` (for example
   `/fn-i/:path(.*)` → `https://us.i.posthog.com/:path`, which is PostHog's
   documented Vercel proxy, using a path name that doesn't look like
   analytics). This has three benefits:
   a. Content blockers on iPhones don't silently eat the reports.
   b. The browser never talks to a third-party origin.
   c. POSTs already bypass the service worker (`service-worker.js` returns
      straight away when the method isn't GET), so nothing new is ever
      cached.
   The app sets no cookies and has no content security policy, so the proxy
   carries nothing extra.

**Why this beats the alternatives here** (the full comparison is in §3):

- **No SDK means nothing to scrub.** Both the Sentry SDK and the PostHog
  SDK record `location.href` automatically, and here that includes
  `#g=<crew token>`. They also record the referrer and click targets with
  their `aria-label` / `title` (in this app, `you.title = ctx.meName` and
  chips labelled "Show only Ross's picks"). Our path only ever sends fields
  we wrote.
- **It works offline because it was built to.** The queue lives in the
  same `localStorage` the app already trusts. The Sentry CDN bundle has no
  offline queue. posthog-js keeps its retry queue in memory only, so
  anything captured offline is lost when the app is closed. Its "store
  events for offline use" issue #1583 is still open.
- **Minification doesn't matter.** There's no bundler, so a stack frame
  already reads `/js/v3/card-facts.js:994:3`, with no source maps needed.
  Each report carries `CACHE_VERSION` and `ASSET_STAMP`, so a line number
  maps straight to the right commit.
- **Alerts reach you for free.** PostHog error-tracking alerts support
  Slack, and your org already has a Slack integration to the Trimm
  workspace (it was connected on the Eachie project, so it needs one
  reconnect click on the new project). With Sentry, Slack would cost
  $26/mo.
- **Agents can query it.** The PostHog MCP answered in this session. The
  Sentry MCP timed out.

**What this gives up, honestly:**

1. PostHog's grouping depends on us sending a well-formed `$exception`
   (type, value, stack frames). We have to parse V8 and WebKit stack strings
   ourselves, which is about 30 lines. Tests pin real stack strings from
   both engines.
2. Sentry's breadcrumbs ("what happened just before") come for free. Here
   they come from our own event stream, which is actually better, because
   it's already scrubbed (§2c).
3. It's one more vendor holding data. It holds only allowlisted,
   name-free, token-free fields, with IPs discarded.

### 2b. The usage event list

**Properties sent with every event.** No names, no tokens, no URLs:

| Property | Values | Why |
|---|---|---|
| `build` | `v87`, `v88`, … (from `CACHE_VERSION`) | Answers "who is on a stale app" |
| `stamp` | the `ASSET_STAMP` hash | Separates two builds that share a version |
| `fest` | a catalogue festival id (`portola-2026`, `acl-2026`), or `custom` for any crew-private festival | Public lineup ids only |
| `screen` | `wall` · `settings` · `landing` · `join` · `create` · `badlink` · `error` | Which screen was showing |
| `standalone` | true/false (home-screen app vs browser tab) | Installed PWAs behave differently |
| `engine` / `os` / `os_major` | `webkit`/`blink`/`gecko` · `ios`/`android`/`mac`/`windows`/`other` · a whole number | Coarse on purpose. Enough to know where to test, and the full user agent is never sent |
| `low_power`, `reduced_motion`, `online` | true/false | Explains motion and sync reports |
| `session` | a random id per page load | Groups one open |
| distinct id | a random device id, made on first run and stored locally | Counts devices. PostHog person profiles are off (`$process_person_profile: false`) |

**The events.** Each one says which code writes it. Artist names are left
out on purpose: Neon already knows *what* was picked, and telemetry only
needs to know *how* the app was used.

| # | Event | When | Properties (allowed values) | Answers | Written from |
|---|---|---|---|---|---|
| 1 | `app_open` | each boot | `cold` (first boot of this page load), `sw` (`controlled`/`none`), `build_changed` (vs this device's last open), `path` (`warm`/`cold`/`landing`/`join`/`badlink`/`fatal`) | Opens per day, who updated | `boot()` in `js/v3/app.js` |
| 2 | `warm_open` | boot, when a crew is remembered | `result` `hit`/`miss`; `miss_reason` `no_member`/`no_cached_doc`/`no_saved_fest`/`no_cached_catalog`/`no_cached_fest_file` | Is the ~1.6 s warm open actually happening in the field | `canOpenWarm()` in `js/v3/app.js`, which today returns `null` for all five reasons and would need to name them |
| 3 | `first_paint` | once, when the wall first renders | `ms_to_wall` (whole ms from navigation start), `fcp_ms` (the browser's first contentful paint), `path` `warm`/`cold`, `nav_ms` (how long the page request took) | "How fast does it open at Pier 80", the lie-fi number | `enterApp()` after the first wall render, plus `performance` paint entries |
| 4 | `fest_view` | a festival becomes the one on screen | `via` `boot`/`switch`/`link` | Which fest people are in | the festival switch in `js/v3/app.js` |
| 5 | `day_view` | a day tab becomes active | `day_kind` `grid`/`stack`/`late_nights`, `day_index`, `is_today`, `via` `tab`/`now`/`boot`/`link` | Which days get looked at | the day tabs in `js/v3/app.js` |
| 6 | `pick` | a pick level changes | `from` 0–4, `to` 0–4, `via` `tap`/`zoom`/`sheet`/`bulk`, `surface` `grid`/`stack`/`strip` | Picks by level, and where people pick from | `recordSelection` / `recordSelectionFor` in `js/state.js`, the single writers for picks |
| 7 | `now_tap` | the v87 NOW tab is tapped | `stop` (index), `stops` (total), `wrapped` true/false, `highlight` true/false (a person is highlighted), `from` `dock`/`rail`, `landed` `now_line`/`first_now_card`/`person_pick` | Is NOW used, and does tap-after-tap get cycled | the `nowCycle` state on `feat/now-jump` |
| 8 | `zoom_open` | a card zooms | `route` `mouse`/`touch`/`keyboard`, `surface` | Zoom use by input type | `zoomCard(…, { source })` in `js/v3/card-facts.js` |
| 9 | `zoom_close` | a zoom closes | `why` (the existing cause strings, e.g. `dismissed (Escape)`, `card scrolled off screen`, as an enum), `dwell_ms` rounded to 250 | Accidental closes, the ghost-zoom class of bug | `unzoomInner({ why })` in `js/v3/card-facts.js` |
| 10 | `notes_open` | a notes sheet opens | `target` `fest`/`date`/`section`/`artist`/`all` | Which doors get used | `openFestNotes` / `openDayNotes` / `openArtistSheet` / `openAllNotes` in `js/v3/notes.js` |
| 11 | `note_write` | a note is saved | `target` (as above), `kind` `new`/`reply`/`edit`/`delete`, `len` `short`/`medium`/`long` | Notes use, **never the text** | `recordNote` in `js/state.js` |
| 12 | `spotify` | each Spotify step | `action` `connect_start`/`connect_ok`/`connect_fail`/`scan_start`/`scan_done`/`scan_fail`/`playlist_make`/`access_request`; `error_kind` (the enum from `lastError()`) | Where the Spotify flow loses people | `js/spotify.js` |
| 13 | `sync_state` | the sync dot **enters or leaves** `offline`, `error` or `blocked` | `from`, `to`, `ms_in_from`, `pending` (count of unsent changes) | Who hit a red dot, and for how long | `setSyncStatus()` in `js/sync.js`. `syncing`↔`online` churn is only counted, into #16 |
| 14 | `new_build` | the service worker hands over a new build | `action` `auto_reload`/`strip_shown`/`strip_tapped` | The stale-app bug class | the `controllerchange` glue in `index.html` and `fn:new-build` in `js/v3/app.js` |
| 15 | `share` / `settings` | invite, personal link, day image, export; the Low power and Stay offline toggles | `kind` (enum) / `setting` + `on` | Feature use | `js/v3/app.js`, `js/v3/settings.js`, `js/v3/tools.js` |
| 16 | `session_end` | the page goes hidden | `duration_s`, counts of `picks`, `zooms`, `now_taps`, `sync_pushes`, `sync_failures`, `dropped` (events the allowlist refused) | Counts that survive even if detail was dropped from the queue | a `visibilitychange` listener in `js/errlog.js` |

About 25 k events across both festivals (8 people × ~12 days × ~15 opens ×
~20 events), which is 40 times under PostHog's monthly free allowance.

### 2c. What each error report carries

Each error is one `$exception` event:

1. **The error.** `type` (`TypeError`, …), `value` (the message after
   scrubbing, capped at 300 chars), and `mechanism` (`handled` is true for
   our own `record()` calls and false for the global hooks; `synthetic` is
   true when there was no stack).
2. **The stack.** Parsed from the V8 (`at fn (url:line:col)`) or WebKit
   (`fn@url:line:col`) format into frames of `function`, `filename` (the
   path only, e.g. `/js/v3/card-facts.js`, never a query or hash), `lineno`,
   `colno`, and `in_app` (true under `/js/`).
3. **What kind.** The journal's own `kind`: `error`, `promise`,
   `zoom:<where>`, `zoom-close-after-click`, plus new ones: `boot` (the
   missing crash), `warm-open:catalog`, `warm-open:fest-file`, `sync:blocked`
   (a deterministic server refusal), and `api` (a 5xx from our own API, with
   `route` and `status` only).
4. **Which build.** `build` and `stamp`, the same as every event.
5. **The situation.** `screen`, `sync_state`, `online`, `standalone`, the
   motion facts `errlog.js` already gathers (`reducedMotion`, `lowPower`,
   `stripRoute`, `stripAnimation`), engine and OS, and the viewport rounded
   to 50 px.
6. **The trail.** The last 10 allowlisted events before the error, each
   with its time offset. These are the breadcrumbs, and they're safe
   because they already passed the allowlist.
7. **How late it arrived.** PostHog derives this from the event's own
   timestamp vs when it was sent, so an error recorded offline at 9:40 PM
   still shows 9:40 PM.
8. **Grouping.** PostHog groups by stack by default. For stackless kinds
   (`zoom-close-after-click`), we send `$exception_fingerprint` =
   `kind + why` so each cause is its own issue.

**Server errors (full build):** a small `api/_lib/report.mjs` sends a
`$exception` from each API catch block with `route`, `method`, `status`,
the scrubbed message and the stack. It **never** sends the query, the
headers or the body. It waits at most 800 ms, and only on a request that is
already failing. The Vercel logs stay as the backup.

### 2d. Privacy scrubbing: how each rule is enforced

Most of the protection comes from the design. Scrubbing is there for the
one free-text field an error has, which is its message.

1. **Nothing is collected automatically.** No SDK, no autocapture, no page
   URL, no referrer, no DOM text, no input values, no session replay.
   Every property on every event comes from the allowlist in §2b, and each
   property has a fixed set of allowed values.
2. **Precise redaction from what the phone already knows.** Before an
   error message or stack is queued, `errlog.js` swaps out every secret and
   name the device holds:
   a. every crew token in this device's crew list, and the person token;
   b. the active crew's member names (whole words, 2 characters or more);
   c. any `#g=`, `?t=`/`&t=`, `me=` or `f=` parameter value, by pattern.
      This catches a token from a crew the device hasn't stored yet.
   The replacements read `‹token›`, `‹name›` and `‹param›`. A pattern alone
   can't know "Ross" is a name, but the device does, so this is exact
   rather than a guess.
3. **Stack paths.** Only the path of each frame's URL is kept. The origin
   becomes `fest`/`festival`/`crew`/`other`, and the query and hash are
   dropped.
4. **The person token** already travels only in the `X-Person-Token`
   header, and our path never reads request headers. The public `pid` is
   **not** sent by default. Open question 5 asks whether you want it.
5. **IP addresses.** Turn on PostHog's project setting "Discard client IP
   data" (`anonymize_ips`), which is false on the Eachie project today.
   Whether PostHog sees the friend's IP or Vercel's through the rewrite
   wasn't checked, so the setting goes on either way.
6. **A second layer at PostHog.** Add an ingestion transformation to the
   project that drops `$current_url`, `$referrer`, `$pathname` and
   `$el_text` if they ever show up. They can't with this design, but that
   protects a future session that adds the SDK without reading this doc.
7. **Tests with teeth** (in CI):
   a. A payload test builds reports from errors whose messages contain a
      real-shaped token, a `#g=` URL, and every member name. It serialises
      the whole queued payload and asserts that none of those strings
      appear anywhere.
   b. A browser contract intercepts the rewrite path in Playwright, drives
      a crew open, a sync error and a note write, and asserts the same over
      the real network bytes.
   c. A `docs-truth` entry pins the allowlist, so adding an event means
      touching the list on purpose.
8. **Flagged as can't-be-made-safe-cheaply:** session replay. Even with
   masking, the invite box is an `<input>` whose value is the crew link,
   and a replay also records the location. Leave it off in every option.

### 2e. The offline queue: **queue and send later, with limits**

Dropping offline events would blind us exactly where the interesting
failures happen: lie-fi, the service worker falling back to its own copy,
a sync that won't take. So we queue.

1. **Where.** One `localStorage` key (`fn_telemetry_q_v1`). The app already
   stores everything there, reads are synchronous, and `errlog.js` already
   wraps every storage touch (including the getter, which throws in Chrome
   when site data is blocked). If storage is refused, the queue lives in
   memory for that session, the same as the journal.
2. **Limits.** At most 300 entries or 96 KB. When full, the **oldest usage
   events are dropped first**, and errors are only dropped by other errors.
   Errors expire after 7 days and usage events after 3, because a stale
   event isn't worth radio time. `session_end` counts are how totals
   survive a drop.
3. **When it sends.** Never on its own timer in the field. It sends:
   a. right after a **successful sync** (`js/sync.js` fires one event). A
      sync that succeeded proves the network works, and the radio is
      already awake;
   b. when the page goes **hidden**, via `fetch(…, { keepalive: true })`
      with at most 50 events and under 60 KB (keepalive's budget);
   c. on the browser's `online` event.
   It never sends while **Stay offline** is on. Low power only sends after
   a sync, which already runs every 5 minutes in that mode.
4. **At most once in the dashboard.** Each entry carries a `uuid` so a
   resend can be recognised (PostHog's handling of a repeated `uuid` is
   listed under "Not verified"). An entry leaves the queue only after a 2xx
   response. A failed send keeps the batch, and the next trigger retries
   it.
5. **The Diagnostics panel still works**, and gains one line: "*n* reports
   waiting to send" or "all sent". A friend's paste then shows whether the
   report already reached you.

### 2f. Alert rules

These go to your **personal Slack (the Trimm workspace)**, never Tecovas.
A channel like `#fest-alerts` works, or a DM (open question 2). The rules
are tuned for 8 people: anything rarer than a spike is worth a ping.

| # | Rule | Fires when | Why it won't spam |
|---|---|---|---|
| 1 | New error issue | the first time a new grouped error is seen, from any phone | Once per issue, not once per occurrence |
| 2 | Issue came back | a resolved issue reappears, e.g. a fix regressed in a new build | Once per reopen |
| 3 | Boot crash | any `$exception` with `kind = boot` | A boot crash means someone is locked out, so it's always worth a ping. PostHog alerts on an issue once, so this is effectively rule 1 flagged `🔴` |
| 4 | Sync trouble | 3 or more `sync_state` events into `error` or `blocked` within 30 minutes, across devices | A real outage looks like this. One friend's flaky field signal doesn't (that's `offline`, which is grey and expected) |

Deliberately left out: spike detection and Vercel's anomaly alerts. Both
are statistical: Vercel's own example is "75 failing requests in 5
minutes", and with 8 people they'd never fire. Also left out is anything
that alerts on `offline`, because being offline in a field is a state, not
a fault (CLAUDE.md). Resolving an issue in PostHog re-arms rule 2, so the
habit is: see the ping, look, fix or resolve.

### 2g. Your dashboard (one PostHog dashboard, "Festival health")

Set the date range to the festival days. From the top:

1. **Errors this festival.** Open issues, the build each was seen on, and
   the number of devices. This is the error-tracking page itself.
2. **Who's on which build.** Unique devices by `build` in the last 24 h.
   If a v85 bar shows up after v87 shipped, the stale-app class of bug is
   back.
3. **Opens.** Opens per day and unique devices per day.
4. **Speed.** `ms_to_wall` at p50 and p90, split warm vs cold, plus the
   warm-open hit rate, and `miss_reason` for the misses.
5. **Sync health.** Devices that went red (error/blocked) in 24 h, the
   longest time offline, and changes still pending when the page closed.
6. **Features.** Picks by level (1, 2, 3, must, cleared), zoom opens by
   route, NOW taps (and how far down the cycle), notes by door, and the
   Spotify funnel from connect to scan done.
7. **Days.** Day views by festival and day.
8. **Devices.** The WebKit vs Blink split and iOS versions, which tells
   you where the real-phone testing has to happen.

**How you or an agent asks later:** through the PostHog MCP (it worked in
this session). For example `query-error-tracking-issues-list` for "what
broke at Portola", `query-trends` on `first_paint`, or HogQL:
`SELECT properties.build, count(DISTINCT distinct_id) FROM events WHERE
event = 'app_open' AND timestamp > now() - INTERVAL 1 DAY GROUP BY 1`. The
"what did people pick" questions stay in Neon.

## 3. Option comparison

Prices and limits were read on 2026-09-24. SDK sizes were measured on
2026-09-24 by downloading the current file and gzipping it.

| | **Own path → PostHog (recommended)** | Sentry SDK (errors) | PostHog SDK | Vercel Web Analytics + Speed Insights | Own path → Neon (first-party beacon) |
|---|---|---|---|---|---|
| **Errors: stack traces** | Yes, parsed by us, readable without source maps | Best in class | Yes | **None** | Yes, stored raw |
| **Errors: grouping** | PostHog issues (or our fingerprint) | Best in class | PostHog issues | – | Ours to build (a fingerprint column) |
| **Errors: alerting** | Slack (Trimm is already connected), free | **Email only on your free plan.** Slack needs Team, $26/mo | Slack, free | – | Ours to build (Slack webhook + a dedupe table) |
| **Usage events** | Allowlisted, dashboards included | – (not its job) | Yes, but autocapture must be turned off | Pageviews, plus custom events with **2 properties** on Pro (8 with the $10/mo add-on) | Allowlisted, and the dashboard is ours to build |
| **Offline in a field** | Queued in `localStorage` and sent after a sync | **CDN bundle has no offline queue** (the offline transport is npm-only, which would mean hand-bundling a vendor file) | In-memory retry only, lost when the app closes (issue #1583 still open) | None | Queued, same as recommended |
| **Weight on the phone** | ~3–4 KB of our own code, in `APP_CORE`, cached by the service worker | 31 KB gzip / 92 KB raw (errors only, v11.0.0), vendored in `/vendor` like html2canvas | 98 KB gzip / 314 KB raw core, **plus extensions lazy-loaded from PostHog's CDN, which the service worker won't cache and so don't work offline** | ~1–2 KB, loaded from `/_vercel/` (not cached) | ~3–4 KB, same as recommended |
| **What leaks by default** | Nothing: only fields we write | `request.url` = `location.href` (**the crew token**), `Referer`, click trails with `aria-label`/`title` (**names**), fetch URLs with `?t=` (**tokens**) | `$current_url` with the hash (**the token**), `$referrer`, `$el_text` (**names**), plus replay if on | The page URL (hash handling not documented, so strip it with `va('beforeSend')`) | Nothing |
| **Scrubbing needed** | Message redaction only (§2d) | `sendDefaultPii:false`, `beforeSend` (strip `request.url` query and hash, drop `Referer`), `beforeBreadcrumb` (drop `ui.click` attributes, strip `?t=` from fetch), remove the HttpContext integration, a server-side scrub rule, and "prevent storing IPs" | `autocapture:false`, `capture_pageview:false`, `disable_session_recording:true`, `before_send` rewriting 4 URL properties, `persistence:'memory'`, `disable_external_dependency_loading:true` | `beforeSend` | None |
| **Cost at ~25 k events** | $0 (free monthly allowance: 1 M events, 100 k exceptions; shared with Eachie) | $0, but the **5 k errors/month is shared** with eachie, list-maker and record-os; 1 seat | $0 | ~$0.75 ($0.03 per 1 k on Pro, nothing included) | $0 (a few Neon rows) |
| **Effort** | M | M (config is the hard part) | M | S, but it doesn't answer the error question | L (grouping, alerts and dashboard are all ours) |
| **Agent query later** | PostHog MCP ✓ (worked today) | Sentry MCP (timed out today; the REST API works) | PostHog MCP ✓ | Vercel dashboard / API | Neon MCP / SQL |
| **Verdict** | **Best fit** | Best error tool, wrong fit for a no-build, offline, token-in-URL app on a free plan | Right store, wrong client | Not an error tool. **Remove the dead tag** | The purest privacy story, but you'd be building a worse PostHog |

On **server logs**: Observability Plus would keep Vercel logs for 30 days
at $1.20 per million events, across the whole team, and it adds anomaly
alerts. Not recommended here, for two reasons. The alerts are statistical
and useless at 8 users. And 30 days of logs means 30 days of crew tokens in
`?t=` search params. The server-side reporter in §2c covers this better.

## 4. Two build options

### 4a. Before Portola (Fri Sep 25): **ship it, errors only, as part of v87, with a cut line**

**Scope.** Errors only, no usage events:

1. `js/errlog.js`:
   a. the redaction step (§2d), the V8/WebKit stack parser, and the queue
      (§2e);
   b. the `$exception` payload with build, stamp, fest, screen, sync state,
      online, standalone, the motion facts and coarse device fields;
   c. the send triggers (after a sync succeeds, when the page is hidden,
      on `online`).
2. `js/v3/app.js`: `record('boot', e)` in boot's catch block, and
   `record(...)` in the two warm-open catches.
3. `js/sync.js`: one line that fires `fn:synced` on a successful push or
   poll.
4. `vercel.json`: the rewrite to PostHog.
5. `index.html`: remove the dead `/_vercel/insights/script.js` tag.
6. `node scripts/sw-stamp.mjs` (`errlog.js` is already in `APP_CORE`, so no
   list change).
7. PostHog setup, which you do or approve (the MCP key can't create
   projects or alerts, because it lacks the `project:write` and
   `hog_function:write` scopes):
   a. create the `festival-navigator` project;
   b. turn on "Discard client IP data";
   c. connect Slack;
   d. add alert rules 1–3.
8. Tests: the payload redaction test, parser tests on real V8 and WebKit
   stacks, queue cap and expiry, the throwing-storage-getter stub, a
   "sending never throws and sends nothing while offline" test, and the
   Playwright network contract. Then an Opus review (Codex is out of
   credits until Sep 29) and a real-browser walk by a teammate.

**Why ship rather than wait:**

1. It's the same code the full design keeps, the path and the queue with
   usage events added later, so this isn't a quick patch that gets redone.
2. Friends will be on v86/v87 in the field for the first time. v86 wasn't
   checked on a physical iPhone before it shipped, and WebKit-only bugs are
   this app's history. The festival is when being blind costs the most.
3. The risk to friends is contained:
   a. it doesn't touch render paths;
   b. every line sits inside the journal's "must never throw" wrapper;
   c. there's no third-party script;
   d. there's no new service worker route (POSTs already bypass it);
   e. it adds no radio wakeups, since it only sends after a sync that
      already woke the radio.
   The worst realistic failure is a report that never arrives. The
   privacy risk (a scrubbing bug sending a token) lands in your own
   private PostHog project, is pinned by tests, and can be fixed by
   rotating the token.
4. **Riding v87 means friends' phones update once.** A separate release
   would put a second "new build" cycle on phones the night before.

**Cut line.** If it isn't reviewed, green in CI and walked by **Fri Sep 25,
12:00 CT**, v87 ships without it. It then ships in the **Sep 28 – Oct 1
gap between Portola and ACL**, which still covers both ACL weekends. Don't
squeeze it in on Saturday.

**Optional add-on in that same gap:** the four health events, `app_open`,
`first_paint`, `warm_open` and `sync_state`. They reuse the same path and
only touch boot and sync, so ACL would give real open-speed and sync
numbers.

### 4b. After ACL (from Oct 12): the full design

1. All of §2b: the feature events (picks, NOW, zoom, notes, Spotify, days,
   shares, new-build) and `session_end`.
2. Server-side error reports (`api/_lib/report.mjs`), with rule 4 alerting
   on sync outages.
3. The dashboard (§2g), built through the PostHog MCP once the key has
   write scopes, or by hand.
4. An off switch for friends: Settings → App → "Send crash reports and
   usage to Kevin" (default on, per open question 4), plus one line in How
   it works. When it's off, the queue is cleared and nothing leaves the
   phone.
5. Diagnostics gains its "*n* waiting / all sent" line.
6. A CLAUDE.md law bullet, one line: `errlog.js` is the only door out;
   nothing leaves the phone that isn't on its allowlist; no SDK, no replay.
   Add a `docs-truth` check that pins it.
7. Retire Speed Insights on the project (enabled, never loaded). This is
   housekeeping.
8. **Scope and risk.** Size L. It touches many modules (wall, card-facts,
   notes, spotify, sync, settings), so the review surface is wide, which is
   why it waits until nobody is at a festival. Risk to friends is low for
   the same reasons as 4a. The main risk is event-name drift, and the
   allowlist test catches that.

## 5. Open questions for you (each answerable in a word)

1. Errors to **PostHog** (Slack, free) or **Sentry** (email only, unless
   $26/mo)? → *PostHog / Sentry*
2. Slack alerts in a **channel** or a **DM** (Trimm workspace)? →
   *channel / DM*
3. Ship the errors-only slice with v87 before Portola, under the Friday
   noon cut line? → *yes / no*
4. Tell friends in the app (one line in How it works, plus an off switch,
   default on)? → *yes / no*
5. Attach each friend's public `pid`, so you can see that *Ross* is on
   v85, not just *a device*? → *yes / no* (my lean: no; device only)
6. Remove the dead Vercel Analytics tag? → *yes / no*
7. Add the four health events (opens, speed, warm open, sync) in the gap
   before ACL? → *yes / no*
8. Is the Spotify-access `SLACK_WEBHOOK_URL` your personal Slack? →
   *yes / no*

## 6. Sources and what was verified

### Your accounts, read 2026-09-24 (read-only calls)

| Account | What it is today | How it was read |
|---|---|---|
| Vercel team `kevinhg` | **Pro**, active. Project `festival-navigator`: `features.webAnalytics: false`; Speed Insights id present, `hasData: false`; no log drains. Env var names include `SLACK_WEBHOOK_URL` and `DATABASE_URL` (values not read). | `vercel api /v9/projects/…`, `/v2/teams/…` |
| Live hosts | `/_vercel/insights/script.js` → **404** on fest, festival and crew.kevinhg.com; `/_vercel/speed-insights/script.js` → 200. Production is v86. | `curl` |
| Sentry org `khg-y1` (US) | **Developer (free) plan** (`plan: am3_f`, `isFree: true`, no on-demand spend). Three projects already share its quota: `eachie`, `list-maker`, `record-os`. No Slack integration. | Sentry REST API with `SENTRY_TOKEN_HG_AGENT` (the Sentry MCP timed out this session) |
| PostHog org `KHG` (US cloud) | **Paid, pay-as-you-go** (project limit 6). One project today, `Eachie`, with session replay and console-log capture on and `anonymize_ips: false`. A **Slack integration to the "Trimm" workspace** exists on that project. The MCP key lacks `project:write`, `alert:write`, `hog_function:write` and `billing:read`. | PostHog MCP (`project-get`, `user-get`, `integrations-list`) + the org API |

### Code facts (all on `main`, `e907f68`)

- `js/errlog.js`: the journal (20 entries, `fn_errlog_v1`), `record`,
  `hookGlobalErrors`, `diagnostics()`.
- `js/v3/app.js`: `hookGlobalErrors()` at load; boot's catch block
  `console.error('boot failed', e)` then `renderFatal()`, with no
  `record`; `canOpenWarm()` returns `null` for five distinct reasons.
- `js/v3/card-facts.js`: `record('zoom-close-after-click', why)`,
  `record(\`zoom:${where}\`, e)`; zoom sources `mouse`/`touch`/`keyboard`.
- `service-worker.js`: returns early for non-GET and for `/_vercel/`;
  `errlog.js` is in `APP_CORE`.
- `?t=<crew token>` query strings: `js/sync.js`, `js/crew.js`,
  `js/spotify.js`, `js/v3/app.js`, `js/v3/settings.js`,
  `js/festivals.js`.
- Names in attributes: `js/v3/app.js` (`you.title = ctx.meName`, the chip
  `aria-label`s, "…'s personal invite link"); the invite `<input>` holds
  the crew link as its value.
- v87 NOW cycle semantics: `origin/feat/now-jump`, NOW.md and
  `claude-plans/2026-09-24-now-jump-build.md` (tap after tap goes down the
  page stop by stop and wraps).

### Web sources (read 2026-09-24)

- Sentry pricing (Developer: 5k errors, 1 user, email alerts, 30-day
  lookback; Team $26/mo billed annually): https://sentry.io/pricing/
- Sentry free plan and Slack: https://www.bugsink.com/blog/does-sentry-free-plan-support-slack-alerts/
  (dated 2026-08-29), and consistent with the Sentry pricing page
- Sentry CDN bundles and the loader: https://docs.sentry.io/platforms/javascript/install/loader/
- Sentry offline caching (IndexedDB, 30 events, `makeBrowserOfflineTransport`):
  https://docs.sentry.io/platforms/javascript/best-practices/offline-caching/.
  Its absence from the CDN bundle was checked directly: 0 matches in
  `https://browser.sentry-cdn.com/11.0.0/bundle.js`, whose only transports
  are `makeFetchTransport`/`createTransport`. The same file shows
  `request.url = location.href` plus `Referer` (`getHttpRequestData`) and
  click attributes `aria-label`/`type`/`name`/`title`/`alt`.
- Sizes, measured: Sentry `bundle.min.js` v11.0.0 is 92,143 B raw / 31,252
  B gzip; PostHog `array.js` (posthog-js 1.434.12 era) is 313,792 B raw /
  98,052 B gzip; `array.full.js` is 656,295 / 200,957.
- PostHog pricing (free monthly: 1 M events, 100 k exceptions, 5 k
  recordings): https://posthog.com/pricing. Retention on free plans (1
  year; longer on paid): https://github.com/PostHog/posthog.com/pull/20399
- PostHog JS config options: https://posthog.com/docs/libraries/js/config
- posthog-js offline queue issue #1583 (open, last updated 2026-06-23):
  https://github.com/PostHog/posthog-js/issues/1583
- PostHog error tracking alerts (new/reopened/spike; Slack, Discord, Teams,
  webhook): https://posthog.com/docs/error-tracking/alerts
- PostHog manual `$exception` capture over HTTP (`/i/v0/e/`,
  `$exception_list`, frames, `$exception_fingerprint`):
  https://posthog.com/docs/error-tracking/installation/manual
- PostHog Vercel reverse proxy: https://posthog.com/docs/advanced/proxy/vercel
- Vercel runtime logs (Pro 1 day, Plus 30 days; search params in log
  detail): https://vercel.com/docs/logs/runtime
- Vercel Observability Plus ($1.20 per 1 M events):
  https://vercel.com/docs/observability/observability-plus
- Vercel anomaly alerts (Observability Plus; error spikes):
  https://vercel.com/changelog/anomaly-alerts-now-include-error-spikes
- Vercel Web Analytics pricing (Pro $0.03 per 1 k, 2 custom properties, 12
  months): https://vercel.com/docs/analytics/limits-and-pricing
- Vercel custom events, `va()` for plain HTML:
  https://vercel.com/docs/analytics/custom-events
- Vercel `beforeSend` for the plain script tag:
  https://vercel.com/docs/analytics/redacting-sensitive-data

### Not verified, and why

1. Which workspace `SLACK_WEBHOOK_URL` points to (it's a secret; open
   question 8).
2. Whether PostHog sees the friend's IP or Vercel's through the rewrite.
   The design turns on "Discard client IP data" either way.
3. Whether Vercel Web Analytics' pageview includes the URL hash. It's
   moot if the tag is removed.
4. Whether PostHog drops a resent event with the same `uuid`. If it
   doesn't, a send whose response was lost can double-count one batch.
   That's rare, and it only affects counts, never errors, since rule 1
   fires once per issue.
5. PostHog's exact `$exception` grouping on hand-built frames. The first
   build should send one test error to the new project and look at the
   issue page before trusting it (the data-quality rule: check the output,
   not just the code).
