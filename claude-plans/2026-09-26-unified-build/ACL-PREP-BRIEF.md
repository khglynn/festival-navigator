# ACL prep — times for Late nights and the headliners' ends (data brief, 2026-09-26)

ACL 2026's Late nights start Tue Sep 29 (Austin club shows through Oct 10) and
Zilker weekend 1 is Oct 2–4. Two data gaps make the app wrong there today, and
this job fixes both in the festival data only — no code.

## The two gaps

1. **Late nights print doors only.** 65 of the 66 `artists[]` entries with
   `"day": "Late nights"` in `data/festivals/acl-2026.json` carry `doors` and no
   set time, so NOW and the (coming) Our plan cannot place them. Venues: The
   Concourse Project 11, Stubb's 8, Emo's 8, Historic Scoot Inn 8, Brushy Street
   Commons 8, Antone's 7, Stubb's Indoors 5, 3TEN 4, Devil May Care 3, Mohawk
   Austin 2, Fair Market 1, The Continental Club 1.
2. **The Zilker headliners print only a start.** A stage's last set has no end,
   so the grid draws it 60 minutes and NOW stops counting it live early.

## How to fix them (read these first)

- `docs/add-a-festival.md` (the data rules), the repo `CLAUDE.md` bullets on pick
  keys ("Artist names in a live festival file are pick keys, and there is no
  rename path") and on run guesses ("Run guesses come from
  `scripts/guess-run-times.mjs`, never render time"), and the header comment of
  `scripts/guess-run-times.mjs`.
- **Before any time edit:** `node scripts/freeze-pick-keys.mjs acl-2026` and
  commit the fixture if it changed (people are already picking ACL).
- **Gap 1, in this order:**
  a. For each Late nights show, look for a PRINTED time on the event's own page
     (`source` / `page.url`, the venue's site, Do512, the ticket page): a "show"
     time or set times. A printed time is written as the set's `time` with no
     `approx` (it is posted; the script never touches it). Keep a note of the URL
     you read it from in your log.
  b. For each venue, research its routine and add it to `data/venues/index.json`
     in the existing `venues-v1` shape (look at the three entries there): `city`,
     `kind` (club / hall / bar / outdoor), `site`, `close` (by weekday where it
     differs, a default, a `confidence`, and `sources` with a URL and a short
     verbatim quote each), `doorsToFirstActMin`, `headlinerSetMin`,
     `supportSetMin`, `setSources`, `notes`. Unknown stays `null` with a note —
     never a made-up number; the script's per-kind fallback exists for that.
  c. Run `node scripts/guess-run-times.mjs acl-2026` (the plan, no write), read
     every room's plan and check it makes sense (a 7 PM doors club show should
     not end at 5 AM; the headliner should get the headliner set), then
     `--write`.
- **Gap 2:** find the official ACL 2026 weekend 1 and weekend 2 schedules with
  END times (the official site, the official app's schedule page, press
  releases, a reputable outlet that printed the full grid). Add each stage's last
  set's end where a source prints it, in the file's existing shape for a set's
  end (read how other sets in `days` carry theirs). Where no source prints it,
  leave it and list it in your report — do not guess a headliner's end.
- Never rename or remove an artist name (pick keys). Never touch any other
  festival's file.

## Checks and banking

- `node scripts/validate-festivals.mjs` (0 errors), `npm test` (all pass except
  nothing — this branch is off main, stamped), and the pick-key freeze test.
- Work in `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/acl-prep`
  on branch `data/acl-prep`. Keep a log `ACL-PREP-LOG.md` beside this brief,
  started first and grown per venue (what you found, the URL, the quote). Commit
  after each step (scope `data:`), push after each commit. This repo is PUBLIC:
  scan every diff for a crew token (`#g=` followed by a long token) with `&&`
  before committing. No PR, no stamp — the coordinator releases it.
- Report: the SHAs; per venue what you found (printed vs registry vs fallback);
  the guessed rooms that looked off and what you did; which headliner ends you
  found (with sources) and which are still missing.
