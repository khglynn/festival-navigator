# Release pipeline map — the mechanics of shipping this weekend

Researcher slice: the release pipeline end-to-end — CI jobs/timing, what
actually protects `main`, how a release is assembled/stamped, production
verification (baseline taken live), and vercel.json caching/routing/preview
protection.

Read-only throughout. Worked from
`/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live`
(a clean checkout of `origin/main`, HEAD `47a381c`). No pushes, merges,
deploys, rollbacks, or DB writes were performed. Curl calls hit **production**
(fest/festival/crew.kevinhg.com, GET only) and one **preview** URL (GET only,
to observe its redirect — did not authenticate or click through). No secret
values are printed anywhere below; only variable *names* are cited.

Baseline moment for this whole doc: **2026-09-26 00:04 UTC / 2026-09-25 7:04 PM CT**.

---

## 1. CI (`.github/workflows/ci.yml`)

Two jobs, both `ubuntu-latest`, triggered on every `push` and every
`pull_request` (so a PR branch gets CI twice per push: once as `push`, once
as `pull_request` — that's why you'll see run pairs a few seconds apart).

**`checks`** (line 8) — the fast path:
1. `npm ci`
2. `npm test` (`node --test tests/*.test.mjs`) — this is where
   `tests/app-shell-complete.test.mjs` catches a stale `ASSET_STAMP` (see §3);
   there is no separate `sw-stamp.mjs --check` step in CI, the check is
   embedded in the unit suite instead.
3. `TZ=Asia/Tokyo npm test` — same suite, run again under a non-UTC,
   non-US zone. Comment in the file explains why: a 2026-08-27 bug keyed a
   Portola instant to the *runner's* date: UTC alone didn't catch it, a far
   zone does, every time. Runner default is UTC (no explicit TZ set on the
   first run).
4. `node scripts/validate-festivals.mjs` — the festival-JSON schema/pick-key
   guard.
5. `npm audit --omit=dev --audit-level=high` — prod deps only, high+ only.

**`browser`** (line 32) — the slow path, and the one that matters most for a
UI-feedback weekend:
1. `npm ci`
2. `npx playwright install --with-deps chromium`
3. `npm run test:browser` (`BROWSER_TEST_REQUIRED=1 node --test
   tests/browser/*.test.mjs`) — real Chromium, real pointer/keyboard input
   against `gallery.html`. This is the job that has historically caught what
   jsdom can't (hover/zoom regressions, per CLAUDE.md's "Node tests are
   blind to two browser rules").

### Timing — measured from the last 10 completed runs on `main` (5) and on
the three PR branches that became #33/#35/#36 (5), all from today (2026-09-25,
the only real day of history — see the branch-protection note on repo age
below). Wall-clock = job `started_at` → `completed_at` via
`gh api repos/khglynn/festival-navigator/actions/runs/<id>/jobs`.

| Job | Median | Worst (of the 10 sampled) | Best |
|---|---|---|---|
| `checks` | **~2m17s** (137s) | ~2m27s (147s) | ~1m43s (103s) |
| `browser` | **~3m45s** (225s) | ~4m01s (241s) | ~3m27s (207s) |

Both jobs start together and run in parallel, so **total time from push to a
green PR is the `browser` job's time — call it ~3.5–4 minutes**, not the sum.
That's the number to plan around for "how long until I know this is safe to
merge."

Raw run IDs used (for anyone who wants to re-derive this):
main pushes `36202569061 36202204661 36195411331 36193816557 36185545512`;
PR-branch pushes `36193429576 36192404319 36189974687 36201947687 36202257562`.

