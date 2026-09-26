// First open, wall first (v92, 2026-09-25 — Kevin chose F2). The real shell,
// on a phone the crew does not know, walked the way a friend walks it:
//
//   the crew link opens straight onto the wall as a GUEST — nobody selected,
//   no "who are you?" list — with a welcome card above the dock saying what
//   this is, once per phone;
//
//   a guest's FINGER tap on a card opens its shelf (the tap change,
//   2026-09-26: the card, − · meter · +, the thread — what a member's tap
//   opens); a click, or any of the shelf's doors, asks who they are on a
//   shelf over the wall that never moves (the guest shelf round), and on join
//   a + (or a click) becomes their pick through the ordinary pick path while
//   − and the note door just join; "Look around" drops it;
//
//   the dock's empty "you" slot is a dashed + that asks the same question;
//
//   and a guest writes NOTHING into the crew until it joins — the link is the
//   consent boundary, and a guest sees only what any link holder already can.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle, settleUntil } from './helpers/shell-rig.mjs';
import { deepMerge } from '../js/merge.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FID = 'portola-2026';
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

// Made-up crews, never real links; built into URLs, never written after `#g=`.
const GUEST = 'firstopentest_guest_0123';
const CLAIM = 'firstopentest_claim_0123';
const BARE = 'firstopentest_bare_01234'; // no inviteFestId: a guest must not stamp one
const EMPTY = 'firstopentest_empty_0123';
const MINE = 'firstopentest_mine_01234'; // a personal link lands here
const ACLONLY = 'firstopentest_aclon_0123'; // no picks, no stamp, one festival that is not the catalog default
const OLDV3 = 'firstopentest_oldv3_0123'; // a legacy doc that still needs its one-shot migration
const ACL = JSON.parse(readFileSync(join(ROOT, 'data/festivals/acl-2026.json'), 'utf8'));
const LEFTOVER = 'firstopentest_left_01234'; // an earlier owner's edit still queued on this phone
const NOROW = 'firstopentest_norow_0123'; // the link's festival is not in the crew's doc
const SLOW = 'firstopentest_slow_01234'; // a join that takes its time on one bar
const MIGR = 'firstopentest_migr_01234'; // a legacy crew whose update fails, then lands

const crewDoc = (people, selections = {}, meta = { name: 'The Test Crew', inviteFestId: FID }) => ({
  v: 4, meta, spotify: {}, affinity: {}, people, festivals: { [FID]: { selections } },
});
// The server's copy: POSTs merge into it, like the real one.
const SERVER = {
  [GUEST]: crewDoc({ Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, { Robyn: { Maya: 2 }, 'Dog Blood': { Kevin: 4 } }),
  [CLAIM]: crewDoc({ Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, { Robyn: { Kevin: 2 } }),
  [BARE]: crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 1 } }, { name: 'Bare Crew' }),
  [EMPTY]: crewDoc({}),
  [MINE]: crewDoc({ Kevin: { colorIndex: 0 }, Drew: { colorIndex: 2 } }),
  [ACLONLY]: { v: 4, meta: { name: 'ACL Crew' }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { 'acl-2026': { selections: {} } } },
  [OLDV3]: { ...crewDoc({ Kevin: { colorIndex: 0 } }, { Robyn: { Kevin: 2 } }), v: 3 },
  [LEFTOVER]: crewDoc({ Kevin: { colorIndex: 0 } }, { Soulwax: { Kevin: 2 } }),
  [NOROW]: { v: 4, meta: { name: 'No Row Crew' }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: {} },
  [SLOW]: crewDoc({ Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 } }, { 'Dog Blood': { Maya: 2 } }),
  [MIGR]: { ...crewDoc({ Kevin: { colorIndex: 0 } }, { 'Dog Blood': { Kevin: 1 } }), v: 3 },
};
let migrateOk = false; // MIGR's one-shot update fails until a test says the network is back

