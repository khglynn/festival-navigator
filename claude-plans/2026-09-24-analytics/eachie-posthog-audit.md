# Eachie's PostHog → Slack: why it read as garbage (audit, 2026-09-25)

**Status:** findings and a fix list. Read-only: nothing in PostHog, Slack or the
eachie repo was changed. Every claim below was read from the live PostHog
project (Eachie, id `262708`, through the PostHog MCP), the eachie working
tree on `main` at `88daea69` (origin was at `314115e1`, since the other
Eachie session keeps pushing), eachie's GitHub issues, or PostHog's own source and docs,
on 2026-09-24/25 (US Central). The message design that fixes this lives next
door in `slack-alert-design.md`.

Kevin (2026-09-24): "we've neevverrr had posthog eachie look/work well. the
messages have always been garbled trash."

## 0. The short version

1. **What actually posts to Slack is small.** There's one PostHog Slack
   destination, posting to **#eachie-feedback** (channel id `C0A2CDKCZP1`, in
   the "Trimm" workspace). Eachie also runs its own twice-weekly "PostHog
   Rollup" cron, which posts to #eachie-system. That's all: PostHog has no
   error alerts, no insight alerts, no subscriptions and no workflows. It has
   also **never received a single error from Eachie**. Eachie's errors go to
   Sentry, and a separate path Eachie owns posts them to #eachie-errors.
