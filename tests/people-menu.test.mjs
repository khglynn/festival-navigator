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
//   with one quiet row under it — Pick for a friend — that moves the same
//   sheet to its next step: the crew, a name, the people from your other
//   fests (Kevin, 2026-10-03).
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
import jsQR from 'jsqr';

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
// And the next N GETs (a poll that left before something else happened).
let holdGets = 0;
const heldGets = [];
// A held request that is given up on (its deadline) fails like a real fetch.
const held = (list, opts) => new Promise((resolve, reject) => {
  list.push(resolve);
  if (opts.signal) opts.signal.addEventListener('abort', () => reject(new window.DOMException('The operation was aborted.', 'AbortError')));
});
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
    // The server takes a write at once; a held POST is its ANSWER slow in
    // transit — so it carries the crew as it was when the write landed.
    if (method !== 'GET') SERVER[t] = deepMerge(SERVER[t], JSON.parse(opts.body).data || {});
    const answer = JSON.parse(JSON.stringify(SERVER[t]));
    if (method !== 'GET' && holdPosts) await held(heldPosts, opts);
    if (method === 'GET' && holdGets > 0) { holdGets -= 1; await held(heldGets, opts); }
    return json(answer);
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
const sync = await import('../js/sync.js');
const errlog = await import('../js/errlog.js');

// The canvas the Invite sheet's QR is drawn on (js/v3/qr.js). jsdom has
// none; the rig's stand-in draws nothing. This one paints each solid
// fillRect into pixels and hands back a data URL naming them, so a test
// decodes what the sheet DREW and holds it against the link it prints.
// Everything else (the favicon's gradient, its paths) stays a no-op.
// `qrCanvas = false` takes the 2D context away from every canvas but the
// favicon's 32px one: a browser that refuses a canvas.
const drawn = new Map();
let qrCanvas = true;
{
  const proto = window.HTMLCanvasElement.prototype;
  proto.getContext = function getContext() {
    if (!qrCanvas && this.width !== 32) return null;
    const canvas = this;
    const pen = {
      fillStyle: '#000000',
      fillRect(x, y, w, h) {
        if (typeof this.fillStyle !== 'string' || !/^#[0-9a-f]{6}$/i.test(this.fillStyle)) return;
        if (!canvas.rgba) canvas.rgba = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        const rgb = [1, 3, 5].map((i) => parseInt(this.fillStyle.slice(i, i + 2), 16));
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          const i = (yy * canvas.width + xx) * 4;
          canvas.rgba.set([...rgb, 255], i);
        }
      },
      // What qr.js reads back to be sure the drawing is really there.
      getImageData(x, y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        if (canvas.rgba) for (let yy = 0; yy < h; yy++) data.set(canvas.rgba.subarray(((y + yy) * canvas.width + x) * 4, ((y + yy) * canvas.width + x + w) * 4), yy * w * 4);
        return { data, width: w, height: h };
      },
    };
    return new Proxy(pen, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })) });
  };
  proto.toDataURL = function toDataURL() {
    if (!this.rgba) return 'data:image/png;base64,';
    const id = `qr${drawn.size}`;
    drawn.set(id, { data: this.rgba, width: this.width, height: this.height });
    return `data:image/png;base64,${id}`;
  };
}
// The text a drawn QR <img> holds, read back the way a camera would.
function scanned(img) {
  const id = (img.getAttribute('src') || '').split(',')[1];
  const px = drawn.get(id);
  if (!px) return null;
  const hit = jsQR(px.data, px.width, px.height, { inversionAttempts: 'dontInvert' });
  return hit ? hit.data : null;
}

