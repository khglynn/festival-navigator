# Rollback and data safety — Portola live weekend

**2026-09-25, ~17:00 PT.** Read-only research. Nothing was rolled back,
promoted, pushed, merged or written to any database or Neon branch.
Code read from the worktree `.claude/worktrees/portola-live` at 47a381c. origin/main is
f88bad7, one docs-only merge ahead, with identical code (`git diff --stat 47a381c origin/main`
shows only NOW.md changed).

## The short version

1. **Undoing a release is possible in seconds.** The team is on Vercel Pro,
   so production can go back to any deployment that was ever live, and the
   switch is immediate. The v88 target is `dpl_88SsCH3LoRbnwJZuPn6mLps41n12`.
2. **Two traps, both confirmed:**
   a. Every release is followed by a docs-only "NOW" merge, which makes a
      new production deployment of the same code. A bare `vercel rollback`
      therefore lands on the release you meant to undo. Always name the target.
   b. After a rollback, merges to main stop going live, and that includes
      set-time data drops. Normal behaviour only comes back after a
      `vercel promote`.
3. **Phones follow a rollback within seconds of their next open or
   foreground.** Nothing refuses a lower version. The one delay is by design:
   a phone that is busy (a zoom or sheet open, or a note being typed) keeps
   the old build and shows the "refresh" strip until it is quiet.
4. **Code rollback is safe only when the bad release wrote nothing new.**
   The server checks only what each phone sends, against a strict list of
   allowed keys. Each phone sends all its unsynced edits as one bundle. If
   one entry in that bundle is refused, the phone's whole bundle is blocked
   for good, and there is no button to clear it. v89 → v88 is fully safe:
   v89 changed no data shape, no API and no festival data.
5. **Neon's safety net is thin.** Point-in-time restore covers 24 hours
   only. There are no snapshots and no snapshot schedule. The last named
   backup is the branch `backup-2026-09-23-prefest`, taken 2026-09-23 13:53 UTC.
   Before a risky ship, one `create_branch` call with no compute is the
   cheapest insurance.

---

## A. Rollback runbook

### A0. Before any release this weekend (pre-flight, 1 minute)

1. Record the rollback target **before** merging. It is the newest
   production deployment right now:
   ```
   vercel ls festival-navigator --prod --scope kevinhg 2>/dev/null | head -1
   ```
   (stdout is just the URL list, newest first; the table goes to stderr — checked 2026-09-25.)
   Write its URL and its `dpl_` id into the release PR description.
   (`vercel api "/v6/deployments?projectId=prj_HCHnHnAKpcOLMsh2x1Lbneg78bm1&target=production&limit=5&teamId=team_cPohkMAMdE65aazXLkkHtjND" --raw`
   gives the id and commit SHA per row. That is how F1 below was built.)
2. If the release touches anything in the red lines (section B), take a Neon
   branch first (A6).
3. After merge, verify all three hosts serve the new `CACHE_VERSION`:
   ```
   for h in fest festival crew; do curl -s https://$h.kevinhg.com/service-worker.js | grep -o "festival-nav-v[0-9]*"; done
   ```

### A1. Choose: instant rollback, or revert-forward?

| | Instant rollback | Revert-forward (git revert PR) |
|---|---|---|
| Time to live | Seconds (Vercel: "happens instantaneously"; the CLI waits up to 3 min for confirmation) | About 5 minutes. CI took 211–265 s on the last 5 runs (`gh run list`, 2026-09-25), plus a Vercel build of 8–15 s (`vercel ls` Duration column) |
| Leaves a sticky state? | **Yes.** Auto-assign of domains is turned off until a promote | No |
| Needs CI / review | No | CI yes. Review is Kevin's call for a pure revert (see "Need from Kevin" in the summary) |
| Data drops afterwards | **Blocked** until promote | Normal |

**Recommended play when friends are actively hurt:**
1. Roll back instantly (A2).
2. Put a `git revert` of the release merge on main through a PR. Its
   deployment builds but does not go live.
