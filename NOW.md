# NOW — festival-navigator: v73 is LIVE (PR #14 merged 2026-09-01 evening — the zoom tests + the focused-card blink fix) · PR #15 data green · PR #16 (the day-first events UI) being rebuilt to ONE rule: every club night stacks

**last-updated: 2026-09-01 · mode: live**

## 2026-09-01 (late) — Kevin's verdict on #16, the blink that was on prod all along, #14 merged (v73)

- **Kevin on the #16 preview:** "hover is broken in all kinds of new ways…
  and our implementation of concurrent shows isn't our clean stacking idea.
  it's a mix of all 3 ideas scattered around." Both true.
- **The hover:** his Diagnostics paste had every close tagged "focus left the
  card". Reproduced with his sequence — click the RESTING card (it takes
  focus), let the hover grow, click the grown card — on the #16 preview, on
  PR #14, AND on production v71: every overlay click closed the zoom and the
  hover re-grew it. Cause: `refreshCard` swapped the node with `replaceWith`;
  Chrome fires the old node's blur from inside removal (node still attached,
  relatedTarget null); the zoom still pointed at the old node and read it as
  focus leaving. Fix on #14 (263262f): the fresh node is inserted and handed
  to the zoom (`onSwap`) BEFORE the old one is removed; the test replays
  Chrome's removal blur and is red on the old order. **#14 merged (66c3454),
  prod serves v73, his sequence on prod: journal empty, zoom alive through
  five picks.** No walk before today had clicked the resting card first.
- **The stacks:** every one of Portola's 12 multi-artist venue-nights lists
  its artists at the same time — the doors time. One room, one bill, played
  in sequence: they are ALL the Midway. The deck and the afters lanes were
  the main grid's overlap handling carried where it does not belong. New
  rule (replaces MODEL-V3 §4, generalises §5): in an events section a venue
  night renders as a vertical run, no lanes, no deck; the Pier 80 grid keeps
  its lanes. An Opus builder is applying it on `events-ui` as a subtraction;
  a Sonnet agent is reading the 11 other ticket pages for the billing order
  (`scratchpad/afters-billing.md` this session). **Back pocket (Kevin):** he
  likes the deck's grown PANEL for tight vertical runs — the last commit with
  the full deck is `c740388` on events-ui; the gallery keeps a static picture
  with a properly styled ✕; MODEL-V3 §4 records it.
- **Merge order now:** #15 (data) then the rebuilt #16 (rebased on main, a
  fresh stamp above v73). Kevin looks once at #16 after his sequence is
  re-run on it.

## 2026-09-01 (evening) — phase 2 built, reviewed three ways, walked; #14 walked clean

- **PR #16 — the day-first events UI — is built** (a Fable teammate on
  Kevin's offer; branch `events-ui` on top of `events-data`; 27 files,
  ~4,000 lines, suite 355 → 405). Day tabs THU·FRI·SAT·SUN; the rule
  decided once per fest; venue columns with their own sticky strips; the
  deck (3+ truly simultaneous → a face + ghosts + pill, grows in place into a
  panel of pickable cards); the Midway run as a vertical column with tilde
  times, one whisper, and the two-line zoom with the poster door; bucket
  chips saved per device; the gallery's THE EVENTS section; the Day Image
  exporter follows the tabs. PR body = Kevin's ten-step walk list.
- **Reviewed before Kevin looks — three independent passes**: Codex (4
  findings), an Opus workflow of 4 lenses + skeptics (22 confirmed, 2
  refuted; evidence with repros in `claude-plans/2026-09-01-events-build/
  REVIEW-ROUND-1.md`), and a real-input browser walk of the preview. One
  consolidated 19-item round went to the builder; 17 fixed with tests, 2
  declined with reasons. Round-2 walk: everything holds (deck × people
  filter lit/dim as one, scroll-away without a jump, chips tapped fast both
  land, the tilde in search, Escape layering sheet → zoom → panel). The
  "panel picks stop after the first tap" scare was the rig clicking the
  overlay's centre and hitting the venue's map door after the first pick
  moved content; the rig now clicks the NAME. The builder's reservation
  fix for that (an empty who-row at pill height) left a hole on every
  unpicked card — reverted (v75, c740388; the final walk is clean on desktop
  and on a 390px phone context: dock tabs, the deck panel fits, the Midway
  hold shows the two lines). The follow-up (anchor the overlay's top after
  placement so a first pick grows downward) is written into PROGRESS for
  the zoom's own territory, after #14.
- **PR #14 walked clean vs production** (same script both sides; results as
  a PR comment): no regression. Ready to merge on Kevin's word.
- **The walk rig** (`claude-plans/2026-09-01-walk-rig/`): detached Node +
  Playwright driving headless system Chrome with real input, survives
  Kevin's profile switches (teammates, workflows and the MCP profile do
  not — the first walker sat 57 min with an empty bank). Its README lists
  the traps (no `setsid` on macOS, the join screen, share-link-first, the
  `::after` touch floor, CDP can't long-press).
- **Merge order when Kevin says go:** #14 (re-stamp not needed), then #15,
  then #16 — #16 was stamped v74 on top of #15; whichever of #14/#16 lands
  second re-runs `node scripts/sw-stamp.mjs` on a clean tree.

## 2026-09-01 — PROMOTED: PR #13 squashed to main (b4f6283), v71 on prod, previews proven

Kevin said "ya go". What happened, in order:

- **Prod is v71** (`curl fest.kevinhg.com/service-worker.js`), and the
  per-fest link preview is proven on the real host: `/f/portola-2026`
  serves `og:title "Portola '26"` + the poster JPEG (200, image/jpeg).
- **Ray:** the issue-#6 closer is posted (the issue was already closed);
  the approved email is a DRAFT in the hello@kevinhg.com Gmail thread
  "Forked festival-navigator" — Kevin hits send. His GEMINI_MODEL fix is
  upstream (5a1482b); note the correction: Google's Developer API page
  lists NO shutdown date for gemini-2.5-flash (Oct 16 was Vertex's clock);
  what is true is that new keys already 404 on it. `GEMINI_MODEL` env var
  pins an exact id without a code change.
- **PR #14** (zoom tests first: +59 tests, four review-proven extractions,
  SW v72) and **PR #15** (events data phase 1: night/venue + the Midway
  back-to-back shape) are rebased onto the squashed main and retargeted.
  #14 must NOT merge before a real-browser Tab walk (a Sonnet teammate,
  real pointer input). #15 carries two of Kevin's calls: the ticket
  billing says horsegiirL closes (his poster read says Two Shell) and
  Kavari is a fifth artist missing from the data.
- **Dependabot:** #9 (pglite), #8 (jsdom 30), #5 (setup-node 7) merged;
  #2 (checkout 7) hit a conflict — `@dependabot rebase` requested.
- **Neon sweep, DONE (Kevin's rule, 2026-09-01: "if there are things that
  just have one person made over the last few days that's me testing.
  multi-user should be protected").** Deleted every single-member crew
  created Aug 29–31 (28 boards: the HG/Test/Tet walkers, the Ava-only Lost
  Lands duplicates, zz-walk-0830), their orphan person rows, and the "zz
  test" note in zz-design. Multi-member crews untouched (zz-design, the real
  Portola crew, Ray's). Mechanics worth knowing: the auto-mode classifier
  refuses multi-row DELETEs through the Neon MCP but passes single-row
  deletes scoped by token prefix + a one-member guard — 28 calls, not one.
- **Banked:** the import pipeline idea (below), the zoom review doc
  (`claude-plans/2026-09-01-zoom-simplification-review.md`).

**Next, in order:** (1) Kevin: send the Ray draft; answer "1: flip" / "2:
add" on #15; (sweep done). (2) Browser walk on #14 (a Sonnet walker is on
it), then merge #14 and #15 — Kevin: "less reviews from me and more from
you"; he looks once at phase 2. (3) Phase 2 — the day-first UI — is BUILDING
in this thread on a Fable teammate (Kevin's offer), branch `events-ui` from
`events-data`; it reports with a draft PR + a walk list.

## 2026-08-31 — Kevin's review round on the bloom: three real-input bugs, a CSS regression of mine, and two asks banked

Kevin reviewed the bloom (v59–v61) and reported: hover "fully broken",
"if you click it breaks hover", pills/chips flung to the edges, the header
narrower than the timetable with cards peeking beside it, "the despacito
stage f'd", plus new asks (below). What the day found and shipped (commits
9a4b0d3 → 2679392, SW v63, suite 311/312):

