// Crew chips + legend.
import * as state from '../state.js';
import { escapeHtml } from '../util.js';

// callbacks: { onSelect(name), onRemove(name), onAdd() }
export function renderPeople(callbacks) {
  const container = document.getElementById('person-selectors');
  container.innerHTML = '';
  state.activePeople().forEach(([name, { color }]) => {
    const wrap = document.createElement('div');
    wrap.className = 'relative';
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.dataset.person = name;
    btn.className = 'person-selector font-semibold py-2 px-4 rounded-full border-2 transition-all duration-200';
    const selected = name === state.selectedPerson;
    btn.style.backgroundColor = `rgba(${color}, ${selected ? 1 : 0.4})`;
    btn.style.borderColor = selected ? '#fff' : `rgba(${color}, 0.7)`;
    btn.style.color = selected ? '#fff' : '#E5E7EB';
    if (selected) btn.classList.add('selected');
    btn.onclick = () => callbacks.onSelect(name);
    const x = document.createElement('button');
    x.textContent = '×';
    x.title = `Remove ${name}`;
    x.className = 'absolute -top-1 -right-1 bg-gray-900 text-gray-400 hover:text-white rounded-full w-4 h-4 text-xs leading-none flex items-center justify-center border border-gray-600';
    x.onclick = (e) => { e.stopPropagation(); callbacks.onRemove(name); };
    wrap.appendChild(btn); wrap.appendChild(x);
    container.appendChild(wrap);
  });
  const add = document.createElement('button');
  add.textContent = '+ Add';
  add.className = 'font-semibold py-2 px-4 rounded-full border-2 border-dashed border-gray-500 text-gray-300 hover:border-white hover:text-white transition';
  add.onclick = callbacks.onAdd;
  container.appendChild(add);
}

export function renderLegend() {
  let html = `<div class="p-4"><h3 class="text-lg font-bold accent-text mb-3 text-center">LEGEND</h3><div class="flex flex-wrap justify-center items-center gap-x-4 gap-y-2">`;
  state.activePeople().forEach(([name, { color }]) => {
    html += `<div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full" style="background-color: rgba(${color},1)"></span><span>${escapeHtml(name)}</span></div>`;
  });
  html += `<div class="flex items-center gap-2"><span class="w-4 h-4 rounded-full border-2 border-dashed border-white"></span><span>Highlight (Must See+)</span></div>`;
  html += `</div></div>`;
  document.getElementById('color-key-container').innerHTML = html;
}
