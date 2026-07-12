# Taste rubric — "does this surface feel finished?"

**Created:** 2026-07-12 · **Status:** draft for Kevin's nod · **Job:** the
judgment calls the design atlas doesn't encode. The finish pass closes every
screen (× 390 and 1440) against ALL eight, and a closed surface only reopens
on new signal. Sources: the v3 atlas, Kevin's accumulated review feedback
(2026-07-11/12), the frontend-design writing principles.

## 1. Alignment & rhythm
Content centers in its container unless there's a stated reason; siblings
share edges (the stage strip's columns ARE the day grids' columns); nothing
clips, bleeds, or ghosts through translucent chrome; spacing comes off the
token scale, not improvised pixels. Tall containers with sparse content are
fine only when the height carries meaning (a 2-hour set's card).

## 2. One component, one job, everywhere
The same concept renders identically on every surface — folds, avatars,
chips, fest-links, sheet chrome, back buttons. A second variant of an
existing component is a defect unless the atlas names it. (Past-fests was
this bug; disclosureFold is the fix pattern.)

## 3. Weight follows importance
Prominence tracks what the user needs NOW: current fest loud, past fests
quiet, escape hatches ("Later") smaller than primary actions. The fest
accent appears ONLY on: fest name, active day tab, stage headers,
current-fest border — anything else stealing accent is a defect.

## 4. Copy voice
Vocabulary is exactly picked / must / notes / fest. Controls say what they
do and keep their name through the flow. Errors say what happened and what
to do next — never apologize, never blame the user's connection for a
server fault. Indeterminate waits get stage-lights copy + the eq loader;
determinate waits show the real number. Concrete beats clever; "already
happened — this wall is the memory" is the tone target.

## 5. Every state exists
Each surface has a considered empty, loading, error, offline, and
spectator (unclaimed-device) state. No dead ends: every state offers
exactly one obvious action.

## 6. Motion is earned
Animation only where it communicates: sync states, the eq loader, aura
shifts. Reduced-motion kills all of it. Nothing bounces for decoration.

## 7. Touch + keyboard floor
44px touch targets (hit-area expansion, not layout moves), visible focus
everywhere, sheets trap and restore focus, every hover-only affordance has
a touch path. The wall works one-thumbed on a phone in a crowd.

## 8. Nothing lies
Counts are real, the sync dot has one source of truth, times are honest
(display floors may pad a card's height, never reorder or relabel), and no
string promises what the code doesn't do.

---

**How it's used:** the finish pass walks each surface (landing, create ×2,
join, wall timetable, wall lineup, search, notes sheets, settings + five
drills, share/add sheets, lost states, standalone pages) at both widths,
scores each rubric line pass/fix, fixes everything, then marks the surface
CLOSED with a screenshot pair. Kevin's final walk is against all-closed
surfaces — anything he finds is new signal, not unchecked territory.
