// Deep merge: overlay leaves win, objects merge recursively.
// This is the heart of the sync model — the same shape runs on the server.
// Deletions can never be expressed (only leaf overwrites), which is why the
// app uses tombstones ({removed:true}) for people and level 0 for picks.
// Prototype-rebinding keys are skipped outright (server validators reject
// them too — this is the client-side defense-in-depth twin).
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base;
  if (typeof overlay !== 'object') return overlay;
  const out = (base && typeof base === 'object') ? Array.isArray(base) ? [...base] : { ...base } : {};
  for (const k in overlay) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = deepMerge(out[k], overlay[k]);
  }
  return out;
}
