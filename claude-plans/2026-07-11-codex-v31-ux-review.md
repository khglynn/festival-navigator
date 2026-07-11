# Codex v3.1 whole-app UX review

Independent, blind pass over the full repo (festival-navigator, v3 redesign) with a UX/user-flows lens.
Findings are appended below AS FOUND, in order discovered — never rewrite prior entries.

Format per finding:

```
## [P0|P1|P2|P3] Short title
- **File:** path:line
- **User impact:** what a real user experiences
- **Root cause:** why it happens
- **Suggested direction:** how to fix (direction, not a full diff)
---
```

Severity key: P0 = broken/blocking a core flow, P1 = clearly wrong or confusing but workaroundable, P2 = rough edge / inconsistency, P3 = polish / nice-to-have.

---

## [P1] Desktop set-times never deliver the promised all-stage view
- **File:** js/v3/wall.js:184; assets/v3.css:175; index.html:20; data/festivals/electric-forest-2026.json:43
- **User impact:** On a 1440px-wide desktop, Electric Forest's seven-stage schedule still lives in a horizontally scrolling viewport instead of showing the full schedule at once. Comparing conflicts across distant stages requires repeated sideways scrolling; Lollapalooza days with even more stages are worse.
- **Root cause:** Each stage is forced to at least 150px, while the entire app shell is capped at 960px. Seven stages plus the 40px time column require at least 1,090px before gaps, so the implementation cannot satisfy its own stated desktop behavior that “desktop fits them all.” The checked-in Electric Forest data has seven stages on Day 1.
- **Suggested direction:** Give the scheduled view a wider desktop layout and/or use a desktop-specific compact stage-column strategy so all normal stage counts fit without an inner horizontal pager; test the maximum checked-in stage count, not only Electric Forest's seven.
---

## [P1] ACL's two weekends are merged into one indistinguishable lineup
- **File:** data/festivals/acl-2026.json:14; js/v3/wall.js:167; index.html:121
- **User impact:** An ACL Weekend One attendee sees Weekend Two-only artists mixed into the same Friday/Saturday/Sunday walls and can pick them without any indication that they will not appear on that attendee's weekend. There is no weekend selector or weekend badge on either mobile or desktop.
- **Root cause:** The data correctly supplies `weekends: "W1"|"W2"|"both"`, but the only wall filters are artist-name search and sort; rendering consumes only `name` and `day`. The toolbar contains no weekend control.
- **Suggested direction:** Add a festival-driven W1/W2 selector that filters the lineup (with a clear “both weekends” treatment), persist the choice per festival/device, and carry it into future scheduled data and exports.
---

## [P1] Gemini approval hides most of the lineup it is asking users to trust
- **File:** js/v3/settings.js:200; js/v3/settings.js:209; js/v3/settings.js:212
- **User impact:** For a researched festival with dozens or hundreds of artists, the approval card shows only the first 12 names and then offers “Looks right — save it.” A user cannot inspect the rest of the lineup, its day assignments, or the cited sources before approving potentially incomplete or incorrect AI research.
- **Root cause:** The candidate preview reduces `c.artists` to `slice(0, 12)` and displays only a source count; there is no expandable full result, source list, or correction step before save.
- **Suggested direction:** Make approval a real review screen: show the complete grouped lineup, expose clickable source citations, surface validation warnings, and allow corrections or a re-research request before confirmation.
---

## [P1] Common names can appear to join successfully while nothing syncs
- **File:** js/v3/app.js:319; js/state.js:138; api/_lib/crew-shared.mjs:29; js/sync.js:76
- **User impact:** A new member named, for example, `O'Connor` or `A&B` is admitted to the wall locally and can make picks, but the server rejects the pending person payload. Their identity and picks remain only on that device; the app exposes the failure only as a gray sync dot, so the user can reasonably believe the crew saw their choices.
- **Root cause:** The join UI accepts any trimmed 24-character value, while the server bans apostrophes, ampersands, quotes, and several other printable characters. Unlike crew creation, joining does not await or surface the write result; it enters the app before the scheduled sync fails.
- **Suggested direction:** Share the server's name rules with the client, validate before entering the wall, use a humane rule that supports normal names where possible, and present a blocking inline error if the initial membership write cannot sync.
---

