# Native apps: the stack, and a path (2026-09-29)

Kevin asked: if the festival app goes to the App Store (and Play), what
should it be built with, which agent should drive it (Codex's computer use vs
Claude's iOS Simulator), and can one codebase ship iOS and Android at once?
This is research and a recommendation, not a build. Nothing here touches the
live lane. ACL runs through Oct 11, so the earliest start is after that, and
the realistic target is the 2027 season.

## The short answer

- **Stack: Capacitor around the web app we already have.** One codebase ships
  web, iOS and Android. Add a few truly native pieces (alerts before a set
  starts, a Live Activity, a widget), because those are what the web can't do
  and what Apple's review wants to see.
- **Don't rewrite in React Native, Expo or Flutter.** Each one means
  rebuilding ~28k lines of hand-tuned vanilla JS and CSS: the zoom, the
  modality rules in card-facts.js, the strip that follows the scroll timeline,
  and the motion. Most of that polish came out of fixing WebKit bugs, and
  inside Capacitor it keeps working, because an iOS Capacitor app IS WebKit
  (WKWebView, the same engine as Safari).
- **Agents: this is mostly code and command-line work, so the agent choice
  isn't what decides the stack.** Run Claude Code on the Mac for the build
  loop (the Simulator pane plus Xcode's agent bridge). Use computer use,
  Codex's or Claude's, for the few GUI-only steps and for walks on a real
  iPhone through iPhone Mirroring.

## What the options really are

| | Keeps our code? | Android too? | Fit for this app |
|---|---|---|---|
| **Capacitor** (Ionic) | Yes, all of it, running in the system WebView | Yes, same project | **Best.** Built for exactly this case: an existing web app plus native plugins. |
| Tauri 2 mobile | Yes (WebView) | Yes | Same idea, less mature on mobile and fewer plugins. The fallback if Capacitor disappoints. |
| Expo / React Native | No. It's React; "DOM components" can embed web views, but only React components | Yes | Full rewrite into React Native views. Good for new apps, wrong for this one. |
| Flutter (Google) | No. It's Dart with its own renderer | Yes | Full rewrite in a new language, and it draws its own pixels, so none of the WebKit or CSS work carries over. |
| Native Swift (+ Skip for Android) | No | Via Skip or a second app | The most native feel, and the most work by far. |

On "Google's build once, ship everywhere": that's **Flutter**, which Google
built itself (the purchase was Firebase, a backend). Flutter's promise is to
write the app once *in Dart*, not to reuse a web app. For a codebase that
already exists as a web app, Capacitor is the tool that actually delivers
"build once."

## Why Capacitor fits this particular codebase

- **iOS is the same WebKit.** Every WebKit rule in CLAUDE.md (the
  `-webkit-user-select` prefix, the mouse-typed finger clicks and ghost mouse
  events, `ScrollTimeline` from iOS 26) applies unchanged. Android's WebView
  is Chromium, which the Chrome runs already cover.
- **Offline gets better.** The app shell ships inside the binary, so there's
  no service worker to go stale and no stale-shell bug of the "hover is broken
  again" kind. Only festival data needs caching.
- **One source of truth.** The web app stays the product. The native shell
  is a thin layer, and the test suites and gallery keep working.

## The native pieces that earn the App Store listing

Apple's guideline 4.2 ("minimum functionality") rejects apps that are just a
website in a wrapper. Reviewers enforce it harder than they used to. What
gets an app through is doing things only an app can do. For us, these are
also the best features the web can't have:

1. **A heads-up before your set**: "Robyn in 15 min · Main stage · 3 of your
   crew." These are *local* notifications, scheduled on the phone from your
   picks. They need no server and **work with no signal**, which is the whole
   premise of the app. A PWA could use Web Push instead, but that needs a
   server, the app on the home screen, and a connection at the moment the
   alert is due.
2. **A Live Activity on the Lock Screen and Dynamic Island**: now playing,
   and what's next in your plan. This one needs a small SwiftUI widget
   extension, a few hundred lines of Swift. It's also where Claude's
   Simulator pane and the Xcode bridge pay off.
3. **A home-screen widget**: your next pick, and where the crew is headed.
4. Haptics on a pick, the native share sheet, and Universal Links, so a crew
   link opens the app.

Android equivalents: notifications (easy), a Glance widget (moderate), and
Android 16's Live Updates in place of a Live Activity (later).

## What the port actually changes (from reading the code)

- **API origin.** About 20 `fetch('/api/…')` call sites, plus errlog's
  `REPORT_PATH = '/fn-i/batch'` and the `/data/festivals/*.json` loads, all
  assume the page is served from our own host. Bundled in Capacitor, the page
  is served from `capacitor://localhost`. Plan: one `apiBase()` helper, plus
  CORS on `api/*.js` for the app's origins (or Capacitor's native HTTP).
- **Festival data.** The service worker's network-first-with-a-4s-budget
  rule doesn't run in the shell. The same rule has to move into JS for native
  builds, with a copy of the data bundled for the first cold start in a field.
- **Crew links.** The `#g=<token>` links become Universal Links
  (`apple-app-site-association` served from fest.kevinhg.com) and Android
  App Links (`assetlinks.json`). The token stays in the fragment, as today.
- **The person token** (`fn_person_v1`, the master key) belongs in the
  Keychain or Android Keystore, not WebView localStorage, which iOS can evict.
  This is a real security upgrade, not just a port task.
- **Spotify.** The PKCE redirect currently lands on `spotify-callback.html`.
  In the app, sign-in has to go through the system auth sheet
  (ASWebAuthenticationSession) and come back on a registered app redirect URI.
- **Updates.** The rule "a new build reloads an open tab only when nothing is
  in progress" needs a native counterpart. Either every web change ships
  through App Store review, or we use live updates (Capgo, Appflow or
  self-hosted) that swap the bundled web code between launches. Apple allows
  this for web code as long as the app's purpose doesn't change. We decide
  this before building, because it shapes the release flow in the LEDGER.
- **errlog.** Add the platform and the native build to the `$exception`
  fields. The scrubber still applies to everything that leaves.

## Agents: who does what

- **Xcode is needed either way** (on a Mac, or on a cloud macOS runner) to
  sign and build for iOS. Nobody has to work *in* Xcode's window, though:
  both Claude Code and Codex drive `xcodebuild` and `simctl` from the
  terminal. Since Xcode 26.3 (Feb 2026), Xcode also runs as an MCP server
  that both agents can connect to for builds, previews and docs.
- **Claude Code desktop's iOS Simulator pane** (beta since 2026-07-21, Pro,
  Max and Team): the simulator streams next to the chat, and Claude taps
  around in it and iterates without needing computer-use permissions. It
  works for any app the simulator runs, a Capacitor app included. **It only
  works in local Mac sessions**, not in cloud sessions like this one.