const pop = () => document.querySelector('#dock-you-wrap .hl-pop');
const isOpen = () => !!pop() && pop().style.display !== 'none';
const row = (name) => [...pop().querySelectorAll('[data-person]')].find((b) => b.dataset.person === name);
const action = (a) => pop().querySelector(`[data-act="${a}"]`);
const wrap = () => $('dock-you-wrap');
const escape = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const shelf = () => document.querySelector('.join-shelf');
// Wait for a state, never the clock (a loaded machine runs late: "the menu
// gained Zed" once failed at a fixed 10 ms settle under load 25). Any history
// traversal still on its way closes a menu when it lands (a menu goes with the
// page on a popstate), so the menu opens only once history is still.
async function until(check, what, ms = 3000) {
  for (let t = 0; !check(); t += 5) {
    if (t > ms) assert.fail(`still waiting for ${what}`);
    await settle(5);
  }
}
const historyStill = () => !(window.history.state && (window.history.state.joinShelf || (window.history.state.layers || []).length));
async function openMenu() {
  await until(historyStill, 'the history to settle');
  if (!isOpen()) $('dock-you').click();
  await until(isOpen, 'the menu to open');
}
async function closeMenu() { if (isOpen()) { escape(); await settle(10); } }
// The join shelf's ways out pop its history entry, and the popstate that
// follows closes any menu that is up: wait for that traversal to land before
// the next tap, never a fixed time (a loaded machine lands it late — see
// first-open-guest.test.mjs lookAround).
async function historySettled() {
  await until(historyStill, 'the shelf’s history entry to go');
  await settle(10);
}
// A sheet's Done pops the router's entry for it; wait for that to land.
async function sheetClosed() {
  await until(() => !document.getElementById('artist-sheet') && historyStill(), 'the sheet and its history entry to go');
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

// Kevin's two steps (2026-10-03: "change the 'pick for a friend' section to
// be a bit cleaner and more subtle since this shelf is so busy now… And then
// the next step shows our people / add name shelf"). The link's step keeps
// the line, the QR, the link and Share; under them a member has ONE quiet
// row, and the name field, the crew and your other fests are the next step
// of the same sheet.
const stepOf = (sheet, sel) => sheet.querySelector(sel).closest('.inv-step');
const linkStep = (sheet) => stepOf(sheet, '.inv-link');
const friendStep = (sheet) => stepOf(sheet, '.inv-name');
const partsOf = (step) => [...step.children].map((n) => (n.classList.contains('inv-qr') ? 'qr'
  : n.classList.contains('inv-link') ? 'link'
    : n.classList.contains('inv-actions') ? 'actions'
      : n.classList.contains('inv-friend') ? 'friend'
        : n.classList.contains('inv-name') ? 'name'
          : n.classList.contains('inv-status') ? 'status'
            : n.querySelector && n.querySelector('.inv-people') ? 'people'
              : n.querySelector && n.querySelector('.inv-others') ? 'others'
                : n.classList.contains('inv-sub') ? 'line' : n.className));
// The row, tapped: the same sheet moves to the friend step (no history entry).
function toFriend(sheet) {
  sheet.querySelector('.inv-friend').click();
  assert.equal(friendStep(sheet).hidden, false, 'the friend step is up');
  assert.equal(linkStep(sheet).hidden, true, 'and the link’s step has gone');
  return sheet;
}

test('+ Invite someone: one sheet — the line, the QR on top of the crew link (Copy), Share; under them ONE quiet row, Pick for a friend', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  assert.equal(isOpen(), false);
  const sheet = document.querySelector('#artist-sheet.invite-sheet');
  assert.ok(sheet, 'the Invite sheet');
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'INVITE SOMEONE');
  const step = linkStep(sheet);
  assert.equal(step.hidden, false, 'the link’s step is the one up');
  assert.deepEqual(partsOf(step), ['line', 'qr', 'link', 'actions', 'friend'], 'the QR on top of the link (slice 1), Share, then the one row');
  const link = sheet.querySelector('.inv-link input');
  assert.match(link.value, new RegExp(`#g=${CREW}`), 'the crew link, visible');
  assert.ok(sheet.querySelector('.inv-link .inv-copy'), 'Copy beside it');
  // The QR is that very link: one link on the sheet, whichever way it leaves.
  const qr = sheet.querySelector('.inv-qr');
  // Not a <figure>: a figure takes its name from its caption, and a screen
  // reader read the caption twice (the review of 1b80842).
  assert.equal(qr.tagName, 'DIV');
  assert.equal(qr.querySelector('figure, figcaption'), null);
  assert.equal(qr.previousElementSibling, sheet.querySelector('.inv-sub'), 'right under the line that says what the link opens');
  const img = qr.querySelector('img');
  assert.equal(img.alt, 'QR code for the crew link');
  assert.equal(qr.querySelector('.inv-qr-cap').textContent, 'Point a phone camera here to join. Anyone who scans it is in.', 'and it says what scanning it does');
  await until(() => img.getAttribute('src'), 'the QR drawn');
  assert.equal(scanned(img), link.value, 'scanned, it is exactly the link in the box');
  assert.equal(qr.querySelectorAll('button').length, 0, 'no Save button: a long-press, a right-click or a screenshot keeps it');
  assert.equal(sheet.querySelector('.inv-sub').textContent.startsWith('Opens straight into Menu Crew.'), true);
  // The row: a real button (the 44px floor), its words, a chevron — and
  // nothing else of the friend step on this one: no label, no field, no chips.
  const row = sheet.querySelector('.inv-friend');
  assert.equal(row.tagName, 'BUTTON', 'a button, so the touch floor comes with it');
  assert.equal(row.querySelector('.inv-friend-name').textContent, 'Pick for a friend');
  assert.equal(row.querySelector('.inv-friend-sub').textContent, 'They can join anytime');
  assert.equal(row.querySelector('.inv-friend-chev').getAttribute('aria-hidden'), 'true', 'the chevron is a picture, not words');
  assert.equal(step.querySelector('.micro-label, .inv-name, .inv-others, .inv-people'), null, 'the busy parts moved to the next step');
  assert.equal(friendStep(sheet).hidden, true, 'the friend step waits behind the row');
  assert.notEqual(document.activeElement, sheet.querySelector('.inv-name input'), 'the name field waits: a keyboard would cover the link');
  assert.equal(sheet.querySelector('.sheet-back').hidden, true, 'no ‹ on the first step');
});

