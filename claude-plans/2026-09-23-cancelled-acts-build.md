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
- Tests first (`tests/cancelled-acts.test.mjs`, 15 of 18 red), then the
  rules, then the data, then the model, render, zoom, day image and
  playlist; each banked as its own commit.
- Existing tests that counted Portola's grid moved with the data: 64 grid
  cells → 63, Saturday 32 sets → 31, the live-pick-keys test accepts "on the
  grid OR marked cancelled", the grid-billing test lets a cancelled entry
  carry `venue`, and the day-image counts read 31 + 1 (Skepta) + 15 + 2.
- Design, as built: the card keeps its aura under a scrim that also
  desaturates it (`backdrop-filter: saturate(.3)`), holds still (no breathing,
  no grain), the name struck through, CANCELLED where the time goes. The
  corner marks sit above the scrim in full colour. The zoom and the sheet
  header wear the same scrim: "Cancelled · Sat", "Announced Sep 21" (a door
  to the report), the note, the place, the crew's pills. First pass used a
  plain 50% scrim; it read "dark", not "off", so the desaturation went in.
- Walked in headless Chrome with real input (mock `/api/crew` served by the
  rig, random throwaway token, production never touched): the card at 390
  and 1280, the zoom by hover, search "skep", and a tap on the grown card in
  gallery.html (picks, stays struck, the You pill arrives).
- gallery.html: 12b (a cancelled act in the zoom row); the events fest has a
  cancelled billing under its stage and a cancelled show last in a stack.
- A throwaway three-way merge (this branch + the one-line-heads branch + the
  crew-join branch) merged with no conflicts and ran 685/687 green, the one
  red being the service-worker stamp (below); the cancelled card rendered
  under `SAT AFTERS` as expected. The merge branch was deleted.

## Left for the integrator

- `node scripts/sw-stamp.mjs` after the merges: this branch changes cached
  assets (js, css, gallery), so `tests/app-shell-complete.test.mjs` is red
  here by design until the stamp runs once.
- An existing crew playlist made before the cancellation keeps Skepta's
  tracks; the top-up only adds. Removing tracks from someone's playlist was
  out of scope.
- The search block (owned by the heads branch) lists billed names in file
  order, so a cancelled name is not forced last among several billed
  matches. It still answers "Crane Stage · Cancelled".
