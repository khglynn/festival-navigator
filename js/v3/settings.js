// Settings (atlas 21h) — ONE page, two doors (header gear + dock fest link).
// Order: YOUR FESTIVALS -> YOU -> APP. Desktop is the same 560px column.
// How-it-works (21i) renders as a sub-view. All doc strings via textContent.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as spotify from '../spotify.js';
import * as sync from '../sync.js';
import * as model from './model.js';
import { FESTIVAL_INDEX } from '../festivals.js';
import { BOARD, hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';
import { openExportLikes, openBulkPaste, openDayImage } from './tools.js';
import { router } from './router.js';
import { nameProblem, NAME_LIMITS } from '../name-rules.mjs';

const LS_SETTINGS = 'fn_settings_v1'; // {lowPower, stayOffline}

export function appSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
  catch { return {}; }
}
export function saveAppSettings(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }

const el = (tag, css, text) => {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (text !== undefined) n.textContent = text;
  return n;
};

function microLabel(text) {
  const n = el('div', 'margin-top: 8px;', text);
  n.className = 'micro-label';
  return n;
}

function toggleRow(title, sub, checked, onFlip) {
  const row = el('div');
  row.className = 'list-row';
  const left = el('div', 'flex: 1;');
  const t = el('div', '', title); t.className = 'row-title';
  left.appendChild(t);
  if (sub) { const s = el('div', '', sub); s.className = 'row-sub'; left.appendChild(s); }
  const toggle = document.createElement('button');
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(!!checked));
  toggle.setAttribute('aria-label', title);
  toggle.appendChild(el('span')).className = '';
  toggle.firstChild.className = 'toggle-knob';
  toggle.addEventListener('click', () => {
    const now = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(now));
    onFlip(now);
  });
  row.append(left, toggle);
  return row;
}

function linkRow(title, onOpen) {
  // A real button (AX-7): keyboard-reachable, announced as interactive.
  const row = el('button');
  row.className = 'list-row';
  row.style.cssText = 'cursor: pointer; width: 100%; background: none; border: none; border-bottom: 1px solid var(--hairline); font: inherit; text-align: left; color: inherit;';
  const t = el('span', 'flex: 1;', title); t.className = 'row-title';
  const chev = el('span', '', '›'); chev.className = 'chev';
  row.append(t, chev);
  row.addEventListener('click', onOpen);
  return row;
}

// ---- YOUR FESTIVALS ---------------------------------------------------------------
function currentFestCard(ctx, actions) {
  const fest = state.fest();
  const card = el('div');
  card.className = 'settings-card current';
  const head = el('div', 'display: flex; align-items: baseline; gap: 8px;');
  const nm = el('span', `font-family: var(--font-display); letter-spacing: .04em; font-size: 19px; color: rgb(var(--fest)); white-space: nowrap;`, fest.name.toUpperCase());
  const yr = el('span', 'font-size: .62em; opacity: .75;', ' ' + (fest.year || ''));
  nm.appendChild(yr);
  const dates = el('span', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', fest.dates || '');
  // The ONE sync state (PS-5): same source as the dot — a "synced" label
  // computed from hasPending alone lied whenever the network was down.
  const LABELS = { online: ['synced', 'var(--sync-ok)'], syncing: ['syncing', 'var(--sync-syncing)'], offline: ['offline', 'var(--sync-offline)'], error: ['sync error', '#F87171'] };
  const [label, color] = LABELS[sync.syncState()] || LABELS.online;
  const syncLabel = el('span', `margin-left: auto; color: ${color}; font-size: 10.5px; font-weight: 700;`, label);
  head.append(nm, dates, syncLabel);
  card.appendChild(head);

  const chips = el('div', 'display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;');
  for (const [name, p] of state.activePeople()) {
    const chip = el('span', '', name);
    chip.className = 'person-chip' + (name === ctx.meName ? ' you' : '');
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, name === ctx.meName);
    chip.style.fontSize = '11px';
    chip.style.padding = '4px 11px';
    chips.appendChild(chip);
  }
  card.appendChild(chips);

  const row = el('div', 'display: flex; gap: 8px; margin-top: 10px;');
  const share = el('button', 'flex: 1; font-size: 12px; padding: 9px;', 'Share invite');
  share.className = 'btn-tonal';
  share.addEventListener('click', async () => {
    // The invite carries the fest being shared (FLOW-1): &f= on the link for
    // this invite, meta.inviteFestId in the doc for links already out there.
    const fid = state.activeFestivalId;
    const link = crew.crewLink(state.getCrewToken(), fid);
    if ((state.crewDoc.meta || {}).inviteFestId !== fid) {
      state.recordInviteFest(fid);
      actions.afterBulk(); // schedules the sync push
    }
    const copyFallback = async () => {
      try { await navigator.clipboard.writeText(link); share.textContent = 'Link copied ✓'; setTimeout(() => { share.textContent = 'Share invite'; }, 1800); }
      catch { share.textContent = 'See the link below'; setTimeout(() => { share.textContent = 'Share invite'; }, 2500); }
    };
    try {
      if (navigator.share) await navigator.share({ title: 'Festival Navigator', url: link });
      else await copyFallback();
    } catch (e) {
      // A dismissed share sheet is a choice; anything else falls back to the
      // clipboard instead of silently doing nothing (FLOW-12).
      if (!e || e.name !== 'AbortError') await copyFallback();
    }
  });
  // Real picks only — raw selection keys include cleared level-0 tombstones
  // and would overcount (CORE-13).
  const count = el('button', 'font-size: 12px; padding: 9px 14px;',
    `${Object.keys(model.picksFor(state.crewDoc, state.activeFestivalId)).length} artists picked`);
  count.className = 'btn-ghost';
  count.addEventListener('click', actions.close);
  row.append(share, count);
  card.appendChild(row);
  return card;
}

