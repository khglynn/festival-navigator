// CORE-12, reshaped (2026-10-01): ACL will not load — no signal — but this
// phone HOLDS another festival (Portola, opened at Portola). It shows that
// one for this open, says so, and changes nothing: the phone's own choice
// stays ACL (the old fallback saved Portola over it, so ACL never came back
// on its own), and no membership row is queued for a festival the crew
// never asked for. Nothing is fetched for it: it is read from the copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';
import { cachesHolding } from './helpers/warm-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const PORTOLA = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const TOKEN = 'heldfallback_member_0123'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const asked = [];
async function network(url) {
  const u = String(url);
  asked.push(u);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/data/festivals/')) throw new TypeError('Load failed');
  return json({ error: 'not in this test' }, 503);
}

globalThis.caches = cachesHolding({ '/data/festivals/portola-2026.json': PORTOLA });
const shell = await bootShell({
  url: 'https://fest.kevinhg.com/',
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'ACL Crew' }]),
    fn_active_crew_v3: TOKEN,
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    fn_welcome_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js');
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('a festival this phone holds stands in for this open only — saved choice and crew untouched', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app'], `a wall, not ${JSON.stringify(shown())}: ${JSON.stringify(journal())}`);
  assert.equal(state.activeFestivalId, 'portola-2026');
  assert.match($('toast-root').textContent, /Couldn’t reach ACL Music Festival — showing Portola for now/);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), FID, 'this phone still means ACL');
  assert.ok(!asked.includes('/data/festivals/portola-2026.json'), 'read from the copy, never fetched');
  assert.ok(!journal().some((e) => e.kind === 'boot' || e.kind === 'boot:offline'), 'nothing broke');
});

// The poll rebuilds the doc around the festival on screen (applyRemoteDoc),
// and used to queue its membership row right there — a stand-in Portola
// pushed into the crew's real doc on the first poll after the toast.
test('…and stays out of the crew: no Portola row queued, not on the first poll either', async () => {
  const state = await import('../js/state.js');
  state.applyRemoteDoc(DOC); // what the 25 s poll does with the crew's answer
  const pending = JSON.parse(localStorage.getItem(`fn_crew_pending_v3_${TOKEN}`) || '{}');
  assert.ok(!(pending.festivals && pending.festivals['portola-2026']), `nothing queued for Portola: ${JSON.stringify(pending)}`);
  assert.ok(!(state.pendingChanges.festivals && state.pendingChanges.festivals['portola-2026']), `nor in memory: ${JSON.stringify(state.pendingChanges)}`);
  assert.equal(state.activeFestivalId, 'portola-2026', 'and the wall still shows it');
});