Two workflows adjacent to CI that are **not** part of the gate: `Copilot`
(auto-runs "Running Copilot Code Review" on pushes — an extra signal, not
required) and `pages-build-deployment` (GitHub Pages — unrelated leftover,
not this app's hosting; the app is 100% Vercel). Don't confuse either with
the release gate.

---

## 2. What protects `main`

Read via `gh api repos/khglynn/festival-navigator/rulesets` +
`rulesets/23242124` (read-only GETs).

```
name: standards-ci · target: branch · enforcement: active
conditions: ref_name include ["~DEFAULT_BRANCH"]
rules: [ { type: required_status_checks,
           parameters: { required_status_checks: [ { context: "checks" } ],
                         strict_required_status_checks_policy: false } } ]
bypass_actors: [ { actor_id: 5, actor_type: RepositoryRole, bypass_mode: "always" } ]
current_user_can_bypass: "always"
```

**Two things worth flagging plainly:**

- **Only the `checks` job is a required status check. `browser` is not.**
  GitHub will happily let a PR merge (or a direct push land) with `checks`
  green and `browser` red, or `browser` still running, or `browser` never
  having run at all. Nothing technical stops that. The actual practice —
  confirmed in `claude-plans/2026-09-24-analytics/BUILD.md` line 355 ("PR
  head... green on both jobs") — is that whoever ships checks *both* jobs by
  hand before merging. That's a human/agent discipline, not a GitHub
  guarantee. For a weekend where a phone-bound Kevin can't eyeball the
  Actions tab, whatever session does the shipping needs to check `browser`'s
  conclusion itself (`gh pr checks <PR>` lists both jobs by name) rather than
  trusting "the PR shows mergeable" as proof the hover/zoom contract passed.
- **There is no "require a pull request before merging" rule in this
  ruleset** — only the status-check rule above. CLAUDE.md's release-gate
  section says "the ruleset requires a PR and the CI check," but the ruleset
  itself only encodes the CI-check half; nothing here technically blocks a
  direct `git push` straight to `main` (for anyone with write access — and
  the repo owner's role bypasses the ruleset entirely, "always"). In
  practice every recent release *did* go through a PR + merge commit (below),
  so this is process discipline carrying weight the tooling doesn't — worth
  Kevin knowing so "the ruleset has my back" isn't overstated. This one's a
  documentation-vs-reality gap, not something I'd change unasked (flagging
  it, not fixing it — that's a product call, not a research one).

**Merge method used for #33/#35/#36:** confirmed by `git log --merges` — each
PR's `mergeCommit` oid (`ed4826b`, `47a381c`, `f88bad7`) is a real 2-parent
merge commit, not a squash or rebase. So `gh pr merge <N> --merge` (or the
"Create a merge commit" button) is the established method; using `--squash`
or `--rebase` on a future release PR would be a behavior change from what
history shows, not neutral.

---

## 3. How a release is assembled and stamped

Two constants live at the top of `service-worker.js` (currently lines 5–6):

```
const CACHE_VERSION = 'festival-nav-v89'; // ...changelog-in-a-comment for the version
const ASSET_STAMP = '4ad32b2f'; // sha1 of APP_CORE — node scripts/sw-stamp.mjs after any cached-asset change
```

`scripts/sw-stamp.mjs` is the only thing that's supposed to touch either line:

- **`node scripts/sw-stamp.mjs`** (no flag) — bumps `CACHE_VERSION` by exactly
  one and rewrites `ASSET_STAMP` to the current sha1 of every file listed in
  `APP_CORE` (the service worker's own cache manifest). This is the **real
  release cut** — it's what makes a shipped version's SW cache name unique
  so installed phones actually fetch new bytes instead of serving the old
  cache forever.
- **`--keep`** — re-stamps `ASSET_STAMP` only, leaves `CACHE_VERSION`
  unchanged. Used for every fix made *while a version is still unreleased*
  (i.e., still only on a preview URL, hasn't gone out as a numbered
  production release yet) — so five review-round fixes to "v88" don't burn
  five version numbers, they all land as v88's one true release stamp.
  Real commits from git history: `d9c68a8 chore: re-stamp v88 (unreleased,
  --keep) — the door-pick focus fix`, `e0c77ba chore: re-stamp v89
  (unreleased, --keep) — review fixes`.
- **`--check`** — exits 1 if the stamp is stale. **Not wired into CI as a
  separate step** — the equivalent assertion lives inside the unit suite
  (`tests/app-shell-complete.test.mjs`, which imports `assetStamp`/`readStamp`
  from this same script and fails `npm test` — i.e. the `checks` CI job — if
  they disagree). So "did someone forget to stamp" is already covered by CI
  green; you don't need to run `--check` by hand as a separate gate, but it's
  there for a fast local sanity check before opening a PR.

**Version-naming convention** (from `git log --all | grep stamp`, oldest→
newest of the ones sampled): `chore: stamp vNN — <one-line summary of what's
in this real release>` for the version-bump commit, `chore: re-stamp vNN
(unreleased, --keep) — <specific fix>` for every fix commit before that
version actually ships. `docs/add-a-festival.md` and the BUILD.md docs
describe a "coordinator" role that does the *final* re-stamp right before
opening the release PR — i.e. the last commit on a release branch is
typically a re-stamp, not a feature commit, so the shipped bytes are known-
final at the moment they're stamped.

**Practical rule to carry into this weekend:** any commit that touches a file
listed in `APP_CORE` (grep `service-worker.js` for the array — currently
`index.html`, both CSS files, both fonts, and every file under `js/` in that
list) needs a `sw-stamp.mjs` run before it's safe to ship, and CI's `checks`
job will already catch it if you forget (red build, not a silent miss).

---

## 4. Production verification — baseline taken live, 2026-09-26 00:04 UTC

Exact commands run (read-only GETs against production; no auth, no writes):

```
curl -s -D - -o sw.js "https://fest.kevinhg.com/service-worker.js"     | grep -Ei "^HTTP|cache-control|etag|x-vercel-cache"
curl -s -D - -o sw.js "https://festival.kevinhg.com/service-worker.js" | grep -Ei "^HTTP|cache-control|etag|x-vercel-cache"
curl -s -D - -o sw.js "https://crew.kevinhg.com/service-worker.js"     | grep -Ei "^HTTP|cache-control|etag|x-vercel-cache"
grep -m1 "CACHE_VERSION\s*=" sw.js   # per host
grep -m1 "ASSET_STAMP\s*=" sw.js     # per host
md5 -q sw.js                          # per host, compare across hosts
```

**Result — all three hosts agree, right now:**

| Host | CACHE_VERSION | ASSET_STAMP | service-worker.js md5 |
|---|---|---|---|
| fest.kevinhg.com | festival-nav-v89 | 4ad32b2f | `24eeb07c1cc0b203079004b2084403ef` |
| festival.kevinhg.com | festival-nav-v89 | 4ad32b2f | `24eeb07c1cc0b203079004b2084403ef` |
| crew.kevinhg.com | festival-nav-v89 | 4ad32b2f | `24eeb07c1cc0b203079004b2084403ef` |

Identical byte-for-byte across all three domains (same md5), identical to
what NOW.md claims ("v89... confirmed on all three hosts... festival-nav-v89,
ASSET_STAMP 4ad32b2f"). `index.html` etag also matched across all three
(`83865aba85adbb0e8a3fe86f65cdd216`). **This is the exact three-line check to
re-run after any future ship** — if any host disagrees with the other two, or
disagrees with what you just stamped, something didn't propagate (stale edge
cache, a host on a different alias/deployment, etc.) and you stop before
telling anyone it's live.

`vercel ls` (read-only) confirms the current Production deployment
(`festival-navigator-ox2oa516m-kevinhg.vercel.app`, 12m old at check time) and
several recent Preview deployments — consistent with the day's PR traffic.
`vercel whoami` confirms the CLI is authenticated as `kevinhg` (the right
team), matching the brief.

---

## 5. `vercel.json` — caching, routing, preview protection

Full file is small; the load-bearing parts:

**No `service-worker.js`/`index.html`/JS-specific cache headers exist.**
The only `headers` rule is a blanket security-header block
(`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`) applied to
`/(.*)`— nothing sets `Cache-Control` at all. In practice (confirmed live,
§4) Vercel's static-hosting default kicks in for every file:
`Cache-Control: public, max-age=0, must-revalidate` plus a strong `ETag`.
That means **the browser always revalidates before trusting a cached copy**
(conditional GET, not "serve stale for N seconds") — this is actually a
*safe* default for exactly the stale-SW risk CLAUDE.md warns about; it's not
a gap, but it's implicit rather than declared, so it's worth knowing it's
Vercel's platform default and not something this repo chose on purpose. If
that default ever changed platform-side, nothing in this repo would notice
until something looked stale.

**Rewrites** (all confirmed present, none touched):
- `/f/:id` → `/api/share?f=:id`, `/f` → `/api/share` (the share-link flow)
- `/fn-i/batch` → `https://us.i.posthog.com/batch` — this is the one
  `js/errlog.js` depends on (CLAUDE.md: "the only door out"); if this rewrite
  ever broke, error/usage reporting from phones would silently go nowhere
  while the app itself kept working fine — a thing worth a synthetic check
  on, not just an eyeball of vercel.json.

**Preview deployment protection — confirmed live, and this matters a lot for
this weekend's workflow:**

```
curl -s -D - "https://festival-navigator-2jh0hj2fi-kevinhg.vercel.app/"
→ HTTP/2 302
→ location: https://vercel.com/sso-api?url=...&nonce=...
```

**Every preview URL is behind Vercel's SSO ("Vercel Authentication")
deployment protection.** A phone that isn't logged into the `kevinhg` Vercel
team in that browser gets bounced to a Vercel login wall, full stop — it
cannot just tap a preview link and see the app. `vercel env ls` shows no
`VERCEL_AUTOMATION_BYPASS_SECRET` configured, so there's also no bypass-token
path set up for letting an unauthenticated device through automatically.

**What this means for the weekend loop:** friends giving live feedback
cannot be handed a preview link to check a fix before it ships — only Kevin
(logged into Vercel) or an already-authenticated CLI/agent session can view a
preview. Real "does this actually work for a friend on their phone"
verification only becomes possible **after** a PR is merged to `main` and
promoted to Production. That raises the cost of being wrong post-merge (no
"friend-tested preview" step exists in this pipeline today) and raises the
value of the two things that *do* run pre-merge: CI's `browser` job (real
Chromium, real input) and the independent Codex/Opus review CLAUDE.md
already requires. Nothing to fix here (adding a bypass secret is a product
decision, not mine to make) — just flagging that "preview it on your phone
first" is not an available safety net this weekend, so the pre-merge checks
are the only checks that happen before real users see a change.

---

## Draft "Ship" runbook

Numbered, with the exact command and its typical duration from the
measurements above. Each step also says who does it, because Kevin cannot
run commands from his phone this weekend — every step below is something
**the shipping Claude session executes itself**, asking Kevin in chat only
for a **yes/no** at the marked gates, never handing him a command to paste.
"Needs Kevin" below means a decision only he can make, not an action only he
can perform.

1. **Make the change on a branch, not `main`.** `git checkout -b <name>`.
   *(instant)*
2. **If the change touched anything in `APP_CORE`** (check
   `service-worker.js`'s array — currently every `js/*`, both CSS files, both
   fonts, `index.html`): run `node scripts/sw-stamp.mjs` for a real release,
   or `node scripts/sw-stamp.mjs --keep` if this is a fix to a version still
   sitting unreleased on a branch. *(instant; skip entirely if nothing
   cache-relevant changed)*
3. **Run the fast suite locally before pushing** — `npm test` and
   `TZ=Asia/Tokyo npm test` and `node scripts/validate-festivals.mjs`.
   Catches the same things CI's `checks` job would, without spending the
   round-trip. *(~10–20s locally, faster than CI's cold-npm-ci ~2m17s)*
4. **Push and open the PR.** `git push -u origin <name>` then
   `gh pr create --fill` (or with a real title/body). *(instant)*
5. **Wait for both CI jobs, by name, not just "PR is green."**
   `gh pr checks <PR>` — confirm **both** `checks` and `browser` show
   success (remember: only `checks` is a required status check, so a merge
   button can look "ready" while `browser` is still red or still running —
   check it yourself). *(~3.5–4 min wall-clock, both jobs run in parallel)*
6. **Independent review** — Codex (or Opus if Codex is out of credits per
   CLAUDE.md), real findings fixed, loop back to step 3 if anything changed.
   *(varies; not timed in this research pass)*
7. **Gate: is this a product call Kevin hasn't seen, or does it touch a
   friend's real data?** If yes → **needs Kevin**, ask in chat with the
   specific question, wait for his answer (a plain yes/no or a pick, not a
   command). If no → proceed; per Kevin's standing rule (CLAUDE.md, "stop
   asking me to merge") this does not need a merge ask.
8. **Merge as a merge commit** — `gh pr merge <PR> --merge` (not
   `--squash`/`--rebase` — every recent release used a real 2-parent merge
   commit; switching methods now would be a quiet process change). *(instant)*
9. **Wait for the `main`-branch CI run to go green too** — same two jobs, same
   ~3.5–4 min, on the merge commit itself. Don't skip this because the PR
   branch was green; the merge commit is a new SHA.
10. **Vercel auto-promotes `main` to Production** (git-connected project;
    no manual `vercel deploy --prod` needed — confirmed by `vercel ls`
    showing Production deployments tracking recent `main` merges within
    minutes). Give it a minute after CI finishes.
11. **Verify all three hosts agree** — the exact three-line check from §4,
    run against `fest.`, `festival.`, and `crew.kevinhg.com`: fetch
    `service-worker.js` from each, compare `CACHE_VERSION`, `ASSET_STAMP`,
    and the file's md5 across all three. All three must match each other
    **and** match the version you just stamped in step 2. *(a few seconds;
    this is the step that would have caught a partial/stale propagation)*
12. **Update NOW.md** with the new version, timestamp, and what shipped —
    the "confirmed on all three hosts at H:MM PT" line is the existing
    convention (see NOW.md's own v89 entry) and is what lets Kevin pick the
    thread back up later without re-deriving any of this.

**What can't be skipped even under time pressure:** step 5's *both-jobs*
check (the ruleset alone won't stop a `browser`-red merge) and step 11's
three-host check (nothing else confirms propagation actually finished — the
Vercel dashboard showing "Ready" means the deployment built, not that DNS/
edge caching for all three custom domains caught up).

**What's structurally unavailable this weekend, so don't plan around it:**
sending a friend a preview link to test before merging — every preview is
behind a Vercel login wall (§5) with no bypass secret configured. If live
in-person feedback needs a "try this before it's real" step, the only way to
get one this weekend is Kevin opening the preview himself (he's logged into
Vercel) and relaying what he sees — a friend's own phone cannot open it.