function festivalsSection(ctx, actions) {
  const wrap = el('div', 'display: flex; flex-direction: column; gap: 8px;');
  wrap.appendChild(microLabel('Your festivals'));
  wrap.appendChild(currentFestCard(ctx, actions));

  const active = FESTIVAL_INDEX.filter((f) => f.status !== 'archived' && f.id !== state.activeFestivalId);
  const archived = FESTIVAL_INDEX.filter((f) => f.status === 'archived' && f.id !== state.activeFestivalId);
  const festRow = (f) => {
    const row = el('button', 'width: 100%;');
    row.className = 'fest-row';
    const left = el('div', 'flex: 1; min-width: 0; text-align: left;');
    const nm = el('span', `font-family: var(--font-display); letter-spacing: .04em; font-size: 15px; color: rgb(${f.accent || '237, 234, 244'}); white-space: nowrap;`, f.name.toUpperCase());
    nm.appendChild(el('span', 'font-size: .65em; opacity: .75;', ' ' + (f.year || '')));
    left.appendChild(nm);
    const picks = Object.keys(model.picksFor(state.crewDoc, f.id)).length;
    const sub = el('div', '', [f.dates, picks ? `${picks} artists picked` : ''].filter(Boolean).join(' · '));
    sub.className = 'fest-dates';
    left.appendChild(sub);
    const chev = el('span', '', '›'); chev.className = 'chev';
    row.append(left, chev);
    row.addEventListener('click', () => actions.switchFestival(f.id));
    return row;
  };
  for (const f of active) wrap.appendChild(festRow(f));

  const add = el('button', '', '+ Add a festival');
  add.className = 'dashed-row';
  add.addEventListener('click', () => { openSubviewByKey('sub:add-fest', ctx, actions); router.push('sub:add-fest'); });
  wrap.appendChild(add);

  if (archived.length) {
    const arch = el('div', 'padding: 2px 4px; color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; display: flex; align-items: center; cursor: pointer;');
    const lbl = el('span', '', `Archived · ${archived.length}`);
    const caret = el('span', 'margin-left: auto;', '▸');
    arch.append(lbl, caret);
    const list = el('div', 'display: none; flex-direction: column; gap: 8px;');
    for (const f of archived) list.appendChild(festRow(f));
    arch.addEventListener('click', () => {
      const open = list.style.display === 'none';
      list.style.display = open ? 'flex' : 'none';
      caret.textContent = open ? '▾' : '▸';
    });
    wrap.append(arch, list);
  }
  return wrap;
}

// Subview back buttons pop the history layer (FLOW-2); the direct restore
// stays as the desync-proof fallback.
function subviewBack(actions) {
  return () => {
    if (router.requestClose()) return;
    const host = document.getElementById('settings-subview');
    if (host) host.textContent = '';
    actions.rerender();
  };
}

