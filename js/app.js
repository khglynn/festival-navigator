// App entry: boot flow (landing -> join -> main), wiring, festival switching.
// Everything DOM-event-shaped lives here; rendering and state live in their
// own modules.
import * as state from './state.js';
import * as crew from './crew.js';
import { loadFestivalIndex, loadFestival, FESTIVAL_INDEX } from './festivals.js';
import { initSync, setSyncStatus, scheduleSync, pushSync, pollSync } from './sync.js';
import { renderPeople as renderPeopleView } from './render/people.js';
import { renderDay, updateArtistHighlight } from './render/grid.js';
import { renderList, resetListState } from './render/list.js';
import { wireModals, openInfoModal } from './ui.js';
import { getArtistInfo, solveConflicts } from './ai.js';
import { downloadSchedule, handleBulkAdd, exportLikes } from './tools.js';
import * as spotify from './spotify.js';

// Mirrors the server's SAFE_NAME_RE (api/_lib/crew-shared.mjs) so users get
// a friendly message instead of a 400.
const NAME_RE = /^[^\x00-\x1f<>"'`&\\]{1,24}$/;
function validName(name) { return NAME_RE.test(name) && name.trim() === name && name.length > 0; }

const peopleCallbacks = { onSelect: selectPerson, onRemove: removePerson, onAdd: addPerson };
function renderPeople() { renderPeopleView(peopleCallbacks); }

// ---- view dispatch (grid for scheduled festivals, list otherwise) -----------
let viewMode = 'grid'; // per-festival session preference; reset on switch

function festHasSchedule() {
  const f = state.fest();
  return !!f.days && Object.keys(f.days).length > 0;
}

function renderCurrentView() {
  const scheduled = festHasSchedule();
  const showGrid = scheduled && viewMode === 'grid';
  document.getElementById('grid-container').classList.toggle('hidden', !showGrid);
  document.getElementById('day-box').classList.toggle('hidden', !showGrid);
  document.getElementById('list-view').classList.toggle('hidden', showGrid);
  const toggle = document.getElementById('view-toggle-btn');
  toggle.classList.toggle('hidden', !scheduled);
  toggle.textContent = showGrid ? 'List' : 'Grid';
  if (showGrid) renderDay(state.currentDay || Object.keys(state.fest().days)[0]);
  else renderList();
}

function refreshView() {
  renderPeople();
  renderCrewBar();
  renderSpotifyPanel();
  renderCurrentView();
}

// ---- view switching ---------------------------------------------------------
const show = (id, on) => document.getElementById(id).classList.toggle('hidden', !on);

function showLanding(message) {
  show('landing-view', true); show('join-view', false); show('main-view', false);
  document.getElementById('landing-message').textContent = message || '';
}

function showJoin(token, fetchedDoc) {
  show('landing-view', false); show('join-view', true); show('main-view', false);
  // Offline or transient failure: fall back to the locally-cached copy so the
  // join screen shows real people, and so a join never overwrites a richer
  // cached doc with an empty stub.
  const doc = fetchedDoc || state.cachedDoc(token) || { meta: {}, people: {} };
  document.getElementById('join-crew-name').textContent = (doc.meta && doc.meta.name) || 'this crew';
  const holder = document.getElementById('join-people');
  holder.innerHTML = '';
  Object.entries(doc.people || {}).filter(([, p]) => p && !p.removed).forEach(([name, { color }]) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.className = 'font-semibold py-2 px-4 rounded-full border-2 transition';
    btn.style.backgroundColor = `rgba(${color}, 0.4)`;
    btn.style.borderColor = `rgba(${color}, 0.7)`;
    btn.onclick = () => { crew.setMe(token, name); enterApp(token, doc); };
    holder.appendChild(btn);
  });
  document.getElementById('join-add-btn').onclick = () => {
    const name = (document.getElementById('join-name-input').value || '').trim();
    if (!validName(name)) { alert('Names can be up to 24 characters with no <, >, quotes or backslashes.'); return; }
    const existing = doc.people && doc.people[name];
    if (existing && !existing.removed) { crew.setMe(token, name); enterApp(token, doc); return; }
    state.activateCrew(token, doc);
    const color = (existing && existing.color) || state.nextColor(state.people());
    state.people()[name] = { color, removed: false };
    state.recordPerson(name, { color, removed: false });
    state.persist();
    crew.setMe(token, name);
    enterApp(token, state.crewDoc);
    scheduleSync();
  };
}

