// Two-weekend scheduled fests (ACL, 2026-08-23): day keys stay the plain
// weekdays — they are frozen pick data and a rename would strand every pick —
// each set carries weekend: 'W1'|'W2' (untagged/'both' = every weekend), and
// each weekend's Friday is its own tab, because a clock grid showing both at
// once would double-book every stage. A weekend is therefore not a filter over
// the wall any more, it is which day you are looking at — and search reads that
// same axis, so nothing is ever findable on the wall and missing from search.
// Day NOTES key on the date instead of the label since V4 (MODEL-V4 §4), so
// the two Fridays hold two conversations; events-wall covers that.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const state = await import('../js/state.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const { renderWall, dayNavOf, wireScrollspy } = await import('../js/v3/wall.js');
const { validateFestivalDoc } = await import('../api/_lib/festival-rules.mjs');

const FEST = {
  id: 'two-wk-fest', name: 'Two Weekend Fest', status: 'scheduled',
  artists: [
    { name: 'Shared Head', day: 'Friday', weekends: 'both' },
    { name: 'One Only', day: 'Friday', weekends: 'W1' },
    { name: 'Two Only', day: 'Friday', weekends: 'W2' },
    { name: 'Beta Both', day: 'Friday', weekends: 'both' },
  ],
  dayMeta: { Friday: { wd: 'Fri', dates: { W1: 'Oct 2', W2: 'Oct 9' } } },
  days: {
    Friday: {
      stages: ['Alpha', 'Beta'],
      artists: [
        { name: 'Shared Head', stage: 'Alpha', time: '6:00 PM - 7:00 PM' },
        { name: 'One Only', stage: 'Alpha', time: '8:00 PM - 9:00 PM', weekend: 'W1' },
        { name: 'Two Only', stage: 'Alpha', time: '8:00 PM - 9:00 PM', weekend: 'W2' },
        { name: 'Beta Both', stage: 'Beta', time: '7:00 PM - 8:00 PM', weekend: 'both' },
      ],
    },
  },
};

FESTIVAL_INDEX.push({ id: 'two-wk-fest', status: 'scheduled' });
state.activateCrew('twowktesttoken_012345678', {
  v: 4, meta: {}, spotify: {}, people: { Kevin: { colorIndex: 3 } },
  festivals: { 'two-wk-fest': { selections: {} } }, affinity: {},
});
state.FESTIVALS['two-wk-fest'] = FEST;
state.setActiveFestivalId('two-wk-fest');

const mkCtx = (weekend, query = '') => ({
  fid: 'two-wk-fest', meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
  sort: 'day', query, weekend, onTap: () => {}, onOpenNotes: null,
  onNotesChange: null, onOpenDayNotes: null,
});

test('getDayArtists filters by weekend; untagged and both play every weekend', () => {
  const w1 = state.getDayArtists('Friday', 'W1').map((a) => a.name);
  const w2 = state.getDayArtists('Friday', 'W2').map((a) => a.name);
  assert.deepEqual(w1.sort(), ['Beta Both', 'One Only', 'Shared Head']);
  assert.deepEqual(w2.sort(), ['Beta Both', 'Shared Head', 'Two Only']);
  const all = state.getDayArtists('Friday').map((a) => a.name);
  assert.equal(all.length, 4, 'no weekend = no filter (single-weekend fests)');
});

