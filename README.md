# 🎪 Festival Navigator

A fast, mobile-first web app for planning a festival with your crew. Pick who's
seeing whom across every stage, spot conflicts, and share the plan — and it keeps
working when the signal doesn't.

Currently loaded festivals:
- **Electric Forest '26** — Rothbury, MI (4 days, 7 stages, Thu–Sun Jun 25–28)
- **Lollapalooza** — Chicago, IL (archived)

## ✨ Features

- **Multi-festival** — switch festivals from the dropdown; each keeps its own crew and picks.
- **Dynamic crew** — add or remove people on the fly, each gets a color automatically.
- **Visual schedule grid** — all stages on one timeline, including late-night/after-midnight sets.
- **Tap to prioritize** — Nice to See → Must See → Highlight → clear.
- **Offline-first** — picks save instantly to your device and sync to the group when you have signal.
- **Installable (PWA)** — add to your home screen; the app shell works with no connection.
- **Spotify affinity overlay** — artist cards show a green accent + ★/♥ badge for artists you follow or have liked songs from (a static, owner-personal snapshot).
- **Also happening** — a time-sorted list of non-stage programming (The Brainery workshops, Silent Disco) below the grid for each day.
- **AI tools** — artist blurbs and a group-plan conflict optimizer; keyless for everyone when a server key is set (see setup).
- **Export** — download a day as a PNG, or copy/paste everyone's picks.

## 🗂️ Project structure

```
index.html            # the whole app (UI + logic)
data/festivals.js      # all festival/stage/set data — edit lineups here
data/spotify-affinity.js # static Spotify snapshot — drives the ★/♥ artist badges
api/selections.js      # Vercel Blob store; deep-merges the group's picks
api/artist-info.js     # server-side Gemini call for artist blurbs
api/gemini.js          # generic server-side Gemini route (used by the optimizer)
manifest.json          # PWA manifest
service-worker.js      # offline app-shell cache
```

### Editing a lineup
Open `data/festivals.js`, find the set, and change its name / stage / time. The
grid, colors, and sync all update automatically. Times can be a single start
(`"6:30 PM"`) — the app fills the end from the next set on that stage — or a full
range (`"6:30 PM - 7:30 PM"`).

## 🔄 How sync works

Every pick is written to `localStorage` immediately (works with zero signal),
then pushed to a shared Vercel Blob document in the background. The server
**deep-merges** updates, so two people editing at once never overwrite each
other. Other devices pull the merged result on an interval and when the app
regains focus. The dot in the bottom bar (next to the festival picker) shows sync status
(online / syncing / offline).

### One-time setup (Vercel dashboard)
1. **Storage → Blob** → connect a Blob store to this project (sets `BLOB_READ_WRITE_TOKEN`).
2. **Settings → Environment Variables** → add `GEMINI_API_KEY` (required for AI features). When set, artist blurbs + the optimizer work for everyone with no per-device key; without it, users are prompted for their own free key from Google AI Studio.
3. Redeploy.

Without the Blob store the app still runs fully — it just stays per-device until
the store is connected.

## 🏗️ Local development

```bash
npm install
vercel dev      # serves the static app + /api functions
```

## 📄 License

MIT