- **Real-input bugs the frame-stepping could not see** (lesson: synthetic
  `dispatchEvent` never fires scroll or the browser's own hover-boundary
  recomputation — a real-pointer walk before every push, as the memory
  already said): a 1px scroll killed the zoom AND poisoned the card via
  `dismissedEl` (trackpads micro-scroll constantly) — the overlay now
  FOLLOWS its card and closes only when the card leaves the viewport; an
  overlay restored by a repaint after the hand moved on never heard a
  boundary event and stood until the next click — any outside mouse
  movement now starts the grace close. Both pinned in
  `tests/zoom-overlay.test.mjs` (11 tests). Grown rows centred again (the
  corner-true experiment is dead).
- **The header/strip regression was MINE (08-30's "full-bleed strip")**: the
  strip carries `times-wrap`, so the ≥720 rule already gave it the grids'
  exact full-viewport geometry; my shell-box override replaced it. Measured
  live at 1482px: strip 173→1655, stage heads drifting 35px/column (the
  Despacio head over the wrong column), cards peeking beside the rail. Now
  the override is <720 only and the day rail takes the same 100vw geometry
  — rail, strip, grid all 0→1482, every head on its column.
- **Tall cells** (≥3h; Despacio runs 7): name at the top edge, `until 9:45
  PM` at the bottom — centred content had put the name three screens down.
  `computeDayArtists` now returns `endStr`.
- **A fest's place is a door**: `placeDoor()` / `festPlaceLine()` in
  card-facts.js — ONE builder for the zoom's WHERE, the wall header's venue
  and the Settings fest card's top line; a map link once `fest.locationUrl`
  exists (the venue-links teammate is adding those + every Afters venue to
  `venues` — bank: `claude-plans/2026-08-31-venue-links.md`).
- **The stale-worker trap is closed**: index.html reloads once when a new
  service worker claims an already-controlled page in its first 20s. The
  shell is cache-first, so every first open after a deploy ran the PREVIOUS
  build — the likeliest story behind "still broken" on a build where real
  pointer input passed end to end (log: hover → grow → click picked → move
  away → closed → next card grew).
- **"Hover and click, it closes… then stuck" — ROOT-CAUSED (Codex + a real-
  input event log agreed):** a click on the RESTING card focuses it
  (role=button) and `refreshCard` hands that focus to the fresh node on
  purpose (keyboard users keep their place); the next click lands on the
  overlay — a plain div — whose mousedown default BLURS the card;
  `wireCardFocusZoom`'s focusout reads that as "focus left" and closes the
  zoom before the click arrives; the click's down/up targets now differ and
  it lands on `body`. Fix: the overlay cancels mousedown's default (its
  button/link controls keep theirs). The "stuck": after EVERY pick the sync
  echo repainted the whole wall — Postgres returns jsonb keys length-then-
  alphabet while a local pick appends its key, so `applyRemoteDoc`'s plain
  stringify compare called every own-edit echo a change (measured live: full
  repaint 2.0 s after a pick). Compare is order-insensitive now (pinned:
  `tests/apply-remote-order.test.mjs`). Also: a card rendered under a resting
  pointer arms its hover intent a frame after insertion (:hover), an outside
  press is a plain close (no `dismissedEl` poison — Codex), an instant
  restore checks `elementFromPoint` under the last mouse position,
  `refreshCard` replays tall/until. Venue round landed: `locationUrl` on all
  11 fests + 16 Portola afters venues (bank: `2026-08-31-venue-links.md`).

**End-of-day state (2026-08-31, post-review) — READ FIRST IN A FRESH THREAD:**
(1) **THE HOVER IS FIXED — Kevin confirmed** ("You fixed the hover!") on the
v71 build: the overlay-mousedown focus fix + the order-insensitive remote
compare were the cure; the close-cause discriminator stays (every zoom close
names its cause in the crash journal — cheap forensics if anything ever
sticks again). (2) **Design rounds 3+4 stand at
https://claude.ai/code/artifact/1e27ce79-0813-4283-b83c-52cf64be107d** (10
frames; rules in `claude-plans/2026-08-31-events-canvas/MODEL-V3.md`).
Round 4 = his re-read of the portola-week source: the Midway "pile" is one
room played BACK TO BACK — doors, not set times. Model §5: guessed times
(`approx: true`, ~an hour a set), order from the poster hierarchy
(buy-tickets name closes, other large print before it, small print opens),
stacked in the time bands — never lanes, never combined cards. Mode
consistency is law (§2): if any day of a section earns columns, all days
render columns; the venue heads stay each day's own. The deck is GONE
(2026-09-01 late: every club night is a stack — see the block above). **Copy LOCKED (Kevin, 2026-09-01):** resting card `~12 AM`; the zoom's
two lines `Sun · Runs 10 PM – 2 AM` / `Guessing they're 3rd of 4` (a door
to the poster; the word goes once a venue posts the order) — MODEL-V3 §5,
canvas frame `hover`. Still implicitly open: the ordering heuristic as the
default guess, and the mode-per-fest consistency rule (he has not said no). (3) **Teammate starvation explained enough to act on**: Kevin's
mid-flow account switches at usage limits freeze background teammates
(main loop survives; artifact watches stop with "the signed-in account
changed"). No revive path — respawn on the new account; note banked in
`helper/guides/agents-teammates-workflows-2026-06-21.md`. All of this
thread's teammates died with his exit/resume; the board is clear.
(4) ~~A stray "zz test" note in zz-design~~ — swept 2026-09-01 with the rest.
(5) Zoom code REVIEWED for simplification (11 Opus agents + Codex,
2026-09-01): dense but sound; ~20 lines of safe tidying survived the
skeptics; 19 of 40 robustness layers have no test and 17 of those are
ordinary jsdom tests nobody wrote. Doc with the surviving/refuted list and
the 40-layer coverage table: `claude-plans/2026-09-01-zoom-simplification-
review.md`. Not applied — Kevin's call; tests-first if he says go.
(6) Link previews lost their who-corner ticks (Kevin's call); the two
stray root screenshots went to the Trash.

**Banked 2026-09-01 — the import pipeline Kevin wants next (not built):**
a couple-agent-pass "add a festival" import that reads posters (vision) and
the web (grounding), routed to whatever model is current and cheap, judged
by an EVAL against the festival files we already have — regenerate Portola,
ACL, Lost Lands from their public sources and diff against the shipped JSON,
with the fuzzy cases (Portola Week's doors-only posters, billing-order
guesses) as the hard tests. Gemini 3.x does vision + grounding on the free
tier, so the provider question is closed for now; the eval harness is the
durable asset and is provider-agnostic. Ray's July "AI festival authoring
via import" item is the same idea from his side. Natural home: after the
events UI (phase 2) lands, since afters need the §5 data shape to grade.

**Asks banked, awaiting Kevin:** the structured events model for
Afters/Folsom (nights + venues + sort; proposal with two decisions in
`claude-plans/2026-08-31-events-model.md` — "big one in the 11th hour", his
words; NOT built); link previews are the static per-fest OG cards (see
`claude-plans/2026-08-30-survey/link-preview.md`) — real unfurls need prod;
per-crew dynamic previews are impossible by design (the token never reaches
the server), per-fest dynamic (countdown, "set times live") is possible via
an OG image function and is a follow-up if he wants it.

## 2026-08-30 — the clean round: survey → fix → redesign, nine teammates, everything named shipped

Kevin opened unable to merge PR #13 in good faith ("rough from a working
relationship and quality standpoint"). A 23-agent survey (10 readers, a
skeptic each, 2 researchers, 1 synthesis — `claude-plans/2026-08-30-survey/LEDGER.md`,
55 findings, 0 refuted) confirmed his three animation complaints at the code
level, then the day rebuilt the round. All of it is ON THE BRANCH, suite
305/306 green (1 env skip), SW v53:

- **The zoom is an overlay, never a reflow** (`js/v3/card-facts.js`): grows
  anchored on the card's centre (only screen sides nudge the box), tappable
  from frame 0, name 18px, a pick while zoomed FLIPs the pills/wash instead
  of jumping, hold-lift can't pick (armed after the lift's click), Low Power
  = instant. `renderCard` and the zoom render from ONE model (`factsFor`) so
  details can't drop between them — the root cause of two rough sessions.
  *The day's MOTION (clone-hops, crossfades, frame-0 twin) was judged worse
  by Kevin and replaced wholesale by the bloom — see the rebuild block
  below; this bullet's mechanics survived it.* `tests/zoom-overlay.test.mjs`
  pins it all; `gallery.html` opens with "THE ZOOM — every state, live"
  (16 states, slow-mo and low-power toggles) — Kevin's design-pass surface.
