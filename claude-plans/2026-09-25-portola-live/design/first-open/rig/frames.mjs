// First-open design frames (2026-09-25). Boots the REAL app (v89, clean
// worktree) into a base state with a made-up crew, then adds the proposed
// layer with production classes + frames.css. 390x844 @2x. No writes leave
// the page (rig.mjs aborts every non-GET /api and every /fn-i).
//   node frames.mjs            all frames
//   node frames.mjs F2a        one frame
import { startRig, demoDoc, TOKEN, FID, OUT, sleep } from './rig.mjs';

const RIG = '/claude-plans/2026-09-25-portola-live/design/first-open/rig';
const SAT_315PM = '2026-09-26T22:15:00Z'; // Portola Saturday, 3:15 PM in San Francisco
const CREW = [['Kevin', 0], ['Maya', 3], ['Jonah', 6], ['Priya', 9], ['Theo', 12], ['Rosa', 15]];
const ROBYN6 = [['Kevin', 0, 4], ['Maya', 3, 4], ['Jonah', 6, 3], ['Priya', 9, 4], ['Theo', 12, 2], ['Rosa', 15, 3]];
const SHM4 = [['Maya', 3, 3], ['Priya', 9, 4], ['Rosa', 15, 4], ['Jonah', 6, 2]];
const FOURTET3 = [['Kevin', 0, 4], ['Jonah', 6, 4], ['Theo', 12, 3]];
const P = (list) => list.map(([name, colorIndex, level]) => ({ name, colorIndex, level }));

const rig = await startRig();
const O = rig.server.origin;
const only = process.argv[2] || null;

const claim = (name) => ({ fn: ([t, n]) => { try { localStorage.setItem(`fn_me_v3_${t}`, n); localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }])); } catch {} }, arg: [TOKEN, name] });

async function frame(id, { base, doc, init, clock, build, arg, top = false, click = null }) {
  if (only && only !== id) return;
  const { ctx, page, errors } = await rig.phone({ doc, init, clock });
  try {
    if (base === 'join') { await page.goto(`${O}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' }); await page.waitForSelector('#screen-join', { state: 'visible', timeout: 15000 }); }
    if (base === 'wall') { await page.goto(`${O}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' }); await page.waitForSelector('#screen-app .card', { state: 'visible', timeout: 15000 }); }
    if (base === 'landing') { await page.goto(`${O}/`, { waitUntil: 'load' }); await page.waitForSelector('#screen-landing', { state: 'visible', timeout: 15000 }); }
    await sleep(700);
    await page.addStyleTag({ url: `${O}${RIG}/frames.css` });
    await page.addScriptTag({ url: `${O}${RIG}/fo-lib.js` });
    await page.evaluate(() => window.FO.load());
    const isGuest = base === 'wall' && init && init.arg && init.arg[1] === 'Guest';
    // A guest: no name on this phone. The code today has no such boot, so the
    // frame borrows a name that is not in the crew and then takes its traces
    // off: the coach mark, + Add, and the "you" avatar become the join door.
    // Run again after any click, because a repaint puts them back.
    const stripGuest = () => page.evaluate(() => {
      document.getElementById('coach-mark')?.remove();
      document.querySelectorAll('#person-chips .person-chip.add').forEach((e) => e.remove());
      for (const id of ['dock-you', 'rail-you']) {
        const y = document.getElementById(id); y.textContent = '+'; y.classList.add('fo-join-ring');
        y.setAttribute('aria-label', 'Add yourself');
      }
      document.getElementById('toast-root').textContent = '';
    });
    if (isGuest) await stripGuest();
    if (top) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); }
    if (click) {
      await page.click(click); await sleep(500);
      if (isGuest) await stripGuest();
      if (top) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); }
    }
    await page.evaluate(build, arg);
    await page.evaluate(() => document.fonts.ready);
    await sleep(600);
    const file = `${OUT}/frames/${id}.png`;
    await page.screenshot({ path: file });
    console.log('ok', id, errors.length ? errors : '');
  } catch (e) {
    console.log('FAIL', id, String(e).slice(0, 400), errors);
  } finally { await ctx.close(); }
}

