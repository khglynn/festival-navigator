# Portola live ops — ledger

Every feedback item, every release, every review. Newest state at the top of
each table; the rules live in RUNBOOK.md.

## Feedback items (round 1, Kevin 2026-09-25 ~5:15 PM PT)

| # | Item (Kevin's words, short) | Kind | Where it is |
|---|---|---|---|
| 1 | Set up a virtual session | done | this session |
| 2 | "Side over": untimed cards line up with timed ones in a stack | tweak | v90 build |
| 3 | OURS: where will most of us be, when (friends meeting up) | call → design | round-1 designs |
| 4 | Scroll to now / NOW not showing (maybe a cached build) | diagnose | now-diagnosis + v90 get-latest control |
| 5 | Add the queer events friends share (Mull, Pervert, Aftershock, Real Bad, Big Muscle), then widen to the whole Folsom-weekend scene with links | data + pick list | research + scene sweep |
| 6 | Taller notes button beside search | tweak | v90 build |
| 7 | NOW not nowing (same as 4) | — | see 4 |
| 8 | First open: what is this, view without joining, share with default filters, empty crew, bare address | call → design + copy | round-1 designs, Codex Sol 6 copy pass |

## Releases

| Version | What | PR | Rollback target | Shipped | Verified |
|---|---|---|---|---|---|
| v89 | (baseline) | #33 | v88 `festival-navigator-fwwumiisf` | 2026-09-25 2:50 PM | smoke 2026-09-25 5:33 PM: 3 hosts v89/4ad32b2f, landing + gallery clean |

## Reviews (Codex model comparison)

| Head | Change | Model · effort | Minutes | Findings (real / false / nit) | Missed what others caught |
|---|---|---|---|---|---|
| ef717ba | #37 ops: runbook, night-clock CI pass, prod smoke | Sol 6 · xhigh | 5.8 | 7 real (smoke guard blind to SW-handled and non-/api/ writes; host check ignored status/stamp; 404 could pass; silent Chromium fallback; runbook rollback target, walk scope, PostHog wording) / 0 / 1 nit | — (Astra, Terra pending) |
| 66789fb | #37 fix commit | Sol 6 · high | 2.2 | 3 real (explicit build skipped the stamp; worker install untested; secondary hosts' app bytes unchecked) / 0 / 0 | — |
