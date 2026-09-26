// In-page helpers for the first-open frames. Draws with the app's OWN modules
// (aura.js for the card's colours, wall.js for the crew marks and your meter,
// palette.js for each person's colour), so a card in a frame is the card the
// wall draws — never a lookalike.
window.FO = (() => {
  const mods = {};
  async function load() {
    if (mods.aura) return mods;
    mods.aura = await import('/js/v3/aura.js');
    mods.wall = await import('/js/v3/wall.js');
    mods.pal = await import('/js/v3/palette.js');
    return mods;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function html(s) { const t = document.createElement('template'); t.innerHTML = s.trim(); return t.content.firstElementChild; }
  function css(href) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    return new Promise((r) => { l.onload = r; l.onerror = r; });
  }
  async function avatar(name, ci, cls = 'avatar') {
    const { pal } = await load();
    const a = el('span', cls, name.charAt(0).toUpperCase());
    a.style.background = pal.hslOf(ci, 0.5);
    a.style.border = '1px solid ' + pal.strokeOf(ci, false);
    return a;
  }
  async function chip(name, ci, extra = '') {
    const { pal } = await load();
    const c = el('button', 'person-chip ' + extra, name);
    c.style.background = pal.hslOf(ci, 0.5);
    c.style.border = '1px solid ' + pal.strokeOf(ci, false);
    return c;
  }
  // people: [{ name, colorIndex, level }]; you: { colorIndex, level } | null
  async function card(name, time, people, { you = null, cls = '' } = {}) {
    const { aura, wall } = await load();
    const all = people.map((p) => ({ ...p, isYou: false }));
    if (you) all.push({ name: 'You', colorIndex: you.colorIndex, level: you.level, isYou: true });
    const c = el('div', 'card timed ' + cls);
    const bg = aura.auraBackground(all);
    c.style.background = bg.background;
    if (bg.animated) { c.classList.add('animated'); c.appendChild(el('span', 'card-grain')); }
    const n = el('span', 'name', name); n.style.color = aura.nameColor(all); c.appendChild(n);
    if (time) { const t = el('span', 'time', time); t.style.color = all.length ? 'rgba(255,255,255,.8)' : 'var(--text-tertiary)'; c.appendChild(t); }
    const marks = aura.whoCorner(all);
    if (marks.length) {
      const w = el('span', 'corner-who');
      for (const m of marks) w.appendChild(wall.crewMark(m));
      c.appendChild(w);
    }
    if (you) {
      const m = aura.meterOf({ colorIndex: you.colorIndex, level: you.level });
      if (m) { const a = el('span', 'corner-about'); a.appendChild(wall.meterChip(m)); c.appendChild(a); }
    }
    return c;
  }
  function hideScreens() {
    for (const s of document.querySelectorAll('body > div[id^="screen-"]')) s.style.display = 'none';
    document.getElementById('toast-root').textContent = '';
  }
  function caption(text) { document.body.appendChild(el('div', 'fo-caption', text)); }
  // The story's scaffold (F3): skip, progress dots, then the caller's content.
  function beat(n) {
    hideScreens();
    const s = el('div', 'entry-screen'); s.id = 'fo-screen';
    const col = el('div', 'fo-col'); col.style.gap = '18px';
    const dots = el('div', 'fo-dots');
    for (let i = 1; i <= 3; i++) dots.appendChild(el('span', i === n ? 'on' : ''));
    col.append(dots);
    s.appendChild(col); document.body.prepend(s);
    return col;
  }
  function skipLink() {
    const k = el('button', 'fo-link', 'Skip to the wall');
    k.style.cssText += 'align-self: center; color: var(--text-tertiary); text-decoration: none;';
    return k;
  }
  return { load, el, html, css, avatar, chip, card, hideScreens, caption, beat, skipLink };
})();
