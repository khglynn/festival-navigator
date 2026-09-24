# Rating canvas — working notes (2026-09-23)

The ask (a friend, via Kevin): "scroll through my picks and see what I rated
them, to decide if I want to go up or down."

## How the canvas is built (why it differs from the 08-29 rig)

- The 08-29 rig rendered in jsdom and serialised DOM into Claude Design
  artboards (one .dc.html per board, each its own viewport).
- This canvas must be ONE self-contained HTML file Kevin opens on phone and
  laptop, with motion live. So: the production modules are BUNDLED (esbuild
  from personal/ynai's node_modules, run read-only against the repo) into the
  page and render in the real browser. Cards are renderCard's, the grid is
  renderWall's, the zoom is card-facts.js's, taps run the real tap cycle
  (gallery.html's handleTap shape, which mirrors app.js).
- Storage: `localStorage`/`sessionStorage` are swapped for in-memory stubs at
  bundle time (esbuild define). The design token is fake and never persisted;
  no network, no API, no database.
- Two hook calls are injected into the BUNDLE (repo files untouched): one at
  the end of renderCard, one at the end of grownBlock. A direction's pieces
  are added there, so the zoom measures, blooms and FLIPs them like its own.
- Phone vs desktop on one page: the production CSS's width/pointer media
  queries are rewritten at build time into `.phone` / `.desk` scopes, and the
  vw-based tokens are pinned per frame (390px phone; 1280px-laptop values for
  desktop frames). Reduced-motion stays a real media query.

## Directions (draft)

A — my rating on the resting card
- A1 mark: your ticks count (1-3 ticks, must = your letter pill), pinned to
  the corner's edge, never folded into +n.
- A2 number: an Anton numeral in the free top-right corner.
- A3 fill: the top edge fills a quarter per tap (4 taps = must = full edge).
- A4 type: poster billing — the name's weight follows your level; must sets
  it in Anton caps like a headliner.

B — adjusting up or down (tap = pick and hold = zoom are taken)
- B1 a 4-stop track in the zoom (tap a stop; tap your stop again to clear).
- B2 hold, slide, lift: the finger that opened the zoom scrubs your level.
- B3 your own pill in the zoom steps you down.

C — everyone's rating in the zoom (7+ crews)
- C1 taps on every pill (tick count after the name, sorted by level).
- C2 tiers (MUST / x3 / x2 / x1 lines; a person slides between tiers).

## Constraints found in the code (evidence)

- whoCorner caps at 2 musts + 2 ticks, input order within each group
  (aura.js). With 5 pickers, YOUR tick can be folded into "+n" — today, on a
  busy card, you cannot even see that you picked it, let alone how high.
- A 30-min set is a 44px cell (wall.js display floor: 2 rows of 20px + 4px
  gap). Padding 5/8/17 leaves ~20px of content box; the name + time already
  overflow it and crop at the bottom. Nothing can be ADDED in flow there.
- Swipes are taken: a grid card sits in a horizontal scroller (stages) and
  every card in the vertical page scroll. Double-tap would delay every pick
  by the double-tap window. Controls inside a card are banned by the 44px
  floor's own rule (`.card button::after { content: none }`).
- The hold's still-down finger is dead time today (card-facts.js wireSlot:
  "while the finger that grew the card is still down, the overlay hears
  nothing") — the one unused phase of an existing gesture (B2).
- Rings/outlines for card state were tried and rejected (aura.js/v3.css
  comment on the Spotify glow, Kevin 2026-07-13) — so no ring direction.
- `.card.now` already owns the card border (brand ring) and the in-card
  top-right corner (the NOW label) on stack cards.

## Found while building (live, in Chromium with real input)

- The zoom blooms centred on the resting card, so the grown card's middle is
  under the finger/mouse that opened it. B3's minus pill landed there: a tap
  meant to raise stepped the level down (reproduced with real mouse clicks).
  => any control in the zoom belongs at an edge; B1's track is the last row.
- A thumb that is still down covers everything below its tip, so B2's
  feedback must sit above it (track under the name) — nearer the centre that
  B1 keeps clear. Real tension if B2 is ever added on top of B1.
- Removal-blur: a focusable control in the zoom that takes focus on press
  closes the whole zoom when a pick rebuilds it (card-facts.js focusout sees
  relatedTarget null). Presses must not take focus; keyboard parks focus on
  the resting card during the rebuild.
- Touch events keep targeting the node the touch started on. Replacing the
  resting card mid-slide stranded B2 after one step. => preview in the zoom
  while sliding, commit once on lift (also calmer).
- A click whose target was removed by the handler before it can fall through
  to the grown card and pick; the track commits in a setTimeout(0).
- On a 390 phone the grid shows ~1.8 stage columns; the second column's right
  edge (crew corner, A2's numeral) is off screen until you swipe.
- The strip-follow scroll timeline is scoped to .tt-block at render time;
  moving the strip out of its block freezes it at its far end.
- Specimen cells need min-height: 0 (wall.js sets it inline on grid cells;
  the base .card is 64px).

## Recommendations (as written into the canvas)
- A: A2 the numeral (A3 the quiet alternative) + always pin YOU in the corner.
- B: B1 the track on the grown card's bottom edge; B2 later, with the caveat.
- C: C2 tiers; C1 if the zoom must stay short.

## Log
- 2026-09-23: read NOW, CLAUDE.md, aura.js, wall.js renderCard, card-facts.js,
  motion.js, v3.css card/zoom/touch-floor blocks, gallery.html's boot.
- 2026-09-23: canvas.html built (build.mjs), checked with shot.mjs (static),
  interact.mjs (mouse), touch.mjs (CDP touch, 390), demo.mjs (B2 demo +
  keyboard). All clean, no console errors.

# Round 2 (2026-09-23, after Kevin looked at the published round 1)

Kevin: "leveraging the chips in the lower right or putting yours on the left
next to the spotify one ... Does numbers match the intent/vibe? must is like a
semantic idea. emojis? width of the card on the left? stars is terrible and
boring. do other music apps have clever concepts here?"

Brief (coordinator's read): placement is decided (crew corner's edge, or a
chip beside Spotify on the Spotify pattern); the ENCODING is open and must
read as intent/intensity, not a score; MUST stays a word; no stars; research
first and cite it. Encodings: width, loudness, emoji, words, + my own.
B and C wait. Round 1 saved as canvas-round1.html and round1/.

Research (links in the canvas):
- Binary: Spotify Liked (no ratings; users keep asking), Apple Music
  Favorite star (replaced Love heart in iOS 17.1), Hype Machine heart.
- RSVP words: Bandsintown Interested/Going, RA "I'm going", Partiful
  Going/Maybe/Can't go (emoji buttons; help article "I don't like the emojis").
- Repetition = intensity: Medium claps, tap up to 50 times.
- Special top state: Tinder Super Like, Hinge Rose (scarcity = meaning).
- Motion = intensity: Discord Super Reactions (same emoji, burst animation).
- DJ tools: rekordbox 1-5 stars (DJs repurpose as ENERGY) + colour labels +
  My Tag; Mixed In Key energy 1-10 (computed, not personal).
- Letterboxd: stars (score) and heart (love) kept separate.
- Clashfinder: click to highlight, click again to clear; four highlight
  colours whose meaning you name yourself in the key.

Push-back from the code: the coordinator said "yours in --brand". --brand
(192,132,252) sits right beside --notes-fill (108,91,212 @ .5) in the same
corner; a brand chip next to the notes bubble reads as a second notes chip.
The app's "you" language is your hue + white stroke (palette.strokeOf isYou,
How it works: "White stroke = you"). Canvas shows the comparison.

## Round 2 built (2026-09-23)
- One chip builder, five encodings (width / loud / emoji / words / stage),
  two placements (left beside Spotify, right at the crew corner's edge), a
  per-direction switch. The crew corner never counts you in both placements.
- Findings: a 12px-tall pill under ~16px wide reads as a dot (width widths
  4/16/26); emoji need 10px to be judged fairly and are still smudges; the
  stage dot reads as an on/off switch; words are the most legible but break
  CLAUDE.md's "UI vocabulary is exactly picked / must / notes / fest".
- Recommendation: 2 Turn it up (meter) beside Spotify; 4 Say it close second.
- Lost-rule regression caught: cutting canvas.css at the directions header
  dropped .vp.cv-specvp padding and the phone full-bleed block; restored.
- Verified: r2test.mjs (every encoding x placement steps + animates, wall tap
  updates every frame), 390 no overflow, phone frames 1:1, no console errors.

# Round 3 (2026-09-23): the zoom
Kevin: "I like the volume approach (turn it up but don't call it that) on the
left. show me riffs on the zoomed view showing how much everyone wants to see
stuff vs what we have now / a simple zoom would be."
- Card DECIDED: the meter (round 2 e2), left, your colour + white edge. The
  name "Turn it up" never appears; the canvas says "the meter". A builder is
  implementing it in production from round2/runtime.js (mineChip 'loud' +
  canvas.css .mine-chip / .bars rules). Round 3 must not change that drawing.
- Round 2 saved as canvas-round2.html and round2/.
- Riffs: 0 today · 1 meters on the pills (baseline) · 2 tiers by meter ·
  3 the room (one bar per person, sorted, crew zeros as stubs + "5 of 7") ·
  4 the desk (a fader per person, crew order, yours live at the right edge).
- Stress: Four Tet 7/7, SHM 5/7, Kelela 2/7, horsegiirL 3/7 not you,
  Parcels only you, and a crew of 15 (13 in).

## Round 3 built (2026-09-23)
- Riffs render inside the zoom's own grown block (hook), so the bloom, the
  sizing and production's pill FLIP work for them; the room and the desk add
  their own open cascade (bars rise / faders slide up, staggered) and their
  re-rating motion (your bar slides to its sorted place and grows; your
  fader moves), transform/opacity only, instant under reduced motion.
- The desk: your channel is the LAST row's right end; presses never take
  focus; commit on release in a setTimeout(0) (round 1's lessons).
- Card chip: meterChip is round 2's mineChip('loud') verbatim (same DOM,
  same CSS). No drawing change. Only additions are canvas-only data-k attrs.
- How it works: 4 chips overflow the 104px demo cell; 3 chips (1/2/3 bars)
  fit and mirror today's 3 swatches. Proposed rest line:
  "Each tap lights a bar. 4 taps = must see."
- Recommendation: 3 the room; ship 1 (meters on pills) if anything must land
  before Portola; keep the desk's idea (your control on the bottom edge).
- Verified: r3test.mjs (mouse: taps in z0-z2, z3 re-sort, z4 drag + tap),
  r3touch.mjs (390 touch: hold, lift, drag fader to MUST, no page scroll,
  no overflow), r3final.mjs (reduced motion, reset, demo fits). No errors.

# Round 4 (2026-09-23): Kevin's blended chips
- Kevin: "cool blended chips if multiple people have the same vote ... in a
  wrapping row rather than a stack". Round 3 kept as canvas-round3.html + round3/.
- One chip per level (MUST/3/2/1), loudest first, one wrapping row, the card
  meter's glyph (same bars), people inside, your chip with the white edge.
- Takes: 1 aura mix (aura.auraBackground of the chip's people at their own
  level's alpha, card base swapped for a scrim) + letters · 2 smooth multi-stop
  blend + the app's letter avatars · 3 hard stripes + first names then "+n".
- Motion (delight): your token FLIPs from the chip you left to the chip you
  joined; surviving chips slide; a changed blend crossfades (old fill layer
  thins away); an emptied chip dissolves as a ghost; a new chip grows in.
  Alone at a level: the chip is carried across and the next bar lights.
  The old row is measured in setLevel BEFORE production rebuilds it
  (window.__bcSnap), because the refresh replaces the grown block wholesale.
- Bug caught: aura.initialFor compares by identity; passing a different
  object for the same person made everyone clash with themselves (2 letters).
- Production size: whoPills() (shared by the zoom AND the notes sheet header)
  ~50 lines + ~25 CSS; partKey needs one line to match chips by level; 6 test
  files assert per-person pills. Motion = a second step in refreshZoomInner.
- Recommendation: take 1; yes, over the room.
- Verified: r4test.mjs (mouse, all three takes, slow-motion mid-flight),
  r4touch.mjs (390 touch, no overflow). No errors. Card chip unchanged.
