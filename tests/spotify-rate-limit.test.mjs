// The crew playlist's top songs (v103 — Kevin, 2026-09-26: "the playlist for
// everyone only has my likes for artists, not top songs for all artists folks
// have tagged"). A search per artist, back to back, drew Spotify's 429s; the
// old loop could not read Retry-After cross-origin, gave up, and quietly kept
// only the maker's saved tracks — and recorded those artists as done, so no
// top-up ever tried them again. Held here against a fake Spotify:
//   · a 429 then a 200 → the artist gets its top songs, after the wait asked;
//   · a 429 with no Retry-After we can read → a 1-2-4-8 s backoff;
//   · a persistent 429, or one that asks for hours → the run stops asking,
//     never sleeps through it, and COUNTS the artists left without top songs;
//   · a 5xx → one retry; three failures in a row → the run stops asking;
//   · searches are paced, and the limit is Spotify's dev-mode max;
//   · the unsearched stay off the crew ledger, so "Add new picks" tries them again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.sessionStorage = { ...globalThis.localStorage };
globalThis.location = { origin: 'https://fest.kevinhg.com', host: 'fest.kevinhg.com', hostname: 'fest.kevinhg.com', hash: '' };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
console.warn = () => {}; // the module's forensics; the assertions say what matters

const spotify = await import('../js/spotify.js');

