// The shared localStorage pair — guarded EVERYWHERE (PS-6): a full or blocked
// store (quota, private mode) must never throw mid-tap. Memory state stays
// right and sync still pushes; only the local cache is lost. Five modules
// used to hand-roll this while util.js sat dead (sweep, 2026-07-12).

export function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

export function saveLS(key, value) {
  try { localStorage.setItem(key, value); }
  catch (e) { console.warn('localStorage write failed:', key, e); }
}