test('Pick for a friend: the same sheet moves on — its title, a ‹ back, the line, the crew already in, the name field focused, your other fests; no history entry', async () => {
  const sheet = document.querySelector('#artist-sheet.invite-sheet');
  const entries = window.history.length;
  const at = JSON.stringify(window.history.state);
  toFriend(sheet);
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'PICK FOR A FRIEND');
  const step = friendStep(sheet);
  assert.deepEqual(partsOf(step), ['line', 'people', 'name', 'status', 'others'], 'what it does, who is in, the name, its word, your other fests');
  assert.equal(step.querySelector('.inv-sub').textContent, 'You pick for them, so the crew sees where they’re going. Whenever they want to pick, their own link makes the picks theirs.');
  // Our people, in their own colours, read-only: a roster, not a control.
  const chips = [...step.querySelectorAll('.inv-people .person-chip')];
  assert.deepEqual(chips.map((c) => c.textContent), ['Ana', 'Ben', 'Cy'], 'the crew, in its order');
  for (const c of chips) {
    assert.equal(c.tagName, 'SPAN', `${c.textContent}: read-only, so not a button`);
    assert.ok(c.classList.contains('static'), `${c.textContent}: wears no pointer`);
    assert.match(c.style.background, /hsl|rgb/, `${c.textContent}: in their colour`);
  }
  assert.deepEqual(chips.filter((c) => c.classList.contains('you')).map((c) => c.textContent), ['Ana'], 'you, marked as Settings marks you');
  assert.equal(step.querySelector('.inv-people').previousElementSibling.textContent, 'Already in');
  assert.deepEqual([...step.querySelectorAll('.inv-others button')].map((b) => b.textContent), ['+ Drew', '+ Kat'], 'Drew and Kat from your other crew; Ana is you');
  assert.equal(document.activeElement, step.querySelector('.inv-name input'), 'the name field takes the focus: it is what this step is for');
  const back = sheet.querySelector('.sheet-back');
  assert.equal(back.hidden, false, 'a ‹ back to the link');
  assert.equal(back.tagName, 'BUTTON');
  assert.equal(back.getAttribute('aria-label'), 'Back to the crew link');
  assert.equal(back.nextElementSibling, sheet.querySelector('.sheet-title'), 'before the title, as Settings’ ‹ is');
  assert.equal(window.history.length, entries, 'no history entry: Back still closes the whole sheet');
  assert.equal(JSON.stringify(window.history.state), at);
  // ‹ goes back to the link's step, focus on the row that left it.
  back.click();
  assert.equal(linkStep(sheet).hidden, false, 'the link again');
  assert.equal(friendStep(sheet).hidden, true);
  assert.equal(sheet.querySelector('.sheet-title').textContent, 'INVITE SOMEONE');
  assert.equal(back.hidden, true, 'and the ‹ goes with the step');
  assert.equal(document.activeElement, sheet.querySelector('.inv-friend'), 'focus back on the row it left from');
  assert.equal(window.history.length, entries, 'still no entry');
  assert.equal(JSON.stringify(window.history.state), at);
});

test('Pick for a friend: server-first, and it ends on their own link, for if they ever want to pick; a name already here is said, not sent', async () => {
  const sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
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
  assert.equal(done.querySelector('.inv-qr'), null, 'and no QR: whoever scanned a QR of Zed’s link would be told it is theirs');
  assert.equal(done.querySelector('.inv-sub').textContent, 'If Zed ever wants to pick, send this link. Opening it makes the picks theirs.', 'done as it stands; the link is an if-ever');
  // The doc comes the ordered way (sync.afterServerWrite's poll), not from the answer.
  await until(() => state.people().Zed, 'Zed, brought by the poll');
  done.querySelector('.inv-done').click();
  await sheetClosed();
});

