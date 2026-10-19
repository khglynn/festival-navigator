# Zoom code — simplification review (2026-09-01)

**Question (Kevin):** after three days of real-input fixes, is `js/v3/card-facts.js` duct tape, and is there room to simplify that keeps us confident it will keep working?

**Who looked:** a Workflow of 11 Opus agents (three lenses — consolidation, structure, test coverage — with an Opus skeptic per proposal who applied the change to a scratch copy and RAN the suite) plus an independent Codex read-only review. Main session synthesised. No files were edited by the review.

**Verdict, converged:** dense but sound — not duct tape. Every dated why-comment maps to a distinct failure; the invariants are coherent (one overlay, one source, no wall reflow, full recovery after a throw). Room to simplify is ~20 lines of tidying. The real confidence lever is TESTS: 40 robustness layers, 10 fully pinned, 11 partially, 19 not at all — and only two of the nineteen are beyond Node. The gap is a writing gap, not a tooling limit.


## Simplifications that survived the skeptic (do these, tests first)

### Fold the two-node Tab handoff into ONE delegated keydown — and delete the `unwireSource` lifecycle  *(lens: consolidate · confidence medium · saves ~9 lines · skeptic risk low)*

**Lines:** 287 (the `z` shape comment), 408, 502, 505, 809–818, 827–837

**Change:**

The Tab route is currently split across two listeners on two different nodes plus a re-wiring dance. `wireSource(z, el)` (827–837) puts a keydown on the RESTING card (Tab → focus the notes chip); `card.addEventListener('keydown', …)` (811–818) puts one on the OVERLAY (Tab from the chip → move on and close, Shift+Tab → back to the card). Because the first is bound to a node that `refreshZoomInner` swaps out, the module carries a whole lifecycle to keep it current: an `unwireSource` field on `z` (408), its initialization to a no-op, `z.unwireSource()` + `wireSource(z, fresh)` in the refresh (502, 505), the wire+cleanup pair in `wireSlot` (809–810), and a mention in the `zoomed` shape comment (287).

Replace all of it with one document-level handler inside `wireSlot`, which reads `z.el` at event time — the shape the file's own rule at 680–682 already asks for ("Always `z.el`, never a captured node"):

```js
  // Keyboard: Tab from the zoomed card reaches the notes chip inside the
  // overlay (the door to a FIRST note needs no pointer); Tab again continues
  // after the card, Shift+Tab returns to it. ONE delegated handler that reads
  // z.el and re-queries the chip on every press, so a refreshZoom may rebuild
  // either side underneath it (it used to be two listeners on two nodes, and
  // the resting one had to be re-wired on every pick).
  const onTabKey = (e) => {
    if (e.key !== 'Tab' || zoomed !== z) return;
    const chip = card.querySelector('button.f-chip.notes');
    if (!chip) return;
    if (e.target === z.el && !e.shiftKey) { e.preventDefault(); chip.focus(); return; }
    if (e.target !== chip) return;
    e.preventDefault();
    if (e.shiftKey) { z.el.focus(); return; }
    const next = nextFocusableAfter(z.el);
    unzoom({ why: 'Tab moved on' });
    if (next) next.focus();
  };
  document.addEventListener('keydown', onTabKey, true);
  z.cleanup.push(() => document.removeEventListener('keydown', onTabKey, true));
```

Then delete `wireSource` entirely, drop `unwireSource` from the `z` literal (408) and from the comment at 287, and delete lines 502 and 505 from `refreshZoomInner`. `nextFocusableAfter` stays exactly as it is.

**Why it is safe:** Preserves every dated case in this area. The reason `wireSource` exists at all is that its node is replaced by a pick (`refreshCard` → `el.replaceWith(fresh)`); reading `z.el` at event time is strictly stronger than re-binding after the fact, and it is the same fix the module already applied to the click, leave, belt and follow handlers. The chip is re-queried per keypress, so the refresh's `z.card.replaceChildren(...)` (516) cannot orphan it — the current overlay handler already relies on that and keeps it. The `zoomed !== z` guard is unchanged, so a stale zoom does nothing. Cleanup is on `z.cleanup`, which `unzoomInner` (600) and `zoomBail` (659) both drain, so the airbag still sweeps it. Capture phase is deliberate: the only other Tab handler in the app is `notes.js:683`, scoped to a sheet element, and a sheet and a zoom cannot coexist (`app.js:55` unzooms before opening one) — so nothing else acts on Tab and the ordering change is inert.

Honest gap: **no test covers the Tab handoff today** — I grepped `tests/` and there is not one keydown-Tab assertion against card-facts.js. So nothing would catch a regression, which is a reason to do this pass, not a reason to skip it. The pass should add two jsdom cases to `tests/zoom-overlay.test.mjs` first (both are cheap — no `Element.animate` needed): (a) focus the resting card, zoom it, dispatch `keydown{key:'Tab'}` on the card, assert `document.activeElement` is `#zoom-layer button.f-chip.notes` and `defaultPrevented`; (b) dispatch `keydown{key:'Tab', shiftKey:true}` on the chip, assert focus returns to the card and the zoom still stands; then plain Tab on the chip, assert `zoomedCard()` is null. Write them against the CURRENT code, watch them pass, then refactor. A real-browser Tab walk (the CLAUDE.md rule for anything focus-shaped) confirms it after.

**Skeptic:** I built the patched version and ran it rather than reasoning alone (scratchpad trees `base` and `patched`, proposal applied verbatim). All 14 tests in tests/zoom-overlay.test.mjs pass identically on both. I added the five Tab probes the suite lacks — card→chip handoff, Shift+Tab back, Tab-moves-on-and-closes, Tab after a pick swapped the resting node via refreshZoom, and Tab on the stale replaced node — plus a listener-leak probe: byte-identical outcomes on both trees, zero leaked document keydown listeners over 20 zoom/pick/unzoom cycles and across a zoom-replaces-zoom.

I verified the load-bearing premise independently instead of trusting it. Every key handler in the app: notes.js:683 (Tab, bubble phase, scoped to the sheet), wall.js:76 (Enter/Space only, and it already guards e.target !== el), sort-control.js:97 (arrows/Escape/type-ahead), five Enter-only inputs in settings.js/app.js, and two document-capture handlers (app.js:97, gallery.html:511) that are Escape-only AND registered at module load, so they run before a per-zoom handler regardless. Nothing else claims Tab. A sheet cannot coexist with a zoom: app.js:55 unzooms before the artist sheet, and for the day/fest sheets the pointerdown-capture dismiss (app.js:92) and wireCardFocusZoom's focusout both close it first. The capture-phase ordering change is therefore genuinely inert. No shadow DOM exists in the repo, so e.target is not retargeted.

Each dated case lives in a handler the patch does not touch: trackpad micro-scroll (follow/onScroll), overlay born under a moved-away pointer (elementFromPoint + the onMove belt), overlay click blurring the focused card (the mousedown preventDefault), hold-lift synthetic click (the touch arming block), skimming ghosts (exitingSlots), Safari stale :hover (lastMouse, never :hover), exception mid-animation (zoomBail drains z.cleanup, which the new handler correctly joins — the airbag test passes on the patched tree).

Semantic equivalence checks I chased and cleared: the resting card's own note chip is `button.chip-notes`, not `button.f-chip.notes`, so the identity check `e.target !== chip` cannot collide with it; when onOpenNotes is null the chip is a span and both shapes go inert identically; the `if (!chip) return` gate matches wireSource's existing gate; z.el and wireSource's captured `el` never diverge because refreshZoomInner rewires in the same breath it reassigns.

Two honest caveats. (1) My evidence is synthetic dispatchEvent, the exact evidence class CLAUDE.md distrusts — the real-browser Tab walk the proposal already schedules is load-bearing, not a formality. (2) A pre-existing wart the walk should look at, unchanged by the patch: nextFocusableAfter(z.el) lands on the resting card's own button.chip-notes, which is opacity:0 while .zoom-source is on (assets/v3.css:786) — invisible in jsdom because its offsetParent is always null.

One forward-looking cost worth a line in the code comment: the Tab interception now happens before anything else in the app can see the key, so a future global keyboard layer would silently lose Tab to the zoom. Today nothing wants it.

Net: the proposal is correct, it removes real duplication, and it correctly names the untested gap. Do it tests-first as written, run node scripts/sw-stamp.mjs, then walk it in a real browser.

**Would break:** None found among the dated cases. One test goes red mechanically: tests/app-shell-complete.test.mjs — card-facts.js is in the service worker's APP_CORE (service-worker.js:44), so `node scripts/sw-stamp.mjs` must run with the change. Verified: green on an unpatched copy, red on the patched copy, identical file set.

### One `pointerUnder()` for both "where is the mouse really" probes  *(lens: consolidate · confidence medium · saves ~3 lines · skeptic risk low)*

**Lines:** 294–298 (add below), 421–434, 866–873

**Change:**

Two places ask the browser the same question the same way — `zoomCardInner`'s instant-restore check (427–433) and `wireCardZoom`'s one-frame-late re-arm (869–873): take `lastMouse`, guard `typeof document.elementFromPoint === 'function'`, and hit-test. Both carry a version of the same warning comment. Put the rule in one place, next to the `lastMouse` listener it depends on:

```js
// What is under the pointer, asked of the BROWSER — never `:hover`, which
// Safari leaves stale after a DOM swap and which grew cards the pointer was
// nowhere near. null when we cannot know (no movement yet, no elementFromPoint).
function pointerUnder() {
  if (!lastMouse || typeof document.elementFromPoint !== 'function') return null;
  return document.elementFromPoint(lastMouse.x, lastMouse.y) || null;
}
```

