// The festival clock and the now line (2026-08-27): on festival day the
// timetable draws a line at the current time and the app lands on it once
// per open. The clock is pinned in tests; a festival day rolls over at 5 AM
// like js/time.js's after-midnight convention.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, positionNowLines, scrollToNowLine } = await import('../js/v3/wall.js');
const now = await import('../js/v3/now.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));

FESTIVAL_INDEX.push({ id: 'portola-2026', status: 'scheduled' });
state.activateCrew('nowlinetesttoken_01234567', {
  v: 4, meta: {}, spotify: {}, people: { HG: { colorIndex: 0 } }, festivals: { 'portola-2026': { selections: {} } }, affinity: {},
});
state.FESTIVALS['portola-2026'] = portola;
state.setActiveFestivalId('portola-2026');

const mkCtx = (date) => ({
  fid: 'portola-2026', meName: 'HG', picks: {}, affinity: null, lowPower: true, sort: 'day', query: '', weekend: 'all',
  filterPeople: [], soloStage: null, now: date, onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null, onSoloStage: () => {},
});
const render = (date) => { const root = document.createElement('div'); document.body.appendChild(root); renderWall(root, mkCtx(date)); return root; };
const local = (s) => new Date(s); // no Z: local time, the phone's clock

test('festivalClock: a festival day runs past midnight — 12:40 AM Sunday is still Saturday at 24:40', () => {
  assert.deepEqual(now.festivalClock(local('2026-09-26T17:42:00')), { iso: '2026-09-26', minutes: 17 * 60 + 42 });
  assert.deepEqual(now.festivalClock(local('2026-09-27T00:40:00')), { iso: '2026-09-26', minutes: 24 * 60 + 40 });
  assert.deepEqual(now.festivalClock(local('2026-09-27T05:00:00')), { iso: '2026-09-27', minutes: 5 * 60 });
  assert.equal(now.clockLabel(17 * 60 + 42), '5:42 PM');
  assert.equal(now.clockLabel(24 * 60 + 40), '12:40 AM');
});

test('dayIsoOf / nowOnDay: iso for one weekend, isos per weekend, null when the file does not say', () => {
  assert.equal(now.dayIsoOf({ iso: '2026-09-26' }), '2026-09-26');
  assert.equal(now.dayIsoOf({ isos: { W1: '2026-10-02', W2: '2026-10-09' } }, 'W2'), '2026-10-09');
  assert.equal(now.dayIsoOf({ date: 'Sep 26' }), null);
  assert.equal(now.nowOnDay(portola, 'Saturday', null, local('2026-09-26T17:42:00')), 17 * 60 + 42);
  assert.equal(now.nowOnDay(portola, 'Sunday', null, local('2026-09-26T17:42:00')), null);
  assert.equal(now.nowOnDay(portola, 'Afters', null, local('2026-09-26T17:42:00')), null, 'a section without an iso never gets a line');
});

test('nowOffsetPx: on the grid, a little before doors, never far past the last set', () => {
  const geo = { startRow: 54, rows: 40, pitch: 24 }; // 1:30 PM start, 10 hours
  assert.equal(now.nowOffsetPx(54 * 15, geo), 0);
  assert.equal(now.nowOffsetPx(54 * 15 + 60, geo), 96, 'an hour in = 4 rows × 24px');
  assert.equal(now.nowOffsetPx(54 * 15 - 20, geo), 0, 'just before doors clamps to the top');
  assert.equal(now.nowOffsetPx(54 * 15 - 90, geo), null, 'well before doors: no line');
  assert.equal(now.nowOffsetPx((54 + 40) * 15 + 90, geo), null, 'well after the last set: no line');
});

test('the wall draws the now line on today’s grid only, with a clock label on the rail', () => {
  const root = render(local('2026-09-27T17:42:00'));
  const lines = root.querySelectorAll('.now-line');
  assert.equal(lines.length, 1);
  const grid = lines[0].closest('.times-grid');
  assert.equal(grid.dataset.iso, '2026-09-27', 'Sunday, not Saturday');
  const startRow = Number(grid.dataset.startRow);
  const expected = ((17 * 60 + 42) / 15 - startRow) * 24 - 1;
  assert.equal(lines[0].style.top, `${expected}px`);
  const label = root.querySelector('.now-label');
  assert.equal(label.textContent, '5:42 PM');
  root.remove();
  const off = render(local('2026-09-20T17:42:00'));
  assert.equal(off.querySelectorAll('.now-line').length, 0, 'a week early: no line anywhere');
  off.remove();
});

test('the ticker moves the line without a repaint, and removes it once the day is over', () => {
  const root = render(local('2026-09-26T14:00:00'));
  const line = root.querySelector('.now-line');
  const before = line.style.top;
  positionNowLines(root, local('2026-09-26T15:00:00'));
  assert.equal(root.querySelector('.now-line'), line, 'same node, moved');
  assert.equal(parseFloat(line.style.top) - parseFloat(before), 96, 'one hour = 96px');
  assert.equal(root.querySelector('.now-label').textContent, '3:00 PM');
  positionNowLines(root, local('2026-09-27T14:00:00'));
  assert.equal(root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line'), null, 'Saturday’s line is gone');
  assert.ok(root.querySelector('.times-grid[data-iso="2026-09-27"] .now-line'), 'Sunday’s appeared');
  positionNowLines(root, local('2026-09-28T14:00:00'));
  assert.equal(root.querySelectorAll('.now-line').length, 0, 'the day after: nothing');
  root.remove();
});

test('scrollToNowLine lands the line a third of the way down the viewport; no line = no scroll', () => {
  const root = render(local('2026-09-26T20:00:00'));
  const calls = [];
  const line = root.querySelector('.now-line');
  line.getBoundingClientRect = () => ({ top: 1200 });
  assert.equal(scrollToNowLine(root, { viewportHeight: 900, scrollTo: (y) => calls.push(y) }), true);
  assert.deepEqual(calls, [1200 - 297]);
  root.remove();
  const off = render(local('2026-09-20T20:00:00'));
  assert.equal(scrollToNowLine(off, { viewportHeight: 900, scrollTo: (y) => calls.push(y) }), false);
  assert.equal(calls.length, 1);
  off.remove();
});

test('validator: dayMeta iso / isos must be real dates', () => {
  const base = { id: 'x', name: 'X', status: 'lineup', artists: [{ name: 'A', day: 'Friday' }] };
  assert.deepEqual(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-10-02' } } }).errors, []);
  assert.deepEqual(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W1: '2026-10-02', W2: '2026-10-09' } } } }).errors, []);
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-13-02' } } }).errors.some((e) => e.includes('iso must be a real')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W3: '2026-10-02' } } } }).errors.some((e) => e.includes('unknown weekend')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: null } }).errors.some((e) => e.includes('must be an object')));
  assert.deepEqual(validateFestivalDoc(portola).errors, [], 'Portola carries real isos');
});
