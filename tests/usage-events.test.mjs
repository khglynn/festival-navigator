// Usage events from the real shell (v108, 2026-10-01): the right word at the
// right moment, and silence on the paths that are not a person doing
// something — a repaint, a Settings round trip.
//
// A member's warm open (the network never answers, so nothing is sent and
// the queue keeps everything), on a pinned clock. Usage gathers in memory and
// reaches the queue two seconds later; the test reads the queue.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-10T17:00:00Z').getTime() });

const { bootShell, settle } = await import('./helpers/shell-rig.mjs');
const { pointerClick } = await import('./helpers/pointer-click.mjs');
const { FID, INDEX, FEST, crewDoc, heldNetwork, cachesHolding, within, SCREENS } = await import('./helpers/warm-rig.mjs');

const TOKEN = 'usageevents_0123456789ab'; // a made-up crew, never a real link
const KEY = 'phc_testkeyForFestivalNavigatorCI01';

globalThis.caches = cachesHolding({ '/data/festivals/index.json': INDEX, [`/data/festivals/${FID}.json`]: FEST });
const net = heldNetwork();
const shell = await bootShell({
  url: `https://fest.kevinhg.com/#g=${TOKEN}`,
  reportKey: KEY,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: TOKEN, name: '' }]),
    [`fn_me_v3_${TOKEN}`]: 'Kevin',
    [`fn_crew_doc_v3_${TOKEN}`]: JSON.stringify(crewDoc({ Kevin: { colorIndex: 0 } })),
    [`fn_crew_fest_v3_${TOKEN}`]: FID,
    fn_welcome_v1: '1',
  },
  fetch: net.fetch,
});
test.after(() => { shell.close(); delete globalThis.caches; mock.timers.reset(); });
const { $, dom } = shell;
const document = dom.window.document;

const usage = () => JSON.parse(globalThis.localStorage.getItem('fn_telemetry_q_v1') || '[]')
  .filter((x) => x.k === 'usage').map((x) => ({ event: x.e.event, ...x.e.properties }));
const named = (name) => usage().filter((e) => e.event === name);
const written = () => settle(2300); // usage reaches the queue two seconds after it happens

test('a warm open says so: app_open, warm_open, first_paint and fest_view, once each', async () => {
  assert.notEqual(await within(1500, () => SCREENS.filter((id) => $(id).style.display !== 'none').includes('screen-app')), null, 'the wall');
  await written();
  const [open] = named('app_open');
  assert.ok(open, JSON.stringify(usage().map((e) => e.event)));
  assert.equal(open.path, 'warm');
  assert.equal(open.page_load, true);
  assert.equal(open.build_changed, false, 'no build was stored before this first open');
  assert.equal(named('warm_open')[0].result, 'hit');
  assert.equal(named('first_paint')[0].path, 'warm');
  assert.equal(typeof named('first_paint')[0].ms_to_wall, 'number');
  assert.equal(named('fest_view')[0].via, 'boot');
  for (const name of ['app_open', 'warm_open', 'first_paint', 'fest_view']) assert.equal(named(name).length, 1, name);
  assert.equal(open.fest, FID, 'every event carries the festival on screen');
  assert.equal(open.member_name, 'Kevin');
  const raw = JSON.stringify(usage());
  assert.ok(!raw.includes(TOKEN) && !raw.includes('#g='), 'no crew link, ever');
});

test('a mouse pick says from, to, how and where — never which artist', async () => {
  const card = document.querySelector('#wall-root .card[data-artist]');
  assert.ok(card, 'a card');
  const artist = card.dataset.artist;
  pointerClick(dom.window, card, 'mouse');
  await written();
  const picks = named('pick');
  assert.equal(picks.length, 1, JSON.stringify(picks));
  assert.equal(picks[0].from, 0);
  assert.equal(picks[0].to, 1);
  assert.equal(picks[0].via, 'click');
  assert.equal(picks[0].surface, 'card');
  assert.ok(!JSON.stringify(usage()).includes(artist), 'the artist never rides');
});

test('a Settings round trip repaints the wall and says nothing about opening it again', async () => {
  const before = usage().length;
  $('gear-btn').click();
  await settle(20);
  $('settings-root').querySelector('.back-btn').click();
  await settle(20);
  await written();
  const after = usage().slice(before).map((e) => e.event);
  for (const name of ['app_open', 'first_paint', 'fest_view', 'warm_open']) assert.ok(!after.includes(name), `${name} after a repaint: ${after}`);
});

test('Low power switched on and off says which and how, nothing else', async () => {
  $('gear-btn').click();
  await settle(20);
  const lp = $('settings-root').querySelector('button[role="switch"][aria-label="Low power"]');
  lp.click();
  await settle(10);
  lp.click();
  await settle(10);
  $('settings-root').querySelector('.back-btn').click();
  await settle(20);
  await written();
  const s = named('setting');
  assert.deepEqual(s.map((e) => [e.setting, e.on]), [['low_power', true], ['low_power', false]]);
});

test('the notes chip opens all notes and says so', async () => {
  $('notes-chip').click();
  await settle(20);
  await written();
  assert.deepEqual(named('notes_open').map((e) => e.target), ['all']);
});
