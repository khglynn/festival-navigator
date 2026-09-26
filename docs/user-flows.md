# Festival Navigator — user flows (the spec the audit walks)

> **Model: fests × circles × you (pivot 2026-07-14, reshape shipped with this
> edit).** The home page lists FESTIVALS; a "crew" is internally a circle —
> one cluster, one link — and barely surfaces as a word. Locked model:
> `claude-plans/2026-07-14-fests-circles-you-direction.md`.

> **The wall, simplified (MODEL-V4, 2026-09-16).** Stage columns on a clock
> only where the festival publishes a stage grid; everything else is a stack
> of cards under the room it happens in. F5 is the walk; the spec is
> `claude-plans/2026-09-16-wall-v4/MODEL-V4.md`.

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

## F2b · Add people on a fest (+ Add someone)

1. Wall → **+ Add someone** → type a name, or one-tap a chip under "From your other
   fests" (active people from every other circle this device knows, deduped,
   minus you and existing members).
2. Success mints the person's claim link (&me=) — placeholder until opened.
3. Settings → CREW → tapping a member chip shows their link with a
   linked-vs-placeholder line (pid = claimed; no pid = waiting for its human).
**Expected:** recurring people are one tap, never retyped; the two links keep
their jobs distinct (circle link = joins the cluster; name link = becomes
that person).

## F3 · Join via shared link (wall first, v92 — 2026-09-25)

1. Open a shared `#g=<token>` link on a phone the crew does not know → the
   WALL, as a guest: nobody selected, the dock's "you" slot a dashed +, and
   (once per phone) a welcome card above the dock — whose plan this is, and
   that more color on a card means more of the crew wants to go. Got it ·
   How it works.
2. Look around: tap names to see their picks, hold a card for details. A
   guest writes nothing into the crew.
