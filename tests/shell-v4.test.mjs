// The shell under MODEL-V4 (2026-09-16): the hidden-room state and its one door,
// the day tabs the axis asks for, the day the wall opens on, and the now mark
// on a stack card. The real index.html and the real app.js, booted the way a
// phone boots them, against Portola — a festival with a grid (Saturday,
// Sunday) and two rooms of its own (Afters, Folsom), which is exactly the
// shape every rule here exists for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'shellv4testtoken_0123456789'; // a made-up crew, never a real link
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const DOC = {
  v: 4, meta: { name: 'The Crew', inviteFestId: FID }, spotify: {}, affinity: {},
  people: { Kevin: { colorIndex: 0 } },
  festivals: { [FID]: { selections: {} } },
};

async function network(url) {
  const u = String(url);
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
    fn_coach_v1: '1', // the coach mark is not what this file is about
  },
  fetch: network,
});
test.after(() => shell.close());
const { $, dom } = shell;
for (let i = 0; i < 100 && $('screen-app').style.display === 'none'; i += 1) await settle(20);

const app = await import('../js/v3/app.js'); // the SAME instance the page booted
const filters = await import('../js/v3/filters.js');

const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const menu = (which) => $(`${which}-fest-wrap`).querySelector('.sort-pop');
const rows = (which) => [...menu(which).querySelectorAll('[data-room]')]
  .map((r) => [r.dataset.room, r.textContent, r.getAttribute('aria-selected')]);

test('the wall is up on Portola, with its three rooms', () => {
  assert.equal($('screen-app').style.display, '', 'the wall');
  const keys = [...new Set([...$('wall-root').querySelectorAll('.sec-head[data-section]')].map((h) => h.dataset.section))];
  // Thursday and Friday are afters nights, so the festival's own room does not
  // appear until Saturday — which is why the show menu sorts it to the front
  // rather than taking the wall's order as read.
  assert.deepEqual(keys, ['Afters', 'Folsom', ':fest']);
});

// ---- the fold's state (MODEL-V4 §3) --------------------------------------------------

test('a fold persists per fest in localStorage, toggles cleanly, and survives a blocked store in memory', () => {
  const store = globalThis.localStorage;
  assert.deepEqual(filters.loadFolded('f1'), []);
  filters.saveFolded('f1', ['Folsom']);
  assert.equal(store.getItem('fn_fold_v1_f1'), '["Folsom"]', 'device-local, keyed per fest — never the crew doc');
  assert.deepEqual(filters.loadFolded('f1'), ['Folsom']);
  assert.deepEqual(filters.loadFolded('f2'), [], 'another fest is untouched');
  assert.deepEqual(filters.toggleFold(['Folsom'], filters.FEST_ROOM), ['Folsom', ':fest']);
  assert.deepEqual(filters.toggleFold(['Folsom', ':fest'], 'Folsom'), [':fest']);
  filters.saveFolded('f1', []);
  assert.equal(store.getItem('fn_fold_v1_f1'), null, 'nothing folded = nothing stored');
  store.setItem('fn_fold_v1_f3', '{"not":"a list"}');
  assert.deepEqual(filters.loadFolded('f3'), [], 'garbage reads as nothing folded');
  // A write that fails against a store that still READS (storage full):
  // memory wins until a write lands — the old stored value must not come
  // back on the next read (Codex, review round 2026-09-01).
  store.setItem('fn_fold_v1_f5', '["Folsom"]');
  assert.deepEqual(filters.loadFolded('f5'), ['Folsom']);
  const realSet = store.setItem;
  const quiet = console.warn;
  console.warn = () => {};
  store.setItem = () => { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); };
  try {
    filters.saveFolded('f5', ['Folsom', 'Afters']);
    assert.deepEqual(filters.loadFolded('f5'), ['Folsom', 'Afters'], 'the write failed — memory is newer than storage and wins');
  } finally { store.setItem = realSet; console.warn = quiet; }
  filters.saveFolded('f5', ['Afters']);
  assert.equal(store.getItem('fn_fold_v1_f5'), '["Afters"]', 'a write that lands re-arms storage');
  store.setItem('fn_fold_v1_f5', '["Folsom"]');
  assert.deepEqual(filters.loadFolded('f5'), ['Folsom'], 'and storage is read again');
  // Two taps in a row apply at once — the second reads the first.
  const t1 = filters.applyFoldToggle('f6', filters.loadFolded('f6'), 'Folsom');
  assert.deepEqual(t1, { next: ['Folsom'], folding: true });
  const t2 = filters.applyFoldToggle('f6', filters.loadFolded('f6'), 'Afters');
  assert.deepEqual(t2, { next: ['Folsom', 'Afters'], folding: true });
  assert.equal(store.getItem('fn_fold_v1_f6'), '["Folsom","Afters"]', 'nothing was lost between the taps');
  assert.deepEqual(filters.applyFoldToggle('f6', filters.loadFolded('f6'), 'Folsom'), { next: ['Afters'], folding: false });
  // Blocked store: memory is the truth for the life of the page. (util.saveLS
  // warns on a failed write — expected here, kept out of the test output.)
  const warn = console.warn;
  const denied = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
  globalThis.localStorage = { getItem: denied, setItem: denied, removeItem: denied };
  console.warn = () => {};
  try {
    assert.doesNotThrow(() => filters.saveFolded('f4', ['Afters']));
    assert.deepEqual(filters.loadFolded('f4'), ['Afters'], 'a blocked store cannot make a tap do nothing');
  } finally { globalThis.localStorage = store; console.warn = warn; }
});