Then the two sites read as their intent: `const under = pointerUnder(); if (under && !slot.contains(under) && !z.el.contains(under)) unzoom({ instant: true, why: 'restored under a moved-away mouse' });` and `const under = pointerUnder(); if (under && el.contains(under)) arm();`. Both keep their `requestAnimationFrame` wrapper and their own guard (`zoomed !== z` / `el.isConnected`) — those are not shared and should not be folded in.

**Why it is safe:** Pure extraction: same `lastMouse`, same guard, same call, same null-means-do-nothing semantics at both sites (neither acts when the answer is unknown). It preserves both dated cases as-is — the Codex gate of 2026-08-31 (an instant restore landing after the hand moved on, with a still hand sending no pointermove for the belt to hear) and Kevin's 2026-08-31 'then it's stuck' (a card born under a resting pointer never hears pointerenter). It also protects the rule that actually matters: 'never `:hover`, always elementFromPoint on the last known position' now lives in one commented function, so a third probe added later inherits it instead of re-deriving it and reaching for `:hover`.

Caught by: `tests/zoom-overlay.test.mjs:351` ('a card rendered under a resting pointer arms its hover intent one frame after insertion') feeds the module a real `pointermove` to set `lastMouse`, stubs `document.elementFromPoint`, and asserts the card grows with no `pointerenter` — it fails immediately if the helper stops reading `lastMouse` or stops calling `elementFromPoint`. The other site (the instant-restore close) has no test; the pass should add one — zoom with `{ instant: true, source: 'mouse' }` while `elementFromPoint` answers `document.body`, and assert the slot is gone after a frame.

**Skeptic:** Could not refute it — and I tried empirically, not just by reading. I rsync'd the repo into the scratchpad (real repo untouched, git status clean), applied the extraction verbatim, and ran the suites. Baseline rig: 317 tests / 316 pass / 0 fail. Patched: identical except tests/app-shell-complete (the SW asset stamp), which is expected since card-facts.js is an APP_CORE file. Every behavioural test passes.

It really is a pure extraction. Diffing the two sites by hand, the shared portion is exactly `lastMouse && typeof EFP === 'function'` + `EFP(lastMouse.x, lastMouse.y)` + the `under &&` truthiness — nothing else. The per-site parts the proposal leaves in place (`instant && source === 'mouse'` / `zoomed !== z` at site A; `el.isConnected` at site B) are the only differences, and they stay.

Walked all seven dated cases. Five cannot be reached by this change at all: the trackpad micro-scroll lives in `follow` (scroll/resize, no pointer probe); the overlay-click-blur fix is the `mousedown` preventDefault in wireSlot; the hold-lift synthetic click is the touch arm branch (and site A is gated `source === 'mouse'`, so touch never enters it); the skimming ghosts are the exitingSlots sweep at the top of zoomCardInner; the airbag wraps the three entry points, and both probes already run inside rAF callbacks — i.e. outside those try/catches — before and after. Safari's stale `:hover` is preserved verbatim: the helper still asks elementFromPoint at the last known position. And the helper calls `document.elementFromPoint(...)` with `document` as the receiver, so it does not trip the WebIDL "Illegal invocation" rule in CLAUDE.md.

Mutation-checked the coverage claim instead of trusting it. Forcing `pointerUnder()` to return null fails exactly one test — zoom-overlay.test.mjs:351 — so that test really does pin the helper. And deleting site A outright leaves all 14 tests green, which proves the reviewer's other claim too: the 2026-08-31 Codex gate is protected by a comment and nothing else today. jsdom 29.1.1 has no elementFromPoint at all (typeof is 'undefined'), which is why that path is unreachable in Node.

One real semantic delta, and it runs in the safe direction. Today site A gates on lastMouse at zoom time but reads lastMouse.x a frame later — a mixed-time read. Merged, it gates and reads at the same instant, so a pointermove landing in that one-frame window now decides the probe. Worst case is an instant close where the belt would have done a 260ms grace close: same intent, sooner. lastMouse is never reset to null, so there is no new deref hazard.

Conditions on the pass, both measured, not guessed. (1) The proposed new test for site A, written the obvious way, turns FOUR other tests red — unzoom/snapshot, the orphaned-mouse-zoom, overlay-never-steals-focus, and the airbag — because lastMouse and a stubbed document.elementFromPoint are sticky module/global state and those four zoom with instant:true and the default source:'mouse'. It needs a try/finally restore like the one at line 364. Also requestAnimationFrame is synchronous in that file ((fn) => fn()), so the stub must be installed BEFORE the zoomCard call, not after — my own first draft failed for exactly that reason. (2) node scripts/sw-stamp.mjs is required or CI is red.

One caveat on the claimed benefit, worth writing into the comment. The "a third probe inherits the rule" argument holds for the elementFromPoint-not-:hover half only. The null policy must NOT be inherited: at site B null means "don't grow" (safe), at site A null means "don't close", which is the "then it's stuck" family Kevin reported. A future close-probe inheriting "null = do nothing" would be wrong, so the comment should say the null policy belongs to the caller.

**Would break:** none found

### Name the file's hardest idea — underMouse()  *(lens: structure · confidence high · saves ~1 lines · skeptic risk low)*

**Lines:** 293–298 (helper lands beside lastMouse), 427–433, 869–873

**Change:**

Add `const underMouse = () => (lastMouse && typeof document.elementFromPoint === 'function' ? document.elementFromPoint(lastMouse.x, lastMouse.y) : null);` next to the lastMouse listener, carrying one comment: what the browser says is under the last known mouse position — the only honest answer when the hand is still (no pointermove is coming) and :hover is unreliable after a DOM swap. Then both sites read through it. At 427–433 keep the cheap outer `lastMouse &&` guard so no wasted rAF is scheduled, and inside the frame use `const under = underMouse();`. At 869–873 the guard collapses to `if (!el.isConnected) return; const under = underMouse();`. This is the one concept in the file encoded twice — once to CLOSE a zoom born under a moved-away hand, once to ARM a card rendered under a resting hand — and today a reader has to notice they are the same rule in mirror image.

**Why it is safe:** Identical read at an identical moment: the helper resolves document.elementFromPoint at call time, not module time, so test 13's stub (`document.elementFromPoint = () => card`) still answers it. The 869 site is pinned by 'a card rendered under a resting pointer arms its hover intent one frame after insertion'. The 427 site has no test and cannot accidentally acquire one: jsdom does not implement elementFromPoint, and the module's lastMouse is only ever set by a pointermove whose pointerType is 'mouse' — the one such event in the suite is dispatched by test 13, after the tests that use instant restores — so that branch never executes in Node today. Worth adding alongside: set lastMouse via a pointerType-'mouse' pointermove, stub elementFromPoint to return document.body, zoomCard with `{ instant: true, source: 'mouse' }`, and assert the slot is gone after a frame. Keeping the outer `lastMouse &&` guard is what makes the change exactly neutral rather than merely equivalent-in-outcome.

**Skeptic:** Could not refute it — verified empirically, not just by reading. I copied the repo to a scratchpad, applied the exact proposed diff, and ran the suite: baseline 316 pass/0 fail; patched 315 pass/1 fail, and the single failure is the SW asset-stamp gate that ANY edit to a cached file trips (fixed by `node scripts/sw-stamp.mjs`, on a clean tree). All 14 zoom tests stay green, and none of them stays green while behaviour changes.

TEXTUAL EQUIVALENCE. Site 869 is exactly equivalent for all inputs: `underMouse()` returns null precisely when the old guard returned early (no lastMouse, or no elementFromPoint), and `if (under && el.contains(under))` blocks arming on null. Site 427 has one divergence: the elementFromPoint-existence check moves from zoom time to frame time. Every real browser has elementFromPoint, so real-browser behaviour is identical; in jsdom it means one extra rAF whose body resolves to null and returns. I confirmed jsdom has no elementFromPoint at all (`typeof` → undefined, not on Document.prototype), so the reviewer's inertness claim holds — including in test 14, which DOES satisfy the outer guard (test 13 sets lastMouse permanently) and still passes patched. The live re-read of `lastMouse` inside the frame — load-bearing, since the hand may have moved during that frame — is preserved, because the helper reads the module variable at call time.

THE DATED CASES, WALKED. Trackpad micro-scroll: the `follow`/scroll-anchor path is untouched. Overlay born under a moved-away pointer: same read, same moment, same two-container test at the site. Overlay click blurring the focused card: the mousedown-preventDefault handler is untouched. Hold-lift synthetic click: the touch arming block is untouched. Skimming ghosts: the exitingSlots sweep is untouched. Safari stale :hover: site 869 still asks elementFromPoint, never :hover — the whole point of the primitive survives. Exception mid-animation: zoomBail wraps zoomCard/refreshZoom/unzoom exactly as before, and neither rAF body was ever inside it, pre or post.

