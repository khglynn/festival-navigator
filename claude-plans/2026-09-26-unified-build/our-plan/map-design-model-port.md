# Our plan — design model + prototype port map (head e1eb206, 2026-09-26)

Status: COMPLETE, 2026-09-26. Read-only on code; sections banked in the order 5, 1, 2, 3, 4, then 6 (surprises + open questions). `D=` = `claude-plans/2026-09-25-portola-live/design/ours-r2/`.

## 5. Golden numbers — `node print-route.mjs` on this head (banked first)

Run from `claude-plans/2026-09-25-portola-live/design/ours-r2/` on e1eb206, 2026-09-26, exit 0, no network. Input: `data/festivals/portola-2026.json` (last touched 23af538 2026-09-26, md5 e5fb4ad32e289d9dec2f0b48288d1c6c), crew = `crew.mjs` selectionsFor(9), MEMBERS Ana..Ivy. Two runs: folded=[] then folded=['Folsom']. Times are festival-day clock printed by `clock()`; a stop's count is its PEAK count (not the count at a given minute).

Diff between the two runs: only Sunday changes (Folsom Street Fair stop + its 4 forks vanish; Sun becomes 13 stops beginning Kaytree 1:40 PM; Mochakk still 5, but its stop starts 5:35 PM instead of 6 PM). Thu 1 / Fri 2 / Sat 12 stops are identical. Totals: 26 stops unfolded (1+2+12+11), 28 folded (1+2+12+13).

