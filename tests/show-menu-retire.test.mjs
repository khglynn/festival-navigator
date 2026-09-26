// The Show menu goes with its screen (v93 — Sol 6's review). It stays up while
// you choose and marks the page busy (body[data-busy] = 'show-menu', so a new
// build's reload waits for it). When the wall's screen went away with it open
// — the crew deleted on the server (a JSON 404 on the poll) — it stayed open
// behind the fest list, and its flag refused every future update reload on
// that phone. Now any screen but the wall closes it, and so does a boot; a
// stale flag with no menu is cleared at the next minute tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

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

const doc = dom.window.document;
const link = () => $('dock-fest-link');
const pop = () => $('dock-fest-wrap').querySelector('.sort-pop');
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const openMenu = () => {
  click(link());
  assert.equal(pop().style.display, '', 'the menu is up');
  assert.equal(doc.body.dataset.busy, 'show-menu', 'and holding a new build’s reload while you choose');
};
// Wait for what a test is about to assert, not a fixed time.
const until = async (ok) => { for (let i = 0; i < 150 && !ok(); i += 1) await settle(10); };
const closed = (why) => {
  assert.equal(link().getAttribute('aria-expanded'), 'false', `${why}: the menu is closed`);
  assert.equal(pop().style.display, 'none', `${why}: and hidden`);
  assert.equal(doc.body.dataset.busy, undefined, `${why}: its busy flag given back — a new build can reload`);
};

test('a boot with the Show menu up (a crew switch, a warm open): the menu closed, not left over the rebuilt wall', async () => {
  openMenu();
  await app.boot();
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  assert.equal($('screen-app').style.display, '', 'the wall again');
  closed('boot');
});

// Last: it deletes the crew this file's shell is standing on.
test('the crew deleted on the server (a JSON 404) with the Show menu up: the fest list, and the menu does not come back with the wall', async () => {
  for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
  openMenu();
  crewGone = true;
  await sync.pollSync();
  await until(() => $('screen-landing').style.display !== 'none');
  assert.notEqual($('screen-landing').style.display, 'none', 'the fest list');
  closed('crew 404');
});
