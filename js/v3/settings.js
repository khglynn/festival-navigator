// Settings (atlas 21h) — ONE page, two doors (header gear + dock fest link).
// Order: YOUR FESTIVALS -> YOU -> CREW -> APP (the Spotify glance card and
// the App-labeled list below it are both "APP"). Desktop is the same 560px column.
// How-it-works (21i) renders as a sub-view. All doc strings via textContent.
import * as state from '../state.js';
import * as crew from '../crew.js';
import * as spotify from '../spotify.js';
import * as sync from '../sync.js';
import * as model from './model.js';
import { FESTIVAL_INDEX, FESTIVALS } from '../festivals.js';
import { BOARD, hslOf, strokeOf } from './palette.js';
import { colorIndexOf, meterChip, crewMark } from './wall.js';
import { meterOf, whoCorner } from './aura.js';
import { festPlaceLine } from './card-facts.js'; // the fest's place line, shared with the wall header
import { recent as recentErrors, diagnostics, SETTINGS_KEY, reportKey, reportsOn, clearReports, noteSettings, pageBuild } from '../errlog.js';
import { el, subviewHead, eqLoader, festRow, openExportLikes, openBulkPaste, openDayImage } from './tools.js';
import { router } from './router.js';
import { nameProblem, NAME_LIMITS } from '../name-rules.mjs';
import { loadJSON, saveLS, getLS, removeLS, errorText } from '../util.js';
import { cancelledNames } from './events.js'; // a cancelled act never goes into a playlist (2026-09-23)

// {lowPower, stayOffline, crashReports}. The key's home is js/errlog.js: the
// crash reporter reads Off and Stay offline before any other module runs.
const LS_SETTINGS = SETTINGS_KEY;
export const SUPPORT_URL = 'https://buymeacoffee.com/kevinhg'; // Kevin's page (also list-maker's), 2026-09-02

export function appSettings() { return loadJSON(LS_SETTINGS, {}); }
// A write that does not land (storage blocked or full) still reaches the crash
// reporter, so Off and Stay offline hold for this page either way.
export function saveAppSettings(s) { noteSettings(s, saveLS(LS_SETTINGS, JSON.stringify(s))); }

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
  const flip = () => {
    const now = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(now));
    onFlip(now);
  };
  toggle.addEventListener('click', (e) => { e.stopPropagation(); flip(); });
  // The whole row flips it. The 40x24 switch was the only live target, so
  // tapping the words "Low power" — the obvious thing to tap, and the big
  // thing to tap — did nothing at all (finish pass, 2026-07-12).
  row.style.cursor = 'pointer';
  row.addEventListener('click', flip);
  row.append(left, toggle);
  return row;
}

