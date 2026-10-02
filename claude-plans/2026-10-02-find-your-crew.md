_The 2026-10-02 design-and-judge run's output: three designs for a crew code, two judges, and this synthesis (Part A for Kevin, Part B the build plan)._
_Slice 1 (the QR on the Invite sheet) is built on `feat/invite-qr`; slices 2 (the home-screen row) and 3 (four words from the key) wait on Kevin's answers to Part A's questions._

# PART A: For Kevin

**First, the two easy ones.**
- **QR code.** It goes on the Invite sheet you already use, between the line at the top and the link box. A friend points their camera at your phone, or at your laptop screen, and they're in. You can screenshot it or long-press it to save it. There are no new screens.
- **Home-screen icon.** This is a quiet row in Settings. On Android it's one tap. On iPhone it shows the steps. Before I promise the iPhone side, I need one 10-minute test on your phone (question 3).

## 1. The crew code I recommend: four words

- **What it looks like.** Each crew gets four plain words, with the festival name in front: **acl · grape stool tiger wagon**. Those words are just an example; your crew's real ones come from the app. They sit at the top of the Invite sheet, so the order is code, then QR, then link, as you asked. They're also on the Crew card in Settings.
- **What you'd say.** "Go to fest.kevinhg.com and type acl grape stool tiger wagon." Capitals, spaces and dashes don't matter, and the first four letters of each word are enough.
- **It lands in the group chat.** Every invite message gets one extra line: "Lost the link? Go to fest.kevinhg.com and type acl grape stool tiger wagon." Searching the chat for "acl" finds it.
- **Where the words come from.** The app reads them off your crew's existing secret link. Every crew already has its words, there's nothing to set up, and they never change. They work on fest., festival. and crew.kevinhg.com, in any browser and any profile.
- **What they open.** Exactly what the link opens: that crew at that festival. You land on the board, tap your name, and you're back.
- **What they never open.** Your other crews, or "you" everywhere. That's still your My link. Keep it in Notes.
- **Several crews.** Each crew has its own four words, so two ACL crews means two sets. On a new browser, you type each set once.
- **The honest risk.** Nobody can guess the words: there are about 17 trillion combinations. But anyone who hears them or sees a screenshot gets the whole crew for good, exactly like the link today. That means every name, pick and note. Because words are easier to say out loud than a link, say them only to people you'd text the link to. And you can't change them, which is also true of the link today.
- **What you give up.** You can't pick the words, and you can't work them out from memory. You read them once, and after that they live in the chat.

## 2. The runner-up you might prefer: "HG ACL26 + a word you pick" (e.g. HG ACL26 TACOS)

- **Why you might like it.** It's closest to what you asked for, and you could rebuild it in your head.
- **Why it's second.** The "HG ACL26" part is meant to be guessable, and the pattern sits in a public repo. That leaves one word as the only lock. A friend-of-a-friend who knows you're "HG" at ACL has a real chance of getting in, and a hit is the whole crew forever.
- **Why not now.** It needs a new table on the live database, a counter for wrong guesses, and screens for changing the code. That's too much for the four days between weekends.
- **If you want it after ACL.** I'd make it "HG ACL26 + two words", with a pause after wrong tries.

## 3. Questions only you can answer

1. **Four random words now, or wait for a code you choose?** Default: four words now. We look at a choosable code after Oct 11 if you miss it.
2. **Should every QR code and shared link point at fest.kevinhg.com, even when it's made on festival. or crew.kevinhg.com?** Default: yes, but only on those three real sites. Test builds keep their own address.
3. **Will you do one test on your iPhone?** In today's app, open your board in Safari, tap Share → Add to Home Screen, then open the new icon. Does your board come up, or an empty start page? Default if I don't hear back: I assume it opens empty. The iPhone row then waits for the four words, so a new icon can be filled by typing them once.

---

# PART B: Build plan

**Order and timing.** Ship slice 1, then 2, then 3, each as its own release through the usual gate:
- red tests first;
- CI green on the PR head;
- an independent review with its real findings fixed;
- a real-input walk;
- a check on all three hosts.