// ---------------------------------------------------------------- F1: the door
// One screen before the wall that says what this is with the crew's own data,
// and hands out three doors: look around, tap your name, add yourself.
const door = async ({ crew, cards, empty, caption }) => {
  const { el } = FO;
  FO.hideScreens();
  const s = el('div', 'entry-screen'); s.id = 'fo-screen';
  const col = el('div', 'fo-col');
  const mark = el('div', 'fo-mark'); mark.append('FESTIVAL '); mark.appendChild(el('span', 'pulse-text', 'NAVIGATOR'));
  const eyebrow = el('div', 'micro-label fo-center', 'You’re invited to'); eyebrow.style.letterSpacing = '.14em';
  const head = el('div', 'screen-headline fo-center', 'PORTOLA ’26'); head.style.color = 'rgb(56, 189, 248)'; head.style.marginTop = '-8px';
  const crewRow = el('div', 'fo-crew');
  const cl = el('span', 'avatar-cluster');
  for (const [n, ci] of crew) cl.appendChild(await FO.avatar(n, ci));
  const who = el('span', 'who', 'The Portola Crew ');
  who.appendChild(el('span', 'n', empty ? '· Kevin started it' : `· ${crew.length} friends`));
  crewRow.append(cl, who);
  const prev = el('div', 'fo-preview');
  const cap = el('div', 'cap');
  cap.append(el('span', 'micro-label', empty ? 'Nothing picked yet' : 'Most picked so far'));
  prev.appendChild(cap);
  const row = el('div', 'row');
  for (const [name, time, people] of cards) row.appendChild(await FO.card(name, time, people));
  prev.appendChild(row);
  const lead = el('div', 'fo-lead');
  if (empty) {
    lead.append('Every friend gets a color, and a card lights up with everyone who picks it. ');
    lead.appendChild(el('strong', '', 'Be the first.'));
  } else {
    lead.append('Every friend has a color — ');
    lead.appendChild(el('strong', '', 'the more color on a card, the more of us want to go.'));
    lead.append(' Look around first; add yourself when you want to pick.');
  }
  const hero = el('a', 'hero'); hero.style.cssText = 'height: 48px; text-decoration: none; display: block;';
  hero.append(el('span', 'hero-bg'), el('span', 'hero-grain'));
  const hl = el('span', 'hero-label', empty ? 'ADD YOURSELF →' : 'LOOK AROUND →'); hl.style.fontSize = '16px'; hero.appendChild(hl);
  col.append(mark, eyebrow, head, crewRow, prev, lead, hero);
  if (empty) {
    const r = el('div'); r.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const i = el('input', 'fo-field'); i.placeholder = 'Your name'; const b = el('button', 'btn-tonal', 'Join'); b.style.cssText = 'font-size: 14px; padding: 12px 24px;';
    r.append(i, b);
    col.insertBefore(r, hero);
    hero.remove();
    const look = el('button', 'btn-ghost', 'Just look around'); look.style.cssText = 'font-size: 12.5px; padding: 10px 16px; align-self: center;';
    col.appendChild(look);
  } else {
    const t = el('div', 'micro-label fo-center', 'Picking too? Tap your name'); t.style.marginTop = '4px';
    const names = el('div', 'fo-names');
    for (const [n, ci] of crew) names.appendChild(await FO.chip(n, ci));
    const add = el('button', 'person-chip add', '+ I’m new'); add.style.cssText = 'font-size: 12.5px; padding: 6px 13px;';
    names.appendChild(add);
    col.append(t, names);
  }
  const how = el('button', 'fo-link', 'How it works'); how.style.alignSelf = 'center';
  col.appendChild(how);
  s.appendChild(col);
  document.body.prepend(s);
  FO.caption(caption);
};

