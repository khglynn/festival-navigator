// The show menu's view row (Phase 1, 2026-09-26): the rooms, a line, Board ·
// List, a line, Settings. A tap switches the wall behind the menu, which
// stays up (v93's popover, no history entry); the choice is this phone's per
// festival, rides the share link, and is NEVER written to the crew — no sync
// call, no change to the crew document. The real shell in jsdom (no layout,
// so no motion: canAnimate says no and the switch is instant); the motion
// and the held place are the browser suite's (tests/browser/list-view.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'viewmenutesttoken_0123456'; // a made-up crew, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DOC = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } },
  festivals: { [FID]: { selections: { Robyn: { Kevin: 2, Maya: 4 } } } },
};
const sent = [];
async function network(url, opts = {}) {
  const u = String(url);
  if ((opts.method || 'GET') !== 'GET') { sent.push(u); return json({ error: 'not in this test' }, 503); }
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/crew?')) return json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'The Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
const state = await import('../js/state.js');
const app = await import('../js/v3/app.js'); // the SAME instance the page booted
const loc = dom.window.location;

const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const menu = () => $('dock-fest-wrap').querySelector('.sort-pop');
const parts = () => [...menu().children].map((li) => li.className || li.querySelector('button').className || li.querySelector('button').dataset.room);
const wall = () => $('wall-root');
const view = (v) => menu().querySelector(`.view-row [data-view="${v}"]`);

test('the menu: Show, the rooms, a line, Board · List, a line, Settings — and no Earlier row', () => {
  assert.deepEqual(parts(), ['menu-label', ':fest', 'Afters', 'Folsom', 'pop-div', 'view-row', 'pop-div', 'settings']);
  const row = menu().querySelector('.view-row');
  assert.equal(row.getAttribute('role'), 'group');
  assert.equal(row.getAttribute('aria-label'), 'View');
  const [board, list] = row.querySelectorAll('button');
  assert.deepEqual([board.textContent, list.textContent], ['Board', 'List']);
  for (const b of [board, list]) {
    assert.equal(b.getAttribute('role'), 'option', 'each choice is a button — the 44px floor comes with it');
    assert.equal(b.querySelector('svg.glyph').getAttribute('stroke'), 'currentColor', 'a glyph in the menu glyphs\' family');
  }
  assert.equal(board.getAttribute('aria-selected'), 'true', 'Board is the default');
  assert.equal(list.getAttribute('aria-selected'), 'false');
  assert.equal(/earlier/i.test(menu().textContent), false, 'the past folds on the wall, not in a menu');
});

test('List: the wall switches behind the menu, which stays up — stored here, never sent, no history entry', async () => {
  const docBefore = JSON.stringify(state.crewDoc);
  const hist = dom.window.history.length;
  click($('dock-fest-link'));
  assert.equal($('dock-fest-link').getAttribute('aria-expanded'), 'true');
  click(view('list'));
  await settle(30);
  assert.equal($('wall-root').dataset.view, 'list', 'the wall is a List');
  assert.ok($('wall-root').querySelector('.card.row'), 'of rows');
  assert.equal($('wall-root').querySelector('.times-grid'), null, 'and no grid');
  assert.equal(localStorage.getItem(`fn_view_v1_${FID}`), 'list', 'this phone, this festival');
  assert.equal(view('list').getAttribute('aria-selected'), 'true');
  assert.equal(view('board').getAttribute('aria-selected'), 'false');
  assert.equal($('dock-fest-link').getAttribute('aria-expanded'), 'true', 'the menu stayed up');
  assert.notEqual(menu().style.display, 'none');
  assert.equal(dom.window.history.length, hist, 'no history entry');
  // The address says the view too (Sol's review of v97): a link copied from
  // the bar, or sent with the browser's own Share, opens as a List.
  assert.equal(loc.pathname, `/f/${FID}`);
  assert.ok(loc.hash.startsWith(`#g=${TOKEN}&f=${FID}`), 'the crew and the festival, as before');
  assert.ok(loc.hash.endsWith('&view=list'), `the view rides the address, last (${loc.hash.replace(TOKEN, '<token>')})`);
  await settle(1500); // past the sync debounce (1.2 s)
  assert.deepEqual(sent.filter((u) => u.startsWith('/api/crew')), [], 'no sync call');
  assert.equal(JSON.stringify(state.crewDoc), docBefore, 'the crew document is untouched');
  assert.equal(JSON.stringify(state.crewDoc).includes('view'), false, 'and holds no view key');
});

test('the rail\'s menu agrees, and a room tick in the List keeps the List', async () => {
  const rail = $('rail-fest-wrap').querySelector('.sort-pop');
  assert.equal(rail.querySelector('.view-row [data-view="list"]').getAttribute('aria-selected'), 'true', 'one state, both doors');
  click(menu().querySelector('[data-room="Afters"]'));
  await settle(30);
  assert.equal($('wall-root').dataset.view, 'list');
  assert.equal($('wall-root').querySelector('.room[data-room="Afters"]'), null, 'Afters is hidden');
  click(menu().querySelector('[data-room="Afters"]'));
  await settle(30);
  assert.ok($('wall-root').querySelector('.room[data-room="Afters"] .card.row'), 'and back, as rows');
});

test('the invite link carries the List, and says so', async () => {
  click(menu().querySelector('.settings'));
  await settle(30);
  const box = $('screen-settings').querySelector('input[aria-label="Crew invite link"]');
  assert.ok(box, 'Settings shows the link');
  assert.match(box.value, /&view=list$/, 'last, after the rest');
  assert.match($('screen-settings').textContent, /Opens as a list — what you’re showing now\./);
  dom.window.history.back();
  // Wait for the traversal to land, not a fixed 40 ms: it came late once
  // under the night clock on a loaded machine (Sol, 2026-09-26), and the
  // next test's tap on the fest name then met a Back still on its way.
  for (let t = 0; $('screen-app').style.display !== '' || ((dom.window.history.state || {}).layers || []).length; t += 5) {
    if (t > 3000) assert.fail('still waiting for Back to leave Settings');
    await settle(5);
  }
  assert.equal($('screen-app').style.display, '');
});

test('Board: back to the wall as it was, and the link says nothing', async () => {
  click($('dock-fest-link'));
  click(view('board'));
  await settle(30);
  assert.equal($('wall-root').dataset.view, undefined);
  assert.ok($('wall-root').querySelector('.times-grid'), 'the grid is back');
  assert.equal($('wall-root').querySelector('.card.row'), null);
  assert.equal(localStorage.getItem(`fn_view_v1_${FID}`), null, 'Board is the default and stores nothing');
  assert.equal(/[#&]view=/.test(loc.hash), false, 'and the address drops the view');
  click($('dock-fest-link'));
  await settle(20);
});

// "Seeded once" holds against your own address: seeding asks the PHONE (has
// it shown this festival? is there a seed marker?), never the link alone.
test('a reload of an address still saying List, on a phone that chose Board since: Board, and not a word', async () => {
  history.replaceState(null, '', `/f/${FID}#g=${TOKEN}&f=${FID}&view=list`);
  $('toast-root').textContent = '';
  await app.boot();
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  await settle(40);
  assert.equal(localStorage.getItem(`fn_view_v1_${FID}`), null, 'the choice made after the link stands');
  assert.equal(wall().dataset.view, undefined, 'the Board');
  assert.doesNotMatch($('toast-root').textContent, /Opened/, 'no "Opened as a list." — this phone was never a stranger to it');
  assert.equal(/[#&]view=/.test(loc.hash), false, 'and the address is rewritten to what the phone shows');
});

test('a reload in List stays List, says nothing, and keeps the view in the address', async () => {
  click($('dock-fest-link'));
  click(view('list'));
  await settle(30);
  click($('dock-fest-link'));
  $('toast-root').textContent = '';
  await app.boot();
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  await settle(40);
  assert.equal(wall().dataset.view, 'list');
  assert.doesNotMatch($('toast-root').textContent, /Opened/);
  assert.ok(loc.hash.endsWith('&view=list'));
  click($('dock-fest-link'));
  click(view('board'));
  await settle(30);
  click($('dock-fest-link'));
});