## [P1] Spotify's implemented access-request path is unreachable from the app
- **File:** api/access.js:1; js/v3/settings.js:392; js/v3/settings.js:394
- **User impact:** A crew member who is not already allowlisted in the Spotify developer app has no in-app way to request access, even though the backend includes a complete request/approval flow. The only visible setup asks someone to paste a raw Client ID and gives no redirect-URI, allowlist, Premium-owner, or developer-dashboard guidance, so Spotify cannot be completed end to end by a typical festival crew.
- **Root cause:** No client code calls `/api/access`; the disconnected drill has only “paste Client ID” and “Connect” branches. The access-request API's config probe, email submission, and approval polling are orphaned.
- **Suggested direction:** Wire the access-request flow into the Spotify drill when the deployment owner app is available, and add an explicit crew-lead setup guide (including redirect URI and allowlist constraints) for bring-your-own Spotify apps.
---

## [P1] Scheduled cards discard their exact set times
- **File:** js/v3/wall.js:53; js/v3/wall.js:232; assets/v3.css:16
- **User impact:** In the set-times view, users see artist names positioned against hourly grid marks but never see the actual start time on a card. Sets beginning at :15, :30, or :45 require estimating from position, which is especially error-prone while horizontally and vertically scrolling on a phone.
- **Root cause:** `renderScheduledDay` passes `{ time: a.startStr }` into `renderCard`, and CSS includes a `.card .time` style, but `renderCard` never reads `opts.time` or creates a time element.
- **Suggested direction:** Render the exact start time inside every scheduled card (with a compact treatment for short cells) and verify it remains legible in split overlap lanes.
---

## [P1] The schedule keeps a sort control that silently does nothing
- **File:** index.html:121; js/v3/app.js:398; js/v3/wall.js:279
- **User impact:** On a scheduled festival, choosing “My picks” or “Crew favorites” triggers a repaint but leaves the schedule unchanged. The same control suddenly works only after typing a search, because search swaps the entire experience to the flat lineup. Users get no explanation of either behavior.
- **Root cause:** The no-query scheduled branch returns before `applySort`; `ctx.sort` is consumed only by the flat renderer. The toolbar is shared unchanged across both modes.
- **Suggested direction:** Make scheduled-mode controls honest: hide/replace sort with schedule-relevant filters or visibly apply the selected emphasis/filter while preserving the clock layout. Explain the deliberate flat-results transition when searching.
---

## [P1] “Download day image” targets a hidden, all-days wall
- **File:** js/v3/settings.js:367; js/v3/app.js:163; js/v3/tools.js:98
- **User impact:** The export is offered from Settings while the app screen containing `#wall-root` has `display:none`; if capture succeeds at all, its target is the entire wall (every day plus notes), not a selected day. On mobile this can yield a blank/failed image or an enormous, impractical canvas, and any html2canvas failure is silently swallowed.
- **Root cause:** Screen switching hides `screen-app`, `downloadWallImage` captures `#wall-root` directly, and there is no day parameter or temporary visible/offscreen export layout. The caller catches every error without feedback.
- **Suggested direction:** Build a dedicated visible offscreen export surface for a user-selected day, size it for a useful share image, and show explicit progress/success/failure feedback.
---

## [P1] Bulk paste reports nonexistent artists as successfully applied
- **File:** js/v3/tools.js:60; js/v3/tools.js:69; js/v3/tools.js:90
- **User impact:** A typo or a pick exported from another festival is counted as “applied,” but no corresponding card exists on the current wall. The invisible pick persists and can reappear in exports, leaving users with no way to find or correct it.
- **Root cause:** Bulk import validates only the person name. It writes every parsed artist string without checking the active festival's artist set, and the success count is incremented unconditionally.
- **Suggested direction:** Match against the active lineup (case-tolerantly with an explicit confirmation for fuzzy matches), list unknown artists before applying, and distinguish updated, skipped, and invalid lines in the result.
---

## [P1] Past festivals cannot be chosen during first-time setup
- **File:** js/v3/app.js:176; js/v3/settings.js:118; js/v3/settings.js:143
- **User impact:** Someone arriving specifically to plan or revisit Electric Forest, Ubbi Dubbi, ACL 2025, Wicked Oaks, or Lollapalooza cannot select it on “Pick the fest.” They must create a crew under an unrelated future festival, discover Settings, expand a collapsed archive, and switch afterward.
- **Root cause:** The create screen explicitly filters every `status === 'archived'` festival, while archived access exists only inside an already-created crew's Settings page.
- **Suggested direction:** Let first-time users choose past festivals from a clearly labeled archive during setup, without forcing an unrelated active-festival choice.
---

## [P1] Empty future festivals lose festival-scope notes entirely
- **File:** data/festivals/tomorrowland-winter-2027.json:10; js/v3/wall.js:292; js/v3/wall.js:317
- **User impact:** Tomorrowland Winter correctly says “Lineup coming soon,” but the wall stops there: the festival-notes composer never renders. A crew cannot use festival notes for tickets, lodging, travel, or announcement reminders during the exact pre-lineup phase when those notes are most useful.
- **Root cause:** The flat renderer returns immediately when `artists.length === 0`, before appending the festival-wide notes section.
- **Suggested direction:** Treat the lineup empty state as one section of the wall, not a terminal return; always render festival-scope notes and give the all-notes empty state an actionable route to them.
---