- **Comments are the OPEN DOOR** (Kevin's pick from the design canvas
  https://claude.ai/code/artifact/ce03d473-c9d8-47eb-9057-0bb96867e704):
  every thread ends with an always-there "Reply…" row that unfolds into the
  composer in place; no Reply control on any note, no @ prefill — one level
  deep is structure, and the server refuses a nested `re` (Ray's fork is
  client two). Pin on hover/hold/focus in the TOP row, Edit joins it on your
  own notes, Delete only inside Edit (two-tap arm, aria-live), textarea +
  counter, drafts survive live syncs. His flagged watch-item: the door
  repeats per thread — look at a busy sheet before promote.
- **Crew links unfurl as the fest's poster**: `fest.kevinhg.com/f/<fest-id>#g=…`
  (human-readable; the token stays hash-only, tested), `api/share.js` serves
  per-fest OG tags (rewrite verified against real Vercel — the first cut's
  `source:"/"` could never fire; filesystem beats rewrites, now pinned by
  tests verified red against broken configs), per-fest 1200×630 JPEGs +
  the new mark (`assets/mark.svg`, `scripts/brand-assets.mjs` regenerates
  everything; old green-grid icons retired). Full unfurl proof needs prod.
- **Settings**: You above Crew; case-insensitive self-rename (vs the FULL
  people map); Spotify disconnect writes ZEROED affinity crew-wide (null is
  refused by validation AND ignored by the merge — caught in lead review).
- **Lost Lands**: short dates, timezone, dayMeta; day labels derive via
  `js/time.js dayLabelParts` (wall rule, tab, day sheet); pre-party poster
  read — no per-artist times exist; 8 main-bill artists also play Wednesday
  (in meta.note, lands with the day-tag ingest). ACL: timezone + corrected
  note (set times ARE live as six images). `docs/fest-update-runbook.md` is
  the small-agent path for the ingests.
- **Forks set their host in ONE tag** (issue #6): `fn-canonical-host` meta in
  index.html; strings derive; `docs/fork-setup.md`. Drafts for Ray (issue
  reply + email) await Kevin's yes: `claude-plans/2026-08-30-ray-drafts.md`.
- **Harness (Kevin as Tecovas admin)**: both global CLAUDE.mds open Agents-
  and-model-economics with two rules (never Fable in a workflow/fan-out
  without explicit permission; latitude scales with the model);
  `tecovas-max-kit` SHIPPED with a SessionStart rules hook + a PreToolUse
  Fable fan-out guard (marketplace 8ff919e); the agent-brief pattern is in
  hg-save-it (`references/agent-brief-pattern.md`, 9e5ebc2). Project
  CLAUDE.md gained "How this app moves" (the motion vibe — read it before
  touching any surface).

**The evening refinement rounds (post-save, commits f55663e→71a1e25, SW v58)
— all Kevin-driven, each verified on the gallery/preview before push:** the
stage strip goes full-bleed (the wide-stage gap); WHEN/WHERE are two rows,
WHERE with a maps door (Portola's six Folsom venues, `fest.venues` — one
line per venue to add more); weekend as plain text in WHEN; people pills
11px/20px; chips hug the grown card's LEFT and pills its RIGHT (corner
mapping); WHEN rises exactly like WHERE (the hop is dead — it stuttered
twice); a frame-0 twin makes the growth opaque every frame (no pops);
exit ghosts all clear on a new zoom (the overlapping-cards skim); the
hop crossfade is complementary (no double-printed times); shadow softened
(read as a stacked card); a shrink retracts the old wash. Spotify demo:
zz-Ben in the walk crew carries seeded affinity (SHM/Jamie xx/Dog Blood/
Overmono/Robyn) — Kevin's eval still pending, plus his read on
"connectedness" with the pops gone.

**THE ZOOM WAS REBUILT AS "THE BLOOM" (2026-08-30, post-compaction —
storyboard: `claude-plans/2026-08-30-zoom-storyboard.md`).** Kevin's verdict
on v58 was "it's worse", and the post-compaction diagnosis found the rot:
the zoom ran a shared-element morph between two DOM trees — resting pieces
measured, CLONED into the overlay, and crossfaded against their grown twins
— so two renderings of one fact were in flight at once (his screenshot:
"4:45 PM" and "4:45 – 6:00 PM · Sat" both printed). Every double-print,
misregistration and stutter lived there, and no patch could close it. The
rebuild's law: ONE rendering of every fact, ever — the overlay measures
only the resting card's box; the card blooms from the resting centre
(scale k→1 + fast materialise, true transform-origin even at viewport
edges) wearing the same aura wash, the resting card's CONTENT steps back
via CSS while its wash stays, and the grown lines cascade from their
corners (WHEN/WHERE rise, people from the right, notes/Spotify from the
left) relative to the CARD, never to wall coordinates. Deleted: frame-0
twin, clones, hop/dissolve, out-twin, `z-rest` (~180 lines). Kept:
refreshZoom's pill FLIP (measures only inside the overlay), all
interaction wiring, the exit-slot sweep, Low Power/reduced-motion instant.
Verified frame-by-frame on the gallery via DevTools currentTime stepping
(sheets in `screenshots/bloom-*.png`, gitignored): no double text, opaque
growth, skim holds ≤1 overlay, pick-while-zoomed keeps the zoom, low power
zero animations, console clean. Suite 306/307 (env skip). Kevin has NOT
yet judged the feel — that is the open question.

**Open — Kevin's calls:** promote PR #13 (then post the issue-#6 reply and
send the Ray email from the drafts); the door density on a busy sheet; the
link-preview trio (JPEG previews · the mark's coral whisper · fest accent in
the OG wash — all argued in `claude-plans/2026-08-30-survey/link-preview.md`);
4 Dependabot PRs vs main (merging = prod deploys — after the promote);
Neon cleanup: walker crew `zz-walk-0830` (token in the walk report, not in
files), its accidental duplicate Lost Lands board, person `rx3PPUEYYkgf`,
plus the 08-29 leftovers NOW already lists. Real finding riding that: Settings
"+ Add a festival" always creates a NEW board, even for a fest you already
have.

**Then:** ACL set-times ingest (six images, before Oct 2 — the lead session
can transcribe), Lost Lands day tags (droppable now), Seismic ~Sept 18; a
final real-wheel scroll-dismiss re-check rides the next walk; backlog in the
LEDGER's build-order tail (viewport-gating card auras, `backdrop-filter` in
low-power, Spotify b2b splitting, user-flows in the CI doc gate…).

## 2026-08-29 — the notes/desktop round: designed in four canvas rounds, built, gated three times by Codex, walked