await frame('F1a', {
  base: 'join', build: door,
  arg: { crew: CREW, caption: 'F1a · the door',
    cards: [['Robyn', 'SAT 7:10 PM', P(ROBYN6)], ['Swedish House Mafia', 'SUN 8:45 PM', P(SHM4)], ['Four Tet', 'SUN 9:30 PM', P(FOURTET3)]] },
});
await frame('F1b', {
  base: 'join', doc: { ...demoDoc(), people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } }, build: door,
  arg: { crew: [['Kevin', 0]], empty: true, caption: 'F1b · the door, nothing picked yet',
    cards: [['Robyn', 'SAT 7:10 PM', []], ['Swedish House Mafia', 'SUN 8:45 PM', []], ['Four Tet', 'SUN 9:30 PM', []]] },
});
await frame('F1c', {
  base: 'wall', clock: SAT_315PM, top: true, click: '#person-chips .person-chip:text-is("Kevin")',
  // A guest who opened a link that starts on Portola only (&show=fest): the
  // link seeds the fold once; here the frame seeds it the same way.
  init: { fn: ([t, n]) => {
    try {
      localStorage.setItem(`fn_me_v3_${t}`, n);
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
      localStorage.setItem('fn_fold_v1_portola-2026', JSON.stringify(['Afters', 'Folsom']));
    } catch {}
  }, arg: [TOKEN, 'Guest'] },
  build: async () => {
    const { showActionToast } = await import('/js/v3/wall.js');
    showActionToast(document.getElementById('toast-root'), 'Opened on Portola.', 'Show all', () => {}, 60000);
    FO.caption('F1c · guest, Kevin highlighted, link opened on Portola');
  },
});

// ------------------------------------------------------ F2: straight onto the wall
const welcomeCard = async ({ crew, line, sub, caption }) => {
  const { el } = FO;
  const wrap = el('div', 'bring-offer fo-welcome');
  const card = el('div', 'bring-card');
  const row = el('div', 'crewrow');
  const cl = el('span', 'avatar-cluster');
  for (const [n, ci] of crew) cl.appendChild(await FO.avatar(n, ci));
  row.append(cl, el('span', 'micro-label', 'The Portola Crew'));
  const txt = el('div');
  txt.append(el('div', 'bring-line', line), el('div', 'bring-sub', sub));
  const act = el('div', 'bring-actions');
  act.append(el('button', 'btn-tonal', 'Got it'), el('button', 'btn-ghost', 'How it works'));
  card.append(row, txt, act);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
  FO.caption(caption);
};

await frame('F2a', {
  base: 'wall', init: claim('Guest'), clock: SAT_315PM, build: welcomeCard,
  arg: { crew: CREW, caption: 'F2a · wall first, welcome card',
    line: 'This is the crew’s plan for Portola.',
    sub: 'Every friend has a color — the more color on a card, the more of us want to go. Tap any artist to add yourself.' },
});