const writes = []; // every non-GET request, as `METHOD path?t=… body`
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
async function network(url, opts = {}) {
  const u = String(url);
  const method = opts.method || 'GET';
  if (method !== 'GET') writes.push({ method, url: u, body: opts.body ? JSON.parse(opts.body) : null });
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u === `/data/festivals/${FID}.json`) return json(FEST);
  if (u === '/data/festivals/acl-2026.json') return json(ACL);
  if (u.startsWith('/api/festival-add?')) return json({ festivals: [] });
  if (u === '/api/person') {
    if (method === 'GET') return json({ error: 'nobody' }, 404);
    const sent = opts.body ? JSON.parse(opts.body) : {};
    return json({ token: 'personfirstopen_token_0123', id: 'pid_firstopen_01', doc: { v: 1, name: sent.name || 'Sam', crews: (sent.data || {}).crews || {} } });
  }
  if (u.startsWith('/api/crew?')) {
    const q = new URL(u, 'https://x').searchParams;
    const t = q.get('t');
    if (!SERVER[t]) return json({ error: 'Crew not found' }, 404);
    if (q.get('op') === 'migrate') {
      if (!migrateOk) return json({ error: 'unreachable' }, 503);
      SERVER[t] = { ...SERVER[t], v: 4 };
      return json(SERVER[t]);
    }
    if (method !== 'GET' && t === SLOW) await new Promise((r) => setTimeout(r, 400));
    if (method !== 'GET') SERVER[t] = deepMerge(SERVER[t], JSON.parse(opts.body).data || {});
    return json(SERVER[t]);
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({ url: `https://fest.kevinhg.com/f/${FID}#g=${GUEST}&f=${FID}`, fetch: network });
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const crew = await import('../js/crew.js');

const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
const shown = () => SCREENS.filter((id) => $(id).style.display !== 'none');
const welcome = () => document.getElementById('welcome-card');
const cardOf = (artist) => document.querySelector(`#wall-root .card[data-artist="${artist}"]`);
const buttonNamed = (root, label) => [...root.querySelectorAll('button')].find((b) => b.textContent === label);
const crewWrites = (t) => writes.filter((w) => w.url.startsWith('/api/crew') && w.url.includes(t));
// The hand behind a press (card-facts.js reads it): a mouse click asks on the
// shelf; a finger's tap on a resting card opens its zoom first.
// A press and its lift, as every pointer's click comes (a click answers only a press that lifted — card-facts.js clickHand).
const press = (el, pointerType) => {
  el.dispatchEvent(new shell.dom.window.PointerEvent('pointerdown', { bubbles: true, pointerType }));
  el.dispatchEvent(new shell.dom.window.PointerEvent('pointerup', { bubbles: true, pointerType }));
};
const clickCard = (artist) => { const c = cardOf(artist); press(c, 'mouse'); c.click(); };
const fingerTap = (el) => { press(el, 'touch'); el.click(); };
// The join shelf.
const shelf = () => document.querySelector('.join-shelf');
const shelfLine = () => shelf().querySelector('.js-line').textContent;
const shelfChip = (name) => [...shelf().querySelectorAll('.js-name')].find((b) => b.dataset.name === name);
const shelfGo = () => shelf().querySelector('.js-go');
const shelfLook = () => shelf().querySelector('.js-look');
const typeName = (v) => { const f = shelf().querySelector('.js-field'); f.value = v; f.dispatchEvent(new shell.dom.window.Event('input')); };
// The next popstate and a beat for its handlers — never a fixed sleep: a
// traversal is two jsdom tasks, and a thread a loaded machine held past the
// sleep read the page between them (Sol 6's night-clock run, 2026-09-26).
const popped = () => new Promise((r) => shell.dom.window.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));
async function goBack() { const p = popped(); history.back(); await p; }
async function lookAround() { shelfLook().click(); await settleUntil(() => !shelf() && !(history.state && history.state.joinShelf)); await settle(10); }
async function open(hash) {
  location.hash = hash;
  await settle(120);
}

await settle(160);

test('a crew link on a phone the crew does not know opens the wall, as a guest', () => {
  assert.deepEqual(shown(), ['screen-app'], 'the wall, not "who are you?"');
  assert.equal(crew.me(GUEST), null, 'nobody claimed on this phone');
  assert.ok(cardOf('Robyn'), 'the crew’s wall, cards and all');
  assert.equal(document.getElementById('coach-mark'), null, 'the old toolbar strip is gone');
  assert.deepEqual(writes, [], 'a guest writes nothing — not the crew, not a person record');
});

