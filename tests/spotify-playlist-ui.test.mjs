// The crew playlist says what it could not do (v103). Kevin: "the playlist for
// everyone only has my likes for artists, not top songs for all artists folks
// have tagged." In the real Spotify drill, against a fake Spotify that stops
// answering after the first artist (a 429 asking for hours):
//   · Make playlist says how many artists got no songs, and what to press;
//   · only the artist that really got its top songs goes on the crew ledger;
//   · Add new picks, once Spotify answers again, tries exactly the others and
//     says what it added — the "same for the crew top-up" of the brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootShell, settle } from './helpers/shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
const TOKEN = 'spotifyplaylistui_0123456'; // a made-up crew, never a real link
const CID = 'c'.repeat(32);
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

let busy = true; // Spotify answers the first search, then asks for hours
let hold = null; // a search held until the test lets it answer (a slow run)
let searched = [];
let items = [];
async function network(url, opts = {}) {
  const u = String(url);
  if (u === '/data/festivals/index.json') return json(INDEX);
  if (u.startsWith('https://api.spotify.com/v1/')) {
    const x = new URL(u);
    const path = x.pathname.replace('/v1', '');
    if (path === '/search') {
      const artist = /artist:"(.*)"/.exec(x.searchParams.get('q'))[1];
      searched.push(artist);
      if (hold) await hold.promise;
      if (busy && searched.length > 1) return json({}, 429, { 'Retry-After': String(21 * 3600) });
      return json({ tracks: { items: [0, 1, 2].map((i) => ({ uri: `spotify:track:${artist.replace(/\W/g, '')}${i}`, artists: [{ name: artist }] })) } });
    }
    if (path === '/me/playlists') return json({ id: 'crewpl', external_urls: { spotify: 'https://open.spotify.com/playlist/crewpl' } }, 201);
    if (path.startsWith('/playlists/crewpl/items')) {
      if (opts.method === 'POST') { items.push(...JSON.parse(opts.body).uris); return json({ snapshot_id: 's' }, 201); }
      return json({ items: items.map((uri) => ({ track: { uri } })), next: null });
    }
  }
  if (u === '/api/access?config=1') return json({ enabled: false, ownerClientId: '' });
  return json({ error: 'not in this test' }, 503);
}

const shell = await bootShell({ fetch: network }); // no crew: boot lands on the landing
await settle(60);
test.after(() => shell.close());
const { $ } = shell;
const state = await import('../js/state.js'); // the SAME instances app.js holds
const spotify = await import('../js/spotify.js');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');
const { openSubviewByKey } = await import('../js/v3/settings.js');
spotify.setPauseForTests(async () => {}); // the waits are the unit tests'; this is the words
console.warn = () => {};

FESTIVALS['ui-fest'] = { id: 'ui-fest', name: 'UI Fest', status: 'lineup', artists: [{ name: 'Soulwax' }, { name: 'Prospa' }, { name: 'Robyn' }] };
FESTIVAL_INDEX.push({ id: 'ui-fest', status: 'lineup' });
localStorage.setItem('fn_spotify_auth_v1', JSON.stringify({ clientId: CID, access_token: 'at', refresh_token: 'rt', expires_at: Date.now() + 3600e3 }));
localStorage.setItem('fn_spotify_libmap_v1', JSON.stringify({ clientId: CID, userId: 'kev', fetchedAt: '2026-09-26T00:00:00Z', artists: {}, trackUris: {} }));
state.activateCrew(TOKEN, {
  v: 4, meta: {}, spotify: { clientId: CID }, people: { Kev: { colorIndex: 0 }, Ross: { colorIndex: 5 } },
  festivals: { 'ui-fest': { selections: { Soulwax: { Kev: 4 }, Prospa: { Ross: 3 }, Robyn: { Ross: 2 } } } }, affinity: {},
}, 'ui-fest');
state.setActiveFestivalId('ui-fest');
const ctx = { meName: 'Kev', fid: 'ui-fest', picks: { Soulwax: { Kev: 4 }, Prospa: { Ross: 3 }, Robyn: { Ross: 2 } } };
const actions = { afterBulk() {}, rerender() {}, close() {} };
// The drill re-renders once when the owner-app config lands (the first open
// after boot asks /api/access); a status line written before that is on the
// card it replaced. Open, then let it land.
const open = async () => {
  const host = document.createElement('div');
  host.id = 'settings-subview';
  $('settings-root').replaceChildren(host);
  openSubviewByKey('sub:spotify', ctx, actions);
  await settle(100);
};
const drill = () => $('settings-subview');
const button = (text) => [...drill().querySelectorAll('button')].find((b) => b.textContent === text);
async function until(check, what, ms = 3000) {
  for (let t = 0; !check(); t += 10) {
    if (t > ms) assert.fail(`still waiting for ${what}: ${drill().textContent.slice(-300)}`);
    await settle(10);
  }
}