// The "More": How it works, short, as a sheet over the wall.
await frame('F2b', {
  base: 'wall', init: claim('Guest'), clock: SAT_315PM,
  build: async () => {
    const { el } = FO;
    const { aura, wall } = await FO.load();
    const { sheetChrome } = await import('/js/v3/notes.js');
    const back = el('div', 'sheet-backdrop'); back.id = 'sheet-backdrop';
    const sheet = el('div', 'sheet'); sheet.style.maxHeight = '80vh';
    sheetChrome(sheet, 'HOW IT WORKS');
    const how = el('div', 'fo-how');
    const row = (demo, strong, rest) => {
      const r = el('div', 'r'); const d = el('div', 'demo'); demo(d);
      const t = el('span', 't'); t.appendChild(el('strong', '', strong)); if (rest) t.append(' ' + rest);
      r.append(d, t); how.appendChild(r);
    };
    const crew = [[3, 4], [9, 4], [15, 3], [6, 2], [12, 3], [0, 4]];
    row((d) => {
      for (const n of [1, 3, 6]) {
        const sw = el('span', 'swatch');
        sw.style.background = aura.auraBackground(crew.slice(0, n).map(([ci, level], i) => ({ name: 'p' + i, colorIndex: ci, level }))).background;
        d.appendChild(sw);
      }
    }, 'More color, more of us.', 'Every friend has a color; a card glows with everyone who picked it.');
    row((d) => { for (const lv of [1, 3, 4]) d.appendChild(wall.meterChip(aura.meterOf({ colorIndex: 18, level: lv }))); },
      'Tap an artist to add yours.', 'Each tap is brighter — 4 taps = must.');
    const chipsRow = el('div', 'r'); const cd = el('div', 'demo');
    const k = await FO.chip('Kevin', 0, 'selected'); k.style.fontSize = '9px'; k.style.padding = '3px 8px'; k.style.minHeight = '0';
    const m = await FO.chip('Maya', 3, 'faded'); m.style.fontSize = '9px'; m.style.padding = '3px 8px'; m.style.minHeight = '0';
    cd.append(k, m);
    const ct = el('span', 't'); ct.appendChild(el('strong', '', 'Tap a name up top')); ct.append(' to see just their picks.');
    chipsRow.append(cd, ct); how.appendChild(chipsRow);
    row((d) => { const n = el('span', 'chip-notes', '2'); n.style.height = '14px'; d.appendChild(n); },
      'Hold an artist', 'for times, details and notes.');
    row((d) => {
      const l = el('span', 'fest-link'); l.style.setProperty('--fest', 'var(--brand)');
      const n = el('span', 'fest-name', 'PORTOLA ’26'); n.style.fontSize = '11px';
      l.append(n, el('span', 'sync-dot')); d.appendChild(l);
    }, 'Tap the fest name', 'to show or hide parts of the week, like Folsom or the afters.');
    row((d) => { const s = el('span', 'sync-dot'); s.style.background = 'var(--sync-offline)'; d.appendChild(s); },
      'Works with no signal.', 'Picks sync when you’re back.');
    row((d) => { const s = el('span', 'chip-spotify', '23'); s.style.height = '13px'; d.appendChild(s); },
      'Spotify, optional:', 'link it in Settings to see which acts you already play. It asks for your email first.');
    row((d) => { d.appendChild(el('span', '', '⚙')).style.cssText = 'color: var(--text-secondary); font-size: 16px;'; },
      'Settings:', 'add another festival, change your name or color.');
    sheet.appendChild(how);
    sheet.appendChild(el('div', 'fo-whisper', 'No accounts. The link is the key — keep it in the crew.'));
    document.body.append(back, sheet);
    FO.caption('F2b · the “More”');
  },
});

// A guest taps Robyn: the one question, asked only now.
await frame('F2c', {
  base: 'wall', init: claim('Guest'), clock: SAT_315PM,
  build: async ({ crew }) => {
    const { el } = FO;
    const { sheetChrome } = await import('/js/v3/notes.js');
    const back = el('div', 'sheet-backdrop'); back.id = 'sheet-backdrop';
    const sheet = el('div', 'sheet');
    sheetChrome(sheet, 'ADD YOURSELF');
    const sub = el('div', '', 'Robyn becomes your first pick. No account — just a name your crew knows.');
    sub.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55; margin-top: -4px;';
    const t1 = el('div', 'micro-label', 'In the crew? Tap your name');
    const names = el('div', 'fo-names'); names.style.justifyContent = 'flex-start';
    for (const [n, ci] of crew) names.appendChild(await FO.chip(n, ci));
    const t2 = el('div', 'micro-label', 'New here?');
    const r = el('div'); r.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const i = el('input', 'fo-field'); i.placeholder = 'Your name'; i.value = 'Sam';
    const b = el('button', 'btn-tonal', 'Join'); b.style.cssText = 'font-size: 14px; padding: 12px 24px; flex: none;';
    r.append(i, b);
    const look = el('button', 'btn-ghost', 'Just looking'); look.style.cssText = 'font-size: 12.5px; padding: 10px 16px;';
    sheet.append(sub, t1, names, t2, r, look);
    document.body.append(back, sheet);
    FO.caption('F2c · tap as a guest → add yourself');
  },
  arg: { crew: CREW },
});

