# Forking and self-hosting festival-navigator

**Written 2026-08-30; checked against the code 2026-10-19.** The shape of
this runbook, and the two traps it names first, come from Ray (`raypp2`),
who forked the app in July 2026, hit every one of these, and wrote them
down (issue #6 and his fork's own setup doc).

The stack: Vercel (static files + functions) and Neon Postgres. No build
step. Node 22 or newer; CI runs Node 24.

## 1. Point the app at yourself, before your first deploy

### The canonical host

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

### The report key

Beside it sits the key for crash reports and usage counts (v88, v108):

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

### Three places that still spell out the upstream host

- `api/share.js` builds link-preview URLs from `ORIGIN` near the top of
  the file. Change it if you want per-festival unfurls on your domain, then
  regenerate the preview images (step 4).
- `index.html`'s `og:url` and `og:image` tags name `https://fest.kevinhg.com`.
- `ops/` is the upstream author's own production checks (its host list is
  upstream's). A fork can ignore it or point it at its own hosts.

### The Spotify access-request flow

The "request access" door (a Slack message with an approve button) turns
on when three variables are set: `OWNER_SPOTIFY_CLIENT_ID`,
`SLACK_WEBHOOK_URL` and `APPROVE_SECRET`. The approve link is only built
for hosts `api/access.js` trusts (`HOST_ALLOW`, which names upstream's), so
on your own domain also set `PUBLIC_BASE_URL`, or the Slack message
arrives without its approve link. Without any of it, members bring their
own Spotify Client ID and nothing breaks.

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
| `PUBLIC_BASE_URL` | no | Your canonical origin, for that flow's approve link. Needed on any domain but upstream's. |

Local `vercel dev` pulls the real cloud env, so localhost `/api` hits
whatever database `DATABASE_URL` names. Point Development at a Neon
branch, or treat local writes as production writes.

## 4. Your own mark and link previews

`npm run brand` (`scripts/brand-assets.mjs`) regenerates the favicon, the
icons and the per-festival 1200×630 preview cards from `assets/mark.svg`
and `data/festivals/index.json`. Edit the SVG (or just your festivals) and
re-run; a test fails CI if a festival lacks its preview image.

## 5. The rituals that keep you honest

- `npm ci`, then `npm test`: the unit suite, on a pinned clock, against the
  real merge SQL (PGlite, in-process; no server, no secrets).
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
