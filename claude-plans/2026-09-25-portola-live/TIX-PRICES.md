# Ticket prices on the Tix door — working notes (2026-09-26)

Brief: `TIX-PRICES-BRIEF.md`. Branch `data/tix-prices`, based on `data/folsom-all`
(b4f562a). Kevin, from Portola, 12:25 AM PT: "I actually think we never need to
see the name of the site where the tix are sold. No necessary info. Just tix if
we don't know price or Tix $69 for example yeah?" — "some of these events are
expensive."

## Part 1 — the label (code)

Done. `linkOf`/`linksOf` in `js/v3/events.js` now render:
- `tickets` no price → `Tix`
- `tickets.price` ≥ 1 whole number → `Tix $NN`
- `tickets.price === 0` → `Tix free`
- `page` → `Info`

`at` stays in the data (required, provenance) but is no longer shown on the
card; `card-facts.js`'s `sourceDoor` folds it into the accessible label
instead ("Tix $69 — buy tickets at AXS").

Validator (`api/_lib/festival-rules.mjs` `checkLinks`) now accepts
`tickets.price` (integer 0–2000) and `tickets.checked` (real YYYY-MM-DD date),
always together — price without checked or vice versa is an error, same for a
non-integer/out-of-range price or a malformed date. `page` still only takes
`{ url, at }`.

Files touched: `js/v3/events.js`, `js/v3/card-facts.js`,
`api/_lib/festival-rules.mjs`, `api/festival-add.js` (comment only — it
already drops the whole `tickets`/`page` object), `docs/add-a-festival.md`,
`gallery.html` (Channel Tres now carries `price: 45, checked: 2026-09-26` —
one priced door; Overmono stays unpriced — one bare `Tix` door),
`tests/show-links.test.mjs`, `tests/events-wall.test.mjs`,
`tests/browser/show-links.test.mjs`.

Test results: `npm test` — 926 pass, 1 skipped, 1 expected fail
(`tests/app-shell-complete.test.mjs`'s asset-stamp check — expected per the
brief, since `events.js`/`card-facts.js` changed and `scripts/sw-stamp.mjs`
is deliberately NOT run here). `node scripts/validate-festivals.mjs` — 0
errors, 2 pre-existing warnings (unrelated: Flight by Nothing's Sunday
billing, tomorrowland-winter-2027's empty lineup). `npm run test:browser` —
running in background, will report below.

## Part 2 — the prices

One row per show. "Show" = one bill (room + night/date + doors time) — a
price applies to every name on that bill per the existing rule.

Status legend: **on sale** (priced, tickets link kept) · **tier N sold out**
(priced at the cheapest tier still available) · **sold out → removed**
(every tier gone, no resale — `tickets` deleted, page-only door) · **door
only** (venue says so — `tickets` was already absent or removed) · **no
price found** (left as bare `Tix`, tickets link kept).

### Portola — Saturday Sep 26

| Show (room · time) | Seller | Price | Source | Status |
|---|---|---|---|---|

### Portola — Sunday Sep 27 (incl. Folsom)

| Show (room · time) | Seller | Price | Source | Status |
|---|---|---|---|---|

### ACL Late nights (Sep 29 – Oct 10)

| Show (date · room) | Seller | Price | Source | Status |
|---|---|---|---|---|

## Surprises / flags

(filled in as found)
