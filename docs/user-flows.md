# Festival Navigator — user flows (the spec the audit walks)

> **Model: fests × circles × you (pivot 2026-07-14, reshape shipped with this
> edit).** The home page lists FESTIVALS; a "crew" is internally a circle —
> one cluster, one link — and barely surfaces as a word. Locked model:
> `claude-plans/2026-07-14-fests-circles-you-direction.md`.

**Created 2026-07-11 · maintained as part of every design/UX change.**
This is the canonical inventory of what a user can do and what correct looks
like. The design-audit workflow walks these flows in a real browser at 390px /
768px / 1440px and diffs reality against this doc — **a mismatch is always a
finding**: either the build is wrong or this doc is stale, and the audit run
fixes whichever it is. That rule is what keeps this doc from rotting.

Conventions: "mobile" = ≤719px, "desktop" = ≥720px. Every screen must look
*intentional* at both — desktop is a designed experience, not stretched mobile.
All doc-derived strings render via textContent/createElement (XSS rule).

---

## F1 · First visit (no crew)

1. Open the root domain with no hash → landing screen.
2. See: brand, one-line promise, ADD A FESTIVAL button, "got a link?" hint,
   YOU card (only once a person record exists: avatar, name, My-link copy
   button with its consequence warning), YOUR FESTIVALS list (empty state if
   none remembered).
**Expected:** rows are FESTIVALS, not crews — every (crew, fest) pair the
device knows is one row, DATE-SORTED by the index's `startsOn` (upcoming
soonest-first; past fests stay but sink to the bottom, most recent first, at
reduced opacity). Fest name renders in the fest's accent with "Sep '26"
beside it — when, at a glance. People of that circle as an avatar cluster;
"just you — add your people inside" when solo. Tapping a row opens THAT fest
(never the crew's last-open one; a blocked-storage device is told instead of
being navigated ambiguously). Two circles at one fest = two rows (unfused
until the merged-board arc). An uncached crew (fresh me-link restore) falls
back to one crew-named "tap to open" row.

## F2 · Add festivals (multi-pick)

1. Landing → ADD A FESTIVAL → **PICK YOUR FESTS** — tap toggles selection
   (brand ring), the go button counts ("ADD 3 FESTIVALS →"); past festivals
   folded in a secondary section.
2. **Name step appears at most once per device** — only when no person record
   exists yet. After that, the me link knows who you are and go creates
   boards directly.
3. Each picked fest becomes its own board (its own single-fest circle, just
   you). ONE fest picked → straight onto its wall + the share moment. SEVERAL
   → land on the festival list with all rows present, toast invites adding
   people per fest. A mid-batch failure reports what made it and what didn't.
4. Deliberate multi-fest circles (the same people doing another fest) are NOT
   created here — that lives in Settings → Your festivals → + Add a festival.
**Expected:** no people questions anywhere in this flow; apostrophes stripped
from generated crew names; selection survives entering the name step.

## F2b · Add people on a fest (+ Add)

1. Wall → **+ Add** → type a name, or one-tap a chip under "From your other
   fests" (active people from every other circle this device knows, deduped,
   minus you and existing members).
2. Success mints the person's claim link (&me=) — placeholder until opened.
3. Settings → CREW → tapping a member chip shows their link with a
   linked-vs-placeholder line (pid = claimed; no pid = waiting for its human).
**Expected:** recurring people are one tap, never retyped; the two links keep
their jobs distinct (circle link = joins the cluster; name link = becomes
that person).

## F3 · Join via shared link

1. Open a shared `#g=<token>` link → join screen shows crew + fest context.
2. Claim a name (new member) or tap an existing name (returning member).
3. Land on the wall with your identity + color assigned.
**Expected:** joining is one open + one tap; no account, no password; a
returning member on a new device recognizes themselves in one glance.

## F4 · The wall — lineup view (unscheduled fests)

1. Wall shows fest header (accent color), search, sort, Notes chip, day
   sections (or THE LINEUP when days are unknown), artist card grid.
2. Tap a card → pick cycle 0→1→2→3→must→0; card aura + who-corner update
   instantly; tap-out-of-must shows the undo toast.