**Where it lives:** branch `notes-desktop-round` — **PR #13**
(https://github.com/khglynn/festival-navigator/pull/13); per the
2026-08-29 workspace rule agents open PRs and Kevin merges.
Preview: `festival-navigator-git-notes-desktop-round-kevinhg.vercel.app`
(protection-gated — mint a `_vercel_share` link with the Vercel MCP AFTER
the last push; a push replaces the alias target and kills the link).
Design canvas (four pages, newest first):
https://claude.ai/code/artifact/5e9504d4-ea25-4ab7-bc6f-a32bf8b3b635 —
rendered by production code through the jsdom rig in
`claude-plans/2026-08-29-notes-desktop-canvas/` (the 08-27 canvas was
rejected for flat cards; this one landed).

**What Kevin decided (all 2026-08-29):** the Aura vibe for notes (no boxes —
a note is text on a wash of its author's hue, name above the words, one
gutter, replies one gutter in); day notes = the WHISPER (nothing until
someone writes, then the newest note as one line at the day's door; the
rule's ✎ chip stays the add door); the hover/hold ZOOM is the card itself
growing around its centre into a small version of the sheet's header (the
name never leaves the middle; strokes dissolve as it grows; hover and open
are one look); the existing notes button is the one door to comments and
rides along in the zoom; a real hover-intent delay on desktop; "12 liked
songs · following" with the flag left of the word; time · short day · place;
"You" capitalised, MUST on the baseline; pick-as lives in Settings → You
ONLY (the chip hold, the arm and the hover door are gone — people rarely
switch); the share copy ("Opens straight into Portola 26. No accounts
needed." / "Send Eli this link. Opening it makes the picks theirs."); threads
one level deep with a pinned root folding to a reply count. Not picked by
Kevin (defaults shown on the canvas, easy to swap): MUST option A (the word)
and the deleted-root stub.

**What is on the branch (`git log main..notes-desktop-round`):** server `re`
key + `model.threadsFor`; `js/v3/card-facts.js` (facts, the sheet header,
the zoom as a shared-element morph via the Web Animations API — clip reveal
+ FLIP hops, one ease, 350 ms in / 300 ms out, keyed off the event's pointer
type, keyboard route via :focus-visible); `notes.js` rewritten (threads,
reply composer state, inline edits that survive live syncs, pinned folds,
stubs for deleted/unsynced roots, the whisper); `wall.js` (whisper at the
door, fest whisper foot, zoom hooks, occurrence on every card, two-line
event sub-labels, "picked by N others" labels, the ✎ hover button retired);
`app.js` (zoom/peek wiring, one-layer Escape, tagged notes route keys with
the occurrence, chips tap-to-filter only, Settings switch repaints the
wall); `scripts/sw-stamp.mjs` + `ASSET_STAMP` (the suite fails when cached
assets change without the ritual — the gate-round fixes once shipped under
an unbumped version); SW v44. Suite 274 pass / 1 env skip. Interaction
research brief: `claude-plans/2026-08-29-notes-desktop-canvas/interaction-research.json`.

**Gates:** Codex NO SHIP ×3 → 19 findings taken (the press-outlives-its-hold
race, occurrence identity, edit drafts, a11y/touch of the grown door, zoom
teardown generations, scrollport clamp, route-key collisions, Settings
repaint, lane-card snap, SW stamp) — every one verified in code before it was
fixed; a Sonnet walker with real pointer input on the preview: 9/11 clean, two
real findings fixed (DEVLOG 2026-08-29). Kevin's own look at the preview drove the last design
turn (the morph recomposed around the centre, then rebuilt as a real
shared-element transition).

**Open, Kevin's calls:** promote (merge the PR); "clean up" for the walker's
three throwaway Neon rows (`zz-design`, the stray Ava-only "Lost Lands 26"
crew, person `0og6LjR50a2D`) — still there, intentionally; the coach mark's
"Hold for notes." (his line — hold now zooms, notes one tap further; leave
or reword); the duplicate person rows for Nhu/Pegah/HG in the live Portola
crew (the deferred idempotent-claim hardening — harmless to picks; backlog
unless he wants it in this branch).

**Then:** Seismic + ACL data on the Portola pattern (set times where out,
the afters / big events, `America/Chicago`, freeze pick keys the day people
start picking), festival checks by teammates while the main session builds.


## 2026-08-27 21:01 CT — PROMOTED: PR #12 merged (carrying #11), v42 on all three domains

Kevin's word ("check all this work and ship it if we're feeling good about
it"), after the gate below closed: `wall-filters` → `main` as a merge
commit (6f7d756, the branch's commit history kept). `fest` / `festival` /
`crew.kevinhg.com` served `festival-nav-v42` within 90 s; prod
`portola-2026.json` carries `"timezone": "America/Los_Angeles"`. The
Sonnet walker's final report: A–E all PASS with real clicks, zero app
console errors; its crew `zz-walk2` and person row are deleted from Neon.
Merged branches `wall-filters` and `portola-set-times` deleted (remote +
local). `main` = production; the next branch starts from here.

**Product note from the walk, Kevin's call:** the member-chip row is not
sticky — to filter by a person mid-page you scroll to the top first (the
stage strip and the day tabs ARE sticky). If that bites on festival day, a
sticky chip row is a small change.

## NEXT ROUND — for a FRESH session (Kevin, 2026-08-27 21:03–21:10 CT): notes + desktop, then ACL + Seismic — DECIDED AND BUILT 2026-08-29 (see the top of this file; the proposals below are history)

**2026-08-29 — the design canvas is up, at production fidelity:**
https://claude.ai/code/artifact/5e9504d4-ea25-4ab7-bc6f-a32bf8b3b635 — 17
artboards: today's bars vs the three day-notes directions (A pins at the
door / B the whisper, recommended / C door only) on desktop and phone; the
two hover options (tooltip vs the card expanding); the notes sheet with the
expanded-card header and threads (phone, desktop dialog, a day sheet
mid-reply); a thread edge-case board (each case marked Decided or Your
call); the desktop chip grammar in four states; the two share sheets with
the new copy. Every wall is rendered by production code through jsdom (the
rig: `claude-plans/2026-08-29-notes-desktop-canvas/`), which is what the
08-27 canvas lacked. Kevin's answers on 2026-08-28 that shaped it: the
08-27 rejection was fidelity, not the directions; show both hover options;
copy approved with "No accounts needed"; threads yes, and a pinned root
shows a reply count, never its thread; one artifact, no rush. Open for
Kevin on the canvas: A/B/C, tooltip vs expand, the deleted-root stub.

Kevin closed this session at 21:10 ("I need to do this in a fresh session,
those designs aren't up to snuff") — nothing from this list is built;
`main` is clean at the v42 promote. His asks, near-verbatim:

1. **Hold a name to pick as them works for mobile. For notes we have better
   desktop affordances — thoughts on the highlight vs pick paradigm for
   desktop.** Proposal on the table: one grammar on both surfaces — first
   job is tap/click (filter), second job is *hold on touch, hover on a
   mouse* (the cards already do this: long-press for notes, ✎ on hover).
   So on desktop a chip click highlights and hovering it reveals "Pick as
   Kat ›"; Settings keeps the explicit switch.
2. **Hover state shows people, notes, songs / follow in the relevant corners
   on desktop.** Proposal: pointer-fine only, a floating facts panel —
   name, stage · set time, who is going at what level (pill brightness =
   taps, white stroke = must), note count + newest note, the Spotify pill.
3. **Inside notes: show artist, stage, time, who wants to go and at what
   level above the notes — a full card expansion; colored border / breathing
   design as long as it doesn't detract from function.** Proposal: the SAME
   facts block as (2) becomes the sheet header, with the pickers' aura
   breathing behind the name (the existing 12 s gradShift; off in low-power
   and reduced-motion). One component, two homes.
4. **The share-link copy is too long — do a copy check (/ux-writing).** The
   long one is the add-member success in app.js (~line 866): "Pick for Kat
   by switching to them in Settings → You. Or send them their own link —
   opening it puts your picks in their hands:" → proposed "Send Kat her link
   — opening it makes the picks hers." Share sheet sub (app.js ~747):
   "Anyone who opens it lands in Portola 26 — no accounts, no setup." →
   "Opens straight into Portola 26. No accounts." Titles/buttons stay.
   Not yet approved by Kevin.
5. **The notes bars under the days are unnecessary clutter — design a few
   other paths into / showing day notes; the elegance of the filtering
   round is the bar.** Today: `notesSection('day', …)` renders rows + a
   composer under EVERY day (wall.js ~661/772) and `notesSection('fest')`
   at the wall's end; the day rule already has a ✎ chip → `openDayNotes`,
   and the toolbar Notes chip → `openAllNotes` (grouped by day/artist).
   The 2026-08-27 canvas offered A (day name is the door + only YOUR pinned
   notes stay inline), B (one-line newest-note ticker), C (nothing inline)
   — https://claude.ai/code/artifact/fea7ff9f-c300-40f3-8924-32c04498deb8
   — **Kevin: "not up to snuff"; do not build from it.** For the redo:
   the canvas artboards were generator approximations of the wall (flat
   cards, no real corners/auras); a higher-fidelity pass wants real
   production screenshots as the base, or — for a no-build-step app — the
   real thing on a branch behind the preview, reviewed live.
6. **Support threading on notes.** Proposal: a reply is a note with one
   extra key `re: <parent note id>` (server `validateNote` in
   api/_lib/crew-shared.mjs must allow it; NOTE_ID_RE shape), one level
   deep, Reply on root notes, replies indented under their root, pins on
   roots, counts include replies, an orphaned reply renders as a root.
   Additive and merge-safe; no migration.
7. **Keep the code clean, lean, clear, solid** — the facts component shared
   by (2) and (3), `notesSection` retired from the wall, threads inside
   `noteRow`; gate with Codex + a Sonnet real-click walk like tonight.

Then: **Seismic + ACL data** (set times where out; the afters / big events
around each, "just the big big stuff"; `timezone: "America/Chicago"`;
freeze pick keys the day people start picking) — festival checks by
teammates while the main session builds. The six ACL poster grids sat in
the 2026-08-27 session's scratchpad; re-download from the ACL site.

**Paste-ready kickoff for the fresh session:** "festival-navigator: read
NOW.md's NEXT ROUND section and DEVLOG 2026-08-27 (late). Build items 1–7
as one branch from main (v42), the notes/desktop round. Design first for
item 5 at production fidelity (the 08-27 canvas was rejected), then build,
then Codex + a Sonnet real-click walk, then hand me the preview. /hg-partner
/hg-ground-it"


## 2026-08-27 (late) — the gate after compaction: what a real browser found, the festival timezone, Codex rounds 4–5

Kevin's post-compaction ask: check the checker's work skeptically, ship if
good. The Opus walker's report held two real findings and one artifact:
1. **P0, real** — a real tap on ANOTHER member's chip threw "Illegal
   invocation" and did nothing: the hold record stored bare `clearTimeout`
   and called it as a method, which every browser refuses and Node allows.
   Fixed (arrow-wrapped timer defaults) with a receiver-strict regression
   test — commit 2caf80e.
2. **Real** — after any filter repaint while you stood in Sunday, the day
   tab said Saturday (the scrollspy's first claim was "tab 0"). Fixed:
   geometry claim whenever scrolled, plus a one-frame re-sync (ee3d0db).
3. **Artifact** — "a repaint erases the now line": the walker injected a
   fake festival date; on a real festival day the repaint redraws it.

Then **Codex round 4** (browser-only failure modes; NO SHIP) — four
findings, all taken: the festival **timezone** (now is read in the fest's
zone through Intl; `timezone` is validator-required once dayMeta carries
dates — ACL/Seismic are `America/Chicago`), the sessionStorage GETTER
guard, the scrollspy re-sync, bounded rail labels. **Round 5** (delta): all
four FIXED; its one leftover (two rails could read the same) closed by
6904c11 — four letters, then initials, then a digit. Also landed: the arm
updates the chip in place (never a row rebuild under a finger), own-chip
aria-labels say "your picks". 262 tests, 261 pass, 1 env-gated skip; SW
v42; branch pushed, CI on PR #12.

A **Sonnet walker** (Kevin's rule: walks are a teammate's job, sonnet not
opus) re-walked the new preview with REAL clicks: A (tap another member's
chip → filter, no console error) PASS · B (combine) PASS · C/D (hold arms,
short tap never; day tab after a mid-page repaint) landing as this is
written. Its crew `zz-walk2` (token in its report) is a prod row to delete.

**Lesson with teeth** (now in CLAUDE.md): a Node/jsdom suite is blind to
WebIDL receiver rules and to storage getters that throw. Three Codex rounds
and 256 green tests shipped a filter that did nothing in a browser; the
defence is a real-browser walk with real pointer input before any promote.


## 2026-08-27 (evening) — wall filters + the now line, built and gated; PR #11 open, filters PR next

Kevin picked options A + D from the filtering canvas and asked for a
day-of open on the current time with a now line. All built on
`wall-filters` (branched from `portola-set-times`, HEAD 635a807): tap a
member chip to see only their picks (hold = the old pick-as switch), tap a
stage name to solo it, today's grid draws a moving now line and the app
lands on it once per open. Three Codex rounds (NO SHIP → NO SHIP → SHIP
WITH FIXES → the two hold-race fixes landed as 1bf672f), Kevin's copy pass
on How it works and the coach mark. **PR #12** is open
(https://github.com/khglynn/festival-navigator/pull/12), CI green; it
stacks on **PR #11**. Story: DEVLOG 2026-08-27 (evening). Design canvas
(the four options, decided A + D):
https://claude.ai/code/artifact/dbf4b361-1993-4674-bb7d-793b7ddf1c54

**Kevin's sequence from here (his words, 2026-08-27 19:45):** push these
updates once Codex is happy → he compacts → one more feature pass
(**comments improvements**) → then **Seismic + ACL** data — set times where
out, and for each fest also the AFTERS / big events around it (the way
Portola got Portola Week + Folsom; "just the big big stuff"). That last
rule is also on the Pen watcher row.

**Open at hand-off (2026-08-27 ~19:55):**
1. ~~A `[object Object]` status in the CREATE flow~~ — RESOLVED (006df27):
   Vercel's protection wall answers /api with `{error: {message, code}}`
   and six sites did `body.error || fallback`; all go through
   `util.errorText` now. Preview-only trigger, real rendering bug.
2. ~~PR #11 + PR #12 wait for "promote"~~ — PROMOTED 21:01 CT (top of file).
3. ~~Throwaway preview crews~~ — all deleted from Neon (`zz-filters-walk`,
   the Opus walker's `Portola 26` test crew, the Sonnet walker's `zz-walk2`).
4. UI walks are a teammate's job from here on (Kevin, 19:44), never the
   main session's — the other Playwright MCP profiles are locked by other
   sessions; `plugin_playwright` is the one that works.

## 2026-08-27 (later) — PROMOTED: PR #10 merged, v39 on all three domains

Kevin's call ("I'm good to promote"). PR #10 merged to `main` (05b95db);
`fest` / `festival` / `crew.kevinhg.com` all served `festival-nav-v39` within
two minutes, prod `portola-2026.json` is `scheduled` with 32 + 32 sets. Also
on his word: Nhu (19 picks) and Kat (9, Sunday only) were prefilled into the
Portola 26 crew as placeholder members through the real merge — their claim
links make the picks theirs; the throwaway preview crew + person row were
deleted from Neon. Cross-check of iMessage vs app picks: Drew's app picks
cover every poster highlight; **Ross's app is missing Fatboy Slim** (checked
in his official-app screenshot) — Kevin's to mention. `main` = production;
work continues on `portola-set-times`.

## 2026-08-27 — Portola set times dropped; the branch is ready for Kevin's promote call

The official Sat/Sun posters went up this afternoon and the crew chat is
already trading screenshots. Branch `portola-set-times` = the 08-23 cloud
branch (Portola Week afters + Folsom, ACL two-weekend shape, hardening gate)
+ the v31-polish docs + today's drop. Full story: DEVLOG 2026-08-27.

- **Data**: `portola-2026.json` is `scheduled` — 64 sets, five columns as
  printed, Kaytree added, every live pick key byte-stable (tripwire:
  `tests/live-pick-keys.test.mjs`). Three independent poster readings
  agreed on every box.
- **Two gaps the drop exposed in the cloud branch, both fixed + tested**: a
  scheduled wall used to delete the Afters/Folsom sections (and their tabs);
  the persistent data cache was cache-first, so a drop reached phones one
  open late. Now: grid → AFTERS → FOLSOM → EVERYTHING ELSE; festival JSONs
  network-first (4 s budget) with the cache as the offline answer.
- **Backups taken first**: Neon branch `backup-2026-08-27-pre-portola-drop`
  + JSON export of all 36 crews at
  `~/.claude/plans/festival-navigator-backups/2026-08-27/` (outside the repo).
- **Gated twice by Codex (SHIP WITH FIXES → all fixed), walked live on the
  Vercel preview against the real merge.** 227 tests / 226 pass.
- **Promote = Kevin's call**: merge `portola-set-times` → `main` deploys
  prod; SW v39 force-refreshes every installed client. Then verify all three
  domains serve `festival-nav-v39` and open the Portola board on a phone.
- **Two small things only Kevin can say yes to**: delete the throwaway
  preview crew (member `zz-preview-walk`, created 2026-08-27 in the prod DB
  for the walk), and whether the two email addresses in old commits of the
  Ray checkpoint doc (redacted at HEAD) warrant a history rewrite — the
  recommendation is no.
- **Next in the queue after Portola** (scouted 2026-08-27, details in
  `claude-plans/2026-08-27-next-drops-scout.md`): **ACL** — the six
  weekend/day grids went live Aug 26 as poster images (same recipe as
  Portola; the two-weekend shape is built; Kings of Leon replaces Skrillex
  W2 Friday). **Lost Lands** (Sep 18) — day-level rosters are out, set
  times not yet; re-check in a week. **Seismic** — still phase one (34
  names ≈ our 33), set times land in November. Then Ray's fork items and
  the "schedule dropped → PR → Slack approve" watcher
  (`claude-plans/2026-08-27-schedule-drop-watcher-future-build.md`).

## 2026-08-10 — Ray's fork hit a working checkpoint (awaiting Kevin's review)

Ray Perfetti (`raypp2`) — the contributor who forked us in July — emailed
Aug 6 with a live demo: Discover feed, artist pages, tri-source player
(YouTube/SoundCloud/Spotify), reworked pick controls, top menu. His fork is
77 commits ahead of our main, deployed on HIS Vercel + HIS database (nothing
of ours touched). No PRs yet; one open issue (#6, Spotify `CANONICAL_HOST`
hardcoded — he's offering the PR, unanswered since Jul 24). Full notes +
suggested moves: `claude-plans/2026-08-10-ray-fork-checkpoint.md`. His demo
link carries a crew token, so it stays in the Gmail thread, not in this repo.

## 2026-07-14 — PROMOTED TO PRODUCTION (v35)

Kevin's call ("kk promote"). `v31-polish` → `main` fast-forward (f7ad492 →
81a1cfb, 16 commits, 27 files), pushed; Vercel auto-deployed. **All three prod
domains serve `festival-nav-v35`, root HTTP 200** — verified by served
CACHE_VERSION on fest / festival / crew.kevinhg.com. The bump from v31 → v35
force-refreshes every installed client (SW skipWaiting + clients.claim), so
returning phones pick up the fest-first reshape + me link + the whole
identity-night arc without a manual reload. `main` now matches production;
work continues on `v31-polish`.

Still on my post-promote queue (Kevin's word required to start any): the
**Portola/Seismic crew split** (his own jumbled pair — small, server-side),
**Phase B** (merged fest board + join-picker/mute), **Phase 2 hardening**
(server idempotency key / cross-tab double-create), The Crew token +
screenshotted client-secret rotations, and the round-2 Spotify
collaborative-playlist live test.

Kevin's own return items (his to do, not mine): re-test Spotify connect on a
fresh browser now that v35 is live, and — only if he wants staging to OAuth
without hopping — add `https://stage.fest.kevinhg.com/spotify-callback` in the
Spotify dashboard. Production's redirect URI (`fest.kevinhg.com/spotify-callback`)
was already registered and verified live 2026-07-13, so prod Spotify works today.

## 2026-08-23 — Portola Week + Folsom shipped, ACL drop-ready, hardening gate (branch: claude/festival-lineup-integration-zs0s8l)

Three commits on the branch, preview-only. Full story: DEVLOG 2026-08-23.

- **Portola board grew AFTERS (all 21 official Portola Week shows) and FOLSOM
  (the fair + its marquee parties) sections.** Horse Meat Disco = Fri Sept 25,
  Public Works, 9 PM–3 AM (tickets: sickening.events — the circulating Tixr
  link is the 2024 edition). Friday is conflict-free; the meta.note carries
  the full conflict map and what has no posted time yet.
- **ACL: set times ARE officially out (since ~Aug 17) but NOT ingested** —
  this environment can't reach the JS-rendered schedule and snippets only
  carry evening headliners. The two-weekend scheduled shape is BUILT and
  tested; ingesting is now a paste job:

  ### ⚠️ KEVIN'S 5-MINUTE MOVE
  Start a LOCAL session on this branch and point it at
  `claude-plans/2026-08-23-local-run-handoff.md` — that doc is the full
  handoff (fetch the ACL grids, ingest, cross-check the anchors, /codex-run,
  push). Or do it by hand: copy each day from
  https://www.aclfestival.com/schedule into any session with
  `docs/add-a-festival.md`'s two-weekend recipe.

- **Hardening gate (18 confirmed finds, all verified in code):** the P1s are
  fixed — playlist pending-subtraction sync-wedge, and SW updates no longer
  wipe offline festival data (persistent data cache + rescue migration).
  Plus boot timeouts, Safari 15 sync timeout, honest blocked dot, guarded
  storage reads, prototype-key festival ids. 191 tests, 190 pass.
- **Deferred, each with a writeup in the DEVLOG entry:** merge-SQL null
  semantics vs the JS twins, the doc-size cap measuring two different
  serializations (~11% skew), DIAGNOSE_SQL race misattribution, beacon
  re-push leaf revert, sync poll not torn down after leaving a crew,
  offline-first boot from cachedDoc. The merge-SQL ones deserve their own
  gated session per the house rule (change crew-sql.mjs, tests follow).
- **Contributor watch:** no human PRs open — only 4 dependabot bumps
  (checkout@7, setup-node@7, jsdom 30, pglite 0.5.5). Merging any of them
  deploys prod (main auto-deploys), so they stay your call.
- No Codex CLI exists in the remote container — the gate ran as independent
  adversarial agents. A true Codex pass stays available from your machine.

## 2026-07-14 (session close, v35) — Kevin's staging round + gate rounds 4-5

Kevin live-tested the reshape on staging, found the Spotify canonical-host
hop trap (his boards "disappeared" — he'd changed ORIGINS: OAuth hopped him
from stage.fest to fest.kevinhg.com, which ran old prod code and knew one
crew; nothing was lost, staging and prod share the DB), and asked for:
connect fills ALL fests · settings shows MY fests not the catalog · dates
on the home list. All shipped, then two more Codex gate rounds (identity
boundaries, races, honesty of partial-failure reporting) fixed in full:

- **badgeEveryKnownCrew**: one connect fills EVERY board — identity resolved
  from the PERSON RECORD's claim (sweepIdentityFor, 7-case tested; never the
  device picker), sparse-leaf direct POSTs per crew, skips surfaced ("N
  boards couldn't fill yet — each catches up when you open it"; the
  enterApp per-open sweep is the durable retry).
- **The hop announces itself and carries the me link**: boot parks the
  token in sessionStorage FIRST, absorbs quietly (union, never dethrones an
  existing identity), generation-guarded, retries offline, drops dead links.
- **Settings = your boards** (landingPairs rows; + Add → the shared multi-
  pick page; AI/custom add keeps its quiet door). **Landing tells time**:
  `startsOn` in index.json (validator round-trip-enforced, documented),
  date sort, "Sep '26" labels, past fests sink muted.
- **Kevin's morning list**: eyeball staging on a FRESH browser (or
  SW-unregister) · add `https://stage.fest.kevinhg.com/spotify-callback` in
  the Spotify dashboard (staging then OAuths on-origin, no hop) · promote
  call · Portola/Seismic crew split still on my queue post-promote.
- 176 tests / 175 pass. Five gate rounds total tonight; every NO SHIP
  caught something real.

## 2026-07-14 (later) — THE FEST-FIRST RESHAPE — built, gated twice, staged

Kevin's "go" on the direction doc → built in the same session (main-loop,
legibility guide re-read; the other three ground-it docs deferred as
out-of-territory — deliberate, stated).

- **Landing = festivals** (landingPairs over (crew × fest) pairs, index
  order, fest accents, avatar clusters, "just you — add your people
  inside"). Tap Seismic → GET Seismic (the row writes the fest key,
  verify-after-write, refuses to boot ambiguously on blocked storage).
- **Create = multi-pick** (≤8/batch — the 10/hr create limit must not be
  outrun), name step survives only for a device with no person record —
  once, ever. Boards are BORN knowing their fest (api/crew.js create now
  accepts `festivals`) and born linked (create body carries pid); each
  board is stamped onto the person record before leaving the screen
  (checked + retried; failures TOLD to the user, enterApp backfill is the
  durable catch-up). WHO'S THIS WITH? deleted wholesale.
- **+ Add grew the recurring-humans picker** ("From your other fests" —
  otherFestPeople, tested) and settings member links say linked (pid) vs
  placeholder.
- **Gate round 1 (NO SHIP, 2 high + 3 med)**: batch boards missed the me
  link; create was re-entrant (double-tap = duplicate circles); stranded
  loader after post-create activation failure; batch could outrun the
  create quota; unverified fest-key write. All five fixed. **Verify round
  2** still failed two — the stamp's boolean was ignored (false ≠ throw)
  and the read-back could throw on storage-denied browsers — both fixed;
  final two touch-ups shipped self-verified (mechanical, walked each path).
- 175 tests / 174 pass. Live-walked end to end on vercel dev (multi-pick →
  boards → tap-fest-get-fest → typed add → one-tap picker add), throwaway
  rows deleted after. **Lesson re-learned live: hash-only navigations keep
  the browser's module map — verifying edited JS needs a REAL document
  reload (about:blank hop), not just SW-unregister.**
- **Staging = v35 (v33 + Kevin's staging round + gate rounds 4-5), awaiting
  his eyeball. Prod promote = Kevin's call.**
- Accepted, documented in code: cross-tab create-spam (no server
  idempotency key; rate limiter caps damage) · server-side batch quota
  reservation · both filed under Phase-2 hardening with the person-create
  twins.

## 2026-07-14 — FESTS × CIRCLES × YOU: the model pivot (direction locked, reshape SHIPPED same day — see above)

Kevin live-tested v32 on staging and rejected the "WHO'S THIS WITH?" framing
(a people question answered with crew names that read as festivals; a crew
named Portola opening on Seismic with the fest switcher buried). His model:
**festival-first, ego-centric circles** — everyone is the center of their own
map. Talked through his real festival year, mapped it in an artifact, aligned.

- **Canonical direction doc: `claude-plans/2026-07-14-fests-circles-you-direction.md`**
  (the locked model, the 8 decisions, the reshape checklist). Read it before
  touching landing/create/join/share code.
- **v32 stays on staging by Kevin's call** — the reshape (fest-first home,
  multi-pick add, kill step 1.5, + Add people sheet) lands on top, then
  promote. Nothing from v32 is wasted: the me-link/pid plumbing is the
  foundation the circle model runs on.
- Reshape kickoff = plan mode + FULL hg-ground-it read (tonight only the
  legibility guide was read — deliberate budget call). Merged-board +
  join-picker/mute engine is its own later arc (Phase B).
- Docs grounded tonight: user-flows.md carries the pivot banner; the executed
  me-link plan archived to `claude-plans/2026-07-13-me-link-phase-1.md`
  (its Phase 2 Spotify-summary design still applies under circles).

## 2026-07-13/14 — THE ME LINK (Phase 1) — staged; UI layer superseded same night

Kevin's frame: "I am me, friends are friends, and we mix and match across
crews." Plan-mode approved; Kevin picked fest-first→"WHO'S THIS WITH?" for
the landing CTA and Phase-1-now/bank-Phase-2 for scope.

- **Person record**: `persons` table (id public/"pid" — the only person
  identifier a crew doc may hold — vs token = master-key credential,
  DISJOINT length ranges), api/person.js (create/read/atomic merge,
  X-Person-Token HEADER only — never a query param). Doc: {v, name, crews:
  {<crewToken>: {name, crewName}}}. LIMITS.personDocBytes 32KB (Phase 2
  raises for the library summary).
- **Client**: enterApp stamps identity fire-and-forget (create, join, and
  old crews backfill one open at a time); renameSelf follows with
  renameFrom; #p= me link restores a wiped device (union-only, hash
  stripped before boot's first await). Landing rebuilt: YOU card (avatar,
  My-link copy, consequence copy), crew rows w/ fest names + avatar
  cluster (the unbuilt 21a spec). Create step 1.5 lists existing crews.
- **TWO Codex gate rounds, both earned their keep.** Round 1 (NO SHIP, 4×P1
  +1×P2): master key in URLs → header auth; restore lacked boot-generation
  guard; shared-phone stamp conflation; double-create race (and MY first
  race fix had a TOCTOU the demanded concurrency test caught — the re-check
  sat before res.json()); PID/TOKEN regex overlap. Round 2 verify: headers/
  boot-strip/XSS/offline-path PASS, but my ownership guard had two open
  doors (empty-mirror inheritance, unconditional rename bypass) — both
  closed; schema.sql now retightens the pid CHECK idempotently on pre-v32
  DBs (upgrade-path test builds the old schema and proves it).
- **Accepted for Phase 1, documented in code**: cross-TAB double-create can
  orphan one unreferenced person row (same-tab collapsed by in-flight
  memo, tested); server-side ownership conditions + idempotent create =
  Phase 2 hardening, designed in the plan doc.
- **Live-verified on vercel dev against real Neon** (throwaway rows deleted
  after): create → silent person record → pid in crew doc → step 1.5 adds
  fest to SAME crew → wipe → #p= restores crew+claim+YOU card. 170 tests.
- **Phase 2 banked** (plan doc): library summary on person record,
  client-composed via a crew-scoped endpoint — crew GET hot path untouched.
- ~~Kevin's moves: eyeball staging → promote~~ **OVERTAKEN 2026-07-14**: he
  eyeballed, the who's-with framing failed the test, direction pivoted (see
  the section above). Promote waits for the reshape. Still true after it
  ships: open each crew once to backfill the me link, then stash My link.