// ---- the show menu (MODEL-V4 §3.1) ---------------------------------------------------

test('the fest name opens the show menu: Show, a row per room, then Settings', () => {
  for (const which of ['dock', 'rail']) {
    const pop = menu(which);
    assert.ok(pop, `${which}: the popover is hung in the wrap`);
    assert.equal(pop.style.display, 'none', 'closed until it is asked for');
    assert.equal(pop.querySelector('.pop-head').textContent, 'Show');
    assert.deepEqual(rows(which), [
      [':fest', '✓Portola', 'true'],
      ['Afters', '✓Afters', 'true'],
      ['Folsom', '✓Folsom', 'true'],
    ], 'the festival by name, then its rooms by theirs — every one checked');
    assert.ok(pop.querySelector('.pop-div'), 'a divider');
    assert.match(pop.querySelector('.settings').textContent, /Settings/, 'and the door that tap used to be');
    assert.equal($(`${which}-fest-link`).getAttribute('aria-haspopup'), 'listbox');
  }
});

// A row that is a <div> or an <li> with a click listener is a row a keyboard
// cannot reach and a thumb under-measures: the 44px floor lives on `button`,
// and so does Enter/Space. Both come back by being the element, not by
// re-implementing either (the sort chip's roving keyboard stays its own).
test('the show menu\'s rows are real buttons, and still options in the listbox', () => {
  for (const which of ['dock', 'rail']) {
    const pop = menu(which);
    const els = [...pop.querySelectorAll('[data-room]'), pop.querySelector('.settings')];
    assert.equal(els.length, 4, 'three rooms and Settings');
    for (const el of els) {
      assert.equal(el.tagName, 'BUTTON', `${which}: a row is a button — the touch floor and the keyboard come with it`);
      assert.equal(el.type, 'button', 'never a submit');
      assert.equal(el.getAttribute('role'), 'option', 'the listbox presentation is unchanged');
    }
    assert.equal(pop.getAttribute('role'), 'listbox');
  }
  // Focusable with no tabindex of its own, which is the whole point.
  const row = menu('dock').querySelector('[data-room="Folsom"]');
  row.focus();
  assert.equal(dom.window.document.activeElement, row, 'a keyboard can stand on a row');
});

test('a tap opens it, Escape closes it, and a tap outside closes it', () => {
  const link = $('dock-fest-link');
  const pop = menu('dock');
  click(link);
  assert.equal(pop.style.display, '', 'open');
  assert.equal(link.getAttribute('aria-expanded'), 'true');
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(link.getAttribute('aria-expanded'), 'false', 'Escape takes the popover, not a history layer');
  assert.equal($('screen-app').style.display, '', 'and nothing under it moved');

  click(link);
  assert.equal(link.getAttribute('aria-expanded'), 'true');
  click($('wall-root'));
  assert.equal(link.getAttribute('aria-expanded'), 'false', 'a tap outside closes it');

  click(link);
  click(link);
  assert.equal(link.getAttribute('aria-expanded'), 'false', 'and the fest name toggles it');
});

