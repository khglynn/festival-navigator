// Spotify integration via Authorization Code + PKCE — no client secret, no
// server-held tokens. Each crew brings its own Spotify app Client ID (the
// crew doc's spotify.clientId); each member's tokens live only in their own
// localStorage. Spotify's 2026 rules cap a dev-mode app at 5 allowlisted
// users and require the app OWNER to keep Premium — the setup guide in the
// UI spells this out.
import * as state from './state.js';
import { loadJSON as loadJSONShared, saveLS } from './util.js';
import { loadFestival, FESTIVALS } from './festivals.js';

const LS_AUTH = 'fn_spotify_auth_v1';       // {clientId, access_token, refresh_token, expires_at}
const LS_LIBMAP = 'fn_spotify_libmap_v1';   // {clientId, userId, fetchedAt, artists: {lowerName: {songs, followed}}}
const LS_ERROR = 'fn_spotify_error';        // sessionStorage: last OAuth failure, shown IN the app
const SCOPES = 'user-library-read user-follow-read playlist-modify-public playlist-modify-private';

const redirectUri = () => `${location.origin}/spotify-callback`;

// OAuth happens on ONE origin (SPOT-1): the Spotify app registers exactly
// fest.kevinhg.com/spotify-callback. Every OTHER host hops — aliases,
// staging, previews — carrying the crew, the fest, and an sp=1 flag that
// re-opens the Spotify drill after the hop. This used to be an allowlist of
// known aliases, which silently broke OAuth on any new domain: staging sent
// Spotify a stage.fest redirect URI and got "redirect_uri: Not matching
// configuration" (Kevin, 2026-07-12). Localhost stays in place for dev.
const CANONICAL_HOST = 'fest.kevinhg.com';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

// `sp=connect` means "the person already pressed Connect — just keep going".
// The hop used to land them on the canonical host with the drill open and a
// SECOND Connect button to press, which reads as a dead end wearing a different
// hat: you asked to connect, and the app moved you somewhere else to ask again
// (Kevin, 2026-07-12). One press, one connect, wherever you started.
export function canonicalHopUrl({ autoConnect = false } = {}) {
  if (location.host === CANONICAL_HOST || LOCAL_HOSTS.includes(location.hostname)) return null;
  const token = state.getCrewToken();
  if (!token) return `https://${CANONICAL_HOST}/`;
  const sp = autoConnect ? 'connect' : '1';
  return `https://${CANONICAL_HOST}/#g=${token}&f=${state.activeFestivalId}&sp=${sp}`;
}

// The last OAuth failure, banked by spotify-callback.html so the error lands
// IN the app's drill — never a dead browser page (design state 5).
export function lastError() {
  try { return sessionStorage.getItem(LS_ERROR); } catch { return null; }
}
export function clearError() {
  try { sessionStorage.removeItem(LS_ERROR); } catch { /* private mode */ }
}

const loadJSON = (key) => loadJSONShared(key, null);

export function auth() { return loadJSON(LS_AUTH); }
export function isConnected() {
  const a = auth();
  return !!(a && a.refresh_token && a.clientId === state.spotifyClientId());
}
export function libraryMap() { return loadJSON(LS_LIBMAP); }
export function disconnect() { localStorage.removeItem(LS_AUTH); localStorage.removeItem(LS_LIBMAP); }
// Drop the cached library but STAY connected — "read it again" re-runs the whole
// sweep (read + badge every festival) without making anyone re-authorise.
export function disconnectLibrary() { localStorage.removeItem(LS_LIBMAP); }

// ---- PKCE connect -----------------------------------------------------------
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function connect() {
  const clientId = state.spotifyClientId();
  if (!clientId) throw new Error('This crew has no Spotify Client ID set yet.');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const stateParam = b64url(crypto.getRandomValues(new Uint8Array(12)));
  // returnTo carries sp=1 so the OAuth return re-opens the drill on EVERY
  // path (audit 6.1) — enterApp's replaceState strips the flag from the URL
  // bar afterwards, but boot reads it first.
  const token = state.getCrewToken();
  const returnTo = token
    ? `${location.origin}/#g=${token}&f=${state.activeFestivalId}&sp=1`
    : location.href;
  sessionStorage.setItem('fn_spotify_pkce', JSON.stringify({
    verifier, state: stateParam, clientId, returnTo,
  }));
  const p = new URLSearchParams({
    response_type: 'code', client_id: clientId, scope: SCOPES,
    redirect_uri: redirectUri(), code_challenge_method: 'S256',
    code_challenge: challenge, state: stateParam,
  });
  location.assign(`https://accounts.spotify.com/authorize?${p}`);
}

