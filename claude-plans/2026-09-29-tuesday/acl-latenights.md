# ACL Late nights — tonight and through Oct 10 (Tue 2026-09-29)

Branch `fix/acl-latenights`. Builder log, banked as I go.

## Brief
Boot real app code in the rig (Chromium + WebKit, 390 and 1280) on an
invented ACL crew at six clocks (Sep 29 4 PM CT, 8:20 PM, 11:59 PM, Sep 30
12:30 AM, Sep 30 6 AM, Oct 3 9 PM). Check tab/room, NOW, rings, fold, Our
picks peek/plan, notes door, List view, Share. Plus LEDGER follow-up 21.

## Log

### 1. Probe (Chromium 390, Board + List), 2026-09-29 afternoon
Rig: `claude-plans/2026-09-29-tuesday/acl-latenights-probe.mjs` (local static
server, /api stubbed in-page, SW blocked, every other request aborted;
phone clock America/Chicago; invented crew Ada..Eve, picks incl. Total Wife
{Ada,Bo}, Fcukers {Bo,Dee,Ada}, Parcels {Ada,Eve}, Lorde {Ada,Bo}).

- Sep 29 4 PM: open lands on LATE (the Sep 29 room, first in the block).
  No NOW, nothing lit. Peek: "TUE · Mohawk Austin · Total Wife → Fcukers ·
  NEXT 8:45 PM" (the stop starts when the bar of 3 is met = Fcukers; by the
  plan's rule 2, not a bug).
- 8:20 PM: NOW tab first in the row; Total Wife lit (1200–1245), a NOW tap
  lands on Total Wife[NOW]. Peek still NEXT 8:45 (bar not met yet). OK.
- 11:59 PM: Fcukers lit (1245–1440). Peek "NOW till 12 AM", so the dock's
  NOW steps aside (v103 rule: the peek carries NOW). List: "Earlier · 1 set"
  folds Total Wife. OK.