## [P1] Switching to an uncached festival offline can strand the app
- **File:** js/v3/app.js:243; js/festivals.js:20; js/v3/app.js:355
- **User impact:** Settings lists every festival while offline, but tapping one that this device has never opened first saves it as active and then fails to fetch its JSON with no message or rollback. Returning to the wall can crash against missing festival data, and subsequent offline launches keep retrying the now-saved unavailable festival instead of opening the last usable one.
- **Root cause:** `switchFestival` mutates/persists the active id before an unguarded `await loadFestival(fid)`. `enterApp` likewise does not recover from a full-festival load failure; only the index fetch has an offline catch.
- **Suggested direction:** Load first and commit the switch only on success, show which festivals are available offline, keep the current wall intact on failure, and fall back to the last cached festival at boot.
---

## [P1] Crew creation never leads users to the invite action
- **File:** js/v3/app.js:206; js/v3/app.js:357; js/v3/settings.js:94
- **User impact:** After creating a crew, the user lands directly on a wall with no share prompt, invite link, or onboarding callout. “Share invite” exists only inside Settings, behind a gear on desktop or the festival name in the mobile dock, so the app's defining collaborative step is easy to miss.
- **Root cause:** Successful creation calls `enterApp` immediately; the only invite UI is nested in `currentFestCard` on Settings.
- **Suggested direction:** Make invite the explicit next step after crew creation (with copy/share and a skippable “start picking” path), then keep the Settings action for later reuse.
---

## [P1] Tapping a crew member chip silently changes who you are
- **File:** js/v3/app.js:95; js/v3/app.js:105; js/v3/app.js:45
- **User impact:** The colored names above the wall look like filters or a crew legend, but tapping any one instantly changes the device identity. Every subsequent artist tap and note is attributed to that person, with no confirmation or persistent “you are now…” feedback beyond subtle styling, so picks can be silently assigned to the wrong member.
- **Root cause:** Every person chip calls `crew.setMe` directly. The affordance is unlabeled, and identity controls share the primary filtering toolbar.
- **Suggested direction:** Keep crew chips informational/filter-oriented and move identity switching into an explicit “You” control with confirmation and a conspicuous active-identity state.
---

## [P1] Add-a-festival opens on top of the full Settings page
- **File:** js/v3/settings.js:138; js/v3/settings.js:161; js/v3/settings.js:373
- **User impact:** Tapping “+ Add a festival” inserts the ADD A FESTIVAL drill-down above the still-visible Settings page instead of replacing it. On both phone and desktop the user sees two page headers and can continue interacting with unrelated settings beneath the supposed subpage.
- **Root cause:** This route calls `openAddFestival` without hiding `settings-main`; Spotify, How it works, Bulk paste, and Export explicitly hide the main view first. The subview and main view are sibling nodes.
- **Suggested direction:** Route every drill-down through one shared subview transition that hides the main panel, restores it on back, and manages focus consistently.
---

## [P1] Browser Back/Forward do not model the app's visible pages
- **File:** js/v3/app.js:236; js/v3/settings.js:337; js/v3/notes.js:93; js/v3/app.js:429
- **User impact:** Settings, its drill-downs, artist notes, and All Notes all open without a history entry. Back may skip several visible levels, jump to a prior site for a directly opened crew link, or re-run the whole crew boot instead of closing the top surface; Forward can never restore the page/sheet the user just left. This is especially disruptive for Android/PWA back gestures.
- **Root cause:** In-app navigation is implemented only with `display` changes and appended sheet DOM. The app listens only to `hashchange` for crew links and never pushes route state or handles `popstate` for screens, subviews, or sheets.
- **Suggested direction:** Define a small route/state model for wall, settings, each settings drill-down, and note sheets; push/replace deliberately and make Back unwind exactly one visible layer while Forward restores it.
---

## [P1] There is no reachable crew switcher or leave action after activation
- **File:** js/v3/app.js:264; js/v3/app.js:375; js/crew.js:27
- **User impact:** The landing page can list multiple remembered crews, but once any crew is active, visiting `/` immediately reopens that active crew. Settings switches festivals inside the same crew and offers no “My crews,” “leave,” or “start another crew” action, so users need an old invite URL or manual storage clearing to change/remove crews.
- **Root cause:** Boot falls back to `activeCrewToken()` whenever the URL lacks a token. `forgetCrew` exists but has no UI call site, and there is no action that intentionally renders the remembered-crews landing page.
- **Suggested direction:** Add an explicit crew-management entry in Settings (switch, rename/context, leave/forget, create new) and distinguish crews from festivals in the landing information architecture.
---