// ---- add a festival (LLM research -> preview -> confirm; api/festival-add) --------
function openAddFestival(actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', subviewBack(actions));
  const title = el('div', '', 'ADD A FESTIVAL'); title.className = 'screen-title';
  head.append(back, title);
  col.appendChild(head);

  const row = el('div', 'display: flex; gap: 8px;');
  const input = el('input');
  input.placeholder = 'Festival name (e.g. Bonnaroo 2026)';
  input.maxLength = 80;
  input.setAttribute('aria-label', 'Festival name');
  input.style.cssText = 'flex: 1; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: #fff; font-size: 13px; font-family: var(--font-ui);';
  const go = el('button', 'font-size: 12px; padding: 9px 15px; flex: none;', 'Research');
  go.className = 'btn-tonal';
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
  row.append(input, go);
  col.appendChild(row);
  const status = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;',
    'The lineup is researched live from the web, then you approve before anything is saved.');
  col.appendChild(status);
  const preview = el('div', 'display: flex; flex-direction: column; gap: 8px;');
  col.appendChild(preview);

  go.addEventListener('click', async () => {
    const name = input.value.trim();
    if (name.length < 2) return;
    go.disabled = true;
    status.textContent = 'Researching — this takes ~20 seconds…';
    preview.textContent = '';
    try {
      const res = await fetch(`/api/festival-add?t=${encodeURIComponent(state.getCrewToken())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) { status.textContent = body.error || 'Research failed.'; return; }
      const c = body.candidate;
      status.textContent = '';
      const card = el('div'); card.className = 'settings-card';
      const nm = el('div', `font-family: var(--font-display); letter-spacing: .04em; font-size: 18px; color: var(--text-header);`, `${c.name || ''} ${c.year || ''}`.trim());
      card.appendChild(nm);
      card.appendChild(el('div', 'color: var(--text-secondary); font-size: 12px; font-weight: 600; margin-top: 4px;',
        [c.subtitle, c.location, c.dates].filter(Boolean).join(' · ')));
      card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; margin-top: 6px;',
        `${(c.artists || []).length} artists found`));
      // "Looks right" needs the WHOLE lineup reviewable, not a 12-name teaser
      // (CT-2) — wrongness has to be visible before the save.
      const sample = (c.artists || []).slice(0, 12).map((a) => a.name).join(' · ');
      card.appendChild(el('div', 'color: var(--text-body); font-size: 11.5px; margin-top: 6px; line-height: 1.5;', sample + ((c.artists || []).length > 12 ? ' …' : '')));
      if ((c.artists || []).length > 12) {
        const fold = document.createElement('details');
        const sum = document.createElement('summary');
        sum.textContent = `Review all ${c.artists.length} artists`;
        sum.style.cssText = 'color: var(--text-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer; margin-top: 6px;';
        fold.appendChild(sum);
        fold.appendChild(el('div', 'color: var(--text-body); font-size: 11.5px; line-height: 1.6; margin-top: 5px;',
          c.artists.map((a) => a.name).join(' · ')));
        card.appendChild(fold);
      }
      // Sources by hostname when present; silence when not — "0 sources" as a
      // trust marker was worse than nothing (CT-2).
      const hosts = [...new Set((body.sources || []).map((s) => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch { return null; } }).filter(Boolean))];
      if (hosts.length) {
        card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; margin-top: 6px;',
          `Sourced from ${hosts.slice(0, 4).join(', ')}${hosts.length > 4 ? '…' : ''}`));
      }
      const confirmRow = el('div', 'display: flex; gap: 8px; margin-top: 10px;');
      const save = el('button', 'flex: 1; font-size: 12px; padding: 9px;', 'Looks right — save it');
      save.className = 'btn-tonal';
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          // A custom must never collide with (and shadow) a built-in catalog
          // fest — same researched id gets a crew-private suffix (CORE-9).
          if (FESTIVAL_INDEX.some((f) => f.id === c.id && !f.custom)) c.id = `${c.id}-crew`.slice(0, 64);
          const r2 = await fetch(`/api/festival-add?t=${encodeURIComponent(state.getCrewToken())}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true, festival: c, sources: body.sources, person: crew.me(state.getCrewToken()) }),
          });
          const b2 = await r2.json();
          if (!r2.ok) { status.textContent = b2.error || 'Save failed.'; save.disabled = false; return; }
          // Pull the crew's customs into the live catalog right now — the fest
          // appears under Your Festivals immediately (Codex P3 trail, P0).
          const { loadCustomFestivals } = await import('../festivals.js');
          await loadCustomFestivals(state.getCrewToken());
          status.textContent = 'Saved — find it under Your festivals.';
        } catch {
          // No try/finally used to exist here — one network error wedged the
          // button disabled forever (CORE-11).
          status.textContent = 'Save failed — check your connection and try again.';
          save.disabled = false;
        }
      });
      const discard = el('button', 'font-size: 12px; padding: 9px 14px;', 'Discard');
      discard.className = 'btn-ghost';
      discard.addEventListener('click', () => {
        preview.textContent = '';
        status.textContent = 'Discarded — search again with a more specific name if that was the wrong one.';
        input.focus();
      });
      confirmRow.append(save, discard);
      card.appendChild(confirmRow);
      preview.appendChild(card);
    } catch {
      // Honest recovery paths only — no promising a manual entry that
      // doesn't exist (CT-2).
      status.textContent = 'Research failed — check your connection, or try a more specific name like “Bonnaroo 2026”.';
    } finally { go.disabled = false; }
  });
  host.appendChild(col);
  input.focus();
}