// A row that leaves the app: a real link (a new tab, no opener), dressed as a
// list row so it reads like its neighbours and stays keyboard-reachable.
function externalRow(title, url, aria) {
  const row = el('a');
  row.className = 'list-row';
  row.href = url; row.target = '_blank'; row.rel = 'noopener';
  if (aria) row.setAttribute('aria-label', aria);
  row.style.cssText = 'cursor: pointer; width: 100%; box-sizing: border-box; background: none; border: none; border-bottom: 1px solid var(--hairline); font: inherit; text-align: left; color: inherit; text-decoration: none;';
  const t = el('span', 'flex: 1;', title); t.className = 'row-title';
  const chev = el('span', '', '↗'); chev.className = 'chev';
  row.append(t, chev);
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
  // Two-line clamp, not a one-line ellipsis. ACL runs two weekends and its date
  // string says so; clipping it to "October 2-4, 20..." with a title= tooltip
  // meant a phone — where title= does nothing at all — could never show the
  // second weekend. The dates are the whole point of the card.
  const dates = el('span', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;');
  // The venue leads the line and opens the map when the fest file knows the
  // address (Kevin, 2026-08-31: the main-stage address, in Settings, for
  // every fest) — the same line the wall header wears.
  dates.appendChild(festPlaceLine(fest));
  // The ONE sync state (PS-5): same source as the dot — a "synced" label
  // computed from hasPending alone lied whenever the network was down.
  const LABELS = {
    online: ['synced', 'var(--sync-ok)'],
    syncing: ['syncing', 'var(--sync-syncing)'],
    offline: ['offline', 'var(--sync-offline)'],
    error: ['sync error', 'var(--sync-error)'],
    // Not "error": the server understood us and said no. Different problem,
    // different word, same color — because both need a human.
    blocked: ['can’t sync', 'var(--sync-error)'],
  };
  const [label, color] = LABELS[sync.syncState()] || LABELS.online;
  const syncLabel = el('span', `margin-left: auto; color: ${color}; font-size: 10.5px; font-weight: 700;`, label);
  head.append(nm, dates, syncLabel);
  card.appendChild(head);

  const chips = el('div', 'display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px;');
  for (const [name, p] of state.activePeople()) {
    // A roster, not a control — `static` drops the cursor:pointer this chip
    // inherits, so it stops promising a tap it never handled.
    const chip = el('span', '', name);
    chip.className = 'person-chip static' + (name === ctx.meName ? ' you' : '');
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
    // The link carries this phone's view (v92, SD1) — the line under the
    // invite link below says which.
    const link = actions.inviteLink ? actions.inviteLink() : crew.crewLink(state.getCrewToken(), fid);
    // A guest shares the link it holds, and writes nothing into the crew
    // until it joins (v92): the invite-festival stamp is a member's.
    if (ctx.meName && (state.crewDoc.meta || {}).inviteFestId !== fid) {
      state.recordInviteFest(fid);
      actions.afterBulk(); // schedules the sync push
    }
    const copyFallback = async () => {
      try { await navigator.clipboard.writeText(link); share.textContent = 'Link copied ✓'; setTimeout(() => { share.textContent = 'Share invite'; }, 1800); }
      catch { share.textContent = 'See the link below'; setTimeout(() => { share.textContent = 'Share invite'; }, 2500); }
    };
    try {
      if (navigator.share) await navigator.share({ title: 'Festival Navigator', text: crew.inviteText((state.fest() || {}).name), url: link });
      else await copyFallback();
    } catch (e) {
      // A dismissed share sheet is a choice; anything else falls back to the
      // clipboard instead of silently doing nothing (FLOW-12).
      if (!e || e.name !== 'AbortError') await copyFallback();
    }
  });
  // Real picks only — raw selection keys include cleared level-0 tombstones
  // and would overcount (CORE-13).
  const nPicks = Object.keys(model.picksFor(state.crewDoc, state.activeFestivalId)).length;
  const count = el('button', 'font-size: 12px; padding: 9px 14px;',
    `${nPicks} artist${nPicks === 1 ? '' : 's'} picked`);
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

  // YOUR boards, not the catalog (Kevin, 2026-07-14: "just show the fests
  // I've picked — we don't need to repeat all the pick-fest options here").
  // Same-circle fests switch in place; boards in other circles open the way
  // landing rows do. Adding a fest goes to the shared multi-pick page.
  const pairs = model.landingPairs(crew.knownCrews(), state.cachedDoc, FESTIVAL_INDEX)
    .filter((p) => p.fid && !(p.token === state.getCrewToken() && p.fid === state.activeFestivalId));
  for (const p of pairs) {
    const meta = FESTIVAL_INDEX.find((f) => f.id === p.fid)
      || { id: p.fid, name: model.festLabelFor(p.fid, FESTIVAL_INDEX).name };
    const sameCrew = p.token === state.getCrewToken();
    const picks = sameCrew ? Object.keys(model.picksFor(state.crewDoc, p.fid)).length : 0;
    const names = p.people.map((x) => x.name);
    wrap.appendChild(festRow(meta, {
      muted: meta.status === 'archived',
      chev: true,
      sub: [
        meta.dates,
        sameCrew && picks ? `${picks} artist${picks === 1 ? '' : 's'} picked` : '',
        !sameCrew && names.length > 1 ? names.slice(0, 3).join(', ') : '',
      ].filter(Boolean).join(' · '),
      onPick: () => (sameCrew ? actions.switchFestival(p.fid) : actions.openBoard(p.token, p.fid)),
    }));
  }

  const add = el('button', '', '+ Add a festival');
  add.className = 'dashed-row';
  add.addEventListener('click', actions.addFestival);
  wrap.appendChild(add);

  // The AI/custom add keeps its own quiet door — it is the ONLY path for a
  // fest that isn't in the catalog, and it lands on THIS board's circle.
  // A member's door only (v92): it writes a festival into THIS crew, and a
  // guest writes nothing into a crew until it joins.
  if (ctx.meName) {
    const custom = el('button', 'font-size: 11.5px; padding: 8px 12px; align-self: center;',
      'Fest not in the catalog? Research + add it to this board');
    custom.className = 'btn-ghost';
    custom.addEventListener('click', () => { openSubviewByKey('sub:add-fest', ctx, actions); router.push('sub:add-fest'); });
    wrap.appendChild(custom);
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
  col.appendChild(subviewHead('ADD A FESTIVAL', subviewBack(actions)));

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
    status.textContent = '';
    status.appendChild(eqLoader('Digging up the lineup — about 20 seconds…'));
    preview.textContent = '';
    try {
      const res = await fetch(`/api/festival-add?t=${encodeURIComponent(state.getCrewToken())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) { status.textContent = errorText(body, 'Research failed.'); return; }
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
      card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; margin-top: 6px;',
        hosts.length
          ? `Sourced from ${hosts.slice(0, 4).join(', ')}${hosts.length > 4 ? '…' : ''}`
          : 'No sources came back with this result — double-check the lineup before saving.'));
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
// The dock's fest link, the way the person reading this sees it — the WHOLE
// component (`.fest-link`: the name in Anton, and the sync dot beside it), not
// a redrawing of part of it. It was the name alone in one row and the
// name-plus-dot in another, five rows apart and in two different faces
// (Kevin, 2026-09-17); one row, one component, both facts. The label is the
// fixed string `ACL '26` — never the current fest's name: "SEISMIC DANCE
// EVENT 9.0 '26" broke out of its box at 390 (Kevin: "easiest fix: code in
// one fest name, probs ACL"). It is a span, not a button: this is a picture
// of the door, and the door is at the bottom of the screen.
//
// THE ACCENT LAW (CLAUDE.md): `--fest` appears in exactly four places, and
// this drill is not one of them — but the component's own rule paints its
// name in `--fest`, and `--fest` is set on <body> per fest, so the picture
// wore the current fest's colour. The token is re-scoped to brand on the
// picture itself: the component is untouched, and inside the drill it reads
// as "ours", not as any festival's.
function festLinkDemo() {
  const link = el('span');
  link.className = 'fest-link';
  link.style.setProperty('--fest', 'var(--brand)');
  const n = el('span', 'font-size: 11px;', "ACL '26");
  n.className = 'fest-name';
  // The caret the real one wears while it opens a menu (v93).
  const caret = el('span');
  caret.className = 'menu-caret';
  const dot = el('span');
  dot.className = 'sync-dot';
  link.append(n, caret, dot);
  return link;
}

function openHowItWorks(actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  col.appendChild(subviewHead('HOW IT WORKS', subviewBack(actions)));

  const card = el('div'); card.className = 'settings-card';
  card.style.cssText += 'display: flex; flex-direction: column; gap: 12px;';
  const lesson = (demoBuilder, strong, rest) => {
    const row = el('div', 'display: flex; align-items: center; gap: 12px;');
    // min-width: 0 + overflow: hidden — a picture stays in its cell; no
    // future label can break out of the row at 390 (2026-09-17).
    const demo = el('div', 'width: 104px; flex: none; min-width: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 3px;');
    demoBuilder(demo);
    const text = el('span', 'color: var(--text-secondary); font-size: 11.5px; font-weight: 600; line-height: 1.45; flex: 1;');
    const s = el('strong', 'color: #fff;', strong);
    text.append(s, ' ' + rest);
    row.append(demo, text);
    return row;
  };
  // Copy pass 2026-08-27 (Kevin): keep the spirit, trim the fat — one line
  // per thing that matters on the wall, then the new filters, then how people
  // get in, then a pointer at Settings. Sort/billing is gone (it only exists
  // on lineup walls and nobody asked). Every demo is a real component drawn
  // small, never a screenshot.
  const chipDemo = (label, { ring = false, faded = false, dashed = false } = {}) => {
    const c = el('span', `font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 999px; color: #fff; background: ${dashed ? 'transparent' : 'hsla(172,90%,62%,.5)'}; border: 1px solid ${dashed ? 'var(--border-emphasis)' : 'hsla(172,90%,62%,.9)'};${dashed ? ' border-style: dashed; color: var(--text-secondary);' : ''}${ring ? ' box-shadow: 0 0 0 1.5px rgba(255,255,255,.85);' : ''}${faded ? ' opacity: .42;' : ''}`, label);
    return c;
  };
  // Order (Kevin, 2026-09-17, MODEL-V4 §3a.4): the rows are GROUPED THE WAY THE
  // SCREEN READS — who is here and how they got here, then the card and what it
  // wears, then the wall's own moves, then the dock, then Settings. Each row is
  // the REAL component drawn small, never a lookalike: the fest link used to be
  // drawn twice, differently, five rows apart ("YOUR FEST ▾" in the body face
  // and "YOUR FEST ●" in Anton), which is exactly the drift a lookalike buys
  // you. The now mark gets no row (Kevin, 2026-09-17: "don't need to explain
  // now"); nor does the now line (2026-08-31: "I don't think that'll confuse
  // anyone"). The copy in these rows is Kevin's own, verbatim.

  // 1-2. The people: whose picks you are looking at, and how someone joins.
  card.appendChild(lesson((d) => {
    d.append(chipDemo('Kat', { ring: true }), chipDemo('Drew', { faded: true }));
  }, 'Highlight a friend’s picks.', 'Tap their name. Switch who you pick as in Settings.'));
  card.appendChild(lesson((d) => {
    d.append(chipDemo('+ Add someone', { dashed: true }));
  }, 'Add your people.', 'Tap + Add someone, or share the crew link — anyone who opens it is in, no account needed.'));

  // 3-5. The card: what a tap does, and what the two corners are saying.
  // Row 3 is the card getting brighter with the REAL meter chip on it, filling
  // a bar a tap (2026-09-23: your level is on the card now, bottom left). Row
  // 4 is the REAL crew marks — everyone else's, since you are on the left.
  card.appendChild(lesson((d) => {
    [0.5, 0.75, 1].forEach((a, i) => {
      const swatch = el('span', `position: relative; flex: 1; height: 30px; border-radius: 6px; border: 1px solid var(--hairline); background: radial-gradient(130% 130% at 20% 120%, hsla(10,90%,62%,${a}) 0%, transparent 78%), #1C1731;`);
      const chip = meterChip(meterOf({ level: i + 1, colorIndex: 0 }));
      chip.style.position = 'absolute';
      chip.style.left = '3px';
      chip.style.bottom = '3px';
      swatch.appendChild(chip);
      d.appendChild(swatch);
    });
  }, 'Add your color to an artist.', 'Tap it. Your bars fill each tap. 4 taps = must see.'));
  // Kat is BOARD[6], the teal row 1's Kat chip already wears — one person,
  // one colour, on one screen.
  card.appendChild(lesson((d) => {
    for (const m of whoCorner([{ name: 'Kat', colorIndex: 6, level: 4 }, { name: 'Sam', colorIndex: 3, level: 1 }])) d.appendChild(crewMark(m));
  }, 'Everyone else’s picks land on the card.', 'Ticks are picks; a letter is a must.'));
  card.appendChild(lesson((d) => {
    const n = el('span', '', '2'); n.className = 'chip-notes'; n.style.height = '14px';
    const s = el('span', '', '23'); s.className = 'chip-spotify'; s.style.height = '13px'; // the green pill, never a music-note glyph
    d.append(n, s);
  }, 'Details and notes.', 'Hold the card. Violet = crew notes; pin one to keep it on top. Green = it’s in your Spotify (connect in Settings).'));

  // 6. The wall: the one mark a card can wear that is a guess. The tilde used
  // to explain itself in a whisper under every venue night — one line of
  // small print the wall had to carry forever (Kevin, 2026-09-17: "weird
  // inline"). It is explained here once instead. (A stage row sat under it
  // until the ship round: the tap it explained was cut.)
  card.appendChild(lesson((d) => {
    const chip = el('span', 'display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--hairline); background: var(--card-unpicked);');
    chip.appendChild(el('span', 'color: #fff; font-size: 10px; font-weight: 700;', 'Gelli Haha'));
    chip.appendChild(el('span', 'color: var(--text-secondary); font-size: 8.5px; font-weight: 600;', '~10:30 PM'));
    d.appendChild(chip);
  }, '~ a guessed start time and artist order.', 'Based on limited intel.'));

  // 7-9. The dock: the fest link (the show menu, MODEL-V4 §3.1 — the real
  // component, caret and dot), then the dot's own row (v93, Kevin: every row
  // leads with the feature, and the dot's colours are a fact of their own, so
  // they no longer ride on the menu's row — drawn as the real dot, in its
  // three states), and the gear.
  card.appendChild(lesson((d) => {
    d.appendChild(festLinkDemo());
  }, 'Show or hide parts of the week.', 'Tap the fest name.'));
  card.appendChild(lesson((d) => {
    for (const state of ['', 'sync-offline', 'sync-error']) {
      const dot = el('span', 'margin: 0 2px;');
      dot.className = `sync-dot ${state}`.trim();
      d.appendChild(dot);
    }
  }, 'Sync, at a glance.', 'Green dot = synced. Gray = offline (still works); red = something’s wrong.'));
  card.appendChild(lesson((d) => {
    const gear = el('span', 'color: var(--text-secondary); font-size: 16px;', '⚙');
    d.appendChild(gear);
  }, 'Switch fests and more in Settings.', ''));
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
  nameRow.append(nm);
  if (ctx.meName) nameRow.append(renameBtn); // a guest renames nothing (v92)
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

  // Member chips open their personal claim link (&me=) — never an identity
  // switch (FLOW-8 still holds): "send Drew HIS link" after adding him on
  // your phone is the whole shared-phone story (Kevin note 5).
  const memberLinkHost = el('div');
  const chips = el('div', 'display: flex; gap: 5px; flex-wrap: wrap;');
  for (const [name, p] of state.activePeople()) {
    const chip = el('button', 'cursor: pointer;', name);
    chip.className = 'person-chip' + (name === ctx.meName ? ' you' : '');
    chip.setAttribute('aria-label', `${name} — get their personal link`);
    const ci = colorIndexOf(name, p);
    chip.style.background = hslOf(ci, 0.5);
    chip.style.border = '1px solid ' + strokeOf(ci, name === ctx.meName);
    chip.style.fontSize = '11px';
    chip.style.padding = '4px 11px';
    chip.addEventListener('click', () => {
      memberLinkHost.textContent = '';
      const mLink = actions.inviteLink ? actions.inviteLink(name) : crew.crewLink(state.getCrewToken(), state.activeFestivalId, name);
      const mRow = el('div', 'display: flex; gap: 8px; align-items: center;');
      const mBox = el('input');
      mBox.readOnly = true;
      mBox.value = mLink;
      mBox.setAttribute('aria-label', `${name}'s personal invite link`);
      mBox.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 8px 11px; color: var(--text-secondary); font-size: 11.5px; font-family: var(--font-ui);';
      mBox.addEventListener('focus', () => mBox.select());
      const mCopy = el('button', 'font-size: 11.5px; padding: 8px 13px; flex: none;', `Copy ${name}’s link`);
      mCopy.className = 'btn-tonal';
      mCopy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(mLink); mCopy.textContent = 'Copied ✓'; setTimeout(() => { memberLinkHost.textContent = ''; }, 1500); }
        catch { mBox.select(); }
      });
      mRow.append(mBox, mCopy);
      // Linked vs placeholder (decision 4): a pid means a real person claimed
      // this name — their me link already carries this crew. No pid = a name
      // waiting for its human; the claim link below is how they arrive.
      memberLinkHost.append(mRow,
        el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; margin-top: 4px;',
          p.pid
            ? `${name}’s in. This link still gets them back in.`
            // The same sentence the add-someone sheet says: one idea, one wording.
            : `Send ${name} this link. Opening it makes the picks theirs.`));
    });
    chips.appendChild(chip);
  }
  if (ctx.meName && actions.addMember) {
    const add = el('button', 'cursor: pointer;', '+ Add someone');
    add.className = 'person-chip add';
    add.addEventListener('click', actions.addMember);
    chips.appendChild(add);
  }
  card.appendChild(chips);
  card.appendChild(memberLinkHost);

  // The invite link, always visible (FLOW-12): share sheets fail silently,
  // a printed URL never does.
  const link = actions.inviteLink ? actions.inviteLink() : crew.crewLink(state.getCrewToken(), state.activeFestivalId);
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
  // Two links, two jobs — say which one this is (me-link build, 2026-07-13).
  card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.45;',
    'Anyone with this link joins the crew. Your own link (My link) is on the home page.'));
  // The view every link here carries (v92, SD1), said where the links are.
  const viewLine = actions.inviteViewLine ? actions.inviteViewLine() : '';
  if (viewLine) card.appendChild(el('div', 'color: var(--text-secondary); font-size: 10.5px; font-weight: 600; line-height: 1.45;', viewLine));
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
    // A guest (v92): looking without a name. The door in is right here —
    // the same join screen a tap on an artist opens.
    card.appendChild(el('span', 'color: var(--text-secondary); font-size: 12px; font-weight: 600; line-height: 1.5;',
      'You’re just looking. Add yourself to pick with the crew — no account, just a name.'));
    if (actions.join) {
      const add = el('button', 'font-size: 12.5px; padding: 9px 16px; align-self: flex-start;', 'Add yourself');
      add.className = 'btn-tonal';
      add.addEventListener('click', actions.join);
      card.appendChild(add);
    }
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
      // Removed names stay blocked too: deep-merge can't delete, so a vacated
      // key still carries removed:true and history — reusing it would tangle
      // identities (Codex ship gate). Case-insensitive against the FULL
      // people map (tombstones included, not activePeople() — that would
      // silently drop the removed-name check above): two active names
      // differing only by case are one person to a human and two forever to
      // the document (CLAUDE.md), and the server refuses that merge for
      // good — a bare-lookup here let the rename toast "succeed" and then
      // desync permanently. Your OWN current key is excluded so a pure case
      // fix ("kev" -> "Kev") doesn't collide with yourself.
      const vLower = v.toLowerCase();
      const taken = Object.keys(state.people()).some((n) => n !== ctx.meName && n.toLowerCase() === vLower);
      if (taken) { status.textContent = 'That name has been used in this crew — pick a different one.'; return; }
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
  // margin-block auto = vertical centering that degrades to normal scroll
  // when content is taller than the window (the entry screens' own pattern).
  const sub = el('div', 'margin-block: auto;'); sub.id = 'settings-subview';
  const main = el('div', 'display: flex; flex-direction: column; gap: 10px; margin-block: auto; width: 100%;');
  main.id = 'settings-main';

  const head = el('div', 'display: flex; align-items: center; gap: 10px;');
  const back = el('button', '', '‹'); back.className = 'back-btn';
  back.setAttribute('aria-label', 'Back to the wall');
  back.addEventListener('click', actions.close);
  const title = el('div', '', 'SETTINGS'); title.className = 'screen-title';
  head.append(back, title);
  main.appendChild(head);

  main.appendChild(festivalsSection(ctx, actions));
  main.appendChild(youSection(ctx, actions));
  main.appendChild(crewSection(ctx, actions));

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
  // Spotify badges YOUR picks and records the crew's Spotify app on first
  // connect — nothing a guest has, nothing a guest writes (v92).
  if (ctx.meName) main.appendChild(sp);

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
  // Crash reports (v88, Kevin 2026-09-24: on by default, the line beside it
  // says what goes, name included). This phone's choice alone — it lives in
  // this device's settings, never the crew doc. Off drops whatever was
  // waiting, and nothing leaves after that. A build with no report key
  // sends nothing, so it offers nothing to switch.
  if (reportKey()) {
    list.appendChild(toggleRow('Send crash reports to Kevin', 'with your name and phone type · never notes or crew links', reportsOn(), (on) => {
      saveAppSettings({ ...appSettings(), crashReports: on });
      if (!on) clearReports();
    }));
  }
  // Bulk paste writes picks under the names it reads — a member's tool (v92).
  if (ctx.meName) list.appendChild(linkRow('Bulk paste picks', () => openSub('sub:bulk')));
  list.appendChild(linkRow('Export picks', () => openSub('sub:export')));
  list.appendChild(linkRow('Day image', () => openSub('sub:day-image')));
  // Which build this phone runs, and the way to a newer one (v90) — beside
  // Diagnostics, the other row a "still broken?" conversation needs.
  list.appendChild(updateRow());
  // The crash journal's one door (2026-08-31): a tap copies a shareable dump
  // (build, device, the last 20 recorded errors — never anything private).
  // Exists so "it broke on my phone" can travel as text instead of a video.
  const errCount = recentErrors().length;
  const diagRow = linkRow(errCount ? `Diagnostics · ${errCount} recent error${errCount === 1 ? '' : 's'}` : 'Diagnostics', async () => {
    const t = diagRow.querySelector('.row-title');
    try {
      await navigator.clipboard.writeText(JSON.stringify(await diagnostics(), null, 2));
      t.textContent = 'Copied ✓ — paste it to whoever is debugging';
    } catch {
      t.textContent = 'Couldn’t copy — screenshot this instead';
    }
    setTimeout(() => { t.textContent = errCount ? `Diagnostics · ${errCount} recent errors` : 'Diagnostics'; }, 2200);
  });
  list.appendChild(diagRow);
  // The one ask this free app makes, at the foot of its own list (Kevin,
  // 2026-09-02): a coffee, never a paywall, never in the way of a pick.
  list.appendChild(externalRow('Buy Kevin a coffee ☕', SUPPORT_URL, 'Buy Kevin a coffee — opens buymeacoffee.com in a new tab'));
  main.appendChild(list);

  root.append(sub, main);
}

