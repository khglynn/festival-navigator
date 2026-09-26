# Portola live ops — the runbook (2026-09-25 → Sep 28)

Kevin is at Portola with friends who use the app; he relays feedback from
his phone and cannot run commands. One session (this folder's owner) ships
fixes to production while people use it. Everything below is executed by
that session; Kevin is asked only for decisions, never for commands.
Evidence for every rule is in `research/` beside this file.

## Lanes

1. Release work happens in its own worktree per release
   (`.claude/worktrees/vNN`, branch `live/vNN`, off origin/main). Ops docs
   live in `.claude/worktrees/portola-live` (branch `live/portola`). The main
   checkout belongs to other sessions: never switch its branch.
2. The city-seasons session works in `.claude/worktrees/season-*` and does
   not merge to main before Mon Sep 28 (its own rule). Main can still move
   under us (docs merges from other sessions): re-stamp above the newest
   main before promoting.
3. Budget and memory: one Codex job and one browser at a time; Sonnet for
   breadth and walks, Opus for judgment, never Fable in a fan-out.

## Ship (every release)

1. Build on `live/vNN`; client-only unless Kevin has made the call (red
   lines below). Commit as you go; a branch push is a preview only.
2. Pre-flight: record the rollback target — the deployment actually serving
   the live domains, `vercel inspect https://fest.kevinhg.com --scope
   kevinhg` (its `id` and `url`), not the newest production build, which
   after a rollback may never have gone live — in the PR body. If the release is anywhere near data, take a Neon branch
   first: `create_branch {project_id: floral-meadow-70237530, name:
   backup-<date>-pre-vNN, no_compute: true}` (point-in-time restore only
   reaches back 24 h; there are no snapshots).
3. Stamp on a clean tree above the newest origin/main:
   `node scripts/sw-stamp.mjs` (a real release) or `--keep` (a fix to a
   still-unreleased version). `git status --short` must be empty first.
4. Local gate: `npm test`, `TZ=Asia/Tokyo npm test`,
   `node scripts/validate-festivals.mjs`; `npm run test:browser` when the
   release is visual.
5. PR → CI. **Check both jobs by name** (`gh pr checks`): the ruleset only
   requires `checks`, so `browser` can be red under a green merge button.
   CI is ~4 min (the two jobs run in parallel); `checks` now also runs a
   Portola Saturday-night pass (`tests/helpers/night-clock.mjs`).
6. Independent review on the exact head: Codex **Sol 6** (`gpt-6-sol`,
   xhigh) through `codex-run.sh`, in a detached worktree at the head sha
   with `node_modules` symlinked. Fix real findings, re-stamp `--keep`,
   loop to 4. Every release also gets a real-browser walk (a Sonnet
   teammate, phone viewport, real input) of the states it touches —
   CLAUDE.md asks for one before any promote, visual or not.
7. Merge yourself (`gh pr merge --merge`) — Kevin's standing rule — unless a
   finding is a product call he hasn't seen or it touches friends' data.
8. Verify: wait for main's CI, then run `node ops/prod-smoke.mjs` **from
   the release worktree** (it expects that checkout's CACHE_VERSION and
   ASSET_STAMP; elsewhere pass them: `node ops/prod-smoke.mjs
   https://fest.kevinhg.com festival-nav-vNN <stamp>`). It checks all three
   hosts serve identical bytes of the new build and boots every host's
   landing plus gallery.html in iPhone WebKit with no errors, blocking every
   write, telemetry call and service worker; ~18 s. Then watch errors for
   15 min (PostHog project 627900 — see Observability).
9. Tell Kevin in one short message: what changed, what to try, "say roll
   back to undo". Update NOW.md and the LEDGER.

## Undo

1. Friends hurt now: `vercel rollback <recorded target URL> --scope kevinhg
   --yes`. **Never a bare `vercel rollback`** — docs merges redeploy the same
   code, so "previous" is usually the release itself.
2. A rollback turns off auto-assign: nothing merged afterwards goes live
   (data drops included) until `vercel promote <good deployment>`. Revert
   on main through a PR first, then promote that build. The session that
   rolled back owns the promote.
3. Cosmetic bug: skip the rollback, revert forward (~5 min).
4. Phones follow a rollback on their next open or foreground; a busy phone
   (zoom, sheet or typing) shows the refresh strip instead.

## Red lines (Kevin's explicit call first)

1. Any new key, shape, note scope or value written into a crew or person
   doc — the server allows only known keys, and after a rollback a phone's
   whole unsynced queue is refused forever.
2. Tightening a validator, limit, name rule or token pattern.
3. Changing the meaning of stored values, or migrating stored docs.
4. Any database change (merge function, constraints, schema).
5. Renaming or removing artist names, festival ids or note-target formats
   in a live fest (pick keys; the freeze file).
6. The update machinery: service-worker.js strategies, APP_CORE handling,
   activate cleanup, `DATA_CACHE`, index.html's reload glue.
7. Env vars, vercel.json rewrites and headers, GET response shapes.

Safe under the standing rules: client UI, CSS and motion that write nothing
new; festival data that only adds (validator + freeze + CI).

## Observability

1. Phone errors reach PostHog project 627900 through `js/errlog.js` with
   build, screen, sync state, and the member's name and pid — when the phone
   allows it: reports are queued while offline and never sent with
   reporting off or Stay offline on, so a quiet dashboard is not proof of
   no errors.
2. Reading it: the PostHog MCP's active project is global and another
   session uses it, so do not switch it. A personal API key scoped to 627900
   in `~/.env` unblocks queries and the Slack alert install (both drafted in
   `research/observability.md`). Until then, ask Kevin what the phone's
   Settings → Diagnostics build line says.

## Reviewer comparison (Kevin's ask)

Sol 6 gates every ship. After a ship, Astra 6 (`gpt-6-astra`) and Terra 5.6
(`gpt-5.6-terra`, the only Terra) review the same head at the same effort,
one at a time, in the background. Every finding is logged in LEDGER.md as
real / false alarm / missed-by, with duration and usage, and summarized for
Kevin at the end of the weekend.
