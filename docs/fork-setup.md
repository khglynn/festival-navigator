# Forking and self-hosting festival-navigator

**Written 2026-08-30; checked against the code 2026-10-19.** The shape of
this runbook, and the two traps it names first, come from Ray (`raypp2`),
who forked the app in July 2026, hit every one of these, and wrote them
down (issue #6 and his fork's own setup doc).

The stack: Vercel (static files + functions) and Neon Postgres. No build
step.

The steps below run in order. Each one leaves the test suite green if you
stop after it, as long as you finish step 1 in one go.

## 0. Get it running

Use Node 24, as CI does (`package.json` pins `engines.node` to `24.x`).
The test tools ask for 24.15.0 or newer on that line (jsdom's own
`engines`). Node 22.22.2 or newer also runs everything; there `npm ci`
prints an `EBADENGINE` warning about the 24.x pin, which is expected and
harmless.

```sh
npm ci      # first: step 1's scripts need the dev dependencies
npm test    # green on a fresh clone, before you change anything
```

## 1. Point the app at yourself, before your first deploy

A handful of edits, then the commands at the end of this step. Do them in
one sitting: the suite is red between the first edit and the last command.

### The canonical host (required)

`index.html` carries the app's canonical host in one tag:

```html
<meta name="fn-canonical-host" content="fest.kevinhg.com">
```

Set it to YOUR host. The Spotify sign-in hop and every on-screen string
that names the host derive from it. Spotify only accepts pre-registered,
exact-match redirect URIs, so every other host hops to this one, and the
hop URL carries the crew token AND the person master token in its
fragment. A fork left on the upstream value hands its users' credentials
to the upstream author's domain the first time someone connects Spotify.

In your Spotify app's settings, register `https://<your-host>/spotify-callback`
as the redirect URI (the app's own Spotify guide in Settings says the same).

Share links are already safe: they name `fest.kevinhg.com` only when the
page itself runs on a kevinhg.com production host; anywhere else, a
fork included, a link keeps the page's own origin (`js/crew.js`,
`shareOrigin`).

### The link-preview origin (required)

A pasted link unfurls as a card that chat apps and crawlers build from the
page's `og:` tags, and those name an absolute origin in two files:

- `api/share.js`: `ORIGIN` near the top (`const ORIGIN = 'https://fest.kevinhg.com'`).
  It builds the per-festival previews served at `/f/<festival id>`.
- `index.html`: the `og:url` and `og:image` tags, both
  `https://fest.kevinhg.com/…`.

Set all three to `https://<your-host>`. Left on upstream, every link your
users paste makes the crawler fetch its image from `fest.kevinhg.com` and
names upstream's address on the card. (The crew token never rides: it
lives in the link's `#` fragment, which no crawler sends.) The preview
images themselves (`assets/og/*.jpg`) draw no host, so they need no
regenerating for this.

### The report key (required: yours, or empty)

Beside the canonical host sits the key for crash reports and usage counts
(v88, v108):

```html
<meta name="fn-report-key" content="phc_…" data-hosts="kevinhg.com">
```

It is the upstream author's PostHog project key, bound by `data-hosts` to
that author's domain. On your domain it does nothing, so nothing reaches
the upstream project. One exception: `localhost` (and `127.0.0.1`, `[::1]`)
always counts, so a local run of an unmodified fork DOES report upstream.

- To get your own reports, put your own PostHog project key in `content`
  (the `phc_…` one: a write-only key, public by design; a personal `phx_…`
  key is ignored on purpose) and your domain in `data-hosts`.
- To send nothing anywhere, empty `content`. Then no report leaves any
  phone, the Settings switch disappears, and Settings → Diagnostics keeps
  working.

Reports go through `/fn-i/batch`, which `vercel.json` rewrites to
PostHog's US ingestion host; an EU project changes that one destination.
What may leave a phone, and what never does, is decided in one file,
`js/errlog.js`.

### Three things that still name the upstream author

None of these leaks anything, but your users would see Kevin's name or
your checks would hit his hosts:

- `js/v3/settings.js`: the "Buy Kevin a coffee ☕" row at the foot of
  Settings, which links `SUPPORT_URL` (near the top of the file,
  `https://buymeacoffee.com/kevinhg`). Point it at your own page or remove
  the row.
- `js/v3/settings.js`: the switch label "Send crash reports and usage to
  Kevin". Name yourself, or drop it with an empty report key (the switch
  then disappears).
- `ops/` is the upstream author's own production checks (its host list is
  upstream's). A fork can ignore it or point it at its own hosts.

### Three tests that name upstream

Change these with the edits above, or the suite goes red. The first two
were found by making the host edits in a copy of the repo and running
`npm test` (2026-10-19); the third holds the switch's words verbatim:

