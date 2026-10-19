# Contributing

Thanks for wanting to help. This is a small personal project, built for a
group of friends and kept in the open, so the process is light.

## Proposing a change

- **A bug or a small fix:** open a pull request against `main`, or an issue
  if you'd rather describe it first.
- **Anything bigger** (a new screen, a change to how picks or notes work, a
  new kind of festival data): open an issue first, so we can talk about the
  shape before you spend an evening on it. Forks that go their own way are
  welcome too; [`docs/fork-setup.md`](docs/fork-setup.md) is for you.
- Say what changes for a person using the app, in plain words, at the top of
  the PR. Screenshots help, as long as they show no real crew link.

## Running the tests

Node 22 or newer (CI runs Node 24).

```sh
npm ci
npm test                                  # unit suite, pinned clock, real merge SQL in-process
npx playwright install chromium webkit    # once
npm run test:browser                      # real-input contracts in Chromium and WebKit
```

CI runs both on every pull request, on Linux. A fix to a bug comes with a
test that fails without it.

## The few rules you could trip on

- **Never commit a crew link or a token.** This repo is public, and an
  address with `#g=` in it is access to a real crew. The same goes for a
  "My link" and for screenshots that show either. `.gitignore` refuses
  images by default for this reason; if you add one that should ship, name
  it there explicitly.
- **Artist names are pick keys.** Everyone's picks are stored under the
  artist's name exactly as the festival file spells it. Renaming or deleting
  an artist in a festival people are using orphans their picks for good, and
  `tests/fixtures/live-pick-keys.json` makes CI fail if you do. A cancelled
  act stays in the file, marked `cancelled`
  ([`docs/add-a-festival.md`](docs/add-a-festival.md)).
- **Run `node scripts/validate-festivals.mjs`** before committing festival
  data. CI runs it too.
- **Bump the stamp.** After changing any file the service worker caches
  (the app's HTML, JS, CSS and fonts), run
  `node scripts/sw-stamp.mjs`, or phones keep the old version and the test
  suite fails to remind you.
- **Look values up, don't invent them.** Colors, sizes and motion come from
  `assets/v3-tokens.css` and `js/v3/motion.js`.

[`AGENTS.md`](AGENTS.md) holds the rest of the repo's rules and the reasons
behind them. It is written for coding agents, and it works just as well for
people.