// Push the OUTGOING crew's queued edits before switching away — the sync
// debounce timer is global, so without this a pick made right before a crew
// switch would sit unsynced (safe in localStorage, but invisible to the crew)
// until this device reopened that crew.
async function flushOutgoingCrew() {
  const token = state.getCrewToken();
  if (!token || !state.hasPending()) return;
  const pending = state.pendingChanges;
  try {
    const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: pending }),
    });
    if (res.ok) state.clearCachedPending(token);
  } catch (e) { /* stays in localStorage; re-pushed when this crew is reopened */ }
}

async function enterApp(token, doc) {
  if (state.getCrewToken() && state.getCrewToken() !== token) await flushOutgoingCrew();
  show('landing-view', false); show('join-view', false); show('main-view', true);
  crew.setActiveCrew(token);
  state.activateCrew(token, doc);
  await loadFestival(state.activeFestivalId);
  state.persist();
  const my = crew.me(token);
  if (my && state.isActivePerson(state.people()[my])) state.setSelectedPerson(my);
  viewMode = 'grid';
  resetListState();
  renderFestivalSelect();
  applyTheme();
  renderPeople();
  renderDayTabs();
  renderCrewBar();
  renderSpotifyPanel();
  applyAffinityForActiveFestival();
  renderCurrentView();
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  pollSync();
  if (state.hasPending()) scheduleSync();
}

// ---- crew bar (bottom controls) ----------------------------------------------
function renderCrewBar() {
  const sel = document.getElementById('crew-select');
  const crews = crew.knownCrews();
  sel.innerHTML = '';
  crews.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.token; opt.textContent = c.name || 'Unnamed crew';
    if (c.token === state.getCrewToken()) opt.selected = true;
    sel.appendChild(opt);
  });
  const newOpt = document.createElement('option');
  newOpt.value = '__new__'; newOpt.textContent = '+ New crew…';
  sel.appendChild(newOpt);
}

async function onCrewSelect(e) {
  const v = e.target.value;
  if (v === '__new__') { showLanding(); return; }
  if (v === state.getCrewToken()) return;
  const doc = await crew.fetchCrew(v).catch(() => null);
  if (!crew.me(v)) { showJoin(v, doc); return; }
  // null doc -> activateCrew falls back to the locally-cached copy.
  enterApp(v, doc);
}