## [P1] Dead or invalid invite links collapse into an unexplained landing page
- **File:** js/v3/app.js:378; js/v3/app.js:381; js/v3/app.js:382
- **User impact:** Opening a deleted, mistyped, expired, or not-yet-cached invite while offline simply shows the normal landing page. The invited user is not told whether the link is invalid, the crew was removed, or a connection is required, so joining appears to have done nothing.
- **Root cause:** Both fetch failure and a 404/null document converge on `renderLanding()` with no error state or preservation of the attempted token.
- **Suggested direction:** Render a dedicated invite error/retry state that distinguishes malformed/not-found from offline-unavailable and retains an obvious path back to My Festivals.
---

## [P1] Artist picking is mouse/touch-only on desktop
- **File:** js/v3/wall.js:55; js/v3/wall.js:127; js/v3/wall.js:81
- **User impact:** Keyboard and assistive-technology users cannot focus an artist card, change its pick level, or open notes for an unnoted artist. Existing note-count chips are also clickable spans rather than controls, and no accessible state announces the current pick level.
- **Root cause:** Artist cards and note chips are non-focusable `div`/`span` elements with click and pointer handlers, without button semantics, keyboard handlers, labels, or pressed/state attributes.
- **Suggested direction:** Use real buttons (or fully equivalent semantics) for pick and note actions, expose the artist and current level in the accessible name/state, support Enter/Space and a keyboard notes action, and add visible focus treatment.
---

## [P2] Settings rows and switches are not keyboard/screen-reader complete
- **File:** js/v3/settings.js:33; js/v3/settings.js:42; js/v3/settings.js:55
- **User impact:** “How it works,” export, bulk paste, and download rows cannot receive keyboard focus because they are clickable divs. Low power and Stay offline are focusable switches, but their buttons contain only an empty knob and are not labelled by the adjacent title, so a screen reader encounters unnamed switches.
- **Root cause:** `linkRow` attaches click behavior to a plain div, while `toggleRow` gives the button switch semantics but no `aria-label`/`aria-labelledby` relationship.
- **Suggested direction:** Render action rows as buttons/links, associate switch labels and descriptions programmatically, and add consistent `:focus-visible` styles.
---

## [P1] Notes cannot be corrected or deleted after posting
- **File:** js/v3/notes.js:40; js/v3/notes.js:52; js/v3/model.js:78
- **User impact:** A typo, stale plan, accidental post, or sensitive detail is permanent in every notes surface. Even the author receives only Pin/Unpin; there is no edit or delete affordance despite synced notes being shared with the crew.
- **Root cause:** Note rows implement only optional pinning. The data model already recognizes `deleted:true` tombstones, but no UI records one or offers author-owned management.
- **Suggested direction:** Add author-only edit/delete controls with confirmation for deletion, write tombstones through the existing note recorder, and make remote updates refresh any open notes surface.
---

## [P2] Open note sheets never receive live crew updates
- **File:** js/v3/app.js:389; js/v3/notes.js:115; js/v3/notes.js:153
- **User impact:** If another crew member adds a note while someone is reading an artist or All Notes sheet, the open sheet stays stale even though the wall behind it is repainted. The reader must close and reopen to see the conversation update.
- **Root cause:** Remote change handling repaints only the wall and person chips. Each sheet paints from state once at open (artist sheets repaint only after the local composer saves), with no subscription or rerender callback for remote changes.
- **Suggested direction:** Include the active overlay in the remote-render path or have note surfaces subscribe to state changes while mounted, preserving scroll/focus when new notes arrive.
---

## [P1] Searching a schedule removes the schedule information
- **File:** js/v3/wall.js:279; js/v3/wall.js:290; js/v3/wall.js:309
- **User impact:** Searching for an artist in Electric Forest or Lollapalooza replaces the clock grid with an ordinary name card. The result does not show stage or start time and offers no jump back to the set's grid position, so search cannot answer the core festival question: “Where and when is this artist?”
- **Root cause:** Any non-empty query bypasses `renderScheduledDay` and falls through to the generic flat renderer, whose cards receive only the artist name.
- **Suggested direction:** Keep scheduled search in schedule context: show day/time/stage in results and provide a clear “jump to set” action (or filter/highlight in place) while retaining pick/note controls.
---