test('both weekends are on the wall, each as its own day: two Fridays, each with its own date and its own sets (MODEL-V4 §2)', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx('all'));

  // One day block per dated Friday, and the festival's own head on each says
  // which: `FRI TWO WEEKEND FEST  Oct 2 · Weekend 1` (one-line heads, 2026-09-23).
  const blocks = [...root.querySelectorAll('.day-block')];
  assert.deepEqual(blocks.map((b) => {
    const head = b.querySelector('.room-head');
    return [b.dataset.day, head.querySelector('.name').textContent, head.querySelector('.sub').textContent];
  }), [['Friday|W1', 'FRI TWO WEEKEND FEST', 'Oct 2 · Weekend 1'], ['Friday|W2', 'FRI TWO WEEKEND FEST', 'Oct 9 · Weekend 2']],
  'the weekend is which day you are looking at, not a filter over one');
  // The tab's number is the day of the month, and it comes from the iso —
  // this fixture prints dates and no isos, so the tabs read FRI and FRI and
  // the rule below them is what tells the two apart. (acl-2026 carries isos;
  // events-model covers that shape.)
  assert.deepEqual(dayNavOf(FEST, mkCtx('all')).map((d) => [d.key, d.short, d.num]),
    [['Friday|W1', 'FRI', null], ['Friday|W2', 'FRI', null]]);
  const namesOn = (tab) => [...blocks.find((b) => b.dataset.day === tab).querySelectorAll('.card')].map((c) => c.dataset.artist).sort();
  assert.deepEqual(namesOn('Friday|W1'), ['Beta Both', 'One Only', 'Shared Head']);
  assert.deepEqual(namesOn('Friday|W2'), ['Beta Both', 'Shared Head', 'Two Only']);
  // The frozen day key never moved: the pick data on both tabs is Friday's.
  const occs = [...root.querySelectorAll('.card')].map((c) => JSON.parse(c.dataset.occ).day);
  assert.ok(occs.every((d) => d === 'Friday'), 'the tab id is a view; the day key is storage');

  root.remove();
});

// Search walks the same dated axis the wall and the day tabs walk. It used to
// ask a surviving `scheduledWeekendOf()` which weekend to answer in, and that
// function defaulted to W1 — with no selector left in the shell it could only
// ever say W1, so a Weekend 2 headliner answered "No artists match".
test('searching a scheduled two-weekend fest answers across the whole dated axis', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx('all', 'only'));
  // A search is a list: each answered day is a block (the tab's anchor) under
  // its one-line list header.
  const blocks = [...root.querySelectorAll('.day-block')];
  assert.deepEqual(blocks.map((b) => [b.dataset.day, b.querySelector('.list-head .sub').textContent]),
    [['Friday|W1', 'Fri · Oct 2 · Weekend 1'], ['Friday|W2', 'Fri · Oct 9 · Weekend 2']],
    'a match under each weekend, each header saying which date it is');
  const namesOn = (tab) => [...blocks.find((b) => b.dataset.day === tab).querySelectorAll('.card')].map((c) => c.dataset.artist);
  assert.deepEqual(namesOn('Friday|W1'), ['One Only']);
  assert.deepEqual(namesOn('Friday|W2'), ['Two Only'], 'the W2 answer is not a wrong turn — it is the other tab');
  // The tabs a search offers are the tabs its headers carry, or a jump lands
  // nowhere.
  assert.deepEqual(dayNavOf(FEST, mkCtx('all', 'only'), root).map((d) => d.key), ['Friday|W1', 'Friday|W2']);
  root.remove();
});

// …and when only ONE of them answers, the nav is that one. The tab list came
// off the plan, so a search that renders a single day still offered every tab
// on the axis: six of ACL's seven jumped to nothing, and at scroll 0 the
// scrollspy lit the first of them — FRI 2, a Weekend 1 tab, over a Weekend 2
// answer (Codex re-check finding 2, 2026-09-17).
test('while a query is on, the day nav is exactly the days that answered — and the first of them is the day you are on', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ctx = mkCtx('all', 'two only');
  renderWall(root, ctx);
  assert.deepEqual([...root.querySelectorAll('.day-block')].map((b) => b.dataset.day), ['Friday|W2'],
    'one day answered');
  assert.deepEqual(dayNavOf(FEST, ctx, root).map((d) => d.key), ['Friday|W2'],
    'so one tab — a tab that jumps nowhere is worse than no tab');

  // The scrollspy's opening claim is the first tab, so filtering the list is
  // what stops it naming the wrong weekend.
  const hadIO = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  const nav = document.createElement('div');
  for (const d of dayNavOf(FEST, ctx, root)) {
    const b = document.createElement('button');
    b.className = 'day-tab';
    b.dataset.day = d.anchor || d.key;
    nav.appendChild(b);
  }
  const un = wireScrollspy(nav, root);
  assert.deepEqual([...nav.querySelectorAll('.active')].map((t) => t.dataset.day), ['Friday|W2'],
    'at scroll 0 the lit tab is the first answer, not the first day of the week');
  un();
  globalThis.IntersectionObserver = hadIO;

  // Clearing the query gives the whole axis back.
  renderWall(root, mkCtx('all'));
  assert.deepEqual(dayNavOf(FEST, mkCtx('all'), root).map((d) => d.key), ['Friday|W1', 'Friday|W2']);
  root.remove();
});

