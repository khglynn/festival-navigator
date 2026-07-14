// Crew identity + registry. A crew is reachable only through its capability
// token (the share link IS the access). This module owns:
//   - which crews this device knows (localStorage registry)
//   - which crew is active, and who "me" is within it
//   - create / fetch / join API calls
// Document state (the crew doc itself + pending changes) lives in state.js.

import { loadJSON, saveLS } from './util.js';

const K = {
  crews: 'fn_crews_v3',            // [{token, name}]
  active: 'fn_active_crew_v3',     // token
  me: (t) => `fn_me_v3_${t}`,      // my person name within crew t
};

export function knownCrews() { return loadJSON(K.crews, []); }

export function rememberCrew(token, name) {
  const crews = knownCrews().filter((c) => c.token !== token);
  crews.push({ token, name });
  saveLS(K.crews, JSON.stringify(crews));
}

export function forgetCrew(token) {
  saveLS(K.crews, JSON.stringify(knownCrews().filter((c) => c.token !== token)));
  localStorage.removeItem(K.me(token));
  if (activeCrewToken() === token) localStorage.removeItem(K.active);
}

export function activeCrewToken() { return localStorage.getItem(K.active) || null; }
export function setActiveCrew(token) { saveLS(K.active, token); }

export function me(token) { return localStorage.getItem(K.me(token)) || null; }
export function setMe(token, name) { saveLS(K.me(token), name); }

