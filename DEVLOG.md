# DEVLOG — festival-navigator

Newest first. One entry per meaningful unit of work.

## 2026-09-02 — the hover was fine; the shell was old. Then the two hazards under it, a contract that runs in a browser, and Kevin's phone notes

- **"Hover broken again" was a v75 shell judging v76 code.** Kevin's
  Diagnostics paste named the build (v75) and the branch alias; his tab had
  been open long enough that the browser never asked for a new worker, and
  the reload-once guard only covered a page's first 20 s. Real-input walks in
  his Chrome 152 of his exact sequences (hover, fast click on a resting card,
  a pick on the grown card, click·Escape·click, a held mouse, the Afters
  columns, a 24-card random walk) pass on v76 and reproduce his journal on
  v75. Fixed the delivery: index.html asks for a new worker on
  visibilitychange and every ten minutes, reloads when nothing is in
  progress, and raises a refresh toast otherwise. Lesson in CLAUDE.md: read
  the build line before believing a report.
- **Two latent hazards found while tracing, both real, both fixed.** (1)
  Chrome flips a focused card to `:focus-visible` after ANY keypress, Escape
  included, and the script `focus()` every pick makes inherits it — so
  click·Escape·click on one card grew a KEYBOARD zoom, which by design never
  closes on hover-out. card-facts.js now tracks the last input the document
  saw (a real key, or a press) and the focus route opens only after a key.
  (2) The long-press timer armed on a mouse: a slow click opened a
  touch-style zoom with the same stuck behaviour. Both pinned in jsdom
  (`zoom-modality`, `long-press`); intent 300 → 200 ms (Kevin: a beat long).
