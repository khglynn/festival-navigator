# The mark and the link preview

*2026-08-30 · notes-desktop-round · design lead: link-preview teammate*

## The problem, stated once

Kevin pasted a crew link into iMessage and got a grey card: "Festival
Navigator / fest.kevinhg.com" next to the OLD static green-grid favicon —
a mark this app stopped wearing when the v3 design landed. Two separate
failures wearing one costume:

1. **The static icons are stale.** `favicon.png`, `icon-192.png`,
   `icon-512.png` are the pre-v3 green grid. The living favicon
   (`js/v3/favicon.js`) paints the real mark — a violet→pink gradient
   square that breathes with the fest accent — but only in a Chrome/FF/Edge
   TAB. Safari tabs, the installed PWA icon, and every link-preview
   crawler read the static PNGs. So the app's actual identity has been
   invisible everywhere that matters for sharing.
2. **`index.html` carries no Open Graph tags at all.** No `og:title`,
   no `og:image`, no `twitter:card`. iMessage and Slack fall back to
   `<title>` + domain + favicon, which is exactly the grey card.

## What gets built

- `assets/mark.svg` — the living favicon made permanent, one file.
- `scripts/brand-assets.mjs` — renders every raster from that one source.
- `assets/og/<fest-id>.jpg` (1200×630, one per fest) + `default.jpg`.
- OG/Twitter meta in `index.html` (default) and `api/share.js` (per fest).

## Design decisions

### 1. The mark is one artist card that the crew has picked

The living favicon is a rounded square, ~22% radius, linear gradient
`#8B5CF6 → #F472B6`. That is the identity and it does not change.

The signature detail the brief asked for — something that says "aura /
crew" without becoming a logo-with-a-glyph — is the **aura itself**. Not
a new invention: `js/v3/aura.js` paints a card by stacking
`radial-gradient(130% 130% at <anchor>, color 0%, color·0.5 45%,
transparent 78%)` layers, one per person who picked it, anchored at four
fixed off-corner positions (`20% 120%`, `85% -20%`, `-15% 30%`,
`115% 70%`). Two people's washes overlapping on one surface IS the crew
idea, drawn.

So the mark is a card the crew has picked: the gradient square, plus aura
washes at real anchor positions. It survives at 16px (what you see is the
gradient square — the favicon we already have) and rewards you at 512px
(the blooms, the depth). No glyph, no letterform, nothing to explain.

**What actually shipped, after rendering the alternatives and looking**
(the first pass was wrong and the renders said so): three washes, not two.
Two washes in the same value family as the base did nothing visible — at
low alpha they vanished, and at .5+ they flattened the square to a pale
lavender that had stopped being the living favicon. What works is
**counter-flow**: deep violet `#8B5CF6` pushed in from the right, bright
violet `#C084FC` from the left. That sculpts the square — it reads as a
lit object rather than a flat CSS ramp — while leaving the violet→pink
identity exactly where it was.

The third wash is the crew idea, and it is the one thing here a person
could argue with: **the first crew member's colour** (`hslOf(0)`, the
coral at the top of the 24-colour board) at alpha .22, arriving from the
bottom-left corner — the way somebody else's pick arrives on a card you
already picked. It is a whisper; it warms the bottom-left and nothing
else. Tried at .40 and the corner goes muddy-brown. Tried the board's
blue instead and the square reads cool and off-brand. One constant in
`scripts/brand-assets.mjs` (`MARK_WASHES`) removes it if Kevin would
rather the mark stay strictly violet→pink.

**And no grain on the icons.** The plan above assumed grain; the renders
argued it down. The living favicon draws none — it is a clean gradient
square — grain is a card/hero *finish* the app itself drops in low-power
and reduced-motion, and at 48px it is dither, not texture. It also costs
5x: a 512 icon is 87 KB clean and 465 KB grained, downloaded on every PWA
install. Grain stays where it belongs: on the link previews, which are
card surfaces.

### 2. Two icons, not one, because a maskable icon is a different shape

`manifest.json` currently points `icon-512.png` at BOTH `purpose: "any"`
and `purpose: "maskable"`. That is wrong in a quiet way: Android masks a
maskable icon to a circle/squircle and clips everything outside a 40%
safe radius, so a rounded square declared maskable gets its corners — the
one shape decision in the mark — thrown away, and the aura anchored at
`85% -20%` is clipped off entirely.