// ---- HOW IT WORKS (21i) -------------------------------------------------------------
function openHowItWorks(actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', subviewBack(actions));
  const title = el('div', '', 'HOW IT WORKS'); title.className = 'screen-title';
  head.append(back, title);
  col.appendChild(head);

  const card = el('div'); card.className = 'settings-card';
  card.style.cssText += 'display: flex; flex-direction: column; gap: 12px;';
  const lesson = (demoBuilder, strong, rest) => {
    const row = el('div', 'display: flex; align-items: center; gap: 12px;');
    const demo = el('div', 'width: 104px; flex: none; display: flex; align-items: center; justify-content: center; gap: 3px;');
    demoBuilder(demo);
    const text = el('span', 'color: var(--text-secondary); font-size: 11.5px; font-weight: 600; line-height: 1.45; flex: 1;');
    const s = el('strong', 'color: #fff;', strong);
    text.append(s, ' ' + rest);
    row.append(demo, text);
    return row;
  };
  card.appendChild(lesson((d) => {
    [0.5, 0.75, 1].forEach((a) => {
      d.appendChild(el('span', `flex: 1; height: 30px; border-radius: 6px; border: 1px solid var(--hairline); background: radial-gradient(130% 130% at 20% 120%, hsla(10,90%,62%,${a}) 0%, transparent 78%), #1C1731;`));
    });
  }, 'Tap an artist 1–3×', '— picked, in your color, brighter each tap.'));
  card.appendChild(lesson((d) => {
    d.appendChild(el('span', 'width: 4px; height: 12px; border-radius: 99px; background: hsla(150,70%,50%,.5); border: 1px solid hsl(150,70%,82%);'));
    d.appendChild(el('span', 'width: 24px; height: 12px; border-radius: 99px; background: hsla(10,90%,62%,.5); border: 1px solid #fff; color: #fff; font-size: 7.5px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center;', 'K'));
  }, '4th tap = must.', 'Your pill gets your letter; ticks are picks. White stroke = you.'));
  card.appendChild(lesson((d) => {
    const n = el('span', '', '2'); n.className = 'chip-notes'; n.style.height = '14px';
    const s = el('span', '', '23'); s.className = 'chip-spotify'; s.style.height = '13px';
    d.append(n, s);
  }, 'Bottom-left corner:', 'violet bubble = crew notes (long-press to read or add) · green = your Spotify.'));
  card.appendChild(lesson((d) => {
    const p = el('span', '', 'PINNED'); p.className = 'chip-notes';
    p.style.cssText += 'height: auto; padding: 3px 8px; letter-spacing: .06em; font-size: 8px;';
    d.appendChild(p);
  }, 'Pin a note', 'to keep it on top of its day. Pins are yours — everyone has their own.'));
  card.appendChild(lesson((d) => {
    d.appendChild(el('span', 'font-family: var(--font-display); letter-spacing: .04em; font-size: 11px; color: rgb(var(--fest));', 'PORTOLA ’26'));
    const dot = el('span'); dot.className = 'sync-dot';
    d.appendChild(dot);
  }, 'The dock:', 'your chip jumps to the top, days follow your scroll, the fest name opens Settings. Green dot = synced.'));
  col.appendChild(card);
  host.appendChild(col);
}

// ---- CREW door (spec F11 / FLOW-6): members, rename, link, switch, danger ----------
function crewSection(ctx, actions) {
  const wrap = el('div', 'display: flex; flex-direction: column; gap: 8px;');
  wrap.appendChild(microLabel('Crew'));
  const card = el('div'); card.className = 'settings-card';
  card.style.cssText += 'display: flex; flex-direction: column; gap: 11px;';

  const status = el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600;');
  const nameRow = el('div', 'display: flex; align-items: center; gap: 9px;');
  const nm = el('span', 'color: #fff; font-weight: 800; font-size: 15px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;', state.crewName());
  const renameBtn = el('button', 'font-size: 11.5px; padding: 6px 12px; flex: none;', 'Rename');
  renameBtn.className = 'btn-ghost';
  nameRow.append(nm, renameBtn);
  card.appendChild(nameRow);
  const renameHost = el('div');
  card.appendChild(renameHost);
  renameBtn.addEventListener('click', () => {
    renameHost.textContent = '';
    const row = el('div', 'display: flex; gap: 8px;');
    const input = el('input');
    input.value = state.crewName();
    input.maxLength = NAME_LIMITS.crewName;
    input.setAttribute('aria-label', 'Crew name');
    input.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 9px 11px; color: #fff; font-size: 13px; font-family: var(--font-ui);';
    const save = el('button', 'font-size: 12px; padding: 8px 14px; flex: none;', 'Save');
    save.className = 'btn-tonal';
    const doSave = () => {
      const v = input.value.trim();
      const problem = nameProblem(v, NAME_LIMITS.crewName);
      if (problem) { status.textContent = problem; return; }
      state.recordCrewName(v);
      actions.afterBulk();
      actions.rerender();
    };
    save.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    row.append(input, save);
    renameHost.appendChild(row);
    input.focus();
  });

  const chips = el('div', 'display: flex; gap: 5px; flex-wrap: wrap;');
  for (const [name, p] of state.activePeople()) {
    const chip = el('span', '', name);
    chip.className = 'person-chip' + (name === ctx.meName ? ' you' : '');
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, name === ctx.meName);
    chip.style.fontSize = '11px';
    chip.style.padding = '4px 11px';
    chips.appendChild(chip);
  }
  card.appendChild(chips);

  // The invite link, always visible (FLOW-12): share sheets fail silently,
  // a printed URL never does.
  const link = crew.crewLink(state.getCrewToken(), state.activeFestivalId);
  const linkRowEl = el('div', 'display: flex; gap: 8px; align-items: center;');
  const linkBox = el('input');
  linkBox.readOnly = true;
  linkBox.value = link;
  linkBox.setAttribute('aria-label', 'Crew invite link');
  linkBox.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 8px 11px; color: var(--text-secondary); font-size: 11.5px; font-family: var(--font-ui);';
  linkBox.addEventListener('focus', () => linkBox.select());
  const copyBtn = el('button', 'font-size: 11.5px; padding: 8px 13px; flex: none;', 'Copy');
  copyBtn.className = 'btn-tonal';
  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); copyBtn.textContent = 'Copied ✓'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1800); }
    catch { linkBox.select(); }
  });
  linkRowEl.append(linkBox, copyBtn);
  card.appendChild(linkRowEl);
  card.appendChild(status);
  wrap.appendChild(card);

  const listEl = el('div'); listEl.className = 'settings-list';
  listEl.appendChild(linkRow('Switch crew', actions.switchCrew));
  // Danger zone: two-tap confirm — device-local, the link gets you back in.
  const dangerRow = el('button');
  dangerRow.className = 'list-row';
  dangerRow.style.cssText = 'cursor: pointer; width: 100%; background: none; border: none; font: inherit; text-align: left; color: inherit;';
  const dLeft = el('div', 'flex: 1;');
  const dTitle = el('div', '', 'Forget this crew on this device');
  dTitle.className = 'row-title';
  dTitle.style.color = '#F87171';
  const dSub = el('div', '', 'Picks and notes stay in the crew — the invite link gets you back in.');
  dSub.className = 'row-sub';
  dLeft.append(dTitle, dSub);
  dangerRow.appendChild(dLeft);
  let armed = false;
  dangerRow.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      dTitle.textContent = 'Tap again to forget this crew';
      setTimeout(() => { armed = false; dTitle.textContent = 'Forget this crew on this device'; }, 4000);
      return;
    }
    actions.leaveCrew();
  });
  listEl.appendChild(dangerRow);
  wrap.appendChild(listEl);
  return wrap;
}

