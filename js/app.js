// App entry: wiring, init, festival switching. Everything DOM-event-shaped
// lives here; rendering and state live in their own modules.
import * as state from './state.js';
import { initSync, setSyncStatus, scheduleSync, pushSync, pollSync } from './sync.js';
import { renderPeople as renderPeopleView } from './render/people.js';
import { renderDay, updateArtistHighlight } from './render/grid.js';
import { wireModals } from './ui.js';
import { getArtistInfo, solveConflicts } from './ai.js';
import { downloadSchedule, handleBulkAdd, exportLikes } from './tools.js';

const peopleCallbacks = { onSelect: selectPerson, onRemove: removePerson, onAdd: addPerson };
function renderPeople() { renderPeopleView(peopleCallbacks); }

function refreshView() {
  renderPeople();
  if (state.currentDay) renderDay(state.currentDay);
}

// ---- crew management ------------------------------------------------------
function addPerson() {
  const name = (prompt('Add a person to the crew:') || '').trim();
  if (!name) return;
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
  // Zero out their picks; level 0 is a value deep-merge can carry (unlike a delete).
  Object.keys(state.selections()).forEach(a => {
    if (state.selections()[a][name] > 0) {
      state.selections()[a][name] = 0;
      state.recordSelection(a, name, 0);
    }
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

// ---- festival switching ---------------------------------------------------
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
  Object.values(state.FESTIVALS).forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id; opt.textContent = f.name;
    if (f.id === state.activeFestivalId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderDayTabs() {
  const container = document.getElementById('day-tabs');
  container.innerHTML = '';
  const meta = state.fest().dayMeta || {};
  Object.keys(state.fest().days).forEach(day => {
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

function switchFestival(fid) {
  if (!state.FESTIVALS[fid]) return;
  state.setActiveFestivalId(fid);
  state.setSelectedPerson(null);
  state.ensureFestivalState(fid);
  applyTheme();
  renderPeople();
  renderDayTabs();
  renderDay(Object.keys(state.fest().days)[0]);
  scheduleSync();
}

// ---- wiring + init --------------------------------------------------------
function init() {
  state.migrateOldData();
  state.ensureFestivalState(state.activeFestivalId);
  initSync({ onRemoteChange: refreshView });
  wireModals();

  document.getElementById('schedule-view').addEventListener('click', (e) => {
    const card = e.target.closest('.artist-card');
    if (card) handleArtistClick(card.dataset.artist);
  });
  document.getElementById('festival-select').onchange = (e) => switchFestival(e.target.value);
  document.getElementById('conflict-solver-btn').onclick = solveConflicts;
  document.getElementById('download-btn').onclick = downloadSchedule;
  document.getElementById('top-download-btn').onclick = downloadSchedule;
  document.getElementById('bulk-add-btn').onclick = handleBulkAdd;
  document.getElementById('export-likes-btn').onclick = exportLikes;
  document.getElementById('refresh-btn').onclick = pollSync;
  window.addEventListener('online', () => { setSyncStatus('syncing'); pushSync(); });
  window.addEventListener('offline', () => setSyncStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollSync(); });

  renderFestivalSelect();
  applyTheme();
  renderPeople();
  renderDayTabs();
  renderDay(Object.keys(state.fest().days)[0]);
  setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
  pollSync();
  setInterval(() => { if (!document.hidden) pollSync(); }, 20000);
  if (state.hasPending()) scheduleSync();
  // Register service worker for offline support.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }
}

init();
