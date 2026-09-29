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
