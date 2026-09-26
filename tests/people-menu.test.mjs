// The people menu (2026-09-26 — Kevin at Portola: "rather than it scroll you
// to the top, it opens a little menu with the people and you can click to
// filter them"). The real shell in jsdom, a member (Ana) on a crew of three:
//
//   your avatar opens HIGHLIGHT, the Show menu's twin — its label, Everyone,
//   the crew with you marked, a line, Pick as someone else, + Invite someone;
//   it stays open while you choose, and closes on a tap outside, the avatar
//   again, Escape, or the fest name's Show — never with a history entry;
//
//   a highlight is a VIEW: this tab's own (filters.js), never the crew doc,
//   never the network — the wall dims in place;
//
//   with a highlight on and the menu shut, the avatar's slot is the pill —
//   the faces reopen the menu, the ✕ clears;
//
//   Pick as someone else is the join shelf in a member's words, two taps
//   (a name, then "I'm Ben"), and the Invite sheet reads crew link first,
//   then a name, then the people from your other fests.
//
// Guests (the + opens the same menu, ending in Join the crew) are
// tests/first-open-guest.test.mjs; the real-browser contract with real input
// is tests/browser/people-menu.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const CREW = 'peoplemenutest_crew_0123';
const OTHER = 'peoplemenutest_other_012';
const SERVER = {
  [CREW]: {
    v: 4, meta: { name: 'Menu Crew', inviteFestId: FID }, spotify: {}, affinity: {},
    people: { Ana: { colorIndex: 0 }, Ben: { colorIndex: 1 }, Cy: { colorIndex: 2 } },
    festivals: { [FID]: { selections: { Robyn: { Ben: 2 }, 'Dog Blood': { Cy: 3 }, Soulwax: { Ana: 1 } } } },
  },
};
const OTHER_DOC = {
  v: 4, meta: { name: 'ACL Crew' }, spotify: {}, affinity: {},
  people: { Ana: { colorIndex: 0 }, Drew: { colorIndex: 4 }, Kat: { colorIndex: 5 } }, festivals: {},
};

const writes = []; // every non-GET request
// A crew POST can be held until the test lets it answer (two quick adds).
let holdPosts = false;
const heldPosts = [];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (method !== 'GET') writes.push({ method, url: u, body: opts.body ? JSON.parse(opts.body) : null });
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u.startsWith('/api/crew?')) {
    const t = new URL(u, 'https://x').searchParams.get('t');
    if (!SERVER[t]) return json({ error: 'Crew not found' }, 404);
    if (method !== 'GET' && holdPosts) await new Promise((r) => heldPosts.push(r));
    if (method !== 'GET') SERVER[t] = deepMerge(SERVER[t], JSON.parse(opts.body).data || {});
    return json(SERVER[t]);
  }
  return json({ error: 'not in this test' }, 503);
}

// A day before the festival: the wall's shape, not the hour (shell-rig `now`).
const shell = await bootShell({
  url: `https://fest.kevinhg.com/f/${FID}#g=${CREW}&f=${FID}`,
  now: '2026-09-20T18:00:00Z',
  fetch: network,
  storage: {
    fn_crews_v3: JSON.stringify([{ token: CREW, name: 'Menu Crew' }, { token: OTHER, name: 'ACL Crew' }]),
    [`fn_me_v3_${CREW}`]: 'Ana',
    [`fn_crew_doc_v3_${OTHER}`]: JSON.stringify(OTHER_DOC),
    fn_welcome_v1: '1',
    fn_welcome_joined_v1: '1',
  },
});
test.after(() => shell.close());
const { $ } = shell;
const { window } = shell.dom;
await settle(200);
const state = await import('../js/state.js'); // the SAME instances app.js holds
const crew = await import('../js/crew.js');
const filters = await import('../js/v3/filters.js');

