# Festival data survey — 2026-08-30

Purpose: check what's live on the real web today for ACL 2026, Seismic 9.0, and
Lost Lands 2026, against what the app's JSON files currently hold, and against
the Portola reference shape (the only one of the four target fests + Portola
that is fully "scheduled"). Read-only survey — no JSON files edited.

## Reference: what Portola's `scheduled` shape carries (field inventory)

From `data/festivals/portola-2026.json`:

- Top-level `timezone` (IANA, e.g. `America/Los_Angeles`) — required once
  `dayMeta` carries dates; "now" line + day-of auto-scroll read in this zone.
- `dayMeta.<Day>`: `wd` (weekday code, e.g. "Sat"), `date` (human, "Sep 26"),
  `iso` ("2026-09-26"). Non-grid sections (Afters, Folsom) get a `date` range
  string only, no `wd`/`iso`.
- `days.<Day>.stages[]` — ordered stage name list for that day (no top-level
  stages field; each day owns its own list).
- `days.<Day>.artists[]` — each has `name`, `stage`, `time` ("6:30 PM - 7:30 PM").
- Top-level `artists[]` still carries every artist for the list/search view,
  with `day` (grid day, or a section name like "Afters"/"Folsom"), and for
  afters/event entries: `stage` (venue + weekday, e.g. "Fri · Regency
  Ballroom") and `time` (hours) rendered as a card sub-label — these are
  EVENTS, not stage/time grid entries.
- `meta.announcementStatus`, `meta.researchedAt`, `meta.sources[]`, `meta.note`
  (long prose — provenance, corrections, what's still unconfirmed).
- `status: "scheduled"` at top level (mirrored in `index.json`).
- Doors: not a JSON field — carried in the human `dates` string
  ("...· doors 1 PM") and in `meta.note` prose ("Doors 1 PM both days, 21+").
- Afters/events modeled as data: additional `artists[]` entries with a
  non-grid `day` value ("Afters", "Folsom", "Afters & Folsom" for a
  cross-listed entry) plus `stage`/`time` sub-label fields — no separate
  top-level structure for them.

## `docs/add-a-festival.md` — format notes relevant to this survey

- `status`: `lineup` (list view only) → `scheduled` (full grid) → `archived`.
- Minimum viable file: `id`, `name`, `year`, `subtitle`, `location`, `dates`,
  `accent`, `status`, `artists[]`.
- Artist names are **pick keys** — byte-identical, case included, between the
  lineup phase and any later scheduled phase. A rename orphans picks; run
  `node scripts/freeze-pick-keys.mjs <id>` before any edit session on a live
  fest (all three target fests are live/pickable now, so this applies to all).
- Two-weekend fests (ACL is the example by name in the doc): keep day keys as
  bare "Friday"/"Saturday"/"Sunday", tag each grid set with
  `weekend: "W1"|"W2"`; `dayMeta.<Day>.dates: {"W1":..., "W2":...}`.
- Set-times drop recipe (order matters): freeze pick keys → transcribe poster
  into `days{}` using EXISTING `artists[]` spellings → add any new poster
  names to `artists[]` → non-grid sections need nothing extra → validate +
  `npm test` + bump `CACHE_VERSION` + eyeball browser.
- `timezone` required as soon as `dayMeta` carries dates; validator rejects
  unknown zones. ACL/Seismic zone per the doc: `America/Chicago`.

## Current file state (read 2026-08-30, before any web research)

### acl-2026.json
- `status: "lineup"`, `researchedAt: "2026-07-07"`, no `timezone`, no
  `dayMeta`, no `days{}`.
- 124 artists, each with `day` (Friday/Saturday/Sunday) + `weekends`
  (W1/W2/both).
- `meta.note` already documents a LOT found since 07-07: official set times
  went live week of 2026-08-17 per aclfestival.com/schedule + the ACL app,
  but says the schedule page is JS-rendered and wasn't ingested (would be
  ~10% populated from press snippets — deliberately left as lineup-only
  pending someone with page access pasting full grids). Also flags: Sienna
  Spiro/Laszewo day moves (single-sourced, unverified), and "ACL Fest Nights"
  official aftershows (Oct 2-13, Emos/Scoot Inn/Antone's etc, $40-70,
  do512.com/aclfestnights) — not yet ingested as an Afters section.

### seismic-9.json
- `status: "lineup"`, `researchedAt: "2026-07-07"`.
- 33 billing lines / 34 artists (Phase One only), no `day`/`stage`/`time` on
  any artist.
- `meta.note`: explicitly Phase One; Phase Two/by-day expected later — cites
  8.0 (2025)'s Phase 2 landing ~Sept 19, ~8 weeks out, as the precedent, but
  says a 2026 Phase 2 "has NOT happened yet as of 2026-07-07." Three stage
  names surfaced in press (Volcano/Tsunami/Frequency) not yet mapped to
  artists.

### lost-lands-2026.json
- `status: "lineup"`, `researchedAt: "2026-07-07"`.
- 96 main-bill artists/credited sets (94 unique, Excision billed 3x) +
  Early-Arrival pre-party names tagged with explicit Wed/Thu day strings.
  Second poster tier (114 more names) documented in `meta.note` prose only,
  not in `artists[]`, to respect the ~120 cap.
- No stage/set-time data anywhere in the file yet (expected — poster-only).

---

## Web research log

All dates below are "read 2026-08-30" unless the source's own publish date is
noted.

### 1. ACL Music Festival 2026

**What's out today:**
- Full lineup + day assignments + weekend tags: unchanged since 07-07, still
  the current official bill. No new artist additions found (searched
  specifically for August 2026 additions — nothing). The known aggregator
  contamination (liveforlivemusic.com listing The Marías, Role Model, Rilo
  Kiley, Djo, Pierce The Veil, Sabrina Claudio) is STILL circulating as of
  today — same six names, same non-official source — reconfirms the file's
  existing decision to exclude them was and still is correct.
  [liveforlivemusic.com](https://liveforlivemusic.com/news/austin-city-limits-music-festival-announces-2026-lineup/)
  (read 2026-08-30).
- **Set times ARE published**, but as images, not text — confirmed by direct
  fetch of [aclfestival.com/schedule](https://www.aclfestival.com/schedule)
  (read 2026-08-30): six schedule images (Fri/Sat/Sun × two weekends), each
  with a "Share Schedule" button, no extractable grid text. This is a more
  precise finding than the file's existing "JS-rendered" note — it's actually
  static HTML wrapping image files, so OCR/manual transcription is the only
  path in, same conclusion the file already reached (stay lineup-only until
  someone pastes the grids) but for a slightly different mechanical reason.
- Confirmed via search snippet: earliest sets 12:45 PM, headliner (American
  Express stage) closes at 10 PM both weekends —
  [teensmedia.net](https://www.teensmedia.net/blog/acl-fest-2026-schedule-set-times-25th-anniversary)
  (read 2026-08-30), matching the figures already in the file's meta.note.
- **Gates/doors**: Friday noon, Saturday/Sunday 11 AM, all days run to 10 PM —
  [search aggregation citing ACL's own FAQ](https://support.aclfestival.com/hc/en-us/articles/4405461449876-Where-and-what-time-do-the-gates-open-each-day)
  (read 2026-08-30; the FAQ page itself 403'd on direct fetch, so this is
  second-hand — worth a direct re-check before treating as fully authoritative,
  same caveat the file should carry for any doors time it adds). NOT currently
  in the file at all (Portola carries doors in its `dates` string; ACL's
  `dates` field has none).
- **Stage list**: confirmed "nine stages" exist, but only two names could be
  confirmed by name — American Express and T-Mobile — plus Miller Lite,
  Snapchat, and Honda already flagged unconfirmed-for-2026 in the file's own
  meta.note. No source today gave the complete nine. Not enough to build
  `days{}` stage lists from.
- **Łaszewo/Sienna Spiro "day move"**: the file's meta.note flags a
  single-sourced claim (theheartsounds.com, 2026-08-17) that Sienna Spiro
  moves to Friday W2 and Łaszewo to Saturday W2. Today's KVUE-sourced search
  snippet says the OPPOSITE and matches what's already in the file: "Laszewo
  performed on Friday... Sienna Spiro performed on Saturday, October 10" —
  [kvue.com](https://www.kvue.com/article/entertainment/events/austin-city-limits/artists-lineup-2026-austin-city-limits-festival/269-cae3083e-0a6c-4b43-8ffd-e7f9221a55d9)
  (read 2026-08-30). That means the file's CURRENT data (Sienna Spiro=Saturday
  W2, Łaszewo=Friday W2) already reflects the assignment two sources now
  agree on, and the single-sourced "move" flagged in meta.note looks like it
  did not happen (or was itself an error). **Recommendation: no data change
  needed here — but the meta.note's open flag can be resolved/closed now that
  a second source has weighed in.**
- **ACL Fest Nights (official late-night aftershows)**: confirmed real,
  Oct 2–13 (not just through Oct 13 as previously noted — one show is Mon
  Oct 6, Passion Pit @ Emo's, so the run stretches across both festival
  weekends and the gap between them), $40–70 each, no wristband needed.
  Venues: Stubb's, Emo's, ACL Live, Antone's (this is a fuller/slightly
  different venue set than the file's meta.note, which named Emo's/Scoot
  Inn/Antone's — Scoot Inn not corroborated today, ACL Live and Stubb's
  should be added). Specific dated shows found today, several NOT yet in the
  file's meta.note: Dr. Dog @ ACL Live (Thu Oct 2), Modest Mouse @ Stubb's
  (Fri Oct 3), MARINA + Mallrat @ ACL Live (Sun Oct 5), Passion Pit @ Emo's
  (Mon Oct 6), Wet Leg @ Stubb's (Sat Oct 11), plus Grocery Bag @ Stubb's
  (10 PM doors) and Night Tapes w/ Alice Rivers @ Antone's (9 PM doors) — the
  latter two ARE already lineup artists in the file (Grocery Bag, Night
  Tapes), so this is exactly the Portola-style "reappearance" case the doc
  describes. Also independently reconfirmed from the file's own existing
  list: Brandon Flowers w/ Jess Williamson, Bleachers w/ This Is Lorelei,
  Steve Aoki (Dim Mak 30, w/ Elephante b2b Riot Ten), Palace, Montclair.
  Source: [search aggregation of do512.com/aclfestnights](https://do512.com/aclfestnights)
  content (the page itself 403'd on direct fetch both times — Cloudflare or
  similar bot-block likely; only search-snippet secondhand content available)
  (read 2026-08-30). **This is a real, sourced, addable "Afters" section** —
  same shape as Portola's — but every fact here is second-hand (search
  snippets of a blocked page), so it needs one direct look at a rendered
  do512.com/aclfestnights page (browser, not WebFetch) before being written
  into the JSON, per the doc's "two independent readings" bar for set-time-
  shaped drops.

**Expected drop window (prior years):**
- **ACL 2024**: set times released **August 1, 2024** for an Oct 4–6 / 11–13
  festival — about 9–10 weeks out —
  [KVUE](https://www.kvue.com/article/entertainment/events/austin-city-limits/acl-fest-daily-schedule-set-times-lineup-2024/269-d9415ab4-3fd0-498a-b295-49b192f59190)
  (read 2026-08-30).
- **ACL 2026**: set times went up the week of **Aug 17, 2026** for an Oct 2–4
  / 9–11 festival — about 6–7 weeks out, i.e. a bit later in the calendar
  than 2024's cadence but same rough order. Already captured in the file.
- Net: **ACL set times are already out today** (as images); the daily-grid
  text just hasn't been transcribed into the JSON yet. This is a "do it now"
  item, not a "wait" item — see recommendations.

**Pick-key spelling check:** spot-checked Charli xcx, RÜFÜS DU SOL, Twenty
One Pilots, Lorde, Skrillex, Kings of Leon, The xx, Brandon Flowers, Łaszewo,
Sienna Spiro against today's search results — all byte-match the file. No
renames found.

---

### 2. Seismic Dance Event 9.0

**What's out today:**
- Still **Phase One only** at the roster level — every search today (multiple
  independent phrasings) returned the same 33-artist Phase One list with no
  Phase Two artists named. Full re-fetch of
  [seismicdanceevent.com/lineup/](https://www.seismicdanceevent.com/lineup/)
  (read 2026-08-30) confirms: same names as the file, plus an explicit
  **"+ MORE TBA"** on the page itself — official confirmation more is
  still coming, artist count unchanged (33/34) from the file.
- **New finding not in the file**: the lineup page's own artist-bio blurbs
  (Instagram-caption style copy embedded per-artist) already reveal THREE
  informal day/stage assignments, quoted verbatim from the page: "UK house
  heavyweight @chrislorenzo66 hits the Tsunami Stage on Friday, November
  13th"; "[Max Styler] takes on the mighty Tsunami stage on Saturday,
  November 14th"; "FOR THE FIRST TIME EVER IN TEXAS… @mestiza.music hits the
  Tsunami Stage on Friday, November 13th." Source: direct fetch of
  seismicdanceevent.com/lineup/ (read 2026-08-30). This is NOT a Phase
  Two/by-day poster — it's promotional copy for 3 of the 33 names — but it is
  a first, official, sourced crack in "no day assignments exist yet." Too
  thin to build `days{}` from (30 of 33 artists still have zero day/stage
  info), but worth a one-line mention if the file's note gets touched, and
  worth re-checking those three artist pages again close to the real Phase 2
  drop in case the blurbs get corrected/removed.
- No pre-parties, afters, or doors times found published for 9.0 anywhere
  today.

**Expected drop window (prior year, 8.0 → 9.0):**
- Seismic **8.0** (Nov 14–16, 2025): Phase Two / by-day lineup landed
  **September 18, 2025** — about 8 weeks before the fest —
  [BroadwayWorld](https://www.broadwayworld.com/austin/article/SEISMIC-DANCE-EVENT-80-Reveals-Phase-Two-Lineup-Ahead-of-November-Festival-20250918)
  (read 2026-08-30). Confirmed by direct fetch of the site's own
  `/phase-2-by-day-lineups-revealed/` page, which is publish-dated
  **2025-09-19** and is explicitly about the 8.0 edition, not 9.0 — the file's
  "8 weeks before" citation is accurate and this page is its actual source
  (it was likely reachable at the same URL back on 2026-07-07 too).
- 8.0's actual set times (not just Phase 2 names) went live even later, per
  EDM Identity's "Seismic Dance Event 8.0 Set Times" piece dated **2025-11-10**
  — 4–6 days before the Nov 14 start.
- For **9.0** (Nov 13–15, 2026), the 8-week-before analog lands **~Sept 18,
  2026** — i.e. about **19 days from today (2026-08-30)**. Nothing has
  dropped early this cycle. **Recommendation: re-check in mid-to-late
  September; nothing actionable in the JSON right now beyond the file's
  existing "Phase One only" honesty.**

**Pick-key spelling check:** spot-checked Above & Beyond, horsegiirl (file
lowercases "horsegiirl"; today's fetch of the official page renders it
"Horsegiirl" in a section header — this is very likely just page styling/
capitalization of a section headline, not a spelling change; the file's
lowercase form matches the artist's own stylization used elsewhere and I did
not find inconsistent official capitalization within the page's own artist
tile text, only in a summary heading), Sara Landry, Porter Robinson, KI/KI,
SG Lewis, Brutalismus 3000, VTSS, Mestiza, Chris Lorenzo, Max Styler — no
byte-level rename found. **Worth a human glance at "horsegiirl" vs
"Horsegiirl" capitalization the next time the official page is opened**,
purely because the fetch surfaced two different cases in two different
spots on the same page — flagging, not asserting a problem.

---

### 3. Lost Lands 2026

**What's out today:**
- **Day-by-day splits ARE published** as of a wave of articles dated
  **2026-08-21** (EDM Sauce, EDM.com — "Excision Drops/Reveals Daily
  Lineups for 2026 Lost Lands Festival"). Confirmed the actual per-day
  artist buckets via
  [JamBase's festival page](https://www.jambase.com/festival/lost-lands-2026)
  (read 2026-08-30), which lists artists grouped under three explicit dates:
  - **Sept 18, 2026** (Friday): ~68 artists including Excision, NGHTMRE,
    Liquid Stranger, Borgore, Levity, TYNAN, and others; Excision closes with
    a two-hour headline set.
  - **Sept 19, 2026** (Saturday): ~62 artists including ILLENIUM, Flosstradamus,
    Flux Pavilion, Whethan, Seven Lions (sunset slot), Subtronics b2b Level Up.
  - **Sept 20, 2026** (Sunday): ~48 artists including Adventure Club
    ("Throwback Set"), Eptic b2b LYNY, Krewella, Wax Motif, ATLiens, Boogie T,
    Ghastly, HALIENE, and Excision closing with his "Detox Set."
  - JamBase's page does NOT carry stage names or set times — day assignment
    only, no time-of-day, no stage. Multiple secondary write-ups (EDM.com,
    EDM Maniac, thedailyfrequency.com) all repeat the same headline-act
    summary above without adding times or stages.
  - This is a **real, addable data drop**: the file currently has zero `day`
    tags on any of the 96 main-bill artists (only the Early Arrival Wed/Thu
    names carry `day`). Adding Fri/Sat/Sun `day` values to the ~96 main-bill
    artists is possible today from JamBase's per-day grouping, but it would
    need a full artist-by-day transcription pass (I only captured the
    headline names above, not all 68+62+48), and JamBase is one aggregator
    source, not lostlandsfestival.com's own graphic — the doc's "two
    independent readings" bar isn't met yet for a full transcription. The
    official poster images themselves
    ([lostlandsfestival.com/lineup/](https://www.lostlandsfestival.com/lineup/))
    render as images, not text, so a full ingest still needs OCR/manual
    reading of the actual poster, cross-checked against JamBase's grouping.
  - No stage names (e.g., a Lost Lands "Excision" mainstage / secondary stage
    split, if any) surfaced in any source today.
  - No set times (time-of-day) found anywhere for 2026 — consistent with the
    prior-year pattern below.

**Expected drop window (prior year, 2025 → 2026):**
- Lost Lands **2025** (Sept 19–21, 2025): actual **set times** (time-of-day
  grid, not just day buckets) were published **~Sept 15, 2025** — 4 days
  before the festival started — per EDM Identity's "Lost Lands 2025 Set
  Times" article dated 2025-09-15.
  (read 2026-08-30).
- For **2026** (Sept 18–20), the analogous full-set-times drop would land
  **~Sept 14–16, 2026** — i.e. **15–17 days from today**. The day-split
  reveal (Aug 21, 2026) landed noticeably EARLIER relative to the festival
  this year than last year's day-split pattern implies (roughly 4 weeks out
  vs. what was closer to days-out for full times) — Lost Lands appears to be
  doing a two-stage reveal (days first, then times close-in) rather than one
  drop, which the file should plan for: **day tags are actionable now,
  full set-time grid is not expected for another 2–3 weeks.**

**Pick-key spelling check:** spot-checked Æon:Mode, gladde paling, PhaseOne,
Excision (2-Hour Set)/(Detox Set)/B2B Space Laces — all corroborated
byte-for-byte by independent sources (JamBase, EDM Identity) today. No
renames found. The unusual-casing names in the file (Æon:Mode with the
ligature, "gladde paling" lowercase) are confirmed as the artists' own
official stylization, not a data-entry error.

---

## Field-by-field against the Portola reference: what's updatable NOW

| Portola field | ACL 2026 | Seismic 9.0 | Lost Lands 2026 |
|---|---|---|---|
| `timezone` | **Addable now** — `America/Chicago`, per the doc's own instruction. Currently missing. No dependency on anything else. | **Addable now** — `America/Chicago`. Currently missing. | Not yet — the doc only calls for `timezone` "as soon as `dayMeta` carries dates," and no `dayMeta` is warranted yet (see below). Would be `America/New_York`. |
| `dayMeta.<Day>.iso` (calendar dates) | **Addable now** — all six calendar dates are known and unchanged (Oct 2/3/4, Oct 9/10/11) regardless of whether set times are ingested. Needs the two-weekend `dates: {"W1":...,"W2":...}` shape per the doc. | **Addable now** for the three known event dates (Nov 13/14/15) even with `status` staying `lineup` — but per the doc, `dayMeta`/`days{}` is a "scheduled" concept; adding bare `dayMeta` without a real `days{}` grid would be new, undocumented territory. **Hold.** | Same tension as Seismic: dates are known (Sept 18/19/20, plus Sept 16/17 pre-party) but no `days{}` grid exists yet to hang `dayMeta` off. **Hold**, pending the day-split ingest below. |
| `days.<Day>.stages[]` + `days.<Day>.artists[]` (full grid) | **Not yet** — set times exist only as unparsed images; needs OCR/manual transcription of the 6 poster images (2 already-known stage names, several unconfirmed) before this is buildable. This is exactly the state the file's meta.note already describes; nothing changed except confirming it's images-not-JS. | **Not yet** — only 3 of 33+ artists have any day/stage hint, and it's promotional copy, not a real grid. Wait for the ~Sept 18, 2026 Phase 2/day drop. | **Partially addable now, at the `artists[].day` level only** (see below) — but a real `days{}` grid (with stages/times) isn't ready; no stage names surfaced anywhere, and no time-of-day data exists yet. |
| Top-level `artists[].day` (list-view day tag, pre-grid) | Already present and current (Friday/Saturday/Sunday + weekends) — no change needed. | Not addable — no day info exists for the 30 non-blurbed artists; adding it for just 3 of 33 would be misleading/incomplete. | **This is the one clearly actionable item.** JamBase's per-day grouping gives Fri/Sat/Sun buckets for the ~96 main-bill artists (headline names captured above; full 68/62/48 rosters would need one more transcription pass against JamBase + a second source or the actual poster image). Doing this moves the file from flat lineup to a Portola-Saturday-style "list view sorted by day" without needing full set times — a real, incremental improvement available today. |
| `status` | Stays `lineup` — no grid exists to promote to `scheduled`. | Stays `lineup`. | Stays `lineup` even if `artists[].day` tags are added — `scheduled` per the doc means a real `days{}` grid, which isn't in reach yet. |
| Doors / gates | **Addable now** to the `dates` string, Portola-style: "gates Fri 12 PM, Sat/Sun 11 AM" (source is second-hand/search-snippet only — worth one direct confirm before treating as fully authoritative, since the FAQ page itself 403'd). | Not found anywhere for 9.0. | Not found anywhere for 2026 (Legend Valley's known camping/gate patterns from prior years could be checked separately, but nothing today). |
| Afters/events modeled as data | **Real, sourced content exists today** (ACL Fest Nights) but every fact is second-hand (search snippets of a page that 403'd twice) — needs one direct browser look at do512.com/aclfestnights before writing entries, per the doc's "two independent readings" bar. Once confirmed, this is a straightforward Portola-style Afters section: several show-artists are already lineup artists (Grocery Bag, Night Tapes) — the exact "reappearance, unify by exact name" case the doc describes. | None found. | None found for 2026 (Early Arrival pre-party is already modeled as data via the Wed/Thu `day` tags — that part is done). |
| Lineup completeness / renames | No new artists; no renames. The aggregator six-name contamination (Marías, Role Model, etc.) is reconfirmed as NOT official — stays excluded. | No new artists (Phase One count unchanged); no renames. | No new artists beyond what's already captured; no renames. Second-tier 114 names still prose-only in `meta.note`, unchanged. |

## Do the artist names still match the official spelling? (pick-key check)

**Yes for all three.** Spot-checked a representative sample from each file
(headliners, oddly-cased/stylized names, and the names most likely to have
drifted) against today's sources — see the per-festival "Pick-key spelling
check" notes above for exact names checked. No byte-level renames found
anywhere. One soft flag, not a finding: Seismic's official lineup page shows
"Horsegiirl" capitalized in one section heading versus "horsegiirl" lowercase
in the file and elsewhere on the same page — almost certainly just heading
style, but worth a human glance next time that page is open, before ever
running `freeze-pick-keys.mjs` again for seismic-9.

---

## Summary recommendations (priority order)

1. **Run `node scripts/freeze-pick-keys.mjs --all-live` before touching any of
   these three files** — all three are live/pickable today, per
   `docs/add-a-festival.md`'s rule that this runs BEFORE any edit session on
   a live fest, not just before set-times drops.
2. **Lost Lands: add `day` tags to the ~96 main-bill `artists[]` entries**
   (Fri Sept 18 / Sat Sept 19 / Sun Sept 20), sourced from JamBase's grouping
   cross-checked against the official poster image (manual read, since the
   poster itself is image-only) — the one genuinely actionable lineup-data
   improvement found in this survey. Keep `status: "lineup"` (no grid yet).
3. **ACL: add `timezone: "America/Chicago"`** — free, zero-risk, doc-required
   groundwork for whenever the grid does get ingested. Optionally add doors
   times to the `dates` string once the FAQ page is directly re-confirmed
   (it 403'd on automated fetch today).
4. **ACL: verify + ingest the "ACL Fest Nights" afters section** — get one
   direct (browser, not automated-fetch-blocked) look at
   do512.com/aclfestnights, diff it against the dated-show list captured in
   this doc, and add it as a Portola-style Afters section once confirmed by
   a second reading.
5. **ACL: resolve the Sienna Spiro/Łaszewo meta.note flag** — today's second
   source (KVUE) confirms the file's CURRENT assignment is correct, so no
   data change is needed, but the open "unverified, single-sourced" flag in
   meta.note can be closed/updated to reflect the second confirming source.
6. **Seismic: no lineup-data changes recommended.** Still genuinely Phase-One
   only; the 3-artist promotional day/stage hints are too thin to act on.
   Re-check after ~Sept 18, 2026 (the 8.0-precedent Phase 2 date) — that is
   the next meaningful checkpoint, not before.
7. **ACL: full set-time grid ingest stays blocked** on someone doing a manual
   read of the six schedule poster images (or finding a text-rendered
   mirror) — no automated path found today. This is the same conclusion the
   file already reached on 07-07/08-23; today's research just confirms
   nothing has changed the blocker (still images, not JSON/text).
8. **Lost Lands: full set-time grid (stage + time-of-day) is genuinely not
   out yet anywhere** — expected around Sept 14–16, 2026 based on the 2025
   precedent (4 days before the fest). Re-check then, not before.

