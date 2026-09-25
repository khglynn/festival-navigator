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
  filterPeople: [], now: date, onTap: () => {}, onOpenNotes: null, onNotesChange: null, onOpenDayNotes: null,
});
const render = (date) => { const root = document.createElement('div'); document.body.appendChild(root); renderWall(root, mkCtx(date)); return root; };
const local = (s) => new Date(s); // no Z: the phone's own clock (the no-timezone path)
const pt = (s) => new Date(`${s}-07:00`); // an instant whose Portola (PDT) wall clock reads s, whatever zone runs the tests

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
  assert.equal(now.nowOnDay(portola, 'Saturday', null, pt('2026-09-26T17:42:00')), 17 * 60 + 42);
  assert.equal(now.nowOnDay(portola, 'Sunday', null, pt('2026-09-26T17:42:00')), null);
  assert.equal(now.nowOnDay(portola, 'Afters', null, pt('2026-09-26T17:42:00')), null, 'a section without an iso never gets a line');
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
  const root = render(pt('2026-09-27T17:42:00'));
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
  const off = render(pt('2026-09-20T17:42:00'));
  assert.equal(off.querySelectorAll('.now-line').length, 0, 'a week early: no line anywhere');
  off.remove();
});

// The line spans EVERY column (Kevin's local demo, 2026-09-24: at 430 it
// stopped partway across the grid, and scrolled to Warehouse / Ship Tent there
// was none). It is `left: 0; right: 0` of its grid's box, and that box was the
// scroller's width while the fixed-length tracks overflowed it. jsdom lays
// nothing out, so this pins the two facts the geometry follows from — the
// browser contract (tests/browser/now-jump.test.mjs) measures the result:
//   · the line's grid is sized to its tracks (width: max-content), every
//     track a fixed length, so the box ends where the last column ends;
//   · the stage strip's row is NOT (its follow reads the lead's scroll range,
//     and nothing there needed to move).
test('the now line’s grid is as wide as its columns, so the line crosses the last one', () => {
  const root = render(pt('2026-09-26T22:30:00'));
  const line = root.querySelector('.now-line');
  const grid = line.closest('.times-grid');
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const lineRule = css.match(/\.now-line\s*\{([^}]*)\}/)[1];
  assert.match(lineRule, /left:\s*0/);
  assert.match(lineRule, /right:\s*0/, 'the line is its grid box, edge to edge');
  const sized = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /(^|;)\s*width:\s*max-content/.test(body))
    .map(([, sel]) => sel.trim())
    .filter((sel) => sel.includes('.times-grid'));
  assert.ok(sized.length, 'some rule sizes a times grid to its tracks');
  assert.ok(sized.some((sel) => grid.matches(sel)), `the line's grid is one of them: ${sized.join(' | ')}`);
  const tracks = grid.style.gridTemplateColumns.trim().split(/\s+(?![^(]*\))/);
  assert.ok(tracks.length > 1 && tracks.every((t) => t === 'var(--col-w)'), `fixed tracks, one token: ${grid.style.gridTemplateColumns}`);
  const strip = root.querySelector('.stage-strip .times-grid');
  assert.ok(strip, 'the strip is on this wall');
  assert.ok(!sized.some((sel) => strip.matches(sel)), 'the strip’s row keeps its own box');
  root.remove();
});

test('the ticker moves the line without a repaint, and removes it once the day is over', () => {
  const root = render(pt('2026-09-26T14:00:00'));
  const line = root.querySelector('.now-line');
  const before = line.style.top;
  positionNowLines(root, pt('2026-09-26T15:00:00'));
  assert.equal(root.querySelector('.now-line'), line, 'same node, moved');
  assert.equal(parseFloat(line.style.top) - parseFloat(before), 96, 'one hour = 96px');
  assert.equal(root.querySelector('.now-label').textContent, '3:00 PM');
  positionNowLines(root, pt('2026-09-27T14:00:00'));
  assert.equal(root.querySelector('.times-grid[data-iso="2026-09-26"] .now-line'), null, 'Saturday’s line is gone');
  assert.ok(root.querySelector('.times-grid[data-iso="2026-09-27"] .now-line'), 'Sunday’s appeared');
  positionNowLines(root, pt('2026-09-28T14:00:00'));
  assert.equal(root.querySelectorAll('.now-line').length, 0, 'the day after: nothing');
  root.remove();
});