// The crew nobody has picked in yet (Kevin made it and sent the link at once).
await frame('F2d', {
  base: 'wall', init: claim('Guest'), clock: SAT_315PM, build: welcomeCard,
  doc: { ...demoDoc(), people: { Kevin: { colorIndex: 0 } }, festivals: { [FID]: { selections: {} } } },
  arg: { crew: [['Kevin', 0]], caption: 'F2d · wall first, nothing picked yet',
    line: 'Kevin started this plan for Portola. Nobody’s picked yet.',
    sub: 'Every friend gets a color, and a card lights up with everyone who picks it. Tap any artist to be first.' },
});

// ------------------------------------------------------------ F3: three beats
// A short story before the wall: who, what the colors mean, how to pick.
await frame('F3a', {
  base: 'join',
  build: async (a) => {
    const { el } = FO;
    const col = FO.beat(1);
    const stage = el('div', 'fo-stage'); const g = el('div', 'fo-big-crew');
    for (const [n, ci] of a.crew) { const p = el('div', 'p'); p.append(await FO.avatar(n, ci), el('span', 'nm', n)); g.appendChild(p); }
    stage.appendChild(g);
    col.append(stage, el('div', 'micro-label fo-center', 'Portola \u201926 \u00b7 The Portola Crew'), el('div', 'fo-h', 'SIX FRIENDS, ONE PLAN'),
      el('div', 'fo-lead', 'Kevin, Maya, Jonah and three more are picking Portola sets, afters and Folsom here \u2014 all in one place.'));
    const b = el('button', 'btn-tonal', 'Next'); b.style.cssText = 'font-size: 14px; padding: 13px; width: 100%; margin-top: 6px;';
    col.append(b, FO.skipLink());
    FO.caption('F3a \u00b7 beat 1: who');
  },
  arg: { crew: CREW },
});
await frame('F3b', {
  base: 'join',
  build: async (a) => {
    const { el } = FO;
    const col = FO.beat(2);
    const stage = el('div', 'fo-stage'); const g = el('div', 'fo-grow');
    const steps = [[a.robyn.slice(1, 2), '1 friend'], [a.robyn.slice(0, 3), '3 friends'], [a.robyn, 'all 6']];
    for (const [people, label] of steps) { const w = el('div'); w.append(await FO.card('Robyn', '7:10 PM', people), el('div', 'lab', label)); g.appendChild(w); }
    stage.appendChild(g);
    col.append(stage, el('div', 'fo-h', 'MORE COLOR, MORE OF US'),
      el('div', 'fo-lead', 'Every friend has a color. A card glows with everyone who picked it \u2014 and brighter means keener.'));
    const b = el('button', 'btn-tonal', 'Next'); b.style.cssText = 'font-size: 14px; padding: 13px; width: 100%; margin-top: 6px;';
    col.append(b, FO.skipLink());
    FO.caption('F3b \u00b7 beat 2: the colors');
  },
  arg: { robyn: P(ROBYN6) },
});
await frame('F3c', {
  base: 'join',
  build: async () => {
    const { el } = FO;
    const col = FO.beat(3);
    const stage = el('div', 'fo-stage'); const g = el('div', 'fo-taps');
    const labs = ['1 tap', '2 taps', '3 taps', '4 = must'];
    for (let lv = 1; lv <= 4; lv++) { const w = el('div'); w.append(await FO.card('Four Tet', '9:30 PM', [], { you: { colorIndex: 18, level: lv } }), el('div', 'lab', labs[lv - 1])); g.appendChild(w); }
    stage.appendChild(g);
    col.append(stage, el('div', 'fo-h fo-2l', 'TAP TO PICK.\nHOLD FOR MORE.'),
      el('div', 'fo-lead', 'Tap an artist to add your color \u2014 four taps is a must. Hold one for times, details and the crew\u2019s notes.'));
    const hero = el('a', 'hero'); hero.style.cssText = 'height: 48px; text-decoration: none; display: block; margin-top: 6px;';
    hero.append(el('span', 'hero-bg'), el('span', 'hero-grain'));
    const hl = el('span', 'hero-label', 'LOOK AROUND \u2192'); hl.style.fontSize = '16px'; hero.appendChild(hl);
    const mine = el('button', 'fo-link', 'I\u2019m in the crew \u2014 pick my name'); mine.style.alignSelf = 'center';
    col.append(hero, mine);
    FO.caption('F3c \u00b7 beat 3: how to pick');
  },
});

