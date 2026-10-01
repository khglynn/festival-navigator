// The calm screen's automatic retry is under way and the person taps
// ‹ Your crews; then the festival file arrives. Before the fix the retry's
// wall replaced the crews by itself (v107 final review). Its twin,
// boot-retry-home.test.mjs, is the retry that fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const TOKEN = 'retryhome_opens_0123456'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let mode = 'dead'; // the festival file: 'dead' fails at once, 'hold' waits on the test
const held = [];
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/')) return json({ festivals: [] });
  if (u.startsWith('/data/festivals/')) {
    if (mode === 'dead') throw new TypeError('Load failed');
    return new Promise((resolve, reject) => held.push({ resolve, reject }));
  }
  return json({ error: 'not in this test' }, 503);
}

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
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('no signal and ACL not on the phone: the calm screen', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error']);
});

test('signal comes back, the retry starts, and the person taps ‹ Your crews while it waits', async () => {
  mode = 'hold';
  window.dispatchEvent(new window.Event('online'));
  await settleUntil(() => held.length > 0, { timeout: 3000 });
  assert.ok(held.length > 0, 'the retry is waiting on the festival file');
  $('error-home').click();
  await settle(50);
  assert.deepEqual(shown(), ['screen-landing']);
});

test('…and the retry gets through after: Your crews stays, no wall lands over it', async () => {
  for (const h of held.splice(0)) h.resolve(json(ACL));
  await settle(400);
  assert.deepEqual(shown(), ['screen-landing'], 'Your crews means it');
  assert.ok(!journal().some((e) => e.kind === 'boot'), 'nothing broke');
});