test('one add at a time: a chip, then Enter, then another chip while the first is on its way — one POST, and the link is the first one’s', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  let sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
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
  await until(() => state.people().Drew, 'Drew, brought by the poll');
  assert.equal(state.people().Kat, undefined, 'and Kat, never sent, is not');
  sheet.querySelector('.inv-done').click();
  await sheetClosed();
});

test('one add at a time, the other way round: a typed name and Enter, then a chip and the Add button — one POST, the typed one’s link', async () => {
  await openMenu();
  action('invite').click();
  await settle(20);
  let sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
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
  await sheetClosed();
});

// The friend step is a step of the sheet, not a layer of its own (AGENTS.md:
// "Browser history is shared state" — no entry, so nothing new for Back to
// get wrong): from it, every way out closes the whole sheet, as from the link.
test('from the friend step, Back, Escape, the ✕ and the dimmed wall each close the whole sheet — as they do from the link', async () => {
  for (const [how, out] of [
    ['Back', () => window.history.back()],
    ['Escape', () => escape()],
    ['the ✕', () => document.querySelector('#artist-sheet .sheet-close').click()],
    ['the dimmed wall', () => document.getElementById('sheet-backdrop').click()],
  ]) {
    await openMenu();
    action('invite').click();
    await settle(20);
    toFriend(document.querySelector('#artist-sheet.invite-sheet'));
    out();
    await sheetClosed();
    assert.equal(document.querySelector('.invite-sheet'), null, `${how}: the whole sheet is down, not just its step`);
  }
});

// In this file the module is already loaded by now (the + Invite test drew
// a QR), so this is the warm path: drawn in a microtask the moment the sheet
// is on the page, refused, and taken away before a frame. The late paths —
// the module refused, held past its deadline, failing at last — are the
// browser contract's (tests/browser/people-menu.test.mjs), where a request
// can really be held or aborted.
test('a phone that cannot draw the QR loses only the QR: the link stands alone, and the record names no link', async () => {
  qrCanvas = false;
  try {
    await openMenu();
    action('invite').click();
    await settle(20);
    const sheet = document.querySelector('#artist-sheet.invite-sheet');
    assert.equal(sheet.querySelector('.inv-qr'), null, 'no QR, and no empty tile where it would have been');
    assert.equal(sheet.querySelector('.inv-sub').nextElementSibling, sheet.querySelector('.inv-link'), 'the link where it always was');
    const said = errlog.recent().filter((e) => e.kind === 'invite:qr');
    assert.equal(said.length, 1, 'recorded once');
    assert.equal(said[0].msg, 'qr: no 2d canvas', 'in the error’s own words');
    // The words are the error's own, so nothing was scrubbed out of them; the
    // stack is file paths (jsdom's own long names can read token-shaped to
    // the scrubber, so a mark there would prove nothing either way).
    assert.doesNotMatch(JSON.stringify(said), new RegExp(`${CREW}|#g=|g=`), 'no link anywhere in it');
  } finally {
    qrCanvas = true;
    // Closed whatever happened above, so one red stays one red: the tests
    // after this one each wait for the history to settle (the review of
    // 1b80842: a failure here once failed the twelve after it).
    const open = document.querySelector('#artist-sheet.invite-sheet');
    if (open) { open.querySelector('.inv-done').click(); await sheetClosed(); }
  }
});

// The fold is a Web Animation; an engine that refuses it (throws from
// animate) must still lose the tile — `gone` is already set by then, so a
// throw there once left a dim empty square on the sheet for good (the
// review of 116ab8e). The image's error, after the tile has been on screen
// for a frame, takes the animated way out. jsdom paints no frames, so this
// test lends the page a frame clock (a timer) while the sheet opens.
test('a QR whose image fails after it was seen still leaves when the fold animation cannot run', async () => {
  const proto = window.HTMLElement.prototype;
  const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
  const was = proto.animate;
  const hadFrames = 'requestAnimationFrame' in window;
  if (!hadFrames) window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  try {
    await openMenu();
    action('invite').click();
    await settle(20);
    const sheet = document.querySelector('#artist-sheet.invite-sheet');
    const qr = sheet.querySelector('.inv-qr');
    assert.ok(qr, 'the QR is on the sheet');
    await new Promise((r) => window.requestAnimationFrame(() => r())); // seen: it leaves by folding
    if (!hadFrames) delete window.requestAnimationFrame;
    proto.animate = function animate() { throw new Error('animate refused'); };
    qr.querySelector('img').dispatchEvent(new window.Event('error'));
    assert.equal(sheet.querySelector('.inv-qr'), null, 'the tile is gone, not stuck');
    assert.equal(sheet.querySelector('.inv-sub').nextElementSibling, sheet.querySelector('.inv-link'), 'and the link stands where it always was');
  } finally {
    if (had) proto.animate = was; else delete proto.animate;
    if (!hadFrames) delete window.requestAnimationFrame;
    const open = document.querySelector('#artist-sheet.invite-sheet');
    if (open) { open.querySelector('.inv-done').click(); await sheetClosed(); }
  }
});

