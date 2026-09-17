// Two-weekend scheduled fests (ACL, 2026-08-23): day keys stay the plain
// weekdays — they are frozen pick data and a rename would strand every pick —
// each set carries weekend: 'W1'|'W2' (untagged/'both' = every weekend), and
// each weekend's Friday is its own tab, because a clock grid showing both at
// once would double-book every stage. A stored 'all' opens on Weekend One.
// Day NOTES key on the date instead of the label since V4 (MODEL-V4 §4), so
// the two Fridays hold two conversations; events-wall covers that.
import test from 'node:test';
import assert from 'node:assert/strict';
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
const { renderWall, scheduledWeekendOf, dayNavOf } = await import('../js/v3/wall.js');
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

test('scheduledWeekendOf: tagged fests render one weekend; untagged fests are untouched', () => {
  assert.equal(scheduledWeekendOf(FEST, 'all'), 'W1', "'Both' maps to Weekend One on a timetable");
  assert.equal(scheduledWeekendOf(FEST, undefined), 'W1');
  assert.equal(scheduledWeekendOf(FEST, 'W2'), 'W2');
  assert.equal(scheduledWeekendOf({ days: { F: { artists: [{ name: 'X', stage: 'S', time: '1:00 PM' }] } } }, 'W2'),
    null, 'no weekend tags = single-weekend fest = no filter at all');
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

  const rules = [...root.querySelectorAll('.day-rule')];
  assert.deepEqual(rules.map((r) => [r.dataset.day, r.querySelector('.date').textContent]),
    [['Friday|W1', 'Fri · Oct 2 · Weekend 1'], ['Friday|W2', 'Fri · Oct 9 · Weekend 2']],
    'the weekend is which day you are looking at, not a filter over one');
  // The tab's number is the day of the month, and it comes from the iso —
  // this fixture prints dates and no isos, so the tabs read FRI and FRI and
  // the rule below them is what tells the two apart. (acl-2026 carries isos;
  // events-model covers that shape.)
  assert.deepEqual(dayNavOf(FEST, mkCtx('all')).map((d) => [d.key, d.short, d.num]),
    [['Friday|W1', 'FRI', null], ['Friday|W2', 'FRI', null]]);
  const namesOn = (tab) => {
    const rule = rules.find((r) => r.dataset.day === tab);
    const out = [];
    for (let n = rule.nextElementSibling; n && !n.classList.contains('day-rule'); n = n.nextElementSibling) {
      out.push(...[...n.querySelectorAll('.card')].map((c) => c.dataset.artist));
    }
    return out.sort();
  };
  assert.deepEqual(namesOn('Friday|W1'), ['Beta Both', 'One Only', 'Shared Head']);
  assert.deepEqual(namesOn('Friday|W2'), ['Beta Both', 'Shared Head', 'Two Only']);
  // The frozen day key never moved: the pick data on both tabs is Friday's.
  const occs = [...root.querySelectorAll('.card')].map((c) => JSON.parse(c.dataset.occ).day);
  assert.ok(occs.every((d) => d === 'Friday'), 'the tab id is a view; the day key is storage');

  root.remove();
});

test('searching a scheduled two-weekend fest answers within the selected weekend', () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  renderWall(root, mkCtx('W1', 'only'));
  const names = [...root.querySelectorAll('.card')].map((c) => c.dataset.artist);
  assert.ok(names.includes('One Only'), 'the W1 match is found');
  assert.ok(!names.includes('Two Only'), 'a W2-only answer to a W1 search is a wrong turn');
  root.remove();
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
