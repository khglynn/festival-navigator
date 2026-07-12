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