test('Make playlist, with Spotify busy after the first artist: it says how many got no songs, and only the one that did is on the ledger', async () => {
  await open();
  button('Make playlist').click();
  await until(() => /✓/.test(drill().textContent), 'the playlist');
  assert.match(drill().textContent, /3 tracks\. 2 artists had no songs found — try Add new picks again later\./);
  assert.deepEqual(state.spotifyPlaylistFor('ui-fest').artists, ['Soulwax'], 'Prospa and Robyn are not recorded as done');
  assert.deepEqual(searched, ['Soulwax', 'Prospa'], 'one try for Prospa, and the run stopped asking — no hours slept');
});

test('Add new picks, once Spotify answers again, tries exactly the two it missed and says what it added', async () => {
  busy = false;
  searched = [];
  await open();
  button('Add new picks').click();
  await until(() => /Added/.test(drill().textContent), 'the top-up');
  assert.deepEqual(searched, ['Prospa', 'Robyn']);
  assert.match(drill().textContent, /Added 6 tracks to the crew playlist\./);
  assert.ok(!/no songs found/.test(drill().textContent), 'nothing left to say about them');
  assert.deepEqual(state.spotifyPlaylistFor('ui-fest').artists, ['Soulwax', 'Prospa', 'Robyn']);
});

test('the top-up says it too when Spotify is busy again', async () => {
  // A new pick, and Spotify back to asking for hours from the first search.
  ctx.picks = { ...ctx.picks, 'Dog Blood': { Kev: 2 } };
  state.crewDoc.festivals['ui-fest'].selections['Dog Blood'] = { Kev: 2 };
  FESTIVALS['ui-fest'].artists.push({ name: 'Dog Blood' });
  busy = true;
  searched = ['x']; // every search from here is the "second" — busy at once
  await open();
  button('Add new picks').click();
  await until(() => /no songs found/.test(drill().textContent), 'the note');
  assert.match(drill().textContent, /1 artist had no songs found — try Add new picks again later\./);
  assert.ok(!/already has everyone/.test(drill().textContent), 'never "already has everyone’s picks" when one is missing');
});

// The crew has a playlist by now, so the button reads "Make a new one".
const make = () => drill().querySelector('button.btn-tonal[data-pl-run]');
test('the drill re-rendered under a running playlist (a friend’s pick on the poll): the new card catches up, keeps Make down, and gets the closing line', async () => {
  busy = false;
  searched = [];
  let release;
  hold = { promise: new Promise((r) => { release = r; }) };
  await open();
  // Just mine: a playlist of your own, which the ledger never records.
  [...drill().querySelectorAll('button')].find((b) => b.textContent === 'Just mine').click();
  make().click();
  await settle(20);
  assert.match(drill().textContent, /Finding tracks 1\/\d+ — Soulwax/);
  await open(); // the re-render
  assert.match(drill().textContent, /Finding tracks 1\/\d+ — Soulwax/, 'the new card says where the run is');
  assert.equal(make().disabled, true, 'and does not offer a second run over the first');
  hold = null;
  release();
  await until(() => /✓/.test(drill().textContent), 'the closing line');
  assert.match(drill().textContent, /✓ “.*” — \d+ tracks\./);
  assert.equal(make().disabled, false);
});
