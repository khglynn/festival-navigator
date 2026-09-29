// A stage's last set with no printed end runs to the day's close (LEDGER
// follow-up 20, 2026-09-29). ACL's Zilker posters print the headliners' START
// only, so the grid drew each a flat 75 minutes and NOW stopped counting
// Skrillex live at 9:30 while he played to 10. The rule is code, not a data
// guess, and it lives in ONE place (js/time.js daySetsOf / computeDayArtists),
// so the grid's height, the cell's now window, Our picks' stops and the Share
// text all move together:
//   - a closer (its stage's last set, no printed end, starting no earlier than
//     every set with a printed end has started) runs to the festival's
//     published close for that day (`dayMeta.<day>.close`);
//   - without one, the latest printed end on any stage that day is a floor of
//     the day: it may lengthen a closer past the default, never shorten it
//     (ACL's latest printed end is 8:30 PM, at or before every headliner's
//     start — taken as the end it would give Skrillex 15 minutes);
//   - every end the poster did not print is approximate (`endApprox`), and a
//     "till" that reads one wears the app's tilde: "till ~10 PM".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { paintFree } from './helpers/paint-free.mjs';
import { computeDayArtists, daySetsOf } from '../js/time.js';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

// plan-rows.js draws rows too, so it reads a document and storage at import
// (tests/plan-stop-ends.test.mjs's setup).
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
const store = new Map();
globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
paintFree(dom.window);
const { planOf, tillOf } = await import('../js/v3/plan.js');
const { planText } = await import('../js/v3/plan-rows.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
// ACL with the close its own meta note quotes (posters: 12:45 PM to 10 PM).
// The file carries that close since 2026-09-29 (dayMeta Fri/Sat/Sun); these
// tests still set it themselves, so they hold whatever the file says.
const withClose = (fest, close) => ({
  ...fest,
  dayMeta: Object.fromEntries(Object.entries(fest.dayMeta).map(([k, m]) => [k, fest.days[k] ? { ...m, close } : m])),
});
const ACL_10 = withClose(ACL, '10 PM');
// ACL as a festival that publishes no close: every day's close taken off.
const withoutClose = (fest) => ({
  ...fest,
  dayMeta: Object.fromEntries(Object.entries(fest.dayMeta).map(([k, m]) => {
    const rest = { ...m };
    delete rest.close;
    return [k, rest];
  })),
});
const ACL_NO_CLOSE = withoutClose(ACL);
const byName = (list) => Object.fromEntries(list.map((a) => [a.name, a]));
const TEN_PM = 22 * 60;

test('a closer runs to the published close, approximate', () => {
  for (const [day, wk, names] of [
    ['Friday', 'W1', ['Skrillex', 'Charli xcx']], ['Friday', 'W2', ['Kings of Leon', 'Charli xcx']],
    ['Saturday', 'W1', ['Lorde', 'RÜFÜS DU SOL']], ['Sunday', 'W2', ['The xx', 'Twenty One Pilots']],
  ]) {
    const sets = byName(daySetsOf(ACL_10, day, wk));
    for (const n of names) {
      assert.equal(sets[n].endMin, TEN_PM, `${day} ${wk} ${n} ends at the close`);
      assert.equal(sets[n].endApprox, true, `${n}'s end is ours, not the poster's`);
    }
  }
});

test('a printed end is untouched and not approximate', () => {
  const sets = byName(daySetsOf(ACL_10, 'Friday', 'W1'));
  assert.equal(sets.Turnstile.endMin, 19 * 60 + 15);
  assert.equal(sets.Turnstile.endApprox, false);
});

test('without a published close, the latest printed end only ever lengthens: ACL keeps its default', () => {
  assert.ok(Object.values(ACL_NO_CLOSE.dayMeta).every((m) => !('close' in m)), 'the fixture publishes no close');
  const sets = byName(daySetsOf(ACL_NO_CLOSE, 'Friday', 'W1'));
  // 8:30 PM is the latest printed end that day, before 8:15 + 75.
  assert.equal(sets.Skrillex.endMin, sets.Skrillex.startMin + 75);
  assert.equal(sets['Charli xcx'].endMin, sets['Charli xcx'].startMin + 75);
  assert.equal(sets.Skrillex.endApprox, true, 'a default is a guess too');
  // The file itself publishes the close, so the same day reads 10 PM there.
  assert.equal(byName(daySetsOf(ACL, 'Friday', 'W1')).Skrillex.endMin, TEN_PM, 'the file\'s own close');
});

test('without a published close, a later printed end on another stage is the day\'s close', () => {
  const out = byName(computeDayArtists({ artists: [
    { name: 'Opener', stage: 'Main', time: '6:00 PM - 7:00 PM' },
    { name: 'Closer', stage: 'Main', time: '9:00 PM' },
    { name: 'Late', stage: 'Side', time: '8:30 PM - 11:30 PM' },
  ] }));
  assert.equal(out.Closer.endMin, 23 * 60 + 30, 'runs to 11:30, the latest printed end');
  assert.equal(out.Closer.endApprox, true);
});

test('a set that starts before another stage\'s printed set has begun is not a closer', () => {
  const out = byName(computeDayArtists({ artists: [
    { name: 'Early', stage: 'Main', time: '9:00 PM' },
    { name: 'Late', stage: 'Side', time: '9:30 PM - 11:30 PM' },
  ] }, { close: '12 AM' }));
  assert.equal(out.Early.endMin, 21 * 60 + 75, 'the default, not three hours to the close');
});

test('a stage that closes early keeps its default: only the closing slot runs to the close', () => {
  const out = byName(computeDayArtists({ artists: [
    { name: 'Kids', stage: 'Tent', time: '3:00 PM' },
    { name: 'Headliner', stage: 'Main', time: '8:00 PM - 9:45 PM' },
  ] }, { close: '10 PM' }));
  assert.equal(out.Kids.endMin, 15 * 60 + 75, 'a 3 PM set never runs seven hours');
  assert.equal(out.Kids.endApprox, true);
});

test('a published close bounds the closer, even inside the default', () => {
  const out = byName(computeDayArtists({ artists: [
    { name: 'Before', stage: 'Main', time: '8:00 PM - 9:00 PM' },
    { name: 'Closer', stage: 'Main', time: '9:30 PM' },
  ] }, { close: '10 PM' }));
  assert.equal(out.Closer.endMin, TEN_PM, 'the close, not 10:45');
});

test('a printed "Close" runs to the published close', () => {
  const out = byName(computeDayArtists({ artists: [
    { name: 'A', stage: 'Main', time: '9:00 PM - 10:30 PM' },
    { name: 'B', stage: 'Main', time: '11:00 PM - Close' },
  ] }, { close: '2 AM' }));
  assert.equal(out.B.endMin, 26 * 60);
  assert.equal(out.B.endApprox, true);
});

test('a close that is not a clock time is ignored, never a NaN', () => {
  const out = byName(computeDayArtists({ artists: [{ name: 'A', stage: 'Main', time: '9:00 PM' }] }, { close: 'late' }));
  assert.equal(out.A.endMin, 21 * 60 + 75);
});

// ---- one place: the plan and the Share read the same ends ----------------------------
const CREW = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-acl.json'), 'utf8'));

test('Our picks: a headliner stop ends at the close, and the Share says "till ~10pm"', () => {
  const plan = planOf(ACL_10, { picks: CREW.picks, members: CREW.members });
  const sk = plan.places.find((p) => p.kind === 'set' && p.acts[0].name === 'Skrillex');
  assert.ok(sk, 'Skrillex is a place');
  assert.equal(sk.end, TEN_PM, "the stop's place ends with the set");
  assert.equal(sk.acts[0].to, TEN_PM);
  assert.equal(sk.acts[0].endApprox, true);
  const night = plan.nights.find((n) => n.iso === '2026-10-02');
  const route = plan.night(night.id);
  const stop = route.items.find((i) => i.kind === 'stop' && i.place.acts[0].name === 'Skrillex');
  assert.equal(tillOf(stop), TEN_PM, "the NOW row's till");
  const at9 = 21 * 60 + 30; // Friday 9:30 PM: past the old 9:30 end
  const text = planText(route, { ctx: { picks: CREW.picks, meName: CREW.me }, plan, nowMin: at9, fest: 'ACL', day: 'Fri' });
  assert.match(text, /T-Mobile for Skrillex @ now till ~10pm/, text);
});

// ---- the validator: the close is one clock time, after every set's start ------------
test('the validator takes ACL with its published close, and stops a close that is not a time', () => {
  const ok = validateFestivalDoc(ACL_10, { filename: 'acl-2026.json' });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.warnings.filter((w) => /close/.test(w)), []);
  const bad = validateFestivalDoc(withClose(ACL, '10 PM - 11 PM'), { filename: 'acl-2026.json' });
  assert.ok(bad.errors.some((e) => /dayMeta\.Friday\.close must be a single clock time/.test(e)), bad.errors.join('\n'));
  const early = validateFestivalDoc(withClose(ACL, '8:30 PM'), { filename: 'acl-2026.json' });
  assert.ok(early.warnings.some((w) => /dayMeta\.Friday\.close "8:30 PM" is not after Charli xcx/.test(w)), early.warnings.join('\n'));
});

