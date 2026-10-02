// The bare fest.kevinhg.com (v108, 2026-10-01): how often a phone opens the
// app with no crew on it — Kevin's find-your-crew question. landing_view says
// how many crews this phone knows and whether it is the home-screen app,
// nothing else; app_open names the landing as the path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const KEY = 'phc_testkeyForFestivalNavigatorCI01';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const shell = await bootShell({
  url: 'https://fest.kevinhg.com/',
  reportKey: KEY,
  storage: {},
  fetch: async (url) => (String(url) === '/data/festivals/index.json' ? json(INDEX) : json({ error: 'not in this test' }, 503)),
});
test.after(() => shell.close());
const { $ } = shell;
const usage = () => JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]')
  .filter((x) => x.k === 'usage').map((x) => ({ event: x.e.event, ...x.e.properties }));

test('a phone with no crew lands on Your crews, and says how many it knows and where it is', async () => {
  await settleUntil(() => $('screen-landing').style.display !== 'none', { timeout: 4000 });
  await settle(2300);
  const views = usage().filter((e) => e.event === 'landing_view');
  assert.equal(views.length, 1, JSON.stringify(usage()));
  assert.equal(views[0].crews, 0);
  assert.equal(views[0].context, 'browser');
  const open = usage().find((e) => e.event === 'app_open');
  assert.equal(open.path, 'landing');
  assert.equal(open.page_load, true);
});