CONDITIONS ON MERGE (all cheap, all real):
1. The helper body MUST call `document.elementFromPoint(...)` as a member expression. I built the detached-receiver variant (`const { elementFromPoint: efp } = document; efp(x,y)`) — it is 14/14 GREEN in Node and throws "Illegal invocation" in every real browser, the exact WebIDL-receiver failure CLAUDE.md documents. Worse, that throw lands in wireCardZoom's rAF, which zoomBail does NOT wrap, so site 869 would regress to Kevin's "then it's stuck" silently, with nothing in the crash journal. The test stub (a plain arrow) can never catch this.
2. Keep the outer `lastMouse &&` at 427 as proposed, and keep `lastMouse` first inside the helper — that short-circuit is what stops elementFromPoint (a layout-forcing hit test) from running once per card on every wall repaint on touch devices.
3. Comments must be ADDITIVE. The two sites carry two different dated whys ("restored under a moved-away mouse", Codex gate 2026-08-31; and "then it's stuck"/Safari stale-:hover, 2026-08-31). The helper's one comment names the shared primitive, not either bug. Stripping the site comments as now-redundant is the only real loss available here.
4. Say in the comment that the helper extracts the LOOKUP, not the RULE. 427 asks "outside BOTH the overlay and the resting card" (and the overlay is what elementFromPoint usually hits, being on top); 869 asks "inside this one card". A follow-up that "finishes the job" with a boolean `isUnderMouse(el)` would break 427's two-container test. The "one concept encoded twice" framing is mildly oversold — the duplication is one expression, and that is exactly why the change is safe.

THE COMPANION TEST is worth adding on its own merit, independent of the refactor: I wrote it and it passes on BOTH the current and the refactored code (a regression pin, not a change-detector), closing the last unpinned zoom branch. It must be appended at the END with a try/finally restoring document.elementFromPoint — I demonstrated that placing it earlier without a restore turns the airbag test red, and that hazard is identical on today's code, so it is test hygiene, not a cost of this change.

**Would break:** none found

### One constant for 'which parts animate on a refresh' — it is currently written three times  *(lens: structure · confidence high · saves ~0 lines · skeptic risk low)*

**Lines:** 482–486 (partKey), 489 (snapshotParts), 554 (the refresh loop)

**Change:**

Hoist `const PART_SEL = '.f-name, .f-sub, .f-where, .f-pill, .f-chip.notes, .f-chip.spot';` to module scope beside partKey and use it at both 489 and 554. Add one line of comment binding it to partKey: these two say WHICH parts move on a refresh and partKey says HOW each is matched across the rebuild — add a grown row and you touch both. Right now the same six-class list is spelled out at 489 and 554 and branch-by-branch at 482–486. A next person adding a row to grownBlock (a genre line, a conflict warning) has three places to remember; miss the snapshot selector and that row silently animates as an arrival on every pick, miss the loop selector and it never moves at all — a motion bug with no error and no failing test.

**Why it is safe:** Byte-identical string, two call sites, both inside functions that already run under the same `animate` guard; grep confirms no other occurrence. It is a constant extraction — the safest refactor shape there is — deliberately chosen over anything cleverer, because this animated-refresh block has effectively no Node coverage: jsdom has no Element.animate, so refreshZoomInner returns at `if (!animate) return` before snapshotParts ever runs, and the one test that stubs animate ('the bloom keeps its laws') stubs it around zoomCard, never around refreshZoom. So no test would catch a logic change here, which is exactly the reason to change nothing but the string's home. 'taps while zoomed cycle 1 → 2 → 3 → 4 → 0 and the pills follow' proves the non-animated refresh path still cycles picks and rebuilds pills.

**Skeptic:** I could not break it. Verified empirically, not by inspection: (1) the two selector strings at card-facts.js:489 and :554 are byte-identical (63 chars each), appear exactly twice in the whole repo, and `PART_SEL` is a free name; (2) applying the exact hoist to a scratchpad copy leaves all 14 zoom tests green; (3) because the proposal is right that no Node test reaches the animated refresh, I wrote the missing coverage myself — a probe stubbing Element.animate and getBoundingClientRect AROUND refreshZoom, driving six picks while zoomed, recording 54 animation calls that exercise all three branches of the loop at 554 (slide / arrival / MUST-badge fade) plus snapshotParts at 489 and the clipPath surface work — and the timelines are byte-identical between baseline and patched. Every dated case lives in code that never reads this selector: trackpad micro-scroll (follow/onScroll, 772-802), overlay born under a moved-away pointer (elementFromPoint rAF, 427-434 and 869-873), overlay-click blur (mousedown preventDefault, 722-726), hold-lift synthetic click (touch arming, 690-712), skimming ghosts (exitingSlots sweep, 397-398), Safari stale :hover (never consulted), exception mid-animation (zoomBail wrappers unchanged; a module-scope string literal cannot throw). No TDZ risk from the wall.js import cycle — neither reader runs during module evaluation, and FOCUSABLE at line 839 is already the identical shape. THREE CORRECTIONS the proposal needs before merging. (a) It is FOUR places, not three: the bloom cascade at 459-464 also enumerates which parts move and uses a DIFFERENT set — `.f-chip` rather than `.f-chip.notes, .f-chip.spot`, and deliberately no `.f-name` (line 449: the name "has no animation of its own — it IS the card and rides the scale"). (b) That undercount is the one hazard the change actually introduces, and it is naming rather than logic: a module-scope constant called PART_SEL sitting near a bloom cascade that animates a different set invites the next person to "fix the inconsistency" at line 464, which would start translating .f-name on every zoom — breaking a documented design law with no red test, since the bloom test only asserts compositor-only keyframes and the WHEN delay. Name it REFRESH_PART_SEL and have the comment state that the bloom's set is deliberately different and is not this constant. (c) The safety argument's mechanism is misstated: snapshotParts is not skipped by `if (!animate) return` at 519 — it is called at 512, seven lines earlier; what skips it is the ternary `animate ? snapshotParts(z.card) : null`. Same conclusion, wrong reason, and a future reader may lean on that sentence. OMITTED COST: card-facts.js is an APP_CORE asset, so this one-liner alone turns tests/app-shell-complete.test.mjs red until `node scripts/sw-stamp.mjs` runs (measured v71 -> v72, stamp d8990cf6 -> 815931a7; full suite 317 tests, 0 fail after stamping). CI catches it, so that is a schedule risk, not an app risk.

**Would break:** none found — every dated case (trackpad micro-scroll, overlay born under a moved-away pointer, overlay click blurring the focused card, hold-lift synthetic click, skimming ghosts, Safari stale :hover, exception mid-animation) runs in code that never reads this selector, and the animated refresh timeline I recorded on the uncovered path is byte-identical before and after. The nearest miss is a FUTURE one the change makes easier, not one it causes: a constant named PART_SEL tempts the next person to apply it at the bloom cascade (lines 459-464), whose set is deliberately different — that would animate .f-name against the stated law with the bloom test ('the bloom keeps its laws') staying green, since it only checks compositor-only keyframes and the WHEN delay.


## Refuted — do NOT do these (and why)

### One `guard()` for the three airbag wrappers  *(lens: consolidate · skeptic risk medium)*

**Lines:** 669–677

**Proposed:** The three exports are the same four tokens copy-pasted with a different journal key:

```js
const guard = (where, fn, args) => {
  try { return fn(...args); } catch (e) { zoomBail(where, e); return null; }
};
export function zoomCard(...args) { return guard('grow', zoomCardInner, args); }
export function refreshZoom(...args) { return guard('refresh', refreshZoomInner, args); }
export function unzoom(...args) { return guard('shrink', unzoomInner, args); }
```

Keep them as `function` declarations, not `const` arrows — this file has a documented runtime import cycle with wall.js (lines 9–10), and hoisting is what makes a cycle forgiving. That is the only detail worth being careful about here.

**Refuted because:** Refuted on the rationale and on the snippet as written — not on the dated bugs, which I want to be straight about.

What checks out: I traced every return of the three exports (app.js:55, 93, 142, 379, 386, 1781; gallery.html:470, 502, 509, 512; internal card-facts.js:331, 392, 431, 733, 749, 764, 784, 790, 816, 823, 906; tests 62, 77). Only `zoomCard`'s return is ever read (`facts` in tests, and it already returns null on throw). So `undefined`→`null` really is inert. And none of the seven dated cases lives in the wrappers: the trackpad micro-scroll fix is in `follow()`; the moved-away pointer is the rAF probe at :427; the blur-before-click is the mousedown preventDefault at :722; the hold-lift arming is :690–712; the ghost sweep is :397; Safari's stale :hover is the elementFromPoint choice at :869. The wrapper shape touches none of them. `guard` also calls a module-local declaration, not a DOM method, so it does not trip the project's WebIDL-receiver rule.

What refutes it:

1. The stated value is false. "The next entry point gets the airbag by construction" — no. A new export still has to be hand-written as `export function foo(...a){ return guard('foo', fooInner, a); }`. That is the same act of remembering as a try/catch, plus a naming convention (`Inner`) and a journal-key argument. Nothing is enforced by construction; the shape that would enforce it (wrap at the export boundary, or iterate a map) is exactly what the proposal rules out to keep hoisted declarations. Strip the false claim and what remains is five lines and one indirection in the file's most safety-critical seam.

2. The one detail it says to be careful about, it gets wrong in its own code. `const guard = …` is a TDZ binding. The three hoisted exports then depend on a value that does not exist until the module body reaches line 669, so they are hollow declarations: called earlier, they throw ReferenceError — and that throw happens while evaluating the call expression, *outside* the try, where `zoomBail` cannot see it. Today `zoomCardInner`/`unzoomInner` are themselves hoisted declarations and `record` is an import binding, so an early call works. In a module the header (:9–10) documents as being in a runtime cycle with wall.js (:16), with two independent entry graphs (app.js and gallery.html:372), the change strictly narrows when these functions are callable, in exchange for nothing. `function guard(…)` fixes it — which is the tell that the proposal did not think the hoisting point through.

3. The suite cannot referee this. No test calls an export during module evaluation, and zoom-overlay.test.mjs imports wall.js (:31) before card-facts (:32), so the safe order is the only one exercised. The airbag test at :383 passes identically under both shapes. Green would be evidence of nothing — the classic stay-green-while-the-hazard-lands case.

