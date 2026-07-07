// Sync (offline-first: local is instant, cloud catches up).
// Model: the remote document is the shared truth; our not-yet-pushed edits
// live in state.pendingChanges and always overlay on top of remote.
import { deepMerge } from './merge.js';
import * as state from './state.js';

let syncTimer = null, isSyncing = false, syncQueued = false;
let onRemoteChange = () => {};

export function initSync(opts) {
  if (opts && opts.onRemoteChange) onRemoteChange = opts.onRemoteChange;
}

export function setSyncStatus(s) {
  document.getElementById('sync-dot').className = 'sync-dot sync-' + s;
  document.getElementById('sync-label').textContent = s;
}

export function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 1200);
}

async function fetchRemote() {
  const res = await fetch('/api/selections', { cache: 'no-store' });
  if (!res.ok) throw new Error('GET failed: ' + res.status);
  return await res.json();
}

function applyRemote(remote) {
  if (state.applyRemoteData(remote)) onRemoteChange();
}

export async function pushSync() {
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) { syncQueued = true; return; }
  isSyncing = true; setSyncStatus('syncing');
  const seqAtStart = state.getEditSeq();
  try {
    const remote = await fetchRemote();
    const out = deepMerge(remote, state.pendingChanges);
    const res = await fetch('/api/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: out })
    });
    if (!res.ok) throw new Error('POST failed: ' + res.status);
    const stored = await res.json();
    // Clear pending only if no new edit landed during the round-trip;
    // otherwise keep them and push again so nothing is lost.
    if (state.getEditSeq() === seqAtStart) { state.clearPending(); }
    else { scheduleSync(); }
    applyRemote(stored);
    setSyncStatus(state.hasPending() ? 'syncing' : 'online');
  } catch (e) {
    console.error('sync push failed', e);
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  } finally {
    isSyncing = false;
    if (syncQueued) { syncQueued = false; scheduleSync(); }
  }
}

export async function pollSync() {
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) return; // a push already has the latest in flight
  try {
    applyRemote(await fetchRemote());
    setSyncStatus(state.hasPending() ? 'syncing' : 'online');
    if (state.hasPending()) scheduleSync();
  } catch (e) { setSyncStatus(navigator.onLine ? 'error' : 'offline'); }
}