Build between weekends (Oct 5–8); ACL weekend 2 is live Oct 9–11 (NOW.md header). None of the three slices adds a table or writes to friends' data. Slice 3 adds one read-only query against production.

**Where the judges disagreed, and which way I went.**
- **The winner.** Both picked "four words from the key".
- **Can't-be-changed.** They split on whether that is fatal. Judge 2 said fatal; judge 1 said it's the same as the link today. I went with ship. A later off switch is listed as a dial, not built.
- **Find op placement.** Both said a find op in api/crew.js must sit above the create branch. I moved it to its own file instead (slice 3).
- **Opt-in.** Judge 2's opt-in worry (every crew gets words without asking): I went no opt-in. The words grant nothing a link-holder lacks, and showing them is the opt-in.
- **Line citation.** Judge 2's correction is verified: the token is made at api/crew.js:54, not :158.
- **Legacy crews.** Judge 2 couldn't verify how the legacy crew's token was made, and neither could I: the clone is shallow (`git rev-parse --is-shallow-repository` = true). So words are only derived for 27-character tokens.

## SLICE 1: QR code on the existing Invite sheet

**Scope**
- In: `openInvite` (js/v3/app.js:3653-3693), which also covers the share moment (`openShareMoment`, app.js:3602).
- Out: the IS IN state (`succeed`, app.js:3754-3783), Settings, the landing, the Show menu.
- **No claim-link QR.** A QR of `&me=Drew` tells anyone who scans it "this link is yours" (app.js:4705-4731). The crew QR does the same in-person job, because Drew taps his own name.
- The QR encodes exactly `link` from `inviteLink()` (app.js:3431-3434, used at 3674). That's the same bytes as the box under it, so the sheet carries one link.
- Never `meLink()` (js/crew.js:261-264).

**Library: uqr 0.1.3**
- MIT, "Copyright (c) Project Nayuki" and "(c) 2023 Anthony Fu". It is an ES-module port of Nayuki's reference encoder.
- I downloaded it to scratch only, nothing in the repo:
  - `dist/index.mjs` is 27,482 bytes, about 7.8 KB gzipped;
  - it has zero imports and exports `encode`;
  - its newest syntax is `?.`.
- Matrix sizes I measured:
  - a 76-character crew link is version 5 at ECC M (41 modules with a 2-module border);
  - a 133-character link with `&show=…&view=list` is version 8 (53 modules).
- **Vendoring:** `vendor/uqr.mjs`, upstream bytes unchanged below a prepended `/*! uqr 0.1.3 · MIT · … */` header (the vendor/html2canvas.min.js precedent). A test pins the sha256 of the body.

**Loading**
- `js/v3/qr.js` (ours) statically imports `../../vendor/uqr.mjs`.
- app.js reaches it only through `import('./qr.js')`, so a vendor parse failure stays out of app.js's module graph. The boot net also ignores non-`/js/` errors (index.html:390-396).
- Both files go in **APP_CORE** (service-worker.js:22), not APP_EXTRAS (79-87):
  - tests/app-shell-complete.test.mjs:23 walks dynamic imports and goes red otherwise;
  - APP_EXTRAS is best-effort (`cache.add(...).catch`, service-worker.js:97), so a phone whose install skipped it would have no QR in a field.
- Then run `node scripts/sw-stamp.mjs`.
- **Warm the module** with an idle `import('./qr.js')` after the wall paints, so the sheet almost always draws the QR synchronously and nothing appears late.

**Code**

