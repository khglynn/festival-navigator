// Artist list view — the home view for festivals whose stage schedule hasn't
// dropped yet (status "lineup"), and a toggle for scheduled ones. Same
// tap-to-cycle picks as the grid, keyed by artist name, so picks made here
// carry straight into the grid when set times are announced.
import * as state from '../state.js';
import { escapeHtml } from '../util.js';
import { timeToMinutes } from '../time.js';

// Module-local UI state (per session; deliberately not synced).
let sortBy = 'billing';   // billing | name | day | mypick | crew
let search = '';
let weekendFilter = 'all'; // all | W1 | W2 (only shown when data has weekends)

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayRank = (d) => { const i = DAY_ORDER.indexOf(d); return i === -1 ? 99 : i; };

function crewHeat(sel, peopleObj) {
  let heat = 0;
  for (const [person, lvl] of Object.entries(sel || {})) {
    if (lvl > 0 && state.isActivePerson(peopleObj[person])) heat += lvl;
  }
  return heat;
}

export function renderList() {
  const el = document.getElementById('list-view');
  const fest = state.fest();
  const peopleObj = state.people();
  const selections = state.selections();
  const hasWeekends = (fest.artists || []).some((a) => a.weekends);
  const hasDays = (fest.artists || []).some((a) => a.day);

  let rows = (fest.artists || []).map((a, i) => ({
    ...a,
    billing: i,
    sel: selections[a.name] || {},
    myLevel: state.selectedPerson ? (selections[a.name] || {})[state.selectedPerson] || 0 : 0,
    heat: crewHeat(selections[a.name], peopleObj),
  }));

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  if (hasWeekends && weekendFilter !== 'all') {
    rows = rows.filter((r) => !r.weekends || r.weekends === 'both' || r.weekends === weekendFilter);
  }

  const cmp = {
    billing: (a, b) => a.billing - b.billing,
    name: (a, b) => a.name.localeCompare(b.name),
    day: (a, b) => dayRank(a.day) - dayRank(b.day) || (a.time && b.time ? timeToMinutes(a.time.split(' - ')[0]) - timeToMinutes(b.time.split(' - ')[0]) : 0) || a.billing - b.billing,
    mypick: (a, b) => b.myLevel - a.myLevel || a.billing - b.billing,
    crew: (a, b) => b.heat - a.heat || a.billing - b.billing,
  }[sortBy] || ((a, b) => a.billing - b.billing);
  rows.sort(cmp);

  const controls = `
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <input id="list-search" type="search" placeholder="Search artists…" value="${escapeHtml(search)}"
             class="flex-grow min-w-40 p-2 rounded bg-gray-700 border border-gray-600 text-white text-sm">
      <select id="list-sort" class="bg-gray-700 text-white text-sm rounded-md px-2 py-2 border border-gray-600">
        <option value="billing"${sortBy === 'billing' ? ' selected' : ''}>Billing order</option>
        <option value="name"${sortBy === 'name' ? ' selected' : ''}>A → Z</option>
        ${hasDays ? `<option value="day"${sortBy === 'day' ? ' selected' : ''}>By day</option>` : ''}
        <option value="mypick"${sortBy === 'mypick' ? ' selected' : ''}>My picks first</option>
        <option value="crew"${sortBy === 'crew' ? ' selected' : ''}>Crew favorites</option>
      </select>
      ${hasWeekends ? `
      <select id="list-weekend" class="bg-gray-700 text-white text-sm rounded-md px-2 py-2 border border-gray-600">
        <option value="all"${weekendFilter === 'all' ? ' selected' : ''}>Both weekends</option>
        <option value="W1"${weekendFilter === 'W1' ? ' selected' : ''}>Weekend 1</option>
        <option value="W2"${weekendFilter === 'W2' ? ' selected' : ''}>Weekend 2</option>
      </select>` : ''}
      <span class="text-xs text-gray-500">${rows.length} artists · tap to pick</span>
    </div>`;

  const affMap = state.affinityLookup(state.selectedPerson);
  const items = rows.map((r) => {
    const aff = affMap ? affMap[r.name.toLowerCase()] : null;
    // Affinity is server-validated (songs int, followed bool), but it syncs
    // from other crew members — coerce at the sink anyway.
    const songs = aff ? (Number(aff.songs) || 0) : 0;
    const followed = aff ? aff.followed === true : false;
    const affBadge = (songs || followed)
      ? `<span class="text-[10px] font-bold text-[#1DB954] ml-1" title="${followed ? 'You follow them' : ''}${followed && songs ? ' · ' : ''}${songs ? songs + ' liked songs' : ''}">${followed ? '★' : ''}${songs ? '♥' + songs : ''}</span>`
      : '';
    const active = Object.entries(r.sel).filter(([p, lvl]) => lvl > 0 && state.isActivePerson(peopleObj[p]));
    const dots = active.map(([p, lvl]) =>
      `<span class="inline-block w-3 h-3 rounded-full border border-gray-900" title="${escapeHtml(p)}: ${lvl === 3 ? 'Must See' : lvl === 2 ? 'Highlight' : 'Nice to See'}" style="background: rgba(${peopleObj[p].color}, ${state.opacities[lvl - 1]})"></span>`
    ).join('');
    const meta = [r.day, r.stage, r.time].filter(Boolean).join(' · ');
    const wk = r.weekends && r.weekends !== 'both'
      ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-600 text-gray-200 ml-1">${r.weekends} only</span>` : '';
    const myLvl = r.myLevel;
    const ring = myLvl === 2 ? 'outline outline-2 outline-dashed outline-white/80' : '';
    const bg = myLvl > 0 && state.selectedPerson
      ? `background: rgba(${peopleObj[state.selectedPerson].color}, ${state.opacities[myLvl - 1]})` : '';
    return `
      <div class="list-artist flex items-center gap-3 py-2 px-3 rounded-md bg-gray-700/60 cursor-pointer select-none ${ring}"
           style="${bg}" data-artist="${escapeHtml(r.name)}">
        <div class="flex-grow min-w-0">
          <p class="font-semibold text-gray-100 truncate">${escapeHtml(r.name)}${affBadge}${wk}</p>
          ${meta ? `<p class="text-xs text-gray-400">${escapeHtml(meta)}</p>` : ''}
        </div>
        <div class="flex gap-1 shrink-0">${dots}</div>
      </div>`;
  }).join('');

  el.innerHTML = `<div class="schedule-container">${controls}<div class="flex flex-col gap-1.5">${items || '<p class="text-gray-400 text-sm">No artists announced yet — check back when the lineup drops.</p>'}</div></div>`;

  document.getElementById('list-search').oninput = (e) => { search = e.target.value; renderList(); };
  document.getElementById('list-sort').onchange = (e) => { sortBy = e.target.value; renderList(); };
  const wkSel = document.getElementById('list-weekend');
  if (wkSel) wkSel.onchange = (e) => { weekendFilter = e.target.value; renderList(); };
}

export function resetListState() { sortBy = 'billing'; search = ''; weekendFilter = 'all'; }
