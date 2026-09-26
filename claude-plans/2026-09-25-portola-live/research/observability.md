# Observability slice — "can we SEE friends' errors, and look one up?"

Status: IN PROGRESS, banking early per brief. Read-only research, worktree
`.claude/worktrees/portola-live`, no writes/pushes/installs done.

## 1. What errlog.js actually sends (js/errlog.js)

One door out, `record(kind, err, at)` → builds a PostHog `$exception` event →
queued in localStorage (`fn_telemetry_q_v1`) → sent via `fetch('/fn-i/batch')`
(vercel.json rewrite to PostHog US ingestion) or `sendBeacon` on hide/pagehide.
No PostHog SDK, no autocapture — every field is built by hand in `baseProps()`
(errlog.js:611-659) and `buildReport()` (errlog.js:729-754).

**Every report carries (baseProps + exception):**
- `distinct_id` = a random per-device uuid (`fn_report_device_v1`), NOT the
  crew's person token or pid.
- `build` (e.g. `v88`, parsed from the SW's `CACHE_VERSION`), `stamp`
  (ASSET_STAMP hash), `sw` (`controlled`/`none`) — errlog.js:360-424. This is
  how "which build threw" survives a shell that's judging a stale build
  (the "v75 judging v76" bug, CLAUDE.md).
- `session` (per-page-load uuid), `host` (`fest`/`festival`/`crew`/`stage`/
  `preview`/`local`/`other` — errlog.js:344-352, so Kevin's own local/preview
  testing is filterable out from real friend traffic).
- `screen` (which screen: wall/settings/landing/join/create/badlink/error/
  loading), `sync_state` (online/syncing/offline/error/blocked), `online`,
  `standalone` (installed as PWA?).
- Device facts in PostHog's own key names (`$device`, `$device_type`, `$os`,
  `$os_version` [major only], `$browser`, `$browser_version` [major only],
  `engine`: webkit/blink/gecko) — errlog.js:267-309. Raw user-agent string
  NEVER leaves.
- `viewport` rounded to nearest 50px (privacy: not exact fingerprint).
- `reduced_motion`, `low_power`, `strip_route`, `strip_animation` — the
  stage-strip motion facts (so a "stage names stutter" report self-answers).
