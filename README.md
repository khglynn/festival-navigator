# 🎪 Festival Navigator

A fast, mobile-first PWA for planning any festival with your crew. Make a crew,
share one link, and everyone's picks sync live — including when the lineup is
out but set times aren't. Works offline once loaded.

**Loaded festivals (July 2026):** Lost Lands, Portola, ACL (both weekends),
EDC Orlando, Seismic 9.0, Tomorrowland Winter '27 (dates only) · Electric
Forest '26 + Lollapalooza '25 archived with full schedules.

## ✨ How it works

- **Crews via share links** — "Start a crew" mints an unguessable link; the
  link is the access (no accounts, no passwords). A crew keeps its people and
  picks across every festival.
- **Two views** — a sortable/searchable **artist list** while only the lineup
  is announced (sort by billing, day, my picks, crew favorites; ACL gets a
  weekend 1/2 filter), and the **schedule grid** once set times drop. Picks
  carry over automatically because they're artist-keyed.
- **Tap to prioritize** — Nice to See → Must See → Highlight → clear. Everyone
  gets a color; overlapping picks blend on the grid.
- **Offline-first** — picks save to the device instantly and sync when signal
  returns. The server merges every write atomically, so nobody's picks ever
  clobber anyone else's.
- **Spotify (optional, per crew)** — the crew lead creates a free Spotify app
  and pastes its Client ID; members connect via PKCE (no secrets anywhere),
  get ★/♥ badges on artists they already listen to, and can turn picks into a
  playlist on their own account. Note Spotify's 2026 rules: new dev apps are
  capped at 5 allowlisted users and the app owner needs Premium.
- **AI tools** — artist blurbs and a group conflict optimizer (server key via
  `GEMINI_API_KEY`, or bring-your-own key client-side).
- **Export** — day grid as PNG, or copy/paste all picks as text.

## 🗂️ Project structure

```
index.html               app shell (landing / join / main views)
js/                      ES modules, no bundler
  app.js                 boot flow + wiring        state.js   crew doc + pending overlay
  sync.js                push/poll sync            crew.js    tokens, registry, share links
  festivals.js           lazy festival loader      spotify.js PKCE + library scan + playlists
  overlap.js             same-stage lane math      render/    grid, list, people
data/festivals/          one JSON per festival + index.json (see docs/add-a-festival.md)
api/                     Vercel functions: crew store, artist-info, optimize
api/_lib/                shared validation + guards (node:test covered)
db/schema.sql            Neon Postgres schema incl. the atomic jsonb_deep_merge()
scripts/                 festival validator/importer, one-time legacy migration
tests/                   node --test suites (npm test)
```

## 🔄 Sync model

Every pick is written to `localStorage` immediately, then the **delta** is
pushed to `/api/crew` where Postgres merges it into the crew document in a
single atomic `UPDATE` (via `jsonb_deep_merge`, see `db/schema.sql`) — write
races are structurally impossible. Other devices poll the merged doc every
20s and on focus. Removals sync as tombstones (`removed: true`) and level-0
picks because a deep-merge can't express deletion.

## 🏗️ Setup (fork/self-host)

1. Deploy to Vercel (static + functions; no build step — Tailwind is
   precompiled and committed, `npm run css` after class changes).
2. Create a Postgres database (free Neon tier is plenty) and run
   `psql "$DATABASE_URL" -f db/schema.sql`.
3. Set env vars: `DATABASE_URL` (required), `GEMINI_API_KEY` (optional — AI
   features fall back to bring-your-own-key without it).
4. Local dev: `npm i && vercel dev` (pulls env from the linked project).
   Note: restart `vercel dev` after creating new files — it only serves files
   that existed at startup.

## 📄 License

MIT