test('scrollToNowLine: the line a third of the way down; before doors on festival day, today’s header; otherwise nothing', () => {
  const root = render(pt('2026-09-26T20:00:00'));
  const calls = [];
  const line = root.querySelector('.now-line');
  line.getBoundingClientRect = () => ({ top: 1200 });
  assert.equal(scrollToNowLine(root, { date: pt('2026-09-26T20:00:00'), viewportHeight: 900, scrollTo: (y) => calls.push(y) }), 'now');
  assert.deepEqual(calls, [1200 - 297]);
  root.remove();
  // Sunday 10 AM: no line yet (doors at 1 PM) — land on Sunday's header.
  const morning = render(pt('2026-09-27T10:00:00'));
  assert.equal(morning.querySelectorAll('.now-line').length, 0);
  // The day's block: its first head is where the day starts (one-line heads,
  // 2026-09-23 — there is no day line above it any more).
  const sunday = morning.querySelector('.day-block[data-iso="2026-09-27"]');
  assert.equal(sunday.firstElementChild.querySelector('.room-head .name').textContent, 'SUN PORTOLA');
  sunday.getBoundingClientRect = () => ({ top: 3000 });
  assert.equal(scrollToNowLine(morning, { date: pt('2026-09-27T10:00:00'), viewportHeight: 900, scrollTo: (y) => calls.push(y) }), 'day');
  assert.equal(calls[1], 3000);
  morning.remove();
  const off = render(pt('2026-09-20T20:00:00'));
  assert.equal(scrollToNowLine(off, { date: pt('2026-09-20T20:00:00'), viewportHeight: 900, scrollTo: (y) => calls.push(y) }), null);
  assert.equal(calls.length, 2);
  off.remove();
});

test('the day-of open: one claim per festival-day, marked only after a real landing, so a pre-festival open does not spend it and an afternoon Settings close does not repeat it', () => {
  const store = new Map();
  const fake = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  const calls = [];
  const opts = (date) => ({ date, viewportHeight: 900, scrollTo: (y) => calls.push(y) });
  // The app's glue, inlined: scrolledBefore → scrollToNowLine → rememberScrolled,
  // keyed in the festival's zone like app.js does (CI runs in UTC; a key on
  // the device date put 12:40 AM PDT on the 28th there — caught 2026-08-27).
  const open = (root, date) => {
    const key = now.dayOfScrollKey('portola-2026', date, portola.timezone);
    if (now.scrolledBefore(key, fake)) return 'skipped';
    const target = scrollToNowLine(root, opts(date));
    if (target) now.rememberScrolled(key, fake);
    return target;
  };
  const week = render(pt('2026-09-20T20:00:00'));
  assert.equal(open(week, pt('2026-09-20T20:00:00')), null, 'a week early: nothing to land on');
  assert.equal(store.size, 0, 'and the claim was NOT spent');
  week.remove();
  const morning = render(pt('2026-09-27T10:00:00'));
  morning.querySelector('.day-block[data-iso="2026-09-27"]').getBoundingClientRect = () => ({ top: 3000 });
  assert.equal(open(morning, pt('2026-09-27T10:00:00')), 'day', 'festival morning: today\'s header');
  morning.remove();
  const afternoon = render(pt('2026-09-27T17:42:00'));
  assert.equal(open(afternoon, pt('2026-09-27T17:42:00')), 'skipped', 'closing Settings that afternoon does not scroll again');
  assert.equal(now.dayOfScrollKey('portola-2026', pt('2026-09-28T00:40:00'), portola.timezone), now.dayOfScrollKey('portola-2026', pt('2026-09-27T17:42:00'), portola.timezone), '12:40 AM is still Sunday');
  assert.notEqual(now.dayOfScrollKey('portola-2026', pt('2026-09-26T17:42:00'), portola.timezone), now.dayOfScrollKey('portola-2026', pt('2026-09-27T17:42:00'), portola.timezone), 'Saturday and Sunday each get their one landing');
  afternoon.remove();
});

test('claimScrollOnce: once per key for the life of the page, remembered across a reload when storage allows, never thrown off by a blocked store', () => {
  const store = new Map();
  const fake = { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) };
  assert.equal(now.claimScrollOnce('k1', fake), true);
  assert.equal(now.claimScrollOnce('k1', fake), false, 'second open in the same page: no');
  assert.equal(store.get('k1'), '1', 'remembered for a reload');
  assert.equal(now.claimScrollOnce('k2', { getItem: () => '1', setItem: () => {} }), false, 'a reload that finds the flag: no');
  const denied = () => { throw new DOMException('blocked', 'SecurityError'); };
  assert.equal(now.claimScrollOnce('k3', { getItem: denied, setItem: denied }), true, 'blocked store: memory decides');
  assert.equal(now.claimScrollOnce('k3', { getItem: denied, setItem: denied }), false, 'and it still does not scroll twice');
});