const pop = () => document.querySelector('#dock-you-wrap .hl-pop');
const isOpen = () => !!pop() && pop().style.display !== 'none';
const row = (name) => [...pop().querySelectorAll('[data-person]')].find((b) => b.dataset.person === name);
const action = (a) => pop().querySelector(`[data-act="${a}"]`);
const wrap = () => $('dock-you-wrap');
const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const shelf = () => document.querySelector('.join-shelf');
async function openMenu() {
  if (!isOpen()) $('dock-you').click();
  await settle(10);
  assert.ok(isOpen(), 'the menu is open');
}
async function closeMenu() { if (isOpen()) { escape(); await settle(10); } }
// The join shelf's ways out pop its history entry, and the popstate that
// follows closes any menu that is up: wait for that traversal to land before
// the next tap, never a fixed time (a loaded machine lands it late — see
// first-open-guest.test.mjs lookAround).
async function historySettled() {
  for (let i = 0; i < 400 && window.history.state && window.history.state.joinShelf; i++) await settle(5);
  await settle(10);
}

test('the avatar opens HIGHLIGHT, the Show menu’s twin: its label, Everyone, the crew with you marked, a line, then the ways on', async () => {
  assert.deepEqual([...document.querySelectorAll('#dock-you, #rail-you')].map((b) => b.getAttribute('aria-haspopup')), ['listbox', 'listbox']);
  await openMenu();
  const p = pop();
  assert.ok(p.classList.contains('sort-pop'), 'the Show menu’s own popover');
  assert.equal(p.getAttribute('aria-multiselectable'), 'true');
  assert.equal(p.querySelector('.menu-label').textContent, 'Highlight');
  assert.deepEqual([...p.querySelectorAll('[data-person]')].map((b) => b.dataset.person), ['', 'Ana', 'Ben', 'Cy'], 'Everyone, then the crew in its order');
  assert.equal(row('').getAttribute('aria-selected'), 'true', 'Everyone ✓ while nobody is highlighted');
  assert.equal(row('').querySelector('.check').textContent, '✓');
  assert.equal(row('Ana').querySelector('.you').textContent, 'you', '“you” after your name');
  assert.equal(p.querySelectorAll('.you').length, 1);
  assert.ok(row('Ben').querySelector('.mark'), 'a person wears their colour mark');
  assert.ok(p.querySelector('.pop-div'), 'a line before the ways on');
  assert.deepEqual([...p.querySelectorAll('[data-act]')].map((b) => [b.dataset.act, b.querySelector('.nm').textContent]),
    [['pick-as', 'Pick as someone else'], ['invite', 'Invite someone']]);
  for (const b of p.querySelectorAll('[role="option"]')) assert.equal(b.tagName, 'BUTTON', 'every row a button: the 44px floor');
  assert.equal($('dock-you').getAttribute('aria-expanded'), 'true');
  assert.ok($('dock').classList.contains('menu-up'), 'the dock stands above the companion cards while it is up');
  await closeMenu();
});

test('a tap on a person highlights them and the menu stays open; the wall dims in place; nothing leaves the phone and nothing enters the crew doc', async () => {
  const docBefore = JSON.stringify(state.crewDoc);
  const sent = writes.length;
  const depth = window.history.length;
  const entry = window.history.state;
  await openMenu();
  const card = cardOf('Soulwax');
  row('Ben').click();
  await settle(10);
  assert.ok(isOpen(), 'still open: it is multi-select');
  assert.equal(cardOf('Soulwax'), card, 'the wall was not repainted: the card is the same node, dimmed where it stands');
  assert.equal(row('Ben').getAttribute('aria-selected'), 'true');
  assert.ok(row('Ben').querySelector('.mark').classList.contains('on'), 'his mark fills');
  assert.equal(row('').getAttribute('aria-selected'), 'false', 'Everyone lets go');
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Ben'], 'kept in this tab (filters.js), per festival');
  assert.ok(cardOf('Soulwax').classList.contains('dim'), 'a card Ben did not pick steps back');
  assert.ok(!cardOf('Robyn').classList.contains('dim'), 'his pick stays');
  row('Cy').click();
  await settle(10);
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Ben', 'Cy'], 'a second tap combines');
  assert.ok(!cardOf('Dog Blood').classList.contains('dim'));
  await settle(1600); // past the sync debounce
  assert.equal(writes.length, sent, 'no request left the phone');
  assert.equal(JSON.stringify(state.crewDoc), docBefore, 'the crew doc is untouched (fests × circles × you, law 2)');
  assert.equal(window.history.length, depth, 'no history entry');
  assert.equal(window.history.state, entry);
});

