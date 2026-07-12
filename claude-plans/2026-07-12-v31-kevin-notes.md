# Kevin's feedback pass — v3.1 build notes (2026-07-12)

**Status:** received 2026-07-12 morning, post-compaction. This is the next arc
on `v31-polish`. Kevin: "These are not an end point they're just what I'm
finding. I'm sure there are others. Use these as threads to augment your
personal sweep review and improvements."

Also asked this session: (a) a clear-eyed sweep — "Is code clearly organized,
clear, elegant, and bulletproof in the wack low-signal messy multi-user
situations we'll find ourselves in?" (b) staging env at
`stage.fest.kevinhg.com`, (c) a visual explainer of how memory/sync works.

## The notes, verbatim + read

**1. Stage names should be sticky headers.**
Read: scrolling vertically through a day, the stage-name row pins below the
sticky controls bar so you always know which column is which.

**1.1 Sticky header should match the sticky footer (dock).**
"The sticky footer has all the right info — have the controls sticky header
match (current one is missing the sync dot and name of fest, and 'you' is
less good than the circle with name. unify those components."
Read: one shared identity/status component vocabulary — avatar circle, fest
name, sync dot — used by both dock and sticky header.

**1.2 Horizontal scroll should be shared across all days; stages must never
misalign between days.**
Read: one canonical stage-column layout for the whole festival (union of
stages across days, one order, one set of widths), every day rendered on that
same grid, `scrollLeft` mirrored across day sections. A stage absent on some
day renders as an empty column — that's the graceful edge-case handling.
Side effect: per-day scroll harvest simplifies to one value.

**2. Back button should go back to the page I was just on.**
Read: investigate what's NOT in history today (likely day-tab switches and
wall↔settings screen changes — router only tracks layers/sheets). Decide
semantics, implement, regression-test alongside the existing router tests.

**3. Stacked (time-overlapping) shows must fit inside their stage column.**
Screenshot: "Black Party" card bleeding out of The Grove's column into
Tito's. Fix: overlap layout splits WITHIN the column (side-by-side shares of
the column width), never overflows it.

**4. Don't cut off names.**
Same screenshots: "Silly Goose" clipped at the timetable's top edge;
"The Dropt…" ellipsized when narrowed by stacking. Fix top-edge clipping
(grid should start with breathing room above the earliest set) and prefer
2-line wrap over mid-name ellipsis on narrow cards.

**5. Add a crew member from the wall header, plus a back-looking button from
the heading to the festival list ("like we had before"). Same add-person in
crew settings.**
Use case: shared phone — one person tracking for everyone; not everyone
joins via invite link. Mechanically: create member (name + color) directly in
the crew doc, then the existing identity switcher covers flipping between
members on one device.

**6. Festival-level notes** — info found while pulling in festival data that
doesn't fit the grid ("more a project callout, idk if there's stuff we should
pre-fill"). Data layer already supports scope `fest` in `recordNote()` —
check how much UI exists and surface it properly. No pre-fill for now.

**7. Spotify connect should work like recordOS:** (a) friends request access
through Kevin's Spotify app (dev-mode allowlist, max ~25), (b) already-authed
folks just log in, (c) BYO client ID only for people who fork the public
repo — an edge case, demoted to an advanced path. Key mechanics: client ID is
public by design under PKCE, so the crew app's client ID can ship as the
default — friends should never need to know a code. "Request access" =
capture the joiner's email/ask for Kevin, since Spotify dev-mode allowlists
are dashboard-managed only (no API). Reference: recordOS's flow (workflow
agent reading it).

**8. Past fests button** — too subtle in settings, too prominent on the
landing page. Rebalance both.

## Session question answered

Kevin asked whether to run this fresh or post-compaction. Answer given: here —
state is banked, heavy analysis fans out to fresh-context agents, and the
notes + screenshots live in this thread.

## Constraints in force (unchanged)

Preview-only; promote is Kevin's call. Public repo: tokens never in committed
files, scans gate commits (`&&`), explicit `git add <paths>`. Never write to
real crews. Grounding doc still rules:
`claude-plans/2026-07-11-v31-fix-phase-grounding.md`.
