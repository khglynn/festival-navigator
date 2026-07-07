// Sync (offline-first: local is instant, cloud catches up).
// Model: the remote crew document is the shared truth; our not-yet-pushed
// edits live in state.pendingChanges and always overlay on top of remote.
import * as state from './state.js';

let syncTimer = null, isSyncing = false, syncQueued = false;
let onRemoteChange = () => {};
let onCrewGone = () => {};

export function initSync(opts) {
  if (opts && opts.onRemoteChange) onRemoteChange = opts.onRemoteChange;
  if (opts && opts.onCrewGone) onCrewGone = opts.onCrewGone;
}

export function setSyncStatus(s) {
  document.getElementById('sync-dot').className = 'sync-dot sync-' + s;
  document.getElementById('sync-label').textContent = s;
}

export function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 1200);
}

class CrewGoneError extends Error {}

async function fetchRemote() {
  const token = state.getCrewToken();
  const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (res.status === 404) throw new CrewGoneError();
  if (!res.ok) throw new Error('GET failed: ' + res.status);
  return await res.json();
}

function applyRemote(remote) {
  if (state.applyRemoteDoc(remote)) onRemoteChange();
}

export async function pushSync() {
  if (!state.getCrewToken()) return;
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) { syncQueued = true; return; }
  isSyncing = true; setSyncStatus('syncing');
  const seqAtStart = state.getEditSeq();
  const tokenAtStart = state.getCrewToken();
  try {
    const res = await fetch(`/api/crew?t=${encodeURIComponent(tokenAtStart)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: state.pendingChanges }),
    });
    if (res.status === 404) throw new CrewGoneError();
    if (!res.ok) throw new Error('POST failed: ' + res.status);
    const stored = await res.json();
    // The crew may have been switched while the request was in flight —
    // never apply one crew's document to another crew's state.
    if (state.getCrewToken() !== tokenAtStart) return;
    // Clear pending only if no new edit landed during the round-trip;
    // otherwise keep them and push again so nothing is lost.
    if (state.getEditSeq() === seqAtStart) { state.clearPending(); }
    else { scheduleSync(); }
    applyRemote(stored);
    setSyncStatus(state.hasPending() ? 'syncing' : 'online');
  } catch (e) {
    // Thread the token: this 404 is about the crew the request was FOR,
    // which may no longer be the active one after a mid-flight switch.
    if (e instanceof CrewGoneError) { onCrewGone(tokenAtStart); return; }
    console.error('sync push failed', e);
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  } finally {
    isSyncing = false;
    if (syncQueued) { syncQueued = false; scheduleSync(); }
  }
}

export async function pollSync() {
  if (!state.getCrewToken()) return;
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) return; // a push already has the latest in flight
  const tokenAtStart = state.getCrewToken();
  try {
    const remote = await fetchRemote();
    if (state.getCrewToken() !== tokenAtStart) return;
    applyRemote(remote);
    setSyncStatus(state.hasPending() ? 'syncing' : 'online');
    if (state.hasPending()) scheduleSync();
  } catch (e) {
    if (e instanceof CrewGoneError) { onCrewGone(tokenAtStart); return; }
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  }
}