// ---- get the latest version (v90, Kevin at Portola, 2026-09-25) --------------------
// Kevin's iPhone kept the old build ("there's just a refresh button") and a
// private tab — which loses who you are — was the only way to the new one.
// This row says which build this phone runs and, on a tap, asks for a newer
// one through the machinery that already carries every release: the worker
// registration's own update(). A newer worker installs, takes over, and
// index.html's glue reloads the page the moment nothing is in progress (or
// puts up the new-build strip). The row only calls it and says what happened.
//
// It never clears a cache or touches storage. Deleting the running worker's
// shell leaves a phone with no offline app until a new worker installs — at
// Pier 80 that is exactly when installs fail — and the data cache is every
// festival this phone can open offline. The worker's own activate already
// removes old shells (v90 build log, item 3).
const UPDATE_CHECK_MS = 15000;    // reg.update() on a network that hangs
const UPDATE_LOOKUP_MS = 5000;    // getRegistration(): the browser's own bookkeeping, no network
const UPDATE_DOWNLOAD_MS = 60000; // a new worker's install: the whole shell
const UPDATE_SWITCH_MS = 1500;    // the glue's reload, if nothing is in progress

// Work that marks the page busy (body[data-busy], index.html's quiet())
// and would be thrown away by a reload, as the row names it. A value not
// listed here still holds the reload; it is just not named.
const BUSY_WORDS = {
  'spotify-scan': 'the Spotify scan finishes',
  join: 'you’ve joined the crew',
  create: 'the new crew is made',
  'me-link': 'your link has loaded',
};

