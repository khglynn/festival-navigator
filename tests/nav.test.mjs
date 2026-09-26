// History with a direction (v93 — js/v3/nav.js). Every entry the app writes
// is numbered in order, so a Back or Forward knows which way it went for
// certain; the app's own traversals are told apart from the person's; and an
// entry a link made is numbered as the newest, while one arrived at by Back
// keeps what it has. The real-browser proof of what the app does with this is
// tests/browser/show-menu-history.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNav, kindOf } from '../js/v3/nav.js';

// A session history: entries and a cursor, like a browser's.
function session(url = '/#g=crew') {
  const entries = [{ state: null, url }];
  let at = 0;
  const loc = { pathname: '/', search: '', hash: '' };
  const setUrl = (u) => { const [p, h] = String(u).split('#'); loc.pathname = p || '/'; loc.hash = h != null ? `#${h}` : ''; };
  setUrl(url);
  const hist = {
    get state() { return entries[at].state; },
    get length() { return entries.length; },
    pushState(s, _t, u) { entries.splice(at + 1); entries.push({ state: s, url: u ?? entries[at].url }); at += 1; setUrl(entries[at].url); },
    replaceState(s, _t, u) { entries[at] = { state: s, url: u ?? entries[at].url }; setUrl(entries[at].url); },
    go(n) { const to = at + n; if (to < 0 || to >= entries.length) return; at = to; setUrl(entries[at].url); hist.onpop(entries[at].state); },
    onpop: () => {},
  };
  // A link opened into the tab: the browser's entry, with no state.
  const navigate = (u) => { entries.splice(at + 1); entries.push({ state: null, url: u }); at += 1; setUrl(u); };
  return { hist, loc, navigate, cursor: () => at };
}

test('kinds: the shelf, a menu, a sheet, Settings, a wall, the list, create', () => {
  assert.equal(kindOf({ joinShelf: true }, '/#g=x'), 'shelf');
  assert.equal(kindOf({ layers: ['menu:show'] }, '/#g=x'), 'menu');
  assert.equal(kindOf({ layers: ['sheet:fest'] }, '/#g=x'), 'sheet');
  assert.equal(kindOf({ layers: ['settings', 'sub:bulk'] }, '/#g=x'), 'settings');
  assert.equal(kindOf({}, '/#g=x'), 'wall');
  assert.equal(kindOf(null, '/'), 'list');
  assert.equal(kindOf({}, '/#new'), 'create');
});

test('every entry the app writes is numbered in order; a rewrite keeps its number and id', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  nav.stampHere();
  const first = s.hist.state;
  assert.ok(Number.isFinite(first.idx) && typeof first.id === 'string' && first.kind === 'wall');
  const menu = nav.push({ layers: ['menu:show'] });
  assert.ok(menu.idx > first.idx && menu.kind === 'menu' && menu.id !== first.id);
  nav.replace({ layers: ['settings'] });
  assert.deepEqual([s.hist.state.idx, s.hist.state.id, s.hist.state.kind], [menu.idx, menu.id, 'settings'], 'the same entry, now Settings');
  const list = nav.push({}, '/');
  assert.equal(list.kind, 'list');
  assert.equal(nav.shownUrl(), '/');
});

test('a Back or Forward knows which way it went, for certain', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  const seen = [];
  s.hist.onpop = (st) => seen.push(nav.arrive(st));
  nav.stampHere();
  nav.push({ layers: ['sheet:fest'] });
  nav.push({ layers: ['sheet:fest', 'x'] });
  s.hist.go(-1);
  s.hist.go(-1);
  s.hist.go(2);
  assert.deepEqual(seen.map((a) => a.dir), [-1, -1, 1]);
  assert.ok(seen.every((a) => a.own === false), 'the person’s presses');
});

test('a push after going Back still numbers after the entry it follows', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  s.hist.onpop = (st) => nav.arrive(st);
  nav.stampHere();
  const a = s.hist.state.idx;
  nav.push({ layers: ['sheet:a'] });
  nav.push({ layers: ['sheet:b'] });
  s.hist.go(-2);
  const c = nav.push({ layers: ['sheet:c'] });
  assert.ok(c.idx > a);
  let dir = null;
  s.hist.onpop = (st) => { dir = nav.arrive(st).dir; };
  s.hist.go(-1);
  assert.equal(dir, -1);
});

test('the app’s own step back is marked, and what waits on it runs once it has arrived', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  nav.stampHere();
  nav.push({ layers: ['menu:show'] });
  let arrived = null;
  let ran = 0;
  s.hist.onpop = (st) => { arrived = nav.arrive(st); nav.applied(arrived.own); };
  nav.back(1, () => { ran += 1; });
  assert.deepEqual([arrived.dir, arrived.own], [-1, true]);
  assert.equal(ran, 1, 'the wait is over');
  nav.push({ layers: ['menu:show'] });
  s.hist.go(-1);
  assert.equal(arrived.own, false, 'the next press is the person’s again');
});

test('an entry a link made is numbered as the newest; one arrived at by Back keeps what it has', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  s.hist.onpop = (st) => nav.arrive(st);
  nav.stampHere();
  const wall = s.hist.state.idx;
  s.navigate('/#g=other'); // a link: the browser's own entry
  nav.seen();
  const link = s.hist.state;
  assert.ok(link && link.idx > wall && link.kind === 'wall', 'numbered, newest');
  s.hist.go(-1);
  nav.seen(); // a hashchange on a Back: nothing to stamp
  assert.equal(s.hist.state.idx, wall, 'kept its number');
});

test('entries this app did not write have no direction, either way', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc });
  const seen = [];
  s.hist.onpop = (st) => seen.push(nav.arrive(st).dir);
  s.hist.pushState({ layers: [] }, ''); // an older build's entry, unnumbered
  nav.push({ layers: ['sheet:x'] });
  s.hist.go(-1);
  s.hist.go(1);
  assert.deepEqual(seen, [0, 0]);
});

test('a blocked sessionStorage — the getter itself throws — still numbers', () => {
  const s = session();
  const nav = createNav({ history: s.hist, location: s.loc, storage: () => { throw new Error('SecurityError'); } });
  nav.stampHere();
  const a = nav.push({ layers: ['sheet:a'] });
  assert.ok(a.idx > s.hist.state.idx - 1 && Number.isFinite(a.idx));
});