// --------------------------------------------------------- shared: the share sheet
await frame('S1', {
  base: 'wall', init: claim('Kevin'), clock: SAT_315PM,
  build: async ({ token }) => {
    const { el } = FO;
    document.getElementById('coach-mark')?.remove();
    const { sheetChrome } = await import('/js/v3/notes.js');
    const back = el('div', 'sheet-backdrop'); back.id = 'sheet-backdrop';
    const sheet = el('div', 'sheet');
    sheetChrome(sheet, 'SEND YOUR CREW THE LINK');
    const sub = el('div', '', 'Opens straight into The Portola Crew. No accounts needed.');
    sub.style.cssText = 'color: var(--text-secondary); font-size: 12.5px; line-height: 1.55; margin-top: -4px;';
    const t = el('div', 'micro-label', 'It opens on');
    const rooms = el('div', 'fo-rooms');
    for (const [label, on] of [['Portola', true], ['Afters', true], ['Folsom', false]]) {
      const b = el('button', 'fo-room'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) b.appendChild(el('span', 'tick', '✓'));
      b.append(label); rooms.appendChild(b);
    }
    const w = el('div', 'fo-whisper', 'They can bring Folsom back from the fest name — this is only where they start.'); w.style.textAlign = 'left';
    const lr = el('div'); lr.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const box = el('div', 'fo-linkbox');
    // Both ends stay readable: where it goes, and the view it opens on. The
    // token in the middle is the part nobody needs to read.
    box.append('fest.kevinhg.com/f/portola-2026 … ');
    box.appendChild(el('span', 'hl', '&show=fest,afters'));
    const copy = el('button', 'btn-tonal', 'Copy'); copy.style.cssText = 'font-size: 12px; padding: 9px 15px; flex: none;';
    lr.append(box, copy);
    const share = el('button', 'btn-tonal', 'Share the link'); share.style.cssText = 'font-size: 13px; padding: 11px; width: 100%;';
    const hr = el('div'); hr.style.cssText = 'height: 1px; background: var(--hairline); margin: 2px 0;';
    const byName = el('button', 'btn-ghost', 'Or add someone by name'); byName.style.cssText = 'font-size: 12px; padding: 10px 14px;';
    sheet.append(sub, t, rooms, w, lr, share, hr, byName);
    document.body.append(back, sheet);
    FO.caption('S1 · share with a starting view');
  },
  arg: { token: TOKEN },
});

