// The stand-in, when the festival's file is broken rather than out of reach
// (Copilot's review of v107): ACL answers 404 — a deploy fault, not the
// signal — and this phone holds Portola. The friend still gets a wall (the
// stand-in, as for no signal), and the fault is reported, so it is never
// silent: before, a held festival quietly covered it.
// boot-held-fallback.test.mjs is the no-signal case, which reports nothing.
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
const TOKEN = 'heldfallback_broken_0123'; // made up
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
  if (u.startsWith('/data/festivals/')) return new Response('Not Found', { status: 404 });
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
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test('a broken ACL file with Portola held: the wall opens on Portola, and the fault is reported', async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app'], `a wall: ${JSON.stringify(journal())}`);
  const state = await import('../js/state.js');
  assert.equal(state.activeFestivalId, 'portola-2026');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), FID, 'this phone still means ACL');
  const kinds = journal().map((e) => e.kind);
  assert.ok(kinds.includes('festival:stand-in'), `reported: ${JSON.stringify(kinds)}`);
  assert.ok(!kinds.includes('boot'), 'and not as the app failing to open');
});