// The fixture proves the rule; the shipped file proves we ship it. ACL bills
// Kings of Leon on the Friday of Weekend 2 only, which is exactly the answer
// the old W1 default could never give. This activates ACL, so it runs last.
test('ACL as shipped: searching finds a Weekend 2 headliner, under the date they play', () => {
  const ACL = JSON.parse(readFileSync(new URL('../data/festivals/acl-2026.json', import.meta.url), 'utf8'));
  FESTIVAL_INDEX.push({ id: 'acl-2026', status: 'scheduled' });
  state.FESTIVALS['acl-2026'] = ACL;
  state.setActiveFestivalId('acl-2026');

  const root = document.createElement('div');
  document.body.appendChild(root);
  const kolCtx = { ...mkCtx('all', 'kings of leon'), fid: 'acl-2026' };
  renderWall(root, kolCtx);

  const cards = [...root.querySelectorAll('.card')];
  assert.deepEqual(cards.map((c) => c.dataset.artist), ['Kings of Leon'], 'found, not "No artists match"');
  const block = root.querySelector('.day-block');
  assert.equal(block.dataset.day, 'Friday|W2', 'under the Friday they actually play');
  assert.equal(block.querySelector('.list-head .sub').textContent, 'Fri · Oct 9 · Weekend 2', 'and the header says which date that is');
  assert.equal(JSON.parse(cards[0].dataset.occ).weekend, 'W2', 'the card carries the weekend, so the zoom tells the right night');
  // The dock said seven tabs over this one answer, six of them dead, and lit
  // the Weekend 1 Friday (Codex re-check finding 2, 2026-09-17).
  assert.deepEqual(dayNavOf(ACL, kolCtx, root).map((d) => d.key), ['Friday|W2'],
    'and the nav is that one day — no dead tab, no wrong weekend');
  assert.deepEqual(dayNavOf(ACL, { ...kolCtx, query: '' }).map((d) => d.key),
    ['Friday|W1', 'Saturday|W1', 'Sunday|W1', 'Friday|W2', 'Saturday|W2', 'Sunday|W2', 'Late nights'],
    'clearing the query gives the whole axis back');
  root.remove();

  // A dated section's answers sit under their DATES, and each names its room:
  // "AFTERS · Sep 24-27" was the label of a section, which is not a place
  // (MODEL-V4 §2) and cannot say which night you would be going out.
  const root2 = document.createElement('div');
  document.body.appendChild(root2);
  renderWall(root2, { ...mkCtx('all', 'jess williamson'), fid: 'acl-2026' });
  const rules = [...root2.querySelectorAll('.list-head')].map((r) => [r.closest('.day-block').dataset.day, r.querySelector('.label').textContent, r.querySelector('.sub').textContent]);
  assert.deepEqual(rules, [
    ['Sunday|W1', 'SUNDAY', 'Sun · Oct 4 · Weekend 1'],
    ['Late nights', 'THU · OCT 1', 'LATE NIGHTS'],
    ['Late nights', 'THU · OCT 8', 'LATE NIGHTS'],
  ], 'the Zilker set under its day, each late night under its own date, both dates on the one tab');
  const late = ACL.artists.filter((a) => a.name === 'Jess Williamson' && a.day === 'Late nights');
  assert.deepEqual([...root2.querySelectorAll('.card')].map((c) => c.dataset.time),
    ['Miller Lite · 2:00 PM', late[0].venue, late[1].venue], 'and every answer says where it is');
  root2.remove();

  state.setActiveFestivalId('two-wk-fest');
});

test('validator: per-set weekend must be W1|W2|both; the fixture validates clean', () => {
  const r = validateFestivalDoc(FEST);
  assert.equal(r.errors.length, 0, `errors: ${r.errors}`);
  const bad = validateFestivalDoc({
    ...FEST,
    days: { Friday: { stages: ['Alpha'], artists: [{ name: 'X', stage: 'Alpha', time: '1:00 PM', weekend: 'w1' }] } },
  });
  assert.ok(bad.errors.some((e) => e.includes('weekend must be')), 'lowercase w1 rejected');
});