## [P1] Settings counts cleared picks as still picked
- **File:** js/v3/settings.js:104; js/v3/settings.js:127; js/v3/app.js:58
- **User impact:** After a user cycles a must back to cleared, Settings still includes that artist in “N artists picked.” The same inflated count appears beside other festivals and can include invisible bulk-paste typos, so the summary cannot be trusted.
- **Root cause:** Counts use the number of raw selection object keys. Level-zero tombstones remain by design, and raw keys are never filtered through `model.picksFor` or matched to the active lineup.
- **Suggested direction:** Derive every user-facing pick count from normalized nonzero picks (and active lineup membership), with a consistent definition such as unique artists picked by anyone.
---

## [P1] Settings can claim “synced” while the app is deliberately or actually offline
- **File:** js/v3/settings.js:76; js/v3/settings.js:350; js/sync.js:22
- **User impact:** With Stay offline enabled, after a failed sync, or simply with no current pending edits, the current-festival card shows a green “synced” label. This contradicts the gray status dot and can make users believe other crew members have received changes when no network attempts are occurring.
- **Root cause:** The Settings label is computed only from `state.hasPending()` and is disconnected from the sync module's online/offline/error/stay-offline status.
- **Suggested direction:** Maintain one observable sync state and render it consistently everywhere, distinguishing synced, syncing, offline with queued changes, intentionally offline, and error (with retry/details).
---

## [P1] Adding a known festival can silently replace its canonical data
- **File:** js/festivals.js:34; js/festivals.js:37; api/festival-add.js:92
- **User impact:** If a crew researches “ACL 2026” (or any already-loaded festival) and Gemini returns the same id, the custom result replaces the checked-in canonical festival document for that crew on every load. That can silently discard curated fields such as ACL weekend assignments or later scheduled data, with no warning and no remove/restore UI.
- **Root cause:** Custom merging always assigns `FESTIVALS[fest.id] = fest` before checking whether the id already exists in the index, and the server accepts/upserts any valid slug without reserving canonical ids.
- **Suggested direction:** Reject canonical-id collisions at research/save time or treat them as an explicit reviewable update layered safely onto canonical data; provide custom-festival management and restore/delete controls.
---

## [P1] Spotify library refresh must be repeated from scratch for every festival
- **File:** js/v3/settings.js:426; js/v3/settings.js:430; js/v3/settings.js:431
- **User impact:** After scanning an entire Spotify library, only the currently open festival gets badges. The message says to open other festivals, but opening alone does nothing; users must revisit Spotify and run the expensive full liked-songs/followed-artists scan again for each festival.
- **Root cause:** Every Refresh click calls `scanLibrary` before applying affinity, and then filters only `state.fest().artists`. Festival switches never reuse the cached `libraryMap` to apply badges.
- **Suggested direction:** Scan the account once, reuse the cached library map across all loaded/current festival lineups automatically, and offer a lightweight “apply cached library” path when a new festival is opened.
---

## [P2] Share failures are silently treated as cancellation
- **File:** js/v3/settings.js:97; js/v3/settings.js:101; js/v3/settings.js:102
- **User impact:** On a desktop/browser where Web Share is unavailable and clipboard permission fails, “Share invite” appears to do nothing. The user is not shown the invite URL or an error and has no in-app manual-copy fallback.
- **Root cause:** Clipboard and native-share errors share one empty catch block whose comment assumes every failure was a dismissed share sheet.
- **Suggested direction:** Treat user cancellation separately from real failures; always expose a selectable invite URL and offer retry/copy feedback.
---

## [P2] Portola renders two indistinguishable SAT dock tabs
- **File:** data/festivals/portola-2026.json:258; js/v3/app.js:143; js/v3/wall.js:142
- **User impact:** Portola's mobile dock contains SAT, SUN, and another SAT: the “Saturday & Sunday” Despacio section is truncated to the same three letters as Saturday. Users cannot tell which SAT target they are jumping to.
- **Root cause:** Every distinct `artist.day` string becomes a separate group/tab, and labels are blindly reduced to the first three characters.
- **Suggested direction:** Model multi-day appearances explicitly (render under both days or as a clearly named special group) and generate unique, data-aware dock labels.
---

## [P0] Festival context is lost when a crew invite is opened on a new device
- **File:** js/crew.js:45; js/v3/app.js:220; js/state.js:57; js/state.js:59
- **User impact:** A crew created for Portola (or any festival other than the first catalog entry) shares an invite labelled with that crew/festival name, but a new member who joins is dropped into Lost Lands. Sharing from a later festival or a custom festival has the same problem. The recipient can start picking the wrong lineup without realizing the invite lost its festival context.
- **Root cause:** The creator's chosen festival is stored only in that device's `localStorage`. The invite URL contains only `#g=<token>`, and a new device with no saved festival always selects `defaultFestivalId()` when activating the crew.
- **Suggested direction:** Include and validate the intended festival id in invite/navigation state (or store an explicit crew default/current invite festival), set it before first render on the recipient, and preserve compatibility for old token-only links with a clear festival choice.
---

