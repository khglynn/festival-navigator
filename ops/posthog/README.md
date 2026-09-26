# PostHog → Slack alert script (shared with Eachie)

`slack-alert.hog` is one Slack message design for both of Kevin's PostHog
projects: **Festival Navigator** (627900) and **Eachie** (262708). It turns
four kinds of PostHog event into short messages that read well on a phone —
a new error, an error that came back or is spiking, a number crossing a
threshold, and Eachie's feedback surveys — and drops any line that has
nothing to say. It replaces Eachie's old template, whose messages always
rendered as an empty `>>` (the audit is in
`claude-plans/2026-09-24-analytics/eachie-posthog-audit.md`).

**Status, 2026-09-25 ~11 PM PT: the two Fest functions are installed and
enabled** in project 627900, posting to #eachie-feedback (`C0A2CDKCZP1`)
through the Slack integration 269583: "Fest → New error (Slack)"
`01a0dc4b-3d7f-0000-61fd-e4e3772ff5fd` and "Fest → Came back (Slack)"
`01a0dc4b-3f7d-0000-2c11-33da43f78cc6`. Both passed a real test invocation
(`mock_async_functions: false` — the default `true` only simulates the Slack
post) on the real SyntaxError issue. The Eachie function is not installed.

The error events' details live under `props.exception_props.*` (only name,
description, first_seen, severity, fingerprint, exception_timestamp and
status are top-level), so the script reads `exception_props.X` first and
falls back to `props.X` — Eachie's survey path, which has no
`exception_props`, is unchanged. Each Fest error message carries a "What it means" line for a
non-developer, from a small table in the script (the app's own error kinds,
then a few browser-message patterns; an unrecognized error gets no line
rather than a guess) — added 2026-09-25 at Kevin's ask. Rollback: PATCH each function
`{"enabled": false}` at `/api/environments/627900/hog_functions/<id>/` with
the write key (`POSTHOG_API_KEY_FESTNAV` in ~/.env).

## Why it lives here, for now

Kevin, 2026-09-25: "let's just save the config stuff here for now." It is
shared by two repos, so its lasting home is part of the helper reorganization
(a Pen sub-item under "Reorganize helper — split cross-machine-sync out…":
find a home for shared utilities). Until then this copy is the master; PostHog
holds the running copies, one per function.

## Installing it

The full procedure — scopes, the one function per app and trigger, the test
invocation that must pass before anything is switched on, and rollback — is
§6 of `claude-plans/2026-09-24-analytics/slack-alert-design.md`. In short:

| App | Function | Trigger |
|---|---|---|
| Fest | New error | `$error_tracking_issue_created` |
| Fest | Came back | `$error_tracking_issue_reopened` |
| Eachie | Feedback received | `survey sent`, test accounts filtered out |

Each runs this same source with its own inputs: `slack_workspace` (the
integration), `channel`, `app_label` ("Fest" or "Eachie"), `username` and
`icon_emoji`. It holds no secrets: the Slack token comes from the integration
at run time.

## Decisions on record (2026-09-25)

1. Eachie's errors stay in Sentry (that path works).
2. Alerts go to the channel Eachie's PostHog already uses (#eachie-feedback,
   `C0A2CDKCZP1`); renaming it to a shared name like #app-alerts is agreed in
   principle and not yet done. Renaming keeps the id, so nothing here changes.
3. Eachie's own rollup job (the twice-weekly post in #eachie-system with
   always-zero numbers) is Eachie's code; its fix is a Pen item for an Eachie
   session.
