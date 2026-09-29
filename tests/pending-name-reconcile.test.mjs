// One person, one key (LEDGER follow-up 13, 2026-09-26). A name this phone
// added while it could not hear the crew — the Invite sheet's offline add, an
// offline join, Stay offline — is spelled the way this phone knew it. If the
// crew meanwhile holds that person under another capitalisation ("Drew" while
// this phone queued "drew"), the server refuses the doc (names are unique
// case-insensitively, api/_lib/crew-sql.mjs), and before this the phone's
// whole sync sat BLOCKED behind it. Now the pending add reconciles to the
// server's key: on any doc the phone applies (a poll, a push's answer), and,
// when the push itself is what finds out, by reading the crew once and going
// again. The shell-level acceptance is tests/offline-add-casing.test.mjs.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="sync-label"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });

// A poll with work pending arms the 1.2 s push debounce; held still here, so
// no push leaves except the ones a test awaits (none fires into the next case).
mock.timers.enable({ apis: ['setTimeout'] });

const state = await import('../js/state.js');
const sync = await import('../js/sync.js');
const crew = await import('../js/crew.js');
const { FESTIVAL_INDEX } = await import('../js/festivals.js');
const FID = 'casing-fest';
FESTIVAL_INDEX.push({ id: FID, status: 'scheduled' });

const mkRes = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => 'application/json' },
  json: async () => JSON.parse(JSON.stringify(body)),
});
const doc = (people, selections = {}) => ({
  v: 4, meta: {}, spotify: {}, people, festivals: { [FID]: { selections } }, affinity: {},
});

// What this phone last heard: K alone. Drew joins on another phone later.
function freshCrew(token) {
  state.activateCrew(token, doc({ K: { colorIndex: 0 } }));
  state.setActiveFestivalId(FID);
  state.ensureFestivalState(FID);
  state.clearPending();
}
const onDisk = (token) => JSON.parse(store.get(state.LS.pending(token)) || '{}');
const anyDrewLower = (o) => JSON.stringify(o).includes('"drew"');

// A server that merges like the real one enough for this: people and picks,
// and the case-insensitive refusal (its words, api/crew.js).
function server(initial) {
  let S = JSON.parse(JSON.stringify(initial));
  const log = { gets: 0, posts: [] };
  globalThis.fetch = async (_url, opts = {}) => {
    if ((opts.method || 'GET') === 'GET') { log.gets++; return mkRes(200, S); }
    const data = JSON.parse(opts.body).data || {};
    log.posts.push(data);
    const names = Object.entries(S.people).filter(([, p]) => !p.removed).map(([n]) => n);
    for (const [n, p] of Object.entries(data.people || {})) {
      if (!p.removed && names.some((m) => m !== n && m.toLowerCase() === n.toLowerCase())) {
        return mkRes(400, { error: 'Someone in the crew already has that name — pick one that differs by more than capitalization' });
      }
    }
    S = JSON.parse(JSON.stringify({
      ...S,
      people: { ...S.people, ...(data.people || {}) },
      festivals: { [FID]: { selections: mergePicks(S.festivals[FID].selections, ((data.festivals || {})[FID] || {}).selections || {}) } },
    }));
    return mkRes(200, S);
  };
  return { log, doc: () => S };
}
function mergePicks(a, b) {
  const out = JSON.parse(JSON.stringify(a));
  for (const [artist, who] of Object.entries(b)) out[artist] = { ...(out[artist] || {}), ...who };
  return out;
}

test('what counts: an active pending name the server holds, active, spelled otherwise — nothing else', () => {
  const remote = { Drew: { colorIndex: 1 }, Sam: { removed: true }, Ana: { colorIndex: 2 } };
  assert.deepEqual(state.namesToReconcile({ people: { drew: { colorIndex: 4 } } }, remote), { drew: 'Drew' });
  assert.deepEqual(state.namesToReconcile({ people: { DREW: {} } }, remote), { DREW: 'Drew' }, 'an empty entry still adds them');
  assert.deepEqual(state.namesToReconcile({ people: { Drew: { colorIndex: 4 } } }, remote), {}, 'the same key is not a rename');
  assert.deepEqual(state.namesToReconcile({ people: { drew: { removed: true } } }, remote), {}, 'a tombstone never collides — the server allows it');
  assert.deepEqual(state.namesToReconcile({ people: { sam: { colorIndex: 3 } } }, remote), {}, 'a REMOVED server person is not the crew’s key');
  assert.deepEqual(state.namesToReconcile({ people: { Mo: {} } }, remote), {}, 'a new name is a new person');
  assert.deepEqual(state.namesToReconcile({ festivals: {} }, remote), {});
  assert.deepEqual(state.namesToReconcile({ people: { drew: {} } }, null), {}, 'no server doc, nothing to say');
});

