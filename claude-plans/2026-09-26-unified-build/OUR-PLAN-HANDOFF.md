# Our plan — handoff to a sibling session (2026-09-26 ~4:30 AM PT)

You are a full Claude Code session started from this file, running beside the live-ops
coordinator session (named **festival-navigator-81** — reach it with SendMessage by that
name). Kevin (the owner, a designer, at Portola in San Francisco this weekend with his
phone) asked for this: "I think 6 [Our plan] would add a ton of value. want to spin up a
parallel session for that work?" Name this session **"Our plan build"** if you save it.

## The goal, in Kevin's terms

Friends at a festival want to answer "where will most of us be, when?" — to meet up.
Our plan is the app's answer: a peek row just above the dock (the artist big, the place
under it; NOW/NEXT with its time just left of the count; one text size for the second
line) that drags up into the whole day plan in the same rows (quiet times, bigger artist
names); on a laptop, a corner card with an Open button that grows into a 400px right
panel with the wall still usable; one NOW once it exists (the NOW tab leaves the dock);
an artist who plays twice counts at both places; hidden rooms stay hidden; the bar is
max(3, ceil(pickers/4)). No "Tell a friend".

Target: ready to ship before Portola ends (Sun Sep 27) if — and only if — the full gate is
clean; otherwise ready for ACL (Late nights from Tue Sep 29; Zilker weekend 1 Oct 2–4).
The unified plan's own timing section says a peek landing mid-festival is risky; weigh
that honestly with the coordinator rather than rushing.

## Read, in this order

1. The repo `CLAUDE.md` (loaded for you) — its laws bind (the fest accent in four places,
   one card-column token, 44px floor, the motion law, storage getters, WebIDL receivers,
   the public repo and crew tokens, the SW stamp only at release, staging = production DB).
2. `claude-plans/2026-09-26-unified-build/PLAN.md` — Kevin's calls at the top, §2.6 (Our
   plan: the data, then the UI), §2.7 (the dock and the one-NOW rule), U4 (the shelf part
   1: companions and the floor line), U6 (the week, one live window, the plan model), U7
   (Our plan on phones), U8 (Our plan on computers), §4 timing, §6 the fragile places.
   Then `REVIEW-1.md` (Codex's review of the plan: the plan cache must invalidate on picks;
   peek visibility under search/desktop; liveWindowOf is a behaviour change — its own gated
   step; bulk/bring writers) and `map-plan-now-dock.md`.
3. The design: `claude-plans/2026-09-25-portola-live/design/ours-r2/` (BRIEF.md, the R3
   frames and rigs — the approved direction) and the round-4 answers on the review page
   https://claude.ai/artifact/WC7kW75eAHCibMUwF7Lzjv (the `decisions` collection in its
   database: `r4-*` and `ours-*` rows; read them with the ArtifactData tool, list action)
   plus `claude-plans/2026-09-25-portola-live/LEDGER.md` "Kevin's calls" #5.
4. `claude-plans/2026-09-26-unified-build/NOW.md` — the build's cursor; the coordinator
   owns it; append a short "Our plan" line when you have a milestone.

## Where and how

- Worktree: `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/plan`,
  branch `live/plan`, based on `live/list` (the List view build in progress, itself on
  v93: the NOW tab and the Show menu popover). Stay in it. Merge (never rebase) the
  coordinator's branches in when it tells you they moved (`git fetch && git merge
  origin/live/list` or `origin/main`).
- Others are building at the same time: the List view + menu bar (`live/list`: the list
  renderer, the dock's three-line icon and dot, the menu), the tap-opens-the-notes-shelf
  change (`live/tap`: card-facts / the card's press wiring), and later the people menu
  (the dock's left side). Own your surfaces — the plan model, the peek, the day plan,
  the laptop panel — and keep your edits to shared files (app.js, v3.css, index.html's
  dock) small and well-marked so merges stay easy. The one-NOW rule removes the dock's
  NOW tab: coordinate that with the coordinator before you delete it (the List build and
  v93 both touch it).
- Model and effort: you run on Kevin's default; use Opus at effort high for any agents you
  start (design and build); Sonnet only for real-browser walkers. Codex reviews: GPT-6
  Sol at high — `~/DevKev/hg-agents/commands/lib/codex-run.sh start --cwd <a clean
  detached gate worktree> --prompt-file <f> --model gpt-6-sol --effort high --write`.
- Design first where the approved frames don't cover a state: render frames with the
  production app (rigs like `design/ours-r2/rig.mjs` or `design/folsom-by-time/rig.mjs` —
  local server, in-memory /api, a made-up crew, SW blocked), look at them, and send the
  new states to Kevin on your OWN review page (a new artifact, not the coordinator's) with
  tap-answerable decisions. His taste notes: no stacks of pills, bare glyphs over shaped
  buttons, motion that grows from where things are, nothing pops.
- Bank as you go: a build log `claude-plans/2026-09-26-unified-build/OUR-PLAN-BUILD.md`
  started before code; commit on `live/plan` after each working step (scope-prefixed, no
  "wip"), push after each commit (a preview deploy only), scan each diff for a crew token
  (`#g=` + a long token) with && before committing.
- The gate before release (RUNBOOK: `claude-plans/2026-09-25-portola-live/RUNBOOK.md`):
  `npm test` in UTC, `TZ=Asia/Tokyo` and the night clock; `npm run test:browser`
  (WebKit runs locally only); a Sol review with its real findings fixed; an independent
  Sonnet walker with real input (never your own walk alone). Then SendMessage the
  coordinator ("festival-navigator-81") with the head SHA, the gate results and frame
  paths — **the coordinator does the merge, the stamp, the PR and the prod smoke**, so
  two sessions never race to production. Don't stamp, don't open a PR, don't merge.
- Never load a real crew link, never touch production or a preview with a real crew, never
  write the database (previews and `vercel dev` use production's).
- Message the coordinator at milestones (design frames ready for Kevin; gated head ready)
  and whenever you're blocked; otherwise work.