test('unchecking a room hides it on every day — the show menu is the one door', () => {
  const stored = () => globalThis.localStorage.getItem(`fn_fold_v1_${FID}`);
  const row = (key) => [...menu('dock').querySelectorAll('[data-room]')].find((r) => r.dataset.room === key);

  click($('dock-fest-link'));
  click(row('Folsom'));
  assert.equal(stored(), '["Folsom"]', 'device-local, per fest — never the crew doc');
  assert.equal(menu('dock').style.display, 'none', 'a row tap closes the menu');
  assert.deepEqual(rows('dock').map((r) => r[2]), ['true', 'true', 'false'], 'and the menu says so');
  assert.deepEqual(rows('rail').map((r) => r[2]), ['true', 'true', 'false'], 'in both doors');

  // A second room: each tap applies before the next reads, so nothing is lost
  // between two taps in a row.
  click($('dock-fest-link'));
  click(row('Afters'));
  assert.equal(stored(), '["Folsom","Afters"]');
  assert.deepEqual(rows('dock').map((r) => r[2]), ['true', 'false', 'false']);

  // And back — tapping a folded room's row unfolds it.
  click($('dock-fest-link'));
  click(row('Afters'));
  click($('dock-fest-link'));
  click(row('Folsom'));
  assert.equal(stored(), null, 'nothing folded = nothing stored');
  assert.deepEqual(rows('dock').map((r) => r[2]), ['true', 'true', 'true']);
});

test('a room with a verbose key is billed in the menu the way the wall bills it', () => {
  // A room key is frozen pick data, so it can carry a comma and a parenthetical
  // ("Wednesday, Sept 16 (Early Arrival Pre-Party)"). Portola's keys are one
  // clean word, which is exactly why this case has to be made rather than
  // waited for: the wall runs every section label through dayLabelParts, and
  // the menu naming the same room must say the same words.
  const head = dom.window.document.createElement('div');
  head.className = 'sec-head';
  head.dataset.section = 'Wednesday, Sept 16 (Early Arrival Pre-Party)';
  $('wall-root').appendChild(head);
  try {
    const labels = new Map(app.roomsOnWall().map((r) => [r.key, r.label]));
    assert.equal(labels.get('Wednesday, Sept 16 (Early Arrival Pre-Party)'), 'Wednesday',
      'the head of the label, never the raw key');
    assert.equal(labels.get(':fest'), 'Portola', 'and the festival is still its own name');
  } finally { head.remove(); }
});

// ---- the day axis (MODEL-V4 §2) ------------------------------------------------------

test('the day tabs are the wall\'s own axis, in both navigations', () => {
  const dock = [...$('dock-days').querySelectorAll('.day-tab')];
  const rail = [...$('rail-days').querySelectorAll('.day-tab')];
  assert.deepEqual(dock.map((t) => t.dataset.day), ['Thursday', 'Friday', 'Saturday', 'Sunday'],
    'Portola: two afters nights, then the two grid days');
  assert.deepEqual(dock.map((t) => t.dataset.day), rail.map((t) => t.dataset.day),
    'one fact, two places — the dock and the rail can never disagree');
  assert.deepEqual(dock.map((t) => t.textContent), ['THU', 'FRI', 'SAT', 'SUN']);
  assert.equal(dock.every((t) => !t.querySelector('.num')), true, 'one weekend: no tab needs a date to tell it apart');
});