- **Computer use.** Codex's has been in use longer (your iPhone Mirroring
  Shortcuts setup). Claude Code desktop added its own on 2026-09-03 and can
  run it in the background on a Mac since then. Either one covers the
  GUI-only steps: the first Signing & Capabilities setup, App Store Connect
  and Play Console forms, and real-device walks. One caution: this app cares
  *how* a press arrives (`clickHand`, pointerType). Taps sent through iPhone
  Mirroring aren't guaranteed to arrive the way a finger does, so walks that
  test modality stay on the real phone, in Kevin's hand.
- **Cloud sessions keep working.** A GitHub Actions macOS runner (or Xcode
  Cloud, whose hours come with the developer membership) running fastlane
  can build and upload to TestFlight and Play on merge. Web and Capacitor
  changes can still come from cloud sessions; the Mac is needed only for the
  Swift extensions and on-device testing.

## Accounts and clocks

- Apple Developer Program: $99/yr. TestFlight builds are usually processed
  in under a day.
- Google Play: $25 once. **A personal account made after Nov 2023 must run a
  closed test with 12+ testers for 14 continuous days before production.**
  The crew is the tester pool, and the clock is why Android should start in
  parallel with iOS, not after it.

## A path

0. **Now through Oct 11:** nothing. The live lane comes first.
1. **Spike (a day or two, on the Mac):** a Capacitor shell with the web app
   bundled, `apiBase()`, running in the Simulator pane and on the phone.
   Walk the wall with a real finger. Decide the live-update question here.
2. **MVP (1–2 weeks):** Universal and App Links, set alerts (local
   notifications), the Keychain for the person token, Spotify through the
   auth sheet, haptics, and CI to TestFlight. Start the Play closed test
   with the crew the same week.
3. **Earn the listing (about a week):** the Live Activity (SwiftUI) and the
   iOS widget. Android notifications first, the widget after.
4. **Submit both stores** well ahead of the first 2027 festival.
   Store screenshots come from gallery.html states.

## Decisions (Kevin, 2026-09-29) and the Thursday runbook

