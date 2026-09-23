# Cancelled acts — build log (2026-09-23)

The ask: Skepta was cancelled from Portola's Saturday Crane Stage on
2026-09-21 ("due to unforeseen circumstances", Goldenvoice on Instagram,
reported by the SF Chronicle). Three people in the crew picked him, and his
name is a frozen pick key. Give an act an honest CANCELLED state — the card
stays, reads as off, keeps its picks, and the grid matches the new flyer.

Branch: `worktree-agent-afa2aaa4ca71fd600`, fast-forwarded onto
`data/prefest-0923` (06fcf60) before any work. Not pushed; no service-worker
stamp (the orchestrator stamps once, after the merges).

## Ground truth, checked 2026-09-23

1. The Chronicle article (Zara Irshad, Sep 21, 2026): no replacement for the
   6:45 PM Crane Stage slot; "the first three acts … Erika b2b SFCowboy,
   Tricky and Nimino — have been given slightly longer set times. This pushes
   DJ Shadow's hour-long performance's start time to 6:10 p.m. instead of
   5:30 p.m. Fatboy Slim and Soulwax … have not been impacted."
2. The official set-times page now serves `2026-Portola-SetTimes-Saturday-v2.jpg`
   (Last-Modified Mon 21 Sep 2026 20:09 GMT) and `crane-stage-26-v2.jpg`. The
   old Saturday JPG is unchanged since Aug 27. Read the v2 flyer: Crane Stage
   is Soulwax 9:55–10:55, Fatboy Slim 7:55–9:25, DJ Shadow 6:10–7:10,
   Nimino 4:50–5:50, Tricky 3:30–4:30, Erika b2b SFCowboy 1:30–3:10. Every
   other Saturday column matches the file box for box. Sunday has no v2.

## Decisions

- **Shape:** `cancelled: { on, source, note? }` on the `artists[]` entry —
  `on` the date it was announced, `source` an https door, `note` one short
  line for the zoom. The entry keeps its `day`; `venue` (an existing field)
  says where it would have been, so the card lands under a "Crane Stage"
  group in the festival's own room.
- **Rules:** unknown keys error (the shape is small on purpose and a typo
  like `date` for `on` should not pass); a cancelled name that still has a
  set on a grid day its entry names is an ERROR; a grid set carrying
  `cancelled` is an error (it comes off the grid instead); the "billed but no
  set on the grid" and "venue has no map" warnings skip cancelled entries.
- **Exporter: marks it** (does not skip). The day image is "the wall you
  see" (tools.js's own rule, one source with the wall), and a group-chat image
  is exactly where a crew-mate who has not opened the app learns their pick
  is off. A skipped card would be the silent disappearance this feature
  exists to prevent. It sorts last in the festival's own block, where the
  wall draws it.
- **Playlist: skips it** — a name every one of whose entries is cancelled and
  that has no grid set (`cancelledNames`) never goes into a new playlist or a
  crew top-up. A name that is cancelled on one night but plays another stays.
- **Search:** the card answers as cancelled ("Crane Stage · Cancelled"); the
  search's order is left alone (the other builder owns that block).

## Log

- 2026-09-23 — worktree fast-forwarded to data/prefest-0923; read NOW,
  CLAUDE.md, wall.js, events.js, card-facts.js, tools.js, festival-rules.mjs;
  verified the Chronicle and the v2 flyer (above). Mapped the two sibling
  builders' hunks so this branch stays out of them: the import line and the
  search block of wall.js, and the settings Spotify drill.
