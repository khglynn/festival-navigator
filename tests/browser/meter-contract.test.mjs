// YOUR meter on the card, in a real browser (2026-09-23).
//
// jsdom has no layout, so tests/meter.test.mjs drives the fit with widths it
// makes up. What only a browser can say: that on every card the app draws —
// Portola's grid and its afters stacks, a 30-minute set's 44px cell, a
// lane-split cell a third of a column wide, a 7-of-7 card with notes and a
// followed Spotify pill — the two bottom corners never touch, never wrap and
// never leave the card, at a 390 phone, a 320 phone and a laptop; that the
// meter is drawn on the Spotify pill's own pattern; and that a real tap is a
// small event (the chip grows in, the next bar lights) that Reduce Motion
// turns into the finished card at once. The app is booted for real against
// a made-up crew of seven; /api never leaves this page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FID = 'portola-2026';
const PORTOLA = JSON.parse(fs.readFileSync(path.join(ROOT, `data/festivals/${FID}.json`), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

// A made-up crew of seven. Kevin is you. Levels are chosen to put every
// shape on the wall: you at 1, 2, 3 and must; a card all seven picked with
// notes and a followed Spotify pill; cards only the others picked.
const CREW = { Kevin: 0, Drew: 1, Kat: 2, Nhu: 3, Pegah: 4, Ross: 5, Sam: 6 };
const ALL7 = (you) => ({ Kevin: you, Drew: 4, Kat: 4, Nhu: 3, Pegah: 2, Ross: 1, Sam: 1 });
const SELECTIONS = {
  Robyn: ALL7(4),
  'Dog Blood': { Kevin: 3, Drew: 4, Kat: 1, Nhu: 2, Ross: 1 },
  Soulwax: { Kevin: 2, Drew: 2, Pegah: 4 },
  'Fatboy Slim': { Kevin: 1, Ross: 4, Sam: 1 },
  Tricky: { Drew: 4, Kat: 4, Nhu: 1, Sam: 2 },
  'Melanie C': ALL7(1),
  'Groove Armada': ALL7(4),
  'Chloé Caillet': { Kevin: 3, Drew: 4, Pegah: 1 },
  Parcels: { Kevin: 2 },
  // Portola's cancelled act (off the grid, last in the Saturday room): your
  // meter stays on it, above the scrim, with the crew's marks.
  Skepta: { Kevin: 4, Drew: 4, Nhu: 1 },
  // The cells a made-up Saturday stage adds (laneFest below).
  'Lane A': { Kevin: 4 },
  'Lane B': ALL7(3),
  'Lane C': { Drew: 1 },
  'Duo A': ALL7(1),
  'Duo B': { Kat: 4, Ross: 4 },
  'Short Set': ALL7(4),
  'Fightmaster Remix': { Kevin: 3, Drew: 1 },
  Oh: { Kevin: 2 },
};
const AFFINITY = {
  Robyn: { songs: 41, followed: true }, 'Groove Armada': { songs: 12, followed: true }, 'Dog Blood': { songs: 7 },
  Soulwax: { songs: 0, followed: true }, Parcels: { songs: 23, followed: true }, 'Lane B': { songs: 99, followed: true },
  'Milli Meng': { songs: 4 },
  'Duo A': { songs: 5, followed: true }, 'Short Set': { songs: 41, followed: true },
};
const NOTED = ['Robyn', 'Robyn', 'Groove Armada', 'Dog Blood', 'Lane B', 'Duo A', 'Short Set'];

function doc() {
  const notes = { artist: {} };
  NOTED.forEach((a, i) => {
    const ts = new Date(Date.UTC(2026, 8, 22, 18, i)).toISOString();
    (notes.artist[a] = notes.artist[a] || {})[`Drew.${Date.parse(ts)}.m${i}`] = { author: 'Drew', ts, text: 'see you there' };
  });
  return {
    v: 4, meta: { name: 'Meter', inviteFestId: FID }, spotify: {}, affinity: { Kevin: AFFINITY },
    people: Object.fromEntries(Object.entries(CREW).map(([n, c]) => [n, { colorIndex: c }])),
    festivals: { [FID]: { selections: SELECTIONS, notes } },
  };
}

// Portola with one more Saturday stage holding the smallest cells the grid
// can make: three 45-minute sets side by side (each a third of a column —
// no shipped fest has three lanes; this is the extreme), a 30-minute set a
// whole column wide with a crowd of seven on it (the 44px floor), two
// 30-minute sets sharing a column (ACL's both-weekends view has these), and
// two more, one of whose names runs to a second line.
function laneFest() {
  const f = structuredClone(PORTOLA);
  const sat = f.days.Saturday;
  sat.stages = [...sat.stages, 'Tiny Tent'];
  const sets = [['Lane A', '2:00 PM - 2:45 PM'], ['Lane B', '2:00 PM - 2:45 PM'], ['Lane C', '2:00 PM - 2:45 PM'],
    ['Duo A', '4:00 PM - 4:30 PM'], ['Duo B', '4:00 PM - 4:30 PM'], ['Short Set', '5:00 PM - 5:30 PM'],
    ['Fightmaster Remix', '6:00 PM - 6:30 PM'], ['Oh', '6:00 PM - 6:30 PM']];
  for (const [name, time] of sets) {
    sat.artists.push({ name, stage: 'Tiny Tent', time });
    f.artists.push({ name, day: 'Saturday' });
  }
  return f;
}

async function openWall({ width = 390, height = 844, touch = true, fest = null, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, serviceWorkers: 'block', reducedMotion });
  const TOKEN = 'metercontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Meter' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
  }, [TOKEN, FID]);
  const body = JSON.stringify(doc());
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  // The crew doc reads; a pick's push is left unanswered-as-offline so the
  // local pick stands (this page never writes anywhere).
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  if (fest) await ctx.route(`**/data/festivals/${FID}.json`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fest) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.setFixedTime(new Date('2026-09-23T19:00:00-07:00'));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(250);
  return { ctx, page };
}

