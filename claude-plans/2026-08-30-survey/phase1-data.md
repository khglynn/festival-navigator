# Phase 1 — festival data (Lost Lands / ACL / index) — 2026-08-30

Owned files: `data/festivals/lost-lands-2026.json`, `data/festivals/acl-2026.json`,
`data/festivals/index.json`, `tests/fixtures/live-pick-keys.json`. Working log —
updated as I go, per the kickoff brief from the ledger
(`claude-plans/2026-08-30-survey/LEDGER.md`) and research
(`claude-plans/2026-08-30-survey/research-festival-data.md`).

## Step 1 — freeze

`node scripts/freeze-pick-keys.mjs lost-lands-2026 acl-2026` — ran before any
edit. No-op (0 new names) since both were already frozen 2026-08-27 and I'm not
adding artists or day labels this pass.

## Step 2 — Lost Lands

- `dates` shortened to `"September 18–20, 2026 · Fri–Sun"` in both
  `lost-lands-2026.json` and `index.json` (matches Portola's short-form
  convention).
- Added `"timezone": "America/New_York"` (Legend Valley, Thornville OH —
  Eastern).
- Added `dayMeta` for Friday/Saturday/Sunday (Sep 18/19/20, no artist tagged
  with these yet — forward groundwork for the day-tag follow-on) and the two
  frozen pre-party day strings (`wd`/`date` only, no `iso` — file stays
  `status: lineup`, no grid).
- **Pre-party stage/time: went and directly read the source.** Downloaded and
  visually read `Lost_Lands_2026_Weds_Thurs_Lineup4_4x5.jpg` (the poster
  already in `meta.sources`) via Read's image support — same "direct read"
  bar the doc sets for set-time drops. Confirmed: the poster lists names per
  day only, no individual stage or time-of-day anywhere. It does name two
  pre-party stages — "The Prehistoric Stage" and "The Crater" — but only as
  the venue for a collective "Mega B2B2B2B2B2B" Thursday set, not
  attributable to any one artist. Per the brief's own instruction, did **not**
  invent stage/time for the 21 pre-party artists — left absent, documented in
  `meta.note`.
- **New finding, flagged not acted on:** the same poster shows 8 artists
  already in the main-bill `artists[]` (Barely Alive, Calcium, Caspa, Distinct
  Motive, Emorfik, Hairitage, Riot Ten, Smoakland) are *also* billed on the
  Wednesday pre-party — a real Portola-style reappearance. Did not add a
  second `artists[]` entry for each: their main-bill entries are still
  day-less (Fri/Sat/Sun tags are the explicitly-deferred follow-on ingest),
  and the validator's duplicate rule treats any day-less entry as colliding
  with everything, so adding the reappearance now would only produce 8 noisy
  warnings for no real gain. Documented in `meta.note` so the next ingest
  picks it up alongside the day tags.
- `researchedAt` → 2026-08-30; added `jambase.com/festival/lost-lands-2026` to
  `meta.sources`; appended a dated `UPDATE 2026-08-30` paragraph to
  `meta.note` covering: the 2026-08-21 day-split reveal (real, sourced,
  intentionally not ingested this pass — needs a full 96-artist transcription,
  not just headline names), the still-unpublished full set-time grid (~Sept
  14-16 expected, 2025 precedent), the pre-party poster re-read, and the
  8-artist reappearance flag.
- Did **not** touch the ~96 main-bill artists' `day` field — explicitly out of
  scope this run per the brief.

## Step 3 — ACL

- Added `"timezone": "America/Chicago"`.
- `researchedAt` → 2026-08-30.
- `meta.note`: appended `UPDATE 2026-08-30` — set times confirmed still image-
  only (six schedule images, Fri/Sat/Sun × two weekends, static HTML wrapping
  images not JS-rendered as the older note guessed — more precise, same
  blocked conclusion); the Sienna Spiro/Łaszewo flag marked RESOLVED (KVUE,
  2026-08-30, confirms the file's current assignment is correct — the
  single-sourced "move" doesn't appear to have happened).
- Did **not** add `days{}`, did not change `status`, did not touch `dates` or
  any artist.

## Step 4 — index.json

- Lost Lands `dates` shortened to match the fest file exactly.
- En-dash normalization pass across every entry's `dates` (cosmetic, ledger
  P3): `edc-orlando-2026` (6-8 → 6–8, Friday-Sunday → Friday–Sunday),
  `seismic-9` (13-15 → 13–15, Friday-Sunday → Friday–Sunday),
  `ubbi-dubbi-2026` (24-25 → 24–25), `wicked-oaks-2025` (25-26 → 25–26),
  `acl-2025` (3-5 → 3–5, 10-12 → 10–12). Left alone: `tomorrowland-winter-2027`
  ("8-day" is a compound adjective, not a range), `electric-forest-2026` (no
  dashes, comma-separated), `lollapalooza-2025` (already a spaced en dash for
  its cross-month range), `portola-2026` / `acl-2026` (already en dash,
  untouched per scope). No reordering, no other field changes.

## Sources used (beyond what's already in each file's meta.sources)

- `https://www.jambase.com/festival/lost-lands-2026` — Lost Lands day-split
  cross-check (already cited in research-festival-data.md; added to the fest
  file's own sources list since the note now references it).
- Direct image fetch + visual read of
  `Lost_Lands_2026_Weds_Thurs_Lineup4_4x5.jpg` (already in `meta.sources`,
  just actually opened it this time) — 2026-08-30.
- `know-before-you-go/` page: attempted a direct fetch for early-arrival gate
  times, got HTTP 403 (bot-blocked, consistent with the research doc's
  do512/ACL FAQ pattern). Not pursued further — out of scope for this pass
  anyway.

## Open items for follow-on (not this pass)

- Lost Lands Fri/Sat/Sun day tags for ~96 main-bill artists (JamBase +
  official poster, cross-checked) — and the 8-artist Wednesday-pre-party
  reappearance found above — land together.
- Lost Lands full time-of-day set-time grid — expected ~Sept 14-16, 2026.
- ACL set-times ingest — blocked on a human reading six schedule images.
- ACL Fest Nights (afters) section — real and sourced per the research doc,
  but do512.com/aclfestnights still 403s automated fetch; needs one direct
  browser look before writing it in.
- Seismic — nothing actionable until ~2026-09-18 (Phase Two precedent).
