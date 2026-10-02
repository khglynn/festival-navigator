// Spotify integration via Authorization Code + PKCE — no client secret, no
// server-held tokens. Each crew brings its own Spotify app Client ID (the
// crew doc's spotify.clientId); each member's tokens live only in their own
// localStorage. Spotify's 2026 rules cap a dev-mode app at 5 allowlisted
// users and require the app OWNER to keep Premium — the setup guide in the
// UI spells this out.
import * as state from './state.js';
import * as crewStore from './crew.js';
import { loadJSON as loadJSONShared, saveLS, removeLS } from './util.js';
import { loadFestival, FESTIVALS } from './festivals.js';
import { track } from './errlog.js';

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
// The value lives in index.html's fn-canonical-host meta (ONE place a fork
// edits — issue #6, Ray Perfetti, 2026-07-24; shipped 2026-08-30). The
// architecture is unchanged and deliberate: Spotify only accepts
// pre-registered exact-match redirect URIs, so every non-canonical host hops.
// The literal is the fallback for Node tests and a stripped <head>.
const CANONICAL_HOST = (typeof document !== 'undefined'
  && document.querySelector('meta[name="fn-canonical-host"]')?.content) || 'fest.kevinhg.com';
export { CANONICAL_HOST };
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
  // The hop carries the ME LINK too: arriving on the canonical host with one
  // crew token and none of the person's other boards is how a whole map
  // "disappears" (Kevin, staging→prod, 2026-07-14). boot() absorbs the person
  // quietly and strips the master key from the URL in the same synchronous
  // frame it uses for any me link.
  const p = crewStore.myPerson();
  return `https://${CANONICAL_HOST}/#g=${token}&f=${state.activeFestivalId}${p ? `&p=${p.token}` : ''}&sp=${sp}`;
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
export function disconnect() { removeLS(LS_AUTH); removeLS(LS_LIBMAP); }
// Drop the cached library but STAY connected — "read it again" re-runs the whole
// sweep (read + badge every festival) without making anyone re-authorise.
export function disconnectLibrary() { removeLS(LS_LIBMAP); }