```

######## folded=[]  us=9 (Ana Ben Cy Dot Eli Fay Gus Hal Ivy) bar=3

== Thu  stops=1
 most 10:30 PM – 12 AM     5 LAIMA → Soulwax @ Regency Ballroom [Ana,Cy,Dot,Hal,Ivy] musts=0 maybe=3  ALSO: Soulwax Sat Crane Stage 9:55 PM

== Fri  stops=2
 some     8 PM – 9 PM      4 Gelli Haha → Channel Tres @ Regency Ballroom [Ana,Cy,Dot,Fay] musts=0 maybe=4  ALSO: Gelli Haha Sat Pier Stage 2:40 PM; Channel Tres Sun Pier Stage 3:30 PM
 some     9 PM – 3 AM      4 Horse Meat Disco @ Public Works [Cy,Dot,Fay,Hal] musts=1 maybe=0
         fork 10:30 PM–12 AM 3 @ Regency Ballroom  [Ana,Ben,Ivy]
         fork 12:30 AM–2 AM 4 @ 1015 Folsom  [Ana,Ben,Eli,Ivy]

== Sat  stops=12
 some  2:40 PM – 3:30 PM   4 Gelli Haha @ Pier Stage [Ana,Cy,Dot,Fay] musts=0 maybe=4  ALSO: Gelli Haha Fri Regency Ballroom 8 PM
 some  3:30 PM – 4:30 PM   3 Tricky @ Crane Stage [Gus,Hal,Ivy] musts=0 maybe=0
 some  4:45 PM – 5:40 PM   4 Groove Armada @ Warehouse [Ana,Ben,Eli,Gus] musts=1 maybe=4  ALSO: Groove Armada Sat The Great Northern 1:30 AM
         fork 4:45 PM–5:30 PM 4 @ Pier Stage Fcukers [Cy,Dot,Fay,Ivy]
 most  5:40 PM – 6:30 PM   6 Tove Lo @ Pier Stage [Ana,Cy,Dot,Fay,Hal,Ivy] musts=0 maybe=0
         fork 5:40 PM–6 PM 3 @ Warehouse Groove Armada [Ben,Eli,Gus]
         fork 6:10 PM–6:30 PM 3 @ Crane Stage DJ Shadow [Ben,Eli,Gus]
 some  6:30 PM – 7:10 PM   3 DJ Shadow @ Crane Stage [Ben,Eli,Gus] musts=0 maybe=0
 most  7:10 PM – 8:10 PM   7 Robyn @ Pier Stage [Ana,Ben,Cy,Dot,Fay,Hal,Ivy] musts=2 maybe=0
         fork 7:15 PM–8:10 PM 3 @ Warehouse Kettama [Ben,Eli,Gus]
 some  8:10 PM – 8:30 PM   3 Kettama @ Warehouse [Ben,Eli,Gus] musts=0 maybe=0
 some  8:30 PM – 9 PM      3 Fatboy Slim @ Crane Stage [Gus,Hal,Ivy] musts=0 maybe=3  ALSO: Fatboy Slim Sun 888 Garage 12:30 AM
 most     9 PM – 10:15 PM  8 Dog Blood @ Pier Stage [Ana,Ben,Cy,Dot,Eli,Fay,Hal,Ivy] musts=2 maybe=0
 most 10:15 PM – 10:30 PM  5 Soulwax @ Crane Stage [Ana,Cy,Dot,Hal,Ivy] musts=0 maybe=5  ALSO: Soulwax Thu Regency Ballroom 10:30 PM
         fork 10:15 PM–10:30 PM 3 @ Warehouse Prospa [Ben,Eli,Gus]
 most 10:30 PM – 1:30 AM   6 Milli Meng → Chloé Caillet → Fcukers @ Public Works [Ben,Cy,Dot,Eli,Fay,Ivy] musts=1 maybe=2
         fork 10:30 PM–10:55 PM 3 @ Crane Stage Soulwax [Ana,Hal,Ivy]
         fork 11 PM–11:30 PM 3 @ Audio  [Ben,Eli,Gus]
 some  1:30 AM – 3 AM      4 Groove Armada @ The Great Northern [Ana,Ben,Eli,Gus] musts=1 maybe=4  ALSO: Groove Armada Sat Warehouse 4:45 PM
         fork 1:30 AM–3 AM 4 @ Public Works  [Cy,Dot,Fay,Ivy]

== Sun  stops=11
 some    11 AM – 6 PM      4 Folsom Street Fair @ Folsom St, 8th-13th [Cy,Dot,Fay,Hal] musts=1 maybe=0
         fork 1:40 PM–2:55 PM 3 @ Ship Tent Kaytree [Ana,Eli,Gus]
         fork 3:30 PM–4:20 PM 3 @ Pier Stage Channel Tres [Ana,Ben,Ivy]
         fork 4:30 PM–5:25 PM 4 @ Pier Stage SG Lewis [Ana,Ben,Eli,Ivy]
         fork 5:35 PM–6 PM 3 @ Pier Stage Mochakk [Ana,Ben,Ivy]
 most     6 PM – 6:35 PM   5 Mochakk @ Pier Stage [Ana,Ben,Cy,Dot,Ivy] musts=0 maybe=0
 some  6:45 PM – 7:05 PM   4 Tiësto @ Warehouse [Ben,Eli,Hal,Ivy] musts=1 maybe=0
 some  7:05 PM – 8:15 PM   4 Zara Larsson @ Pier Stage [Ana,Cy,Dot,Fay] musts=2 maybe=0
         fork 7:05 PM–8:15 PM 4 @ Warehouse Tiësto [Ben,Eli,Hal,Ivy]
 some  8:20 PM – 8:45 PM   3 Overmono @ Warehouse [Ben,Eli,Gus] musts=0 maybe=3  ALSO: Overmono Sun Public Works 12:45 AM
 most  8:45 PM – 10 PM     8 Swedish House Mafia @ Pier Stage [Ana,Ben,Cy,Dot,Eli,Fay,Hal,Ivy] musts=3 maybe=0
 some    10 PM – 10:45 PM  4 Parcels @ Crane Stage [Cy,Dot,Fay,Ivy] musts=0 maybe=4  ALSO: Parcels Sat Regency Ballroom 10:45 PM
         fork 10 PM–10:45 PM 3 @ Warehouse Four Tet [Ana,Eli,Gus]
 some 10:45 PM – 11 PM     3 Four Tet @ Warehouse [Ana,Eli,Gus] musts=1 maybe=0
 some 11:15 PM – 12 AM     3 Kaytree → Ben UFO → Overmono @ Public Works [Ana,Eli,Gus] musts=1 maybe=3  ALSO: Kaytree Sun Ship Tent 1:40 PM; Ben UFO Sun Ship Tent 5:10 PM; Overmono Sun Warehouse 8:20 PM
   ···  scattered 12 AM – 12:30 AM
 some 12:30 AM – 1:30 AM   4 Two Shell @ The Midway [Cy,Dot,Fay,Ivy] musts=0 maybe=0
         fork 12:30 AM–1:30 AM 3 @ The Great Northern  [Ana,Ben,Eli]
 some  1:30 AM – 2 AM      4 SG Lewis @ The Great Northern [Ana,Ben,Eli,Ivy] musts=0 maybe=4  ALSO: SG Lewis Sun Pier Stage 4:30 PM

--- share, Sat 11 AM ---
Portola Saturday, where most of us will be:
5:40 PM: Tove Lo, Pier Stage
7:10 PM: Robyn, Pier Stage
9 PM: Dog Blood, Pier Stage
10:15 PM: Soulwax, Crane Stage
10:30 PM on: Public Works (Milli Meng, then Chloé Caillet, then Fcukers)

--- share, Sat 9:40 PM ---
Portola Saturday, where most of us will be:
Now: Dog Blood, Pier Stage, till 10:15 PM
10:15 PM: Soulwax, Crane Stage
10:30 PM on: Public Works (Milli Meng, then Chloé Caillet, then Fcukers)

--- share, Sun 2 PM ---
Portola Sunday, where most of us will be:
Now: Folsom St, 8th-13th (Folsom Street Fair), till 6 PM
  or Kaytree, Ship Tent from 1:40 PM
6 PM: Mochakk, Pier Stage
8:45 PM: Swedish House Mafia, Pier Stage

######## folded=[Folsom]  us=9 (Ana Ben Cy Dot Eli Fay Gus Hal Ivy) bar=3

== Thu  stops=1
 most 10:30 PM – 12 AM     5 LAIMA → Soulwax @ Regency Ballroom [Ana,Cy,Dot,Hal,Ivy] musts=0 maybe=3  ALSO: Soulwax Sat Crane Stage 9:55 PM

== Fri  stops=2
 some     8 PM – 9 PM      4 Gelli Haha → Channel Tres @ Regency Ballroom [Ana,Cy,Dot,Fay] musts=0 maybe=4  ALSO: Gelli Haha Sat Pier Stage 2:40 PM; Channel Tres Sun Pier Stage 3:30 PM
 some     9 PM – 3 AM      4 Horse Meat Disco @ Public Works [Cy,Dot,Fay,Hal] musts=1 maybe=0
         fork 10:30 PM–12 AM 3 @ Regency Ballroom  [Ana,Ben,Ivy]
         fork 12:30 AM–2 AM 4 @ 1015 Folsom  [Ana,Ben,Eli,Ivy]

== Sat  stops=12
 some  2:40 PM – 3:30 PM   4 Gelli Haha @ Pier Stage [Ana,Cy,Dot,Fay] musts=0 maybe=4  ALSO: Gelli Haha Fri Regency Ballroom 8 PM
 some  3:30 PM – 4:30 PM   3 Tricky @ Crane Stage [Gus,Hal,Ivy] musts=0 maybe=0
 some  4:45 PM – 5:40 PM   4 Groove Armada @ Warehouse [Ana,Ben,Eli,Gus] musts=1 maybe=4  ALSO: Groove Armada Sat The Great Northern 1:30 AM
         fork 4:45 PM–5:30 PM 4 @ Pier Stage Fcukers [Cy,Dot,Fay,Ivy]
 most  5:40 PM – 6:30 PM   6 Tove Lo @ Pier Stage [Ana,Cy,Dot,Fay,Hal,Ivy] musts=0 maybe=0
         fork 5:40 PM–6 PM 3 @ Warehouse Groove Armada [Ben,Eli,Gus]
         fork 6:10 PM–6:30 PM 3 @ Crane Stage DJ Shadow [Ben,Eli,Gus]
 some  6:30 PM – 7:10 PM   3 DJ Shadow @ Crane Stage [Ben,Eli,Gus] musts=0 maybe=0
 most  7:10 PM – 8:10 PM   7 Robyn @ Pier Stage [Ana,Ben,Cy,Dot,Fay,Hal,Ivy] musts=2 maybe=0
         fork 7:15 PM–8:10 PM 3 @ Warehouse Kettama [Ben,Eli,Gus]
 some  8:10 PM – 8:30 PM   3 Kettama @ Warehouse [Ben,Eli,Gus] musts=0 maybe=0
 some  8:30 PM – 9 PM      3 Fatboy Slim @ Crane Stage [Gus,Hal,Ivy] musts=0 maybe=3  ALSO: Fatboy Slim Sun 888 Garage 12:30 AM
 most     9 PM – 10:15 PM  8 Dog Blood @ Pier Stage [Ana,Ben,Cy,Dot,Eli,Fay,Hal,Ivy] musts=2 maybe=0
 most 10:15 PM – 10:30 PM  5 Soulwax @ Crane Stage [Ana,Cy,Dot,Hal,Ivy] musts=0 maybe=5  ALSO: Soulwax Thu Regency Ballroom 10:30 PM
         fork 10:15 PM–10:30 PM 3 @ Warehouse Prospa [Ben,Eli,Gus]
 most 10:30 PM – 1:30 AM   6 Milli Meng → Chloé Caillet → Fcukers @ Public Works [Ben,Cy,Dot,Eli,Fay,Ivy] musts=1 maybe=2
         fork 10:30 PM–10:55 PM 3 @ Crane Stage Soulwax [Ana,Hal,Ivy]
         fork 11 PM–11:30 PM 3 @ Audio  [Ben,Eli,Gus]
 some  1:30 AM – 3 AM      4 Groove Armada @ The Great Northern [Ana,Ben,Eli,Gus] musts=1 maybe=4  ALSO: Groove Armada Sat Warehouse 4:45 PM
         fork 1:30 AM–3 AM 4 @ Public Works  [Cy,Dot,Fay,Ivy]

== Sun  stops=13
 some  1:40 PM – 2:55 PM   3 Kaytree @ Ship Tent [Ana,Eli,Gus] musts=0 maybe=3  ALSO: Kaytree Sun Public Works 11:15 PM
   ···  scattered 2:55 PM – 3:30 PM
 some  3:30 PM – 4:20 PM   3 Channel Tres @ Pier Stage [Ana,Ben,Ivy] musts=0 maybe=3  ALSO: Channel Tres Fri Regency Ballroom 10:30 PM
 some  4:30 PM – 5:25 PM   4 SG Lewis @ Pier Stage [Ana,Ben,Eli,Ivy] musts=0 maybe=4  ALSO: SG Lewis Sun The Great Northern 12:30 AM
 most  5:35 PM – 6:35 PM   5 Mochakk @ Pier Stage [Ana,Ben,Cy,Dot,Ivy] musts=0 maybe=0
 some  6:45 PM – 7:05 PM   4 Tiësto @ Warehouse [Ben,Eli,Hal,Ivy] musts=1 maybe=0
 some  7:05 PM – 8:15 PM   4 Zara Larsson @ Pier Stage [Ana,Cy,Dot,Fay] musts=2 maybe=0
         fork 7:05 PM–8:15 PM 4 @ Warehouse Tiësto [Ben,Eli,Hal,Ivy]
 some  8:20 PM – 8:45 PM   3 Overmono @ Warehouse [Ben,Eli,Gus] musts=0 maybe=3  ALSO: Overmono Sun Public Works 12:45 AM
 most  8:45 PM – 10 PM     8 Swedish House Mafia @ Pier Stage [Ana,Ben,Cy,Dot,Eli,Fay,Hal,Ivy] musts=3 maybe=0
 some    10 PM – 10:45 PM  4 Parcels @ Crane Stage [Cy,Dot,Fay,Ivy] musts=0 maybe=4  ALSO: Parcels Sat Regency Ballroom 10:45 PM
         fork 10 PM–10:45 PM 3 @ Warehouse Four Tet [Ana,Eli,Gus]
 some 10:45 PM – 11 PM     3 Four Tet @ Warehouse [Ana,Eli,Gus] musts=1 maybe=0
 some 11:15 PM – 12 AM     3 Kaytree → Ben UFO → Overmono @ Public Works [Ana,Eli,Gus] musts=1 maybe=3  ALSO: Kaytree Sun Ship Tent 1:40 PM; Ben UFO Sun Ship Tent 5:10 PM; Overmono Sun Warehouse 8:20 PM
   ···  scattered 12 AM – 12:30 AM
 some 12:30 AM – 1:30 AM   4 Two Shell @ The Midway [Cy,Dot,Fay,Ivy] musts=0 maybe=0
         fork 12:30 AM–1:30 AM 3 @ The Great Northern  [Ana,Ben,Eli]
 some  1:30 AM – 2 AM      4 SG Lewis @ The Great Northern [Ana,Ben,Eli,Ivy] musts=0 maybe=4  ALSO: SG Lewis Sun Pier Stage 4:30 PM

--- share, Sat 11 AM ---
Portola Saturday, where most of us will be:
5:40 PM: Tove Lo, Pier Stage
7:10 PM: Robyn, Pier Stage
9 PM: Dog Blood, Pier Stage
10:15 PM: Soulwax, Crane Stage
10:30 PM on: Public Works (Milli Meng, then Chloé Caillet, then Fcukers)

--- share, Sat 9:40 PM ---
Portola Saturday, where most of us will be:
Now: Dog Blood, Pier Stage, till 10:15 PM
10:15 PM: Soulwax, Crane Stage
10:30 PM on: Public Works (Milli Meng, then Chloé Caillet, then Fcukers)

--- share, Sun 2 PM ---
Portola Sunday, where most of us will be:
Now: Kaytree, Ship Tent, till 2:55 PM
5:35 PM: Mochakk, Pier Stage
8:45 PM: Swedish House Mafia, Pier Stage
```

