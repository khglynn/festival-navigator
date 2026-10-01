// Festival data loading (v3 JSON model, replaces the old window.FESTIVALS
// global script). The index is small and loaded at boot; full festival files
// are fetched lazily on activation. The service worker serves both
// network-first — the live copy when it answers within 4 s, so a set-times
// drop lands on the next open — with its persistent data cache as the offline
// answer for anything opened once.
//
// Festival file shape: data/festivals/<id>.json — see scripts/validate-festivals.mjs
// for the schema (status: lineup | scheduled | archived; artists[] always
// present; days{}/stages/dayMeta only when a real schedule exists).

import { timeoutSignal } from './util.js';

export const FESTIVALS = {};      // id -> full festival object (loaded so far)
export let FESTIVAL_INDEX = [];   // [{id, name, year, status, dates, location, accent}]

export async function loadFestivalIndex() {
  const res = await fetch('/data/festivals/index.json');
  if (!res.ok) throw new Error('festival index failed: ' + res.status);
  FESTIVAL_INDEX = await res.json();
  return FESTIVAL_INDEX;
}

// How long the wall waits on a festival file before answering from this
// phone's copy instead. The request is never aborted — the worker keeps
// downloading under waitUntil, so a slow file still lands in its data cache
// for the next try. Exported for the tests.
export const FEST_FILE_DEADLINE_MS = 12000;

// The festival file: live (network-first through the worker), else the copy
// this phone holds. Throws only when neither answers; the error then carries
// `network: true` when the network is what failed (no answer, no body, no
// answer in time, a 5xx), as against a server that answered wrongly (a 404, a
// broken JSON drop) — a real fault that must stay loud (2026-10-01).
export async function loadFestival(id) {
  if (FESTIVALS[id]) return FESTIVALS[id];
  const path = `/data/festivals/${id}.json`;
  let fest = null;
  let failure = null;
  let timer = null;
  try {
    const live = (async () => {
      let res;
      try { res = await fetch(path); } catch (e) { throw networkFailure(e); }
      // A 5xx is a server or a proxy that could not get through right now — on
      // a festival network, often the carrier's own gateway — so it counts
      // with the network: the calm screen and its retries, not the crash.
      // A 4xx (a renamed or missing file) is a real fault and stays loud.
      if (!res.ok) {
        const bad = new Error(`festival ${id} failed: ` + res.status);
        throw res.status >= 500 ? networkFailure(bad) : bad;
      }
      let text;
      // A body that dies mid-download is the network too: on one bar the
      // worker hands back live headers inside its 4 s budget and the rest
      // never comes (2026-10-01).
      try { text = await res.text(); } catch (e) { throw networkFailure(e); }
      return JSON.parse(text);
    })();
    live.catch(() => { /* a loser of the race below must not surface as an unhandled rejection */ });
    const late = new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(networkFailure(new Error(`festival ${id} took too long`))), FEST_FILE_DEADLINE_MS);
    });
    fest = await Promise.race([live, late]);
  } catch (e) {
    failure = e;
  } finally {
    clearTimeout(timer);
  }
  // The worker answers from its copy when the network fails outright; this
  // covers the two cases it cannot see — a body cut after the headers, and a
  // page no worker controls yet.
  if (!fest) fest = await cachedJSON(path);
  if (!fest) throw failure;
  if (!FESTIVALS[id]) FESTIVALS[id] = fest;
  return FESTIVALS[id];
}

function networkFailure(cause) {
  const e = cause instanceof Error ? cause : new Error(String(cause));
  try { e.network = true; } catch { /* a frozen error: the caller treats it as a fault */ }
  return e;
}

// A festival this phone already HOLDS, other than `except` — the catalog
// default first, then catalog order — read from its own copies, never fetched.
// Null when it holds none. Crew-private festivals are not offered: their
// files live with the crew (cachedCustomFestivals), not under /data/festivals.
export async function heldFestivalId(except) {
  let first = null;
  try { first = defaultFestivalId(); } catch { first = null; }
  const ids = [first, ...FESTIVAL_INDEX.filter((f) => !f.custom).map((f) => f.id)];
  for (const id of ids) {
    if (!id || id === except) continue;
    if (await festivalFromCache(id)) return id;
  }
  return null;
}

