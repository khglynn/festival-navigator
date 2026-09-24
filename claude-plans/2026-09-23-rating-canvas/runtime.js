// The rating canvas runtime, round 4: Kevin's blended chips in the zoom. Everything a card, a grid or a
// zoom looks like comes from the bundled production modules (window.FN); this
// file seeds a throwaway crew in memory, cuts the wall into artboards, puts the
// decided meter on every card, and builds each zoom riff inside the zoom's own
// grown block (so it measures, blooms and slides with it).
(function () {
  'use strict';
  const { state, FESTIVALS, FESTIVAL_INDEX, wall: W, facts: F, model, aura, palette, motion: M, portola, festIndex } = window.FN;

  // ---- the crew (in memory only; the token is fake and never stored) ------------
  const FID = 'portola-2026';
  FESTIVALS[FID] = portola;
  FESTIVAL_INDEX.push(festIndex.find((f) => f.id === FID));
  const ME = 'Ava';
  const CREW7 = ['Ava', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus'];
  const CREW15 = [...CREW7, 'Hal', 'Ivy', 'Jo', 'Kat', 'Lou', 'Max', 'Nia', 'Oli'];
  // The eight extra people exist so the crew-of-fifteen case has real colours;
  // they only ever pick inside that one specimen.
  const PEOPLE = Object.fromEntries(CREW15.map((n, i) => [n, { colorIndex: i }]));
  const SEED = {
    'Swedish House Mafia': { Ben: 4, Ava: 4, Cleo: 2, Dev: 1, Eli: 3 },
    'Four Tet': { Gus: 4, Ben: 3, Cleo: 3, Fay: 1, Dev: 1, Eli: 2, Ava: 2 },
    Parcels: { Ava: 3 },
    horsegiirL: { Cleo: 4, Dev: 2, Eli: 1 },
    Kelela: { Ava: 2, Fay: 1 },
    JT: { Ava: 1 },
    Overmono: { Ava: 4 },
    'Zara Larsson': { Dev: 2 },
    'Tiësto': { Ben: 3, Ava: 1 },
    Despacio: { Fay: 2 },
    'Ben UFO': { Gus: 3, Dev: 2, Eli: 2, Fay: 1, Ava: 3 },
  };
  const FOUR_TET_15 = { Gus: 4, Ben: 3, Cleo: 3, Fay: 1, Dev: 1, Eli: 2, Ava: 2, Hal: 4, Ivy: 2, Jo: 3, Kat: 1, Lou: 4, Max: 2 };
  const ts = (h, m) => new Date(Date.UTC(2026, 8, 22, h, m)).toISOString();
  const note = (author, t, text, n) => [model.makeNoteId(author, t, n), { author, ts: t, text }];
  const NOTES = { artist: {
    'Swedish House Mafia': Object.fromEntries([note('Ben', ts(18, 5), 'Front left, by the sound desk', 'aaaaa1'), note('Cleo', ts(18, 40), 'I will be late from horsegiirL', 'aaaaa2')]),
    Parcels: Object.fromEntries([note('Ava', ts(19, 2), 'Leaving Four Tet early for this?', 'bbbbb1')]),
    'Ben UFO': Object.fromEntries([note('Gus', ts(20, 1), 'Public Works back room', 'ccccc1'), note('Dev', ts(20, 9), 'Doors at 10, he goes on at 12', 'ccccc2')]),
  } };
  const AFFINITY = { Ava: {
    'Four Tet': { songs: 12, followed: true }, Kelela: { songs: 3, followed: false },
    'Ben UFO': { songs: 7, followed: true }, JT: { songs: 3, followed: false },
  } };
  const freshDoc = () => JSON.parse(JSON.stringify({
    v: 4, meta: { name: 'Canvas crew' }, spotify: {}, people: PEOPLE,
    festivals: { [FID]: { selections: SEED, notes: NOTES } }, affinity: AFFINITY,
  }));
  const TOKEN = 'canvasonlynotacrew_0000000000';
  state.activateCrew(TOKEN, freshDoc(), FID);
  let picks = model.picksFor(state.crewDoc, FID);
  const affinity = state.affinityLookup(ME);
  const levelOf = (artist) => ((picks[artist] || {})[ME]) || 0;

  // ---- small helpers ---------------------------------------------------------------
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  let slow = false;
  const canMove = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function anim(el, frames, opts) {
    if (!el || !canMove() || typeof el.animate !== 'function') return null;
    const a = el.animate(frames, opts);
    if (slow) a.playbackRate = 0.25;
    return a;
  }
  const rect = (el) => el.getBoundingClientRect();
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const meOf = (facts) => facts.people.find((p) => p.isYou) || null;
  const ci = (name) => PEOPLE[name].colorIndex;
  function markEl(m) { // exactly the way renderCard draws a crew mark (wall.js who-corner loop)
    const s = mk('span', 'mark' + (m.kind === 'ghost' ? ' ghost' : ''));
    if (m.kind !== 'ghost') {
      s.style.width = m.width + 'px';
      s.style.background = m.fill;
      s.style.border = '1px solid ' + m.stroke;
      s.style.fontSize = m.kind === 'must' ? '7.5px' : '0px';
    }
    s.textContent = m.label;
    return s;
  }

  // ---- THE CARD, DECIDED: the meter, beside Spotify ------------------------------------
  // Unchanged from round 2 (round2/runtime.js mineChip, enc 'loud'): the Spotify
  // pill's pattern, your colour at .5, the white stroke that means you, three
  // bars lit one per tap, the word MUST on the fourth.
  function meterChip(level, colorIndex) {
    const c = mk('span', `mine-chip enc-loud${level === 4 ? ' is-must' : ''}`);
    c.dataset.level = String(level);
    c.style.background = palette.hslOf(colorIndex, 0.5);
    c.setAttribute('aria-hidden', 'true');
    if (level === 4) { c.appendChild(mk('span', 'w', 'MUST')); return c; }
    const bars = mk('span', 'bars');
    for (let i = 1; i <= 3; i++) bars.appendChild(mk('span', 'bar' + (i <= level ? ' on' : '')));
    c.appendChild(bars);
    return c;
  }
  // The crew corner counts only the others; your meter leads the bottom-left.
  function decorate(el, facts) {
    const who = el.querySelector('.corner-who');
    const about = el.querySelector('.corner-about');
    const me = meOf(facts);
    if (who) {
      who.textContent = '';
      aura.whoCorner(facts.people.filter((p) => !p.isYou)).forEach((m, i) => { const s = markEl(m); s.dataset.k = 'm' + i; who.appendChild(s); });
    }
    if (about) for (const c of about.children) c.dataset.k = c.classList.contains('chip-notes') ? 'notes' : 'spot';
    if (!me || !about) return;
    const chip = meterChip(me.level, me.colorIndex);
    chip.dataset.k = 'mine';
    about.prepend(chip);
  }
  window.__fnCardHook = (el, facts, ctx) => { if (ctx && ctx.meter) decorate(el, facts); };

  function snapOf(el) {
    const out = new Map();
    for (const n of el.querySelectorAll('.corner-about > [data-k], .corner-who > [data-k]')) out.set(n.dataset.k, rect(n));
    return out;
  }
  // Round 2's motion for the meter: neighbours make room, the chip grows in or
  // re-sizes from its edge, a newly lit bar rises, MUST arrives as a word.
  function animateCard(fresh, from, to, snap) {
    const R = M.REFRESH_MS;
    for (const n of fresh.querySelectorAll('.corner-about > [data-k], .corner-who > [data-k]')) {
      if (n.dataset.k === 'mine') continue;
      const was = snap.get(n.dataset.k);
      if (!was) continue;
      const dx = was.left - rect(n).left;
      if (Math.abs(dx) > 0.5) anim(n, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: R, easing: M.EASE_ARRIVE });
    }
    const chip = fresh.querySelector('.mine-chip');
    if (!chip) return;
    chip.style.transformOrigin = '0% 50%';
    const was = snap.get('mine');
    if (!was) { anim(chip, [{ transform: 'scale(.35)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'none', opacity: 1 }], { duration: M.GROW_MS + 60, easing: M.EASE_ARRIVE }); return; }
    const w = rect(chip).width;
    if (Math.abs(was.width - w) > 0.5) anim(chip, [{ transform: `scaleX(${was.width / w})` }, { transform: 'none' }], { duration: R, easing: M.EASE_ARRIVE });
    const up = to > from;
    if (to === 4 || from === 4) {
      anim(chip.firstElementChild, [{ transform: `translateY(${up ? '5px' : '-5px'})`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: M.GROW_MS, delay: 60, easing: M.EASE_ARRIVE, fill: 'both' });
      return;
    }
    const b = chip.querySelectorAll('.bar')[Math.max(from, to) - 1];
    if (b) { b.style.transformOrigin = '50% 100%'; anim(b, up ? [{ transform: 'scaleY(0)' }, { transform: 'none' }] : [{ transform: 'scaleY(1.25)' }, { transform: 'none' }], { duration: R, easing: M.EASE_ARRIVE }); }
  }

  // ---- the meter glyph, small, for the zoom's riffs ------------------------------------
  function miniMeter(level, cls = 'pm') {
    const m = mk('span', cls);
    for (let i = 1; i <= 3; i++) m.appendChild(mk('span', i <= level ? 'on' : ''));
    m.setAttribute('aria-hidden', 'true');
    return m;
  }
  const LABEL = ['not picked', 'picked', 'picked ×2', 'picked ×3', 'must'];
  const byLoud = (a, b) => (b.level - a.level) || ((b.isYou ? 1 : 0) - (a.isYou ? 1 : 0));

  // Everyone in the crew, with their level for this set (0 = not picked).
  function crewLevels(facts) {
    const crew = window.__zoomCrew || CREW7;
    const lv = Object.fromEntries(facts.people.map((p) => [p.name, p.level]));
    return crew.map((name) => ({ name, level: lv[name] || 0, colorIndex: ci(name), isYou: name === ME }));
  }
  // How the grown block knows it is opening (bloom) vs re-rating (refresh).
  const refreshing = (facts) => window.__zoomPrev && window.__zoomPrev.artist === facts.name;
  const opening = (grown) => grown.isConnected && !!grown.closest('#zoom-layer');


  // ---- the zoom: comparison riffs (reused from round 3) + Kevin's blended chips -------------
  const RIFFS = {};
  // 3 — the room: one bar per person, loudest first, the unpicked as stubs.
  const HEIGHT = [0, 0.3, 0.55, 0.8, 1];
  const lastRoom = new Map();
  RIFFS.room = (grown, facts) => {
    const who = grown.querySelector('.f-who');
    const crew = crewLevels(facts).sort(byLoud);
    const room = mk('div', 'rm' + (crew.length > 9 ? ' big' : ''));
    room.setAttribute('role', 'img');
    const inN = crew.filter((p) => p.level).length;
    const mustN = crew.filter((p) => p.level === 4).length;
    room.setAttribute('aria-label', crew.filter((p) => p.level).map((p) => `${p.isYou ? 'You' : p.name} ${LABEL[p.level]}`).join(', ') || 'Nobody has picked this yet');
    const bars = mk('div', 'rm-bars');
    const all = crew.map((p) => ({ ...p, initial: aura.initialFor(p, crew) }));
    for (const p of all) {
      const ch = mk('div', 'rm-ch' + (p.isYou ? ' you' : '') + (p.level === 4 ? ' must' : '') + (p.level ? '' : ' zero'));
      ch.dataset.name = p.name;
      const well = mk('span', 'rm-well');
      const fill = mk('span', 'rm-fill');
      fill.style.height = `${HEIGHT[p.level] * 100}%`;
      if (p.level) { fill.style.background = palette.hslOf(p.colorIndex, 0.85); fill.style.borderColor = palette.strokeOf(p.colorIndex, p.isYou); }
      well.appendChild(fill);
      ch.append(well, mk('span', 'rm-i', p.isYou ? 'You' : p.initial));
      bars.appendChild(ch);
    }
    const cap = mk('div', 'rm-cap', inN ? `${inN} of ${crew.length}${mustN ? ` · ${mustN} must` : ''}` : `none of ${crew.length} yet`);
    room.append(bars, cap);
    if (who) who.replaceWith(room); else grown.insertBefore(room, grown.querySelector('.f-chips'));
    // Motion: on opening, the room lights up left to right; on a re-rating,
    // your bar slides to its new place and grows or falls to its new height.
    const key = crew.length + facts.name;
    const order = all.map((p) => p.name);
    const prevOrder = lastRoom.get(key);
    lastRoom.set(key, order);
    const prev = window.__zoomPrev;
    const ref = refreshing(facts);
    queueMicrotask(() => {
      if (!opening(grown)) return;
      const chs = [...bars.children];
      if (!ref) {
        chs.forEach((ch, i) => { const f = ch.querySelector('.rm-fill'); f.style.transformOrigin = '50% 100%'; anim(f, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: M.CASCADE_MS + 60, delay: M.CONTENT_FADE_MS + 40 + i * (M.STAGGER_MS - 10), easing: M.EASE_ARRIVE, fill: 'both' }); });
        return;
      }
      const you = chs.find((c) => c.dataset.name === ME);
      if (!you || !prevOrder) return;
      const pitch = chs.length > 1 ? rect(chs[1]).left - rect(chs[0]).left : 0;
      const dx = (prevOrder.indexOf(ME) - order.indexOf(ME)) * pitch;
      if (Math.abs(dx) > 0.5) anim(you, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: M.REFRESH_MS, easing: M.EASE_ARRIVE });
      for (const c of chs) {
        if (c === you) continue;
        const d = (prevOrder.indexOf(c.dataset.name) - order.indexOf(c.dataset.name)) * pitch;
        if (Math.abs(d) > 0.5) anim(c, [{ transform: `translateX(${d}px)` }, { transform: 'none' }], { duration: M.REFRESH_MS, easing: M.EASE_ARRIVE });
      }
      const f = you.querySelector('.rm-fill');
      const hf = HEIGHT[prev.from], ht = HEIGHT[prev.to];
      f.style.transformOrigin = '50% 100%';
      if (ht) anim(f, [{ transform: `scaleY(${hf / ht})` }, { transform: 'none' }], { duration: M.REFRESH_MS + 40, easing: M.EASE_ARRIVE });
    });
  };


  // ---- Kevin's idea: ONE chip per level anyone chose, its fill a blend of the
  // people at that level, the level said by the card meter's own glyph, the
  // people inside, all chips in one wrapping row. Three takes:
  //   aura   — the card's aura mix (aura.auraBackground, as the card does) + initials
  //   grad   — a smooth multi-stop blend + the app's letter avatars, overlapping
  //   stripe — hard stripes, one per person + first names that fold into "+n"
  const youFirst = (a, b) => (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0);
  function fillFor(members, take) {
    const cs = members.map((p) => p.colorIndex);
    if (cs.length === 1) return palette.hslOf(cs[0], 0.6); // one person alone is just their colour
    if (take === 'aura') {
      // The card's own blend: the same radial layers at the same alphas for this
      // level; only the opaque card base under them becomes a soft scrim.
      return aura.auraBackground(members).background.replace(/, #1C1731$/, ', rgba(12, 10, 20, .28)');
    }
    const n = cs.length;
    if (take === 'grad') return `linear-gradient(100deg, ${cs.map((c, i) => `${palette.hslOf(c, 0.7)} ${Math.round((i / (n - 1)) * 100)}%`).join(', ')})`;
    return `linear-gradient(90deg, ${cs.map((c, i) => `${palette.hslOf(c, 0.62)} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`).join(', ')})`;
  }
  function tokens(host, members, take, crew) {
    if (take === 'stripe') {
      const shown = members.slice(0, 2);
      shown.forEach((p, i) => {
        if (i) host.appendChild(mk('span', 'bc-sep', '·'));
        const t = mk('span', 'bc-n' + (p.isYou ? ' you' : ''), p.isYou ? 'You' : p.name);
        if (p.isYou) t.dataset.you = '1';
        host.appendChild(t);
      });
      if (members.length > 2) host.appendChild(mk('span', 'bc-more', `+${members.length - 2}`));
      return;
    }
    for (const p of members) {
      // initialFor compares by identity: hand it this person's own crew entry,
      // or everyone clashes with themselves and shows two letters.
      const letter = aura.initialFor(crew.find((o) => o.name === p.name) || p, crew);
      const t = take === 'grad' ? mk('span', 'bc-av' + (p.isYou ? ' you' : ''), letter) : mk('span', 'bc-i' + (p.isYou ? ' you' : ''), letter);
      if (take === 'grad') { t.style.background = palette.hslOf(p.colorIndex, 0.9); t.style.borderColor = palette.strokeOf(p.colorIndex, p.isYou); }
      if (p.isYou) t.dataset.you = '1';
      host.appendChild(t);
    }
  }
  function chipsRiff(take) {
    return (grown, facts) => {
      const who = grown.querySelector('.f-who');
      if (!who) return;
      const crew = crewLevels(facts);
      const snap = window.__bcSnap || null;
      const row = mk('div', `f-who bc-row bc-${take}`);
      for (const L of [4, 3, 2, 1]) {
        const members = facts.people.filter((p) => p.level === L).sort(youFirst);
        if (!members.length) continue;
        const chip = mk('span', 'bc' + (members.some((p) => p.isYou) ? ' has-you' : ''));
        chip.dataset.level = String(L);
        chip.style.background = fillFor(members, take);
        chip.appendChild(L === 4 ? mk('span', 'bc-must', 'MUST') : miniMeter(L));
        const ppl = mk('span', 'bc-ppl');
        tokens(ppl, members, take, crew);
        chip.appendChild(ppl);
        chip.setAttribute('aria-label', `${LABEL[L]}: ${members.map((p) => (p.isYou ? 'you' : p.name)).join(', ')}`);
        row.appendChild(chip);
      }
      who.replaceWith(row);
      const ref = refreshing(facts);
      const prev = window.__zoomPrev;
      queueMicrotask(() => {
        if (!row.isConnected) return;
        if (ref && snap) remix(row, snap, prev);
        else if (opening(grown)) {
          // The bloom: chips arrive from the right, a beat apart — the same
          // entrance the zoom gives its people pills (card-facts.js cascade).
          [...row.children].forEach((c, i) => anim(c, [{ transform: 'translate(14px, 0)', opacity: 0 }, { opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }], { duration: M.CASCADE_MS, delay: M.CONTENT_FADE_MS + 55 + i * (M.STAGGER_MS - 2), easing: M.EASE_ARRIVE, fill: 'both' }));
        }
      });
    };
  }
  // The delight moment: when you re-rate, your token slides out of one chip
  // into the other, the chips slide to their new places, and each blend that
  // changed re-mixes (the old fill thins away over the new). Transforms and
  // opacity only; with reduced motion, nothing moves and the new state stands.
  function snapRow(row) {
    if (!row) return null;
    const chips = new Map();
    for (const c of row.querySelectorAll('.bc')) chips.set(c.dataset.level, { rect: rect(c), bg: c.style.background });
    const you = row.querySelector('[data-you]');
    return { chips, you: you ? rect(you) : null };
  }
  function remix(row, snap, prev) {
    const card = row.closest('.zoom-card') || row.closest('.zoom-slot');
    const R = M.REFRESH_MS;
    const now = new Map();
    for (const c of row.querySelectorAll('.bc')) now.set(c.dataset.level, c);
    // Alone at a level, you don't change chips, your chip turns up: the chip
    // you left and the chip you made are one chip, carried across, with the
    // next bar lighting (or MUST arriving) instead of a dissolve and a regrow.
    const fromK = prev ? String(prev.from) : null, toK = prev ? String(prev.to) : null;
    const carried = prev && prev.from && prev.to && !now.has(fromK) && !snap.chips.has(toK) && now.has(toK) && snap.chips.has(fromK);
    if (carried) snap.chips.set(toK, snap.chips.get(fromK)), snap.chips.delete(fromK);
    for (const [lv, c] of now) {
      const old = snap.chips.get(lv);
      const r = rect(c);
      if (carried && lv === toK) {
        const glyph = c.firstElementChild;
        if (prev.to === 4 || prev.from === 4) anim(glyph, [{ transform: `translateY(${prev.to > prev.from ? '5px' : '-5px'})`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: M.GROW_MS, delay: 60, easing: M.EASE_ARRIVE, fill: 'both' });
        else { const b = glyph.children[Math.max(prev.from, prev.to) - 1]; if (b) { b.style.transformOrigin = '50% 100%'; anim(b, prev.to > prev.from ? [{ transform: 'scaleY(0)' }, { transform: 'none' }] : [{ transform: 'scaleY(1.3)' }, { transform: 'none' }], { duration: R, delay: 40, easing: M.EASE_ARRIVE }); } }
      }
      if (!old) { anim(c, [{ transform: 'scale(.55)', opacity: 0 }, { opacity: 1, offset: 0.45 }, { transform: 'none', opacity: 1 }], { duration: R + 60, delay: 70, easing: M.EASE_ARRIVE, fill: 'both' }); continue; }
      const dx = (old.rect.left + old.rect.width / 2) - (r.left + r.width / 2);
      const dy = (old.rect.top + old.rect.height / 2) - (r.top + r.height / 2);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) anim(c, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: R, easing: M.EASE_ARRIVE });
      if (old.bg !== c.style.background) {
        const layer = mk('span', 'bc-old');
        layer.style.background = old.bg;
        c.prepend(layer);
        const a = anim(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: R + 120, easing: M.EASE_SURFACE, fill: 'forwards' });
        const done = () => layer.remove();
        if (a) { a.onfinish = done; a.oncancel = done; } else done();
      }
    }
    // A chip that emptied dissolves where it was.
    if (card) {
      const cr = rect(card);
      for (const [lv, old] of snap.chips) {
        if (now.has(lv)) continue;
        const g = mk('span', 'bc bc-ghost');
        g.style.cssText = `position: absolute; left: ${old.rect.left - cr.left}px; top: ${old.rect.top - cr.top}px; width: ${old.rect.width}px; height: ${old.rect.height}px; background: ${old.bg}; box-sizing: border-box; z-index: 1;`;
        card.appendChild(g);
        const a = anim(g, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }], { duration: M.OUT_MS + 80, easing: M.EASE_LEAVE, fill: 'forwards' });
        const done = () => g.remove();
        if (a) { a.onfinish = done; a.oncancel = done; } else done();
      }
    }
    // Your token travels from the chip you left to the chip you joined.
    const you = row.querySelector('[data-you]');
    if (you && snap.you) {
      const r = rect(you);
      you.style.position = 'relative';
      you.style.zIndex = '3';
      anim(you, [{ transform: `translate(${snap.you.left - r.left}px, ${snap.you.top - r.top}px)` }, { transform: 'none' }], { duration: R + 100, easing: M.EASE_ARRIVE });
    } else if (you) {
      anim(you, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: R, delay: 90, easing: M.EASE_ARRIVE, fill: 'both' });
    }
  }
  RIFFS.aura = chipsRiff('aura');
  RIFFS.grad = chipsRiff('grad');
  RIFFS.stripe = chipsRiff('stripe');

  window.__zoomDir = null;
  window.__fnGrownHook = (grown, facts) => { const r = RIFFS[window.__zoomDir]; if (r) r(grown, facts); };

  // ---- one level change, everywhere it shows ------------------------------------------
  const frames = [];
  const statics = [];
  function setLevel(artist, next) {
    const from = levelOf(artist);
    if (next === from) return;
    state.recordSelection(artist, ME, next);
    const sels = state.crewDoc.festivals[FID].selections;
    (sels[artist] = sels[artist] || {})[ME] = next; // app.js applyLocalPick, the mirror picksFor reads
    picks = model.picksFor(state.crewDoc, FID);
    window.__zoomPrev = { artist, from, to: next };
    const zoomed = F.zoomedCard();
    // The chips' re-mix needs to know where everything was: measure the live
    // zoom's row before production rebuilds it.
    window.__bcSnap = snapRow(document.querySelector('#zoom-layer .zoom-slot.shown .bc-row'));
    try {
      for (const f of frames) {
        f.ctx.picks = picks;
        for (const el of [...f.el.querySelectorAll(`.card[data-artist="${CSS.escape(artist)}"]`)]) {
          const snap = snapOf(el);
          const fresh = W.refreshCard(el, artist, f.ctx, { onSwap: el === zoomed ? (n) => F.refreshZoom(n, f.ctx) : null });
          animateCard(fresh, from, next, snap);
        }
      }
      for (const s of statics) if (s.artist === artist && !s.fixed) { window.__bcSnap = snapRow(s.box.querySelector('.bc-row')); s.build(); }
    } finally { window.__zoomPrev = null; window.__bcSnap = null; }
  }
  const tap = (artist) => setLevel(artist, model.nextTapLevel(levelOf(artist)));

  // ---- the zoom layer follows the frame the pointer is in ---------------------------------
  const zl = document.getElementById('zoom-layer');
  function activate(frame) {
    if (F.zoomedCard()) return;
    window.__zoomDir = frame.zdir || null;
    window.__zoomCrew = CREW7;
    zl.className = frame.scope;
  }
  document.addEventListener('pointerdown', (e) => {
    if (F.zoomedCard() && !F.zoomContains(e.target)) F.unzoom({ why: 'press outside the zoom' });
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && F.zoomedCard()) { F.dismissZoom(); e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);

  function makeCtx(frame) {
    const ctx = {
      fid: FID, meName: ME, picks, affinity, lowPower: false, weekend: 'all', filterPeople: [], folded: [],
      soloStage: null, sort: 'billing', query: '', now: new Date('2026-09-23T20:00:00Z'),
      meter: frame.meter !== false,
      onTap: (artist) => tap(artist),
      onOpenNotes: () => {}, onOpenDayNotes: () => {}, onOpenFestNotes: () => {}, onNotesChange: () => {},
      wireZoom: (el, artist, occ) => {
        const o = { onOpenNotes: () => {}, occ };
        F.wireCardZoom(el, artist, ctx, o);
        F.wireCardFocusZoom(el, artist, ctx, o);
      },
      onPeek: (artist, el, occ) => {
        activate(frame);
        F.zoomCard(el, artist, ctx, { onOpenNotes: () => {}, source: 'touch', occ });
      },
    };
    return ctx;
  }

  // ---- artboards: Portola Sunday's grid, cut from a full production render ----------------
  const PHONE_W = 390;
  const DESK_W = 796; // hour rail + four 176px stage columns + a 20px gutter
  const ROW = 24;     // wall.js: 20px rows + 4px gap, 15 minutes each
  function sundayParts(root) {
    const kids = [...root.children];
    const i = kids.findIndex((k) => k.classList.contains('day-rule') && k.dataset.day === 'Sunday');
    const rooms = [];
    for (let j = i + 1; j < kids.length && !kids[j].classList.contains('day-rule'); j++) rooms.push(kids[j]);
    return { fest: rooms.find((r) => r.dataset.room === ':fest'), afters: rooms.find((r) => r.dataset.room === 'Afters') };
  }
  function buildWallFrame(host, { scope, zdir, cap = '', fromRow = 80, rows = 12, scrollCol = null }) {
    const frame = { scope, zdir };
    frame.ctx = makeCtx(frame);
    const vp = mk('div', `vp ${scope}${scope === 'desk' ? ' wide' : ''}`);
    vp.style.setProperty('--vw', scope === 'phone' ? '390px' : '1280px');
    vp.style.width = (scope === 'phone' ? PHONE_W : DESK_W) + 'px';
    frame.el = vp;
    const root = mk('div', 'wall-wrap');
    W.renderWall(root, frame.ctx);
    const { fest } = sundayParts(root);
    // The .tt-block stays whole: production scoped the strip's scroll timeline
    // to it at render time, and a strip outside it freezes at its far end.
    const festRoom = mk('div', 'room');
    festRoom.appendChild(fest.querySelector('.sec-head'));
    const tt = fest.querySelector('.tt-block');
    const wrap = tt.querySelector('.times-wrap:not(.stage-strip)');
    const grid = wrap.querySelector('.times-grid');
    const clip = mk('div', 'cv-clip');
    clip.style.height = `${rows * ROW - 4 + 7}px`;
    wrap.style.marginTop = `${-(fromRow - Number(grid.dataset.startRow)) * ROW}px`;
    tt.insertBefore(clip, wrap);
    clip.appendChild(wrap);
    festRoom.appendChild(tt);
    vp.appendChild(festRoom);
    const board = mk('div', 'cv-board ' + (scope === 'desk' ? 'is-desk' : 'is-phone'));
    const capEl = mk('div', 'cv-board-cap');
    capEl.innerHTML = cap;
    const frameBox = mk('div', 'cv-frame');
    frameBox.appendChild(vp);
    board.append(capEl, frameBox);
    host.appendChild(board);
    for (const t of ['pointerover', 'pointerdown', 'focusin']) vp.addEventListener(t, () => activate(frame), true);
    if (scrollCol != null) {
      const sc = vp.querySelector('.times-wrap:not(.stage-strip) .times-scroll');
      sc.scrollLeft = scrollCol * ((parseFloat(getComputedStyle(vp).getPropertyValue('--col-w')) || 178) + 4);
    }
    frames.push(frame);
    return frame;
  }

  // ---- a zoom at rest, built by the zoom's own builders ------------------------------------
  function staticZoom(host, { artist, zdir, cap, crew = CREW7, fixedPicks = null }) {
    const box = mk('div', 'cv-zspec');
    const capEl = mk('div', 'cv-board-cap');
    capEl.innerHTML = cap;
    const z = mk('div', 'cv-zbox phone');
    z.style.setProperty('--vw', '390px');
    box.append(capEl, z);
    host.appendChild(box);
    const s = {
      artist, fixed: !!fixedPicks, box: z,
      build() {
        const ctx = { ...makeCtx({ scope: 'phone' }), picks: fixedPicks ? { [artist]: fixedPicks } : picks };
        const keep = [window.__zoomDir, window.__zoomCrew];
        window.__zoomDir = zdir; window.__zoomCrew = crew;
        let facts, sc;
        try {
          facts = F.factsFor(artist, ctx, null);
          sc = F.sheetCard(facts, { onOpenNotes: () => {} });
        } finally { [window.__zoomDir, window.__zoomCrew] = keep; }
        const slot = mk('div', 'zoom-slot shown');
        slot.style.minWidth = '216px';
        slot.style.maxWidth = 'min(360px, 100%)';
        const card = mk('div', 'zoom-card');
        const surface = mk('div', 'z-surface' + (facts.animated ? ' animated' : ''));
        surface.style.background = facts.background;
        surface.appendChild(mk('span', 'card-grain'));
        card.append(surface, sc.querySelector('.f-name'), sc.querySelector('.f-grown'));
        if (!fixedPicks) card.addEventListener('click', (e) => { if (e.target.closest('button, a')) return; tap(artist); });
        slot.appendChild(card);
        const old = z.firstElementChild;
        if (old) z.replaceChild(slot, old); else z.appendChild(slot);
      },
    };
    s.build();
    statics.push(s);
  }
  const CASES = [
    { artist: 'Four Tet', cap: '<b>Four Tet</b> · all seven' },
    { artist: 'Swedish House Mafia', cap: '<b>Swedish House Mafia</b> · five of seven' },
    { artist: 'Kelela', cap: '<b>Kelela</b> · two of seven' },
    { artist: 'horsegiirL', cap: '<b>horsegiirL</b> · three, not you' },
    { artist: 'Parcels', cap: '<b>Parcels</b> · only you' },
    { artist: 'Four Tet', cap: '<b>A crew of fifteen</b> · thirteen in', crew: CREW15, fixedPicks: FOUR_TET_15 },
  ];


  // ---- build the page ------------------------------------------------------------------------
  const legend = document.getElementById('cv-crew');
  for (const n of CREW7) {
    const c = mk('span', 'person-chip' + (n === ME ? ' you' : ''), n === ME ? `${n} (you)` : n);
    c.style.background = palette.hslOf(ci(n), 0.5);
    c.style.border = `1px solid ${palette.strokeOf(ci(n), n === ME)}`;
    if (n === ME) c.style.fontWeight = '700';
    legend.appendChild(c);
  }
  function fit() {
    for (const b of document.querySelectorAll('.cv-board.is-desk .cv-frame')) b.style.zoom = String(Math.min(1, b.closest('.cv-boards').clientWidth / (DESK_W + 2)));
    for (const b of document.querySelectorAll('.cv-board.is-phone .cv-frame')) { const avail = b.parentElement.clientWidth; b.style.zoom = avail >= PHONE_W ? '1' : String(avail / (PHONE_W + 2)); }
  }
  const strip = (id) => { const zs = document.querySelector(`#${id} .cv-zooms`); const s = mk('div', 'cv-zstrip'); zs.appendChild(s); return s; };
  // For comparison: today and round 3's room, static only.
  for (const [id, z] of [['c0', null], ['c3', 'room']]) { const s = strip(id); for (const c of CASES) staticZoom(s, { ...c, zdir: z }); }
  // Kevin's chip, three takes: static on every case, and live at both sizes.
  for (const [id, z] of [['t1', 'aura'], ['t2', 'grad'], ['t3', 'stripe']]) {
    const s = strip(id);
    for (const c of CASES) staticZoom(s, { ...c, zdir: z });
    const boards = document.querySelector(`#${id} .cv-boards`);
    buildWallFrame(boards, { scope: 'desk', zdir: z, cap: '<b>Laptop</b> · rest the mouse on a card, then tap it' });
    buildWallFrame(boards, { scope: 'phone', zdir: z, cap: '<b>Phone</b> · hold a card, lift, then tap it', scrollCol: 2 });
  }
  fit();
  window.addEventListener('resize', fit);

  // ---- controls ------------------------------------------------------------------------------
  document.getElementById('cv-slow').addEventListener('change', (e) => {
    slow = e.target.checked;
    for (const a of document.getAnimations()) a.playbackRate = slow ? 0.25 : 1;
  });
  new MutationObserver(() => { if (slow) for (const a of document.getAnimations()) if (a.playbackRate === 1) a.playbackRate = 0.25; })
    .observe(zl, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  document.getElementById('cv-reset').addEventListener('click', () => {
    if (F.zoomedCard()) F.unzoom({ instant: true, why: 'reset' });
    const base = freshDoc().festivals[FID].selections;
    for (const artist of new Set([...Object.keys(picks), ...Object.keys(base)])) {
      const want = (base[artist] || {})[ME] || 0;
      if (levelOf(artist) !== want) setLevel(artist, want);
    }
  });


  // The recommendation.
  document.getElementById('rec-h').textContent = '1 · Aura chips, with the letters';
  document.getElementById('rec-p').innerHTML = [
    '<p><b>Yes, I would now pick Kevin’s chip over the room.</b> It says what the room says (how hot the crew is, and who) in at most four shapes instead of seven or fifteen, it stays one wrapping row at any crew size, and the level reads twice: in the meter glyph and in how bright the chip is, because the fill is the card’s own aura mix at that level’s brightness. The room’s one real advantage, the people who haven’t picked it, is the least useful thing in a zoom about who is going.</p>',
    '<p><b>Take 1 over the others:</b> the aura mix makes each chip a small piece of the card it came from, and the letters stay legible on it at every crew size. The avatars (take 2) are the prettiest at two or three people and the busiest at five; the stripes (take 3) count people honestly but fight the names written on them.</p>',
    '<p><b>How small a change, before Saturday:</b> the chips replace one function, <code>whoPills()</code> in card-facts.js (about 50 lines, plus 25 of CSS), and because it is shared, the notes sheet header gets the same chips for free. Six test files check the old per-person pills and would need small updates. <b>Ship the chips first, with one line more:</b> the zoom’s refresh matches its pieces by a pill’s first word, so it needs to match chips by level instead; then its existing motion slides the chips that stay and grows the ones that arrive. The travelling token and the re-mix are a second step inside the zoom’s refresh code, where small fixes have bitten three times, so they can follow after the weekend.</p>',
  ].join('');


  window.__canvas = { frames, statics, setLevel, levelOf };
})();