3. Search filters across all days; sort (Billing / A→Z / My picks / Crew
   favorites) reorders; both work together.
**Expected:** sort control is a styled menu (not a native select), keyboard
accessible; an artist billed on multiple days appears under EACH of those days
(never a combined "Day X & Day Y" section); grid density and type scale to the
viewport (no vast dead space on desktop).

## F5 · The wall — set-times view (scheduled fests)

1. A fest with day schedules renders stage-column grids per day: hour rail
   left, one column per stage, cards spanning their set times.
2. Same-stage time overlaps split into side-by-side lanes.
3. Tapping a card cycles the pick **without the card moving or vanishing**.
4. Items with a stage + time appear IN the grid; only genuinely
   unscheduled/stage-less programming lives in a clearly-designed
   "everything else" column at the far right.
5. Searching falls back to the filterable flat grid.
**Expected:** the grid may exceed the page's reading max-width — it goes
full-bleed (headings stay at reading width) and scrolls horizontally with
scroll-snap on mobile; desktop shows as many columns as fit the window.

## F6 · Notes — artist scope

1. Mobile: long-press a card (~500ms) → artist sheet. Desktop: hover reveals a
   note affordance on the card; click opens the same surface.
2. Sheet shows the artist's notes (author-attributed, pinnable per-device) +
   composer.
3. Save → note syncs to the crew; note counts update everywhere.
**Expected:** mobile = bottom sheet; desktop = centered dialog (never a
full-width strip pinned to the bottom of a wide viewport). Only your own notes
can be deleted (tombstone).

## F7 · Notes — day scope

1. Each day header carries a notes affordance (with count) → opens that day's
   notes surface (same sheet/dialog pattern).
2. An in-flow composer also lives under each day's grid.
**Expected:** both paths write the same day-scoped notes; day notes visible
from the day header, not only by scrolling past the whole day.

## F8 · Notes — festival scope + the all-notes view

1. Notes chip (top of wall, with total count) → ALL NOTES view: festival-note
   composer at top, then sections — This festival / each day / each artist.
2. Wall bottom also has the NOTES · <FEST> section with composer.
**Expected:** the all-notes view is the notes HOME: you can always ADD a
festival note right there (including from the empty state); scope sections are
legible (D3); empty state may hint at long-press but never as the only path.

## F9 · Day navigation

1. Mobile: bottom dock — You chip (jump to top), day tabs (scrollspy-active),
   fest link (opens settings).
2. Desktop: sticky day rail under the toolbar with the same tabs + jump to
   top; scrollspy highlights the day in view.
**Expected:** every viewport has day navigation; dock hides while typing in
search (keyboard avoidance).

## F10 · Browser navigation

1. Back after opening Settings / a drill page / any sheet or dialog → closes
   that layer, returns to the previous surface. Forward re-opens.
2. The `#g=` crew link survives all navigation (shareable at any time).
3. In-UI back buttons and browser back agree.
**Expected:** browser back NEVER dumps the user out of the app while layers
are open; refresh at any point restores the same surface or its nearest parent.

## F11 · Settings — one page, two doors