test('festivalClock with a timezone: the festival\'s wall clock, whatever zone the phone is in', () => {
  const LA = 'America/Los_Angeles';
  assert.deepEqual(now.festivalClock(new Date('2026-09-26T22:00:00Z'), LA), { iso: '2026-09-26', minutes: 15 * 60 }, 'an Austin phone at 5 PM CT sees Portola at 3 PM PT');
  assert.deepEqual(now.festivalClock(new Date('2026-09-27T07:40:00Z'), LA), { iso: '2026-09-26', minutes: 24 * 60 + 40 }, '12:40 AM PT is still Saturday, at 24:40');
  assert.deepEqual(now.festivalClock(new Date('2026-09-27T12:00:00Z'), LA), { iso: '2026-09-27', minutes: 5 * 60 }, '5:00 AM PT rolls over to Sunday');
  assert.deepEqual(now.festivalClock(new Date('2026-11-01T09:30:00Z'), 'America/Chicago'), { iso: '2026-10-31', minutes: 24 * 60 + 3 * 60 + 30 }, 'the hour after DST ends reads 3:30 AM CST, still Saturday');
  const d = new Date('2026-09-26T22:00:00Z');
  assert.deepEqual(now.festivalClock(d, 'Not/AZone'), now.festivalClock(d), 'an unknown zone falls back to the device clock');
  assert.equal(now.dayOfScrollKey('portola-2026', new Date('2026-09-27T07:40:00Z'), LA), 'fn_scrolled_v2_portola-2026_2026-09-26');
  assert.equal(now.nowOnDay(portola, 'Saturday', null, new Date('2026-09-26T22:00:00Z')), 15 * 60, 'the file\'s zone drives nowOnDay');
});

test('validator: dayMeta dates need the festival\'s timezone, and it must be a real zone', () => {
  const base = { id: 'x', name: 'X', status: 'lineup', artists: [{ name: 'A', day: 'Friday' }] };
  assert.deepEqual(validateFestivalDoc(base).errors, [], 'no dates, no zone needed');
  assert.deepEqual(validateFestivalDoc({ ...base, timezone: 'America/Chicago' }).errors, [], 'a zone without dates is fine');
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-10-02' } } }).errors.some((e) => e.includes('timezone is required')), 'dates without a zone');
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W1: '2026-10-02', W2: '2026-10-09' } } } }).errors.some((e) => e.includes('timezone is required')));
  assert.ok(validateFestivalDoc({ ...base, timezone: 'Austin' }).errors.some((e) => e.includes('IANA zone')), 'not a zone name');
  assert.ok(validateFestivalDoc({ ...base, timezone: 7 }).errors.some((e) => e.includes('IANA zone')));
  assert.equal(portola.timezone, 'America/Los_Angeles', 'Portola is Pacific');
});

test('validator: dayMeta iso / isos must be real dates', () => {
  const base = { id: 'x', name: 'X', status: 'lineup', timezone: 'America/Chicago', artists: [{ name: 'A', day: 'Friday' }] };
  assert.deepEqual(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-10-02' } } }).errors, []);
  assert.deepEqual(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W1: '2026-10-02', W2: '2026-10-09' } } } }).errors, []);
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-13-02' } } }).errors.some((e) => e.includes('iso must be a real')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W3: '2026-10-02' } } } }).errors.some((e) => e.includes('unknown weekend')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: null } }).errors.some((e) => e.includes('must be an object')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '0000-10-02' } } }).errors.some((e) => e.includes('real')), 'year 0000 is not a festival');
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { iso: '2026-10-02', isos: { W1: '2026-10-02', W2: '2026-10-09' } } } }).errors.some((e) => e.includes('not both')));
  assert.ok(validateFestivalDoc({ ...base, dayMeta: { Friday: { isos: { W1: '2026-10-02' } } } }).errors.some((e) => e.includes('both W1 and W2')));
  const dup = validateFestivalDoc({ ...base, artists: [{ name: 'A', day: 'Friday' }, { name: 'B', day: 'Saturday' }], dayMeta: { Friday: { iso: '2026-10-02' }, Saturday: { iso: '2026-10-02' } } });
  assert.ok(dup.errors.some((e) => e.includes("already another day's")), 'two days on one date would draw two now lines');
  const mixed = validateFestivalDoc({ ...base, artists: [{ name: 'A', day: 'Friday' }, { name: 'B', day: 'Saturday' }], dayMeta: { Friday: { iso: '2026-10-02' }, Saturday: { isos: { W1: '2026-10-02', W2: '2026-10-09' } } } });
  assert.ok(mixed.errors.some((e) => e.includes("already another day's")), 'a plain iso collides with the same date under a weekend');
  assert.deepEqual(validateFestivalDoc(portola).errors, [], 'Portola carries real isos');
});