// What the row's second line says, in each state.
export function updateWords({ state, page = null, next = null, busy = null }) {
  switch (state) {
    case 'checking': return 'Checking…';
    case 'latest': return page ? `You’re on the latest — ${page}` : 'You’re on the latest version';
    case 'downloading': return 'Downloading the new version…';
    case 'switching': return 'Got it — switching over…';
    case 'ready': return `${next || 'The new version'} is ready — tap to use it`;
    // Ready, but a reload now would throw away work that is running.
    case 'held': return `${next || 'The new version'} switches in once ${BUSY_WORDS[busy] || 'what’s running finishes'} — tap again then`;
    case 'slow': return 'Still downloading — it switches over by itself when it’s done';
    case 'offline': return page ? `You’re offline — this phone keeps ${page} until you have signal` : 'You’re offline — try again when you have signal';
    case 'unreachable': return 'Couldn’t check — try again with more signal';
    // The browser did not answer "is there a worker?" — not a no.
    case 'lookup-failed': return 'Couldn’t check just now — try again in a moment';
    case 'failed': return 'Couldn’t download it — try again with more signal';
    case 'no-worker': return 'This browser keeps no offline copy, so a reload always gets the latest';
    default: return page ? `This phone runs ${page}` : 'Checks for a newer version of the app';
  }
}