- `tests/brand-assets.test.mjs`: lines 140–141 (the `og:image` in
  `index.html`) and lines 149 and 153 (the image and `og:url` from
  `api/share.js`) name `https://fest.kevinhg.com`.
- `tests/view-menu.test.mjs`: line 131 expects a copied crew link to start
  `https://fest.kevinhg.com/`, and the link follows your
  `fn-canonical-host`. The next test in that file then fails as a
  knock-on; fixing line 131 fixes both.
- `tests/errlog-settings-toggle.test.mjs`: line 22, `LABEL`, is the
  Settings switch's words, if you rename it (above).

Making the first two read the host from the code instead is on the
BACKLOG.

### Then the commands, in this order

```sh
npm run brand             # only if you changed the mark or the festival list (step 4)
node scripts/sw-stamp.mjs # bump the service worker's stamp
npm test
```

`index.html` and `js/v3/settings.js` are among the files the service worker
caches, so any edit to them needs `node scripts/sw-stamp.mjs`, or
`tests/app-shell-complete.test.mjs` fails (and phones would keep the old
copy). It runs after `npm run brand` because the icons are cached files
too.

### The Spotify access-request flow

The "request access" door (a Slack message with an approve button) turns
on when three variables are set: `OWNER_SPOTIFY_CLIENT_ID`,
`SLACK_WEBHOOK_URL` and `APPROVE_SECRET`. The approve link is only built
for hosts `api/access.js` trusts (`HOST_ALLOW`, which names upstream's), so
on your own domain also set `PUBLIC_BASE_URL`. Without it, the request is
recorded but no Slack message is sent at all: the server will not build a
link for a host it does not trust, and it sends nothing rather than a
message with no way to approve. Without any of the three, members bring
their own Spotify Client ID and nothing breaks.

## 2. Database (Neon)

Create a Neon project, run `db/schema.sql` (idempotent) in its SQL editor,
and check that the merge function exists. It is the concurrency guarantee:

```sql
SELECT jsonb_deep_merge('{"a":{"x":1}}'::jsonb, '{"a":{"y":2}}'::jsonb);
-- expect {"a": {"x": 1, "y": 2}}
```

## 3. Environment variables (Vercel → Settings)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Set for Development, Preview AND Production. Missing on Preview means every preview deploy answers 500. |
| `GEMINI_API_KEY` | no | AI festival research (`api/festival-add.js`) and reading picks from a festival app's schedule images (`api/import-schedule.js`). |
| `GEMINI_MODEL` | no | Pins an exact Gemini model id. Default: the floating `gemini-flash-latest` alias (Ray's fix, `api/_lib/guard.mjs`). |
| `OWNER_SPOTIFY_CLIENT_ID` / `SLACK_WEBHOOK_URL` / `APPROVE_SECRET` | no | Together, the Spotify access-request flow (step 1). |
| `PUBLIC_BASE_URL` | no | Your canonical origin. Needed on any domain but upstream's, or the access-request flow sends no Slack message. |

To run the app locally, `npx vercel dev` (the Vercel CLI is not one of
this repo's dependencies; install it globally if you'd rather type
`vercel dev`). It pulls the real cloud env, so localhost `/api` hits
whatever database `DATABASE_URL` names. Point Development at a Neon
branch, or treat local writes as production writes.

## 4. Your own mark and link previews

`npm run brand` (`scripts/brand-assets.mjs`) regenerates the favicon, the
icons and the per-festival 1200×630 preview cards from the mark and
`data/festivals/index.json`. The mark is generated in code, not drawn:
`markSvg()` in `scripts/brand-assets.mjs` builds it from `MARK_WASHES`
(its colour washes), `ANCHORS` (where they sit) and `MARK_RADIUS`, and
writes `assets/mark.svg` from that on every run. So change those, not the
SVG, which the next run overwrites. Then run it, and
`node scripts/sw-stamp.mjs` (the icons are cached files). A test fails CI
if a festival lacks its preview image.

## 5. The rituals that keep you honest

- `npm test`: the unit suite, on a pinned clock, against the real merge
  SQL (PGlite, in-process; no server, no secrets).
- `npx playwright install chromium webkit` once, then `npm run test:browser`:
  the real-input contracts in Chromium and WebKit (CI runs both on Linux).
- `node scripts/validate-festivals.mjs`: before committing any festival
  data. CI runs it too.
- `node scripts/freeze-pick-keys.mjs <fest-id>`: the day real people start
  picking in a festival, and before any set-times edit. Artist names are
  pick keys; a rename orphans picks forever.
- `node scripts/sw-stamp.mjs`: after changing ANY file the service worker
  caches (the suite fails loudly if you forget).

## 6. Deploys

With Vercel's git integration, a push to any branch except `main` deploys a
preview, and a merge to `main` deploys production. Previews and production
use whatever `DATABASE_URL` each environment names, so check before you
test writes against a preview.