test('Everyone clears the highlight, the menu still open', async () => {
  await openMenu();
  row('').click();
  await settle(10);
  assert.ok(isOpen());
  assert.deepEqual(filters.loadPeopleFilter(FID), []);
  assert.equal(row('').getAttribute('aria-selected'), 'true');
  assert.equal(document.querySelectorAll('#wall-root .card.dim').length, 0, 'the whole wall back');
  await closeMenu();
});

test('closed with a highlight on, the avatar’s slot is the pill: the faces in the crew’s order, and a ✕ that clears in one tap', async () => {
  await openMenu();
  row('Cy').click();
  row('Ben').click();
  await settle(10);
  assert.equal(wrap().dataset.slot, 'avatar', 'while the menu is up, the slot is your avatar');
  escape();
  await settle(10);
  assert.equal(isOpen(), false);
  assert.equal(wrap().dataset.slot, 'pill');
  const faces = [...wrap().querySelectorAll('.hl-pill .hl-faces .avatar')];
  assert.deepEqual(faces.map((a) => a.dataset.name), ['Ben', 'Cy'], 'the menu’s order, not the order tapped');
  assert.match(wrap().querySelector('.hl-faces').getAttribute('aria-label'), /Highlighting Ben and Cy/);
  assert.equal($('rail-you-wrap').dataset.slot, 'pill', 'the laptop’s rail says the same');
  wrap().querySelector('.hl-x').click();
  await settle(10);
  assert.deepEqual(filters.loadPeopleFilter(FID), []);
  assert.equal(wrap().dataset.slot, 'avatar', 'your avatar again');
  assert.equal(document.querySelectorAll('#wall-root .card.dim').length, 0);
  assert.equal(isOpen(), false, 'the ✕ clears; it opens nothing');
});

test('the pill’s faces reopen the menu, and the slot is your avatar while it is up', async () => {
  await openMenu();
  row('Ben').click();
  await closeMenu();
  assert.equal(wrap().dataset.slot, 'pill');
  wrap().querySelector('.hl-faces').click();
  await settle(10);
  assert.ok(isOpen());
  assert.equal(wrap().dataset.slot, 'avatar');
  assert.equal(row('Ben').getAttribute('aria-selected'), 'true');
  row('Ben').click(); // off again for the next test
  await closeMenu();
  assert.equal(wrap().dataset.slot, 'avatar');
});

test('it closes on a tap outside, on the avatar again and on Escape — and a tap on a card only closes it', async () => {
  await openMenu();
  $('dock-you').click();
  await settle(10);
  assert.equal(isOpen(), false, 'the avatar again');
  await openMenu();
  document.body.click();
  await settle(10);
  assert.equal(isOpen(), false, 'a tap outside');
  await openMenu();
  escape();
  await settle(10);
  assert.equal(isOpen(), false, 'Escape');
  assert.equal(document.activeElement === document.body || document.activeElement === $('dock-you'), true);
  await openMenu();
  cardOf('Soulwax').click();
  await settle(10);
  assert.equal(isOpen(), false, 'a card closes it');
  assert.equal(((state.crewDoc.festivals[FID].selections || {}).Soulwax || {}).Ana, 1, 'and is not picked on the way out');
});

test('one menu at a time: the fest name’s Show closes Highlight, and Highlight closes Show', async () => {
  await openMenu();
  $('dock-fest-link').click();
  await settle(10);
  assert.equal(isOpen(), false);
  const show = document.querySelector('#dock-fest-wrap .sort-pop');
  assert.ok(show && show.style.display !== 'none', 'Show is up');
  $('dock-you').click();
  await settle(10);
  assert.ok(isOpen());
  assert.equal(show.style.display, 'none', 'Show went');
  await closeMenu();
});

