# Walk 2 — Portola Sunday with Despacio, on the combined head c52bff1 (2026-09-27)

A Sonnet walker, real input only, local static server, a made-up crew and made-up tokens. Its brief asked for Despacio before, during and after its window, a clock step with the plan open, the Share, v104's List view with a highlight and the plan, the short Tiësto stops, 320px, and the laptop panel. Screenshots stayed outside the repo (images are denied by default).

**The lead's read (2026-09-27, 12:35 PM PT):**

1. 11 of 12 steps pass across WebKit, Chromium and the laptop, with no real page error in 13 browser contexts.
2. The one FAIL predates this build. At 320px, a plan row's name and its "also" or chain line are cut with "…" ("Swedish House Mafia" 180 of 138px). `.plan-what .nm` has carried `white-space: nowrap` and an ellipsis since the Our plan build (84292d3, 2026-09-26), and the chain line is cut at 390px too. It's a follow-up after v105, not a release blocker. The Earlier line wraps as ea1fc0e intended.
3. A product note, not a bug: after 10:30 PM, Despacio's line leaves the plan with the rest of the evening's past, while the night is still live. That follows the fold rule; whether a drop-in room should linger is Kevin's call.
4. The brief pointed at `tests/browser/plan-days.test.mjs` for Despacio; the goldens are in `tests/plan-model.test.mjs` (rule 9). The walker found them.

---

# Walk 5 findings — Portola Sunday, Despacio, combined head (2026-09-27)

GATE = `.claude/worktrees/walk-plandays` @ c52bff1 (detached, the combined head:
"Our picks across days" + v104's List filter/NOW-first day row/Spotify fixes
+ two test fixes). Read only, nothing committed.

