# v103 — NOW on the left, the List filters by highlight, Spotify's top songs (brief, 2026-09-26 ~3 PM PT)

Kevin, back from Portola's afternoon, three asks for one release. Branch `live/v103` off main
(v101 Our picks live; v102 Spotify names about to land — merge origin/main when it does).
Another session is building the Share for Our picks on `live/share` (Show menu row, welcome ✕,
the plan's foot) — keep clear of those; coordinate through the coordinator.

## 1. NOW at the far left of the day bar
Kevin: "move the now to the far left in the day bar — just not pinned over everything — don't
have it move between days — can simplify code accordingly." Today (v96) NOW is a tab beside the
live day in the scrolling day row, so it moves as days pass; Our picks' one-NOW rule hides the
dock's NOW while the plan's peek carries it (js/v3/plan-shelf.js planShowsNow). Make NOW the
first item of the day row (phone dock and laptop rail), scrolling with the row (not pinned over
it), in one fixed place whatever the day; keep the one-NOW rule; remove the code that placed it
beside the live day. Frames 390/320/1280, Portola and ACL.

## 2. In the List, a highlight filters
Kevin: "when in list view — let's have highlight actually filter — only show that person(s)
picks. our grid can highlight. our list can filter." In the Board a highlight dims; in the List
it hides every row the highlighted people didn't pick (rooms with none left show one quiet
line, not an empty head; the fold counts follow). Viewer-side only, never the crew doc.
Check with Our picks open (his note: "does filters work with our picks open").

## 3. The crew playlist's songs
Kevin: "the playlist for everyone only has my likes for artists, not top songs for all artists
folks have tagged." Code (js/spotify.js findTrackUris): per artist, your saved tracks first, then
the top 3 from `/search`; on ANY search error it silently keeps only your saved tracks. With ~50
crew artists a burst of searches likely hits Spotify's rate limit (429), so most artists got
only Kevin's likes (or nothing). Make search robust: honour 429 Retry-After with backoff, pace
the calls, retry once on 5xx; count and SAY how many artists got no top songs ("12 artists
had no songs found — try again later") instead of a silent fallback; same for the crew top-up
(addArtistsToPlaylist). Unit tests with a fake Spotify (429 then 200; persistent 429).

## Gate
Laws in CLAUDE.md (one-NOW, 44px floor, motion law, storage in try, no crew-doc writes for a
view). npm test at UTC, TZ=Asia/Tokyo, NIGHT_CLOCK; npm run test:browser; CI green on BOTH jobs
(Linux WebKit is required and has caught real bugs today — read every red by name); log in
V103-BUILD.md started first; commit + push per step; don't stamp, no PR. Report SHAs, results,
frames, calls.
