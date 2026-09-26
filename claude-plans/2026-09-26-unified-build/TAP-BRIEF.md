# The tap change — build brief (2026-09-26 ~4:35 AM PT)

Kevin wants this before Portola ends (Sun Sep 27) — **but only if it passes the full gate
AND his own check on his iPhone** (a preview link the coordinator sends him). The
unified plan's §4 says a gesture change mid-festival is the riskiest thing we could ship;
if it isn't airtight by Sunday morning it ships right after Portola, before ACL weekend 1
(friends learn the gesture once either way). Build it to that bar.

## What (Kevin's calls — PLAN.md top, "Kevin's calls after the plan" item 1, confirmed and
## sharpened 2026-09-26 ~2:50 AM PT)

"a tap on mobile (the one that replaced our long hold) show[s] the notes shelf (with full
controls) rather than a zoom with a notes button. On desktop we should keep hover with
the notes button. Clicking that opens the notes shelf — with no notes button."

- **Phone (touch):** a tap on any card opens ONE bottom shelf: the card's facts (name,
  when, where, the doors out: Tix / Info), the bare − · + controls, and the notes thread
  with its composer underneath. No zoom step, no notes button. Picking moves from "tap"
  to the shelf's − / + for members (today a member's tap picks). Guests already get a
  zoom on tap (v92) — they get the same shelf, whose − / + / composer open the join
  shelf (v92's guest rules). The long-press can go (or stay as the same door — say which).
- **Desktop (mouse):** unchanged hover → zoom with its notes button; clicking the notes
  button opens the same shelf (full controls, no notes button of its own).
- The shelf is the existing notes sheet grown into this role — reuse its anatomy
  (`sheetChrome`, the thread, the composer), don't invent a second sheet.

## Read

`claude-plans/2026-09-26-unified-build/PLAN.md`: Kevin's calls at the top; §2.1 (one hand),
§2.2 (one write path), §2.3 (one shelf, two roles); U0 (nets — WebKit real in CI before the
tap change), U2 (one hand, one write path), U3 (a tap opens the card, for everyone — the
most care; its unit-test list is in `map-input.md` §3), U5 (the shelf, part 2: questions —
the notes); §4 timing and §6 the fragile places. `REVIEW-1.md` (Codex on the plan: the
join shelf's history cases; a real-iPhone gate for the tap change). The repo CLAUDE.md
(the zoom's keyboard route, the touch-ghost trap `touchAt`, WebKit's -webkit-user-select,
the 44px floor, the motion law, storage getters, receivers). Take only what U0 and U2 the
tap change actually needs — say what you skipped and why.

## Where and how

Worktree `/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/shelves`,
branch `live/tap` (off `live/list`, which is itself being built — merge `origin/live/list`
in when the coordinator says it moved; never rebase). Others build in parallel: the List
view + menu bar (`live/list`), Our plan (`live/plan`, a sibling session). Keep your edits
to card-facts.js / the card's press wiring / the notes sheet; keep shared-file edits small.
Design first: render frames of the phone shelf (member, guest, a card with doors out, a
long thread, the composer with the keyboard up) at 390/320 and the desktop path at 1280
with a rig like `claude-plans/2026-09-25-portola-live/design/folsom-by-time/rig.mjs`; send
the frame paths to the coordinator before building past the shelf's look. Bank as you go
(`TAP-BUILD.md` beside this brief first; commit + push after each step; scan for crew
tokens with &&). Don't stamp, don't open a PR. Gate: `npm test` in three clocks, the
browser suite (Chromium + WebKit — make WebKit real in CI as U0 says), a real-input walk
of every tap path including the WebKit touch-ghost cases. Report SHAs, tests, frames and
product calls.