test('the rename moves their picks, affinity and Spotify stats onto the server’s key, drops the add, and leaves notes alone', () => {
  const note = { author: 'drew', ts: 1, text: 'see you there' };
  const pending = {
    people: { drew: { colorIndex: 4 }, Mo: { colorIndex: 5 } },
    festivals: {
      [FID]: {
        selections: { GRiZ: { drew: 3 }, Robyn: { drew: 1, Drew: 4 }, Lane: { K: 2 } },
        notes: { artist: { GRiZ: { 'drew.abc': note } } },
      },
    },
    affinity: { drew: { GRiZ: { songs: 3 } } },
    spotifyStats: { drew: { likedCount: 9 } },
  };
  const out = state.renamePending(pending, { drew: 'Drew' });
  assert.deepEqual(out.people, { Mo: { colorIndex: 5 } }, 'the server’s Drew stands — colour and pid are theirs');
  assert.deepEqual(out.festivals[FID].selections, { GRiZ: { Drew: 3 }, Robyn: { Drew: 4 }, Lane: { K: 2 } },
    'an edit already under the server’s key wins');
  assert.deepEqual(out.festivals[FID].notes.artist.GRiZ['drew.abc'], note, 'a note’s id embeds its author: untouched');
  assert.deepEqual(out.affinity, { Drew: { GRiZ: { songs: 3 } } });
  assert.deepEqual(out.spotifyStats, { Drew: { likedCount: 9 } });
  assert.equal(pending.people.drew.colorIndex, 4, 'the input is not mutated');
  assert.equal('people' in state.renamePending({ people: { drew: {} } }, { drew: 'Drew' }), false,
    'an emptied people map goes, so it is not work owed');
});

test('a poll reconciles before any push: picks, disk and who this phone is follow the server’s key', async () => {
  const T = 'casingtoken_poll_0123456';
  freshCrew(T);
  // Joined offline as "drew" and picked twice; the crew has had "Drew" since.
  crew.setMe(T, 'drew');
  state.recordPerson('drew', { colorIndex: 1 });
  state.recordSelection('GRiZ', 'drew', 3);
  state.recordSelection('Robyn', 'K', 2);
  const srv = server(doc({ K: { colorIndex: 0 }, Drew: { colorIndex: 2 } }));
  let repaints = 0;
  sync.initSync({ onRemoteChange: () => { repaints++; }, onSyncBlocked: () => assert.fail('never blocked') });
  await sync.pollSync();
  assert.equal(crew.me(T), 'Drew', 'this phone is Drew now');
  assert.equal(state.people().drew, undefined, 'one Drew on the wall');
  assert.deepEqual(state.people().Drew, { colorIndex: 2 }, 'with the crew’s colour');
  assert.equal(state.selections().GRiZ.Drew, 3, 'the pick came along');
  assert.ok(!anyDrewLower(state.pendingChanges), 'nothing pending under the other spelling');
  assert.ok(!anyDrewLower(onDisk(T)), 'and nothing on disk either — a later persist would bring it back');
  assert.ok(repaints >= 1);
  await sync.pushSync();
  assert.equal(srv.log.posts.length, 1);
  assert.ok(!anyDrewLower(srv.log.posts[0]), 'what leaves is spelled the crew’s way');
  assert.equal(srv.doc().festivals[FID].selections.GRiZ.Drew, 3);
  assert.equal(sync.syncState(), 'online');
  assert.equal(state.hasPending(), false);
});

test('when the push is what finds out: one read of the crew, one more push, never blocked', async () => {
  const T = 'casingtoken_push_0123456';
  freshCrew(T);
  crew.setMe(T, 'K');
  state.recordPerson('drew', { colorIndex: 1 }); // the Invite sheet's offline add
  state.recordSelection('GRiZ', 'drew', 2); // K picking as drew, say
  const srv = server(doc({ K: { colorIndex: 0 }, Drew: { colorIndex: 2 } }));
  let blocked = null;
  sync.initSync({ onRemoteChange: () => {}, onSyncBlocked: (r) => { blocked = r; } });
  await sync.pushSync();
  assert.equal(blocked, null, 'nobody is told the crew refused');
  assert.equal(sync.syncState(), 'online');
  assert.equal(srv.log.gets, 1, 'one read of the crew');
  assert.equal(srv.log.posts.length, 2, 'the refused push, then the reconciled one');
  assert.ok(anyDrewLower(srv.log.posts[0]) && !anyDrewLower(srv.log.posts[1]));
  assert.equal(srv.doc().festivals[FID].selections.GRiZ.Drew, 2);
  assert.equal(crew.me(T), 'K', 'who this phone is did not move');
  assert.equal(state.hasPending(), false);
});

test('a refusal a read of the crew cannot fix stays refused — once, no loop', async () => {
  const T = 'casingtoken_full_0123456';
  freshCrew(T);
  state.recordPerson('Mo', { colorIndex: 1 });
  let gets = 0, posts = 0, blocked = null;
  globalThis.fetch = async (_url, opts = {}) => {
    if ((opts.method || 'GET') === 'GET') { gets++; return mkRes(200, doc({ K: { colorIndex: 0 } })); }
    posts++;
    return mkRes(400, { error: 'This crew is full (12 people max)' });
  };
  sync.initSync({ onRemoteChange: () => {}, onSyncBlocked: (r) => { blocked = r; } });
  await sync.pushSync();
  assert.equal(sync.syncState(), 'blocked');
  assert.match(blocked, /full/);
  assert.equal(posts, 1, 'the same bytes are not sent twice');
  assert.equal(gets, 1);
  await sync.pushSync();
  assert.equal(posts, 1, 'still refused');
  assert.equal(gets, 1, 'and no read either: the refusal is remembered before anything leaves');
});

test('a refusal with no person in it does not read the crew at all', async () => {
  const T = 'casingtoken_nopp_0123456';
  freshCrew(T);
  state.recordSelection('GRiZ', 'K', 2);
  let gets = 0;
  globalThis.fetch = async (_url, opts = {}) => {
    if ((opts.method || 'GET') === 'GET') { gets++; return mkRes(200, doc({ K: {} })); }
    return mkRes(400, { error: 'bad field' });
  };
  sync.initSync({ onRemoteChange: () => {}, onSyncBlocked: () => {} });
  await sync.pushSync();
  assert.equal(sync.syncState(), 'blocked');
  assert.equal(gets, 0);
});
