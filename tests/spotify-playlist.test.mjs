// The crew-shared playlist: create once (collaborative), everyone who
// connects later joins in — and the crew doc's artist ledger is what makes
// the top-up append-only instead of duplicating tracks. Plus the
// spotifyStats write the 07-12 rebuild dropped (verified missing on a live
// crew doc 2026-07-13).
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

const state = await import('../js/state.js');
const spotify = await import('../js/spotify.js');
const { validateIncoming } = await import('../api/_lib/crew-shared.mjs');
const { FESTIVALS, FESTIVAL_INDEX } = await import('../js/festivals.js');

// activateCrew resolves a default festival from the index — give it one.
FESTIVALS['pl-test'] = { id: 'pl-test', name: 'PL Test', status: 'lineup', artists: [] };
FESTIVAL_INDEX.push({ id: 'pl-test', status: 'lineup' });

const PLAYLIST = {
  id: 'abc123DEF456ghi', url: 'https://open.spotify.com/playlist/abc123DEF456ghi',
  mode: 'everyone', by: 'Kevin', at: '2026-07-13T20:00:00Z', artists: ['GRiZ', 'Lane 8'],
};

test('playlistMissingArtists: case-insensitive diff against the ledger', () => {
  const picked = ['GRiZ', 'lane 8', 'Excision', 'Stranger'];
  assert.deepEqual(spotify.playlistMissingArtists(picked, PLAYLIST), ['Excision', 'Stranger']);
  // No ledger yet = everything is missing; empty picks = nothing to add.
  assert.deepEqual(spotify.playlistMissingArtists(picked, { artists: [] }), picked);
  assert.deepEqual(spotify.playlistMissingArtists([], PLAYLIST), []);
});

test('validator: crew playlist meta round-trips; hostile shapes bounce', () => {
  assert.equal(validateIncoming({ spotify: { playlists: { 'electric-forest-2026': PLAYLIST } } }).ok, true);
  const bad = (patch) => validateIncoming({
    spotify: { playlists: { 'electric-forest-2026': { ...PLAYLIST, ...patch } } },
  }).ok;
  assert.equal(bad({ url: 'https://evil.com/playlist/x' }), false, 'non-Spotify url');
  assert.equal(bad({ mode: 'public' }), false, 'unknown mode');
  assert.equal(bad({ artists: Array.from({ length: 501 }, (_, i) => `a${i}`) }), false, 'ledger cap');
  assert.equal(bad({ sneaky: true }), false, 'unknown key');
  assert.equal(validateIncoming({ spotify: { playlists: { 'electric-forest-2026': { mode: 'everyone' } } } }).ok,
    false, 'id + url required');
  // clientId still validates alongside playlists (the old shape keeps working)
  assert.equal(validateIncoming({ spotify: { clientId: 'a'.repeat(32) } }).ok, true);
});

test('recordSpotifyStats writes the doc AND the pending push (the dropped write)', () => {
  store.clear();
  state.activateCrew('sptoken_stats_0123456789', {
    v: 4, meta: {}, spotify: {}, people: { Kev: { colorIndex: 0 } }, festivals: {}, affinity: {},
  });
  const stats = { likedCount: 11423, artistCount: 6180, lastSynced: '2026-07-13T19:00:00Z', user: 'kevglynn.sf' };
  state.recordSpotifyStats('Kev', stats);
  assert.deepEqual(state.crewDoc.spotifyStats.Kev, stats, 'local doc renders immediately');
  assert.equal(state.hasPending(), true, 'and it is queued for the crew');
  assert.equal(validateIncoming({ spotifyStats: { Kev: stats } }).ok, true, 'and the server will take it');
});

test('recordSpotifyPlaylist: doc + pending + lookup', () => {
  store.clear();
  state.activateCrew('sptoken_pl_012345678901', {
    v: 4, meta: {}, spotify: {}, people: { Kev: { colorIndex: 0 } }, festivals: {}, affinity: {},
  });
  state.recordSpotifyPlaylist('electric-forest-2026', PLAYLIST);
  assert.deepEqual(state.spotifyPlaylistFor('electric-forest-2026'), PLAYLIST);
  assert.equal(state.spotifyPlaylistFor('portola-2026'), null);
  assert.equal(state.hasPending(), true);
  assert.equal(validateIncoming({ spotify: { playlists: { 'electric-forest-2026': PLAYLIST } } }).ok, true);
});

test('ensureFestivalState queues the membership for sync (ghost-festival fix)', () => {
  store.clear();
  state.activateCrew('sptoken_fest_012345678', {
    v: 4, meta: {}, spotify: {}, people: { Kev: { colorIndex: 0 } },
    festivals: { 'pl-test': { selections: {} } }, affinity: {},
  });
  assert.equal(state.hasPending(), false, 'clean start');
  state.ensureFestivalState('lollapalooza-2025');
  assert.ok(state.crewDoc.festivals['lollapalooza-2025'], 'local render immediately');
  assert.equal(state.hasPending(), true, 'AND the crew will hear about it');
  assert.equal(validateIncoming({ festivals: { 'lollapalooza-2025': { selections: {} } } }).ok,
    true, 'and the server validator takes the empty-fest delta');
  // Re-ensuring an existing fest queues nothing new (no sync churn).
  const seqBefore = state.hasPending();
  state.ensureFestivalState('lollapalooza-2025');
  assert.equal(state.hasPending(), seqBefore);
});

test('likedUrisOf reads the fest-artist track cache; playlist union prefers likes', () => {
  store.clear();
  localStorage.setItem('fn_spotify_libmap_v1', JSON.stringify({
    clientId: 'x'.repeat(32), userId: 'kev', fetchedAt: '2026-07-13T00:00:00Z',
    artists: { 'big sis': { songs: 15, followed: true } },
    trackUris: { 'big sis': ['spotify:track:aaa', 'spotify:track:bbb'] },
  }));
  assert.deepEqual(spotify.likedUrisOf('Big Sis'), ['spotify:track:aaa', 'spotify:track:bbb']);
  assert.deepEqual(spotify.likedUrisOf('Unknown'), []);
});