1. Gear (or dock fest link) → Settings: YOU door (name, color, your Spotify)
   and CREW door (members, crew name, festivals, share link, danger zone).
   The festivals block lists YOUR boards (same rows as the landing, date-
   sorted): same-circle fests switch in place, boards in other circles open
   like landing rows, "+ Add a festival" goes to the shared multi-pick page,
   and the AI/custom add keeps its own quiet door (the only path for a fest
   not in the catalog — it lands on THIS board's circle).
2. Your festivals: current fest marked; other catalog fests switchable in one
   tap; past/archived fests clearly visible (not a fine-print line); each row
   shows the crew's pick count.
3. "+ Add a festival" → F12.
**Expected:** switching fests repaints the wall in the new fest's accent;
adding/renaming/removing stays legible at both viewports.

## F12 · Add a festival (Gemini research)

1. Type a festival name → grounded research runs → preview card (name, year,
   dates, sample artists, sources).
2. "Looks right — save it" → crew-private festival joins the catalog and
   Your-festivals list immediately; it behaves like any catalog fest.
3. Bad candidate → refine or cancel; errors are plain-language.
**Expected:** past festivals are researchable too; the preview makes wrongness
obvious before saving; saved customs survive reloads and offline (localStorage
fallback).

## F13 · Spotify — connect, scan, use

1. Settings → Spotify: state-driven flow — crew lead sets the app Client ID
   once (clearly framed as one-time crew setup, not something every member
   configures); members then Connect (PKCE OAuth) → callback returns to the
   app → the library read starts on its own with REAL progress (live counter +
   progress bar + album covers flicking by; fest-relevant finds highlighted;
   reduced-motion gets the numbers without the flicker) → every crew festival
   badges in one pass; playlist tools + Refresh + Disconnect live in the drill.
2. Leaving the drill mid-read shows a quiet wall pill ("Spotify · reading your
   library 62%") — browsing is never blocked; the pill clears itself.
3. Playlist: name it before making it (editable, sensible default); progress,
   success (track count + Open-in-Spotify link), and errors all render inside
   the playlist card. "Everyone" playlists are collaborative and recorded in
   the crew doc — a member who connects later auto-joins their picks in, and
   an "Add new picks" button tops it up anytime.
4. High-affinity artists (followed + 5 or more saved songs) carry a soft green
   corner glow; followed-only artists still get the bookmark chip.
5. OAuth redirect works from every production domain the app is served on.
**Expected:** each state explains itself in one sentence; the drill looks like
part of the app (Class-A layout, not a floating button in a void); a failed
OAuth shows a recoverable in-app message, never a dead browser error page.

## F14 · Tools — export + share artifacts

1. Export likes (text) and Day image (pick a day → PNG of its wall,
   html2canvas offscreen render) from settings/tools.
2. Bulk paste (v4 semantics) for importing picks — unknown artists/levels are
   reported, never silently coerced.
**Expected:** artifacts match the wall's current fest + state; PNG is legible
on a phone share sheet; export failures say so in the UI.

## F15 · Offline / PWA

1. Installed or offline, the app shell loads (SW cache); crew doc falls back
   to last-synced copy; stay-offline + low-power modes reachable.
2. Reconnection syncs pending picks/notes without loss (additive merges).
**Expected:** offline is a first-class state with visible sync status (dot),
not a broken page. /api/ never served from cache.

## F16 · Lost states

1. Unknown routes → 404 "WYA?" page, centered, on-brand, links home.
2. A `#g=` token that doesn't resolve → clear "link didn't work" state with a
   path forward (not a blank wall).

## F17 · Me link — one person across crews

1. Entering any crew (create, join, or reopening an old one) silently ensures
   a person record and stamps this crew onto it; the crew doc gets only the
   public `pid`, never the person token.
2. Landing YOU card → "My link" copies `#p=<token>` — the personal restore
   link. Its copy carries the consequence: sharing it makes someone else you.
3. Open the me link on a new device → every crew on the record registers
   (union — never removes), names come pre-claimed, landing shows the lot,
   and the hash is stripped from the URL immediately.
4. A broken (truncated) me link says so; a deleted/unknown one says "doesn't
   work anymore"; offline says try again online.
5. The Spotify canonical-host hop is a me link in disguise: it announces
   itself before navigating, carries `&p=` beside the crew token, and boot
   absorbs the person QUIETLY (every board registers, names claimed) before
   continuing into the drill — arriving on the OAuth origin never costs the
   rest of your map. Both tokens are stripped/kept in one synchronous frame.
6. After a library scan, EVERY board fills in — the sweep badges each known
   crew this device holds a claim in, not just the one you connected from.
**Expected:** identity plumbing never blocks entering a crew — every failure
is silent-and-retried on the next open. The person token appears nowhere but
the me link and the device's own storage.

---

*Flow list changes (add/remove/rename a flow) are design decisions — run them
past Kevin. Step-level edits that track shipped behavior are routine doc
maintenance and belong in the same commit as the change that caused them.*