test('an axis entry\'s anchor and num reach the tab (a two-weekend fest\'s six, a dated section\'s one)', () => {
  const axis = [
    { key: 'Friday', short: 'FRI', long: 'FRIDAY · OCT 2', num: '2', anchor: 'Friday@W1' },
    { key: 'Friday', short: 'FRI', long: 'FRIDAY · OCT 9', num: '9', anchor: 'Friday@W2' },
    { key: 'Late nights', short: 'LATE', long: 'LATE NIGHTS' },
  ];
  const dock = axis.map((d) => app.dayTab(d, d.short, { withNum: true }));
  assert.deepEqual(dock.map((t) => t.dataset.day), ['Friday@W1', 'Friday@W2', 'Late nights'],
    'the anchor addresses the rule, because one key cannot address two Fridays');
  assert.deepEqual(dock.map((t) => t.textContent), ['FRI2', 'FRI9', 'LATE'], 'the date tells them apart');
  assert.deepEqual(dock.map((t) => (t.querySelector('.num') || {}).textContent), ['2', '9', undefined],
    'as the dock\'s small num, not part of the word');
  const rail = axis.map((d) => app.dayTab(d, d.long));
  assert.deepEqual(rail.map((t) => t.textContent), ['FRIDAY · OCT 2', 'FRIDAY · OCT 9', 'LATE NIGHTS'],
    'the rail\'s long label carries its own date, so it never needs the num');
  assert.equal(rail.every((t) => !t.querySelector('.num')), true);
  assert.deepEqual(rail.map((t) => t.dataset.day), ['Friday@W1', 'Friday@W2', 'Late nights'],
    'and both navigations jump to the same rule');
});

// ---- the day the wall opens on (MODEL-V4 §2) -----------------------------------------

test('the wall opens on the festival\'s first GRID day, not on the first thing that plays', () => {
  const axis = [
    { key: 'Thursday' }, { key: 'Friday' }, { key: 'Saturday' }, { key: 'Sunday' }, { key: 'Late nights' },
  ];
  assert.equal(app.defaultDayOf(axis, FEST).key, 'Saturday',
    'Portola: Thursday and Friday are other people\'s warehouses');
  assert.equal(app.defaultDayOf(axis, { days: {} }).key, 'Thursday',
    'a lineup fest has no grid — it opens on the first day it has');
  assert.equal(app.defaultDayOf([], FEST), null, 'and a wall with no days has nowhere to land');
  // A two-weekend fest: the first entry whose key is a grid day is the first
  // weekend's, because the axis is in order.
  const acl = [
    { key: 'Friday', anchor: 'Friday@W1' }, { key: 'Saturday', anchor: 'Saturday@W1' },
    { key: 'Friday', anchor: 'Friday@W2' }, { key: 'Late nights' },
  ];
  assert.equal(app.defaultDayOf(acl, { days: { Friday: {}, Saturday: {} } }).anchor, 'Friday@W1');
});

test('ACL as shipped: the Late nights tab starts Sep 29 and the wall still opens on Oct 2', async () => {
  // The cases above hand defaultDayOf an axis by hand, so they prove the
  // PICKER and take the axis order on trust. This one reads the real file and
  // builds the real axis, because the thing that could go wrong is the order:
  // ACL's Late nights run Sep 29 – Oct 10, and the earliest of them is three
  // days before the festival's first grid day. A wall that opened on the
  // earliest thing that plays would open ACL on a Tuesday in a bar.
  const { dayNavOf } = await import('../js/v3/wall.js');
  const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  const axis = dayNavOf(ACL, { query: '', sort: 'day', weekend: 'all', filterPeople: [], folded: [] });

  const late = axis.find((d) => d.key === 'Late nights');
  assert.ok(late && late.dated, 'the dated section is a tab of its own');
  assert.equal(late.dates[0], '2026-09-29', 'and it really does start before the fest');
  assert.equal(axis.at(-1).key, 'Late nights', 'it hangs off the END of the axis, after the days (§2)');
  assert.deepEqual(axis.filter((d) => !d.dated).map((d) => d.long),
    ['FRI 2', 'SAT 3', 'SUN 4', 'FRI 9', 'SAT 10', 'SUN 11'], 'six dated tabs, both weekends');

  const open = app.defaultDayOf(axis, ACL);
  assert.equal(open.iso, '2026-10-02', 'the wall opens on the first grid day, not on Sep 29');
  assert.equal(open.key, 'Friday|W1');
});

// ---- the now mark (MODEL-V4 §1.2) ----------------------------------------------------
// ONE implementation, and it is the wall's. The wall stamps each stack card
// with the window it plays in (data-now-from / data-now-to, minutes on the
// festival-day axis) and reads the date and the timezone off the .venue-grid
// those cards sit in. The shell carried a second one that expected all four on
// every CARD; it therefore matched nothing, and ran right after every repaint
// and on every tick — so the marks the wall had just drawn were wiped before
// anyone saw them.