// The token riding in the URL hash (#g=...), i.e. an opened share link.
export function tokenFromHash() {
  const m = (location.hash || '').match(/[#&]g=([A-Za-z0-9_-]{20,40})/);
  return m ? m[1] : null;
}

// "There is a crew link here, and it is broken" — which is a completely
// different thing from "there is no crew link here".
//
// A truncated link (chat apps clip long URLs; people paste half of one) failed
// tokenFromHash's shape check, returned null, and dropped the person on the
// plain landing page with no explanation at all — the app silently pretending
// they had never clicked anything. They are staring at the wrong screen with no
// idea why, holding what they believe is a valid invite (finish pass,
// 2026-07-12).
export function hashHasBrokenToken() {
  const hash = location.hash || '';
  if (!/[#&]g=/.test(hash)) return false;   // no crew link at all — landing is right
  return tokenFromHash() === null;          // a crew link that does not parse
}

// The festival context riding an invite link (#g=<token>&f=<festId>). Read it
// at boot, BEFORE enterApp's replaceState strips the hash down to #g=.
export function festFromHash() {
  const m = (location.hash || '').match(/[#&]f=([a-z0-9-]{1,64})(?:&|$)/);
  return m ? m[1] : null;
}

const FEST_ID_RE = /^[a-z0-9-]{1,64}$/;

// Share links carry the sharer's festival so a joiner on a fresh device lands
// on the crew's fest instead of the catalog default (FLOW-1). A personal link
// (`meName`) additionally carries WHO it's for: someone added on another
// member's phone opens their link and lands on their own circle, picks
// already theirs (Kevin note 5, 2026-07-12).
export function crewLink(token, festId, meName) {
  const f = festId && FEST_ID_RE.test(festId) ? `&f=${festId}` : '';
  const m = meName ? `&me=${encodeURIComponent(meName)}` : '';
  return `${location.origin}/#g=${token}${f}${m}`;
}

// The member a personal invite link is for (#g=<token>&me=<name>). Read at
// boot, BEFORE enterApp's replaceState strips the hash down to #g=.
export function meFromHash() {
  const m = (location.hash || '').match(/[#&]me=([^&]+)/);
  if (!m) return null;
  try { return decodeURIComponent(m[1]).trim() || null; }
  catch { return null; }
}

// Which crew a boot should open. A cold start (first boot of this page load)
// resumes the remembered crew — reopening the PWA lands you where you were.
// Any LATER boot is an in-app navigation (hashchange, browser back): a bare
// URL then means the user deliberately left the crew, so it's the landing —
// resuming there made Back from the wall a re-entry loop (Kevin note 2).
export function bootTokenFor(hashToken, activeToken, isFirstBoot) {
  return hashToken || (isFirstBoot ? activeToken : null);
}

// "Crew not found" means OUR API said so (JSON 404). A routing/platform 404
// (HTML body — broken deploy, stale SW, misconfigured env) must read as a
// transient failure, or one bad deploy would wipe every device's remembered
// crews via the crew-gone path.
export function isApiNotFound(res) {
  return res.status === 404 && (res.headers.get('content-type') || '').includes('application/json');
}

export async function fetchCrew(token) {
  const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (isApiNotFound(res)) return null;
  if (!res.ok) throw new Error('crew fetch failed: ' + res.status);
  return await res.json();
}

export async function createCrew(crewName, myName, personObj) {
  const res = await fetch('/api/crew', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: crewName, people: { [myName]: personObj } }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'create failed: ' + res.status);
  }
  return await res.json(); // {token, doc}
}

// ---- person (the "me link") ---------------------------------------------
// One person across crews. The device keeps {token, id, name, crews} here;
// the server doc's crews registry is what a NEW device restores from. The
// person token is a MASTER KEY — its doc lists every crew token — so it
// travels only in the me link and this store, never in a crew doc (crew docs
// carry the public `pid` instead). The local `crews` mirror exists so
// stamping can skip the network when nothing changed.

const PERSON_KEY = 'fn_person_v1'; // {token, id, name, crews:{<crewToken>:{name,crewName}}}

export function myPerson() { return loadJSON(PERSON_KEY, null); }
export function setMyPerson(p) { saveLS(PERSON_KEY, JSON.stringify(p)); }

export function meLink() {
  const p = myPerson();
  return p ? `${location.origin}/#p=${p.token}` : null;
}

// The person token riding in the URL hash (#p=...), i.e. an opened me link.
export function personFromHash() {
  const m = (location.hash || '').match(/[#&]p=([A-Za-z0-9_-]{20,40})/);
  return m ? m[1] : null;
}

// Same contract as hashHasBrokenToken: "there is a me link here and it is
// broken" is different from "there is no me link here".
export function hashHasBrokenPersonLink() {
  const hash = location.hash || '';
  if (!/[#&]p=/.test(hash)) return false;
  return personFromHash() === null;
}

// The person token travels ONLY in this header — a query param would put the
// master key in platform logs and proxies (Codex gate, P1).
export async function fetchPerson(token) {
  const res = await fetch('/api/person', {
    headers: { 'X-Person-Token': token },
    cache: 'no-store',
  });
  if (isApiNotFound(res)) return null;
  if (!res.ok) throw new Error('person fetch failed: ' + res.status);
  return await res.json(); // {id, doc}
}

// Create-if-missing, silently. Identity plumbing must never block entering a
// crew — every failure path returns null and the next crew open retries.
// The in-flight memo collapses same-tab concurrent calls (double-tap, two
// stamps racing) to ONE create POST. Two separate TABS racing can still mint
// an orphan server row — accepted for Phase 1: the row is unreferenced,
// localStorage converges first-write-wins, and the pid only ever comes from
// the converged record. Server-idempotent creation is Phase 2 hardening.
let personCreateInFlight = null;
export async function ensurePerson(name) {
  const existing = myPerson();
  if (existing) return existing;
  if (personCreateInFlight) return personCreateInFlight;
  personCreateInFlight = createPersonOnce(name);
  try { return await personCreateInFlight; }
  finally { personCreateInFlight = null; }
}

async function createPersonOnce(name) {
  try {
    const res = await fetch('/api/person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const { token, id, doc } = await res.json();
    // Re-check after EVERY await, flush against the write: another caller
    // (second tab, double-tap) may have stored a record while ours was in
    // flight. First write wins — our freshly minted row is abandoned
    // unreferenced, and every caller converges on ONE record before any pid
    // reaches a crew doc (Codex gate, P1; the check used to sit before
    // res.json(), and that one yield point was enough to lose the race).
    const raced = myPerson();
    if (raced) return raced;
    const p = { token, id, name: doc.name, crews: {} };
    setMyPerson(p);
    return p;
  } catch { return null; }
}

// May the identity stamp write for this (crew, name)? This device's person
// record belongs to ONE human, and a shared phone hands the picker to others
// (FLOW-8 switchIdentity) — so ownership is checked BOTH ways (Codex gate
// round 2, high):
//   - claimed crew: only the claimed name may restamp, and a rename is
//     honored only when it starts FROM that claimed name — a switched picker
//     invoking rename cannot transfer the record.
//   - unclaimed crew: open only to a picker matching the record's own name
//     (case-insensitive). A mismatched picker simply doesn't ride the me
//     link for that crew — the safe side of ambiguity.
export function mayStampPerson(person, crewToken, name, { renameFrom = null } = {}) {
  const mirror = person && (person.crews || {})[crewToken];
  if (mirror) return mirror.name === name || (!!renameFrom && mirror.name === renameFrom);
  return !!person && typeof person.name === 'string'
    && person.name.toLowerCase() === String(name).toLowerCase();
}

// Record "in this crew I am <name>" on the person doc. Idempotent via the
// local mirror; offline-tolerant (false = try again next open, nothing lost).
export async function stampPersonCrew(crewToken, myName, crewName) {
  const p = myPerson();
  if (!p) return false;
  const cur = (p.crews || {})[crewToken];
  if (cur && cur.name === myName && cur.crewName === crewName) return true;
  try {
    const res = await fetch('/api/person', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Person-Token': p.token },
      body: JSON.stringify({ data: { crews: { [crewToken]: { name: myName, crewName } } } }),
    });
    if (!res.ok) return false;
    const { doc } = await res.json();
    setMyPerson({ ...p, name: doc.name || p.name, crews: doc.crews || {} });
    return true;
  } catch { return false; }
}
