// v3 app shell: boot flow (landing -> join/claim -> wall), wall wiring,
// sync cadence, and the server-side v4 migration call. Screen renderers live
// in wall.js; Settings/notes/Spotify screens mount here as they land.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as sync from '../sync.js';
import * as spotify from '../spotify.js';
import * as model from './model.js';
import { loadFestivalIndex, loadFestival, loadCustomFestivals, FESTIVAL_INDEX, defaultFestivalId } from '../festivals.js';
import { renderWall, refreshCard, showUndoToast, showToast, wireScrollspy, colorIndexOf, groupByDay, knownDaysOf } from './wall.js';
import { openArtistSheet, openDayNotes, openAllNotes, closeSheet, refreshOpenSheet } from './notes.js';
import { renderSettings, appSettings, openSubviewByKey } from './settings.js';
import { router } from './router.js';
import { createSortControl } from './sort-control.js';
import { nameProblem } from '../name-rules.mjs';
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
  onOpenNotes: (artist) => {
    openArtistSheet(artist, ctx, onNotesChange);
    router.push(`sheet:notes:${artist}`);
  },
  onOpenDayNotes: (day) => {
    openDayNotes(day, ctx, onNotesChange);
    router.push(`sheet:day:${day}`);
  },
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
  // Weekend view is a device-local preference per fest (ST-3): set it once
  // ("I'm going W2") and wrong-weekend picks announce themselves.
  ctx.weekend = localStorage.getItem(`fn_weekend_v1_${ctx.fid}`) || 'all';
}

// ---- tap cycle -------------------------------------------------------------------
// A multi-day artist has one card under EACH day — a pick must repaint every
// sibling, or the others go stale and invite double-cycling (CORE-15).
function refreshArtistCards(artistName) {
  const els = document.querySelectorAll(`#wall-root .card[data-artist="${CSS.escape(artistName)}"]`);
  if (!els.length) { repaintWall(); return; }
  els.forEach((el) => refreshCard(el, artistName, ctx));
}