// ---- a fake Spotify ---------------------------------------------------------------
// `plan[artist]` is the list of answers that artist's searches get, in order
// (the last one repeats): a number is a status (429 with `retry` seconds when
// given, 5xx), 'net' is a dropped connection, 'ok' is a real answer.
let plan = {};
let calls = [];
let waits = [];
let playlistItems = [];
let createFails = [];
let addFails = [];
let created = 0;
const asked = new Map();
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const tracksOf = (artist, n = 9) => ({ tracks: { items: Array.from({ length: n }, (_, i) => ({ uri: `spotify:track:${artist.replace(/\W/g, '')}${i}`, artists: [{ name: artist }] })) } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const path = u.pathname.replace('/v1', '');
  calls.push(`${opts.method || 'GET'} ${path}${u.search}`);
  if (path === '/search') {
    const artist = /artist:"(.*)"/.exec(u.searchParams.get('q'))[1];
    const list = plan[artist] || ['ok'];
    const n = (asked.get(artist) || 0) + 1; // this artist's n-th search
    asked.set(artist, n);
    const step = list[Math.min(n - 1, list.length - 1)];
    if (step === 'net') throw new TypeError('Failed to fetch');
    if (step === 'ok') return json(tracksOf(artist));
    if (step === 'none') return json({ tracks: { items: [] } }); // answered: Spotify has nothing for them
    if (typeof step === 'object') return json({}, step.status, step.retry != null ? { 'Retry-After': String(step.retry) } : {});
    return json({}, step);
  }
  if (path === '/me/playlists' && opts.method === 'POST') {
    created += 1;
    // `createFails` / `addFails`: the next such write's answer — { status, did }
    // where `did` says whether Spotify performed it anyway (a 502 after the work).
    const f = createFails.shift();
    if (f && !f.did) return json({}, f.status);
    if (f) return json({ error: { status: f.status } }, f.status);
    return json({ id: 'pl123', external_urls: { spotify: 'https://open.spotify.com/playlist/pl123' } }, 201);
  }
  if (path.startsWith('/playlists/pl123/items')) {
    if (opts.method === 'POST') {
      const f = addFails.shift() || null;
      if (!f || f.did) playlistItems.push(...JSON.parse(opts.body).uris);
      if (f) return json({}, f.status, f.retry != null ? { 'Retry-After': String(f.retry) } : {});
      return json({ snapshot_id: 's' }, 201);
    }
    return json({ items: playlistItems.map((uri) => ({ track: { uri } })), next: null });
  }
  return json({ error: 'not in this test' }, 404);
};
spotify.setPauseForTests(async (ms) => { waits.push(ms); });
const reset = (p = {}) => { plan = p; calls = []; waits = []; playlistItems = []; createFails = []; addFails = []; created = 0; asked.clear(); };
localStorage.setItem('fn_spotify_auth_v1', JSON.stringify({ clientId: 'c'.repeat(32), access_token: 'at', refresh_token: 'rt', expires_at: Date.now() + 3600e3 }));
// The maker's saved tracks for one artist (the scan cache).
localStorage.setItem('fn_spotify_libmap_v1', JSON.stringify({
  clientId: 'c'.repeat(32), userId: 'kev', fetchedAt: '2026-09-26T00:00:00Z', artists: { robyn: { songs: 3 } },
  trackUris: { robyn: ['spotify:track:mineRobyn1', 'spotify:track:mineRobyn2'] },
}));
const searches = () => calls.filter((c) => c.startsWith('GET /search'));
const bigWaits = () => waits.filter((w) => w > 400); // the backoffs, not the pacing

test('a 429 then a 200: the wait Spotify asked for, then the artist\'s top songs — nothing left unsearched', async () => {
  reset({ Soulwax: [{ status: 429, retry: 3 }, 'ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax'], collaborative: true });
  assert.deepEqual(bigWaits(), [3000], 'Retry-After: 3 → three seconds');
  assert.equal(searches().length, 2);
  assert.deepEqual(made.found, ['Soulwax']);
  assert.deepEqual(made.unsearched, []);
  assert.equal(made.trackCount, 3, 'its top three');
});

test('a 429 whose Retry-After cannot be read (cross-origin) backs off 1 s, 2 s … and gets there', async () => {
  reset({ Soulwax: [{ status: 429 }, { status: 429 }, 'ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax'] });
  assert.deepEqual(bigWaits(), [1000, 2000]);
  assert.deepEqual(made.found, ['Soulwax']);
});

test('a persistent 429: four waits and the run stops asking — the rest are counted, their saved tracks still go in, and they stay off the ledger', async () => {
  reset({ Soulwax: [{ status: 429, retry: 2 }], Robyn: ['ok'], Prospa: ['ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax', 'Robyn', 'Prospa'], collaborative: true });
  assert.deepEqual(bigWaits(), [2000, 2000, 2000, 2000], 'four waits, then no more');
  assert.equal(searches().length, 5, 'five tries for Soulwax, none for the two after it');
  assert.deepEqual(made.unsearched, ['Soulwax', 'Robyn', 'Prospa'], 'all three are counted');
  assert.deepEqual(made.found, [], 'none of them recorded as done');
  assert.deepEqual(playlistItems, ['spotify:track:mineRobyn1', 'spotify:track:mineRobyn2'], 'your saved Robyn tracks still made it');
  assert.equal(spotify.unsearchedNote(made.unsearched), '3 artists had no songs found — try again later.');
  // "Add new picks" diffs the ledger: every one of them is still missing, so it tries again.
  assert.deepEqual(spotify.playlistMissingArtists(['Soulwax', 'Robyn', 'Prospa'], { artists: made.found }), ['Soulwax', 'Robyn', 'Prospa']);
});

test('a Retry-After of hours is never slept through: no wait at all, the run stops, and says so', async () => {
  reset({ Soulwax: [{ status: 429, retry: 21 * 3600 }] });
  await assert.rejects(
    spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax', 'Prospa'] }),
    /slow down — try again in a few minutes/,
    'no saved tracks either: no empty playlist, and a sentence about Spotify, not the lineup',
  );
  assert.deepEqual(bigWaits(), []);
  assert.equal(searches().length, 1);
  assert.equal(calls.filter((c) => c.startsWith('POST /me/playlists')).length, 0, 'no playlist made');
});

test('a 5xx is retried once; twice in a row leaves that artist unsearched and the run goes on', async () => {
  reset({ Soulwax: [503, 'ok'], Prospa: [502, 502], Robyn: ['ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax', 'Prospa', 'Robyn'] });
  assert.deepEqual(made.found, ['Soulwax', 'Robyn']);
  assert.deepEqual(made.unsearched, ['Prospa']);
  assert.deepEqual(bigWaits(), [1000, 1000], 'one second before each retry');
});

test('three failures in a row that are not "busy" (no connection) stop the run asking', async () => {
  reset({ A: ['net'], B: ['net'], C: ['net'], D: ['ok'], Robyn: ['ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['A', 'B', 'C', 'D', 'Robyn'] });
  assert.equal(searches().length, 3, 'D and Robyn are not searched');
  assert.deepEqual(made.unsearched, ['A', 'B', 'C', 'D', 'Robyn']);
  assert.equal(made.trackCount, 2, 'your saved Robyn tracks');
});

test('searches are paced, one at a time, and ask for no more than Spotify\'s dev-mode limit of 10', async () => {
  reset({});
  await spotify.playlistFromPicks({ title: 'T', artistNames: ['A', 'B', 'C', 'D'], tracksPerArtist: 5 });
  const gaps = waits.filter((w) => w <= 400);
  assert.equal(gaps.length, 3, 'a gap before every search but the first');
  assert.ok(gaps.every((w) => w > 0 && w <= 250), `about a quarter second apart: ${gaps}`);
  assert.ok(searches().every((c) => /[?&]limit=10(&|$)/.test(c)), `limit clamped to 10: ${searches()[0]}`);
});

test('the crew top-up: artists already in the playlist are deduped by track, and an unsearched artist comes back in the result to be tried again', async () => {
  reset({ Soulwax: ['ok'], Prospa: [{ status: 429, retry: 99999 }] });
  playlistItems = ['spotify:track:Soulwax0'];
  const r = await spotify.addArtistsToPlaylist({ playlistId: 'pl123', artistNames: ['Soulwax', 'Prospa'] });
  assert.equal(r.added, 2, 'Soulwax 1 and 2 — its 0 was already there');
  assert.deepEqual(r.found, ['Soulwax']);
  assert.deepEqual(r.unsearched, ['Prospa']);
  assert.equal(spotify.unsearchedNote(r.unsearched, { again: 'try Add new picks again' }), '1 artist had no songs found — try Add new picks again later.');
});

test('Retry-After reads seconds or a date, and nothing when the browser hides it', () => {
  const res = (v) => ({ headers: { get: (k) => (k === 'Retry-After' ? v : null) } });
  assert.equal(spotify.retryAfterMs(res('5')), 5000);
  assert.equal(spotify.retryAfterMs(res('0')), 0);
  assert.equal(spotify.retryAfterMs(res(null)), null);
  assert.equal(spotify.retryAfterMs(res('')), null);
  const now = Date.parse('2026-09-26T12:00:00Z');
  assert.equal(spotify.retryAfterMs(res('Sat, 26 Sep 2026 12:00:30 GMT'), now), 30000);
  assert.equal(spotify.retryAfterMs({ headers: { get: () => { throw new Error('no'); } } }), null);
});

// ---- Sol's review of bfcf621: a write is never repeated blind, and "done" means top songs --------
const adds = () => calls.filter((c) => c.startsWith('POST /playlists/pl123/items'));
const reads = () => calls.filter((c) => c.startsWith('GET /playlists/pl123/items'));

test('a create Spotify answered with a 5xx is NOT repeated — it may have made the playlist — and the words say to check', async () => {
  reset({ Soulwax: ['ok'] });
  createFails = [{ status: 502, did: true }];
  await assert.rejects(
    spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax'] }),
    /didn’t confirm the playlist — check your Spotify before making another/,
  );
  assert.equal(created, 1, 'one create, never two');
  assert.equal(adds().length, 0);
});

// Round 3 cut the read-back: a 5xx on an add is never repeated in any form.
test('an add Spotify answered with a 5xx is never repeated — no second add, no read back — and the run says which artists are confirmed', async () => {
  reset({ Soulwax: ['ok'] });
  addFails = [{ status: 502, did: true }];
  await assert.rejects(spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax'] }), (e) => {
    assert.deepEqual(e.playlist, { id: 'pl123', url: 'https://open.spotify.com/playlist/pl123' });
    assert.deepEqual(e.confirmed, [], 'the one add was not confirmed');
    assert.match(e.message, /made the playlist but didn’t confirm every song/);
    return true;
  });
  assert.equal(adds().length, 1, 'one add, never two');
  assert.equal(reads().length, 0, 'and no read back');
  assert.equal(created, 1);
});

test('a long playlist whose second batch fails: the artists whose songs all landed in the first hundred are the confirmed ones', async () => {
  const fifty = Array.from({ length: 50 }, (_, i) => `Artist ${String(i).padStart(2, '0')}`);
  reset(Object.fromEntries(fifty.map((n) => [n, ['ok']])));
  // 3 top songs each = 150 tracks: the first add (100) lands, the second fails.
  addFails = [null, { status: 503, did: false }];
  await assert.rejects(spotify.playlistFromPicks({ title: 'T', artistNames: fifty, tracksPerArtist: 3 }), (e) => {
    assert.deepEqual(e.confirmed, fifty.slice(0, 33), 'the first 33 artists (99 songs) are whole in the first batch; the 34th is split');
    return true;
  });
  assert.equal(adds().length, 2);
  assert.equal(playlistItems.length, 100);
});

test('a 429 on an add is a refusal (nothing was done): it waits and sends it again, and nothing is doubled', async () => {
  reset({ Soulwax: ['ok'] });
  addFails = [{ status: 429, did: false, retry: 2 }];
  await spotify.playlistFromPicks({ title: 'T', artistNames: ['Soulwax'] });
  assert.deepEqual(bigWaits(), [2000]);
  assert.equal(playlistItems.length, 3);
  assert.equal(reads().length, 0, 'no read back needed for a refusal');
});

test('a search that answered with NO top songs is not "done": your saved tracks go in, but the artist stays off the ledger and is counted', async () => {
  reset({ Robyn: ['none'], Soulwax: ['ok'] });
  const made = await spotify.playlistFromPicks({ title: 'T', artistNames: ['Robyn', 'Soulwax'], collaborative: true });
  assert.deepEqual(made.found, ['Soulwax'], 'only the artist whose top songs came');
  assert.deepEqual(made.topless, ['Robyn']);
  assert.deepEqual(made.unsearched, []);
  assert.ok(playlistItems.includes('spotify:track:mineRobyn1'), 'your saved Robyn tracks are in');
  assert.equal(spotify.toplessNote(made.topless), '1 artist had no top songs on Spotify.');
  assert.deepEqual(spotify.playlistMissingArtists(['Robyn', 'Soulwax'], { artists: made.found }), ['Robyn'], 'so Add new picks looks again');
});

test('the top-up carries the artists with no top songs, saved tracks or not', async () => {
  reset({ Robyn: ['none'], Prospa: ['none'] });
  const r = await spotify.addArtistsToPlaylist({ playlistId: 'pl123', artistNames: ['Robyn', 'Prospa'] });
  assert.deepEqual(r.found, []);
  assert.deepEqual(r.topless, ['Robyn', 'Prospa']);
  assert.equal(r.added, 2, 'your two saved Robyn tracks');
  reset({ Prospa: ['none'] });
  const r2 = await spotify.addArtistsToPlaylist({ playlistId: 'pl123', artistNames: ['Prospa'] });
  assert.deepEqual(r2, { added: 0, misses: 1, found: [], unsearched: [], topless: ['Prospa'] }, 'nothing to add, and it says who');
});