So: `icon-512.png` keeps the rounded mark for `any`, and
`icon-maskable-512.png` is a **full-bleed** variant — no corner radius,
the aura pulled inward so it still reads inside the safe zone. Two files,
each honest about the shape it will be shown in.

### 3. The link previews are JPEG, not PNG — a format decision, not a compromise

Planned as PNG. Measured, and changed: a 1200×630 card with the app's
grain on it is **1.6 MB as a PNG and ~130 KB as a q88 JPEG**. Per-pixel
noise is the one thing PNG cannot compress, and the fix is not to drop
the grain — on a gradient this wide the grain is doing real work as
**dither** (an 8-bit PNG of a 1200px violet ramp bands, and chat clients
re-encode it anyway). Tried the cheap outs first: coarser turbulence
(1.0 MB), monochrome noise (1.1 MB), discrete-quantised alpha (1.0 MB).
None of them get near.

So the previews ship as `assets/og/<fest-id>.jpg` (+ `default.jpg`), with
`og:image:type` `image/jpeg`. Every OG image on the web is a JPEG for
exactly this reason. It also clears WhatsApp's ~300 KB preview-fetch
ceiling with room to spare — `tests/brand-assets.test.mjs` asserts that
cap so a future format change cannot quietly reintroduce a 1.6 MB card.

The icons stay PNG: they are small, lossless matters for a mark, and
without grain a 512 is 87 KB.

### 4. The link preview is one card from the wall, blown up to poster size

A festival's OG image is the same object as the mark, at 1200×630:
`--card-unpicked` (#1C1731) as the ground, three aura washes at the app's
real anchors, grain over the top, and the festival's name on it in the
display face.

- **The name is the hero**, in Anton, in the fest's own accent, with the
  superscript year mark the app's header already draws (`.yr`, .45em,
  opacity .7). This is `js/v3/app.js`'s festival title, at poster scale.
- **The wash is the fest accent plus a brand-violet layer.** The accent
  gives every fest its own colour in a chat thread — Lost Lands green,
  Portola sky, ACL yellow, EDC pink — which is the whole point Kevin
  raised. The violet layer underneath is what keeps a row of them one
  family.
  - *On the four-places rule:* CLAUDE.md reserves `--fest` for the fest
    name, the active day tab, stage headers, and the Settings
    current-fest border. That rule is about **app chrome** — about not
    letting a festival's colour creep onto controls that belong to the
    app. An OG image is not chrome; it is that festival's poster, and the
    name is still the only *typographic* use of the accent. Flagging it
    rather than burying it: if Kevin reads the rule as covering every
    surface, the fix is one constant in `scripts/brand-assets.mjs`.
- **The sub-line is `<LOCATION> · <MONTH> <YEAR>`, derived from
  `location` + `startsOn`**, not from the `dates` string. `dates` is
  free prose written for a human reading the board — Lost Lands' runs to
  two clauses about an Early Arrival pre-party, Electric Forest's is
  `"Jun 25, Jun 26, Jun 27, Jun 28"`. None of that survives at poster
  scale, and truncating prose at a `(` is the kind of rule that silently
  produces garbage on the twelfth festival. `startsOn` is an ISO date the
  validator already enforces, so the derived line is uniform and can't be
  wrong.
- **The promise line is the app's own**, lifted verbatim from the landing
  screen in `index.html`: *"Pick artists with your people. Works with no
  signal."* No new copy was written for this work.
- **The signature detail:** the who-corner. `aura.js`'s `whoCorner()`
  draws 4px ticks for picks and lettered pills for musts in the
  bottom-right of every card. The OG card carries a row of ticks in real
  crew-palette colours, bottom-right, where they live. Abstract if you've
  never used the app; unmistakable if you have. No letters — lettered
  pills would mean inventing people.
  *(Retired 2026-09-01 at Kevin's call — on a 1200×630 preview the ticks
  read as stray coloured chips, not as a crew. The previews now end on the
  promise line; `brand-assets.mjs` no longer draws them.)*