test('the dock’s "you" slot is a dashed + that says what it does', () => {
  for (const id of ['dock-you', 'rail-you']) {
    const you = $(id);
    assert.ok(you.classList.contains('guest'), `${id} wears the guest ring`);
    assert.equal(you.textContent, '+');
    assert.equal(you.getAttribute('aria-label'), 'Add yourself to the crew');
    assert.equal(you.tagName, 'BUTTON', 'a real button, so it inherits the 44px floor');
  }
});

test('the welcome card says what this is, above the dock, in C1’s words', () => {
  const box = welcome();
  assert.ok(box, 'up on the first open');
  assert.ok($('screen-app').contains(box), 'inside the wall screen — Settings and the join screen hide it with the wall');
  assert.ok(box.classList.contains('bring-offer'), 'the offer’s anatomy, above the dock');
  assert.equal(box.querySelector('.micro-label').textContent, 'The Test Crew');
  assert.equal(box.querySelector('.bring-line').textContent, 'This is the crew’s plan for Portola.');
  assert.equal(box.querySelector('.bring-sub').textContent,
    'Every friend has a color — the more color on a card, the more of us want to go. More info', 'one line, then the link');
  assert.equal(box.querySelectorAll('.avatar-cluster .avatar').length, 2, 'the crew, in their colours');
  const halves = [...box.querySelectorAll('.bring-actions button')].map((b) => b.textContent);
  assert.deepEqual(halves, ['Pick shows', 'Look around'], 'two halves: the way to pick first, on the left; the quiet way to look on the right');
  assert.ok(box.querySelector('.bring-actions .btn-ghost').textContent === 'Look around', 'looking is the outlined one');
  assert.ok(buttonNamed(box, 'Pick shows').classList.contains('btn-tonal'), 'picking is the filled one');
  const more = box.querySelector('.bring-sub .welcome-more');
  assert.ok(more, 'More info ends the explanation line');
  assert.equal(more.textContent, 'More info');
  assert.equal(more.tagName, 'BUTTON', 'a real button, drawn as a link');
});

test('"Pick shows" on the welcome asks on the shelf, over the wall — nothing waiting, nothing written', async () => {
  buttonNamed(welcome(), 'Pick shows').click();
  await settle(10);
  assert.deepEqual(shown(), ['screen-app'], 'the wall stays; nothing takes over the screen');
  assert.ok(shelf(), 'the shelf is up');
  assert.equal(shelf().id, 'artist-sheet', 'the production sheet (its id is the one every closing path knows)');
  assert.ok(document.getElementById('sheet-backdrop'), 'the wall dimmed behind it');
  assert.equal(shelfLine(), 'Pick shows as…', 'no artist waiting');
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1', 'the welcome has been read');
  assert.equal(history.state && history.state.joinShelf, true, 'a history entry, so Back closes it');
  await lookAround();
  assert.equal(shelf(), null, 'Look around takes it down');
  assert.equal(document.getElementById('sheet-backdrop'), null);
  assert.equal(welcome(), null, 'and the welcome does not come back');
  assert.deepEqual(writes, []);
  // The next test reads the old storage: the welcome not yet seen.
  localStorage.removeItem('fn_welcome_v1');
});

const notesShelf = () => { const n = document.getElementById('artist-sheet'); return n && !n.classList.contains('join-shelf') ? n : null; };
test('a guest’s finger tap on a card opens its shelf — − · meter · + along the card’s floor — and writes nothing', async () => {
  fingerTap(cardOf('Robyn'));
  await settle(10);
  assert.equal(document.querySelector('#zoom-layer .zoom-card'), null, 'no zoom on a finger');
  const sheet = notesShelf();
  assert.ok(sheet, 'the card’s shelf, the view a member gets by tapping');
  assert.equal(shelf(), null, 'nothing asked yet: a tap looks');
  const doors = [...sheet.querySelectorAll('.sheet-card .f-step-row > *')];
  assert.deepEqual(doors.map((b) => b.className.split(' ')[0]), ['f-step', 'f-meter', 'f-step'], '− · a hollow meter · +');
  assert.ok(doors.filter((b) => b.tagName === 'BUTTON').every((b) => !b.disabled), '− and + both live: each one asks who you are');
  assert.equal(sheet.querySelector('.f-pick'), null, 'no special Pick shows button');
  assert.equal(sheet.querySelector('.composer'), null, 'no composer for a guest');
  // (a tap taking the welcome down: first-open-tap-welcome.test.mjs, where it is up)
  // A tap on the shelf's card does nothing: reading never asks by accident.
  sheet.querySelector('.sheet-card .f-name').click();
  await settle(10);
  assert.equal(shelf(), null);
  assert.deepEqual(writes, []);
});