// Every card's corners, measured: what is drawn, where, and your meter.
const cornersOn = (page) => page.evaluate(() => {
  const out = [];
  for (const card of document.querySelectorAll('#wall-root .card')) {
    const rc = card.getBoundingClientRect();
    if (!rc.width) continue;
    const cs = getComputedStyle(card);
    const inner = { left: rc.left + parseFloat(cs.borderLeftWidth), right: rc.right - parseFloat(cs.borderRightWidth) };
    const box = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height }; };
    const about = [...card.querySelectorAll(':scope > .corner-about > *')].filter((c) => c.getClientRects().length).map((c) => ({ kind: c.dataset.kind, ...box(c) }));
    const who = [...card.querySelectorAll(':scope > .corner-who > *')].map((m) => ({ text: m.textContent, ghost: m.classList.contains('ghost'), ...box(m) }));
    const meter = card.querySelector(':scope > .corner-about > .chip-meter');
    const spotN = card.querySelector('.chip-spotify .n');
    // The centred text a cell carries low: the start time, a tall set's
    // "until", and every line of the name (clipped to what the name shows).
    const texts = [...card.querySelectorAll(':scope > .time, :scope > .until')].map((t) => {
      const range = document.createRange();
      range.selectNodeContents(t);
      return { shown: getComputedStyle(t).visibility !== 'hidden', ...box(range) };
    });
    const nm = card.querySelector(':scope > .name');
    const nameRange = document.createRange();
    nameRange.selectNodeContents(nm);
    const nameBox = nm.getBoundingClientRect();
    for (const r of nameRange.getClientRects()) {
      if (r.width && r.top < nameBox.bottom - 1) texts.push({ shown: true, name: true, left: r.left, right: r.right, top: r.top, bottom: Math.min(r.bottom, nameBox.bottom) });
    }
    out.push({
      artist: card.dataset.artist, cell: card.classList.contains('cell'), cancelled: card.classList.contains('cancelled'), width: rc.width, height: rc.height, inner,
      fit: Number(card.dataset.fit), about, who, texts,
      level: meter ? Number(meter.dataset.level) : 0,
      meterShown: !!(meter && meter.getClientRects().length),
      lit: meter ? meter.querySelectorAll('.bar.on').length : 0,
      word: meter ? (meter.querySelector('.must') || { textContent: '' }).textContent : '',
      spotCount: spotN && spotN.getClientRects().length ? spotN.textContent : '',
      label: card.getAttribute('aria-label'),
      bottom: rc.bottom,
    });
  }
  return out;
});