`js/v3/qr.js`
- `qrMatrix(text)` → `encode(text, { ecc: 'M', border: 2 })`.
- `qrPng(text, cssPx)` draws integer-scaled modules to a canvas at devicePixelRatio and returns a PNG data URL.
  - Dark is `--page` (#0C0A14) and light is `--text-primary` (#FFFFFF), read from computed tokens with literal fallbacks.
  - It throws if `getContext` is null (jsdom).
- It never logs or tracks its text.

app.js
- `inviteQr(link)` next to `inviteLinkRow` (app.js:3627):
  - it returns `<figure class="inv-qr">` synchronously, with a reserved square tile, `<img alt>` and `<figcaption>`;
  - it fills the image when ready, fading in with opacity only. The motion kill rules in the tokens file make that instant under Low power or reduced motion.
  - On failure it removes the figure and calls `record()`, with no link in the error.
- Line 3690 becomes `sheet.append(sub, inviteQr(link), inviteLinkRow(link, 'Crew invite link'), actions)`.
- `INVITE_WORDS` (3612-3625) gains:
  - `qrAlt: 'QR code for the crew link'`;
  - `qrCaption: 'Point a phone camera here to join. Anyone who scans it is in.'`

`assets/v3.css`, next to 473-498
- `.invite-sheet .inv-qr`: `align-self: center; width: min(176px, 52vw); aspect-ratio: 1; background: var(--text-primary); border-radius: var(--r-card); padding: 8px; margin: 0`.
- The `img`: `width: 100%; image-rendering: pixelated; -webkit-touch-callout: default`. Long-press must stay alive, since callouts are off only on cards and controls (v3.css:30, 267, 1152, 1389, 1865).
- `figcaption` in `--text-tertiary`.

**Save image:** no button. Long-press the `<img>` (Save to Photos), right-click on desktop, or screenshot, as Kevin said. A button would push "Or add a friend" further below the 72vh sheet cap (v3.css:681).

**Optional, if Kevin says yes to question 2:** a `shareOrigin()` used only by `inviteLink`, `planLink` and the Settings links.
- It returns `https://` plus the `fn-canonical-host` meta (index.html:31, read the way spotify.js:32-34 does) when `hostKind()` is one of the three prod hosts (js/errlog.js:349-357); otherwise `location.origin`.
- Do not change `crewLink`'s address-bar use at app.js:5215.
- Add the case to tests/crew-links.test.mjs.

**Tests (red first)**
- New `tests/qr.test.mjs`:
  - for every `crewLink` shape (bare, festival, `&me`, `&show`, `&view`, the longest show list), the matrix rendered to RGBA decodes back to the exact text, using jsQR (devDependency, Apache-2.0);
  - the vendor body hash is pinned.
- `tests/people-menu.test.mjs:339+`: the order becomes qr, link, name, others, and the IS IN state has **no** `.inv-qr`.
- `tests/share-copy.test.mjs`: the caption wording, and a source rule that no `inviteQr(`/`qrPng(` call takes `meLink`.
- The app-shell walker and stamp tests go red until APP_CORE and the stamp are done.
- `tests/browser/people-menu.test.mjs` (367-384), at 320×568 and 390×844:
  - the QR is square, inside the sheet, `naturalWidth > 0`, and jsQR-decodes from a screenshot;
  - Copy and Share still work with real pointer input;
  - the name field scrolls into reach;
  - in a reduced-motion run, the QR is visible without waiting.
- `gallery.html`: add the Invite sheet states (member, guest, share moment). None exist today.

**Real-iPhone checks**
- The iOS Camera scans the QR off a phone screen and off a laptop screen. This is Kevin's laptop-profile case.
- Long-pressing the QR offers Save or Share.
- A saved screenshot opened in Photos offers the link.
- Whether a Mac opens a QR from Photos or Preview: verify before telling Kevin.

**Laws touched**
- **The token is the credential:** the QR holds it, the caption says so, and it's drawn on the phone, never by an outside QR service.
- **Person token:** never in a QR.
- **errlog.js is the only door:** no link reaches `track()` or `record()`.
- **`--fest` stays in its four places:** the QR uses `--page` and `--text-primary`.
- **Motion:** opacity only, instant under Low power.
- **Router:** no new layer.
- **Service worker:** APP_CORE, sw-stamp and CACHE_VERSION.
- **Node is blind to canvas:** jsdom has no canvas, so the real-browser walk decides.

## SLICE 2: Quiet Settings row for the home screen

**Step 0:** Kevin's iPhone baseline (question 3). What it decides:
- **(A) The icon opens the board.** iOS took the page URL with its hash, so iOS needs only the instructions.
- **(B) The icon opens empty.** The manifest's `start_url: "/"` (manifest.json:5) won, and the icon's storage is empty.

**Per-crew start URL: out of this slice.** Reasons:
- Safari's handling of a page-built (`blob:`/`data:`) manifest is unverified.
- The native iOS app is next (NOW.md "Next: the iOS app"), which makes an iOS-only trick short-lived.
- Slice 3's words make an empty icon recoverable in one step.

If B, run one experiment as a follow-up:
- **First try:** remove `<link rel="manifest">` (index.html:46) at boot on iOS Safari when not standalone. The iOS test is at index.html:18, and the Apple meta tags at index.html:51-54 keep the icon standalone.
- **Only then:** a `data:` manifest whose start_url is `crew.crewLink(token, fid, me)`.
- **Never:** a served `/manifest?t=` URL (crew.js:110-117). Never `#p=`.

**What ships**
- **Android, always:**
  - a new `js/v3/install.js` registers `beforeinstallprompt` at init, calls `preventDefault()` (hiding Chrome's own bar is the quiet default) and holds the event;
  - the row's tap calls `held.prompt()` on the event itself (the Illegal-invocation law), awaits `held.userChoice`, then clears it;
  - `appinstalled` clears the event and removes the row;
  - keep `start_url: "/"`, because an installed app shares Chrome's storage and `/` resumes the last crew (crew.js:201-203).
- **iOS:** only if the baseline is A, or once slice 3 ships. The tap expands steps in place, with no sheet and no history entry:
  - A: "Tap Share (under ⋯ on newer iPhones), then Add to Home Screen. Open it once with signal."
  - After slice 3: "…then open it and type this crew's words once."

**The row**
- Where: settings.js App list, right after "How it works" (824).
- Built like `updateRow` (1066-1080): a `<button class="list-row">` with a title and a `row-sub`, so it gets the 44px floor.
- Title "Add to home screen". The festival name appears in plain text, never in `--fest`.
- Shown when a crew is open, `standaloneApp()` is false (app.js:3157-3160; pass it through actions), and either the iOS gate passes or an Android prompt is held.

**Usage:** add `home_screen: { platform: ['ios','android'], step: ['tapped','installed','dismissed'] }` to `USAGE` (js/errlog.js:863-886). Existing `landing_view.context` (app.js:3127; errlog.js:884) already tells PostHog whether anyone opens from an icon today.

**Tests (red first)**
- Pure `installKind({ua, maxTouchPoints, standalone, held})` over:
  - iPhone;
  - iPad reporting as a Mac with touch;
  - a Mac with no touch;
  - Android with and without a held prompt;
  - standalone everywhere, which must give no row.
- A shell-rig test (`tests/helpers/shell-rig.mjs`, like tests/update-row.test.mjs):
  - the row is present or absent by platform;
  - a fake `Event` with a receiver-strict `prompt` is called exactly once;
  - `appinstalled` removes the row;
  - any storage touch goes through the throwing-getter stub.
- The usage-track and app-shell tests.

**Real devices**
- Kevin's iPhone: the baseline, plus the follow-up if B. Check `standalone: true` in Diagnostics inside the icon, offline reopen, and that "‹ Your crews" stays in-app.
- One Android phone: Chrome's real install dialog, and that the installed app resumes the crew.

**Laws touched**
- **Router:** no history entry.
- **Touch floor:** 44px, by being a button.
- **WebIDL receivers:** call `prompt` on the event.
- **Storage:** every touch in a try.
- **errlog.js:** the new line goes on `USAGE`.
- **Service worker:** sw-stamp.
- **`--fest`:** not used.
- **The token never in a path or query.**

## SLICE 3: Four words from the key

**Shared module `js/crew-words.mjs`** (phone and server, the precedent being crew-shared.mjs:11 importing js/name-rules.mjs)
- `WORDS`: 2,048 curated lowercase a–z words, 3–8 letters, unique first four letters, festival-friendly (no grim or rude words).
  - BIP-39 English has the unique-prefix property; check its licence or curate our own.
  - A frozen sha256 test applies: a position can never change once shown, the same as the pick-key freeze.
- `wordsFor(token)`:
  - only for `/^[A-Za-z0-9_-]{27}$/`, the exact output of `randomBytes(20).toString('base64url')` (api/crew.js:54); otherwise null, so legacy-shaped tokens get no words;
  - it takes the top 44 bits of the first 8 characters and splits them into four 11-bit indices;
  - I verified a 20,000-token round trip in scratch: every token is 27 characters, and all 20,000 matched.
- `parseWords(text)`:
  - case-free, splits on non-letters, accepts a unique 4-letter prefix, keeps the **last four** list words;
  - a leading non-list word becomes `hint` (the festival label);
  - three words or an unknown word gives `{problem}`, with a suggestion.
- Also `keyFromWords` → `{prefix7, top2}`, `matchesKey`, `festLabel(festId)` (the first segment of a catalogue id), and `parseOpenText(text)` → crew link | My link | words | bad.

**Server: new `api/crew-find.js`, POST only**
- It's a separate file, so a find can never fall into create (`POST && !token`, api/crew.js:35). It is the 8th function; check the Vercel plan's limit.
- Order of checks:
  - OPTIONS returns 204;
  - `crossSite` returns 403 (guard.mjs:22-26);
  - `rateLimited(req,'crew-find',60,3600000)` returns 429. It's a speed bump (guard.mjs:3-5); the 44 bits are the wall: about 112 years to any hit at 100 guesses a second against 50 crews.
  - The body is `{words, fest?}`. Never read the query.
  - A bad shape returns 400 with zero SQL.
- `FIND_SQL` lives in api/_lib/crew-sql.mjs (exact bytes tested in PGlite, like tests/db-merge.test.mjs):
  `SELECT token, doc->'meta'->>'inviteFestId' AS invite, <festival keys, guarded by jsonb_typeof> FROM crews WHERE length(token)=27 AND left(token,7)=$1`
- Filter with `matchesKey`. Exactly one match returns 200 `{token, fest}` with `Cache-Control: no-store`.
  - `fest` is the crew's festival whose id starts with `hint-`, else `invite`, else the first.
  - "None" and "ambiguous" return the identical 404.
- Never log the body.
- No schema change, no index (the table is tens of rows), no writes.

**Client**
- `crew.findCrew(text)`: a POST with an 8-second timeout, like `fetchCrew` (crew.js:216-218). Do not copy its `?t=`.
- **Landing door.** Under index.html:131-132, keep that line verbatim (pinned by tests/share-copy.test.mjs:44). Add an input `#landing-find` with:
  - placeholder "Type your crew's words, or paste a link";
  - `autocomplete=off autocapitalize=none autocorrect=off spellcheck=false enterkeyhint=go`;
  - an Open button and a status line, copied from the bad-link row (index.html:287-291).
- `wireLandingFind()` is called from `renderLanding` (app.js:4220). By kind:
  - **Crew link:** `history.replaceState(null,'', '#g=…&f=…&me=…')`, then `boot()`.
  - **My link:** call `restoreFromMeLink(token)` directly (app.js:4198). **Never write `#p=` into the address bar or history**, and clear the input afterwards.
  - **Words:** offline or Stay offline says "Words need signal — try again with a bar." Otherwise:
    - set `body.dataset.busy='crew-find'` so a new build can't reload mid-lookup (index.html:449);
    - on success, `replaceState(crew.crewLink(token, fest))`, then `boot()`, with no extra Back step;
    - on 404: "No crew has those words. Check them with whoever sent them.";
    - on 429: "Too many tries from here — wait a few minutes."
- The bad-link box (app.js:5124-5125) uses the same `parseOpenText`.

**Showing the words**
- **Invite sheet:** `inviteWordsRow()` before `inviteQr` gives the order words, QR, link.
  - Synchronous, offline, guests included (it's the same credential the guest already has).
  - The festival label in `--text-tertiary`, the words in `--text-primary`, `-webkit-user-select: text` (the WebKit-prefix law).
  - The line under them: "Or type these at fest.kevinhg.com", with the host from `fn-canonical-host`.
- **Settings:** the same row above the link box (settings.js:601-617). The text at 619-620 becomes "Anyone with this link or these words joins the crew. Your own link (My link) is on the home page."
- **Invite message:** `crew.inviteText(festName, words)` (crew.js:147-150) appends "Lost the link? Go to fest.kevinhg.com and type acl grape stool tiger wagon." It has three callers: app.js:2641, app.js:3684 and settings.js:164.
- **The link does not use the code.** The QR and the Copy box stay the token link: it opens offline, on friends' older builds, and with no lookup. The words ride beside it in every message.

**Scrubbing and usage**
- `secrets()` (app.js:46-57) adds every known crew's words, spaced, dashed and joined. All are at least 12 characters, so `knownSecrets` keeps them (errlog.js:167); the `TOKEN_RUN` rule (errlog.js:182) can't see words.
- `USAGE` gains `crew_find: { via: ['landing','badlink'], kind: ['words','link','my_link'], result: ['found','none','bad','offline','limited','error'] }`.
- APP_CORE gains `/js/crew-words.mjs`, then sw-stamp.

**New rule for AGENTS.md:** a crew token's **first 8 characters are now its key**. Never print a token prefix in docs, logs, Diagnostics, the LEDGER or commits. I grepped the docs and code: none exists today.

**Tests (red first)**
- `tests/crew-words.test.mjs`:
  - a round trip over 10,000 tokens;
  - the 27-character gate;
  - parse variants (caps, dashes, "acl" in front, 4-letter prefixes, rejecting 3 words or an unknown word);
  - list invariants and the frozen hash.
- `tests/db-find.test.mjs`: PGlite runs the exact `FIND_SQL` against fake crews, including a 20-character token that must never match and a doc with no festivals.
- `tests/crew-find-api.test.mjs`:
  - GET returns 405;
  - a query is ignored;
  - a bad shape makes zero SQL calls;
  - none and ambiguous give byte-identical 404s;
  - success has `no-store`;
  - 429 and 403 come before any SQL;
  - a console spy sees no body.
- A shell test: a pasted My link calls `restoreFromMeLink`, and `p=` never appears in any `history` call or hash write.
- share-copy: the new lines, and that no `track()`/`record()` is built from `#landing-find`.
- The order test: words, qr, link, name, others.
- The browser walk: the landing box at 320px with the keyboard up, and the sheet with all three rows.

**Real iPhone**
- Typing the words with autocorrect really off.
- An empty home-screen icon: type the words → board → tap your name.
- Messages search for "acl" finds the line.

**Laws touched**
- **Bent: "a crew token IS the credential."** The words are a second spelling of it, 44 bits instead of 160. This is Kevin's call (Part A, question 1).
- **Kept:**
  - **Token never in a path or query:** POST body only.
  - **Nobody sees people in circles they're not in:** one crew per set of words, no list, no search, one 404.
  - **Person token:** never involved.
  - **errlog.js:** secrets list and allowlist.
  - **Storage:** none new.
  - **The merge SQL and its exact-bytes test:** untouched.
  - **No Blob, no new table.**
  - **Production:** reads only. Staging and local hit the production DB (AGENTS.md), so this matters.

**Dials for later, not built:**
- an off switch per crew (`meta.words: 'off'`, through `validateMeta`, crew-shared.mjs:309-321);
- a `#w=` link form, stripped at boot the way `#p=` is (app.js:5267-5272);
- the settable runner-up from Part A.