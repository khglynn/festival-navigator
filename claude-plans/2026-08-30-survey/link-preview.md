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
- **`default.jpg`** mirrors the landing screen instead: FESTIVAL /
  NAVIGATOR stacked, NAVIGATOR in the pulse gradient, on a violet/pink
  aura. Same object, no festival. It drops the small corner mark the fest
  cards carry — repeating the mark beside a 100px FESTIVAL / NAVIGATOR
  wordmark read as a stray swatch. Everything else sits on the fest
  cards' exact baselines, so all twelve are one family.

### 5. The fest id rides in the QUERY, the crew token never does

`crewLink()` gains `?f=<id>` **before** the hash, and keeps the existing
`&f=` inside it. The `#g=` token stays hash-only — CLAUDE.md, with
teeth: a query param lands in platform access logs, and that token is
the credential.

Emitting the id twice is deliberate. The query is the only half a
crawler and a Vercel rewrite can see; the hash is the half the running
app already reads (`crew.festFromHash()`), and leaving it alone means
this change touches no boot code at all. Fourteen extra characters in a
link nobody reads (they see the preview card) buys a zero-risk boot path.

`api/share.js` serves `index.html` with per-fest tags injected between
`<!-- OG:BEGIN -->` / `<!-- OG:END -->` markers, wired by a `vercel.json`
rewrite on `/` that only fires when a query `f` is present. It trusts
nothing from the query: `?f=` selects a festival by exact id match
against `data/festivals/index.json` and is never echoed into the
response. Unknown id, junk, injection attempt → the default tags. Every
interpolated value is HTML-escaped anyway. `og:url` is built from a
hardcoded `https://fest.kevinhg.com`, never the request's Host header.

`og:image` points at the pre-rendered static PNG. Nothing renders at
request time.

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
| `vercel.json` | rewrite + `includeFiles` |
| `js/crew.js` | `crewLink` gains `?f=` |
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