// ---- YOU door (spec F11 / FLOW-8): identity, rename, color -------------------------
function youSection(ctx, actions) {
  const wrap = el('div', 'display: flex; flex-direction: column; gap: 8px;');
  wrap.appendChild(microLabel('You'));
  const card = el('div');
  card.className = 'settings-card';
  card.style.cssText += 'display: flex; flex-direction: column; gap: 11px;';
  if (!ctx.meName) {
    card.appendChild(el('span', 'color: var(--text-tertiary); font-size: 12px; font-weight: 600;', 'Open your crew link to claim a name.'));
    wrap.appendChild(card);
    return wrap;
  }
  const p = state.people()[ctx.meName];
  const status = el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600;');
  const row = el('div', 'display: flex; align-items: center; gap: 11px;');
  const av = el('span', '', ctx.meName.charAt(0).toUpperCase());
  av.className = 'avatar';
  av.style.cssText += 'width: 26px; height: 26px; font-size: 10px; border: 1.5px solid #fff;';
  av.style.background = hslOf(colorIndexOf(ctx.meName, p), 0.5);
  const nm = el('span', 'color: #fff; font-weight: 700; font-size: 14px; flex: 1;', ctx.meName);
  row.append(av, nm);
  card.appendChild(row);
  const expandHost = el('div');

  const btnRow = el('div', 'display: flex; gap: 6px; flex-wrap: wrap;');
  const mk = (label) => {
    const b = el('button', 'font-size: 11.5px; padding: 6px 12px;', label);
    b.className = 'btn-ghost';
    return b;
  };
  const switchBtn = mk('Not you? Switch');
  const renameBtn = mk('Rename me');
  const colorBtn = mk('Change color');
  btnRow.append(switchBtn, renameBtn, colorBtn);
  card.append(btnRow, expandHost, status);

  // Identity change is explicit and confirmable (FLOW-8) — never a stray tap.
  switchBtn.addEventListener('click', () => {
    expandHost.textContent = '';
    const list = el('div', 'display: flex; flex-direction: column; gap: 6px;');
    for (const [name, person] of state.activePeople()) {
      if (name === ctx.meName) continue;
      const b = el('button', 'width: 100%;');
      b.className = 'fest-row';
      const bAv = el('span', '', name.charAt(0).toUpperCase());
      bAv.className = 'avatar';
      bAv.style.background = hslOf(colorIndexOf(name, person), 0.5);
      const bNm = el('span', 'color: #fff; font-weight: 700; font-size: 13px; flex: 1; text-align: left;', `I’m ${name}`);
      b.append(bAv, bNm);
      b.addEventListener('click', () => { actions.switchIdentity(name); actions.rerender(); });
      list.appendChild(b);
    }
    if (!list.children.length) list.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600;', 'No one else has joined yet.'));
    expandHost.appendChild(list);
  });

  renameBtn.addEventListener('click', () => {
    expandHost.textContent = '';
    const col = el('div', 'display: flex; flex-direction: column; gap: 7px;');
    const rrow = el('div', 'display: flex; gap: 8px;');
    const input = el('input');
    input.value = ctx.meName;
    input.maxLength = NAME_LIMITS.personName;
    input.setAttribute('aria-label', 'Your name');
    input.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 9px 11px; color: #fff; font-size: 13px; font-family: var(--font-ui);';
    const save = el('button', 'font-size: 12px; padding: 8px 14px; flex: none;', 'Save');
    save.className = 'btn-tonal';
    const doSave = () => {
      const v = input.value.trim();
      if (v === ctx.meName) { expandHost.textContent = ''; return; }
      const problem = nameProblem(v);
      if (problem) { status.textContent = problem; return; }
      if (state.people()[v] && !state.people()[v].removed) { status.textContent = 'That name is taken in this crew.'; return; }
      actions.renameSelf(v);
      actions.rerender();
    };
    save.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    rrow.append(input, save);
    col.appendChild(rrow);
    col.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.5;',
      'Your picks move with you. Notes you already wrote keep your old name.'));
    expandHost.appendChild(col);
    input.focus();
  });

  colorBtn.addEventListener('click', () => {
    expandHost.textContent = '';
    const grid = el('div', 'display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px;');
    const taken = new Set(state.activePeople().filter(([n]) => n !== ctx.meName).map(([, pp]) => pp.colorIndex).filter(Number.isInteger));
    const mine = colorIndexOf(ctx.meName, p);
    for (let i = 0; i < BOARD.length; i++) {
      const dot = el('button');
      dot.setAttribute('aria-label', `Color ${i + 1}${taken.has(i) ? ' (taken)' : ''}${i === mine ? ' (yours)' : ''}`);
      dot.style.cssText = `aspect-ratio: 1; border-radius: var(--r-pill); cursor: pointer; background: ${hslOf(i, 0.85)}; border: 2px solid ${i === mine ? '#fff' : 'transparent'}; opacity: ${taken.has(i) ? '.25' : '1'};`;
      dot.disabled = taken.has(i);
      dot.addEventListener('click', () => { actions.changeColor(i); actions.rerender(); });
      grid.appendChild(dot);
    }
    expandHost.appendChild(grid);
  });

  wrap.appendChild(card);
  return wrap;
}