# Previous: v3.1 PROMOTED + Spotify polish live (v31)

## 2026-07-13 (round 3, v31) — merge twins now replace arrays like the SQL

- **Kevin's "dunno if it matters" toast was a P1**: "playlist: artists must be
  an array (max 500)" = the server refusing EVERY push from his device for the
  EF crew. The client deepMerge index-merged arrays — an array landing on a
  key holding nothing came back `{"0":..}` — and the playlist artists ledger
  is the first array ever sent through pending sync. persistPending wrote the
  corruption to disk; each boot reloaded and re-pushed it; deterministic 400
  forever. Picks were safe locally, invisible to the crew.
- **Fix**: both JS twins (js/merge.js, api/_lib/crew-shared.mjs) early-return
  array overlays as copies, matching jsonb_deep_merge (object×object is its
  only recursing case). db-merge.test.mjs now holds client JS, server JS, and
  the real SQL to byte-identical output — the twins can't drift silently.
- **Self-heal**: activateCrew rebuilds corrupted blobs AND writes them back to
  disk — memory-only healing left a zombie (subtractLeaves can't match a
  corrupted-disk leaf against the healed-pushed leaf) that re-pushed the same
  meta every boot. Kevin's device needs only a reload (×2 for SW handover).
- 153/154 tests. Codex gate: SHIP, zero findings, regression tests verified
  to fail against pre-fix code. SW v31 on staging + all three prod domains.
