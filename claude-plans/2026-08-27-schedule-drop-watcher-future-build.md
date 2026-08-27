# Future build: the "schedule dropped" watcher → data PR → Slack approve

*Banked 2026-08-27, the night Portola's set times dropped and the crew chat
beat us to it by an hour. Kevin's ask: catch this kind of drop automatically,
fold the data in, and push a PR approval to him in Slack. Targeted for the
week of 2026-08-31. Not started.*

## The moment this is for

Portola posted its set-times posters on a Thursday afternoon (site +
Instagram). Within the hour the crew was trading screenshots and one member
said "app is updated" — about the official app, not ours. Ours caught up
that night by hand: fetch the posters, transcribe (three independent
readers), reconcile, write `days{}`, validate, test, gate, walk, PR. The
transcribe-and-verify part is now a recipe (`docs/add-a-festival.md`, the
"Set-times drop, in order" list) — which is exactly what makes it automatable.

## Shape (what would make this durable)

1. **Watch** — a scheduled job (Vercel cron or a cloud Claude routine) that
   polls each live festival's official set-times / schedule URL(s) listed in
   its JSON `meta.sources`, plus a content hash of the page and of any
   poster images it links. Fire on change only. Cheap, no LLM.
2. **Ingest** — on a change, a cloud session runs the recipe: read the new
   poster/grid with two independent model readers, reconcile box-by-box,
   write `days{}` using the EXISTING `artists[]` spellings (the pick-key
   freeze fails CI if it drifts), add new names, bump `CACHE_VERSION`, run
   validator + tests, open a branch + PR with the reconciliation report in
   the body. Refuse to open a PR when the readers disagree or a grid is
   <90% populated (the ACL lesson: a partial grid lies harder than a lineup).
3. **Approve** — a Slack DM to Kevin with the PR link, the preview link,
   the counts (sets/day, new names, live pick keys verified), and two
   buttons: merge (deploys prod) / hold. Reuse the recordOS-style Slack
   webhook pattern the repo already has (`api/access.js` + `SLACK_WEBHOOK_URL`).

## What already exists to build on

- The recipe + the validator rules + the pick-key freeze (all shipped 2026-08-27).
- The two-weekend `days{}` shape for ACL (shipped 2026-08-23).
- `scripts/import-festival.mjs` (pasted-lineup conversion).
- Vercel Cron is available on this project; cloud Claude routines exist
  (`/schedule`).

## Open questions for Kevin

- Poll cadence and which sources per fest (some post images, ACL renders a
  JS grid, some only post to Instagram — Instagram needs a different watcher).
- Merge-from-Slack vs. "Slack tells me, I merge in GitHub" (the latter is
  simpler and matches "promote is Kevin's call, always").
- Whether the same watcher should cover lineup *changes* (cancellations,
  replacements) between drops.
