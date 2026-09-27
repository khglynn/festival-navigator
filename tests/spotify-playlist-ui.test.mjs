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
const topless = new Set(); // artists Spotify answers for with no top songs
let createId = 'crewpl';
let creates = 0;
let addDown = false; // adds (and reads of the playlist) answer 5xx
let midRun = null; // whether a crew record of the new playlist exists mid-run
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
      if (topless.has(artist)) return json({ tracks: { items: [] } }); // answered: no top songs for them
      return json({ tracks: { items: [0, 1, 2].map((i) => ({ uri: `spotify:track:${artist.replace(/\W/g, '')}${i}`, artists: [{ name: artist }] })) } });
    }
    if (path === '/me/playlists') {
      creates += 1;
      if (midRun) midRun.push((state.spotifyPlaylistFor('ui-fest') || {}).id === createId);
      return json({ id: createId, external_urls: { spotify: `https://open.spotify.com/playlist/${createId}` } }, 201);
    }
    if (path.startsWith(`/playlists/${createId}/items`)) {
      if (opts.method === 'POST') {
        if (midRun && midRun.length === 1) midRun.push((state.spotifyPlaylistFor('ui-fest') || {}).id === createId);
        if (addDown) return json({}, 502); // Spotify did NOT add them, and says so badly
        items.push(...JSON.parse(opts.body).uris);
        return json({ snapshot_id: 's' }, 201);
      }
      if (addDown) return json({}, 503); // …and so does reading it
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

// Sol's review of v103: an artist Spotify answered for with NO top songs is
// not done — not on the ledger, counted in the words, and never "already has
// everyone's picks" while one is missing. Galen is picked; Spotify has nothing.
const addPick = (name, by) => {
  ctx.picks = { ...ctx.picks, [name]: { [by]: 2 } };
  state.crewDoc.festivals['ui-fest'].selections[name] = { [by]: 2 };
  if (!FESTIVALS['ui-fest'].artists.some((a) => a.name === name)) FESTIVALS['ui-fest'].artists.push({ name });
};
test('Add new picks with an artist Spotify has no top songs for: it says so, keeps it off the ledger, and never says "already has everyone’s picks"', async () => {
  busy = false;
  searched = [];
  topless.add('Galen');
  addPick('Galen', 'Ross');
  await open();
  button('Add new picks').click();
  await until(() => /top songs/.test(drill().textContent), 'the note');
  assert.match(drill().textContent, /1 artist had no top songs on Spotify — Add new picks looks again\./);
  assert.ok(!/already has everyone/.test(drill().textContent));
  assert.ok(!state.spotifyPlaylistFor('ui-fest').artists.includes('Galen'), 'Galen is not done');
  // Again, nothing new: the same words, still never "already has everyone's picks".
  await open();
  button('Add new picks').click();
  await until(() => /top songs/.test(drill().textContent) && !button('Add new picks').disabled, 'the second note');
  assert.ok(!/already has everyone/.test(drill().textContent), 'a second press says it again');
});

test('Make a new one (Everyone) with that artist and your saved tracks of theirs: the saved tracks go in, the artist stays off the ledger, and it is said', async () => {
  searched = [];
  items = [];
  localStorage.setItem('fn_spotify_libmap_v1', JSON.stringify({ clientId: CID, userId: 'kev', fetchedAt: '2026-09-26T00:00:00Z', artists: { galen: { songs: 1 } }, trackUris: { galen: ['spotify:track:kevGalen'] } }));
  await open();
  [...drill().querySelectorAll('button')].find((b) => b.textContent === 'Everyone').click();
  make().click();
  await until(() => /✓/.test(drill().textContent), 'the playlist');
  assert.match(drill().textContent, /1 artist had no top songs on Spotify — Add new picks looks again\./);
  assert.ok(items.includes('spotify:track:kevGalen'), 'your saved Galen track is in');
  assert.ok(!state.spotifyPlaylistFor('ui-fest').artists.includes('Galen'), 'and Galen is still not done');
});

// Sol's round 3 on v103, the mechanism cut: no crew record exists while a
// Make runs; it is recorded ONCE, at the end, and the open drill is redrawn
// then. Spotify makes the playlist but its adds fail: the record carries the
// artists confirmed so far (none here), the words say so, and the button in
// front of you — the SAME open drill, never reopened — is Add new picks, which
// fills that playlist. One create in all.
test('Make where the create works but the adds fail: recorded once at the end, and the open drill offers Add new picks, which fills it — one create', async () => {
  topless.clear();
  searched = [];
  items = [];
  creates = 0;
  createId = 'crewPlaylist02AB';
  addDown = true;
  midRun = [];
  await open();
  [...drill().querySelectorAll('button')].find((b) => b.textContent === 'Everyone').click();
  make().click();
  await until(() => /didn’t confirm every song/.test(drill().textContent) && !button('Add new picks')?.disabled, 'the words and the redrawn drill');
  assert.match(drill().textContent, /Spotify made the playlist but didn’t confirm every song — Add new picks finishes it\./);
  assert.ok(button('Add new picks'), 'the open drill now offers Add new picks');
  assert.equal(button('Make playlist'), undefined, 'and never Make playlist');
  assert.ok([...drill().querySelectorAll('a')].some((a) => a.href === 'https://open.spotify.com/playlist/crewPlaylist02AB'), 'it is linked');
  const rec = state.spotifyPlaylistFor('ui-fest');
  assert.equal(rec.id, 'crewPlaylist02AB');
  assert.deepEqual(rec.artists, [], 'no artist confirmed yet');
  assert.deepEqual(midRun, [false, false], 'no crew record of it while the run was going (at the create, at the add)');
  // Spotify answers again: the visible Add new picks, in the same drill.
  addDown = false;
  button('Add new picks').click();
  await until(() => /Added/.test(drill().textContent), 'the top-up');
  assert.ok(items.length > 0, 'the songs went into that playlist');
  assert.equal(creates, 1, 'never a second create');
  assert.ok(state.spotifyPlaylistFor('ui-fest').artists.length > 0);
});
