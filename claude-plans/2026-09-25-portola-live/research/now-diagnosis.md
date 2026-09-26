# NOW diagnosis — is v89 actually right? (2026-09-25)

**Verdict: STALE BUILD — and the underlying feature is brand new. The NOW code on v89 is correct in every case tested (6 real-clock instants, two browser engines, zero bugs found). The most likely reason Kevin never saw NOW during Portola week is timing, not a defect: NOW didn't exist in production until 12:04 AM PT last night (v87). If Kevin looked at his phone at any point before then — which covers most of "Portola week" so far — there was genuinely nothing to see, correctly. After that, his one open tab most likely kept running the OLD (pre-v87) app shell, the way this app is documented to do until a tab gets a real reload; the private tab worked because it's a fresh fetch with no old service worker attached to it.**

## 0. The story, in plain terms

- NOW (the tab, the line on the clock grid, the glowing "playing now" card, and tap-to-jump) shipped as v87, merged and confirmed live at **12:04–12:05 AM PT last night (early Fri Sep 25)**. Before that commit, none of it existed in the code at all — not a bug, just not built yet.
- v88 followed at 1:20 PM today, v89 at 2:50 PM today (both unrelated to NOW — notes-chip and error-reporting fixes).
- I loaded the exact v89 code from this worktree in a real headless browser (Chromium and WebKit), pinned the clock to six moments Kevin would plausibly have checked his phone, and drove the actual NOW tap. In every case the tab, the line, the lit card, and the jump did exactly what the spec says they should. I found no code bug.
- Production (`fest.kevinhg.com/service-worker.js`) is confirmed serving v89 right now, with cache headers (`max-age=0, must-revalidate`) that are about as update-friendly as they can be — so this isn't a deploy problem either.
- What's left is the well-documented failure mode this app already has a paragraph about in `CLAUDE.md`: **"the service worker will serve you a stale app while you are testing."** A tab that was already open before v87 shipped keeps running v86-or-earlier's JavaScript (no NOW code exists in memory) until something makes it actually reload — and on iOS, that "something" is less reliable than on desktop. Kevin's own fix (a private tab) is exactly the workaround that always bypasses this, because a private tab has no old service worker to be stuck on.

---

## 1. The exact rule for "live" (from the code, not from memory)

Read from `claude-plans/2026-09-24-now-jump-build.md`, `js/v3/now.js`, and `js/v3/wall.js`.

