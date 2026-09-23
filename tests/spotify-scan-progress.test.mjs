// The Spotify drill must never look frozen while it is reading (2026-09-23).
//
// What Kevin saw: "Reading your library…", an empty bar and an empty cover
// tile, for the whole scan — he thought it had hung. It had read 6,225
// artists fine. The cause: runFullSync() was handed the progress callback of
// the card that STARTED the scan, and the drill re-renders under a running
// scan (the owner-app config landing right after the OAuth return, a remote
// sync repainting, back/forward). Every card after the first was deaf.
//
// Held here, against the real modules in the real shell:
//   - progress reaches whichever card is mounted NOW, and a card mounted
//     mid-scan catches up at once from the latest snapshot (numbers, bar,
//     cover);
//   - before the first number, the bar is visibly waiting (and says so in
//     words, for reduced motion and Low Power where nothing moves);
//   - a scan that fails stops and offers a retry instead of re-launching
//     itself in a loop (offline at a festival, that loop was a battery fire).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const TOKEN = 'spotifyprogress_0123456789'; // a made-up crew, never a real link
const CID = 'c'.repeat(32);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const gates = {};
const gated = (name) => new Promise((open) => { gates[name] = open; });
let waits = {};
const calls = [];
let offline = false;

const track = (i, cover) => ({
  track: { uri: `spotify:track:t${i}`, artists: [{ name: `Artist ${i}` }], album: { images: [{ url: cover }] } },
});
const page = (from, n, next) => ({
  total: 100,
  items: Array.from({ length: n }, (_, k) => track(from + k, `https://i.scdn.co/image/cover-${from + k}`)),
  next,
});

async function network(url) {
  const u = String(url);
  calls.push(u);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('/data/festivals/')) {
    try { return json(JSON.parse(readFileSync(join(ROOT, u.slice(1)), 'utf8'))); } catch { return json({}, 404); }
  }
  if (u === '/api/access?config=1') { await waits.access; return json({ enabled: false, ownerClientId: '' }); }
  if (u.startsWith('https://api.spotify.com/v1/')) {
    if (offline) throw new TypeError('Failed to fetch');
    const path = u.slice('https://api.spotify.com/v1'.length);
    if (path === '/me') return json({ id: 'kev' });
    if (path === '/me/tracks?limit=50') { await waits.page1; return json(page(0, 50, 'https://api.spotify.com/v1/me/tracks?offset=50&limit=50')); }
    if (path === '/me/tracks?offset=50&limit=50') { await waits.page2; return json(page(50, 50, null)); }
    if (path.startsWith('/me/following')) return json({ artists: { items: [{ name: 'Artist 3', images: [] }], cursors: { after: null } } });
  }
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({ fetch: network }); // no crew: boot lands on the landing
await settle(60);
test.after(() => shell.close());
const { $, dom } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const spotify = await import('../js/spotify.js');
const { openSubviewByKey } = await import('../js/v3/settings.js');

// jsdom never loads images; a cover that "arrives" is what the tile shows.
Object.defineProperty(dom.window.HTMLImageElement.prototype, 'src', {
  configurable: true,
  get() { return this.getAttribute('src') || ''; },
  set(v) { this.setAttribute('src', v); setTimeout(() => { if (this.onload) this.onload(); }, 0); },
});

const ctx = { meName: 'Kev', fid: null, picks: {} };
const actions = { afterBulk() {}, rerender() {}, close() {} };
function freshCrew() {
  localStorage.setItem('fn_spotify_auth_v1', JSON.stringify({
    clientId: CID, access_token: 'test-access', refresh_token: 'test-refresh', expires_at: Date.now() + 3600e3,
  }));
  localStorage.removeItem('fn_spotify_libmap_v1');
  state.activateCrew(TOKEN, {
    v: 4, meta: {}, spotify: { clientId: CID }, people: { Kev: { colorIndex: 0 } }, festivals: {}, affinity: {},
  });
  ctx.fid = state.activeFestivalId;
  const host = document.createElement('div');
  host.id = 'settings-subview';
  $('settings-root').replaceChildren(host);
}
const drill = () => $('settings-subview');
const counter = () => drill().querySelector('.scan-tile')?.nextElementSibling?.firstElementChild;
const bar = () => drill().querySelector('.scan-bar');
const fill = () => drill().querySelector('.scan-bar-fill');
const tileImg = () => drill().querySelector('.scan-tile img');

