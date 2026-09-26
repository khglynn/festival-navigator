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
