// Import from a festival app's schedule export — the sheet (2026-09-26,
// Kevin at Portola: "folks could import these to add to their lists. But I
// think it'd be like a flow cause they'd need to land their levels. We could
// start them at like mid — 2 level pick?").
//
// ONE surface that grows as it goes, never a wizard: the images you chose
// sit in a row at the top, each saying what it is as it is read ("SAT · 4
// sets"); under them each day's sets arrive as the wall's own cards, at your
// colour and level 2, in the festival's day order; a tap on a card cycles its
// level exactly the way a tap on the wall does (1 → 2 → 3 → must → off); and
// one button at the foot adds them — for you, through the app's ordinary pick
// path (app.js recordPick), then the wall. Nothing is written before that
// button, and nothing but your own picks ever is.
//
// What it never does: lower (or touch) a pick you already have — those sit
// on one line under their day at your level, not in the import; guess a name
// the lineup does not have — those are listed plainly under their day; or
// keep the image — it goes to /api/import-schedule once, shrunk on the phone
// to ~1080px JPEG, and is neither stored nor logged there.
import * as state from '../state.js';
import * as model from './model.js';
import { renderCard, refreshCard, meterChip, colorIndexOf } from './wall.js';
import { meterOf } from './aura.js';
import { sheetChrome, dialogize, rememberOpener, closeSheet } from './notes.js';
import { eqLoader } from './tools.js';
import { appSettings } from './settings.js';
import { lineupIndex, matchRead, startLevel, picksToWrite } from './import-match.js';
import { canAnimate, GROW_MS, STAGGER_MS, CASCADE_MS, EASE_ARRIVE } from './motion.js';
import { record } from '../errlog.js';

const MAX_IMAGES = 8;          // a festival is a few days; this is a quota guard, not a design
const MAX_W = 1080;            // the export's own width: sharp enough to read, small to send
const MAX_H = 4096;            // a long scrolling screenshot keeps its width
const JPEG_QUALITY = 0.85;
const MAX_SEND_BYTES = 3 * 1024 * 1024; // api/import-schedule.js MAX_IMAGE_BYTES
const READ_TIMEOUT_MS = 45000; // an upload on one bar plus ~6 s of reading
const PARALLEL = 2;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

// ---- the image, made small on the phone -----------------------------------------
// Decoded (createImageBitmap, or an <img> where that cannot read the file),
// drawn at most MAX_W wide and re-encoded as JPEG. A file the browser cannot
// draw is sent as it is when the server can read its type and it fits;
// otherwise it is "Can't open this image" on its own tile.
function dataUrlOf(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(blob);
  });
}
async function decode(file) {
  if (typeof window.createImageBitmap === 'function') {
    try { return await window.createImageBitmap(file); } catch { /* an <img> may still read it */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function imagePayload(file) {
  let src = null;
  try { src = await decode(file); } catch { src = null; }
  const w = src ? (src.width || src.naturalWidth || 0) : 0;
  const h = src ? (src.height || src.naturalHeight || 0) : 0;
  if (w > 0 && h > 0) {
    const k = Math.min(1, MAX_W / w, MAX_H / h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * k));
    canvas.height = Math.max(1, Math.round(h * k));
    const g = canvas.getContext('2d');
    if (g) {
      g.drawImage(src, 0, 0, canvas.width, canvas.height);
      if (typeof src.close === 'function') src.close();
      const blob = await new Promise((resolve) => {
        try { canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY); } catch { resolve(null); }
      });
      if (blob && blob.size) return dataUrlOf(blob);
    }
  }
  if (/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type || '') && file.size <= MAX_SEND_BYTES) return dataUrlOf(file);
  throw Object.assign(new Error('unreadable image'), { code: 'decode' });
}

