1. **Overlay is the right architecture, with three corrections.**

   - A direct `<body>` child will not be trapped by current containing blocks. The relevant stacking order is stage strip `24`, day rail `25`, dock `30`, sheet `40/41`, toast `50`; use about `36`, below sheets/toasts ([v3.css:195](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:195), [v3.css:237](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:237), [v3.css:273](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:273), [v3.css:481](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:481)). No card ancestor currently has transform/filter/perspective; the blur contexts are lower-z siblings.
   - Do **not** hide the source with `visibility:hidden`. That removes it from focus and the accessibility tree, breaking the proposed keyboard route. Use `opacity:0` while retaining the source as the semantic/focus anchor, and mirror its visible focus ring onto the overlay. Mark duplicated overlay prose as decorative while leaving the notes button accessible. [`visibility:hidden` cannot receive focus](https://developer.mozilla.org/docs/Web/CSS/visibility).
   - Full wall repaints need an immediate teardown, not a 220 ms return animation toward a source about to disappear. `repaintWall()` already calls `unzoom()`, so remote sync is safe ([app.js:373](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:373), [app.js:1721](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:1721)). Search bypasses that guard and calls `renderWall()` directly, which would orphan a body overlay ([app.js:1768](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:1768)). Centralize teardown around every `renderWall`, or route search through a safe repaint.
   - Local pick refresh needs new integration: current code explicitly unzooms/rezooms and selects `:hover || fresh[0]` ([app.js:122](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:122)). With the overlay covering the source, `:hover` is unreliable, and `fresh[0]` can select the wrong occurrence. Preserve the exact source index/occurrence, replace it, keep it transparent, then update overlay facts without replaying.
   - “Two rect calls” is optimistic: card + overlay + both name rects is four; timetable clamping adds the scroller rect. That is still cheap. More important is batching all reads before writes, avoiding the current read/write/read sequence ([card-facts.js:332](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:332)).

2. **Use `clip-path`, but don’t call it universally compositor-only.**

   I would choose the proposed `clip-path: inset()` over animated width/height or counter-scaling:

   - Width/height forces layout every frame—even if confined to a small subtree.
   - Transform plus counter-scale is compositor-friendly but comparatively intricate and risks blurry/distorted text.
   - Clip-path preserves final text/layout and performs no wall layout. On one small overlay, its bounded main-thread cost is reasonable.

   The caveat is that clip-path animation is not consistently compositor-backed across deployed Safari/Firefox versions; WebKit’s compositor work was still being tracked recently. Transform and opacity remain the only dependable cross-engine compositor choices. [WebKit issue](https://bugs.webkit.org/show_bug.cgi?id=185816), [MDN rendering guidance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS).

   I would initially ship only the clip reveal plus one grown-content fade. The separate name glide is polish, not required to solve the complaint. Also apply clipping to an inner surface rather than the shadow-bearing wrapper, or the card shadow may be clipped/popup when the animation ends. Reduced motion **and Low power** should make it instant—the setting promises “no animation,” while current `canAnimate()` ignores `ctx.lowPower` ([settings.js:686](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/settings.js:686), [card-facts.js:194](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/card-facts.js:194)).

3. **The touch grammar is coherent; protect the release click.**

   “Hold previews; next tap picks; outside tap dismisses” matches the card’s ordinary tap meaning better than the current special dismiss behavior ([wall.js:208](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/wall.js:208), [app.js:73](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:73)).

   The danger is the synthetic click following the hold. Current suppression lives on the source card’s capture path ([wall.js:158](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/wall.js:158)). Touch normally implicitly captures the pointer, so it should still land there, but the robust design is:

   - Keep the source connected and transparent.
   - Keep the overlay non-interactive until that original `pointerup`/click sequence finishes.
   - Then enable overlay pointer events for the *next* tap.

   That guarantees lifting the holding finger only reveals; it cannot accidentally record a pick. Explicit pointer capture or a one-shot document click swallow is another defensible belt. The Pointer Events specification otherwise targets an uncaptured click at the common ancestor when down/up targets differ, which the source-only listener would miss. [Pointer Events dispatch rule](https://www.w3.org/TR/pointerevents/).

4. **Simpler fallback: same portal, less morph.**

   I would not materially change the overlay architecture. If real-device Safari testing still shows clip jank, drop the exact reveal and use a subtle uniform `scale(.96) → 1` plus opacity on the final overlay—no counter-scale, no shared-piece clones. It is less literal, but still reads as one card punching forward, never moves siblings, and is maximally light.

   For the timetable, clamp against the source `.times-scroll` rect and dismiss immediately on its scroll; it has momentum scrolling enabled ([v3.css:442](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/assets/v3.css:442)). Also dismiss on `window` and `visualViewport` resize/scroll. The keyboard is mostly harmless because opening notes already unzooms before the sheet/input appears ([app.js:49](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/js/v3/app.js:49)).

   No build-system obstacle exists. If implementation adds a module, it must join `APP_CORE`; every JS/CSS change still requires `node scripts/sw-stamp.mjs` ([service-worker.js:19](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/service-worker.js:19), [sw-stamp.mjs:1](/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/scripts/sw-stamp.mjs:1)).

Bottom line: approve the body-overlay direction, conditional on replacing `visibility:hidden`, hardening the hold-release click, centralizing full-repaint teardown, and testing the actual pointer/focus sequence in Safari. No files changed.