test('Pick as someone else: the join shelf in a member’s words — your chip says you, a name, then “I’m Ben” — two taps, never one', async () => {
  await openMenu();
  action('pick-as').click();
  await settle(20);
  assert.equal(isOpen(), false, 'the menu went as the shelf rose');
  assert.ok(shelf(), 'the join shelf');
  assert.equal(window.history.state && window.history.state.joinShelf, true, 'with its own history entry, as the shelf always has');
  assert.equal(shelf().querySelector('.js-line').textContent, 'Pick shows as…');
  assert.equal(shelf().querySelector('.js-sub').textContent, 'Tap a name, then confirm.');
  assert.equal(shelf().querySelector('.js-field'), null, 'no name field: someone new comes in through + Invite someone');
  const chip = (n) => shelf().querySelector(`.js-name[data-name="${n}"]`);
  assert.ok(chip('Ana').querySelector('.js-you'), 'your chip says so');
  const go = shelf().querySelector('.js-go');
  const stay = shelf().querySelector('.js-look');
  assert.equal(stay.textContent, 'Stay Ana');
  assert.equal(go.disabled, true);
  chip('Ana').click();
  assert.equal(go.disabled, true, 'your own chip chooses nobody: you are already you');
  chip('Ben').click();
  assert.equal(go.textContent, 'I’m Ben');
  assert.equal(crew.me(CREW), 'Ana', 'one tap switches nobody');
  go.click();
  await historySettled();
  assert.equal(crew.me(CREW), 'Ben', 'the second tap does');
  assert.equal(shelf(), null);
  assert.equal($('dock-you').textContent, 'B');
  assert.notEqual(window.history.state && window.history.state.joinShelf, true, 'its entry is consumed');
  // And back, by the same two taps.
  await openMenu();
  assert.equal(row('Ben').querySelector('.you').textContent, 'you', '“you” moved with you');
  action('pick-as').click();
  await settle(20);
  shelf().querySelector('.js-name[data-name="Ana"]').click();
  shelf().querySelector('.js-look').click(); // Stay Ben
  await historySettled();
  assert.equal(crew.me(CREW), 'Ben', 'Stay changes nothing');
  await openMenu();
  action('pick-as').click();
  await settle(20);
  shelf().querySelector('.js-name[data-name="Ana"]').click();
  shelf().querySelector('.js-go').click();
  await historySettled();
  assert.equal(crew.me(CREW), 'Ana');
  assert.equal(writes.filter((w) => w.url.startsWith('/api/crew')).length, 0, 'picking as someone is this phone’s own choice: nothing sent');
});

test('Pick as someone else never switches to someone removed while the shelf was up', async () => {
  await openMenu();
  action('pick-as').click();
  await settle(20);
  shelf().querySelector('.js-name[data-name="Cy"]').click();
  const saved = state.crewDoc.people.Cy;
  state.applyRemoteDoc(deepMerge(state.crewDoc, { people: { Cy: { removed: true } } })); // another phone removes her
  shelf().querySelector('.js-go').click();
  await historySettled();
  assert.equal(crew.me(CREW), 'Ana', 'still Ana: Cy is nobody to be now');
  assert.equal(shelf(), null, 'the shelf went down all the same');
  state.applyRemoteDoc(deepMerge(state.crewDoc, { people: { Cy: { ...saved, removed: false } } })); // back for the tests below
  await settle(10);
});

test('+ Invite someone: one sheet — the crew link first (Copy), then a name, then the people from your other fests', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  assert.equal(isOpen(), false);
  const sheet = document.querySelector('#artist-sheet.invite-sheet');
  assert.ok(sheet, 'the Invite sheet');
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'INVITE SOMEONE');
  const order = [...sheet.children].map((n) => (n.classList.contains('inv-link') ? 'link'
    : n.querySelector && n.querySelector('.inv-name') ? 'name'
      : n.querySelector && n.querySelector('.inv-others') ? 'others' : null)).filter(Boolean);
  assert.deepEqual(order, ['link', 'name', 'others'], 'Kevin’s order');
  const link = sheet.querySelector('.inv-link input');
  assert.match(link.value, new RegExp(`#g=${CREW}`), 'the crew link, visible');
  assert.ok(sheet.querySelector('.inv-link .inv-copy'), 'Copy beside it');
  assert.deepEqual([...sheet.querySelectorAll('.inv-others button')].map((b) => b.textContent), ['+ Drew', '+ Kat'], 'Drew and Kat from your other crew; Ana is you');
  assert.notEqual(document.activeElement, sheet.querySelector('.inv-name input'), 'the name field waits: a keyboard would cover the link');
  assert.equal(sheet.querySelector('.inv-sub').textContent.startsWith('Opens straight into Menu Crew.'), true);
});

