// The shared localStorage pair — guarded EVERYWHERE (PS-6): a full or blocked
// store (quota, private mode) must never throw mid-tap. Memory state stays
// right and sync still pushes; only the local cache is lost. Five modules
// used to hand-roll this while util.js sat dead (sweep, 2026-07-12).
//
// But "never throw" was quietly doing more harm than good: a swallowed write
// meant a pick lived ONLY in memory, and the push is debounced 1.2s behind it.
// Lock the phone in that window — the single most ordinary thing a person does
// at a festival — and the pick was gone on next boot, with nothing on screen
// ever having said so. Silence is the bug (finish pass, 2026-07-12). So the
// guard stays, and the failure is now reported instead of whispered to a
// console nobody is reading in a field.

let onWriteFail = () => {};

// The app wires this to the toast + sync-dot plumbing at boot. It stays a
// callback (not an import) so util.js keeps zero dependencies — it is the leaf
// every other module imports.
export function onStorageWriteFail(fn) { onWriteFail = fn; }

export function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

// Raw-string sibling of loadJSON, same guard: a storage-blocked browser
// (private mode, "block all cookies") THROWS on getItem itself, and raw reads
// in the boot path turned that into the fatal screen instead of a from-link,
// memory-only session (gate find, 2026-08-23).
export function getLS(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function removeLS(key) {
  try { localStorage.removeItem(key); } catch { /* nothing stored anyway */ }
}

// A fetch that never settles is worse than one that fails: gating a paint on
// an untimed network call left a phone on associated-but-dead festival WiFi
// staring at a blank page for the OS socket timeout — minutes, with the whole
// doc sitting in cache (gate find, 2026-08-23). AbortSignal.timeout shipped in
// Safari 16; the controller+timer fallback covers 15.x, where the missing API
// used to mean NO timeout at all and one hung fetch wedged sync forever. A
// late abort on a settled fetch is a no-op, so the timer needs no cleanup.
export function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
  if (typeof AbortController !== 'undefined') {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  }
  return undefined;
}

// Returns true when the value actually reached disk. Callers that are holding
// the only copy of a user's edit MUST care about the answer.
export function saveLS(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('localStorage write failed:', key, e);
    try { onWriteFail(e); } catch { /* a failing reporter must never eat the edit too */ }
    return false;
  }
}