- **`default.jpg`** mirrors the landing screen instead: FESTIVAL /
  NAVIGATOR stacked, NAVIGATOR in the pulse gradient, on a violet/pink
  aura. Same object, no festival. It drops the small corner mark the fest
  cards carry — repeating the mark beside a 100px FESTIVAL / NAVIGATOR
  wordmark read as a stray swatch. Everything else sits on the fest
  cards' exact baselines, so all twelve are one family.

### 5. The festival is IN THE PATH at /f/<id>, and the crew token never is

A fest-scoped link is `https://fest.kevinhg.com/f/portola-2026#g=<token>&f=portola-2026`.
A crew-wide link with no festival keeps the plain `/#g=<token>` shape.

**The festival is in the path because a person reads it there.** Kevin's
complaint was about how links look in chats, and the eye stops at the
first `#`: `fest.kevinhg.com/f/lost-lands-2026` says what the link opens
before the token noise begins. A query (`/s?f=…`) routes identically and
reads like machinery.

**The `/s` is load-bearing, and the first cut got it wrong.** That cut
rewrote `/` to the function when a query `f` was present. It passed a
local harness and shipped; on a live preview `GET /?f=portola-2026`
returned 200 with `x-vercel-cache: HIT` and the DEFAULT OG block — the
CDN answered from index.html and the function was never invoked. Vercel
says so plainly in its own `vercel.json` reference:

> The `source` property should **NOT** be a file because precedence is
> given to the filesystem prior to rewrites being applied. Instead, you
> should rename your static file or Vercel Function.

The filesystem is consulted BEFORE rewrites, so a rewrite on `/` can
never fire while an index.html exists. Nothing sits at `/f`, so the
rewrite owns it — and **nothing may ever be created there**: an `f`
file or an `f/` directory would silently take every `/f/<anything>` back
from the function. The shadow test checks the static prefix for exactly
that, and fails with `/f/:id <- f`.

Moving off `/` also let the `has: [{query: f}]` matcher go, which is a
second quiet landmine — the same page notes that `has` "does not yet
work locally while using `vercel dev`, but does work when deployed",
i.e. it fails in the opposite direction from this bug.

Two rewrites, not one: `/f/:id` → `/api/share?f=:id` carries the
festival (the `:param` syntax and the destination interpolation are both
in the reference — `/resize/:width/:height`, `/proxy/:match*` →
`https://example.com/:match*`), and a bare `/f` → `/api/share` catches a
link a chat app truncated, so it redirects home instead of dead-ending
on a 404. `trailingSlash: false` folds `/f/` into `/f` with a 308 before
routing, so that shape is covered too.

*The lesson worth keeping past this branch: a harness that mimics one
routing RULE without mimicking the routing ORDER will pass a config that
can never work. The harness now checks the filesystem first and
reproduces the live failure exactly, and two tests encode the rule (see
below) — the general one fails with `/ <- index.html`.*

The id ALSO stays in the hash, and that copy is load-bearing rather than
decorative. An unknown or truncated `/f/<id>` redirects to `/`, and the
fragment is then the only thing left naming the festival — so dropping
the hash copy for a tidier URL would quietly break the fallback it is
there to serve. It is also what the running app reads
(`crew.festFromHash()`), so the boot path is untouched by any of this.

The `#g=` token stays hash-only. CLAUDE.md, with teeth: a query param
lands in platform access logs and referrer headers, and that token IS
the crew's data. A festival id is public catalogue information.

`api/share.js` serves `index.html` with per-fest tags injected between
`<!-- OG:BEGIN -->` / `<!-- OG:END -->` markers. It trusts nothing from
the request: `?f=` selects a festival by exact id match against
`data/festivals/index.json` and is never echoed into the response.
Unknown id, junk, injection attempt, or a bare `/f` → **302 to `/`** —
`/f` exists to say something about one festival, and with none to name
the person belongs in the app. A browser carries the fragment across a
redirect whose target has none, so `#g=` and `&f=` both survive; a
crawler follows it and reads the static default tags. Every interpolated
value is HTML-escaped anyway, and `og:url` is built from a hardcoded
origin, never the request's Host header.

`og:image` points at the pre-rendered static file. Nothing renders at
request time.