// The laws every card keeps, whatever its width: the corners never touch,
// never wrap onto a second line, and never leave the card.
function assertCornersKeep(cards, where) {
  const bad = [];
  for (const c of cards) {
    const all = [...c.about, ...c.who];
    for (const p of all) {
      if (p.left < c.inner.left - 0.5 || p.right > c.inner.right + 0.5) bad.push(`${c.artist}: a piece leaves the card (${where})`);
      if (p.bottom > c.bottom) bad.push(`${c.artist}: a piece below the card (${where})`);
    }
    const oneLine = (pieces) => pieces.every((p) => Math.abs((p.top + p.bottom) / 2 - (pieces[0].top + pieces[0].bottom) / 2) < 1.5);
    if (c.about.length && !oneLine(c.about)) bad.push(`${c.artist}: the about corner wraps (${where})`);
    if (c.who.length && !oneLine(c.who)) bad.push(`${c.artist}: the crew corner wraps (${where})`);
    if (c.about.length && c.who.length) {
      const gap = Math.min(...c.who.map((m) => m.left)) - Math.max(...c.about.map((a) => a.right));
      if (gap < 2) bad.push(`${c.artist}: corners ${gap.toFixed(1)}px apart at ${c.width}px (fit ${c.fit}) (${where})`);
    }
    // A set's start time (or "until") is never under a chip: either the
    // corners clear it, or — only where your meter cannot sit beside it — it
    // steps back. A time the card already crops (a two-line name pushed it
    // past the bottom edge, as it always has) is not the corners' to clear.
    for (const t of c.texts) {
      if (!t.shown || (!t.name && t.bottom > c.bottom + 0.5)) continue;
      for (const p of all) {
        const vertical = p.top < t.bottom - 2 && p.bottom > t.top + 2;
        const horizontal = p.left < t.right + 2 && p.right > t.left - 2;
        if (vertical && horizontal) bad.push(`${c.artist}: a corner sits on its ${t.name ? 'name' : 'time'} at ${c.width}px (fit ${c.fit}) (${where})`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
}

// Your meter is on exactly the cards you picked, at your level; the +n is
// the others the crew corner does not draw.
function assertMeterTells(cards) {
  const others = (artist) => Object.entries(SELECTIONS[artist] || {}).filter(([n, l]) => n !== 'Kevin' && l > 0).length;
  for (const c of cards) {
    const mine = (SELECTIONS[c.artist] || {}).Kevin || 0;
    assert.equal(c.level, mine, `${c.artist}: the meter says your level`);
    if (mine && mine < 4) assert.equal(c.lit, mine, `${c.artist}: ${mine} bar(s) lit`);
    if (mine === 4) assert.equal(c.word, 'MUST');
    // Drawn at the corner's edge — unless the artist's name runs down into a
    // narrow short cell's band, the one place it steps back (GIVE_WAY's last).
    if (mine && c.meterShown) assert.equal(c.about[0].kind, 'meter', `${c.artist}: at the corner's edge`);
    if (mine && !c.meterShown) assert.ok(c.cell && c.texts.some((t) => t.name && t.bottom > c.bottom - 16), `${c.artist}: your meter stepped back only for its name`);
    if (c.fit < 7) {
      const drawn = c.who.filter((m) => !m.ghost).length;
      const ghost = c.who.find((m) => m.ghost);
      assert.equal(drawn + (ghost ? Number(ghost.text.slice(1)) : 0), others(c.artist), `${c.artist}: the crew corner counts everyone else, you never`);
    }
  }
}

test('a 390 phone: every card on Portola’s Saturday keeps its corners apart, and your meter says your level', { skip }, async () => {
  const { ctx, page } = await openWall();
  try {
    const cards = await cornersOn(page);
    assert.ok(cards.length > 100, 'the whole wall rendered');
    assertCornersKeep(cards, '390');
    assertMeterTells(cards);
    // The phone column: 178px, two across.
    const robyn = cards.find((c) => c.artist === 'Robyn');
    assert.equal(Math.round(robyn.width), 178);
    // The 7-of-7 card with notes and a followed Spotify pill runs out of room
    // on a phone, and the Spotify count is the first thing to go: the pill
    // stays, the count lives in the zoom.
    assert.ok(robyn.fit >= 1, `the crowded card gave way (fit ${robyn.fit})`);
    assert.equal(robyn.spotCount, '', 'the count went first');
    assert.deepEqual(robyn.about.map((a) => a.kind), ['meter', 'notes', 'spotify'], 'and the pill, the notes and your meter stayed');
    // A card with room keeps everything.
    const parcels = cards.find((c) => c.artist === 'Parcels');
    assert.equal(parcels.fit, 0);
    assert.equal(parcels.spotCount, '23');
    // The label says your level once, the chip is hidden from a screen reader.
    assert.match(robyn.label, /^Robyn — must, picked by 6 others/);
    // A cancelled act keeps every pick on it, yours included.
    const skepta = cards.find((c) => c.artist === 'Skepta');
    assert.ok(skepta && skepta.cancelled, 'Skepta is on the wall, cancelled');
    assert.ok(skepta.meterShown, 'your meter shows on a cancelled card');
    assert.equal(skepta.word, 'MUST');
    assert.match(skepta.label, /^Skepta \(cancelled\) — must, picked by 2 others/);
  } finally { await ctx.close(); }
});

for (const width of [390, 320]) {
  test(`the smallest cards on a ${width} phone: a 30-minute set’s 44px cell under a crowd, lanes, a name on two lines`, { skip }, async () => {
    const { ctx, page } = await openWall({ width, height: 700, fest: laneFest() });
    try {
      const cards = await cornersOn(page);
      assertCornersKeep(cards, String(width));
      assertMeterTells(cards);
      const cell = (n) => cards.find((c) => c.artist === n);
      // The 44px floor, a whole column wide, all seven on it: the corners fit
      // around its start time, and your MUST and the start time both show.
      const short = cell('Short Set');
      assert.equal(Math.round(short.height), 44, 'a 30-minute set is a 44px cell');
      assert.equal(short.word, 'MUST');
      assert.ok(short.meterShown);
      assert.ok(short.texts.find((t) => !t.name).shown, 'its start time stays');
      assert.ok(short.fit >= 1, 'the crowd gave way around it');
      // A third of a column: your MUST and your bars, beside a crowd that folded.
      assert.ok(cell('Lane A').width < 64, `three lanes: ${cell('Lane A').width}px`);
      assert.ok(cell('Lane A').meterShown && cell('Lane A').word === 'MUST');
      assert.ok(cell('Lane B').meterShown && cell('Lane B').lit === 3);
      assert.ok(cell('Lane B').fit >= 1);
      // Two 30-minute sets sharing a column: your meter stays on both.
      assert.ok(cell('Duo A').meterShown && cell('Oh').meterShown);
      for (const n of ['Lane A', 'Lane B', 'Duo A', 'Short Set', 'Oh']) {
        const c = cell(n);
        assert.ok(c.about[0].bottom <= c.bottom - 2, `${n}: the meter sits inside the card`);
      }
    } finally { await ctx.close(); }
  });
}

test('a laptop: the same laws at 1280, and the meter is drawn on the Spotify pill’s pattern', { skip }, async () => {
  const { ctx, page } = await openWall({ width: 1280, height: 800, touch: false, fest: laneFest() });
  try {
    const cards = await cornersOn(page);
    assertCornersKeep(cards, '1280');
    assertMeterTells(cards);
    const pattern = await page.evaluate(() => {
      const pick = (sel) => {
        const card = [...document.querySelectorAll('#wall-root .card')].find((c) => c.matches(sel) && c.querySelector('.chip-meter') && c.querySelector('.chip-spotify:not([hidden])'));
        const m = card.querySelector('.chip-meter'), s = card.querySelector('.chip-spotify');
        const cm = getComputedStyle(m), sp = getComputedStyle(s);
        const rm = m.getBoundingClientRect(), rs = s.getBoundingClientRect();
        return { h: [rm.height, rs.height], bottom: [rm.bottom, rs.bottom], radius: [cm.borderTopLeftRadius, sp.borderTopLeftRadius], border: [cm.borderTopWidth, sp.borderTopWidth], borderColor: cm.borderTopColor, bg: m.style.background };
      };
      return { card: pick('.card:not(.cell)'), cell: pick('.card.cell') };
    });
    for (const [kind, p] of Object.entries(pattern)) {
      assert.equal(p.h[0], p.h[1], `${kind}: the meter is the Spotify pill's height`);
      assert.equal(p.bottom[0], p.bottom[1], `${kind}: on the same line`);
      assert.equal(p.radius[0], p.radius[1], `${kind}: the same pill radius`);
      assert.equal(p.border[0], p.border[1], `${kind}: the same 1px edge`);
      assert.equal(p.borderColor, 'rgb(255, 255, 255)', `${kind}: the white edge that means you`);
      assert.match(p.bg, /^rgba\(/, `${kind}: your colour at .5, not a token`);
    }
    assert.equal(pattern.card.h[0], 14);
    assert.equal(pattern.cell.h[0], 13);
  } finally { await ctx.close(); }
});

// What a real tap on a phone asks the compositor for, sampled right after it.
const tapAndSample = async (page, artist) => {
  const card = page.locator(`#wall-root .card[data-artist="${artist}"]`).first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 12);
  return page.evaluate((a) => {
    const c = document.querySelector(`#wall-root .card[data-artist="${a}"]`);
    const m = c.querySelector('.chip-meter');
    const running = document.getAnimations().filter((an) => an.effect && an.effect.target && c.contains(an.effect.target) && an.effect.target.closest('.corner-about'));
    return {
      level: m ? Number(m.dataset.level) : 0,
      on: m ? m.querySelectorAll('.bar.on').length : 0,
      moving: running.map((an) => {
        const t = an.effect.target;
        return t.classList.contains('chip-meter') ? 'meter' : t.classList.contains('bar') ? `bar${[...t.parentNode.children].indexOf(t) + 1}` : t.classList.contains('must') ? 'word' : t.dataset.kind || t.className;
      }),
      props: [...new Set(running.flatMap((an) => an.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)))))],
    };
  }, artist);
};

test('a real tap is a small event: the chip grows in, the next bar lights, MUST arrives — transform and opacity only', { skip }, async () => {
  const { ctx, page } = await openWall();
  try {
    // Velvet Trip: nobody has picked it yet. Five taps walk your whole ladder.
    const steps = [];
    for (let i = 0; i < 5; i++) {
      steps.push(await tapAndSample(page, 'Velvet Trip'));
      await sleep(400); // let each change finish before the next tap
    }
    assert.deepEqual(steps.map((s) => s.level), [1, 2, 3, 4, 0]);
    assert.deepEqual(steps[0].moving, ['meter'], 'the chip grows out of the corner');
    assert.deepEqual(steps[1].moving, ['bar2'], 'the second bar lights, and only it');
    assert.deepEqual(steps[2].moving, ['bar3']);
    assert.ok(steps[3].moving.includes('word'), 'the word arrives');
    assert.deepEqual(steps[4].moving, [], 'clearing: nothing of the meter is left to move');
    for (const s of steps) assert.deepEqual(s.props.filter((p) => !['transform', 'opacity'].includes(p)), [], 'compositor-only');
    // With a neighbour: the Spotify pill travels to make room as your chip
    // arrives, and closes the gap when you clear it.
    const arrive = await tapAndSample(page, 'Milli Meng');
    assert.equal(arrive.level, 1);
    assert.deepEqual(arrive.moving.sort(), ['meter', 'spotify']);
    for (let i = 0; i < 3; i++) { await sleep(400); await tapAndSample(page, 'Milli Meng'); }
    await sleep(400);
    const clear = await tapAndSample(page, 'Milli Meng');
    assert.equal(clear.level, 0);
    assert.deepEqual(clear.moving, ['spotify'], 'the pill slides back to the corner\u2019s edge');
  } finally { await ctx.close(); }
});

test('Reduce Motion: every tap lands the finished chip at once', { skip }, async () => {
  const { ctx, page } = await openWall({ reducedMotion: 'reduce' });
  try {
    for (const want of [1, 2, 3, 4, 0]) {
      const s = await tapAndSample(page, 'Velvet Trip');
      assert.equal(s.level, want);
      assert.deepEqual(s.moving, [], `level ${want}: nothing animates`);
    }
  } finally { await ctx.close(); }
});
