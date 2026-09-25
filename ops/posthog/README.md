# PostHog → Slack alert script (shared with Eachie)

`slack-alert.hog` is one Slack message design for both of Kevin's PostHog
projects: **Festival Navigator** (627900) and **Eachie** (262708). It turns
four kinds of PostHog event into short messages that read well on a phone —
a new error, an error that came back or is spiking, a number crossing a
threshold, and Eachie's feedback surveys — and drops any line that has
nothing to say. It replaces Eachie's old template, whose messages always
rendered as an empty `>>` (the audit is in
`claude-plans/2026-09-24-analytics/eachie-posthog-audit.md`).

**Status, 2026-09-25:** written and reviewed against PostHog's own sources,
**not yet installed or run**. Slack (the "Trimm" workspace) is connected to
the Festival Navigator project (integration 269583); no function uses it yet.

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
