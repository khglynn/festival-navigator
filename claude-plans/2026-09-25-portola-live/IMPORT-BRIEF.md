# Import picks from the Portola app's export — build brief (2026-09-26, ~3 AM PT)

Kevin, from Portola: "Portola has this export feature that gives you PNGs. I would love if
folks could import these to add to their lists. But I think it'd be like a flow cause
they'd need to land their levels. We could start them at like mid — 2 level pick?" Then,
sending two exports: "They don't do afters and you have to export days separately."

## The input

The official Portola app exports one image per day (1080×1920 JPEG/PNG): the header
"My 2026 Portola Schedule", a day chip ("Saturday 9/26", "Sunday 9/27"), then rows of
**Name** / `2:45PM - 9:45PM · STAGE`, separated by thin rules, on a textured blue ground
with a skyline at the bottom. No afters. Two real samples (Kevin's own — keep them OUT of
the public repo; use them locally only):

- `/private/tmp/claude-505/-Users-kevinhalladay-glynn-DevKev-personal-festival-navigator/ad85413b-2402-4df6-89fc-d9f0bc11c9d7/scratchpad/portola-exports/sat-9-26.jpg`
  — Despacio (2:45–9:45 PM, DESPACIO), Ranger Trucco b2b Alisha (2:45–3:45, WAREHOUSE),
  Airwolf Paradise (1:30–2:30, PIER), Erika b2b sfcowboy (1:30–3:10, CRANE)
- `…/portola-exports/sun-9-27.jpg` — Overmono (8:20–9:20, WAREHOUSE), underscores
  (5:50–6:40, CRANE), VTSS (4:30–5:30, WAREHOUSE), Silva Bumpa (2:30–3:30, WAREHOUSE)

All eight match `data/festivals/portola-2026.json` names case-insensitively (ours says
"erika b2b sfcowboy"). Picks are keyed by artist NAME, so a match is a name match; day,
stage and time are for disambiguation and for showing the person what matched.

## The flow (friend-facing — frames to the coordinator before it ships)

1. **Where it starts:** Settings, beside Bulk paste (the tools that already round-trip
   picks — `js/v3/tools.js`), as "Import from the Portola app". Propose, with a frame,
   whether a second, quieter door belongs somewhere a new person will see it (the
   just-joined welcome, How it works) — don't build a second door without the frame.
2. **Choose images:** one or more (a day per image). A file input (`accept="image/*"`,
   `multiple`) — photos app on a phone. Show each image's day as it's read.
3. **Read:** each image goes to a new endpoint that returns
   `{ festival: "Portola", day: "Saturday 9/26", items: [{ name, start, end, stage }] }`.
   The image is never stored or logged.
4. **Review ("land their levels"):** one list, grouped by day, each matched set with the
   card's own level chip starting at **2** (mid — Kevin's call); a tap cycles the level
   the way a pick does (1 → 2 → 3 → must → off); a set you ALREADY picked shows your
   level and is never lowered by the import. Names we couldn't match are listed plainly
   ("Not on this fest's lineup: …") — never silently dropped, never guessed.
5. **Add N picks** — one action writes them through the app's existing pick path for
   the person who is importing (the crew's normal sync; no new document keys, no DB
   changes). Then back to the wall with a small confirmation.

Motion and look follow CLAUDE.md's laws (tokens from v3-tokens.css, --brand not --fest,
44px floor, the app's sheet anatomy — `sheetChrome` — and its motion vocabulary). Kevin's
taste: bare glyphs over shaped buttons; no stacks of pills; no dead air.

## The endpoint

`api/import-schedule.js`, modelled on `api/festival-add.js`: POST, `crossSite` +
`rateLimited` (a tight bucket), a size cap under Vercel's 4.5 MB body limit (downscale
on the phone before upload — a canvas to ~1080 wide JPEG), and a Gemini call with the
image as inline data and a strict JSON response. `api/_lib/guard.mjs callGemini` is
text-only today — extend it with an optional image part without changing its current
callers' behaviour. The prompt asks only for what's printed; it never invents a set.
Return 400 for a non-image, 413 for too big, 502 when the model fails, and never echo
the image back. No new env vars (the existing Gemini key and `GEMINI_MODEL`); no
vercel.json change. Consider whether the endpoint should require a crew context
(the crew token header the app already sends) to keep strangers from using our model
quota — decide, and say why.

## Matching (pure, unit-tested)

A pure function in its own module: exact name (case-insensitive, trimmed) → normalized
(unicode NFKD, strip punctuation and "b2b"/"B2B"/"x" spacing differences, collapse
whitespace) → if several fest entries share the normalized name, prefer the one on the
image's day and stage. Never fuzzy-match beyond that (a near miss is "not on the lineup",
shown to the person). Tests: the eight samples above; case; accents (the app already
ignores accents in search); a b2b spelled differently; an unknown name; a name on the
wrong day (still matches — picks are by name — but flag it in the review).

## Gates

- Unit tests (matching, the endpoint with a stubbed model, the size/type guards), the
  whole suite in UTC, TZ=Asia/Tokyo and the night clock.
- A real extraction check of the two sample images against the real model — do it by
  pushing the branch (a preview deploy has the env) and POSTing the images to the
  preview's endpoint with curl. That endpoint writes nothing. NEVER exercise the pick
  write on a preview or localhost `vercel dev` against a real crew: both share the
  production database. The UI is tested locally with the endpoint stubbed.
- Browser tests for the flow (Chromium + WebKit locally), and frames of every state
  at 390 and 1280 into `v97-shots/` (git-ignored) for the coordinator.
- Don't stamp the service worker (the coordinator does at release). Commit as you go on
  `live/import`, push after each commit, keep a build log `IMPORT-BUILD.md` beside this
  brief, and report: SHAs, test results, the real-model extraction output for both
  samples, the frame paths, and any product call you made.