// One add per crew, whatever the sheets do (Sol's re-review of 1b678c0: the
// guard lived in the sheet, so close and reopen reset it, two POSTs went out,
// and the older answer landing last dropped the newer person locally).
test('one add per crew across a closed and reopened sheet: the new sheet waits on the add that is out, then takes its answer', async () => {
  const posts = () => writes.filter((w) => w.method === 'POST' && w.url.startsWith('/api/crew'));
  const before = posts().length;
  await openMenu();
  action('invite').click();
  await settle(20);
  let sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
  holdPosts = true;
  sheet.querySelector('.inv-name input').value = 'Mo';
  sheet.querySelector('.inv-add').click();
  await settle(5);
  assert.equal(posts().length, before + 1, 'Mo is on its way');
  sheet.querySelector('.inv-done').click(); // closed with Mo still out
  await sheetClosed();
  await openMenu();
  action('invite').click();
  await settle(20);
  sheet = document.querySelector('#artist-sheet.invite-sheet');
  assert.equal(linkStep(sheet).hidden, false, 'a reopened sheet opens on the link, as every Invite does');
  assert.equal(sheet.querySelector('.inv-friend-sub').textContent, 'Adding Mo…', 'its row says what is out');
  toFriend(sheet);
  assert.match(sheet.querySelector('.inv-status').textContent, /Adding Mo…/, 'and so does the step behind it');
  assert.equal(sheet.querySelector('.inv-add').disabled, true, 'and waits for it');
  assert.equal(sheet.querySelector('.inv-name input').readOnly, true);
  assert.ok([...sheet.querySelectorAll('.inv-others button')].every((b) => b.disabled));
  const input = sheet.querySelector('.inv-name input');
  input.value = 'Nia';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  sheet.querySelector('.inv-add').click();
  await settle(20);
  assert.equal(posts().length, before + 1, 'one POST at a time: Nia waits');
  holdPosts = false;
  heldPosts.splice(0).forEach((r) => r());
  await until(() => /MO IS IN/.test(document.querySelector('#artist-sheet .sheet-title')?.textContent || ''), 'Mo’s answer on the reopened sheet');
  sheet = document.querySelector('#artist-sheet');
  assert.match(sheet.querySelector('.inv-link input').value, /me=Mo/, 'Mo’s own link, on the sheet that was open when it landed');
  await until(() => state.people().Mo, 'Mo, brought by the poll');
  sheet.querySelector('.inv-done').click();
  await sheetClosed();
  // Now Nia, on her own.
  await openMenu();
  action('invite').click();
  await settle(20);
  sheet = document.querySelector('#artist-sheet.invite-sheet');
  assert.equal(sheet.querySelector('.inv-friend-sub').textContent, 'They can join anytime', 'nothing out: the row says its own words');
  toFriend(sheet);
  assert.equal(sheet.querySelector('.inv-add').disabled, false, 'nothing out: the entries are live again');
  sheet.querySelector('.inv-name input').value = 'Nia';
  sheet.querySelector('.inv-add').click();
  await until(() => /NIA IS IN/.test(document.querySelector('#artist-sheet .sheet-title')?.textContent || ''), 'Nia’s answer');
  assert.match(document.querySelector('#artist-sheet .inv-link input').value, /me=Nia/);
  assert.equal(posts().length, before + 2, 'two adds, two POSTs, one after the other');
  await until(() => state.people().Mo && state.people().Nia, 'both, on this phone');
  document.querySelector('#artist-sheet .inv-done').click();
  await sheetClosed();
});