function shareCrew() {
  const link = crew.crewLink(state.getCrewToken());
  const name = state.crewName();
  if (navigator.share) {
    navigator.share({ title: `${name} · Festival Navigator`, url: link }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(link).then(() => {
    openInfoModal(`<h2 class="text-xl font-bold accent-text mb-2">Crew link copied</h2><p class="text-gray-300 mb-2">Send it to your crew — opening the link joins <strong>${name.replace(/[<>&]/g, '')}</strong> on any device.</p><p class="text-xs text-gray-500 break-all">${link}</p>`);
  }).catch(() => {
    openInfoModal(`<h2 class="text-xl font-bold accent-text mb-2">Crew link</h2><p class="text-xs text-gray-400 break-all">${link}</p>`);
  });
}

// ---- Spotify panel --------------------------------------------------------------
function myName() { return crew.me(state.getCrewToken()); }

function applyAffinityForActiveFestival() {
  const me = myName();
  if (!me || !spotify.isConnected() || !spotify.libraryMap()) return;
  const names = (state.fest().artists || []).map((a) => a.name);
  if (!names.length) return;
  const n = spotify.applyAffinityToCrew(me, names);
  if (n) { state.persist(); scheduleSync(); }
}

function renderSpotifyPanel() {
  const panel = document.getElementById('spotify-panel');
  const status = document.getElementById('spotify-status');
  const hint = document.getElementById('spotify-redirect-hint');
  if (hint) hint.textContent = `${location.origin}/spotify-callback`;
  panel.innerHTML = '';
  const btn = (label, onclick, extraCls = '') => {
    const b = document.createElement('button');
    b.textContent = label; b.className = 'accent-button ' + extraCls; b.onclick = onclick;
    panel.appendChild(b);
    return b;
  };

  const clientId = state.spotifyClientId();
  if (!clientId) {
    status.textContent = '· not set up for this crew yet';
    const input = document.createElement('input');
    input.placeholder = 'Crew Spotify app Client ID';
    input.className = 'p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm w-72';
    panel.appendChild(input);
    btn('Save', () => {
      const v = input.value.trim();
      if (!/^[0-9a-fA-F]{32}$/.test(v)) { alert('That does not look like a Spotify Client ID (32 hex characters).'); return; }
      state.crewDoc.spotify = { clientId: v };
      state.recordSpotifyClientId(v);
      state.persist(); scheduleSync();
      renderSpotifyPanel();
    });
    return;
  }

  if (!spotify.isConnected()) {
    status.textContent = '· crew app ready';
    btn('Connect my Spotify', () => spotify.connect().catch((e) => alert(e.message)));
    return;
  }

  status.textContent = spotify.libraryMap()
    ? `· connected (library scanned ${new Date(spotify.libraryMap().fetchedAt).toLocaleDateString()})`
    : '· connected';

  btn(spotify.libraryMap() ? 'Rescan my likes' : 'Scan my likes', async () => {
    openInfoModal(`<h2 class="text-xl font-bold accent-text mb-2">Scanning your Spotify library</h2><p id="scan-progress" class="text-gray-300">Starting…</p><p class="text-xs text-gray-500 mt-2">Big libraries take a few minutes — leave this open.</p>`);
    try {
      await spotify.scanLibrary((msg) => { const el = document.getElementById('scan-progress'); if (el) el.textContent = msg; });
      applyAffinityForActiveFestival();
      openInfoModal(`<h2 class="text-xl font-bold accent-text mb-2">Library scanned ✓</h2><p class="text-gray-300">Artists you listen to now show a <span style="color:#1DB954">★/♥</span> badge on this festival's lineup — and on any festival you open next.</p>`);
      refreshView();
    } catch (e) { openInfoModal(`<h2 class="text-xl font-bold text-red-400 mb-2">Scan failed</h2><p class="text-gray-300">${e.message}</p>`); }
  });

  btn('Playlist from picks…', () => openPlaylistBuilder());
  btn('Disconnect', () => { spotify.disconnect(); renderSpotifyPanel(); }, '!bg-gray-600 !text-gray-200');
}

function openPlaylistBuilder() {
  const fest = state.fest();
  openInfoModal(`
    <h2 class="text-xl font-bold accent-text mb-3">Playlist from picks</h2>
    <div class="flex flex-col gap-3 text-gray-200">
      <label class="flex items-center justify-between gap-3">Whose picks
        <select id="pl-scope" class="bg-gray-700 rounded p-2 text-sm"><option value="me">Just mine</option><option value="crew" selected>Whole crew</option></select>
      </label>
      <label class="flex items-center justify-between gap-3">Which picks
        <select id="pl-level" class="bg-gray-700 rounded p-2 text-sm"><option value="1" selected>Everything picked</option><option value="3">Must See and up</option><option value="2">Highlights only</option></select>
      </label>
      <label class="flex items-center justify-between gap-3">Tracks per artist
        <select id="pl-tracks" class="bg-gray-700 rounded p-2 text-sm"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select>
      </label>
      <button id="pl-create" class="accent-button">Create on my Spotify</button>
      <p id="pl-progress" class="text-sm text-gray-400"></p>
    </div>`);
  document.getElementById('pl-create').onclick = async () => {
    const scope = document.getElementById('pl-scope').value;
    const minLevel = Number(document.getElementById('pl-level').value);
    const tracksPerArtist = Number(document.getElementById('pl-tracks').value);
    const me = myName();
    const qualifies = (lvl) => minLevel === 1 ? lvl >= 1 : minLevel === 3 ? (lvl === 3 || lvl === 2) : lvl === 2;
    const artistNames = Object.entries(state.selections())
      .filter(([, byPerson]) => Object.entries(byPerson).some(([p, lvl]) =>
        qualifies(lvl) && state.isActivePerson(state.people()[p]) && (scope === 'crew' || p === me)))
      .map(([artist]) => artist);
    if (!artistNames.length) { document.getElementById('pl-progress').textContent = 'No picks match those filters yet.'; return; }
    document.getElementById('pl-create').disabled = true;
    try {
      const title = `${state.crewName()} · ${fest.name} ${fest.year || ''}`.trim();
      const result = await spotify.playlistFromPicks({
        title, artistNames, tracksPerArtist,
        onProgress: (m) => { const el = document.getElementById('pl-progress'); if (el) el.textContent = m; },
      });
      openInfoModal(`<h2 class="text-xl font-bold accent-text mb-2">Playlist created 🎧</h2><p class="text-gray-300 mb-3">${result.trackCount} tracks from ${artistNames.length} artists${result.misses ? ` (${result.misses} artists not found on Spotify)` : ''}.</p><a href="${result.url}" target="_blank" class="accent-button inline-block">Open in Spotify</a>`);
    } catch (e) {
      const el = document.getElementById('pl-progress');
      if (el) el.textContent = 'Failed: ' + e.message;
      document.getElementById('pl-create').disabled = false;
    }
  };
}

// ---- crew management ----------------------------------------------------------
function addPerson() {
  const name = (prompt('Add a person to the crew:') || '').trim();
  if (!name) return;
  if (!validName(name)) { alert('Names can be up to 24 characters with no <, >, quotes or backslashes.'); return; }
  const existing = state.people()[name];
  if (existing && !existing.removed) { alert(`${name} is already on the list.`); return; }
  const color = (existing && existing.color) ? existing.color : state.nextColor(state.people());
  // removed:false is an explicit value the deep-merge can carry — it overwrites
  // any remote tombstone, so a re-added person doesn't vanish on the next pull.
  state.people()[name] = { color, removed: false };
  state.recordPerson(name, { color, removed: false });
  state.persist(); scheduleSync();
  renderPeople();
}

function removePerson(name) {
  if (!confirm(`Remove ${name} from the crew? This clears their picks for everyone.`)) return;
  const existing = state.people()[name] || {};
  state.people()[name] = { ...existing, removed: true }; // tombstone so the removal syncs to the crew
  state.recordPerson(name, { ...existing, removed: true });
  // Zero out their picks across ALL the crew's festivals; level 0 is a value
  // deep-merge can carry (unlike a delete).
  const fids = Object.keys(state.crewDoc.festivals || {});
  fids.forEach((fid) => {
    const sels = (state.crewDoc.festivals[fid] || {}).selections || {};
    Object.keys(sels).forEach((artist) => {
      if (sels[artist][name] > 0) {
        sels[artist][name] = 0;
        state.recordSelectionFor(fid, artist, name, 0);
      }
    });
  });
  if (state.selectedPerson === name) state.setSelectedPerson(null);
  state.persist(); scheduleSync();
  renderPeople(); renderDay(state.currentDay);
}

function selectPerson(name) {
  state.setSelectedPerson(state.selectedPerson === name ? null : name);
  renderPeople();
}

function handleArtistClick(artistName) {
  if (!state.selectedPerson) { getArtistInfo(artistName); return; }
  const sel = (state.selections()[artistName] = state.selections()[artistName] || {});
  const cur = sel[state.selectedPerson] || 0;
  let next;
  if (cur === 0) next = 1;       // Nice to See
  else if (cur === 1) next = 3;  // Must See
  else if (cur === 3) next = 2;  // Highlight
  else next = 0;                 // remove
  sel[state.selectedPerson] = next;
  state.recordSelection(artistName, state.selectedPerson, next);
  state.persist();
  updateArtistHighlight(artistName);
  scheduleSync();
}

// ---- festival switching --------------------------------------------------------
function applyTheme() {
  const fest = state.fest();
  document.documentElement.style.setProperty('--accent', fest.accent || '16, 185, 129');
  const yr = fest.year ? `<span class="fest-year">${fest.year}</span>` : '';
  document.getElementById('fest-name').innerHTML = fest.name.toUpperCase() + yr;
  document.getElementById('fest-subtitle').textContent = fest.subtitle || '';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', '#111827');
}

function renderFestivalSelect() {
  const sel = document.getElementById('festival-select');
  sel.innerHTML = '';
  FESTIVAL_INDEX.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.status === 'archived' ? `${f.name} ${f.year || ''} (past)` : `${f.name} ${f.year || ''}`;
    if (f.id === state.activeFestivalId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderDayTabs() {
  const container = document.getElementById('day-tabs');
  container.innerHTML = '';
  const fest = state.fest();
  if (!fest.days) return;
  const meta = fest.dayMeta || {};
  Object.keys(fest.days).forEach(day => {
    const dm = meta[day];
    const btn = document.createElement('button');
    btn.dataset.day = day;
    btn.className = 'day-tab relative font-semibold py-2 px-5 rounded-md transition-colors duration-200 bg-gray-700 hover:opacity-80';
    if (dm) btn.innerHTML = `${dm.wd}<span class="day-num">${dm.num}</span>`;
    else btn.textContent = day;
    btn.onclick = () => renderDay(day);
    container.appendChild(btn);
  });
}

async function switchFestival(fid) {
  if (!FESTIVAL_INDEX.some(f => f.id === fid)) return;
  try { await loadFestival(fid); }
  catch (e) { alert('Could not load that festival (offline and not cached yet).'); renderFestivalSelect(); return; }
  state.setActiveFestivalId(fid);
  state.ensureFestivalState(fid);
  state.setCurrentDay(null);
  viewMode = 'grid';
  resetListState();
  applyTheme();
  renderPeople();
  renderDayTabs();
  applyAffinityForActiveFestival(); // badge the new lineup from the cached library scan
  renderCurrentView();
  pollSync();
}

// ---- boot ----------------------------------------------------------------------
// Guards overlapping boots (e.g. back/forward between two crew links): only
// the newest boot() is allowed to change what's on screen — a slower, earlier
// fetch resolving late must not swap the view back to a stale crew.
let bootGeneration = 0;

async function boot() {
  const gen = ++bootGeneration;
  const current = () => gen === bootGeneration;
  try { await loadFestivalIndex(); }
  catch (e) {
    if (current()) showLanding('Could not load festival data — are you offline? Try again once connected.');
    return;
  }
  const hashToken = crew.tokenFromHash();
  if (hashToken) {
    let doc = null;
    try { doc = await crew.fetchCrew(hashToken); }
    catch (e) { /* offline with a link: fall through to cached copy */ }
    if (!current()) return;
    if (!doc) {
      const known = crew.knownCrews().some((c) => c.token === hashToken);
      if (!known) { showLanding('That crew link does not work (or you are offline). Create a crew or try again.'); return; }
    } else {
      crew.rememberCrew(hashToken, (doc.meta && doc.meta.name) || '');
    }
    if (!crew.me(hashToken)) { showJoin(hashToken, doc); return; }
    enterApp(hashToken, doc);
    return;
  }
  const active = crew.activeCrewToken();
  if (!current()) return;
  if (active) { enterApp(active, null); pollSync(); return; }
  showLanding();
}

function wireStatic() {
  wireModals();
  initSync({
    onRemoteChange: refreshView,
    onCrewGone: (goneToken) => {
      // Only evict the crew the 404 was actually about; a stale response for
      // a crew we already switched away from must not nuke the active one.
      crew.forgetCrew(goneToken);
      if (goneToken === state.getCrewToken()) showLanding('That crew no longer exists.');
      else renderCrewBar();
    },
  });

  document.getElementById('schedule-view').addEventListener('click', (e) => {
    const card = e.target.closest('.artist-card');
    if (card) handleArtistClick(card.dataset.artist);
  });
  document.getElementById('list-view').addEventListener('click', (e) => {
    const row = e.target.closest('.list-artist');
    if (row) { handleArtistClick(row.dataset.artist); renderList(); }
  });
  document.getElementById('view-toggle-btn').onclick = () => {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    renderCurrentView();
  };
  document.getElementById('festival-select').onchange = (e) => switchFestival(e.target.value);
  document.getElementById('crew-select').onchange = onCrewSelect;
  document.getElementById('share-crew-btn').onclick = shareCrew;
  document.getElementById('conflict-solver-btn').onclick = solveConflicts;
  document.getElementById('download-btn').onclick = downloadSchedule;
  document.getElementById('top-download-btn').onclick = downloadSchedule;
  document.getElementById('bulk-add-btn').onclick = handleBulkAdd;
  document.getElementById('export-likes-btn').onclick = exportLikes;
  document.getElementById('refresh-btn').onclick = pollSync;
  window.addEventListener('online', () => { setSyncStatus('syncing'); pushSync(); });
  window.addEventListener('offline', () => setSyncStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollSync(); });
  window.addEventListener('hashchange', () => {
    const t = crew.tokenFromHash();
    if (t && t !== state.getCrewToken()) boot();
  });

  document.getElementById('create-crew-btn').onclick = async () => {
    const crewName = (document.getElementById('create-crew-name').value || '').trim();
    const myName = (document.getElementById('create-my-name').value || '').trim();
    if (!validName(crewName) || crewName.length > 40) { alert('Crew name: 1-40 characters, no <, >, quotes or backslashes.'); return; }
    if (!validName(myName)) { alert('Your name: 1-24 characters, no <, >, quotes or backslashes.'); return; }
    const btn = document.getElementById('create-crew-btn');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const { token, doc } = await crew.createCrew(crewName, myName, state.COLOR_PALETTE[0]);
      crew.rememberCrew(token, crewName);
      crew.setMe(token, myName);
      history.replaceState(null, '', `/#g=${token}`);
      enterApp(token, doc);
    } catch (e) {
      alert('Could not create the crew: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Start crew';
    }
  };

  setInterval(() => { if (!document.hidden) pollSync(); }, 20000);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

wireStatic();
boot();