// One image to the reader. Resolves {read} or {error: <code>}; never throws.
const ERRORS = {
  offline: 'Needs signal',
  stay: 'Stay offline is on',
  decode: 'Can’t open this image',
  big: 'Too big to send',
  crew: 'Open your crew’s link first',
  slow: 'Too slow — tap to retry',
  busy: 'Busy — tap to retry',
  failed: 'Couldn’t read — tap to retry',
};
export async function readImage(file, token, { fetchImpl = (...a) => fetch(...a) } = {}) {
  if (appSettings().stayOffline) return { error: 'stay' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { error: 'offline' };
  let image;
  try { image = await imagePayload(file); } catch (e) { return { error: e && e.code === 'decode' ? 'decode' : 'failed' }; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetchImpl('/api/import-schedule', {
      method: 'POST',
      // The crew token rides a header, never the URL (platform logs keep URLs).
      headers: { 'Content-Type': 'application/json', 'X-Crew-Token': token },
      body: JSON.stringify({ image }),
      cache: 'no-store',
      signal: ctrl.signal,
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (res.ok && body && Array.isArray(body.items)) return { read: body };
    if (res.status === 413) return { error: 'big' };
    if (res.status === 400) return { error: 'decode' };
    if (res.status === 401) return { error: 'crew' };
    if (res.status === 429) return { error: 'busy' };
    return { error: 'failed' };
  } catch (e) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { error: 'offline' };
    return { error: e && e.name === 'AbortError' ? 'slow' : 'failed' };
  } finally {
    clearTimeout(timer);
  }
}

// ---- the sheet ------------------------------------------------------------------
// opts: { ctx, fest, token, me, record(name, level) -> bool, done(count),
//         read? (tests pass a stub reader) }
export function openImportSheet(opts) {
  const { ctx, fest, token, me } = opts;
  const readOne = opts.read || ((file) => readImage(file, token));
  const index = lineupIndex(fest);
  const festDays = Object.keys(fest.days || {});
  // The picks you had when the sheet opened, by name; re-read at Add.
  const mineNow = () => {
    const out = new Map();
    for (const [name, byP] of Object.entries(ctx.picks || {})) {
      const lvl = byP && byP[me];
      if (lvl > 0) out.set(name, lvl);
    }
    return out;
  };
  const mine = mineNow();

  // shots: [{ file, url, key, state: 'reading'|'read'|'empty'|'error', error, read, tile }]
  const shots = [];
  // groups: key -> { key, label, day, order, printedDays: Set, matched: Map(name -> entry), unknown: Set, festivals: Set, node }
  const groups = new Map();
  // The level each imported name will land at — one per NAME, so a set on
  // two images (Despacio plays both days) is one pick and one level.
  const levels = new Map();
  let closed = false;
  let queue = [];
  let running = 0;

  rememberOpener();
  closeSheet();
  const backdrop = el('div', 'sheet-backdrop');
  backdrop.id = 'sheet-backdrop';
  backdrop.addEventListener('click', () => opts.close());
  const sheet = el('div', 'sheet import-sheet');
  sheet.id = 'artist-sheet'; // closeSheet + the router's sheet kind own this id
  sheet.dataset.import = 'choose';
  sheetChrome(sheet, `FROM THE ${String(fest.name || '').toUpperCase()} APP`);

  const lede = el('p', 'imp-lede',
    `Export your schedule from the ${fest.name} app — it makes one image per day — then choose the images here.`);
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.className = 'imp-input';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  // The row of images, and the dashed "+" that asks for more. Before the
  // first choice the "+" is the whole width: the one thing to do here.
  const shotsRow = el('div', 'imp-shots');
  shotsRow.setAttribute('role', 'list');
  const add = el('button', 'imp-add');
  add.type = 'button';
  const addGlyph = el('span', 'imp-add-glyph', '+');
  addGlyph.setAttribute('aria-hidden', 'true');
  const addWord = el('span', 'imp-add-word', 'Choose images');
  add.append(addGlyph, addWord);
  add.setAttribute('aria-label', 'Choose schedule images');
  add.addEventListener('click', () => input.click());
  shotsRow.appendChild(add);

  const shotsNote = el('div', 'imp-note imp-shots-note');
  shotsNote.setAttribute('aria-live', 'polite');
  const days = el('div', 'imp-days');
  const foot = el('div', 'imp-foot');
  const go = el('button', 'btn-tonal imp-go');
  go.type = 'button';
  go.disabled = true;
  const status = el('div', 'imp-status');
  status.setAttribute('aria-live', 'polite');
  foot.append(status, go);
  sheet.append(lede, input, shotsRow, shotsNote, days, foot);
  dialogize(sheet, `Import from the ${fest.name} app`);
  document.body.append(backdrop, sheet);

  // Drop images on the sheet (a laptop): the same as choosing them.
  sheet.addEventListener('dragover', (e) => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
  sheet.addEventListener('drop', (e) => {
    const files = e.dataTransfer ? [...e.dataTransfer.files] : [];
    if (!files.length) return;
    e.preventDefault();
    take(files);
  });
  input.addEventListener('change', () => {
    const files = [...(input.files || [])];
    input.value = '';
    take(files);
  });

  function take(files) {
    if (closed) return;
    const images = files.filter((f) => /^image\//.test(f.type || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || ''));
    const room = MAX_IMAGES - shots.length;
    let skipped = files.length - images.length;
    const fresh = [];
    for (const file of images) {
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (shots.some((s) => s.key === key)) continue;
      if (fresh.length >= room) { skipped++; continue; }
      fresh.push({ file, key, state: 'reading', error: null, read: null, tile: null, url: null });
    }
    shotsNote.textContent = skipped > 0
      ? (shots.length + fresh.length >= MAX_IMAGES ? `Up to ${MAX_IMAGES} images at a time.` : 'Only images can be read.')
      : '';
    if (!fresh.length) return;
    sheet.dataset.import = 'reading';
    shotsRow.classList.add('has-shots');
    addWord.textContent = 'More';
    fresh.forEach((s, i) => {
      shots.push(s);
      s.tile = shotTile(s);
      shotsRow.insertBefore(s.tile, add);
      if (canAnimate(s.tile, ctx)) {
        s.tile.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: GROW_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
      }
      queue.push(s);
    });
    paintFoot();
    pump();
  }

  function shotTile(s) {
    const tile = el('div', 'imp-shot');
    tile.setAttribute('role', 'listitem');
    const face = el('button', 'imp-shot-face');
    face.type = 'button';
    try { s.url = URL.createObjectURL(s.file); } catch { s.url = null; }
    if (s.url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = s.url;
      face.appendChild(img);
    }
    // A tile that failed is its own retry.
    face.addEventListener('click', () => {
      if (s.state !== 'error' || closed) return;
      s.state = 'reading';
      s.error = null;
      paintShot(s);
      paintFoot();
      queue.push(s);
      pump();
    });
    const cap = el('div', 'imp-shot-cap');
    tile.append(face, cap);
    tile._face = face;
    tile._cap = cap;
    paintShot(s, tile);
    return tile;
  }

  function paintShot(s, tile = s.tile) {
    if (!tile) return;
    tile.dataset.state = s.state;
    const cap = tile._cap;
    cap.textContent = '';
    const face = tile._face;
    face.disabled = s.state !== 'error';
    if (s.state === 'reading') {
      cap.appendChild(eqLoader('Reading'));
      face.setAttribute('aria-label', `${s.file.name || 'Image'}: reading`);
    } else if (s.state === 'read') {
      const g = s.group;
      const n = s.read.items.length;
      cap.append(el('span', 'imp-shot-day', shortLabel(g)), el('span', 'imp-shot-n', `${n} set${n === 1 ? '' : 's'}`));
      face.setAttribute('aria-label', `${s.file.name || 'Image'}: ${g ? g.label : 'read'}, ${n} set${n === 1 ? '' : 's'}`);
    } else if (s.state === 'empty') {
      cap.appendChild(el('span', 'imp-shot-n', 'No sets found'));
      face.setAttribute('aria-label', `${s.file.name || 'Image'}: no sets found`);
    } else {
      // Offline is a state, not a fault (gray, like the sync dot); the rest need you.
      cap.appendChild(el('span', s.error === 'offline' || s.error === 'stay' ? 'imp-shot-n' : 'imp-shot-n err', ERRORS[s.error] || ERRORS.failed));
      face.setAttribute('aria-label', `${s.file.name || 'Image'}: ${ERRORS[s.error] || ERRORS.failed}${s.error === 'decode' || s.error === 'big' || s.error === 'stay' || s.error === 'crew' ? '' : ' — tap to retry'}`);
    }
  }

  function pump() {
    while (!closed && running < PARALLEL && queue.length) {
      const s = queue.shift();
      running++;
      Promise.resolve()
        .then(() => readOne(s.file))
        .catch((e) => { record('import:read', e); return { error: 'failed' }; })
        .then((out) => {
          running--;
          if (closed) return;
          landed(s, out || { error: 'failed' });
          pump();
        });
    }
  }

  function landed(s, out) {
    // The router took the sheet down (✕, Back, the backdrop) while this image
    // was being read: the answer is dropped, and so are the image previews.
    if (!sheet.isConnected) { closed = true; cleanup(); return; }
    if (out.error) {
      s.state = 'error';
      s.error = out.error;
    } else if (!out.read.items.length) {
      s.state = 'empty';
      s.read = out.read;
    } else {
      s.state = 'read';
      s.read = out.read;
      s.group = fold(out.read);
    }
    paintShot(s);
    const empties = shots.filter((x) => x.state === 'empty').length;
    shotsNote.textContent = empties
      ? `${empties === 1 ? 'One image' : `${empties} images`} had no sets on ${empties === 1 ? 'it' : 'them'} — is ${empties === 1 ? 'it' : 'each'} the ${fest.name} app’s schedule export?`
      : '';
    if (s.state === 'read') paintGroup(s.group, true);
    paintFoot();
  }

  // A read joins the group for its day: two images of one day are one day.
  function fold(read) {
    const m = matchRead(index, read);
    const key = m.day || (m.label ? `printed:${m.label.toLowerCase()}` : `image:${shots.length}`);
    let g = groups.get(key);
    if (!g) {
      const order = m.day ? festDays.indexOf(m.day) : festDays.length + groups.size;
      g = { key, day: m.day, label: m.day || m.label || 'This image', printed: m.label, order, matched: new Map(), unknown: [], festivals: new Set(), node: null };
      groups.set(key, g);
    }
    if (read.festival) g.festivals.add(read.festival);
    for (const hit of m.matched) {
      if (g.matched.has(hit.name)) continue;
      const cur = mine.get(hit.name) || 0;
      g.matched.set(hit.name, { ...hit, already: cur > 0, current: cur });
      if (cur === 0 && !levels.has(hit.name)) levels.set(hit.name, hit.cancelled ? 0 : startLevel(0));
    }
    for (const u of m.unknown) if (!g.unknown.includes(u)) g.unknown.push(u);
    return g;
  }

  const shortLabel = (g) => {
    if (!g) return '';
    const meta = g.day && fest.dayMeta ? fest.dayMeta[g.day] : null;
    return (meta && meta.wd ? meta.wd : String(g.label).split(/\s+/)[0]).toUpperCase();
  };

  // The ctx the review's cards render from: the wall's own, with your level
  // on every imported set replaced by the level it will land at. No zoom, no
  // notes door, no people filter — a card here does one thing.
  function reviewCtx() {
    const picks = { ...ctx.picks };
    for (const [name, level] of levels) picks[name] = { ...(ctx.picks[name] || {}), [me]: level };
    return { ...ctx, picks, filterPeople: [], onPeek: null, wireZoom: null, onOpenNotes: null, onTap: cycle };
  }

  function cycle(name) {
    if (closed || !levels.has(name)) return;
    levels.set(name, model.nextTapLevel(levels.get(name)));
    const rc = reviewCtx();
    for (const card of days.querySelectorAll(`.card[data-artist="${CSS.escape(name)}"]`)) refreshCard(card, name, rc);
    paintFoot();
  }

  // Where a set is on OUR lineup, the way a card on the wall says it: the
  // stage and the start ("Warehouse · 2:45 PM"), with the day in front when
  // it is not the day this group is.
  function timeLine(hit, g) {
    const occ = hit.occ || {};
    const start = occ.time ? String(occ.time).split(' - ')[0].trim() : '';
    const dayBit = occ.day && occ.day !== g.day
      ? ((fest.dayMeta && fest.dayMeta[occ.day] && fest.dayMeta[occ.day].wd) || occ.day).toUpperCase()
      : null;
    return [dayBit, occ.stage, start].filter(Boolean).join(' · ');
  }

  function groupNode(g) {
    const node = el('section', 'imp-day');
    node.dataset.key = g.key;
    const head = el('div', 'imp-day-head');
    const title = el('h3', 'imp-day-title', g.day ? g.day.toUpperCase() : String(g.label).toUpperCase());
    const meta = g.day && fest.dayMeta ? fest.dayMeta[g.day] : null;
    const sub = el('span', 'imp-day-sub', meta && meta.date ? meta.date : (g.day ? '' : 'as printed'));
    head.append(title, sub);
    node.appendChild(head);
    const rc = reviewCtx();
    const fresh = [...g.matched.values()].filter((h) => !h.already);
    if (fresh.length) {
      const grid = el('div', 'imp-grid');
      for (const hit of fresh) {
        const occ = hit.occ && hit.occ.grid ? { day: hit.occ.day, stage: hit.occ.stage, time: hit.occ.time } : null;
        const card = renderCard(hit.name, rc, { time: timeLine(hit, g), occ });
        grid.appendChild(card);
      }
      node.appendChild(grid);
    }
    // The lines under a day: a festival that is not this one, a set on
    // another day here, what you already have, and what the lineup lacks.
    const notes = el('div', 'imp-notes');
    const other = [...g.festivals].find((f) => !sameFest(f, fest.name));
    if (other) notes.appendChild(el('p', 'imp-note', `This image says ${other} — these are matched to ${fest.name}.`));
    for (const hit of fresh) {
      if (!hit.offDay) continue;
      notes.appendChild(el('p', 'imp-note', `${hit.name} is on ${hit.where.join(' & ')} here${g.day ? `, not ${g.day}` : ''}.`));
    }
    const kept = [...g.matched.values()].filter((h) => h.already);
    if (kept.length) {
      const line = el('p', 'imp-note imp-kept');
      line.appendChild(el('span', 'imp-kept-label', 'Already yours'));
      const ci = colorIndexOf(me, state.people()[me]);
      for (const h of kept) {
        const item = el('span', 'imp-kept-item');
        item.appendChild(el('span', '', h.name));
        const chip = meterOf({ level: h.current, colorIndex: ci });
        if (chip) item.appendChild(meterChip(chip));
        line.appendChild(item);
      }
      notes.appendChild(line);
    }
    if (g.unknown.length) notes.appendChild(el('p', 'imp-note', `Not on ${fest.name}’s lineup here: ${g.unknown.join(', ')}.`));
    if (!fresh.length && !kept.length && !g.unknown.length) notes.appendChild(el('p', 'imp-note', 'Nothing to add from this day.'));
    if (notes.childNodes.length) node.appendChild(notes);
    return node;
  }

  function paintGroup(g, arriving) {
    // Where every day already on the sheet stands before the new one lands,
    // so the ones it pushes down travel there instead of jumping (FLIP).
    const before = new Map([...days.children].map((n) => [n, n.getBoundingClientRect().top]));
    const node = groupNode(g);
    const old = g.node;
    g.node = node;
    if (old && old.parentNode) old.replaceWith(node);
    else {
      const after = [...groups.values()].filter((x) => x.node && x.node.parentNode === days && x.order > g.order)
        .sort((a, b) => a.order - b.order)[0];
      days.insertBefore(node, after ? after.node : null);
    }
    if (!arriving || !canAnimate(node, ctx)) return;
    for (const [n, top] of before) {
      if (n === old || !n.isConnected) continue;
      const dy = top - n.getBoundingClientRect().top;
      if (Math.abs(dy) > 0.5) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: GROW_MS, easing: EASE_ARRIVE });
    }
    // The day arrives with a little life: its head, then its cards one beat
    // apart, rising into place.
    const pieces = [node.querySelector('.imp-day-head'), ...node.querySelectorAll('.imp-grid > .card'), ...node.querySelectorAll('.imp-note')];
    pieces.forEach((p, i) => {
      if (!p) return;
      p.animate([{ transform: 'translateY(8px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: CASCADE_MS, delay: i * STAGGER_MS, easing: EASE_ARRIVE, fill: 'backwards' });
    });
  }

  function entries() {
    const out = [];
    for (const g of groups.values()) for (const h of g.matched.values()) out.push({ name: h.name, already: h.already, level: h.already ? 0 : levels.get(h.name) });
    return out;
  }

  function paintFoot() {
    const reading = shots.some((s) => s.state === 'reading');
    const n = picksToWrite(entries()).length;
    const any = shots.some((s) => s.state === 'read');
    if (reading) {
      sheet.dataset.import = 'reading';
      go.disabled = true;
      go.textContent = n ? `Add ${n} pick${n === 1 ? '' : 's'}` : 'Reading…';
      status.textContent = '';
    } else if (any) {
      sheet.dataset.import = 'review';
      go.disabled = n === 0;
      go.textContent = n ? `Add ${n} pick${n === 1 ? '' : 's'}` : 'Nothing new to add';
    } else {
      sheet.dataset.import = shots.length ? 'stuck' : 'choose';
      go.disabled = true;
      go.textContent = shots.length ? 'Nothing to add yet' : 'Add picks';
    }
    foot.hidden = !shots.length;
  }

  go.addEventListener('click', () => {
    if (closed || go.disabled) return;
    // Re-read what you have NOW: a pick made on another phone since the sheet
    // opened is yours, and the import never lowers it.
    const now = mineNow();
    const writes = picksToWrite(entries()).filter((w) => !(now.get(w.name) > 0));
    let n = 0;
    for (const w of writes) {
      if (opts.record(w.name, w.level) === false) {
        status.textContent = n
          ? `Added ${n}, then this crew started updating — try the rest again in a moment.`
          : 'This crew is still updating — nothing was added. Try again in a moment.';
        if (n) opts.done(n, { stay: true });
        return;
      }
      n++;
    }
    closed = true;
    cleanup();
    opts.done(n);
  });

  function cleanup() {
    for (const s of shots) if (s.url) { try { URL.revokeObjectURL(s.url); } catch { /* already gone */ } }
    queue = [];
  }

  paintFoot();
  return {
    // The router closed the sheet (✕, Back, the backdrop): reads still in
    // flight are dropped when they land.
    closed: () => { closed = true; cleanup(); },
    take,
  };
}

function sameFest(printed, name) {
  const a = String(printed || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const b = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return !a || !b || a.includes(b) || b.includes(a);
}
