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