Kevin: TestFlight (and Android's equivalent) only, this year. Live updates
yes, unless they turn into a huge pain. First native piece: "a live tile
mirroring our footer that opens to our plan". Target: a Mac session on
**Thursday Oct 1**, the day before ACL, using Claude.

**Bundled app plus our own live updates. Loading the live site is out.**
Loading fest.kevinhg.com in the shell (`server.url`) would get us live
updates for free, but on iOS the service worker and Capacitor's plugins
don't work together there (ionic-team/capacitor #5278, #7069; App-Bound
Domains break plugin injection). So the app would lose offline, or lose
the tile. Instead the web code ships inside the app, and a self-hosted
updater (`@capgo/capacitor-updater` in manual mode, open source) checks a
version file on our host at launch, downloads the new bundle in the
background, and switches to it on the next cold start. That's never
mid-use, the same rule as the web: a new build reloads only when nothing is
in progress. Cost $0. A bundle is built from a branch, so **none of this
touches production during ACL**; the web-side changes merge through the
normal gate afterwards.

**The tile is a widget first, with a Live Activity after.** The footer's
peek (`peekOf(plan, fest, date)`, plan.js) is a pure function of the clock.
So JS can compute tonight's whole run of peeks ahead of time (NOW Robyn
till 9:40, then NEXT …) and give that list to a WidgetKit timeline. iOS
then flips the Lock Screen and Home Screen widget on schedule, with no
signal and without the app running. Tapping it opens the plan
(`openPlan`). A Live Activity (Dynamic Island) can't advance on its own
without server pushes, and it ends after 8 hours, so it comes second: a
countdown to the next stop, refreshed whenever the app is opened. Android
widget (Glance): later.

**Buy me a coffee:** unchanged. The link opens buymeacoffee.com in the
system browser, whose checkout handles payment. US apps may currently link
out to purchases with no Apple commission (Epic v. Apple; the Supreme
Court has the appeal, so revisit before an App Store listing). No in-app
purchase this year.

**Store art:** TestFlight needs no screenshots. This year the "ad" is a
sticker with the public TestFlight link as a QR code, for the crew.
Screenshots and stickers made from gallery.html states come before a 2027
listing.

**Before Thursday (Kevin)** — status as of Tue Sep 29, 2026, 7:30 PM CT:
- Apple Developer Program: **done.** Approved Sep 29 (welcome mail 7:32 AM
  PT), enrolled as an Individual, Team ID 63P283TPFT, renews Sep 29, 2027.
  The Apple ID is Kevin's gmail one.
- Play Console: **identity verified** Sep 29 (1:49 AM CT), on Kevin's
  trimm.co Google account, so the two stores sit on different identities.
  Still to confirm in the console: the contact phone and the Android-device
  check. Fallback stays a signed APK sent straight to Android friends.
- Xcode 26 plus the iOS simulator runtime, and Android Studio: **not
  installed** on the Mac this was checked from, which had 9.5 GB free.
  Xcode and one simulator runtime want roughly 20–30 GB with room to build
  ([Bitrise's Xcode 26 size notes](https://bitrise.io/blog/post/xcode-app-size-reduction-in-26-0-beta-5)),
  so Thursday runs on a Mac with that much free.
- Turn on Developer Mode on the iPhone (it appears after the phone is
  first connected to Xcode): not yet.
- Pull the app ideas from Apple Notes: not yet.

**Prep a cloud session can do before Thursday (this branch, no prod):**
1. `apiBase()` for the ~20 `/api` calls, `REPORT_PATH`, and the festival
   JSON loads; native HTTP (CapacitorHttp) so the API needs no CORS change.
2. Native offline: skip service-worker registration inside the app; the
   festival data comes from the network (4s budget), then the last good
   copy, then the bundled copy.
3. `peekTimeline(plan, fest, from, hours)`: the widget's entries, each with
   its moment, tag, name, place, time words and count. Tested in Node
   against the real Portola and ACL files.
4. The bridge (inert on the web): after each plan paint, hand the
   timeline to the widget's App Group.
5. A script that zips the web bundle and writes the updater's version file.

**Thursday on the Mac (Claude Code desktop, Simulator pane):**
`npx cap add ios android`, the app icon and launch screen, the widget
extension (SwiftUI, the footer's look from v3-tokens.css) plus the App
Group, the small Swift plugin that receives the timeline, the updater, a
walk in the Simulator and then on the phone with a real finger, archive,
TestFlight. Friends: TestFlight internal testers (App Store Connect users,
up to 100, no review) are available the same day. The public link needs a
Beta App Review of the first build, typically about a day, so ACL weekend 1
is tight for it. Android: a debug-signed APK Thursday; Play internal
testing once the account clears.

## Open calls for Kevin

- **The widget itself** (2026-09-29, after this plan): Kevin is not convinced about a widget. Talk it through before building any of the Lock Screen / Home Screen / Live Activity pieces; the Capacitor shell and TestFlight come first either way.

- The bundle ID (permanent once registered): `com.kevinhg.festival`? And the
  home-screen name: "Festival" (manifest short_name) or "Festival Navigator"?

- Whether alerts are opt-in per pick, or on for musts only.
