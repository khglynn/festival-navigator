# Ticket prices on the Tix door — brief (2026-09-26, 12:25 AM PT)

Kevin, 2026-09-26, from Portola: "I actually think we never need to see the name
of the site where the tix are sold. No necessary info. Just tix if we don't know
price or Tix $69 for example yeah?" — and why: "some of these events are
expensive". A friend deciding between two afters wants the cost at a glance; the
seller's name told them nothing they act on.

You are working in `.claude/worktrees/tix-prices`, branch `data/tix-prices`, based
on `data/folsom-all` (b4f562a — every Folsom party is already in the Portola file).
Stay in this worktree. Commit as you go (one concern per commit, scope-prefixed
messages, never `wip`) and push the branch after each commit — if you die halfway,
what you banked is what survives. Keep a running notes file,
`claude-plans/2026-09-25-portola-live/TIX-PRICES.md`, and grow it as you work (the
price table below lives there), starting it before your first page fetch.

## Part 1 — the label (code, small)

`js/v3/events.js` `linkOf`/`linksOf` builds the zoom's doors. Today they read
`Tix @ AXS` and `Info @ DoTheBay`. Change them to:

| Data | Door text |
|---|---|
| `tickets` with no `price` | `Tix` |
| `tickets.price` a whole number ≥ 1 | `Tix $69` (no decimals, no thousands separator needed) |
| `tickets.price` is 0 | `Tix free` |
| `page` | `Info` |

`at` stays in the data and stays REQUIRED exactly as today (it is provenance — the
docs say why: a referral wrapper hides the seller). It is just no longer shown. If
the doors carry an accessible label or title, it may keep naming the seller
("buy tickets at AXS") — that is not something a person sees. Everything else about
the doors is unchanged: the same-target rule (one door when page and tickets are the
same page), cancelled shows losing the tickets door, the order Tix then Info.

The data shape grows by two optional fields, both or neither:
`"tickets": { "url": "...", "at": "AXS", "price": 69, "checked": "2026-09-26" }`

- `price` — whole US dollars, the cheapest ticket you could buy online at `checked`.
  Use the all-in price the seller shows when it shows one (US live-event sellers
  have had to show the total price since the FTC's May 2025 rule); round cents UP
  (never understate). 0 means a free ticket/RSVP. Integer 0–2000.
- `checked` — ISO date (YYYY-MM-DD) the price was read.

Update the validator (find where it enforces "anything but `{ url, at }`" — the docs
section named below describes it) to accept those two fields with exactly those
rules and to error on: price without checked, checked without price, a non-integer
or out-of-range price, a malformed date. Do not tighten anything else. The bill rule
(every name on one bill carries the same `tickets`) holds — a price goes on every
name of the bill; check what `tests/show-links.test.mjs` compares and keep it
passing honestly.

Update, in the same commit or the next: `tests/show-links.test.mjs`,
`tests/events-wall.test.mjs`, `tests/browser/show-links.test.mjs`, the comments that
quote the old text in `js/v3/events.js` and `js/v3/card-facts.js`, `gallery.html`
(its zoom state with doors — show one priced and one unpriced door), and
`docs/add-a-festival.md` §"Event pages and tickets" (the example, the field table,
the validator sentence, and one line on what `price`/`checked` mean). Add unit tests
for: no price → `Tix`, 69 → `Tix $69`, 0 → `Tix free`, page → `Info`, and the
validator's new errors.

Do NOT run `scripts/sw-stamp.mjs`. Changing `events.js` changes the asset stamp, so
`tests/app-shell-complete.test.mjs` will report a stale stamp — that one failure is
expected; the release stamps it. Every other test must pass: `npm test`,
`node scripts/validate-festivals.mjs`, and `npm run test:browser` (run it; if a
WebKit case fails, say which and whether it also fails on b4f562a).

## Part 2 — the prices (data, the bulk of the work)

Price every `tickets` link for shows that have not happened yet:

1. `data/festivals/portola-2026.json` — entries whose night/date is **Saturday
   Sep 26 or Sunday Sep 27** (afters and Folsom). Skip Friday; it is over.
2. `data/festivals/acl-2026.json` — all 65 ticketed Late nights entries
   (Sep 29 – Oct 10).

For each show (one bill = one show = one price, applied to every name on it):

- Read the ticket link's page. Firecrawl scrape (`mcp__firecrawl__firecrawl_scrape`,
  load it via ToolSearch; markdown format, `waitFor` a few seconds for JS sellers)
  is the tool. If the seller page is walled or unreadable (Ticketmaster and AXS often
  are), read the show's `page` link instead — the DoStuff listings (DoTheBay, Do512)
  print a price line like "$25 – $45"; take the low end.
- Record the cheapest ticket on sale NOW. If early tiers are sold out, the cheapest
  remaining tier. If every tier is sold out and there is no resale on that link:
  remove `tickets` (the docs' existing rule — the page stays the only door) and note
  it. If the page says door only, same. If you cannot find any price with
  reasonable effort, leave the price off (the door reads `Tix`) and note why —
  a missing price is honest; a guessed one is not.
- Never change a name, a time, a venue, or a URL. Prices and `checked` only, plus
  the sold-out removals above. The pick-key freeze (`tests/fixtures/live-pick-keys.json`)
  must stay green.

The notes file gets one table row per show: show, night, seller, price, where the
price came from (seller page / listing page), status (on sale, tier 1 sold out,
sold out → tickets removed, no price found). Commit data in batches — Portola
Saturday, Portola Sunday, ACL in two or three chunks — validating before each.

## Done means

Pushed branch `data/tix-prices` with the label change, tests, docs, and every
upcoming ticketed show priced or noted. Report back: commits, counts (priced / no
price found / tickets removed as sold out), anything surprising (a price over $150,
a seller that changed, a link that died), the test results (with the one expected
stamp failure named), and screenshot paths of the zoom showing `Tix $NN · Info` and
a bare `Tix` at 390px from gallery.html or the local app. Do not open a PR, do not
merge, do not deploy — the coordinator folds this into the next release. Never load
a crew link (`#g=…`) anywhere and never write to the database; this work touches
only files in this worktree.