// Cut, not patched (Sol's third round on the add answer, bcaacb3): the add
// no longer writes its answer into this phone's doc, and asks sync for the
// doc the ordered way. So the two orders that lost or resurrected people
// simply cannot happen.
const addNamed = async (name, { holdAnswer = false } = {}) => {
  await openMenu();
  action('invite').click();
  await settle(20);
  const sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
  if (holdAnswer) holdPosts = true;
  sheet.querySelector('.inv-name input').value = name;
  sheet.querySelector('.inv-add').click();
  await settle(5);
};
const answered = (name) => until(() => new RegExp(`${name.toUpperCase()} IS IN`).test(document.querySelector('#artist-sheet .sheet-title')?.textContent || ''), `${name}’s answer`);
const doneWithSheet = async () => { document.querySelector('#artist-sheet .inv-done').click(); await sheetClosed(); };

test('a poll that left before the add and answers after it cannot take the new person away', async () => {
  holdGets = 1;
  const old = sync.pollSync(); // out before the add: its snapshot has no Pat
  await settle(5);
  await addNamed('Pat');
  await answered('Pat');
  assert.match(document.querySelector('#artist-sheet .inv-link input').value, /me=Pat/, 'Pat’s link, at once, from the name alone');
  await until(() => state.people().Pat, 'Pat, brought by the fresh poll');
  heldGets.splice(0).forEach((r) => r()); // the old poll answers now, last
  await old;
  await settle(20);
  assert.ok(state.people().Pat, 'Pat is still here: the older snapshot was set aside');
  await doneWithSheet();
});

test('another phone’s removal and recolour, arriving while an add’s answer is in transit, are never undone by it', async () => {
  await addNamed('Ria', { holdAnswer: true }); // the server has Ria; her answer is slow
  const benWas = state.people().Ben.colorIndex;
  SERVER[CREW] = deepMerge(SERVER[CREW], { people: { Mo: { removed: true }, Ben: { colorIndex: 17 } } }); // another phone
  await sync.pollSync(); // …and a poll brings it
  assert.equal(state.people().Mo.removed, true, 'Mo is out, here');
  assert.equal(state.people().Ben.colorIndex, 17);
  holdPosts = false;
  holdGets = 1; // hold the fresh poll too, so the answer's own effect can be seen alone
  heldPosts.splice(0).forEach((r) => r()); // Ria's answer — Mo active, Ben's old colour — lands last
  await answered('Ria');
  await settle(20);
  assert.equal(state.people().Mo.removed, true, 'Mo stays out: the answer writes nothing into this phone’s doc');
  assert.equal(state.people().Ben.colorIndex, 17, 'and Ben keeps his new colour');
  heldGets.splice(0).forEach((r) => r());
  await until(() => state.people().Ria, 'Ria, brought by the fresh poll');
  assert.equal(state.people().Mo.removed, true);
  assert.equal(state.people().Ben.colorIndex, 17);
  assert.notEqual(benWas, 17);
  await doneWithSheet();
});

test('a request that hangs is let go at its deadline: a plain word, and the entries live again', async () => {
  const real = AbortSignal.timeout;
  let asked = null;
  AbortSignal.timeout = (ms) => { asked = ms; const c = new AbortController(); setTimeout(() => c.abort(), 60); return c.signal; };
  try {
    await addNamed('Uma', { holdAnswer: true }); // never answered
    const sheet = document.querySelector('#artist-sheet.invite-sheet');
    assert.equal(asked, 12000, 'the join flow’s deadline');
    assert.equal(sheet.querySelector('.inv-add').disabled, true, 'waiting');
    await until(() => !sheet.querySelector('.inv-add').disabled, 'the entries to come back');
    assert.equal(sheet.querySelector('.inv-status').textContent, 'Didn’t reach the crew — try again.');
    assert.equal(sheet.querySelector('.inv-name input').readOnly, false);
  } finally {
    AbortSignal.timeout = real;
    holdPosts = false;
    heldPosts.splice(0);
  }
  // Let go for the page, not just this sheet: a reopened sheet is free, and the try again goes out.
  await doneWithSheet();
  await addNamed('Uma');
  await answered('Uma');
  await doneWithSheet();
});

// Stay offline means this phone sends nothing (Sol's re-review of 58e75fe).
const postsNow = () => writes.filter((w) => w.method === 'POST' && w.url.startsWith('/api/crew')).length;
const settleSync = async () => { sync.setStayOffline(false); await sync.pushSync(); await settle(10); };