test('Add by name is server-first and ends on their own link; a name already here is said, not sent', async () => {
  const sheet = document.querySelector('#artist-sheet.invite-sheet');
  const input = sheet.querySelector('.inv-name input');
  input.value = 'ben';
  sheet.querySelector('.inv-add').click();
  await settle(20);
  assert.match(sheet.querySelector('.inv-status').textContent, /Ben is already in this crew\./);
  const before = writes.length;
  input.value = 'Zed';
  sheet.querySelector('.inv-add').click();
  await settle(80);
  const post = writes.slice(before).find((w) => w.method === 'POST' && w.url.startsWith('/api/crew'));
  assert.ok(post, 'the server hears it first');
  assert.ok(post.body.data.people.Zed, 'the person, by name');
  const done = document.querySelector('#artist-sheet');
  assert.equal(done.querySelector('.sheet-title').textContent, 'ZED IS IN');
  assert.match(done.querySelector('.inv-link input').value, /me=Zed/, 'their own link');
  assert.ok(state.people().Zed, 'and Zed is in the crew here');
  done.querySelector('.inv-done').click();
  await settle(40);
});

test('one add at a time: a chip, then Enter, then another chip while the first is on its way — one POST, and the link is the first one’s', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  let sheet = document.querySelector('#artist-sheet.invite-sheet');
  const input = sheet.querySelector('.inv-name input');
  const chip = (n) => [...sheet.querySelectorAll('.inv-others button')].find((b) => b.textContent === `+ ${n}`);
  const posts = () => writes.filter((w) => w.method === 'POST' && w.url.startsWith('/api/crew')).length;
  const before = posts();
  holdPosts = true;
  chip('Drew').click();
  await settle(5);
  assert.equal(posts(), before + 1, 'Drew is on its way');
  input.value = 'Kat';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  chip('Kat').click();
  await settle(20);
  assert.equal(posts(), before + 1, 'Enter and a second chip started nothing');
  assert.equal(sheet.querySelector('.inv-add').disabled, true, 'Add waits');
  assert.equal(chip('Kat').disabled, true, 'the other chips wait');
  assert.equal(input.readOnly, true, 'the field waits, keeping its focus');
  holdPosts = false;
  heldPosts.splice(0).forEach((r) => r());
  await settle(80);
  sheet = document.querySelector('#artist-sheet');
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'DREW IS IN');
  assert.match(sheet.querySelector('.inv-link input').value, /me=Drew/, 'Drew’s own link');
  assert.ok(state.people().Drew, 'Drew is in the crew');
  assert.equal(state.people().Kat, undefined, 'and Kat, never sent, is not');
  sheet.querySelector('.inv-done').click();
  await settle(40);
});

test('one add at a time, the other way round: a typed name and Enter, then a chip and the Add button — one POST, the typed one’s link', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  let sheet = document.querySelector('#artist-sheet.invite-sheet');
  const input = sheet.querySelector('.inv-name input');
  const posts = () => writes.filter((w) => w.method === 'POST' && w.url.startsWith('/api/crew'));
  const before = posts().length;
  holdPosts = true;
  input.value = 'Lu';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle(5);
  const kat = [...sheet.querySelectorAll('.inv-others button')].find((b) => b.textContent === '+ Kat');
  kat.click();
  sheet.querySelector('.inv-add').click();
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await settle(20);
  assert.equal(posts().length, before + 1, 'one POST');
  assert.ok(posts()[before].body.data.people.Lu, 'Lu’s');
  holdPosts = false;
  heldPosts.splice(0).forEach((r) => r());
  await settle(80);
  sheet = document.querySelector('#artist-sheet');
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'LU IS IN');
  assert.match(sheet.querySelector('.inv-link input').value, /me=Lu/);
  assert.equal(state.people().Kat, undefined);
  sheet.querySelector('.inv-done').click();
  await settle(40);
});

test('the menu gained Zed in place, and a crew-mate who left is gone from it and from the highlight', async () => {
  await openMenu();
  assert.ok(row('Zed'), 'the new person has a row');
  row('Zed').click();
  row('Cy').click();
  await settle(10);
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Zed', 'Cy']);
  await closeMenu();
  // Cy leaves (another phone removes her); the next paint prunes her.
  state.applyRemoteDoc(deepMerge(state.crewDoc, { people: { Cy: { removed: true } } }));
  $('dock-you').click(); // the menu reads the crew afresh as it opens
  await settle(10);
  assert.equal(row('Cy'), undefined, 'no row for someone who left');
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Zed'], 'and the highlight forgot her, rather than blank the wall');
  row('Zed').click();
  await closeMenu();
});