test('a tap on the dimmed wall only closes the shelf — it never opens the card under it', async () => {
  const back = document.getElementById('sheet-backdrop');
  const closed = popped(); // the dimmed wall closes through history, like Back
  press(back, 'touch');
  back.click();
  await closed;
  assert.equal(notesShelf(), null, 'closed');
  assert.equal(shelf(), null, 'and nothing asked');
  fingerTap(cardOf('Robyn')); // the next tap opens again
  await settle(10);
  assert.ok(notesShelf(), 'a fresh tap opens a card');
});

test('+ on the card’s shelf asks on the join shelf, naming the artist; the notes shelf gives way', async () => {
  const pick = notesShelf().querySelector('.sheet-card .f-step.plus');
  pick.dispatchEvent(new shell.dom.window.MouseEvent('mousedown', { bubbles: true })); // a real press
  pick.click();
  await settle(10);
  const { recent } = await import('../js/errlog.js');
  assert.ok(!recent().some((r) => JSON.stringify(r).includes('zoom-close-after-click')), 'nothing journaled as a surprise');
  assert.equal(notesShelf(), null, 'the notes shelf gave way');
  assert.ok(shelf());
  assert.equal(shelfLine(), 'Pick Robyn as…');
  assert.deepEqual([...shelf().querySelectorAll('.js-name')].map((b) => b.dataset.name), ['Kevin', 'Maya'], 'the crew’s names, to tap');
  assert.equal(shelfGo().textContent, 'Join');
  assert.equal(shelfGo().disabled, true, 'nothing chosen: nothing to answer');
  assert.equal(shelfLook().textContent, 'Look around', 'in the welcome card’s words');
  assert.equal(shelf().querySelector('.js-field').placeholder, 'Add your name', 'Kevin’s words (2026-09-25)');
});

test('claiming takes two taps: the name, then "I’m Maya" — and a typed name reads as what it will do', () => {
  shelfChip('Maya').click();
  assert.equal(shelfGo().textContent, 'I’m Maya');
  assert.equal(shelfChip('Maya').getAttribute('aria-pressed'), 'true');
  assert.ok(shelfChip('Kevin').classList.contains('off'), 'the others step back');
  assert.equal(crew.me(GUEST), null, 'a tap on a name claims nothing on its own');
  typeName('Sam');
  assert.equal(shelfGo().textContent, 'Join as Sam', 'a new name');
  typeName('maya');
  assert.equal(shelfGo().textContent, 'I’m Maya', 'an existing name, any capitalisation, is a claim');
  assert.ok(shelfChip('Maya').classList.contains('on'));
  assert.deepEqual(writes, []);
});

test('"Look around" drops the question — still a guest, the wall unchanged, nothing written', async () => {
  await lookAround();
  assert.equal(shelf(), null);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(GUEST), null);
  assert.equal(welcome(), null, 'read once, gone');
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Maya, 2, 'nothing on the wall changed');
  assert.deepEqual(writes, []);
});

test('the dashed + opens the same shelf, with no artist waiting', async () => {
  $('dock-you').click();
  await settle(10);
  assert.ok(shelf());
  assert.equal(shelfLine(), 'Pick shows as…');
  await lookAround();
  assert.equal(shelf(), null);
});

test('the system Back takes the shelf down', async () => {
  clickCard('Robyn');
  await settle(10);
  assert.ok(shelf(), 'a click (desktop) asks on the shelf directly');
  assert.equal(shelfLine(), 'Pick Robyn as…');
  await goBack();
  assert.equal(shelf(), null, 'Back closes it, rather than leaving the app');
  assert.deepEqual(shown(), ['screen-app']);
});

