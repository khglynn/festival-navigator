// Sync (offline-first: local is instant, cloud catches up).
// Model: the remote crew document is the shared truth; our not-yet-pushed
// edits live in state.pendingChanges and always overlay on top of remote.
import * as state from './state.js';
import { isApiNotFound } from './crew.js';

let syncTimer = null, isSyncing = false, syncQueued = false;
let pushGen = 0; // bumped when a push APPLIES its merged doc — guards the poll race
let onRemoteChange = () => {};
let onCrewGone = () => {};
let onSyncBlocked = () => {};

// The payload the server has already refused (400/413). A rejection like that
// is deterministic: re-sending the identical bytes gets the identical refusal.
// The old code "stopped the retry loop" only in its comment — pollSync still
// saw hasPending() and re-armed scheduleSync() every 25s, so one poisoned
// payload re-POSTed forever, re-toasting the same false reassurance and
// blocking every OTHER pending edit on the device behind it (finish pass,
// 2026-07-12).
//
// Remembering the exact refused payload (not just "we are blocked") is what
// keeps this from becoming a dead end: the moment the user changes ANYTHING,
// the payload differs, and we try again on our own. No stuck state to escape.
let refusedPayload = null;
const sig = (o) => JSON.stringify(o);
const isRefused = (payload) => refusedPayload !== null && sig(payload) === refusedPayload;
// "Stay offline" (manual, never auto-toggled): suppress every network
// attempt until switched off. Picks still save locally first, always.
let stayOffline = false;
export function setStayOffline(on) {
  stayOffline = !!on;
  if (stayOffline) setSyncStatus('offline');
}

export function initSync(opts) {
  if (opts && opts.onRemoteChange) onRemoteChange = opts.onRemoteChange;
  if (opts && opts.onCrewGone) onCrewGone = opts.onCrewGone;
  if (opts && opts.onSyncBlocked) onSyncBlocked = opts.onSyncBlocked;
}

// ONE observable sync state (PS-5): the dot, the settings label, and any
// future surface all read this — never a parallel computation that can lie.
let currentStatus = 'online';
export function syncState() { return currentStatus; }

export function setSyncStatus(s) {
  currentStatus = s;
  // v3 has two dots (desktop header + mobile dock) — update every instance.
  document.querySelectorAll('.sync-dot').forEach((el) => { el.className = 'sync-dot sync-' + s; });
  const label = document.getElementById('sync-label');
  if (label) label.textContent = s;
}

// A hung fetch used to jam sync forever — isSyncing never cleared because the
// promise never settled (PS-4). 20s is generous for a crew-doc round trip.
const SYNC_TIMEOUT_MS = 20000;
const timeoutSignal = () => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout
  ? AbortSignal.timeout(SYNC_TIMEOUT_MS)
  : undefined);

export function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 1200);
}

class CrewGoneError extends Error {}

async function fetchRemote() {
  const token = state.getCrewToken();
  const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, { cache: 'no-store', signal: timeoutSignal() });
  // Only OUR API's JSON 404 means the crew is gone — a platform/routing 404
  // (broken deploy, stale SW) is transient and must never forget crews.
  if (isApiNotFound(res)) throw new CrewGoneError();
  if (!res.ok) throw new Error('GET failed: ' + res.status);
  return await res.json();
}

function applyRemote(remote) {
  if (state.applyRemoteDoc(remote)) onRemoteChange();
}