## 1. The model's algorithm, precisely (`design/ours-r2/ours-model.mjs`, 356 lines)

`D=` below means `claude-plans/2026-09-25-portola-live/design/ours-r2/`. The design folder is on this head unchanged since d55d087 (the files were copied in from `../ours/`). The only app import is `js/v3/events.js` (`parseEventTime, venueGroupsOf, nightOf, venueOf, isCancelled, WEEKDAYS`, D/ours-model.mjs:44), so it runs in Node.

### 1a. Constants (D/ours-model.mjs:46-58)

| Name | Value | Used for |
|---|---|---|
| `STEP` | 5 | minutes per slice (:46) |
| `FLOOR_MIN` | 3 | the bar's floor, and `available` needs `us.length >= 3` (:47, :149) |
| `FLOOR_SHARE` | 1/4 | `barFor(n) = max(3, ceil(n/4))` (:48, :56-58). 9 → 3, 12 → 3, 13 → 4, 16 → 4, 17 → 5 |
| `MIN_STOP` | 15 | a run shorter than this is folded into the run before it or blanked; a fork shorter than this is dropped (:49, :245, :285) |
| `CHANGEOVER` | 20 | a scattered gap shorter than this is removed (walking between stages) (:50, :289) |
| `FEST_ROOM` | `':fest'` | the grid's only room key (:54, :84) — BUG on ACL, see §2 |
| unprinted grid end | next start on the same stage, else `+60` | (:81-82) — differs from the wall, see §2e |
| most | `peak.people.length * 2 > us.length` | strictly more than half (:273) |
| leansOnDoubles | `peak.maybe.length * 2 >= peak.people.length` | half or more (:280) |
| "even" fork (share text only) | `f.count >= bar && f.count >= ceil(s.count * 0.75)` | :345 (dead: shareText not ported) |
| "even" fork (UI, r3-proto) | `f.count >= stop.count && overlap >= 0.6 * stop duration` | D/r3-proto.mjs:124 |
| fork shows its own time | `f.from >= stop.from + 30` | D/r3-proto.mjs:118 |

### 1b. Inputs and outputs

`oursModel(fest, picks, members, { folded = [] })` (:146).
- `fest`: the raw festival JSON. `picks`: `{ artistName: { person: level 0-4 } }` (the shape `model.picksFor` returns). `members`: array of names. `folded`: show-menu keys.
- Returns `{ us: string[], bar, available, folded, nights: Route[], playsAt: Map<act, {night, place, from, kind}[]> }`. When `!available`, returns early with `nights: []` and no `playsAt` (:149-150).
- `Route = { night: 'Thu'|'Fri'|…, us: n, bar, items: Item[], stops: n }` (:293).
- `Item` is either `{ kind: 'scattered', from, to }` or a stop:
  `{ kind: 'stop', tier: 'most'|'some', place, from, to, count, people[], musts, maybe[], leansOnDoubles, alsoAt[], timeline[{t, people[]}], forks[{place, from, to, count, people[]}] }` (:283-286). `count`/`people` are the PEAK slice's, not the count at any given minute.