// ------------------------------------------------------------ shared: landings
await frame('L1', {
  base: 'landing',
  build: async () => {
    const { el } = FO;
    FO.hideScreens();
    const s = el('div', 'entry-screen'); s.id = 'fo-screen';
    const col = el('div', 'fo-col'); col.style.gap = '16px';
    const brand = el('div', 'brand'); brand.append('FESTIVAL'); brand.appendChild(el('br')); brand.appendChild(el('span', 'pulse-text', 'NAVIGATOR'));
    const lead = el('div', 'fo-lead');
    lead.append('Your crew’s festival plan, on one screen.'); lead.appendChild(el('br'));
    lead.append('Every friend gets a color — the wall lights up with who wants to see what.');
    const t = el('div', 'micro-label', 'Got a link from a friend?'); t.style.marginTop = '8px';
    const r = el('div'); r.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-top: -6px;';
    const i = el('input', 'fo-field'); i.placeholder = 'Paste it here';
    const b = el('button', 'btn-tonal', 'Open'); b.style.cssText = 'font-size: 14px; padding: 12px 24px; flex: none;';
    r.append(i, b);
    const w = el('div', 'fo-whisper', 'Crews are private — their link is the only way in. Ask whoever invited you to send it again.'); w.style.textAlign = 'left'; w.style.marginTop = '-6px';
    const or = el('div', 'micro-label', 'Or start your own'); or.style.marginTop = '8px';
    const hero = el('a', 'hero'); hero.style.cssText = 'height: 48px; text-decoration: none; display: block; margin-top: -6px;';
    hero.append(el('span', 'hero-bg'), el('span', 'hero-grain'));
    const hl = el('span', 'hero-label', 'START A CREW →'); hl.style.fontSize = '16px'; hero.appendChild(hl);
    const q = el('div', 'fo-quiet'); const qt = el('div', 't');
    qt.appendChild(el('strong', '', 'Used this on another phone?')); qt.append(' Open your My link here and all your crews come back.');
    const qb = el('button', 'fo-link', 'Where’s that?'); qb.style.flex = 'none';
    q.append(qt, qb);
    col.append(brand, lead, t, r, w, or, hero, q);
    s.appendChild(col); document.body.prepend(s);
    FO.caption('L1 · cold landing, nothing on this phone');
  },
});
await frame('L2', {
  base: 'landing',
  init: { fn: ([t, d]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
      localStorage.setItem(`fn_crew_doc_v3_${t}`, JSON.stringify(d));
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'FAKEpersonTOKENdesignOnly0000000001', id: 'fakepid01', name: 'Kevin', crews: {} }));
    } catch {}
  }, arg: [TOKEN, demoDoc()] },
  build: async () => {
    const { el } = FO;
    const fests = document.getElementById('landing-fests');
    FO.hideScreens();
    const s = el('div', 'entry-screen'); s.id = 'fo-screen';
    const col = el('div', 'fo-col'); col.style.gap = '12px'; col.style.marginTop = '28px'; col.style.marginBottom = 'auto';
    const mark = el('div', 'fo-mark'); mark.append('FESTIVAL '); mark.appendChild(el('span', 'pulse-text', 'NAVIGATOR')); mark.style.marginBottom = '10px';
    const t = el('div', 'micro-label', 'Your festivals');
    const add = el('button', 'dashed-row', '+ Add a festival');
    const t2 = el('div', 'micro-label', 'Got a new link?'); t2.style.marginTop = '10px';
    const r = el('div'); r.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    const i = el('input', 'fo-field'); i.placeholder = 'Paste it here';
    const b = el('button', 'btn-tonal', 'Open'); b.style.cssText = 'font-size: 14px; padding: 12px 24px; flex: none;';
    r.append(i, b);
    const q = el('div', 'fo-quiet'); q.style.marginTop = '18px';
    q.appendChild(await FO.avatar('Kevin', 0, 'avatar lg'));
    const qt = el('div', 't'); qt.appendChild(el('strong', '', 'Kevin')); qt.append(' · On a new phone? Your My link brings every crew back.');
    const qb = el('button', 'btn-ghost', 'My link'); qb.style.cssText = 'font-size: 12px; padding: 8px 13px; flex: none;';
    q.append(qt, qb);
    col.append(mark, t, fests, add, t2, r, q);
    s.appendChild(col); document.body.prepend(s);
    FO.caption('L2 · landing, a phone that knows you');
  },
});

console.log('blocked writes:', rig.blocked.length, [...new Set(rig.blocked)]);
await rig.close();
