// v3 app shell: boot flow (landing -> join/claim -> wall), wall wiring,
// sync cadence, and the server-side v4 migration call. Screen renderers live
// in wall.js; Settings/notes/Spotify screens mount here as they land.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as sync from '../sync.js';
import * as model from './model.js';
import { loadFestivalIndex, loadFestival, loadCustomFestivals, FESTIVAL_INDEX } from '../festivals.js';
import { renderWall, refreshCard, showUndoToast, wireScrollspy, colorIndexOf } from './wall.js';
import { openArtistSheet, openAllNotes, closeSheet } from './notes.js';
import { renderSettings, appSettings } from './settings.js';
import { startFavicon, stopFavicon } from './favicon.js';
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
  migrationPending: false,
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
  if (ctx.migrationPending) {
    showUndoToast($('toast-root'), 'Updating this crew — picks unlock in a moment', () => {});
    return;
  }
  const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const next = model.nextTapLevel(current);
  state.recordSelection(artistName, ctx.meName, next);
  applyLocalPick(artistName, ctx.meName, next);
  refreshCtx();
  refreshCard(cardEl, artistName, ctx);
  sync.scheduleSync();
  if (current === 4 && next === 0) {
    showUndoToast($('toast-root'), 'Cleared your must for ' + artistName, () => {
      state.recordSelection(artistName, ctx.meName, 4);
      applyLocalPick(artistName, ctx.meName, 4);
      refreshCtx();
      // Re-query by artist: a remote-poll repaint during the 5s undo window
      // detaches the closed-over node and replaceWith would silently no-op
      // (Codex P3 trail, finding 2).
      const liveEl = document.querySelector(`#wall-root .card[data-artist="${CSS.escape(artistName)}"]`);
      if (liveEl) refreshCard(liveEl, artistName, ctx);
      else repaintWall();
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
  $('desk-fest-pill').textContent = `${fest.name.toUpperCase()} ${fest.year || ''}`.trim();
  document.title = `${fest.name} — Festival Navigator`;
  startFavicon(fest.accent, { lowPower: ctx.lowPower });
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
  // Scheduled fests: tabs from days{} keys (labels via dayMeta weekday, e.g.
  // EF's "Day 1" -> THU). Lineup fests: tabs from the artists' day fields.
  const scheduled = fest.days && Object.keys(fest.days).length;
  const groups = scheduled
    ? Object.keys(fest.days)
    : [...new Set((fest.artists || []).map((a) => a.day).filter(Boolean))];
  for (const day of groups) {
    const meta = (fest.dayMeta || {})[day];
    const tab = document.createElement('button');
    tab.className = 'day-tab';
    tab.dataset.day = day;
    tab.textContent = (meta?.wd || day).slice(0, 3).toUpperCase();
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
  for (const id of ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings']) {
    $(id).style.display = id === screen ? '' : 'none';
  }
}

// ---- create: pick the fest + your name -> a fresh crew ------------------------------
let createFid = null;
function renderCreate() {
  show('screen-create');
  createFid = null;
  $('create-status').textContent = '';
  const list = $('create-fests');
  list.textContent = '';
  for (const f of FESTIVAL_INDEX.filter((x) => x.status !== 'archived')) {
    const row = document.createElement('button');
    row.className = 'fest-row';
    row.style.width = '100%';
    const left = document.createElement('div');
    left.style.cssText = 'flex: 1; min-width: 0; text-align: left;';
    const nm = document.createElement('span');
    nm.style.cssText = `font-family: var(--font-display); letter-spacing: .04em; font-size: 16px; color: rgb(${f.accent || '237, 234, 244'}); white-space: nowrap;`;
    nm.textContent = f.name.toUpperCase();
    const yr = document.createElement('span');
    yr.style.cssText = 'font-size: .65em; opacity: .75;';
    yr.textContent = ' ' + (f.year || '');
    nm.appendChild(yr);
    left.appendChild(nm);
    const sub = document.createElement('div');
    sub.className = 'fest-dates';
    sub.textContent = f.dates || '';
    left.appendChild(sub);
    row.appendChild(left);
    row.addEventListener('click', () => {
      createFid = f.id;
      [...list.children].forEach((c) => { c.style.borderColor = ''; c.style.borderWidth = ''; });
      row.style.borderColor = `rgba(${f.accent || '192, 132, 252'}, .55)`;
      row.style.borderWidth = '1.5px';
      $('create-status').textContent = `${f.name} it is — now your name.`;
    });
    list.appendChild(row);
  }
}

async function createCrewFlow() {
  const myName = $('create-name-input').value.trim();
  const status = $('create-status');
  if (!createFid) { status.textContent = 'Pick the fest first.'; return; }
  if (!myName) { status.textContent = 'And your name — that becomes your color.'; return; }
  const btn = $('create-go-btn');
  btn.disabled = true;
  status.textContent = 'Creating…';
  try {
    const meta = FESTIVAL_INDEX.find((f) => f.id === createFid);
    // SAFE_NAME_RE bans apostrophes — "'26" becomes "26" in the crew name.
    const crewName = `${meta.name} ${(meta.year || '').replace(/'/g, '')}`.trim().slice(0, 40);
    const { token, doc } = await crew.createCrew(crewName, myName, { colorIndex: 0 });
    crew.setMe(token, myName);
    localStorage.setItem(`fn_crew_fest_v3_${token}`, createFid);
    await enterApp(token, doc);
    // Stamp the crew's fest into the doc so invites resolve on new devices
    // even when a shared link lost its &f= param (FLOW-1).
    state.recordInviteFest(createFid);
    sync.scheduleSync();
  } catch (e) {
    status.textContent = String(e.message || e);
    btn.disabled = false;
  }
}

// ---- settings (one page, two doors) -----------------------------------------------
function applyLowPower(on) {
  ctx.lowPower = !!on;
  document.body.classList.toggle('low-power', ctx.lowPower);
  if (ctx.lowPower) stopFavicon();
  else if (state.getCrewToken()) startFavicon(state.fest()?.accent, { lowPower: false });
}

function openSettings() {
  closeSheet();
  refreshCtx();
  show('screen-settings');
  renderSettings($('settings-root'), ctx, {
    close: () => { show('screen-app'); repaintWall(); },
    rerender: openSettings,
    switchFestival: async (fid) => {
      state.setActiveFestivalId(fid);
      state.ensureFestivalState(fid);
      state.setCurrentDay(null);
      await loadFestival(fid);
      show('screen-app');
      applyFestTheme();
      repaintWall();
      sync.pollSync();
    },
    onLowPower: (on) => { applyLowPower(on); },
    onStayOffline: (on) => { sync.setStayOffline(on); if (!on) sync.pushSync(); },
    recordPick: (artist, person, level) => {
      if (ctx.migrationPending) return; // same gate as handleTap (bulk paste path)
      state.recordSelection(artist, person, level);
      applyLocalPick(artist, person, level);
    },
    afterBulk: () => { sync.scheduleSync(); refreshCtx(); },
  });
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

// `current` threads boot's generation guard through the awaits: if a newer
// boot started (rapid crew-link switch), this activation aborts instead of
// swapping page-level state under a wall the user can still see and tap —
// which could attribute a tap on the OLD crew's card to the NEW crew's
// pendingChanges (Codex P6 gate, finding P1-2).
async function enterApp(token, doc, current = () => true) {
  crew.setActiveCrew(token);
  crew.rememberCrew(token, (doc.meta && doc.meta.name) || '');
  await loadCustomFestivals(token); // crew-private fests join the catalog first
  if (!current()) return;
  // Invite festival context (FLOW-1): the link's &f= wins (freshest), then the
  // doc's stamp. Consumed once — only fills the void on a fest-less device.
  const festHint = pendingFestHint || (doc.meta && doc.meta.inviteFestId) || null;
  pendingFestHint = null;
  state.activateCrew(token, doc, festHint);
  // Migrate BEFORE the wall becomes interactive: a raw 3 written onto a
  // still-v3 doc would later be rewritten to 4 by the migrate op — silently
  // corrupting a genuine "picked x3" into "must" (Codex P6 gate, finding 1).
  // Offline/failed migration -> writes stay gated (ctx.migrationPending) and
  // the poll loop retries; reads are safe throughout (readLevel maps by v).
  if (model.needsMigration(state.crewDoc)) {
    await sync.requestMigration();
    if (!current()) return;
    ctx.migrationPending = model.needsMigration(state.crewDoc);
  } else {
    ctx.migrationPending = false;
  }
  await loadFestival(state.activeFestivalId);
  if (!current()) return;
  show('screen-app');
  applyFestTheme();
  refreshCtx();
  renderPersonChips();
  renderDockYou();
  repaintWall();
  history.replaceState(null, '', `/#g=${token}`);
  sync.pollSync();
}

// ---- boot -----------------------------------------------------------------------
let bootGeneration = 0;
let pendingFestHint = null; // &f= from the opened invite link, consumed by enterApp
export async function boot() {
  const gen = ++bootGeneration;
  const current = () => gen === bootGeneration;
  // Capture before any await: enterApp's replaceState strips the hash to #g=.
  pendingFestHint = crew.festFromHash();
  try { await loadFestivalIndex(); } catch { /* offline with cache: proceed */ }

  if (location.hash === '#new') { renderCreate(); return; }
  const token = crew.tokenFromHash() || crew.activeCrewToken();
  if (!token) { renderLanding(); return; }

  let doc = null;
  try { doc = await crew.fetchCrew(token); } catch { doc = state.cachedDoc(token); }
  if (!current()) return;
  if (!doc) { doc = state.cachedDoc(token); }
  if (!doc) { renderLanding(); return; }
  if (!crew.me(token)) { renderJoin(token, doc); return; }
  await enterApp(token, doc, current);
}

// ---- wiring ----------------------------------------------------------------------
export function init() {
  sync.initSync({
    onRemoteChange: () => { repaintWall(); renderPersonChips(); },
    onCrewGone: () => { renderLanding(); },
  });
  $('search-input').addEventListener('input', (e) => {
    ctx.query = e.target.value;
    renderWall($('wall-root'), ctx);
    renderDockDays(); // scrollspy re-wires against the filtered day rules (gate F8)
  });
  $('sort-select').addEventListener('change', (e) => { ctx.sort = e.target.value; repaintWall(); });
  const dock = $('dock');
  $('search-input').addEventListener('focus', () => dock.classList.add('hidden'));
  $('search-input').addEventListener('blur', () => dock.classList.remove('hidden'));
  $('dock-you').addEventListener('click', () => window.scrollTo({ top: 0, behavior: ctx.lowPower ? 'auto' : 'smooth' }));
  $('gear-btn').addEventListener('click', openSettings);
  $('dock-fest-link').addEventListener('click', openSettings);
  $('notes-chip').addEventListener('click', () => { refreshCtx(); openAllNotes(ctx); });
  $('create-go-btn').addEventListener('click', createCrewFlow);
  $('create-back').addEventListener('click', () => { history.replaceState(null, '', '/'); renderLanding(); });
  const saved = appSettings();
  applyLowPower(saved.lowPower);
  sync.setStayOffline(saved.stayOffline);
  // Poll every 25s normally; low power stretches to every 5 min (design 21h).
  let lowTick = 0;
  setInterval(async () => {
    if (ctx.lowPower && (lowTick = (lowTick + 1) % 12) !== 0) return;
    // Retry the one-shot migration until it lands (offline first-open case),
    // then unlock writes.
    if (ctx.migrationPending && navigator.onLine) {
      if (await sync.requestMigration()) {
        ctx.migrationPending = model.needsMigration(state.crewDoc);
        if (!ctx.migrationPending) repaintWall();
      }
    }
    sync.pollSync();
  }, 25000);
  document.addEventListener('visibilitychange', () => {
    // Respect low power: returning to the tab does not bypass the 5-min throttle.
    if (!document.hidden && !ctx.lowPower) sync.pollSync();
  });
  window.addEventListener('hashchange', () => { closeSheet(); boot(); });
  window.addEventListener('online', () => sync.pushSync());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  boot();
}

init();
