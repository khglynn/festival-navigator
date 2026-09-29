# Release v106 — finishing the combined branch (Tue 2026-09-29)

Branch `release/v106`, worktree `.claude/worktrees/v106-release`, starting
head 0f4901e (four fix branches merged + ACL's `dayMeta` close "10 PM"
Fri/Sat/Sun). Log banked as I go.

## Task
1. Update the unit + browser goldens the ACL close moved, each checked
   against the rule: a stage's closing-slot set with no printed end runs to
   the day's published close (endApprox); nothing else moves. Keep the
   "without a published close, ACL keeps its default" behaviour covered with
   a no-close fixture.
2. Gates: npm test (+ TZ=Asia/Tokyo, + NIGHT_CLOCK), validator, the browser
   list both engines (+ LATE_ANIMATIONS_MS=800 for three).
3. Stamp last (`sw-stamp.mjs --keep`), commit, push.

## Log

### 1. What the close moves (diff of every festival file, old close=null vs the file's close)
Scratch script run against js/time.js computeDayArtists per day x weekend.
Exactly 12 sets change, all ACL, all the last set on the two big stages,
all `endApprox` — nothing on a small stage, no other festival (no other
file has a close), no Late night (a section, not a grid day, no close):

| Day | W | Set (stage, start) | old end | new end |
|---|---|---|---|---|
| Fri | W1 | Skrillex (T-Mobile 8:15) | 9:30 | ~10 PM |
| Fri | W1/W2 | Charli xcx (AmEx 8:40) | 9:55 | ~10 PM |
| Fri | W2 | Kings of Leon (T-Mobile 8:15) | 9:30 | ~10 PM |
| Sat | W1/W2 | Lorde (T-Mobile 8:15) | 9:30 | ~10 PM |
| Sat | W1/W2 | RUFUS DU SOL (AmEx 8:30) | 9:45 | ~10 PM |
| Sun | W1/W2 | The xx (T-Mobile 8:30) | 9:45 | ~10 PM |
| Sun | W1/W2 | Twenty One Pilots (AmEx 8:30) | 9:45 | ~10 PM |

`npm test` on 0f4901e: 1385 tests, 1373 pass, 11 fail, 1 skipped. Two
fails are the stamp (app-shell ASSET_STAMP; sw-stamp's fn-build meta
v105 vs v106) — step 5. Nine are goldens, judged one by one below.

