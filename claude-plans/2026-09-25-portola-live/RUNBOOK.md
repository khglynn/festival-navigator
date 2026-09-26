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
3. Budget and memory: one Codex job and one browser at a time; never Fable
   in a fan-out. High effort is the default for every agent (Kevin,
   2026-09-26): Opus for design and key build work (Sonnet lacks the taste
   for design), Sonnet for walks and data research.

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
   Bring main in with `git merge origin/main`, not a rebase: the branch is
   pushed and its head sha is what Codex and the walker judged, and the
   merge commit records how each conflict was resolved (35cb467). The number
   follows ship order, not branch names: v94 shipped before `live/v93`, so
   that branch re-stamps above main and ships as v96 (2026-09-26).
4. Local gate: `npm test`, `TZ=Asia/Tokyo npm test`, the festival-night
   pass `NIGHT_CLOCK=2026-09-27T04:30:00Z NODE_OPTIONS="--import
   ./tests/helpers/night-clock.mjs" npm test`, and
   `node scripts/validate-festivals.mjs`; `npm run test:browser` when the
   release is visual.
5. PR → CI. **Check both jobs by name** (`gh pr checks`): the ruleset only
   requires `checks`, so `browser` can be red under a green merge button.
   CI is ~4 min (the two jobs run in parallel); `checks` now also runs a
   Portola Saturday-night pass (`tests/helpers/night-clock.mjs`). Poll the
   two jobs by name rather than `gh pr checks --watch`, which never returns
   while an unrelated check (the staging deploy) sits pending:
   `gh pr checks <n> --json name,bucket --jq '.[] | select(.name=="checks"
   or .name=="browser") | "\(.name) \(.bucket)"'`.
6. Independent review on the exact head: Codex **Sol 6** (`gpt-6-sol`,
   high since 2026-09-26; xhigh before) through `codex-run.sh`, in a
   detached worktree at the head sha with `node_modules` symlinked. Fix
   real findings, re-stamp `--keep`,
   loop to 4. Every release also gets a real-browser walk (a Sonnet
   teammate, phone viewport, real input) of the states it touches —
   CLAUDE.md asks for one before any promote, visual or not. The walker is
   not the builder: on 2026-09-26 independent walks caught two bugs the
   builder's own walk had passed (Escape regrowing a zoom; a welcome that
   never showed).
   **When a third round finds a new hole of the same kind, stop patching and
   cut the mechanism, not the feature.** v93's stay-open Show menu took four
   rounds of Back bugs, costing more than three other releases together, and
   every one came from the menu owning a browser-history entry. As a popover
   with no entry it kept the feature and lost the whole class of bug (the
   first proposal cut the feature; Kevin pushed back). Say what was cut and
   where it is banked (`v93-BUILD.md` on `live/v93`, which lands with v96).
7. Merge yourself (`gh pr merge --merge`) — Kevin's standing rule — unless a
   finding is a product call he hasn't seen or it touches friends' data.
8. Verify: wait for main's CI, then run `node ops/prod-smoke.mjs` **from
   the release worktree** (it expects that checkout's CACHE_VERSION and
   ASSET_STAMP; elsewhere pass them: `node ops/prod-smoke.mjs
   https://fest.kevinhg.com festival-nav-vNN <stamp>` — both, or it
   refuses). It checks all three hosts serve the new build and identical
   bytes for every APP_CORE file, boots every host's landing plus
   gallery.html in iPhone WebKit with no errors while blocking every write,
   telemetry call and service worker, then lets the worker install on the
   landing and confirms it caches the new build; ~30 s. One transient miss
   on one host (a host a few seconds behind, a single fetch error) earns one
   rerun, which came back clean both times it happened (v91, v95); the same
   failure twice is real. Then watch errors for
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
2. Reading it: never switch the PostHog MCP's active project (it is
   global). Use the REST API with `POSTHOG_API_KEY` from `~/.env` (reads
   project 627900: `POST /api/projects/627900/query/` with HogQL); the key
   with hog_function:write is `POSTHOG_API_KEY_FESTNAV` (also Keychain
   `posthog-festnav-hogwrite`). Queries in `research/observability.md`
   (the first one's fixed). After a ship: exceptions by build since the
   merge time; zero is only meaningful if phones are online.

## Reviewer comparison (Kevin's ask)

Sol 6 gates every ship. After a ship, Astra 6 (`gpt-6-astra`) and Terra 5.6
(`gpt-5.6-terra`, the only Terra) review the same head at the same effort,
one at a time, in the background. Every finding is logged in LEDGER.md as
real / false alarm / missed-by, with duration and usage, and summarized for
Kevin at the end of the weekend.