test('before the first number, the bar is visibly waiting — and says so in words', async () => {
  waits = { access: gated('access'), page1: gated('page1'), page2: gated('page2') };
  freshCrew();
  assert.ok(spotify.isConnected() && !spotify.libraryMap(), 'connected, nothing read yet');
  openSubviewByKey('sub:spotify', ctx, actions);
  await settle(10);
  assert.equal(counter().textContent, 'Reading your library…');
  assert.ok(bar().classList.contains('waiting'), 'the bar breathes instead of sitting empty');
  assert.match(drill().textContent, /first page/i, 'words for when nothing may move (reduced motion, Low Power)');
});

test('the drill re-renders under the running scan, and the NEW card still hears every page', async () => {
  const first = drill().firstElementChild;
  gates.access(); // the owner-app config lands — the exact re-render the OAuth return makes
  await settle(10);
  assert.notEqual(drill().firstElementChild, first, 'a fresh card is on screen now');
  assert.equal(counter().textContent, 'Reading your library…', 'still reading, still waiting');

  gates.page1();
  await settle(20);
  assert.match(counter().textContent, /50 of 100 liked songs · 50 artists/, 'the mounted card got the page');
  assert.ok(!bar().classList.contains('waiting'), 'a real number replaces the breathing');
  assert.match(fill().style.width, /^47\.5%$/, 'and the bar moves');
  assert.ok(!/first page/i.test(drill().textContent), 'the waiting words go with it');
  await settle(5); // the cover lands on its (stubbed) load, a tick after the numbers
  assert.ok(tileImg(), 'covers flick by in the card you are looking at');
});

test('a card mounted mid-scan catches up at once from the latest page', async () => {
  openSubviewByKey('sub:spotify', ctx, actions); // a remote-sync repaint, back/forward …
  assert.match(counter().textContent, /50 of 100 liked songs/, 'no waiting for the next page to know where it is');
  assert.ok(!bar().classList.contains('waiting'));
  assert.match(fill().style.width, /^47\.5%$/);
  await settle(5);
  assert.ok(tileImg(), 'the last cover comes back too — never an empty tile mid-scan');

  gates.page2();
  await settle(60);
  assert.match(drill().textContent, /Your Spotify/, 'the scan finished and the drill says what it read');
  assert.match(drill().textContent, /100 artists in your library/);
  assert.equal(document.getElementById('spot-scan-pill'), null, 'no pill left behind');
});

test('a scan that fails stops and offers a retry — it never re-launches itself in a loop', async () => {
  freshCrew();
  offline = true;
  const before = calls.filter((u) => u.endsWith('/v1/me')).length;
  openSubviewByKey('sub:spotify', ctx, actions);
  await settle(200);
  const tries = calls.filter((u) => u.endsWith('/v1/me')).length - before;
  assert.equal(tries, 1, `one attempt, not a loop (saw ${tries})`);
  const retry = [...drill().querySelectorAll('button')].find((b) => b.textContent === 'Try again');
  assert.ok(retry, 'a retry the person chooses');
  assert.ok(!bar() || !bar().classList.contains('waiting'), 'and nothing pretends to be working');

  offline = false;
  waits = { access: Promise.resolve(), page1: Promise.resolve(), page2: Promise.resolve() };
  retry.click();
  await settle(80);
  assert.match(drill().textContent, /Your Spotify/, 'the retry reads the library');
});
