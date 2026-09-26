// A share link's view (Phase 1, 2026-09-26): `&view=list` beside the rooms'
// `&show=`, applied ONCE on a phone that has never shown the festival —
// each part only where this phone has no choice of its own — said on
// arrival, and never written to the crew (m-menu-past-persist §2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const ACL = 'acl-2026';
const ACL_FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${ACL}.json`), 'utf8'));

const A = 'firstopenview_aaaa_01234';
const B = 'firstopenview_bbbb_01234';
const C = 'firstopenview_cccc_01234';
const D = 'firstopenview_dddd_01234';
const doc = () => ({
  v: 4, meta: { name: 'View Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { Robyn: { Kevin: 2 } } } },
});
const writes = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') { writes.push(u); return json({ error: 'not in this test' }, 503); }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u === `/data/festivals/${ACL}.json`) return json(ACL_FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) return json(doc());
  return json({ error: 'not in this test' }, 503);
}

const VIEW = `fn_view_v1_${FID}`;
const FOLD = `fn_fold_v1_${FID}`;
// The first boot is a fresh phone opening a link with both parts. (A page
// seeds a festival once — the marker lives in memory too — so each case
// below that needs a fresh seed uses a festival of its own.)
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${A}&f=${FID}&show=folsom&view=list`,
  storage: { fn_welcome_v1: '1' },
  fetch: network,
});
test.after(() => shell.close());
const { $ } = shell;
const crew = await import('../js/crew.js');
const toast = () => $('toast-root').textContent;
async function open(hash) {
  $('toast-root').textContent = '';
  location.hash = hash;
  await settle(140);
}
const freshPhone = () => { for (const c of crew.knownCrews()) crew.forgetCrew(c.token); };
await settle(160);

test('rooms and view together: each part seeded before the first paint, one line says both, never sent', () => {
  assert.equal(localStorage.getItem(VIEW), 'list', 'this phone’s own view now');
  assert.deepEqual(new Set(JSON.parse(localStorage.getItem(FOLD))), new Set([':fest', 'Afters']));
  assert.match(toast(), /Opened on Folsom, as a list\./);
  assert.deepEqual(writes.filter((u) => !u.startsWith('/api/person')), [], 'a view is never written to the crew');
});

test('Show all brings the rooms back and leaves the view: it is about the rooms', async () => {
  const btn = [...$('toast-root').querySelectorAll('button')].find((b) => b.textContent === 'Show all');
  assert.ok(btn);
  btn.click();
  await settle(20);
  assert.equal(localStorage.getItem(FOLD), null, 'the rooms come back');
  assert.equal(localStorage.getItem(VIEW), 'list');
});

test('a phone that has shown the festival keeps its own view — a link never moves it', async () => {
  const { saveView, BOARD } = await import('../js/v3/filters.js');
  saveView(FID, BOARD); // it went back to Board by choice
  await open(`#g=${B}&f=${FID}&view=list`);
  assert.equal(localStorage.getItem(VIEW), null);
  assert.doesNotMatch(toast(), /as a list/);
});

test('the List alone, on a fresh phone: stored, and said with no door on the toast', async () => {
  freshPhone();
  await open(`#g=${C}&f=${ACL}&view=list`);
  assert.equal(localStorage.getItem(`fn_view_v1_${ACL}`), 'list');
  assert.match(toast(), /Opened as a list\./);
  assert.equal($('toast-root').querySelectorAll('button').length, 0, 'the fest name is the door to Board');
});

test('&view=board is the default: it seeds nothing and says nothing', async () => {
  freshPhone();
  await open(`#g=${D}&f=${ACL}&view=board`);
  assert.equal(localStorage.getItem(`fn_view_v1_${ACL}`), 'list', 'the view this phone chose above stands');
  assert.doesNotMatch(toast(), /Opened/);
});