**Service worker: checked, and nothing needs changing** — measured in a
real browser, including with the server dead, rather than reasoned
about. The worker registers from `/service-worker.js`, so its scope is
`/` and covers `/f/<id>`; the page is controlled. Navigations are
already network-first, so an online open always gets live tags.

The nested path is the part worth proving, because a relative asset URL
would resolve under `/f/` and 404: every stylesheet, icon and manifest
href in index.html is absolute, checked in the DOM. And with the harness
killed, a **cold `/f/lost-lands-2026` that had never been opened** still
booted the whole app from cache — landing screen, modules, tokens,
Anton — falling through to the precached `/`. The `/f/<id>` entries live
in the version-keyed shell cache that `activate` wipes wholesale, so
there is no cross-version staleness; worst case is about twelve 17 KB
entries.

## Mechanics worth writing down (each one cost a probe)

- **resvg-js cannot read woff2.** `fontdb` rejects the shipped
  `assets/fonts/*.woff2` with "malformed font" and then silently renders
  in a fallback face. The script decompresses woff2 → ttf in memory with
  `wawoff2` (2nd devDependency) so the *shipped* font files stay the one
  source of truth for the typeface — no second copy of Anton in the repo
  to drift.
- **`font.fontBuffers` does not register family names; `font.fontFiles`
  does.** Measured 2026-08-30: the identical Anton bytes render as Anton
  via `fontFiles` and as a fallback sans via `fontBuffers`, with no error
  — a silent wrong-font ship. So the script writes the decompressed TTFs
  to an OS temp dir, renders, and removes them.
- **The script proves the font loaded before it generates anything.** It
  renders the same string twice — once naming Anton, once naming a
  family that cannot exist — and fails loudly if the two rasters match.
  A silent fallback is exactly the failure mode a design pipeline must
  not have.
- **Inter's variable weights collapse.** resvg picks the default
  instance, so `font-weight: 600/800` renders identical to 400. The
  micro-label's 800 weight is faked with a hairline `stroke` in the fill
  colour, which reads correctly at these sizes.
- **Two new devDependencies, both pure-JS.** `wawoff2` (woff2 → ttf) and
  `jpeg-js` (the preview encoder). Neither is imported by anything that
  ships: `scripts/` is in `.vercelignore`, and `api/share.js` is
  deliberately dependency-free. They do get installed on every Vercel
  build alongside the existing `jsdom`/`pglite` devDeps — plus
  `@resvg/resvg-js`, which pulls a prebuilt native binary. Worth an eye
  on the first preview deploy; nothing at runtime touches them.
- **Text is auto-fitted by measurement, not by guessing.** `Resvg#getBBox()`
  on a text-only SVG gives a real advance width, so long names
  ("Seismic Dance Event 9.0", "Tomorrowland Winter") shrink to fit the
  measure instead of running off the canvas.

## Scope kept out

- `js/v3/favicon.js` is untouched. The living favicon keeps breathing;
  its static fallback simply stops contradicting it.
