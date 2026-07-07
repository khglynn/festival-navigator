// App state: festival data access, crew/selection state, localStorage
// persistence, and the pendingChanges overlay that makes sync offline-safe.
import { deepMerge } from './merge.js';
import { computeDayArtists } from './time.js';

export const COLOR_PALETTE = [
  '239, 68, 68', '59, 130, 246', '34, 197, 94', '251, 191, 36',
  '168, 85, 247', '236, 72, 153', '249, 115, 22', '20, 184, 166',
  '99, 102, 241', '132, 204, 22', '244, 63, 94', '14, 165, 233'
];
export const opacities = [0.5, 0.75, 1.0]; // index = level-1

export const LS = {
  active: 'fn_active_festival',
  data: 'fn_data_v2',
  pending: 'fn_pending_v2',
  geminiKey: 'geminiApiKey'
};

export const FESTIVALS = window.FESTIVALS || {};

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}

// allData[festId] = { people: {name:{color}}, selections: {artist:{person:level}} }
export let allData = loadJSON(LS.data, {});
// pendingChanges mirrors allData but only locally-changed leaves not yet pushed
export let pendingChanges = loadJSON(LS.pending, {});

export let activeFestivalId = localStorage.getItem(LS.active) || window.DEFAULT_FESTIVAL || Object.keys(FESTIVALS)[0];
if (!FESTIVALS[activeFestivalId]) activeFestivalId = Object.keys(FESTIVALS)[0];

export let currentDay = null;
export let selectedPerson = null;
let editSeq = 0; // bumped on every local edit; guards the push/clear race
const dayCache = {}; // `${fid}|${day}` -> computed artists

export function setCurrentDay(d) { currentDay = d; }
export function setSelectedPerson(p) { selectedPerson = p; }
export function setActiveFestivalId(fid) { activeFestivalId = fid; localStorage.setItem(LS.active, fid); }
export function getEditSeq() { return editSeq; }

export function persist() { localStorage.setItem(LS.data, JSON.stringify(allData)); }
export function persistPending() { localStorage.setItem(LS.pending, JSON.stringify(pendingChanges)); }

export function fest() { return FESTIVALS[activeFestivalId]; }
export function festState() { return allData[activeFestivalId]; }
export function people() { return festState().people; }
export function selections() { return festState().selections; }

// A removed person is tombstoned ({removed:true}) rather than deleted,
// so the removal can sync (deep-merge can't express a key deletion).
export function isActivePerson(p) { return !!p && !p.removed; }
export function activePeople() { return Object.entries(people()).filter(([, p]) => isActivePerson(p)); }

// Record a single changed leaf into pendingChanges so it syncs & survives.
export function recordSelection(artist, person, level) {
  const p = (pendingChanges[activeFestivalId] = pendingChanges[activeFestivalId] || {});
  const s = (p.selections = p.selections || {});
  (s[artist] = s[artist] || {})[person] = level;
  editSeq++; persistPending();
}

export function recordPerson(name, obj) {
  const p = (pendingChanges[activeFestivalId] = pendingChanges[activeFestivalId] || {});
  const pe = (p.people = p.people || {});
  pe[name] = obj;
  editSeq++; persistPending();
}

export function ensureFestivalState(fid) {
  if (!allData[fid]) allData[fid] = { people: {}, selections: {} };
  if (!allData[fid].people) allData[fid].people = {};
  if (!allData[fid].selections) allData[fid].selections = {};
  // Seed default crew the first time this festival is opened with nobody set.
  if (Object.keys(allData[fid].people).length === 0) {
    const prev = activeFestivalId; activeFestivalId = fid; // so recordPerson targets fid
    (FESTIVALS[fid].defaultPeople || []).forEach((name) => {
      const color = nextColor(allData[fid].people);
      allData[fid].people[name] = { color };
      recordPerson(name, { color });
    });
    activeFestivalId = prev;
  }
  persist();
}

export function nextColor(peopleObj) {
  const used = new Set(Object.values(peopleObj).filter(p => !p.removed).map(p => p.color));
  const open = COLOR_PALETTE.find(c => !used.has(c));
  return open || COLOR_PALETTE[Object.keys(peopleObj).length % COLOR_PALETTE.length];
}

export function hasPending() { return Object.keys(pendingChanges).length > 0; }
export function clearPending() { pendingChanges = {}; persistPending(); }

// Rebuild local state from remote + our pending overlay. Returns true if the
// visible festival actually changed (so callers repaint only when needed).
export function applyRemoteData(remote) {
  const before = JSON.stringify(allData[activeFestivalId] || {});
  allData = deepMerge(remote || {}, pendingChanges);
  ensureFestivalState(activeFestivalId); // re-seed crew if brand new
  persist();
  return JSON.stringify(allData[activeFestivalId] || {}) !== before;
}

// Returns computed artists for a day with startMin/endMin resolved (cached).
export function getDayArtists(day) {
  const key = `${activeFestivalId}|${day}`;
  if (dayCache[key]) return dayCache[key];
  const computed = computeDayArtists(fest().days[day]);
  dayCache[key] = computed;
  return computed;
}

// One-time migration of the pre-multi-festival localStorage key.
export function migrateOldData() {
  const old = localStorage.getItem('lollaSelections');
  if (old && FESTIVALS['lollapalooza-2025']) {
    try {
      const parsed = JSON.parse(old);
      ensureFestivalState('lollapalooza-2025');
      const tgt = allData['lollapalooza-2025'].selections;
      // Route through pendingChanges too, so these survive the first
      // remote merge and sync up to the shared store.
      const pend = (pendingChanges['lollapalooza-2025'] = pendingChanges['lollapalooza-2025'] || {});
      const ps = (pend.selections = pend.selections || {});
      Object.entries(parsed).forEach(([artist, sels]) => {
        tgt[artist] = deepMerge(tgt[artist], sels);
        ps[artist] = deepMerge(ps[artist], sels);
      });
      editSeq++; persist(); persistPending();
      localStorage.removeItem('lollaSelections'); // migrated
    } catch (e) { /* ignore */ }
  }
}
