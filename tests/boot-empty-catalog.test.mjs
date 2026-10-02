// A first visit whose catalog never arrives (2026-10-01). The invite link is
// opened on a weak signal: the crew answers, index.json does not, and no
// worker controls the page yet, so there is no copy of it either. Activation
// needs a catalog, and threw a TypeError from defaultFestivalId on the empty
// list — the loud "app won't open" for what is only no signal. Now: the calm
// screen, its own kind, and it opens by itself once the catalog comes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const TOKEN = 'emptycatalog_first_01234'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let dead = true;
async function network(url) {
  const u = String(url);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (dead && u.startsWith('/data/festivals/')) throw new TypeError('Load failed');
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(ACL);
  return json({ error: 'not in this test' }, 404);
}

const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${TOKEN}&f=${FID}`,
  storage: { fn_welcome_v1: '1' },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('no catalog on a first visit is the calm no-signal screen, not a crash', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error']);
  assert.ok(!journal().some((e) => e.kind === 'boot'), `not a crash: ${JSON.stringify(journal())}`);
  assert.ok(journal().some((e) => e.kind === 'boot:offline'));
  assert.match($('screen-error').textContent, /can’t be reached right now/);
});

test('the catalog comes back: the wall opens by itself, on the link’s festival', async () => {
  dead = false;
  window.dispatchEvent(new window.Event('online'));
  await settleUntil(() => shown().includes('screen-app'), { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app']);
  const state = await import('../js/state.js');
  assert.equal(state.activeFestivalId, FID);
});
