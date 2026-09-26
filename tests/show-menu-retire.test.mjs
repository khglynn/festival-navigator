// The Show menu goes with its screen (v93 — Sol 6's review of 33164a3). The
// menu stays up while you choose, holds a history entry of its own and marks
// the page busy (body[data-busy] = 'show-menu', so a new build's reload waits
// for it). When the wall's screen went away with the menu open — the crew
// deleted on the server (a JSON 404 on the poll), the fest list — the app
// changed screens and left all three behind: the busy flag refused every
// future update reload on that phone, and history still named the menu.
// Now any screen but the wall retires it: closed, its entry dropped where the
// page stands (never a Back, which could move the app off the screen it is
// going to), the flag given back. And a stale 'show-menu' flag with no menu
// open is cleared at the next tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
// (The fest-list case below passes on older code too: its button's click is
// an outside tap, which takes the menu's entry back before the fest list
// opens. It stays as the pin for that route.)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'menuretiretest_crew_0123'; // made up, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const DOC = { v: 4, meta: { name: 'Retire Crew', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let crewGone = false; // the server's answer for this crew: here, or deleted
async function network(url) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/crew?')) return crewGone ? json({ error: 'Crew not found' }, 404) : json(DOC);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  return json({ error: 'not in this test' }, 503);
}
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  storage: {
    fn_welcome_v1: '1',
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: 'Retire Crew' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
const sync = await import('../js/sync.js'); // the SAME instances the page booted
const app = await import('../js/v3/app.js');
const { router } = await import('../js/v3/router.js');

const doc = dom.window.document;
const h = dom.window.history;
const link = () => $('dock-fest-link');
const pop = () => $('dock-fest-wrap').querySelector('.sort-pop');
const busy = () => doc.body.dataset.busy;
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const openMenu = () => {
  click(link());
  assert.equal(pop().style.display, '', 'the menu is up');
  assert.equal(busy(), 'show-menu', 'and holding a new build’s reload');
  assert.deepEqual(h.state.layers, ['menu:show'], 'on its own history entry');
  assert.equal(h.state.kind, 'menu', 'numbered and named as the menu’s (nav.js)');
};
// Wait for what a test is about to assert, not a fixed time: under a loaded
// suite the popstate and the replayed tap land later.
const until = async (ok) => { for (let i = 0; i < 150 && !ok(); i += 1) await settle(10); };
const retired = (why) => {
  assert.equal(link().getAttribute('aria-expanded'), 'false', `${why}: the menu is closed`);
  assert.equal(pop().style.display, 'none', `${why}: and hidden`);
  assert.equal(busy(), undefined, `${why}: the busy flag is given back — a new build can reload`);
  assert.ok(!(h.state && (h.state.layers || []).includes('menu:show')), `${why}: history no longer stands on the menu`);
  assert.equal(router.current().includes('menu:show'), false, `${why}: nor does the router`);
};

test('the fest list with the Show menu up: the menu goes with the wall, its busy flag and history entry too', async () => {
  openMenu();
  const back = $('fest-list-btn');
  assert.ok(back, 'the heading’s ‹ to the fest list');
  back.click(); // an outside tap: held, the menu's entry taken back, then given to the button
  await until(() => $('screen-landing').style.display !== 'none' && busy() === undefined);
  assert.notEqual($('screen-landing').style.display, 'none', 'the fest list');
  retired('fest list');
  // And back to the wall: the crew opens again, with no menu reopened.
  h.back();
  await settle(200);
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  assert.equal($('screen-app').style.display, '', 'Back: the wall again');
  assert.equal(link().getAttribute('aria-expanded'), 'false', 'with the menu closed');
  assert.equal(busy(), undefined);
});

// A link opened into the page needs nothing new: a fragment navigation
// fires popstate, and the menu's own layer closes it. A boot the app runs
// itself (a crew switch, a warm open's answer) fires nothing: it rebuilt the
// wall and reset the router under an open menu, which stayed up with no
// history entry the router knew and its busy flag still held.
test('a boot with the Show menu up (a crew switch, a warm open): the menu retired, not left over the rebuilt wall', async () => {
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  openMenu();
  await app.boot();
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  await settle(40);
  assert.equal($('screen-app').style.display, '', 'the wall again');
  retired('boot');
});

test('a stale "show-menu" busy flag with no menu open is cleared at the next tick', async () => {
  doc.body.dataset.busy = 'show-menu';
  Object.defineProperty(doc, 'visibilityState', { value: 'visible', configurable: true });
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  await settle(20);
  assert.equal(busy(), undefined, 'the reload is no longer held by a menu that is not there');
  // Another flow's flag is never touched.
  doc.body.dataset.busy = 'spotify-scan';
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  await settle(20);
  assert.equal(busy(), 'spotify-scan');
  delete doc.body.dataset.busy;
});

// Last: it deletes the crew this file's shell is standing on.
test('the crew deleted on the server (a JSON 404) with the Show menu up: the fest list, the menu retired, the reload free', async () => {
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  openMenu();
  crewGone = true;
  await sync.pollSync();
  await until(() => $('screen-landing').style.display !== 'none');
  assert.notEqual($('screen-landing').style.display, 'none', 'the fest list');
  retired('crew 404');
});