const RealDate = globalThis.Date;
// Saturday 2026-09-26, 11:30 PM in San Francisco (PDT is UTC-7) — the hour
// Portola's afters are the whole festival.
const SAT_LATE = RealDate.UTC(2026, 8, 27, 6, 30);
function atFestivalTime(ms, fn) {
  class Pinned extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(ms); }
    static now() { return ms; }
  }
  globalThis.Date = Pinned;
  try { return fn(); } finally { globalThis.Date = RealDate; }
}
const marked = () => [...$('wall-root').querySelectorAll('.card.now')].map((c) => c.dataset.artist).sort();
// The app's one ticker: a minute passing, or the tab coming back. jsdom never
// renders, so its document sits at 'prerender' forever and the ticker's
// visibility guard would never let one through.
Object.defineProperty(dom.window.document, 'visibilityState', { value: 'visible', configurable: true });
const tick = () => document.dispatchEvent(new dom.window.Event('visibilitychange'));

test('the now mark survives the ticker and a pick — the shell reads the wall\'s marks, never its own', async () => {
  atFestivalTime(SAT_LATE, () => {
    tick();
    const playing = marked();
    assert.ok(playing.length > 0, 'somebody is playing at 11:30 PM on the Saturday of Portola');
    for (const name of playing) {
      const card = $('wall-root').querySelector(`.card.now[data-artist="${name}"]`);
      assert.equal(card.querySelector('.now-label').textContent, 'NOW');
      assert.equal(card.querySelector('.now-label').className, 'now-label in-card');
      assert.ok(card.closest('.venue-grid[data-iso]'), 'a mark only ever lives on a stack card');
    }

    tick();
    assert.deepEqual(marked(), playing, 'the ticker moves the mark, it does not clear it');

    // A pick replaces the card's node. The window rides the node, so a refresh
    // that dropped it would put the ring out until the next full repaint.
    const first = $('wall-root').querySelector(`.card.now[data-artist="${playing[0]}"]`);
    first.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    assert.deepEqual(marked(), playing, 'and a pick keeps every mark, the picked card included');
    const fresh = $('wall-root').querySelector(`.card[data-artist="${playing[0]}"].now`);
    assert.ok(fresh && fresh !== first, 'it really is a new node');
    assert.ok(fresh.dataset.nowFrom && fresh.dataset.nowTo, 'carrying its window');
  });
  // The pick armed a real push (1.2 s). Let it land while the shell is still
  // standing, rather than after test.after() has pulled the DOM out from under it.
  await settle(1500);
});

test('after the last set, nobody — and a wall with nothing playing costs nothing', () => {
  // 6 AM the next morning: past the 5 AM rollover, so the festival day has
  // moved on and no grid claims the clock.
  atFestivalTime(RealDate.UTC(2026, 8, 27, 13, 0), () => {
    tick();
    assert.deepEqual(marked(), []);
    assert.equal($('wall-root').querySelectorAll('.now-label.in-card').length, 0, 'the labels go with the ring');
  });
});

// The show menu names what the wall SHOWS — roomsOnWall() reads the room
// headers standing in #wall-root, so a room the wall draws by hand instead of
// through the room component is a room the menu cannot offer. ACL's Late
// nights was exactly that. Runs last: it stands ACL's wall up in place of
// Portola's, and puts Portola back.
test('the show menu names every room the wall shows — ACL\'s dated section included', async () => {
  const state = await import('../js/state.js');
  const { renderWall } = await import('../js/v3/wall.js');
  const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
  const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
  const ONE_ROOM = {
    id: 'one-room', name: 'One Room', status: 'scheduled',
    dayMeta: { Friday: { wd: 'Fri', date: 'Oct 2', iso: '2026-10-02' } },
    artists: [{ name: 'Solo', day: 'Friday' }],
    days: { Friday: { stages: ['A'], artists: [{ name: 'Solo', stage: 'A', time: '8:00 PM - 9:00 PM' }] } },
  };
  FESTIVAL_INDEX.push({ id: 'acl-2026', status: 'scheduled' }, { id: 'one-room', status: 'scheduled' });
  FESTIVALS['acl-2026'] = ACL;
  FESTIVALS['one-room'] = ONE_ROOM;
  const wall = $('wall-root');
  const portolaWall = [...wall.childNodes];
  const stand = (fid) => {
    state.setActiveFestivalId(fid);
    renderWall(wall, {
      fid, meName: 'Kevin', picks: {}, affinity: null, lowPower: true,
      sort: 'day', query: '', weekend: 'all', filterPeople: [], soloStage: null, folded: [],
      onTap: () => {}, onOpenDayNotes: () => {}, onNotesChange: null,
    });
    return app.roomsOnWall();
  };
  try {
    assert.deepEqual(stand('acl-2026').map((r) => [r.key, r.label]),
      [[':fest', 'ACL Music Festival'], ['Late nights', 'Late nights']],
      'the festival\'s own room, then the dated section — two rooms, so there IS a menu');
    assert.deepEqual(stand('one-room').map((r) => r.key), [':fest'],
      'one room: below two the shell drops the menu and the fest name goes to Settings, as it always did');
  } finally {
    state.setActiveFestivalId(FID);
    wall.replaceChildren(...portolaWall);
  }
});