// Called by spotify-callback.html with the ?code from Spotify.
// The person sees a sentence; the console keeps the forensics.
//
// These two throw sites used to interpolate a raw HTTP body and a
// `Spotify API 429 on /v1/me/tracks` string straight into a message the
// Settings drill renders with textContent — so a bad moment with Spotify put
// status codes and endpoint paths on screen in front of someone who just wanted
// their liked songs badged (finish pass, 2026-07-12).
function spotifyError(message, detail) {
  if (detail) console.warn('spotify:', detail);
  return new Error(message);
}

export async function completeAuth(code, returnedState) {
  const pkce = JSON.parse(sessionStorage.getItem('fn_spotify_pkce') || 'null');
  if (!pkce || pkce.state !== returnedState) throw new Error('Auth state mismatch — try connecting again.');
  sessionStorage.removeItem('fn_spotify_pkce');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: redirectUri(),
      client_id: pkce.clientId, code_verifier: pkce.verifier,
    }),
  });
  if (!res.ok) {
    throw spotifyError(
      'Spotify couldn’t finish signing you in. Try connecting again.',
      `token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const t = await res.json();
  saveLS(LS_AUTH, JSON.stringify({
    clientId: pkce.clientId, access_token: t.access_token,
    refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in - 60) * 1000,
  }));
  return pkce.returnTo;
}

async function accessToken() {
  const a = auth();
  if (!a) throw new Error('Not connected to Spotify.');
  if (Date.now() < a.expires_at) return a.access_token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: a.refresh_token, client_id: a.clientId }),
  });
  if (!res.ok) {
    // Only a REJECTED token is fatal — a transient 5xx/429 during a Spotify
    // blip must not wipe a valid refresh token + the whole library scan
    // (audit 6.2).
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      disconnect();
      throw new Error('Spotify session expired — connect again.');
    }
    throw new Error('Spotify had a hiccup refreshing your session — try again in a minute.');
  }
  const t = await res.json();
  saveLS(LS_AUTH, JSON.stringify({
    ...a, access_token: t.access_token,
    refresh_token: t.refresh_token || a.refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  }));
  return t.access_token;
}

// Spotify Web API with 429 handling (burst until told to back off).
async function api(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    if (res.status === 429) {
      const wait = (parseInt(res.headers.get('Retry-After') || '2', 10) + 1) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      throw spotifyError(
        'Spotify isn’t responding right now — try again in a minute.',
        `API ${res.status} on ${path}`,
      );
    }
    return await res.json();
  }
  throw new Error('Spotify rate limit would not clear.');
}

// ---- library scan -> affinity ------------------------------------------------
// Scans liked songs + followed artists into a device-cached full-library map,
// then filters it to the crew's festival lineups (kept small in the crew doc).
export async function scanLibrary(onProgress) {
  const me = await api('/me');
  const artists = {}; // lowerName -> {songs, followed, name}
  let url = '/me/tracks?limit=50', scanned = 0;
  while (url) {
    const page = await api(url);
    for (const item of page.items) {
      for (const a of (item.track?.artists || [])) {
        const key = a.name.toLowerCase();
        (artists[key] = artists[key] || { songs: 0 }).songs++;
      }
    }
    scanned += page.items.length;
    if (onProgress) onProgress(`Scanned ${scanned.toLocaleString()} of ${page.total.toLocaleString()} liked songs…`);
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  let after = null, followed = 0;
  do {
    const page = await api(`/me/following?type=artist&limit=50${after ? `&after=${after}` : ''}`);
    for (const a of page.artists.items) {
      const key = a.name.toLowerCase();
      (artists[key] = artists[key] || {}).followed = true;
      followed++;
    }
    after = page.artists.cursors?.after || null;
    if (onProgress) onProgress(`Scanned library + ${followed} followed artists…`);
  } while (after);
  const map = { clientId: auth().clientId, userId: me.id, fetchedAt: new Date().toISOString(), artists };
  saveLS(LS_LIBMAP, JSON.stringify(map));
  return map;
}

// Every artist name in a festival, lineup + schedule.
export function artistNamesOf(fest) {
  const names = new Set((fest.artists || []).map((a) => a.name));
  for (const day of Object.keys(fest.days || {})) {
    for (const a of (fest.days[day].artists || [])) names.add(a.name);
  }
  return names;
}

// Badge EVERY festival this crew has, in one pass — the thing connecting was
// always supposed to do.
//
// It did not. Scanning badged only the festival you happened to be looking at,
// and then told you so: "Badged 42 artists on this fest. Open other fests to
// badge them too." The app handed the user a chore. Kevin's model — "if I
// connect Spotify it should fill in all my fests, and if I add fests later
// Spotify should just pull" — is the correct one, and this is it (2026-07-12).
//
// Scope is the CREW's festivals, not the whole catalogue: badging all 11 would
// bloat the crew doc toward its 256KB cap for artists nobody is planning to see.
// A festival added later gets badged on the spot (app.js switchFestival), from
// the same cached library — no reconnect, no rescan.
export async function badgeAllCrewFests(myName) {
  const lib = libraryMap();
  if (!lib) throw new Error('Scan your library first.');

  const fids = new Set(Object.keys(state.crewDoc.festivals || {}));
  if (state.activeFestivalId) fids.add(state.activeFestivalId);

  const perFest = {};
  const merged = { ...(state.affinityFor(myName) || {}) };
  let total = 0;

  for (const fid of fids) {
    let fest = FESTIVALS[fid];
    if (!fest) {
      // A festival the crew has but this device has never opened.
      try { await loadFestival(fid); } catch { continue; } // offline: skip, badge it on next open
      fest = FESTIVALS[fid];
      if (!fest) continue;
    }
    let hits = 0;
    for (const name of artistNamesOf(fest)) {
      const aff = affinityOf(lib, name);
      if (!aff) continue;
      merged[name] = aff;
      hits++;
    }
    perFest[fid] = { name: fest.name, hits };
    total += hits;
  }

  // ONE write for the whole sweep, not one per festival.
  state.recordAffinity(myName, merged);
  return { total, perFest };
}

function affinityOf(lib, artistName) {
  const hit = lib.artists[artistName.toLowerCase()];
  if (!hit) return null;
  const aff = {};
  if (hit.songs) aff.songs = Math.min(hit.songs, 99999);
  if (hit.followed) aff.followed = true;
  return Object.keys(aff).length ? aff : null;
}

// Filter the cached library map to every artist across the crew's loaded
// festivals and write it into the crew doc under my name.
export function applyAffinityToCrew(myName, festivalArtistNames) {
  const lib = libraryMap();
  if (!lib) throw new Error('Scan your library first.');
  const out = {};
  for (const name of festivalArtistNames) {
    const hit = lib.artists[name.toLowerCase()];
    if (!hit) continue;
    const aff = {};
    if (hit.songs) aff.songs = Math.min(hit.songs, 99999);
    if (hit.followed) aff.followed = true;
    if (Object.keys(aff).length) out[name] = aff;
  }
  // MERGE with what's already badged — recordAffinity replaces the person's
  // whole map locally, and a per-fest apply must never wipe another fest's
  // badges (SPOT-5). The cached library map means fest switches badge free.
  const merged = { ...(state.affinityFor(myName) || {}), ...out };
  state.recordAffinity(myName, merged);
  return Object.keys(out).length;
}

// ---- playlist from picks ------------------------------------------------------
// Creates the playlist on the CONNECTED MEMBER'S own account.
//
// Endpoint choices matter here: Spotify's February 2026 Development Mode
// changes REMOVED /artists/{id}/top-tracks (no replacement) and
// /users/{id}/playlists, and renamed playlist track-adding to
// /playlists/{id}/items. So tracks come from plain track SEARCH (top hits
// for the artist), creation goes through /me/playlists, and adds go through
// /items. Do not "modernize" these back to the classic endpoints — they 403
// for dev-mode apps. (developer.spotify.com/documentation/web-api/tutorials/
// february-2026-migration-guide)
// tracksPerArtist defaults to 1 — the UI promises "one track per picked
// artist" and the artifact should keep the promise (SPOT-7).
export async function playlistFromPicks({ title, artistNames, tracksPerArtist = 1, onProgress }) {
  const uris = [];
  let misses = 0;
  for (let i = 0; i < artistNames.length; i++) {
    const name = artistNames[i];
    if (onProgress) onProgress(`Finding tracks ${i + 1}/${artistNames.length}: ${name}`);
    try {
      const search = await api(`/search?q=${encodeURIComponent(`artist:"${name}"`)}&type=track&limit=${tracksPerArtist * 3}`);
      const wanted = name.toLowerCase();
      const hits = (search.tracks?.items || [])
        .filter((t) => (t.artists || []).some((a) => a.name.toLowerCase() === wanted));
      const chosen = (hits.length ? hits : (search.tracks?.items || [])).slice(0, tracksPerArtist);
      if (!chosen.length) { misses++; continue; }
      chosen.forEach((t) => uris.push(t.uri));
    } catch (e) { misses++; }
  }
  if (!uris.length) throw new Error('No tracks found for those picks — Spotify search returned nothing (or the crew app lost API access).');
  const createRes = await fetch('https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: title, public: false, description: 'Made with Festival Navigator' }),
  });
  if (!createRes.ok) throw new Error('Playlist creation failed: ' + createRes.status);
  const playlist = await createRes.json();
  for (let i = 0; i < uris.length; i += 100) {
    const addRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    });
    if (!addRes.ok) throw new Error('Adding tracks failed: ' + addRes.status);
  }
  return { url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`, trackCount: uris.length, misses };
}