test('a notes sheet, as a guest: read-only, with the door in where the composer would be', async () => {
  // Forward into a day's notes, the way history reopens a sheet.
  const { dom } = shell;
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: { layers: ['sheet:day:2026-09-26'] } }));
  await settle(20);
  const sheet = document.getElementById('artist-sheet');
  assert.ok(sheet, 'the day’s notes are open');
  assert.equal(sheet.querySelector('.composer'), null, 'no composer for a guest');
  const door = sheet.querySelector('button.join-door');
  assert.ok(door, 'the door in');
  assert.equal(door.textContent, 'Add yourself to write a note');
  door.click();
  await settle(20);
  assert.ok(shelf(), 'the shelf, in the notes sheet’s place');
  assert.equal(document.querySelectorAll('.sheet').length, 1, 'one sheet at a time');
  assert.equal(shelfLine(), 'Pick shows as…');
  await lookAround();
  assert.deepEqual(shown(), ['screen-app']);
  assert.deepEqual(writes, []);
});

test('Settings, as a guest: no door writes into the crew, and You says how to join', async () => {
  $('gear-btn').click();
  await settle(20);
  const root = $('settings-root');
  assert.deepEqual(shown(), ['screen-settings']);
  assert.equal(buttonNamed(root, 'Rename'), undefined, 'a guest renames nothing');
  assert.equal(buttonNamed(root, 'Fest not in the catalog? Research + add it to this board'), undefined);
  assert.equal(root.querySelector('[aria-label="Spotify settings"]'), null, 'Spotify badges YOUR picks — a guest has none');
  assert.ok(![...root.querySelectorAll('.row-title')].some((t) => t.textContent === 'Bulk paste picks'));
  assert.match(root.textContent, /You’re just looking\. Add yourself to pick with the crew/);
  assert.ok(buttonNamed(root, 'Add yourself'), 'the door in, right there');
  assert.ok(buttonNamed(root, 'How it works') || [...root.querySelectorAll('.row-title')].some((t) => t.textContent === 'How it works'));
  buttonNamed(root, 'Add yourself').click();
  await settle(20);
  assert.deepEqual(shown(), ['screen-app'], 'back on the wall');
  assert.ok(shelf(), 'with the same shelf over it');
  await lookAround();
  assert.deepEqual(shown(), ['screen-app'], '"Look around" leaves the wall, not Settings');
  assert.deepEqual(writes, []);
});

test('joining from a tap: one POST for the person, and the + they tapped is their first pick', async () => {
  fingerTap(cardOf('Kettama'));
  await settle(10);
  notesShelf().querySelector('.sheet-card .f-step.plus').click();
  await settle(10);
  assert.equal(shelfLine(), 'Pick Kettama as…');
  typeName('Sam');
  shelfGo().click();
  await settle(160);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(shelf(), null, 'the shelf went back down');
  assert.equal(crew.me(GUEST), 'Sam');
  const joins = crewWrites(GUEST);
  assert.ok(joins.length >= 1);
  assert.deepEqual(Object.keys(joins[0].body.data.people), ['Sam'], 'the first write is the join, today’s path');
  assert.equal(joins[0].body.data.festivals, undefined, 'and nothing else rides it');
  assert.equal(state.crewDoc.festivals[FID].selections.Kettama.Sam, 1, 'Kettama is Sam’s first pick');
  assert.equal(state.pendingChanges.festivals?.[FID]?.selections?.Kettama?.Sam ?? SERVER[GUEST].festivals[FID].selections.Kettama?.Sam, 1,
    'through the ordinary pick path — queued (or already pushed) like any tap');
  assert.equal($('dock-you').textContent, 'S', 'the + became Sam');
  assert.ok(!$('dock-you').classList.contains('guest'));
  // The just-joined welcome (the independent walk of b29aac0): the guest card
  // was read before the join could land, and this one has its own marker —
  // it is where Sam learns how to pick.
  const card = welcome();
  assert.ok(card, 'the just-joined welcome is up');
  assert.match(card.querySelector('.bring-sub').textContent, /Tap any artist, then \+ to add yours/);
  assert.deepEqual([...card.querySelectorAll('.bring-actions button')].map((b) => b.textContent), ['Got it'], 'a member’s one door');
  assert.equal(localStorage.getItem('fn_welcome_joined_v1'), '1', 'once per phone: shown is seen');
});