- **The festival's own clock, not the phone's.** `js/v3/now.js` `festivalClock()` reads the wall-clock time in the festival's own timezone (`America/Los_Angeles` for Portola) via `Intl.DateTimeFormat`, never the device's local zone. A friend checking from Austin sees the line where the crew actually is.
- **The day rolls over at 5 AM, not midnight.** Anything before 5 AM counts as "still last night" (so a 1:15 AM Club Six set is still "Thursday night," and the calendar-day label used for lookups shifts back one day). This matches how festival nights actually work.
- **NOW tab (`#dock-now` / `#rail-now`) shows only when something is live on the wall right now** (`js/v3/app.js` `paintNowTabs`, reading `wall.js nowLanding`). "The wall" here means the whole rendered page for the open festival (all of Thu/Fri/Sat/Sun for Portola render as one continuous scroll with day tabs as anchors — this is NOT per-tab; NOW can be true even if you're scrolled to a different day than the live one).
- **A grid day (Saturday, Sunday — the only two Portola actually publishes a stage clock for) gets a NOW LINE** drawn across its timetable, active only while the clock falls inside that grid's own printed hours (`onGrid` check in `wall.js liveOnWall`). Before doors or after the grid closes, the line does not show for that grid.
- **Everything else (Thu/Fri afters, Folsom, and Sat/Sun's own afters+Folsom sections) is a stack of cards, not a clock**, per MODEL-V4's one rule ("stage columns only where the festival publishes a stage grid"). A stack card gets a glowing **`.card.now`** ring/class when the current time falls inside that specific show's computed window: its own printed start until the next act in that room starts, or its own printed end, or the room's close time, or +60 minutes — whichever is known first. A room that gives only doors+close (no set times at all) glows the whole room for that window; a room with SOME timed acts and one untimed one gives the untimed one no window at all (it's "on the bill, time unknown," never lit) — this is the exact untimed-act fix from 2026-09-24 for Sunday's Midway (S.I.M / Espurr / New Nostalgia).
- **Tap NOW → lands on:** the best pick if you've highlighted a person (their highest-level live pick, ties broken by whichever started most recently); otherwise the now line (a third of the way down what you can see) while a grid is open, or the first live card in wall order once the grid's closed for the night. A second tap cycles down to the next live thing, then wraps.
- **A cancelled act (Skepta) is never "now."**

None of this is exotic — it's a well-specified, well-tested feature (807 unit tests, 148 browser tests, two independent review rounds per the build log). The question was purely "does the SHIPPED build actually do this," which is what I went and checked.

---

## 2. Every event window, Thu Sep 24 – Mon Sep 28 2026 (America/Los_Angeles), from `data/festivals/portola-2026.json`

Portola's grid only exists for **Saturday** and **Sunday**. Thursday and Friday have no stage grid at all — they're pure afters stacks. The app synthesizes 4 day tabs in this order: **Thu, Fri, Sat, Sun** (Thu/Fri borrow their calendar dates from Saturday's `dayMeta`).

| Section | Night | Venues (rooms) | Time shape |
|---|---|---|---|
| Saturday grid | Sat Sep 26 | Pier Stage, Crane Stage, Warehouse, Ship Tent, Despacio | Sets from **1:30 PM to ~11:00 PM** |
| Sunday grid | Sun Sep 27 | same 5 stages | Sets from **1:30 PM to ~11:00 PM** |
| Afters | Thu Sep 24 | Club Six, Regency Ballroom | Regency 7 PM–12 AM (Soulwax etc.); Club Six 10 PM–4 AM |
| Afters + Folsom | Fri Sep 25 | 1015 Folsom, 888 Garage, DNA Lounge (Folsom), GAMH, Monarch, **Pier 80 (Despacio, explicit 5 PM–11 PM)**, Public Works (+ Folsom), Regency, Great Northern, Midway | Rooms open 7 PM–10 PM, run to 12 AM–2 AM; Despacio is the one exact all-afternoon window |
| Afters + Folsom | Sat Sep 26 | 888 Garage, Audio, Monarch, Public Works, Regency, SVN West (Folsom — Magnitude, Sep 26 9 PM–4 AM), Great Northern, Midway (Folsom — PERVERT XXL, 10 PM–6 AM) | Rooms open 9–10 PM, run to 2–4 AM |
| Afters + Folsom | Sun Sep 27 | 1015 Folsom (Real Bad 37, 8 PM–5 AM), 888 Garage, Audio, **Folsom Street Fair itself (11 AM–6 PM, daytime)**, Monarch, Public Works, Rickshaw Stop, SF Eagle, SVN West, Great Northern, **Midway (3 untimed acts: S.I.M, Espurr, New Nostalgia)** | Rooms open 7–10 PM, run to 2–5 AM; the Fair itself is the one DAYTIME item in the whole dataset |
| — | Mon Sep 28 | *(nothing — the data ends Sunday night/Monday early AM. No Monday content exists to be "live.")* | — |

### What NOW should show at each requested instant (hand-computed, then confirmed in a browser — see §3)

| Instant | Grid open? | Live right now | Expected: NOW tab / line / lit card |
|---|---|---|---|
| **Fri 2:00 PM** | no (Fri has no grid) | Nothing — earliest Friday item (Despacio) doesn't start until 5 PM | **No NOW tab at all.** Correct — nothing is on. |
| **Fri 6:00 PM** | no | Despacio only (Pier 80, 5–11 PM) | NOW tab, 1 lit card (Despacio), no line (Friday has no grid) |
| **Fri 10:00 PM** | no | 7 rooms live: Despacio, 1015 Folsom (Rory Phillips), GAMH (B0yg1rl), Public Works (Horse Meat Disco), DNA Lounge (BRUT SF), Regency (Jyoty) | NOW tab, several lit cards, tap cycles through stops |
| **Fri 11:30 PM** | no | 10 rooms live (nearly everything Friday has) | NOW tab, many lit cards |
| **Sat 3:00 PM** | **yes** (1:30 PM–11 PM) | Grid: Gelli Haha (Pier), erika b2b sfcowboy (Crane), plus Warehouse/Ship Tent/Despacio-stage acts. No afters yet (they don't open till evening). | NOW tab **+ now line** across the Saturday grid, several lit grid cells, no afters cards yet |
| **Sat 9:30 PM** | **yes** | Grid: Dog Blood (Pier), a changeover gap on Crane (Fatboy Slim just ended ~9:25, Soulwax not till 9:55), Warehouse/Ship Tent/Despacio-stage acts. Afters: Velvet Trip (Regency, started 9:15) and Magnitude (SVN West/Folsom, started 9 PM) have just opened. | NOW tab, now line, grid cells lit **and** 2 afters cards lit — a genuinely busy, multi-stop moment |

---

## 3. Real-browser reproduction against v89 (this worktree's code)

Ran a Playwright script against the exact code in this worktree (`.claude/worktrees/portola-live`), served locally, following the same pattern as `tests/browser/now-jump.test.mjs`:

- **No production data touched.** Every `/api/*` route was intercepted and stubbed locally (a made-up crew token, `nowdiagcontract_…`, never a real link); nothing left the page.
- Clock pinned per-instant with Playwright's `page.clock.setFixedTime(...)`, iPhone-sized viewport (390×844, touch enabled).
- Ran the full 6-instant matrix in **Chromium**, then cross-checked the two most interesting instants (Fri 6 PM, Sat 9:30 PM) in **WebKit** (Safari's engine — installed and available). WebKit matched Chromium exactly on both.
- One browser process at a time, closed when done, per the ground rules.

**Result: 6/6 instants matched the hand-computed table above exactly, no console errors, no mismatches.** Screenshots (before tap + after tap) for all 6 in Chromium, plus 2 WebKit confirmations, are in `now-shots/`:

```
chromium-fri-2pm-before.png
chromium-fri-6pm-before.png / -after-tap.png
chromium-fri-10pm-before.png / -after-tap.png
chromium-fri-1130pm-before.png / -after-tap.png
chromium-sat-3pm-before.png / -after-tap.png
chromium-sat-930pm-before.png / -after-tap.png
webkit-fri-6pm-before.png / -after-tap.png
webkit-sat-930pm-before.png / -after-tap.png
```

Highlights, read straight off the DOM (not eyeballed):

- **Fri 2 PM**: `dock-now` hidden, zero now-lines, zero lit cards. Correct — nothing is on.
- **Fri 6 PM**: `dock-now` visible, exactly 1 lit card (Despacio). Tap → scrolled to it, screen-reader status said *"Playing now: Despacio at Pier 80 (loyalty invite)."* Screenshot confirms Despacio's card wears the purple highlight ring.
- **Fri 10 PM**: 7 lit cards (Despacio, Jyoty, B0yg1rl, Horse Meat Disco ×2 rooms, Rory Phillips, BRUT SF). Tap → status names the first 4 and says "1 of 3" (3 stops).
- **Fri 11:30 PM**: 10 lit cards. Tap → status covers Channel Tres, Horse Meat Disco, Six Sex, "1 of 3."
- **Sat 3 PM**: now-line present (`data-iso: 2026-09-26`), visible; tap status: *"Now, 3:00 PM. Playing now: Gelli Haha at Pier Stage, erika b2b sfcowboy at Crane Stage, Ranger Trucco b2b Alisha at Warehouse, MGNA Crrrta at Ship Tent and Despacio at Despacio."* Screenshot shows the grid rendered correctly with the day-of landing already in place.
- **Sat 9:30 PM**: now-line present, exactly 2 stack cards lit (Velvet Trip, Magnitude) — matching the hand calc that Crane Stage is between sets. The screenshot is the clearest single piece of evidence in this whole diagnosis: the violet now-line crosses the grid at "9:30 PM," Dog Blood's card (struck by the line) is bold/lit, and below it the Sat Afters section shows Velvet Trip glowing with the purple ring. **This is v89 working exactly as designed.**

No code fix is needed from this slice. (One unrelated, minor thing I noticed and am NOT chasing, since it's outside this slice: after the Fri 6 PM tap, the dock's active-day tab briefly still read "THU" while the visible content was clearly the "FRI AFTERS · SEP 25" section — looked like a scrollspy lag, not a NOW bug. Flagging for the other builder, not fixing here.)

---

## 4. The update path — how a phone finds out about a new build, and what to do today

Read from `index.html` (the inline script after `app.js`) and `service-worker.js`.

**How it's supposed to work while a tab is open:**

1. On every load, the page registers the service worker, then asks it to check for updates (`reg.update()`) whenever the tab becomes visible again, and on a 10-minute timer while it stays open.
2. If a newer worker installs, it takes over immediately (`skipWaiting()` + `clients.claim()`) — but the OLD worker's JavaScript is still what's actually running in that tab's memory (a page doesn't hot-swap its own already-loaded code).
3. The page notices the takeover (`controllerchange`) and reloads itself automatically — **but only if nothing is "in progress"** (no note being typed, no sheet or zoom open, no field focused). If something is in progress, it shows a persistent strip ("Updated behind the scenes — refresh to run the latest") and waits, re-checking on the next visibility change or every 15 seconds, until it's safe to reload on its own.
4. This exact design exists **because of a documented past incident** (2026-09-01, in `CLAUDE.md`): "a v75 shell judging v76 code" — Kevin reported something broken that had already been fixed, because his open tab was silently still running the old JS.

**The server side is not the problem right now.** I checked production directly (read-only, no writes): `fest.kevinhg.com/service-worker.js` is confirmed serving v89 this instant, and it's sent with `cache-control: public, max-age=0, must-revalidate` — the browser is required to check back with the server every single time, not cache it for a day. That's about as update-friendly as HTTP headers get.

**So what's the longest a phone could plausibly stay stale?** Honestly: **there's no hard ceiling I can promise, but in the ordinary case it should self-heal on the very next real reopen of the app** (a fresh app-icon tap or a fully-closed-then-reopened Safari tab is a real navigation, and with these headers the browser's own update check should catch it right away). What can defeat that in practice, and is the likely explanation here, is iOS-specific: Safari/WebKit has a documented history of being less reliable than desktop Chrome about firing `visibilitychange` and running service-worker update checks promptly for a backgrounded or suspended tab — especially a pinned/reused tab that never goes through a full "closed and reopened" cycle. That's consistent with everything Kevin reported: a normal tab stayed stuck, and a **private tab** — which always does a from-scratch fetch with zero prior service worker — worked immediately.

**What Kevin can do today, safely, on his phone:**

1. **First, just try force-quitting and reopening it** (swipe it away in the app switcher, or fully close the Safari tab, then reopen from the home-screen icon or a fresh tab). This is a real navigation and should pick up v89 given the headers above — most likely this alone fixes it now, over an hour after v89 shipped.
2. **If that doesn't do it, do NOT clear Safari's "Website Data" for this site** (Settings → Safari → Advanced → Website Data, or "Clear History and Website Data"). That wipes `localStorage` for the site — and **that's exactly where his person token lives** (his identity inside his crew, per `CLAUDE.md`'s "the person token is a master key"). Clearing it would silently sign him out of his crew; he'd need his crew's invite link again to get back in. It would NOT delete anything from the shared crew doc (that's server-side, in Neon), but it would forget who he is on that device.
3. **The private-tab route he already found always works**, precisely because it starts with nothing cached — but it's a throwaway per-session workaround (a fresh private tab each time, no memory of who he is), not something to live in day-to-day.
4. If step 1 genuinely doesn't fix it (a real stuck registration, not just staleness), the safe next step is Settings → Diagnostics (see §5) to confirm what build his phone is actually reporting, before anything more drastic.

**A small in-app "get the latest version" control (5 lines):**

1. **Where:** Settings → App section, as a new row right beside "Diagnostics" — e.g. "Check for the latest version."
2. **What it does on tap:** ask the already-registered service worker to check right now (`registration.update()`), instead of waiting for the 10-minute timer or the next visibility change.
3. **What it does NOT do:** touch `localStorage` at all — no identity, no picks, no settings are touched. It only asks for new code.
4. **If a newer build is found:** let the existing safe-reload logic handle it exactly as it already does today (wait until nothing's in progress, then reload; otherwise show the same persistent strip) — this control doesn't need its own reload path, just an on-demand trigger for the check.
5. **If nothing's new:** say so briefly ("You're on the latest already") so the tap isn't a silent no-op — that feedback is the whole value of the button over just waiting.

---

## 5. Where the build line already shows today

Settings → App → **"Diagnostics."** Tapping it copies a JSON block to the clipboard (not shown on screen) — Kevin has to paste it somewhere (Notes, a text message) to read it. The relevant field is `build`, e.g. `"festival-nav-v89"` — read from the names of whatever's in the browser's Cache Storage right now (`js/errlog.js` `diagnostics()`). It also carries viewport size, whether reduced-motion/low-power are on, and the last 20 recorded errors — never anything private (no crew link, no note text).

One caveat worth knowing: this reads *what's cached*, which in the narrow window right after a new worker takes over could be one step ahead of what's *actually executing* in an already-open tab (the same "v75 shell, v76 code" gap `CLAUDE.md` describes) — but it will never be *behind*, so if Diagnostics ever says v89, the tab really has the current code.