export async function pushSync() {
  if (!state.getCrewToken()) return;
  if (stayOffline) { setSyncStatus('offline'); return; }
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) { syncQueued = true; return; }

  // Freeze the payload. state.pendingChanges is live and can gain leaves while
  // the request is in flight; both the refusal check and the post-success
  // subtraction have to talk about the exact bytes we actually sent.
  const payload = JSON.parse(JSON.stringify(state.pendingChanges));

  // Already refused, unchanged since. Sending it again would produce the same
  // rejection and the same toast, forever. Stay put — visibly — until an edit
  // changes the payload or the crew frees up room.
  if (isRefused(payload)) { setSyncStatus('blocked'); return; }

  isSyncing = true; setSyncStatus('syncing');
  const tokenAtStart = state.getCrewToken();
  try {
    const res = await fetch(`/api/crew?t=${encodeURIComponent(tokenAtStart)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // sv:4 declares v4 pick semantics (1-3 picked, 4 must) — without it the
      // server treats level 3 as legacy "Must See" and maps it on v4 docs.
      body: JSON.stringify({ data: payload, sv: 4 }),
      signal: timeoutSignal(),
    });
    if (isApiNotFound(res)) throw new CrewGoneError();
    // A validation/limit rejection is deterministic, not transient: the same
    // bytes will be refused every time. Remember them so we stop asking, tell
    // the human plainly, and leave the door open — any new edit changes the
    // payload and we retry by ourselves. Nothing is lost either way: the edits
    // are still on disk and still pending.
    if (res.status === 413 || res.status === 400) {
      const body = await res.json().catch(() => ({}));
      refusedPayload = sig(payload);
      setSyncStatus('blocked');
      onSyncBlocked(body.error || 'These changes can’t sync — the crew may have hit a limit.');
      return;
    }
    if (!res.ok) throw new Error('POST failed: ' + res.status);
    const stored = await res.json();
    // The crew may have been switched while the request was in flight —
    // never apply one crew's document to another crew's state.
    if (state.getCrewToken() !== tokenAtStart) return;
    refusedPayload = null; // the server is accepting our writes again
    // Subtract exactly what was ACKED from memory and disk. Anything left over
    // is either an edit made during the round-trip or another tab's write —
    // both real, both still owed a push.
    state.clearPending(payload);
    applyRemote(stored);
    pushGen++;
    if (state.hasPending()) scheduleSync();
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

// Last call before the page dies.
//
// Every edit sits in a 1.2s debounce before pushSync() even starts, and the
// most ordinary thing anyone does at a festival — pick a set, lock the phone,
// put it in a pocket — lands squarely inside that window. A backgrounded tab
// can be reaped by the OS with no further JS run, and an in-flight fetch() dies
// with it. sendBeacon is the one send the browser promises to finish anyway.
//
// We deliberately ignore the response: we cannot read it, so pending stays
// pending and the next boot pushes it again. That is safe precisely because the
// merge is idempotent — re-sending the same delta lands the same document.
// Sending twice is free; not sending once loses somebody's pick.
export function flushOnHide() {
  if (stayOffline || !navigator.onLine) return false;
  const token = state.getCrewToken();
  if (!token || !state.hasPending()) return false;
  if (isRefused(state.pendingChanges)) return false; // the server already said no
  if (typeof navigator.sendBeacon !== 'function') return false;
  try {
    const body = new Blob(
      [JSON.stringify({ data: state.pendingChanges, sv: 4 })],
      { type: 'application/json' },
    );
    return navigator.sendBeacon(`/api/crew?t=${encodeURIComponent(token)}`, body);
  } catch {
    return false;
  }
}

// One-shot server-side v3->v4 migration (atomic + idempotent server-side;
// see api/crew.js op=migrate). Called by boot when the loaded doc is v3.
export async function requestMigration() {
  const token = state.getCrewToken();
  if (!token || !navigator.onLine) return false;
  try {
    const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}&op=migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: timeoutSignal(),
    });
    if (!res.ok) return false;
    const doc = await res.json();
    if (state.getCrewToken() !== token) return false;
    applyRemote(doc);
    return true;
  } catch { return false; }
}

export async function pollSync() {
  if (!state.getCrewToken()) return;
  if (stayOffline) { setSyncStatus('offline'); return; }
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  if (isSyncing) return; // a push already has the latest in flight
  const tokenAtStart = state.getCrewToken();
  const genAtStart = pushGen;
  try {
    const remote = await fetchRemote();
    if (state.getCrewToken() !== tokenAtStart) return;
    // A push that COMPLETED while this GET was in flight applied a doc newer
    // than the one this poll is carrying — applying the stale snapshot rolled
    // freshly-synced picks back for a visible ~25s (sweep P1, 2026-07-12).
    if (pushGen !== genAtStart) return;
    applyRemote(remote);
    setSyncStatus(state.hasPending() ? 'syncing' : 'online');
    if (state.hasPending()) scheduleSync();
  } catch (e) {
    if (e instanceof CrewGoneError) { onCrewGone(tokenAtStart); return; }
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  }
}