- `Place = { id, night, kind: 'set'|'room', room, roomKeys[], place, start, end, approx, acts[{ name, from, to, time, approx, occ }] , doors?, close? }` (:84-87, :110-117). `occ` is what `factsFor(name, ctx, occ)` needs to draw the node (set: `{day, stage, time}`; room: `{day, stage: stage || "<night> · <venue>", time, venue}`). NOTE: the room `occ` omits `date` and `weekend`, which `occOf` (js/v3/events.js:75-87) now carries — the port should build occ with `occOf(entry)` for rooms and `{day, stage, time, weekend}` for grid sets (the grid's own shape, js/v3/wall.js:1300).

### 1c. Places (`placesOf`, :72-121)

1. **Grid sets:** for each key of `fest.days`, every set whose `time` parses with `parseEventTime` (events.js:129, the 9 AM festival-day axis). `night = dayMeta[dayKey].wd || dayKey.slice(0,3)` (:75). End = printed end, else the next set's start on the same stage, else start+60 (:81-82). One place per set: `id = "<wd>|<stage>|<name>"`, `roomKeys: [':fest']`, one act. No weekend filter (bug b). Billing entries, activities and strays are not places (strays are: they are sets; billing/activities are not).
2. **Rooms:** section entries = `fest.artists` whose `day` is not a grid day, `nightOf(e)` is a weekday, and not cancelled (:92). Dated entries (`date:` ISO, `nightOf` null) are DROPPED (bug c). Grouped by night, then `venueGroupsOf(entries)` (events.js:226) → one place per venue-night across ALL sections (so a venue billed under two sections on one night is one room; `roomKeys` = the distinct `e.day` values at that venue joined by ' & ' then split, :109-111). `start = doors ?? min(member.nowFrom)`, `end = close ?? max(member.nowTo)`, skipped if either is null, `end <= start → +1440` (:102-108). acts = every member with `from/to = nowFrom/nowTo` (events.js:252-261 rule: next member's start, else printed end, else close, else +60).
   - Consequence under v94 (Folsom by-time, 68 one-party rooms, events.js:302-338 `showsOnItsOwn`): two separate parties at one venue on one night become ONE room spanning doors→close, and "arrive for your first pick, stay through your last" is applied across two unrelated parties. Open question for the port.

### 1d. Who is where (rules 1, 3, 5)

- **US** (`usOf`, :61-67): members with any level > 0 on any artist in `picks`. The design passes `members = state.activePeople()` names in r3-proto.mjs:24; the model itself only filters `members` by having a pick, so a departed member's picks are excluded only because they are not in `members`. Rule 1: US is computed on the whole festival, never the folded view (the fold is not an input to `usOf`).
- **doubled** (:152-154): an act name that appears in >1 place across the WHOLE festival (all nights, hidden rooms included). `playsAt` (:156-161) lists every place of each doubled act.
- **stretchFor(place, person)** (:128-136): the person's acts here with level > 0; `from = min(act.from ?? place.start)`, `to = max(act.to ?? place.end)` (rule 4: in a room you arrive for your first pick and stay through your last), `level = max`, `sure = some act here is NOT doubled`.
- **Per night** (:168-212): `here` = every place with that night INCLUDING hidden ones. `t0 = min(start)`, `t1 = max(end)`, slices every 5 min `t0 <= t < t1`.
  - `crowd(p)` = number of US with a live stretch at p (before placement).
  - Each person goes to the live place maximizing the key `[level, crowd, wasHereLastSlice ? 1 : 0, place.start]`, lexicographic, larger wins (:193-194). So: higher level → bigger pre-placement crowd → stay where you were → the LATER-starting place ("the set that just began"). A full tie keeps the first place in `here` order (strict `> 0`).
  - `was` remembers each person's last place (:198); never reset between slices when a person is unplaced (they keep their old `was`).
  - Count per place: `{place, people[], musts (level 4 count), maybe[] (people whose only acts here are doubled)}` (:199-206).
  - **Rank** (:207): people desc → musts desc → place.start ASC (earlier-started wins this tie; the opposite of the placement tie-break).
  - **Rule 8 applied here, after placement** (:211): `ranked` keeps only places with `people >= bar` AND `shown(place)`.
- **visibleIn(folded)** (:141-144): a place is shown if ANY of its roomKeys is not folded.
- **Nights listed** (:166): distinct `night` of shown places; sorted by `WEEKDAYS.indexOf` (Mon first) (:225-226) — bug a.

### 1e. Route (`routeOf`, :233-294; rule 6-7)

1. Runs: consecutive slices with the same top-ranked place id (null when nothing clears the bar) (:234-240).
2. Blip fold, walking from the end (:243-249): a non-null run shorter than 15 min is appended to the previous run IF that one is non-null (the previous keeps its id and swallows the blip's slices), else it becomes null. (The comment says "between two others" but only the previous one is checked; a blip at the very start becomes null.)
3. Merge adjacent runs with the same id (:251-253).
4. Each null run → `scattered`. Each id run → a stop: `peak` = the first slice with the most people at the run's place (strict `>`); forks = every OTHER ranked place during the run, spanning its first to last slice seen (+5; gaps inside are NOT split), `peak` its largest crowd; forks shorter than 15 min dropped (:256-286). `timeline` = `{t, people}` for every slice where the run place is in `ranked` (i.e. at or over the bar).
5. Remove scattered shorter than 20 min; trim scattered off both ends (:289-292).
6. `alsoAt` (rule 5 honesty, :215-222): only for stops with `leansOnDoubles`; for each act at the stop that someone in `stop.maybe` picked, every other play of it not at (same night AND same place name).

### 1f. Readers

- `headlinersOf(stop, picks)` (:298-304): a room's acts ranked by how many of the stop's people picked each (lv > 0) then play order; top 3; re-sorted by play order.
- `oursAt(model, night, minutes)` (:307-317): `current` = stop with `from <= m < to`; `scattered` likewise; `next` = first stop with `from > m`; `later` = the rest; `here` = the latest `timeline` entry with `t <= m` (the NOW count is the count at this minute, never the peak).
- `peekOf(night, nowMin)` (D/r3-proto.mjs:129-135): current → `{stop, tag:'now', count: (here || current.people).length}`; else the first MOST stop among next+later, else the next stop → `{tag:'next', count: stop.count}`; else null (after the day's last stop there is NO peek).
- `forkFor(stop, bar, nowMin)` (D/r3-proto.mjs:122-126): forks with `count >= bar` (and `to > nowMin` when given — only for the NOW row, :170); prefer the first "even" fork (`count >= stop.count` and overlapping >= 60% of the stop); else the biggest (then earliest). At most ONE fork row per stop, even though the model keeps several (Sun's Folsom stop has four).
- `clock(min)` (:319-324): `h:mm AM|PM`, minutes dropped when :00 ("9 PM"), wraps mod 1440. The app already has `hourLabelOf` / `clockLabel` (events.js:143, now.js:77) — the port should use one of those, not a third formatter (check they format identically first).
- `shareTextOf` (:333-356): retired (BRIEF.md:81-83). Do not port.

### 1g. Where each of the eight rules lives

| Rule | Code |
|---|---|
| 1 US = members with a pick, whole festival | `usOf` :61-67; not fed `folded` (:147) |
| 2 bar = max(3, ceil(US/4)) | `barFor` :56-58; `available` :149 |
| 3 one body, one place, 5-min slices, tie-breaks | :184-198 (key :193) |
| 4 place = grid set or venue-night room; arrive first pick, stay till last | `placesOf` :72-121; `stretchFor` :133-134 |
| 5 an act playing twice counts at both; `alsoAt` honesty | doubled/playsAt :152-161; `sure` :132; maybe :205; leansOnDoubles :280; alsoAt fill :215-222 |
| 6 route = top place over the bar; forks; scattered | ranked filter :211; `routeOf` :233-294 |
| 7 most (> half) vs some | :273 |
| 8 hidden rooms hidden, but bodies placed first | `visibleIn` :141-144; nights :166; filter after placement :211 |

## 2. The four ACL bugs, re-verified on this head, and what the port reads instead

Probe (scratchpad, read-only, no network): the design `placesOf` and the app's own `wallPlanFor`/`roomsOf` (js/v3/wall.js imports fine in Node) run on `acl-2026`, `portola-2026`, `seismic-9`.

| # | Bug | On this head | Worse or better than the old map |
|---|---|---|---|
| a | nights from weekday keys | design nights `["Fri","Sat","Sun"]`; the wall's week is SIX dated days `Friday|W1 (2026-10-02)` … `Sunday|W2 (2026-10-11)` + a `Late nights` extra with 10 dates `2026-09-29, 10-01, 10-02, 10-03, 10-04, 10-05, 10-06, 10-08, 10-09, 10-10` | same |
| b | W1+W2 grid sets on one clock | 41 same-stage overlaps across Fri/Sat/Sun (e.g. "Fri Asleep at the Wheel 1:00 PM - 1:45 PM / Happy Landing 1:00 PM - 1:45 PM @ T-Mobile"). ACL grid = 49 untagged + 42 W1 + 42 W2 sets | old map said 18 on Friday only; it is 41 over three days |
| c | dated Late nights entries dropped | 0 room places from 66 dated entries (`nightOf` is null for `date:` entries, events.js:31-39; the design filter needs `nightOf`, D/ours-model.mjs:92) | same |
| d | grid roomKeys `':fest'` | design roomKeys `[":fest"]`; ACL's menu offers `["weekend:W1","weekend:W2","Late nights"]` (`roomsOf`, wall.js:1422-1439; `weekendRoom`, wall.js:1364) | same; plus `wallPlanFor` treats `:fest` as INERT on a two-weekend fest (wall.js:1403), so even a stale `:fest` key must not hide anything |

Portola on this head: the wall's week is `Thursday (2026-09-24, synthetic, Afters 7)`, `Friday (09-25, synthetic, Afters 21, Folsom 20)`, `Saturday (09-26, grid, Afters 15, Folsom 24)`, `Sunday (09-27, grid, Afters 25, Folsom 21)`; rooms `[":fest","Afters","Folsom"]`; `dayMeta.Folsom.layout = "by-time"` (v94). Seismic 9: no grid, no nights (design returns empty nights; `wallPlanFor` returns a plan with no days) — no peek.

### 2a. Three more things the port must fix (not in the old maps)

1. **Two live-window rules, and PLAN.md Q3 misdescribes the grid.** PLAN.md:807-810 says "today the grid says the start plus 60 minutes". False on this head: the grid's cells come from `state.getDayArtists` (js/state.js:403-411) → `computeDayArtists` (js/time.js:43-69), which ALWAYS fills a missing end (next set on the stage, gap clamped to 30..120 min; a stage's last set +75). So `liveTo: a.endMin ?? a.startMin + 60` (wall.js:1234, written to `data-now-to` at :1308) never reaches its `+60`. Measured on ACL's 12 closer instances (Skrillex, Charli xcx, Kings of Leon, Lorde, RÜFÜS DU SOL, The xx, Twenty One Pilots): grid 75 min, design model 60 min. The old map (map-plan §5a.4) had the same error. Portola's 63 grid sets all print ends, so its golden numbers do not move with this rule. The simplest honest port: read grid windows from `computeDayArtists` on the weekend-filtered day (pure, no state), so the peek's "till" equals the wall's glow by construction; any change to the rule (Q3) is then one edit in time.js.
2. **By-time sections (v94) are not rooms.** 10 of Portola's 55 design Folsom rooms merge two unrelated parties at one venue on one night (e.g. `Fri|The Stud`: BARK BEFORE DARK 5-9 PM and DIRTY BOOTS 10 PM-2 AM become one room 5 PM-2 AM; `Sat|DNA Lounge`: Big Muscle 1-7 PM + SXTPS 10 PM-2:30 AM). The design also uses `venueGroupsOf`'s run rule (next member's start beats the printed end, events.js:252-255), which the by-time list explicitly reverses: "a party's PRINTED end wins" (`timeBandsOf`, events.js:370-386). Port: a section whose `sectionLayoutOf(fest, key) === 'by-time'` (events.js:326-329) yields one place PER PARTY with the `timeBandsOf` window; only by-venue sections yield venue-night rooms.
3. **A two-section show appears in both section lists.** `groupByDay` puts an "Afters & Folsom" entry under each part (wall.js:748-760; `splitDays` :720-731), so reading `sections[i].byDay` naively seats the same show twice. Two such rooms on Portola (`Fri|Public Works`, `Sun|Audio`). Dedupe by entry identity (`occOf`) and union the roomKeys, as the design did implicitly by reading `fest.artists` once.
4. **After-hours past the 5 AM clock rollover** (v94 `nightMinutes`, wall.js:1713-1728; commit 3d114ad): Aftershock runs 3-10 AM "Saturday". `festivalClock` (js/v3/now.js:45-58) says Sunday from 5 AM, so `planAt` must also ask the previous night via `nightMinutes(iso, clock)` (days 0 or 1). The design's `oursAt(model, 'Sat', minutes)` has no notion of this.
5. **ACL nights can be Late-nights-only or grid+Late.** Five Late nights dates are also grid dates (10-02, 10-03, 10-04, 10-09, 10-10): a night keyed by ISO must MERGE the grid day's sets with that date's Late nights rooms (the wall shows them on separate tabs; the plan is "the day"). Five dates are Late-nights-only (09-29, 10-01, 10-05, 10-06, 10-08). Open call: does a Tuesday Late night get a plan/peek? The rule-as-written says yes if 3+ of us picked shows there.
6. **Two-weekend sections only land on grid days**: `eventModelOf` maps `s.byDay` over `axisDays`, which on a two-weekend fest are the grid days only (events.js:543-565). No ACL section uses `night:` today, so nothing is lost, but the port should not assume a section night can exist on a non-grid ACL day.

### 2b. What the port reads instead: the wall's week

`wallPlanFor(fest, ctx)` (wall.js:1377-1415) returns `{ model: { days, sections, extras, looseNoDay, anchor }, festRoom, scheduled, weekends, gridDays }` with the fold applied; with `folded: []` it is the whole week (exactly how `roomsOf` reads it, wall.js:1422-1426). `eventModelOf` (events.js:429-565) is behind it. Each `day` = `{ key ('Saturday' | 'Friday|W1'), dayKey, wd, iso, weekend, grid, billing, synthetic, short, long, sub, when }`; each `section` = `{ key, label, byNight, byDay: Map(day.key → entries) }`; each `extra` = `{ key, label, byDate: Map(iso → entries) | null, entries }`.

**Visibility (rule 8) by reusing the wall, not re-implementing it.** Build two weeks: `whole = wallPlanFor(fest, {...ctx, query:'', folded:[]})` for placing bodies, and `shown = wallPlanFor(fest, {...ctx, query:''})` for showing. A place is shown iff:
- grid set of day D: `shown.festRoom && shown.model.days.some(d => d.key === D.key)` (a hidden weekend drops its days, wall.js:1410; `:fest` is inert on ACL, :1403; a one-room fest ignores every key, :1394);
- section place (by-venue room or by-time party) on day D: any of its section keys is in `shown.model.sections` (a two-section show stays while either is shown — the design's `visibleIn` rule, D/ours-model.mjs:141-144, and the wall's);
- dated-extra place: its extra key is in `shown.model.extras`.
This inherits the menu's "inert key" and "single room" rules for free. `whole` and `shown` are exactly what `roomsOf`/`renderWall` already compute; cache both per repaint.

### 2c. Port signatures (a sketch — `js/v3/plan.js`, pure; `js/v3/week.js` if U6 lifts the week first)

```js
// constants, unchanged from the design
export const STEP = 5, FLOOR_MIN = 3, FLOOR_SHARE = 1 / 4, MIN_STOP = 15, CHANGEOVER = 20;
export const barFor = (n) => Math.max(FLOOR_MIN, Math.ceil(n * FLOOR_SHARE));
export function usOf(picks, members) {}            // members = state.activePeople().map(([n]) => n)

// Places, per NIGHT keyed by ISO (fallback day.key when a day has no iso).
//  night = { id: iso, iso, dayKeys: [day.key, ...], wd, label: 'SAT' / 'FRI 2', date: 'Sep 26' }
//  place = { id, night: iso, kind: 'set' | 'room' | 'party', place, start, end, approx,
//            roomKeys: [...],               // weekend:W1 / :fest / section key / extra key
//            dayKey, acts: [{ name, from, to, time, approx, occ, play }] }
//  play = `${place}|${time}` identity for rule 5 (Q5 default: same stage + time on
//  the other weekend is ONE play, never "doubled")
export function placesOf(fest, whole) {}
//   grid: for each whole.model.days d with d.grid → computeDayArtists({ ...fest.days[d.dayKey],
//         artists: filter(!a.weekend || a.weekend === 'both' || a.weekend === d.weekend) })
//         (same filter as state.getDayArtists, js/state.js:408); roomKeys =
//         whole.weekends.length > 1 ? [weekendRoom(d.weekend)] : [FEST_ROOM]
//   by-venue section on d: venueGroupsOf(dedupedEntries) → rooms (design rule 4)
//   by-time section on d: timeBandsOf(entries) members → one 'party' place each
//   dated extra: for [iso, list] of extra.byDate → rooms (or parties if the extra is by-time),
//         merged into the night whose iso matches (a grid day's, or a night of its own)

export function planOf({ fest, whole, shown, picks, members }) {}
//   → { us, bar, available, nights: [{ night, items, stops }], playsAt }
//   nights ordered by ISO; same slice sweep, tie-breaks, route, most/some as §1.

export function planAt(plan, date, timeZone = fest.timezone) {}
//   clock = festivalClock(date, tz); try the clock.iso night, then the previous night
//   through nightMinutes(iso, clock); → { night, minutes, current, here, scattered, next, later }
export function peekOf(plan, date, tz) {}            // → { night, stop, tag: 'now'|'next', count } | null
export function forkFor(stop, bar, nowMin = null) {} // D/r3-proto.mjs:122-126, unchanged
export function headlinersOf(stop, picks) {}          // unchanged
export function alsoOf(stop, night) {}               // "also 1:30 AM" same night; else the other night's
                                                      // short label — a DATE on a two-weekend fest
                                                      // ("also Oct 9"), the weekday on Portola ("also Thu")
```

Cache (PLAN §2.6.4 + REVIEW-1 finding 2): rebuild `planOf` on any selection change (a pick via `refreshArtistCards` does NOT go through `repaintWall`), member change, fold change, or fest data change; the minute ticker only calls `planAt`/`peekOf`.

## 3. The peek / plan UI spec (D/r3-proto.mjs + D/r3-proto.css + the approved frames)

Frames were rendered 2026-09-25 21:48 against the app as it was then (the dock in them has no v93 NOW tab because `dockWithoutNow()` hid `#dock-now`/`#rail-now`, D/r3-proto.mjs:202-215 — those ids still exist on this head, index.html:224, 244, now living INSIDE the day row per v93 `paintNowTabs`, js/v3/app.js:855-881). The `X-*` frames (20:47-20:51) are ROUND TWO (r2-proto: big Anton time column, "RIGHT NOW · 4 AT PIER STAGE" headline, a "Tell a friend" button, the NOW tab in the dock) — all superseded by round three; use them only for content states round three did not draw: a scattered row ("Scattered till 12:30 AM", X-sun-split), a true split (Zara Larsson 4 / "or Tiësto · Warehouse 4"), a one-stop night ("THU OUR PLAN", Regency Ballroom, "LAIMA → Soulwax · also Sat", X-thu-also).

### 3a. What each approved frame shows (the acceptance picture)

| Frame | Clock | Content |
|---|---|---|
| Q-peek-next-390 | Sat 11 AM | peek above the dock: aura node · **Tove Lo** / Pier Stage · outlined NEXT over 5:40 PM · **6** of us. Wall scrolled to SAT PORTOLA |
| Q-peek-now-390 | Sat 9:40 PM | peek: glowing node · **Dog Blood** / Pier Stage · filled ●NOW over "till 10:15 PM" · **8** of us |
| Q-plan-390 / -320 | Sat 11 AM | shelf over the wall, above the dock: head `SAT OUR PLAN  SEP 26 · 9 OF US PICKING ───── (✕)`; rows Gelli Haha 2:40 PM 4 ("Pier Stage · also Fri") · Tricky 3:30 3 · Groove Armada 4:45 4 ("also 1:30 AM") + "or Fcukers · Pier Stage 4" · **Tove Lo** NEXT 5:40 PM 6 + six faces (A C D F H I) + "or Groove Armada · Warehouse 3" · DJ Shadow 6:30 3 · **Robyn** 7:10 7 + faces + "or Kettama · Warehouse 3" · Kettama 8:10 3 · Fatboy Slim 8:30 3 ("also Sun") · **Dog Blood** 9 PM 8 + faces · **Soulwax** 10:15 5 … (scrolls). At 320 the fork's place ellipsizes ("or Groove Armada · …") and "also 1:30 …" clips |
| Q-plan-now-390 | Sat 9:40 PM | "Earlier today: **8 stops** ⌄" · **Dog Blood** NOW till 10:15 PM 8 with the real `sheetCard` grown under it (9:00 – 10:15 PM · Sat · Pier Stage; MUST You·Fay / Ben·Cy +1 / Eli·Hal +1 chips) · Soulwax 10:15 5 "also Thu" + faces + "or Prospa · Warehouse 3" · **Public Works** ~10:30 PM 6 "Milli Meng → Chloé Caillet → Fc…" + faces + "or Soulwax · Crane Stage 3" · The Great Northern ~1:30 AM 4 "Groove Armada · also 4:45 PM" + "or Public Works · Milli Meng 4" |
| DT-peek-1440 | Sat 11 AM | 380px corner card bottom-right: `OUR PLAN · SAT · 9 OF US` + `Open ⌃` pill, hairline, then the Tove Lo NEXT row. Rail on top, no dock, no NOW tab |
| DT-peek-hover-1280 | Sat 9:40 PM | card lifted, brand edge, Open filled; white tip "The whole day ⌃" above its right; Dog Blood NOW row |
| DT-plan-1280 / -1440 | 9:40 PM / 11 AM | 400px right panel from under the rail to the bottom, `SAT OUR PLAN · SEP 26 · 9 OF US PICKING` + `Close ⌄`; the same rows (1280: Earlier 8 stops + Dog Blood grown; 1440: the full day with NEXT on Tove Lo). The wall runs under it unchanged (it covers the Despacio column and the head's hairline) |

Measured from the 2x PNGs (divide by 2): at 390 the dock is ~44 CSS px tall and the peek ~68 px (grabber + one row), so the phone's bottom chrome is ~112 px while the peek shows (PLAN §7d/2.5 guessed "about 44px" for the peek — it is ~68).

### 3b. DOM (as the prototype builds it)

```
peek (phone)     div.q-bar  [fixed, bottom = dock height - 1]
                   div.grabber
                   div.q-row.<most|some>[.live]      ← stopRow(stop, {tag, count, faces:false}), .also removed
shelf (phone)    div.sheet-backdrop#q-backdrop [bottom = dock height]
                 div.sheet.q-sheet [bottom = dock height; #dock z-index raised to 42 inline]
                   div.grabber
                   div.q-head > div.room-head( span.name(span.wd "SAT", " ", span.label "OUR PLAN"), span.sub "Sep 26 · 9 of us picking", span.line )
                              + button.sheet-close "✕"
                   div.q-plan > rows…
row              div.q-row.<most|some|or|earlier|scattered>[.live][.past][.first][.last]
                   span.q-node[.animated]                       (col 1)
                   span.q-what > span.nm, span.pl(+span.also), [span.q-who > span.avatar…]   (col 2)
                   span.q-when > [span.q-tag.now(i,"NOW") | span.q-tag.next "NEXT"], span.t[.soft]   (col 3)
                   span.q-n > b "8", "of us"                    (col 4)
                   [div.q-grow > .sheet-card]                   (cols 2-4, the NOW row only)
fork row         div.q-row.or: node(empty) · nm(i "or", name, span.pl-inline " · where") · when(soft time if ≥30 min after the stop starts, else empty) · count
earlier row      div.q-row.earlier: node · nm("Earlier today: ", b "8 stops") · empty span · span.chev "⌄"
scattered row    div.q-row.scattered: node(hidden) · nm "Scattered till 12:30 AM" (italic) · soft start time · empty
corner (desk)    div.q-stack [fixed right 20 bottom 20, 380w] > div.q-corner[role=button][aria-label="Our plan: open the day's plan"]
                   div.q-ch > span.k "Our plan", span.c "· Sat · 9 of us", button.q-open("Open", svg chevron-up)
                   div.q-row (faces:false, .also removed);   [div.q-tip "The whole day ⌃" on hover]
panel (desk)     div.q-panel [fixed right 0 bottom 0, top = #day-rail bottom, 400w]
                   div.q-head > room-head + button.q-shut("Close", svg chevron-down)
                   div.q-plan
```

Row content rules (D/r3-proto.mjs:41-121):
- `nm`: a set stop → the artist; a ROOM stop → the VENUE ("Public Works", "The Great Northern"), with the headliners joined " → " as its second line (so "the artist leads" is true only for sets).
- `pl`: set → stage; room → `headlinersOf(...).join(' → ')`; then "also …" (tertiary, " · " prefix). `alsoText` = unique over `alsoAt` of (same night ? `clock(o.from)` : `o.night`) joined ", " (:54-57). The peek and corner drop "also".
- faces: only on MOST rows, not on the grown NOW row, never in the peek/corner; you first; `hslOf(ci,.5)` fill, `1px solid strokeOf(ci, isMe)` (:69-80, :99).
- when: NOW row → "till " + (set: the SET's own end `acts[0].to`; room: `stop.to`) (:82); every other row → start, with "~" when it is a room whose lead act is approx (:81, :96). NEXT rows show the start under the tag.
- count: the NOW row shows the count AT THIS MINUTE (`here`), every other row the peak (:131, :167).
- The tagged row = the peek's stop (`peekOf`); a NOW row grows its card (`grow && tag === 'now'`, :167); stops with `to <= now` get `.past` (opacity .42), and when MORE THAN ONE is over they fold into the single "Earlier today: n stops" row and the scattered stretches before now go with them (:144-156). The earlier row is static in the prototype (no expand behaviour drawn).
- One fork row max per stop (`forkFor`, §1f); a fork under a past stop is past too.
- `.first`/`.last` on the first/last row trim the rail.

### 3c. The four-column grid

`grid-template-columns: var(--q-nw) minmax(0,1fr) var(--q-ww) var(--q-cw); column-gap: var(--q-gap); align-items: baseline; padding: 8px 0` (D/r3-proto.css:16-18).

| Width | --q-nw | --q-ww | --q-cw | --q-gap | row box (sheet gutter 14px each side) | column 2 (1fr) |
|---|---|---|---|---|---|---|
| ≥360 (390) | 16 | 72 | 48 | 10 | 390 − 28 = 362 | 362 − 16 − 72 − 48 − 30 = **196px** |
| ≤359 (320) | 16 | 64 | 44 | 8 | 320 − 28 = 292 | 292 − 16 − 64 − 44 − 24 = **144px** |
| desktop panel | 16 | 72 | 48 | 10 | 400 − 40 = 360 | **194px** |
| corner card | 16 | 72 | 48 | 10 | 380 − 2 − 28 = 350 | **184px** |

(`--sp-gutter` = `clamp(14px, 2.5vw, 28px)`, v3-tokens.css:85, is 14px at both phone widths.) The `@media (max-width: 359px)` switch is on `:root` (D/r3-proto.css:13). Watch: "till 10:15 PM" at 12px/600 is wider than the 72/64px when column; `.q-when` is `justify-self:end; min-width:0` with nowrap text, so it spills LEFT into column 2's gap (visible in Q-plan-now: the "till" starts well left of the times above). Either size column 3 for the longest "till h:mm PM" or accept the spill deliberately; measure at 320.

### 3d. Styles, and which are tokens

Every `var(--…)` the prototype uses EXISTS on this head (checked against assets/v3-tokens.css): `--brand` (192,132,252; :45), `--dock` #0A0812 (:11), `--page` #0C0A14 (:10), `--text-primary` #FFF (:21), `--text-body` #C6CBD6 (:22), `--text-secondary` #8E86A8 (:23), `--text-tertiary` #877FA4 (:27), `--text-header` (:20), `--tonal-text` #D8B4FE (:38), `--tonal-fill` (:37), `--hairline` (:14), `--border-card` (:15), `--border-input` (:16), `--r-pill` (:66), `--font-ui` Inter (:72), `--font-display` Anton (:71), `--track-display` .05em (:73), `--track-label` .12em (:74), `--fs-micro` 11px (:83), `--sp-gutter` (:85), `@keyframes gradShift` (:155). No `--fest` anywhere (correct: brand only). Reused app classes: `.sheet`, `.sheet-backdrop`, `.sheet-close`, `.sheet .grabber`, `.room-head` (+ `.name/.wd/.label/.sub/.line`), `.avatar`, `.avatar-cluster`, `.sheet-card` (via `sheetCard`), `.person-chip`, `.btn-tonal`.

INVENTED by the prototype (a builder must either promote these to tokens in v3-tokens.css or map them onto existing ones):

| Invented | Value | Nearest existing |
|---|---|---|
| `--q-nw/--q-ww/--q-cw/--q-gap` | 16/72/48/10 (320: 16/64/44/8) | none (new layout tokens) |
| `--q-line` (the one second-line style) | `600 12px/1.3 var(--font-ui)` | `--fs-body` is a 12.5-13.5 clamp; nothing is exactly 12px/600 |
| artist size | most 17px/800 lh 1.18 ls −.005em; some 14.5px/700 `--text-body`; or 13px/600; earlier/scattered 12px/600 tertiary | `--fs-card` clamp(13.5-15px) is the card name size; 17px is new |
| count digit | Anton 17px (some/or 14px) + "of us" 10px/700 tertiary | `--fs-day` clamp(16-19px) is the Anton head size |
| NOW/NEXT tag | 9px/800 ls .1em, pad 3px 7px, pill; NOW = `rgb(--brand)` fill + `--page` text + 4px `--page` dot; NEXT = `--tonal-text` + inset 1px `rgba(brand,.55)` | the app's `.now-tab` (v3.css) is the dock's NOW; the tag is a new pill |
| node | most 16px aura disc, ring `1px rgba(255,255,255,.38)` + `4px var(--q-bg)` halo; some 10px hollow ring `1.5px rgba(brand,.7)`; or/earlier 7px ring `rgba(brand,.45)`; live adds ring .6 + `0 0 12px rgba(brand,.85)` glow; animated → `gradShift 12s` | the card aura itself comes from `factsFor(...).background` (card-facts.js:48) |
| rail | 2px, `rgba(brand,.26)`, x = nw/2 − 1; first row starts 18px down, last ends 18px down; scattered = dashes `rgba(brand,.38)` 3px on / 4px off | none |
| faces | 15px avatar, 7.5px type, 1.5px `--q-bg` ring, −4px overlap | `.avatar` is 17px/8px, cluster overlap −5px (v3.css:264-267) |
| past | opacity .42 | none |
| peek surface `.q-bar` | radius `14px 14px 0 0`; shadow `0 -6px 18px rgba(0,0,0,.45)`; pad `5px gutter 6px`; z-index 31 | `--r-sheet` is `20px 20px 0 0`; `.sheet` shadow `0 -8px 30px rgba(0,0,0,.5)` |
| peek grabber | 30 × 3px `--border-card`, margin 0 auto 3px | `.sheet .grabber` is 36 × 4 with a 6px 30px hit pad (v3.css:492-494) |
| shelf `.q-sheet` | pad `10px gutter 16px`, gap 8, `max-height: 88vh` | `.sheet` pad 16, gap 12, max-height 72vh (v3.css:483-490) |
| grown card | `.q-grow` cols 2/5, margin-top 8; `.sheet-card` pad 13/12/14, name 17px | `.sheet-card` pad 16/16/17, name 19px (v3.css:1047-1054) |
| corner card | 380w, right/bottom 20, radius 16, pad 8/14/10, border 1px `--border-card`, shadow `0 14px 36px rgba(0,0,0,.55)`; hover translateY(−2px), border `rgba(brand,.55)`, shadow `0 18px 42px rgba(0,0,0,.6)`; `transition .15s` | `--r-settings` 12px is the nearest radius; no corner-card token |
| corner header | "OUR PLAN" `rgb(--brand)` `--fs-micro`/800 `--track-label` uppercase; "· SAT · 9 OF US" tertiary `--fs-micro`/700 .06em; hairline under | tokens, except .06em |
| Open / Close pills | Open: 26px tall, pad 0 10 0 11, 1px `--border-input`, 700 11.5px, 11px chevron svg; hover: border `rgba(brand,.7)`, `--tonal-text`, bg `rgba(brand,.12)`. Close: 28px | `.btn-ghost` (v3-tokens.css:221) is the ghost family — U1's button tokens should absorb both |
| tip | `#fff` bg, `--page` text, radius 6, 11px/700, shadow `0 6px 16px rgba(0,0,0,.4)` | none; `#fff` is a raw colour |
| panel | 400w, top = rail bottom, `border-left: 1px --hairline`, shadow `-14px 0 40px rgba(0,0,0,.45)`, pad 14/20/16, gap 8, z-index 31, no backdrop | none |

Stacking as prototyped: peek/corner/panel z31 (dock z30 v3.css:524; menu-up z39 :348; welcome/offer z38 :185; zoom layer z36 :1160; sheets 40/41 :482-484). So the zoom (36) paints over the peek — the port must add the peek to the zoom's floor (`dockTop()`, card-facts.js:833) rather than rely on z-order.

Motion (BRIEF.md:84-89; not built in the prototype, which just renders open or shut): the shelf follows the finger (pointer-driven transforms, never a CSS transition — `.low-power *` kills every animation AND transition with `!important`, v3-tokens.css:224, and reduced motion at :150); past a third it settles open on `EASE_ARRIVE` / `GROW_MS` (js/v3/motion.js:5, 11), short of it drops back on `EASE_LEAVE` / `OUT_MS` (:7, 12); rows above/below arrive `STAGGER_MS` (:9) apart; the live card blooms after landing; Reduce Motion / Low power jump. Note the prototype's corner card uses a CSS `transition` for hover (D/r3-proto.css:112) and `.sheet` carries `animation: sheetIn` (v3.css:489) — both get killed under Low power, which is fine for decoration but must not carry state.

### 3e. Port checklist for the builder (things the prototype hard-codes)

1. `ME = 'Ana'` (D/r3-proto.mjs:15) → `ctx.meName` (a guest has none: no "you first").
2. `DATE = { Thu: 'Sep 24', … }` (:17) → the week day's `when` ("Sep 26"; ACL "Oct 2 · Weekend 1") — events.js:523-536; ACL two-weekend days get `when` at :543-560.
3. The head's weekday → `day.short` / the wall's `headWeekday(day)`; the count → `plan.us.length`.
4. `E` module global and `env()` (:20-28) → the model cached per repaint (§2c); `ctx` is the app's live ctx (`factsFor` needs `picks`, `meName`, `affinity`, `lowPower`, `filterPeople`).
5. `dockH()` reads `#dock`'s rect (:198) → `--foot-h` (PLAN §2.5).
6. The corner card is a `div[role=button]` containing a real `button.q-open` (:255-261) — invalid nesting; PLAN §2.6 UI.4 says make the whole card the `<button>` and "Open ⌃" a span.
7. Close is a `.sheet-close` ✕ on the phone and a labelled "Close ⌄" pill on desktop.
8. Chevron SVG path (:191-196) is inline; the app has no shared icon for it.
9. `clock()` drops ":00" ("9 PM") — neither `clockLabel` ("9:00 PM", now.js:77-82) nor `hourLabelOf` ("9 PM" for every minute, events.js:143-146) matches it; decide one formatter (the cards print the file's own strings, e.g. "9:00 PM").
10. `dockWithoutNow()` is a frame-only hack; the real rule is PLAN §2.7 (`paintNowTabs`, app.js:856).
11. `welcomeCard`, `joinDialog`, `ghostStepper`, `openZoom`, `cursorAt`, `sendBlock` are other rounds' or frame-only helpers — not part of the Our plan port.

## 4. How the rig renders the production app (D/rig.mjs, D/frames3.mjs) — re-verified on this head

**Verified 2026-09-26 on e1eb206:** a scratch script (in my scratchpad, importing `D/rig.mjs` unchanged, screenshots to the scratchpad only) booted the real app at 390 and 1280 and drew `peekPhone`, `shelfPhone` and `panel` at Sat 9:40 PM with no page errors. Measured on this head: `#dock` = 45px tall at 390 (top 799 of 844); the peek `.q-bar` = **71px** (top 729), so the phone's bottom chrome with the peek is ~116px; `#day-rail` = 45px at 1280; `.q-panel` = 880,45 → 400×755; row columns resolve to `16px 196px 72px 48px` on the phone and `16px 193px 72px 48px` in the panel. The rows it printed match the approved Q-plan-now frame text exactly (Earlier today: 8 stops · Dog Blood NOW till 10:15 PM 8 + grown card · Soulwax 10:15 PM 5 also Thu + "or Prospa · Warehouse 3" · Public Works ~10:30 PM 6 + "or Soulwax · Crane Stage 3" · The Great Northern ~1:30 AM 4 also 4:45 PM + "or Public Works · Milli Meng 4"). Visible head differences vs the approved frames: the fest name now carries v93's Show-menu caret; the afters stacks indent to the clock's columns; `#dock-now` lives inside `#dock-days` (v93) and was hidden by `dockWithoutNow()`.

**The mechanics:**

1. `openRig()` (D/rig.mjs:17-22): `serveStatic(ROOT)` from `tests/helpers/static-server.mjs:14-33` (repo root on 127.0.0.1:ephemeral, `cache-control: no-store`, `/` → index.html, no /api), one headless Chromium via `playwright` (1.58.2 installed).
2. `openApp(rig, { now, width=390, height=844, fold=null, crew=9, desktop=false })` (:25-54):
   a. context: `viewport`, `deviceScaleFactor: 2`, `hasTouch/isMobile = !desktop` (desktop = mouse + ≥720 layout: the rail on top, no dock), **`serviceWorkers: 'block'`**;
   b. routing: anything not the local origin → `abort()` (no network); `/api/**` → 503; `/api/crew**` GET → `crewDoc('portola-2026', crew)` from D/crew.mjs:105-111 (a v4 doc: `{ v:4, meta:{name:'Design crew', inviteFestId}, people: {name:{colorIndex}}, festivals:{[fid]:{selections}} }`), any write → 503; `/api/festival-add**` → `{"festivals":[]}`; `/fn-i/**` (the crash-report door) → 204;
   c. `addInitScript` before any page script: `navigator.serviceWorker.register` stubbed; localStorage seeded: `fn_crews_v3 = [{token, name}]` (js/crew.js:15), `fn_me_v3_<token> = 'Ana'` (crew.js:17), `fn_crew_fest_v3_<token> = 'portola-2026'` (js/state.js:26), optional `fn_fold_v1_portola-2026 = [...]` (js/v3/filters.js:93). The token is a made-up constant in rig.mjs, never a real crew link. It also sets `fn_coach_v1` and `fn_errlog_off_v1`, which **no code on this head reads** (dead keys; harmless — `/fn-i/**` is stubbed anyway). It does NOT seed `fn_welcome_v1` (js/v3/welcome.js:29); the welcome card did not appear for the seeded member at these clocks.
   d. `page.clock.setFixedTime(now)` then `goto(origin + '/#g=<made-up token>')`; waits for `#screen-app` visible and > 20 `#wall-root .card`, then 900 ms.
3. `frames3.mjs`: one fresh context per frame; `calls(page, [[fn, arg], ...])` dynamic-imports `/<design folder>/r3-proto.mjs` INSIDE the page (so the prototype runs against the page's live `state`, `model`, `card-facts`, `palette` modules), `P.env({})`, `P.ensureCss()`, then each call in order (D/frames3.mjs:18-25). Helpers: `headTop(page, 'SAT PORTOLA', 14)` scrolls a room head to 14px from the top; `activeDay` fakes the active day tab; `cardToMiddle` centres a card. Clocks are PT with a `-07:00` offset (`PT('2026-09-26T21:40:00')`), `M(h,m)` = festival-day minutes.
4. Output: `frames/<id>.png` next to the rig (PNGs are gitignored; the approved ones live only in the `portola-live` worktree). Run `node frames3.mjs [prefix …]`.

**Reusing it for new frames (the builder's recipe):**
- Keep `openRig`/`openApp` as-is; point a new frames script at the REAL module once `plan-shelf.js` exists instead of `r3-proto.mjs` (the app will draw the peek itself, so frames become `openApp` + interactions, not injected DOM).
- Other fests: `crewDoc(fid, n)` and the `fn_crew_fest_v3_` seed are Portola-hard-coded (`'portola-2026'` at rig.mjs:33, :41, :44) — parameterize `fid` for ACL/Seismic frames, and write an ACL crew (placeholder names only; the repo is public).
- A pinned clock stops timers too (project memory "browser harness traps": the fake clock delays timers and in-page polls on a big wall) — for motion frames use `page.clock.install` + `runFor`, not `setFixedTime`.
- The CSS `sheetIn` scale animation is mid-flight right after `shelfPhone` (a `getBoundingClientRect` read the sheet as 382px wide at left 4 on a 390 viewport); wait ~200 ms or disable animations before measuring.

## 6. Surprises versus the old maps (map-plan-now-dock.md at abe7205, PLAN.md) and open questions

**Surprises**
1. PLAN.md Q3 and map-plan §5a.4 say the grid ends an unprinted set at start+60. On this head it is `computeDayArtists` (time.js:43-69): next set's gap clamped 30..120, last set +75; the `+60` in wall.js:1234 is unreachable. ACL's closers glow 75 min on the wall and would say 60 in the design model. Q3's default ("next set, else 60, everywhere") would CHANGE the grid's current behaviour, not just the plan's.
2. ACL has 41 same-stage overlaps in the design model across three days (the old map said 18 on Friday).
3. v94 made Folsom a by-time section of separate parties with printed ends winning (`timeBandsOf`); the design model still treats a venue-night as one room — 10 Portola venue-nights merge two unrelated parties.
4. v94's `nightMinutes` (after-hours past the 5 AM rollover, to 10 AM) is a clock rule the design model has no notion of; `planAt` must ask the previous night too.
5. The measured peek is ~71px tall at 390 on this head (PLAN guessed ~44px); dock 45px.
6. ACL Late nights share five dates with grid days; a plan night keyed by ISO must merge them, and five dates are Late-nights-only.
7. `wallPlanFor` already encodes the fold's edge rules (inert `:fest` on two-weekend fests, a one-room fest ignores keys, a hidden weekend drops its days); rule 8 can reuse `shown = wallPlanFor(fest, ctx)` instead of re-implementing `visibleIn`.
8. A room stop's big name is the VENUE, not an artist (prototype `whatEl`); "the artist leads" holds only for sets.
9. The prototype's NOW "till" for a set is the SET's end, not the stop's end (Soulwax's stop ends 10:30 when the route moves, its set later).
10. The rig still boots on this head unchanged; two of its localStorage seeds (`fn_coach_v1`, `fn_errlog_off_v1`) are dead keys.
11. The `X-*` frames named in the brief for this map are round-two frames (superseded row, headline and send button).

**Open questions**
1. Late-nights-only dates (ACL Tue Oct 6 etc.): plan and peek, or festival days only?
2. By-time parties: one place per party (recommended) — and does a party with no printed end still use the next party's start in that venue?
3. Grid live window: adopt `computeDayArtists` as the one rule (plan follows the wall), or Q3's "next set, else 60" (the wall changes)?
4. "Earlier today: n stops ⌄" — does it expand? Not drawn. Exactly one past stop shows as a faded row, two or more fold.
5. After the day's last stop there is no peek at all (`peekOf` → null) — intended?
6. `alsoAt` label on ACL: "also Oct 9" (date) vs the weekday; and Q5's "same stage + same time is one play" needs an explicit identity (`stage|time`).
7. The when column (72/64px) is narrower than "till 10:15 PM"; spill left by design or widen?
8. One time formatter: the prototype's "9 PM / 9:40 PM" matches neither `clockLabel` nor `hourLabelOf`.
9. Activities and fest-room billing entries with times (not grid sets) — places or not? The design ignores them.
10. The corner card z31 sits under the welcome card (z38) and the zoom (z36); U4's corner stack decides ordering.
