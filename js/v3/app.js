// v3 app shell: boot flow (landing -> join/claim -> wall), wall wiring,
// sync cadence, and the server-side v4 migration call. Screen renderers live
// in wall.js; Settings/notes/Spotify screens mount here as they land.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as sync from '../sync.js';
import * as model from './model.js';
import { loadFestivalIndex, loadFestival } from '../festivals.js';
import { renderWall, refreshCard, showUndoToast, wireScrollspy, colorIndexOf } from './wall.js';
import { openArtistSheet, closeSheet } from './notes.js';
import { hslOf, strokeOf, nextColorIndex } from './palette.js';

const $ = (id) => document.getElementById(id);

// ---- view context ---------------------------------------------------------------
const ctx = {
  fid: null,
  meName: null,
  picks: {},
  affinity: null,
  query: '',
  sort: 'billing',
  lowPower: false,
  onTap: handleTap,
  onOpenNotes: (artist) => openArtistSheet(artist, ctx, onNotesChange),
  onNotesChange: () => onNotesChange(),
};

function onNotesChange() {
  sync.scheduleSync();
  repaintWall();
}

function refreshCtx() {
  ctx.fid = state.activeFestivalId;
  ctx.meName = crew.me(state.getCrewToken());
  ctx.picks = model.picksFor(state.crewDoc, ctx.fid);
  ctx.affinity = state.affinityLookup(ctx.meName);
}

// ---- tap cycle -------------------------------------------------------------------
function handleTap(artistName, cardEl) {
  if (!ctx.meName) return;
  const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const next = model.nextTapLevel(current);
  state.recordSelection(artistName, ctx.meName, next);
  applyLocalPick(artistName, ctx.meName, next);
  refreshCtx();
  const freshEl = refreshCard(cardEl, artistName, ctx);
  sync.scheduleSync();
  if (current === 4 && next === 0) {
    showUndoToast($('toast-root'), 'Cleared your must for ' + artistName, () => {
      state.recordSelection(artistName, ctx.meName, 4);
      applyLocalPick(artistName, ctx.meName, 4);
      refreshCtx();
      refreshCard(freshEl, artistName, ctx);
      sync.scheduleSync();
    });
  }
}

// recordSelection writes pending; mirror into the local doc for instant render.
function applyLocalPick(artist, person, level) {
  state.ensureFestivalState(ctx.fid);
  const sels = state.crewDoc.festivals[ctx.fid].selections;
  (sels[artist] = sels[artist] || {})[person] = level;
  state.persist();
}

// ---- header / toolbar / dock ------------------------------------------------------
function applyFestTheme() {
  const fest = state.fest();
  document.body.style.setProperty('--fest', fest.accent || '192, 132, 252');
  $('fest-name').textContent = fest.name.toUpperCase();
  $('fest-year').textContent = fest.year || '';
  $('fest-sub').textContent = [fest.subtitle, fest.dates].filter(Boolean).join(' · ');
  $('dock-fest-name').textContent = `${fest.name.toUpperCase()} ${fest.year || ''}`.trim();
  document.title = `${fest.name} — Festival Navigator`;
}

function renderPersonChips() {
  const row = $('person-chips');
  row.textContent = '';
  for (const [name, p] of state.activePeople()) {
    const chip = document.createElement('button');
    chip.className = 'person-chip' + (name === ctx.meName ? ' you' : '');
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, name === ctx.meName);
    chip.textContent = name;
    chip.addEventListener('click', () => {
      crew.setMe(state.getCrewToken(), name);
      refreshCtx();
      renderPersonChips();
      repaintWall();
      renderDockYou();
    });
    row.appendChild(chip);
  }
}

function renderDockYou() {
  const you = $('dock-you');
  you.textContent = '';
  if (!ctx.meName) return;
  const p = state.people()[ctx.meName];
  const ci = colorIndexOf(ctx.meName, p);
  you.style.background = hslOf(ci, 0.5);
  you.style.border = '1.5px solid #fff';
  you.textContent = ctx.meName.charAt(0).toUpperCase();
}

let unspy = () => {};
function renderDockDays() {
  const days = $('dock-days');
  days.textContent = '';
  const fest = state.fest();
  const groups = new Set((fest.artists || []).map((a) => a.day).filter(Boolean));
  for (const day of groups) {
    const tab = document.createElement('button');
    tab.className = 'day-tab';
    tab.dataset.day = day;
    tab.textContent = day.slice(0, 3).toUpperCase();
    tab.addEventListener('click', () => {
      const target = document.querySelector(`.day-rule[data-day="${CSS.escape(day)}"]`);
      if (target) target.scrollIntoView({ behavior: ctx.lowPower ? 'auto' : 'smooth', block: 'start' });
    });
    days.appendChild(tab);
  }
  unspy();
  unspy = wireScrollspy(days, $('wall-root'));
}

function repaintWall() {
  refreshCtx();
  renderWall($('wall-root'), ctx);
  renderDockDays();
  $('notes-count').textContent = String(model.totalNoteCount(state.crewDoc, ctx.fid));
}

// ---- screens ----------------------------------------------------------------------
function show(screen) {
  for (const id of ['screen-landing', 'screen-join', 'screen-app']) {
    $(id).style.display = id === screen ? '' : 'none';
  }
}