// ---- the wall: the same end draws the cell and its now window -------------------------
test('the Board: Skrillex\'s cell reaches 10 PM and its now window ends there, the grid with it', async () => {
  globalThis.location = globalThis.location || { origin: 'https://fest.kevinhg.com', hash: '' };
  const state = await import('../js/state.js');
  const { FESTIVAL_INDEX } = await import('../js/festivals.js');
  const { renderWall } = await import('../js/v3/wall.js');
  if (!FESTIVAL_INDEX.some((f) => f.id === ACL.id)) FESTIVAL_INDEX.push({ id: ACL.id, status: 'scheduled' });
  state.activateCrew(['day', 'close', 'test', '0123456789'].join('_'), { // made up, never a real link
    v: 4, meta: {}, spotify: {}, affinity: {}, people: { Ada: { colorIndex: 0 } },
    festivals: { [ACL.id]: { selections: {} } },
  }, ACL.id, { festival: ACL.id });
  state.FESTIVALS[ACL.id] = ACL_10;
  state.forgetComputedDays(ACL.id);
  state.setActiveFestivalId(ACL.id);
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, { fid: ACL.id, meName: 'Ada', picks: {}, affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all', onTap: () => {} });
  const fri = root.querySelector('.day-block[data-day="Friday|W1"]');
  const cell = [...fri.querySelectorAll('.times-grid .card')].find((c) => c.dataset.artist === 'Skrillex');
  assert.ok(cell, 'Skrillex has a cell on the first Friday');
  assert.equal(cell.dataset.nowFrom, String(20 * 60 + 15));
  assert.equal(cell.dataset.nowTo, String(TEN_PM), 'NOW counts him live till the close');
  // 8:15 to 10 PM is seven quarter-hour rows (it was five: 75 minutes).
  assert.match(cell.style.gridRow, /span 7$/);
  const grid = cell.closest('.times-grid');
  assert.equal((Number(grid.dataset.startRow) + Number(grid.dataset.rows)) * 15, TEN_PM, 'the grid ends at the close');
  root.remove();
});