2. **Why it was garbage:** the message template pointed at a property that has
   never existed. It fired on the wrong events (Kevin's own logins). Its
   "View Recording" button opened the destination's settings page, not a
   recording. And back in Dec 2025 there was no way to test a template before
   it went live. So every message read "*Kevin* triggered *$identify*"
   followed by an empty quote (`>>`).
3. **"Quiet" isn't the same as "fixed".** Since the Aug 2 trigger fix, the
   destination has posted **nothing for 53 days**. The template is still
   broken, so the next survey response would arrive just as empty as the
   first ones did.
4. **The rollup is garbage for a different reason.** Four of its five numbers
   can't be right. One counts an event name the code retired in February. One
   counts an event that stopped firing on Jul 31 (eachie issue #170). One
   counts surveys, which haven't happened since December.
5. **Fix, in one line:** rebuild the destination as feedback-only, reading the
   survey answer from where it really lives. Take rage clicks out of real-time
   Slack. Replace the rollup with one insight alert that catches silent
   tracking breaks. Keep Eachie's errors in Sentry for now. Details are in §5,
   and each fix names who does it and which API scope it needs.

## 1. What Eachie's PostHog sends to Slack today

| # | Path | Where it posts | Fires on | Evidence |
|---|---|---|---|---|
| 1 | PostHog destination **"Slack"** (`019b29d7-f6d1-0000-5d0d-c02aa137c9b1`, template `template-slack`). Created 2025-12-17 01:06 UTC, last edited **2026-08-02 17:55 UTC** | **#eachie-feedback** (`C0A2CDKCZP1`, public, PostHog bot is a member), Slack integration "Trimm" (id `155795`) | `survey sent` **or** `$rageclick`. **No test-account filter.** Bot name "PostHog", icon `:hedgehog:` | `cdp-functions-retrieve`, `integrations-channels-retrieve` |
| 2 | Error-tracking alerts | none | none | `error-tracking-alerts-list` (internal destinations): 0. `system.error_tracking_issues`: 0. `$exception`: never ingested |
| 3 | Insight alerts, subscriptions, workflows | none | none | `alerts-list` 0, `subscriptions-list` 0, `system.hog_flows` 0. The only other function is the GeoIP transformation |
| 4 | Eachie code: `app/api/cron/posthog-rollup/route.ts` | #eachie-system (`SLACK_WEBHOOK_EACHIE_SYSTEM`) | Tue and Fri at 20:10 UTC (3:10 PM CT), `vercel.json`. It 500'd from launch until `POSTHOG_API_KEY` was added on 2026-07-23, and first ran on 2026-07-24 (eachie DEVLOG) | repo read |
| 5 | Eachie code: `app/api/webhooks/sentry/route.ts` (not PostHog) | #eachie-errors | Sentry issue webhooks | repo read. This is the one alert path built with care: conditional fields, a regression banner, and a plain-English "what this means" line |

**Delivery history of #1**, from PostHog's function metrics (they only go
back about 90 days): **3 posts, all `$identify`**, on Jul 27 (twice) and
Aug 2. Nothing has posted since, and one later `$identify` on Aug 7 was
correctly skipped. Function logs show the same three runs, each finishing in
110 to 160 ms. The function's revision history is empty, and there's no
activity-log table for functions, so the exact filter it had before Aug 2
can't be reconstructed. We only know it matched `$identify`.

**The channel festival-navigator will reuse: #eachie-feedback, `C0A2CDKCZP1`.**
Use the id, not the name, since the id survives a rename (see fix 9).

## 2. What the messages looked like

There's no Slack connector in this session, so these are reconstructed from
three things: the live template, the real events that triggered each message,
and Kevin's own description in eachie issue #36 (filed 2026-02-11): "Message
body shows up as empty (`>>`)."

The live Blocks template is: a section `*{person.name}* triggered:
*{event.event}*`, then a section `>>> {event.properties.$survey_response}`,
then buttons "View Person" (`{person.url}`) and "View Recording"
(`{source.url}`).

a. **Survey feedback** (Dec 17, 2025, 5 posts, all Kevin testing the widget):

```
:hedgehog: PostHog
Kevin Halladay-Glynn triggered: survey sent
>>                                   ← the answer never appears
[View Person]  [View Recording]      ← opens the destination's own settings page
```

b. **Login pings.** In the window when the trigger matched `$identify`
(Dec 17 to Aug 2), there were 39 `$identify` events, and 37 of them were
Kevin's own logins. So there were up to 39 posts like this:

```
Kevin Halladay-Glynn triggered: $identify
>>
[View Person]  [View Recording]
```

c. **Rage clicks** (the current trigger). There were 59 all-time, the last on
Jun 10. Whether any posted before Aug 2 can't be told, since metrics only
keep about 90 days. None have posted under the current filter. Anonymous
visitors have no name, so the name falls back to their raw ID:

```
019bfb69-…-… triggered: $rageclick
>>
```

d. **The rollup** in #eachie-system (Eachie code), shape only. The numbers
vary by window; `0*` marks the ones that are zero by construction:

```
📊 PostHog Rollup (72h window)
research_started  n     research_completed  0*    completion rate  0.0%*
follow_up_submitted  0*    survey sent  0*
Top rageclick pages
No rageclick pages in this window.
Generated 2026-09-18T20:10:03.412Z
```

## 3. Why they're garbled: one root cause per kind of garbage

| # | Garbage | Root cause | Evidence | Kind |
|---|---|---|---|---|
| 1 | Empty `>>` body | The template reads `event.properties.$survey_response`, which **has never existed in this project**; PostHog's own taxonomy check reports it "not found". posthog-js (1.304 at the time) writes the answer to **`$survey_response_7c0fd18c-d2e9-4320-84d3-4b6afabf78fb`** (keyed by question id), and to `$survey_questions` as `[{id, question, response}]`. The Dec 17 attempted fix wrote `{event.properties.$survey_response_7c0fd18c-d2e9-…}` with dot access, and Hog reads the hyphens as **subtraction**. A key with hyphens needs brackets: `event.properties['$survey_response_…']`. The template was later put back to `$survey_response`, which is what's live now. And for non-survey triggers the quote line has nothing to show by design | `survey sent` keys (5 of 5 events); `claude-plans/archive/2025/2025-12-17-posthog-feedback-widget-slack.md` in eachie; Hog docs (bracket access) | PostHog config |
| 2 | Pings about Kevin logging in | The trigger matched `$identify` until 2026-08-02. 37 of 39 identifies in that window were Kevin's | eachie #36 (closed 2026-08-30); `$identify` counts; delivery logs | PostHog config |
| 3 | Rage clicks posted through a survey template | 59 rage clicks all-time: **42 were Kevin's**, 17 anonymous, 13 on localhost. The destination has **no test-account filter**, even though the project defines one (`$host` not localhost). A rage-click message has no page or element, only an empty survey line, and anonymous visitors render as a raw ID (PostHog's `getPersonDisplayName` falls back to `distinct_id`) | SQL on `$rageclick`; project `test_account_filters`; PostHog `nodejs/src/cdp/utils.ts` | PostHog config |
| 4 | Buttons that lie | "View Recording" is `{source.url}`, which is the **alert's own settings page** (PostHog's templates use it as "Alert: <source.url>"). The survey events carried `$session_id` and `sessionRecordingUrl` all along | template inputs; PostHog error-alert templates | PostHog config |
| 5 | Every fix attempt made it worse or did nothing | In Dec 2025 the only way to edit was PostHog's code editor, driven through Playwright, "very resistant to automation". Nothing was tested before saving ("Kevin confirmed he saved… changes didn't take effect"). There was no MCP write path | the Dec 17 plan | Tooling at the time |
| 6 | Stale function code | The function keeps its own Dec 2025 copy of the Slack template code. Templates don't update functions already built from them, so it lacks today's scope check and thread support. Minor, but it's another reason to rebuild rather than edit | `cdp-functions-retrieve` (`hog` vs `template.code`) | PostHog config |
| 7 | Rollup numbers that can't be right | `follow_up_submitted` was renamed in code to `orchestrator_followup_submitted`, which has **never been sent once**. `research_completed` went silent on Jul 31 while `research_started` continued (9 started / 0 completed in August), so completion reads 0.0%. `survey sent` has been 0 since Dec 17. The labels are raw event names, the rage-click pages are raw full URLs (localhost included), and the timestamp is UTC ISO | monthly counts SQL; eachie #170 (open); route source | Eachie code |

