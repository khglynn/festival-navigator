// The city season's view (2026-09-25, claude-plans/2026-09-25-season-v0/):
// a `kind: season` file renders as months of cards from today on, each month
// cut into Monday-to-Sunday weeks under one-line heads; the card says its
// date; the zoom says the rest; YOURS leads for someone who has connected
// Spotify; Austin sits after the festivals in every list. Rendered by the real
// modules in jsdom with the clock PINNED (ctx.now and the model's `today`) —
// never the real one, so the suite reads the same at 11 PM on a show night as
// it does at noon (memory: tests that pass by daylight).
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const state = await import('../js/state.js');
const model = await import('../js/v3/model.js');
const { FESTIVALS, FESTIVAL_INDEX, defaultFestivalId } = await import('../js/festivals.js');
const { renderWall, refreshCard, dayNavOf, wallPlanFor, roomsOf, seasonPlanOf } = await import('../js/v3/wall.js');
const { factsFor, sheetCard } = await import('../js/v3/card-facts.js');
const { seasonModelOf, weekHeadOf, seasonWhen, mondayOf, isSeason } = await import('../js/v3/events.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

// Friday 2026-09-25, 8 PM in Austin — a show night.
const NOW = new Date('2026-09-25T20:00:00-05:00');
const TODAY = '2026-09-25';
const show = (name, date, venue, more = {}) => ({ name, day: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(date.slice(5, 7)) - 1], date, venue, ...more });
const SEASON = {
  id: 'season-test', kind: 'season', name: 'Austin', year: "'26–27", subtitle: 'Winter + Spring', location: 'Austin, TX',
  dates: 'Aug 2026 – Jan 2027', status: 'scheduled', timezone: 'America/Chicago', accent: '244, 114, 182', days: {},
  venues: { Mohawk: 'https://maps.google.com/?q=Mohawk' },
  artists: [
    show('Last Month', '2026-08-30', 'Parish', { time: '8 PM' }),                 // a month that is over
    show('Last Sunday', '2026-09-20', 'Parish', { time: '8 PM' }),                // this month, before today
    show('Late Tonight', TODAY, 'Mohawk', { time: '9 PM' }),
    show('Early Tonight', TODAY, 'Parish', { time: '7 PM', doors: '6 PM' }),
    show('No Clock', TODAY, 'Hotel Vegas'),
    show('Sunday Thing', '2026-09-27', 'Scoot Inn', { time: '8 PM' }),
    show('Monday Next', '2026-09-28', 'Mohawk', { time: '8 PM' }),
    show('Twice Band', '2026-10-01', 'Mohawk', { time: '8 PM' }),
    show('Called Off', '2026-10-06', 'Mohawk', { time: '8 PM', cancelled: { on: '2026-09-24', source: 'https://do512.com/x' }, page: { url: 'https://do512.com/called-off', at: 'Do512' } }),
    show('Tuesday Show', '2026-10-07', 'Parish', { time: '8 PM' }),
    show('Twice Band', '2026-10-20', 'Parish', { time: '9 PM' }),
    show('Rich Show', '2026-10-24', 'Mohawk', {
      time: '8 PM', doors: '7 PM', with: ['Opener One', 'Opener Two', 'Opener Three', 'Opener Four'],
      tickets: { url: 'https://www.ticketmaster.com/e/1', at: 'Ticketmaster' }, page: { url: 'https://do512.com/e/1', at: 'Do512' },
      onSale: '2026-10-02T10:00:00-05:00',
      presales: [{ name: 'Old', start: '2026-09-01T10:00:00-05:00' }, { name: 'Artist Presale', start: '2026-09-30T10:00:00-05:00' }],
    }),
    show('Sold Right Out', '2026-10-25', 'Parish', { time: '8 PM', soldOut: true, tickets: { url: 'https://www.axs.com/e/2', at: 'AXS' } }),
    show('On Sale Already', '2026-10-26', 'Parish', { time: '8 PM', onSale: '2026-09-01T10:00:00-05:00' }),
    show('First Of November', '2026-11-01', 'Mohawk', { time: '8 PM' }),
    show('New Year Show', '2027-01-15', 'Parish', { time: '8 PM' }),
  ],
  dayMeta: {},
};
const FEST = {
  id: 'fest-test', name: 'Portola', status: 'scheduled', timezone: 'America/Los_Angeles',
  dayMeta: { Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' } },
  artists: [{ name: 'Rich Show', day: 'Saturday' }, { name: 'Grid Act', day: 'Saturday' }],
  days: { Saturday: { stages: ['Main'], artists: [{ name: 'Rich Show', stage: 'Main', time: '8:00 PM - 9:00 PM' }, { name: 'Grid Act', stage: 'Main', time: '9:00 PM - 10:00 PM' }] } },
};

const TOKEN = 'seasonviewtoken_0123456789';
FESTIVAL_INDEX.push({ id: 'season-test', kind: 'season', status: 'scheduled', startsOn: '2026-09-24', name: 'Austin' }, { id: 'fest-test', status: 'scheduled', startsOn: '2026-09-26', name: 'Portola' });
FESTIVALS['season-test'] = SEASON;
FESTIVALS['fest-test'] = FEST;
const DOC = {
  v: 4, meta: {}, spotify: {},
  people: { Kevin: { colorIndex: 0 }, Nhu: { colorIndex: 1 } },
  festivals: {
    'season-test': { selections: { 'Twice Band': { Nhu: 3 } } },
    // A pick at another festival makes a season show "yours" too.
    'fest-test': { selections: { 'Sunday Thing': { Kevin: 2 }, 'Monday Next': { Nhu: 4 } } },
  },
  affinity: { Kevin: { 'Rich Show': { songs: 12, followed: true }, 'Called Off': { songs: 3 } } },
};
state.activateCrew(TOKEN, DOC, 'season-test');

const ctxFor = (fid, over = {}) => {
  const ctx = {
    fid, meName: 'Kevin', affinity: state.affinityLookup('Kevin'), lowPower: true, sort: 'billing', query: '', weekend: 'all',
    filterPeople: [], folded: [], now: NOW, taps: [], opened: [],
    picks: model.picksFor(state.crewDoc, fid),
    onOpenNotes: (a) => ctx.opened.push(a), onNotesChange: null, onOpenDayNotes: () => {},
    ...over,
  };
  ctx.onTap = over.onTap || ((artist, el) => { ctx.taps.push(artist); return refreshCard(el, artist, ctx); });
  return ctx;
};
const render = (fid, over = {}) => {
  state.setActiveFestivalId(fid);
  const root = document.getElementById('wall-root');
  const ctx = ctxFor(fid, over);
  renderWall(root, ctx);
  return { root, ctx };
};
const heads = (root, block) => [...root.querySelectorAll(`.day-block[data-day="${block}"] .room-head`)]
  .map((h) => `${h.querySelector('.name').textContent}|${h.querySelector('.sub').textContent}`);
const cardsIn = (el) => [...el.querySelectorAll('.card')].map((c) => `${c.dataset.artist}|${c.querySelector('.time')?.textContent || ''}`);

test('the season file is a valid festival document', () => {
  const { errors } = validateFestivalDoc(SEASON, { filename: 'season-test.json' });
  assert.deepEqual(errors, []);
  assert.ok(isSeason(SEASON) && !isSeason(FEST));
});

test('the model: from today on — a month that is over is gone, and so are the days before today', () => {
  const m = seasonModelOf(SEASON, { today: TODAY });
  assert.deepEqual(m.months.map((x) => x.key), ['September', 'October', 'November', 'January'], 'August is over; the months follow the calendar');
  const names = m.months.flatMap((x) => x.weeks.flatMap((w) => w.entries.map((e) => e.name)));
  assert.ok(!names.includes('Last Sunday') && !names.includes('Last Month'));
  assert.equal(m.yours, null, 'no isYours, no YOURS at all');
  // A month whose every show is before today is over even in its own month.
  const late = seasonModelOf(SEASON, { today: '2026-09-30' });
  assert.equal(late.months[0].key, 'October');
});

test('the model: a month is its shows by date, then start, then file order — a show with no time last on its date', () => {
  const sep = seasonModelOf(SEASON, { today: TODAY }).months[0];
  assert.deepEqual(sep.weeks.map((w) => w.entries.map((e) => e.name)), [
    ['Early Tonight', 'Late Tonight', 'No Clock', 'Sunday Thing'],
    ['Monday Next'],
  ]);
});

test('the model: weeks run Monday to Sunday, clamped to the month and to today; this week and next say so', () => {
  const m = seasonModelOf(SEASON, { today: TODAY });
  const w = (k) => m.months.find((x) => x.key === k).weeks.map((x) => `${x.from}..${x.to}:${x.when || ''}`);
  assert.deepEqual(w('September'), ['2026-09-25..2026-09-27:this', '2026-09-28..2026-09-30:next'], 'this week starts today; next week stops at the month');
  assert.deepEqual(w('October').slice(0, 2), ['2026-10-01..2026-10-04:next', '2026-10-05..2026-10-11:'], 'the other half of next week, in its own month');
  assert.deepEqual(w('November'), ['2026-11-01..2026-11-01:'], 'a Sunday the month cuts to one day');
  assert.equal(mondayOf('2026-09-25'), '2026-09-21');
  assert.equal(mondayOf('2026-09-21'), '2026-09-21');
  assert.equal(mondayOf('2026-09-27'), '2026-09-21');
  assert.deepEqual(weekHeadOf({ from: '2026-10-05', to: '2026-10-11' }), { wd: 'OCT', label: '5 – 11' });
  assert.deepEqual(weekHeadOf({ from: '2026-11-01', to: '2026-11-01' }), { wd: 'NOV', label: '1' });
});

test('the model: a cancelled show stays on the wall, last in its week, and never counts as on', () => {
  const oct = seasonModelOf(SEASON, { today: TODAY }).months.find((x) => x.key === 'October');
  const week = oct.weeks.find((w) => w.monday === '2026-10-05');
  assert.deepEqual(week.entries.map((e) => e.name), ['Tuesday Show', 'Called Off'], 'the cancelled Oct 6 show sorts after Oct 7');
  assert.equal(oct.count, oct.weeks.reduce((s, x) => s + x.entries.length, 0) - 1);
});

test('the model: YOURS is Spotify and picks elsewhere, soonest first, never a cancelled show', () => {
  const picked = model.pickedElsewhere(state.crewDoc, 'Kevin', 'season-test');
  assert.deepEqual([...picked], ['sunday thing'], 'your own picks at other fests — never a crew-mate’s');
  const isYours = (n) => n === 'Rich Show' || n === 'Called Off' || picked.has(n.toLowerCase());
  const m = seasonModelOf(SEASON, { today: TODAY, isYours });
  assert.deepEqual(m.yours.map((e) => e.name), ['Sunday Thing', 'Rich Show']);
});

test('the card says its date, and its start when it has one; a cancelled show says so first', () => {
  const s = (name) => seasonWhen(SEASON.artists.find((a) => a.name === name));
  assert.equal(s('Early Tonight'), 'Fri · Sep 25 · 7 PM');
  assert.equal(s('No Clock'), 'Fri · Sep 25');
  assert.equal(s('Called Off'), 'Cancelled · Tue · Oct 6');
});

test('the wall: YOURS, then the months — each a block the tabs land on, each week under one head', () => {
  const { root } = render('season-test');
  const blocks = [...root.querySelectorAll(':scope > .day-block')].map((b) => `${b.dataset.day}:${b.dataset.kind}`);
  assert.deepEqual(blocks, ['yours:yours', 'September:month', 'October:month', 'November:month', 'January:month']);
  assert.deepEqual(heads(root, 'yours'), ['YOURS|From your Spotify and picks']);
  assert.deepEqual(heads(root, 'September'), ['SEP 25 – 27|This week', 'SEP 28 – 30|Next week']);
  assert.deepEqual(heads(root, 'October').slice(0, 2), ['OCT 1 – 4|Next week', 'OCT 5 – 11|']);
  const sep = root.querySelector('.day-block[data-day="September"]');
  assert.deepEqual(cardsIn(sep).slice(0, 3), ['Early Tonight|Fri · Sep 25 · 7 PM', 'Late Tonight|Fri · Sep 25 · 9 PM', 'No Clock|Fri · Sep 25']);
  // The same card a lineup draws, in the same grid; its occurrence is its show.
  const card = sep.querySelector('.card[data-artist="Early Tonight"]');
  assert.ok(card.closest('.wall-grid'));
  assert.equal(JSON.parse(card.dataset.occ).date, TODAY);
  // Nothing is split by location on the wall: no venue stacks, no venue heads.
  assert.equal(root.querySelectorAll('.venue-grid, .venue-group, .stage-head').length, 0);
  // An artist's two nights are two cards sharing one pick.
  assert.equal(root.querySelectorAll('.day-block[data-kind="month"] .card[data-artist="Twice Band"]').length, 2);
});

test('the tabs: YOURS, then a tab per month; none carries a date (no date notes in a season)', () => {
  state.setActiveFestivalId('season-test');
  const tabs = dayNavOf(SEASON, ctxFor('season-test'));
  assert.deepEqual(tabs.map((t) => `${t.key}:${t.short}:${t.long}`), [
    'yours:YOURS:YOURS', 'September:SEP:SEPTEMBER', 'October:OCT:OCTOBER', 'November:NOV:NOVEMBER', 'January:JAN:JANUARY ’27',
  ]);
  assert.ok(tabs.every((t) => t.dates.length === 0));
  assert.equal(wallPlanFor(SEASON, ctxFor('season-test')), null, 'a season is not a week of days');
  assert.deepEqual(roomsOf(SEASON, ctxFor('season-test')), [], 'no rooms to hide: the fest name opens Settings');
});

test('no Spotify, no YOURS — not even with picks at other festivals', () => {
  const { root } = render('season-test', { affinity: null });
  assert.equal(root.querySelector('.day-block[data-day="yours"]'), null);
  assert.equal(dayNavOf(SEASON, ctxFor('season-test', { affinity: null }))[0].key, 'September');
});

test('a search answers by name or by location, in date order, and the answer says where', () => {
  const { root } = render('season-test', { query: 'mohawk' });
  assert.equal(root.querySelector('.day-block[data-day="yours"]'), null, 'a search is a list of answers, not YOURS');
  assert.equal(root.querySelectorAll('.room-head').length, 0, 'no week heads in a search');
  const all = cardsIn(root);
  assert.deepEqual(all.map((c) => c.split('|')[0]), ['Late Tonight', 'Monday Next', 'Twice Band', 'Called Off', 'Rich Show', 'First Of November']);
  assert.equal(all[0].split('|')[1], 'Fri · Sep 25 · 9 PM\nMohawk');
  const tabs = dayNavOf(SEASON, ctxFor('season-test', { query: 'mohawk' }), root);
  assert.deepEqual(tabs.map((t) => t.key), ['September', 'October', 'November']);
  const none = render('season-test', { query: 'zzzz' }).root;
  assert.match(none.textContent, /No shows match/);
});

test('the zoom: date, start and doors; the bill; the presale still ahead then the on-sale; the other nights', () => {
  state.setActiveFestivalId('season-test');
  const ctx = ctxFor('season-test');
  const occ = (name, date) => {
    const e = SEASON.artists.find((a) => a.name === name && (!date || a.date === date));
    return { day: e.day, stage: null, time: e.time || null, weekend: null, date: e.date, venue: e.venue };
  };
  const rich = factsFor('Rich Show', ctx, occ('Rich Show'));
  assert.equal(rich.when, 'Sat · Oct 24 · 8 PM · Doors 7 PM');
  assert.equal(rich.where, 'Mohawk');
  assert.equal(rich.mapUrl, 'https://maps.google.com/?q=Mohawk');
  assert.equal(rich.bill, 'with Opener One, Opener Two, Opener Three +1');
  assert.deepEqual(rich.sale, ['Presale Wed · Sep 30 · 10 AM', 'On sale Fri · Oct 2 · 10 AM'], 'a past presale says nothing');
  assert.deepEqual(rich.links.map((l) => l.text), ['Tix @ Ticketmaster', 'Info @ Do512']);
  assert.equal(rich.also, null);
  assert.deepEqual(factsFor('Sold Right Out', ctx, occ('Sold Right Out')).sale, ['Sold out']);
  assert.equal(factsFor('On Sale Already', ctx, occ('On Sale Already')).sale, null, 'an on-sale in the past is not news');
  assert.equal(factsFor('Twice Band', ctx, occ('Twice Band', '2026-10-01')).also, 'Also Tue Oct 20 at Parish');
  assert.equal(factsFor('Twice Band', ctx, occ('Twice Band', '2026-10-20')).also, 'Also Thu Oct 1 at Mohawk');
  const off = factsFor('Called Off', ctx, occ('Called Off'));
  assert.equal(off.when, 'Cancelled · Tue · Oct 6');
  assert.equal(off.sale, null);
  assert.deepEqual(off.links.map((l) => l.text), ['Info @ Do512'], 'a cancelled show keeps its page, loses its tickets');
});

test('the grown card draws the season lines in order, and a festival zoom draws none of them', () => {
  state.setActiveFestivalId('season-test');
  const { root } = render('season-test');
  const card = root.querySelector('.day-block[data-kind="month"] .card[data-artist="Rich Show"]');
  const f = factsFor('Rich Show', ctxFor('season-test'), JSON.parse(card.dataset.occ));
  const grown = sheetCard(f, { onClose: () => {} }).querySelector('.f-grown');
  assert.deepEqual([...grown.children].map((n) => n.classList[0] === 'f-quiet' ? n.classList[1] : n.classList[0]),
    ['f-bill', 'f-sub', 'f-where', 'f-links', 'f-sale', 'f-chips'], 'the bill under the name, the sale under the ticket doors');
  assert.deepEqual([...grown.querySelectorAll('.f-sale > span')].map((n) => n.textContent), f.sale, 'one line each');
  // The festival: the same name, a grid set — no season keys at all.
  state.setActiveFestivalId('fest-test');
  const fest = factsFor('Rich Show', ctxFor('fest-test'), { day: 'Saturday', stage: 'Main', time: '8:00 PM - 9:00 PM', weekend: null });
  assert.equal(fest.bill, undefined);
  assert.equal(fest.sale, undefined);
  assert.equal(fest.also, undefined);
});

test('the plan reads the season’s own clock: at 1 AM Saturday it is still Friday night in Austin', () => {
  state.setActiveFestivalId('season-test');
  const plan = seasonPlanOf(SEASON, ctxFor('season-test', { now: new Date('2026-09-26T01:00:00-05:00') }));
  assert.equal(plan.today, TODAY);
  assert.equal(plan.months[0].weeks[0].entries[0].name, 'Early Tonight');
});

test('lists: the season follows the upcoming festivals and precedes the past ones; it is never the default', () => {
  const index = [
    { id: 'austin', kind: 'season', status: 'scheduled', startsOn: '2026-09-24' },
    { id: 'portola', status: 'scheduled', startsOn: '2026-09-26' },
    { id: 'acl', status: 'scheduled', startsOn: '2026-10-02' },
    { id: 'ef', status: 'archived', startsOn: '2026-06-25' },
  ];
  const doc = { festivals: { austin: {}, portola: {}, acl: {}, ef: {} }, people: {} };
  const pairs = model.landingPairs([{ token: 't', name: 'c' }], () => doc, index);
  assert.deepEqual(pairs.map((p) => `${p.fid}:${p.season ? 'season' : p.past ? 'past' : 'fest'}`), ['portola:fest', 'acl:fest', 'austin:season', 'ef:past']);
  const saved = FESTIVAL_INDEX.splice(0);
  try {
    FESTIVAL_INDEX.push(...index);
    assert.equal(defaultFestivalId(), 'portola', 'a season leading the index is still not the default');
  } finally {
    FESTIVAL_INDEX.splice(0, FESTIVAL_INDEX.length, ...saved);
  }
});