test('validator: a morning set (5–11 AM) warns — the schedule axis and the now clock would disagree', () => {
  const r = validateFestivalDoc({
    id: 'x', name: 'X', status: 'scheduled', artists: [{ name: 'A', day: 'Friday' }, { name: 'B', day: 'Friday' }],
    days: { Friday: { stages: ['S'], artists: [{ name: 'A', stage: 'S', time: '9:00 AM - 10:00 AM' }, { name: 'B', stage: 'S', time: '12:30 AM - 1:30 AM' }] } },
  });
  assert.ok(r.warnings.some((w) => w.includes('9:00 AM') && w.includes('one axis')), `9 AM warns: ${r.warnings}`);
  assert.ok(!r.warnings.some((w) => w.includes('12:30 AM')), 'an after-midnight set is the normal case');
});

// A dated section's date is a festival day too (2026-09-23): ACL's Late nights
// runs Sep 29 to Oct 10, and on a between-the-weekends night (Tue Sep 29, the
// Mohawk) the day-of open used to skip it and land on the first grid day,
// Oct 2. Now it lands on tonight's head in the Late nights block — unless a
// real grid day is today, which still wins (Oct 3 has both).
test('the day-of open counts a Late nights date as today; a grid day today still wins; hidden, it counts for nothing', () => {
  const acl = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  FESTIVAL_INDEX.push({ id: 'acl-2026', status: 'scheduled' });
  state.FESTIVALS['acl-2026'] = acl;
  const ct = (s) => new Date(`${s}-05:00`); // an instant whose Austin (CDT) wall clock reads s
  const renderAcl = (date, folded = []) => {
    state.setActiveFestivalId('acl-2026');
    const root = document.createElement('div');
    document.body.appendChild(root);
    renderWall(root, { ...mkCtx(date), fid: 'acl-2026', folded });
    return root;
  };
  const calls = [];
  const opts = (date) => ({ date, viewportHeight: 900, scrollTo: (y) => calls.push(y), timeZone: acl.timezone });
  try {
    // Tue Sep 29, 8 PM in Austin: no grid today, two late-night shows.
    const tue = renderAcl(ct('2026-09-29T20:00:00'));
    const room = tue.querySelector('.day-block[data-day="Late nights"] .room[data-iso="2026-09-29"]');
    assert.ok(room, 'tonight is a room on its own date inside the Late nights block');
    assert.equal(room.querySelector('.room-head .name').textContent, 'TUE LATE NIGHTS');
    room.getBoundingClientRect = () => ({ top: 7000 });
    assert.equal(scrollToNowLine(tue, opts(ct('2026-09-29T20:00:00'))), 'day');
    assert.deepEqual(calls, [7000], 'the open lands on TUE LATE NIGHTS, not on Friday Oct 2');
    // 1 AM is still Tuesday night (the festival day runs to 5 AM).
    assert.equal(scrollToNowLine(tue, opts(ct('2026-09-30T01:00:00'))), 'day');
    assert.deepEqual(calls, [7000, 7000]);
    tue.remove();

    // Sat Oct 3, 9 AM: a grid day AND a late night — the grid day wins.
    const sat = renderAcl(ct('2026-10-03T09:00:00'));
    assert.ok(sat.querySelector('.room[data-iso="2026-10-03"]'), 'there IS a late night on the 3rd');
    sat.querySelector('.day-block[data-iso="2026-10-03"]').getBoundingClientRect = () => ({ top: 3000 });
    sat.querySelector('.room[data-iso="2026-10-03"]').getBoundingClientRect = () => ({ top: 9000 });
    assert.equal(scrollToNowLine(sat, opts(ct('2026-10-03T09:00:00'))), 'day');
    assert.equal(calls.at(-1), 3000, 'SAT ACL MUSIC FESTIVAL, the festival itself');
    sat.remove();

    // Late nights hidden: tonight has nothing to land on, and the shell falls
    // back to its usual open (the first grid day).
    const hidden = renderAcl(ct('2026-09-29T20:00:00'), ['Late nights']);
    assert.equal(scrollToNowLine(hidden, opts(ct('2026-09-29T20:00:00'))), null);
    hidden.remove();
    // A night the section does not play (Wed Sep 30) is not a festival day either.
    const wed = renderAcl(ct('2026-09-30T20:00:00'));
    assert.equal(scrollToNowLine(wed, opts(ct('2026-09-30T20:00:00'))), null);
    wed.remove();
  } finally {
    state.setActiveFestivalId('portola-2026');
  }
});
