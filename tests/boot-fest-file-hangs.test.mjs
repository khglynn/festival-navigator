// A festival file that HANGS (2026-10-01): the likelier failure on a
// festival network, where requests neither answer nor fail. loadFestival
// waits FEST_FILE_DEADLINE_MS (12 s), then answers from this phone's copy —
// here there is none — so the calm screen and its retries, instead of the
// loader forever with nothing recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const TOKEN = 'hungfestfile_guest_01234'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/data/festivals/')) return new Promise(() => {}); // never answers
  return json({ error: 'not in this test' }, 503);
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
const { FEST_FILE_DEADLINE_MS } = await import('../js/festivals.js');
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('a hung festival file ends at the deadline in the calm screen, not an endless loader', { timeout: 30000 }, async () => {
  await settleUntil(() => false, { timeout: 2000 });
  assert.deepEqual(shown(), [], 'still waiting well inside the deadline');
  await settleUntil(() => shown().length > 0, { timeout: FEST_FILE_DEADLINE_MS + 4000, step: 50 });
  assert.deepEqual(shown(), ['screen-error']);
  assert.match($('error-msg').textContent, /can’t be reached right now/);
  assert.ok(journal().some((e) => e.kind === 'boot:offline'));
  $('error-home').click(); // leaving stops its retries
  await settleUntil(() => shown().includes('screen-landing'), { timeout: 3000 });
});
