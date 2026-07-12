# NOW — festival-navigator: v3.1 FIX PHASE COMPLETE — Kevin's promote call

## POST-COMPACTION NOTE (2026-07-12 morning)

Kevin reviewed the preview, loves it, and is about to share NOTES — the next
arc is his feedback pass on the v3.1 build. Receive those notes per
hg-partner (signal, not spec) with the fix-phase grounding doc's quality bar
(`claude-plans/2026-07-11-v31-fix-phase-grounding.md` — the brief still
rules). Work continues on `v31-polish` until Kevin promotes; do not re-open
finished classes unless his notes point there. Everything below this section
is the standing state: the promote steps, his queued actions, and what
shipped. The Stage-4 findings + disposition (incl. four design calls
deliberately left for him) live in
`claude-plans/2026-07-12-v31-stage4-audit-backlog.md`.

**Updated:** 2026-07-12 ~01:30 CT · **Branch:** `v31-polish` (pushed; preview
verified) · **History:** DEVLOG.md · **Audit result:**
`claude-plans/2026-07-12-v31-stage4-audit-backlog.md`

## THE DECISION IN FRONT OF KEVIN

**Promote `v31-polish` to production** (your call, always):

1. Review the preview: `vercel ls festival-navigator` → newest Preview URL
   (deployment-protected — open it logged into Vercel, or
   `vercel promote <url>` straight from the CLI after your own look).
2. Merge: `git checkout main && git merge v31-polish && git push` (Vercel
   auto-deploys main to the three prod domains; SW bumps v14 → v15 which
   force-refreshes every installed client's shell).
3. After promote, one manual action queued below (Spotify dashboard).

## What shipped (the whole v3.1 backlog + everything the gates found)

- All 73 discovery findings (1 P0 / 32 P1 / 40 P2) fixed across 7 classes:
  invite context (with self-healing backfill for links already in group
  chats), the broken-behavior CORE sweep, history-backed navigation, lost
  states, the desktop body (day rail, dialogs, full-bleed timetable, fluid
  type), a11y layer (computed AA contrast, keyboard-first cards, dialog
  semantics), notes home w/ edit+delete, everything-else column, ACL weekend
  view, five-state Spotify drill on one OAuth origin, honest SW/sync/PWA.
- Both gates passed with findings, ALL addressed: Codex diff review (2 rounds
  — router refresh P1 reproduced+fixed; rename tombstones; setup ungated) and
  the 71-agent Stage-4 audit re-run (0 P0, ZERO discovery findings
  rediscovered; its 4 P1s fixed same-session — repaint now preserves scroll/
  drafts/focus, sort popover clamps, OAuth returns land in the drill).
- Tests 63 → 89 green · validator clean · 20 commits on `v31-polish`.

## ⚠️ KEVIN ACTIONS QUEUED

1. **Spotify dashboard (SPOT-1):** add redirect URI
   `https://fest.kevinhg.com/spotify-callback` to the crew Spotify app at
   developer.spotify.com/dashboard. The app now canonicalizes all OAuth to
   fest.kevinhg.com (aliases hop with crew+fest context carried).
2. **FYI — token incident, resolved, no action needed:** a mid-run commit
   briefly (minutes) exposed two AUDIT-crew tokens on the public repo
   (walker logs swept in by `git add -A`). History rewritten same minute;
   both crews were disposable audit artifacts and are now deleted, mooting
   the exposure. **No real crew token was exposed.** Process hardened
   (gitignore + gated scans + memory).
3. **Fast-follows for your call** (from the audit, deliberately not done
   unattended): settings drills' desktop composition (the atlas says 560px
   column on purpose — the audit disagrees; your taste decides), in-app
   research provenance for saved fests, The-Crew token rotation from the
   2026-07-09 NOW.md leak (still pending, unrelated to this run).

## Standing facts

- Preview env now has DATABASE_URL (added this run — previews hit the real
  Neon DB). GEMINI_API_KEY already covered Preview.
- Audit crews (Audit Rig, Portola 26) deleted at teardown; walker scratch
  dirs (390/ 768/ 1440/ offline/) are gitignored — never commit them.
- Crew links in chat/scratchpad only — never commit a token; token scans
  GATE commits (`&&`, never `;`).