Candidates from the brief that turned out **not** to be causes:

1. **Raw JSON dumps.** The template never used `{event.properties}`.
2. **Untruncated error stacks.** No errors ever reached PostHog.
3. **Badly shaped events from Eachie's own code.** Eachie's posthog-js events
   are well formed. The one Eachie-code data problem is missing and renamed
   events (#170), and that only shows up in the rollup.
4. **A Block Kit vs mrkdwn mismatch.** Only in a small way: `>>>` followed by
   nothing renders as a bare quote marker. The real cause is the missing
   property in row 1.

## 4. What PostHog offers now that it didn't in Dec 2025

Eachie's destination was built on 2025-12-17. What has shipped since, with
dates from PostHog's own commits and docs (read 2026-09-25):

| Capability | Since | Why it matters here | Source |
|---|---|---|---|
| Issue alerts: one message per **new** or **reopened** error issue, instead of one per event | early 2025 ("we just launched issue alerting", a PostHog reply on an issue filed 2025-02-18); docs page since 2025-04-09, updated 2026-08-27 | Existed in Dec, but unused: Eachie never sent errors to PostHog | [docs](https://posthog.com/docs/error-tracking/alerts), [PostHog#28839](https://github.com/PostHog/posthog/issues/28839) |
| Filtering alerts by the exception's own properties (URL, build, …) | shipped after the Jul 21, 2025 request | Lets an alert skip localhost or old builds | [PostHog#35395](https://github.com/PostHog/posthog/issues/35395) |
| **Exception properties copied onto the alert event** | in source (read 2026-09-25) | A template can show the build, browser, OS and stack frame of the error that opened the issue. This makes the design in `slack-alert-design.md` possible | `nodejs/src/cdp/utils.ts`, `products/error_tracking/backend/temporal/lifecycle/side_effects.py` |
| Spike alerts: Slack templates, then a setup wizard; per-project multiplier, minimum count and snooze; 5-minute buckets | 2026-01-09 (#44516), 2026-03-10 (#50319) | A usable "error spike" message | [spike docs](https://posthog.com/docs/error-tracking/spikes) |
| Merge-stable issue links (through the fingerprint) | 2026-07-17 (#71031) | Links in old Slack messages keep working after issues are merged | commit history |
| Insight alerts to Slack, then Discord and Teams; anomaly detection (13 detectors plus an LLM detector); investigation notebooks | Slack 2025 ([PostHog#27302](https://github.com/PostHog/posthog/issues/27302)); Discord 2026-06-17; Teams 2026-06-25 | Threshold alerts land in the same channel with the same look | [alerts docs](https://posthog.com/docs/alerts) |
| **Snooze menu inside the Slack message** | 2026-07-28 (#72698) | Silence a noisy alert from your phone | commit history |
| **Chart image on every firing insight alert** | 2026-09-08 (#95951) | The number at a glance on a phone | commit history |
| Slack destination: reply in a thread; scope-aware bot name and icon | 2026-08-20; 2026-09-07 (#94943) | The bot name can say which app sent it | `slack.template.ts` history |
| Liquid templating documented for destinations | 2026-04-07 | Another way to format values | [customizing destinations](https://posthog.com/docs/cdp/destinations/customizing-destinations) |
| Prompt (AI-written) subscriptions to Slack, with an analysis window | documented; window setting 2026-07-08 | A plain-language weekly digest, if the rollup's job is still wanted | [subscriptions docs](https://posthog.com/docs/product-analytics/subscriptions) |
| **Agents can author and test alerts**: MCP tools `error-tracking-alerts-create`, `cdp-functions-invocations-create` (test runs), `integrations-channels-retrieve` | present in the MCP now | The Dec failure was untested hand edits in a web editor. Now an agent can build a message, test it against a real event, and read the delivery logs | MCP `search` |

## 5. Fix list for Eachie

Each fix says what it is and why, which side does it (PostHog config, Eachie
code, or Slack), the API scope it needs, and who acts. The PostHog MCP key
today **lacks `hog_function:write`, `alert:write`, `insight:write`,
`project:write` and `subscription:write`**. Those tools show as
"scope-gated" in the MCP's own search.

1. **Replace the "Slack" destination with "Eachie · Feedback received".**
   Trigger on `survey sent` only, with test accounts filtered. Read the
   answer from `$survey_questions`, so no question id is hard-coded. Add a
   Replay button from `$session_id`, and show a name only when the person
   is identified. The layout is `slack-alert-design.md` §4.
   a. Rebuild it as a new function, test it against a real past event (for
      example `019b29e8-89f6-770e-b0b8-d83041dab3d7`, Dec 17), then
      **disable** the old one. Don't delete it; it's the only record of what
      was there.
   b. Side: PostHog config. Scope: `hog_function:write`. Who: an agent,
      once the scope is granted.
2. **Take rage clicks out of real-time Slack.** 59 in nine months, 71%
   of them Kevin's own, and the message has nothing useful to say.
   If they're wanted at all, a weekly subscription to a "rage clicks by
   page" insight does the job (`insight:write` + `subscription:write`).
   **My lean: drop them.** Side: PostHog config, as part of fix 1.
3. **Add one insight alert that catches silent tracking breaks.** A SQL
   insight: "research runs started today with no `research_completed`",
   alerting when it's ≥ 1 for a day. It posts to #eachie-feedback in the
   shared threshold layout (`slack-alert-design.md` §3). It would have
   flagged #170 on the first day a run started without finishing after
   Jul 31, instead of four weeks later on Aug 29.
   a. Side: PostHog config. Scopes: `insight:write` + `alert:write`.
   b. Checks run hourly at best on this plan (every 15 minutes needs Boost).
4. **Retire the `posthog-rollup` cron.** #170 already names it a
   retirement candidate. The work: the route folder, its two `vercel.json`
   cron entries, the `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` lines in
   `.env.example`, and one line in `docs/guides/KEEP-IT-LEGIBLE.md`. Fix 3
   does the rollup's real job (noticing when something breaks).
   a. If a weekly summary is still wanted, a prompt subscription writes
      one in plain language (`subscription:write`, AI data-processing
      consent, AI credits).
   b. Side: Eachie code. Who: the Eachie session. **Another session is
      working in that repo right now**, so hand it over rather than editing.
5. **Fix #170's capture.** `research_completed` has been silent since
   Jul 31, and `orchestrator_followup_*` has never fired. Side: Eachie code,
   already tracked in #170.
6. **Send the build with every event.** Add something like
   `posthog.register({ build: <short commit SHA> })` in
   `instrumentation-client.ts`, so any PostHog alert can say which deploy it
   came from. festival-navigator uses the same `build` property name, which
   lets one template serve both. Side: Eachie code.
7. **Treat Kevin's own account as a test account.** Add
   `is_super_admin != true` (a person property Eachie already sets) to the
   project's test-account filter, and tick "filter test accounts" on every
   Slack function. Your own clicks and logins then never alert. Side:
   PostHog config. Scope: `project:write`, plus `hog_function:write` for
   the functions.
8. **Decision: where Eachie's errors live.** My lean is to **keep them in
   Sentry** for now. The Sentry-to-Slack path works, it has source maps and
   a tested noise policy, and Eachie's frames are minified, so without
   source maps uploaded to PostHog the "top frame" line would be gibberish.
   Turning on PostHog exception capture would duplicate every error. The
   case against: Sentry's free quota is shared with list-maker and
   record-os, and one tool is simpler. Revisit if that quota bites. Kevin's
   call.
9. **Optional: rename #eachie-feedback** to something neutral like
   `#hg-alerts`, since Festival Navigator will post there too. PostHog
   stores the channel id, so every destination keeps working. Side: Slack.
   Kevin's click.
10. **Note for the new festival-navigator project:** Slack integrations
    belong to one PostHog project. The fest project has to connect Slack
    itself (Settings → Integrations → Slack → Add to Slack). That's a
    browser OAuth consent Kevin clicks through. After that it can post to
    `C0A2CDKCZP1`, since the same PostHog app is already in that channel.

## 6. Sources and evidence

1. **PostHog MCP, read-only** (project `262708`): `project-get`,
   `integrations-list`, `integrations-channels-retrieve`,
   `cdp-functions-list` / `-retrieve` / `-metrics-retrieve` /
   `-logs-retrieve` / `-list-revisions`, `error-tracking-alerts-list`,
   `alerts-list`, `subscriptions-list`, `read-data-schema`, and `execute-sql`
   over `events`, `system.hog_functions`, `system.hog_flows`,
   `system.surveys` and `system.error_tracking_issues`.
2. **eachie repo** (read only): `instrumentation-client.ts`,
   `app/providers.tsx`, `app/page.tsx`,
   `app/api/cron/posthog-rollup/route.ts`,
   `app/api/webhooks/sentry/route.ts`, `vercel.json`, `src/lib/slack.ts`,
   `DEVLOG.md`, `NOW.md`,
   `claude-plans/archive/2025/2025-12-17-posthog-feedback-widget-slack.md`.
   GitHub issues #36 and #170.
3. **PostHog source**, read on GitHub 2026-09-25:
   `nodejs/src/cdp/utils.ts` (person name fallback; exception properties
   copied onto alert events),
   `products/error_tracking/backend/temporal/lifecycle/side_effects.py` and
   `event_properties.py`, `posthog/tasks/alerts/utils.py`
   (`$insight_alert_firing` properties),
   `frontend/src/scenes/hog-functions/sub-templates/sub-templates.ts`
   (PostHog's own alert templates),
   `nodejs/src/cdp/templates/_destinations/slack/slack.template.ts`, the Hog
   runtime in `common/hogvm/typescript/src/stl/`, and posthog-js
   `packages/core/src/error-tracking/parsers/index.ts`.
4. **PostHog skill** `authoring-error-tracking-alerts` (plugin 1.1.64):
   the canonical Block Kit for each trigger and each event's properties.

### Not verified, and why

1. **The exact past renderings.** No Slack connector was available to read
   the channel, so §2 is a reconstruction.
2. **The filter before Aug 2, and whether rage clicks ever posted.** The
   function has no revision history, and delivery metrics keep about
   90 days.
3. **Whether `sessionRecordingUrl` opens.** posthog-js built it with the
   project token in the path, not the project id. No browser was used, so
   it wasn't opened. The new template builds the link from `$session_id`
   instead.
4. **The new templates haven't been run.** Running Hog from here needed a
   local API key, and loading it was blocked. See the test step in
   `slack-alert-design.md` §6.
