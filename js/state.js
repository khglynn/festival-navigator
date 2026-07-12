// App state for the ACTIVE crew: the crew document, the pendingChanges
// overlay that makes sync offline-safe, and festival data access.
//
// Crew doc shape (v3, mirrors api/_lib/crew-shared.mjs):
//   { v, meta:{name,createdAt}, spotify:{clientId?},
//     people:  {name: {color, removed?}},                  // crew-wide
//     festivals: {fid: {selections: {artist: {person: level}}}},
//     affinity: {person: {artist: {songs?, followed?}}} }  // crew-wide
import { deepMerge } from './merge.js';
import { computeDayArtists } from './time.js';
import { FESTIVALS, FESTIVAL_INDEX, defaultFestivalId } from './festivals.js';

export { FESTIVALS };

export const COLOR_PALETTE = [
  '239, 68, 68', '59, 130, 246', '34, 197, 94', '251, 191, 36',
  '168, 85, 247', '236, 72, 153', '249, 115, 22', '20, 184, 166',
  '99, 102, 241', '132, 204, 22', '244, 63, 94', '14, 165, 233'
];
export const opacities = [0.5, 0.75, 1.0]; // index = level-1

export const LS = {
  doc: (t) => `fn_crew_doc_v3_${t}`,
  pending: (t) => `fn_crew_pending_v3_${t}`,
  fest: (t) => `fn_crew_fest_v3_${t}`,
  geminiKey: 'geminiApiKey',
};

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}

// Writes are guarded like reads (PS-6): a full/blocked localStorage (quota,
// private mode) must never throw mid-tap — memory state stays right and sync
// still pushes; only the local cache is lost.
function saveLS(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { console.warn('localStorage write failed:', key, e); }
}

// ---- active crew context ----------------------------------------------------
let crewToken = null;
export let crewDoc = null;        // full crew document (remote truth + pending overlay)
export let pendingChanges = {};   // only locally-changed leaves not yet pushed
export let activeFestivalId = null;
export let currentDay = null;
export let selectedPerson = null;
let editSeq = 0; // bumped on every local edit; guards the push/clear race
const dayCache = {}; // `${fid}|${day}` -> computed artists

export function getCrewToken() { return crewToken; }
export function getEditSeq() { return editSeq; }
export function setCurrentDay(d) { currentDay = d; }
export function setSelectedPerson(p) { selectedPerson = p; }

// Load a crew into the active slot (from cache; sync refreshes it after).
// NOTE: callers must `await loadFestival(state.activeFestivalId)` before
// rendering — the index tells us the id is valid, not that data is loaded.
// `festHint` (optional) is the invite's festival context — from the share
// link's &f= param or the doc's meta.inviteFestId. It only fills the void on
// a device with no saved fest for this crew; a returning device keeps its own.
export function activateCrew(token, doc, festHint) {
  crewToken = token;
  crewDoc = doc || loadJSON(LS.doc(token), null) || { v: 3, meta: {}, spotify: {}, people: {}, festivals: {}, affinity: {} };
  pendingChanges = loadJSON(LS.pending(token), {});
  crewDoc = deepMerge(crewDoc, pendingChanges);
  const savedFest = localStorage.getItem(LS.fest(token));
  const known = (id) => FESTIVAL_INDEX.some((f) => f.id === id);
  const hinted = (festHint && known(festHint)) ? festHint : null;
  activeFestivalId = (savedFest && known(savedFest)) ? savedFest : (hinted || defaultFestivalId());
  if (hinted && activeFestivalId === hinted) saveLS(LS.fest(token), hinted);
  currentDay = null;
  selectedPerson = null;
  Object.keys(dayCache).forEach((k) => delete dayCache[k]);
  ensureFestivalState(activeFestivalId);
}

export function setActiveFestivalId(fid) {
  activeFestivalId = fid;
  saveLS(LS.fest(crewToken), fid);
}

export function persist() { saveLS(LS.doc(crewToken), JSON.stringify(crewDoc)); }
export function persistPending() { saveLS(LS.pending(crewToken), JSON.stringify(pendingChanges)); }

// ---- accessors ---------------------------------------------------------------
export function fest() { return FESTIVALS[activeFestivalId]; }
export function crewName() { return (crewDoc.meta && crewDoc.meta.name) || 'Your crew'; }
export function people() { return crewDoc.people; }
export function selections() { return crewDoc.festivals[activeFestivalId].selections; }
export function affinityFor(person) { return (crewDoc.affinity || {})[person] || null; }

// Case-insensitive affinity lookup for renderers: lineup names and Spotify
// names sometimes differ in casing.
export function affinityLookup(person) {
  const aff = person ? affinityFor(person) : null;
  if (!aff) return null;
  const map = {};
  for (const [name, v] of Object.entries(aff)) map[name.toLowerCase()] = v;
  return map;
}
export function spotifyClientId() { return (crewDoc.spotify || {}).clientId || ''; }

// A removed person is tombstoned ({removed:true}) rather than deleted,
// so the removal can sync (deep-merge can't express a key deletion).
export function isActivePerson(p) { return !!p && !p.removed; }
export function activePeople() { return Object.entries(people()).filter(([, p]) => isActivePerson(p)); }