// ---- the settings screen --------------------------------------------------------------
export function renderSettings(root, ctx, actions) {
  root.textContent = '';
  const sub = el('div'); sub.id = 'settings-subview';
  const main = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  main.id = 'settings-main';

  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.setAttribute('aria-label', 'Back to the wall');
  back.addEventListener('click', actions.close);
  const title = el('div', '', 'SETTINGS'); title.className = 'screen-title';
  head.append(back, title);
  main.appendChild(head);

  main.appendChild(festivalsSection(ctx, actions));
  main.appendChild(crewSection(ctx, actions));
  main.appendChild(youSection(ctx, actions));

  // Spotify glance (state only; the drill page holds every action — 21f rule)
  const sp = el('button'); sp.className = 'settings-card';
  sp.style.cssText += 'display: flex; flex-direction: column; gap: 9px; cursor: pointer; margin-top: 8px; width: 100%; font: inherit; text-align: left; color: inherit;';
  sp.setAttribute('aria-label', 'Spotify settings');
  const spHead = el('div', 'display: flex; align-items: baseline; gap: 8px;');
  spHead.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Spotify'));
  const lib = spotify.libraryMap();
  spHead.appendChild(el('span', `color: ${spotify.isConnected() ? 'var(--spotify-stroke)' : 'var(--text-tertiary)'}; font-size: 11px; font-weight: 700;`,
    spotify.isConnected() ? 'connected' : 'not connected'));
  spHead.appendChild(el('span', 'margin-left: auto; color: var(--text-tertiary); font-size: 10.5px; font-weight: 600;', lib ? `synced ${lib.fetchedAt?.slice(0, 10) || ''} ›` : '›'));
  sp.appendChild(spHead);
  if (lib) sp.appendChild(el('div', 'color: var(--text-secondary); font-size: 12px; font-weight: 600;', `${Object.keys(lib.artists || {}).length.toLocaleString()} artists in your library`));
  const openSub = (key) => { openSubviewByKey(key, ctx, actions); router.push(key); };
  sp.addEventListener('click', () => openSub('sub:spotify'));
  main.appendChild(sp);

  main.appendChild(microLabel('App'));
  const list = el('div'); list.className = 'settings-list';
  list.appendChild(linkRow('How it works', () => openSub('sub:how')));
  const s = appSettings();
  list.appendChild(toggleRow('Low power', 'no animation · sync every 5 min', s.lowPower, (on) => {
    saveAppSettings({ ...appSettings(), lowPower: on });
    actions.onLowPower(on);
  }));
  list.appendChild(toggleRow('Stay offline', 'stop sync attempts until I turn this off', s.stayOffline, (on) => {
    saveAppSettings({ ...appSettings(), stayOffline: on });
    actions.onStayOffline(on);
  }));
  list.appendChild(linkRow('Bulk paste likes', () => openSub('sub:bulk')));
  list.appendChild(linkRow('Export likes', () => openSub('sub:export')));
  list.appendChild(linkRow('Day image', () => openSub('sub:day-image')));
  main.appendChild(list);

  root.append(sub, main);
}

// Open a settings drill by its router key — the one entry point both the
// in-UI rows and the router's forward/refresh re-open path share (FLOW-2).
export function openSubviewByKey(key, ctx, actions) {
  const root = document.getElementById('settings-root');
  const rerender = () => renderSettings(root, ctx, actions);
  const main = document.getElementById('settings-main');
  if (main) main.style.display = 'none';
  const host = document.getElementById('settings-subview');
  const sub = { ...actions, rerender };
  const back = subviewBack(sub);
  if (key === 'sub:how') openHowItWorks(sub);
  else if (key === 'sub:add-fest') openAddFestival(sub);
  else if (key === 'sub:spotify') openSpotifyDrill(ctx, sub);
  else if (key === 'sub:bulk') openBulkPaste(host, { back, recordPick: actions.recordPick, afterApply: actions.afterBulk });
  else if (key === 'sub:export') openExportLikes(host, ctx, back);
  else if (key === 'sub:day-image') openDayImage(host, ctx, back);
}

// ---- Spotify drill (21f / SPOT-2) — one state-driven card, five states -------------
// Every state explains itself in one sentence and offers exactly one action.