3. Tap an artist (or the +, or Settings → You → Add yourself, or a notes
   sheet's "Add yourself to write a note") → the join screen, saying "Pick
   <artist> as…" when an artist is waiting. Claim a name or add yourself; the
   artist becomes your pick (only from nothing — a claimed name keeps its own
   level). "Just looking" goes back to the wall where you were.
4. Still asked first, as before: a personal link (`&me=`, "this link is
   yours"), and a phone whose person is in the crew ambiguously. A recognized
   phone (its pid on one member) walks straight in, "Welcome back · Not me".
5. A link can carry the sharer's view (`&show=fest,afters`): a phone that has
   never shown that festival opens on it once ("Opened on Folsom. · Show
   all"); it is never written to the crew and never overrides a view.
**Expected:** a looker gets there in zero taps and a picker in one tap plus a
name; no account, no password; a returning member on a new device recognizes
themselves in one glance.

## F4 · The wall — lineup view (unscheduled fests)

1. Wall shows fest header (accent color), search, sort, Notes chip, day
   sections (or THE LINEUP when days are unknown), artist card grid.
2. Tap a card → pick cycle 0→1→2→3→must→0; card aura + your meter (the
   lower-left chip: one bar lit per tap, then MUST) update instantly, the
   next bar lighting as you watch; tap-out-of-must clears quietly (no undo
   toast since 2026-09-25; the next tap starts the cycle again). The
   who-corner (lower right) is everyone else's picks, and its +n counts
   only other people.
3. Search filters across all days; sort (Billing / A→Z / My picks / Most
   picked) reorders; both work together.
**Expected:** sort control is a styled menu (not a native select), keyboard
accessible; an artist billed on multiple days appears under EACH of those days
(never a combined "Day X & Day Y" section); grid density and type scale to the
viewport (no vast dead space on desktop).

## F5 · The wall — a festival week (scheduled fests)

1. **The days are the days.** Day tabs are the grid days plus the nights the
   weekday sections play, so no day is ever empty. A two-weekend scheduled
   fest gets one tab per date (FRI 2 · SAT 3 · SUN 4 · FRI 9 · SAT 10 ·
   SUN 11), each drawing its own weekend. The wall opens on the festival's
   first grid day, or on today while the festival is running.
2. **A day is rooms**, each under its own header: the festival's own room
   first (PORTOLA · PIER 80), then each section playing that night (AFTERS,
   FOLSOM).
3. **Stage columns only where the festival publishes a stage grid.** That
   day's timetable draws hour rail, sticky stage strip, cards spanning their
   set times, side-by-side lanes for same-stage overlaps, and the now line —
   spanning the whole day, doors to close, so the line always has a home.
   Anything of the festival's that is not on that grid follows underneath as
   venue groups.
4. **Everything else is venue groups:** one stack per venue, the venue name
   as its header, "Doors 10 PM · ~3 AM" under it where that is known, and the
   night's artists as cards top to bottom in play order. Whoever is on right
   now wears the now mark. A card with no time shows no time line.
5. Tapping a card cycles the pick **without the card moving or vanishing**.
6. **A room's header names the room** and takes no tap of its own — no
   chevron, no fold (MODEL-V4 §3a.2).
7. **The fest name** (bottom dock on mobile, day rail on desktop) opens the
   show menu: one row per room of the festival week with a check, then
   Settings. Unchecking a room hides it on every day — it renders nothing,
   and a day with nothing visible left on it has no rule and no tab (never
   an empty shell). Remembered per fest, on this device only, and it is the
   ONE way to hide a part of the week; the menu still lists every room, which
   is where the state is visible.
   A fest with one room goes straight to Settings, as it always did.
8. **A dated section is its own tab** after the days (LATE NIGHTS), ruled by
   date (TUE · SEP 29) with its venue groups under each rule. Its cards pick
   like any other, and an artist playing two of its nights is two cards and
   one pick.
9. Searching falls back to the filterable flat grid.
**Expected:** nothing but a published stage grid ever gets a clock — no
threshold decides a layout; the grid may exceed the page's reading max-width
(full-bleed, headings at reading width, scroll-snap on mobile, as many
columns as fit a desktop window); the people filter dims everywhere — on
the clock, in a stack, in a list — and never hides a card.

## F6 · Notes — artist scope (via the zoom, one grammar across mouse and touch — 2026-08-30)

1. Hover with intent (mouse, after a real delay) or hold (touch, ~500ms)
   shows the zoom: the card grows into an overlay centered on it — the wall
   never reflows or moves underneath.
2. A tap or click ON THE ZOOMED CARD picks: the level cycles, the pills
   update live, and the zoom stays put, so repeated taps preview the next
   level without re-opening anything. The notes chip inside the zoom is the
   one control that doesn't pick — it's the door to the artist sheet. The
   corner note-count chip on a resting (unzoomed) card is also always a
   one-tap door to the sheet.
3. Tapping outside the zoom, Escape, or scrolling puts the zoom away.
4. The sheet opens with the card itself as its header (grown once more, ✕ in
   its corner) — with no notes chip on it, because the sheet IS the thread;
   the Spotify chip stays — then the conversation: threads one level deep. At rest a note
   is a name, a time and words. Hover (mouse), press-and-hold (touch) or
   keyboard focus fades in one line of plain words under them — `Reply · Pin`,
   or `Edit · Reply · Pin` on your own. Replies indent one gutter under their
   root; a deleted root leaves a quiet stub so its replies keep their context,
   and that stub can still be replied to.
5. Reply opens a composer inline, at the foot of the thread you pressed — where
   the note will actually land. Replying to a reply pre-fills `@Name` and still
   posts flat, one level. The sheet's bottom composer writes NEW notes only.
6. Edit turns the note's own words into a field in place, and the cue line
   becomes `Save · Cancel · Delete` — delete has no other door, and keeps its
   two-tap "Sure?" arm.
7. Save → note syncs to the crew; note counts (replies included) update
   everywhere.
**Expected:** mobile = bottom sheet; desktop = centered dialog (never a
full-width strip pinned to the bottom of a wide viewport). Only your own notes
can be edited or deleted (tombstone). A pinned root sorts to the top and shows
a reply count, never its thread, until tapped open — and replying into a folded
thread opens it, so you can see where the words land.

## F7 · Notes — a date, and a section on a date

1. **A note is written where you are standing** (MODEL-V4 §3a.3). Tapping a
   day's rule opens that date's notes; tapping a section's header on a day
   opens that section-on-that-date's (`Folsom · Friday`); a card's zoom opens
   the artist's. The rule and the header ARE the doors — real buttons, nothing
   added to them but the hit.
2. Day notes are keyed by the **ISO date**, so the two Fridays of a
   two-weekend fest are two threads and an afters night is its own. A section
   on a date is keyed `<iso>|<section>`, additive. Nothing rolls up: a
   `Folsom · Friday` note never appears under `Friday`. A note written under an
   older weekday label still renders under the date that label maps to; a note
   written under a bare section label stays readable in the sheet, with no door.
3. The WHISPER (2026-08-29): nothing sits inline until someone writes; then
   the newest note (root or reply) rides as one soft line under the door it
   belongs to — a date's under its rule, a section-on-a-date's under that
   header on that day, never under another day. Composing happens in the sheet.
**Expected:** a date reads the way the wall's rule reads it (`Friday`) — unless
two dates would answer to the same name, when every date takes the dated form
(`Fri · Oct 2`); a storage key never reaches the screen.

## F8 · Notes — festival scope + the all-notes view

1. Notes chip (top of wall, with total count) → ALL NOTES view: festival-note
   composer at top, then ONLY the targets somebody has written on, in wall
   order — This festival / a date / a section on that date / each artist. No
   empty date rows and no "+ Add a note for…" doors: you write from where you
   are standing, and the sheet is the list of what came of it.
2. Wall bottom carries NOTES · <FEST> as a whisper once festival notes exist
   (on a lineup-less fest, a quiet "+ Add a note" keeps the invitation).
**Expected:** the all-notes view is the notes HOME: you can always ADD a
festival note right there (including from the empty state); scope sections are
legible (D3); empty state may hint at the hold but never as the only path.

## F9 · Day navigation

1. Mobile: bottom dock — You chip (jump to top), day tabs (scrollspy-active),
   fest name (the show menu, or Settings on a one-room fest — F5.7).
2. Desktop: sticky day rail under the toolbar with the same tabs + jump to
   top; scrollspy highlights the day in view.
3. A dated section's tab sits at the end, labelled by the section
   (LATE NIGHTS). It never joins the day axis and is never split.
**Expected:** every viewport has day navigation; dock hides while typing in
search (keyboard avoidance); no tab is ever empty, so nothing has to explain
that everything on a day is hidden.

## F10 · Browser navigation

1. Back after opening Settings / a drill page / any sheet or dialog → closes
   that layer, returns to the previous surface. Forward re-opens.
2. The `#g=` crew link survives all navigation (shareable at any time).
3. In-UI back buttons and browser back agree.
**Expected:** browser back NEVER dumps the user out of the app while layers
are open; refresh at any point restores the same surface or its nearest parent.

## F11 · Settings — one page, two doors

1. Gear (or dock fest link) → Settings: YOU door (name, color, your Spotify —
   and, since 2026-08-29, the ONLY place to switch who this device picks as:
   the wall repaints for the new identity) and CREW door (members, crew name,
   festivals, share link, danger zone).
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