// A bounded wait: the promise's own answer, or `fallback` once `ms` pass.
const within = (promise, ms, fallback) => new Promise((resolve, reject) => {
  const t = setTimeout(() => resolve(fallback), ms);
  Promise.resolve(promise).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

// A worker's own answer to "which build are you?" (service-worker.js answers
// the page that asked); null when it is too old to answer or does not.
function askWorkerBuild(worker, container, ms = 3000) {
  return new Promise((resolve) => {
    if (!worker || !container) { resolve(null); return; }
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { container.removeEventListener('message', hear); } catch { /* gone */ }
      resolve(v);
    };
    const hear = (e) => {
      const d = e && e.data;
      if (!d || typeof d.fnBuild !== 'string') return;
      const m = /^festival-nav-(v\d+)$/.exec(d.fnBuild);
      finish(m ? m[1] : null);
    };
    try {
      container.addEventListener('message', hear);
      if (typeof container.startMessages === 'function') container.startMessages();
      worker.postMessage({ fn: 'build?' });
    } catch { finish(null); return; }
    setTimeout(() => finish(null), ms);
  });
}

// A new worker's install, to its end: 'activated', 'redundant' (it failed),
// or 'timeout' while it is still going.
function workerSettles(worker, ms) {
  return new Promise((resolve) => {
    const now = () => worker.state === 'activated' || worker.state === 'redundant';
    if (now()) { resolve(worker.state); return; }
    const t = setTimeout(() => { worker.removeEventListener('statechange', on); resolve('timeout'); }, ms);
    const on = () => {
      if (!now()) return;
      clearTimeout(t);
      worker.removeEventListener('statechange', on);
      resolve(worker.state);
    };
    worker.addEventListener('statechange', on);
  });
}

// The real page's side of the check. Every DOM global is called through an
// arrow, never stored bare (a stored location.reload throws "Illegal
// invocation" in every browser and nothing in Node).
export function updateEnv() {
  let container = null;
  try { container = (window.navigator && window.navigator.serviceWorker) || null; } catch { container = null; }
  return {
    online: () => { try { return window.navigator.onLine !== false; } catch { return true; } },
    // The registration, or null for a CONFIRMED absence (no worker API, or
    // the browser answered that none is registered). A lookup that throws or
    // does not answer in time REJECTS: that is not a no, and the row must
    // not tell a phone on one bar that it keeps no offline copy.
    registration: async () => {
      if (!container || typeof container.getRegistration !== 'function') return null;
      const NO_ANSWER = {};
      const reg = await within(container.getRegistration(), UPDATE_LOOKUP_MS, NO_ANSWER);
      if (reg === NO_ANSWER) throw new Error('getRegistration did not answer');
      return reg || null;
    },
    pageBuild: () => pageBuild(),
    activeBuild: (reg) => askWorkerBuild(reg && reg.active, container),
    // The glue's own word that this page runs an older build than the worker
    // now in charge: it put up the new-build strip (app.js showNewBuildStrip).
    behind: () => !!document.getElementById('new-build-strip'),
    // Work a reload would throw away (index.html's quiet() reads the same mark).
    busy: () => { try { return document.body.dataset.busy || null; } catch { return null; } },
    settles: (worker, ms) => workerSettles(worker, ms),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    reload: () => window.location.reload(),
  };
}

// One check, start to finish; `say` hears every state on the way. Returns
// the last one. Nothing here reloads the page: a newer worker taking over is
// what does that, through index.html's glue, or a second tap on "ready".
export async function checkForUpdate(env, say = () => {}) {
  const step = (s) => { say(s); return s; };
  // A newer build is here: "ready", or "held" while work is running that a
  // reload would throw away.
  const ready = (page, next) => {
    const busy = env.busy();
    return step(busy ? { state: 'held', page, next, busy } : { state: 'ready', page, next });
  };
  // The page's build first: it settles before any other worker is asked
  // "which build?", so their answers can never be mistaken for this page's.
  const page = await env.pageBuild();
  let reg = null;
  let lookupFailed = false;
  try { reg = await env.registration(); } catch { lookupFailed = true; }
  // Already downloaded, this page just has not switched: no network needed.
  if (env.behind()) return ready(page, reg ? await env.activeBuild(reg) : null);
  if (!env.online()) return step({ state: 'offline', page });
  if (lookupFailed) return step({ state: 'lookup-failed', page });
  if (!reg) return step({ state: 'no-worker', page });
  step({ state: 'checking', page });
  try {
    const answered = await within(reg.update().then(() => true), UPDATE_CHECK_MS, false);
    if (!answered) return step({ state: 'unreachable', page });
  } catch {
    return step({ state: 'unreachable', page });
  }
  const incoming = reg.installing || reg.waiting;
  if (incoming) {
    step({ state: 'downloading', page });
    const end = await env.settles(incoming, UPDATE_DOWNLOAD_MS);
    if (end === 'redundant') return step({ state: 'failed', page });
    if (end === 'timeout') return step({ state: 'slow', page });
    step({ state: 'switching', page });
    await env.sleep(UPDATE_SWITCH_MS); // the glue reloads here unless something is in progress
  }
  // Behind with no strip is a page no worker controlled when it loaded (the
  // glue lets the first worker's claim pass without a reload). A misread
  // page build lands here too, and costs one reload onto the same build.
  const active = await env.activeBuild(reg);
  if (env.behind() || (page && active && active !== page)) return ready(page, active);
  return step({ state: 'latest', page: page || active });
}

// The row: a real button (the 44px floor comes from being one), its words in
// the second line, which is a live region so a screen reader hears each state.
// Exported for its tests, which hand it a stand-in page.
export function updateRow(envOf = updateEnv) {
  const row = el('button');
  row.className = 'list-row';
  row.style.cssText = 'cursor: pointer; width: 100%; background: none; border: none; border-bottom: 1px solid var(--hairline); font: inherit; text-align: left; color: inherit;';
  row.dataset.update = 'idle';
  const left = el('span', 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;');
  const t = el('span', '', 'Get the latest version'); t.className = 'row-title';
  const sub = el('span', '', updateWords({ state: 'idle' })); sub.className = 'row-sub';
  sub.setAttribute('aria-live', 'polite');
  left.append(t, sub);
  row.appendChild(left);
  let last = { state: 'idle', page: null };
  let running = false;
  const show = (s) => {
    last = s;
    row.dataset.update = s.state;
    sub.textContent = updateWords(s);
  };
  pageBuild().then((page) => { if (last.state === 'idle') show({ state: 'idle', page }); }, () => {});
  row.addEventListener('click', async () => {
    if (running) return;
    const env = envOf();
    // The second tap on "ready" is the strip's own Refresh: the person asked,
    // and it is the way through when a sheet keeps the glue from reloading.
    // Never through running work (a Spotify scan): a reload would throw it
    // away, so the row says what it waits for, and the first tap after the
    // work is done switches.
    if (last.state === 'ready' || last.state === 'held') {
      const busy = env.busy();
      if (busy) { show({ state: 'held', page: last.page, next: last.next || null, busy }); return; }
      env.reload();
      return;
    }
    running = true;
    try { await checkForUpdate(env, show); } catch { show({ state: 'unreachable', page: last.page }); } finally { running = false; }
  });
  return row;
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

// ---- Spotify drill (21f / SPOT-2) — one state-driven card ---------------------------
// Every state explains itself in one sentence and offers exactly one action.
//
// Access model (Kevin note 7, 2026-07-12, recordOS-style): the MAIN path is
// the deployment owner's Spotify app — its client ID ships via
// /api/access?config=1 (public by design under PKCE), so friends never see a
// code. Door (a): already on the app's allowlist -> just Connect. Door (b):
// not yet -> request access in-app (email -> Slack ping -> owner adds them in
// the Spotify dashboard). Door (c), tucked away: bring-your-own client ID —
// for repo forks and crews outside the owner's circle.

const LS_ACCESS_EMAIL = 'fn_spotify_access_email';
let accessConfig; // {enabled, ownerClientId} — fetched once per session
async function fetchAccessConfig() {
  if (accessConfig !== undefined) return accessConfig;
  try {
    const res = await fetch('/api/access?config=1');
    accessConfig = res.ok ? await res.json() : { enabled: false, ownerClientId: '' };
  } catch { accessConfig = { enabled: false, ownerClientId: '' }; }
  return accessConfig;
}

// Door (b): request a spot on the owner app's allowlist. Remembers the email
// locally so reopening the drill shows where the request stands.
function requestAccessRow(rerenderDrill) {
  const wrap = el('div', 'display: flex; flex-direction: column; gap: 7px; border-top: 1px solid var(--hairline); padding-top: 10px;');
  const saved = getLS(LS_ACCESS_EMAIL);
  const status = el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; line-height: 1.5;');
  if (saved) {
    wrap.appendChild(el('div', 'color: var(--text-secondary); font-size: 11.5px; font-weight: 600;',
      `Access request sent for ${saved}.`));
    const check = el('button', 'font-size: 11px; padding: 6px 12px; align-self: flex-start;', 'Check status');
    check.className = 'btn-ghost';
    check.addEventListener('click', async () => {
      check.disabled = true;
      try {
        const res = await fetch(`/api/access?email=${encodeURIComponent(saved)}`);
        const body = await res.json();
        if (body.status === 'approved') {
          status.textContent = 'Approved ✓ — hit Connect above and you’re in.';
        } else if (body.status === 'pending') {
          status.textContent = 'Still pending — the owner gets a ping and adds you; usually quick.';
        } else {
          status.textContent = 'No request on file — send it again below.';
          removeLS(LS_ACCESS_EMAIL);
          rerenderDrill();
        }
      } catch { status.textContent = 'Couldn’t check right now — try again in a moment.'; }
      finally { check.disabled = false; }
    });
    wrap.append(check, status);
    return wrap;
  }
  wrap.appendChild(el('div', 'color: var(--text-secondary); font-size: 11.5px; font-weight: 600; line-height: 1.5;',
    'First time? Spotify needs you on the crew app’s guest list — request it with the email on your Spotify account:'));
  const row = el('div', 'display: flex; gap: 8px;');
  const input = el('input');
  input.type = 'email';
  input.placeholder = 'you@spotify-account.email';
  input.maxLength = 254;
  input.setAttribute('aria-label', 'Your Spotify account email');
  input.style.cssText = 'flex: 1; min-width: 0; background: var(--page); border: 1px solid var(--border-input); border-radius: var(--r-card); padding: 9px 11px; color: #fff; font-size: 12.5px; font-family: var(--font-ui);';
  const send = el('button', 'font-size: 11.5px; padding: 8px 14px; flex: none;', 'Request access');
  send.className = 'btn-tonal';
  const doSend = async () => {
    const email = input.value.trim();
    if (!email.includes('@')) { status.textContent = 'That doesn’t look like an email.'; return; }
    send.disabled = true;
    try {
      const res = await fetch('/api/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) { status.textContent = errorText(body, 'Request failed — try again.'); return; }
      saveLS(LS_ACCESS_EMAIL, email.toLowerCase());
      status.textContent = body.status === 'approved'
        ? 'You’re already approved ✓ — hit Connect above.'
        : 'Sent ✓ — the owner gets a ping and adds you. Come back and Connect in a bit.';
    } catch { status.textContent = 'Couldn’t reach the crew service — try again in a moment.'; }
    finally { send.disabled = false; }
  };
  send.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
  row.append(input, send);
  wrap.append(row, status);
  return wrap;
}

// The full own-app guide, shared by the BYO fold and fork deployments.
// Reflects Spotify's Feb-2026 developer rules (one dev-mode app per account,
// Premium required, 5 authorized users, dashboard-managed allowlist).
function spotifyAppSteps() {
  const steps = el('div', 'display: flex; flex-direction: column; gap: 6px; color: var(--text-tertiary); font-size: 11px; font-weight: 600; line-height: 1.55;');
  const lines = [
    '1. developer.spotify.com/dashboard → Create app. You need Spotify Premium, and Spotify allows ONE development-mode app per account — reuse it across projects if you already have one.',
    `2. In the app’s settings, add this exact Redirect URI: https://${SPOTIFY_CANONICAL_HOST}/spotify-callback — running a fork on another domain? Set the fn-canonical-host meta in index.html to your host (docs/fork-setup.md).`,
    '3. Pick “Web API” when it asks which APIs you’re using.',
    '4. Copy the Client ID from the app page and paste it here.',
    '5. Spotify caps development apps at 5 authorized users: on the app page, open User Management and add each friend’s Spotify account email — nobody can connect until their email is on that list.',
  ];
  for (const l of lines) steps.appendChild(el('div', '', l));
  return steps;
}

// Door (c): bring-your-own Spotify app — deliberately a quiet fold, not a
// peer of the main path ("main path is my friends, my spotify" — Kevin).
function byoAppFold(actions, rerenderDrill, msg) {
  const fold = document.createElement('details');
  const sum = document.createElement('summary');
  sum.textContent = 'Using your own Spotify app instead';
  sum.style.cssText = 'color: var(--text-tertiary); font-size: 11px; font-weight: 700; cursor: pointer;';
  fold.appendChild(sum);
  const inner = el('div', 'display: flex; flex-direction: column; gap: 8px; margin-top: 7px;');
  inner.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; line-height: 1.55;',
    'For forks of this app, or crews outside the owner’s circle:'));
  inner.appendChild(spotifyAppSteps());
  inner.appendChild(clientIdInputRow(actions, rerenderDrill, msg));
  fold.appendChild(inner);
  return fold;
}

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

// ---- Spotify: one press, then it just works -----------------------------------
// The whole flow used to be five screens and three presses (Connect -> hop ->
// Connect again -> Rescan -> "now go open your other festivals"). Kevin's model
// is the right one: "if I connect Spotify it should fill in all my fests, and if
// I add fests later Spotify should just pull." Everything below serves that.

let scanning = false; // a scan survives a re-render of the drill
// The completion line survives the drill's re-render — writing it into the
// pre-rerender msg node talked to a detached element (Codex round 5, P2).
let lastSyncNote = '';
// A scan outlives the card that started it, so progress goes to whichever
// reading card is mounted NOW, and a card mounted mid-scan replays the
// latest snapshot at once. It used to go only to the card that started the
// scan: the drill re-renders under a running scan (the owner-app config
// landing right after the OAuth return, a remote sync, back/forward), and
// every card after the first sat on "Reading your library…" with an empty
// bar and an empty cover until the very end — Kevin thought it had hung
// (2026-09-23; it had read 6,225 artists fine).
let scanView = null;   // the mounted reading card's painter
let scanLatest = null; // the latest progress snapshot, for a card that mounts mid-scan
// A failed scan waits for the person. The drill used to fall straight back
// into its reading state and start again — offline, that was a scan loop
// with no pause at all (found with the fix above, 2026-09-23).
let scanFailed = false;

// ONE card, used by every not-yet-connected state, so the first Spotify screen a
// member sees says what connecting DOES instead of showing them a client ID.
function connectCard({ onConnect, extras = [] }) {
  const card = el('div');
  card.className = 'settings-card';
  card.style.cssText += 'display: flex; flex-direction: column; gap: 10px; align-items: flex-start;';
  card.appendChild(el('div', 'color: var(--text-body); font-size: 12.5px; font-weight: 600; line-height: 1.55;',
    'Connect Spotify and every artist you already listen to gets badged — across every festival in your crew, and any you add later.'));
  const btn = el('button', 'font-size: 13px; padding: 11px 18px;', 'Connect my Spotify');
  btn.className = 'btn-tonal';
  btn.addEventListener('click', onConnect);
  card.appendChild(btn);
  card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; line-height: 1.5;',
    'We read your liked songs and follows. Read-only — nothing is ever posted to your account.'));
  for (const x of extras) card.appendChild(x);
  return card;
}

// One press connects, wherever you started. The hop to the canonical OAuth
// origin happens underneath and continues by itself on arrival (sp=connect).
// It ANNOUNCES itself now — a silent origin change reads as the app losing
// everything (Kevin, 2026-07-14) — and the hop URL carries the me link, so
// every board arrives too.
function startConnect(msg) {
  const hop = spotify.canonicalHopUrl({ autoConnect: true });
  if (hop) {
    msg.textContent = `Connecting on ${SPOTIFY_CANONICAL_HOST} — your boards come along…`;
    setTimeout(() => location.assign(hop), 650);
    return;
  }
  spotify.connect().catch((e) => { msg.textContent = String(e.message || e); });
}