function renderLanding() {
  show('screen-landing');
  const list = $('landing-fests');
  list.textContent = '';
  const crews = crew.knownCrews();
  for (const c of crews) {
    const doc = state.cachedDoc(c.token);
    const row = document.createElement('button');
    row.className = 'fest-row';
    row.style.width = '100%';
    const left = document.createElement('div');
    left.style.cssText = 'flex: 1; min-width: 0; text-align: left;';
    const nm = document.createElement('span');
    nm.className = 'fest-name';
    nm.style.cssText = 'font-family: var(--font-display); letter-spacing: .04em; font-size: 16px; color: var(--text-header);';
    nm.textContent = c.name || 'Your festival';
    left.appendChild(nm);
    const sub = document.createElement('div');
    sub.className = 'fest-dates';
    const n = doc ? Object.keys(doc.people || {}).length : 0;
    sub.textContent = n ? `${n} people` : 'tap to open';
    left.appendChild(sub);
    const chev = document.createElement('span');
    chev.className = 'chev';
    chev.textContent = '›';
    row.append(left, chev);
    row.addEventListener('click', () => { location.hash = `#g=${c.token}`; boot(); });
    list.appendChild(row);
  }
  $('landing-empty').style.display = crews.length ? 'none' : '';
}

function renderJoin(token, doc) {
  show('screen-join');
  $('join-fest-name').textContent = (doc.meta && doc.meta.name) || 'THE FESTIVAL';
  const list = $('join-people');
  list.textContent = '';
  for (const [name, p] of Object.entries(doc.people || {})) {
    if (p && p.removed) continue;
    const row = document.createElement('button');
    row.className = 'fest-row';
    row.style.width = '100%';
    const av = document.createElement('span');
    av.className = 'avatar lg';
    const ci = colorIndexOf(name, p);
    av.style.background = hslOf(ci, 0.5);
    av.style.border = '1px solid ' + strokeOf(ci, false);
    av.textContent = name.charAt(0).toUpperCase();
    const nm = document.createElement('span');
    nm.style.cssText = 'color: #fff; font-weight: 700; font-size: 15px;';
    nm.textContent = name;
    row.append(av, nm);
    row.addEventListener('click', () => { crew.setMe(token, name); enterApp(token, doc); });
    list.appendChild(row);
  }
  $('join-add-btn').onclick = async () => {
    const name = $('join-name-input').value.trim();
    if (!name) return;
    const taken = Object.values(doc.people || {})
      .map((p) => p.colorIndex).filter(Number.isInteger);
    state.activateCrew(token, doc);
    state.recordPerson(name, { colorIndex: nextColorIndex(taken) });
    crew.setMe(token, name);
    enterApp(token, state.crewDoc);
    sync.scheduleSync();
  };
}

async function enterApp(token, doc) {
  crew.setActiveCrew(token);
  crew.rememberCrew(token, (doc.meta && doc.meta.name) || '');
  state.activateCrew(token, doc);
  await loadFestival(state.activeFestivalId);
  show('screen-app');
  applyFestTheme();
  refreshCtx();
  renderPersonChips();
  renderDockYou();
  repaintWall();
  history.replaceState(null, '', `/#g=${token}`);
  // Server-side v4 migration for legacy docs, then repaint from truth.
  if (model.needsMigration(state.crewDoc)) {
    await sync.requestMigration();
    repaintWall();
  }
  sync.pollSync();
}

// ---- boot -----------------------------------------------------------------------
let bootGeneration = 0;
export async function boot() {
  const gen = ++bootGeneration;
  const current = () => gen === bootGeneration;
  try { await loadFestivalIndex(); } catch { /* offline with cache: proceed */ }

  const token = crew.tokenFromHash() || crew.activeCrewToken();
  if (!token) { renderLanding(); return; }

  let doc = null;
  try { doc = await crew.fetchCrew(token); } catch { doc = state.cachedDoc(token); }
  if (!current()) return;
  if (!doc) { doc = state.cachedDoc(token); }
  if (!doc) { renderLanding(); return; }
  if (!crew.me(token)) { renderJoin(token, doc); return; }
  await enterApp(token, doc);
}

// ---- wiring ----------------------------------------------------------------------
export function init() {
  sync.initSync({
    onRemoteChange: () => { repaintWall(); renderPersonChips(); },
    onCrewGone: () => { renderLanding(); },
  });
  $('search-input').addEventListener('input', (e) => { ctx.query = e.target.value; renderWall($('wall-root'), ctx); });
  $('sort-select').addEventListener('change', (e) => { ctx.sort = e.target.value; repaintWall(); });
  const dock = $('dock');
  $('search-input').addEventListener('focus', () => dock.classList.add('hidden'));
  $('search-input').addEventListener('blur', () => dock.classList.remove('hidden'));
  $('dock-you').addEventListener('click', () => window.scrollTo({ top: 0, behavior: ctx.lowPower ? 'auto' : 'smooth' }));
  setInterval(() => sync.pollSync(), 25000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync.pollSync(); });
  window.addEventListener('hashchange', () => { closeSheet(); boot(); });
  window.addEventListener('online', () => sync.pushSync());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  boot();
}

init();
