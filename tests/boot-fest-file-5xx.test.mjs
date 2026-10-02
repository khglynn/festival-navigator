// A 5xx for the festival file is the network's kind of failure, not a fault
// in the app (2026-10-01, Sol's review): on a festival network it is often
// the carrier's own gateway that cannot get through. The calm screen and its
// retries, never the crash. (A 4xx stays loud: boot-fest-file-broken.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const TOKEN = 'gatewayfestfile_guest_012'; // a made-up crew, never a real link
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
  if (u.startsWith('/data/festivals/')) return new Response('bad gateway', { status: 502 });
  return json({ error: 'not in this test' }, 404);
}

const shell = await bootShell({
  url: 'https://fest.kevinhg.com/',
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'ACL Crew' }]),
    fn_active_crew_v3: TOKEN,
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('a 5xx for the festival file is the calm screen, not the crash', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-error']);
  assert.ok(!journal().some((e) => e.kind === 'boot'), `not a crash: ${JSON.stringify(journal())}`);
  assert.ok(journal().some((e) => e.kind === 'boot:offline'));
  assert.match($('screen-error').textContent, /can’t be reached right now/);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), FID, 'the saved choice stands');
  assert.ok(!asked.includes('/data/festivals/portola-2026.json'), 'and no other festival is fetched in its place');
});

test('“Your crews” leaves the calm screen, and its retries stop with it', async () => {
  $('error-home').click();
  await settleUntil(() => shown().includes('screen-landing'), { timeout: 3000 });
  assert.deepEqual(shown(), ['screen-landing']);
  const before = asked.length;
  window.dispatchEvent(new window.Event('online')); // what would have re-booted the crew
  await settleUntil(() => false, { timeout: 300 });
  assert.equal(asked.length, before, 'nothing re-boots behind the landing');
  assert.deepEqual(shown(), ['screen-landing']);
});