3. `vercel promote` that deployment (A3). This restores normal
   auto-deploys, running the reverted (known-good) code.

For a cosmetic bug, skip the rollback and revert forward.

### A2. Roll back (exact commands)

Run these from any directory. The deployment URL tells the CLI which project.
If the CLI asks to link a project, add
`--cwd /Users/kevinhalladay-glynn/DevKev/personal/festival-navigator`. That
only reads `.vercel/project.json` there and never touches branches.

```
# Undo v89 -> back to v88 (the v88 release merge, dd8db93):
vercel rollback https://festival-navigator-fwwumiisf-kevinhg.vercel.app --scope kevinhg --yes
#   same thing by id:  vercel rollback dpl_88SsCH3LoRbnwJZuPn6mLps41n12 --scope kevinhg --yes
vercel rollback status festival-navigator --scope kevinhg

# Undo a future v90 -> back to v89: use the URL recorded in A0.
# As of 17:00 PT today that is the current production deployment:
vercel rollback https://festival-navigator-ox2oa516m-kevinhg.vercel.app --scope kevinhg --yes
```

**Never run a bare `vercel rollback` with no target.** See F1. Three of the
last three production deployments are v89 code.

Verify:
```
for h in fest festival crew; do curl -s https://$h.kevinhg.com/service-worker.js | grep -o "festival-nav-v[0-9]*"; done
vercel api "/v9/projects/festival-navigator?teamId=team_cPohkMAMdE65aazXLkkHtjND" --raw \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('autoAssign=',d['autoAssignCustomDomains'],'rollbackTarget=',d.get('lastRollbackTarget'))"
```
After a rollback, expect `autoAssign= False`. Today it reads `True` and
`lastRollbackTarget=None`, meaning production is not in a rolled-back state.

### A3. Get back to normal (undo the rollback)

Vercel docs, current as of their 2026-07-07 update: "After a rollback, Vercel turns off
auto-assignment of production domains. This means new pushes to your
production branch won't go live automatically. To restore normal deployment
behavior, you need to undo the rollback by promoting a different deployment."
The CLI form is `vercel promote [deployment-id or url]`, which "promotes the
specified deployment and restores auto-assignment of production domains".

```
# 1. Merge the fix/revert to main first (CI green). It BUILDS a production deployment that is NOT aliased.
vercel ls festival-navigator --prod --scope kevinhg 2>/dev/null | head -1     # newest = the fix (built, not live)
vercel promote https://festival-navigator-<fix-slug>-kevinhg.vercel.app --scope kevinhg --yes
vercel promote status festival-navigator --scope kevinhg
# 2. Verify: three hosts show the fix's CACHE_VERSION, and autoAssign= True (A2 command).
```
Do **not** promote main's newest deployment until the bad code is reverted on
main. A promote ships whatever main holds.

### A4. Rollback targets as of 2026-09-25 ~17:00 PT

