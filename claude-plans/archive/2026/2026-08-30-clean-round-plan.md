# The clean round — plan (2026-08-30)

**Branch:** `notes-desktop-round` (PR #13), fixed forward — same PR, new gate.
**Why:** Kevin cannot merge #13 in good faith. The survey
(`2026-08-30-survey/LEDGER.md`, 55 findings, 0 refuted) confirmed his three
animation complaints at the code level and found the rest. Colour and type are
settled (Kevin, 2026-08-30) — the latitude is cleanliness, the design *system*,
and setting the repo up for later additions (Kevin, agentic fest updates, Ray's
fork). Brief: clean, simple, effective.

## Decisions carried into the build (Kevin can override any)

1. **Tap on a held card picks.** One grammar on both surfaces: hover/hold shows
   the zoom, a tap or click on it cycles the pick (pills update live), tap
   outside / Escape / scroll put it away. Kevin's complaint is the spec; the
   "tap dismisses" rule in `docs/user-flows.md` F6 is retired.
2. **The zoom becomes an overlay.** The grown card is drawn in its own fixed
   layer, centred on the resting card's centre, clamped to the viewport (and
   to `.times-scroll` in the timetable). The wall never reflows. Three
   compositor-friendly animations (clip reveal, name glide, one group fade)
   instead of ~15; reduced-motion AND Low Power make it instant. Codex reviewed
   the architecture (`2026-08-30-survey/codex-zoom-review.md`): approved with
   `opacity:0` (not `visibility:hidden`) on the resting card so keyboard focus
   survives, a hold-release guard so lifting the finger never picks, teardown
   on every `renderWall` (search bypasses `repaintWall`), z-index ≈ 36.
3. **Comments: Direction A** from the research — nothing at rest but name and
   words; press (touch) / hover (mouse) / focus reveals one plain-words cue line
   (`Reply · Pin`, or `Edit · Reply · Pin` on your own); Reply opens the
   composer inline under the note you pressed (a reply to a reply pre-fills
   `@Name`, still posts flat); Edit turns the text editable in place and the
   line becomes `Save · Cancel · Delete` — delete exists only inside editing.
   Direction B (one `···` per note) is the documented fallback if A reads too
   indirect on the preview.
4. **Stub copy** for a deleted root: "you removed this note" / "Ava removed
   this note" — the file's own "you" convention.
5. **Spotify badges** stay a record for now (rescan does not clear); Disconnect
   clears your own affinity because the copy promises it and the data is
   crew-visible. Mirror-vs-record is backlog.
6. **ACL's six schedule images** get transcribed by the main session (it can
   read images) on a follow-on branch — not a human chore for Kevin.

## Phase 1 — fix the round (checkpoint: Codex gate + Sonnet walk + Kevin on the preview)

- The zoom overlay (`js/v3/card-facts.js` rewrite of the zoom half; CSS
  `.zoom-layer` / `.zoom-card`); tap-to-pick on the overlay; `refreshArtistCards`
  updates the overlay's facts in place (no morph replay); keep the zoom across
  a remote repaint; keyboard route (Tab into the notes chip and back);
  `ctx.lowPower` in `canAnimate`.
- Settings: You above Crew (`settings.js:666-668` + the line-2 comment);
  self-rename duplicate check case-insensitive against `state.people()`.
- Lost Lands: short `dates` in both files; `dayMeta` for the pre-party days;
  `stage` + `time` on the 21 pre-party artists (Portola Afters pattern); day
  header label routed through the same stripping helper the day-rail tab uses.
  Freeze pick keys first; never rename day strings.
- ACL: `timezone: "America/Chicago"`; the meta note corrected (set times ARE
  out, as images; Sienna Spiro / Laszewo resolved).
- Cheap correctness: Spotify disconnect clears `crewDoc.affinity[me]`;
  `docs/user-flows.md` strings ("Most picked", "click picks", F6 grammar);
  dead `sort === 'day'` branch + fixtures; dead `.n-note.pinned` class;
  "Hold for notes" / "MUST SEE" copy in the coach mark and How-it-works.
- Tests: a jsdom click-cycle test through the real card handler (0→1→2→3→4→0),
  the zoomed variant, a reply-to-a-reply baseline. `node scripts/sw-stamp.mjs`.

## Phase 2 — comments, Direction A (checkpoint: gate + walk + Kevin on the preview)

- The cue line, inline reply composer, `@Name`, edit mode with Cancel and
  Delete inside it, Pin in the line; a focus-visible fallback for the reveal.
- Textarea with a counter for long notes; expand a folded pinned thread on
  reply; reply from the All-Notes home for every scope; the stub copy.

## Phase 3 — set up for later (checkpoint: gate → PR ready for Kevin)

- Ray / forks: the Spotify canonical host in one place (`<meta>` in
  `index.html`), every on-screen string derived from it, `docs/fork-setup.md`
  naming `PUBLIC_BASE_URL`; reply on issue #6 crediting him. Server-side
  one-level-deep `re` check (his fork is the second client).
- Fest updates by small agents — Ray's roadmap item 7, Kevin's yes
  (2026-08-30): "AI festival authoring via import" as a remote agentic run
  (OpenRouter or Cloudflare, rate-limited so billing cannot get away). The
  app already has a Gemini research path in `api/festival-add.js` — start by
  reading it. Shape: a run produces a festival JSON on the Portola pattern,
  the validator + pick-key freeze gate it, a human confirms before it lands.
  Plus the written brief and the refreshed `docs/add-a-festival.md`, validator
  rules for ascending `startsOn` and the index/file `dates` convention. Lost
  Lands day tags (Fri/Sat/Sun, available since 2026-08-21) land through that
  path as its first run. Design it as a mini-plan inside Phase 3, not a guess.
- Venue and map links for afters / events — the slice of Ray's item 8 that fits
  our app today (Kevin, 2026-08-30): a `venues` map in the festival file
  (name → address + map link), rendered in the zoom and the sheet header for
  event cards. Not the citywide schema.
- CI: `docs/user-flows.md` in the doc-truth gate; `db-concurrency` running
  against PGlite. Dependabot PRs #2 #5 #8 #9 with the suite green.
- Motion cost: viewport-gate `.card.animated`; `backdrop-filter: none` under
  `.low-power`.
- NOW.md / DEVLOG / PR description; the survey folder stays as the record.
- After the ship: draft Kevin's email reply to Ray (thread "Forked
  festival-navigator", last message his, 2026-08-06) with what this round
  did — issue #6 closed, fork-setup doc, what we took and what stays his.
  Kevin sends it. Items 3–6 of Ray's roadmap are penned for a later session
  (Working Pen, 2026-08-30).

## Follow-on branches
- ACL set times (transcribe six images, W1/W2 shape, `isos`, `status:
  scheduled`, freeze, validate, real screenshot check; ACL Fest Nights after one
  direct look). Before Oct 2.
- Seismic Phase Two — not before ~2026-09-18; needs a calendar reminder.
- Lost Lands full set times — expected ~Sept 14–16.

## Backlog (from the ledger)
Spotify combo-name splitting; affinity-inherited-by-a-reused-name; mid-scan
rename guard; "My link" row in You; pick counts on cross-circle rows;
`defaultFestivalId()` ordering; "remove a member"; Settings' fixed 560px
column; duplicate person rows for Nhu/Pegah/HG; the walker's three throwaway
Neon rows.