// Crew-private festivals added via LLM research (api/festival-add.js).
// Fetched once the crew token is known, merged into the catalog, and cached
// per-crew in localStorage so they survive offline (the SW never caches /api/).
// Two halves on purpose: boot starts the fetch beside the catalog's, but may
// only MERGE once the catalog is in — the merge checks canonical ids against
// FESTIVAL_INDEX, and loadFestivalIndex replaces that list wholesale.
const LS_CUSTOM = (t) => `fn_custom_fests_v1_${t}`;

export function mergeCustoms(list) {
  for (const fest of list) {
    if (!fest || !fest.id) continue;
    // A custom may never shadow a canonical catalog fest (CORE-9): whatever
    // is stored, the checked-in data wins at read time.
    if (FESTIVAL_INDEX.some((f) => f.id === fest.id && !f.custom)) continue;
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

// The crew's customs, fresh or (offline, endpoint down) the last-known copy.
// Never rejects.
export async function fetchCustomFestivals(token) {
  if (!token) return [];
  let list = [];
  try {
    // 8s timeout: the wall waits on this, and a dead festival network that
    // neither resolves nor rejects held the whole app at a blank screen — the
    // offline catch below had the cached customs the entire time (gate find,
    // 2026-08-23).
    const res = await fetch(`/api/festival-add?t=${encodeURIComponent(token)}`, {
      cache: 'no-store', signal: timeoutSignal(8000),
    });
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
  return list;
}

// ---- the warm open: what this phone already holds (2026-09-23) --------------
// At Pier 80 with 40k phones on one tower the network HANGS rather than fails,
// and every network-first read above spends its whole budget before the cache
// answers — a cold open sat on the loader for up to ~16 s over files that were
// on the phone the entire time. These read the worker's caches directly, with
// no network in the way, for the first paint; the ordinary reads refresh it
// once they land (app.js freshenWarmOpen). None of them throws: a browser with
// site data blocked throws from the `caches` getter itself.
//
// The worker's persistent festival-data bucket, looked in first because every
// fetch refreshes it; the shell's install snapshot (index.json) is the fallback.
// Must equal service-worker.js DATA_CACHE (tests/sw-data-network-first.test.mjs).
export const DATA_CACHE_NAME = 'festival-nav-data-v1';

async function cachedJSON(path) {
  try {
    const store = caches;
    if (!store || typeof store.match !== 'function') return null;
    const hit = (await store.match(path, { cacheName: DATA_CACHE_NAME })) || (await store.match(path));
    return hit ? await hit.json() : null;
  } catch { return null; }
}

// The catalog from cache when this page has none yet. True when the page
// holds a catalog, either way. Never replaces one that is already here.
export async function festivalIndexFromCache() {
  if (FESTIVAL_INDEX.length) return true;
  const list = await cachedJSON('/data/festivals/index.json');
  if (Array.isArray(list) && list.length && !FESTIVAL_INDEX.length) FESTIVAL_INDEX = list;
  return FESTIVAL_INDEX.length > 0;
}

// A festival file this page or this phone already holds; null when neither.
export async function festivalFromCache(id) {
  if (FESTIVALS[id]) return FESTIVALS[id];
  const fest = await cachedJSON(`/data/festivals/${id}.json`);
  if (fest && !FESTIVALS[id]) FESTIVALS[id] = fest;
  return FESTIVALS[id] || null;
}

// The live festival file (network-first through the worker, as always) for
// the warm open's freshness check. Null on any failure; never touches
// FESTIVALS — the caller decides whether the fresh copy replaces the painted one.
export async function fetchFestivalFile(id) {
  try {
    const res = await fetch(`/data/festivals/${id}.json`);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

// The crew's customs as last stored on this phone, without asking.
export function cachedCustomFestivals(token) {
  try {
    const list = JSON.parse(localStorage.getItem(LS_CUSTOM(token)));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export async function loadCustomFestivals(token) {
  const list = await fetchCustomFestivals(token);
  mergeCustoms(list);
  return list;
}

// (isScheduled() was deleted 2026-07-12 — dead code whose status-gated logic
// disagreed with the renderer's actual check (`fest.days` presence). The
// renderer's inline check is the one truth; audit finding 12.3.)

// The sensible default for a fresh crew/device: the next upcoming festival
// (index.json is ordered by date, archived last).
export function defaultFestivalId() {
  const active = FESTIVAL_INDEX.find((f) => f.status !== 'archived');
  return (active || FESTIVAL_INDEX[0]).id;
}