// The crew's Spotify config, visible and correctable (SPOT-3): a wrong Client
// ID used to be uncorrectable — the input only rendered while the id was empty.
function clientIdConfigRow(actions, rerenderDrill) {
  const wrap = el('div', 'display: flex; flex-direction: column; gap: 7px; border-top: 1px solid var(--hairline); padding-top: 10px; margin-top: 2px;');
  const row = el('div', 'display: flex; align-items: center; gap: 8px;');
  row.appendChild(el('span', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 700; letter-spacing: .06em; flex: 1;',
    `CREW APP · …${state.spotifyClientId().slice(-6)}`));
  const change = el('button', 'font-size: 11px; padding: 5px 11px;', 'Change');
  change.className = 'btn-ghost';
  const clear = el('button', 'font-size: 11px; padding: 5px 11px;', 'Clear');
  clear.className = 'btn-ghost';
  row.append(change, clear);
  wrap.appendChild(row);
  const host = el('div');
  wrap.appendChild(host);
  change.addEventListener('click', () => {
    host.textContent = '';
    host.appendChild(clientIdInputRow(actions, rerenderDrill));
  });
  let armed = false;
  clear.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      clear.textContent = 'Sure?';
      setTimeout(() => { armed = false; clear.textContent = 'Clear'; }, 3000);
      return;
    }
    state.recordSpotifyClientId(''); // '' is the documented clear value
    actions.afterBulk();
    rerenderDrill();
  });
  return wrap;
}

function clientIdInputRow(actions, rerenderDrill, msg) {
  const row = el('div', 'display: flex; gap: 8px;');
  const input = el('input');
  input.placeholder = 'Spotify app Client ID';
  input.setAttribute('aria-label', 'Spotify app Client ID');
  input.maxLength = 32;
  input.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: #fff; font-size: 12.5px; font-family: var(--font-ui);';
  const save = el('button', 'font-size: 12px; padding: 9px 14px; flex: none;', 'Save');
  save.className = 'btn-tonal';
  const doSave = () => {
    const v = input.value.trim();
    if (!/^[0-9a-fA-F]{32}$/.test(v)) {
      if (msg) msg.textContent = 'A Client ID is 32 hex characters — copy it from the app page on the Spotify dashboard.';
      return;
    }
    state.recordSpotifyClientId(v);
    actions.afterBulk();
    rerenderDrill(); // the Connect state appears NOW (CORE-14)
  };
  save.addEventListener('click', doSave);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
  row.append(input, save);
  return row;
}

