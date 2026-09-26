# Import picks from the Portola app — build log (live/import, off v95 75ccf2f)

Brief: `IMPORT-BRIEF.md` beside this file. Builder: one Opus session in
`.claude/worktrees/import`, 2026-09-26 ~3:30–6 AM PT. Not stamped, no PR:
the coordinator releases it (it is v97 in the frames' folder name).

## Where it stands

- [x] 1. Matcher (pure) + tests — `js/v3/import-match.js`, `js/fold.mjs`
- [x] 2. Endpoint + `callGemini` image part + tests — `api/import-schedule.js`
- [x] 3. Real-model extraction of both samples (see "Real model" — the
      preview's own run needs a crew token; one command below)
- [x] 4. The flow (a sheet from Settings) — `js/v3/import.js`
- [x] 5. Browser test (WebKit + Chromium) + frames at 390 / 1280 in `v97-shots/`
- [x] 6. Second-door proposal — framed only (`11-proposed-second-door`), not built
- [x] 7. Three clocks + browser suite (below)

## What was built

1. **Door:** Settings → App → "Import from the Portola app", right under Bulk
   paste; members only (it writes your picks), named for the fest on screen.
2. **The sheet** (`sheet:import`, the production sheet anatomy via
   `sheetChrome`, a history entry like every sheet). One surface that grows:
   a line + a dashed "+ Choose images" → the chosen images as 9:16 tiles, each
   captioned as it is read ("SAT · 4 sets", "Needs signal", "Couldn't read —
   tap to retry", "No sets found") → each day's sets as **the wall's own
   cards** (`renderCard`, `--col-w` wide: two across a phone, three in the
   1280 dialog) at your colour and level 2, in the festival's day order →
   "Add N picks" pinned at the foot. A tap on a card cycles its level exactly
   as on the wall, with the wall's own meter motion (`refreshCard`).
3. **Never touched:** a set you already picked sits on an "Already yours" line
   under its day, at your level (the real meter chip), outside the import —
   not lowered, not raised. Re-read at Add time too (a pick made on another
   phone meanwhile wins). Names the lineup lacks: "Not on Portola's lineup
   here: …". A set on another day: imported, and "Tove Lo is on Saturday
   here, not Sunday." (its card says SAT). A different fest's image: a line.
4. **Add:** each pick through `recordToolPick` (the tap's own path, now shared
   with Bulk paste), for the importer only and only on the fest it opened on;
   one `scheduleSync`; every layer down (`history.go(-depth)`); the wall
   opens on the first set added; toast "Added N picks from your Portola
   schedule." No new document keys, no DB change.
5. **Endpoint** `POST /api/import-schedule`: `X-Crew-Token` header (checked
   against `crews`, a read), `{image}` base64 (the phone shrinks to ≤1080px
   JPEG q.85 first). Bytes decide the type (JPEG/PNG/WEBP/HEIC). 400 not an
   image, 413 over 3 MB, 401 no crew we know, 429 past 30/hour/address/
   instance, 502 model failed or unusable. Answer shaped/cleaned/capped as
   untrusted data. Image never stored, echoed or logged (errors log the
   message only). No env or vercel.json change. `callGemini` gains optional
   `image` + `schema`; the text-only body is pinned byte-identical by a test.

## Product calls (mine — confirm or overturn)

1. **The endpoint requires a crew** (header, verified by a read). Why: the
   repo is public, so the endpoint is findable; festival-add (the only other
   Gemini door) already requires one; everyone who can import already holds
   their crew token, so it costs them nothing; a burned quota would also take
   festival-add down. Header, not `?t=`: platform logs keep URLs (the person
   token's rule). Cost: one indexed read per image, and the preview check
   below needs a real crew token.
2. **Rate limit 30/hour per address** (per instance), before the store is
   asked anything — loose on purpose: a festival's phones share carrier
   addresses (CGNAT); the crew check is the real wall.
3. **Second door: propose, not built** — the just-joined welcome card's own
   sentence grows one clause: "Tap any artist to add yours, or *bring your
   Portola app schedule*." (a text link like its "More info", no new button),
   only on Portola. That is the moment a new member's list is empty. Frame:
   `v97-shots/390-11-…` / `1280-11-…` (DOM-injected mock). How it works would
   be the wrong home (read after the fact, rarely).
4. **Cancelled acts** start at off (0) in the review — visible, struck, tap to
   pick anyway. **Offline / Stay offline:** the tile says "Needs signal" /
   "Stay offline is on" in gray (a state, not a fault); nothing is sent while
   Stay offline is on.
5. **Up to 8 images** at once, 2 read in parallel; same file twice is one tile;
   two images of one day are one day; the same artist on two images is one
   pick at the higher level.
6. The sheet holds a new-build reload by existing rule (a sheet backdrop is
   not "quiet"), so no `data-busy` marker was needed.

## Pushback on the brief

1. "The crew token header the app already sends" — there is none: the app
   sends the crew token as `?t=` everywhere. The import uses a header; moving
   the others is a separate call.
2. The brief's preview gate ("POST the images to the preview with curl — it
   writes nothing") assumed an open endpoint. With a crew required, the
   preview needs a real crew token, which this lane may not use. A throwaway
   CLI deploy with the crew lookup stubbed was refused by the permission
   classifier (right call). What was done instead is below.
3. A matching nuance the brief didn't name: ours spells "erika b2b sfcowboy",
   the export "Erika b2b sfcowboy" — case-only, so it is an *exact* match.

## Real model (gemini-flash-latest; the project sets no GEMINI_MODEL)

Read through the endpoint's own handler code locally (only the crew lookup
stubbed, personal key from `~/.env`), 2026-09-26 ~3:12 AM PT — both perfect:

- Saturday 9/26 (5.5 s): Despacio 2:45–9:45 PM DESPACIO · Ranger Trucco b2b
  Alisha 2:45–3:45 PM WAREHOUSE · Airwolf Paradise 1:30–2:30 PM PIER ·
  Erika b2b sfcowboy 1:30–3:10 PM CRANE (festival "Portola").
- Sunday 9/27 (5.4 s): Overmono 8:20–9:20 PM WAREHOUSE · underscores
  5:50–6:40 PM CRANE · VTSS 4:30–5:30 PM WAREHOUSE · Silva Bumpa 2:30–3:30 PM
  WAREHOUSE (festival "Portola").
- The app icon (not a schedule): `{festival: null, day: null, items: []}`.

On the preview (`festival-navigator-gyj6g9ew6`, branch alias
`festival-navigator-git-live-import-kevinhg.vercel.app`, via `vercel curl`):
GET 405 · no token 401 · non-image 400 · 4.2 MB 413 · unknown token-shaped
crew 401 after the real `crews` read. Project runs fluid compute, 300 s default.

**To finish the preview check** (needs a crew token you may use — a throwaway
one; the endpoint writes nothing), from the main checkout:

    vercel curl /api/import-schedule --deployment <preview url> -- -s -X POST \
      -H 'Content-Type: application/json' -H 'X-Crew-Token: <token>' \
      --data-binary @body-sat.json

(`body-sat.json` = `{"image":"<base64 of the export>"}`.) Note: `vercel
curl` silently creates a "Protection Bypass for Automation" secret on the
project; this lane revoked the one it created (0 remain, as before).

## Tests (at 67e4619 + this log)

- Unit, UTC / TZ=Asia/Tokyo / night clock: 1042 tests, 1040 pass, 1 skipped,
  1 fail in each — the service-worker stamp (APP_CORE changed; the
  coordinator stamps). One UTC run also failed `first-open-shelf-close`
  ("Escape and Back while a join is in flight", timing under load): 5/5 pass
  alone, 3/3 on base, clean on the next full run.
- `node scripts/validate-festivals.mjs`: 0 errors.
- Browser suite: 213/213 (Chromium + WebKit), incl. the new
  `tests/browser/import-flow.test.mjs` (both engines: header token, 1080px
  send, level cycle, already-yours untouched, only Kevin's keys written,
  wall lands on the first pick; plus retry-a-failed-tile and ✕ writes nothing).
- New unit files: `tests/import-match.test.mjs` (13), `tests/import-schedule.test.mjs` (12).

## Frames — `claude-plans/2026-09-25-portola-live/v97-shots/` (git-ignored)

`{390,1280}-` × `01-settings-door`, `02-choose`, `03-reading`, `04-review`,
`04b-review-foot`, `05-landed` (Airwolf 3, Overmono must, VTSS off),
`05b-landed-foot`, `06-wall-after-add`, `07-edges` (unknown name, off-day
set, already-yours at 1), `08-nothing-new`, `09-failed-and-empty`,
`10-offline`, `11-proposed-second-door`. Regenerate:
`IMPORT_SAMPLES=<dir with the two exports> node claude-plans/2026-09-25-portola-live/import-walk.mjs`.

## Found, not changed (pre-existing)

1. **Every Settings close drops the wall's scroll to its top** (measured:
   3900 → 0 on Back). The import works around it for its own exit only.
2. After a programmatic landing the dock can still light the previous day
   (SUN while Saturday is on screen) until the next real scroll.

## Log

- ~3:30 AM — read brief, CLAUDE.md, RUNBOOK, the tools, the card/meter code.
- 99f003d matcher + fold · 3205b59 endpoint · (real-model run) ·
  ee05b5e the sheet · 16d43e6 browser test · 67e4619 frames round (row
  squeeze, lede exit, offline gray, landing on the first pick).
