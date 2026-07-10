// Crew identity + registry. A crew is reachable only through its capability
// token (the share link IS the access). This module owns:
//   - which crews this device knows (localStorage registry)
//   - which crew is active, and who "me" is within it
//   - create / fetch / join API calls
// Document state (the crew doc itself + pending changes) lives in state.js.

const K = {
  crews: 'fn_crews_v3',            // [{token, name}]
  active: 'fn_active_crew_v3',     // token
  me: (t) => `fn_me_v3_${t}`,      // my person name within crew t
};

function loadJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}

export function knownCrews() { return loadJSON(K.crews, []); }

export function rememberCrew(token, name) {
  const crews = knownCrews().filter((c) => c.token !== token);
  crews.push({ token, name });
  localStorage.setItem(K.crews, JSON.stringify(crews));
}

export function forgetCrew(token) {
  localStorage.setItem(K.crews, JSON.stringify(knownCrews().filter((c) => c.token !== token)));
  localStorage.removeItem(K.me(token));
  if (activeCrewToken() === token) localStorage.removeItem(K.active);
}

export function activeCrewToken() { return localStorage.getItem(K.active) || null; }
export function setActiveCrew(token) { localStorage.setItem(K.active, token); }

export function me(token) { return localStorage.getItem(K.me(token)) || null; }
export function setMe(token, name) { localStorage.setItem(K.me(token), name); }

// The token riding in the URL hash (#g=...), i.e. an opened share link.
export function tokenFromHash() {
  const m = (location.hash || '').match(/[#&]g=([A-Za-z0-9_-]{20,40})/);
  return m ? m[1] : null;
}

export function crewLink(token) {
  return `${location.origin}/#g=${token}`;
}

export async function fetchCrew(token) {
  const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
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