// Every artist across the crew's loaded festivals, lowercased — what lets the
// scan ticker celebrate a find the moment it streams past.
function crewFestNamesLower() {
  const names = new Set();
  const fids = new Set(Object.keys(state.crewDoc.festivals || {}));
  if (state.activeFestivalId) fids.add(state.activeFestivalId);
  for (const fid of fids) {
    const fest = FESTIVALS[fid];
    if (!fest) continue;
    for (const n of spotify.artistNamesOf(fest)) names.add(n.toLowerCase());
  }
  return names;
}

// Everyone-mode crew playlists: append tracks for picked artists that aren't
// in the playlist's ledger yet. Runs quietly after a member connects (their
// picks may be new to the playlist) and behind the drill's Update button.
// Collaborative playlists accept other members' tokens; if Spotify refuses
// anyway, say so and leave the manual retry — never fail the sync over it.
async function syncEveryonePlaylists(ctx, actions, onNote) {
  const lists = state.crewDoc.spotify?.playlists || {};
  let added = 0;
  for (const [fid, meta] of Object.entries(lists)) {
    if (meta.mode !== 'everyone') continue;
    const fest = FESTIVALS[fid];
    if (!fest) continue;
    const names = spotify.playlistArtistsFromPicks(model.picksFor(state.crewDoc, fid), { skip: cancelledNames(fest) });
    const missing = spotify.playlistMissingArtists(names, meta);
    if (!missing.length) continue;
    try {
      const r = await spotify.addArtistsToPlaylist({ playlistId: meta.id, artistNames: missing });
      if (r.found.length) {
        state.recordSpotifyPlaylist(fid, { ...meta, artists: [...(meta.artists || []), ...r.found] });
        actions.afterBulk();
        added += r.added;
      }
    } catch (e) {
      console.warn('playlist sync:', e);
      if (onNote) onNote('Couldn’t add to the crew playlist — the Update button in the drill can retry.');
    }
  }
  if (added && onNote) onNote(`Added ${added} track${added === 1 ? '' : 's'} to the crew playlist.`);
  return added;
}

// A body-level pill so the scan stays visible when the person leaves the
// drill to browse the wall — the scan keeps running either way, and badges
// popping in later without explanation reads as haunted. Fixed-position,
// never blocks anything.
function scanPill(text) {
  let pill = document.getElementById('spot-scan-pill');
  if (text === null) { pill?.remove(); return; }
  if (!pill) {
    pill = el('div');
    pill.id = 'spot-scan-pill';
    pill.className = 'spot-pill';
    pill.setAttribute('role', 'status');
    document.body.appendChild(pill);
  }
  pill.textContent = text;
}

// Read the library, then badge EVERY festival the crew has. Both halves, always,
// with no button in between — because connecting was the ask.
async function runFullSync(ctx, actions, rerenderDrill, msg) {
  if (!ctx.meName) { msg.textContent = 'Claim your name first (open your crew link).'; return; }
  scanning = true;
  scanFailed = false;
  scanLatest = null;
  const onProgress = (p) => {
    scanLatest = p;
    if (scanView) scanView(p);
    // Only speak up when the drill isn't on screen — no double narration.
    // offsetParent is null whenever the settings screen is display:none.
    const drillVisible = !!document.getElementById('settings-subview')?.offsetParent;
    if (!drillVisible) {
      scanPill(p.phase === 'badge' ? 'Spotify · badging your festivals…'
        : `Spotify · reading your library${p.total ? ` ${Math.round(((p.scanned || 0) / p.total) * 100)}%` : '…'}`);
    } else scanPill(null);
  };
  // The scan spans minutes and every recorder writes into the CURRENT crew
  // doc — if the person switches crews mid-scan, blind writes land the old
  // crew's identity on the new crew (live ghost: "Kevin HG" stats on a crew
  // he isn't in, 2026-07-13). Same crew at the end, or nothing is written.
  const tokenAtStart = state.getCrewToken();
  const meAtStart = ctx.meName;
  // Busy (index.html's quiet()): a new build's reload waits out the scan
  // rather than throwing away minutes of reading.
  document.body.dataset.busy = 'spotify-scan';
  try {
    const map = await spotify.scanLibrary((p) => onProgress(p), {
      festNames: crewFestNamesLower(),
    });
    if (state.getCrewToken() !== tokenAtStart) {
      scanning = false;
      scanView = null; scanLatest = null;
      scanPill(null);
      console.warn('spotify: crew changed mid-scan — library cached, crew writes skipped (reopen the drill to badge this crew)');
      return;
    }
    state.recordSpotifyStats(meAtStart, map.stats); // the 07-12 dropped write
    onProgress({ text: 'Badging your festivals…', phase: 'badge' });
    const { total, perFest } = await spotify.badgeAllCrewFests(meAtStart);
    const fests = Object.keys(perFest).length;
    actions.afterBulk();
    // Fest-first: your other boards are their own crews — one connect fills
    // ALL of them, not just the one you happened to be on (Kevin, 2026-07-14:
    // "I'd expect my Spotify connection to populate all my fests").
    onProgress({ text: 'Filling your other boards…', phase: 'badge' });
    const others = await spotify.badgeEveryKnownCrew();
    // Your picks may be new to the crew playlist — fold them in while we're
    // here (Kevin's model: someone who auths joins the playlist too).
    const notes = [];
    if (others.crews) notes.push(`Filled ${others.crews} other board${others.crews === 1 ? '' : 's'} too.`);
    if (others.skipped) notes.push(`${others.skipped} board${others.skipped === 1 ? '' : 's'} couldn’t fill yet — each catches up when you open it.`);
    await syncEveryonePlaylists(ctx, actions, (n) => notes.push(n));
    scanning = false;
    scanView = null; scanLatest = null;
    scanPill(null);
    const badgeLine = total
      ? `Badged ${total} artist${total === 1 ? '' : 's'} across ${fests} festival${fests === 1 ? '' : 's'}.`
      : 'Nothing in your library matches these lineups yet — it will badge new festivals as you add them.';
    lastSyncNote = [badgeLine, ...notes].join(' ');
    rerenderDrill(); // renders lastSyncNote into the FRESH msg node
  } catch (e) {
    scanning = false;
    scanFailed = true; // the drill offers "Try again" — never an automatic restart
    scanView = null; scanLatest = null;
    scanPill(null);
    // fetch rejects with a TypeError when the network is gone, and its words
    // ("Failed to fetch", "Load failed") are the browser's, not ours.
    if (e instanceof TypeError) console.warn('spotify scan:', e);
    lastSyncNote = e instanceof TypeError
      ? 'Couldn’t reach Spotify — check your signal and try again.'
      : String(e.message || e);
    rerenderDrill();
  } finally {
    delete document.body.dataset.busy;
  }
}

// How many artists are badged on each of the crew's festivals — computed from
// what is actually in the crew doc, so it cannot claim a badge that isn't there.
function badgeCountsByFest(meName) {
  const aff = state.affinityFor(meName) || {};
  if (!Object.keys(aff).length) return [];
  const out = [];
  const fids = new Set(Object.keys(state.crewDoc.festivals || {}));
  if (state.activeFestivalId) fids.add(state.activeFestivalId);
  for (const fid of fids) {
    const fest = FESTIVALS[fid];
    if (!fest) continue; // not loaded on this device — do not guess
    let hits = 0;
    for (const name of spotify.artistNamesOf(fest)) if (aff[name]) hits++;
    out.push({ id: fid, name: `${fest.name} ${fest.year || ''}`.trim(), hits });
  }
  return out.sort((a, b) => b.hits - a.hits);
}

// The plumbing — which Spotify app the crew rides, and the fork path. A member
// never needs this, so it does not get to be the first thing they see.
function advancedFold(actions, rerenderDrill, msg, { owner }) {
  const fold = document.createElement('details');
  const sum = document.createElement('summary');
  sum.textContent = 'Advanced';
  sum.style.cssText = 'color: var(--text-tertiary); font-size: 11px; font-weight: 700; cursor: pointer;';
  fold.appendChild(sum);
  const body = el('div', 'margin-top: 8px; display: flex; flex-direction: column; gap: 10px;');
  if (owner) {
    // The owner (and only the owner) needs this exact string, and getting it
    // wrong is the difference between working and "redirect_uri: Not matching
    // configuration" on a dead Spotify page.
    body.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.5;',
      `App owner: this app’s Spotify redirect URI must be exactly https://${SPOTIFY_CANONICAL_HOST}/spotify-callback`));
  }
  body.appendChild(clientIdConfigRow(actions, rerenderDrill));
  body.appendChild(byoAppFold(actions, rerenderDrill, msg));
  fold.appendChild(body);
  return fold;
}

const SPOTIFY_CANONICAL_HOST = spotify.CANONICAL_HOST; // one value, one home: index.html's fn-canonical-host meta