- Sep 30 12:30 AM: nothing lit, no NOW (close 12 AM). List folds both sets
  ("Earlier · 2 sets", room head stays as its date's door). Board keeps the
  room whole (by design, LIST-BUILD call 2). No peek: the next stop is Sun
  Oct 4, not tomorrow — "tomorrow only, as built" (Kevin 2026-09-26). OK.
- Sep 30 6 AM: open lands on FRI 2 at the top (no room today; before the
  first grid day `nextVisibleDay` answers null → first grid day). Noted
  below as a finding.
- Oct 3 9 PM: NOW lit on CMAT, Velvet Trip, Dazzle Camouflage (Late nights)
  and the grid's now line on SAT 3; NOW lands on the grid line (inside the
  grid's hours — by design). "Earlier · FRI 2" folds Friday. Peek jumps to
  SUN Oct 4 because no Oct 3 stop clears the bar of 3 (Lorde and Parcels
  have 2 each): "Earlier · Sep 29 – Oct 3" in the open plan. Plan design.

Follow-up 12 ("a Late nights date that is over folds as a whole day only on
the next held clock"): does not bite tonight. The Late nights tab is ONE day
block; it can only fold whole when every date is over (after Oct 10). Each
date's room folds its own sets in the List at the next held clock (boot,
resume, 5 AM) — a phone left open from 11:59 PM keeps Fcukers visible past
midnight until it is resumed, which is the designed "never vanishes under
your thumb".

### 2. WebKit + laptop widths
- Every clock in WebKit (390, 1280), Chromium 1280, and WebKit List: the
  same rings, the same NOW presence, the same folds, no page errors (one
  "ResizeObserver loop" in WebKit 1280 List = LEDGER follow-up 37).
- **Found: WebKit at 1280 opens 36px short of the Late nights room, and the
  rail says SUN 11.** The open lands while the web fonts are still loading;
  each of the six grid days above grows 6px when Inter lands (6 × 6 = 36),
  and WebKit has no scroll anchoring to hold the landing (Chromium does, so
  it lands at 50px = --jump-offset). The day row's scroll spy then reads
  Sunday Oct 11. Laptop Safari, every festival's open; at 390 the growth
  is ~1px. Fix below (§4).
- Phone "second NOW tap stays put" on Oct 3 was the probe tapping a NOW the
  row had rested half behind its fade (LEDGER follow-up 34); with
  `nowInView` first, tap 2 goes to the Late nights cards and tap 3 comes
  back to the grid line, both engines.

### 3. LEDGER follow-up 21 — both halves real, both fixed
- Validator (4de188b): `roomKey` needed a weekday `night`, so dated rooms
  had no key and every run check skipped them. Keyed by the date now; a
  new section-entries case was red first. ACL still validates with 0 errors.
- Notes sheet restore (e9828d6): `findEventEntry` matched on time; a venue
  show now matches on name + day + date + venue + stage with time as a
  tie-break (ambiguous → null, grid sets unchanged) and factsFor reads the
  entry's time. dated-occurrence case red first (Palace, 12:30 AM stale).
- `npm test` after both: 1353 pass / 1 fail (the SW stamp, left for the
  coordinator) / 1 skipped / 1 todo.

### 4. Fix: the open lands again when the fonts arrive (38ef147)
`maybeOpenOnDay` → `landAgainWithFonts`: when `document.fonts` is still
loading at the open, land once more on `fonts.ready` (+2 frames) — only if
the page is where the open left it, no wheel/touch/pointer/key since, no
sheet up, same festival. tests/browser/acl-latenights.test.mjs: WebKit 1280
red before (gap 36, rail SUN 11), green after, both engines × 390/1280 ×
fonts on time / held 900ms; the hand guard's test is red with the guard
removed.

### 5. Our picks on a Late night — two real bugs, fixed (dece4e7)
Probe (`acl-latenights-share.mjs`): at 8:20 PM the Share said "Mohawk Austin
for Total Wife and Fcukers @ 8:45pm" — no tilde on Fcukers' guessed start;
at 11:59 PM the NOW row grew Total Wife's card while Fcukers played.
Cause: plan-rows `actFor` took `headlinersOf(...)[0]`, which is PLAY order
(the opener), not the most-picked act its comment promises; `approxOf`
read that act. Fixed both; the tilde now follows the act playing at the
stop's first minute. tests/plan-latenights.test.mjs red first. The ACL
goldens (node + browser plan-acl) had frozen the same bug on Stubb's Oct 1
("8:30 PM" is Brandon Flowers' guess) — now "~8:30".

### Notes door, List, Share — checked, fine
- Tue Sep 29's head "TUE LATE NIGHTS" is a button "Notes for Tue · Sep 29";
  it opens the DATE sheet (`sheet:day:2026-09-29`, title "TUE · SEP 29") and
  a note lands under `notes.day["2026-09-29"]` as a keyed object (the write
  refused by the rig, kept pending). Matches the CLAUDE.md law.
- List at every clock: Late-night rooms fold their own over sets ("Earlier ·
  1 set" at 11:59 PM, "· 2 sets" after close), rings identical to the Board.
- Share at 11:59 PM: "Mohawk Austin for Total Wife and Fcukers @ now till
  12am". plan-acl's per-night Share goldens cover the other nights.

### 6. Past midnight on a busier night, and later dates (probe extras)
- Fri Oct 2 1:30 AM (Oct 1's night): The Chainsmokers (12–2 AM) and
  Montclair (10:30 PM–1:45 AM) lit, NOW in the row, a NOW tap lands on the
  Oct 1 room with The Chainsmokers in view. 5:00 AM: nothing lit, the open
  lands on FRI 2 (today, before doors).
- Thu Oct 8 4 PM: the open lands on the Oct 8 room; W1 folds to "Earlier ·
  FRI 2 · SAT 3 · SUN 4".

### Findings for the coordinator (not fixed here)
A. **A date with no Late night skips the next one** (Wed Sep 30, Wed Oct 7):
   the open lands on the next GRID day (Fri Oct 2 / Fri Oct 9), passing the
   Late night the evening before it (Thu Oct 1 / Thu Oct 8). `app.js
   nextVisibleDay` ignores dated rooms and calls Sep 30 "before the
   festival". A product call: count dated rooms as days for "during" and
   for "the next visible day". Nothing is wrong on the screen; the LATE tab
   is one tap away.
B. **Oct 3 9 PM (Zilker Saturday) with no stop left today**: the open plan
   heads to Sunday (tomorrow-only rule) and files today under "Earlier ·
   Sep 29 – Oct 3" while Saturday still has sets on. Plan design, v105;
   worth Kevin's eye if a friend finds it odd.
C. **LEDGER follow-up 12 does not bite tonight.** Late nights is one day
   block, so it can only fold whole after Oct 10. In the List each past
   date keeps its head with an "Earlier · N sets" line (by Oct 8, six of
   them above tonight's room); the Board keeps past dates whole. The open
   lands on tonight's room either way. A per-date fold (past dates as one
   line) is the build if the stack gets in the way.
D. WebKit 1280 List at Oct 3 9 PM: one "ResizeObserver loop" page error
   (LEDGER follow-up 37).
E. The phone's NOW can rest half behind the day row's fade (follow-up 34):
   the probe's blind tap on its box centre missed it at Oct 3 9 PM.
