# ACL prep, round two — make the Late nights guesses safe, and the tool honest (2026-09-26)

Round one (a data researcher, `ACL-PREP-LOG.md` beside this, commits 9c18ce9 · 1cf5808 · ce9fd60
on `data/acl-prep`) gave all 66 ACL Late nights entries a time: 18 printed on a page (good), 48
guessed. Reading the result room by room, the guesses have one dangerous shape, the tool has a
gap, and the suite is red. This round fixes all three. ACL Late nights starts Tue Sep 29 and
friends will use these times to decide when to leave the house.

## 1. Guesses that come out LATER than the show (the one that hurts)

A guess that is early costs a friend some waiting; a guess that is late makes them miss the act.
Several rooms put a headliner at ~12:30 AM behind 7–9 PM doors, because the venue landed in the
registry as `kind: "club"` with an unknown close, so the script used the club fallback (2 AM) and
placed the closer at close − 90 min:

- Emo's (a ~1,700-cap concert hall): Palace ~12:30 AM behind 7 PM doors (Oct 1), BUNT. and
  Levity ~12:30 AM behind 9 PM doors.
- Brushy Street Commons (an outdoor venue): Hunx and his Punx, Underscores, Arcy Drive (7 PM
  doors!) at ~12:30 AM.
- 3TEN (ACL Live's small room): Łaszewo ~12:30 AM behind 8 PM doors.

Austin's concert venues run to curfews (the city's outdoor sound rules for outdoor stages; house
curfews indoors), not to 2 AM, unless the night is billed as a late show. Research each of these
venues' real routine (their own sites and FAQs — emosaustin.com, the 3TEN / ACL Live site,
Brushy Street Commons' site, Austin's outdoor music venue sound ordinance for the outdoor ones —
and past shows' printed "show" or set times), correct `kind` and `close` in `data/venues/index.json`
with sources and quotes, look again for PRINTED show times on each event's own venue page (round
one checked Do512 and ticketing sites; the venues' own calendars often print "Show 8 PM"), and
re-run. A night billed as a late or DJ show (9 PM+ doors at a club-format room) may truly run to
2 AM — decide per room from evidence, and say why.

Then read EVERY guessed room against one test: would a friend who arrives at the guessed time
miss the act? If you cannot rule that out, the guess is too late — prefer the earlier plausible
time and write the reason in the log. The Concourse Project (a 2 AM EDM club) and a few others
may be right as they are; say so where you checked.

## 2. The tool has a gap

`scripts/guess-run-times.mjs`'s `runsOf()` groups by `night` only, so on ACL's date-keyed Late
nights section it finds zero runs; round one worked around it with a throwaway script calling
`planRun`. Fix the script so a date-keyed section groups by date + venue (the model:
`claude-plans/2026-08-31-events-canvas/MODEL-V3.md` §5 and the repo CLAUDE.md "Run guesses come
from scripts/guess-run-times.mjs, never render time"), with a unit test. Then re-run
`node scripts/guess-run-times.mjs acl-2026` and show that the file it writes is the file you
intend: posted times untouched, hand corrections (Devil May Care's Bambi at 10:30 PM, set below
Rebecca Black's posted 11:45 PM) either reproduced by the tool or recorded so a re-run cannot
undo them. A guess nobody can reproduce is the kind the model forbids.

## 3. The suite is red (5 tests)

`occOf carries the date and the venue…`, `factsFor tells each late night its own truth…`, `the
artist sheet's header for a dated occurrence…`, `a dated section exports with its dates: ACL Late
nights, as shipped`, `ACL as shipped: searching finds a Weekend 2 headliner…`. For each, find out
whether the test encoded the old data (doors only, the old order) and should be updated, or
whether the data change broke something the test protects — in particular, round one reordered
entries (its `apply-order` step): check that play order, search and the pick keys still behave.
Update a test only when it asserts the old data, and say which it was for each.

## Rules

Data + the script + its tests + those five tests only. Never rename or remove an artist name; run
`node scripts/freeze-pick-keys.mjs acl-2026` if you touch names (you shouldn't). The headliners'
missing ends at Zilker are out of scope (a code rule, decided separately). Work in
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/acl-prep` on
`data/acl-prep`; append to `ACL-PREP-LOG.md` as you go; commit after each step (scope `data:` or
`scripts:`), push after each commit, scan each diff for a crew token (`#g=` + a long token) with
`&&` first. `node scripts/validate-festivals.mjs` 0 errors and `npm test` green at the three
clocks (default, `TZ=Asia/Tokyo`, `NIGHT_CLOCK=2026-09-27T04:30:00Z NODE_OPTIONS="--import
./tests/helpers/night-clock.mjs"`) before you report. No PR, no stamp. Do not spawn agents.

Report: SHAs; per venue what changed and the evidence; every room whose guess moved and from/to;
the rooms you left as they were and why; what each of the five tests was.