- **The hover contract runs in a real browser now, in CI.**
  `tests/browser/hover-contract.test.mjs` drives Playwright's input layer
  through Kevin's sequences against gallery.html (no network); `npm run
  test:browser`, a separate CI job with Chromium. Every "walked clean"
  before this was a script somebody ran by hand; the jsdom suite cannot see
  boundary events, removal blurs or focus heuristics, which is exactly where
  the zoom kept breaking with a green suite. Also swept every card on all
  four Portola days with the prior session's rig: 112 hoverable cards, 0
  misbehave.
- **Kevin's phone notes, in order.** The stage strip stuttered a frame
  behind the grid on his iPhone: it was a second scroller mirrored from
  scroll events; now it follows the lead grid by a CSS scroll-driven
  animation (WebKit 26 and Chromium 152 verified with real wheel input) or a
  transform where the engine lacks ScrollTimeline or motion is reduced. iOS
  raised the text callout on hold: WebKit only honours
  `-webkit-user-select`, now beside every `user-select: none`. Offline
  walked clean (worker precaches, offline reload shows the wall, an offline
  pick syncs when the network returns). "Buy Kevin a coffee ☕" sits at the
  foot of Settings → App. The Electric Forest "EVERYTHING ELSE" column is
  becoming a card section (an Opus agent, branch `ee-section-2`). Add-a-show
  is a proposal (`claude-plans/2026-09-02-add-a-show.md`) waiting on three
  calls.
- **Venue norms feed the run guesses.** 14 Sonnet researchers + 14
  refuters profiled every Portola Week room (routine close, late ceiling,
  doors-to-first-act, set lengths, sources; banked under
  `claude-plans/2026-09-02-venue-profiles/`); `data/venues/index.json` is the
  durable registry; `scripts/guess-run-times.mjs` turns doors + registry into
  set-time guesses as a reviewable diff, never at render time. Findings a
  data editor acted on (Kevin's calls): The Midway Sun prints 10pm–3am on
  19hz — recorded as an EVIDENCED guess (`close: 3 AM`, tilde kept, the
  listing as `closeSource`; the guesser honours it over the venue default);
  AXS's dedicated Doors field says Regency Sat 9 PM, not 10 — taken, the
  order door now points at AXS. NOT added: KAVARI. 19hz still lists them,
  but the Midway's own Tixr page and AXS both bill four names today (the
  Tixr slug still carries "kavari"; the canonical URL dropped it) — off the
  bill. The halls (Regency, GAMH) publish no close anywhere.

## 2026-09-01 (late) — the blink under every pick, and one rule for club nights

- **A pick on a focused card blinked the zoom, on production, since the
  bloom shipped.** Kevin's Diagnostics journal read "focus left the card"
  twice a second; the real-input trace showed why: click a resting card (it
  focuses), the next click on the grown card picks, `refreshCard` swaps the
  node, and Chrome fires the OLD node's blur from inside the removal steps —
  still attached, relatedTarget null. The zoom still pointed at the old node
  and closed; the hover intent re-grew it a beat later. Fixed in #14 by
  handing the fresh node to the zoom before the old one is removed (an
  `onSwap` on `refreshCard`; the rig mirrors it). The test replays Chrome's
  removal blur, red on the old order. Merged; prod v73; his sequence leaves
  the journal empty. Lesson banked in the walk rig: walk the sequences people
  use — nobody's walk had clicked the resting card first.
- **Every multi-artist venue-night in Portola's afters is a doors-time
  bill, not simultaneous sets.** Kevin: "it's a mix of all 3 ideas scattered
  around." The deck and the afters lanes go; a venue night is a vertical
  run; the main grid keeps lanes. Rebuild in progress on #16; the deck's
  panel stays in the back pocket (gallery picture + the commit that has it).

## 2026-09-01 — Promoted: the notes/desktop round is live, and the two follow-ups are queued

- **PR #13 squashed to main (b4f6283) on Kevin's "ya go"; prod is v71.**
  Threads, the bloom, per-fest link previews, the focus-blur click fix he
  confirmed, venue map doors, the crash journal + Diagnostics. The preview
  card is proven on the real host (`/f/portola-2026` → poster JPEG).
- **Ray's fork paid us back:** his `guard.mjs` floated the Gemini model and
  made the error name WHICH failure (404 model / 429 quota / key). Ported,
  credited. I first wrote that Google retires the pinned model for everyone
  on Oct 16 — wrong; that date is Vertex AI's lifecycle, and the Developer
  API page lists no date. What is true: new keys already 404 on it.
  `GEMINI_MODEL` now reads the environment first.
- **Two review-driven PRs from background Opus agents, both rebased onto
  the squash:** #14 (zoom: 59 tests written against the current code, then
  the four extractions an adversarial review proved safe; SW v72; gated on a
  real-browser Tab walk) and #15 (events data phase 1: `night`/`venue`,
  the Midway back-to-back shape with guessed times and an order-with-source,
  validator teeth, frozen-key proof).
- **Provider question answered with sources, not memory:** Gemini stays for
  the add-a-festival research call (grounded citations, free at our volume,
  now Gemini 3.5 Flash via the alias); Claude + web search is the quality
  upgrade if lineups come back wrong; OpenRouter's search path is deprecated
  in favour of a beta tool and adds a hop. Kevin's larger idea — a
  multi-pass, vision + grounding import graded against the fests we already
  ship — is banked in NOW.
- **Cleanup:** link previews lost their who-corner ticks; Dependabot #9, #8,
  #5 merged; the Neon test-row sweep is partial (two multi-row deletes were
  refused by the auto-mode classifier — SQL for Kevin in NOW).

## 2026-08-31 — Kevin's review of the bloom: what synthetic tests can't see, a regression of mine, and the click that closed the zoom

- **Three bugs the frame-stepping could not see, all real-input only:** a 1px
  trackpad scroll dismissed AND poisoned the zoom (now it follows its card);
  an overlay restored by a repaint under a moved-away hand never heard a
  boundary event (any outside movement now closes it); and the one Kevin kept
  hitting — "hover and click, it closes… then stuck" — which Codex and a live
  event log root-caused together: a click on the resting card focuses it,
  `refreshCard` restores that focus to the fresh node (right, for keyboard
  users), and the next click on the overlay (a plain div) blurs the card, so
  the keyboard route's `focusout` closes the zoom before the click can land.
  The overlay cancels mousedown's default now.
- **The "stuck" half was a full-wall repaint after every pick.** Postgres
  hands back jsonb keys length-then-alphabet; a local pick appends its key;
  `applyRemoteDoc`'s stringify compare called the own-edit echo a remote
  change — measured live at 2.0 s after a pick, 110 cards rebuilt, zoom torn
  down, focus dumped, hover intents killed. The compare is order-insensitive.
- **My 08-30 "full-bleed strip" broke the timetable at any window wider than
  the shell** — the strip already had the grids' geometry via its `times-wrap`
  class; my override made it narrower, drifting every stage head 35px per
  column and letting cards scroll out beside the rail. Reverted to <720 only;
  the rail took the same full-viewport geometry. Tall sets (Despacio, 7h) now
  read like a printed grid: name at the top edge, "until 9:45 PM" at the
  bottom.
- **Stale-worker trap closed:** the first open after every deploy ran the
  previous build (cache-first shell). index.html reloads once when a new
  worker claims the page in its first 20 s. Every "still broken" of the day
  is suspect in hindsight.
- **A fest's place is a door** — `placeDoor()`/`festPlaceLine()` serve the
  zoom's WHERE, the wall header and the Settings card; a Sonnet teammate
  sourced `locationUrl` for all 11 fests and 16 Portola afters venues, and
  caught my test fixture that assumed Portola had no address.
- **Lessons banked:** a real-pointer walk before every push (the memory
  already said so; it was skipped twice); a venue teammate starved for 45 min
  with no bank file — TaskStop + respawn with bank-first as the literal first
  tool call worked in 20 min.

## 2026-08-30 (late) — the bloom: the zoom's motion rebuilt once, from a storyboard

- Kevin's verdict on the evening's v58: "it's worse... there HAS to be
  something rotten under the hood." There was, and it was architectural:
  the zoom ran a shared-element morph between two DOM trees — resting
  pieces measured (rects + eight font properties each), CLONED into the
  overlay, crossfaded against their grown twins, with a frame-0 twin and an
  exit-ghost set papering over the seams. Two renderings of one fact in
  flight is why "4:45 PM" and "4:45 – 6:00 PM · Sat" printed together, why
  lines mis-registered, and why every patch (v55–58) moved the problem
  instead of closing it.
- The rebuild follows the banked lesson (storyboard → build once → watch
  slow-mo → ONE push): `claude-plans/2026-08-30-zoom-storyboard.md` first,
  then ~180 lines of seam-hiding deleted from card-facts.js. New law in the
  file header: ONE rendering of every fact, ever — the overlay measures
  only the resting card's box. The bloom: scale k→1 from the resting centre
  (true transform-origin at viewport edges too) + 90ms materialise, the
  same aura wash carrying the "same card" read; resting CONTENT steps back
  via CSS while its wash stays (`zoom-source` hides children now, not the
  card — no hole, no twin); grown lines cascade from their corners relative
  to the CARD. The way out recedes from wherever the bloom has got to
  (live-value read before the exit, so a fast skim never pops).
- Watched frame-by-frame before pushing: DevTools `currentTime` stepping at
  0/45/95/160/230/330ms on the gallery's richest state, plus skim (≤1
  overlay), pick-while-zoomed (zoom holds, pill FLIPs in), low-power (zero
  animations), Escape, console — all clean. Suite 306/307 green.

## 2026-08-30 — the clean round: a survey with skeptics, nine teammates, and the zoom rebuilt three times in daylight

- **The survey came first** (ultracode): ten Sonnet readers over every
  subsystem, a skeptic re-reading every finding at its file:line, two web
  researchers (comment-UI patterns across 15 products; what ACL/Seismic/Lost
  Lands have actually published), one Opus synthesis. 55 findings, 0 refuted,
  1 P0 — the zoomed card swallowed every click after the first, four readers
  reaching the same line independently. The P0 and the row-reflow were
  exactly Kevin's two complaints, now with mechanisms attached.
- **The zoom was rebuilt live against Kevin's eyes, three times** — overlay
  (no reflow), then colour/one-model (an appended background layer had made
  the CSS shorthand invalid: every grown card went black; the deeper fix
  made `factsFor` the ONE card model both renderers draw from), then
  personality (cross-fade frame 0, corner-origin arrivals, stagger +
  overshoot, uniform-scale hops after the time line smeared). Codex reviewed
  the architecture before a line was written and its four corrections all
  proved load-bearing.
- **A usage pause silently starved nine teammates for an hour** — alive in
  the pane list, zero bank files, queued wake-ups never draining. TaskStop
  ×9, respawn with the same briefs plus one new law: create the bank file
  BEFORE the first edit. The relaunched set delivered everything; the law is
  now in hg-save-it's agent-brief pattern.
- **Verification kept earning its keep**: the settings agent's disconnect
  fix would have bricked sync (null is refused by `validateAffinity` and
  IGNORED by the merge — zeroed writes are the mechanic); the link-preview
  agent's local harness missed that Vercel serves the filesystem before
  rewrites (caught by reading the live preview's served bytes; the fix moved
  links to `/f/<fest-id>`, docs-confirmed, with tests proven red against two
  broken configs — and its own first shadow test had passed on the broken
  config); the walker's 8 FAILs split into 3 real zoom bugs (hold-lift
  picked: armed one event early; keyboard growth gated by the pointer's
  dismissed rule; scroll-dismiss unreproducible under a scripted real
  scroll — flagged for a real-wheel re-check) and 5 items that were just
  v48 walking ahead of uncommitted work.
- **Design flowed through a canvas Kevin could argue with**: mechanics
  directions (A/B/C), then arrangement paradigms on his "root in use cases"
  note, then his pick — A, pin on hover in the top row — built by the same
  Opus teammate that owned notes.js all day. His motion standard is now the
  project CLAUDE.md's "How this app moves"; GIFs became watchable via
  ffmpeg contact sheets.
- **Shipped beyond the app**: the Tecovas Fable fan-out guard (SessionStart
  rules + a PreToolUse ask on Workflow/Agent, transcript-sniffed, fails
  open) to the whole-workforce marketplace; the latitude-scales-with-model
  rule to both global CLAUDE.mds; the agent-brief pattern to hg-save-it;
  Ray's issue #6 closed in code with a fork runbook; per-fest link previews
  with the mark replacing the last of the old green grid.

## 2026-08-29 — the notes/desktop round: four design rounds, one build, three Codex gates

- **Design that landed.** The 08-27 canvas failed on fidelity, so the rig
  in `claude-plans/2026-08-29-notes-desktop-canvas/` renders every artboard
  through production code (jsdom + state.js/wall.js/notes.js). Round 1
  covered all six asks and Kevin's verdict was "no elegance" — boxes and
  stacked pills. Round 2 offered three vibes (ink / aura / script); he chose
  Aura. Round 3 refined it and carried it into the open decisions. Round 4
  answered his notes: dials, a rounded header, the live morph. Then his own
  look at the preview drove two more turns: recompose the morph around the
  centre (the name never leaves the middle; hover becomes a small open
  header), and rebuild the transition as a real shared-element morph —
  things slide and scale into place, nothing fades-then-reappears.
- **Two things got simpler by his call.** Pick-as moved to Settings → You
  only (the chip hold, the arm, the hover door and their tests are gone —
  people rarely switch); the existing notes button stays the one door to
  comments and rides along in the zoom.
- **The build** (branch `notes-desktop-round`, SW v44): threads (`re`),
  card-facts.js (one component: the zoom and the sheet header), the aura
  sheet, the whisper replacing the inline bars, occurrence identity on every
  card, tagged route keys, the approved share copy, two-line event cards,
  "picked by N others" labels, and `scripts/sw-stamp.mjs` — an asset stamp
  the suite enforces, born from shipping gate fixes under an unbumped
  version.
- **Codex, three rounds, NO SHIP each time, 19 findings taken** — the
  lesson class again: a repaint between a hold arming and its release could
  confirm an identity switch (a press record now outlives its hold); a
  duplicate performance zoomed into the first match's set (the occurrence
  rides the card, the route key, the sheet); a live sync ate an in-flight
  edit (drafts live outside the painted list); an unfinished teardown
  stacked grown blocks (the record owns its node); the clamp used content
  bounds not the scrollport; a JSON-looking artist name could collide with
  the route key (a tagged payload no name can hold); Settings → You left the
  wall stale once the chip path was gone; lane cards snapped on the way out.
  Every finding was re-read in the file before the fix.
- **Research for the interaction grammar** (five Sonnet studies, brief
  banked): tap = primary with zero delay; hover-in 300–500 ms and always
  slower than hover-out; hold 500 ms / 10 px (the OS constants production
  already used); gestures keyed off the event's pointer type, never a media
  query; actions inside a preview need stopPropagation AND a target guard.
- **Walkers.** The first (production reference screenshots) used scripted
  clicks for picks despite the brief and reported two "bugs" the crew's own
  document disproved — real input for everything is now the standing brief.
  A second walker died in a usage pause with nothing banked (bank-as-you-go
  is why that cost nothing). The gate walk on the final preview (real mouse,
  real touch via CDP, real keys): 9 of 11 clean — hover intent, threads,
  whisper, chips, keyboard, mobile, two-line event cards, zero app console
  errors. Its two findings were real: resting pieces ghosted mid-morph (the
  hop started from an identity transform, not from where the flipped layout
  had moved the piece), and a hover zoom grew back under a resting pointer
  after Escape or a pick (a dismissed zoom now waits for the pointer to
  leave; a pick keeps the zoom and re-grows the fresh card at once). It also
  found a tracked accessibility-tree dump a walker had committed — removed.
- **PR #13** carries the round; Kevin merges (the 2026-08-29 workspace rule).

## 2026-08-27 (late) — the browser-only bugs, the festival timezone, gate rounds 4–5

- **Round closed at 21:10 with the next brief banked, nothing built.** Kevin's
  six asks for the notes/desktop round (hover facts, the notes sheet as an
  expanded card, day notes without the bars, threading, a share-copy pass,
  the desktop chip grammar) are in NOW.md's NEXT ROUND section with the
  proposals made in chat. A design canvas for the day-notes paths was
  rejected ("not up to snuff") — a fresh session redoes it at production
  fidelity. One race worth remembering: the main session deleted the
  walker's test crew while the walker was still on a follow-up, and the
  walker raised it as a P0; the database was fine. Stop the walker first.
- **Promoted 21:01 CT.** PR #12 (carrying #11) merged to `main` as a
  merge commit; v42 on all three domains within 90 s; the walker's final
  report A–E PASS on real clicks; throwaway rows deleted; merged branches
  deleted. CI now runs the suite twice — UTC and Asia/Tokyo — after the
  runner's zone caught a test that Austin could not.
- **What only a real tap could find.** Three Codex rounds and 256 Node
  tests passed a people filter that did nothing in a browser. `chipGesture`
  stored the bare `clearTimeout` on its hold record and called it as
  `hold.clearTimer(...)`; WebIDL wants the window as receiver, so every
  browser threw "Illegal invocation" on every real tap on another member's
  chip. Your own chip never wires the pointer handlers — which is exactly
  why the checker's own-chip checks passed and why the bug survived. Fix:
  arrow-wrapped timer defaults; the regression test installs a
  receiver-strict stub so Node refuses the same way a browser does. Two
  knock-ons closed with it: the filter was saved before the throw and
  surfaced minutes later on an unrelated repaint; a touch-type tap could arm
  pick-as with no hold.
- **The day tab lied after a repaint.** The scrollspy's first claim was
  "tab 0" — true at load, false on every re-wire, and both new filters
  re-wire. Now: geometry when scrolled, first tab at scroll 0, and one
  requestAnimationFrame re-sync because search adds/drops the sticky strip
  after the wire (`--jump-offset` moves).
- **The arm is in place now.** Arming used to rebuild the chip row under
  the finger that armed it; where the release lands as a click after that
  is browser-specific, and on an armed chip a click is the confirm. The
  chip updates in place; the row is rebuilt only after the arm expires.
- **Codex round 4, browser-only failure modes — NO SHIP, four taken.**
  Time P1: the now line used the phone's clock. Storage P1: `typeof
  sessionStorage` does not guard a getter that throws (Chrome, site data
  blocked) — a blocked phone would have hit the fatal screen on enterApp.
  Scroll P2: the stale offset above. CSS P2: "Warehouse" clipped in a
  34×44 rail with no hover to recover it. **Round 5 (delta)**: all four
  FIXED; its one leftover — two rails reading the same — closed: four
  letters, then initials ("BL" / "BLB"), then a digit ("MS" / "MS2").
- **The timezone decision, reversed.** The first cut said the phone's clock
  IS the festival's clock, the person being at the festival. True at Pier
  80; false for a friend checking from Austin (line two hours late) and for
  the day-of open near the 5 AM rollover. Festival files carry an IANA
  `timezone` now, the validator requires it once dayMeta carries dates, the
  grids carry it as `data-tz` for the ticker, and tests pin instants
  (`Z` / `-07:00`) so they pass in any zone — including the DST-end hour in
  America/Chicago that ACL and Seismic will live through. No zone, or an
  unknown one, still reads the device clock.
- **Walk notes not acted on, by decision:** How-it-works row 9 names three
  of five sync states (red covers both error and blocked — the right
  simplification for that screen); the Vercel preview toolbar occludes a
  row at 390px on previews only.
- **A Sonnet walker re-walked the fixed preview with real clicks**: tapping
  another member's chip filters (64 of 64 dim for a member with no picks,
  no console error), combining works, everyone ✕ clears. The first walker's
  Chrome was still holding the Playwright profile an hour after it finished
  — "Browser is already in use" means kill that `mcp-chrome-*` pid.

## 2026-08-27 (evening) — wall filters (A + D), the now line, the day-of open

- **Kevin picked A + D from the canvas** and added: on festival day, open
  on the current time with a now line. Built on branch `wall-filters`.
- **A · tap a member chip → the wall shows only their picks** (tap more to
  combine; your own chip = "my picks"; an "everyone ✕" chip returns). On
  the timetable non-matching cards DIM (the clock keeps its shape, and a
  dimmed card still takes a tap); on the lists (afters, Folsom, lineup-only
  fests) they hide, with "No picks here from Kat" where that empties a
  section. Per-fest, per-tab (sessionStorage) — a filter that survived a
  reload would read as "where did everyone go?" — and pruned to members
  still in the crew.
- **The wrinkle the code had waiting**: member chips already switched
  identity on tap ("Pick as Drew?" then a second tap, Kevin's 2026-07-12
  shared-phone flow). Resolved with the app's own grammar — cards tap to
  pick and hold for notes, so chips **tap to filter and hold to pick-as**;
  the hold arms the same two-step confirm, Settings keeps the explicit
  switch for keyboards. Flagged to Kevin as the one call to veto.
- **D · tap a stage name in the sticky strip → solo that stage**: the
  column goes wide, the others fold to 34px rails with the name set
  vertically (tap a rail to move the solo), the pressed head says "✕ all
  stages". One `columnsTemplate` feeds the strip and every day, so a solo
  holds top to bottom; a remembered stage that no longer exists is ignored,
  never a blank wall. Stage heads are real buttons (aria-pressed), opted out
  of the 44px floor like the other in-row controls, with vertical-only
  borrowed space so a tap can't land on the neighbour.
- **The now line**: `js/v3/now.js` is the festival clock — a day runs to
  5 AM (a phone opened at 12:40 AM Sunday is still living Saturday's grid,
  matching time.js's after-midnight reading), the phone's local clock IS the
  festival clock (the person this is for is standing there; files carry no
  timezone on purpose), and a grid day knows its date from `dayMeta.iso`
  (`isos: {W1, W2}` for two-weekend fests; validated as real dates; Portola
  carries them). Today's grid draws a brand-violet line with a "5:42 PM"
  label on the hour rail; a one-minute ticker (and the tab coming back from
  the background) moves it without a repaint, and drops it once the day is
  over. No iso, no line, no guess.
- **The day-of open**: a fresh open lands the now line a third of the way
  down the viewport — once per festival-day per tab, so a repaint after a
  pick never yanks the scroll; a PWA resumed from the background keeps its
  place; never while searching. Coming back from Settings after a festival
  switch counts as an open for that fest.
- Design canvas got the second look's fixes (the phone artboard now scrolls
  its five columns like the real app instead of clipping three of them;
  Option B's choices are a popover, as its note promised) and records the
  decision.
- **Codex gate round 1: NO SHIP, five P1s — all real.** The v40 worker
  cached app.js and wall.js but not the two modules they had just grown, so
  an offline boot after the update would have died on the first import
  (→ APP_CORE + v41, and `tests/app-shell-complete.test.mjs` walks the
  static + dynamic import graph from app.js against the atomic core list —
  and proves it would catch a missing module). Storage-blocked Safari swallowed the
  filter's write and re-read nothing, so a chip tap did nothing (→ memory
  is the truth for the life of the page, storage the reload copy; same for
  the scroll-once flag). Clearing your last pick on a list card under a
  filter left it dimmed, not hidden (→ filtered taps on list cards repaint);
  scheduled search ignored the filter (→ it hides like every list). Stage
  heads had a 32px tap target because overflow:hidden clipped the ::after
  (→ ellipsis on an inner label, head overflow visible). And the pick-as
  arm lived in the chip's DOM closure, so a remote repaint mid-confirm
  turned the confirming tap into a filter toggle (→ `chipGesture` in
  filters.js is a pure state machine with the arm keyed by name, tested
  with a fake clock). Plus the P2s: pruned filters written back, dayMeta
  dates bounded and unique, iso XOR isos, both weekends required, a morning
  set warns, before-doors day-of open lands on today's header.
- **Codex round 2 (verify): still NO SHIP — round 1 had left real gaps.**
  The 32px stage target was still 32px: the borrowed ::after can't escape
  the strip's own scroll container (→ on touch devices the strip row is a
  real 44px; desktop keeps 32). A repaint mid-HOLD left the old chip's timer
  alive, arming a chip nobody could see, so the next plain tap switched
  identity with no confirm (→ one pending hold for the whole row, cancelled
  on every rebuild, its orphaned release swallowed; arming rebuilds the row
  so the armed chip renders from `armedName()`; all driven by a fake clock
  in tests). The scroll-once used two keys (day header vs now line) so a
  morning open plus an afternoon Settings close scrolled twice, and an open
  before the festival spent the claim on nothing (→ one key per fest per
  festival-day, marked only after a real landing). Under a filter that
  includes you, picking a card from the grid didn't surface its afters
  twin (→ a filtered tap by a filtered person repaints). Search extras
  counted matches before the people filter (→ after). `iso` vs `isos`
  duplicates across days weren't compared (→ a plain iso claims both
  weekends). And the copy pass had put a ♪ in the Spotify demo — the one
  glyph the repo bans (→ the green pill). Accepted, documented: time.js
  reads every AM set as after-midnight while the clock rolls at 5 AM — no
  grid has a morning set and the validator warns the day one does; an
  activities-only day under solo is unreachable from a valid file.
- **Codex round 3: SHIP WITH FIXES** — two interleavings left in the hold
  state machine: a deliberate press inside the 800 ms suppression left by a
  cancelled hold was swallowed, and an older pointer's release on the same
  chip could clear a newer press's timer. Every press now resets the
  suppression and carries a token; a release clears only its own hold.
  Both are fake-clock regression tests (1bf672f). PR #12 opened.
- **Kevin's copy pass on How it works** (his voice, trimmed): billing/sort
  gone, rows for tap-a-name / hold-to-pick-as / tap-a-stage / the now line
  / + Add and the crew link / Spotify in Settings, the dock row says only
  "green dot = synced", and a "cool stuff in Settings" close. The coach mark
  carries his line. 234 → 254 tests. SW v39 → v41.
- **Still open when this entry was written**: a `[object Object]` status
  seen once in the create flow on the branch-alias preview — under
  investigation by a UI-walk teammate (see NOW.md).

## 2026-08-27 (after the promote) — the pick-key guard grows teeth for whoever edits data next

- **Kevin's ask**: make it very hard for a future session — a smaller
  model, a cloud run, the drop-watcher automation — to break existing crew
  selections. The rule now lives in the tools those sessions are told to
  run, not in memory: `api/_lib/pick-keys.mjs` freezes a live festival's
  id, every artist name and every day label (atomic values, combined-label
  parts, grid keys) into `tests/fixtures/live-pick-keys.json`, and BOTH
  `scripts/validate-festivals.mjs` (the one command every data edit runs;
  CI) and `tests/live-pick-keys.test.mjs` fail when a frozen string is
  gone — with a full-sentence message naming what breaks and the
  sanctioned fix. Every non-archived festival must be frozen (the
  validator says which command to run if one isn't); all six are.
  `scripts/freeze-pick-keys.mjs` only ever adds — dropping a string is a
  hand edit to the fixture, visible in the diff. `data/festivals/README.md`
  is the two-minute version, sitting where a data editor will look.
  Proven by mutation: case-drifting one live name fails the validator.
- **Header copy** says the fest once: `Pier 80 · September 26–27, 2026 ·
  doors 1 PM` (the afters/Folsom dates live on their section rules; they
  were being read twice). Data is network-first, so no SW bump.
- **Filtering the wall** — four options drafted on the real header as a
  design canvas (chips-as-filter · stage solo · a Showing menu · search
  tokens), recommendation A + D. Kevin's pick decides the build.

## 2026-08-27 — Portola set times: the drop, and what the drop exposed

- **Portola's official set-times posters went up** (site + Instagram,
  Aug 27 afternoon; the crew chat lit up within the hour). Transcribed from
  the 1080px official JPGs by three readers — two independent model
  readers in a workflow plus a third pass — and reconciled box by box: all
  64 sets agreed on stage, start and end; stage membership also matched
  the four official per-stage lineup images. `portola-2026.json` gained
  `days{}` (Sat/Sun, five columns as printed incl. Despacio as one block),
  `status: scheduled`, and one new name (Kaytree, Ship Tent Sun 1:40).
  Every one of the crew's 49 live pick keys is on the grid under the same
  bytes; all 62 names that prod served are still present.
- **The drop exposed two real gaps in the cloud branch it landed on**, both
  fixed with regression tests that fail on the pre-change code:
  1. *A scheduled wall deleted the afters.* `renderWall` rendered only
     `days{}` in scheduled mode — the 38 Afters and 8 Folsom cards the crew
     had been picking on would have vanished the moment set times shipped,
     and the tab bar with them. Now the grid renders the festival days, then
     every remaining `artists[].day` group as card sections (`extraSectionsOf`,
     shared by browse, search and the day tabs), then anything billed on a
     grid day but missing from the grid under EVERYTHING ELSE.
  2. *The persistent data cache was cache-first.* Festival JSONs were moved
     to a version-proof cache on 08-23 (right) but served cache-first
     (wrong for data): a set-times drop reached an online phone one open
     LATE — "app is updated" → open → last week's lineup. Data is now
     network-first with a 4 s budget, cache as the offline answer, and a
     first open with nothing cached waits for the network instead of 503ing.
     Tested against the real `service-worker.js` in a vm sandbox.
- **Validator grew teeth for grids**: grid names must match `artists[]` byte
  for byte (a case-only match is an ERROR — it would split picks), no
  overlapping sets on one stage, no set ending before it starts, and a
  warning for a lineup artist billed on a grid day with no set there. The
  rules key on `days{}` presence, like the renderer, not on status.
- **The pick-key freeze**: `scripts/freeze-pick-keys.mjs` snapshots a live
  festival's names into `tests/fixtures/live-pick-keys.json`;
  `tests/live-pick-keys.test.mjs` fails if any later disappears. A rename
  becomes a visible fixture edit. Portola frozen (81 names). Run it for ACL
  and Seismic the day real people start picking there.
- **Backups before touching anything**: Neon branch
  `backup-2026-08-27-pre-portola-drop` (full DB, point-in-time, no compute)
  plus a JSON export of all 36 crews and Kevin's crew doc in
  `~/.claude/plans/festival-navigator-backups/2026-08-27/` (outside the
  repo — it holds tokens).
- **Two Codex gate rounds over the whole branch diff** (`git diff
  origin/main...HEAD`, high effort, ~9 min each). Round 1: no P0 — every
  live pick key intact — but three P1s and six P2s, all fixed the same
  night: the late-network cache write in the new SW path was fire-and-
  forget (a reaped worker could discard the fresh copy → held open with a
  synchronous `waitUntil`, shell and navigation paths too); three raw
  `localStorage` reads survived the 08-23 hardening and crashed a storage-
  blocked Safari on crew activation (→ every read in `js/` now goes through
  the guarded helpers); Day Image lost Afters/Folsom the moment Portola
  went scheduled (→ it draws from `extraSectionsOf` like the wall); the
  activate-time rescue could delete a device's only offline copy after a
  failed migration (→ an old cache is kept until its festival entries are
  rescued); malformed `days{}` / `stages` could 500 festival-add; TIME_RE
  accepted 13:00 PM; overlap detection missed point-times and would have
  flagged archived Lolla's two genuine simultaneous listings (→ judged on
  renderer-resolved spans, as a WARNING; Portola held to zero); dupe
  detection compared raw labels instead of rendered days. Round 2 verified
  #1–#4 and #10 fixed and the rest partial; the partials closed in one more
  commit (renderer-consistent split, `stages` guard, AM/PM case in
  `timeToMinutes`, navigation lifetime, explicit error on a cold miss).
  **Still Kevin's call**: commit `8f4a09d`/`66c4eed` history carries two
  email addresses in the Ray checkpoint doc (redacted at HEAD; rewriting a
  public branch's history is a bigger act than the exposure).
- **Live preview walk** (Playwright, the real Vercel preview, the real
  Neon merge): SAT / SUN / AFTERS / FOLSOM tabs; 64 grid cells; 38 + 8
  section cards with venue · hours; tapping Overmono on the grid repainted
  the Afters Overmono card too and the pick landed in the server doc; SW
  v39 controlling with the persistent data cache beside it. A throwaway
  "Portola 26" crew (member `zz-preview-walk`) was created in the prod DB
  for the walk — delete on Kevin's word.
- 191 → 227 tests (226 pass, 1 env-gated skip). SW v38 → v39. Branch
  `portola-set-times` = cloud branch + v31-polish docs + this.

## 2026-08-23 — Portola Week + Folsom on the board, ACL made drop-ready, a field-hardening gate

- **The Portola board now holds the crew's whole weekend**: the official
  Portola Week program (21 Goldenvoice shows, Thu Sept 24 – Sun Sept 27,
  announced Aug 18) as an AFTERS section and Folsom Street Fair weekend
  (the fair + Horse Meat Disco, Magnitude, PERVERT XXL, DEVIANTS, Real
  Bad 37, BRUT, Disco Daddy) as a FOLSOM section — on the same board, same
  picks. Horse Meat Disco (the crew ask): **Fri Sept 25, Public Works,
  9 PM–3 AM**, verified against multiple listings; a stale 2024 Tixr link
  circulates, the real tickets are at sickening.events. Mechanism: an
  afters appearance is its own artists[] entry; a name matching a lineup
  artist unifies the pick/aura/notes on purpose, and lineup cards learned
  a venue · time sub-label. Friday is conflict-free — that's HMD night.
- **ACL set times ARE out** (week of Aug 17, both weekends) — and NOT
  ingested, on purpose: this cloud session's egress policy can't reach the
  JS-rendered schedule page, and 14 research agents + a 3-agent snippet-
  mining round recovered only the evening headline blocks (~6 of ~30
  sets/day). A 10%-populated grid lies harder than an honest lineup view.
  Instead the two-weekend scheduled SHAPE shipped end to end (per-set
  weekend tags, weekday day keys so day notes survive the flip, one
  weekend on the grid at a time, per-weekend day-rule dates, validator +
  docs + tests) — **pasting the grids from aclfestival.com/schedule is now
  a pure data drop**, with verified evening anchors in acl-2026.json's
  meta.note to cross-check against.
- **An adversarial gate over the sync/offline/multi-user surface** (three
  find lenses, every finding independently re-verified in code; 18
  confirmed, 1 refuted, 36 invariants held). Fixed with regression tests:
  the playlist-entry pending-subtraction wedge (the note-fragment bug's
  twin — reproduced, then fixed atomically); festival JSONs moving to a
  persistent SW cache so a CACHE_VERSION bump no longer wipes every
  festival an offline device had opened (+ a rescue migration); 8s boot
  fetch timeouts (dead festival WiFi = blank page, cache had the doc all
  along); Safari 15.x getting NO sync timeout at all; the blocked-state
  dot honestly staying blocked through unchanged polls; prototype-shaped
  festival ids; storage-blocked boot crash; clientId clobbering pending.
  Deferred with writeups: merge-SQL null semantics, octet_length vs
  JSON.stringify cap mismatch, DIAGNOSE race misattribution, beacon
  re-push leaf revert, poll teardown after leaving a crew, offline-first
  boot.
- 176 → 191 tests (190 pass, 1 env-gated skip). SW v36→v38. Branch
  `claude/festival-lineup-integration-zs0s8l`, preview only — promote is
  Kevin's call. No Codex CLI in the remote container; the gate ran as
  independent adversarial agents instead.

## 2026-07-14 — The identity night: me link → model pivot → fest-first, four gates

- **One overnight session moved the app onto Kevin's real model.** It started
  as "one link that restores everything" (the me link: persons table,
  header-auth API, public pid vs secret token, #p= restore), got live-tested
  by Kevin the same night, and his feedback pivoted the whole IA: **fests ×
  circles × you** — home lists FESTIVALS, a "crew" is a backstage circle (one
  cluster, one link, the consent boundary), and every person is the center of
  their own map (Google+ Circles, remembered right). Direction doc:
  `claude-plans/2026-07-14-fests-circles-you-direction.md`; the confirmed
  visual explainer lives as a claude.ai artifact linked from it.
- **Built and staged in the same session**: fest-first landing (date-sorted
  via new `startsOn` in index.json, "Sep '26" beside each name, past fests
  sinking muted), multi-pick create (name asked ONCE per device ever; boards
  born knowing their fest AND their person), "WHO'S THIS WITH?" deleted the
  night after it shipped, + Add sheet with the recurring-humans picker,
  settings listing YOUR boards instead of the catalog, and connect-once →
  EVERY board badges (badgeEveryKnownCrew sweeps across crews).
- **The staging→prod Spotify hop trap, found by Kevin live**: OAuth's
  canonical-host hop moved him to an origin that knew one crew, and his map
  "disappeared." The hop now announces itself and carries the me link; boot
  absorbs the person quietly (master key stripped in the same synchronous
  frame) and continues into the drill. Verified live on a wiped browser.
- **Four Codex gate rounds, every one earned**: master key in URLs → header
  auth; a TOCTOU in my own race fix caught by the test the gate demanded; my
  ownership guard's two open doors (empty-mirror inheritance, rename bypass);
  re-entrant create minting duplicate circles; batch boards missing the me
  link; a storage read-back that could throw. NO SHIP verdicts are the
  system working.
- Also that night, before all this: the array-eating deepMerge (a sync-
  blocked device from one "harmless" toast) — both JS twins now replace
  arrays like the SQL, with a three-way byte-parity test.
- 175 tests (174 pass, 1 env-gated skip). Staging = v35 across the arc's
  final state; **prod stays at v31 until Kevin promotes** after his
  fest-month shakedown. Phase B banked: merged fest board + join-picker/mute.

## 2026-07-13 — Production promote + Spotify proven live + same-day polish

- The whole v3.1 arc reached production (v14 → v29 in one afternoon, three
  domains, each deploy verified by served CACHE_VERSION — never HTTP 200).
- Spotify's last unverifiable mile closed: Kevin registered the one canonical
  redirect URI, connected live, 6,180 artists scanned, every crew fest badged
  in one pass. Root causes of his "still broken" report were prod being 14
  versions stale + the dashboard field — zero code bugs in the rebuilt flow.
- His first-connect feedback shipped same-day: scan ticker with album covers
  (data was already in the pages — zero extra API calls), playlist card that
  reports where you can see it (old status line rendered below the fold —
  "Make playlist" wasn't broken, it was invisible), collaborative crew
  playlists in the doc (spotify.playlists — members auto-join on connect),
  affinity corner-glow tiers, restored spotifyStats write.
- Verification found the stats write missing by diffing the LIVE crew doc
  against what the drill displayed — the drill was reading local cache and
  looked fine. Check the store, not the screen.
- Also: dead BLOB token removed from all Vercel envs; Codex gained
  network-by-default + a CDP browser bridge (helper/guides/
  codex-capabilities.md) after its sandbox blindness showed in the audit.

## 2026-07-12 (latest) — Spotify flow: connect once, badge everything

Kevin tried the real flow after the finish pass shipped and it was broken: OAuth
`redirect_uri: Not matching configuration`, a confusing two-hop connect with a
second button on a sparse page showing raw client-ID plumbing, and the gear icon
stranded far-left under Lost Lands' long date string. His model was right and the
app wasn't honoring it: connect once, every festival badges, add a festival later
and it just pulls from the library already on the device.

Fixed: the gear pin (a `≥720px` rule stripped its `margin-left:auto` whenever the
header wrapped — verified live on the exact festival from his screenshot), the
connect hop (now one press, `sp=connect` auto-continues on the canonical host
instead of showing a second Connect button), and the core promise —
`badgeAllCrewFests()` reads the library once and badges every festival the crew
has in a single write, and a festival added later self-badges via the existing
`switchFestival` path. The drill itself got rebuilt around one shared
`connectCard` (says what it does, no raw client-ID on the first screen) with the
plumbing folded under Advanced.

5 new tests prove the actual promise: a non-active festival gets badged, a
newly-added one self-badges, badging one never wipes another's, the whole sweep
is one doc write not N. What could NOT be verified this session: the real 3-door
owner-app flow only renders where the Spotify env vars exist (production, not
staging), and the real OAuth round-trip needs Kevin's own login. The
`redirect_uri` error itself was never a code bug — it's one field in Kevin's
Spotify dashboard, queued in NOW.md since earlier today.

Session ended here — usage-limited, switched to Sonnet, wrapped clean rather than
push further. Tests 141 passing + 1 skipped (Neon-only). Rig crew created for
verification deleted; no real crew touched.

## 2026-07-12 (late) — THE FINISH PASS: 86 findings, and what they were really about

A 12-agent audit against the taste rubric: 6 browser walkers (every surface at
390 and 1440, driving a seeded rig crew with deliberately messy data — 5 members
incl. a tombstone, picks at every level, notes at all three scopes) plus 6
code/test/doc dimensions. 86 findings, zero agent failures, 2.7M tokens.

**The pattern:** almost nothing was crashing. Nearly everything was the app
quietly saying something untrue, or quietly losing a tap. That is exactly the
class of bug a green test suite cannot see, and it is why the suite was green.

### Data loss (the only bug that really matters here)
- `saveLS()` swallowed every localStorage failure with a `console.warn`. Quota
  exceeded or private mode → the edit lives only in memory, and the push is 1.2s
  behind it. Lock the phone in that window and the pick is gone, silently. It
  reports now.
- The 1.2s debounce was a grave for a backgrounded tab. `flushOnHide()` beacons
  pending picks on pagehide; we keep pending afterwards (a beacon's reply is
  unreadable) and re-send next boot — safe precisely because the merge is
  idempotent. Sending twice is free; not sending once loses a pick.
- **A 400/413 permanently poisoned the pending queue.** The comment in sync.js
  said "the retry loop stops". It did not: `pollSync` saw `hasPending()` and
  re-armed `scheduleSync()` every 25s, re-POSTing the same doomed payload
  forever and blocking every *other* edit on that device behind it. We now
  remember the exact refused payload, stop asking, and let any NEW edit earn a
  fresh attempt — so there is no dead end to escape. New `blocked` sync state.
- `clearPending()` blind-wrote `'{}'`, re-opening on the clear path the exact
  last-writer-wins race `persistPending()` had been fixed to close. It now
  subtracts only the ACKED leaves, from memory and disk both.
- "Drew" and "drew" forked into two permanent identities. Each client checked
  for it against its own in-memory doc, which cannot see the other phone joining
  in the same breath. The invariant moved to the merge — the only place both
  writes are visible. Checked the live store FIRST: no existing crew holds such a
  pair, or the rule would have bricked every future write to it.

### The SQL was never tested
`jsonb_deep_merge` — the function every concurrency guarantee rests on — was
executed by ZERO tests. "6 of 6 concurrent merges survive" had been a comment,
not a fact, since July, and the suite tested a JS "reference twin" whose own
comments admit it is not what production enforces. The statements moved to
`api/_lib/crew-sql.mjs`; `tests/db-merge.test.mjs` runs **those exact bytes**
against real Postgres via **PGlite** (in-process, no server, no secrets, runs in
CI). 6-of-6 now proven. So is arrays-are-replaced-wholesale — which is *why*
notes must be keyed objects — and every WHERE-clause invariant.
Verified `sql.query()` returns rows the same shape as the tagged template, and
that both statements plan against the real production schema, before shipping the
call-shape change.

### Calibration: don't build on an agent's claim either
An agent called the 256KB doc cap "structurally guaranteed" to be hit and
recommended a compaction subsystem. Queried the live store: the busiest real crew
is **1,643 bytes — 0.6% of cap**. The failure mode was real; the stated cause was
not. No compaction built. Taking it on faith would have meant real complexity and
real risk, at ship time, to solve a problem 0.6% of the way to existing.

### The lies (rubric 8)
Archived-fest banner froze on the *first* archived fest's name (`if (existing)
return`) — the screen calmly saying Electric Forest while showing Lollapalooza.
The day-tab scrollspy watched a 10%-band and any big scroll cleared it in one go,
so the tab said Thursday while you stood in Sunday. Export promised "paste-ready
for Bulk paste" while emitting removed members' picks that Bulk paste refuses.
Search survived a fest switch → "No artists match" over a full lineup. The sync
dot painted `error` gray while the Settings label painted it red.

### The touch floor was a list nobody edits
Three walkers found it in three places, which is the tell it was never three
bugs. The 44px rule NAMED six selectors — and the naming was the bug: every
control added since (chips 26px, "+ ✎" 17px, all of Settings, the whole desktop
day rail) got nothing. It applies to `button` now, so new controls inherit it by
being what they are. Tuned against real geometry afterwards: -5px horizontal made
neighbouring chips (5px apart) overlap across the whole gap — a tap swallowed by
the wrong person's chip is worse than the small target it fixed.

### Docs that cannot lie
The README described an app that had not existed for two releases: a deleted
`js/render/`, an `npm run css` Tailwind step for a framework v3 dropped, removed
API endpoints, the pre-v3 pick vocabulary. `VERCEL_SETUP.md` was a confident
setup guide for **Vercel Blob** — the backend we BANNED for losing writes ("Vercel
Blob is perfect!" it said). Deleted. The durable half is
`tests/docs-truth.test.mjs`: paths must exist, no doc may name an npm script that
does not exist, no doc may present Tailwind/Blob as current, and the festival list
lives ONLY in index.json. All six failed against the docs as they were.

`.gitignore` claimed to ignore `.claude/` while git tracked seven files inside it
— a rule that read as protection while providing none. Codex reviews moved to
`claude-plans/codex-reviews/`; `*.png` now denied by default (a walker run dumped
50 screenshots into the repo root, and audit artifacts can carry crew tokens).

### The Codex gate found two P1s — and shot down my best test
Full write-up: `claude-plans/2026-07-12-codex-finish-gate.md`.

- **The touch-target fix was a hazard.** Settings rows stack with no gaps, so a
  universal `button::after { inset: -15px }` grew every row's hit area 15px into
  its neighbours, and the later-painted sibling wins an overlap. A tap near the
  bottom of "Switch crew" could arm the destructive "Forget this crew". A touch
  fix that hands you a destructive mis-tap is not a fix. Default inverted: real
  `min-height: 44px` (cannot overlap) unless a control opts out; borrowed space
  only where there is room. Verified in-browser — zero overlaps, 31 controls.
- **The sync block never lifted.** The toast promised "they'll sync as soon as the
  crew has room" and nothing ever retried unchanged pending bytes, so a phone
  stayed stuck even after another member freed up room. The app was making a
  promise it had no mechanism to keep. A poll seeing a CHANGED remote doc now
  clears the refusal (bounded: one retry per real change).
- **My concurrency test was a rubber stamp, and Codex proved it empirically** — it
  swapped in the banned pre-lock CTE, reran the six-way Promise.all 50 times, and
  lost zero writes. PGlite is one connection; Promise.all serialises. The real
  test (`tests/db-concurrency.test.mjs`) uses Neon's HTTP driver — one independent
  session per request — and carries a CONTROL asserting the banned CTE *does* lose
  writes there, so the harness is provably able to see a lost write. Without that
  control we would just be trusting a green tick a second time.

And one P0 I caught in my own new code before Codex got to it: `subtractLeaves`
recursed into note objects, so editing a note mid-push sent back `{text}` with no
author/ts — which the server rejects, which the brand-new refusal guard then turns
into a permanently blocked device. Two correct-looking fixes combining into
something worse than either solved. Notes travel whole now.

### Three lessons for next time
1. **The service worker lies to you after a deploy.** Every fix read as "not
   applied" in the browser while `curl | md5` proved the server had the new bytes:
   the old SW was serving its stale cache. It fooled me twice. Unregister +
   `caches.delete()` before believing any browser check.
2. **Green tests are necessary, not sufficient.** The focus-restore fix was
   complete and correct across three files, all tests passed — and it was still
   broken live, because `closeSheet()` nulled the opener it had just been handed.
   jsdom has no real focus model to break. Only the actual browser found it.
3. **A test you cannot fail is a test you cannot trust.** Two of the best things
   here came from proving a test could FAIL: reverting a fix to watch its
   regression test go red, and the CTE control that proves the concurrency harness
   can see a lost write. A green tick is evidence of nothing until you have seen
   it go red for the right reason.

Tests 95 → 136 (+1 skipped in CI: the Neon concurrency test). Rig crew and both
walker-created crews deleted at teardown; no real crew was ever written to.

## 2026-07-12 (evening) — round-2 review + copy pass + finish-pass approved

- Kevin's staging review round: cells re-centered (safe-center keeps the
  clip-proof fallback), person chips switch identity via two-tap confirm
  (pick for who you just added, no settings trip), canonicalHopUrl inverted
  from allowlist to hop-everything-but-canonical (staging OAuth sent Spotify
  a stage redirect URI), one disclosureFold for past fests both places,
  fest-notes strip removed (Notes chip owns it), eq-loader wait states,
  near-opaque sticky chrome, resize re-mirrors the timetable scrollers.
- Spotify Feb-2026 policy landed in the model: 5 authorized users, ONE
  dev-mode app per account, Premium required, endpoint cuts postponed for
  existing apps. The in-app own-app guide (spotifyAppSteps) now teaches the
  real flow incl. User Management; NO staging redirect URI needed by design.
  Kevin's one dashboard task: add fest.kevinhg.com/spotify-callback to MCP HG.
- Copy pass (Opus teammate): full string inventory, zero lying strings,
  "genuinely close" verdict. Tier-1 applied (Export/Bulk paste PICKS —
  vocabulary rule; flavored indeterminate waits; one "How it works") +
  Kevin approved; "Rescan my Spotify" + 404 "YOUR FESTIVALS" applied as
  recommendations; manifest "plan" + Portola example deliberately kept.
- Taste rubric written and APPROVED (claude-plans/2026-07-12-taste-rubric.md)
  — the finish pass closes every surface against it; that arc is next.

## 2026-07-12 — Kevin's notes arc: all 8 notes + sweep, staging born, memory explainer

- **Staging is live: https://stage.fest.kevinhg.com** — its own Vercel
  project (`festival-navigator-staging`) whose PRODUCTION branch is
  v31-polish, so the URL is public (Standard Protection exempts production
  custom domains) while the main project's preview protection stays intact.
  Only v31-polish builds there (ignore-command); Cloudflare A record,
  unproxied. Discovered on the way: custom domains on preview branches AND
  custom environments stay SSO-protected; the per-env `deploymentProtection:
  "disabled"` field stores but the edge ignores it (add-on-gated). The
  dedicated-project pattern is the reliable public-staging recipe.
- **Clear-eyed sweep** (5 Sonnet lenses + adversarial verify + main-loop
  synthesis after the Opus agent hit a schema retry cap; results recovered
  from the workflow journal): honest verdict + findings in
  claude-plans/2026-07-12-v31-sweep-findings.md. Lens grades B-/B-/B-/B-/C+;
  model layer elegant, screen-assembly layer frayed, timetable was the C+.
- **All 8 of Kevin's notes shipped in 5 clusters** (each committed + tested +
  staged): (A) canonical cross-day stage columns + ONE sticky stage strip +
  mirrored horizontal scroll; lane splits contained by border-box; clipped
  names killed (real cause: flex-shrink squeezing the name box — measured
  live); day-rail unified with the dock (avatar + fest name + sync dot).
  (B) back-button truth (bootTokenFor: resume only on cold start), heading ‹
  to the fest list, add-member-on-their-behalf with personal &me= claim
  links + case-insensitive claiming (Drew scenario verified end-to-end on
  staging). (C) sync hardening: 413/400 stop retrying + speak, pushGen kills
  the stale-poll rollback, create-path caps, Slack mrkdwn escape, two-tab
  pending merge; dead artist-info.js deleted. (D) Spotify three-door access
  model (owner app from /api/access?config=1 = main path; request-access
  door; BYO in a fold — api/access.js was already the recordOS-style
  backend), fest-notes strip at the wall top, past-fests weight rebalance.
  (E) legibility per the ground-it guide: util.js became the real shared
  home (5 hand-rolled LS pairs consolidated, unguarded writes fixed),
  el/subviewHead shared, legacy parseBulkLine deleted, comment lies fixed.
- Codex arc gate caught a real P1: the 2-row readability floor could stack
  two time-disjoint short sets — lane math now runs on display extents
  (regression test added).
- Tests 89 → 95. SW v16 → v19. Memory explainer published as a Claude
  artifact (the link/device/cloud story, built in the app's own tokens).
- Browser-walk gotchas banked: the Playwright MCP's evaluate runs in an
  isolated world (page fetch stubs need browser_run_code_unsafe +
  page.evaluate), goto to the same URL+hash is a same-document navigation
  (modules keep state — go via about:blank to truly reload), and SW-origin
  requests bypass page.route.

## 2026-07-12 — Stage-4 audit re-run PASSED + full response pass

- The gate's proof landed: 71-agent re-run (3 viewport walkers + offline
  prober + code finders → review lenses → adversarial verify) against the
  cc37d7d preview found **0 P0 and ZERO of the 73 discovery findings** —
  whack-a-mole broken. 42 new findings (4 P1 / 10 P2 / 28 P3), full list +
  disposition: claude-plans/2026-07-12-v31-stage4-audit-backlog.md.
- Response pass (this session): the repaint boundary now preserves ephemeral
  state — timetable scrollLeft per day, composer drafts (value+focus+caret),
  keyboard focus through card refresh — so a crew member's sync can never
  yank your scroll or eat your half-typed note; scrollspy only observes real
  day headers, defaults to day one, and carries aria-current; sort popover
  clamps to the viewport; OAuth returns land back IN the drill with the
  banked error shown; transient Spotify 5xx no longer nukes valid sessions;
  card accessible names carry crew picks/notes/Spotify; archived disclosure
  is a real button; asymmetric timetable bleed fills wide windows; join gets
  the wordmark; misses/sources/plurals/copy all report honestly; data +
  validator + docs hygiene (Lolla dayMeta, dead fields dropped, activities
  time format enforced, stages[] doc corrected).
- Three infra lessons banked to memory the hard way: workflow args can
  arrive as a JSON string (script now fails fast), Vercel share links die on
  every new deployment (mint after the last push), and preview needed
  DATABASE_URL added to its env scope.
- Deliberate non-fixes flagged for Kevin in the banked backlog: settings
  column width (atlas says 560 on purpose), entry-screen composition, saved-
  fest provenance surface.

## 2026-07-12 — Codex ship gate: fix-first verdict, all 7 findings addressed

- Verdict was 0 P1 / 4 P2 / 3 P3 (clean on data-loss, cross-crew writes, XSS,
  SW core list, OAuth leakage). Fixed: renameSelf now TOMBSTONES the old
  name's picks (Export Likes ghosts + reused-name double-render); rename
  blocks previously-used names entirely (merge can't delete tombstones);
  Spotify setup is open to any member — "lead" is copy flavor, never a gate
  (the first-position heuristic broke when the founder renamed themselves);
  sort control's first arrow press opens without advancing, and the popover
  closes on focusout; join-with-a-formerly-removed-name resurrects explicitly
  (removed:false) instead of entering invisible; wall.js tidies.
- DELIBERATE non-fix (Codex P2-4): switchCrew/leaveCrew leave stale history
  entries; Back after leaving re-opens that crew's link (the join screen).
  That's coherent capability-model behavior (back = reopen the link), and the
  "real" fix needs async history collapse with worse failure modes. Instead
  the router's reconcile is hardened: every layer open/close is individually
  guarded, so a stale key from any old entry can never crash the app.
- Audit re-run infra: preview env lacked DATABASE_URL (the NOW.md standing
  fact, finally connected) — added to Preview scope; server 500s no longer
  render as "you're offline" (13ef1ce). Workflow args once arrived as a JSON
  string (walkers got literal "undefined" prompts) — the rerun script now
  parses string args and FAILS FAST on missing values.

## 2026-07-12 (early) — PWA/SYNC honesty + first-run content

- **PS-3/4/5**: the dot goes gray the instant the radio does (offline event);
  every sync fetch carries a 20s AbortSignal timeout so a hung request can
  never jam isSyncing forever; sync state is ONE observable (sync.syncState())
  — the settings label reads it instead of recomputing from hasPending (which
  lied offline) and shows synced/syncing/offline/sync-error honestly.
- **PS-6**: every hot-path localStorage write in state.js + crew.js goes
  through a quota-guarded saveLS — a full store degrades to memory-only +
  console warning, never a throw mid-tap.
- **PS-7**: manifest orientation lock dropped (landscape timetable reading is
  legit); theme/background colors corrected to the v3 --page (#0C0A14 — they
  still carried the pre-v3 gray).
- **CT-1**: one-time dismissible coach mark on the first wall (pick mechanic +
  long-press + a link into How-it-works). CT-2: research preview shows the
  FULL lineup behind a review fold, source hostnames only when real (no more
  "0 sources"), discard clears state and refocuses, error copy stops promising
  a manual path that doesn't exist. CT-3: empty-state sweep.
- (PS-1/PS-2 shipped with the Spotify commit — same SW file.)

## 2026-07-12 (early) — SPOTIFY: five states, one OAuth origin, honest SW

- **The drill is a state machine now (SPOT-2)**: five explicit states, each
  one sentence + one action. Not-set-up members are pointed at the likely
  crew lead; the lead gets the one-time setup with a how-to fold (redirect
  URI + dev-mode limits); ready state explains what's read and what's never
  posted; connected state keeps stats/refresh/playlist/disconnect; failures
  land IN the app with the reason and a retry — spotify-callback.html banks
  the error and bounces home instead of dead-ending (state 5).
- **One OAuth origin (SPOT-1)**: PKCE runs only on fest.kevinhg.com; the prod
  aliases show "Continue on fest.kevinhg.com" which hops WITH crew + fest +
  an sp=1 flag that reopens the drill after landing (sessionStorage is
  per-origin — the dance can't span hosts). ⚠️ Kevin action queued in NOW.md:
  register https://fest.kevinhg.com/spotify-callback in the Spotify dashboard.
- **Config is correctable (SPOT-3)**: the crew app row shows the masked id
  with Change + two-tap Clear in both ready and connected states.
- **SW honesty (SPOT-4 + PS-1/PS-2, pulled forward)**: cross-origin requests
  are no longer touched (cache-first api.spotify.com made every re-scan one
  scan stale); core shell install is ATOMIC (addAll — no more offline-ready
  claims over a half-cached shell); navigations are network-first with cache
  fallback so a stale shell can't pin. v14 → v15.
- **Badges follow the library, not the fest (SPOT-5)**: applyAffinity MERGES
  (a per-fest apply used to wipe other fests' badges locally) and fest
  switches auto-badge from the cached scan — no rescan. Playlists keep the
  UI's one-track-per-artist promise (SPOT-7). SPOT-6 (access requests)
  consciously parked — dashboard allowlisting is Kevin's fast-follow.

## 2026-07-12 (early) — NOTES + SET-TIMES: the experience classes

- **Notes**: one scope sheet serves artists AND days (NT-2 — day headers carry
  a ✎ chip with count); notes are editable and deletable through the tombstone
  model (edit keeps id+ts so order holds; the server's id-prefix rule already
  means only your own) (NT-3); pins work in every surface (NT-4); sheets get a
  real close ✕ and the grabber actually swipes down to close (NT-5). The
  all-notes view is the notes HOME (NT-1): festival composer first — present
  even (especially) in the empty state.
- **Set-times**: the below-grid activity list died — activities and any set
  with an unknown stage (previously silently DROPPED) live in one neutral
  "EVERYTHING ELSE" column, chronological (ST-2). Day rules show real dates
  from dayMeta (ST-4). Archived fests carry a memory banner (ST-5).
- **Weekends (ST-3)**: fests with W1/W2 artists get a Weekend view (Both/One/
  Two, persisted per fest per device); W1/W2-only artists carry a quiet tag in
  Both view so a wrong-weekend must can't sneak in. Verified live on ACL.
- **Data honesty (ST-6)**: Lolla '25 got its year + dates back (file + index);
  the validator now warns on archived fests missing either, and on combined
  day strings that won't split (comma dropped from the separator set — commas
  live inside single-day labels like Lost Lands' pre-party days).

## 2026-07-11 (night) — FLOWS 5–13: joins that can't strand, settings with two doors

- **FLOW-5**: js/name-rules.mjs is now the ONE name rule — client forms and
  the server validator import the same module (drift impossible; parity test
  probes 17 names incl. the classic O'Brien). Join's first write happens
  BEFORE entry: the server's answer reaches the joiner as form copy, never as
  a forever-gray sync dot; offline falls back to local-first join.
- **FLOW-9/13**: create is two real steps (pick → NOW YOU with chosen-fest
  chip in accent border; past fests reachable in a muted section with PAST
  badges). Enter submits every entry form.
- **FLOW-10**: the join screen names the FESTIVAL (from &f= or the doc stamp),
  in the fest's accent, with "with <crew>" under it — verified live.
- **FLOW-7/12**: post-create share moment (dialog with the URL VISIBLE +
  copy + native share); settings share falls back to clipboard on non-abort
  failures; the crew door prints the invite link permanently.
- **FLOW-8**: person chips are presence display only — identity switching is
  an explicit Settings action with a toast.
- **FLOW-6/11**: settings has the spec's two doors. CREW: rename (validated),
  members, visible link, Switch crew (landing), two-tap Forget-on-this-device
  (device-local; back can undo it via history — that's honest). YOU: switch
  identity, self-rename (new person + tombstone + picks/affinity migrate
  through additive merges; old notes keep the old byline), 24-board color
  picker with taken colors disabled.

## 2026-07-11 (late evening) — DESKTOP + A11Y foundations: the app gets a desktop body

- **Tokens** (design-direction doc): fluid type scale --fs-display/screen/day/
  card/body/micro, --shell-max 960→1080 @1100, --sp-gutter clamp. AX-3 contrast
  retune COMPUTED (scratchpad script, WCAG math): --text-tertiary #5D5578
  (2.84:1) → #877FA4 — same hue/sat, ≥4.5:1 on all three surfaces (worst 4.61).
  aura.js subColor follows (text legibility, not gradient math). Taste-pass
  note: tertiary now sits near secondary — watch the gray ladder.
- **A11Y layer**: cards are role=button + tabIndex + Enter/Space + pick level
  in the accessible name (AX-1); one :focus-visible language, inline
  outline:none purged (AX-2); sheets are real dialogs w/ focus trap + restore
  (AX-4); labels on every input (AX-5); 44px coarse-pointer hit areas via
  ::after + dock tabs scroll-safe centering (AX-6); settings rows/toggles are
  named buttons (AX-7). prefers-reduced-motion rides the low-power path.
- **Desktop body**: sticky day rail ≥720 (YOU ↑ + Anton micro tabs, shared
  scrollspy with the dock — one observer, two containers) (DT-1); sheets
  become centered dialogs ≥720, 150ms fade+scale, reduced-motion kills it
  (DT-2); wall grid auto-fills ~176px columns (DT-3); entry screens center
  via margin-block:auto overflow-safe (DT-4); the timetable goes FULL-BLEED
  ≥720 with rail aligned to the shell edge — body overflow-x:clip makes
  horizontal page scroll structurally impossible (DT-5); hover ✎ chip on
  fine pointers, keyboard-reachable (DT-6); native select replaced by
  js/v3/sort-control.js — chip + popover listbox, arrows/Enter/Esc/typeahead
  (DT-7).
- Verified live at 1440 + 390 on the Audit Rig crew (localhost vercel dev,
  which — correction to earlier note — has FULL cloud env: /api works against
  real Neon; the "deleted crew" toasts in smoke were genuinely-deleted test
  crews, correct behavior). Browser-back closed an open dialog in the real
  browser with the #g= link intact (FLOW-2 live check).

## 2026-07-11 (evening) — CORE class (18) + FLOW-2/3/4 + ST-1: the broken-behavior sweep

- **Cards**: refreshCard now reproduces the original render exactly — placement
  styles copied, render opts stashed in dataset (CORE-1: set-times vanish);
  renderCard renders its time line (CORE-3); long-press hardened with
  pointercancel + isConnected (CORE-15); a pick repaints every sibling card of
  a multi-day artist. groupByDay splits "Saturday & Sunday" into real days
  against known day names — wall sections and dock tabs share the logic (ST-1).
- **Set-times**: hour rail moved OUTSIDE the horizontal scroller (sticky-in-grid
  is a no-op — a grid item's containing block is its own area), rail + grid
  share one rows template (CORE-2). Search in a scheduled fest renders per-day
  chronological results with stage · time on each card (CORE-4); the sort
  control hides in timetable view rather than silently no-op (CORE-5 — a
  timetable has one true order; search results sort by time).
- **Sync honesty**: applyRemoteDoc's visible slice now includes notes + meta
  (CORE-6); open sheets repaint on remote change (CORE-16). NEW from smoke
  testing: crew-gone now requires the API's own JSON 404 — a platform/routing
  404 (broken deploy, stale SW) must never wipe remembered crews.
- **Navigation (FLOW-2)**: js/v3/router.js — history-backed layer stack
  (settings / drills / sheets), back closes top layer, forward re-opens,
  refresh restores, Escape = universal back, #g= survives. Pure diff logic
  unit-tested with a simulated session history.
- **Lost states**: bad/expired links get a real screen with paste-a-link
  recovery; dead crews are forgotten with a toast (FLOW-3). Boot has an error
  boundary + global no-screen-visible net (FLOW-4). Offline fest-switch loads
  before persisting; boot falls back to a loadable fest with a toast (CORE-12).
- **Tools**: bulk paste is an integrity gate — strict level labels, lineup-only
  artists recorded under canonical spelling, migration-gate blocks the whole
  batch, every skip reported (CORE-8). Day image rebuilt: offscreen fixed-width
  render per day, real error surfacing (CORE-7 — old path shipped 0-byte PNGs).
  Pick counts use picksFor, dropping tombstones (CORE-13).
- **Misc**: custom fests can't shadow canonical ids (client guard at save +
  read — server-side guard deliberately skipped: token holders only hurt their
  own crew's view, and read-time canonical-wins makes shadowing impossible)
  (CORE-9); empty-lineup fests keep the notes composer (CORE-10); add-festival
  save try/catches (CORE-11); Spotify Client-ID save double-writes + re-renders
  the drill (CORE-14); honest no-button toast + migration banner w/ retry
  (CORE-17/18).
- Tests 63 → 87 (jsdom added as devDependency for DOM regressions).

## 2026-07-11 (evening) — v3.1 fix phase begins: FLOW-1 (the P0) on v31-polish

- Branch `v31-polish` off main. FLOW-1 fixed per the decided hybrid: share
  links now carry `&f=<festId>` (crewLink + festFromHash, captured at boot
  before enterApp's replaceState strips it), and `meta.inviteFestId` — the one
  carve-out from the doc-shape freeze — is stamped at crew creation and
  refreshed on Share invite, through the normal validated merge path.
- activateCrew takes the hint only when the device has no saved fest for that
  crew (returning devices keep their own context); unknown ids fall through to
  the old default. Validator: meta accepts exactly name + inviteFestId.
- 7 regression tests in tests/invite-context.test.mjs, incl. an end-to-end
  check that recordInviteFest's overlay passes validateIncoming. 63/63 green.

## 2026-07-11 (afternoon) — v3.1 discovery: audit-first, findings banked

- Kevin's morning pass found ~10 real problems the overnight gates missed
  (incl. a set-times vanish bug and broken Spotify OAuth) → run restructured
  audit-FIRST at his direction: "don't play whack-a-mole; robust, top to
  bottom." His findings became the calibration set for the machinery.
- Discovery engines: (1) 54-agent design-audit workflow — 3 Playwright walkers
  on prod at 390/768/1440 as throwaway crew "Audit Rig" + code finders +
  reviewer lenses + opus dedupe + adversarial verify → 34 confirmed findings
  in 8 classes (claude-plans/2026-07-11-v31-backlog-workflow.md); (2) blind Codex gpt-5.6-sol
  whole-repo UX pass → 51 findings (claude-plans/2026-07-11-codex-v31-ux-review.md).
- Calibration: 15/16 of Kevin's findings independently rediscovered. One
  structural miss (Spotify redirect — rig had no Client ID, walkers died one
  step early); lesson: Stage-4 re-run must seed a Client ID + walk offline.
- Cross-model headline: both engines independently flagged the same P0 —
  invites lose festival context on new devices (joiner lands on Lost Lands).
- Merged, re-judged, sequenced: claude-plans/2026-07-11-v31-backlog.md — 1 P0 / 24 P1 / 32 P2
  in 9 fix classes. Supporting docs shipped same run: docs/user-flows.md (the
  executable spec — mismatch is always a finding), design direction, fix-phase
  grounding (hg-save-it lens), frontend-design skill installed to hg-agents.
- Deliberate boundary: ZERO app-code edits this session — findings cite
  file:line against a stable tree; the fix phase starts from a cleared
  context reading the banked docs (NOW.md has the read order).

## 2026-07-10 (overnight) — v3 SHIPPED TO PRODUCTION (main)

- Full arc in one overnight run: P0 grounding -> P1 design system -> P2 data
  layer (Codex gate: 3 P0s fixed structurally) -> P3 all screens (walk gate)
  -> P4 festival-add API -> P5 SW v13 + living favicon -> P6 final gate +
  live migrate integrity -> merge to main -> production -> all three real
  crews pre-migrated to v4. Morning report:
  claude-plans/2026-07-10-v3-morning-report.md.
- Review economics that worked: bank-as-you-go reviewer files (two reviewers
  "vanished" from the registry but were merely slow — both delivered), gates
  at phase boundaries, every finding dispositioned same-night with the fix
  cited back to its finding number.
- The guard + classifier stack worked as designed: blocked a CREATE TABLE on
  an ON DELETE CASCADE word-match, then correctly refused a credential-
  materializing workaround — table creation deferred to Kevin rather than
  routed around. Layered defenses > my in-the-moment reasoning.

## 2026-07-10 (overnight) — v3 P3: THE WALL SHIPS (branch `v3-design`)

- index.html replaced wholesale with the v3 shell (landing 21a, join 21b,
  wall 21c). js/v3/app.js orchestrates boot -> join -> wall; js/v3/wall.js
  renders day sections of aura cards from live picks (model.js reads), owns
  the tap cycle (0-4-0 with undo toast on the 5th tap), search/sort, and the
  dock scrollspy (IntersectionObserver). Legacy person colors map onto the
  24-board deterministically (old palette position -> board slot, no writes).
- sync.js: sv:4 semantics declaration on every push; requestMigration() calls
  the server-side op; setSyncStatus feeds both dots. All doc-derived strings
  render via textContent (gate rule).
- LIVE-VERIFIED on the branch API (vercel dev :3111 + throwaway v4 crew):
  join -> claim -> 117-artist wall -> tap x5 = alpha ladder/must-pill/clear+
  toast in the DOM -> server doc shows level 4, v:4, sync online. The one
  test hiccup was the July-7 service worker still controlling old tabs —
  expected; skipWaiting converges on the second load.

## 2026-07-10 (overnight) — v3 P0+P1+P2: grounding, rig, design system, data layer (branch `v3-design`)

- **P2**: doc v4 semantics (picks 0-4, keyed-object notes, spotifyStats,
  colorIndex) + version-aware client reads. Codex gate (blocking) found 3
  P0s; all fixed STRUCTURALLY: migration moved server-side (?op=migrate, one
  atomic SQL transform, v never client-writable), note ids must carry their
  author prefix, sv:4 semantics declarations with SQL choosing the mapped
  delta for stale clients. 56/56 tests incl. concurrent-notes both-orders.
- **P4 core**: /api/festival-add — Gemini search-grounded research ->
  validated candidate + sources -> user-confirm -> crew-private upsert.
  Festival rules extracted to api/_lib/festival-rules.mjs (single source of
  truth with CI validator). custom_festivals DDL deferred to Kevin (guard
  false-positive on ON DELETE CASCADE; classifier rightly blocked the
  workaround).

- **P0**: four foundation docs deep-read → distillation in the grounding doc;
  compaction hooks + Neon destructive-op guard installed and behavior-tested;
  design atlas read in full → `assets/v3-tokens.css` + `claude-plans/
  v3-inventory.md`; @vercel/blob + migrate-legacy.mjs deleted (prod deps = 1);
  Anton/Inter self-hosted (Inter as one variable woff2); CI now runs on all
  branch pushes.
- **P1**: `js/v3/palette.js` (24-board from the design project's 12a AURA,
  canonical first four; stable colorIndex) + `js/v3/aura.js` (pure-function
  port of the atlas renderVals — 9 tests pin the EXACT gradient strings) +
  `assets/v3.css` (every component: cards/cells, corners, chips, toolbar,
  sheet, dock, settings, notes, segmented, toggles) + `gallery.html`
  exercising the production stylesheet with atlas-verbatim data. Verified in
  Playwright: computed backgrounds match the engine, self-hosted fonts load,
  full-page screenshot eyeballed against the atlas.
- Palette nuance worth remembering: slot 3 is the README's curated green
  hsl(150,70%,50%), NOT the board's naive 150-bright — greens at 90% sat fail
  the 0.5-alpha-on-#141021 legibility rule.

## 2026-07-09 — Data archaeology + archive fests (branch `rescue-and-archives`)

- **Root-caused the "missing EF saves"**: the legacy blob was clobbered to 402
  bytes at 09:10:14 on Jul 7 — sixty seconds before `migrate-legacy.mjs` ran —
  so the migration's byte-for-byte verify faithfully copied an already-emptied
  doc. The 3 surviving picks were all that reached Neon. (The Blob write-loss
  failure mode, again; it destroyed real data before the ban was written.)
- **Recovered Lollapalooza 2025**: two independent survivors — `lollaSelections`
  in Chrome Profile 2's LevelDB (10 artists/17 picks, read via classic-level on
  a copy) + the Aug-2025 blob (4 more artists). Union validated against the
  shipped lineup (0 orphans), written as new crew "Lolla 2025" (6 people,
  21 picks, verified leaf-by-leaf). Token in chat only — repo is public.
- **recover.html**: self-serve rescue page for device localStorage (all key
  generations: `fn_data_v2`/`fn_pending_v2`, `lollaSelections`,
  `fn_spotify_libmap_v1`). Preview → merge via existing `/api/crew` → read-back
  verify; EF id remap, tombstone drop, unknown-people skip, never-lower rule.
  E2E-tested with Playwright against a throwaway prod crew (then deleted via
  Neon). Exists because phones that synced at EF still hold the crew's picks.
- **Three archived festivals** researched + adversarially verified (6-agent
  workflow, ~766K tokens): `ubbi-dubbi-2026` (50 acts; Day 2 weather-cancelled
  mid-event), `wicked-oaks-2025` (68 acts; 4 announced-but-cut excluded),
  `acl-2025` (124 acts, day + W1/W2 flags; final performed lineup incl. Killers
  headliner swap). Principle: final published set times are truth.
- **Learned the level semantics**: 1=Nice to See, **2=Highlight, 3=Must See**
  (`js/ai.js:84`, tap cycle `js/app.js:423-425`) — don't assume 2=Must.
- **Security**: The Crew's token is in this public repo's git history (NOW.md).
  Removed from HEAD; rotation queued as Kevin's decision. New rule in project
  memory: grep for `#g=` before committing docs.