function handleTap(artistName) {
  if (!ctx.meName) return;
  if (ctx.migrationPending) {
    showToast($('toast-root'), 'Updating this crew — picks unlock in a moment');
    return;
  }
  const current = (ctx.picks[artistName] || {})[ctx.meName] || 0;
  const next = model.nextTapLevel(current);
  state.recordSelection(artistName, ctx.meName, next);
  applyLocalPick(artistName, ctx.meName, next);
  refreshCtx();
  refreshArtistCards(artistName);
  sync.scheduleSync();
  if (current === 4 && next === 0) {
    showUndoToast($('toast-root'), 'Cleared your must for ' + artistName, () => {
      state.recordSelection(artistName, ctx.meName, 4);
      applyLocalPick(artistName, ctx.meName, 4);
      refreshCtx();
      refreshArtistCards(artistName);
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

// Presence display only (FLOW-8): a chip tap used to silently REASSIGN this
// device's identity — one stray thumb and your picks start landing on someone
// else. Switching who you are is an explicit Settings action now.
function renderPersonChips() {
  const row = $('person-chips');
  row.textContent = '';
  for (const [name, p] of state.activePeople()) {
    const chip = document.createElement('span');
    chip.className = 'person-chip' + (name === ctx.meName ? ' you' : '');
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, name === ctx.meName);
    chip.style.cursor = 'default';
    chip.textContent = name;
    row.appendChild(chip);
  }
}

// The explicit identity switch (FLOW-8), called from Settings.
function switchIdentity(name) {
  crew.setMe(state.getCrewToken(), name);
  refreshCtx();
  renderPersonChips();
  renderDockYou();
  showToast($('toast-root'), `You’re ${name} on this device now.`);
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
// One day list feeds BOTH navigations: the mobile dock and the desktop day
// rail (DT-1). Scheduled fests: tabs from days{} keys (labels via dayMeta
// weekday). Lineup fests: the same split-aware grouping the wall renders —
// a "Saturday & Sunday" artist must not mint its own tab (ST-1).
function renderDayNav() {
  const dock = $('dock-days');
  const rail = $('rail-days');
  dock.textContent = '';
  rail.textContent = '';
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;
  const groups = scheduled
    ? Object.keys(fest.days)
    : [...groupByDay(fest.artists || [], knownDaysOf(fest)).keys()].filter(Boolean);
  for (const day of groups) {
    const meta = (fest.dayMeta || {})[day];
    const jump = () => {
      const target = document.querySelector(`.day-rule[data-day="${CSS.escape(day)}"]`);
      if (target) target.scrollIntoView({ behavior: ctx.lowPower ? 'auto' : 'smooth', block: 'start' });
    };
    const mkTab = (label) => {
      const tab = document.createElement('button');
      tab.className = 'day-tab';
      tab.dataset.day = day;
      tab.textContent = label;
      tab.addEventListener('click', jump);
      return tab;
    };
    dock.appendChild(mkTab((meta?.wd || day).slice(0, 3).toUpperCase()));
    // Rail tabs stay compact: drop parenthetical asides from verbose day keys
    // ("Wednesday, Sept 16 (Early Arrival pre-party)" -> "WEDNESDAY, SEPT 16").
    const railLabel = meta?.wd ? `${meta.wd} ${meta.num || ''}`.trim() : day.replace(/\s*\(.*\)\s*$/, '');
    rail.appendChild(mkTab(railLabel.toUpperCase()));
  }
  unspy();
  unspy = wireScrollspy([dock, rail], $('wall-root'));
}

function repaintWall() {
  refreshCtx();
  renderWall($('wall-root'), ctx);
  renderDayNav();
  $('notes-count').textContent = String(model.totalNoteCount(state.crewDoc, ctx.fid));
  // A timetable has one true order — a sort control there would be a lie
  // (CORE-5). Searching a scheduled fest sorts chronologically by design.
  const scheduled = !!(state.fest().days && Object.keys(state.fest().days).length);
  $('sort-control').style.display = scheduled ? 'none' : '';
  updateMigrationBanner();
  updateWeekendRow();
  updateArchiveNote();
  maybeShowCoachMark();
}

// Multi-weekend fests (ACL) get a weekend view (ST-3): pick yours once and
// the wall shows who's actually playing it; W1/W2-only artists carry a tag
// in the Both view so a wrong-weekend must can't sneak in.
function updateWeekendRow() {
  const existing = document.getElementById('weekend-row');
  const fest = state.fest();
  const has = (fest.artists || []).some((a) => a.weekends === 'W1' || a.weekends === 'W2');
  if (!has) { if (existing) existing.remove(); return; }
  let row = existing;
  if (!row) {
    row = document.createElement('div');
    row.id = 'weekend-row';
    row.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-top: 11px;';
    const lbl = document.createElement('span');
    lbl.className = 'micro-label';
    lbl.style.marginRight = '4px';
    lbl.textContent = 'Weekend';
    row.appendChild(lbl);
    for (const [val, label] of [['all', 'Both'], ['W1', 'One'], ['W2', 'Two']]) {
      const b = document.createElement('button');
      b.className = 'seg';
      b.dataset.w = val;
      b.textContent = label;
      b.addEventListener('click', () => {
        localStorage.setItem(`fn_weekend_v1_${ctx.fid}`, val);
        repaintWall();
      });
      row.appendChild(b);
    }
    document.querySelector('#screen-app .toolbar').after(row);
  }
  row.querySelectorAll('.seg').forEach((b) => b.classList.toggle('active', b.dataset.w === (ctx.weekend || 'all')));
}

// First-wall coach mark (CT-1): the pick mechanic and long-press are
// un-inferable — one dismissible line, once per device, pointing at the
// full legend for more.
const LS_COACH = 'fn_coach_v1';
function maybeShowCoachMark() {
  if (document.getElementById('coach-mark')) return;
  try { if (localStorage.getItem(LS_COACH)) return; } catch { return; }
  if (!ctx.meName) return;
  const bar = document.createElement('div');
  bar.id = 'coach-mark';
  bar.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 11px; padding: 10px 13px; border: 1px solid var(--notes-chip-stroke); border-radius: var(--r-row); background: rgba(139, 123, 255, .07);';
  const msg = document.createElement('span');
  msg.style.cssText = 'flex: 1; color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.45;';
  msg.append('Tap an artist to pick — brighter each tap, 4th is a must. Hold one for notes. ');
  const how = document.createElement('button');
  how.style.cssText = 'background: none; border: none; padding: 0; cursor: pointer; color: var(--notes-chip-text); font-size: 12px; font-weight: 700; text-decoration: underline; text-underline-offset: 2px;';
  how.textContent = 'How it all works';
  how.addEventListener('click', () => {
    openSettings();
    router.push('settings');
    openSubviewByKey('sub:how', ctx, settingsActions);
    router.push('sub:how');
  });
  msg.appendChild(how);
  const dismiss = document.createElement('button');
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.style.cssText = 'background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 13px; flex: none; padding: 2px 4px;';
  dismiss.textContent = '✕';
  dismiss.addEventListener('click', () => {
    try { localStorage.setItem(LS_COACH, '1'); } catch { /* private mode */ }
    bar.remove();
  });
  bar.append(msg, dismiss);
  document.querySelector('#screen-app .toolbar').after(bar);
}

// An archived fest reads as a memory, not a live plan (ST-5).
function updateArchiveNote() {
  const existing = document.getElementById('archive-note');
  const fest = state.fest();
  if (fest.status !== 'archived') { if (existing) existing.remove(); return; }
  if (existing) return;
  const bar = document.createElement('div');
  bar.id = 'archive-note';
  bar.style.cssText = 'margin-top: 11px; padding: 9px 13px; border: 1px solid var(--border-card); border-radius: var(--r-row); color: var(--text-secondary); font-size: 12px; font-weight: 600; line-height: 1.45; background: var(--card);';
  bar.textContent = `${fest.name} ${fest.year || ''} already happened — this wall is the memory. Picks still work for the record.`.replace('  ', ' ');
  document.querySelector('#screen-app .toolbar').after(bar);
}

// While a legacy crew's server-side migration is pending, picking is gated —
// a persistent banner says so instead of leaving taps mysteriously dead
// (CORE-18). Notes and reading work throughout.
function updateMigrationBanner() {
  const existing = document.getElementById('migration-banner');
  if (!ctx.migrationPending) { if (existing) existing.remove(); return; }
  let bar = existing;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'migration-banner';
    bar.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 11px; padding: 10px 13px; border: 1px solid rgba(245, 158, 11, .35); border-radius: var(--r-row); background: rgba(245, 158, 11, .08);';
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.style.cssText = 'flex: 1; color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.45;';
    const retry = document.createElement('button');
    retry.className = 'btn-tonal';
    retry.style.cssText = 'font-size: 11.5px; padding: 7px 13px; flex: none;';
    retry.textContent = 'Try now';
    retry.addEventListener('click', async () => {
      retry.disabled = true;
      await sync.requestMigration();
      ctx.migrationPending = model.needsMigration(state.crewDoc);
      retry.disabled = false;
      if (!ctx.migrationPending) repaintWall();
      else updateMigrationBanner();
    });
    bar.append(msg, retry);
    document.querySelector('#screen-app .toolbar').after(bar);
  }
  bar.querySelector('.msg').textContent = navigator.onLine
    ? 'Updating this crew to the new pick format — picks unlock in a moment.'
    : 'You’re offline — picks unlock after one online update. Notes and reading work now.';
}

// ---- screens ----------------------------------------------------------------------
const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];
function show(screen) {
  for (const id of SCREENS) {
    $(id).style.display = id === screen ? '' : 'none';
  }
}
const anyScreenVisible = () => SCREENS.some((id) => $(id).style.display !== 'none');

// ---- create, two steps (spec F2): pick the fest, then your name --------------------
let createFid = null;

function festPickRow(f, { muted = false, onPick }) {
  const row = document.createElement('button');
  row.className = 'fest-row';
  row.style.width = '100%';
  if (muted) row.style.opacity = '.72';
  const left = document.createElement('div');
  left.style.cssText = 'flex: 1; min-width: 0; text-align: left;';
  const nm = document.createElement('span');
  nm.style.cssText = `font-family: var(--font-display); letter-spacing: .04em; font-size: var(--fs-day); color: rgb(${f.accent || '237, 234, 244'}); white-space: nowrap;`;
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
  if (muted) {
    const badge = document.createElement('span');
    badge.style.cssText = 'flex: none; color: var(--text-tertiary); font-size: 10px; font-weight: 800; letter-spacing: .08em; border: 1px solid var(--border-card); border-radius: var(--r-pill); padding: 3px 8px;';
    badge.textContent = 'PAST';
    row.appendChild(badge);
  }
  row.addEventListener('click', () => onPick(f));
  return row;
}

function renderCreate() {
  show('screen-create');
  createFid = null;
  $('create-step-1').style.display = 'flex';
  $('create-step-2').style.display = 'none';
  $('create-status').textContent = '';
  const list = $('create-fests');
  list.textContent = '';
  const pick = (f) => createStepTwo(f);
  for (const f of FESTIVAL_INDEX.filter((x) => x.status !== 'archived')) {
    list.appendChild(festPickRow(f, { onPick: pick }));
  }
  // Past festivals stay reachable (spec F2/F12) — visually secondary, same anatomy.
  const past = FESTIVAL_INDEX.filter((x) => x.status === 'archived');
  if (past.length) {
    const divider = document.createElement('div');
    divider.className = 'micro-label';
    divider.style.cssText = 'margin-top: 8px;';
    divider.textContent = 'Past festivals';
    list.appendChild(divider);
    for (const f of past) list.appendChild(festPickRow(f, { muted: true, onPick: pick }));
  }
}

function createStepTwo(f) {
  createFid = f.id;
  $('create-step-1').style.display = 'none';
  $('create-step-2').style.display = 'flex';
  $('create-status').textContent = '';
  // Chosen-fest chip — fest accent border is the current-fest border rule.
  const chosen = $('create-chosen');
  chosen.textContent = '';
  const chip = document.createElement('span');
  chip.style.cssText = `display: inline-flex; align-items: baseline; gap: 6px; border: 1.5px solid rgba(${f.accent || '192, 132, 252'}, .55); border-radius: var(--r-pill); padding: 8px 16px; font-family: var(--font-display); letter-spacing: .04em; font-size: 15px; color: rgb(${f.accent || '237, 234, 244'});`;
  chip.textContent = `${f.name.toUpperCase()} ${f.year || ''}`.trim();
  chosen.appendChild(chip);
  $('create-name-input').focus();
}

async function createCrewFlow() {
  const myName = $('create-name-input').value.trim();
  const status = $('create-status');
  if (!createFid) { status.textContent = 'Pick the fest first.'; renderCreate(); return; }
  // Same rule the server enforces (FLOW-5) — the form catches it, not the 400.
  const problem = nameProblem(myName);
  if (problem) { status.textContent = problem; return; }
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
    // The share moment (FLOW-7): a crew of one isn't a crew yet.
    openShareMoment();
    router.push('sheet:share');
  } catch (e) {
    status.textContent = String(e.message || e);
  } finally {
    btn.disabled = false;
  }
}

// ---- the share moment (FLOW-7/FLOW-12) ----------------------------------------------
// One centered dialog right after create (and re-openable from Settings):
// the link is VISIBLE — share sheets fail silently, a printed URL never does.
function openShareMoment() {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.id = 'artist-sheet'; // closeSheet + the router's sheet kind own this id
  const grabber = document.createElement('div');
  grabber.className = 'grabber';
  const title = document.createElement('span');
  title.className = 'sheet-title';
  title.textContent = 'ONE LINK MAKES IT A CREW';
  const sub = document.createElement('div');
  sub.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55;';
  sub.textContent = `Anyone who opens it lands in ${state.crewName()} — no accounts, no setup.`;
  const link = crew.crewLink(state.getCrewToken(), state.activeFestivalId);
  if ((state.crewDoc.meta || {}).inviteFestId !== state.activeFestivalId) {
    state.recordInviteFest(state.activeFestivalId);
    sync.scheduleSync();
  }
  const linkRowEl = document.createElement('div');
  linkRowEl.style.cssText = 'display: flex; gap: 8px; align-items: center;';
  const linkBox = document.createElement('input');
  linkBox.readOnly = true;
  linkBox.value = link;
  linkBox.setAttribute('aria-label', 'Crew invite link');
  linkBox.style.cssText = 'flex: 1; min-width: 0; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: var(--text-body); font-size: 12px; font-family: var(--font-ui);';
  linkBox.addEventListener('focus', () => linkBox.select());
  const copy = document.createElement('button');
  copy.className = 'btn-tonal';
  copy.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
  copy.textContent = 'Copy';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy'; }, 1800); }
    catch { linkBox.select(); }
  });
  linkRowEl.append(linkBox, copy);
  const actionsRow = document.createElement('div');
  actionsRow.style.cssText = 'display: flex; gap: 8px;';
  if (navigator.share) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn-tonal';
    shareBtn.style.cssText = 'flex: 1; font-size: 13px; padding: 11px;';
    shareBtn.textContent = 'Share the link';
    shareBtn.addEventListener('click', async () => {
      try { await navigator.share({ title: 'Festival Navigator', url: link }); }
      catch { /* dismissed — the visible link is the fallback */ }
    });
    actionsRow.appendChild(shareBtn);
  }
  const later = document.createElement('button');
  later.className = 'btn-ghost';
  later.style.cssText = 'font-size: 12px; padding: 11px 16px;' + (navigator.share ? '' : ' flex: 1;');
  later.textContent = 'Later — to the wall';
  later.addEventListener('click', () => { if (!router.requestClose()) closeSheet(); });
  actionsRow.appendChild(later);
  sheet.append(grabber, title, sub, linkRowEl, actionsRow);
  document.body.append(backdrop, sheet);
}

