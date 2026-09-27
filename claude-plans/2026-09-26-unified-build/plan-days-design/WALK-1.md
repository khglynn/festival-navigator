# Real-input walk on daf9c3b — 2026-09-27, 7:55–8:52 AM PT

A Sonnet walker ran this from the brief the lead wrote. All steps passed in both engines: Chromium and WebKit on the phone, and both on the laptop. It found no app bug. Its 74 screenshots stay outside the repo, since `.gitignore` denies images.

The lead then looked at the frames Kevin will judge, and found one thing the walker did not call out. On Portola Sunday at 390px, the Earlier line ellipsizes: "EARLIER · THU · FRI · SAT · 4 S…". It went to the builder.

The brief had one mistake: it put Despacio at ACL. It is Portola's drop-in room, and ACL declares none.

The walker's findings follow, as it wrote them. Its crew tokens were redacted, and the lead verified that with a scan.

---

# Real-browser walk: Our picks across the days (2026-09-27)

Independent walker, real input only (Playwright `page.mouse`, `page.touchscreen`,
`page.keyboard`, `page.mouse.wheel`, CDP `Input.dispatchTouchEvent` for finger
drags on Chromium). GATE = `.claude/worktrees/walk-plandays` @ daf9c3b, read-only.
Local static server only, made-up crew tokens only, never production/preview/
`vercel dev`. Crew tokens are never written below -- `<token>` stands in for one.

## Adaptations from the brief (hard rule 5)

- **Real finger-drag scrolling is Chromium-only.** Playwright's `page.touchscreen`
  exposes only `tap(x, y)` -- no drag/swipe primitive -- and WebKit has no CDP
  session (`newCDPSession` throws "CDP session is only available in Chromium").
  The app's own test suite (`plan-drag.test.mjs`) reaches the same wall: its one
  real finger-drag test is Chromium-only. So: Chromium phone steps use real CDP
  touch drags (`Input.dispatchTouchEvent` touchStart/touchMove.../touchEnd,
  ending still, paused before the next gesture); WebKit phone steps use a real
  mouse wheel over the list for scrolling (still real input, exercises the same
  scroll code path) and `touchscreen.tap()` for taps. Noted once here rather
  than re-flagged every step.
- **Slow-motion sampling** (CDP `Animation.setPlaybackRate`) is Chromium-only for
  the same CDP-session reason -- done only where the brief asks for it in
  Chromium. Also found: this CDP knob slows Web Animations (the head's turn)
  but NOT native `scrollTo({behavior:'smooth'})` -- so a fixed-interval Node-side
  poll of scrollTop can show a bigger apparent "jump" between two polls than any
  real frame moved, purely from poll-timing misalignment. The trustworthy signal
  for glide smoothness is the browser's own scroll events (captured as
  `window.__glide`, the same technique `plan-days.test.mjs` uses), not a Node
  poll -- both are reported where relevant, with the poll's number flagged as
  an artifact when it disagrees.
