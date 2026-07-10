// Settings -> APP tools: bulk paste (round-trips with export), export likes,
// download the wall as a PNG. Kevin's explicit keeps live here.
import * as state from '../state.js';
import * as model from './model.js';
import { parseBulkLineV4, LEVEL_LABELS_V4 } from '../parse.js';

const el = (tag, css, text) => {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (text !== undefined) n.textContent = text;
  return n;
};

function subviewHead(title, onBack) {
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', onBack);
  const t = el('div', '', title); t.className = 'screen-title';
  head.append(back, t);
  return head;
}

// ---- export likes ---------------------------------------------------------------
export function exportLikesText(ctx) {
  const picks = model.picksFor(state.crewDoc, ctx.fid);
  const byPerson = {};
  for (const [artist, byP] of Object.entries(picks)) {
    for (const [person, level] of Object.entries(byP)) {
      (byPerson[person] = byPerson[person] || []).push({ artist, level });
    }
  }
  const blocks = [];
  for (const [person, list] of Object.entries(byPerson)) {
    list.sort((a, b) => b.level - a.level || a.artist.localeCompare(b.artist));
    blocks.push(list.map((x) => `${person}: ${x.artist} (${LEVEL_LABELS_V4[x.level]})`).join('\n'));
  }
  return blocks.join('\n\n');
}

export function openExportLikes(host, ctx, onBack) {
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  col.appendChild(subviewHead('EXPORT LIKES', onBack));
  const ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.value = exportLikesText(ctx) || 'No picks yet.';
  ta.style.cssText = 'width: 100%; min-height: 220px; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-settings); color: var(--text-body); font-size: 12px; font-family: var(--font-ui); padding: 12px; box-sizing: border-box;';
  const copy = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', 'Copy to clipboard');
  copy.className = 'btn-tonal';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(ta.value); copy.textContent = 'Copied ✓'; setTimeout(() => { copy.textContent = 'Copy to clipboard'; }, 1500); }
    catch { ta.select(); }
  });
  col.append(ta, copy,
    el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600;', 'Paste-ready for Bulk paste on another crew or fest.'));
  host.appendChild(col);
}

// ---- bulk paste -------------------------------------------------------------------
export function applyBulkText(text, record) {
  const people = new Set(Object.keys(state.people()).filter((n) => !state.people()[n].removed));
  let applied = 0;
  const unknownPeople = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parsed = parseBulkLineV4(line);
    if (!parsed) continue;
    if (!people.has(parsed.person)) { unknownPeople.add(parsed.person); continue; }
    record(parsed.artistName, parsed.person, parsed.level);
    applied++;
  }
  return { applied, unknownPeople: [...unknownPeople] };
}

export function openBulkPaste(host, actions) {
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  col.appendChild(subviewHead('BULK PASTE LIKES', actions.back));
  col.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;',
    'One per line: Person: Artist (Must) · levels: Picked, Picked ×2, Picked ×3, Must. Old exports (Must See, Highlight, Nice to See) work too.'));
  const ta = document.createElement('textarea');
  ta.placeholder = 'Kevin: GRiZ (Must)';
  ta.style.cssText = 'width: 100%; min-height: 160px; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-settings); color: var(--text-primary); font-size: 12.5px; font-family: var(--font-ui); padding: 12px; box-sizing: border-box; outline: none;';
  const status = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600;');
  const go = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', 'Add / Update');
  go.className = 'btn-tonal';
  go.addEventListener('click', () => {
    const { applied, unknownPeople } = applyBulkText(ta.value, actions.recordPick);
    status.textContent = `${applied} picks applied.` + (unknownPeople.length ? ` Skipped unknown people: ${unknownPeople.join(', ')}.` : '');
    if (applied) actions.afterApply();
  });
  col.append(ta, go, status);
  host.appendChild(col);
}

// ---- download the day as a PNG ------------------------------------------------------
export async function downloadWallImage(festName) {
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas not loaded');
  const root = document.getElementById('wall-root');
  const canvas = await window.html2canvas(root, { backgroundColor: '#0C0A14', scale: 2 });
  const a = document.createElement('a');
  a.download = `${festName.toLowerCase().replace(/\s+/g, '-')}-wall.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