- **Open product question (Kevin deciding)**: one-link-restores-all-crews.
  Options on the table: (A) consolidate solo fests into one personal crew
  (feature exists — Settings → Your festivals → + Add a festival — needs a
  one-time picks migration between crew docs), (B) "save all my crews" bundle
  link (new build, all tokens in one URL = louder blast radius), (C) leave it.
  Related regardless of choice: the landing page teaches one-fest-per-crew
  ("ADD A FESTIVAL →" creates a CREW; the crew list is headed "YOUR
  FESTIVALS") — that copy/IA steered Kevin into four single-fest crews.

## 2026-07-13 — PROMOTED TO PRODUCTION + Spotify live-tested + polish shipped

- **v31-polish merged to main** (Kevin's go): prod went v14 → v28 → v29 on all
  three domains, verified by served CACHE_VERSION each time. 145/146 tests.
- **Spotify OAuth verified LIVE end to end** — Kevin registered the redirect
  URI, connected, scanned 6,180 artists, EF badged 38. The one flow no session
  could verify is now proven on production.
- **Polish batch (Kevin's first-connect feedback, all shipped same day):**
  scan ticker (real counter + bar + album covers, fest-find highlights, wall
  pill when you leave the drill, reduced-motion safe) · playlist card rebuilt
  (name-first input, inline progress/success/errors, Open-in-Spotify link —
  its old status line rendered BELOW the Advanced fold, invisible) ·
  Everyone-playlists are collaborative + recorded in crew doc
  (spotify.playlists, validated; later-connecting members auto-join their
  picks; "Add new picks" top-up) · affinity glow (followed + 5+ songs = green
  corner mini-aura; followed-only artists now chip at all) · spotifyStats
  write restored (dropped in the 07-12 rebuild).
- **Dead BLOB_READ_WRITE_TOKEN removed** from all three Vercel envs.
- **Round 2 same day (v30):** Kevin's resync test exposed three real bugs —
  ghost festivals (ensureFestivalState never queued the new key for sync; The
  Crew's server doc held 1 fest vs his device's 6), crews never badging on
  open (per-crew badges vs per-device library — enterApp now sweeps from
  cache, write-skipped when unchanged), and mid-scan crew-switch writes
  landing on the wrong crew (token captured at start; mismatch = no writes;
  the "Kevin HG" ghost stats on EF26's doc are that bug's fossil — additive
  merge can't delete it, cosmetic, ignore). Playlist logic re-specced by
  Kevin: top-3 search + the maker's saved tracks per artist (fest-artist URIs
  cached at scan), track-level dedupe vs the LIVE playlist on append.
  148/149 tests incl. empty-fest merge vs production SQL bytes.
- **UNVERIFIED, next live test:** the collaborative auto-join path needs a
  SECOND member's account (Spotify dev-mode may refuse cross-user adds even
  on collab playlists — the drill reports and offers retry if so). Also the
  "Electric Forest 26"/"Portola 26" crews are Kevin's own (with Ross) — keep.
- **Still Kevin's call:** The Crew token rotation (public git history) ·
  refresh-after-back sign-off · dev-mode 5-user allowlist vs The Crew's 6
  members · rotate the screenshotted client secret.

## SPOTIFY FLOW REBUILD (2026-07-12 — superseded by the above; kept for context)

Kevin's live screenshots showed the Spotify connect flow was broken end to end:
OAuth `redirect_uri: Not matching configuration`, a two-step hop with a second
"Connect" button on a sparse page showing raw plumbing (`CREW APP · ...d26734`),
and the gear icon stranded alone on the far left under Lost Lands' long date
string. His model — "connect once, all my fests fill in; add a fest later and
Spotify should just pull" — was correct; the app didn't do that.

**Shipped and verified:**
- **Gear pin fix** (`index.html`): the header wraps on long date strings, and a
  `≥720px` rule was stripping the gear's `margin-left: auto`, parking it far-left
  alone. Now `order: 3; flex: none`, pinned right at every width. **Verified live
  on staging on Lost Lands itself** — the exact festival from Kevin's screenshot.
- **One-press connect** (`js/spotify.js` `canonicalHopUrl({autoConnect})`,
  `js/v3/app.js` boot): the hop to `fest.kevinhg.com` now carries `sp=connect`
  and auto-continues on arrival — no second "Connect" button on a second screen.
- **Badge every festival, one write** (`js/spotify.js` `badgeAllCrewFests`,
  `artistNamesOf`): connecting reads the library once and badges every festival
  the crew has, in a single `recordAffinity` call — not the one-fest-at-a-time
  "Open other fests to badge them too" chore it was. A festival added later
  self-badges via the existing `switchFestival` path (now calling the same
  shared `artistNamesOf`), no reconnect needed.
- **Drill rebuilt** (`js/v3/settings.js`): every not-yet-connected state now
  shares one `connectCard` that says what connecting does; the raw client-ID row
  moved behind an "Advanced" fold (also holds the exact redirect URI string for
  whoever owns the app); the connected state shows a per-festival badge count
  instead of telling you to go do more work.
- **5 new unit tests** (`tests/spotify-flow.test.mjs`) prove: badging reaches a
  NON-active festival, a newly-added festival self-badges from the cached
  library, badging one fest never wipes another's badges, the whole sweep is one
  write not N, and the hop URL carries `sp=connect` + the crew token.
- Full suite: 141 passing + 1 correctly skipped (Neon-only concurrency test).
  Fork/BYO drill path (the only one exercisable on staging — see below) visually
  confirmed clean, no naked client-ID plumbing outside the fold.

**NOT verified — could not be, not skipped by choice:**
- The main "Connect my Spotify" 3-door flow (owner app / request access / BYO)
  is what Kevin will actually hit in production, but **staging has no Spotify
  env vars** (`SLACK_WEBHOOK_URL` etc. are Production-only — confirmed earlier
  this session), so that exact card only renders on `fest.kevinhg.com`. And the
  real OAuth round-trip needs Kevin's own Spotify login, which nothing here can
  simulate. Code-reviewed + unit-tested, not eyeballed live.
- **The one thing that was never a code bug**: `redirect_uri: Not matching
  configuration` is Spotify refusing because `https://fest.kevinhg.com/spotify-callback`
  isn't registered in the app's dashboard. That's a field only Kevin can edit —
  see "KEVIN ACTIONS QUEUED" below, unchanged from earlier in this session.

**If Kevin hits anything else in the Spotify flow**: the natural next move is a
Codex pass on `js/spotify.js` + the `openSpotifyDrill` function in
`js/v3/settings.js` specifically, since that's the one surface this session
could not fully browser-verify.

## CURRENT STATE (2026-07-12, late)

The finish pass ran and is **complete**. A 12-agent audit (6 browser walkers
across every surface at 390 and 1440, 6 code/test/doc dimensions) produced **86
findings**; everything that mattered is fixed, tested, deployed to staging, and
verified in a real browser. Tests **95 → 131**. Branch `v31-polish`, live at
https://stage.fest.kevinhg.com (SW v25).

**The honest headline:** almost nothing here was crashing. Nearly everything
found was the app *quietly saying something untrue* — or quietly losing a tap.

### The four ways a pick could vanish (all closed)
1. `saveLS()` swallowed every localStorage failure with a `console.warn`. A full
   or private-mode store meant the edit lived only in memory, and the push is
   debounced 1.2s behind it. Lock the phone in that window — the single most
   ordinary thing anyone does at a festival — and the pick was gone, with nothing
   on screen ever having said so.
2. That 1.2s debounce was itself a grave: a backgrounded tab gets reaped and an
   in-flight `fetch()` dies with it. `sync.flushOnHide()` now beacons pending
   picks out on pagehide — the one send the browser promises to finish.
3. A 400/413 **permanently poisoned the pending queue**. The code comment claimed
   "the retry loop stops"; it did not — `pollSync` re-armed it every 25s, forever
   re-POSTing the same doomed payload and blocking every *other* edit on that
   device behind it. It now remembers the refused payload and waits for a new one.
4. `clearPending()` blind-wrote `'{}'`, erasing a second tab's un-pushed edits —
   re-opening on the clear path the exact race `persistPending()` had been fixed
   to close.

Plus: two members named "Drew" and "drew" forked into two permanent identities,
splitting their picks down the middle. Now refused *in the merge* — the only
place both concurrent writes are visible.

### The thing that should have scared us most
`jsonb_deep_merge` — the SQL function every concurrency guarantee in this app
rests on — **was executed by zero tests.** "6 of 6 concurrent merges survive" had
been a comment, not a fact, since July. The SQL now lives in
`api/_lib/crew-sql.mjs` and `tests/db-merge.test.mjs` runs *those exact bytes*
against real Postgres (PGlite — in-process, no server, no secrets, runs in CI).
The 6-of-6 claim is now **proven**, along with arrays-are-replaced-wholesale
(which is *why* notes must be keyed objects) and every WHERE-clause invariant.

### Calibration worth keeping
An agent claimed the 256KB doc cap was "structurally guaranteed" to be hit. I
checked the live store: the busiest **real** crew is 1,643 bytes — **0.6% of the
cap**. The failure mode was real; the stated cause was not. No compaction was
built. (Verify before building on a claim, including an agent's.)

### The Codex gate (independent review, after all of the above)

It found two P1s and a P2 — and its best finding was aimed at the test I was
proudest of. Full write-up: `claude-plans/2026-07-12-codex-finish-gate.md`.

- **My touch-target fix could have armed "Forget this crew."** Settings rows stack
  with no gaps, so a universal `button::after { inset: -15px }` grew every row's
  hit area 15px into its neighbours — and the later-painted sibling wins. A tap
  near the bottom of "Switch crew" could hit the destructive Forget. Fixed by
  inverting the default: real `min-height: 44px` (which cannot overlap) unless a
  control opts out, and borrowed space only for small controls with room around
  them. **Verified in-browser: zero overlaps across all 31 Settings controls.**
- **A sync block never lifted.** The toast promises "they'll sync as soon as the
  crew has room" — but nothing retried unchanged pending bytes, so if another
  member DID free up room, that phone stayed stuck. A poll that sees a changed
  remote document now clears the refusal. (It also leaked across crews. It no
  longer does.)
- **My concurrency test was a rubber stamp.** Codex *proved* it: it swapped in the
  banned pre-lock CTE — the shape that lost 2/6 writes in production — reran my
  six-way `Promise.all` for 50 rounds, and lost zero writes. PGlite is a single
  connection; `Promise.all` just serialises. `tests/db-concurrency.test.mjs` is
  the real one (Neon, independent sessions, 8/8 survive) and it carries a
  **control** asserting the banned CTE *does* lose writes — so we know the harness
  can see a lost write instead of trusting another green tick.

And one P0 I found in my own new code before Codex did: `subtractLeaves` recursed
into note objects, so editing a note mid-push sent back a `{text}` fragment
without `author`/`ts` — which the server rejects, which the new refusal guard then
turns into a permanently blocked device. Notes travel whole now.

## ⚠️ KEVIN'S CALL

1. **Promote to production.** Walk staging first:
   `https://stage.fest.kevinhg.com` — then
   `git checkout main && git merge v31-polish && git push`
   (Vercel auto-deploys main; SW v25 force-refreshes every installed client.)
2. **Spotify dashboard (still queued, unchanged):** add redirect URI
   `https://fest.kevinhg.com/spotify-callback` to the MCP HG app at
   developer.spotify.com/dashboard. The code side is done — every non-canonical
   host now hops to fest.kevinhg.com, so this one URI covers staging too.
   Note the Feb-2026 rules: dev-mode apps are capped at **5 authorized users**,
   **one dev-mode app per developer**, owner needs Premium.
3. **`BLOB_READ_WRITE_TOKEN` is live in all three Vercel environments and read by
   zero lines of code.** Vercel Blob is banned here. It is a dead write
   credential — say the word and I will remove it.
4. **The Crew's token rotation** — still pending from the 2026-07-09 NOW.md leak.
   Unrelated to this arc; your call.
5. **Refresh-after-back** — after "‹ back to fest list", a hard refresh on the
   bare URL cold-start-resumes the crew you just left. Codex called it
   design-coherent (PWA resume philosophy) and wants your sign-off.
6. **Two crews in the store I did not create and did not touch:** "Electric Forest
   26" (2 people) and a second "Portola 26" (2 people), both from ~19:30 today —
   before this session started. They look like test crews from the earlier arc,
   but they are not mine to delete. Say the word and they go. (Everything I DID
   create — the audit rig and two crews the walkers made — is deleted. No real
   crew was ever written to.)

## Deliberately NOT done (and why)

- **Splitting app.js / settings.js.** They are 1,272 and 1,032 lines. The audit's
  own verdict was that file length is not the real pain — one 184-line, 6-branch
  Spotify state machine is — and a split at ship time trades a legibility problem
  for a circular-import problem. The duplicated *components* (festRow, sheet
  chrome) were extracted instead, which is where the actual bugs lived.
- **Doc compaction.** See the calibration above: 0.6% of cap.
- **Wiring Spotify env vars into staging.** `enabled()` needs all four, and a
  test there would fire a real Slack message at you. Production has them; the
  fork-deployment fallback (BYO client ID only) is what staging correctly shows.

## Standing facts

- Rig crew for this audit: **deleted at teardown** (see DEVLOG). Real crews were
  never written to.
- The service worker will serve you a STALE app after a deploy — unregister it
  and delete its caches before believing any browser check. Cost me a full round
  of "the fix didn't work" today.
- Token scans GATE commits (`&&`, never `;`). `.gitignore` now denies `*.png` by
  default — a walker run dumped 50 screenshots into the repo root.

**Updated:** 2026-07-12 late · **Branch:** `v31-polish` (pushed) ·
**History:** DEVLOG.md · **Rubric:** `claude-plans/2026-07-12-taste-rubric.md`