function openSpotifyDrill(ctx, actions) {
  const host = document.getElementById('settings-subview');
  host.textContent = '';
  const rerenderDrill = () => openSpotifyDrill(ctx, actions);
  const col = el('div', 'display: flex; flex-direction: column; gap: 10px;');
  const head = subviewHead('SPOTIFY', subviewBack(actions));
  head.appendChild(el('span', 'margin-left: auto; color: var(--spotify-stroke); font-size: 11.5px; font-weight: 700;',
    spotify.isConnected() ? 'connected' : ''));
  col.appendChild(head);
  const msg = el('div', 'color: var(--text-tertiary); font-size: 11.5px; font-weight: 600; line-height: 1.5;');
  if (lastSyncNote) msg.textContent = lastSyncNote;

  const oauthError = spotify.lastError();
  const clientId = state.spotifyClientId();
  // The owner-app config decides which doors render; first open fetches it
  // and repaints (cheap, cached for the session).
  if (accessConfig === undefined) {
    fetchAccessConfig().then(() => {
      if (document.getElementById('settings-subview')?.contains(col)) rerenderDrill();
    });
  }
  const owner = accessConfig || { enabled: false, ownerClientId: '' };
  const usesOwnerApp = owner.enabled && (!clientId || clientId === owner.ownerClientId);

  if (oauthError) {
    // Failure state: say what happened, offer the retry, IN the app. A
    // dev-mode allowlist rejection is the expected first-contact failure on
    // the owner's app — that's exactly where the request-access door goes.
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
    if (usesOwnerApp) card.appendChild(requestAccessRow(rerenderDrill));
    col.append(card, msg);
  } else if (!clientId && owner.enabled) {
    // MAIN PATH: the crew rides the owner's Spotify app — no codes, no setup.
    // ONE button, and it works from whatever host you are on (the hop to the
    // canonical OAuth origin is our plumbing, not the member's errand).
    col.appendChild(connectCard({
      onConnect: () => {
        // Adopting the owner app is the crew's default — recorded on first
        // connect so every member (and the OAuth return) uses the same app.
        state.recordSpotifyClientId(owner.ownerClientId);
        actions.afterBulk();
        startConnect(msg);
      },
      extras: [requestAccessRow(rerenderDrill), advancedFold(actions, rerenderDrill, msg, { owner: true })],
    }));
    col.appendChild(msg);
  } else if (!clientId) {
    // Fork deployments (no owner app configured): BYO setup is the only
    // path, so it speaks first — any member can do it.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 10px;';
    card.appendChild(el('div', 'color: var(--text-body); font-size: 12.5px; font-weight: 600; line-height: 1.55;',
      'One-time crew setup — any member can do it. Paste the crew’s Spotify app Client ID:'));
    card.appendChild(clientIdInputRow(actions, rerenderDrill, msg));
    const fold = document.createElement('details');
    fold.open = true; // the only path on a fork deployment — no hiding it
    const sum = document.createElement('summary');
    sum.textContent = 'How to set up the Spotify app';
    sum.style.cssText = 'color: var(--text-secondary); font-size: 11.5px; font-weight: 700; cursor: pointer;';
    fold.appendChild(sum);
    const stepsWrap = el('div', 'margin-top: 6px;');
    stepsWrap.appendChild(spotifyAppSteps());
    fold.appendChild(stepsWrap);
    card.appendChild(fold);
    col.append(card, msg);
  } else if (!spotify.isConnected()) {
    // Ready: the crew has an app, this member has not connected yet.
    //
    // This screen used to be a lone "Continue on fest.kevinhg.com" button, one
    // line of caption, and a row reading "CREW APP · ...d26734 [Change] [Clear]"
    // — internal plumbing, on the first Spotify screen a member ever sees, with
    // no explanation of what connecting even does. Kevin's word was "sparse and
    // weird" and he was being generous (2026-07-12). Same card as the main path
    // now: say what it does, one button, plumbing folded away.
    col.appendChild(connectCard({
      onConnect: () => startConnect(msg),
      extras: [
        owner.enabled ? requestAccessRow(rerenderDrill) : null,
        advancedFold(actions, rerenderDrill, msg, { owner: owner.enabled }),
      ].filter(Boolean),
    }));
    col.appendChild(msg);
  } else if (scanFailed && !scanning && !spotify.libraryMap()) {
    // The last read stopped (no signal, Spotify down). Say so and wait for
    // the person: falling straight back into the reading state restarted the
    // scan with no pause at all, which offline is a loop.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 10px; align-items: flex-start;';
    card.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Reading your Spotify stopped'));
    card.appendChild(el('div', 'color: var(--text-body); font-size: 12px; font-weight: 600; line-height: 1.5;',
      lastSyncNote || 'Something interrupted it partway.'));
    const retry = el('button', 'font-size: 12.5px; padding: 10px 16px;', 'Try again');
    retry.className = 'btn-tonal';
    retry.addEventListener('click', () => { scanFailed = false; lastSyncNote = ''; rerenderDrill(); });
    card.appendChild(retry);
    col.appendChild(card);
  } else if (!spotify.libraryMap() || scanning) {
    // Connected, nothing read yet — so READ IT. No button.
    //
    // Connecting used to leave you here staring at "not scanned yet" beside a
    // "Rescan my Spotify" button you had to press yourself, and pressing it
    // badged only the festival you happened to be on, then told you to go open
    // the others by hand. Connecting IS the ask. Everything after it is ours.
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 12px; align-items: flex-start;';
    card.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Reading your Spotify'));

    // Real progress, not a spinner promise: album covers flick by as pages
    // stream in (fest-relevant finds hold a beat longer + tint green), over a
    // live counter and a bar. Reduced-motion gets the numbers without the
    // flicker (Kevin, 2026-07-13: "communication of progress" — the covers
    // are the proof the scan is really reading YOUR library).
    const ticker = el('div', 'display: flex; gap: 12px; align-items: center; width: 100%;');
    const tile = el('div');
    tile.className = 'scan-tile';
    ticker.appendChild(tile);
    const lines = el('div', 'display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0;');
    const counter = el('div', 'color: var(--text-body); font-size: 12.5px; font-weight: 700;', 'Reading your library…');
    const finds = el('div', 'color: var(--spotify-stroke); font-size: 11.5px; font-weight: 700; min-height: 14px;', '');
    const barWrap = el('div');
    barWrap.className = 'scan-bar';
    const bar = el('div');
    bar.className = 'scan-bar-fill';
    barWrap.appendChild(bar);
    lines.append(counter, finds, barWrap);
    ticker.appendChild(lines);
    const sub = el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600; line-height: 1.5;',
      'Liked songs and follows — then every festival in your crew badges itself.');
    card.append(ticker, sub);
    col.append(card, msg);
    // Before the first number (a slow first page on one bar of signal) the
    // bar breathes (v3.css .scan-bar.waiting) and the finds line — the slot
    // the "at your festivals" count will use — says why, so nothing on the
    // card moves when the numbers come. The words are all that reduced
    // motion and Low Power get, and all they need. Only a scan that is really
    // running (or about to be) may look like one.
    if (scanning || ctx.meName) {
      barWrap.classList.add('waiting');
      finds.style.color = 'var(--text-tertiary)';
      finds.textContent = 'Waiting on Spotify’s first page…';
    }
    const numbersArrived = () => {
      if (!barWrap.classList.contains('waiting')) return;
      barWrap.classList.remove('waiting');
      finds.style.color = 'var(--spotify-stroke)';
      finds.textContent = '';
    };

    const noMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let lastFlick = 0, holdUntil = 0;
    const onProgress = (p) => {
      numbersArrived();
      if (p.phase === 'badge') { counter.textContent = p.text; bar.style.width = '100%'; return; }
      counter.textContent = p.phase === 'follows'
        ? `${p.followed} followed artists · ${p.artists.toLocaleString()} artists total`
        : `${p.text} · ${p.artists.toLocaleString()} artists`;
      if (p.finds > 0) finds.textContent = `${p.finds} at your festivals ✓`;
      if (p.total > 0 && p.phase === 'likes') bar.style.width = `${Math.min(100, (p.scanned / p.total) * 95)}%`;
      if (p.phase === 'follows') bar.style.width = '97%';
      const now = Date.now();
      if (p.cover && !noMotion && now >= holdUntil && now - lastFlick > 350) {
        lastFlick = now;
        if (p.coverIsFind) { holdUntil = now + 1100; tile.classList.add('find'); }
        else tile.classList.remove('find');
        const img = document.createElement('img');
        img.src = p.cover; img.alt = ''; img.decoding = 'async';
        img.onload = () => { tile.replaceChildren(img); };
      }
    };
    // THIS card hears the scan from now on, whoever started it; mounted
    // mid-scan, it catches up from the latest page at once.
    scanView = onProgress;
    if (scanning) { if (scanLatest) onProgress(scanLatest); }
    else runFullSync(ctx, actions, rerenderDrill, msg);
  } else {
    const lib = spotify.libraryMap();
    const card = el('div'); card.className = 'settings-card';
    card.style.cssText += 'display: flex; flex-direction: column; gap: 9px;';
    card.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Your Spotify'));
    card.appendChild(el('div', 'color: var(--text-secondary); font-size: 12px; font-weight: 600;',
      `${Object.keys(lib.artists || {}).length.toLocaleString()} artists in your library · read ${lib.fetchedAt?.slice(0, 10) || ''}`));

    // What it actually DID, per festival — the answer to "did that work?".
    // The old screen could only say "Badged 42 artists on this fest. Open other
    // fests to badge them too", which is the app assigning you homework.
    const badged = badgeCountsByFest(ctx.meName);
    if (badged.length) {
      const list = el('div', 'display: flex; flex-direction: column; gap: 4px; margin-top: 2px;');
      for (const f of badged) {
        const row = el('div', 'display: flex; gap: 8px; align-items: baseline; font-size: 11.5px; font-weight: 600;');
        row.append(
          el('span', 'color: var(--text-body); flex: 1; min-width: 0;', f.name),
          el('span', 'color: var(--spotify-stroke); flex: none;',
            f.hits ? `${f.hits} badged` : 'none of these yet'),
        );
        list.appendChild(row);
      }
      card.appendChild(list);
      card.appendChild(el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.5;',
        'Add a festival later and it badges itself — no reconnecting.'));
    }

    const refresh = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', 'Read it again');
    refresh.className = 'btn-ghost';
    refresh.addEventListener('click', () => {
      if (!ctx.meName) { msg.textContent = 'Claim your name first (open your crew link).'; return; }
      spotify.disconnectLibrary();
      rerenderDrill(); // falls into the reading state, which does the whole sweep
    });
    card.appendChild(refresh);
    col.appendChild(card);

    // Playlist card. Everything it says happens INSIDE the card — its old
    // status line lived at the very bottom of the drill, below the Advanced
    // fold, so "Make playlist" looked like it did nothing (Kevin, live,
    // 2026-07-13: "didn't do anything as far as I can tell" — it had said
    // 'No picks yet.' two screens below his viewport).
    const pl = el('div'); pl.className = 'settings-card';
    pl.style.cssText += 'display: flex; flex-direction: column; gap: 10px;';
    pl.appendChild(el('span', 'color: #fff; font-weight: 700; font-size: 14px;', 'Playlist from our picks'));

    const plStatus = el('div', 'color: var(--text-secondary); font-size: 11.5px; font-weight: 600; line-height: 1.5; min-height: 15px;');
    const fid = ctx.fid;
    const existing = state.spotifyPlaylistFor(fid);

    if (existing && existing.mode === 'everyone') {
      // The crew already has one — show it, link it, offer the top-up.
      const row = el('div', 'display: flex; gap: 8px; align-items: center; flex-wrap: wrap;');
      const open = document.createElement('a');
      open.href = existing.url; open.target = '_blank'; open.rel = 'noopener';
      open.textContent = 'Open in Spotify ↗';
      open.style.cssText = 'color: var(--spotify-stroke); font-size: 12.5px; font-weight: 700; text-decoration: none;';
      row.append(
        el('span', 'color: var(--text-body); font-size: 12px; font-weight: 600;',
          `Crew playlist · ${(existing.artists || []).length} artists · by ${existing.by || '?'}`),
        open,
      );
      pl.appendChild(row);
      const update = el('button', 'font-size: 12px; padding: 8px 14px; align-self: flex-start;', 'Add new picks');
      update.className = 'btn-ghost';
      update.addEventListener('click', async () => {
        update.disabled = true;
        plStatus.textContent = 'Checking for new picks…';
        try {
          const added = await syncEveryonePlaylists(ctx, actions, (n) => { plStatus.textContent = n; });
          if (!added) plStatus.textContent = 'Playlist already has everyone’s picks.';
        } catch (e) { plStatus.textContent = String(e.message || e); }
        finally { update.disabled = false; }
      });
      pl.appendChild(update);
    }

    const segRow = el('div', 'display: flex; gap: 6px;');
    const segAll = el('button', '', 'Everyone'); segAll.className = 'seg active';
    const segMine = el('button', '', 'Just mine'); segMine.className = 'seg';
    let mineOnly = false;
    const defaultTitle = () => `${state.fest().name} — ${mineOnly ? ctx.meName : 'the crew'}`;
    segRow.append(segAll, segMine);
    pl.appendChild(segRow);

    // Pick the name before it exists — a playlist you named is one you keep.
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.maxLength = 100;
    nameInput.value = defaultTitle();
    nameInput.setAttribute('aria-label', 'Playlist name');
    nameInput.style.cssText = 'width: 100%; box-sizing: border-box; background: rgba(255,255,255,.05); border: 1px solid var(--border-card); border-radius: 9px; padding: 8px 10px; color: #fff; font-size: 12.5px; font-weight: 600; font-family: inherit;';
    let nameDirty = false;
    nameInput.addEventListener('input', () => { nameDirty = true; });
    const retitle = () => { if (!nameDirty) nameInput.value = defaultTitle(); };
    segAll.addEventListener('click', () => { mineOnly = false; segAll.classList.add('active'); segMine.classList.remove('active'); retitle(); });
    segMine.addEventListener('click', () => { mineOnly = true; segMine.classList.add('active'); segAll.classList.remove('active'); retitle(); });
    pl.appendChild(nameInput);

    pl.appendChild(el('div', 'color: var(--text-tertiary); font-size: 11px; font-weight: 600;',
      'Top tracks plus your saved songs for every picked artist, musts first. Made in your account — Everyone playlists are collaborative, so crew-mates who connect add their saves automatically.'));
    const make = el('button', 'font-size: 12px; padding: 9px 16px; align-self: flex-start;', existing ? 'Make a new one' : 'Make playlist');
    make.className = 'btn-tonal';
    make.addEventListener('click', async () => {
      try {
        make.disabled = true;
        const names = spotify.playlistArtistsFromPicks(ctx.picks, { me: mineOnly ? ctx.meName : null, skip: cancelledNames(state.fest()) });
        if (!names.length) {
          // Picks that are all on cancelled acts are still picks — say so,
          // rather than "you haven't picked anything".
          const onlyOff = spotify.playlistArtistsFromPicks(ctx.picks, { me: mineOnly ? ctx.meName : null }).length > 0;
          plStatus.textContent = onlyOff
            ? `${mineOnly ? 'Your picks' : 'The picks'} on this fest are all cancelled acts — nothing to play yet.`
            : mineOnly
              ? 'You haven’t picked any artists on this fest yet — tap some cards first.'
              : 'Nobody has picked artists on this fest yet — tap some cards first.';
          return;
        }
        const title = nameInput.value.trim() || defaultTitle();
        const made = await spotify.playlistFromPicks({
          title, artistNames: names, collaborative: !mineOnly,
          onProgress: (p) => { plStatus.textContent = `Finding tracks ${p.i}/${p.of} — ${p.name}`; },
        });
        if (!mineOnly) {
          state.recordSpotifyPlaylist(fid, {
            id: made.id, url: made.url, mode: 'everyone', by: ctx.meName,
            at: new Date().toISOString(), artists: made.found,
          });
          actions.afterBulk();
        }
        // Skips are always reported (audit 5.2) — a flat success over 3
        // missing artists is a quiet lie.
        plStatus.textContent = '';
        const done = el('span', 'color: var(--text-body); font-size: 12px; font-weight: 600;',
          `✓ “${title}” — ${made.trackCount} tracks.${made.misses ? ` ${made.misses} artist${made.misses === 1 ? '' : 's'} had no findable track.` : ''} `);
        const link = document.createElement('a');
        link.href = made.url; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = 'Open in Spotify ↗';
        link.style.cssText = 'color: var(--spotify-stroke); font-weight: 700; text-decoration: none;';
        plStatus.replaceChildren(done, link);
      } catch (e) { plStatus.textContent = String(e.message || e); }
      finally { make.disabled = false; }
    });
    pl.append(make, plStatus);
    col.appendChild(pl);

    const dis = el('button', 'font-size: 12px; padding: 8px 14px; align-self: flex-start;', 'Disconnect');
    dis.className = 'btn-ghost';
    dis.addEventListener('click', () => {
      spotify.disconnect();
      // The copy below promises "only the badges disappear" — but badges
      // live in crewDoc.affinity, a synced, crew-visible field every card
      // reads (app.js ctx.affinity / card-facts.js), and disconnect() only
      // touches this device's localStorage. Clear this person's entry too,
      // the same recorder + persist + scheduleSync trio renameSelf uses, so
      // the badges actually disappear here and for the rest of the crew.
      const mine = state.affinityFor(ctx.meName);
      if (mine) {
        // Deep-merge cannot delete and IGNORES null (deepMerge/jsonb twin:
        // null overlay keeps the base), so "cleared" is written as zeros —
        // object over object merges key by key, and every badge reader shows
        // nothing for songs 0 + followed false. A null here looked cleared
        // locally and came back on the next pull (caught 2026-08-30).
        const zeroed = {};
        for (const artist of Object.keys(mine)) zeroed[artist] = { songs: 0, followed: false };
        state.recordAffinity(ctx.meName, zeroed);
        state.persist();
        sync.scheduleSync();
      }
      rerenderDrill();
    });
    col.append(dis, el('div', 'color: var(--text-tertiary); font-size: 10.5px; font-weight: 600; line-height: 1.55;',
      'Disconnect keeps picks and notes — only the badges disappear.'));
    // The which-app plumbing lives behind Advanced here too — a connected member
    // has even less reason to look at a client ID than an unconnected one.
    const cfg = el('div'); cfg.className = 'settings-card';
    cfg.appendChild(advancedFold(actions, rerenderDrill, msg, { owner: owner.enabled }));
    col.append(cfg, msg);
  }
  host.appendChild(col);
}
