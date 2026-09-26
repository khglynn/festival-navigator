// The past in the shell (Phase 1, 2026-09-26): the line flips under a tap
// (and never touches storage or the crew), a day tab onto a day that is over
// opens the days line and lands there, and a phone back from the lock screen
// judges the past again — the sets that ended while it slept fold, the page
// held by time. The real shell in jsdom, its clock pinned to Portola
// Saturday 4:15 PM PT; the motion and real input are the browser suite's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'pastshelltesttoken_012345'; // a made-up crew, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DOC = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: { Tricky: { Kevin: 2 } } } },
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
    [`fn_view_v1_${FID}`]: 'list',
  },
  fetch: network,
  now: '2026-09-26T23:15:00Z', // Saturday 4:15 PM at Pier 80
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);
const state = await import('../js/state.js');

const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const wall = () => $('wall-root');
const sat = () => wall().querySelector('.day-block[data-day="Saturday"] .room[data-room=":fest"]');
const line = () => sat().querySelector('.past-line');
const days = () => [...wall().querySelectorAll(':scope > .day-block')].map((b) => b.dataset.day);

test('it opens folded: the days line at the top, the room\'s seven behind its own', () => {
  assert.deepEqual(days(), ['Saturday', 'Sunday']);
  assert.equal(wall().querySelector(':scope > .past-line').textContent, 'Earlier · THU · FRI');
  assert.equal(line().textContent, 'Earlier · 7 sets');
});

test('a tap flips the line and brings the past back; a tap again folds it — nothing stored, nothing sent', async () => {
  const docBefore = JSON.stringify(state.crewDoc);
  click(line());
  await settle(20);
  assert.equal(line().textContent, 'Hide earlier');
  assert.equal(line().getAttribute('aria-expanded'), 'true');
  assert.ok(sat().querySelector('.card[data-artist="Airwolf Paradise"]'), 'the past is back');
  click(line());
  await settle(20);
  assert.equal(line().textContent, 'Earlier · 7 sets');
  assert.equal(sat().querySelector('.card[data-artist="Airwolf Paradise"]'), null);
  assert.equal(JSON.stringify(state.crewDoc), docBefore, 'the crew document is untouched');
  assert.equal(localStorage.getItem(`fn_view_v1_${FID}`), 'list', 'the view is the only thing this phone keeps here');
  await settle(1500);
  assert.deepEqual(sent.filter((u) => u.startsWith('/api/crew')), [], 'no sync call');
});

test('the scrollspy lights the first day ON the wall, not the first tab: SAT, never THU', () => {
  const lit = [...$('dock-days').querySelectorAll('.day-tab.active')].map((t) => t.dataset.day);
  assert.deepEqual(lit, ['Saturday']);
  assert.ok([...$('dock-days').querySelectorAll('.day-tab')].some((t) => t.dataset.day === 'Thursday'), 'THU keeps its tab: it is navigation');
});

test('a day tab onto a day that is over opens the days line and lands there', async () => {
  const thu = [...$('dock-days').querySelectorAll('.day-tab')].find((t) => t.dataset.day === 'Thursday');
  click(thu);
  await settle(20);
  assert.deepEqual(days(), ['Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.equal(wall().querySelector(':scope > .past-line').textContent, 'Hide earlier');
  click(wall().querySelector(':scope > .past-line'));
  await settle(250);
  assert.deepEqual(days(), ['Saturday', 'Sunday'], 'and it folds again');
});

test('back from the lock screen an hour later: what ended folds, the rest stands', async () => {
  assert.ok(sat().querySelector('.card[data-artist="Tricky"]'), 'Tricky (3:30–4:30) is on at 4:15');
  const RealDate = globalThis.Date;
  const later = RealDate.now() + 60 * 60 * 1000; // 5:15 PM
  class Later extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(later); }
    static now() { return later; }
  }
  globalThis.Date = Later;
  try {
    Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new dom.window.Event('visibilitychange'));
    await settle(20);
    assert.equal(sat().querySelector('.card[data-artist="Tricky"]'), null, 'Tricky ended at 4:30: folded on resume');
    assert.match(line().textContent, /^Earlier · \d+ sets$/);
    assert.notEqual(line().textContent, 'Earlier · 7 sets', 'more of the day is behind the line now');
  } finally {
    globalThis.Date = RealDate;
  }
});