### 2. The plan, stop by stop (planOf on the file vs the file with its close stripped)
Both test crews (plan-model's ACL_PICKS, tests/fixtures/plan-crew-acl.json)
give the same diff, and it is only the closers:
- Oct 2: Skrillex's stop 8:15–9:30 → 8:15–10 PM; the 9:30–9:55 Charli xcx
  tail stop is gone (she and Skrillex now end together; the "or Charli xcx"
  fork line already covers her). 6 stops → 5 that night; 25 → 24 overall.
- Oct 3 / Oct 10: Lorde 8:15–9:30 → 8:15–10 PM; Oct 10's scattered gap
  before Devil May Care now starts at 10 PM (it starts when Lorde ends).
- Oct 4 / Oct 11: The xx 8:30–9:45 → 8:30–10 PM (NOW "till ~10 PM").
- Oct 9: Kings of Leon still hands the route to Charli xcx at 8:40 (the
  crew's picks, unchanged), but its NOW till reads the set's own end, 10 PM;
  Charli's stop 8:40–9:55 → 8:40–10 PM.
- No Late-night stop, no daytime stop, no other place moved.
Spot checks (real file): Friday Oct 2's AmEx headliner Charli xcx ends
~10 PM; the Share at Fri 9:30 PM says "T-Mobile for Skrillex @ now till
~10pm" and "American Express for Charli xcx @ now till ~10pm"; Sun Oct 11
9 PM "The xx @ now till ~10pm"; Sat Oct 3 9:40 PM "Lorde @ now till ~10pm".
Portola: no close in its file, zero changes (diff above).

### 3. The nine reds, each judged (old → new, and why it is right)
All nine match the rule and the diff in §1–2, so each was updated; none
refused.
1. day-close "without a published close … ACL keeps its default": the file
   now HAS a close, so the test runs on `ACL_NO_CLOSE` (every close taken
   off; the fixture asserts it has none) — Skrillex/Charli keep start + 75
   there — plus one line that the file itself reads 10 PM. (d438559)
2. plan-model windows: Skrillex ['8:15 PM','9:30 PM'] → ['8:15 PM','10 PM'];
   checkWindows (plan window == the wall card's data-now window, all 248
   cards) was already green, i.e. wall and plan moved together. A no-close
   planOf still gives 9:30. Title/message say "to the day's close".
3. plan-model nights: stops [1,1,6,…] → [1,1,5,…] (Fri Oct 2's Charli xcx
   9:30–9:55 tail stop gone) and Oct 4 The xx 8:30–9:45 → 8:30–10 PM.
4. plan-model rule 5: [25,13] → [24,13] (the same tail stop; it had no
   "also").
5. plan-model NOW row: tillOf(Skrillex) 9:30 → 10 PM; tillOf(Kings of Leon)
   9:30 → 10 PM; kol.to stays 8:40 (the route still moves to Charli).
6–9. plan-acl goldens tue / wed / sat (+ satEarlier) / sun: the Charli tail
   line removed (tue, satEarlier), "Scattered till 11:45 PM 9:30 PM" →
   "10 PM" (4 lists), "The xx … NOW till ~9:45 PM" → "~10 PM" (sun).
   (bceee90)
Browser plan-acl: 8/8 green with NO golden change — every whole-night
Share line carries a start time only, and the one "from now" Share in the
golden is Tue Sep 29 (a Late night). The "now till ~10pm" Share is held by
day-close's Skrillex test and was spot-checked on the real file (§2).

Observation, not changed: the scattered row's start ("Scattered till
11:45 PM 10 PM") is Lorde's inferred end but wears no tilde — it wore none
at 9:30 either (also inferred), so it is the existing convention, not this
change. Worth a look if the tilde is meant to follow every inferred time.

### 4. Unit gate after the golden commits (head bceee90, before the stamp)
- `npm test`: 1385 tests, 1382 pass, 1 skipped, 2 fail = the stamp pair
  (app-shell ASSET_STAMP; sw-stamp's index.html fn-build v105 vs v106).
- `TZ=Asia/Tokyo npm test`: the same 1382 / 1 / 2 (stamp pair only).
- `NIGHT_CLOCK=2026-09-30T02:30:00Z npm test` (the script imports
  tests/helpers/night-clock.mjs, which reads NIGHT_CLOCK): the same.
- `node scripts/validate-festivals.mjs`: 10 files, 0 errors, 2 warnings
  (pre-existing: Flight by Nothing billed Sunday with no grid set;
  Tomorrowland winter's empty lineup). No close warning on ACL.

### 5. Browser gate, Chromium + WebKit (head bceee90, BROWSER_TEST_REQUIRED=1, serial)
plan-acl, plan-share, plan-days, plan-tail, plan-stop-ends, acl-latenights,
day-row-first-paint, now-jump, list-view, zoom-still-hand, people-menu:
259 tests, 258 pass, 0 fail, 1 skipped (by design: "WebKit: a later
night's glide carries on across a repaint … (the engine's own glide)" —
only Linux WebKit animates it). All eight "Tue 4 PM, the open lands on
tonight's Late nights room and the day row says LATE" cases green, including
WebKit 1280 with fonts on time and fonts 900 ms late.

### 6. LATE_ANIMATIONS_MS=800, and the WebKit 1280 landing — NOT confirmed fixed
- `LATE_ANIMATIONS_MS=800` acl-latenights + day-row-first-paint + plan-acl,
  both engines: 26/26 green locally.
- **The brief's key check does not hold on Linux.** CI already ran the
  combined head 0f4901e (acl-weekend's scrollspy fix merged in): the browser
  job FAILED in both the push run (36638024580) and the PR run (36638028094)
  on "WebKit 1280: Tue 4 PM, the open lands on tonight's Late nights room and
  the day row says LATE" (the fonts-on-time variant), same signature as
  before: `{"gap":0,"active":["SUN 11"],"fonts":"loaded"}`. The fonts-late
  variant passed there. On the v106-only head 3de19fa it was intermittent:
  push run 36634512190 browser green, PR run 36634513915 red on both
  variants.
- Local macOS WebKit cannot show it: the v106-only head (3de19fa, exported
  to the scratchpad with this node_modules) passes this test 6/6 — 3 plain,
  3 with LATE_ANIMATIONS_MS=800 — exactly like this branch. So a local green
  is no evidence either way; only Linux WebKit (CI) is.
- The signature says the page LANDED right (gap 0) but the spy's last claim
  was made against a layout ~one block short (SUN 11 is the block above
  LATE; the fonts-on-time open lands while Inter is still arriving and the
  six grid days above grow 6px each), and nothing re-read after the final
  landing. acl-weekend's change fixed the claim made at WIRING time; this
  one is a later claim (a re-read between the font growth and
  `landAgainWithFonts`' second landing, or a second landing that brings no
  re-read), so it is a different hole. Not fixed here: outside the brief,
  and it cannot be reproduced on this Mac.
- Also red in those CI runs: error-report "the page names the build it is"
  (v105 vs v106) — the unstamped fn-build meta; step 5's stamp covers it.

### 7. Stamp and final gate (aeac3d2)
- `node scripts/sw-stamp.mjs --keep`: v106 kept, ASSET_STAMP b5e21dd2 →
  0f61e93d, index.html fn-build v105 → v106. `--check`: fresh.
- `npm test` / `TZ=Asia/Tokyo npm test` / `NIGHT_CLOCK=2026-09-30T02:30:00Z
  npm test`: each 1385 tests, 1384 pass, 0 fail, 1 skipped.
- error-report browser test (CI's other red on 0f4901e): 1/1 green locally.
- Pushed after this log commit; CI on the pushed head is the only place the
  WebKit 1280 landing can be judged (§6).

## Hand-back
Commits: d438559 (no-close fixture), bceee90 (goldens), aeac3d2 (stamp),
this log. Nothing refused. Open item for the coordinator: §6 — the Linux
WebKit 1280 fonts-on-time landing still reads SUN 11 with the scrollspy fix
in; it needs a Linux probe (log each spy claim + scrollY + fonts.status in a
copy of the test, run on CI), not a local run.

### 8. CI on the pushed head 8c51084 — green, and what that does and does not say
- Push run 36642095621 and PR #71 run 36642102114: checks green, browser
  green (515 tests, 511 pass, 0 fail, 4 skipped each), all four WebKit
  "Tue 4 PM … says LATE" cases green in both.
- But 8c51084's app code is byte-identical to 0f4901e's except the
  fn-build meta (read only by js/errlog.js for crash reports; 3de19fa had
  no meta and still failed once). So the green is the same intermittent
  landing coming up heads, not a fix. Linux WebKit, "WebKit 1280: Tue 4 PM"
  fonts-on-time: 3de19fa 1/2, 0f4901e 0/2, 8c51084 2/2 → 3 of 6; the
  fonts-late variant 5 of 6. Always `{"gap":0,"active":["SUN 11"]}` when
  red: the page lands, the row does not follow.
- Next step (coordinator's call): a Linux probe — a copy of the test that
  logs every spy claim (scrollY, the LATE and SUN 11 block tops,
  --jump-offset, fonts.status, and whether landAgainWithFonts ran or bailed
  and why) — pushed on a throwaway branch so CI's WebKit runs it a few
  times. Candidates to confirm there: a geometry read between the font
  growth and the second landing with no scroll event after it (e.g. an
  engine scroll adjustment that fires none), or landAgainWithFonts bailing
  (`fonts.status` already 'loaded' at the open, or `scrollY !== at`) after
  a read that saw the pre-font layout.
