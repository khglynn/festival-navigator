// Settings -> APP tools: bulk paste (round-trips with export), export likes,
// download the wall as a PNG. Kevin's explicit keeps live here.
import * as state from '../state.js';
import * as model from './model.js';
import { parseBulkLineV4, LEVEL_LABELS_V4 } from '../parse.js';
import { renderCard, groupByDay, knownDaysOf } from './wall.js';

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
// Integrity rules (CORE-8): only known people, only artists actually in this
// fest (recorded under the lineup's canonical spelling), only understood
// levels — and if writes are gated (migration pending) NOTHING counts as
// applied. Every skip is reported, never silently dropped.
export function applyBulkText(text, record) {
  const people = new Set(Object.keys(state.people()).filter((n) => !state.people()[n].removed));
  const fest = state.fest();
  const canon = new Map(); // lowercase -> the lineup's canonical spelling
  for (const a of fest.artists || []) canon.set(a.name.toLowerCase(), a.name);
  for (const day of Object.keys(fest.days || {})) {
    for (const a of (fest.days[day].artists || [])) canon.set(a.name.toLowerCase(), a.name);
  }
  let applied = 0;
  let blocked = false;
  const unknownPeople = new Set();
  const unknownArtists = new Set();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parsed = parseBulkLineV4(line);
    if (!parsed) { badLines++; continue; }
    if (!people.has(parsed.person)) { unknownPeople.add(parsed.person); continue; }
    const canonical = canon.get(parsed.artistName.toLowerCase());
    if (!canonical) { unknownArtists.add(parsed.artistName); continue; }
    if (record(canonical, parsed.person, parsed.level) === false) { blocked = true; break; }
    applied++;
  }
  return { applied, blocked, unknownPeople: [...unknownPeople], unknownArtists: [...unknownArtists], badLines };
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
    const r = applyBulkText(ta.value, actions.recordPick);
    if (r.blocked) {
      status.textContent = 'This crew is still updating — nothing was applied. Try again in a moment.';
      return;
    }
    const parts = [`${r.applied} picks applied.`];
    if (r.unknownPeople.length) parts.push(`Unknown people skipped: ${r.unknownPeople.join(', ')}.`);
    if (r.unknownArtists.length) {
      const shown = r.unknownArtists.slice(0, 8).join(', ');
      parts.push(`Not in this lineup: ${shown}${r.unknownArtists.length > 8 ? '…' : ''}.`);
    }
    if (r.badLines) parts.push(`${r.badLines} line${r.badLines > 1 ? 's' : ''} not understood.`);
    status.textContent = parts.join(' ');
    if (r.applied) actions.afterApply();
  });
  col.append(ta, go, status);
  host.appendChild(col);
}

// ---- day image (share a day's wall as a PNG) ----------------------------------------
// The old exporter captured #wall-root — display:none from Settings, so it
// shipped 0-byte PNGs silently, and it grabbed EVERY day at once (CORE-7).
// This one builds one day offscreen at a fixed share-friendly width, checks
// the canvas is real, and says out loud when it can't.

const dayArtistsFor = (day) => {
  const fest = state.fest();
  if (fest.days && Object.keys(fest.days).length) {
    return [...state.getDayArtists(day)]
      .sort((x, y) => x.startMin - y.startMin)
      .map((a) => ({ name: a.name, time: `${a.stage} · ${a.startStr}` }));
  }
  const groups = groupByDay(fest.artists || [], knownDaysOf(fest));
  return (groups.get(day) || []).map((a) => ({ name: a.name }));
};

async function buildDayCanvas(day, ctx) {
  if (typeof window.html2canvas !== 'function') throw new Error('html2canvas-missing');
  const fest = state.fest();
  // Offscreen but laid out (html2canvas can't capture display:none), fixed
  // width so the share artifact is identical from any device.
  const node = el('div', 'position: absolute; left: -10000px; top: 0; width: 1080px; background: #0C0A14; padding: 36px 40px 28px; box-sizing: border-box; font-family: var(--font-ui);');
  const head = el('div', 'display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px;');
  head.appendChild(el('span', `font-family: var(--font-display); letter-spacing: .05em; font-size: 40px; color: rgb(${fest.accent || '192, 132, 252'});`, fest.name.toUpperCase()));
  head.appendChild(el('span', 'color: #8E86A8; font-size: 16px; font-weight: 700;', (day || 'THE LINEUP').toUpperCase()));
  node.appendChild(head);
  const grid = el('div', 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;');
  // lowPower ctx: grain + animation lean on mix-blend / keyframes that
  // html2canvas renders unreliably — the flat aura is the honest export.
  const exportCtx = { ...ctx, lowPower: true, onOpenNotes: null, onTap: () => {} };
  for (const a of dayArtistsFor(day)) grid.appendChild(renderCard(a.name, exportCtx, { time: a.time }));
  node.appendChild(grid);
  node.appendChild(el('div', 'margin-top: 18px; color: #5D5578; font-size: 12px; font-weight: 700; letter-spacing: .08em;', `${state.crewName().toUpperCase()} · FESTIVAL NAVIGATOR`));
  document.body.appendChild(node);
  try {
    const canvas = await window.html2canvas(node, { backgroundColor: '#0C0A14', scale: 2, width: 1080, windowWidth: 1080 });
    if (!canvas || !canvas.width || !canvas.height) throw new Error('empty-canvas');
    return canvas;
  } finally {
    node.remove();
  }
}

export function openDayImage(host, ctx, onBack) {
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  col.appendChild(subviewHead('DAY IMAGE', onBack));
  col.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;',
    'Pick a day — you get a PNG of its wall with everyone’s picks, sized for a group chat.'));
  const status = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600;');
  const fest = state.fest();
  const scheduled = fest.days && Object.keys(fest.days).length;
  const days = scheduled
    ? Object.keys(fest.days)
    : [...groupByDay(fest.artists || [], knownDaysOf(fest)).keys()];
  if (!days.length) status.textContent = 'No lineup yet — nothing to export.';
  for (const day of days) {
    const row = el('button', 'width: 100%;');
    row.className = 'fest-row';
    const label = el('span', 'flex: 1; text-align: left; color: var(--text-primary); font-weight: 700; font-size: 13.5px;', day || 'THE LINEUP');
    const chev = el('span', '', '›'); chev.className = 'chev';
    row.append(label, chev);
    row.addEventListener('click', async () => {
      row.disabled = true;
      status.textContent = 'Building the image…';
      try {
        const canvas = await buildDayCanvas(day, ctx);
        const a = document.createElement('a');
        const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        a.download = `${slug(fest.name)}${day ? `-${slug(day)}` : ''}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        status.textContent = 'Saved — check your downloads or share sheet.';
      } catch (e) {
        status.textContent = String(e.message).includes('html2canvas')
          ? 'The image tool didn’t load — check your connection and reload the app.'
          : 'Couldn’t build the image — try again.';
      } finally {
        row.disabled = false;
      }
    });
    col.appendChild(row);
  }
  col.appendChild(status);
  host.appendChild(col);
}
