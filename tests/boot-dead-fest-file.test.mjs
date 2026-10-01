// "App won't open: TypeError — Load failed" (PostHog → Slack, 2026-10-01
// 20:34Z, an iPhone, v106, screen=loading, no member name). A phone the
// worker already controls reopens ACL on a festival network that fails. The
// worker answers /api with its 503 and index.json from its shell, but the
// ACL file never reached its data cache (the first visit fetched it before
// the worker claimed the page) — so the file fails, enterApp falls back to
// the catalog default (Portola, a festival this friend never opened), that
// fetch fails too, and it escapes (app.js `await loadFestival(fallback)`)
// to boot's catch: record('boot') and the fatal screen. Worse, the fallback
// was SAVED first, so "Try again" on signal opens Portola, not ACL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const PORTOLA = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
const TOKEN = 'deadfestfile_guest_01234'; // a made-up crew, never a real link
const FID = 'acl-2026';
const DOC = {
  v: 4, meta: { name: 'ACL Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { 'Sabrina Carpenter': { Kevin: 2 } } } },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let dead = true; // the festival network: WebKit's words for a request that never got an answer
const asked = [];
async function network(url) {
  const u = String(url);
  asked.push(u);
  if (u === '/data/festivals/index.json') return json(INDEX); // the worker's shell copy answers
  if (u.startsWith('/api/')) return dead ? json({}, 503) : (u.startsWith('/api/crew?') ? json(DOC) : json({ festivals: [] }));
  if (u.startsWith('/data/festivals/')) {
    if (dead) throw new TypeError('Load failed');
    if (u.endsWith('/acl-2026.json')) return json(ACL);
    if (u.endsWith('/portola-2026.json')) return json(PORTOLA);
  }
  return json({ error: 'not in this test' }, 404);
}

const shell = await bootShell({
  url: 'https://fest.kevinhg.com/', // reopened from the home screen: the active crew resumes
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'ACL Crew' }]),
    fn_active_crew_v3: TOKEN,
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(DOC),
    [`fn_crew_fest_v3_${TOKEN}`]: FID, // this phone was looking at ACL
    fn_welcome_v1: '1',
    // no fn_me_v3_: a guest, so never the warm open
  },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js');
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const journal = () => JSON.parse(localStorage.getItem('fn_errlog_v1') || '[]');

test("a dead festival network on a file this phone never held is not 'the app won\u2019t open'", async () => {
  await settleUntil(() => shown().length > 0, { timeout: 4000 });
  assert.ok(!journal().some((e) => e.kind === 'boot'), `not recorded as a boot crash: ${JSON.stringify(journal())}`);
  assert.ok(journal().some((e) => e.kind === 'boot:offline'), 'but still seen: its own kind, so Slack can say what it is');
  const words = ($('screen-error').style.display !== 'none' ? $('screen-error').textContent : '') + ($('screen-badlink').style.display !== 'none' ? $('screen-badlink').textContent : '');
  assert.match(words, /ACL/, `it names the festival that is missing, and says so calmly: ${JSON.stringify(shown())} ${words.trim().slice(0, 200)}`);
  assert.doesNotMatch(words, /hit an error/, 'not "the app hit an error" — nothing broke; there is no signal');
  assert.equal(localStorage.getItem(`fn_crew_fest_v3_${TOKEN}`), FID, 'this phone\u2019s own choice is not overwritten by a fallback that never loaded');
  assert.ok(!asked.includes('/data/festivals/portola-2026.json'), 'and no festival this phone does not hold is fetched in its place on a network that just failed');
});

test('signal comes back: ACL opens by itself, the festival this phone was on', async () => {
  dead = false;
  window.dispatchEvent(new window.Event('online'));
  await settleUntil(() => shown().includes('screen-app'), { timeout: 4000 });
  assert.deepEqual(shown(), ['screen-app'], 'the wall, without a tap');
  assert.equal(state.activeFestivalId, FID, `opened ${state.activeFestivalId}`);
  assert.equal(state.fest().name, ACL.name);
});