test('the next open walks Sam straight in — claimed, no question, no welcome', async () => {
  await open('');
  assert.deepEqual(shown(), ['screen-landing']);
  await open(`#g=${GUEST}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(GUEST), 'Sam');
  assert.equal(welcome(), null);
});

test('tapping your own name in keeps what you had: a pick already there is never moved', async () => {
  await open(`#g=${CLAIM}`);
  assert.deepEqual(shown(), ['screen-app'], 'a crew this phone’s person is not in: a guest again');
  assert.equal(crew.me(CLAIM), null);
  clickCard('Robyn');
  await settle(10);
  shelfChip('Kevin').click();
  shelfGo().click(); // "I'm Kevin"
  await settle(160);
  assert.equal(crew.me(CLAIM), 'Kevin');
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Kevin, 2, 'Kevin’s 2 stays a 2 — the waiting tap never cycles it');
});

test('a guest shares the link it holds, and never stamps the crew’s invite festival', async () => {
  await open(`#g=${BARE}&f=${FID}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(BARE), null);
  $('gear-btn').click();
  await settle(20);
  buttonNamed($('settings-root'), 'Share invite').click();
  await settle(20);
  assert.equal((state.pendingChanges.meta || {}).inviteFestId, undefined, 'no stamp from a guest');
  assert.deepEqual(crewWrites(BARE), [], 'nothing written to that crew at all');
  $('settings-root').querySelector('.back-btn').click();
  await settle(40);
});

test('a crew with nobody in it: the wall, and a tap asks for a first name', async () => {
  await open(`#g=${EMPTY}&f=${FID}`);
  assert.deepEqual(shown(), ['screen-app']);
  clickCard('Robyn');
  await settle(10);
  assert.ok(shelf());
  assert.equal(shelf().querySelectorAll('.js-name').length, 0, 'no names to tap — just the new-name field');
  assert.equal(shelf().querySelector('.js-names-wrap').hidden, true);
  await lookAround();
  assert.deepEqual(crewWrites(EMPTY), []);
});

test('a personal link still asks first ("this link is yours"), and "Look around" walks in as a guest', async () => {
  await open(`#g=${MINE}&f=${FID}&me=Drew`);
  assert.deepEqual(shown(), ['screen-join']);
  assert.match($('join-people').textContent, /this link is yours/);
  $('join-look').click();
  await settle(160);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(MINE), null, 'looking, not claiming');
  assert.ok($('dock-you').classList.contains('guest'));
  assert.deepEqual(crewWrites(MINE), []);
});

test('a guest with no festival in the link or the crew lands where the crew is — never on a festival the crew does not have', async () => {
  // The catalog default is Portola; this crew only has ACL, with no picks and
  // no invite stamp. Opening Portola here would record it in the crew's doc.
  await open(`#g=${ACLONLY}`);
  await settle(80);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.activeFestivalId, 'acl-2026');
  assert.equal(state.pendingChanges.festivals, undefined, 'no festival membership queued');
  assert.deepEqual(crewWrites(ACLONLY), [], 'nothing sent to the crew at all');
  // And a tap asks over THIS festival's wall.
  const first = document.querySelector('#wall-root .card[data-artist]');
  press(first, 'mouse');
  first.click();
  await settle(10);
  assert.ok(shelf());
  assert.equal(state.activeFestivalId, 'acl-2026', 'the wall under the shelf is still ACL');
  await lookAround();
});

test('a guest never asks for a legacy crew’s one-shot migration — that is a write; joining runs it', async () => {
  await open(`#g=${OLDV3}&f=${FID}`);
  await settle(80);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(OLDV3), null);
  assert.deepEqual(crewWrites(OLDV3), [], 'no op=migrate from a guest');
  assert.equal(document.getElementById('migration-banner'), null, 'and no "picks unlock in a moment" for someone with no picks');
});

test('history cannot open a member-only drill for a guest: it lands on Settings itself', async () => {
  const { dom } = shell;
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: { layers: ['settings', 'sub:bulk'] } }));
  await settle(20);
  assert.deepEqual(shown(), ['screen-settings']);
  assert.notEqual(document.getElementById('settings-main').style.display, 'none', 'the Settings page, not the drill');
  assert.equal(document.querySelector('#settings-subview textarea'), null, 'no bulk paste box');
  dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate', { state: { layers: [] } }));
  await settle(20);
  assert.deepEqual(crewWrites(OLDV3), []);
});