- `fest` (festival id, validated `^[a-z0-9-]{1,64}$`), `pid` (public person
  id, validated `^[A-Za-z0-9_-]{10,16}$` — deliberately disjoint length range
  from crew/person TOKEN_RE so a token can never pass as a pid), `member_name`
  (the crew member's own display name, ≤40 chars) — these three come from
  `provider.context()`, which app.js supplies via `configureReports()`
  (app.js:33). **This is the answer to "look up one friend's errors by
  name": `member_name` and `pid` ride on every report, by Kevin's own
  decision recorded in errlog.js:646 and CLAUDE.md ("The public pid and the
  name in the crew may ride along (Kevin, 2026-09-24)").**
- `$exception_list`: one exception with `type`, `value` (message, scrubbed +
  clipped 300 chars), `mechanism.handled`, and a parsed stacktrace (frames
  with function/filename/lineno/colno/in_app — file PATH only, never full
  URL, never query/hash).
- `kind` = the code-site name that called `record()`, e.g. `boot`,
  `sync:blocked`, `zoom-close-after-click`, `zoom:<where>`,
  `warm-open:catalog`, `module-load` (errlog.js:772-803, call sites: sync.js,
  app.js, card-facts.js, v3/tools.js).
- `count` (repeat-fold count within one page load).

**What NEVER leaves (scrubText, errlog.js:172-205, and the field allowlist
itself):** any crew token or the person token (exact-match cut, longest
first), any URL's query/hash, any `?x=`/`#x=`/`&x=` param, email addresses,
V8's quoted-string-content snippets, any run of 20+ token-shaped chars. No
`location.href`, no click text, no note text, no raw user-agent. Off
("Send crash reports" toggle) and Stay-offline are read fresh inside
errlog.js at send time (errlog.js:492-503), so they hold even if the rest of
the app never loaded — this is intentional defense-in-depth, not a gap.

**Caps that matter for a live weekend:** max 5 queued reports per distinct
error per page load, max 25 total reports per page load
(PER_SESSION/SESSION_CAP, errlog.js:79-80) — so a loop can't flood a friend's
phone's queue or PostHog. Repeats fold into `count` on the original report.

PostHog project confirmed in code: `index.html` embeds the `phc_…` write-only
key in a `fn-report-key` meta tag, scoped to specific hosts via `data-hosts`
(errlog.js:466-489) — I did not print the key value (never should; it's
public/write-only by design per the code comment, but not needed for this
report anyway).

## 2. Querying project 627900 without touching the active project

**Blocked — no safe route found, and I did not call `switch-project`.**

- `mcp__posthog__exec` is loaded and working, but every query tool
  (`query-trends`, `execute-sql`, `read-data-schema`, etc.) operates against
  whatever project is currently ACTIVE for this authenticated session — none
  of them take a `project_id` parameter. I checked tool `info` output info
  is bundled per-tool-call (schema/info commands), and the tool-set
  description says nothing about a `--project` override; the only way to
  change project is `switch-project`, which the brief explicitly forbids
  (another live session is on "Eachie" 262708 right now).
- `~/.env`: grepped variable NAMES only (`grep -oE '^[A-Z_]+' ~/.env | grep -i
  posthog`) — **zero POSTHOG-named variables exist in `~/.env`**. No
  `POSTHOG_PERSONAL_API_KEY`, no `PHX_...`. Also checked both Claude
  profiles' settings.json for a POSTHOG env var — none found either.
  (Full `~/.env` var-name list has ANTHROPIC/CLOUDFLARE/EACHIE/FAL/NOTION/
  REPLICATE/XAI keys — no PostHog personal key anywhere on this machine.)
- The PostHog REST API (`app.posthog.com/api/projects/627900/...`) needs a
  **personal API key** (`phx_...`, a real secret, distinct from the public
  `phc_...` ingestion key baked into index.html) — none exists locally, so I
  cannot hit the REST API either. The `phc_` key in index.html is
  write-only/ingestion-only by PostHog design (posthog-js docs) and cannot
  read anything back.

**Verified, not just inferred:** called `project-get` (read-only) and
confirmed the session's active project really is Eachie (262708, confirmed
by name/api_token/app_urls in the response — festival-navigator's key would
show `phc_...` matching the meta tag and app_urls for fest/festival/crew
domains). Checked `info switch-project`: its own description says it
"switch[es] the active PostHog project for **subsequent tool calls**" —
i.e. it is session-global state, not scoped to one call, exactly as the
brief warned. Also searched for any `projects-get`/`projects-list` tool
that might enumerate accessible projects read-only — none exists; the only
two project-shaped tools in this MCP are `project-get` (active project
only) and `switch-project` (changes it). So there is no way, through this
MCP, to even list project 627900's existence without switching to it.

**What would unblock this, plainly:**
1. Kevin (at a desk, briefly) creates a **personal API key** scoped to
   project 627900 read access at posthog.com → Settings → Personal API
   Keys, and drops it in `~/.env` as e.g. `POSTHOG_PERSONAL_API_KEY_FESTNAV`.
   Then a session can `curl -H "Authorization: Bearer $KEY"
   https://us.posthog.com/api/projects/627900/...` without ever touching
   the MCP's active-project state. This is the cleanest fix and needs Kevin
   at a desk once, not per-query.
2. Alternatively, if the PostHog MCP server itself gets a `project_id`
   override parameter in a future version (worth a `posthog:agent-feedback`
   ping — "mcp" category — since every query tool is single-active-project
   only, which is awkward exactly when two sessions share one PostHog
   account across two projects), that would remove the need for a personal
   key entirely.
3. Least good but works today: ask the other live session (on Eachie) to
   pause, `switch-project` to 627900, run the 3 queries below, switch back.
   Fragile and coordination-heavy — not recommending it.

## 3. The three queries (drafted, NOT run — no safe route)

Written against the schema errlog.js actually produces, ready to paste once
either a personal API key or a safe MCP path exists.

**(a) Error count by build, last 2 hours** — HogQL via `execute-sql` or the
REST `/api/projects/627900/query/` endpoint:
```sql
SELECT properties.build, count() AS n  -- (fixed 2026-09-25: $exception_list was selected but not grouped)
FROM events
WHERE event = '$exception'
  AND timestamp > now() - INTERVAL 2 HOUR
GROUP BY properties.build
ORDER BY n DESC
```
(Actual PostHog HogQL syntax is `properties.build` via the `properties`
JSON accessor — confirm exact column path with `read-data-schema` /
`event_properties` for `$exception` once the project is reachable; I did not
verify this against live schema, since project 627900 isn't reachable this
session.)

**(b) All errors for one crew member (by name or pid), in a time window:**
```sql
SELECT timestamp, properties.kind, properties.$exception_list,
       properties.build, properties.screen, properties.fest
FROM events
WHERE event = '$exception'
  AND (properties.member_name = 'Drew' OR properties.pid = 'abc123xyz789')
  AND timestamp > now() - INTERVAL 1 DAY
ORDER BY timestamp DESC
```
This is the "they say it broke" lookup — `member_name` is exactly the name
a friend would give Kevin in Slack/text, and it's on every report by design
(errlog.js:646, CLAUDE.md decision 2026-09-24).

**(c) Error kinds first seen after a given build went live:**
```sql
SELECT properties.kind, min(timestamp) AS first_seen, count() AS n
FROM events
WHERE event = '$exception' AND properties.build = 'v89'
GROUP BY properties.kind
ORDER BY first_seen ASC
```
Pair with PostHog's native Error Tracking issue list
(`$error_tracking_issue_created`) which already does new-vs-recurring
classification server-side — likely a better UI than raw SQL for this one
once installed (see §4).

**None of these were executed** — no safe route to project 627900 existed
this session (see §2). All three are ready to run the moment a personal API
key or an MCP project-scope path exists.

## 4. Installing PostHog → Slack alerts (ops/posthog/)

Read `ops/posthog/README.md` and `ops/posthog/slack-alert.hog`. Did not
install/run/touch anything (destructive-op and no-writes rule).

**Status as of 2026-09-25 (README, verified against file):** the Slack alert
script is written and reviewed, **not yet installed or run**. Slack
("Trimm" workspace) is already connected to the Festival Navigator PostHog
project (integration 269583) — that part of the plumbing exists. No
PostHog Function uses the script yet.

**What one Function needs (from the README's install table):**
| App | Function name | Trigger event |
|---|---|---|
| Fest | New error | `$error_tracking_issue_created` |
| Fest | Came back | `$error_tracking_issue_reopened` |
| (Eachie, separate repo/app, not this slice) | Feedback received | `survey sent` |

Each Function runs the SAME `slack-alert.hog` source with its own `inputs`
(`slack_workspace` = the Slack integration, `channel`, `app_label` = "Fest",
`username`, `icon_emoji`). The script holds no secrets itself — the Slack
token comes from the integration at run time, not from anything in the repo.

The full step-by-step (scopes, exact test-invocation-before-flipping-on,
rollback) lives in `claude-plans/2026-09-24-analytics/slack-alert-design.md`
§6 — I read the README's summary but did not open that doc in this pass;
recommend the session that actually installs this reads §6 in full first.

**Kevin's four recorded calls (README "Decisions on record", 2026-09-25):**
1. Eachie's errors stay in Sentry (that path already works, not touched).
2. Alerts go to the channel Eachie's PostHog already posts to
   (#eachie-feedback, `C0A2CDKCZP1`); renaming to a shared name like
   #app-alerts is agreed in principle, not yet done — renaming keeps the
   Slack channel ID so nothing here breaks when that happens.
3. Eachie's own broken twice-weekly rollup job (always-zero numbers in
   #eachie-system) is Eachie's own code — fix is a separate Pen item for an
   Eachie session, not this repo.
4. (Implicit 4th, from the file header) — this script's lasting home is
   pending a helper reorg ("split cross-machine-sync out…"); until then this
   copy in `ops/posthog/` is the master, PostHog holds the running copies.

**Can it be installed entirely remotely, with Kevin only approving in chat
(no desk, no login)?** Reading the script and README: creating a PostHog
Function and wiring its trigger/inputs is a PostHog **dashboard** action —
there's no CLI/API path shown in this repo for creating a Function
(`ops/posthog/` holds only the .hog source and docs, not a deploy script).
That means **installing it does need someone at the PostHog UI** — most
plausibly a browser session (Kevin's phone browser could technically click
through PostHog's UI to create a Function and paste the .hog source, since
it's just web forms — Kevin doesn't need a laptop, just to be logged into
PostHog on whatever device he has). This is a case that matches the brief's
"can't ask Kevin to run commands" framing: it's not a command, it's a few
taps in a web UI he can do from his phone if he has a minute, OR it can wait
until he's back at a desk. I did not attempt to install anything (told not
to), and did not find a `posthog` CLI or Terraform-style config in this repo
that would let a session create the Function unattended.

## Bottom line for the weekend

- **Seeing "is anything breaking right now"**: not yet turnkey. The data is
  already flowing correctly (errlog.js is solid, ships good fields, scrubs
  well) — the gap is 100% on the READ side: no personal API key exists
  locally, so nobody (human or agent) can query project 627900 outside the
  PostHog UI itself right now. Kevin logging into posthog.com on his phone
  and looking at the Error Tracking tab for project 627900 works today,
  with zero new setup — that's the fastest "can I see it" path this
  weekend, independent of anything in this doc.
- **Looking up one friend's errors**: the data model already supports it
  perfectly (`member_name` + `pid` on every report) — same gap: needs
  either the PostHog UI directly, or a personal API key for programmatic
  lookup.
- **Alerts (so nobody has to go looking)**: written, reviewed, wired to
  Slack at the integration level, but the two PostHog Functions themselves
  are not created yet — that's a short web-UI task, not a code change.
