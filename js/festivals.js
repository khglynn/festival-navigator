// Festival data loading (v3 JSON model, replaces the old window.FESTIVALS
// global script). The index is small and loaded at boot; full festival files
// are fetched lazily on activation. The service worker's cache-first handler
// makes both available offline after first load.
//
// Festival file shape: data/festivals/<id>.json — see scripts/validate-festivals.mjs
// for the schema (status: lineup | scheduled | archived; artists[] always
// present; days{}/stages/dayMeta only when a real schedule exists).

export const FESTIVALS = {};      // id -> full festival object (loaded so far)
export let FESTIVAL_INDEX = [];   // [{id, name, year, status, dates, location, accent}]

export async function loadFestivalIndex() {
  const res = await fetch('/data/festivals/index.json');
  if (!res.ok) throw new Error('festival index failed: ' + res.status);
  FESTIVAL_INDEX = await res.json();
  return FESTIVAL_INDEX;
}

export async function loadFestival(id) {
  if (FESTIVALS[id]) return FESTIVALS[id];
  const res = await fetch(`/data/festivals/${id}.json`);
  if (!res.ok) throw new Error(`festival ${id} failed: ` + res.status);
  const fest = await res.json();
  FESTIVALS[id] = fest;
  return fest;
}

// Crew-private festivals added via LLM research (api/festival-add.js).
// Fetched once the crew token is known, merged into the catalog, and cached
// per-crew in localStorage so they survive offline (the SW never caches /api/).
const LS_CUSTOM = (t) => `fn_custom_fests_v1_${t}`;

function mergeCustoms(list) {
  for (const fest of list) {
    if (!fest || !fest.id) continue;
    FESTIVALS[fest.id] = fest; // full doc — no lazy fetch for customs
    if (!FESTIVAL_INDEX.some((f) => f.id === fest.id)) {
      FESTIVAL_INDEX.push({
        id: fest.id, name: fest.name, year: fest.year, status: fest.status,
        dates: fest.dates, location: fest.location, accent: fest.accent,
        custom: true,
      });
    }
  }
}

export async function loadCustomFestivals(token) {
  if (!token) return [];
  let list = [];
  try {
    const res = await fetch(`/api/festival-add?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (res.ok) {
      list = (await res.json()).festivals || [];
      try { localStorage.setItem(LS_CUSTOM(token), JSON.stringify(list)); } catch { /* quota */ }
    } else {
      throw new Error(String(res.status));
    }
  } catch {
    // offline or endpoint down: serve the last-known customs from cache
    try { list = JSON.parse(localStorage.getItem(LS_CUSTOM(token))) || []; } catch { list = []; }
  }
  mergeCustoms(list);
  return list;
}

export function isScheduled(fest) {
  return fest.status === 'archived' || fest.status === 'scheduled'
    ? !!fest.days && Object.keys(fest.days).length > 0
    : false;
}

// The sensible default for a fresh crew/device: the next upcoming festival
// (index.json is ordered by date, archived last).
export function defaultFestivalId() {
  const active = FESTIVAL_INDEX.find((f) => f.status !== 'archived');
  return (active || FESTIVAL_INDEX[0]).id;
}
