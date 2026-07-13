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
  // Arrays replace wholesale — jsonb_deep_merge only recurses object×object,
  // and this twin must match it. Index-merging object-ified arrays: an array
  // landing where none existed came back as {"0":..,"1":..}, the server
  // rightly refused it, and the device was sync-blocked (live, 2026-07-13).
  if (Array.isArray(overlay)) return overlay.slice();
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? { ...base } : {};
  for (const k in overlay) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    out[k] = deepMerge(out[k], overlay[k]);
  }
  return out;
}

// The inverse operation, and the reason it exists: after a push succeeds we
// must drop the leaves the server now has — but NOT the leaves another tab
// wrote to disk while our request was in flight. Overwriting the pending blob
// with '{}' is the last-writer-wins bug persistPending() was already fixed for,
// left standing on the clear path (finish pass, 2026-07-12).
//
// A leaf is removed only when it is IDENTICAL to what we pushed. A leaf whose
// value differs is somebody's newer edit — keep it and let it sync next round.
// Emptied objects are pruned so hasPending() cannot report a husk of {} as work.
// `isAtomic(path)` marks a subtree that must travel WHOLE — see state.js.
// Without it, subtraction happily descends INTO a value-object and emits a
// partial one, and some value-objects are only valid complete.
export function subtractLeaves(base, pushed, isAtomic = () => false, path = []) {
  if (!base || typeof base !== 'object' || Array.isArray(base)) return base;
  if (!pushed || typeof pushed !== 'object' || Array.isArray(pushed)) return base;
  const out = {};
  for (const k in base) {
    if (FORBIDDEN_KEYS.has(k)) continue;
    if (!(k in pushed)) { out[k] = base[k]; continue; }

    const b = base[k], p = pushed[k];
    const here = [...path, k];
    const same = JSON.stringify(b) === JSON.stringify(p);

    // Acked exactly as sent — the server has it.
    if (same) continue;

    // An atomic subtree differs, so it goes back in FULL. Never a fragment of one.
    if (isAtomic(here)) { out[k] = b; continue; }

    const bothBranches = b && p && typeof b === 'object' && typeof p === 'object'
      && !Array.isArray(b) && !Array.isArray(p);

    if (bothBranches) {
      const rest = subtractLeaves(b, p, isAtomic, here);
      if (Object.keys(rest).length) out[k] = rest; // prune fully-acked branches
      continue;
    }
    // Leaf changed under us: a concurrent writer moved it after we serialized.
    out[k] = b;
  }
  return out;
}
