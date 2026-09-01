# Forking and self-hosting festival-navigator

**Written 2026-08-30.** The shape of this runbook — and the two traps it names
first — comes from Ray Perfetti (`raypp2`), who forked the app in July 2026,
hit every one of these, and wrote them down (issue #6 and his fork's own
setup doc). The stack: Vercel (static + functions) + Neon Postgres. No build
step.

## 1. Point the app at yourself — one tag

`index.html` carries the app's canonical host in one place:

```html
<meta name="fn-canonical-host" content="fest.kevinhg.com">
```

Set it to YOUR host before deploying. Everything derives from it: the Spotify
OAuth hop (Spotify only accepts pre-registered exact-match redirect URIs, so
every other host hops to this one — and the hop URL carries the crew token
AND the person master token in its fragment, so a fork left on the upstream
value hands its users' credentials to the upstream author's domain), and every
on-screen string that names the host. There is no second copy to chase.

`api/access.js`'s `HOST_ALLOW` is anchored to upstream hostnames too, but
setting the `PUBLIC_BASE_URL` env var overrides it — without it the approve
link in Slack notifications is omitted, nothing breaks.

Link previews (`api/share.js`) build og:urls from a hardcoded origin near the
top of that file — change `ORIGIN` there if you want per-festival unfurls on
your domain, then regenerate the preview images (step 4).

## 2. Database (Neon)

Create a Neon project, run `db/schema.sql` (idempotent) in its SQL editor,
and verify the merge function exists — it is the concurrency guarantee:

```sql
SELECT jsonb_deep_merge('{"a":{"x":1}}'::jsonb, '{"a":{"y":2}}'::jsonb);
-- expect {"a": {"x": 1, "y": 2}}
```

## 3. Environment variables (Vercel → Settings)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Set for Development, Preview AND Production — missing on Preview means every preview deploy 500s. |
| `GEMINI_API_KEY` | no | The AI festival-research path in `api/festival-add.js`. |
| `PUBLIC_BASE_URL` | no | Canonical origin for approve links; bypasses `HOST_ALLOW`. |
| `OWNER_SPOTIFY_CLIENT_ID` / `SLACK_WEBHOOK_URL` / `APPROVE_SECRET` | no | The Slack access-request flow only. |

Note: local `vercel dev` pulls the real cloud env — localhost `/api` hits
whatever database `DATABASE_URL` names. Point Development at a Neon branch,
or treat local writes as production writes.

## 4. Your own mark and link previews

`node scripts/brand-assets.mjs` regenerates the favicon, icons, and the
per-festival 1200×630 preview cards from `assets/mark.svg` and
`data/festivals/index.json`. Edit the SVG (or just your festivals) and re-run;
a test fails CI if a festival lacks its preview image.

## 5. The rituals that keep you honest

- `npm test` — the suite runs against the real merge SQL (PGlite, no server).
- `node scripts/validate-festivals.mjs` — before committing any festival data.
- `node scripts/freeze-pick-keys.mjs <fest-id>` — the day real people start
  picking in a festival, and before any set-times edit. Artist names are pick
  keys; a rename orphans picks forever.
- `node scripts/sw-stamp.mjs` — after changing ANY file the service worker
  caches (the suite fails loudly if you forget).

## 6. Deploys

Branch pushes are previews; production is a deliberate promote. Previews and
production share whatever `DATABASE_URL` says per environment — check before
testing writes against a preview.