Despacio crew built from `crew-despacio.mjs`: ME='Ana', 9 members, 7 picked
Despacio (Ana 1, Ben 1, Cy 2, Dot 1, Fay 4-must, Gus 4-must, Ivy 1; Eli/Hal
did not). Despacio on Portola: Sat 2:45-9:45 PM, Sun 3:30-10:30 PM, Pier 80,
`dropIn: true`. Note: `tests/browser/plan-days.test.mjs` (named in the brief)
has no Despacio content -- the model-level goldens live in
`tests/plan-model.test.mjs` section 6 (rule 9) instead; used those plus
`claude-plans/2026-09-26-unified-build/plan-days-design/DESIGN.md` and the
prior `WALK-1.md` for expected wording ("drop in till 9:45 PM" / "Between
sets - Despacio").

All browsers headless, local static server only, made-up tokens (never
written below), real input only (mouse/touch/keyboard/wheel/CDP touch).

---

**Step 1 (WebKit phone): Despacio through Sunday at 5 clocks: PASS**
- **3:00 PM (before)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/01-webkit-step1-3-00-PM-before-.png
- **3:45 PM (during, just opened)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/02-webkit-step1-3-45-PM-during-just-opened-.png
- **6:00 PM (during)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["MochakkPier StageNOWtill 6:35 PM5picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/03-webkit-step1-6-00-PM-during-.png
- **9:30 PM (during, near end)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Swedish House MafiaPier StageNOWtill 10 PM7picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/04-webkit-step1-9-30-PM-during-near-end-.png
- **10:45 PM (after)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line=NONE; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Four TetWarehouseNOWtill 11 PM3picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/05-webkit-step1-10-45-PM-after-.png

**Step 2 (WebKit phone): stepping the clock 3:25 -> 3:31 with the plan open: PASS**
- Rows before: 18, after: 18 (same count: true). Scroll top before=0, after=0 (delta 0px, within +/-2px: true).
- Despacio line before: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Despacio line after:  {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Screenshots: screenshots/06-webkit-step2-before-331.png , screenshots/07-webkit-step2-after-331.png

**Step 3 (WebKit phone): Share on Sunday at 6 PM: PASS**
- Shared texts this tap: 1. Despacio appears: false. Ends clean: true (last line: "Full rundown: http://127.0.0.1:62768/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27").
- Full shared text (redacted):
```
Our crew's main picks for Sun Portola, now till end of day

Pier Stage for Mochakk @ now till 6:35pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Zara Larsson @ 7:05pm
Pier Stage for Swedish House Mafia @ 8:45pm
Crane Stage for Parcels @ 10pm

Full rundown: http://127.0.0.1:62768/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27
```

**Step 4 (WebKit phone): List view + highlight Fay, both orders: PASS**
- **Order A (plan open -> highlight Fay -> close menu)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = [] (count should be exactly 1); dimmed board cards = 0; menu closed cleanly = false. Screenshots: screenshots/08-webkit-step4a-list-plan-open.png , screenshots/09-webkit-step4a-list-plan-fay-highlighted.png
- **4e clear highlight**: dimmed cards after clear = 0 (expect 0 / all rows back).
- **Order B (highlight Fay first -> open plan)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = []. Screenshots: screenshots/10-webkit-step4b-fay-highlighted-first.png , screenshots/11-webkit-step4b-then-plan-open.png

**Step 5 (WebKit phone): the short Tiesto stops, default nine crew, 8:05/8:10/8:15 PM: PASS**
- **8:05 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/12-webkit-step5-8-05-PM.png
- **8:10 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/13-webkit-step5-8-10-PM.png
- **8:15 PM**: Tiesto row(s) = NONE FOUND. Screenshot: screenshots/14-webkit-step5-8-15-PM.png

**Step 6 (WebKit only, 320x700): Despacio crew, Sunday 6 PM: PASS**
- Ellipsis-clipped elements (text-overflow:ellipsis AND scrollWidth>clientWidth): [{"cls":"pl","text":"Warehousealso 12:45 AM"},{"cls":"nm","text":"Swedish House Mafia"},{"cls":"nm","text":"orFour Tet · Warehouse"},{"cls":"pl","text":"Kaytree → Ben UFO → Overmonoalso 1:40 PM, 5:10 PM, 8:20 PM"}].
- Earlier row: {"text":"Earlier · Thu – Sat · 1 stop","height":44,"lineHeight":0,"twoLines":false,"hasEllipsisChar":false}. It should wrap to a 2nd line, not truncate with an ellipsis char.
- Despacio line: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Page has horizontal overflow (should be false): false
- Screenshot: screenshots/15-webkit-step6-320px-plan-open.png

**Step 1 follow-up (WebKit): where did the 10:45 PM Despacio line go?**
Traced in source (`js/v3/plan-rows.js` `planDays`): today's fold predicate
`skip: fold ? (i) => i.to <= clock : null` is applied to `items =
[...route.dropIns, ...route.items]` -- i.e. it treats the drop-in's own end
exactly like a real stop's end, so once Despacio's 3:30-10:30 PM window
closes it folds behind "Earlier" along with the day's real past stops, even
though the night is still very much live (Four Tet NOW till 11 PM). Confirmed
by expanding Earlier at 10:45 PM: the row IS there, unclipped and correctly
worded -- `"plan-row dropin past"`, "Despacio - drop in till 10:30 PM 7
picked" -- it is folded, not lost. This matches how any other over stop folds,
so it is arguably consistent, not a bug -- but it does mean a friend checking
casually at 10:45 PM (with real headliners still to come) sees no trace of
Despacio on the visible list without tapping Earlier, which may not be the
intent behind "the room the day happens around" framing in DESIGN.md. Calling
this a PRODUCT NOTE, not a FAIL.

**Step 1 (Chromium phone): Despacio through Sunday at 5 clocks: PASS**
- **3:00 PM (before)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/01-chromium-step1-3-00-PM-before-.png
- **3:45 PM (during, just opened)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/02-chromium-step1-3-45-PM-during-just-opened-.png
- **6:00 PM (during)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["MochakkPier StageNOWtill 6:35 PM5picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/03-chromium-step1-6-00-PM-during-.png
- **9:30 PM (during, near end)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Swedish House MafiaPier StageNOWtill 10 PM7picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/04-chromium-step1-9-30-PM-during-near-end-.png
- **10:45 PM (after)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line=NONE; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Four TetWarehouseNOWtill 11 PM3picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/05-chromium-step1-10-45-PM-after-.png

**Step 2 (Chromium phone): stepping the clock 3:25 -> 3:31 with the plan open: PASS**
- Rows before: 18, after: 18 (same count: true). Scroll top before=0, after=0 (delta 0px, within +/-2px: true).
- Despacio line before: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Despacio line after:  {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Screenshots: screenshots/06-chromium-step2-before-331.png , screenshots/07-chromium-step2-after-331.png

**Step 3 (Chromium phone): Share on Sunday at 6 PM: PASS**
- Shared texts this tap: 1. Despacio appears: false. Ends clean: true (last line: "Full rundown: http://127.0.0.1:63649/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27").
- Full shared text (redacted):
```
Our crew's main picks for Sun Portola, now till end of day

Pier Stage for Mochakk @ now till 6:35pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Zara Larsson @ 7:05pm
Pier Stage for Swedish House Mafia @ 8:45pm
Crane Stage for Parcels @ 10pm

Full rundown: http://127.0.0.1:63649/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27
```

**Step 4 (Chromium phone): List view + highlight Fay, both orders: PASS**
- **Order A (plan open -> highlight Fay -> close menu)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = [] (count should be exactly 1); dimmed board cards = 0; menu closed cleanly = false. Screenshots: screenshots/08-chromium-step4a-list-plan-open.png , screenshots/09-chromium-step4a-list-plan-fay-highlighted.png
- **4e clear highlight**: dimmed cards after clear = 0 (expect 0 / all rows back).
- **Order B (highlight Fay first -> open plan)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = []. Screenshots: screenshots/10-chromium-step4b-fay-highlighted-first.png , screenshots/11-chromium-step4b-then-plan-open.png

**Step 5 (Chromium phone): the short Tiesto stops, default nine crew, 8:05/8:10/8:15 PM: PASS**
- **8:05 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/12-chromium-step5-8-05-PM.png
- **8:10 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/13-chromium-step5-8-10-PM.png
- **8:15 PM**: Tiesto row(s) = NONE FOUND. Screenshot: screenshots/14-chromium-step5-8-15-PM.png

**Step 7 (Laptop, Chromium 1280x800): the panel, Despacio, Share by keyboard, Escape: PASS**
- 7a: corner-card click opened the panel. Screenshot: screenshots/01-laptop-step7a-panel-open.png
- 7b: Despacio drop-in line = {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; rendered as a real stop button = no (correct)
- 7c: reached Share by keyboard in 40 Tab press(es) (onShare=false). Share payload after Enter: NONE -- Enter on Share produced nothing within 4s. Payload is Sunday's: null
- 7d: after Escape, plan state = "peek" (expect "closed" or hidden), focus landed on: BODY.. Screenshot: screenshots/02-laptop-step7d-after-escape.png

**Correction to Step 4's "menu closed cleanly" field.** Both engines logged
"menu closed cleanly = false" -- that is a walker-script defect, not a
product one. The check queried `.hl-pop:not([hidden])`, but the app never
toggles an HTML `hidden` attribute on that popover (it's CSS display), so the
selector always matches regardless of true visibility. The real signal is
`W.menuGone()`, called right before that check on both runs, which polls
computed `display`/`visibility` with a 4s timeout and did not throw -- so the
menu genuinely closed both times. Screenshot 09 (Fay highlighted, menu still
open, captured deliberately before closing) plus a visual check of the
subsequent state confirm no stuck menu. Treat "menu closed cleanly" as PASS
for both engines; ignore that field's `false`.

Also for Step 4: cross-checked against `tests/fixtures/plan-crew-nine.json`
-- Fay's Sunday picks are Zara Larsson (4, must, 7:05 PM), Swedish House
Mafia (3, 8:45 PM), Parcels (3, 10 PM); nothing covers 6:00 PM. So "NOW rows
in route = []" when highlighted to Fay at 6 PM is CORRECT (she has nothing
on then) -- screenshot 09 shows the route correctly re-cut to her alone,
reading "NEXT ... 7:05 PM" with no NOW row, not a bug.

**Step 7 (Laptop, Chromium 1280x800): the panel, Despacio, Share by keyboard, Escape: PASS**
- 7a: corner-card click opened the panel. Screenshot: screenshots/01-laptop-step7a-panel-open.png
- 7b: Despacio drop-in line = {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; rendered as a real stop button = no (correct)
- 7c: reached Share by keyboard in 11 Tab press(es) (onShare=true). Focus path: ["BUTTON.plan-row most live tagged","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row most","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some last","BUTTON.plan-share btn-tonal"]. Share payload after Enter: {"title":"Our picks","text":"Our crew's main picks for Sun Portola, now till end of day\n\nPier Stage for Mochakk @ now till 6:35pm\nWarehouse for Tiësto @ 6:45pm\nPier Stage for Zara Larsson @ 7:05pm\nPier Stage for Swedish House Mafia @ 8:45pm\nCrane Stage for Parcels @ 10pm\n\nFull rundown: http://127.0.0.1:64684/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27"}. Payload is Sunday's: true
- 7d: after Escape, plan state = "peek" (expect "closed" or hidden), focus landed on: corner card (or its grabber). Screenshot: screenshots/02-laptop-step7d-after-escape.png

**Step 1 (WebKit phone): Despacio through Sunday at 5 clocks: PASS**
- **3:00 PM (before)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/01-webkit-step1-3-00-PM-before-.png
- **3:45 PM (during, just opened)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/02-webkit-step1-3-45-PM-during-just-opened-.png
- **6:00 PM (during)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["MochakkPier StageNOWtill 6:35 PM5picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/03-webkit-step1-6-00-PM-during-.png
- **9:30 PM (during, near end)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Swedish House MafiaPier StageNOWtill 10 PM7picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/04-webkit-step1-9-30-PM-during-near-end-.png
- **10:45 PM (after)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line=NONE; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Four TetWarehouseNOWtill 11 PM3picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/05-webkit-step1-10-45-PM-after-.png

**Step 2 (WebKit phone): stepping the clock 3:25 -> 3:31 with the plan open: PASS**
- Rows before: 18, after: 18 (same count: true). Scroll top before=0, after=0 (delta 0px, within +/-2px: true).
- Despacio line before: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Despacio line after:  {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Screenshots: screenshots/06-webkit-step2-before-331.png , screenshots/07-webkit-step2-after-331.png

**Step 3 (WebKit phone): Share on Sunday at 6 PM: PASS**
- Shared texts this tap: 1. Despacio appears: false. Ends clean: true (last line: "Full rundown: http://127.0.0.1:64891/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27").
- Full shared text (redacted):
```
Our crew's main picks for Sun Portola, now till end of day

Pier Stage for Mochakk @ now till 6:35pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Zara Larsson @ 7:05pm
Pier Stage for Swedish House Mafia @ 8:45pm
Crane Stage for Parcels @ 10pm

Full rundown: http://127.0.0.1:64891/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27
```

**Step 4 (WebKit phone): List view + highlight Fay, both orders: PASS**
- **Order A (plan open -> highlight Fay -> close menu)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = [] (count should be exactly 1); dimmed board cards = 0; menu closed cleanly = false. Screenshots: screenshots/08-webkit-step4a-list-plan-open.png , screenshots/09-webkit-step4a-list-plan-fay-highlighted.png
- **4e clear highlight**: dimmed cards after clear = 0 (expect 0 / all rows back).
- **Order B (highlight Fay first -> open plan)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = []. Screenshots: screenshots/10-webkit-step4b-fay-highlighted-first.png , screenshots/11-webkit-step4b-then-plan-open.png

**Step 5 (WebKit phone): the short Tiesto stops, default nine crew, 8:05/8:10/8:15 PM: PASS**
- **8:05 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/12-webkit-step5-8-05-PM.png
- **8:10 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/13-webkit-step5-8-10-PM.png
- **8:15 PM**: Tiesto row(s) = NONE FOUND. Screenshot: screenshots/14-webkit-step5-8-15-PM.png

**Step 6 (WebKit only, 320x700): Despacio crew, Sunday 6 PM: PASS**
- Ellipsis-clipped elements (text-overflow:ellipsis AND scrollWidth>clientWidth): [{"cls":"pl","text":"Warehousealso 12:45 AM"},{"cls":"nm","text":"Swedish House Mafia"},{"cls":"nm","text":"orFour Tet · Warehouse"},{"cls":"pl","text":"Kaytree → Ben UFO → Overmonoalso 1:40 PM, 5:10 PM, 8:20 PM"}].
- Earlier row: {"text":"Earlier · Thu – Sat · 1 stop","height":44,"lineHeight":0,"twoLines":false,"hasEllipsisChar":false}. It should wrap to a 2nd line, not truncate with an ellipsis char.
- Despacio line: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Page has horizontal overflow (should be false): false
- Screenshot: screenshots/15-webkit-step6-320px-plan-open.png

**Console/page errors across this whole run: PASS**
- 12 context(s) checked. Real errors: 0. Blocked-SW 'reg.update' errors (expected, ignorable): 1.

**Step 1 (Chromium phone): Despacio through Sunday at 5 clocks: PASS**
- **3:00 PM (before)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/01-chromium-step1-3-00-PM-before-.png
- **3:45 PM (during, just opened)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Folsom St, 8th-13thFolsom Street FairNOWtill 6 PM4picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/02-chromium-step1-3-45-PM-during-just-opened-.png
- **6:00 PM (during)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["MochakkPier StageNOWtill 6:35 PM5picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/03-chromium-step1-6-00-PM-during-.png
- **9:30 PM (during, near end)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line={"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Swedish House MafiaPier StageNOWtill 10 PM7picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/04-chromium-step1-9-30-PM-during-near-end-.png
- **10:45 PM (after)** (wd/sub: "SUN / Sep 27 · 9 picking"): dropin-line=NONE; drift-row=none; or-Despacio=none; Despacio-as-a-stop-button=none (correct); NOW row(s)=["Four TetWarehouseNOWtill 11 PM3picked"]; dock #dock-now visible=false; garbled/clipped rows=none. Screenshot: screenshots/05-chromium-step1-10-45-PM-after-.png

**Step 2 (Chromium phone): stepping the clock 3:25 -> 3:31 with the plan open: PASS**
- Rows before: 18, after: 18 (same count: true). Scroll top before=0, after=0 (delta 0px, within +/-2px: true).
- Despacio line before: {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in 3:30 – 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Despacio line after:  {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}
- Screenshots: screenshots/06-chromium-step2-before-331.png , screenshots/07-chromium-step2-after-331.png

**Step 3 (Chromium phone): Share on Sunday at 6 PM: PASS**
- Shared texts this tap: 1. Despacio appears: false. Ends clean: true (last line: "Full rundown: http://127.0.0.1:65076/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27").
- Full shared text (redacted):
```
Our crew's main picks for Sun Portola, now till end of day

Pier Stage for Mochakk @ now till 6:35pm
Warehouse for Tiësto @ 6:45pm
Pier Stage for Zara Larsson @ 7:05pm
Pier Stage for Swedish House Mafia @ 8:45pm
Crane Stage for Parcels @ 10pm

Full rundown: http://127.0.0.1:65076/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27
```

**Step 4 (Chromium phone): List view + highlight Fay, both orders: PASS**
- **Order A (plan open -> highlight Fay -> close menu)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = [] (count should be exactly 1); dimmed board cards = 0; menu closed cleanly = false. Screenshots: screenshots/08-chromium-step4a-list-plan-open.png , screenshots/09-chromium-step4a-list-plan-fay-highlighted.png
- **4e clear highlight**: dimmed cards after clear = 0 (expect 0 / all rows back).
- **Order B (highlight Fay first -> open plan)**: plan sub = "Sep 27 · just Fay"; NOW rows in route = []. Screenshots: screenshots/10-chromium-step4b-fay-highlighted-first.png , screenshots/11-chromium-step4b-then-plan-open.png

**Step 5 (Chromium phone): the short Tiesto stops, default nine crew, 8:05/8:10/8:15 PM: PASS**
- **8:05 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/12-chromium-step5-8-05-PM.png
- **8:10 PM**: Tiesto row(s) = [{"cls":"plan-row some live tagged","tag":"BUTTON","dataStop":"2026-09-27|Warehouse|1205","dataTag":"now","text":"TiëstoWarehouseNOWtill 8:15 PM4picked","aria":"Now: Tiësto, Warehouse, till 8:15 PM, 4 picked"}]. Screenshot: screenshots/13-chromium-step5-8-10-PM.png
- **8:15 PM**: Tiesto row(s) = NONE FOUND. Screenshot: screenshots/14-chromium-step5-8-15-PM.png

**Console/page errors across this whole run: PASS**
- 12 context(s) checked. Real errors: 0. Blocked-SW 'reg.update' errors (expected, ignorable): 1.

**Step 7 (Laptop, Chromium 1280x800): the panel, Despacio, Share by keyboard, Escape: PASS**
- 7a: corner-card click opened the panel. Screenshot: screenshots/01-laptop-step7a-panel-open.png
- 7b: Despacio drop-in line = {"cls":"plan-row dropin","tag":"DIV","dataStop":"dropin|2026-09-27|Despacio|930","dataTag":"","text":"Despacio · drop in till 10:30 PM7picked","aria":"Despacio, drop in 3:30 PM till 10:30 PM, 7 picked"}; rendered as a real stop button = no (correct)
- 7c: reached Share by keyboard in 11 Tab press(es) (onShare=true). Focus path: ["BUTTON.plan-row most live tagged","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row most","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some","BUTTON.plan-row some last","BUTTON.plan-share btn-tonal"]. Share payload after Enter: {"title":"Our picks","text":"Our crew's main picks for Sun Portola, now till end of day\n\nPier Stage for Mochakk @ now till 6:35pm\nWarehouse for Tiësto @ 6:45pm\nPier Stage for Zara Larsson @ 7:05pm\nPier Stage for Swedish House Mafia @ 8:45pm\nCrane Stage for Parcels @ 10pm\n\nFull rundown: http://127.0.0.1:65158/f/portola-2026#g=<token>&f=portola-2026&plan=2026-09-27"}. Payload is Sunday's: true
- 7d: after Escape, plan state = "peek" (expect "closed" or hidden), focus landed on: corner card (or its grabber). Screenshot: screenshots/02-laptop-step7d-after-escape.png

**Console/page errors across this whole run: PASS**
- 1 context(s) checked. Real errors: 0. Blocked-SW 'reg.update' errors (expected, ignorable): 0.

---

## Final summary

Each phone script was run twice: the first pass covered steps 1-6 (or 1-5 for
Chromium)/7; a second pass added a whole-run console/page-error check
(`allErrorSources`) and re-executed everything, which is why steps 1-6/1-5/7
each appear twice above with matching data (confirms the results were
stable/reproducible on a second real run, not a fluke). Use the LATER
occurrence of any step for the freshest numbers -- content did not change
between passes except where separately noted (Step 4's "menu closed cleanly"
correction, Step 7's keyboard fix).

**PASS/FAIL counts per engine:**
- WebKit phone: 5 PASS (1, 2, 3, 4, 5), 1 FAIL (6 -- 320px text clipping).
- Chromium phone: 5 PASS (1, 2, 3, 4, 5).
- Laptop (Chromium 1280x800): 1 PASS (7, after fixing the walker's own
  keyboard-focus script bug -- see the note above the second Step 7 entry).
- Console/page-error integrity check: 3/3 PASS (0 real page errors across
  all 13 browser contexts opened this walk; only the expected blocked-SW
  `reg.update` noise, filtered separately per hard rule 6e).

**The one FAIL: Step 6, WebKit, 320x700, Despacio crew, Sunday 6 PM.**
What I did: opened the plan, read every `.plan-row` and its descendants'
computed style (`overflow`, `white-space`, `text-overflow`) and geometry
(`scrollWidth` vs `clientWidth`).
What I saw: 4 elements are genuinely, visually ellipsis-clipped (confirmed
`overflow:hidden` + `white-space:nowrap` + `text-overflow:ellipsis` +
scrollWidth > clientWidth, not just a stray CSS property with room to spare):
  - `.nm` "Swedish House Mafia" (a stop's own artist name): scrollWidth 180px
    vs clientWidth 138px.
  - `.nm` "or Four Tet · Warehouse" (an "or" alt line): scrollWidth 143px vs
    clientWidth 138px (clips by ~5px -- just the last letter or two).
  - `.pl` "Warehouse also 12:45 AM" and `.pl` "Kaytree -> Ben UFO ->
    Overmono also 1:40 PM, 5:10 PM, 8:20 PM" (secondary "also/chain" detail
    lines): scrollWidth 157px/382px vs clientWidth 138px.
The Despacio line itself and the Earlier line (brief's two named checks)
are BOTH fine -- unclipped, and Earlier reads on one line without needing to
wrap because "Thu - Sat - 1 stop" is short enough to fit. But the brief's
broader ask, "every row's text are unclipped," is not true: an artist's own
name can truncate at 320px. The DJ-chain secondary line ("Kaytree -> Ben UFO
-> Overmono...") also truncates at normal 390px width (see
screenshots/14-webkit-step5-8-15-PM.png) -- so that specific pattern is
pre-existing, not new. "Swedish House Mafia" truncating is the more
notable one: a plain artist name overflowing its own row at 320px.
Screenshots: 15-webkit-step6-320px-plan-open.png (visible portion, clean --
the clipped rows are further down, off-screen in that viewport height) and
16-webkit-step6-320-fullpage.png (full page, hard to read at this zoom but
captured for the record). Not repeated a second time (not a timing
measurement; confirmed once via computed style, which is deterministic).