## [P1] Add-a-festival save can get permanently stuck after a network error
- **File:** js/v3/settings.js:214; js/v3/settings.js:216; js/v3/settings.js:220
- **User impact:** If connectivity drops after research but before confirmation, tapping “Looks right — save it” can leave that button disabled forever with no error or retry feedback. The user must discard/research again or leave the page.
- **Root cause:** The confirmation listener disables Save and awaits fetch/JSON parsing without its own `try/catch/finally`. The outer research handler's error handling has already completed and cannot catch errors from this later click.
- **Suggested direction:** Give confirmation its own guarded request lifecycle, always re-enable on failure, preserve the reviewed candidate, and show actionable offline/server retry feedback.
---

## [P2] Spotify playlist quantity contradicts the UI
- **File:** js/v3/settings.js:452; js/v3/settings.js:465; js/spotify.js:171
- **User impact:** The playlist card promises “One track per picked artist,” but a successful run adds two tracks per artist by default. Large crew lineups produce roughly double the expected playlist length.
- **Root cause:** The caller does not pass `tracksPerArtist`, so `playlistFromPicks` uses its default value of 2.
- **Suggested direction:** Pass one track per artist to match the product copy, or expose a clear track-count choice and update the estimate before creation.
---

## [P1] Note-only syncs do not repaint the wall at all
- **File:** js/state.js:173; js/state.js:176; js/v3/app.js:389
- **User impact:** When another member adds a festival, day, or artist note, the receiving device updates its cached document but leaves the note section, artist badge, and total Notes count unchanged. The note appears only after an unrelated action causes a repaint (search, sort, festival reopen, reload), undermining live crew notes.
- **Root cause:** `applyRemoteDoc` decides whether to call `onRemoteChange` by comparing only people, active-festival selections, and affinity. Notes are omitted from the visible-state comparison, so a note-only poll returns `false` and the app never rerenders.
- **Suggested direction:** Include active-festival notes (and every other rendered remote field) in change detection, or emit a typed remote-change event and update wall counters, sections, and any open notes surface from the same path.
---

## [P1] Bulk paste turns every unknown level into a real pick
- **File:** js/parse.js:18; js/parse.js:22; js/v3/tools.js:67
- **User impact:** Lines such as `Kevin: GRiZ (Muts)`, `(Picked x4)`, or any arbitrary parenthesized label are accepted as level-1 picks and reported as applied. A simple typo silently changes intent instead of being flagged.
- **Root cause:** `parseBulkLineV4` initializes `level = 1` and returns it for every label not explicitly recognized; the importer has no invalid-level branch.
- **Suggested direction:** Whitelist the documented labels, return a structured parse error for everything else, preview line-by-line errors, and apply only after the user confirms the valid subset.
---

## [P2] Spotify Client ID setup requires leaving and reopening the drill
- **File:** js/v3/settings.js:392; js/v3/settings.js:405; js/v3/settings.js:407
- **User impact:** After saving a valid Client ID, the page says “connect below once it syncs,” but no Connect button appears below. Even after sync completes, the user must back out and reopen Spotify to reach the connect branch.
- **Root cause:** The drill chooses its disconnected branch once at render time. Saving records pending state and schedules sync but neither applies the id immediately to the visible crew doc nor rerenders after the server response.
- **Suggested direction:** Show an explicit saving/syncing state, then rerender the same drill with Connect available as soon as the Client ID is locally valid (while still reporting sync failure).
---

## [P2] Archived Lollapalooza has no year or dates anywhere in the experience
- **File:** data/festivals/lollapalooza-2025.json:4; data/festivals/lollapalooza-2025.json:7; data/festivals/index.json:95
- **User impact:** The archive row and wall header show only “Lollapalooza,” unlike every other festival. Users cannot tell which edition the full schedule represents, especially once future Lollapalooza data is added.
- **Root cause:** Both the full festival document and index entry have blank `year` and `dates`, even though the id and filename identify 2025.
- **Suggested direction:** Fill canonical 2025 metadata and require year/date completeness for archived festival records in validation.
---

## [P2] Festival date metadata is loaded but omitted from day headers
- **File:** data/festivals/electric-forest-2026.json:21; js/v3/wall.js:192; js/v3/wall.js:193
- **User impact:** Electric Forest schedule sections read “DAY 1 · THU 1” rather than showing the available `Jun 25` date. In long multi-day schedules, users must remember the date mapping from the page-level date string.
- **Root cause:** The renderer uses only `dayMeta.wd` and `dayMeta.num`; `dayMeta.date` is never rendered.
- **Suggested direction:** Show the actual calendar date beside each day title and use `num` only where it adds information rather than repeating “Day 1.”
---

