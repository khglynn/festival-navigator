// First open, wall first (v92, 2026-09-25 — Kevin chose F2). The real shell,
// on a phone the crew does not know, walked the way a friend walks it:
//
//   the crew link opens straight onto the wall as a GUEST — nobody selected,
//   no "who are you?" list — with a welcome card above the dock saying what
//   this is, once per phone;
//
//   a guest's first tap on an artist is the moment the name is asked (today's
//   join screen, now saying which artist), and on join that artist becomes
//   their pick through the ordinary pick path; "Just looking" goes back;
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
import { bootShell, settle } from './helpers/shell-rig.mjs';
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
};

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
    const t = new URL(u, 'https://x').searchParams.get('t');
    if (!SERVER[t]) return json({ error: 'Crew not found' }, 404);
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
// Writes that carry anything. sync.js pushes the ACTIVE crew's pending
// changes when a debounce scheduled on the previous crew fires after a switch
// — with nothing pending that is `{data: {}}`, which the merge leaves exactly
// as it was (pre-existing, and not a guest's doing). The law is about content.
const contentWrites = (t) => crewWrites(t).filter((w) => /[?&]op=/.test(w.url) || Object.keys((w.body && w.body.data) || {}).length > 0);
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
    'Every friend has a color — the more color on a card, the more of us want to go. Look around, or join to add your own picks.');
  assert.equal(box.querySelectorAll('.avatar-cluster .avatar').length, 2, 'the crew, in their colours');
  assert.ok(buttonNamed(box, 'Just looking') && buttonNamed(box, 'How it works'), 'the quiet way to look, on the left');
  const pick = buttonNamed(box, 'Join to pick');
  assert.ok(pick, 'Kevin’s right-hand door, for a friend who already knows they want to pick');
  assert.equal(box.querySelector('.bring-actions').lastElementChild, pick, 'after the two ways to look — the right side');
  assert.ok(pick.classList.contains('welcome-join'));
});

test('"Join to pick" is the ordinary join, with nothing waiting — and still writes nothing', async () => {
  buttonNamed(welcome(), 'Join to pick').click();
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal($('join-for').style.display, 'none', 'no artist waiting');
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1', 'the welcome has been read');
  $('join-look').click();
  await settle(40);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(welcome(), null, 'and it does not come back');
  assert.deepEqual(writes, []);
  // The next test reads the old storage: the welcome not yet seen.
  localStorage.removeItem('fn_welcome_v1');
});

test('a guest’s tap on an artist asks who they are, naming the artist — and still writes nothing', () => {
  cardOf('Robyn').click();
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal($('join-for').textContent, 'Pick Robyn as…');
  assert.notEqual($('join-for').style.display, 'none');
  assert.ok($('join-look'), 'with a way back');
  assert.match($('join-people').textContent, /Kevin/, 'the crew’s names, to tap');
  assert.equal(localStorage.getItem('fn_welcome_v1'), '1', 'asking was engaging: the welcome has done its job');
  assert.deepEqual(writes, []);
});

test('"Just looking" goes back to the wall, still a guest, the welcome not coming back', async () => {
  $('join-look').click();
  await settle(40);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(GUEST), null);
  assert.equal(welcome(), null, 'read once, gone');
  assert.equal(state.crewDoc.festivals[FID].selections.Robyn.Maya, 2, 'nothing on the wall changed');
  assert.deepEqual(writes, []);
});

test('the dashed + opens the same question, with no artist waiting', async () => {
  $('dock-you').click();
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal($('join-for').style.display, 'none', 'no "Pick … as" without a tap');
  $('join-look').click();
  await settle(40);
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
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal(document.getElementById('artist-sheet'), null, 'the sheet went with the wall');
  assert.equal($('join-for').style.display, 'none');
  $('join-look').click();
  await settle(40);
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
  assert.deepEqual(shown(), ['screen-join'], 'the same join screen');
  $('join-look').click();
  await settle(40);
  assert.deepEqual(shown(), ['screen-app'], '"Just looking" comes back to the wall, not to Settings');
  assert.deepEqual(writes, []);
});

test('joining from a tap: one POST for the person, and the tapped artist is their first pick', async () => {
  cardOf('Kettama').click();
  assert.equal($('join-for').textContent, 'Pick Kettama as…');
  $('join-name-input').value = 'Sam';
  $('join-add-btn').click();
  await settle(160);
  assert.deepEqual(shown(), ['screen-app']);
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
  cardOf('Robyn').click();
  const kevin = [...$('join-people').querySelectorAll('button')].find((b) => /Kevin/.test(b.textContent));
  kevin.click();
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
  cardOf('Robyn').click();
  assert.deepEqual(shown(), ['screen-join']);
  assert.equal($('join-people').children.length, 0, 'no names to tap — just the new-name field');
  $('join-look').click();
  await settle(40);
  assert.deepEqual(crewWrites(EMPTY), []);
});

test('a personal link still asks first ("this link is yours"), and "Just looking" walks in as a guest', async () => {
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
  assert.deepEqual(contentWrites(ACLONLY), [], 'nothing written into the crew');
  // And a tap asks in that festival's name, not a stamp's or a default's.
  document.querySelector('#wall-root .card[data-artist]').click();
  assert.deepEqual(shown(), ['screen-join']);
  assert.match($('join-fest-name').textContent, /^ACL/);
  $('join-look').click();
  await settle(40);
});

test('a guest never asks for a legacy crew’s one-shot migration — that is a write; joining runs it', async () => {
  await open(`#g=${OLDV3}&f=${FID}`);
  await settle(80);
  assert.deepEqual(shown(), ['screen-app']);
  assert.equal(crew.me(OLDV3), null);
  assert.deepEqual(contentWrites(OLDV3), [], 'no op=migrate from a guest');
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
  assert.deepEqual(contentWrites(OLDV3), []);
});