test('under Stay offline an add sends nothing: it is kept here as a pending edit, and the sheet says the crew hears when the phone is online again', async () => {
  const before = postsNow();
  sync.setStayOffline(true);
  try {
    await addNamed('Vic');
    await answered('Vic');
    assert.equal(postsNow(), before, 'no POST under Stay offline');
    const sheet = document.querySelector('#artist-sheet');
    assert.equal(sheet.querySelector('.inv-sub').textContent, 'The crew sees Vic once this phone is online again. If Vic ever wants to pick, send this link. Opening it makes the picks theirs.');
    assert.match(sheet.querySelector('.inv-link input').value, /me=Vic/, 'his link all the same');
    assert.ok(state.people().Vic, 'Vic is here at once');
    assert.ok(((state.pendingChanges || {}).people || {}).Vic, 'as a pending edit, for sync to send');
    await doneWithSheet();
  } finally { await settleSync(); }
  assert.equal(postsNow(), before + 1, 'and sync sends him once the setting is off');
  assert.ok(SERVER[CREW].people.Vic, 'the crew has him');
});

test('Stay offline switched on while an add is out and it succeeds: nothing is queued here — the server has the person, and sync brings them when it resumes', async () => {
  await addNamed('Wes', { holdAnswer: true }); // out, and the server has him
  sync.setStayOffline(true);
  try {
    holdPosts = false;
    heldPosts.splice(0).forEach((r) => r());
    await answered('Wes');
    assert.match(document.querySelector('#artist-sheet .inv-sub').textContent, /once this phone is online again/, 'the sheet says so');
    assert.equal(((state.pendingChanges || {}).people || {}).Wes, undefined, 'no pending copy (it could bring back someone another phone removes, or undo a newer colour)');
    assert.equal(state.people().Wes, undefined, 'and no local write: the ordered path brings him');
    await doneWithSheet();
    // Another phone removes Wes before this one sends again: nothing here brings him back.
    SERVER[CREW] = deepMerge(SERVER[CREW], { people: { Wes: { removed: true } } });
  } finally { await settleSync(); } // what switching the setting off does (app.js onStayOffline → pushSync)
  assert.ok(state.people().Wes, 'the crew doc arrived the ordered way');
  assert.equal(state.people().Wes.removed, true, 'with the other phone’s removal standing');
});

test('a local-only add checks the people cap first: a full crew says so instead of promising a link', async () => {
  const fill = {};
  const active = () => state.activePeople().length;
  for (let i = 0; active() + Object.keys(fill).length < 24; i += 1) fill[`Fill${i}`] = { colorIndex: 0 };
  state.applyRemoteDoc(deepMerge(state.crewDoc, { people: fill })); // 24 active, as this phone knows it
  assert.equal(active(), 24);
  sync.setStayOffline(true);
  try {
    await addNamed('Yan');
    await settle(20);
    const sheet = document.querySelector('#artist-sheet.invite-sheet');
    assert.equal(sheet.querySelector('.inv-status').textContent, 'This crew is full (24 people max).', 'the server’s own words');
    assert.equal(state.people().Yan, undefined);
    assert.equal(((state.pendingChanges || {}).people || {}).Yan, undefined, 'nothing queued');
    assert.equal(sheet.querySelector('.inv-add').disabled, false, 'the entries are live again');
    document.querySelector('#artist-sheet .sheet-close').click();
    await sheetClosed();
  } finally { await settleSync(); } // the crew as the server has it again (the fill was this phone's alone)
  assert.equal(state.people().Fill0, undefined);
});

test('a local-only add of a removed member merges into their entry: their pid is kept', async () => {
  const pid = 'pidolitest0001';
  SERVER[CREW] = deepMerge(SERVER[CREW], { people: { Oli: { colorIndex: 13, removed: true, pid } } });
  await sync.pollSync();
  assert.equal(state.people().Oli.pid, pid);
  sync.setStayOffline(true);
  try {
    await addNamed('Oli');
    await answered('Oli');
    assert.equal(state.people().Oli.removed, false, 'back');
    assert.equal(state.people().Oli.pid, pid, 'with the pid their claim link needs');
    await doneWithSheet();
  } finally { await settleSync(); }
  assert.equal(SERVER[CREW].people.Oli.pid, pid, 'and the server’s copy keeps it too');
});