// ---- PKCE connect -----------------------------------------------------------
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function connect() {
  track('spotify', { action: 'connect_start' });
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

// ---- one way to ask Spotify (v103, 2026-09-26) -------------------------------
// Kevin: "the playlist for everyone only has my likes for artists, not top
// songs for all artists folks have tagged." The crew playlist fires a search
// per artist (~50 at Portola) back to back, and a dev-mode app's rate limit
// (a rolling 30 s window) answers a burst with 429s. The old loop waited on
// `Retry-After` — a header a browser can only read cross-origin when Spotify
// lists it in Access-Control-Expose-Headers — so it fell back to 3 s, gave up
// after five tries, and the playlist's catch quietly kept only your own saved
// tracks. And a real Retry-After can be HOURS in dev mode (Spotify's forum
// reports ~21 h), which the old loop would have slept through.
//
// Every call now goes through `call`:
//   · 429 → wait `Retry-After` when it can be read, else back off 1-2-4-8 s;
//     never sit through one wait past WAIT_CAP_MS, nor more than four — past
//     either, throw SpotifyBusy (the caller stops asking and says so);
//   · a 5xx on a READ → one retry after a second (a dropped connection is
//     not retried: offline, it only delays the person's own "Try again");
//   · a 5xx on a WRITE (a playlist made, tracks added) is never repeated,
//     in any form: Spotify may have done it and failed to say so, and a second
//     try makes a second playlist or doubles the songs (Sol's review of v103).
//     It throws SpotifyUnsure; the run stops there and says what it could
//     confirm, and the next Add new picks dedupes against the live playlist.
//     (Round two read the playlist back and resumed mid-run; round three cut
//     that mechanism — three rounds of holes in one place, V103-BUILD.md.)
//     A 429 on a write still waits and sends it again: a refusal, nothing was done;
//   · anything else not ok → the plain-words error, as before.
// The waits go through `pause`, which a test can swap for a clock of its own.
const WAIT_CAP_MS = 20000;
const BACKOFF_MS = [1000, 2000, 4000, 8000];
const RETRY_MS = 1000;
let pause = (ms) => new Promise((r) => setTimeout(r, ms));
export function setPauseForTests(fn) { pause = fn || ((ms) => new Promise((r) => setTimeout(r, ms))); }

// Spotify said "slow down" for longer than we will wait: the caller stops
// asking for the rest of this run and tells the person to try again later.
export class SpotifyBusy extends Error {
  constructor(waitMs) {
    super('Spotify asked us to slow down — try again in a few minutes.');
    this.name = 'SpotifyBusy';
    this.waitMs = waitMs;
  }
}

// A write Spotify answered with a 5xx: it may or may not have happened.
export class SpotifyUnsure extends Error {
  constructor(path, status) {
    super('Spotify didn’t confirm that — check your Spotify before trying again.');
    this.name = 'SpotifyUnsure';
    this.path = path;
    this.status = status;
  }
}

// Seconds, or an HTTP date — whichever Spotify sent, when the browser lets us
// read it at all. Null when it cannot be read.
export function retryAfterMs(res, now = Date.now()) {
  let v = null;
  try { v = res.headers && typeof res.headers.get === 'function' ? res.headers.get('Retry-After') : null; } catch { v = null; }
  if (v == null || String(v).trim() === '') return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

async function call(path, { method = 'GET', body = null } = {}) {
  let limited = 0;
  let retried = false;
  for (;;) {
    // The token is read each time round (a long wait can outlive it), and
    // before the fetch: an expired session is its own answer ("connect
    // again"), never a blip to try twice.
    const token = await accessToken();
    // A dropped connection (a field's one bar, or a 429 whose answer came back
    // without CORS headers, which a browser reports the same way) rejects
    // here with the browser's TypeError, untouched: it is one attempt, not a
    // retry — offline, a second try only delays the "Try again" a person can
    // press (tests/spotify-scan-progress.test.mjs), and the drill already
    // words a TypeError as "check your signal". A playlist run counts it and
    // stops after a few in a row.
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429) {
      const wait = retryAfterMs(res) ?? BACKOFF_MS[Math.min(limited, BACKOFF_MS.length - 1)];
      if (limited >= BACKOFF_MS.length || wait > WAIT_CAP_MS) {
        console.warn('spotify:', `429 on ${path}, asked to wait ${Math.round(wait / 1000)} s — stopping`);
        throw new SpotifyBusy(wait);
      }
      limited += 1;
      await pause(wait);
      continue;
    }
    if (res.status >= 500 && method !== 'GET') {
      console.warn('spotify:', `${res.status} on ${method} ${path} — not repeated blind`);
      throw new SpotifyUnsure(path, res.status);
    }
    if (res.status >= 500 && !retried) { retried = true; await pause(RETRY_MS); continue; }
    if (!res.ok) {
      throw spotifyError(
        'Spotify isn’t responding right now — try again in a minute.',
        `API ${res.status} on ${path}`,
      );
    }
    if (res.status === 204) return {};
    return await res.json();
  }
}
const api = (path) => call(path);

// ---- library scan -> affinity ------------------------------------------------
// Scans liked songs + followed artists into a device-cached full-library map,
// then filters it to the crew's festival lineups (kept small in the crew doc).
//
// onProgress receives a structured object (not a string): {text, scanned,
// total, artists, finds, cover, phase} — the drill renders a real counter and
// flicks album covers by as pages stream in. `festNames` (a lowercase Set of
// every artist across the crew's fests) is what lets the ticker celebrate a
// FIND ("14 at your fests") and hold fest-relevant covers a beat longer.
// `statsFor` records crew-visible spotifyStats under that member name — the
// 07-12 rebuild dropped this write and nobody's connection was visible to
// their crew (verified live 2026-07-13).
// Usage (v108): the scan's start and how it ended — never what it found.
export async function scanLibrary(onProgress, opts = {}) {
  track('spotify', { action: 'scan_start' });
  try {
    const out = await scanLibraryOnce(onProgress, opts);
    track('spotify', { action: 'scan_done' });
    return out;
  } catch (e) {
    track('spotify', { action: 'scan_fail' });
    throw e;
  }
}
async function scanLibraryOnce(onProgress, { festNames = null } = {}) {
  const me = await api('/me');
  const artists = {}; // lowerName -> {songs, followed}
  // Liked-track URIs for FEST artists only (capped) — what lets a playlist
  // carry the songs you actually saved, not just search's top hits. Fest-only
  // keeps the cache small; it never enters the crew doc.
  const trackUris = {}; // lowerName -> [spotify:track:...]
  let url = '/me/tracks?limit=50', scanned = 0, likedTotal = 0, finds = 0;
  const seenFinds = new Set();
  while (url) {
    const page = await api(url);
    likedTotal = page.total || likedTotal;
    let cover = null, festCover = null;
    for (const item of page.items) {
      const imgs = item.track?.album?.images || [];
      const img = imgs.length ? imgs[imgs.length - 1].url : null; // smallest
      if (img && !cover) cover = img;
      for (const a of (item.track?.artists || [])) {
        const key = a.name.toLowerCase();
        (artists[key] = artists[key] || { songs: 0 }).songs++;
        if (festNames && festNames.has(key)) {
          if (item.track?.uri) {
            (trackUris[key] = trackUris[key] || []);
            if (trackUris[key].length < 10) trackUris[key].push(item.track.uri);
          }
          if (!seenFinds.has(key)) {
            seenFinds.add(key); finds++;
            if (img) festCover = img;
          }
        }
      }
    }
    scanned += page.items.length;
    if (onProgress) {
      onProgress({
        phase: 'likes', scanned, total: likedTotal,
        artists: Object.keys(artists).length, finds,
        cover: festCover || cover, coverIsFind: !!festCover,
        text: `${scanned.toLocaleString()} of ${likedTotal.toLocaleString()} liked songs`,
      });
    }
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  let after = null, followed = 0;
  do {
    const page = await api(`/me/following?type=artist&limit=50${after ? `&after=${after}` : ''}`);
    let cover = null, festCover = null;
    for (const a of page.artists.items) {
      const key = a.name.toLowerCase();
      (artists[key] = artists[key] || {}).followed = true;
      followed++;
      const imgs = a.images || [];
      const img = imgs.length ? imgs[imgs.length - 1].url : null;
      if (img && !cover) cover = img;
      if (festNames && festNames.has(key)) {
        if (!seenFinds.has(key)) { seenFinds.add(key); finds++; }
        if (img) festCover = img;
      }
    }
    after = page.artists.cursors?.after || null;
    if (onProgress) {
      onProgress({
        phase: 'follows', scanned, total: likedTotal,
        artists: Object.keys(artists).length, followed, finds,
        cover: festCover || cover, coverIsFind: !!festCover,
        text: `${followed} followed artists`,
      });
    }
  } while (after);
  const map = { clientId: auth().clientId, userId: me.id, fetchedAt: new Date().toISOString(), artists, trackUris };
  saveLS(LS_LIBMAP, JSON.stringify(map));
  // Stats are RETURNED, not recorded here: the caller must decide whether the
  // crew this scan started on is still the crew on screen (a scan spans
  // minutes; recording blindly is how "Kevin HG" ghost-stats landed on a crew
  // he isn't in, live 2026-07-13).
  map.stats = {
    likedCount: likedTotal,
    artistCount: Object.keys(artists).length,
    lastSynced: map.fetchedAt,
    user: me.id,
  };
  return map;
}

// My saved tracks for one artist, from the scan cache (fest artists only).
export function likedUrisOf(artistName) {
  const lib = libraryMap();
  return lib?.trackUris?.[artistName.toLowerCase()] || [];
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

  // ONE write for the whole sweep, not one per festival — and NO write when
  // nothing changed (this also runs at every crew activation now; identical
  // re-writes would be pure sync churn).
  const before = state.affinityFor(myName) || {};
  const changed = JSON.stringify(merged) !== JSON.stringify(before);
  if (changed) state.recordAffinity(myName, merged);
  return { total, perFest, changed };
}

function affinityOf(lib, artistName) {
  const hit = lib.artists[artistName.toLowerCase()];
  if (!hit) return null;
  const aff = {};
  if (hit.songs) aff.songs = Math.min(hit.songs, 99999);
  if (hit.followed) aff.followed = true;
  return Object.keys(aff).length ? aff : null;
}

// Who may this sweep write as, in this crew? The answer comes from the PERSON
// RECORD's own claim — never crewStore.me(), which is the device's mutable
// picker and can be a switched shared-phone identity (Codex round 4, P1).
// The fetched doc must agree: the claimed name exists, is active, and — when
// the entry carries a pid — it is OURS. Ambiguity means skip, never guess.
export function sweepIdentityFor(person, crewToken, doc) {
  const claim = person && (person.crews || {})[crewToken];
  const myName = claim && claim.name;
  if (!myName) return null;
  const entry = doc && (doc.people || {})[myName];
  if (!entry || entry.removed) return null;
  if (entry.pid && person.id && entry.pid !== person.id) return null; // someone else's name now
  return myName;
}

// Fest-first (2026-07-14): every board is its own circle, so "connect once,
// everything fills in" must reach across CREWS, not just across the active
// crew's fests. For each crew the PERSON RECORD claims a name in: fetch the
// doc, compute my affinity for its fests' artists, POST ONLY the sparse
// leaves this sweep discovered — never a re-spray of the fetched map, which
// would replay stale values over a concurrent scan's newer ones (leaf-level
// last-write-wins). The POST goes DIRECT: state.pendingChanges belongs to
// the ACTIVE crew only, and a cross-crew write must never ride it (the
// sync.js wrong-crew rule). The active crew keeps its richer local path
// (badgeAllCrewFests). Crew-private (AI-added) fests in other crews are
// skipped, and every skipped/failed board self-heals via the enterApp
// per-open sweep — that backstop is the retry mechanism, and the caller's
// copy says so instead of claiming a clean sweep.
export async function badgeEveryKnownCrew(onProgress) {
  const lib = libraryMap();
  const person = crewStore.myPerson();
  if (!lib || !person) return { crews: 0, skipped: 0 };
  const activeToken = state.getCrewToken(); // captured ONCE — a mid-sweep crew switch must not re-scope the loop
  let crews = 0;
  let skipped = 0;
  for (const c of crewStore.knownCrews()) {
    if (c.token === activeToken) continue; // active crew: badgeAllCrewFests owns it
    try {
      const doc = await crewStore.fetchCrew(c.token);
      if (!doc) { skipped++; continue; }
      const myName = sweepIdentityFor(person, c.token, doc);
      if (!myName) { skipped++; continue; }
      const existing = (doc.affinity || {})[myName] || {};
      const out = {};
      let loadFailed = false; // a fest we couldn't read is a PARTIAL sweep, not a clean no-op
      for (const fid of Object.keys(doc.festivals || {})) {
        let fest = FESTIVALS[fid];
        if (!fest) {
          try { await loadFestival(fid); } catch { loadFailed = true; continue; }
          fest = FESTIVALS[fid];
          if (!fest) { loadFailed = true; continue; }
        }
        for (const name of artistNamesOf(fest)) {
          const aff = affinityOf(lib, name);
          if (aff && JSON.stringify(existing[name]) !== JSON.stringify(aff)) out[name] = aff;
        }
      }
      if (!Object.keys(out).length) {
        if (loadFailed) skipped++; // report it — the per-open sweep is the retry
        continue;
      }
      const res = await fetch(`/api/crew?t=${encodeURIComponent(c.token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { affinity: { [myName]: out } }, sv: 4 }),
      });
      if (res.ok) { crews++; if (onProgress) onProgress({ crews, crewName: c.name }); }
      else skipped++;
    } catch { skipped++; }
  }
  return { crews, skipped };
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
// tracksPerArtist defaults to 3 + the maker's own saved tracks per artist —
// "always top 3 + any likes" (Kevin, 2026-07-13; supersedes SPOT-7's
// one-track promise — the UI copy moved with it).
// Per artist: their top tracks by search PLUS every track of theirs you
// actually saved (from the scan cache), deduped. "Always top 3 + any likes"
// — Kevin's spec, 2026-07-13. Liked tracks lead so the playlist opens with
// the songs you know.
//
// v103: searches are PACED (one at a time, SEARCH_GAP_MS apart — a burst is
// what drew the 429s), and what could not be searched is COUNTED and handed
// back, never swallowed: `unsearched` names every artist whose top songs could
// not be fetched (Spotify busy past our wait, or down). Their saved tracks
// still go in, but they are left out of `found` — the crew playlist's ledger —
// so the next "Add new picks" tries their top songs again (the live
// playlist's own tracks dedupe what is already there). Once Spotify says
// "busy" past our wait — or fails three searches in a row — the run stops
// asking: every artist after it is unsearched, and the person is told how many.
const SEARCH_GAP_MS = 250;
const SEARCH_LIMIT_MAX = 10; // Spotify's dev-mode max for /search (February 2026 migration guide)
async function findTrackUris(artistNames, tracksPerArtist, onProgress) {
  const uris = [];
  const found = [];
  const unsearched = [];
  const topless = [];
  const byArtist = new Map(); // name → the songs it brought (to say which landed)
  let busy = null;
  let down = 0; // failures in a row that were not "busy" (Spotify down, no connection)
  let last = 0;
  const limit = Math.max(1, Math.min(SEARCH_LIMIT_MAX, tracksPerArtist * 3));
  for (let i = 0; i < artistNames.length; i++) {
    const name = artistNames[i];
    if (onProgress) onProgress({ i: i + 1, of: artistNames.length, name });
    const liked = likedUrisOf(name);
    let top = null; // null: not searched (busy, down); []: searched, nothing
    if (!busy && down < 3) {
      if (last) await pause(Math.max(0, SEARCH_GAP_MS - (Date.now() - last)));
      try {
        const search = await api(`/search?q=${encodeURIComponent(`artist:"${name}"`)}&type=track&limit=${limit}`);
        const wanted = name.toLowerCase();
        const hits = (search.tracks?.items || [])
          .filter((t) => (t.artists || []).some((a) => a.name.toLowerCase() === wanted));
        top = (hits.length ? hits : (search.tracks?.items || [])).slice(0, tracksPerArtist).map((t) => t.uri);
        down = 0;
      } catch (e) {
        if (e && e.name === 'SpotifyBusy') busy = e;
        else down += 1; // three in a row and the run stops asking
        console.warn('spotify: search', name, e && e.message);
      }
      last = Date.now();
    }
    const mine = new Set(liked);
    const combined = [...liked, ...(top || []).filter((u) => !mine.has(u))];
    uris.push(...combined);
    byArtist.set(name, combined);
    if (top === null) { unsearched.push(name); continue; }
    // Searched, and Spotify has no top songs for them (a local DJ, a name
    // it spells differently): your saved tracks still go in, but the artist
    // is not done — it stays off the ledger, so Add new picks looks again,
    // and it is counted, never folded into "already has everyone's picks"
    // (Sol's review of v103: saved tracks used to mark it complete).
    if (!top.length) { topless.push(name); continue; }
    found.push(name);
  }
  // A track two picked artists share (a collab) goes in once.
  return { uris: [...new Set(uris)], found, misses: topless.length, topless, unsearched, busy: !!busy, byArtist };
}

// The sentence a person reads about the artists whose top songs did not
// come (v103: said, never a silent fallback). `again` is what to press.
export function unsearchedNote(unsearched, { again = '' } = {}) {
  const n = (unsearched || []).length;
  if (!n) return '';
  return `${n} artist${n === 1 ? '' : 's'} had no songs found — ${again ? `${again} later` : 'try again later'}.`;
}
// …and about the artists Spotify answered for with no top songs at all.
// `again`: what looks again (Add new picks, for a crew playlist).
export function toplessNote(topless, { again = '' } = {}) {
  const n = (topless || []).length;
  if (!n) return '';
  return `${n} artist${n === 1 ? '' : 's'} had no top songs on Spotify${again ? ` — ${again}` : ''}.`;
}

// Every track URI already in the playlist — the append-side dedupe. Reads
// live items (paginated) so manual edits and other members' adds count.
async function playlistTrackUris(playlistId) {
  const have = new Set();
  let path = `/playlists/${playlistId}/items?limit=100&fields=items(track(uri)),next`;
  while (path) {
    const page = await api(path);
    for (const it of (page.items || [])) if (it.track?.uri) have.add(it.track.uri);
    path = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return have;
}

// Adds in batches of a hundred, in order. Any failure stops it — a 5xx is
// never repeated (it may have landed) — and the error says how many songs
// were confirmed before it (`confirmed`), for the caller to say which artists
// are in.
async function pushTracks(playlistId, uris) {
  for (let i = 0; i < uris.length; i += 100) {
    try {
      await call(`/playlists/${playlistId}/items`, { method: 'POST', body: { uris: uris.slice(i, i + 100) } });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      err.confirmed = i;
      throw err;
    }
  }
}

// `collaborative` is what makes the crew-shared "Everyone" playlist work:
// Spotify only lets OTHER members' tokens append to a playlist they don't own
// when it's collaborative (and collab requires public:false). Solo "Just mine"
// playlists stay plain private.
// An add that fails after the create throws with `.playlist` ({ id, url })
// and `.confirmed` (the found artists whose every song landed before the
// failure) on the error: the caller records the playlist then, once, with
// those — never mid-run — and the next Add new picks finishes it (Sol's
// round 3 on v103).
export async function playlistFromPicks({ title, artistNames, tracksPerArtist = 3, collaborative = false, onProgress }) {
  track('spotify', { action: 'playlist_make' });
  const { uris, found, misses, topless, unsearched, busy, byArtist } = await findTrackUris(artistNames, tracksPerArtist, onProgress);
  if (!uris.length) {
    // Nothing came back at all. Spotify being busy (or down) is not the same
    // as a lineup it does not know — say which, and make no empty playlist.
    if (unsearched.length) throw new Error(busy ? 'Spotify asked us to slow down — try again in a few minutes.' : 'Spotify isn’t responding right now — try again in a minute.');
    throw new Error('No tracks found for those picks — Spotify search returned nothing (or the crew app lost API access).');
  }
  // A create is never repeated: after an unsure answer the playlist may be
  // in their Spotify already, and a second press is theirs to make.
  let playlist;
  try {
    playlist = await call('/me/playlists', {
      method: 'POST',
      body: { name: title, public: false, collaborative: !!collaborative, description: 'Made with Festival Navigator' },
    });
  } catch (e) {
    if (e && e.name === 'SpotifyUnsure') throw new Error('Spotify didn’t confirm the playlist — check your Spotify before making another.');
    throw e;
  }
  const made = { id: playlist.id, url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}` };
  try {
    await pushTracks(playlist.id, uris);
  } catch (e) {
    console.warn('spotify: adding to a new playlist', e && e.message);
    const landed = new Set(uris.slice(0, (e && e.confirmed) || 0));
    const err = new Error('Spotify made the playlist but didn’t confirm every song.');
    err.playlist = made;
    err.confirmed = found.filter((a) => (byArtist.get(a) || []).every((u) => landed.has(u)));
    throw err;
  }
  return { ...made, trackCount: uris.length, misses, found, topless, unsearched };
}

// The artists a playlist made from picks holds, strongest pick first (musts
// lead): everyone's picks, or `me`'s alone for "Just mine". `skip` is the
// fest's cancelled acts (events.js cancelledNames, 2026-09-23) — their picks
// stay on their cards, but nobody is going to hear that set. One function for
// the Make button and the crew top-up, so the two can never disagree.
export function playlistArtistsFromPicks(picks, { me = null, skip = new Set() } = {}) {
  return Object.entries(picks || {})
    .map(([artist, byP]) => ({ artist, level: me ? (byP[me] || 0) : Math.max(0, ...Object.values(byP)) }))
    .filter((x) => x.level > 0 && !skip.has(x.artist))
    .sort((a, b) => b.level - a.level)
    .map((x) => x.artist);
}

// Append tracks for artists that aren't in the crew playlist yet — the
// auto-extend path when a member connects later or picks change. The diff is
// computed against the crew doc's recorded artist list (not Spotify's items —
// cheaper, and resilient to manual playlist edits).
export async function addArtistsToPlaylist({ playlistId, artistNames, tracksPerArtist = 3, onProgress }) {
  track('spotify', { action: 'playlist_make' });
  if (!artistNames.length) return { added: 0, misses: 0, found: [], unsearched: [], topless: [] };
  const { uris, found, misses, topless, unsearched } = await findTrackUris(artistNames, tracksPerArtist, onProgress);
  if (!uris.length) return { added: 0, misses, found, unsearched, topless };
  // Track-level dedupe against the LIVE playlist — the ledger dedupes
  // artists, but two members can both like the same song (and an artist
  // tried again after a busy run already has its saved tracks in).
  const have = await playlistTrackUris(playlistId);
  const fresh = uris.filter((u) => !have.has(u));
  if (fresh.length) await pushTracks(playlistId, fresh);
  return { added: fresh.length, misses, found, unsearched, topless };
}

// Pure diff helper (unit-tested): which currently-picked artists are missing
// from the playlist's recorded artist list?
export function playlistMissingArtists(pickedNames, meta) {
  const have = new Set((meta?.artists || []).map((n) => n.toLowerCase()));
  return pickedNames.filter((n) => !have.has(n.toLowerCase()));
}
