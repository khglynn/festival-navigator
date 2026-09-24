// The city-seasons canvas runtime (2026-09-24). Everything a card, a stack, a
// head or a zoom looks like comes from the bundled production modules
// (window.FN); this file registers the Austin season as a festival, seeds a
// throwaway crew in memory, builds whole app screens (header, toolbar, rail or
// dock, wall) inside scrolling frames, and layers each direction on through
// the same kind of hooks the rating canvas used. Forked from
// claude-plans/2026-09-23-rating-canvas/runtime.js.
(function () {
  'use strict';
  const { state, FESTIVALS, FESTIVAL_INDEX, wall: W, facts: F, model, palette, motion: M, events: E, season } = window.FN;

  // ---- the clock: Thursday 24 September 2026, 6:40 PM in Austin ------------------
  // The bar can pretend it is another day (with the season as read on Sep 24),
  // because on Sep 24 tonight is the first night in the file and every door
  // opens on the same room.
  const isoPlus = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  let NOW, TODAY, TOMORROW, WEEK_END;
  function setClock(iso) {
    NOW = new Date(`${iso}T23:40:00Z`); // 6:40 PM in Austin (CDT)
    TODAY = iso;
    TOMORROW = isoPlus(iso, 1);
    WEEK_END = isoPlus(iso, 6);
  }
  setClock('2026-09-24');

  // ---- the season as a festival ------------------------------------------------------
  const FID = season.id;
  // The one seeded cancellation: the file has none, and the brief asks to see one.
  const CANCELLED = { name: 'Stella Lefty', date: '2027-01-31' };
  for (const a of season.artists) {
    if (a.name === CANCELLED.name && a.date === CANCELLED.date) {
      a.cancelled = { on: '2026-09-22', source: null, note: 'Seeded for this canvas: no show in the season file is cancelled.' };
    }
  }
  FESTIVALS[FID] = season;
  FESTIVAL_INDEX.push({ id: FID, name: season.name, year: season.year, status: season.status, dates: season.dates, location: season.location, accent: season.accent });
  document.body.style.setProperty('--fest', season.accent);
  const MONTHS = Object.keys(season.dayMeta); // September … May, in order
  const MONTH_NUM = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
  const monthLong = (m) => (MONTH_NUM[m] < 9 ? `${m} ’27` : m).toUpperCase();

  // ---- the crew and Kevin's taste (in memory only; the token is fake) ----------------
  const ME = 'Kevin';
  const PEOPLE = { Kevin: { colorIndex: 1 }, Ben: { colorIndex: 0 }, Cleo: { colorIndex: 4 }, Dev: { colorIndex: 3 } };
  const SEED = {
    Jungle: { Kevin: 3, Ben: 2 },
    Gorillaz: { Kevin: 4, Ben: 1, Cleo: 2 },
    'Modest Mouse': { Cleo: 3 },
    Bonobo: { Kevin: 2, Dev: 4 },
    'Steve Lacy': { Kevin: 1 },
    'Sylvan Esso': { Cleo: 4 },
    'Bob Moses': { Dev: 2 },
    Bleachers: { Ben: 2 },
    'The Aces': { Cleo: 1 },
  };
  // Picks at other fests: "yours" also means an artist you picked anywhere.
  const PAST = {
    'portola-2026': { 'Four Tet': { Kevin: 4 }, Parcels: { Kevin: 3 }, Fcukers: { Kevin: 2 } },
    'acl-2026': { Bleachers: { Kevin: 2 }, 'Lola Young': { Kevin: 3 } },
  };
  const PAST_LABEL = { 'portola-2026': 'at Portola ’26', 'acl-2026': 'for ACL ’26' };
  // Spotify, seeded from the season's real names (indie, pop, electronic).
  const AFF = {
    Jungle: { songs: 14, followed: true }, Bonobo: { songs: 22, followed: true }, 'Steve Lacy': { songs: 9, followed: false },
    'Sylvan Esso': { songs: 17, followed: true }, 'Bob Moses': { songs: 6, followed: true }, 'Slow Magic': { songs: 4, followed: false },
    'The Aces': { songs: 3, followed: false }, 'Modest Mouse': { songs: 11, followed: false }, Gorillaz: { songs: 8, followed: true },
    SOMBR: { songs: 5, followed: false }, Tyla: { songs: 3, followed: false }, 'Four Tet': { songs: 30, followed: true },
  };
  const freshDoc = () => JSON.parse(JSON.stringify({
    v: 4, meta: { name: 'Canvas crew' }, spotify: {}, people: PEOPLE,
    festivals: { [FID]: { selections: SEED, notes: {} }, ...Object.fromEntries(Object.entries(PAST).map(([fid, s]) => [fid, { selections: s, notes: {} }])) },
    affinity: { [ME]: AFF },
  }));
  const TOKEN = 'canvasonlynotacrew_0000000000';
  state.activateCrew(TOKEN, freshDoc(), FID);
  let picks = model.picksFor(state.crewDoc, FID);
  const affinity = state.affinityLookup(ME);
  const levelOf = (artist) => ((picks[artist] || {})[ME]) || 0;
  const lc = (s) => String(s).toLowerCase();
  function pastPickOf(name) {
    for (const [fid, sels] of Object.entries(PAST)) {
      const hit = Object.entries(sels).find(([n, by]) => lc(n) === lc(name) && by[ME] >= 1);
      if (hit) return { fid, label: PAST_LABEL[fid] };
    }
    return null;
  }
  const isYours = (name) => !!((affinity || {})[lc(name)] || pastPickOf(name));

  // Announce and on-sale times: none of the sources read on 24 Sep carries
  // them (research/ticketing-apis.md), so these few are seeded. MUNA's are real.
  const key = (a) => `${a.name}|${a.date}`;
  const ANNOUNCED = {
    'Sylvan Esso|2027-03-08': '2026-09-22', 'Tyla|2026-12-11': '2026-09-21', 'Bob Moses|2026-12-12': '2026-09-23',
    'Niall Horan|2027-05-14': '2026-09-22', 'Anna Shoemaker|2027-03-05': '2026-09-18', 'The Interrupters|2027-03-22': '2026-09-21',
    'Alan Walker|2027-01-21': '2026-09-19', 'Vansire|2027-01-23': '2026-09-23',
  };
  const ON_SALE = {
    'Sylvan Esso|2027-03-08': { at: '2026-09-25T15:00:00Z', text: 'Fri Sep 25, 10 AM' },
    'Bob Moses|2026-12-12': { at: '2026-10-02T15:00:00Z', text: 'Fri Oct 2, 10 AM' },
    'Tyla|2026-12-11': { at: '2026-10-02T15:00:00Z', text: 'Fri Oct 2, 10 AM' },
  };
  const onSaleOf = (a) => { const o = ON_SALE[key(a)]; return o && new Date(o.at) > NOW ? o : null; };
  const inHours = (o) => { const h = Math.round((new Date(o.at) - NOW) / 3600000); return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`; };

  // ---- small helpers ---------------------------------------------------------------------
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
  const upper = (s) => String(s).toUpperCase();
  const shortDate = (iso) => E.shortDate(iso);
  const wdOf = (iso) => E.weekdayOfIso(iso);

  // ---- a show's facts beyond what the zoom already says ---------------------------------------
  // The zoom's facts carry the name, WHEN ("Thu · Sep 24 · Doors 8 PM") and
  // WHERE. The show they came from is the entry with that name, that room,
  // and that date inside WHEN.
  function entryOfFacts(facts) {
    return season.artists.find((a) => a.name === facts.name && a.venue === facts.where && String(facts.when).includes(shortDate(a.date))) || null;
  }
  // Support acts, from the billing the venue printed. Where the billing leads
  // with the headliner, the rest is who is with them (w/, with, feat., +) or
  // the tour's name; where it does not ("Official 2026 ACL Fest Nights:
  // Bleachers"), the billing is shown as printed.
  function billingOf(a) {
    const b = a.billedAs;
    if (!b) return null;
    if (!lc(b).startsWith(lc(a.name))) return { kind: 'billed', text: b };
    let rest = b.slice(a.name.length)
      .replace(/\s+at\s+the\s+concourse\s+project\b.*$/i, '')
      .replace(/\s*@\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
      .trim();
    const w = rest.match(/^(?:w\/|with\b|feat\.?|ft\.?|featuring\b|\+|,|&)\s*(.+)$/i);
    if (w) return { kind: 'with', text: w[1].replace(/\s*,\s*$/, '') };
    rest = rest.replace(/^[\s:\-–—|]+/, '').trim();
    return rest ? { kind: 'tour', text: rest } : null;
  }
  const HOSTS = [[/ticketmaster|livenation|evyy/, 'Ticketmaster'], [/etix/, 'Etix'], [/eventim/, 'Eventim'], [/seetickets/, 'See Tickets'],
    [/axs\.com/, 'AXS'], [/acltv|acllive/, 'ACL Live'], [/prekindle/, 'Prekindle'], [/eventbrite/, 'Eventbrite'], [/ticketsauce/, 'Ticketsauce'],
    [/brushystreet/, 'Brushy Street'], [/partiful/, 'Partiful'], [/laylo/, 'Laylo'], [/feverup/, 'Fever'], [/goodwolf/, 'Good Wolf'],
    [/schoolofrock/, 'School of Rock'], [/moodycenter/, 'Moody Center'], [/dice\.fm/, 'DICE']];
  // How to go: the venue's own buy link (ground truth), else Do512's, else the
  // Continental Club's door, else the venue's calendar page.
  function buyOf(a) {
    const url = (a.buy && a.buy.url) || (typeof a.tickets === 'string' && /^https:\/\//.test(a.tickets) ? a.tickets : null);
    if (url) {
      let host = '';
      try { host = new URL(url).host; } catch { /* not a url */ }
      if (a.buy && a.buy.ticketer === 'venue') return { kind: 'buy', url, label: a.venue };
      const hit = HOSTS.find(([re]) => re.test(host));
      return { kind: 'buy', url, label: hit ? hit[1] : host.replace(/^www\./, '') };
    }
    if (a.venue === 'Continental Club') return { kind: 'door' };
    if (typeof a.source === 'string' && /^https:\/\//.test(a.source)) return { kind: 'buy', url: a.source, label: a.venue };
    return null;
  }

  // ---- the zoom's new lines (all three directions; never artboard 0) --------------------------
  //   name · [with …] · WHEN · WHERE · [Tickets · Ticketmaster / on sale …] · who · chips · [picked at …]
  function door(text, url, cls) {
    const d = mk(url ? 'a' : 'span', cls, text);
    if (url) { d.href = url; d.target = '_blank'; d.rel = 'noopener'; d.addEventListener('click', (e) => e.stopPropagation()); }
    return d;
  }
  function buyLine(a) {
    if (a.cancelled) return null;
    const buy = buyOf(a);
    const sale = onSaleOf(a);
    if (!buy && !sale) return null;
    const box = mk('div', 'f-buy');
    if (buy && buy.kind === 'door') box.appendChild(mk('span', 'f-door', 'Door only'));
    else if (buy) box.appendChild(door(`Tickets · ${buy.label}`, buy.url, 'f-buy-link'));
    if (sale) box.appendChild(mk('span', 'f-sale', `On sale ${sale.text}`));
    return box;
  }
  const MY_LINES = '.f-bill, .f-buy, .f-past';
  let refreshing = null; // set by setLevel while production rebuilds a zoom
  window.__zoomDir = null;
  window.__fnGrownHook = (grown, facts) => {
    const dir = window.__zoomDir;
    if (!dir || dir === '0') return;
    const a = entryOfFacts(facts);
    if (!a) return;
    const bill = billingOf(a);
    if (bill) grown.insertBefore(mk('div', 'f-bill', bill.kind === 'with' ? `with ${bill.text}` : bill.text), grown.firstChild);
    const buy = buyLine(a);
    const where = grown.querySelector('.f-where');
    if (buy) grown.insertBefore(buy, where ? where.nextSibling : grown.querySelector('.f-who, .f-chips'));
    const past = pastPickOf(a.name);
    if (past) grown.appendChild(mk('div', 'f-past', `You picked them ${past.label}`));
    const snap = refreshing && refreshing.artist === facts.name ? refreshing.lines : null;
    queueMicrotask(() => {
      if (!grown.isConnected || !grown.closest('#zoom-layer')) return;
      if (snap) {
        // A pick while zoomed: production slid its own lines; these slide too.
        for (const el of grown.querySelectorAll(MY_LINES)) {
          const was = snap.get(el.className);
          if (!was) continue;
          const now = rect(el);
          const dy = was.top - now.top;
          if (Math.abs(dy) > 0.5) anim(el, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: M.REFRESH_MS, easing: M.EASE_ARRIVE });
        }
        return;
      }
      // The bloom: in the zoom's own cascade, a beat apart, from their corners.
      const arrive = (el, x, y, delay) => anim(el, [{ transform: `translate(${x}px, ${y}px)`, opacity: 0 }, { opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }],
        { duration: M.CASCADE_MS, delay, easing: M.EASE_ARRIVE, fill: 'both' });
      const b = grown.querySelector('.f-bill'); if (b) arrive(b, 0, 6, M.CONTENT_FADE_MS + 20);
      const t = grown.querySelector('.f-buy'); if (t) arrive(t, 0, 6, M.CONTENT_FADE_MS + 50);
      const p = grown.querySelector('.f-past'); if (p) arrive(p, -14, 0, M.CONTENT_FADE_MS + 85);
    });
  };

  // ---- the card: NEW for a week (direction A only) --------------------------------------------
  window.__fnCardHook = (el, facts, ctx, opts) => {
    if (!ctx || ctx.dir !== 'A' || facts.cancelled) return;
    const occ = opts && opts.occ;
    const on = occ && occ.date ? ANNOUNCED[`${facts.name}|${occ.date}`] : null;
    if (!on || isoPlus(on, 7) <= TODAY) return;
    el.classList.add('is-new');
    el.insertBefore(mk('span', 'new-label', 'NEW'), el.firstChild);
    el.setAttribute('aria-label', `${el.getAttribute('aria-label')}, announced this week`);
  };

  // ---- one pick, everywhere it shows ---------------------------------------------------------
  const frames = [];
  const statics = [];
  function setLevel(artist, next) {
    const from = levelOf(artist);
    if (next === from) return;
    state.recordSelection(artist, ME, next);
    const sels = state.crewDoc.festivals[FID].selections;
    (sels[artist] = sels[artist] || {})[ME] = next; // app.js applyLocalPick, the mirror picksFor reads
    picks = model.picksFor(state.crewDoc, FID);
    const zoomed = F.zoomedCard();
    const lines = new Map();
    for (const el of document.querySelectorAll(`#zoom-layer ${MY_LINES.split(', ').join(', #zoom-layer ')}`)) lines.set(el.className, rect(el));
    refreshing = { artist, lines };
    try {
      for (const f of frames) {
        if (!f.ctx) continue;
        f.ctx.picks = picks;
        for (const el of [...f.el.querySelectorAll(`.card[data-artist="${CSS.escape(artist)}"]`)]) {
          W.refreshCard(el, artist, f.ctx, { onSwap: el === zoomed ? (n) => F.refreshZoom(n, f.ctx) : null });
        }
      }
      for (const s of statics) if (s.artist === artist) s.build();
    } finally { refreshing = null; }
  }
  const tap = (artist) => setLevel(artist, model.nextTapLevel(levelOf(artist)));

  // ---- the zoom layer follows the frame the pointer is in --------------------------------------
  const zl = document.getElementById('zoom-layer');
  function activate(frame) {
    if (F.zoomedCard()) return;
    window.__zoomDir = frame.dir;
    zl.className = frame.scope === 'phone' ? 'phone' : 'desk wide';
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
      soloStage: null, sort: 'billing', query: '', now: NOW, dir: frame.dir,
      onTap: (artist) => tap(artist),
      onOpenNotes: () => {}, onOpenDayNotes: () => {}, onOpenFestNotes: null, onNotesChange: () => {},
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

  // ---- the season, as each direction composes it ----------------------------------------------
  // A tab is { key, short, long, kind, dates: Map(iso -> shows) }. The wall
  // is renderExtra's own recipe (a block per tab, a room per date, the
  // production venue stacks under it) with ONE change: the head names the
  // date, `FRI OCT 16`, where today it names the month.
  function byDate(list) {
    const m = new Map();
    for (const a of list) { if (!m.has(a.date)) m.set(a.date, []); m.get(a.date).push(a); }
    return new Map([...m].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  }
  // Which nights each door shows. A month before this one has fallen off, the
  // way a finished fest does. A (and B's months) keep this month's past
  // nights, as a fest keeps its Thursday, and open on tonight's room; C shows
  // only what is still ahead, and YOURS only what you can still go to.
  const monthIdx = (m) => MONTHS.indexOf(m);
  const monthOfIso = (iso) => Object.keys(MONTH_NUM).find((m) => MONTH_NUM[m] === Number(iso.slice(5, 7)));
  function tabsFor(frame) {
    const hidden = frame.hidden || new Set();
    const shown = season.artists.filter((a) => !hidden.has(a.venue));
    const ahead = shown.filter((a) => a.date >= TODAY);
    const cur = monthIdx(monthOfIso(TODAY));
    const tabs = [];
    if (frame.dir === 'B' && frame.yoursOn !== false) {
      const mine = ahead.filter((a) => isYours(a.name));
      if (mine.length) tabs.push({ key: 'yours', short: 'YOURS', long: 'YOURS', kind: 'yours', dates: byDate(mine), list: mine, count: mine.length });
    }
    let weekDates = null;
    if (frame.dir === 'C' && frame.weekOn !== false) {
      const wk = ahead.filter((a) => a.date <= WEEK_END);
      if (wk.length) {
        weekDates = new Set(wk.map((a) => a.date));
        tabs.push({ key: 'week', short: 'WEEK', long: 'THIS WEEK', kind: 'week', dates: byDate(wk), count: wk.length });
      }
    }
    const pool = frame.dir === 'C' ? ahead : shown.filter((a) => monthIdx(a.day) >= cur);
    for (const m of MONTHS) {
      let list = pool.filter((a) => a.day === m);
      if (weekDates) list = list.filter((a) => !weekDates.has(a.date));
      if (!list.length) continue;
      tabs.push({ key: m, short: upper(m.slice(0, 3)), long: monthLong(m), kind: 'month', month: m, dates: byDate(list), count: list.length });
    }
    return tabs;
  }
  function nightHead(iso) {
    const h = mk('button', 'room-head');
    h.type = 'button';
    const name = mk('span', 'name');
    name.append(mk('span', 'wd', upper(wdOf(iso) || '')), ' ', mk('span', 'label', upper(shortDate(iso))));
    h.append(name, mk('span', 'sub', iso === TODAY ? 'Tonight' : iso === TOMORROW ? 'Tomorrow' : ''), mk('span', 'line'));
    h.setAttribute('aria-label', `Notes for ${E.shortDateLabel(iso)}`);
    return h;
  }
  // B: the on-sale whisper under a YOURS room — the day whisper's own shape
  // (one soft wash, pinned under the head it belongs to), in brand: it is the
  // app speaking, not a person.
  function onSaleWhisper(a) {
    const sale = onSaleOf(a);
    if (!sale) return null;
    const buy = buyOf(a);
    const w = mk(buy && buy.url ? 'a' : 'div', 'day-whisper sale-whisper');
    if (buy && buy.url) { w.href = buy.url; w.target = '_blank'; w.rel = 'noopener'; }
    w.append(mk('span', 'who', 'On sale'), mk('span', 'text', `${a.name} · ${sale.text}${buy && buy.label ? ` · ${buy.label}` : ''}`), mk('span', 'more', inHours(sale)));
    return w;
  }
  // A thin month ends with one line that says why it is thin.
  function thinLine(tab, dir) {
    const n = tab.count;
    const who = dir === 'B' ? 'When one of yours lands, it shows up in YOURS.' : dir === 'C' ? 'Slack tells you the day before an on-sale for yours.' : 'Slack tells you the day one of yours lands.';
    const p = mk('div', 'thin-month');
    p.append(mk('p', 'lead', `${n} show${n === 1 ? '' : 's'} so far.`), mk('p', 'hint', `Rooms announce two to four months out, so ${tab.month} fills in later. ${who}`));
    return p;
  }
  function renderSeason(root, frame) {
    const ctx = frame.ctx;
    root.textContent = '';
    for (const t of frame.tabs) root.appendChild(tabBlock(t, frame));
    W.positionNowMarks(root, NOW);
    void ctx;
  }
  function tabBlock(t, frame) {
    const block = mk('div', 'day-block');
    block.dataset.day = t.key;
    block.dataset.kind = t.kind;
    for (const [iso, list] of t.dates) {
      const room = mk('div', 'room');
      room.dataset.room = t.key;
      room.dataset.iso = iso;
      room.appendChild(nightHead(iso));
      if (t.kind === 'yours') for (const a of list) { const w = onSaleWhisper(a); if (w) room.appendChild(w); }
      W.venueGroups(room, list, frame.ctx, { day: { iso }, fest: season });
      block.appendChild(room);
    }
    if (t.kind === 'month' && t.count < 12) block.appendChild(thinLine(t, frame.dir));
    if (t.kind === 'yours') {
      const end = mk('div', 'thin-month yours-end');
      end.append(mk('p', 'hint', `That is every Austin date by an artist in your Spotify or your picks, through May. Every show, month by month, below.`));
      block.appendChild(end);
    }
    return block;
  }

  // ---- whole app screens -------------------------------------------------------------------------
  const PHONE_W = 390, PHONE_H = 760, DESK_W = 1280, DESK_H = 780;
  const shellTpl = document.createElement('template');
  shellTpl.innerHTML = window.__APP_SHELL;
  const $in = (root, id) => root.querySelector(`[data-id="${id}"]`);

  function personChips(row) {
    row.textContent = '';
    for (const [name, p] of Object.entries(PEOPLE)) {
      const isMe = name === ME;
      const chip = mk('button', 'person-chip' + (isMe ? ' you' : ''), name);
      chip.style.background = palette.hslOf(p.colorIndex, 0.5);
      chip.style.border = '1px solid ' + palette.strokeOf(p.colorIndex, isMe);
      chip.type = 'button';
      row.appendChild(chip);
    }
    const add = mk('button', 'person-chip add', '+ Add');
    add.type = 'button';
    row.appendChild(add);
  }
  function youAvatar(el) {
    el.textContent = 'K';
    el.style.background = palette.hslOf(PEOPLE[ME].colorIndex, 0.5);
    el.title = ME;
  }

  function buildFrame(host, opts) {
    const frame = { dir: '0', scope: 'phone', cap: '', hidden: new Set(), ...opts };
    const phone = frame.scope === 'phone';
    const board = mk('div', 'cv-board ' + (phone ? 'is-phone' : 'is-desk'));
    if (frame.cap) { const c = mk('div', 'cv-board-cap'); c.innerHTML = frame.cap; board.appendChild(c); }
    const box = mk('div', 'cv-frame');
    const vp = mk('div', `vp app ${phone ? 'phone' : 'desk wide'}`);
    vp.style.setProperty('--vw', `${phone ? PHONE_W : DESK_W}px`);
    vp.style.width = `${phone ? PHONE_W : DESK_W}px`;
    vp.style.height = `${frame.height || (phone ? PHONE_H : DESK_H)}px`;
    const scroller = mk('div', 'vp-scroll');
    const shell = shellTpl.content.cloneNode(true);
    const shellEl = shell.querySelector('.shell');
    const dock = shell.querySelector('.dock');
    scroller.appendChild(shellEl);
    vp.appendChild(scroller);
    if (dock) vp.appendChild(dock);
    box.appendChild(vp);
    board.appendChild(box);
    host.appendChild(board);
    Object.assign(frame, { board, el: vp, scroller, shell: shellEl, dock, root: $in(shellEl, 'wall-root') });
    // The chrome app.js would paint.
    $in(shellEl, 'fest-name').textContent = upper(season.name);
    $in(shellEl, 'fest-year').textContent = season.year;
    const sub = $in(shellEl, 'fest-sub');
    if (frame.dir === '0') sub.replaceChildren(F.festPlaceLine(season));
    else sub.textContent = `15 rooms · Sep 2026 – May 2027`;
    for (const id of ['dock-fest-name', 'rail-fest-name']) { const n = $in(vp, id); if (n) n.textContent = W.festLinkLabel(season); }
    for (const id of ['dock-you', 'rail-you']) { const n = $in(vp, id); if (n) youAvatar(n); }
    personChips($in(shellEl, 'person-chips'));
    $in(shellEl, 'notes-count').textContent = '0';
    const sortHost = $in(shellEl, 'sort-control');
    if (sortHost) sortHost.remove(); // a season has no sort chip in any direction; today's sort is billing
    for (const t of ['pointerover', 'pointerdown', 'focusin']) vp.addEventListener(t, () => activate(frame), true);
    scroller.addEventListener('scroll', () => {
      const z = F.zoomedCard();
      if (z && vp.contains(z)) F.unzoom({ instant: true, why: 'the frame scrolled' });
      spy(frame);
    }, { passive: true });
    for (const id of ['dock-fest-link', 'rail-fest-link']) {
      const link = $in(vp, id);
      if (link) link.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(frame, link); });
    }
    frames.push(frame);
    lazy(frame);
    return frame;
  }

  // Frames render when they come near the screen: a season is 425 cards, and
  // a page of ten frames is four thousand of them.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); const f = frames.find((x) => x.board === e.target); if (f) paint(f); }
  }, { rootMargin: '900px 0px' });
  function lazy(frame) { io.observe(frame.board); }

  function paint(frame) {
    frame.ctx = frame.ctx || makeCtx(frame);
    frame.ctx.picks = picks;
    if (frame.dir === '0') {
      W.renderWall(frame.root, frame.ctx);
      frame.tabs = W.dayNavOf(season, frame.ctx).map((t) => ({ key: t.key, short: t.short, long: t.long }));
    } else {
      frame.tabs = tabsFor(frame);
      renderSeason(frame.root, frame);
    }
    paintTabs(frame);
    frame.painted = true;
    if (frame.menuOpen) { const link = $in(frame.el, frame.scope === 'phone' ? 'dock-fest-link' : 'rail-fest-link'); if (link) openMenu(frame, link, { instant: true }); }
    if (frame.after) frame.after(frame);
    requestAnimationFrame(() => spy(frame));
  }

  // ---- tabs: the dock (phone) and the rail (desktop) -------------------------------------------
  function tabRows(frame) { return [$in(frame.el, 'dock-days'), $in(frame.el, 'rail-days')].filter(Boolean); }
  function makeTab(frame, t, label) {
    const b = mk('button', 'day-tab', label);
    b.type = 'button';
    b.dataset.day = t.key;
    if (t.kind === 'yours' || t.kind === 'week') b.classList.add('tab-' + t.kind);
    b.addEventListener('click', () => jump(frame, t.key));
    return b;
  }
  function paintTabs(frame) {
    const [dock, rail] = [$in(frame.el, 'dock-days'), $in(frame.el, 'rail-days')];
    if (dock) dock.replaceChildren(...frame.tabs.map((t) => makeTab(frame, t, t.short)));
    if (rail) rail.replaceChildren(...frame.tabs.map((t) => makeTab(frame, t, t.long)));
    frame.active = null;
  }
  const offsetOf = (frame) => (frame.scope === 'phone' ? 8 : ($in(frame.el, 'day-rail').offsetHeight || 0) + 6);
  const topIn = (frame, el) => { let y = 0, n = el; while (n && n !== frame.scroller) { y += n.offsetTop; n = n.offsetParent; } return y; };
  function jump(frame, keyName) {
    const block = frame.root.querySelector(`.day-block[data-day="${CSS.escape(keyName)}"]`);
    if (!block) return;
    frame.scroller.scrollTo({ top: Math.max(0, topIn(frame, block) - offsetOf(frame)), behavior: canMove() ? 'smooth' : 'auto' });
  }
  // Production's scrollspy rule (wall.js wireScrollspy), re-hosted on the
  // frame's own scroller: the active tab is the last block whose top you have
  // scrolled past; the row fades its edges while it overflows, and keeps the
  // active tab in view.
  function spy(frame) {
    if (!frame.painted || frame.spyTick) return;
    frame.spyTick = requestAnimationFrame(() => {
      frame.spyTick = 0;
      const blocks = [...frame.root.querySelectorAll('.day-block[data-day]')];
      if (!blocks.length) return;
      const at = frame.scroller.scrollTop + offsetOf(frame) + 32;
      let current = blocks[0];
      for (const b of blocks) { if (topIn(frame, b) <= at) current = b; else break; }
      const day = frame.scroller.scrollTop < 4 ? blocks[0].dataset.day : current.dataset.day;
      for (const row of tabRows(frame)) {
        for (const t of row.children) {
          const on = t.dataset.day === day;
          t.classList.toggle('active', on);
          if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
          if (on && frame.active !== day) {
            const left = t.offsetLeft - row.offsetLeft - (row.clientWidth - t.offsetWidth) / 2;
            row.scrollTo({ left: Math.max(0, left), behavior: frame.active && canMove() ? 'smooth' : 'auto' });
          }
        }
        const over = row.scrollWidth - row.clientWidth > 1;
        row.classList.toggle('overflowing', over);
        row.classList.toggle('more-left', over && row.scrollLeft > 1);
        row.classList.toggle('more-right', over && row.scrollLeft < row.scrollWidth - row.clientWidth - 1);
      }
      frame.active = day;
    });
  }
  function wireRowFades(frame) {
    for (const row of tabRows(frame)) row.addEventListener('scroll', () => {
      const over = row.scrollWidth - row.clientWidth > 1;
      row.classList.toggle('more-left', over && row.scrollLeft > 1);
      row.classList.toggle('more-right', over && row.scrollLeft < row.scrollWidth - row.clientWidth - 1);
    }, { passive: true });
  }

  // ---- a tab that comes and goes (B's YOURS, C's THIS WEEK) ------------------------------------
  // It arrives the way v87's NOW does (feat/now-jump app.js showNowTab): the
  // tab fades in from 6px left with the beat, and the tabs beside it slide
  // over to make room, tab by tab. Its block lands at the top of the wall
  // without moving what you are looking at: the scroll is carried by the
  // block's height, and the block rises in only if it is on screen.
  function replay(frame, flag) {
    if (!frame.painted) paint(frame);
    const sc = frame.scroller;
    const block = () => frame.root.querySelector('.day-block[data-kind="yours"], .day-block[data-kind="week"]');
    // Leave: quick and plain.
    frame[flag] = false;
    const oldTabs = frame.el.querySelectorAll('.tab-yours, .tab-week');
    const leaving = [...oldTabs].map((t) => anim(t, [{ opacity: 1 }, { opacity: 0, transform: 'translateX(-6px)' }], { duration: M.OUT_MS, easing: M.EASE_LEAVE, fill: 'forwards' })).filter(Boolean);
    const gone = () => {
      const was = block();
      const h = was ? was.getBoundingClientRect().height + parseFloat(getComputedStyle(frame.root).rowGap || 0) : 0;
      const before = new Map(tabRows(frame).flatMap((r) => [...r.children].map((t) => [`${r.dataset.id}|${t.dataset.day}`, rect(t).left])));
      frame.tabs = tabsFor(frame);
      if (was) { was.remove(); sc.scrollTop = Math.max(0, sc.scrollTop - h); }
      paintTabs(frame);
      slideTabs(frame, before);
      spy(frame);
      setTimeout(() => arrive(frame, flag), slow ? 1400 : 650);
    };
    if (leaving.length) Promise.all(leaving.map((a) => a.finished.catch(() => {}))).then(gone); else gone();
  }
  function arrive(frame, flag) {
    const sc = frame.scroller;
    frame[flag] = true;
    const before = new Map(tabRows(frame).flatMap((r) => [...r.children].map((t) => [`${r.dataset.id}|${t.dataset.day}`, rect(t).left])));
    frame.tabs = tabsFor(frame);
    const t = frame.tabs[0];
    const block = tabBlock(t, frame);
    const atTop = sc.scrollTop < 4;
    frame.root.insertBefore(block, frame.root.firstChild);
    if (!atTop) sc.scrollTop += block.getBoundingClientRect().height + parseFloat(getComputedStyle(frame.root).rowGap || 0);
    paintTabs(frame);
    slideTabs(frame, before);
    for (const tab of frame.el.querySelectorAll('.tab-yours, .tab-week')) {
      anim(tab, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: M.CASCADE_MS, delay: M.STAGGER_MS, easing: M.EASE_ARRIVE, fill: 'backwards' });
    }
    if (atTop) {
      // The wall below slides down to make room, and the rooms of the new tab
      // rise in a beat apart.
      const h = block.getBoundingClientRect().height;
      for (const n of [...frame.root.children].slice(1, 3)) anim(n, [{ transform: `translateY(${-h}px)` }, { transform: 'none' }], { duration: M.REFRESH_MS + 80, easing: M.EASE_ARRIVE });
      [...block.children].slice(0, 5).forEach((room, i) => anim(room, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: M.CASCADE_MS + 40, delay: 120 + i * (M.STAGGER_MS + 20), easing: M.EASE_ARRIVE, fill: 'backwards' }));
    }
    spy(frame);
  }
  function slideTabs(frame, before) {
    for (const r of tabRows(frame)) for (const t of r.children) {
      const was = before.get(`${r.dataset.id}|${t.dataset.day}`);
      if (was == null) continue;
      const dx = was - rect(t).left;
      if (Math.abs(dx) >= 1) anim(t, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: M.CASCADE_MS, easing: M.EASE_ARRIVE });
    }
  }

  // ---- the show menu: today's (months) and the rooms filter (venues) ---------------------------
  const UNCOVERED = ['Empire Control Room', 'Hole in the Wall', 'Radio/East', 'Cheer Up Charlies', 'Elysium', 'Paramount Theatre'];
  const venueCounts = () => {
    const m = new Map();
    for (const a of season.artists) m.set(a.venue, (m.get(a.venue) || 0) + 1);
    return [...m].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  };
  function menuRow(label, { on = null, count = null, onTap = null, settings = false } = {}) {
    const li = mk('li');
    li.setAttribute('role', 'presentation');
    const row = mk('button');
    row.type = 'button';
    row.setAttribute('role', 'option');
    if (on != null) row.setAttribute('aria-selected', on ? 'true' : 'false');
    if (settings) row.className = 'settings';
    row.append(mk('span', 'check', on ? '✓' : ''), mk('span', 'row-label', label));
    if (count != null) row.appendChild(mk('span', 'count', String(count)));
    if (settings) row.appendChild(mk('span', 'chev', '›'));
    if (onTap) row.addEventListener('click', (e) => { e.stopPropagation(); onTap(row); });
    li.appendChild(row);
    return li;
  }
  function buildMenu(frame) {
    const pop = mk('ul', 'sort-pop' + (frame.dir === '0' ? '' : ' rooms-pop'));
    pop.setAttribute('role', 'listbox');
    const head = mk('li', 'pop-head', 'Show');
    head.setAttribute('role', 'presentation');
    pop.appendChild(head);
    if (frame.dir === '0') {
      // Today: production's rooms (wall.js roomsOf) — for a season, the months.
      for (const r of W.roomsOf(season, frame.ctx)) {
        pop.appendChild(menuRow(r.label, { on: !(frame.ctx.folded || []).includes(r.key), onTap: () => {
          closeMenu(frame);
          const f = new Set(frame.ctx.folded || []);
          if (f.has(r.key)) f.delete(r.key); else f.add(r.key);
          frame.ctx.folded = [...f];
          paint(frame);
        } }));
      }
    } else {
      for (const [venue, n] of venueCounts()) {
        pop.appendChild(menuRow(venue, { on: !frame.hidden.has(venue), count: n, onTap: (row) => toggleVenue(frame, venue, row) }));
      }
      const div = mk('li', 'pop-div');
      div.setAttribute('role', 'presentation');
      pop.appendChild(div);
      const not = mk('li', 'pop-note');
      not.setAttribute('role', 'presentation');
      not.append(mk('span', 'pop-note-k', 'Not read yet'), mk('span', 'pop-note-v', UNCOVERED.join(' · ')));
      pop.appendChild(not);
    }
    const div2 = mk('li', 'pop-div');
    div2.setAttribute('role', 'presentation');
    pop.appendChild(div2);
    pop.appendChild(menuRow('Settings', { settings: true, onTap: () => closeMenu(frame) }));
    pop.addEventListener('click', (e) => e.stopPropagation());
    return pop;
  }
  function openMenu(frame, link, { instant = false } = {}) {
    const wrap = link.parentElement;
    closeMenu(frame, { instant: true });
    const pop = buildMenu(frame);
    wrap.appendChild(pop);
    frame.menu = { pop, link };
    link.setAttribute('aria-expanded', 'true');
    if (!instant) anim(pop, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: M.CASCADE_MS, easing: M.EASE_ARRIVE, fill: 'backwards' });
  }
  function closeMenu(frame, { instant = false } = {}) {
    if (!frame.menu) return;
    const { pop, link } = frame.menu;
    frame.menu = null;
    link.setAttribute('aria-expanded', 'false');
    const a = instant ? null : anim(pop, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(4px)' }], { duration: M.OUT_MS, easing: M.EASE_LEAVE, fill: 'forwards' });
    if (a) a.onfinish = () => pop.remove(); else pop.remove();
  }
  function toggleMenu(frame, link) { if (frame.menu) closeMenu(frame); else openMenu(frame, link); }
  document.addEventListener('click', () => { for (const f of frames) if (f.menu && !f.pinMenu) closeMenu(f); });

  // Untick a room: its stacks leave quick and plain, the wall is re-laid,
  // and every stack that stayed slides from where it was to where it is (a
  // FLIP, transform only). A night whose last room went leaves with it; one
  // coming back rises in with the beat.
  function toggleVenue(frame, venue, row) {
    const hiding = !frame.hidden.has(venue);
    row.setAttribute('aria-selected', hiding ? 'false' : 'true');
    row.querySelector('.check').textContent = hiding ? '' : '✓';
    const idOf = (g) => `${g.closest('.room').dataset.iso}|${g.querySelector('.stage-head .label').textContent}`;
    const before = new Map([...frame.root.querySelectorAll('.venue-group')].map((g) => [idOf(g), rect(g)]));
    const roomsBefore = new Set([...frame.root.querySelectorAll('.room')].map((r) => r.dataset.iso + r.dataset.room));
    const leaving = hiding ? [...frame.root.querySelectorAll('.venue-group')].filter((g) => g.querySelector('.stage-head .label').textContent === venue) : [];
    const relay = () => {
      if (hiding) frame.hidden.add(venue); else frame.hidden.delete(venue);
      const st = frame.scroller.scrollTop;
      frame.tabs = tabsFor(frame);
      renderSeason(frame.root, frame);
      paintTabs(frame);
      frame.scroller.scrollTop = st;
      const view = rect(frame.scroller);
      for (const g of frame.root.querySelectorAll('.venue-group')) {
        const r = rect(g);
        if (r.bottom < view.top - 200 || r.top > view.bottom + 200) continue;
        const was = before.get(idOf(g));
        if (!was) { anim(g, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: M.CASCADE_MS + 60, delay: 80, easing: M.EASE_ARRIVE, fill: 'backwards' }); continue; }
        const dx = was.left - r.left, dy = was.top - r.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) anim(g, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: M.REFRESH_MS + 60, easing: M.EASE_ARRIVE });
      }
      for (const r of frame.root.querySelectorAll('.room')) {
        if (roomsBefore.has(r.dataset.iso + r.dataset.room)) continue;
        const h = r.querySelector('.room-head');
        if (h) anim(h, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: M.CASCADE_MS, delay: 60, easing: M.EASE_ARRIVE, fill: 'backwards' });
      }
      spy(frame);
    };
    const outs = leaving.map((g) => anim(g, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.94)' }], { duration: M.OUT_MS, easing: M.EASE_LEAVE, fill: 'forwards' })).filter(Boolean);
    if (outs.length) Promise.all(outs.map((a) => a.finished.catch(() => {}))).then(relay); else relay();
  }

  // ---- Slack, as each alert would land ------------------------------------------------------------
  // Slack's own message anatomy (dark theme): the app's avatar, its name and
  // the APP tag, the time, the text, a context line, one button. Nothing else
  // of Slack is drawn.
  function rich(text) {
    // *bold* and <url|label>, nothing more.
    const frag = document.createDocumentFragment();
    const re = /\*([^*]+)\*|<([^|>]+)\|([^>]+)>/g;
    let i = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > i) frag.append(text.slice(i, m.index));
      if (m[1]) frag.appendChild(mk('b', null, m[1]));
      else { const a = mk('a', 'sk-link', m[3]); a.href = m[2]; a.target = '_blank'; a.rel = 'noopener'; frag.appendChild(a); }
      i = re.lastIndex;
    }
    if (i < text.length) frag.append(text.slice(i));
    return frag;
  }
  function slack(host, { day, msgs }) {
    const box = mk('div', 'sk');
    if (day) { const d = mk('div', 'sk-day'); d.appendChild(mk('span', null, day)); box.appendChild(d); }
    for (const msg of msgs) {
      if (msg.day) { const d = mk('div', 'sk-day'); d.appendChild(mk('span', null, msg.day)); box.appendChild(d); }
      const row = mk('div', 'sk-msg');
      const av = mk('img', 'sk-av');
      av.src = window.__MARK; av.alt = '';
      const body = mk('div', 'sk-body');
      const meta = mk('div', 'sk-meta');
      meta.append(mk('b', 'sk-name', 'Festival Navigator'), mk('span', 'sk-app', 'APP'), mk('span', 'sk-time', msg.time));
      body.appendChild(meta);
      for (const line of msg.lines) { const p = mk('div', 'sk-text'); p.appendChild(rich(line)); body.appendChild(p); }
      if (msg.card) body.appendChild(skCard(msg.card));
      if (msg.context) { const c = mk('div', 'sk-context'); c.appendChild(rich(msg.context)); body.appendChild(c); }
      const acts = mk('div', 'sk-actions');
      const btn = mk('a', 'sk-btn', 'Open in Festival Navigator');
      btn.href = '#dirs';
      acts.appendChild(btn);
      body.appendChild(acts);
      row.append(av, body);
      box.appendChild(row);
    }
    host.appendChild(box);
    return box;
  }
  // The card's facts as a Slack section: a left bar in the show's colour, the
  // same lines the zoom says, in the same order.
  function skCard({ name, lines }) {
    const c = mk('div', 'sk-card');
    c.appendChild(mk('div', 'sk-card-name', name));
    for (const l of lines) { const p = mk('div', 'sk-card-line'); p.appendChild(rich(l)); c.appendChild(p); }
    return c;
  }
  const MUNA = {
    name: 'MUNA',
    lines: ['with Hemlocke Springs', 'Sat · Sep 19 · Doors 7 PM', 'Moody Amphitheater', 'Tickets · <https://www.ticketmaster.com/event/3A0064A7C59AF73A|Ticketmaster> · presale Tue May 12, 10 AM · on sale Thu May 14, 10 AM'],
  };
  function alerts() {
    slack(document.querySelector('#dir-a .cv-alert'), {
      msgs: [{
        day: 'Friday, May 8th', time: '12:41 PM',
        lines: ['*MUNA* is coming to Austin.'],
        card: MUNA,
        context: 'You follow MUNA · 23 liked songs · announced this morning',
      }],
    });
    slack(document.querySelector('#dir-b .cv-alert'), {
      msgs: [{
        day: 'Sunday, May 10th', time: '10:00 AM',
        lines: ['Presale in 48 hours: *MUNA* at Moody Amphitheater, Sat Sep 19.'],
        card: { name: 'MUNA', lines: ['Presale Tue May 12, 10 AM · on sale Thu May 14, 10 AM', 'Tickets · <https://www.ticketmaster.com/event/3A0064A7C59AF73A|Ticketmaster>'] },
        context: 'You follow MUNA · 23 liked songs',
      }, {
        day: 'Monday, May 11th', time: '9:00 AM',
        lines: ['*Your Austin week:* 1 new for you.', '*MUNA* · Sat Sep 19 · Moody Amphitheater · presale Tue 10 AM'],
        context: 'Every Monday · everything else announced this week is in the app',
      }],
    });
    slack(document.querySelector('#dir-c .cv-alert'), {
      msgs: [{
        day: 'Monday, May 11th', time: '10:00 AM',
        lines: ['Tomorrow at 10 AM, presale for *MUNA* at Moody Amphitheater, Sat Sep 19.'],
        card: { name: 'MUNA', lines: ['Presale Tue May 12, 10 AM · on sale Thu May 14, 10 AM', 'Tickets · <https://www.ticketmaster.com/event/3A0064A7C59AF73A|Ticketmaster>'] },
        context: 'You follow MUNA · 23 liked songs',
      }, {
        day: 'Friday, September 18th', time: '10:00 AM',
        lines: ['Tomorrow: *MUNA* at Moody Amphitheater. Doors 7 PM.'],
        context: 'You and Ben picked it · only if you picked it',
      }],
    });
  }

  // ---- the MUNA timeline, and when each direction would have spoken -------------------------------
  function munaTimeline() {
    const host = document.getElementById('cv-muna');
    const COLS = [['FRI', 'May 8'], ['SAT', '9'], ['SUN', '10'], ['MON', '11'], ['TUE', '12'], ['WED', '13'], ['THU', '14'], ['gap', ''], ['FRI', 'Sep 18'], ['SAT', '19']];
    const ROWS = [
      ['MUNA', 'fact', { 0: 'announced', 4: 'presale', 5: 'presales', 6: 'on sale', 9: 'the show' }],
      ['A · month', 'a', { 0: 'DM, same day' }],
      ['B · yours', 'b', { 2: 'DM', 3: 'digest' }],
      ['C · week', 'c', { 3: 'DM', 8: 'if picked' }],
      ['Kevin, 2026', 'miss', { 9: 'found out after' }],
    ];
    const grid = mk('div', 'mt');
    grid.style.setProperty('--cols', COLS.length);
    grid.appendChild(mk('div', 'mt-k'));
    for (const [wd, d] of COLS) {
      const c = mk('div', 'mt-h' + (wd === 'gap' ? ' gap' : ''));
      if (wd === 'gap') c.textContent = '4 months';
      else c.append(mk('span', 'wd', wd), mk('span', 'd', d));
      grid.appendChild(c);
    }
    for (const [label, kind, at] of ROWS) {
      grid.appendChild(mk('div', 'mt-k ' + kind, label));
      COLS.forEach(([wd], i) => {
        const c = mk('div', 'mt-c' + (wd === 'gap' ? ' gap' : ''));
        if (at[i]) { const dot = mk('span', 'mt-dot ' + kind); c.append(dot, mk('span', 'mt-t', at[i])); }
        grid.appendChild(c);
      });
    }
    const wrap = mk('div', 'mt-wrap');
    wrap.appendChild(grid);
    host.append(mk('div', 'mt-cap', 'MUNA · Moody Amphitheater · 134 days from announcement to show; tickets on sale for 128 of them, never sold out'), wrap);
  }
  function monthStrip() {
    const host = document.getElementById('cv-months');
    const counts = MONTHS.map((m) => [m, season.artists.filter((a) => a.day === m).length]);
    const max = Math.max(...counts.map(([, n]) => n));
    for (const [m, n] of counts) {
      const col = mk('div', 'ms-col');
      const bar = mk('span', 'ms-bar');
      bar.style.height = `${Math.max(2, (n / max) * 64)}px`;
      col.append(mk('span', 'ms-n', String(n)), bar, mk('span', 'ms-m', upper(m.slice(0, 3))));
      host.appendChild(col);
    }
    host.appendChild(mk('p', 'ms-cap', 'Shows announced so far, per month, read 24 Sep. September is only its last week.'));
  }

  // ---- build the page ---------------------------------------------------------------------------
  function fit() {
    for (const b of document.querySelectorAll('.cv-board.is-desk .cv-frame')) {
      const avail = b.closest('.cv-boards').clientWidth;
      b.style.zoom = String(Math.min(1, avail / (DESK_W + 2)));
    }
    for (const b of document.querySelectorAll('.cv-board.is-phone .cv-frame')) {
      const avail = b.parentElement.clientWidth;
      b.style.zoom = avail >= PHONE_W + 2 ? '1' : String(avail / (PHONE_W + 2));
    }
  }

  munaTimeline();
  monthStrip();
  document.getElementById('cv-seeds').textContent = 'Seeded, because no source we read carries them: Kevin’s Spotify (Jungle, Bonobo, Sylvan Esso, Four Tet and eight more), his picks at Portola and ACL, a small crew (Ben, Cleo, Dev), the announce dates behind NEW, the on-sale times, and one cancellation. Everything else is the season file: the shows, rooms, dates, doors, billing and buy links. The canvas clock is Thu Sep 24, 6:40 PM.';

  // Artboard 0: today's code.
  const today = document.getElementById('today-boards');
  buildFrame(today, { dir: '0', scope: 'phone', cap: '<b>Phone</b> · today’s code, the season file fed in' });
  buildFrame(today, { dir: '0', scope: 'desk', cap: '<b>Laptop</b> · tap AUSTIN in the rail for today’s show menu' });

  // The three directions on phones, then on laptops.
  const phoneOf = (id) => document.querySelector(`#${id} .cv-phone-slot`);
  const fa = buildFrame(phoneOf('dir-a'), { dir: 'A', scope: 'phone', cap: '<b>Phone</b> · opens on tonight’s room' });
  const fb = buildFrame(phoneOf('dir-b'), { dir: 'B', scope: 'phone', cap: '<b>Phone</b> · opens on YOURS' });
  const fc = buildFrame(phoneOf('dir-c'), { dir: 'C', scope: 'phone', cap: '<b>Phone</b> · opens on this week' });
  const db = buildFrame(document.querySelector('#desk-b .cv-boards'), { dir: 'B', scope: 'desk' });
  const dc = buildFrame(document.querySelector('#desk-c .cv-boards'), { dir: 'C', scope: 'desk' });
  buildFrame(document.querySelector('#desk-a .cv-boards'), { dir: 'A', scope: 'desk' });
  for (const f of frames) wireRowFades(f);
  document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.replay;
    for (const f of (d === 'B' ? [fb, db] : [fc, dc])) replay(f, d === 'B' ? 'yoursOn' : 'weekOn');
  }));
  void fa;

  // The rooms filter, open.
  const cover = document.getElementById('cover-boards');
  buildFrame(cover, { dir: 'A', scope: 'phone', menuOpen: true, pinMenu: true, cap: '<b>Phone</b> · the fest name opens it; tick and untick' });
  buildFrame(cover, { dir: 'A', scope: 'desk', menuOpen: true, pinMenu: true, cap: '<b>Laptop</b> · the same menu, under the rail' });
  for (const f of frames) if (!f.rowFades) { wireRowFades(f); f.rowFades = true; }

  alerts();
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

  window.__canvas = { frames, statics, setLevel, levelOf, tabsFor, season, isYours, buyOf, billingOf };
})();