## [P1] Desktop has no day navigation at all
- **File:** index.html:133; assets/v3.css:136; js/v3/app.js:128
- **User impact:** On a 1440px desktop, a four-day scheduled festival requires scrolling through several thousand pixels to reach later days. The only day-jump controls live in the mobile dock, which is forcibly hidden at 720px and above; there is no desktop replacement or sticky day navigation.
- **Root cause:** `renderDockDays` renders exclusively into `#dock-days`, and the entire dock is `display:none` on desktop. The desktop header exposes no days.
- **Suggested direction:** Add a desktop day navigator (ideally sticky alongside the schedule controls) using the same day targets/scrollspy, and verify long flat and scheduled festivals.
---

## [P2] Archived festivals look and behave like current planning data
- **File:** data/festivals/electric-forest-2026.json:9; js/v3/app.js:83; js/v3/app.js:45
- **User impact:** After entering an archived festival, the wall has no “Archived”/past-event context and every card remains editable. Users can unknowingly alter old picks as if planning an upcoming weekend.
- **Root cause:** Status is used only to filter festival lists; the active wall theme/header and pick handler never read `fest.status`.
- **Suggested direction:** Add a clear archive banner/state and deliberately decide whether old picks are editable; if edits remain allowed, label that mode and protect against accidental changes while keeping notes/export useful.
---

## [P2] The sort control is styled to look non-interactive
- **File:** index.html:121; assets/v3.css:63; assets/v3.css:68
- **User impact:** The sort dropdown is rendered as a plain rounded pill with the native arrow removed and no replacement arrow, so especially on touch it can read as a static “Billing” label rather than a control.
- **Root cause:** Inline `appearance:none` suppresses the platform indicator. CSS defines `.sort-chip .caret`, but a native select cannot contain the caret span that rule expects.
- **Suggested direction:** Keep the native indicator or add a non-interfering custom chevron with clear focus/pressed states while preserving the native select behavior.
---

## [P2] Notes sheets scale edge-to-edge on a 1440px desktop
- **File:** assets/v3.css:104; assets/v3.css:105; assets/v3.css:108
- **User impact:** Artist and All Notes sheets stretch across the full desktop viewport, producing very long note bubbles and a composer more than a thousand pixels wide, while the rest of the app is capped at 560–960px. It looks like a mobile sheet enlarged rather than an intentional desktop surface.
- **Root cause:** `.sheet` is fixed with `left:0; right:0` and has no desktop max-width/margin treatment.
- **Suggested direction:** Use a centered, bounded modal/sheet treatment at desktop breakpoints while keeping the edge-to-edge bottom sheet on phones.
---

## [P2] The note-sheet grabber advertises a gesture that does not exist
- **File:** js/v3/notes.js:103; js/v3/notes.js:131; assets/v3.css:111
- **User impact:** Mobile users see the conventional drag grabber but cannot swipe the sheet down. With no visible close button, they must infer that tapping the dim backdrop dismisses it (or use a keyboard Escape key that phones do not have).
- **Root cause:** Sheets implement only backdrop click and global Escape dismissal; there are no pointer/touch drag handlers or close control.
- **Suggested direction:** Either implement swipe-to-dismiss with an accessible close button and focus management, or remove the false grabber affordance and make dismissal explicit.
---

## [P2] Add-a-festival errors promise a manual path that does not exist
- **File:** api/festival-add.js:106; js/v3/settings.js:181; js/v3/settings.js:234
- **User impact:** When Gemini returns no usable data, the API tells the user to “try again or add manually,” but the UI has no manual festival or lineup entry path. Not-found suggestions returned by the API are also discarded, leaving only a dead-end error.
- **Root cause:** The client displays only `body.error`; it implements research/confirm/discard but no manual editor and no rendering of `closest` candidates.
- **Suggested direction:** Add a validated manual fallback (or remove the false promise), expose closest matches as retry options, and preserve the user's query/candidate across errors.
---

## [P2] The service worker can install an incomplete offline shell as “ready”
- **File:** service-worker.js:44; service-worker.js:47; service-worker.js:51
- **User impact:** If even a critical script or stylesheet briefly fails during service-worker installation, the PWA still activates and presents itself as offline-capable. A later no-signal launch can load the HTML but fail to boot or render correctly because the missing asset was never guaranteed into the cache.
- **Root cause:** Every individual `cache.add` failure is swallowed and `skipWaiting()` runs regardless; there is no required atomic core set or post-install completeness check.
- **Suggested direction:** Fail installation when any core boot asset is unavailable, keep only genuinely optional assets best-effort, and add an offline-shell verification test covering a clean install.
---