- SW cache v11→v12 (tailwind.css grew recover.html's classes).

## 2026-07-07 — Prime-time build (P1–P7, one session)

- **Crews shipped**: capability-link model (160-bit token = access), landing/join flows,
  per-device "me", crew switcher + share button. Legacy global doc migrated into Kevin's
  crew (verified byte-for-byte, twice) and `/api/selections` retired with a 410.
- **Storage pivoted mid-build, on evidence**: Vercel Blob (plan A) measurably lost writes —
  eventually-consistent reads even with cache-busting (stress test: 3/6 stale, 1 write gone
  permanently). Rebuilt on Neon Postgres: single inline atomic `UPDATE` via
  `jsonb_deep_merge()` (source: `db/schema.sql`). A CTE draft lost 2/6 concurrent merges
  (snapshot-before-lock); inline survives 18/18. Do not reintroduce a CTE read.
- **Festival model v3**: per-festival JSON + validator + importer; sortable artist list view
  for lineup-only festivals (ACL weekend filter); overlap-aware grid lanes replace the
  "also happening" workaround (activities list stays, data-driven). Six 2026-27 festivals
  researched from official sources and loaded.
- **Spotify via PKCE**: per-crew Client ID, zero server secrets, tokens device-local,
  library scan → per-person badges, playlist-from-picks on the member's own account.
  Verified to the OAuth boundary; live round-trip needs Kevin's allowlisted app.
- **AI hardening**: raw-prompt `/api/gemini` deleted; structured `/api/optimize`; shared
  per-IP rate limits + same-origin checks; AI HTML passes a tag whitelist.
- **Reviews**: two Codex passes (first hung, respawn delivered) + a background security
  review + a final 4-dimension workflow fan-out. All confirmed findings fixed same-day:
  prototype-pollution key handling, compressed-vs-text size gate, outgoing-crew flush on
  switch, boot re-entrancy guard, offline-join cache fallback, escaping gaps.
- **Gotchas that cost time**: `vercel dev` doesn't serve files created after start (restart
  it); the Write tool serialized literal `\x00` bytes twice when regex escapes were meant;
  old CLI's `--yes` created a stray project from a wrong cwd (cleanup: Kevin deletes
  `festivals` project in Vercel dashboard).

## 2026-07-07 — Prime-time build kickoff (P0)

- Grounded in hg-ground-it four-doc pass; plan at `claude-plans/2026-07-07-prime-time.md`.
- Verified external constraints from primary sources: Spotify dev-mode = 5 users/app + owner Premium (Mar 2026); Vercel Blob Hobby = ~5GB / 100K simple / 10K advanced ops per month, pause-not-bill.
- Decisions locked with Kevin: capability-link crews (no accounts), Spotify via PKCE with per-crew client IDs (zero server-held secrets, playlists on the member's own account), stay on Vercel.
- Known defects to fix (found in code read): del-then-put data-loss window + write race in `api/selections.js`; world-writable global doc, CORS `*`; `/api/gemini` = open LLM proxy; Kevin-only baked Spotify affinity; no lineup-only view; grid cannot render same-stage overlaps (the real reason the "also happening" list exists).
- Branch `prime-time` created; durable-build state files + compaction hooks installed.
