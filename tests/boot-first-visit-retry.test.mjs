// The calm screen's own retry, still without signal (v107 review). A first
// visit: the crew doc arrived, the festival file did not, and a guest's doc
// is never written to this phone — so the retry, unable to fetch the doc
// again, fell to the bad-link screen ("the crew service hit an error") and
// stopped retrying. It keeps the doc the page had, keeps the link (its view,
// its festival) as it was, and opens by itself once signal is back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const TOKEN = 'firstvisitretry_guest_01'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { 'Sabrina Carpenter': { Kevin: 2 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let crewUp = true;
let festUp = false;
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) { if (!crewUp) throw new TypeError('Load failed'); return json(DOC); }
  if (u.startsWith('/api/festival-add?')) { if (!crewUp) throw new TypeError('Load failed'); return json({ festivals: [] }); }
  if (u.startsWith('/data/festivals/')) { if (!festUp) throw new TypeError('Load failed'); return json(ACL); }
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${TOKEN}&f=${FID}&view=list`,
  storage: { fn_welcome_v1: '1' },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('a first visit without the festival file: the calm screen', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error']);
  assert.match($('error-msg').textContent, /can’t be reached right now/);
  assert.equal(localStorage.getItem(`fn_crew_doc_v3_${TOKEN}`), null, 'a guest\u2019s doc is not on this phone');
});

test('its retry with the signal still dead stays calm, and keeps the link whole', async () => {
  crewUp = false;
  window.dispatchEvent(new window.Event('online')); // or the 15 s timer, or coming back to the app
  await settleUntil(() => false, { timeout: 300 });
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error'], `not the bad-link screen: ${$('badlink-msg').textContent}`);
  assert.match($('error-msg').textContent, /can’t be reached right now/);
  assert.match(location.hash, /&view=list/, 'the link\u2019s view is still in it');
});

test('signal back: it opens by itself, on the view the link carried', async () => {
  crewUp = true;
  festUp = true;
  window.dispatchEvent(new window.Event('online'));
  await settleUntil(() => shown().includes('screen-app'), { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(localStorage.getItem(`fn_view_v1_${FID}`), 'list');
});
