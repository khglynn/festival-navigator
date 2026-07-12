// Settings (atlas 21h) — ONE page, two doors (header gear + dock fest link).
// Order: YOUR FESTIVALS -> YOU -> APP. Desktop is the same 560px column.
// How-it-works (21i) renders as a sub-view. All doc strings via textContent.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as spotify from '../spotify.js';
import { FESTIVAL_INDEX } from '../festivals.js';
import { hslOf, strokeOf } from './palette.js';
import { colorIndexOf } from './wall.js';
import { openExportLikes, openBulkPaste, downloadWallImage } from './tools.js';

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
  const row = el('div');
  row.className = 'list-row';
  row.style.cursor = 'pointer';
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
  const syncState = el('span', 'margin-left: auto; color: var(--sync-ok); font-size: 10.5px; font-weight: 700;',
    state.hasPending() ? 'syncing' : 'synced');
  head.append(nm, dates, syncState);
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
    try {
      if (navigator.share) await navigator.share({ title: 'Festival Navigator', url: link });
      else { await navigator.clipboard.writeText(link); share.textContent = 'Link copied ✓'; setTimeout(() => { share.textContent = 'Share invite'; }, 1800); }
    } catch { /* user dismissed the share sheet */ }
  });
  const count = el('button', 'font-size: 12px; padding: 9px 14px;',
    `${Object.keys((state.crewDoc.festivals[state.activeFestivalId] || {}).selections || {}).length} artists picked`);
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
    const picks = Object.keys((state.crewDoc.festivals[f.id] || {}).selections || {}).length;
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
  add.addEventListener('click', () => openAddFestival(actions));
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

// ---- add a festival (LLM research -> preview -> confirm; api/festival-add) --------
function openAddFestival(actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', () => { host.textContent = ''; actions.rerender(); });
  const title = el('div', '', 'ADD A FESTIVAL'); title.className = 'screen-title';
  head.append(back, title);
  col.appendChild(head);

  const row = el('div', 'display: flex; gap: 8px;');
  const input = el('input');
  input.placeholder = 'Festival name (e.g. Bonnaroo 2026)';
  input.maxLength = 80;
  input.style.cssText = 'flex: 1; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: #fff; font-size: 13px; font-family: var(--font-ui); outline: none;';
  const go = el('button', 'font-size: 12px; padding: 9px 15px; flex: none;', 'Research');
  go.className = 'btn-tonal';
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
        `${(c.artists || []).length} artists found${body.sources?.length ? ` · ${body.sources.length} sources` : ''}`));
      const sample = (c.artists || []).slice(0, 12).map((a) => a.name).join(' · ');
      card.appendChild(el('div', 'color: var(--text-body); font-size: 11.5px; margin-top: 6px; line-height: 1.5;', sample + ((c.artists || []).length > 12 ? ' …' : '')));
      const confirmRow = el('div', 'display: flex; gap: 8px; margin-top: 10px;');
      const save = el('button', 'flex: 1; font-size: 12px; padding: 9px;', 'Looks right — save it');
      save.className = 'btn-tonal';
      save.addEventListener('click', async () => {
        save.disabled = true;
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
      });
      const discard = el('button', 'font-size: 12px; padding: 9px 14px;', 'Discard');
      discard.className = 'btn-ghost';
      discard.addEventListener('click', () => { preview.textContent = ''; });
      confirmRow.append(save, discard);
      card.appendChild(confirmRow);
      preview.appendChild(card);
    } catch {
      status.textContent = 'Research failed — check your connection.';
    } finally { go.disabled = false; }
  });
  host.appendChild(col);
}

