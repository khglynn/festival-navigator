# Portola live ops — ledger

Every feedback item, every release, every review. Newest state at the top of
each table; the rules live in RUNBOOK.md.

## Feedback items (round 1, Kevin 2026-09-25 ~5:15 PM PT)

| # | Item (Kevin's words, short) | Kind | Where it is |
|---|---|---|---|
| 1 | Set up a virtual session | done | this session |
| 2 | "Side over": untimed cards line up with timed ones in a stack | tweak | v90 live (desktop; phone: timetable leftovers only). Phone afters: next build, a sideways scroll as Kevin described |
| 3 | OURS: where will most of us be, when (friends meeting up) | call → design | review page: https://claude.ai/artifact/WC7kW75eAHCibMUwF7Lzjv (design/ours/BRIEF.md) |
| 4 | Scroll to now / NOW not showing (maybe a cached build) | diagnose | stale build, not a bug (NOW shipped v87 at 12:04 AM Fri; verified at six instants in WebKit + Chromium). v90 live: Settings → Get the latest version |
| 5 | Add the queer events friends share (Mull, Pervert, Aftershock, Real Bad, Big Muscle), then widen to the whole Folsom-weekend scene with links | data + pick list | Pervert, Real Bad already in; MÜLL, Big Muscle, Aftershock live (PR #40). 68-party pick list for Kevin: https://claude.ai/artifact/FkTX3wa8wZn71jhdT8813x |
| 6 | Taller notes button beside search | tweak | v90 live |
| 7 | NOW not nowing (same as 4) | — | see 4 |
| 8 | First open: what is this, view without joining, share with default filters, empty crew, bare address | call → design + copy | same review page (design/first-open/BRIEF.md, Codex Sol 6 copy pass) |

## Releases

| Version | What | PR | Rollback target | Shipped | Verified |
|---|---|---|---|---|---|
| v97 | the List view (Board · List per phone per festival; `&view=list` in links and the address), the past folded behind EARLIER / HIDE EARLIER, the menu bar `dot · FEST '26 · ☰` | #54 | `dpl_GPBW4L7gTmcAwgo778XRHjh32bBT` (`5n64xt1rm`, v96) | 2026-09-26 6:42 AM | smoke PASS (festival-nav-v97 / 07ca84c4, 43 APP_CORE files identical on 3 hosts); walker SHIP 12/12 + the three fixes; 0 PostHog errors after |
| v96 | NOW as a tab in the day row; the Show menu a popover that stays open across ticks with no history entry; "+ Invite someone"; import picks from the Portola app's exported images (Settings, level 2, never lowering); the wall's address keeps its festival (`/f/<id>#g=…`) so link previews name the fest; a festival switch that finishes after you left Settings does nothing | #53 | `dpl_EDgPZyK9w7RhDm11VP2PL9nt3b9i` (`jpns9fsmj`, v95 + docs #50–#52) | 2026-09-26 5:36 AM | smoke PASS (festival-nav-v96 / 7117a248); `/api/import-schedule` answers GET with 405; `/f/portola-2026` carries the OG tags; 0 PostHog errors after |
| v95 | ticket doors read Tix / Tix $69 / Tix free / Info, never the seller; a one-time price + sold-out check (27 priced, 13 sold out → Info only, 40 bare Tix; resale sites never used) | #49 | `dpl_Y7BdTNbi4gpNXF5JVMgnXqYRbcTy` (`kgz0o4y3l`, v94) | 2026-09-26 2:12 AM | smoke 2:14 AM PASS (first run: one transient fonts.css fetch error on one host; rerun clean); prod JSON: PERVERT XXL 154, Magnitude 111 |
| v94 | Folsom weekend by time (declared `layout: by-time`), every verified party (64 entries / 65 cards), NOW rings to each party's own end across the 5 AM rollover (stacks too) | #48 | `dpl_EDA2vjKpcVWde2e8g8MF7mRziMDM` (`4x6htg8zq`, v92) | 2026-09-26 1:44 AM | smoke 1:44 AM PASS; prod Portola 195 entries, Folsom 64; local browser 210/210 incl. WebKit. Ships before live/v93, so the build skips v93 |
| v92 | guest first open: wall first, welcome card, join shelf, bare − · note · + zoom row; zoom text pairs + centred column, refit on resize/fonts | #43 | `dpl_o6xpnbLTxuMN9NJqQajcqLsdCZDG` (`jcq5094s8`, v91 + #47 docs) | 2026-09-26 1:26 AM | smoke 1:27 AM PASS (festival-nav-v92 / e82e2e1c) |
| v91 | phone afters line up under the timetable and scroll sideways; NOW slides a row to show its card; search ignores accents | #42 | `dpl_GjVVNR99hLMhjup6GX6BScTYFji1` (`fu3rtu01e`, v90) | 2026-09-25 7:59 PM | smoke 8:01 PM PASS (first run caught fest.kevinhg.com a few seconds behind the other two; rerun clean) |
| v90 | stack alignment under a clock, taller notes button, Get the latest version | #38 | `dpl_3gWy9wgXFV6iBQ4QtSecFML7xevW` (`97fdiul11`: v89 code + the #40 parties) | 2026-09-25 6:32 PM | smoke 6:33 PM PASS: v90/aa9f98ba on 3 hosts, 38 APP_CORE files identical, worker installs |
| data | MÜLL, Big Muscle: Bare Chest Calendar, Aftershock | #40 | n/a (data only) | 2026-09-25 6:24 PM | JSON on all 3 hosts carries the three names |
| v89 | (baseline) | #33 | v88 `festival-navigator-fwwumiisf` | 2026-09-25 2:50 PM | smoke 2026-09-25 5:33 PM: 3 hosts v89/4ad32b2f, landing + gallery clean |

## Reviews (Codex model comparison)

| Head | Change | Model · effort | Minutes | Findings (real / false / nit) | Missed what others caught |
|---|---|---|---|---|---|
| ef717ba | #37 ops: runbook, night-clock CI pass, prod smoke | Sol 6 · xhigh | 5.8 | 7 real (smoke guard blind to SW-handled and non-/api/ writes; host check ignored status/stamp; 404 could pass; silent Chromium fallback; runbook rollback target, walk scope, PostHog wording) / 0 / 1 nit | worker install untested (found on re-review); HTTP errors on data assets; invalid HogQL query |
| ef717ba | same head, same prompt | Astra 6 · xhigh | 8.5 | 5 real, all shared with Sol or Terra except one (an invalid HogQL query in observability.md), plus worker install on the first pass; reproduced two with probes / 0 / 1 nit | silent Chromium fallback; smoke expects the checkout's build; rollback target; walk scope; HTTP errors on data assets |
| ef717ba | same head, same prompt | Terra 5.6 · xhigh | 10.9 | 7 real: the only one to catch a 4xx/5xx the app swallows passing the smoke; runbook's local gate missing the night pass; stale research notes; plus the shared ones / 0 / 0 — and its own `sw-stamp --help` did a real bump (it restored it; the script now refuses unknown flags) | silent Chromium fallback; checkout build; rollback target; walk scope; HogQL query |
| 66789fb | #37 fix commit | Sol 6 · high | 2.2 | 3 real (explicit build skipped the stamp; worker install untested; secondary hosts' app bytes unchecked) / 0 / 0 | — |
| e4d40ca | v90 release | Sol 6 · xhigh | 5.0 | 2 real (the ready tap reloaded through a running Spotify scan; a failed registration lookup read as "no offline copy") + 1 product call (phone afters) / 0 / 0 | — |
| bd8c6b1 | v90 fix round | Sol 6 · high | 1.2 | 0 — both fixed, tests pin them | — |
| 71d2d5a | v91 release | Sol 6 · xhigh | ~8 | 1 real (NOW could land on a right-column stack card clipped by its row) + test-coverage nits / 0 | — |
| ce81009 | v91 fix round | Sol 6 · xhigh | ~5 | 0 blocking; asked for whole-card bounds in the 390/430 cycle tests and a Low Power row check | — |
| 40a2a47 | v92 first open | Sol 6 · xhigh | ~8 | 2 blockers (a guest could POST an old queued edit / a new festival row; an in-flight join could give the first pick to the wrong person) + 2 should-fix | CI's Tokyo pass caught blocker 1 independently |
| 1c1bf37 | v92 fix round | Sol 6 · xhigh | ~6 | 1 new blocker (member writes could silently stop if storage reads fail — guest-ness must be a session fact) + 3 should-fix | — |
| 963e599 | v92 reshaped flow (guest shelf, − · note · + row) | Sol 6 · xhigh | ~4 | 2 blockers (Escape/Back during an in-flight join; a stale shelf history entry) + focus return | — |
| PLAN.md | unified build plan | Sol 6 · xhigh | ~4 | 8 real (bulk/bring writer needs a person + batch; plan cache must invalidate on picks; join-shelf history cases; real-iPhone gate; liveWindowOf is a behaviour change; peek visibility under search/desktop; Show-menu fix already in v92; rollback wording) | → REVIEW-1.md beside the plan |

| a73df70 | v92 re-review | Sol 6 · high | ~6 | 1 IMPORTANT (zoom text pairs never refit on resize / late fonts) | — |
| 623a50b | v92 refit fix | Sol 6 · high | ~4 | 0 blocking; 2 minors (transform origin mid-bloom; double relayout in one frame) → follow-ups | — |
| 2cb7a32 | v94 Folsom by time | Sol 6 · xhigh | ~10 | 1 real BLOCKER: NOW rings dropped at the 5 AM rollover for parties still open (Aftershock to 10 AM) — stacks had it too | — |
| 3d114ad · 937f417 | v94 5 AM fix; merge with v92 | Sol 6 · xhigh / high | ~8 / ~8 | 0 / 0 | — |
| 33164a3 | v93 merged with v92 | Sol 6 · xhigh | ~9 | 1 BLOCKER: a crew 404 with the Show menu open left body[data-busy] set (blocks every update reload) | — |
| 7332366 · c8230b1 | v93 retire fix; history rework + anchor | Sol 6 · high / xhigh | ~6 / ~12 | 1 BLOCKER each: dead duplicate history entries (a Back that does nothing); then join-shelf duplicates + URL-only skipping; 1 IMPORTANT (an interrupted fold overrides a newer jump) | the independent walker caught the menu-tick jump to the day's top |
| ba0be43 · 8ba6c49 · d4c928f | v95 ticket prices | Sol 6 · high / high / medium | ~5 / ~2 / ~2 | 1 IMPORTANT (a cached price without its date, or $2001, rendered), then unreal dates, then the year range — each fixed | — |
| 9548b48 | v93 descoped (menu popover, no history entry) | Terra 5.6 · xhigh | ~10 | 0 — the one Terra trial; Kevin then settled on Sol 6 high | — |
| 4c9c7b3 · ccde52a · e4cba91 | v96 (v93 + import + the address fix) | Sol 6 · high | ~6 / ~4 / ~4 | 1 BLOCKER (the address kept the old fest after a switch in Settings; reload bounced back) → fixed; then 1 BLOCKER (a switch finishing after you left Settings wrote over the landing) → guarded; then 0. 1 IMPORTANT: the import's rate limit is per server instance → follow-up | the v96 walker found the same switch bug independently |
| bd98c12 · 8da4631 | v97 List view | Sol 6 · high | ~6 | 1 NIT (the name clamp) — and the Our plan session found the List's stacked-room rings disagreeing with the Board's → both fixed | — |
| 0d19e6e | v97 after v96 merged in | Sol 6 · high | ~5 | 3 IMPORTANT (the address bar dropped List; a festival switch kept the old past clock and open folds; the import could land on a folded pick) + 1 NIT (stale "caret" words) → fixed in 930f186 | — |
| 19df64b | v97 fix round | Sol 6 · high | ~5 | 0 blocking; 2 NITs (a fold closing mid-switch repaints once more; a folded import landing renders the wall twice) → follow-ups | — |
| 370952c | v97 walk | Sonnet walker, real input | ~50 | SHIP: 12/12 on 0d19e6e, the address / switch / import fixes re-walked on 370952c; harness notes only | — |
| db9bf2c | the tap change | Sol 6 · high | ~7 | 1 BLOCKER (VoiceOver's double-tap picks instead of opening the shelf), 1 IMPORTANT (the composer has no ride over the iOS keyboard), 1 NIT (the one-time line checks only this fest's picks) → with the builder | the Opus reviewer and the walker had passed it |

### Model comparison so far (Kevin's ask)

One head (ef717ba, #37) reviewed by all three with the same prompt at xhigh: **Sol 6** was fastest (5.8 min) and found the most (7 real); **Astra 6** (8.5 min) found 5, one unique (an invalid query) and caught the worker-install gap on its first pass, reproducing two findings with probes; **Terra 5.6** (10.9 min) found 7, three unique — including the most important one of the round (a 4xx/5xx the app swallows passing the smoke) — and its own `sw-stamp --help` performed a real bump. Every model missed things another caught. Working read: Sol 6 as the gate is sound; a second model on high-stakes heads (the gesture release, Our plan) is worth its usage. Sol 6 then gated every release that night and caught a real blocker on four of six heads.

## Kevin's calls, 2026-09-25 (review page rounds 1–4 and chat)

1. **First open (v92):** F2 wall first. A guest (a phone with no name in this crew) lands on the wall; the welcome card is for new people only — members, recognized phones and creators land as before. Card: one line ("Every friend has a color — the more color on a card, the more of us want to go."), **Pick shows** (primary, LEFT) · **Look around** (right), "More info" as a link ending the line. A guest's tap opens the card's zoom (never the full-screen join); with a zoom open, a tap on another card only closes. Joining is a footer shelf over the wall: "Pick X as…", two-tap name claim ("I'm Maya"), placeholder "Add your name", Look around closes. Full-screen join only for personal links.
2. **The zoom row (everyone, phone and desktop):** a bare **−** at the left and a bare **+** at the right, inset ~10–12px from the content edges, no button shape; the existing note chip in the middle; invisible hit areas = the full left / right of the row band out to the card edges. + steps 1→2→3→must and stops; − steps to not picked and stops. A guest's −/+/empty note opens the join shelf (a populated note opens the notes to read). Members' tap on the wall still picks until the gesture release. The button study's segmented pill was rejected ("misaligned and too much in the middle").
3. **v93:** NOW as a tab beside the live day in the scrolling day row (no pinned NOW, no dot); "+ Add someone"; a solid ring on the +3 overflow; the show/filter menu stays open across toggles and closes on an outside tap, Escape or Back; a small gear left of its Settings line.
4. **Folsom (v94):** include all verified parties; shown **by time** (cards in start-time order, wrapping, time headers), declared in the festival data, not inferred; one-time sold-out check at data prep (no rolling checker — "if not don't build it").
5. **Our plan (was OURS):** R3 — a peek row above the dock (artist big, place under it; NOW/NEXT with its time just left of the count; one text size for the second line) that drags up into the day plan in the same rows (quiet times, bigger artist names); no "Tell a friend"; desktop: a corner card with an Open button growing into a 400px right panel, wall usable; one NOW (in the peek) once it exists; an artist who plays twice counts at both places; hidden rooms stay hidden; bar max(3, ceil(pickers/4)).
6. **Order of the unified build:** "release in the order that makes the most sense for the quality of the build" — `claude-plans/2026-09-26-unified-build/PLAN.md` (+ REVIEW-1.md), not the festival calendar. Kevin: "It's okay to take your time and do more not less."
7. **Reading errors:** PostHog project 627900 — `POSTHOG_API_KEY` in ~/.env reads; `POSTHOG_API_KEY_FESTNAV` (also in the Keychain as `posthog-festnav-hogwrite`) has hog_function:write for the Slack alerts.


## Kevin's calls, 2026-09-26 (after midnight, chat)

8. **People menu (unified build, after the shelf primitive):** the left twin of Show — avatar pill → Highlight menu (crew multi-select, Our plan row, Pick as someone else, + Add someone). "+ Add someone" opens a shelf with the crew link first (Copy / Share), then a name, then other fests. Full text in the unified PLAN.md ("Kevin's calls after the plan", item 2).
9. **Menus announce themselves (v93):** a small caret after the fest name says it opens a menu; How it works stays feature-first (what it does, then how) — no "tap the …" rows, and the box is not rethought. The gear is an SVG, never the ⚙ glyph (iOS can draw it as an emoji).
10. **Ticket doors show the price, never the seller:** "Just tix if we don't know price or Tix $69" — because "some of these events are expensive". Info doors lose the site name too, so the two read alike (flag it back if Kevin wants `Info @ DoTheBay` kept). Label + a one-time price check (Portola Sat/Sun, ACL Late nights; sold-out shows lose their Tix door) on `data/tix-prices`: `TIX-PRICES-BRIEF.md` beside this file. Rides the next release after it lands.
11. **"Invite someone", not "Add someone"** (12:28 AM) — the chip, its sheet and How it works say Invite (v93; the sheet's own button still says Add, since that tap adds the name and then shows their link).
12. *(A default shipped in v94, not yet Kevin's call:)* **Folsom on a phone keeps its own two columns** under the Portola timetable (a time list is read across, so stepping in under the clock would hide half of every pair); flipping to the stepped-in version is one CSS block.

13. **Models and effort** (~3:50 AM): HIGH by default for every agent; Opus (high) for design and key build work (Sonnet lacks the taste; fine for walkers and research); Codex reviews on Sol 6 at high; batch work into larger phases with one full gate each; on a third round of the same kind of blocker, cut the mechanism, not the feature.
14. **List view + menu bar approved** (~3:45 AM, review page r5/r5b): full-width one-flow rows, a 560px laptop column, the three-line icon right of the fest name with the sync dot left, the past folded behind EARLIER that flips to HIDE EARLIER (no menu option), Board · List glyph row, small-caps stages. The hour pin ("Sunday at 2 — Folsom or Portola?") and the moment lens are PUNTED for their own design thinking (the moment lens is his favourite).
15. **Before Portola ends** (~4:40 AM): the List, the tap change, the people menu + Invite sheet (crew link first), and Our plan (a sibling session). The tap change ships alone, only after his iPhone test on a preview, with a rollback prepared: "as long as we bank and are prepped to maybe roll back those parts of the code (tap) let's do it and I'll test it for you when I wake up."
16. **Import from the Portola app** (~2:55 AM): picks land at level 2 and he adjusts; add-an-event is BANKED (`claude-plans/2026-09-02-add-a-show.md`) until its place on the wall is clear.

## Follow-ups found tonight (not blocking; for the unified build's U0 / sweep)

1. **A hold in the first seconds of a first open can be lost** — the first-boot identity round trip repaints the wall and replaces the card under the finger (the v95 walker, 2026-09-26). Keep the card node, or re-arm the hold on the replacement.
2. **Error reports don't name the build** when no service worker controls the page (every report tonight had `build: null`, `sw: "none"`): fall back to the page's own version.
3. **"Zoom closed right after a click: notes sheet opened"** is the intended close when the note chip opens notes — stop reporting that reason as a warning.
4. v92 minors (Sol): a resize mid-bloom can shift the bloom's origin; a font load and a resize in the same frame can relayout twice.
5. Tests: a shared real-hold helper for every browser test (hold until the zoom stands — five files still hold a fixed 650 ms under page.clock); the CDP flick must end without a fling before a quick tap.
6. Folsom neighbourhoods: the pick list has one for every party; the data has none — offered to Kevin.
7. **The import's rate limit is per server instance** (Sol on v96): move to a shared per-crew quota (the crew row) before the import gets popular.
8. **fold-intent on Linux WebKit only**: "NOW tapped during a tick's fade" moves the page 1350px there (skipped on Linux WebKit, dated, in the tap branch); check on a real iPhone.
9. **v97 NITs** (Sol on 19df64b): settle a closing fold's animation before a festival switch (one extra repaint today); a folded import landing renders the wall twice (227 ms in jsdom — measure on a throttled phone).
10. **The address carries the view but not the room checks** (`&show=`) that the invite link carries — make them match if a friend ever shares from the address bar with rooms hidden.
11. **ACL prep**: Late nights print doors only (65 of 66) and the Zilker headliners print no end — a data job on `data/acl-prep` (guess-run-times + the venue registry + printed ends), before Sep 29.
12. **The Board's in-room fold** was not built in v97 (only whole past days fold on Board); the gallery has no List section yet; a Late nights date that is over folds as a whole day only on the next held clock.