// ---- settings (one page, two doors) -----------------------------------------------
function applyLowPower(on) {
  ctx.lowPower = !!on;
  document.body.classList.toggle('low-power', ctx.lowPower);
  if (ctx.lowPower) stopFavicon();
  else if (state.getCrewToken()) startFavicon(state.fest()?.accent, { lowPower: false });
}

// The most recent settings actions object — the router's forward re-open of
// a settings drill needs it (openSettings rebuilds it on every render).
let settingsActions = null;
function closeSettings() { show('screen-app'); repaintWall(); }

function openSettings() {
  closeSheet();
  refreshCtx();
  show('screen-settings');
  settingsActions = {
    close: () => { if (!router.requestClose()) closeSettings(); },
    rerender: openSettings,
    switchFestival: async (fid) => {
      // Load BEFORE persisting the switch: an offline device must never be
      // left pointing at a festival it cannot render (CORE-12).
      try { await loadFestival(fid); }
      catch {
        showToast($('toast-root'), 'Can’t open that festival offline yet — it loads once you’re back online.');
        return;
      }
      state.setActiveFestivalId(fid);
      state.ensureFestivalState(fid);
      state.setCurrentDay(null);
      // The scanned library is a device asset — switching fests badges the
      // new lineup from the cache, no rescan (SPOT-5).
      if (ctx.meName && spotify.isConnected() && spotify.libraryMap()) {
        try {
          const names = new Set((state.fest().artists || []).map((a) => a.name));
          for (const d of Object.keys(state.fest().days || {})) {
            for (const a of state.fest().days[d].artists || []) names.add(a.name);
          }
          if (spotify.applyAffinityToCrew(ctx.meName, [...names]) > 0) sync.scheduleSync();
        } catch { /* stale map — the drill's Refresh is the recovery path */ }
      }
      applyFestTheme();
      if (!router.requestClose()) closeSettings();
      sync.pollSync();
    },
    onLowPower: (on) => { applyLowPower(on); },
    onStayOffline: (on) => { sync.setStayOffline(on); if (!on) sync.pushSync(); },
    recordPick: (artist, person, level) => {
      if (ctx.migrationPending) return false; // same gate as handleTap (bulk paste path)
      state.recordSelection(artist, person, level);
      applyLocalPick(artist, person, level);
      return true;
    },
    afterBulk: () => { sync.scheduleSync(); refreshCtx(); },
    // FLOW-8: identity change is an explicit, named action — never a chip tap.
    switchIdentity: (name) => switchIdentity(name),
    // FLOW-6: the landing is the crew switcher; the current crew stays remembered.
    switchCrew: () => {
      router.reset();
      history.replaceState(null, '', '/');
      renderLanding();
    },
    leaveCrew: () => {
      const t = state.getCrewToken();
      crew.forgetCrew(t);
      router.reset();
      history.replaceState(null, '', '/');
      renderLanding();
      showToast($('toast-root'), 'Crew forgotten on this device — the invite link gets you back in.', 6000);
    },
    // Self-rename (FLOW-11): a person IS their key in the doc, so renaming is
    // new person + tombstone old + picks (and Spotify badges) migrated through
    // the normal additive merge. Old notes keep the old byline — honest history.
    renameSelf: (newName) => {
      const old = ctx.meName;
      const person = state.people()[old];
      state.recordPerson(newName, { colorIndex: colorIndexOf(old, person) });
      // recordPerson writes pending only — mirror into the local doc so the
      // rename is visible before the sync round-trip (recorder convention).
      state.crewDoc.people[newName] = { colorIndex: colorIndexOf(old, person) };
      for (const [fid, entry] of Object.entries(state.crewDoc.festivals || {})) {
        for (const [artist, byPerson] of Object.entries(entry.selections || {})) {
          const level = model.readLevel(state.crewDoc, byPerson[old]);
          if (level > 0) {
            state.recordSelectionFor(fid, artist, newName, level);
            state.ensureFestivalState(fid);
            const sels = state.crewDoc.festivals[fid].selections;
            (sels[artist] = sels[artist] || {})[newName] = level;
          }
        }
      }
      const aff = state.affinityFor(old);
      if (aff) state.recordAffinity(newName, aff);
      state.recordPerson(old, { removed: true });
      if (state.crewDoc.people[old]) state.crewDoc.people[old].removed = true;
      state.persist();
      crew.setMe(state.getCrewToken(), newName);
      sync.scheduleSync();
      refreshCtx();
      renderPersonChips();
      renderDockYou();
      showToast($('toast-root'), `You’re ${newName} now — picks came with you.`);
    },
    changeColor: (idx) => {
      state.recordPerson(ctx.meName, { colorIndex: idx });
      const mine = state.people()[ctx.meName];
      if (mine) mine.colorIndex = idx; // local doc mirror for instant render
      state.persist();
      sync.scheduleSync();
      refreshCtx();
      renderPersonChips();
      renderDockYou();
    },
  };
  renderSettings($('settings-root'), ctx, settingsActions);
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
    nm.style.cssText = 'font-family: var(--font-display); letter-spacing: .04em; font-size: var(--fs-day); color: var(--text-header);';
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
  // The invite names the FESTIVAL (FLOW-10) — the fest is why you came; the
  // crew is who with. Fest context comes from the link's &f= or the doc stamp.
  const hintId = pendingFestHint || (doc.meta && doc.meta.inviteFestId) || null;
  const festMeta = hintId ? FESTIVAL_INDEX.find((f) => f.id === hintId) : null;
  const crewLabel = (doc.meta && doc.meta.name) || 'your crew';
  const headline = $('join-fest-name');
  if (festMeta) {
    headline.textContent = `${festMeta.name.toUpperCase()} ${festMeta.year || ''}`.trim();
    headline.style.color = `rgb(${festMeta.accent || '192, 132, 252'})`;
    $('join-crew-sub').textContent = `with ${crewLabel}`;
  } else {
    headline.textContent = crewLabel;
    headline.style.color = '';
    $('join-crew-sub').textContent = '';
  }
  $('join-status').textContent = '';
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
    const status = $('join-status');
    // Same rule the server enforces (FLOW-5): the form answers, never a 400.
    const problem = nameProblem(name);
    if (problem) { status.textContent = problem; return; }
    // Typing an existing member's name is a returning member recognizing
    // themselves — claim it, same as tapping the row.
    const existing = (doc.people || {})[name];
    if (existing && !existing.removed) { crew.setMe(token, name); enterApp(token, doc); return; }
    const btn = $('join-add-btn');
    btn.disabled = true;
    status.textContent = 'Joining…';
    const taken = Object.values(doc.people || {})
      .map((p) => p.colorIndex).filter(Number.isInteger);
    const person = { colorIndex: nextColorIndex(taken) };
    const festHint = pendingFestHint || (doc.meta && doc.meta.inviteFestId) || null;
    try {
      // The first write happens BEFORE entry (FLOW-5): if the server says no
      // (people cap, doc size), the joiner hears it here — not as a forever-
      // gray sync dot after picking twenty artists that never left the phone.
      const res = await fetch(`/api/crew?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { people: { [name]: person } }, sv: 4 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        status.textContent = body.error || 'Couldn’t join — try a different name.';
        btn.disabled = false;
        return;
      }
      const merged = await res.json();
      crew.setMe(token, name);
      await enterApp(token, merged);
    } catch {
      // Network failure: offline-first join, sync catches up (old behavior).
      state.activateCrew(token, doc, festHint);
      state.recordPerson(name, person);
      crew.setMe(token, name);
      enterApp(token, state.crewDoc);
      sync.scheduleSync();
    } finally {
      btn.disabled = false;
    }
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
  try {
    await loadFestival(state.activeFestivalId);
  } catch {
    // Offline with this fest uncached: fall back to a loadable fest rather
    // than stranding a blank wall (CORE-12). If the default also fails,
    // boot's error boundary takes over.
    const fallback = defaultFestivalId();
    if (state.activeFestivalId === fallback) throw new Error(`festival ${fallback} failed to load`);
    const wantedName = FESTIVAL_INDEX.find((f) => f.id === state.activeFestivalId)?.name || 'that festival';
    state.setActiveFestivalId(fallback);
    state.ensureFestivalState(fallback);
    await loadFestival(fallback);
    showToast($('toast-root'), `Couldn’t load ${wantedName} offline — it opens once you’re back online.`, 6000);
  }
  if (!current()) return;
  // Captured before replaceState rewrites the entry: which layers were open
  // when the page was refreshed (spec F10 — refresh restores the same
  // surface). The entry must KEEP representing those layers — writing null
  // here made one Back collapse the whole restored stack and killed Forward
  // (Codex trailing review, P1, reproduced).
  const savedLayers = (history.state && history.state.layers) || null;
  show('screen-app');
  applyFestTheme();
  refreshCtx();
  renderPersonChips();
  renderDockYou();
  repaintWall();
  history.replaceState(savedLayers ? { layers: savedLayers } : null, '', `/#g=${token}`);
  sync.pollSync();
  router.reset();
  if (savedLayers) router.restore(savedLayers);
  // A hop from an alias domain mid-Spotify-setup (SPOT-1): reopen the drill
  // so the member lands exactly where they left off.
  if (pendingSpotifyOpen) {
    pendingSpotifyOpen = false;
    openSettings();
    router.push('settings');
    openSubviewByKey('sub:spotify', ctx, settingsActions);
    router.push('sub:spotify');
  }
}

// ---- lost states (spec F16) --------------------------------------------------------
// A link that doesn't resolve gets a real screen with a way forward — never a
// silent fall to landing (FLOW-3). `gone` = the server said 404 (deleted or
// retyped); otherwise we're offline with nothing cached.
function renderBadLink(token, { gone }) {
  show('screen-badlink');
  $('badlink-msg').textContent = gone
    ? 'It may have been retyped, or the crew was deleted. Ask your crew for a fresh link and paste it here.'
    : 'You’re offline and this crew isn’t saved on this device yet. Reconnect, then open the link again.';
  if (gone) crew.forgetCrew(token); // dead crews don't haunt the landing list
  else $('badlink-input').value = crew.crewLink(token);
  $('badlink-status').textContent = '';
  $('badlink-open').onclick = () => {
    const m = ($('badlink-input').value || '').match(/g=([A-Za-z0-9_-]{20,40})/);
    if (!m) { $('badlink-status').textContent = 'That doesn’t look like a crew link — it has a #g= part.'; return; }
    const target = `#g=${m[1]}`;
    if (location.hash === target) boot();
    else location.hash = target; // hashchange boots
  };
  $('badlink-home').onclick = () => { history.replaceState(null, '', '/'); renderLanding(); };
}

// The last-resort screen (FLOW-4): an exception escaping boot/enterApp used
// to leave every screen display:none — a permanently blank page.
function renderFatal() {
  try {
    show('screen-error');
    $('error-retry').onclick = () => location.reload();
    $('error-home').onclick = () => { history.replaceState(null, '', '/'); renderLanding(); };
  } catch { /* even the error screen failed — nothing safe left to render */ }
}

// ---- boot -----------------------------------------------------------------------
let bootGeneration = 0;
let pendingFestHint = null; // &f= from the opened invite link, consumed by enterApp
let pendingSpotifyOpen = false; // &sp=1 from the canonical-domain hop (SPOT-1)
export async function boot() {
  const gen = ++bootGeneration;
  const current = () => gen === bootGeneration;
  router.reset();
  // Capture before any await: enterApp's replaceState strips the hash to #g=.
  pendingFestHint = crew.festFromHash();
  pendingSpotifyOpen = /[#&]sp=1(?:&|$)/.test(location.hash || '');
  try {
    try { await loadFestivalIndex(); } catch { /* offline with cache: proceed */ }

    if (location.hash === '#new') { renderCreate(); return; }
    const token = crew.tokenFromHash() || crew.activeCrewToken();
    if (!token) { renderLanding(); return; }

    let doc = null;
    let gone = false;
    try {
      doc = await crew.fetchCrew(token);
      gone = doc === null;
    } catch { /* network failure — try the cache below */ }
    if (!current()) return;
    // A deleted crew is deleted NOW — don't re-enter the app on a stale
    // cached doc just to bounce out one sync later (Codex trailing review).
    if (gone) { renderBadLink(token, { gone: true }); return; }
    if (!doc) doc = state.cachedDoc(token);
    if (!doc) { renderBadLink(token, { gone }); return; }
    if (!crew.me(token)) { renderJoin(token, doc); return; }
    await enterApp(token, doc, current);
  } catch (e) {
    console.error('boot failed', e);
    if (current()) renderFatal();
  }
}

// ---- wiring ----------------------------------------------------------------------
export function init() {
  sync.initSync({
    onRemoteChange: () => { repaintWall(); renderPersonChips(); refreshOpenSheet(); },
    onCrewGone: (token) => {
      // The server said this crew no longer exists — a dead row on the
      // landing list would just 404 again (FLOW-3).
      crew.forgetCrew(token);
      renderLanding();
      showToast($('toast-root'), 'That crew link no longer works — removed from your festivals.', 6000);
    },
  });

  // Browser navigation models the layer stack (FLOW-2): back closes the top
  // layer, forward re-opens it, refresh restores it (spec F10).
  router.registerKind('settings', () => openSettings(), () => closeSettings());
  router.registerKind('sub:', (key) => { openSettings(); openSubviewByKey(key, ctx, settingsActions); }, () => openSettings());
  router.registerKind('sheet:', (key) => {
    refreshCtx();
    if (key === 'sheet:all') openAllNotes(ctx);
    else if (key === 'sheet:share') openShareMoment();
    else if (key.startsWith('sheet:day:')) openDayNotes(key.slice('sheet:day:'.length), ctx, onNotesChange);
    else if (key.startsWith('sheet:notes:')) openArtistSheet(key.slice('sheet:notes:'.length), ctx, onNotesChange);
  }, () => closeSheet());
  window.addEventListener('popstate', (e) => router.onPopState(e.state));
  $('search-input').addEventListener('input', (e) => {
    ctx.query = e.target.value;
    renderWall($('wall-root'), ctx);
    renderDayNav(); // scrollspy re-wires against the filtered day rules (gate F8)
  });
  const sortCtl = createSortControl({ initial: ctx.sort, onChange: (v) => { ctx.sort = v; repaintWall(); } });
  $('sort-control').appendChild(sortCtl.el);
  const dock = $('dock');
  $('search-input').addEventListener('focus', () => dock.classList.add('hidden'));
  $('search-input').addEventListener('blur', () => dock.classList.remove('hidden'));
  const jumpTop = () => window.scrollTo({ top: 0, behavior: ctx.lowPower ? 'auto' : 'smooth' });
  $('dock-you').addEventListener('click', jumpTop);
  $('rail-you').addEventListener('click', jumpTop);
  const openSettingsLayer = () => { openSettings(); router.push('settings'); };
  $('gear-btn').addEventListener('click', openSettingsLayer);
  $('dock-fest-link').addEventListener('click', openSettingsLayer);
  $('notes-chip').addEventListener('click', () => { refreshCtx(); openAllNotes(ctx); router.push('sheet:all'); });
  $('create-go-btn').addEventListener('click', createCrewFlow);
  $('create-back').addEventListener('click', () => { history.replaceState(null, '', '/'); renderLanding(); });
  $('create-back-2').addEventListener('click', () => renderCreate());
  // Enter submits every entry form (FLOW-13) — the keyboard's Go button on
  // mobile is the same event.
  const enterClicks = (inputId, btnId) => {
    $(inputId).addEventListener('keydown', (e) => { if (e.key === 'Enter') $(btnId).click(); });
  };
  enterClicks('create-name-input', 'create-go-btn');
  enterClicks('join-name-input', 'join-add-btn');
  enterClicks('badlink-input', 'badlink-open');
  const saved = appSettings();
  // prefers-reduced-motion rides the same path as Low power (quality floor):
  // the aura/favicon animations stop without the user hunting for a setting.
  applyLowPower(saved.lowPower || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
  window.addEventListener('online', () => { sync.pushSync(); updateMigrationBanner(); });
  // The dot goes gray the moment the radio does — not five minutes later at
  // the next poll (PS-3).
  window.addEventListener('offline', () => { sync.setSyncStatus('offline'); updateMigrationBanner(); });
  // Escape is universal back: pops the top layer through history so the
  // browser's back button and the keyboard always agree (FLOW-2).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !router.requestClose()) closeSheet();
  });
  // Last-resort net (FLOW-4): an early crash used to leave every screen
  // display:none. Only fires when nothing is rendered — a background sync
  // hiccup must never nuke a working wall.
  window.addEventListener('error', () => { if (!anyScreenVisible()) renderFatal(); });
  window.addEventListener('unhandledrejection', () => { if (!anyScreenVisible()) renderFatal(); });
  boot();
}

init();