// ---- the stylesheet answers for what this shell draws ---------------------------------
// Node sees classes toggled, never pixels: `.card.now` and the show menu's rows
// both passed every test above while having no rule in the stylesheet at all,
// and shipped invisible. The gap was found by a human reading the diff. This
// case is the teeth — a selector the shell's JS writes and the stylesheet does
// not answer for is a red build, not a review finding.
test('every class this shell writes for visual effect has a rule in v3.css', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  for (const sel of [
    '.sort-pop .pop-head',   // the show menu's "Show"
    '.sort-pop .pop-div',    // the divider before Settings
    '.sort-pop .chev',       // the › on the Settings row
    '.card.now',             // the now mark's ring
    '.now-label.in-card',    // and its label, parked in the card's corner
  ]) assert.ok(css.includes(sel), `${sel} is drawn by the shell and styled by nothing`);
  // The dock is fixed to the bottom of the phone. A popover that opens
  // downward from it opens off the screen — the show menu's own surface.
  const dockPop = /\.dock \.sort-pop\s*\{([^}]*)\}/.exec(css);
  assert.ok(dockPop, 'the dock\'s popover needs a rule of its own');
  assert.match(dockPop[1], /bottom:\s*calc\(100%/, 'it opens upward, above the dock');
  assert.match(dockPop[1], /top:\s*auto/, 'and lets go of the downward default');
});

// Two definitions of one thing is the same bug as none: v3.css described the
// now mark twice, and the later block silently won — so the ring and the glow
// on screen were not the ones the first block (and MODEL-V4 §1.2) describe,
// and editing the first one looked like it did nothing at all.
test('the now mark is defined once, and wears the now line\'s own glow', () => {
  const css = readFileSync(join(ROOT, 'assets/v3.css'), 'utf8');
  const blocks = (re) => [...css.matchAll(re)].map((m) => m[1]);
  const shadowOf = (block) => /box-shadow:\s*([^;]+);/.exec(block)[1].replace(/\s+/g, ' ').trim();

  const mark = blocks(/\.card\.now\s*\{([^}]*)\}/g);
  assert.equal(mark.length, 1, 'one .card.now block — a second one wins silently and makes the first unfixable');
  assert.equal(blocks(/\.now-label\.in-card\s*\{([^}]*)\}/g).length, 1, 'and one .now-label.in-card');

  // The design: a 1.5px ring in brand — the card's own 1px border recoloured
  // plus half a pixel of spread, so no layout moves — and the now line's glow,
  // because the line and the mark are one idea in two places.
  const lineGlow = shadowOf(blocks(/\.now-line\s*\{([^}]*)\}/g)[0]);
  const markShadow = shadowOf(mark[0]);
  assert.match(mark[0], /border-color:\s*rgb\(var\(--brand\)\)/, 'the ring is the card\'s own border, recoloured');
  assert.match(markShadow, /^0 0 0 \.5px rgb\(var\(--brand\)\)/, 'plus half a pixel of spread');
  assert.ok(markShadow.endsWith(lineGlow), `the mark wears the line's glow — got "${markShadow}" against "${lineGlow}"`);
});