test('a guest never sends: an earlier owner’s queued edit stays queued, untouched, and nothing leaves', async () => {
  // This phone was Kevin's in this crew once; his last pick never went out.
  const queued = JSON.stringify({ festivals: { [FID]: { selections: { Robyn: { Kevin: 1 } } } } });
  localStorage.setItem(`fn_crew_pending_v3_${LEFTOVER}`, queued);
  await open(`#g=${LEFTOVER}&f=${FID}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(LEFTOVER), null, 'a guest');
  const sync = await import('../js/sync.js');
  await settle(1500); // past the push debounce
  await sync.pushSync(); // and asked outright
  assert.equal(sync.flushOnHide(), false, 'the unload beacon sends nothing either');
  assert.equal(await sync.requestMigration(), false, 'nor the one-shot update');
  assert.deepEqual(crewWrites(LEFTOVER), [], 'no POST, not even an empty one');
  assert.equal(localStorage.getItem(`fn_crew_pending_v3_${LEFTOVER}`), queued, 'Kevin’s edit is still queued, for Kevin');
  assert.equal(sync.syncState(), 'online', 'reading is not "syncing" and not a fault');
});

test('a guest on a crew without the link’s festival row renders it and records nothing — even after a poll', async () => {
  await open(`#g=${NOROW}&f=${FID}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(state.activeFestivalId, FID);
  const sync = await import('../js/sync.js');
  await sync.pollSync(); // applyRemoteDoc re-ensures the festival on every poll
  assert.equal(state.pendingChanges.festivals, undefined, 'no festival row queued');
  assert.equal(localStorage.getItem(`fn_crew_pending_v3_${NOROW}`), null);
  await settle(1500);
  assert.deepEqual(crewWrites(NOROW), []);
});

test('one answer at a time: a slow join is not overtaken by a tap on someone else’s name', async () => {
  await open(`#g=${SLOW}&f=${FID}`);
  clickCard('Robyn');
  await settle(10);
  assert.equal(shelfLine(), 'Pick Robyn as…');
  typeName('Sam');
  shelfGo().click(); // the POST takes 400 ms
  await settle(20);
  const kevin = shelfChip('Kevin');
  assert.equal(kevin.disabled, true, 'every other answer waits');
  assert.equal(shelfLook().disabled, true);
  assert.equal(shelfGo().disabled, true);
  kevin.click();
  shelfGo().click();
  document.getElementById('sheet-backdrop').click(); // the dimmed wall does not drop a settling answer either
  await settle(700);
  assert.equal(crew.me(SLOW), 'Sam', 'the answer that was given');
  const robyn = state.crewDoc.festivals[FID].selections.Robyn || {};
  assert.equal(robyn.Sam, 1, 'Robyn is Sam’s first pick');
  assert.equal(robyn.Kevin, undefined, 'and never Kevin’s');
  assert.equal(crewWrites(SLOW).filter((w) => w.body && w.body.data && w.body.data.people && w.body.data.people.Sam && w.body.data.people.Sam.colorIndex !== undefined).length, 1, 'one join');
});

test('the promised pick waits for a legacy crew’s update — kept, not dropped — and lands when it does', async () => {
  await open(`#g=${MIGR}&f=${FID}`);
  assert.deepEqual(shown(), ['screen-app']);
  assert.deepEqual(crewWrites(MIGR), [], 'a guest never asks for the update');
  clickCard('Robyn');
  await settle(10);
  typeName('Tia');
  shelfGo().click();
  await settle(200);
  assert.equal(crew.me(MIGR), 'Tia');
  assert.ok(crewWrites(MIGR).some((w) => /op=migrate/.test(w.url)), 'the member asks for the update — and it fails');
  assert.ok(document.getElementById('migration-banner'), 'picks are locked, and the wall says so');
  assert.equal((state.crewDoc.festivals[FID].selections.Robyn || {}).Tia, undefined, 'not yet');
  migrateOk = true;
  document.querySelector('#migration-banner button').click(); // "Try now"
  await settle(120);
  assert.equal(document.getElementById('migration-banner'), null, 'unlocked');
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Tia, 1, 'and Robyn is Tia’s, as promised');
});