function openSpotifyDrill(ctx, actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const rerenderDrill = () => openSpotifyDrill(ctx, actions);
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', subviewBack(actions));
  head.append(back, el('div', '', 'SPOTIFY'));
  head.lastChild.className = 'screen-title';
  const status = el('span', 'margin-left: auto; color: var(--spotify-stroke); font-size: 11.5px; font-weight: 700;',
    spotify.isConnected() ? 'connected' : '');
  head.appendChild(status);
  col.appendChild(head);
  const msg = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;');

  const oauthError = spotify.lastError();
  const clientId = state.spotifyClientId();
  const members = state.activePeople();
  const leadName = members.length ? members[0][0] : null;
  const isLead = !!ctx.meName && (leadName === ctx.meName || members.length <= 1);

  if (oauthError) {
    // State 5: something failed — say what, offer the retry, IN the app.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 9px;';
    card.appendChild(el('span', 'color: #F87171; font-weight: 700; font-size: 14px;', 'That connection didn’t go through'));
    card.appendChild(el('div', 'color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.5;', `Spotify said: ${oauthError}`));
    const retry = el('button', 'font-size: 12.5px; padding: 10px 16px; align-self: flex-start;', 'Try connecting again');
    retry.className = 'btn-tonal';
    retry.addEventListener('click', () => {
      spotify.clearError();
      spotify.connect().catch((e) => { msg.textContent = String(e.message || e); });
    });
    const dismiss = el('button', 'font-size: 11.5px; padding: 8px 13px; align-self: flex-start;', 'Dismiss');
    dismiss.className = 'btn-ghost';
    dismiss.addEventListener('click', () => { spotify.clearError(); rerenderDrill(); });
    const btns = el('div', 'display: flex; gap: 8px;');
    btns.append(retry, dismiss);
    card.appendChild(btns);
    col.append(card, msg);
  } else if (!clientId && !isLead) {
    // State 1: not set up, and this member can't fix that — name who can.
    const card = el('div'); card.className = 'settings-card';
    card.appendChild(el('div', 'color: var(--text-body); font-size: 12.5px; font-weight: 600; line-height: 1.55;',
      `Spotify isn’t set up for this crew yet — ask your crew lead${leadName ? ` (probably ${leadName})` : ''} to add the crew’s Client ID here.`));
    col.append(card, msg);
  } else if (!clientId) {
    // State 2: one-time crew setup, clearly framed as the lead's single step.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 10px;';
    card.appendChild(el('div', 'color: var(--text-body); font-size: 12.5px; font-weight: 600; line-height: 1.55;',
      'One-time crew setup: paste your Spotify app’s Client ID. Every member connects through it after that.'));
    card.appendChild(clientIdInputRow(actions, rerenderDrill, msg));
    const fold = document.createElement('details');
    const sum = document.createElement('summary');
    sum.textContent = 'How to get a Client ID';
    sum.style.cssText = 'color: var(--text-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;';
    fold.appendChild(sum);
    const steps = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.6; margin-top: 6px;');
    steps.textContent = '1. developer.spotify.com/dashboard → Create app. '
      + '2. Add the redirect URI https://fest.kevinhg.com/spotify-callback. '
      + '3. Copy the Client ID from the app page and paste it above. '
      + 'Development mode allows 5 users, and the app owner needs Premium.';
    fold.appendChild(steps);
    card.appendChild(fold);
    col.append(card, msg);
  } else if (!spotify.isConnected()) {
    // State 3: ready — one primary action; prod aliases hop to the ONE
    // registered OAuth origin (SPOT-1), and the button says so.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 10px;';
    const hop = spotify.canonicalHopUrl();
    const connect = el('button', 'font-size: 13px; padding: 11px 18px; align-self: flex-start;',
      hop ? 'Continue on fest.kevinhg.com' : 'Connect my Spotify');
    connect.className = 'btn-tonal';
    connect.addEventListener('click', () => {
      if (hop) { location.assign(hop); return; }
      spotify.connect().catch((e) => { msg.textContent = String(e.message || e); });
    });
    card.appendChild(connect);
    card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;',
      hop ? 'Spotify connects from one address — your crew and picks come along.'
          : 'We read your liked songs and follows to badge artists — nothing is posted.'));
    card.appendChild(clientIdConfigRow(actions, rerenderDrill));
    col.append(card, msg);
  } else {
    const lib = spotify.libraryMap();
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 9px;';
    card.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Your library'));
    card.appendChild(el('div', 'color: var(--text-secondary); font-size: 12px; font-weight: 600;',
      lib ? `${Object.keys(lib.artists || {}).length.toLocaleString()} artists · synced ${lib.fetchedAt?.slice(0, 10) || ''}` : 'not scanned yet'));
    const refresh = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', 'Refresh my likes');
    refresh.className = 'btn-tonal';
    refresh.addEventListener('click', async () => {
      if (!ctx.meName) { msg.textContent = 'Claim your name first (open your crew link).'; return; }
      try {
        refresh.disabled = true;
        await spotify.scanLibrary((p) => { msg.textContent = p; });
        const names = new Set((state.fest().artists || []).map((a) => a.name));
        for (const d of Object.keys(state.fest().days || {})) {
          for (const a of state.fest().days[d].artists || []) names.add(a.name);
        }
        const n = spotify.applyAffinityToCrew(ctx.meName, [...names]);
        msg.textContent = `Badged ${n} artists on this fest. Open other fests to badge them too.`;
        actions.afterBulk();
      } catch (e) { msg.textContent = String(e.message || e); }
      finally { refresh.disabled = false; }
    });
    card.appendChild(refresh);
    col.appendChild(card);

    const pl = el('div'); pl.className = 'settings-card';
    pl.style.cssText += 'display: flex; flex-direction: column; gap: 10px;';
    pl.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Playlist from our picks'));
    const segRow = el('div', 'display: flex; gap: 6px;');
    const segAll = el('button', '', 'Everyone'); segAll.className = 'seg active';
    const segMine = el('button', '', 'Just mine'); segMine.className = 'seg';
    let mineOnly = false;
    segAll.addEventListener('click', () => { mineOnly = false; segAll.classList.add('active'); segMine.classList.remove('active'); });
    segMine.addEventListener('click', () => { mineOnly = true; segMine.classList.add('active'); segAll.classList.remove('active'); });
    segRow.append(segAll, segMine);
    pl.appendChild(segRow);
    pl.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600;', 'One track per picked artist, musts first. Made in your account.'));
    const make = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', 'Make playlist');
    make.className = 'btn-tonal';
    make.addEventListener('click', async () => {
      try {
        make.disabled = true;
        const picks = ctx.picks;
        const names = Object.entries(picks)
          .map(([artist, byP]) => ({ artist, level: mineOnly ? (byP[ctx.meName] || 0) : Math.max(...Object.values(byP)) }))
          .filter((x) => x.level > 0)
          .sort((a, b) => b.level - a.level)
          .map((x) => x.artist);
        if (!names.length) { msg.textContent = 'No picks yet.'; return; }
        await spotify.playlistFromPicks({
          title: `${state.fest().name} — ${mineOnly ? ctx.meName : 'the crew'}`,
          artistNames: names,
          onProgress: (p) => { msg.textContent = p; },
        });
        msg.textContent = 'Playlist created in your Spotify.';
      } catch (e) { msg.textContent = String(e.message || e); }
      finally { make.disabled = false; }
    });
    pl.appendChild(make);
    col.appendChild(pl);

    const dis = el('button', 'font-size: 12px; padding: 8px 14px; align-self: flex-start;', 'Disconnect');
    dis.className = 'btn-ghost';
    dis.addEventListener('click', () => { spotify.disconnect(); rerenderDrill(); });
    col.append(dis, el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.55;',
      'Disconnect keeps picks and notes — only the badges disappear.'));
    const cfg = el('div'); cfg.className = 'settings-card';
    cfg.appendChild(clientIdConfigRow(actions, rerenderDrill));
    col.append(cfg, msg);
  }
  host.appendChild(col);
}