- `manifest.json`'s `name` / `short_name` are untouched. `short_name:
  "Festival"` is weak on a home screen and `"Fest Nav"` would use the
  app's own vocabulary — but renaming what sits under a person's icon is
  Kevin's call, not a side effect of a favicon fix. Raised in the report.
- `description` in `manifest.json` DOES change, to the landing screen's
  real promise line — it was carrying invented copy.

## Files touched

| File | What |
|---|---|
| `assets/mark.svg` | new — the source of every raster |
| `scripts/brand-assets.mjs` | new — the generator (`npm run brand`) |
| `assets/og/*.jpg` | new — 11 fests + default, ~130 KB each |
| `favicon.png`, `icon-192.png`, `icon-512.png` | regenerated |
| `icon-maskable-512.png` | new |
| `index.html` | OG/Twitter meta between markers · **APP_CORE file — SW stamp goes stale** |
| `api/share.js` | new — per-fest tag injection |
| `vercel.json` | rewrites on `/f/:id` and `/f` + `includeFiles` |
| `js/crew.js` | `crewLink` serves fest links from `/f/<id>` · **APP_CORE file** |
| `manifest.json` | maskable icon + real description |
| `.gitignore` | allow-list the new PNGs |
| `package.json` | `@resvg/resvg-js`, `wawoff2`, `jpeg-js`, `npm run brand` |
| `tests/brand-assets.test.mjs` | new |
| `tests/crew-links.test.mjs`, `tests/invite-context.test.mjs` | updated for the query |
| `README.md`, `docs/add-a-festival.md` | the new step |


## Verified (2026-08-30)

- `node scripts/validate-festivals.mjs` — 11 files, 0 errors, 1 pre-existing
  warning (Tomorrowland Winter has no lineup yet).
- `npm test` — **303 tests, 301 pass, 1 skipped, 1 fail**. The one failure is
  `the service worker stamp matches the cached assets`, which is expected and
  is the lead's to clear: **`index.html` is an APP_CORE file and this work
  edits it** (so do other teammates' changes to `assets/v3.css`,
  `js/v3/notes.js`, `js/v3/settings.js`). `node scripts/sw-stamp.mjs`
  deliberately NOT run here.
- Every generated raster opened and looked at, not just size-checked.
- Static serve on :8124 — the default tags render, and all eight referenced
  assets return 200 with the right content types.
- A local harness mimicking the vercel.json rewrite — `/?f=portola-2026` and
  `/?f=acl-2026` return per-fest tags; `/?f=not-a-fest` and
  `/?f=%22%3E%3Cscript%3E` fall back to the default card with nothing echoed;
  headers and cache-control correct.
- **Real browser (Playwright):** `http://…/?f=portola-2026` boots the app
  normally — landing screen `display: flex`, hero button present, no app
  errors — with the injected per-fest tags live in the DOM. The query does
  not disturb the boot path. (An earlier run showed a dead page; that was the
  test harness serving `.mjs` as `application/octet-stream`, not the app —
  worth remembering that a local harness can manufacture a bug that looks
  like yours.)


## Round two (2026-08-30, same day)

*(Two passes, same day: first the routing fix, then the link shape. Both
are folded into decision 5 above; this is the record of how it went.)*

The first version shipped to a preview and the rewrite never fired — the
lead caught it with `x-vercel-cache: HIT` and a default OG block on
`/?f=portola-2026`. Diagnosis confirmed against Vercel's own reference
before touching anything (quoted in decision 5). Fix: share links moved
from `/?f=` to `/s?f=`, the `has` matcher dropped, `og:url` follows, and
an unknown or absent `f` now 302s to `/` instead of serving default tags
from a path that has no reason to exist.

Two new tests encode the routing rule rather than trusting it, and both
were checked against the broken config to confirm they go red:

- *no rewrite source is shadowed by a file the filesystem would serve
  first* — the general rule. Fails with `/ <- index.html`. Its own first
  draft passed on the broken config, because `new URL('/index.html',
  root)` resolves against the filesystem root, not the repo; that bug is
  now called out in a comment beside the fix.
- *a fest-scoped share link points at the path the rewrite owns* — ties
  `crewLink`, `vercel.json` and `api/share.js` together, so the three can
  never drift apart silently again.

The first fix moved links to `/s?f=<id>`. The lead then made the right
call to spend the extra pass on the shape itself rather than bank it as
a follow-up: the complaint was about how links READ, and `/s?f=` is
machinery. Final shape is `/f/<fest-id>`.

Verified after both passes: the corrected harness — which now compiles
`:param` sources the way Vercel does — reproduces the live failure on
the old shape (`x-harness-served: filesystem`, zero per-fest markers)
and serves per-fest tags on `/f/lost-lands-2026`, `/f/portola-2026` and
`/f/acl-2026`. The junk battery (`/f/not-a-fest`, an encoded
`"><script>alert(1)</script>`, an encoded `../../etc/passwd`, a bare
`/f`, an over-long id, a wrong-case id, a trailing-space id) all 302 to
`/` with nothing echoed; a raw `../../etc/passwd` and `/f/<id>/extra`
404, which is right. POST is 405. And a real browser boots the app at
`/f/portola-2026` — styles applied, modules loaded, every asset href
absolute, SW controlling the page, per-fest tags live in the DOM — then
boots it again, cold and fully offline, with the server killed.

Both routing tests were re-checked against two broken configs, not just
trusted: reverting to `source: "/"` fails them with `/ <- index.html`,
and dropping an `f/index.html` into the repo fails the shadow test with
`/f/:id <- f`.
