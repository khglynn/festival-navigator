# v3.1 fix phase — grounding for the post-clear session

**Written 2026-07-11 by the discovery session, for the session that builds.**
Read this before touching anything. Then: NOW.md (live state),
`2026-07-11-v31-design-direction.md` (the design decisions),
`claude-plans/2026-07-11-v31-backlog.md` (the merged findings), `docs/user-flows.md` (the spec).
If anything here contradicts what you find in the code or on the live site,
trust what you see, fix the doc, and keep moving — these files serve the work,
not the other way around.

## The brief, verbatim (this is the north star, not the backlog)

> "Use /hg-durable-build and your best judgement (in collaboration with agents
> and codex) to build a kick-ass app that has a knock-you-back-stunning UI, a
> thoughtful and no page or user flow neglected UX, and a rock solid won't
> leave folks stuck and lost in the middle of a festival backend."
> — Kevin, 2026-07-11, stepping away and handing over the run

Three clauses, three quality bars, and they are the acceptance criteria behind
the acceptance criteria:

- **Knock-you-back-stunning UI** — not "styled," stunning. The design-direction
  doc holds the decisions (tokens, timetable wall, dialog specs). When a screen
  is technically fixed but visually flat, it isn't done. Screenshot it, look at
  it the way Kevin will, and raise the craft until it would knock him back.
- **No page or user flow neglected** — the failure v3 shipped with was
  *unevenness*: a beautiful wall next to a floating Spotify button. Every flow
  in docs/user-flows.md deserves the same intentionality. The neglected corners
  (404, empty states, error copy, the bad-token page) are where this brief is
  won or lost, because nobody was ever going to polish them by default.
- **Rock solid, won't leave folks stuck at a festival** — the app's real
  context is a muddy field, one bar of signal, a dying phone. Broken back
  buttons, vanishing cards, dead-end OAuth errors are not P2 polish there —
  they strand someone mid-festival. Reliability of the *experience* is a
  backend property: sync that never loses a pick, states that always offer a
  way forward.

## The spirit (why a backlog is not the job)

Kevin's exact worry, from this morning: he did a quick pass and found half a
dozen problems the build's own review gates missed, twice. His words: *"I
don't wanna keep doing that and play whack-a-mole. I want your help to make
sure that we do something robust and solid, top to bottom"* — and later, that
the next session must have *"a discerning eye and care about the overall big
picture, not just the laundry list."*

So hold this posture:

- **The backlog is the floor, not the ceiling.** Every item traces to a class;
  fix the class. When you fix the sort menu, the actual task is "the app's
  control vocabulary" — selects, buttons, inputs, chips as one designed family
  — not one styled dropdown. That's the difference between executing a list
  item and honoring the brief. (One worked example, because it generalizes:
  H1's *real* fix is "single-card re-render preserves every invariant the full
  render establishes" — the grid-placement bug is just where it surfaced.)
- **Finding new problems is in scope.** If you see something the audit missed,
  that's the system working, not scope creep. Add it, fix it or bank it, say so.
- **Stopping short is the expensive failure.** Kevin: it's more exasperating
  when we stop short than when we take a better path than he proposed. If a
  fuller pass makes the system durable, take it and narrate why.
- **Taste is a verification step.** After the machinery passes, walk the app
  yourself at 390 and 1440 with fresh eyes — the audit rediscovering Kevin's
  findings proves coverage, not beauty. The Chanel check from the design doc:
  per screen, remove one thing.

## How to work (the collaboration shape)

- **Durable-build kit is active.** Small verified units; bank NOW.md as you go;
  DEVLOG per meaningful unit; commits scoped + secret-scanned (public repo —
  grep `#g=` before any docs commit); honest verification (run it, read the
  output, screenshot the UI). Never wrap up early because context feels full.
- **Codex (gpt-5.6-sol as of 2026-07-11) is a partner, not a gate.** Reach for
  it when a diagnosis feels thin or a design call wants a second mind — plus
  the formal blocking gate on the full diff before ship. It hangs sometimes;
  past ~3 min of silence, kill and verify another way.
- **Workflows for breadth, main loop for coupled edits.** The CSS/JS fix work
  is coupled — one mind holds the invariants. Fan out (sonnet agents) for
  verification breadth: the Stage-4 audit re-run, test sweeps, screenshot
  walks. Never frontier models in fan-outs.
- **Ultracode is on** — orchestrate substantive verification through the
  Workflow tool. The audit workflow script is banked at
  `claude-plans/2026-07-11-design-audit.workflow.js` — re-run it via
  Workflow({scriptPath}) with fresh args ({repo, base, link, shotDir, ts};
  the Audit Rig link comes from the private token note, never the repo).
- **Skills that carry this run:** frontend-design (loaded for any UI work),
  hg-durable-build (the kit), triple-check before declaring phases done.
- **Notify Kevin only on true blockers.** He's away on purpose. Production
  promote is his; build on branch `v31-polish`, verify on the Vercel preview
  URL, leave the promote decision in NOW.md with exactly what he needs to do.

## Verification gates (in order, none skippable)

1. `npm test` green AND output read — plus new regression tests for every P0/P1
   (refreshCard-in-grid, groupByDay split, history router, notes composers).
2. **Audit re-run** (same workflow, same seeded Audit Rig crew) — prior
   findings gone, no new criticals. This re-run is the anti-whack-a-mole proof;
   it, not your confidence, is what "done" means here.
3. Codex blocking gate on the full diff (bank-as-you-go findings file).
4. Your own taste pass at 390/1440 against the design direction.
5. Preview deploy verified in a real browser; NOW.md updated for Kevin's
   promote call; teardown (Audit Rig crew deleted — token in
   `~/.claude/plans/v31-audit-rig-token.md`, NOT in this repo; scratchpad
   artifacts already rescued into the repo).

## Dated facts a fresh session needs (verify if they smell stale)

- Three prod domains serve the app: fest/festival/crew.kevinhg.com (SW v14).
- Real crews: The Crew, Lolla 2025, Amish ACL — all doc v4. NEVER write to
  them; the seeded test crew is "Audit Rig" (token per above).
- Spotify fix (I1) ends in a Kevin action: registering
  `<domain>/spotify-callback` redirect URIs in the Spotify dashboard. Build
  the code side (canonicalize + error state), then queue his step in NOW.md.
- vercel dev won't serve files created after it starts (restart it); Chrome
  heuristic-caches modules (fetch cache:'reload' + reload); the Write tool has
  twice emitted literal control bytes for `\xNN` escapes — verify binary-clean
  after regex-heavy writes.
- Crew-doc SHAPE is frozen this run: display/UX layer only, no migrations, no
  destructive DB ops. (Rationale: the v4 migration just shipped and is stable;
  churning the data layer during a polish pass risks real crews for zero UX
  gain.)