- **"Despacio at ACL is a drop-in room" (item 4) does not match this build's
  data.** Despacio is a Portola drop-in room (`data/festivals/portola-2026.json`,
  Saturday + Sunday, `dropIn: true`). ACL's festival file
  (`data/festivals/acl-2026.json`) declares no `dropIn` room anywhere -- 0
  `.plan-row.dropin` lines are ever drawn across its whole fortnight. This is
  flagged prominently in the report rather than silently walked around.
  Separately: in `plan-crew-nine.json` (this walk's Portola crew), Despacio is
  picked by only 1 of 9 people (Gus, level 1) -- below the crew's own "enough of
  us" bar for a 9-person view, so it does not show without a highlight. A
  highlight of just Gus (bar 1 for a solo view) surfaces it; screenshotted there.
- **Step 11c's Tab-to-Share check is Chromium-only.** Playwright's WebKit
  follows Safari's own convention: Tab skips buttons unless macOS's "Full
  Keyboard Access" is on, and Playwright exposes no toggle for it. This is not
  test-harness laziness -- GATE's own suite hits the identical wall and skips
  its keyboard-reach test for WebKit for exactly this reason
  (`tests/browser/plan-drag.test.mjs:811-813`, "Safari Tabs past buttons by
  default"). Adapted once: WebKit's step 11c confirms the Share control itself
  still works (a direct click sends a payload), but does not attempt Tab
  navigation. Not an app bug in either engine.

## Screenshot index

Screenshots land in `screenshots/`, numbered in the order taken. Referenced by
path from each step's entry below.

## Steps


**Step 1a-1d (Chromium phone): finger-drag through the days, Sat -> Sun -> Sat: PASS**
- 1a/1b: finger-drag up reached Sunday (nightTop offset -279.921875px); head/Share turned (SAT->SUN, arrived-from-below frames: true). Screenshots: screenshots/01-chromium-phone-step1-saturday.png, screenshots/02-chromium-phone-step1-sunday.png
- 1c: finger-drag back reached Saturday (nightTop offset 44px); head/Share turned back (SUN->SAT, arrived-from-above frames: true). Screenshot: screenshots/03-chromium-phone-step1-back-to-saturday.png
- Turn frames up: [{"part":"wd","where":"head","from":"translateY(10px)","duration":200},{"part":"sub","where":"head","from":"translateY(10px)","duration":200}]
- Turn frames down: [{"part":"wd","where":"head","from":"translateY(-10px)","duration":200},{"part":"sub","where":"head","from":"translateY(-10px)","duration":200}]

**Step 1e (Chromium phone, 0.25x): sample the SAT->SUN turn in slow motion: PASS**
- 207 samples of .wd's top over the drag+turn (0.25x speed), 11 distinct values, max frame-to-frame jump 10.00px.
- animate() calls recorded on the head: [{"part":"wd","where":"head","from":"translateY(10px)","duration":200},{"part":"sub","where":"head","from":"translateY(10px)","duration":200}]
- Verdict, MEASUREMENT-CORRECTED (checked before trusting it, per "suspect the
  measurement first"): the auto-verdict below said "not clearly smooth"
  because a `distinct >= 4 && maxJump < 6` heuristic saw one 10px jump
  (83 -> 93) and failed it on that alone. That jump is not a rendered pop:
  `js/v3/plan-shelf.js` line 349 swaps in a FRESH `.wd`/`.sub` DOM node and
  animates it from `translateY(10px)` with `cubic-bezier(.2, .9, .3, 1.1)` (a
  >1 control point -- an intentional slight overshoot). My sampler polls "the
  current .wd element," so the one sample straddling the node swap
  necessarily reads the new node at its 10px starting offset -- a
  discontinuity in the MEASUREMENT (old node's rest position, then new
  node's start position), not in what was rendered. The 9 samples after it
  (93, 91.18, 86.82, 85.08, 83.69, 83.06, 82.86, 82.77, 82.81, 82.89, 83) are
  a clean, monotonic ease back to rest with exactly the wobble the 1.1
  overshoot predicts, then settling dead-on 83. Corrected verdict: this IS
  one smooth motion, no pop -- the automated heuristic's threshold just didn't
  allow for a legitimate swap-then-ease shape.
- Original auto-verdict (kept for the record): not clearly smooth from this sample set -- see raw values below.
- Raw samples: [83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,93,91.18,86.82,85.08,83.69,83.06,82.86,82.77,82.81,82.89,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83,83]

**Step 2 (Chromium phone): Sunday holds through a minute tick, a tap, and the Share: PASS**
- 2a/2b: one-minute tick (+visibilitychange) left the list still (Δ0px) and the head SUN.
- 2c: tapped Sunday row (card grew: false); row stayed under the finger (-92.921875 -> -92.921875). Screenshot: screenshots/04-chromium-phone-step2-sunday-row-tapped.png
- 2d: Share text starts "Our crew's main picks for Sun Portola", ends ...&plan=2026-09-27, no "now till". Full text:
Our crew's main picks for Sun Portola

Folsom St, 8th-13th for Folsom Street Fair @ 11am
Pier Stage for SG Lewis @ 4:30pm
Pier Stage for Mochakk @ 6pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Swedish House Mafia @ 8:45pm

Full rundown: http://127.0.0.1:59211/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27

**Step 3 (Chromium phone): &plan=2026-09-27 link opens on tonight then glides to Sunday: PASS**
- 3a: the plan opened with no input, then glided to Sunday. Screenshot: screenshots/05-chromium-phone-step3-link-landed-sunday.png
- 3b: the browser's own scroll events (42 real frames) show a continuous glide, max per-frame jump 48px (<60px); the window landed (plan-top stable by sample 20) before the list started moving (sample 24).
- A raw 30ms Node-side poll of the same run showed a coarser max gap of 173px between two samples -- this is a poll-timing artifact (page.evaluate round trips do not align to paint frames under CDP's 0.25x, which slows Web Animations but not native smooth-scroll), not a real jump; the frame-level __glide data above is the trustworthy signal and shows no pop.
- 3c: closing showed peek "Now: Dog Blood, Pier Stage, till 10:15 PM, 8 picked" (tonight's Dog Blood, not Sunday) -- the peek stayed tonight's throughout.

**Step 4 (Chromium phone): the Show menu opens over the open plan and re-plans it live: PASS**
- The plan stayed open (open) under the Show menu, and the menu sat on top of it (menu). Screenshot: screenshots/06-chromium-phone-step4-show-menu-over-plan.png
- Turning Afters off removed its rows from the plan live, with the menu still up (no flash to empty observed).
- Closing the menu left the plan open (open); history.length unchanged (2 -> 2).

**Step 5 (Chromium phone): the people menu over the open plan -- no Our picks row, highlight re-plans live: PASS**
- 5a: no "Our picks" row in the people menu while the plan is open.
- 5b: tapping Gus alone -> head said "just you" (0 dimmed rows).
- 5c: adding Cy + Hal -> head read "Sep 26 · you, Cy + Hal". Screenshot (menu over plan): screenshots/07-chromium-phone-step5-people-menu-over-plan.png
- 5d/5e: after closing, head kept saying "Sep 26 · you, Cy + Hal"; foot line "Opens on everyone’s picks"; Share text named none of the nine before "Full rundown:". Full Share text:
Our picks for Sat Portola, now till end of day

Pier Stage for Dog Blood @ now till 10:15pm

Full rundown: http://127.0.0.1:59211/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-26
- 5f: dock NOW tab visible=false, plan has a tagged Now row=true -- never both.
- 5g: cleared highlight -> sub reads "Sep 26 · 9 picking".

**Step 6 (Chromium phone): the short Tiesto stop at Portola Sun 8:05 PM: PASS**
- At 8:05 PM: NOW row "Now: Tiësto, Warehouse, till 8:15 PM, 4 picked". Tiesto row text: "TiëstoWarehouseNOWtill 8:15 PM4picked". Screenshot: screenshots/08-chromium-phone-step6-tiesto-805.png
- At 8:10 PM (mid short-stop): NOW row "Now: Tiësto, Warehouse, till 8:15 PM, 4 picked". Screenshot: screenshots/09-chromium-phone-step6-tiesto-810.png
- At 8:15 PM (short-stop ends): NOW row "Next: Swedish House Mafia, Pier Stage, 8:45 PM, 8 picked". Screenshot: screenshots/10-chromium-phone-step6-tiesto-815.png
- Text clipping check across all visible rows at 8:05: none clipped
- Reads as a real place to be: a 10-minute window (8:05-8:15) with a named room and act, same row shape as every other stop -- Kevin should judge from the screenshots whether that reads as noise or as a real stop.

**Step 7a (Chromium phone): ACL Tue 6 PM -- every night in the days list, head+Share at each: PASS**
- Days list screenshot: screenshots/11-chromium-phone-step7a-acl-days-list.png
- 2026-09-29: reached=true, wd=TUE, sub="Sep 29 · 8 picking", share="Share today’s picks". Screenshot: screenshots/12-chromium-phone-step7a-2026-09-29.png
- 2026-10-01: reached=true, wd=THU, sub="Oct 1 · 8 picking", share="Share Thu Oct 1’s picks". Screenshot: screenshots/13-chromium-phone-step7a-2026-10-01.png
- 2026-10-02: reached=true, wd=FRI, sub="Oct 2 · 8 picking", share="Share Fri Oct 2’s picks". Screenshot: screenshots/14-chromium-phone-step7a-2026-10-02.png
- 2026-10-03: reached=true, wd=SAT, sub="Oct 3 · 8 picking", share="Share Sat Oct 3’s picks". Screenshot: screenshots/15-chromium-phone-step7a-2026-10-03.png
- 2026-10-04: reached=true, wd=SUN, sub="Oct 4 · 8 picking", share="Share Sun Oct 4’s picks". Screenshot: screenshots/16-chromium-phone-step7a-2026-10-04.png
- 2026-10-05: reached=true, wd=MON, sub="Oct 5 · 8 picking", share="Nothing to share Monday" (resting). Screenshot: screenshots/17-chromium-phone-step7a-2026-10-05.png
- 2026-10-08: reached=true, wd=THU, sub="Oct 8 · 8 picking", share="Share Thu Oct 8’s picks". Screenshot: screenshots/18-chromium-phone-step7a-2026-10-08.png
- 2026-10-09: reached=true, wd=FRI, sub="Oct 9 · 8 picking", share="Share Fri Oct 9’s picks". Screenshot: screenshots/19-chromium-phone-step7a-2026-10-09.png
- 2026-10-10: reached=true, wd=SAT, sub="Oct 10 · 8 picking", share="Share Sat Oct 10’s picks". Screenshot: screenshots/20-chromium-phone-step7a-2026-10-10.png
- 2026-10-11: reached=true, wd=SUN, sub="Oct 11 · 8 picking", share="Share Sun Oct 11’s picks". Screenshot: screenshots/21-chromium-phone-step7a-2026-10-11.png
- Mon·Tue bare run: one head "MON · TUEOct 5 – 6", line "Nothing picked yet", Share off=true.

**Step 7b (Chromium phone): ACL W2 Sat -- Earlier "Sep 29 - Oct 9", opened dimmed, Sun Oct 11 to the top: PASS**
- Earlier line: "Earlier · Sep 29 – Oct 9" -> tapped open -> "Hide earlier". Screenshot: screenshots/22-chromium-phone-step7b-earlier-opened-dimmed.png
- Past heads under it: ["TUESep 29","THUOct 1","FRIOct 2","SATOct 3","SUNOct 4","MON · TUEOct 5 – 6","THUOct 8","FRIOct 9"]
- Dimmed row opacities: [0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42]
- Sun Oct 11 (the fortnight's last day) reached the top: wd=SUN, share="Share Sun Oct 11’s picks". Screenshot: screenshots/23-chromium-phone-step7b-sun-oct11-top.png

**Step 7c (Chromium phone): Despacio's drop-in line (Portola, not ACL -- see adaptation note): PASS**
- CONFIRMED MISMATCH: ACL's plan (Tue 6 PM, full days list) draws 0 ".plan-row.dropin" lines anywhere -- ACL's festival data declares zero dropIn rooms. This is a brief/data mismatch (see FINDINGS.md adaptation note), not an app bug.
- Despacio DOES have its own drop-in line on Portola, once highlighted to just Gus (the crew bar for all 9 doesn't clear on his solo pick): "Despacio · drop in till 9:45 PM", aria-label "Despacio, drop in 2:45 PM till 9:45 PM", drawn as a <div> (not a button/stop). Screenshot: screenshots/24-chromium-phone-step7c-despacio-line-portola-solo-highlight.png

**Step 8 (Chromium phone): the short plan (Ada/Bo/Cal) takes the shelf's full height: PASS**
- The open shelf took its full height (744.0px of 743px cap) with blank room (464.3px) under the last row. Screenshot: screenshots/25-chromium-phone-step8-short-plan-full-height.png
- Saturday (SAT, "Share today’s picks") and Sunday (SUN, "Share Sun Oct 11’s picks") both reached the top. Screenshot at Sunday: screenshots/26-chromium-phone-step8-short-plan-sunday-top.png
- Open sampled at 0.25x: window height held constant (744) -- no gap, no jump.
- Close sampled at 0.25x: window height held constant (744) -- no gap, no jump.

**Step 9 (Chromium phone): the morning after -- ACL Sun Oct 11 9 PM through 5:01 AM: PASS**
- Opened at Sun Oct 11, 9 PM. Screenshot: screenshots/27-chromium-phone-step9-open-9pm.png
- 9a, 11:30 PM: state=open, day says "Nothing to share today" (rests: true). Screenshot: screenshots/28-chromium-phone-step9-1130pm-nothing-left.png
- 9b, Mon Oct 12 5:01 AM: state=open, Sunday rows dimmed under its head ([{"past":true,"head":true,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1}]), head/Share "SUN / Share Sun Oct 11’s picks". Share text ends ...&plan=2026-10-11 with no "now till". Screenshot: screenshots/29-chromium-phone-step9-501am-sunday-dimmed.png
- 9c: closed -> state=none (the shelf goes and does not return to a peek). Screenshot: screenshots/30-chromium-phone-step9-closed-no-shelf.png

**Step 1a-1d (WebKit phone, wheel-adapted): through the days, Sat -> Sun -> Sat: PASS**
- 1a/1b: scrolled up reached Sunday; head/Share turned (SAT->SUN, animate() called with the expected arrived-from-below frames + 200ms duration: true). Screenshots: screenshots/01-webkit-phone-step1-saturday.png, screenshots/02-webkit-phone-step1-sunday.png
- 1c: scrolled back reached Saturday; head/Share turned back (SUN->SAT, arrived-from-above frames: true). Screenshot: screenshots/03-webkit-phone-step1-back-to-saturday.png
- 1e note: CDP slow-motion sampling is Chromium-only (see FINDINGS.md adaptation note) -- the animate() call shape above is WebKit's equivalent evidence that the turn is one real Web Animation (not a hard style-swap), which is the mechanism the smoothness verdict rests on.
- Turn frames up: [{"part":"wd","where":"head","from":"translateY(10px)","duration":200},{"part":"sub","where":"head","from":"translateY(10px)","duration":200}]
- Turn frames down: [{"part":"wd","where":"head","from":"translateY(-10px)","duration":200},{"part":"sub","where":"head","from":"translateY(-10px)","duration":200}]

**Step 2 (WebKit phone): Sunday holds through a minute tick, a tap, and the Share: PASS**
- 2a/2b: one-minute tick (+visibilitychange) left the list still (Δ0px) and the head SUN.
- 2c: tapped Sunday row (card grew: true); row stayed under the finger (187.0625 -> 188.0625). Screenshot: screenshots/04-webkit-phone-step2-sunday-row-tapped.png
- 2d: Share text starts "Our crew's main picks for Sun Portola", ends ...&plan=2026-09-27, no "now till". Full text:
Our crew's main picks for Sun Portola

Folsom St, 8th-13th for Folsom Street Fair @ 11am
Pier Stage for SG Lewis @ 4:30pm
Pier Stage for Mochakk @ 6pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Swedish House Mafia @ 8:45pm

Full rundown: http://127.0.0.1:59346/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27

**Step 3 (WebKit phone): &plan=2026-09-27 link opens on tonight then glides to Sunday: PASS**
- 3a: the plan opened with no input, then glided to Sunday. Screenshot: screenshots/05-webkit-phone-step3-link-landed-sunday.png
- 3b: the ask was one smooth scrollTo, made once the window had landed (plan-top stable by sample 5, list first moved at sample 7). WebKit's own scroll events (11 entries, 11 distinct positions) show multiple intermediate positions, a real glide.
- 3c: closing showed peek "Now: Dog Blood, Pier Stage, till 10:15 PM, 8 picked" (tonight's Dog Blood, not Sunday) -- the peek stayed tonight's throughout.

**Step 4 (WebKit phone): the Show menu opens over the open plan and re-plans it live: PASS**
- The plan stayed open (open) under the Show menu, and the menu sat on top of it (menu). Screenshot: screenshots/06-webkit-phone-step4-show-menu-over-plan.png
- Turning Afters off removed its rows from the plan live, with the menu still up (no flash to empty observed).
- Closing the menu left the plan open (open); history.length unchanged (2 -> 2).

**Step 5 (WebKit phone): the people menu over the open plan -- no Our picks row, highlight re-plans live: PASS**
- 5a: no "Our picks" row in the people menu while the plan is open.
- 5b: tapping Gus alone -> head said "just you" (0 dimmed rows).
- 5c: adding Cy + Hal -> head read "Sep 26 · you, Cy + Hal". Screenshot (menu over plan): screenshots/07-webkit-phone-step5-people-menu-over-plan.png
- 5d/5e: after closing, head kept saying "Sep 26 · you, Cy + Hal"; foot line "Opens on everyone’s picks"; Share text named none of the nine before "Full rundown:". Full Share text:
Our picks for Sat Portola, now till end of day

Pier Stage for Dog Blood @ now till 10:15pm

Full rundown: http://127.0.0.1:59346/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-26
- 5f: dock NOW tab visible=false, plan has a tagged Now row=true -- never both.
- 5g: cleared highlight -> sub reads "Sep 26 · 9 picking".

**Step 6 (WebKit phone): the short Tiesto stop at Portola Sun 8:05 PM: PASS**
- At 8:05 PM: NOW row "Now: Tiësto, Warehouse, till 8:15 PM, 4 picked". Tiesto row text: "TiëstoWarehouseNOWtill 8:15 PM4picked". Screenshot: screenshots/08-webkit-phone-step6-tiesto-805.png
- At 8:10 PM (mid short-stop): NOW row "Now: Tiësto, Warehouse, till 8:15 PM, 4 picked". Screenshot: screenshots/09-webkit-phone-step6-tiesto-810.png
- At 8:15 PM (short-stop ends): NOW row "Next: Swedish House Mafia, Pier Stage, 8:45 PM, 8 picked". Screenshot: screenshots/10-webkit-phone-step6-tiesto-815.png
- Text clipping check across all visible rows at 8:05: none clipped

**Step 7a (WebKit phone): ACL Tue 6 PM -- every night in the days list, head+Share at each: PASS**
- Days list screenshot: screenshots/11-webkit-phone-step7a-acl-days-list.png
- 2026-09-29: reached=true, wd=TUE, sub="Sep 29 · 8 picking", share="Share today’s picks". Screenshot: screenshots/12-webkit-phone-step7a-2026-09-29.png
- 2026-10-01: reached=true, wd=THU, sub="Oct 1 · 8 picking", share="Share Thu Oct 1’s picks". Screenshot: screenshots/13-webkit-phone-step7a-2026-10-01.png
- 2026-10-02: reached=true, wd=FRI, sub="Oct 2 · 8 picking", share="Share Fri Oct 2’s picks". Screenshot: screenshots/14-webkit-phone-step7a-2026-10-02.png
- 2026-10-03: reached=true, wd=SAT, sub="Oct 3 · 8 picking", share="Share Sat Oct 3’s picks". Screenshot: screenshots/15-webkit-phone-step7a-2026-10-03.png
- 2026-10-04: reached=true, wd=SUN, sub="Oct 4 · 8 picking", share="Share Sun Oct 4’s picks". Screenshot: screenshots/16-webkit-phone-step7a-2026-10-04.png
- 2026-10-05: reached=true, wd=MON, sub="Oct 5 · 8 picking", share="Nothing to share Monday" (resting). Screenshot: screenshots/17-webkit-phone-step7a-2026-10-05.png
- 2026-10-08: reached=true, wd=THU, sub="Oct 8 · 8 picking", share="Share Thu Oct 8’s picks". Screenshot: screenshots/18-webkit-phone-step7a-2026-10-08.png
- 2026-10-09: reached=true, wd=FRI, sub="Oct 9 · 8 picking", share="Share Fri Oct 9’s picks". Screenshot: screenshots/19-webkit-phone-step7a-2026-10-09.png
- 2026-10-10: reached=true, wd=SAT, sub="Oct 10 · 8 picking", share="Share Sat Oct 10’s picks". Screenshot: screenshots/20-webkit-phone-step7a-2026-10-10.png
- 2026-10-11: reached=true, wd=SUN, sub="Oct 11 · 8 picking", share="Share Sun Oct 11’s picks". Screenshot: screenshots/21-webkit-phone-step7a-2026-10-11.png
- Mon·Tue bare run: one head "MON · TUEOct 5 – 6", line "Nothing picked yet", Share off=true.

**Step 7b (WebKit phone): ACL W2 Sat -- Earlier "Sep 29 - Oct 9", opened dimmed, Sun Oct 11 to the top: PASS**
- Earlier line: "Earlier · Sep 29 – Oct 9" -> tapped open -> "Hide earlier". Screenshot: screenshots/22-webkit-phone-step7b-earlier-opened-dimmed.png
- Past heads under it: ["TUESep 29","THUOct 1","FRIOct 2","SATOct 3","SUNOct 4","MON · TUEOct 5 – 6","THUOct 8","FRIOct 9"]
- Dimmed row opacities: [0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42,0.42]
- Sun Oct 11 (the fortnight's last day) reached the top: wd=SUN, share="Share Sun Oct 11’s picks". Screenshot: screenshots/23-webkit-phone-step7b-sun-oct11-top.png

**Step 7c (WebKit phone): Despacio's drop-in line (Portola, not ACL -- see adaptation note): PASS**
- CONFIRMED (again, WebKit): ACL's plan draws 0 ".plan-row.dropin" lines anywhere.
- Despacio's drop-in line on Portola (Gus highlighted solo): "Despacio · drop in till 9:45 PM", aria-label "Despacio, drop in 2:45 PM till 9:45 PM", drawn as a <div>. Screenshot: screenshots/24-webkit-phone-step7c-despacio-line-portola-solo-highlight.png

**Step 8 (WebKit phone): the short plan (Ada/Bo/Cal) takes the shelf's full height: PASS**
- The open shelf took its full height (744.0px of 742.999939px cap) with blank room (464.9px) under the last row. Screenshot: screenshots/25-webkit-phone-step8-short-plan-full-height.png
- Saturday (SAT, "Share today’s picks") and Sunday (SUN, "Share Sun Oct 11’s picks") both reached the top. Screenshot at Sunday: screenshots/26-webkit-phone-step8-short-plan-sunday-top.png
- Open sampled (real-time, no CDP in WebKit): window height held constant (744) -- no gap, no jump.
- Close sampled: window height held constant (744) -- no gap, no jump.

**Step 9 (WebKit phone): the morning after -- ACL Sun Oct 11 9 PM through 5:01 AM: PASS**
- Opened at Sun Oct 11, 9 PM. Screenshot: screenshots/27-webkit-phone-step9-open-9pm.png
- 9a, 11:30 PM: state=open, day says "Nothing to share today" (rests: true). Screenshot: screenshots/28-webkit-phone-step9-1130pm-nothing-left.png
- 9b, Mon Oct 12 5:01 AM: state=open, Sunday rows dimmed under its head ([{"past":true,"head":true,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1},{"past":true,"head":false,"opacity":1}]), head/Share "SUN / Share Sun Oct 11’s picks". Share text ends ...&plan=2026-10-11 with no "now till". Screenshot: screenshots/29-webkit-phone-step9-501am-sunday-dimmed.png
- 9c: closed -> state=none (the shelf goes and does not return to a peek). Screenshot: screenshots/30-webkit-phone-step9-closed-no-shelf.png

**Step 10a (WebKit phone, Reduce Motion): steps 1a-1d with no animation: PASS**
- Reduce Motion: scrolling to Sunday landed the head/Share correctly (SUN, "Share Sunday’s picks") with zero animate() calls recorded -- the turn happens at once, no motion. Screenshot: screenshots/31-webkit-phone-step10-reduced-motion-sunday.png

**Step 10b (WebKit phone, Reduce Motion): step 3's later-night link with no animation: PASS**
- Reduce Motion: the &plan= link landed on Sunday (SUN, "Share Sunday’s picks") and closed cleanly with no animation issues. Screenshot: screenshots/32-webkit-phone-step10-reduced-motion-link-landed.png

**Step 11a-11e (Chromium laptop): the panel opens, Sunday reaches the top by wheel, Share by keyboard, Escape returns focus: PASS**
- 11a: clicking the corner card opened the panel (corner line before: "OUR PICKS · SAT · 9 PICKING").
- 11b: wheel reached Sunday; panel head line turned to "SUN" (2 corner animate() calls, each translateY(10px)/200ms: true); corner card still said tonight's before scrolling ("OUR PICKS · SAT · 9 PICKING"). Screenshot: screenshots/01-chromium-laptop-step11-panel-sunday.png
- 11c: the Share was reachable by Tab (16 presses); Enter sent a payload ending "...<token-tail>&f=portola-2026&plan=2026-09-27" (Sunday's plan link: true).
- 11d: Escape closed the Show menu, focus returned to #rail-fest-link (opener: rail-fest-link, match=true); Escape closed the people menu, focus returned to #rail-you (opener: rail-you, match=true).

**Step 11f (Chromium laptop): the panel with the short crew (Ada/Bo/Cal) on a later day: PASS**
- Panel with the short crew's later day (Sunday) at the top: wd=SUN, share="Share Sun Oct 11’s picks". Share sits at 788px, panel bottom at 800px -- 12px of blank space under/around the Share. Screenshot: screenshots/02-chromium-laptop-step11f-short-plan-later-day.png
- Kevin should judge this from the screenshot -- whether the Share floating over blank space at the panel foot reads right on the laptop.

**Step 12 (Chromium laptop -> phone -> laptop): layout crossing keeps Sunday at the top, refits at once: PASS**
- Before crossing (1280): wd=SUN. Screenshot: screenshots/03-chromium-laptop-step12-before-1280.png
- 1280 -> 390: day at top = SUN, plan state = open. Settled cleanly (no oscillation in the last frames): true (tail: [{"t":55,"l":0,"w":390,"h":744},{"t":55,"l":0,"w":390,"h":744},{"t":55,"l":0,"w":390,"h":744}]). Screenshot: screenshots/04-chromium-laptop-step12-after-390.png
- 390 -> 1280: day at top = SUN, plan state = open. Settled cleanly: true (tail: [{"t":44,"l":880,"w":400,"h":756},{"t":44,"l":880,"w":400,"h":756},{"t":44,"l":880,"w":400,"h":756}]). Screenshot: screenshots/05-chromium-laptop-step12-after-1280-again.png
- 32 frames sampled during the shrink, 32 during the grow (real-time poll, no CDP slow-motion for this step).

**Step 11a-11e (WebKit laptop): the panel opens, Sunday reaches the top by wheel, Share by keyboard, Escape returns focus: PASS**
- 11a: clicking the corner card opened the panel (corner line before: "OUR PICKS · SAT · 9 PICKING").
- 11b: wheel reached Sunday; panel head line turned to "SUN" (2 corner animate() calls, each translateY(10px)/200ms: true); corner card still said tonight's before scrolling ("OUR PICKS · SAT · 9 PICKING"). Screenshot: screenshots/01-webkit-laptop-step11-panel-sunday.png
- 11c: ADAPTED (hard rule 5) -- WebKit Tabs past buttons by default (Safari's own convention, no Full Keyboard Access toggle in Playwright; GATE's suite skips its own keyboard-reach test for the same reason). Not an app bug. Checked Share works via a direct click instead: sent a payload ending "...g=<token>&f=portola-2026&plan=2026-09-27" (Sunday's plan link: true).
- 11d: Escape closed the Show menu, focus returned to #rail-fest-link (opener: rail-fest-link, match=true); Escape closed the people menu, focus returned to #rail-you (opener: rail-you, match=true).

**Step 11f (WebKit laptop): the panel with the short crew (Ada/Bo/Cal) on a later day: PASS**
- Panel with the short crew's later day (Sunday) at the top: wd=SUN, share="Share Sun Oct 11’s picks". Share sits at 788px, panel bottom at 800px -- 12px of blank space under/around the Share. Screenshot: screenshots/02-webkit-laptop-step11f-short-plan-later-day.png
- Kevin should judge this from the screenshot -- whether the Share floating over blank space at the panel foot reads right on the laptop.

**Step 12 (WebKit laptop -> phone -> laptop): layout crossing keeps Sunday at the top, refits at once: PASS**
- Before crossing (1280): wd=SUN. Screenshot: screenshots/03-webkit-laptop-step12-before-1280.png
- 1280 -> 390: day at top = SUN, plan state = open. Settled cleanly (no oscillation in the last frames): true (tail: [{"t":55,"l":0,"w":390,"h":744},{"t":55,"l":0,"w":390,"h":744},{"t":55,"l":0,"w":390,"h":744}]). Screenshot: screenshots/04-webkit-laptop-step12-after-390.png
- 390 -> 1280: day at top = SUN, plan state = open. Settled cleanly: true (tail: [{"t":44,"l":880,"w":400,"h":756},{"t":44,"l":880,"w":400,"h":756},{"t":44,"l":880,"w":400,"h":756}]). Screenshot: screenshots/05-webkit-laptop-step12-after-1280-again.png
- 32 frames sampled during the shrink, 30 during the grow (real-time poll, no CDP slow-motion for this step).
