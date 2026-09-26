# Inventory notes (raw, banked as I read) — 2026-09-25

All paths relative to the worktree (origin/main @ 47a381c, v89).

## Boot routing (js/v3/app.js boot(), 2633-2772)
- Hash is read at 2640-2645: `&f=` (festFromHash), `&me=` (meFromHash), `sp=`.
  Parsers in js/crew.js: tokenFromHash 44-47 (`[#&]g=([A-Za-z0-9_-]{20,40})`),
  festFromHash 66-69 (`[#&]f=([a-z0-9-]{1,64})`), meFromHash 115-120.
- Link shape (crew.crewLink 78-109): `https://fest.kevinhg.com/f/<fid>#g=<token>&f=<fid>[&me=<name>]`.
  Token only ever in the hash; the fest id in the path is for the OG preview (api/share.js).
- `#new` -> create (2716). Broken `g=` -> bad-link screen (2720).
- No token in hash and none active (or not first boot) -> renderLanding (2722).
- Warm open (2733-2739) needs crew.me(token) — a claimed name. Guests can never warm-open.
- Cold path: fetch doc, then `if (!crew.me(token))` -> recognizeOnOpen (pid match) else renderJoin (2755-2760).
  => TODAY NOBODY REACHES THE WALL WITHOUT A NAME.

## Landing (index.html 118-135, app.js renderLanding 1940-2073)
- "FESTIVAL NAVIGATOR / Pick artists with your people. Works with no signal. / ADD A FESTIVAL -> /
  Add your fests, then your people. Got a link? Just open it. / YOUR FESTIVALS / Nothing yet — add a
  festival or open a link someone shared."
- YOU card with "My link" (the master key) when a person record exists (1947-1984).
- Rows = (crew, fest) pairs this device knows (model.landingPairs) — device-local only.
- There is NO way to find a crew from here without its link. Good (consent boundary), but blank.

## Join (index.html 170-188, app.js renderJoin 2210-2316)
- "FESTIVAL NAVIGATOR / You're invited to / PORTOLA '26 (in fest accent) / with <crew name> /
  Tap your name, or add yourself." + member rows + "I'm someone new…" field + Join.
- NOTE: the headline paints `festMeta.accent` (2220) — a fifth place for --fest-ish color
  (inline rgb, not the token; predates? flag for the four-places rule).
- No explanation of what the app does beyond the tiny wordmark. No way in without a name.
- Join writes to /api/crew BEFORE entry (2290) — server-first.
- `&me=` floats that person to the top with "this link is yours" (2249-2257).

## Recognize you (2082-2107): pid match walks straight in, toast "Welcome back, Kevin." + Not me.
## Bring your picks (2114-2208, crew-entry.js): card above the dock, once per crew x fest.

## How it works bar = the coach mark (app.js maybeShowCoachMark 1116-1147)
- `fn_coach_v1` in localStorage, once per device, only when ctx.meName.
- Copy: "Tap artists to add your color. 4 taps = must see. Hold for details. Tap a name to
  highlight their picks. How it works" + ✕. Link opens Settings -> sub:how.
- Inserted as a toolbar strip (insertStrip 1180) above the wall.

## How it works page (settings.js openHowItWorks 377-473) — 8 lesson rows with real components.

## Share moment (app.js openShareMoment 1476-1538)
- "ONE LINK MAKES IT A CREW / Opens straight into <crew>. No accounts needed." + link box + Copy +
  "Share the link" + Later. Opens right after a single-fest CREATE (1445) — this is the
  "link to share on the very first page" Kevin doesn't love.
- Also Settings: currentFestCard "Share invite" (settings.js ~130-165), crewSection link box (570-588),
  per-member personal links (&me=) 519-556.
- Share never carries room choices today.

## Nameless viewer ("spectator") — mostly supported already
- handleTap returns silently with no name (347) — a dead tap, the one real hole.
- Person chips: no "+ Add" without a name (429-438).
- Notes read-only, "No notes yet." for nameless (notes.js 563-575, 899-900).
- Settings You card: "Open your crew link to claim a name." (settings.js 628-632).
- renderYou paints nothing (857). Coach mark skipped (1120). Bring-picks skipped (2134).
- enterApp backfill of inviteFestId guarded by crew.me (2378).

## Room filter = the fold (js/v3/filters.js 80-131)
- localStorage `fn_fold_v1_<fid>`, keys `:fest` (the festival's own room) or a section label.
- Viewer-side by law, never in the doc. Show menu on the fest name (app.js buildShowMenu 1011).
- Portola rooms: `:fest` "Portola" (Sat/Sun grid), "Afters" (Thu-Sun, 67), "Folsom" (Fri-Sun, 7).

## "Add events in Settings" — DOES NOT EXIST
- Settings has "+ Add a festival" (catalog) and "Fest not in the catalog? Research + add it"
  (AI research, settings.js 207-218, 234-346). No single show/event add:
  claude-plans/2026-09-02-add-a-show.md is "not built"; NOW.md lists it after Oct 11.

## Screenshots of today (v89, clean worktree, fake crew, SW blocked, all writes aborted)
Rig: rig/rig.mjs + rig/today.mjs (static server over the worktree; GET /api/crew answered with an
invented crew; every non-GET /api and every /fn-i aborted — 4 POST /api/person attempts were caught
and dropped, i.e. entering a crew tries to mint an identity).
- shots/today/t1-cold-landing.png — pitch + ADD A FESTIVAL + "Nothing yet". No way to find a crew.
- shots/today/t2-join-new-device.png — "You're invited to PORTOLA '26 / with The Portola Crew / Tap your
  name, or add yourself." A list of six names. Reads like a login. No hint of what's inside.
- shots/today/t3-join-empty-crew.png — the same screen with no names: a lone field in the dark.
- shots/today/t4-first-wall-coach-mark.png — FINDING: on the day-of open the wall scrolls to today
  (scrollY 835 on open, the bar sits at y=213), so the How it works bar is ABOVE THE FOLD. A friend
  opening a link during Portola week never sees it. Also off-screen: the header and the crew's chips.
- shots/today/t4b-first-wall-top.png — the same wall scrolled to the top: the bar is 5 lines of text.
- shots/today/t5-share-moment.png — "ONE LINK MAKES IT A CREW" sheet over the creator's first wall.
- shots/today/t6-how-it-works.png — the 8-row legend (good content, buried two taps deep).
- shots/today/t7-landing-returning.png — a returning device: the My link (master key) card sits
  high on the first page, above the festivals.
- shots/today/t8-recognized-welcome.png — pid match: straight in, "Welcome back, Kevin. / Not me".

Correction to the join-screen note above: the join headline in the fest accent IS "the fest name",
one of the four allowed places. Not a violation.
