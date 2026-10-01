// The join screen's doors with no festival to show (v107 review). A
// personal link (&me=Kevin) on a first visit: the crew answers, the festival
// file does not, so the join screen comes first. Tapping your own name used
// to throw into nothing — an unhandled rejection, the join screen just sitting
// there. Now it is the same calm screen a boot gets, and its retry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const TOKEN = 'joinoffline_person_01234'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Drew: { colorIndex: 1 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/data/festivals/')) throw new TypeError('Load failed');
  return json({ error: 'not in this test' }, 503);
}
const unhandled = [];
process.on('unhandledRejection', (r) => unhandled.push(String((r && r.message) || r)));
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${TOKEN}&f=${FID}&me=Kevin`,
  storage: { fn_welcome_v1: '1' },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('tapping your own name with the festival unreachable is the calm screen, not silence', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-join']);
  const me = [...$('join-people').querySelectorAll('button')].find((b) => /Kevin/.test(b.textContent));
  assert.ok(me, 'Kevin\u2019s name on the join screen');
  me.click();
  await settleUntil(() => shown().includes('screen-error'), { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error']);
  assert.match($('error-msg').textContent, /can’t be reached right now/);
  assert.ok(journal().some((e) => e.kind === 'boot:offline'), `reported as it is: ${JSON.stringify(journal().map((e) => e.kind))}`);
  assert.deepEqual(unhandled, [], 'nothing thrown into the void');
});

test('“Your crews” leaves it, and its retries stop', async () => {
  $('error-home').click();
  await settleUntil(() => shown().includes('screen-landing'), { timeout: 3000 });
  assert.deepEqual(shown(), ['screen-landing']);
});