export function ensureFestivalState(fid) {
  if (!crewDoc.festivals[fid]) crewDoc.festivals[fid] = { selections: {} };
  if (!crewDoc.festivals[fid].selections) crewDoc.festivals[fid].selections = {};
}

export function nextColor(peopleObj) {
  const used = new Set(Object.values(peopleObj).filter(p => !p.removed).map(p => p.color));
  const open = COLOR_PALETTE.find(c => !used.has(c));
  return open || COLOR_PALETTE[Object.keys(peopleObj).length % COLOR_PALETTE.length];
}

// ---- pending-change recorders (each also applies to the local doc) -----------
export function recordSelection(artist, person, level) {
  recordSelectionFor(activeFestivalId, artist, person, level);
}

// Same, but for an explicit festival (person removal clears picks crew-wide).
export function recordSelectionFor(fid, artist, person, level) {
  const f = (pendingChanges.festivals = pendingChanges.festivals || {});
  const entry = (f[fid] = f[fid] || {});
  const s = (entry.selections = entry.selections || {});
  (s[artist] = s[artist] || {})[person] = level;
  editSeq++; persistPending();
}

// Notes are keyed objects (never arrays — deep-merge would eat concurrent
// writes). Double-write: local doc for instant render, pending for the push.
export function recordNote(fid, scope, target, noteId, note) {
  const build = (root) => {
    const f = (root.festivals = root.festivals || {});
    const entry = (f[fid] = f[fid] || {});
    const notes = (entry.notes = entry.notes || {});
    const scoped = (notes[scope] = notes[scope] || {});
    const map = scope === 'fest' ? scoped : (scoped[target] = scoped[target] || {});
    map[noteId] = note;
  };
  build(pendingChanges);
  build(crewDoc);
  editSeq++; persistPending(); persist();
}

export function recordPerson(name, obj) {
  const pe = (pendingChanges.people = pendingChanges.people || {});
  pe[name] = obj;
  editSeq++; persistPending();
}

export function recordAffinity(person, artistMap) {
  // Double-write like every other recorder: local doc for the immediate
  // render, pending for the sync push.
  (crewDoc.affinity = crewDoc.affinity || {})[person] = artistMap;
  const aff = (pendingChanges.affinity = pendingChanges.affinity || {});
  aff[person] = artistMap;
  editSeq++; persistPending();
}

export function recordSpotifyClientId(clientId) {
  // Double-write like every other recorder — spotifyClientId() reads the
  // local doc, so a pending-only write left the drill stuck on the setup
  // state until the next full sync round-trip (CORE-14).
  crewDoc.spotify = crewDoc.spotify || {};
  crewDoc.spotify.clientId = clientId;
  pendingChanges.spotify = { clientId };
  editSeq++; persistPending(); persist();
}

export function recordCrewName(name) {
  crewDoc.meta = crewDoc.meta || {};
  crewDoc.meta.name = name;
  (pendingChanges.meta = pendingChanges.meta || {}).name = name;
  editSeq++; persistPending();
}

// Where new joiners land (FLOW-1): stamped at crew creation, refreshed when
// an invite is shared — so even old token-only links resolve to the right fest.
export function recordInviteFest(fid) {
  crewDoc.meta = crewDoc.meta || {};
  crewDoc.meta.inviteFestId = fid;
  (pendingChanges.meta = pendingChanges.meta || {}).inviteFestId = fid;
  editSeq++; persistPending();
}

export function hasPending() { return Object.keys(pendingChanges).length > 0; }
export function clearPending() { pendingChanges = {}; persistPending(); }

// Cached copy of a crew doc (for offline joins / crew switching).
export function cachedDoc(token) { return loadJSON(LS.doc(token), null); }
export function cachedPending(token) { return loadJSON(LS.pending(token), {}); }
export function clearCachedPending(token) { localStorage.removeItem(LS.pending(token)); }

// Rebuild local doc from remote + our pending overlay. Returns true if the
// visible slice actually changed (so callers repaint only when needed).
export function applyRemoteDoc(remote) {
  // The "visible slice" must cover everything the wall renders — notes and
  // meta included, or a note-only remote change never repaints (CORE-6).
  const visible = () => JSON.stringify({
    p: crewDoc.people,
    s: (crewDoc.festivals[activeFestivalId] || {}).selections || {},
    n: (crewDoc.festivals[activeFestivalId] || {}).notes || {},
    a: crewDoc.affinity || {},
    m: crewDoc.meta || {},
  });
  const before = visible();
  crewDoc = deepMerge(remote || {}, pendingChanges);
  ensureFestivalState(activeFestivalId);
  persist();
  return visible() !== before;
}

// Returns computed artists for a day with startMin/endMin resolved (cached).
export function getDayArtists(day) {
  const key = `${activeFestivalId}|${day}`;
  if (dayCache[key]) return dayCache[key];
  const computed = computeDayArtists(fest().days[day]);
  dayCache[key] = computed;
  return computed;
}
