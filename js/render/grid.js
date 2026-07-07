// Schedule grid + activities list rendering, and pick-state painting.
import * as state from '../state.js';
import { absMinToLabel, activityMinutes } from '../time.js';
import { escapeHtml, cssEscape } from '../util.js';
import { renderLegend } from './people.js';
import { computeLanes } from '../overlap.js';

let gridBaseMin = 12 * 60; // recomputed per day in renderDay to trim empty lead time
function minToRow(min) { return Math.floor((min - gridBaseMin) / 15) + 2; }

function shortStage(name) {
  return name
    .replace('Toyota Music Den', 'Toyota Den').replace('Kidzapalooza', 'Kidza')
    .replace('Bonus Tracks', 'Bonus').replace('Bud Light Backyard', 'Backyard');
}

export function renderDay(day) {
  state.setCurrentDay(day);
  const fest = state.fest();
  const dm = (fest.dayMeta || {})[day];
  const dayLabel = dm ? `${dm.wd} ${dm.date}` : day;
  document.getElementById('schedule-day-title').textContent = `${dayLabel} · ${fest.name}`;
  const dayData = fest.days[day];
  const activeStages = dayData.stages;
  const numStages = activeStages.length;
  document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', t.dataset.day === day));

  const computed = state.getDayArtists(day);
  // Trim empty lead time: start the grid on the hour ~30 min before the day's first set.
  const firstStart = computed.length ? Math.min(...computed.map(a => a.startMin)) : (fest.dayStartHour || 12) * 60;
  gridBaseMin = Math.floor((firstStart - 30) / 60) * 60;
  const maxMin = computed.reduce((m, a) => Math.max(m, a.endMin), gridBaseMin + 60);
  const lastRow = minToRow(maxMin) + 1;

  let html = `<div class="schedule-grid" style="grid-template-columns: 64px repeat(${numStages}, minmax(120px, 1fr)); grid-template-rows: auto repeat(${lastRow}, 20px);">`;
  html += `<div class="stage-title text-center p-2 sticky top-0 bg-gray-800 z-10">TIME</div>`;
  activeStages.forEach(s => {
    html += `<div class="stage-title text-center sticky top-0 bg-gray-800 p-2 z-10 text-sm">${shortStage(s)}</div>`;
  });

  for (let m = gridBaseMin; m <= maxMin; m += 60) {
    html += `<div class="time-label" style="grid-row: ${minToRow(m)}">${absMinToLabel(m)}</div>`;
  }

  // Same-stage overlaps split the column into side-by-side lanes (the
  // graceful replacement for the old fixed "also happening" workaround).
  const lanes = computeLanes(computed);
  // Spotify badges follow the selected person (their liked/followed artists).
  const affMap = state.affinityLookup(state.selectedPerson);
  computed.forEach(a => {
    const stageIndex = activeStages.indexOf(a.stage) + 2;
    if (stageIndex < 2) return;
    const startRow = minToRow(a.startMin);
    const endRow = minToRow(a.endMin);
    const duration = a.endMin - a.startMin;
    const { lane, lanes: laneCount } = lanes.get(a) || { lane: 0, lanes: 1 };
    const short = (duration <= 40 || a.name.length > 16 || laneCount > 1) ? 'artist-text-short' : '';
    const span = Math.max(1, endRow - startRow);
    const laneStyle = laneCount > 1
      ? ` width: calc(${100 / laneCount}% - 2px); margin-left: ${(100 / laneCount) * lane}%; justify-self: start;`
      : '';
    const aff = affMap ? affMap[a.name.toLowerCase()] : null;
    const affCls = aff ? ' has-spotify' : '';
    const affBadge = aff
      ? `<span class="spotify-badge" title="${aff.followed ? 'You follow them' : ''}${aff.followed && aff.songs ? ' · ' : ''}${aff.songs ? aff.songs + ' liked songs' : ''}">${aff.followed ? '★' : ''}${aff.songs ? '♥' + aff.songs : ''}</span>`
      : '';
    html += `
        <div class="artist-card bg-gray-700 rounded-md p-1 flex flex-col justify-center items-center text-center h-full${affCls}"
             style="grid-column: ${stageIndex}; grid-row: ${startRow} / span ${span};${laneStyle}"
             data-artist="${escapeHtml(a.name)}">
            ${affBadge}
            <p class="font-bold leading-tight text-gray-100 pointer-events-none ${short}">${escapeHtml(a.name)}</p>
            <p class="text-xs text-gray-400 pointer-events-none ${short}">${a.startStr}</p>
        </div>`;
  });
  html += `</div>`;
  document.getElementById('schedule-view').innerHTML = html;

  renderLegend();
  Object.keys(state.selections()).forEach(updateArtistHighlight);
  renderActivities(day);
}

export function renderActivities(day) {
  const el = document.getElementById('activities-view');
  if (!el) return;
  const list = (state.fest().activities || {})[day] || [];
  if (!list.length) { el.innerHTML = ''; return; }
  const sorted = [...list].sort((a, b) => activityMinutes(a.time.split(' - ')[0]) - activityMinutes(b.time.split(' - ')[0]));
  const rows = sorted.map(a => `<div class="flex items-baseline gap-3 py-1.5 border-b border-gray-700">
        <span class="text-xs text-gray-400 w-36 shrink-0">${escapeHtml(a.time)}</span>
        <span class="flex-grow text-sm text-gray-100">${escapeHtml(a.name)}</span>
        <span class="text-xs accent-text shrink-0">${escapeHtml(a.venue)}</span>
    </div>`).join('');
  el.innerHTML = `<div class="schedule-container"><h2 class="text-xl md:text-2xl font-bold accent-text mb-3">Also happening · The Brainery &amp; Silent Disco</h2>${rows}</div>`;
}

export function updateArtistHighlight(artistName) {
  const cards = document.querySelectorAll(`[data-artist="${cssEscape(artistName)}"]`);
  if (!cards.length) return;
  const sel = state.selections()[artistName] || {};
  // Only levels 1/2/3 count; 0 (or missing person) means not selected.
  const active = Object.entries(sel).filter(([p, lvl]) => lvl > 0 && state.isActivePerson(state.people()[p]));
  cards.forEach(card => {
    card.classList.remove('highlight-artist');
    if (!active.length) { card.style.background = ''; return; }
    let highlight = false;
    const stops = active.map(([p, lvl]) => {
      if (lvl === 2) highlight = true;
      return `rgba(${state.people()[p].color}, ${state.opacities[lvl - 1]})`;
    });
    if (highlight) card.classList.add('highlight-artist');
    card.style.background = stops.length === 1 ? stops[0] : `linear-gradient(135deg, ${stops.join(', ')})`;
  });
}