4. The bolted-on test suggestion is wrong as written. "Stub `Element.prototype.animate` to throw, then tap a zoomed card" cannot produce a zoomed card: with the stub installed, `zoomCard` throws first, records `zoom:grow`, sweeps the stage, and the tap has nothing to refresh — `last.kind` is `zoom:grow` and the new test goes red. It only works if you zoom with `instant: true` first (which short-circuits past `canAnimate`), then install the stub, then click. Worth having, but it is not the drive-by the note implies.

5. Cost side: any edit here needs `node scripts/sw-stamp.mjs` and a production promote to reach the phones — shipping a cosmetic churn through the deploy gate into a seam Kevin just confirmed works.

If he wants real simplification with a payoff, the honest target is the opposite direction: `place()` and `rect()` inside the scroll `follow()` rAF and the `wireCardZoom` elementFromPoint probe (:869) are *not* airbagged, and those are the exact shapes the Safari stranding came from. Extending coverage there buys something; renaming four tokens does not.

**Would break:** No dated case breaks. What breaks is the airbag's own guarantee: `const guard` puts a TDZ binding under three hoisted exports in a module documented to be in a runtime import cycle (card-facts.js:9–10 ↔ wall.js:16), and the resulting ReferenceError is thrown outside the try, so `zoomBail` never sees it. tests/zoom-overlay.test.mjs:383 stays green under both shapes — it imports wall.js first (:31) and never calls an export during module evaluation — so the suite cannot catch it. Secondary: the proposed `zoom:refresh` test cannot be written as described (a card cannot be zoomed while `animate` throws).

### One grace timer with named start/stop, shared by the boundary events and the belt — keeping BOTH  *(lens: consolidate · skeptic risk medium)*

**Lines:** 741–765

**Proposed:** `pointerenter` (742), `pointerleave` (745) and the document `pointermove` belt (758) all drive the same `outT` with the same `ZOOM_OUT_MS` and the same `zoomed === z` re-check, written out three times. Name the two outcomes once and let all three call them:

```js
  let outT = null;
  const hold = () => { if (outT) { clearTimeout(outT); outT = null; } };
  const leaving = (why) => {
    if (zoomed !== z || z.source !== 'mouse' || outT) return;
    outT = setTimeout(() => { outT = null; if (zoomed === z) unzoom({ why }); }, ZOOM_OUT_MS);
  };
  card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold(); });
  card.addEventListener('pointerleave', (e) => {
    if (e.p

**Refuted because:** Refuted on the proof, not on a dated bug — and the distinction matters, so both directions:

WHAT IS ACTUALLY TRUE IN THE PROPOSAL. None of the seven dated defences is touched by this diff. The trackpad micro-scroll rule (the `follow`/`place` block, 780–802), the overlay-born-under-a-moved-away-pointer rAF `elementFromPoint` probe (427–433) and its twin in `wireCardZoom` (869–873), the mousedown-preventDefault that stops the overlay blurring the focused card (722–726), the hold-lift arm-after-the-synthetic-click block (690–712), the `exitingSlots` ghost sweep (397–398), the `zoomBail` airbag (654–668), and the never-trust-`:hover` Safari rule are all outside 741–765. The pointerType gating, the `z.el.contains(relatedTarget)` exemption, the `z.source !== 'mouse'` gate and the `zoomed === z` re-check are all preserved as claimed. Moving `zoomed !== z || z.source !== 'mouse'` out of `onMove`'s head into `leaving()` is genuinely safe: `outT` is only ever armed on lines 749/764, both of which already require `z.source === 'mouse'`, and `z.source` is fixed at construction (`refreshZoomInner` mutates `z.el`/`z.ctx`, never `source`), so `hold()` on a touch or keyboard zoom is the no-op the author says it is. And no test goes red — 301 passes either way.

WHY IT STILL FAILS THE BAR. The safety argument rests on a premise that is false as written: "`outT` can only be pending after a leave." Line 764 arms `outT` from the belt. So the sequence the proof must rule out is not leave→leave (which the enter/inside-move really does interrupt) but BELT-ARM → pointerleave. In that sequence today's code restarts the grace from the leave; the merged `leaving()` swallows it and closes on the belt's older clock. I spent real effort trying to build that sequence in a single-pointer browser and could not — every route back inside `card` that would let a `pointerleave` fire also fires `pointerenter` or an inside `pointermove` first, in Chrome and in Safari. So I am reporting it as an unproven hole, not a live break. But the file's entire history is sessions that reasoned "that can't happen" about pointer bookkeeping and were wrong on Kevin's machine (Safari's stale hover chains, the born-under-the-pointer card, the lift's synthetic click). A merge justified by an argument with a hole in it is exactly the shape that keeps costing this file rounds.

THE DEEPER POINT: THESE TWO CALL SITES ARE NOT DUPLICATES. The restart rule is where they deliberately differ, and both directions are correct for their own signal. The belt must not restart or a mouse that keeps moving re-arms forever and never closes (the proposal spots this). The leave restarts because a boundary crossing is a fresh, higher-confidence "the person left" than the belt's positional guess, and it deserves the full 260 ms from the moment it fired. Any unification must throw one of the two rules away — so this is not a refactor with the same behaviour, it is a behaviour decision wearing a refactor's clothes. The consolidation also buys less than it looks: the two paths already share one `outT`, so nothing about the shared state is being tamed; ~6 duplicated lines become ~10 (two named closures plus three handlers), and the comment block grows.

ONE OBSERVABLE CHANGE, INVISIBLE TO THE SUITE. Where a pointermove-outside is delivered before the `pointerleave` (engine- and ordering-dependent), today the leave's restart overwrites the pending timer and the close records `why: 'pointer left the overlay'`; under the merge the belt's earlier arm survives and it records `'mouse moved outside (belt)'`. That string is the payload of `record('zoom-close-after-click', why)` (line 583) — the instrument added ONE DAY AGO, 2026-08-31, because Kevin's "every click closes the hover" journaled itself as nothing and one of these legitimate close paths is still firing wrongly on his machine. Re-labelling closes while that investigation is open is a small cost with an outsized downside: it is precisely the evidence that would identify the culprit. `tests/zoom-overlay.test.mjs:301` cannot see any of this — it dispatches raw MouseEvents with no boundary events at all, so it stays green through the change. That is the "green while behaviour changed" hazard the review was asked to watch for, in the one place the reviewer already admits has no test.

WHAT I WOULD SAY TO KEVIN. Not merged. If the itch is naming, take the zero-behaviour half: hoist `hold()` alone (the clear-and-null, which is identical at all three sites) and leave the two arms spelled out with a one-line comment on why the leave restarts and the belt does not — that removes the only true duplicate and makes the asymmetry documented instead of accidental. And take the reviewer's test suggestion regardless of the refactor: the enter/leave pair having no coverage is a real gap worth closing on its own.

**Would break:** None found — no dated case reopens, and no test in tests/zoom-overlay.test.mjs goes red. The unproven divergence is the belt-arm → pointerleave sequence (js/v3/card-facts.js:764 arms outT, contradicting the proposal's "outT can only be pending after a leave"), where the merged no-restart leaving() closes on the belt's older clock instead of restarting the 260 ms grace. tests/zoom-overlay.test.mjs:301 passes either way — it dispatches bare MouseEvents and fires no boundary events, so the suite cannot see the change. Collateral: the why string recorded by the one-day-old zoom-close-after-click journal (card-facts.js:583) flips from 'pointer left the overlay' to 'mouse moved outside (belt)' in orderings where the outside pointermove precedes the leave.

### Split wireSlot into five named sub-wirings — pure code motion, no logic touched  *(lens: structure · skeptic risk medium)*

**Lines:** 683–825 (wireSlot body); the call site at 419 is unchanged

**Proposed:** Reduce wireSlot to a five-line table of contents: `if (z.source === 'touch') armAfterHold(z); wirePressAndPick(z); wireHoverClose(z); wireFollow(z); wireKeyboardHandoff(z);` — each sub-wiring a module-private function taking `z`, in that exact order. armAfterHold takes 690–712 (the deaf overlay + arm-after-lift-click + its clearTimeout cleanup). wirePressAndPick takes 722–735 (the mousedown focus-preserver that writes lastOverlayPress, and the click-is-a-pick handler). wireHoverClose takes 742–770 — critically, ALL THREE readers of `outT` (pointerenter, pointerleave, the document pointermove belt) plus their shared cleanup, so `outT` becomes visibly local to the four things that touch it. wi

**Refuted because:** The destination is sound; the SPEC is not, and two of the three ways to fumble it are invisible to the suite.

WHAT SURVIVES SCRUTINY. The state graph is read correctly: `outT` is touched by exactly four things and they all land in one sub-wiring; `slot`/`card` really are stable across a pick (refreshZoom line 516 keeps `z.card` and replaces only its children), so re-destructuring them is safe; the node+type claim holds (card gets mousedown/click/pointerenter/pointerleave/keydown/focusout, one apiece), so registration order is genuinely irrelevant. All seven dated cases live wholly inside one block each, and the two that scared me most — skimming ghosts (exitingSlots) and the exception-mid-animation airbag — aren't in wireSlot at all. Perfectly executed, this is behaviour-preserving. I could not break it on correctness.

THE SPEC DEFECT (demonstrated). wireHoverClose is specified as 742-770. `let outT = null;` is line 741. I applied the range literally: the zoom still GROWS fine — wiring succeeds because the closures aren't evaluated — and 12/14 tests pass. The ReferenceError fires on the first pointer movement, inside a passive capture-phase document listener that zoomBail does NOT cover (the airbag only wraps zoomCard/refreshZoom/unzoom). In a browser that is Kevin's 2026-08-31 "after click, it doesn't un-hover" resurrected: the overlay stands forever and every mousemove throws. The suite does catch it (2 red), so it's survivable — but the range was clearly written off a line skim rather than the dataflow, which is exactly the wrong provenance for the parts that AREN'T caught.

THE TWO GREEN-PASSING TRAPS. (1) I applied the reviewer's own named trap — `z.cleanup.push(() => unwire())` instead of `() => z.unwireSource()`. 14/14 GREEN. What actually breaks: after a pick-while-zoomed, refreshZoom reassigns z.unwireSource, so cleanup unwires the dead node and leaves the keydown listener on the LIVE resting card — one leaked listener per pick, each pinning the whole z graph (slot, card, ctx). Invisible to Node, invisible to a browser walk. Prose is the only guard offered, and the brief's worst outcome is precisely "stays green while behaviour changed."
(2) The instruction "drop `const { slot, card } = z;` and re-declare per sub-wiring" installs a destructure-at-the-top reflex in the one block whose governing rule is never capture `z.el` — and that rule's comment (lines 680-682, "Always `z.el`, never a captured node") stays behind on the five-line dispatcher, a screen from the code it governs. I added `const el = z.el;` to wireKeyboardHandoff: 14/14 GREEN. Browser damage: after a pick, Shift+Tab from the notes chip focuses the detached card, focus falls to body, the overlay's focusout closes the zoom; Tab-moves-on finds nothing (indexOf = -1); tabbing back to the refreshed card reads as "focus left the zoom." All three sit in the quarter the reviewer already admits has zero coverage.

NET GAIN IS ZERO. It removes no duplication (the proposal says so), adds five declarations and five call sites, and grows the file. It is legibility re-arrangement bought with three green-passing hazards.

A WARNING TO PASS ON. The two grace-close timers (749, 764) look like the obvious next dedup and are not — 748 clears-then-sets, 764 sets only if idle. I merged them into one graceClose(why): 14/14 GREEN, and the merged version restarts the 260ms grace on every outside pointermove, so a moving hand never closes the zoom. That is the trackpad-jiggle failure class this file already has scars from, and the orphan test (one pointermove, then wait 320ms) cannot see it.

WHAT I'D DO INSTEAD. Two verbatim duplications are real and safe: the part selector '.f-name, .f-sub, .f-where, .f-pill, .f-chip.notes, .f-chip.spot' appears identically at lines 489 and 554, and `for (const a of z.anims) { try { a.cancel(); } catch {} }` at 499 and 603. Hoist both, leave wireSlot alone. If the split is still wanted: write the three keyboard tests FIRST plus one that pins the late-binding (pick while zoomed, unzoom, assert no live listener on the fresh card), and keep `const { slot, card } = z;` at the top of wireSlot passed into the sub-wirings — never re-destructure, so `el` can never join the list.

**Would break:** Primary, demonstrated: the stated wireHoverClose range 742-770 excludes `let outT = null;` at line 741 — run literally, the zoom grows normally and only the first pointer movement throws ReferenceError inside the passive capture-phase pointermove belt, which the airbag does not wrap. Real-browser result is the 2026-08-31 "after click, it doesn't un-hover" bug returning (12/14 pass; red tests are 'an orphaned mouse zoom closes on the next outside movement' and 'the bloom keeps its laws'). Green-passing, therefore worse: (a) the reviewer's own named trap — early-bound `() => unwire()` in wireKeyboardHandoff leaks a keydown listener onto every live resting card after a pick-while-zoomed, 14/14 green; (b) `const el = z.el;` in wireKeyboardHandoff — the destructure reflex the proposal's own instruction installs — breaks Shift+Tab return, Tab-moves-on, and the overlay focusout after any pick, 14/14 green. Adjacent trap for the next round: merging the pointerleave (clear-then-set) and belt (set-if-idle) grace timers into one graceClose() leaves the zoom permanently open under a moving mouse, 14/14 green.

### Rename the Inner trio to the names the crash journal already prints  *(lens: structure · skeptic risk low)*

**Lines:** 390, 496, 577, 669–677

**Proposed:** zoomCardInner → grow, refreshZoomInner → refresh, unzoomInner → shrink. Leave the three exported wrappers and their bail-label strings exactly as they are ('grow', 'refresh', 'shrink'), so a `zoom:refresh` line in the crash journal now names a function you can grep for by that word. Keep the three try/catch wrappers as three separate three-line functions — do NOT collapse them into a `guarded(label, fn)` higher-order helper. That saves five lines and costs the greppability of three exported function declarations, and it would flip refreshZoom's and unzoom's throw-path return from undefined to null for no reason. The airbag is not ceremony: it is earned by the 2026-08-31 Safari recording (a t

**Refuted because:** Refuted on rationale and cost, NOT on behaviour — be careful how this is relayed. The rename genuinely cannot break the hover: the three names are module-private (six occurrences repo-wide, all in card-facts.js, three of them the wrapper call sites), grow/refresh/shrink appear today only in comments and the label literals so there is no shadowing, and every dated case (trackpad micro-scroll follow, born-under-a-moved-away-pointer rAF + onMove belt, mousedown-preventDefault focus fix, hold-lift arm-after-click, exitingSlots ghost sweep, Safari stale :hover elementFromPoint, the airbag) lives in wireSlot/wireCardZoom or reaches the trio only through the byte-identical exported wrappers. Three reasons to decline anyway. (1) The benefit already exists: `grep -n refresh js/v3/card-facts.js` returns line 673, `try { return refreshZoomInner(...args); } catch (e) { zoomBail('refresh', e); }` — the label and the function name are on the SAME line, so a `zoom:refresh` journal line already greps straight to the function; same for grow (670) and shrink (676). The `Inner` hop is one line long and self-annotating. (2) Omitted cost with a named red test: card-facts.js is APP_CORE, ASSET_STAMP hashes APP_CORE content, so tests/app-shell-complete.test.mjs's stamp test fails on the rename — a 15th test the "full 14-test suite is the net" claim does not see — and clearing it runs scripts/sw-stamp.mjs, bumping CACHE_VERSION v71 to v72 and forcing a full app-shell re-download on every installed phone for a cosmetic change. (3) The claimed safety mechanism is wrong in the direction that matters: "fails to resolve at import time, loudly" is false — these are function declarations called from inside try blocks, so a bad reference is a call-time ReferenceError thrown INSIDE the airbag being defended, caught by zoomBail, filed in a 20-slot journal, and returned as null. The airbag turns a loud typo into a silently dead zoom. The suite does still catch each of the three (test 1 dereferences facts.name; tests 2/3 assert zoomedCard() after the refresh; test 10 asserts the exit animates the slot), but the unzoom net is thin: because zoomBail performs a competent cleanup (slot removed, zoom-source off, state zeroed), a fully broken unzoom still passes tests 5, 11, 12 and 13 — only test 10's animate-stub distinguishes a real exit from a bail. That is the green-while-behaviour-changed shape, and it argues for touching this trio less, not more. Minor and pointing the same way: `grow` collides with the file's dominant prose vocabulary (grown, grownBlock, .f-grown, "grow cards", "grow in a beat later") so a loose grep gets noisier, zoomCard/zoomCardInner pairs at a glance while zoomCard/grow needs a lookup, and `shrink` is a mild lie for the instant path, which removes the slot rather than shrinking it — a fuzzy journal LABEL is cheap, a fuzzy function NAME is what the next reader trusts. Net effect: zero lines, zero branches, zero states removed. It is not a simplification, which is what was asked for.

**Would break:** tests/app-shell-complete.test.mjs — "the service worker stamp matches the cached assets" goes red the moment card-facts.js bytes change (it is APP_CORE line 44 of service-worker.js; ASSET_STAMP d8990cf6 is a sha1 over APP_CORE file content). No dated hover/zoom case breaks — I walked all seven and the rename is inert.


## What each lens said when asked 'and if nothing?'

### consolidate

Yes, there is room — but it is tidying, not surgery: about 21 lines out of a ~630-line zoom section, and the four proposals above are the whole honest list. The reason the list is short is that most of what looks like duplication here is two mechanisms covering two different failures that happen to end in the same outcome, and I am explicitly NOT proposing these:

1. **The document `pointermove` belt (758–766) stays.** It exists because boundary events are structurally unreliable in this app: an overlay can be born with the pointer already elsewhere (a sync-echo repaint restoring a zoom after the hand moved on), and a card that never saw `pointerenter` never hears `pointerleave`. CLAUDE.md's browser-only note is explicit that Node tests are blind to this class. Delete it and Kevin's 2026-08-31 "after click, it doesn't un-hover" comes straight back.

2. **`pointerleave` on the overlay (745–750) stays too, and is not redundant with the belt.** The belt only hears movement inside the window. When the mouse exits the browser window — easy, since the overlay is only clamped left/right and can sit at the viewport's bottom edge — the last pointermove is inside the overlay (which *cancels* the close) and only `pointerleave` fires afterwards. Merging them one way loses the orphan, the other way loses the window-exit. Proposal 3 shares their timer without deleting either.

3. **The touch arm block's three paths (700–705) stay.** The `click`-once, the 350 ms timer and `pointercancel` are three different lifts: one that synthesises a click, one that does not (the finger slid), one that is cancelled. The 350 ms timer would technically cover the cancel case, but at the cost of a grown card that ignores taps for a third of a second after a cancelled gesture — a delight cost in a file whose stated bar is delight.

4. **The two `focusout` handlers (819–824 on the overlay, 901–907 on the resting card) stay separate.** They sit on nodes in different trees and cover complementary exits, and it is tempting to replace both with one document-level `focusout` in `wireSlot`. I am not proposing it: `refreshCard` does `el.replaceWith(fresh)` on a focused card during every pick-while-zoomed, and whether a browser fires `focusout` for a focused node being removed — and whether that event still propagates to `document` once the node is detached — is exactly the kind of engine-dependent behaviour the Node suite cannot see and this file has already been burned by twice. A per-node listener and a document listener would fire differently in that window, and "differently" here means the zoom silently dying on every pick. If it is ever worth doing, it needs a real-browser walk in Chrome AND Safari first, not a green suite.

One thing worth flagging beyond the lens: the parts of this file with the weakest test coverage are the parts I most want to touch. The Tab handoff has **zero** assertions anywhere in `tests/`, and only `zoomCard`'s airbag wrapper is pinned (not `refreshZoom`'s or `unzoom`'s). Each proposal above names the test to add first. If only one thing happens from this review, make it those tests — they are worth more than the 21 lines.

### structure

Two of your framings I want to answer with a plain no, because taking them would cost more than it bought.

THE LIFECYCLE ENUM IS A NO. 'growing' | 'grown' | 'shrinking' would be a state variable that nothing in the file reads. Grep the branches: every guard in every handler asks exactly one question, `zoomed === z` — is this still the live zoom — and the only other stage-state is `exitingSlots`, a set of slots that outlive their `z`. Nothing anywhere branches on growing-vs-grown, and the one place you would expect it to, unzoomInner's mid-bloom exit, deliberately does NOT need it: it reads the live computed transform and opacity off the slot, which is strictly better than a flag because it handles any frame of the bloom, not three named ones. Adding the enum means rewriting ~10 correct guards from `zoomed !== z` into enum checks — real behaviour risk, in the file's most bug-earned code, to represent a distinction the design does not make. The lifecycle you actually have is binary and already legible.

THE FLAT SEQUENCE'S COMMENTS ARE THE ASSET, AND THEY STAY. wireSlot is ~145 lines of which better than half is prose, and every robustness layer names the bug that earned it with a date. That is the most valuable thing in the file — far more than its shape — and proposal 1 is a move precisely so all of it travels intact. If you take only one thing from this review, take that none of these four proposals edits a why-comment.

THE RUNNER-UP I DID NOT PROMOTE: an `onGlobal(target, type, fn, opts)` helper that registers a listener and pushes its own removal onto z.cleanup. It would make structural the rule that today is only implicit — listeners on `card`/`slot` die with the overlay and need no cleanup; listeners on `document`/`window` must be undone by hand, which is why three blocks push cleanup and four correctly do not. I left it off because its neutrality is not test-provable: every handler is guarded by `zoomed !== z`, so a leaked listener is inert and no assertion in the suite would notice a broken removal. Refactoring toward a rule the tests cannot police is the wrong trade in this file. The zero-risk version of the same win is two lines of comment at the top of wireSlot stating the rule out loud — worth doing, not structural enough to rank.

TWO COVERAGE HOLES, FOUND WHILE READING, WORTH FIXING WHETHER OR NOT YOU TAKE ANY REFACTOR: (1) the keyboard handoff — the resting card's Tab→notes-chip, Shift+Tab back, Tab-moves-on-and-unzooms, and the overlay's own focusout — has no test at all; the existing focus test drives wireCardFocusZoom on the resting card, a different listener. (2) The 'restored under a moved-away mouse' close at 427–433 never executes in Node (jsdom has no elementFromPoint, and lastMouse is unset at that point in the run), so the Codex-gate fix from 2026-08-31 is unpinned. Both are cheap to write and both sit under code proposal 1 or 2 would move.


## Coverage — the 40 layers, indexed by their dated why-comments

Forty robustness layers, indexed by the dated why-comments. Ten are fully pinned, eleven partially, nineteen not at all. The honest headline for the simplification question: of the nineteen unpinned layers, only two are fundamentally beyond Node — nextFocusableAfter's destination (jsdom reports offsetParent null for everything, so the candidate list is always empty) and the :focus-visible keyboard-vs-pointer gate (jsdom answers false, so wireCardFocusZoom's grow route is dead code in the entire suite). The other seventeen are ordinary jsdom tests nobody has written yet. That means the coverage gap here is a writing gap, not a tooling limit.

What the 14 tests actually protect: the overlay's structure and one-model rendering, the pick grammar (card picks, chip and map door don't), the touch hold's arm-after-the-lift, the ghost sweep, the bloom's compositor-only budget and the WHEN delay, the exit's live-opacity read, the pointermove belt, the born-under-a-pointer re-arm, the airbag on grow, and scroll-does-not-dismiss. Those are the expensive bugs, and they are genuinely nailed down.

What rests on Kevin's browser alone: every hover boundary handler on the overlay (enter/leave grace), the whole animated refresh block after a pick — roughly fifty lines that CI never executes — the dismissedEl rule, the viewport clamp and all the geometry, the keyboard Tab path, the instant-restore-under-a-moved-away-mouse check (also never executed: jsdom has no elementFromPoint), the airbag on refresh and shrink, the ghost-reaping timeout, and all of app.js's zoom glue, which the tests re-implement by hand rather than run.

Two quiet fragilities worth knowing: the suite's isolation depends on jsdom lacking elementFromPoint (test 13 leaves lastMouse set for every test after it — if jsdom ever ships that method, test 14 can start closing its own zoom), and two production branches are dead in Node for the same reason. So "green" here means the bloom's contracts hold; it does not mean the hover holds.

For the merge question specifically: the two hover-close mechanisms (the overlay's pointerleave grace and the document pointermove belt) look like the clearest duplication in the file, and only one of them — the belt — is pinned. A merge there would be invisible to CI in both directions. Same for the two elementFromPoint re-arm sites: one is pinned, one has never run. Any simplification touching those needs its test written first, or it rides entirely on a browser walk.


| Layer | Lines | Pinned by | Gap test (if none) | Browser-only |
|---|---|---|---|---|
| lastMouse tracker — one passive capture-phase pointermove for the module's life, mouse-only, feeding both elementFromPoint re-arms | card-facts.js 291-298 | PARTIAL — tests/zoom-overlay.test.mjs, 'a card rendered under a resting pointer arms its hover intent one frame after insertion (a repaint under a still hand)' exercises it as a prerequisite, but nothing asserts the pointerType==='mouse' filter |  |  |
| canAnimate gate — Low Power (ctx.lowPower) and prefers-reduced-motion force every path instant, because CSS cannot reach Element.animate() | card-facts.js 300-303 | NONE — makeCtx always sets lowPower:false and the matchMedia stub always answers matches:false | Install the recording animate stub, zoom once with ctx.lowPower=true and once with matchMedia returning matches:true, and assert zero animate calls plus a fully-formed overlay both times. |  |
| zoomLayer() rebuilds #zoom-layer when the cached node is no longer connected | card-facts.js 308-317 | NONE — test 1 asserts the layer hangs off <body>, but no test removes it and re-zooms | Zoom, unzoom, remove #zoom-layer from the document, zoom again and assert a fresh layer exists on <body> with exactly one slot in it. |  |
| zoomContains — 'outside' means outside BOTH the resting card and the overlay, so a tap on the overlay is a pick and never a dismiss | card-facts.js 320-324 | tests/zoom-overlay.test.mjs, 'the grown card is an overlay: outside the wall, and the resting card is never resized' (asserts true for the overlay's .f-name, true for the card, false for document.body) |  |  |
| zoomSnapshot + instant restore across a full-wall repaint (a crew-mate's poll must not eat the card you are resting on) | card-facts.js 326-329; app.js 378-386 | tests/zoom-overlay.test.mjs, 'unzoom removes the overlay and restores the card; the snapshot survives a repaint' |  |  |
| dismissedEl — a zoom put away on purpose (Escape) stays away until the pointer leaves the card; deliberately NOT consulted on the keyboard route | card-facts.js 330-332, 853, 874-881, 890-893 | PARTIAL — tests/zoom-overlay.test.mjs, 'a scroll never kills the zoom — the overlay follows its card (trackpads jiggle)' pins only the ABSENCE of poisoning after a scroll; the mechanism itself is unpinned |  |  |
| insetFor — the clip that reveals exactly the old box out of the new one during a refresh crossfade | card-facts.js 334-339 | NONE — its only caller is the animated refresh path, which no test enters | Call insetFor with two hand-built boxes and assert the four inset values and the round radius, then assert the refresh crossfade uses it (see the animated-refresh layer). |  |
| place() — centre on the resting card, clamp on the LEFT/RIGHT viewport edges only (top and bottom never move it), with a Number.isFinite fallback against NaN geometry | card-facts.js 341-354 | NONE — jsdom returns all-zero rects, so the clamp arithmetic never does anything in any test | Stub getBoundingClientRect and window.innerWidth so a card sits 20px from the right edge, zoom, and assert slot.style.left is the clamped value while slot.style.top is the raw centred value; repeat with a zero-width rect and assert left is finite. |  |
| buildParts — the wash and border live on an absolutely-positioned .z-surface UNDER an unclipped hit target, so the whole grown box takes a tap from the first frame of the bloom | card-facts.js 356-371; v3.css 758-767 | PARTIAL — tests/zoom-overlay.test.mjs, 'the grown card and the resting card render from ONE model: same aura, every detail carried' pins the surface's background against the card's; the hit-target-during-bloom property is unpinned |  | yes |
| sizeSlot — the overlay never grows smaller than the card it grows out of (MIN_W/MAX_W/MIN_H floored by the resting rect) | card-facts.js 373-378 | NONE — with all-zero jsdom rects this degenerates to the three constants and is never observed | Stub the resting rect at 400x200 and assert slot.style.minWidth/maxWidth/minHeight all report at least 400/400/200px rather than the 216/360/132 defaults. |  |
| originFor + scaleFor — the bloom grows from (and recedes toward) the resting card's true centre inside the overlay box, at a starting scale clamped to 0.7–0.95 | card-facts.js 380-388 | NONE — the animated test records keyframes but asserts nothing about the scale value or transform-origin | With stubbed rects, assert slot.style.transformOrigin equals the resting centre offset inside the placed box, and that the grow keyframe's starting scale sits inside [0.7, 0.95]. |  |
| One zoom on stage — an early return when the same card is re-zoomed, and an instant unzoom of any other zoom first ('a new zoom took the stage') | card-facts.js 391-392 | PARTIAL — tests/zoom-overlay.test.mjs, 'zooming a second card replaces the first — one zoom at a time' pins the replace; the same-card early return (returns null, keeps the standing overlay) is unpinned |  |  |
| exitingSlots — a NEW zoom sweeps EVERY still-shrinking overlay, not just this card's (the skimming-ghosts overlap, Kevin's GIF 2026-08-30) | card-facts.js 290, 393-398, 627, 663-664 | tests/zoom-overlay.test.mjs, 'the bloom keeps its laws: compositor-only, WHEN waits out the content fade, exit from live opacity, exit slots swept' |  |  |
| Instant restore under a moved-away mouse — a repaint-restored overlay asks elementFromPoint under the last known mouse and puts itself away if the hand has gone (Codex gate 2026-08-31) | card-facts.js 421-434 | NONE — and it is not merely unasserted, it never executes: jsdom has no document.elementFromPoint, so the guard is false in every test | Feed a mouse pointermove, stub document.elementFromPoint to return document.body, zoom with {instant:true, source:'mouse'} and assert the slot is gone after one frame; then stub it to return the card and assert the slot survives. |  |
| The bloom is compositor-only — every keyframe of every animation touches transform/opacity alone, so a grow can never reflow the wall | card-facts.js 437-464 | tests/zoom-overlay.test.mjs, 'the bloom keeps its laws…' (asserts every keyframe key is one of transform/opacity/offset/easing) |  |  |
| ONE rendering of every fact — the grown WHEN line waits out the resting content's 90ms CSS fade before it begins | card-facts.js 456-461; v3.css 784-786 | tests/zoom-overlay.test.mjs, 'the bloom keeps its laws…' (asserts the .f-sub animation's delay >= 90) |  |  |
| The cascade's shape — WHERE follows WHEN, pills arrive from the right, chips from the left, each a STAGGER_MS beat apart | card-facts.js 462-464 | NONE — the animated test finds only the .f-sub call and asserts nothing about the others | From the recorded calls, assert the pills' first keyframe translate has +x and the chips' has -x, and that delays increase monotonically across sub → where → pills → chips. |  |
| refreshZoom bookkeeping — a pick keeps the zoom: cancel in-flight anims, move .zoom-source to the fresh node, rebuild the overlay's parts, re-place the box | card-facts.js 496-518 | tests/zoom-overlay.test.mjs, 'a click on the grown card PICKS; its notes chip opens notes and never picks' and 'taps while zoomed cycle 1 → 2 → 3 → 4 → 0 and the pills follow' |  |  |
| refreshZoom re-wires the keyboard source listener onto the fresh resting card (unwireSource → wireSource) | card-facts.js 503-505, 809, 827-837 | NONE — no test presses Tab at all, before or after a pick | Zoom, click to pick, then dispatch keydown Tab on the FRESH resting card and assert focus moved to the overlay's notes chip — proving the listener followed the node swap. |  |
| refreshZoom's animated re-entrance — old wash lingers and unclips away, the new surface unclips from the old box, every surviving part FLIP-slides, a new pill grows in, a MUST badge fades on | card-facts.js 519-573 | NONE — the recording stub is installed only in the bloom test, which never triggers a refresh; this whole block is unexecuted in CI | Install the animate stub, zoom, then click to pick, and assert: an old-surface fade with clipPath keyframes exists, a newly-arrived .f-pill got the scale(.55)→none arrival, and a MUST badge that just appeared got its own fade. |  |
| The close journal — an overlay mousedown timestamps lastOverlayPress, and any close within 1s of it records its named cause to the crash journal | card-facts.js 576, 583, 722-723 | NONE — test 12 actually executes this path (mousedown, then card.blur() closes within 1s) but asserts nothing about it | Mousedown on the overlay body, unzoom({why:'x'}), then assert errlog.recent().at(-1) is kind 'zoom-close-after-click' with msg 'x' — and that a close 2s later records nothing. |  |
| The exit leaves from LIVE values — computed transform and opacity read first, with Number.isFinite instead of `// 1` so a first-frame dismissal doesn't flash the card opaque | card-facts.js 586-599 | PARTIAL — tests/zoom-overlay.test.mjs, 'the bloom keeps its laws…' pins the opacity half (sets slot opacity 0, asserts the exit keyframe starts at 0); the transform read is unpinned (jsdom computes 'none') |  |  |
| In-flight anims are cancelled on the instant path but deliberately LEFT RUNNING on the animated exit (cancelling snapped half-arrived lines to full opacity) | card-facts.js 602-613 | NONE | With a stub that records cancel() calls, start a bloom, unzoom animated and assert the interior cascade animations were NOT cancelled; unzoom instant from a fresh bloom and assert they WERE. |  |
| The exit ghost belt — finish() runs once (onfinish/oncancel/timeout), and a setTimeout of OUT_MS*4+80 removes a slot whose animation never finishes (a backgrounded tab) | card-facts.js 627-642 | PARTIAL — 'the bloom keeps its laws…' pins that the slot LINGERS for its animation; the timeout that eventually reaps it is unpinned |  |  |
| The airbag on grow — a throw mid-zoom is journalled and the stage swept (no stranded slot, no content-invisible card) | card-facts.js 645-671 | tests/zoom-overlay.test.mjs, 'the airbag: a throw mid-zoom is recorded and sweeps the stage — no stranded slot, no invisible card (the Safari recording, 2026-08-31)' |  |  |
| The airbag on refresh and on shrink — the other two entry points wrapped by the same bail | card-facts.js 672-677 | NONE — only zoomCard's wrapper is tested | Zoom on the instant path, then make Element.animate throw and click to pick: assert kind 'zoom:refresh' in the journal and a swept stage; repeat with an animated unzoom for 'zoom:shrink'. |  |
| A hold's release cannot pick — the overlay is pointer-deaf until AFTER the lift's synthetic click, with a 350ms timer belt for a lift that synthesises none and pointercancel for an aborted gesture | card-facts.js 688-712 | PARTIAL — tests/zoom-overlay.test.mjs, 'a hold on touch: the lift and its own click cannot pick; the NEXT tap does' pins the click path exactly; the 350ms timer and the pointercancel path are unpinned |  |  |
| The overlay never steals focus — mousedown on the card body is preventDefault'd so the focused resting card is not blurred (which would close the zoom before the click landed); buttons and links keep their defaults | card-facts.js 715-726 | tests/zoom-overlay.test.mjs, 'the overlay never steals focus: a click on its body picks even when the resting card holds focus (the 2026-08-31 "hover and click, it closes")' |  |  |
| The overlay's click handler — a stale-z guard, a nested-button escape hatch, and an isConnected check that closes instead of picking when the resting card has left the DOM | card-facts.js 729-735 | PARTIAL — the pick and the button escape are pinned by 'a click on the grown card PICKS…' and 'a venue the festival maps becomes a door to the map — and never a pick'; the isConnected branch is unpinned |  |  |
| Overlay hover bookkeeping — pointerenter cancels a pending grace close, pointerleave starts one after ZOOM_OUT_MS, and a leave whose relatedTarget is the resting card underneath is ignored | card-facts.js 738-750 | NONE — the orphan test drives the document-level belt, never these two boundary handlers | Dispatch a mouse pointerleave on the overlay with relatedTarget=document.body and assert it closes after ZOOM_OUT_MS; repeat with relatedTarget=the resting card and assert it stays; and re-enter mid-grace and assert the close was cancelled. |  |
| The pointermove belt under the boundary events — an overlay born with the pointer already elsewhere still closes on the next outside movement (Kevin 2026-08-31: 'after click, it doesn't un-hover') | card-facts.js 752-770 | tests/zoom-overlay.test.mjs, 'an orphaned mouse zoom closes on the next outside movement (a repaint can restore a zoom after the hand moved on)' |  |  |
| Scroll and resize FOLLOW, never dismiss — capture phase (inner scrollers don't bubble), rAF-throttled to one re-place per frame, closing only when the card truly left the viewport, with a zero-size-viewport transient guard and a card-left-the-DOM branch | card-facts.js 772-802 | PARTIAL — tests/zoom-overlay.test.mjs, 'a scroll never kills the zoom — the overlay follows its card (trackpads jiggle)' pins the headline (a scroll does not dismiss, and does not poison the card); all four inner guards are unpinned |  |  |
| Keyboard route inside the overlay — Tab from the card reaches the notes chip, Tab again unzooms and moves on, Shift+Tab returns to the card, and focusout closes only when focus truly left both nodes | card-facts.js 804-824, 827-837 | NONE — no test in the file presses Tab | Focus the resting card, dispatch keydown Tab and assert the chip took focus; dispatch Tab on the chip and assert the zoom closed; dispatch Shift+Tab and assert focus returned to the card. |  |
| nextFocusableAfter — Tab out of the overlay lands on the next VISIBLE focusable after the card, skipping anything inside #zoom-layer | card-facts.js 839-844 | NONE | Cannot be pinned honestly in Node: jsdom reports offsetParent===null for every element, so the visibility filter empties the candidate list and the function always returns null. The close half is Node-testable; the destination needs a real layout. | yes |
| Hover intent — ZOOM_IN_MS of pointer-fine dwell before a card grows, judged by EVENT pointerType, never a media query | card-facts.js 848-858 | PARTIAL — 'a card rendered under a resting pointer arms its hover intent one frame after insertion' pins the delay, but through the rAF re-arm; the ordinary pointerenter route is never dispatched by any test |  |  |
| The born-under-a-resting-pointer re-arm — one frame after insertion, ask elementFromPoint under the last known mouse (never :hover, which Safari leaves stale after DOM swaps) | card-facts.js 859-873 | tests/zoom-overlay.test.mjs, 'a card rendered under a resting pointer arms its hover intent one frame after insertion (a repaint under a still hand)' |  |  |
| wireCardZoom's pointerleave — cancels a pending intent timer, ignores a leave whose relatedTarget is the overlay that just appeared over the card, and clears the dismissed mark | card-facts.js 874-881 | NONE | Dispatch pointerenter then pointerleave inside the intent window and assert no zoom ever appears; with a zoom up, dispatch pointerleave with relatedTarget inside the overlay and assert dismissedEl was not cleared and the zoom survives. |  |
| wireCardFocusZoom's focusin gate — only KEYBOARD focus grows a card, decided by :focus-visible so a click or a tap does not bypass hover intent | card-facts.js 887-900 | NONE — worse, jsdom answers :focus-visible with false, so this route is dead code in the whole suite | Not pinnable in Node without stubbing el.matches, which stubs away the thing under test — the browsers' own keyboard-vs-pointer judgement is the mechanism. A real-browser walk (Tab to a card = grows; click a card = does not) is the only honest pin. | yes |
| wireCardFocusZoom's focusout — closes when focus truly left, with a relatedTarget guard for focus moving into the card's own subtree or the overlay | card-facts.js 901-907 | PARTIAL — 'the overlay never steals focus…' asserts card.blur() closes the zoom (the failure the mousedown fix prevents); the relatedTarget guard is unpinned |  |  |
| app.js glue — the capture-phase pointerdown that closes on a press outside, Escape closing exactly one layer, repaintWall's snapshot/occ-matched restore, and refreshArtistCards keeping the zoom on the right one of an artist's several cards | app.js 93-99, 140-142, 378-386, 1781 | NONE — the test file re-implements this glue by hand in makeCtx().onTap; app.js itself is never loaded by tests/zoom-overlay.test.mjs | Import the real handlers (or extract them) and assert: a pointerdown on document.body closes a standing zoom while one on the overlay does not; Escape closes the zoom and stops propagation; and after a repaint the zoom returns to the card whose data-occ matches, not the artist's first card. |  |


## Codex's independent read (verbatim)

Yes—there is room for three small refactors. I would not remove any robustness layer or combine event routes. The targeted suite passes 14/14; no files were edited.

## Safe simplifications

1. Centralize “inside this zoom” detection

Current ranges: [card-facts.js:319](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:319), plus 427–432, 758–765, 819–824, and 901–906.

Exact shape:

```js
function isInsideZoom(z, node) {
  return !!(z && node && (z.el.contains(node) || z.slot.contains(node)));
}

export function zoomContains(node) {
  return isInsideZoom(zoomed, node);
}
```

Use `isInsideZoom()` in the restore check, movement belt, and both focusout paths.

This preserves:

- The 2026-08-31 repaint restored under an already-moved mouse: `elementFromPoint()` still checks both source and overlay.
- Outside-press dismissal without poisoning the source.
- The 2026-08-31 focus/blur case: movement between resting card and overlay still counts as internal.

Existing coverage: “the grown card is an overlay…,” “an orphaned mouse zoom closes…,” and “the overlay never steals focus….”

New test needed: Tab from the resting card into the notes chip, then Shift+Tab back, without closing the zoom.

Confidence: high.

2. Share the hover-close timer mechanics—not the event sensors

Current range: [card-facts.js:741](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:741)–770.

Exact shape:

```js
let outT = null;

const cancelClose = () => {
  if (!outT) return;
  clearTimeout(outT);
  outT = null;
};

const startClose = (why) => {
  if (outT) return;
  outT = setTimeout(() => {
    outT = null;
    if (zoomed === z) unzoom({ why });
  }, ZOOM_OUT_MS);
};
```

`pointerleave` should `cancelClose()` then `startClose(...)`; the movement belt should cancel inside and `startClose(...)` outside.

This deliberately retains both `pointerleave` and document `pointermove`. It preserves the 2026-08-31 orphan-overlay fix because movement remains an independent belt when boundary events never fire. It also preserves grace cancellation when the pointer returns. It does not touch the trackpad-safe scroll-follow path.

Existing coverage: “an orphaned mouse zoom closes on the next outside movement….”

New test needed: overlay `pointerleave` starts closing, `pointerenter` cancels it, and a later leave closes it.

Confidence: high with that test.

3. Give overlay controls one shared predicate

Current range: [card-facts.js:722](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:722)–735.

Exact shape:

```js
const isOwnControl = (target) =>
  target !== card && !!target.closest?.('button, a');
```

Use it in both `mousedown` and `click`. Body presses still prevent focus movement and still pick; buttons and map links keep their native behavior.

This preserves:

- The 2026-08-31 “hover and click closes before click lands” fix.
- The 2026-08-29 requirement that the grown card body picks.
- Notes and map doors never becoming picks.

Existing coverage: “a click on the grown card PICKS…,” “a venue…becomes a door to the map,” and “the overlay never steals focus….”

Confidence: high.

I would stop there. Extracting the repeated part selector or animation-cancellation loop would save only a line or two while making deliberately different animation paths easier to confuse.

## Wrapper verdict

The three responsibilities are necessary, not ceremony:

- The `Inner` functions hold the operation that may fail midway.
- The exported `try/catch` functions establish a reliable failure boundary for every caller, including event callbacks.
- `zoomBail` restores the invariant that there is no overlay, no hidden source, and no live zoom state after an exception.

The inner functions could technically be inlined into large `try` blocks, but that would only move braces and obscure the recovery boundary. A higher-order wrapper would likewise save very little while making stack traces and entry-point behavior less explicit.

One coverage gap: the airbag test at [zoom-overlay.test.mjs:383](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/tests/zoom-overlay.test.mjs:383) proves `zoom:grow`, but not `zoom:refresh` or `zoom:shrink`. Before altering these wrappers, add fault-injection cases for those two paths and assert that slots and `.zoom-source` are swept.

## Looks duplicated, but is not

Do not simplify away:

- The lifetime `lastMouse` listener, per-zoom movement belt, and `elementFromPoint()` checks. They respectively remember pointer truth, detect movement while open, arm a card born under a still pointer, and reject an orphan restored after the pointer moved.
- `pointerleave` plus document `pointermove`. One is the normal signal; the other exists precisely because browser boundary events can be absent.
- Source `focusout`, overlay `focusout`, and body `mousedown.preventDefault()`. They cover different sides and ordering of the focus handoff.
- Click-plus-timeout-plus-`pointercancel` touch arming at [card-facts.js:686](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:686), together with the resting card’s long-press swallow in [wall.js:156](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/wall.js:156). That is the hold-lift synthetic-click defense.
- `.zoom-slot`, `.zoom-card`, `.z-surface`, and `.zoom-source` in [v3.css:753](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:753). They are positioning box, hit target, visual wash, and resting source—not four representations of one thing.
- `exitingSlots`, normal teardown, and `zoomBail`. Normal exits animate; the set prevents ghost overlap; the bail’s global DOM sweep catches half-created state that was never registered normally.
- `refreshCard()` followed by `refreshZoom()`. The first replaces the resting card with current facts while preserving placement/focus; the second hands that new node to the standing overlay.
- Snapshot → instant teardown → instant restoration during a full wall repaint. The wall nodes genuinely cease to exist; preserving the occurrence identity is what restores the correct duplicate artist card.
- Leaving interior animations running during animated exit while cancelling them during instant teardown. The comment at lines 607–613 explains the one-frame snap that cancellation caused.

## Overall verdict

This is dense-but-sound, not duct tape. The complexity mostly reflects a real interaction state machine spanning mouse, touch, keyboard, DOM replacement, scrolling, animation, and Safari’s unreliable boundary state. The dated comments correspond to distinct failure modes, and the code now has coherent invariants: one overlay, one source, no wall reflow, and complete recovery after failure. A few repeated predicates and timer operations can be tightened, but a broad cleanup would reduce confidence rather than improve maintainability. Any refactor still needs a real-pointer browser walk because jsdom cannot reproduce focus defaults, WebIDL receiver failures, Safari hover state, or animation feel.


---
*Sources: workflow run wf_c796536a-5ff (journal in the session's subagents/workflows dir); Codex run cx-20260901-123332-21586-20f0ab. Next step if Kevin wants the pass: write the Tab / hover-grace / airbag-refresh-shrink / close-journal tests against CURRENT code first, watch them pass, then apply the surviving extractions, `node scripts/sw-stamp.mjs` on a clean tree, real-browser Tab walk before promote.*
