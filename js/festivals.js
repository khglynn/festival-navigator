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
