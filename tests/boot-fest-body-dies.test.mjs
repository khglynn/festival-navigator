// Network-first, then the body dies: on a festival network the worker's 4 s
// budget covers the HEADERS, so it hands back the live response — and the
// 98 KB body then fails mid-download (WebKit: TypeError "Load failed"). The
// copy in the worker's data cache is never asked: enterApp falls back to
// another festival (and saves it) or, with that one unreachable too, the
// fatal screen. The phone held ACL the whole time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settleUntil } from './helpers/shell-rig.mjs';
import { cachesHolding } from './helpers/warm-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const TOKEN = 'festbodydies_guest_01234'; // made up
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// Headers in time, then the connection drops.
const dyingBody = () => new Response(new ReadableStream({ start(c) { c.error(new TypeError('Load failed')); } }), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/api/')) return json({}, 503);
  if (u === `/data/festivals/${FID}.json`) return dyingBody();
  if (u.startsWith('/data/festivals/')) throw new TypeError('Load failed');
  return json({ error: 'not in this test' }, 404);
}

globalThis.caches = cachesHolding({ [`/data/festivals/${FID}.json`]: ACL }); // the worker's data cache holds ACL
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
const state = await import('../js/state.js');
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');

test('a live response whose body dies falls back to the copy this phone holds', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app'], `the wall, not ${JSON.stringify(shown())}: ${localStorage.getItem('fn_errlog_v1')}`);
  assert.equal(state.activeFestivalId, FID, `ACL from the cache, not ${state.activeFestivalId}`);
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), FID, 'the saved choice untouched');
});