## [P2] Installed PWA unnecessarily locks phones to portrait
- **File:** manifest.json:9
- **User impact:** Users who prefer landscape for a wider schedule grid cannot rotate the installed PWA, even though horizontal space is especially valuable for comparing stages.
- **Root cause:** The manifest forces `orientation: "portrait-primary"` instead of allowing the device orientation.
- **Suggested direction:** Remove the orientation lock (or support `any`) and verify the wall, schedule, sheets, and dock in phone/tablet landscape.
---

## [P2] Going offline can leave a stale green sync indicator for five minutes
- **File:** js/v3/app.js:411; js/v3/app.js:430; js/sync.js:107
- **User impact:** When connectivity drops, the app has no offline-event handler. The dot can continue to claim green/online until the next 25-second poll, or up to five minutes in Low power, so crews may assume recent work is already shared.
- **Root cause:** The app handles `online` but not `offline`; status changes only when a later poll/push observes the connection state.
- **Suggested direction:** Handle the browser offline event immediately, distinguish locally saved/queued work in the label, and keep periodic/network-failure detection as a fallback.
---

## [P1] A wrong crew Spotify Client ID cannot be corrected
- **File:** js/v3/settings.js:392; js/v3/settings.js:411; js/v3/settings.js:477
- **User impact:** If the first person pastes a valid-looking but wrong Client ID, every member is routed to a failing Spotify authorization and Settings offers no way to edit or clear the crew-level id. “Disconnect” removes only the current device's tokens/library and leaves the bad shared configuration intact.
- **Root cause:** The Client ID input exists only when `state.spotifyClientId()` is empty. Once populated, the disconnected branch shows only Connect, and the connected branch's Disconnect never calls `recordSpotifyClientId`.
- **Suggested direction:** Add an explicitly permission/trust-framed crew Spotify configuration section with view/edit/clear, validation via a test authorization, confirmation before disrupting connected members, and clear ownership guidance.
---

## [P1] Legacy crews lose offline picking until a server migration succeeds
- **File:** js/v3/app.js:348; js/v3/app.js:351; js/v3/app.js:46
- **User impact:** A previously cached v3 crew opening the redesigned app without signal can view its wall but cannot make any artist picks. Every tap is blocked until the device gets online and the server migration completes, contradicting the normal “picks save locally first” offline behavior.
- **Root cause:** Any v3 document sets `ctx.migrationPending` when the online-only migration request cannot complete, and `handleTap` hard-gates all writes. There is no preflight banner or offline-compatible staging path.
- **Suggested direction:** Proactively migrate active crews server-side before rollout or stage/replay v4-intent edits safely; at minimum surface a persistent blocking explanation before users tap and provide an explicit retry state.
---

## [P2] The migration-blocked toast offers a fake Undo action
- **File:** js/v3/app.js:47; js/v3/wall.js:332; js/v3/wall.js:335
- **User impact:** When legacy picks are locked, the message “Updating this crew — picks unlock in a moment” includes an Undo button. Tapping Undo does nothing, which makes an already blocking state feel broken.
- **Root cause:** The migration notice reuses `showUndoToast` with an empty callback, and that helper always renders an Undo button.
- **Suggested direction:** Use a separate status/error toast without Undo, keep it visible while blocked, and expose retry/connectivity status.
---

## [P2] Primary setup forms ignore the Enter key
- **File:** js/v3/app.js:406; js/v3/app.js:319; js/v3/settings.js:187
- **User impact:** On desktop, pressing Enter after typing a name on Create or Join—or after typing a festival to research—does nothing. Users must move to and click the adjacent button despite these appearing as conventional single-field forms.
- **Root cause:** These controls are loose inputs/buttons rather than forms and have no Enter key handlers; only note composers implement Enter submission.
- **Suggested direction:** Use semantic forms with submit handlers so keyboard and mobile IME “Go” actions work consistently, preserving disabled/loading/error behavior.
---

## [P1] Bulk paste claims success while migration has disabled every write
- **File:** js/v3/app.js:255; js/v3/tools.js:69; js/v3/tools.js:90
- **User impact:** On a legacy crew waiting for migration (notably offline), Bulk paste reports “N picks applied” even though all of its record calls were ignored. Nothing changes on the wall and the user receives no indication that the import must be retried later.
- **Root cause:** The Settings `recordPick` callback silently returns while `migrationPending`, but `applyBulkText` increments `applied` after every callback without knowing whether the write succeeded.
- **Suggested direction:** Disable the tool with the same visible migration state, or have record operations return success/failure and count only committed local writes; preserve the pasted text for retry.
---