test('bringing back a removed member: a reopened sheet before the poll lands still knows the add is done — no second POST', async () => {
  assert.equal(state.people().Mo.removed, true, 'Mo left earlier (another phone removed him)');
  holdGets = 1; // the ordered poll after the add waits
  await addNamed('mo'); // any capitalisation brings back the same person
  await answered('Mo');
  const after = postsNow();
  await doneWithSheet();
  assert.equal(state.people().Mo.removed, true, 'this phone still has the old entry — the poll has not landed');
  await openMenu();
  action('invite').click();
  await settle(20);
  const sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
  sheet.querySelector('.inv-name input').value = 'Mo';
  sheet.querySelector('.inv-add').click();
  await settle(20);
  assert.equal(postsNow(), after, 'no second POST');
  assert.equal(sheet.querySelector('.inv-status').textContent, 'Mo is already in this crew.', 'the answered add counts, though the old entry is removed');
  heldGets.splice(0).forEach((r) => r());
  await until(() => state.people().Mo && !state.people().Mo.removed, 'Mo back, brought by the poll');
  document.querySelector('#artist-sheet .sheet-close').click();
  await sheetClosed();
});

// Codex on 6178e38 (a regression against production): an answered add was
// remembered until a sheet happened to check it while the person looked
// active here. Nobody did, another phone removed him, and the sheet said
// "already in this crew" and sent nothing — production sends the re-add.
// The memory now ends when a read that left after the add has landed,
// whatever it says about him.
test('an add answered, another phone removes him, an ordered poll brings that: adding him back sends the POST', async () => {
  await addNamed('Gus');
  await answered('Gus');
  await until(() => state.people().Gus && !state.people().Gus.removed, 'Gus, brought by the ordered poll');
  await doneWithSheet(); // and nothing on this phone looks at the add again while he is here
  SERVER[CREW] = deepMerge(SERVER[CREW], { people: { Gus: { removed: true } } }); // another phone removes him
  await sync.pollSync(); // a poll that left after the add: the server's word on Gus
  assert.equal(state.people().Gus.removed, true, 'Gus is out, here');
  // Count the adds for Gus, not every crew POST: a sync push of this phone's
  // own pending edits can land in the same window (CI run 36263820686 saw
  // 18 vs 17 — a push, not a second add).
  const gusAdds = () => writes.filter((w) => w.method === 'POST' && w.url.startsWith('/api/crew') && w.body && w.body.data && w.body.data.people && w.body.data.people.Gus);
  const before = gusAdds().length;
  await addNamed('Gus');
  await answered('Gus');
  assert.equal(gusAdds().length, before + 1, 'the re-add goes to the server, as production’s does');
  const post = gusAdds().at(-1);
  assert.equal(post.body.data.people.Gus.removed, false, 'bringing him back');
  await until(() => state.people().Gus && !state.people().Gus.removed, 'Gus back, brought by the ordered poll');
  await doneWithSheet();
});

test('the menu gained Zed in place, and a crew-mate who left is gone from it and from the highlight', async () => {
  await openMenu();
  assert.ok(row('Zed'), 'the new person has a row');
  row('Zed').click();
  row('Cy').click();
  await settle(10);
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Zed', 'Cy']);
  await closeMenu();
  // Cy leaves (another phone removes her); the next paint prunes her. She
  // leaves on the SERVER and arrives by the ordered poll: a local-only apply
  // was undone whenever the shell's 25 s poll landed here and brought her
  // back from the server (CI run 37021952091, under the Tokyo pass's load).
  SERVER[CREW] = deepMerge(SERVER[CREW], { people: { Cy: { removed: true } } });
  sync.afterServerWrite();
  await until(() => state.people().Cy && state.people().Cy.removed, 'Cy out, brought by the poll');
  $('dock-you').click(); // the menu reads the crew afresh as it opens
  await settle(10);
  assert.equal(row('Cy'), undefined, 'no row for someone who left');
  assert.deepEqual(filters.loadPeopleFilter(FID), ['Zed'], 'and the highlight forgot her, rather than blank the wall');
  row('Zed').click();
  await closeMenu();
});

test('closing the Invite sheet after an add hands focus back to + Invite someone — the chip the add redrew, never the page', async () => {
  const chip = () => document.querySelector('.person-chip.add');
  const opener = chip();
  assert.ok(opener, 'the people row’s + Invite someone');
  opener.focus();
  opener.click();
  await settle(20);
  const sheet = toFriend(document.querySelector('#artist-sheet.invite-sheet'));
  sheet.querySelector('.inv-name input').value = 'Yan';
  sheet.querySelector('.inv-add').click();
  await until(() => /YAN IS IN/.test(document.querySelector('#artist-sheet .sheet-title')?.textContent || ''), 'Yan’s answer');
  await until(() => state.people().Yan && chip() !== opener, 'the poll brings Yan and the row is redrawn');
  assert.equal(opener.isConnected, false, 'the chip that opened the sheet is gone');
  escape();
  await sheetClosed();
  assert.equal(document.activeElement, chip(), 'focus lands on the new + Invite someone, not <body>');
});
