// Festival tools: PNG download, bulk paste, export list.
import * as state from './state.js';
import { escapeHtml } from './util.js';
import { openInfoModal, closeInfoModal } from './ui.js';
import { renderDay } from './render/grid.js';
import { scheduleSync } from './sync.js';
import { parseBulkLine } from './parse.js';

export function downloadSchedule() {
  if (!state.fest().days || !state.currentDay) {
    openInfoModal(`<p class="text-gray-300">The image download works on the schedule grid — this festival has no stage schedule yet.</p>`);
    return;
  }
  openInfoModal(`<div class="text-center"><h3 class="text-2xl font-bold mb-2 accent-text">Generating Image...</h3><p class="text-gray-300">One moment.</p></div>`);
  const content = document.getElementById('downloadable-content');
  const keyEl = document.getElementById('color-key-container');
  const originalParent = content.parentElement;
  const fest = state.fest();
  const numStages = fest.days[state.currentDay].stages.length;
  const width = 80 + numStages * 200;
  const wrapper = document.createElement('div');
  wrapper.style.backgroundColor = '#1F2937'; wrapper.style.padding = '10px'; wrapper.style.width = width + 'px';
  keyEl.classList.remove('hidden'); keyEl.classList.add('bg-gray-900', 'border-t-2');
  const headers = content.querySelectorAll('.sticky');
  headers.forEach(h => h.classList.remove('sticky'));
  wrapper.appendChild(content); document.body.appendChild(wrapper);
  html2canvas(wrapper, { backgroundColor: '#1F2937', scale: 2, width, windowWidth: width }).then(canvas => {
    const imageUrl = canvas.toDataURL('image/png');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const t = window.open();
      if (t) t.document.body.innerHTML = `<body style="background:#111827;"><h3 style="color:#fff;font-family:sans-serif;text-align:center;padding:1rem;">Long-press the image to save</h3><img src="${imageUrl}" style="width:100%;"></body>`;
    } else {
      const link = document.createElement('a');
      const dpart = ((fest.dayMeta || {})[state.currentDay]?.date || state.currentDay).toLowerCase().replace(/\s+/g, '-');
      link.download = `${fest.name.toLowerCase().replace(/\s+/g, '-')}-${dpart}.png`;
      link.href = imageUrl; link.click();
    }
  }).catch(err => { console.error(err); openInfoModal(`<p>Sorry, image generation failed.</p>`); })
    .finally(() => {
      headers.forEach(h => h.classList.add('sticky'));
      keyEl.classList.add('hidden'); keyEl.classList.remove('bg-gray-900', 'border-t-2');
      originalParent.appendChild(content); document.body.removeChild(wrapper); closeInfoModal();
    });
}

export function handleBulkAdd() {
  const input = document.getElementById('artist-paste-input');
  const raw = input.value.trim();
  if (!raw) { alert('Paste a list of picks first.'); return; }
  const fest = state.fest();
  const allArtists = fest.days
    ? Object.values(fest.days).flatMap(d => d.artists)
    : fest.artists;
  let found = 0; const notFound = [];
  raw.split('\n').forEach(line => {
    const parsed = parseBulkLine(line);
    if (!parsed) return;
    const { person, artistName, level } = parsed;
    if (!state.isActivePerson(state.people()[person])) return;
    const hit = allArtists.find(a => a.name.toUpperCase() === artistName.toUpperCase());
    if (!hit) { notFound.push(artistName); return; }
    (state.selections()[hit.name] = state.selections()[hit.name] || {})[person] = level;
    state.recordSelection(hit.name, person, level);
    found++;
  });
  state.persist(); scheduleSync(); renderDay(state.currentDay); input.value = '';
  let html = `<h2 class="text-xl font-bold accent-text mb-2">Bulk Add Results</h2><p class="text-gray-300 mb-2">Added/updated ${found} selections.</p>`;
  if (notFound.length) html += `<h3 class="text-lg font-semibold text-gray-100 mt-3">Not found:</h3><ul>${[...new Set(notFound)].map(n => `<li class="text-gray-300 ml-4 list-disc list-inside">${escapeHtml(n)}</li>`).join('')}</ul>`;
  openInfoModal(html);
}

export function exportLikes() {
  let out = '';
  Object.keys(state.people()).filter(p => state.isActivePerson(state.people()[p])).forEach(person => {
    const lines = [];
    Object.keys(state.selections()).forEach(artist => {
      const lvl = state.selections()[artist][person];
      if (lvl > 0) {
        const priority = lvl === 2 ? 'Highlight' : lvl === 3 ? 'Must See' : 'Nice to See';
        lines.push(`${person}: ${artist} (${priority})`);
      }
    });
    if (lines.length) out += lines.join('\n') + '\n\n';
  });
  if (!out) out = 'No selections yet.';
  const html = `<h2 class="text-xl font-bold accent-text mb-2">All Group Selections</h2><p class="text-sm text-gray-400 mb-3">Compatible with the Bulk Add tool.</p><textarea id="csv-output" class="w-full h-64 p-2 rounded bg-gray-900 border border-gray-600 text-white mb-3" readonly>${escapeHtml(out.trim())}</textarea><button id="copy-csv-btn" class="accent-button">Copy to Clipboard</button>`;
  openInfoModal(html);
  document.getElementById('copy-csv-btn').onclick = () => {
    const ta = document.getElementById('csv-output'); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    const b = document.getElementById('copy-csv-btn'); b.textContent = 'Copied!';
    setTimeout(() => { b.textContent = 'Copy to Clipboard'; }, 2000);
  };
}