// ---- HOW IT WORKS (21i) -------------------------------------------------------------
function openHowItWorks(actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', () => { host.textContent = ''; actions.rerender(); });
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

  main.appendChild(microLabel('You'));
  const youCard = el('div', 'display: flex; align-items: center; gap: 11px; padding: 12px 14px;');
  youCard.className = 'settings-card';
  if (ctx.meName) {
    const p = state.people()[ctx.meName];
    const av = el('span', '', ctx.meName.charAt(0).toUpperCase());
    av.className = 'avatar';
    av.style.cssText += 'width: 26px; height: 26px; font-size: 10px; border: 1.5px solid #fff;';
    av.style.background = hslOf(colorIndexOf(ctx.meName, p), 0.5);
    const nm = el('span', 'color: #fff; font-weight: 700; font-size: 14px; flex: 1;', ctx.meName);
    youCard.append(av, nm);
  } else {
    youCard.appendChild(el('span', 'color: var(--text-tertiary); font-size: 12px; font-weight: 600;', 'Open your crew link to claim a name.'));
  }
  main.appendChild(youCard);

  // Spotify glance (state only; the drill page holds every action — 21f rule)
  const sp = el('div'); sp.className = 'settings-card';
  sp.style.cssText += 'display: flex; flex-direction: column; gap: 9px; cursor: pointer; margin-top: 8px;';
  const spHead = el('div', 'display: flex; align-items: baseline; gap: 8px;');
  spHead.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Spotify'));
  const lib = spotify.libraryMap();
  spHead.appendChild(el('span', `color: ${spotify.isConnected() ? 'var(--spotify-stroke)' : 'var(--text-tertiary)'}; font-size: 11px; font-weight: 700;`,
    spotify.isConnected() ? 'connected' : 'not connected'));
  spHead.appendChild(el('span', 'margin-left: auto; color: var(--text-tertiary); font-size: 10.5px; font-weight: 600;', lib ? `synced ${lib.fetchedAt?.slice(0, 10) || ''} ›` : '›'));
  sp.appendChild(spHead);
  if (lib) sp.appendChild(el('div', 'color: var(--text-secondary); font-size: 12px; font-weight: 600;', `${Object.keys(lib.artists || {}).length.toLocaleString()} artists in your library`));
  sp.addEventListener('click', () => { main.style.display = 'none'; openSpotifyDrill(ctx, { ...actions, rerender: () => renderSettings(root, ctx, actions) }); });
  main.appendChild(sp);

  main.appendChild(microLabel('App'));
  const list = el('div'); list.className = 'settings-list';
  const sub2 = () => { main.style.display = 'none'; };
  const rerender = () => renderSettings(root, ctx, actions);
  list.appendChild(linkRow('How it works', () => { sub2(); openHowItWorks({ ...actions, rerender }); }));
  const s = appSettings();
  list.appendChild(toggleRow('Low power', 'no animation · sync every 5 min', s.lowPower, (on) => {
    saveAppSettings({ ...appSettings(), lowPower: on });
    actions.onLowPower(on);
  }));
  list.appendChild(toggleRow('Stay offline', 'stop sync attempts until I turn this off', s.stayOffline, (on) => {
    saveAppSettings({ ...appSettings(), stayOffline: on });
    actions.onStayOffline(on);
  }));
  list.appendChild(linkRow('Bulk paste likes', () => {
    sub2();
    openBulkPaste(document.getElementById('settings-subview'), {
      back: () => { document.getElementById('settings-subview').textContent = ''; rerender(); },
      recordPick: actions.recordPick,
      afterApply: actions.afterBulk,
    });
  }));
  list.appendChild(linkRow('Export likes', () => {
    sub2();
    openExportLikes(document.getElementById('settings-subview'), ctx,
      () => { document.getElementById('settings-subview').textContent = ''; rerender(); });
  }));
  list.appendChild(linkRow('Download day image', async () => {
    try { await downloadWallImage(state.fest().name); }
    catch { /* html2canvas missing — the row simply does nothing rather than crash */ }
  }));
  main.appendChild(list);

  root.append(sub, main);
}

// ---- Spotify drill (21f) — every action lives here ----------------------------------
function openSpotifyDrill(ctx, actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.addEventListener('click', () => { host.textContent = ''; actions.rerender(); });
  head.append(back, el('div', '', 'SPOTIFY'));
  head.lastChild.className = 'screen-title';
  const status = el('span', 'margin-left: auto; color: var(--spotify-stroke); font-size: 11.5px; font-weight: 700;',
    spotify.isConnected() ? 'connected' : '');
  head.appendChild(status);
  col.appendChild(head);
  const msg = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;');

  if (!spotify.isConnected()) {
    if (!state.spotifyClientId()) {
      msg.textContent = 'The crew lead sets a Spotify Client ID once (Settings on their device); then everyone can connect.';
      const row = el('div', 'display: flex; gap: 8px;');
      const input = el('input');
      input.placeholder = 'Crew Spotify app Client ID';
      input.maxLength = 32;
      input.style.cssText = 'flex: 1; background: var(--card); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 10px 12px; color: #fff; font-size: 12.5px; font-family: var(--font-ui); outline: none;';
      const save = el('button', 'font-size: 12px; padding: 9px 14px;', 'Save');
      save.className = 'btn-tonal';
      save.addEventListener('click', () => {
        const v = input.value.trim();
        if (!/^[0-9a-fA-F]{32}$/.test(v)) { msg.textContent = 'That does not look like a 32-character Client ID.'; return; }
        state.recordSpotifyClientId(v);
        actions.afterBulk();
        msg.textContent = 'Saved — connect below once it syncs.';
      });
      row.append(input, save);
      col.append(msg, row);
    } else {
      const connect = el('button', 'font-size: 13px; padding: 11px 18px; align-self: flex-start;', 'Connect my Spotify');
      connect.className = 'btn-tonal';
      connect.addEventListener('click', () => spotify.connect().catch((e) => { msg.textContent = String(e.message || e); }));
      col.append(connect, msg);
    }
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
        const names = (state.fest().artists || []).map((a) => a.name);
        const n = spotify.applyAffinityToCrew(ctx.meName, names);
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
    dis.addEventListener('click', () => { spotify.disconnect(); host.textContent = ''; actions.rerender(); });
    col.append(dis, el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.55;',
      'Disconnect keeps picks and notes — only the badges disappear.'), msg);
  }
  host.appendChild(col);
}
