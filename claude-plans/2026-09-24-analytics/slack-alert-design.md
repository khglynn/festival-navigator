# Slack alert messages: one design for Eachie and Festival Navigator (2026-09-25)

**Status:** a design, ready to build once the PostHog scopes in §6 are
granted. Nothing was installed. Read it alongside `eachie-posthog-audit.md`,
which explains what went wrong before and why each rule below exists.

**Where the messages go:** #eachie-feedback in the "Trimm" Slack, channel id
**`C0A2CDKCZP1`** (Kevin, 2026-09-24: "you can use the slack channel eachie
uses"). Both apps post there, so every message says which app it's from in its
first words.

**What it covers:**

| Layout | PostHog trigger | Serves |
|---|---|---|
| §1 New error issue | `$error_tracking_issue_created` | Fest rules 1 and 3 (DESIGN §2f): new issue; a boot crash gets 🔴 |
| §2 Issue came back / error spike | `$error_tracking_issue_reopened`, `$error_tracking_issue_spiking` | Fest rule 2; Eachie spikes, if Eachie's errors ever move to PostHog |
| §3 Insight threshold alert | `$insight_alert_firing` | Fest rule 4 (sync trouble); Eachie's "research stopped finishing" alert (audit fix 3) |
| §4 Feedback received | `survey sent` | Eachie's one live alert, rebuilt (audit fix 1) |

## 0. The rules, and why

1. **The first words say which app.** The bot name is "Festival Navigator" or
   "Eachie", and the headline and the notification text both start with the
   app label. On a phone's lock screen the first few words are all you see.
2. **Every field says something or isn't there.** No "Build:" with nothing
   after it, no "undefined", and no "Status: Active" (it's always Active on a
   new issue, so it tells you nothing). This is why the message is built in
   Hog code, not in the alert wizard's Blocks box: a Blocks template can't
   leave a block out when its value is missing (PostHog says so in a comment
   in its own template), and that's exactly how Eachie got its empty `>>`.
3. **Anything a person or an error can type goes in `plain_text`, never
   `mrkdwn`.** That covers error messages, issue names, nicknames and survey
   answers. In `mrkdwn`, a message containing `<!channel>` pings everyone,
   and `<anonymous>` turns into a broken link. PostHog's own insight template
   makes the same choice. The notification `text` is `mrkdwn` by nature, so
   the script escapes `& < >` there.
4. **Three lines above the button:** what broke (headline), what it said and
   where in the code (body), and one grey line of facts. That's glanceable in
   a field at 10 PM, and enough to decide "now or tomorrow".
5. **One main button, to the thing you'd act on:** the issue, the insight,
   or the replay. Issue links go through PostHog's fingerprint redirect,
   which keeps working after issues are merged (shipped 2026-07-17).
6. **Times show in the reader's own time zone**, using Slack's date token
   ("today at 9:40 PM"). That matters because an error recorded offline at
   9:40 PM may only reach PostHog hours later. The fallback text uses
   Central time.
7. **The notification text is written on purpose.** It's what a push
   notification shows, so it's never left to a default.
8. **No message beats an empty one.** If there's nothing to say (a survey
   with no answer, an event this script doesn't know), it sends nothing.
9. **Test against a real event before switching it on.** The Dec 2025
   failure was edits nobody could test (§6).

## 1. Layout: new error issue

**Example** (Festival Navigator, from the fest's own error path):

```
Festival Navigator                                          ← bot name
🟠 Fest · New error: TypeError                              ← header
Cannot read properties of null (reading 'dataset')          ← plain text
at openZoom · card-facts.js:212
Seen today at 9:40 PM  ·  v88 · iPhone · iOS 26 · Safari 26 · wall · Ross
[ Open issue ]
```

A boot crash (`kind = boot`, someone is locked out):

```
🔴 Fest · App won’t open: TypeError
Unexpected token '<'
at boot · app.js:41
Seen today at 9:40 PM  ·  v88 · iPhone · iOS 18 · Safari 18 · Kat
[ Open issue ]
```

Eachie, if its errors ever move to PostHog (audit fix 8 says not yet). A
line with nothing to say simply isn't there:

```
Eachie
🟠 Eachie · New error: TypeError
Failed to fetch
at runResearch · page-8f3a2c.js
Seen today at 2:14 PM  ·  a1b2c3d · Mac OS X 10 · Chrome 141 · /research
[ Open issue ]  [ Replay ]
```

**Notification text:** `🟠 Fest: New error — TypeError: Cannot read
properties of null (reading 'dataset')`

**Why there's no count:** PostHog fires this event on the *first* occurrence
of an issue, so the count would always read 1. "Seen" is the first-seen time.
Counts belong to the spike layout (§2), where they mean something.

**The Block Kit this produces** for the first example. Paste it into
[Slack's Block Kit Builder](https://app.slack.com/block-kit-builder) to see
it at phone width:

```json
{
  "channel": "C0A2CDKCZP1",
  "username": "Festival Navigator",
  "icon_emoji": ":tent:",
  "unfurl_links": false,
  "unfurl_media": false,
  "text": "🟠 Fest: New error — TypeError: Cannot read properties of null (reading 'dataset')",
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "🟠 Fest · New error: TypeError", "emoji": true } },
    { "type": "section", "text": { "type": "plain_text", "emoji": false,
      "text": "Cannot read properties of null (reading 'dataset')\nat openZoom · card-facts.js:212" } },
    { "type": "context", "elements": [
      { "type": "mrkdwn", "text": "Seen <!date^1790390400^{date_short_pretty} at {time}|Fri Sep 25, 09:40 PM CT>" },
      { "type": "plain_text", "emoji": false, "text": "v88 · iPhone · iOS 26 · Safari 26 · wall · Ross" }
    ] },
    { "type": "actions", "elements": [
      { "type": "button", "style": "primary", "text": { "type": "plain_text", "text": "Open issue" },
        "url": "https://us.posthog.com/project/<fest id>/error_tracking/fingerprint/<fingerprint>?timestamp=…&utm_source=alert&utm_medium=slack&utm_campaign=error_tracking_alert" }
    ] }
  ]
}
```

## 2. Layout: issue came back, or error spike

**Came back** (an issue you marked resolved shows up again, e.g. a fix that
didn't hold in a new build):

```
🔁 Fest · Back again: TypeError
Cannot read properties of null (reading 'dataset')
at openZoom · card-facts.js:212
Back today at 8:02 PM · first seen Sep 20  ·  v89 · iPhone · iOS 26 · Safari 26 · wall
[ Open issue ]
```

Notification: `🔁 Fest: Back again — TypeError: Cannot read properties of null…`

**Spiking.** PostHog's spike event carries counts but *no* exception details,
so the facts line isn't there at all, rather than showing up blank:

```
📈 Eachie · Spiking: TypeError
Failed to fetch
14 in the last 5 minutes · 7× the usual rate
Detected today at 2:20 PM
[ Open issue ]
```

On an issue's first spike, when there's no baseline yet, the count line reads
`14 in the last 5 minutes · first spike, no baseline yet` instead of a
misleading "0×" (the same guard PostHog uses in its own template).

**For festival-navigator:** DESIGN §2f leaves spike alerts out on purpose,
since with 8 people they'd never fire. The layout is shared anyway, so Eachie
gets it for free if it ever needs it.

## 3. Layout: insight threshold alert

The alert's **name is the headline**, so name alerts as the thing that
happened, e.g. "3+ phones can't sync" or "Research runs aren't finishing".
Don't use internal names like "sync_state alert".

```
📊 Fest · 3+ phones can't sync
The insight value (phones in error or blocked) for current hour (4) is more than upper threshold (2)
[ chart image ]
[ Open insight ]  [ Alert settings ]  [ Snooze… ▾ ]
```

1. The breach sentence is PostHog's own wording (from
   `products/alerts/backend/evaluation/comparator.py`) and stays plain text.
2. When an anomaly detector explains itself, its reason
   (`anomaly_rationale`) goes on a second line.
3. The chart only appears when PostHog rendered one. It attaches a chart to
   every firing Slack alert since 2026-09-08.
4. **Snooze** is PostHog's own Slack menu, copied as-is (the `block_id` must
   stay `insight_alert_snooze:<alert id>`). It works because the message is
   posted by PostHog's own Slack app. When PostHog attached an investigation
   notebook, the second button reads "Investigation" and opens it instead.

Notification: `📊 Fest: 3+ phones can't sync`

**Plan limit:** insight alerts check hourly at best on this plan (every
15 minutes needs the Boost add-on, real time needs Scale). So fest rule 4's
"within 30 minutes" becomes "within the hour" unless the plan changes.

## 4. Layout: feedback received (Eachie)

This replaces the destination that posted `>>` (audit fix 1). It reads
answers from `$survey_questions`, so no question id is hard-coded. For a
one-question survey it shows just the answer; with several questions, each
answer sits under its question.

```
Eachie
💬 Eachie · Beta Feedback
The synthesis cut off halfway through the third model's answer
jess@example.com · /research · iPhone · iOS 26 · Safari 26
[ Replay ]  [ Person ]
```

1. **Who** only appears for identified people, as PostHog's display name for
   them. On the Eachie project that's the email, since no custom display
   property is set. An anonymous visitor shows as "Anonymous visitor", never
   as a raw ID.
2. **Replay** only appears when the event has a `$session_id`.
3. A survey response with no answer text isn't sent at all.

Notification: `💬 Eachie feedback: The synthesis cut off halfway through the
third model's answer`

## 5. The shared Hog source

**One script serves all four layouts.** It branches on the event name, and
each PostHog function (one per app and trigger) runs the same source with
three inputs set: `app_label` ("Fest" or "Eachie"), `username` and
`icon_emoji`.

**Where it lives:** `ops/posthog/slack-alert.hog` in this repo (Kevin,
2026-09-25: "save the config stuff here for now"; its lasting home for shared
utilities is part of the helper reorganization). Eachie's docs point there. It holds no secrets: the Slack token comes
from the integration input at run time.

**Every construct is from a checked source:**

1. `fun`, closures, `x -> …` lambdas, `?.`, `??`, negative indexes, and
   `typeof` returning `'array'`: PostHog's Hog VM tests (`functions.hog`,
   `upvalues.hog`, `lambdas.hog`, `arrays.hog`, `typeof.hog`).
2. Library functions (`concat` treats null as empty, `empty`/`notEmpty`,
   `arrayStringConcat`, `toInt`, `toDateTime`, `formatDateTime`, `trim`,
   `replaceAll`, `splitByString`, `has`, `encodeURLComponent`, `round`,
   `toFloat`): the Hog runtime that runs destinations
   (`common/hogvm/typescript/src/stl/`).
3. The post-to-Slack tail and the scope check: PostHog's current Slack
   template.

**It has not been run** (§6 says why, and how to test it before it goes
live).

```hog
// slack-alert.hog: one Slack message design for Eachie and Festival Navigator.
// Events: $error_tracking_issue_created / _reopened / _spiking,
//         $insight_alert_firing, 'survey sent'. Anything else sends nothing.
// Inputs: slack_workspace, channel, app_label, username, icon_emoji.
// Design: claude-plans/2026-09-24-analytics/slack-alert-design.md (festival-navigator).
// Rules: a line appears only when it has something to say; anything a person or an
// error can type goes in plain_text, never mrkdwn.

let app := inputs.app_label ?? project.name
let kind := event.event
let props := event.properties
let blocks := []
let note := null // the notification text

// ---------- helpers ----------

fun clip(v, n) {
  if (empty(v)) {
    return null
  }
  let s := trim(toString(v))
  if (length(s) <= n) {
    return s
  }
  return concat(substring(s, 1, n - 1), '…')
}

fun joinPresent(parts, sep) {
  return arrayStringConcat(arrayFilter(x -> notEmpty(x), parts), sep)
}

// Notification text is mrkdwn, so escape what Slack treats as markup.
fun esc(v) {
  return replaceAll(replaceAll(replaceAll(toString(v ?? ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
}

// "Seen today at 9:40 PM" in the reader's own time zone.
fun slackTime(prefix, iso) {
  if (empty(iso)) {
    return null
  }
  let dt := toDateTime(iso)
  let ts := toInt(dt)
  if (not (ts > 0)) {
    return null
  }
  let fallback := formatDateTime(dt, '%a %b %e, %I:%i %p', 'America/Chicago')
  return concat(prefix, ' <!date^', toString(ts), '^{date_short_pretty} at {time}|', fallback, ' CT>')
}

// "iPhone · iOS 26 · Safari 26" from PostHog's standard device keys.
fun deviceLine(pr) {
  let os := empty(pr.$os) ? null : trim(concat(pr.$os, ' ', toInt(pr.$os_version)))
  let browser := empty(pr.$browser) ? null : trim(concat(pr.$browser, ' ', toInt(pr.$browser_version)))
  return joinPresent([pr.$device, os, browser], ' · ')
}

// "at openZoom · card-facts.js:212": the in-app frame nearest the crash.
// PostHog stores frames oldest-first (posthog-js reverses the raw stack), so the
// crash site is the LAST frame. Reads both raw frames (function/filename/lineno)
// and processed ones (resolved_name/source/line), then falls back to the
// flattened in-app lists PostHog adds during processing.
fun topFrame(pr) {
  let frames := pr?.$exception_list?.[1]?.stacktrace?.frames ?? []
  let inApp := arrayFilter(x -> x?.in_app == true, frames)
  let fr := inApp?.[-1] ?? frames?.[-1]
  let fnName := null
  let file := null
  let lineNo := null
  if (notEmpty(fr)) {
    fnName := fr.resolved_name ?? fr.function
    file := fr.source ?? fr.filename
    lineNo := fr.line ?? fr.lineno
  } else {
    fnName := pr?.$exception_functions?.[-1]
    file := pr?.$exception_sources?.[-1]
  }
  if (fnName == '?' or fnName == '<anonymous>') {
    fnName := null
  }
  let base := null
  if (notEmpty(file)) {
    base := splitByString('/', splitByString('?', toString(file))[1])[-1]
  }
  let loc := empty(base) ? null : (empty(lineNo) ? base : concat(base, ':', toString(lineNo)))
  let out := joinPresent([empty(fnName) ? null : concat('at ', fnName), loc], ' · ')
  return empty(out) ? null : out
}

fun issueUrl(pr) {
  if (notEmpty(pr.fingerprint)) {
    return concat(project.url, '/error_tracking/fingerprint/', encodeURLComponent(pr.fingerprint),
      '?timestamp=', encodeURLComponent(pr.exception_timestamp ?? ''),
      '&utm_source=alert&utm_medium=slack&utm_campaign=error_tracking_alert')
  }
  return concat(project.url, '/error_tracking/', event.distinct_id)
}

fun button(label, url, isMain) {
  let b := {'type': 'button', 'text': {'type': 'plain_text', 'text': label}, 'url': url}
  if (isMain) {
    b['style'] := 'primary'
  }
  return b
}

fun header(s) {
  return {'type': 'header', 'text': {'type': 'plain_text', 'text': clip(s, 150), 'emoji': true}}
}

fun plainSection(s) {
  return {'type': 'section', 'text': {'type': 'plain_text', 'text': s, 'emoji': false}}
}

// ---------- §1 and §2: error issues ----------

if (kind == '$error_tracking_issue_created' or kind == '$error_tracking_issue_reopened' or kind == '$error_tracking_issue_spiking') {
  let reopened := kind == '$error_tracking_issue_reopened'
  let spiking := kind == '$error_tracking_issue_spiking'
  let boot := props.kind == 'boot'
  let icon := spiking ? '📈' : (reopened ? '🔁' : (boot ? '🔴' : '🟠'))
  let verb := spiking ? 'Spiking' : (reopened ? 'Back again' : (boot ? 'App won’t open' : 'New error'))
  let name := clip(props.name ?? props.$exception_types?.[1] ?? 'Error', 110)

  blocks := arrayPushBack(blocks, header(concat(icon, ' ', app, ' · ', verb, ': ', name)))

  let countLine := null
  if (spiking) {
    let cur := toFloat(props.current_bucket_value)
    let baseline := toFloat(props.computed_baseline)
    let rate := (baseline > 0) ? concat(toString(round(cur / baseline)), '× the usual rate') : 'first spike, no baseline yet'
    countLine := concat(toString(toInt(cur)), ' in the last 5 minutes · ', rate)
  }
  let bodyText := joinPresent([clip(props.description, 280), topFrame(props), countLine], '\n')
  if (notEmpty(bodyText)) {
    blocks := arrayPushBack(blocks, plainSection(bodyText))
  }

  let seen := slackTime(spiking ? 'Detected' : (reopened ? 'Back' : 'Seen'), props.exception_timestamp)
  let firstSeen := reopened ? slackTime('first seen', props.first_seen) : null
  let timeText := joinPresent([seen, firstSeen], ' · ')
  let facts := joinPresent([props.build, deviceLine(props), props.screen ?? props.$pathname, props.member_name], ' · ')
  let ctx := []
  if (notEmpty(timeText)) {
    ctx := arrayPushBack(ctx, {'type': 'mrkdwn', 'text': timeText})
  }
  if (notEmpty(facts)) {
    ctx := arrayPushBack(ctx, {'type': 'plain_text', 'text': clip(facts, 300), 'emoji': false})
  }
  if (notEmpty(ctx)) {
    blocks := arrayPushBack(blocks, {'type': 'context', 'elements': ctx})
  }

  let buttons := [button('Open issue', issueUrl(props), true)]
  if (notEmpty(props.$session_id)) {
    buttons := arrayPushBack(buttons, button('Replay', concat(project.url, '/replay/', encodeURLComponent(props.$session_id)), false))
  }
  blocks := arrayPushBack(blocks, {'type': 'actions', 'elements': buttons})

  let said := empty(props.description) ? '' : concat(': ', esc(clip(props.description, 120)))
  note := concat(icon, ' ', esc(app), ': ', verb, ' — ', esc(name), said)

// ---------- §3: insight threshold alerts ----------

} else if (kind == '$insight_alert_firing') {
  let title := props.alert_name ?? props.insight_name ?? 'Insight alert'
  blocks := arrayPushBack(blocks, header(concat('📊 ', app, ' · ', title)))

  let bodyText := joinPresent([clip(props.breaches, 1500), clip(props.anomaly_rationale, 500)], '\n')
  if (notEmpty(bodyText)) {
    blocks := arrayPushBack(blocks, plainSection(bodyText))
  }
  if (notEmpty(props.insight_chart_url)) {
    blocks := arrayPushBack(blocks, {'type': 'image', 'image_url': props.insight_chart_url, 'alt_text': 'Insight chart'})
  }

  let insightUrl := concat(project.url, '/insights/', props.insight_id, '?utm_source=alert&utm_medium=slack&utm_campaign=alert_check_firing')
  let hasInvestigation := notEmpty(props.investigation_notebook_url)
  let secondUrl := hasInvestigation ? props.investigation_notebook_url : concat(project.url, '/insights/', props.insight_id, '/alerts?alert_id=', props.alert_id, '&utm_source=alert&utm_medium=slack&utm_campaign=alert_check_firing')
  blocks := arrayPushBack(blocks, {
    'type': 'actions',
    // PostHog's snooze handler finds the alert through this block_id; keep it exactly.
    'block_id': concat('insight_alert_snooze:', props.alert_id),
    'elements': [
      button('Open insight', insightUrl, true),
      button(hasInvestigation ? 'Investigation' : 'Alert settings', secondUrl, false),
      {
        'type': 'static_select',
        'action_id': 'insight_alert_snooze',
        'placeholder': {'type': 'plain_text', 'text': 'Snooze…'},
        'options': [
          {'text': {'type': 'plain_text', 'text': 'For 1 hour'}, 'value': concat(props.alert_id, '|1h')},
          {'text': {'type': 'plain_text', 'text': 'For 6 hours'}, 'value': concat(props.alert_id, '|6h')},
          {'text': {'type': 'plain_text', 'text': 'For 1 day'}, 'value': concat(props.alert_id, '|1d')},
          {'text': {'type': 'plain_text', 'text': 'For 1 week'}, 'value': concat(props.alert_id, '|1w')},
          {'text': {'type': 'plain_text', 'text': 'Pick a date & time…'}, 'value': concat(props.alert_id, '|custom')}
        ]
      }
    ]
  })
  note := concat('📊 ', esc(app), ': ', esc(title))

// ---------- §4: survey feedback ----------

} else if (kind == 'survey sent') {
  let answered := []
  for (let q in props.$survey_questions ?? []) {
    let r := q?.response
    if (typeof(r) == 'array') {
      r := arrayStringConcat(r, ', ')
    }
    if (notEmpty(r)) {
      answered := arrayPushBack(answered, {'question': q?.question, 'answer': toString(r)})
    }
  }
  if (empty(answered)) {
    return // nothing to say: send nothing
  }
  let lines := []
  for (let a in answered) {
    if (length(answered) == 1) {
      lines := arrayPushBack(lines, clip(a.answer, 1500))
    } else {
      lines := arrayPushBack(lines, concat(clip(a.question, 150) ?? '', '\n', clip(a.answer, 600)))
    }
  }

  let identified := notEmpty(person?.properties?.email) or notEmpty(person?.properties?.name)
  blocks := arrayPushBack(blocks, header(concat('💬 ', app, ' · ', props.$survey_name ?? 'Feedback')))
  blocks := arrayPushBack(blocks, plainSection(arrayStringConcat(lines, '\n\n')))
  let facts := joinPresent([identified ? person.name : 'Anonymous visitor', props.$pathname, deviceLine(props)], ' · ')
  blocks := arrayPushBack(blocks, {'type': 'context', 'elements': [{'type': 'plain_text', 'text': clip(facts, 300), 'emoji': false}]})

  let buttons := []
  if (notEmpty(props.$session_id)) {
    buttons := arrayPushBack(buttons, button('Replay', concat(project.url, '/replay/', encodeURLComponent(props.$session_id)), true))
  }
  if (identified and notEmpty(person?.url)) {
    buttons := arrayPushBack(buttons, button('Person', person.url, empty(buttons)))
  }
  if (notEmpty(buttons)) {
    blocks := arrayPushBack(blocks, {'type': 'actions', 'elements': buttons})
  }
  note := concat('💬 ', esc(app), ' feedback: ', esc(clip(answered[1].answer, 140)))

} else {
  return // an event this script doesn't know: send nothing rather than a blank message
}

// ---------- post (the tail of PostHog's current Slack template) ----------

let payload := {'channel': inputs.channel, 'blocks': blocks, 'text': note, 'unfurl_links': false, 'unfurl_media': false}
let granted := replaceAll(inputs.slack_workspace.scope ?? '', ' ', '')
let canCustomize := empty(granted) or has(splitByString(',', granted), 'chat:write.customize')
if (canCustomize and notEmpty(inputs.icon_emoji)) {
  payload['icon_emoji'] := inputs.icon_emoji
}
if (canCustomize and notEmpty(inputs.username)) {
  payload['username'] := inputs.username
}

let res := fetch('https://slack.com/api/chat.postMessage', {
  'body': payload,
  'method': 'POST',
  'headers': {
    'Authorization': f'Bearer {inputs.slack_workspace.access_token}',
    'Content-Type': 'application/json; charset=utf-8'
  }
})
if (res.status != 200 or res.body.ok == false) {
  throw Error(f'Slack refused the message: {res.status}: {res.body}')
}
```

### Property paths each layout reads

| Path in the script | Layout | Where it comes from | Fest source (to build) | Eachie source |
|---|---|---|---|---|
| `event.event` | all | PostHog | — | — |
| `name`, `description` | §1, §2 | issue name and description (PostHog sets them from the exception type and message, or from `$issue_name` / `$issue_description`) | `$exception_list[].type/value`; `$issue_name` for vague kinds (below) | posthog-js |
| `fingerprint`, `exception_timestamp`, `first_seen` | §1, §2 | PostHog alert event | — | — |
| `current_bucket_value`, `computed_baseline` | §2 spike | PostHog alert event | — | — |
| `$exception_list[1].stacktrace.frames[]` (`function`/`resolved_name`, `filename`/`source`, `lineno`/`line`, `in_app`) | §1, §2 | the exception that opened the issue (PostHog copies its properties onto the alert event) | errlog.js frames | posthog-js |
| `$exception_functions`, `$exception_sources`, `$exception_types` | §1, §2 fallback | added by PostHog's processing | — | — |
| `kind` | §1 (🔴 for `boot`) | exception property | errlog.js `kind` (DESIGN §2c.3) | not sent |
| `build` | §1, §2 | exception property | `build` (DESIGN §2c.4) | **not sent yet** (audit fix 6) |
| `$device`, `$os`, `$os_version`, `$browser`, `$browser_version` | §1, §2, §4 | exception / event property | **send these standard keys** (below) | posthog-js, automatic |
| `screen` or `$pathname` | §1, §2, §4 | exception / event property | `screen` | `$pathname` |
| `member_name` | §1, §2 | exception property | crew display name (Decision 3) | not sent |
| `$session_id` | §1, §2, §4 | event property | not sent (no replay) | posthog-js |
| `alert_name`, `insight_name`, `insight_id`, `alert_id`, `breaches`, `anomaly_rationale`, `insight_chart_url`, `investigation_notebook_url` | §3 | PostHog `$insight_alert_firing` (`posthog/tasks/alerts/utils.py`) | — | — |
| `$survey_name`, `$survey_questions[] {question, response}` | §4 | posthog-js survey event | — | posthog-js |
| `person.name`, `person.url`, `person.properties.email/name` | §4 | PostHog person | — | Clerk identify |

**When the exception is too big:** if the copied properties are too large for
PostHog's internal message queue, PostHog drops them and sets
`message_was_too_large`. The script then sends just the headline, the message
and the time. That's the rule working as intended: missing facts disappear,
they don't turn into blanks.

### What the fest error path should send, so these messages read well

These refine DESIGN §2c. They're small, and they're cheapest to settle before
the v88 build.

1. **Frames:** PostHog's manual-capture docs require `platform: "custom"` on
   every frame, plus `function` (use `"?"` when unknown; the script drops
   it). Add `lang: "javascript"`. Put the **crash site last**, the same way
   posthog-js reverses the raw stack. The V8 and WebKit stack text puts it
   first.
2. **Device:** use PostHog's standard keys `$device`, `$os`, `$os_version`,
   `$browser`, `$browser_version` (and `$device_type`), not custom names. One
   template then serves both apps, and PostHog's own filters work on the fest
   project.
3. **Readable issue names:** set `$issue_name` where the exception type says
   little, especially for stackless kinds. For example,
   `zoom-close-after-click` → "Zoom closed right after a click", and
   `sync:blocked` → "Server refused a sync". PostHog uses it only on the event
   that creates the issue, so it names both the issue list and the Slack
   headline. The phone already knows what each `kind` means, so the label
   belongs there, not in the template. **Leave `boot` alone:** the script
   already heads it "App won’t open", and a matching `$issue_name` would print
   that twice.
4. **Same names as Eachie:** `build`, `screen`, and `member_name` for the
   crew display name. Tokens and note text never go in any field (DESIGN
   §2d).

## 6. How to install, test and roll back

**Needed from Kevin first:**

1. **Grant scopes on the PostHog MCP key** (or re-authenticate the MCP):
   a. `hog_function:write` to create and test the Slack functions and
      error-tracking alerts (`error-tracking-alerts-create`,
      `cdp-functions-create`, `cdp-functions-partial-update`,
      `cdp-functions-invocations-create`);
   b. `alert:write` + `insight:write` for the insight alerts;
   c. `project:write` for test-account filters and the fest project's
      "discard client IP" setting;
   d. optional: `subscription:write`.
2. **Connect Slack in the new fest project** (Settings → Integrations →
   Slack). It's a browser consent screen only Kevin can click through.
   Integrations belong to one project, so the Eachie project's "Trimm"
   connection doesn't carry over.
3. **Spike detection settings** have no API. Leave them off for fest; tune
   them in the UI later if Eachie wants spikes.

**Install:** one function per app and trigger, all running the §5 source.

| App | Function | Type | Filter |
|---|---|---|---|
| Fest | New error | internal destination | `$error_tracking_issue_created` |
| Fest | Came back | internal destination | `$error_tracking_issue_reopened` |
| Fest | Sync trouble | insight alert destination | `$insight_alert_firing` for that alert |
| Eachie | Feedback received | destination | `survey sent`, **filter test accounts on** |
| Eachie | Research not finishing | insight alert destination | `$insight_alert_firing` for that alert |

For error alerts, create them with `error-tracking-alerts-create`
(`template-slack`), then set the source with `cdp-functions-partial-update`
if the create call doesn't take source directly. For insight alerts, create
the destination with `alert-destinations-create`, then swap its source the
same way. Inputs: the project's Slack integration, channel `C0A2CDKCZP1`, and
`app_label` / `username` / `icon_emoji` (for example "Fest" / "Festival
Navigator" / `:tent:`, and "Eachie" / "Eachie" / its own emoji).

**Test before switching on.** This is the step Dec 2025 never had.

1. Create each function **disabled**.
2. Run it once with `cdp-functions-invocations-create` (or "Test function" in
   the UI), using a real event as the mock:
   a. fest: the first deliberate test error, sent from a phone to the new
      project (DESIGN §6, not verified item 5);
   b. Eachie feedback: `survey sent` `019b29e8-89f6-770e-b0b8-d83041dab3d7`
      (Dec 17);
   c. an insight alert: its "test" check.
3. Read the result in Slack **on a phone**, and check it against the
   examples above. Also read the function's logs for Hog errors.
4. Then enable it.
5. For Eachie, disable the old "Slack" destination only after the new one
   has posted correctly once.

**Rollback:** disable the function. Nothing is deleted, and the old function
stays in place, disabled, as the record.

**Why the script is untested:** running Hog here needed PostHog's query API
with a local key. Loading that key was blocked as credential handling, so
nothing was run. Every construct is taken from PostHog's own shipped
templates, its Hog VM tests, or its runtime source (listed in §5). The
realistic failure is a Hog syntax slip, and step 2 catches that before
anything reaches Slack.

## 7. Open questions (each answerable in a word)

1. Where does `slack-alert.hog` live? **Lean: this repo, `ops/posthog/`**,
   deployed to both projects. Or `hg-agents`.
2. Rename #eachie-feedback to something neutral like `#hg-alerts`? The id
   stays the same, so nothing breaks. *yes / no*
3. Eachie's errors: stay in Sentry (my lean), or move to PostHog so they use
   §1 and §2? *stay / move*
4. Show the crew nickname (`member_name`) in fest error messages? Decision 3
   allows it, and it tells you who to ask. *yes / no*

## 8. Stale line in DESIGN.md

DESIGN §2f still says alerts go to "a channel like `#fest-alerts`… or a DM
(open question 2)". Decision 1 replaced that with the Eachie channel,
`C0A2CDKCZP1`. Fix it when DESIGN.md is next edited. It was left alone here,
since this pass was scoped to these two files.