| Slug | Created (PT) | Deployment id | Commit | What | Code |
|---|---|---|---|---|---|
| ox2oa516m | 09-25 16:50 | dpl_Cr5mNCTXNNSXsgRe5dYK7XBsKSFw | f88bad7 | docs: NOW (#36). **Current prod** | v89 |
| 1i3d9ifyk | 09-25 16:45 | dpl_2EfT2bBhRDmHmHUDuMpus7YSQjic | 47a381c | ops: PostHog alert script (#35) | v89 |
| q6s6sedvm | 09-25 15:10 | dpl_Awxhu4fzQTpVNGzrTdxxdjvvUYSb | 7a0b190 | docs: NOW after v89 (#34) | v89 |
| **7s3byr0i6** | 09-25 14:51 | **dpl_37kCZTCZ2g2Cv9CY7N4mo93dzpRz** | ed4826b | **v89 release merge** | v89 |
| **fwwumiisf** | 09-25 13:24 | **dpl_88SsCH3LoRbnwJZuPn6mLps41n12** | dd8db93 | **v88 release merge** | v88 |
| 3epqn12km | 09-25 00:10 | dpl_6ShnqZgojxzkArFqwGPkw7vxu7gX | 28f8c45 | data: Sun Midway bill | v87 + today's data |
| 7kscsr053 | 09-24 23:59 | dpl_BZxzzbqoPpBkv6gC1ndpfaHHve9e | d4669bd | v87 release merge | v87 |

The full URL is `https://festival-navigator-<slug>-kevinhg.vercel.app`. Every
row is READY with `isRollbackCandidate=true`.

v88 → v89 is safe to reverse:
1. `git diff --stat dd8db93 ed4826b` shows client JS/CSS and the service worker
   only. No api/, db/ or data/ change.
2. The only change on a write path is the removed must-undo toast (app.js).
3. `git diff --stat dd8db93 origin/main -- data/` is empty, so **rolling back
   to v88 loses no festival data**.
4. index.html is byte-identical between v88 and v89.

### A5. What phones do after a rollback (vN+1 → vN)

1. **Instant, for all requests.** Skew Protection is enabled on the project
   (`skewProtectionMaxAge=43200`), but it only pins clients that send
   `x-deployment-id`, `?dpl=` or a `__vdpl` cookie. This app does none of
   those: the repo grep has zero hits and prod `/` sets no cookie. So HTML,
   /api, and festival JSON all come from the rolled-back deployment on the
   very next request. Every file is served
   `cache-control: public, max-age=0, must-revalidate` with an ETag (measured
   with curl), so no HTTP cache holds the new bytes.
2. **Open app, in the foreground or brought back to it.** index.html:346-349
   calls `reg.update()` on every `visibilitychange → visible` and every 10
   minutes. The browser sees that service-worker.js bytes changed, because
   the `CACHE_VERSION` string differs, and installs the vN worker:
   a. It downloads 38 APP_CORE files (963 KB uncompressed), atomically
      (service-worker.js:22-61, 86).
   b. It calls `skipWaiting` (:89).
   c. Activate deletes every other version cache, including vN+1's
      (:106-121), then claims the page (:123).
   d. `controllerchange` (index.html:336-343) reloads at once if the page is
      quiet. Otherwise it shows the persistent strip (app.js:1226-1240) and
      retries on every visibility change and every 15 s (index.html:344-345).
3. **Closed app, next open.** The navigation is network-first with a 1.5 s
   budget (service-worker.js:239, 267-272), so it gets vN's index.html. For
   that one load the modules still come from the old worker's cache. The
   browser checks the worker on navigation, installs vN, and reloads when
   quiet. On a working network, a phone is on vN within seconds of opening.
4. **Offline during the rollback.** The phone keeps running its vN+1 shell:
   the navigation fails over to its own cached shell after 1.5 s. Picks queue
   locally. On reconnect it pushes its queue to the vN API first, then
   updates as in item 2. That push is where data compatibility bites (section C).
5. **Nothing refuses or wedges a downgrade.**
   a. There is no version comparison anywhere in service-worker.js,
      index.html or js/. errlog.js only reads cache names to label crash
      reports (errlog.js:365-395, 1004).
   b. Three small delays exist, all self-healing:
      1. The install is all-or-nothing. If one file fails to download on bad
         signal, the old worker keeps serving until the next check
         (service-worker.js:19-21).
      2. A new worker that is mid-install when the domains switch can cache
         a mix of both builds. The next update check cures it, because
         service-worker.js bytes differ again.
      3. A busy phone (zoom or sheet open, or text in a field;
         index.html:323-332) stays on the bad build until it goes quiet or
         the person taps Refresh.
   c. Cosmetic: after a downgrade the strip still says "refresh to run the
      latest".
6. **Festival data** is fetched network-first with a 4 s budget, from a
   persistent cache that survives shell changes (service-worker.js:16, 174-184,
   252-260). Rolled-back data therefore replaces what phones hold on their
   next online fetch.

### A6. Neon insurance before a risky ship

1. **How the 2026-09-23 backup was taken** (session transcript 4a3c7e10,
   13:53 UTC):
   a. The Neon MCP call
      `create_branch {project_id: "floral-meadow-70237530", name: "backup-2026-09-23-prefest", no_compute: true}`.
      Result: branch `br-restless-fog-ajh8wujm`, parent_timestamp
      2026-09-23T13:53:32Z, state `ready`, 0 compute seconds used
      (`list_branches`, read today).
   b. A one-off node script using `@neondatabase/serverless` that ran
      `SELECT`s on `crews`, `persons` and `custom_festivals` and wrote JSON to
      `~/.claude/plans/festival-navigator-backups/2026-09-23/` (crews.json
      79 KB, persons.json 42 KB, custom_festivals.json 20 KB). The folder is
      outside the repo because the files hold tokens.
   c. Hygiene note: that command pasted the DATABASE_URL literal inline, so
      the credential now sits in a local session transcript. Next time, use
      `vercel env pull` into a scratch file, or the Neon MCP.
   d. The older branch `backup-2026-08-27-pre-portola-drop` is now `archived`
      (idle branches archive; it can still be restored but wakes slowly).
2. **Current safety net** (`describe_project`, `list_snapshots`,
   `get_snapshot_schedule`):
   a. `history_retention_seconds = 86400`: point-in-time restore reaches back
      **24 hours only**.
   b. Plan: `launch_v3`.
   c. Snapshots: none. Snapshot schedule on main (`br-hidden-mouse-aj4svhyd`):
      empty.
   d. DB logical size is about 31.7 MB.
   e. The maintenance window is Fridays 07:00-08:00 UTC (00:00-01:00 PDT
      Fri), so not during the Sat/Sun sets.
3. **Cheapest snapshot before a risky ship:** the same single call, e.g.
   `create_branch {project_id: "floral-meadow-70237530", name: "backup-2026-09-26-pre-v90", no_compute: true}`.
   It is copy-on-write and instant, uses no compute, and storage only grows
   with divergence. It creates a Neon branch, so the session will need a
   permission OK. It writes nothing to production tables.
   `create_snapshot` on `br-hidden-mouse-aj4svhyd` is the alternative;
   named branches are the precedent here. Add the JSON export only when a
   release touches doc shape.
4. **Never restore main wholesale mid-festival.** It would erase every pick
   and note friends wrote after the backup. Repair per crew instead:
   a. Read that crew's doc from the JSON export, or from the backup branch
      with a temporary read-only compute.
   b. Re-merge the missing leaves through the normal merge.
   c. Deletions cannot be expressed through `jsonb_deep_merge`
      (schema.sql:8). Removing a bad key from stored docs therefore needs a
      direct SQL `UPDATE … SET doc = doc #- '{path}'`. That is Kevin's call:
      it writes friends' real data.
5. **Worth asking Kevin:** raise PITR retention from 1 day to several days
   for the Portola → ACL fortnight (a project setting; check the Launch-plan
   cap in the console). At 24 hours, a problem noticed Monday morning cannot
   be restored to Saturday.

---

## B. Red lines while the festival is live (Sat Sep 26 – Sun Sep 27 + afters, and ACL Oct 2–11)

Each item below must not ship without Kevin's explicit call. The evidence is
in section C.

1. **A client that writes a new key, shape, note scope or value range into
   a crew doc or person doc.** A rollback strands every phone that has the
   new shape in its unsynced queue: the whole queue is refused forever, and
   there is no discard button (C2, C3). Offline phones in a field are the
   common case.
   a. The only safe order is expand, then use. Ship server acceptance in
      one release and let it soak. Ship the client writer in a later
      release. Never roll back below the acceptance release.
   b. Stored docs also keep the new key forever, because merges cannot
      delete (schema.sql:8).
2. **Tightening any validator or limit.** This covers `validateIncoming` /
   `validatePersonIncoming` (crew-shared.mjs:358-367, 416-436), the merge
   SQL WHERE clauses (crew-sql.mjs:29-39), `LIMITS` (crew-shared.mjs:13-27),
   name rules in `js/name-rules.mjs`, and `TOKEN_RE` / `PID_RE`
   (crew-shared.mjs:29, 35). Phones still on the old build (busy tabs,
   offline queues) get their whole queue blocked going forward (C3).
3. **Changing the meaning of an existing value, or any server-side migration
   of stored docs.** Examples: pick levels, `removed`, note `deleted` or `re`,
   or a new `?op=` like the v3→v4 migrate (crew.js:75-101). Validators cannot
   see meaning, which is why the `sv:4` guard exists (crew.js:109-129). A
   migration that rewrote stored docs cannot be undone by rolling back code.
4. **Any database change:** `jsonb_deep_merge()`, CHECK constraints, tables,
   or applying `db/schema.sql`. The DB is shared by every deployment,
   including previews and localhost. A Vercel rollback reverts code, never
   the database.
5. **Renaming or removing an artist name, festival id or note-target key
   format** in a live fest. Artist names are pick keys with no rename path
   (CLAUDE.md; `tests/fixtures/live-pick-keys.json`). A date/section target
   format change (`<iso>|<section>`) orphans notes. A cancelled act keeps
   its name.
6. **Changing the update machinery itself:** service-worker.js strategies,
   `APP_CORE` handling, activate cleanup, the `DATA_CACHE` name, the
   navigation fallback, or index.html's `quiet()` / `controllerchange` /
   `reg.update` glue. This is the channel every fix and every rollback
   travels through. A bug here can pin phones on a bad build that no Vercel
   rollback reaches. Renaming `DATA_CACHE` would also delete every phone's
   offline festival data on activate (service-worker.js:106-121).
7. **Env var changes, or vercel.json rewrites and headers.**
   a. Vercel docs: "Vercel won't update environment variables if you change
      them… and will roll back to a previous build". A deployment runs with
      its build-time env. No production env var has changed since
      2026-07-07 (project env `updatedAt`).
   b. Adding long `max-age` caching to JS would let the HTTP cache feed stale
      bytes into a service-worker install. Today every file is `max-age=0`.
8. **Changing the response shape of GET `/api/crew` or `/api/person`.**
   Every open phone parses it, including phones still on the old build.

**Process rules (not a Kevin call, just discipline):**
1. Name the rollback target in every release PR (A0).
2. Never run a bare `vercel rollback`.
3. After any rollback, the session that did it owns the promote (A3). Until
   then, no data drop reaches phones. That is the easiest way to silently
   freeze Sunday's set times.
4. Merge one release at a time, and verify it before the next.

**Rollback-safe (ship freely under the standing rules):**
1. Client UI, CSS and motion changes that write nothing new. v89 is exactly
   this.
2. Festival data that only **adds**: sets, times, openers, the `cancelled`
   flag (validator + freeze + CI).
3. Server changes that only **loosen** validation, as long as no client
   writes the new thing in the same release.

---

## C. Evidence

### C1. Deployments and hosts (F1)
1. Source: `vercel api /v6/deployments?...target=production`, which gives
   the commit SHA and message per deployment; table in A4. `vercel inspect`
   on ox2oa516m lists the aliases: crew / fest / dev.fest / festival
   .kevinhg.com, plus four vercel.app aliases.
2. Live curl: all three hosts serve `festival-nav-v89`, ASSET_STAMP
   `4ad32b2f`.
3. Project settings (`vercel api /v9/projects/<id>`):
   a. `autoAssignCustomDomains=true`, `lastRollbackTarget=null`
   b. `ssoProtection=all_except_custom_domains`: the unique
      `*-kevinhg.vercel.app` URLs 302 to a Vercel login, so a rollback target
      cannot be walked without a logged-in browser. Read the files from git
      at that commit instead.
   c. `deploymentExpiration.expirationDaysProduction=365`
   d. No rolling release configured. No cron jobs (vercel.json).
4. Team plan: Pro (`vercel api /v2/teams/<team>`). Pro can roll back to any
   eligible deployment; Hobby only to the previous one.
5. `.vercelignore` drops NOW.md, claude-plans/, tests/ and scripts/ from the
   upload, but each merge to main still creates a production deployment.
   That is how three v89-code deployments exist.

### C2. The server validates only what is sent, and allows only known keys
1. The merge path runs `validateIncoming(incoming)` only (crew.js:105-107).
   The SQL then enforces size, active-member count and case-duplicate names
   (crew-sql.mjs:24-40). `validateMergedDoc` runs only on create
   (crew.js:59); its own comment says the SQL does the rest
   (crew-shared.mjs:369-372). **The stored doc is never re-validated.** A
   key that vN+1 stored does not block vN's merges for that crew.
2. Allowlists are used everywhere, and an unknown key means a 400:
   a. sections (crew-shared.mjs:358-366)
   b. people keys (:101-106)
   c. festival-entry keys (:230-237)
   d. note keys (:142-155) and scopes artist/day/fest (:132, :209)
   e. levels 0..4 only (:122)
   f. affinity (:251-254), spotify (:293-304), meta (:311-318),
      playlists (:271-285)
   g. the person doc (:416-436)
3. The client ignores unknown stored keys rather than crashing. For example,
   `totalNoteCount` reads only the `fest` / `artist` / `day` scopes
   (model.js:119-125).

### C3. One refused entry blocks a phone's whole queue
1. Unsynced edits are one object, `state.pendingChanges`, persisted to
   localStorage at `fn_crew_pending_v3_<token>` (state.js:25, 33, 66) and
   reloaded as-is on boot. The only repair on load is
   `healPlaylistArtists` (state.js:317-336).
2. A push sends the whole object (sync.js:106, 124). A 400 or 413 saves the
   refused bytes and sets the phone to `blocked` (sync.js:133-147).
3. A new edit changes the bundle, so the phone retries, but the bundle still
   carries the refused entry and is refused again.
4. The toast says "they'll sync as soon as the crew has room"
   (app.js:2799-2802). There is no UI to discard unsynced edits.
5. Precedents:
   a. 2026-07-13: a corrupted playlist array "was refused by the server on
      every push — sync-blocking the device (live)". Only a new client build
      with a heal-on-load step fixed it (state.js:317-323).
   b. DEVLOG ~L814-818: a note sent without author/ts would have "turned
      into a permanently blocked device".
6. So, after a bad rollback, a phone's stuck queue is freed only by
   **rolling forward** with a client that heals or drops the stuck entry.
   Rolling back does not free it.

### C4. What each kind of change does to a rollback

| Change | Stored doc after rollback | Phones after rollback | Rollback-safe? |
|---|---|---|---|
| UI / CSS only (v89) | untouched | reload to vN | **Yes** |
| Festival data: add sets/openers/times | n/a | the rolled-back data lacks the new acts, so picks made on them hide (still stored) until roll-forward | Yes, if the target has the same data. Check `git diff <target> main -- data/` |
| Festival data: rename/remove a name | n/a | picks orphaned | **No** (and banned anyway) |
| Client writes a new key/shape | new key stays forever (merges can't delete) | offline or unflushed phones blocked on everything queued | **No** |
| Server loosens validation only | untouched | fine | Yes |
| Server tightens validation | untouched | forward break for old phones; rollback fixes it | Forward-unsafe |
| Merge SQL in crew-sql.mjs | code reverts | fine | Yes, if the statement change is pure |
| `jsonb_deep_merge` / schema in the DB | **not reverted** | all deployments affected | **No** |
| Meaning change / migrate op | rewritten data stays | old code misreads it | **No** |
| Person token / pid rules | rows keep their format | 400 "malformed" for mismatches | **No** |
| New / changed env var | rolled-back deployment keeps its build-time env | — | Check both deployments |
