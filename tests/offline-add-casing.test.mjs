// BANKED — a follow-up, not this release (2026-09-26, the people build;
// PEOPLE-BUILD.md "Follow-ups"). Written now so the acceptance test exists
// before the fix does; it runs as a TODO and does not fail the suite.
//
// A local-only add (offline, or Stay offline) names the person by what THIS
// phone knows. If the crew already has "Drew" and this phone does not know
// it yet, an offline add of "drew" queues a pending person keyed "drew";
// the server's merge refuses two names that differ only by case
// (api/_lib/crew-sql.mjs, 400 "Someone in the crew already has that name"),
// sync.js treats that as a deterministic refusal, and the phone's sync is
// BLOCKED — every later pick waits behind it until a new edit changes the
// payload. Production's offline add (main, openAddMember's catch branch) has
// the same exposure: it writes people[canonical] with canonical taken from
// the local copy's casing and no reconciliation.
//
// Acceptance: a pending add whose name matches a server person
// case-insensitively reconciles to the server's key and never blocks sync.
// The fix is sync-engine design (reconciling a pending person against the
// server's names), not the Invite sheet's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const CREW = 'offlinecasingtest_crew_01'; // made up, never a real link

// What this phone saw at boot: no Drew. The server gains Drew (another phone)
// once this phone has stopped listening (Stay offline, in the test).
const SEEN = {
  v: 4, meta: { name: 'Casing Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Ana: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
let SERVER = JSON.parse(JSON.stringify(SEEN));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) {
    if (method === 'GET') return json(SERVER);
    const data = (JSON.parse(opts.body).data) || {};
    // The merge's rule: two active names that differ only by case are refused.
    const names = Object.keys(SERVER.people);
    for (const n of Object.keys(data.people || {})) {
      if (names.some((m) => m !== n && m.toLowerCase() === n.toLowerCase())) {
        return json({ error: 'Someone in the crew already has that name — pick one that differs by more than capitalization' }, 400);
      }
    }
    SERVER = deepMerge(SERVER, data);
    return json(SERVER);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${CREW}&f=${FID}`,
  now: '2026-09-20T18:00:00Z',
  fetch: network,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: CREW, name: 'Casing Crew' }]),
    [`fn_me_v3_${CREW}`]: 'Ana',
    [`fn_crew_doc_v3_${CREW}`]: JSON.stringify(SEEN),
    fn_welcome_v1: '1',
    fn_welcome_joined_v1: '1',
  },
});
test.after(() => shell.close());
await settle(200);
const state = await import('../js/state.js');
const sync = await import('../js/sync.js');

test('a pending add whose name matches a server person case-insensitively reconciles to the server’s key and never blocks sync', {
  todo: 'banked: sync-engine reconciliation of a pending person against the server’s names (PEOPLE-BUILD.md follow-ups); production’s offline add has the same exposure',
}, async () => {
  sync.setStayOffline(true);
  SERVER = deepMerge(SERVER, { people: { Drew: { colorIndex: 1 } } }); // another phone; this one does not hear it
  assert.equal(state.people().Drew, undefined, 'this phone does not know Drew');
  document.getElementById('dock-you').click();
  await settle(10);
  document.querySelector('#dock-you-wrap .hl-pop [data-act="invite"]').click();
  await settle(20);
  const sheet = document.querySelector('#artist-sheet.invite-sheet');
  sheet.querySelector('.inv-name input').value = 'drew';
  sheet.querySelector('.inv-add').click();
  await settle(20);
  sync.setStayOffline(false);
  await sync.pushSync();
  await settle(20);
  assert.notEqual(sync.syncState(), 'blocked', 'sync is never blocked by it');
  assert.equal(Object.keys(state.people()).filter((n) => n.toLowerCase() === 'drew').length, 1, 'one Drew');
  assert.ok(state.people().Drew, 'under the server’s key');
  assert.equal(((state.pendingChanges || {}).people || {}).drew, undefined, 'and nothing left pending under the other casing');
});
