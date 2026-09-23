// One line per room (2026-09-23), in a real browser at phone width.
//
// Kevin: "combine the double lines (for day and then event) into one line each
// like 'Sat Portola' 'Sat Afters'". Every room on a day wears one head that
// names when and what, and a day is a `.day-block` the tabs land on. What jsdom
// cannot see is the part a thumb sees: that a head is ONE line on a 390px
// phone for every fest we ship (the sub gives way first, and only then does
// the name ellipsize), that a tab tap lands the day's first head under the
// sticky chrome, that the scrollspy lights the day you are standing in through
// a whole scroll, and that the day-of open lands on today's first head. The
// app is booted for real against a made-up crew; /api never leaves this page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../helpers/static-server.mjs';
import { launchBrowser, NO_BROWSER } from '../helpers/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INDEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/festivals/index.json'), 'utf8'));
const CATALOG = (INDEX.festivals || INDEX).map((f) => f.id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await serveStatic(ROOT);
const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); await server.close(); });
const skip = browser ? false : NO_BROWSER;

// A phone (hasTouch puts the page on a COARSE pointer, where the 44px floor
// lives) opened on `fid` for a made-up crew. `fest` replaces the file the app
// fetches, for the edge cases no shipped fest has yet.
async function openPhone(fid, { fest = null, now = null, folded = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const TOKEN = 'headscontract_0123456789'; // a made-up crew, never a real link
  await ctx.addInitScript(([t, f, fold]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Contract' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_coach_v1', '1');
    if (fold) localStorage.setItem(`fn_fold_v1_${f}`, JSON.stringify(fold));
  }, [TOKEN, fid, folded]);
  const doc = { v: 4, meta: { name: 'Contract', inviteFestId: fid }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 } }, festivals: { [fid]: { selections: {} } } };
  // Playwright tries the LAST-registered matching route first: the catch-all goes first.
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) }));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  if (fest) await ctx.route(`**/data/festivals/${fid}.json`, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fest) }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  if (now) await page.clock.setFixedTime(now);
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#wall-root') && document.querySelector('#wall-root').children.length > 0, null, { timeout: 15000 });
  await sleep(300);
  return { ctx, page };
}

// Every room head's geometry, in document order.
const headsOn = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll('#wall-root .room-head')].map((h) => {
    const r = h.getBoundingClientRect();
    const name = h.querySelector('.name');
    const sub = h.querySelector('.sub');
    return {
      text: name.textContent, sub: sub.textContent, vw, right: r.right, height: r.height,
      tag: h.tagName, nowrap: getComputedStyle(name).whiteSpace === 'nowrap',
      clipped: name.scrollWidth > name.clientWidth + 1,
      subWidth: sub.getBoundingClientRect().width,
      subFits: sub.scrollWidth <= sub.clientWidth + 1,
    };
  });
});

test('every room head on every fest we ship is ONE line on a 390px phone, and a door clears the 44px floor', { skip }, async () => {
  let total = 0;
  for (const fid of CATALOG) {
    const { ctx, page } = await openPhone(fid);
    try {
      const heads = await headsOn(page);
      total += heads.length;
      for (const h of heads) {
        const where = `${fid}: "${h.text}  ${h.sub}"`;
        assert.ok(h.nowrap, `${where} — the name never wraps`);
        assert.ok(h.height <= 45, `${where} is ${h.height}px tall — one line, at the floor`);
        assert.ok(h.height >= 44, `${where} is ${h.height}px tall — every head wears the floor, door or not (one component, one look)`);
        assert.ok(h.right <= h.vw + 0.5, `${where} runs off a 390px screen (${h.right} > ${h.vw})`);
        if (h.clipped) assert.ok(h.subWidth <= 1, `${where} — the sub gives way before the name ellipsizes`);
      }
    } finally {
      await ctx.close();
    }
  }
  assert.ok(total >= 30, `the catalog really has heads to check (${total})`);
});

test('a festival name too long for a phone: the sub goes first, then the name ellipsizes — one line, never two', { skip }, async () => {
  const portola = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
  const long = { ...portola, name: 'Tomorrowland Winter Wonderland Weekender' };
  const { ctx, page } = await openPhone('portola-2026', { fest: long });
  try {
    const sat = (await headsOn(page)).find((h) => h.text.startsWith('SAT TOMORROWLAND'));
    assert.ok(sat, 'the long name is on the wall');
    assert.equal(sat.sub, 'Sep 26 · Pier 80', 'the sub is still in the DOM, for the zoomed-out desktop');
    assert.ok(sat.clipped, 'the name ellipsizes');
    assert.ok(sat.subWidth <= 1, `having let the sub go first (${sat.subWidth}px left of it)`);
    assert.ok(sat.height <= 45 && sat.right <= sat.vw + 0.5, 'one line, on the screen');
  } finally {
    await ctx.close();
  }
});

test('a tab lands its day\'s first head under the sticky chrome, and the scrollspy lights the day you are in through a whole scroll', { skip }, async () => {
  const { ctx, page } = await openPhone('portola-2026');
  try {
    const where = (day) => page.evaluate((d) => {
      const block = document.querySelector(`#wall-root .day-block[data-day="${d}"]`);
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
      return {
        top: block.getBoundingClientRect().top, offset,
        first: block.querySelector('.room-head .name').textContent,
        active: (document.querySelector('#dock-days .day-tab.active') || {}).dataset?.day || null,
      };
    }, day);
    for (const [day, first] of [['Thursday', 'THU AFTERS'], ['Saturday', 'SAT PORTOLA'], ['Friday', 'FRI AFTERS'], ['Sunday', 'SUN PORTOLA']]) {
      await page.click(`#dock-days .day-tab[data-day="${day}"]`);
      await page.waitForFunction((d) => document.querySelector('#dock-days .day-tab.active')?.dataset.day === d, day, { timeout: 8000 });
      await sleep(700); // the smooth scroll settles
      const at = await where(day);
      assert.equal(at.first, first, `${day}'s first head names the day`);
      assert.ok(at.top >= at.offset - 2 && at.top <= at.offset + 32, `${day} landed at ${at.top}px; the chrome ends at ${at.offset}px`);
      assert.equal(at.active, day, 'and its tab is lit');
    }

    // The whole scroll, top to bottom by a thumb-sized wheel: at every stop the
    // lit tab is the last day whose block has reached the chrome.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await sleep(200);
    const seen = new Set();
    for (let i = 0; i < 400; i += 1) {
      const probe = await page.evaluate(() => {
        const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
        const blocks = [...document.querySelectorAll('#wall-root .day-block[data-day]')];
        let want = blocks[0].dataset.day;
        for (const b of blocks) if (b.getBoundingClientRect().top <= offset + 32) want = b.dataset.day;
        const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
        return { want, lit: document.querySelector('#dock-days .day-tab.active')?.dataset.day, bottom };
      });
      assert.equal(probe.lit, probe.want, `stop ${i}: standing in ${probe.want}, the dock lit ${probe.lit}`);
      seen.add(probe.lit);
      if (probe.bottom) break;
      await page.mouse.wheel(0, 700);
      await sleep(120);
    }
    assert.deepEqual([...seen], ['Thursday', 'Friday', 'Saturday', 'Sunday'], 'every day was lit, in order, on the way down');
  } finally {
    await ctx.close();
  }
});

test('the day-of open lands on today\'s first head before doors', { skip }, async () => {
  // Sunday the 27th, 9 AM in San Francisco: the festival day, no set yet.
  const { ctx, page } = await openPhone('portola-2026', { now: new Date('2026-09-27T16:00:00Z') });
  try {
    await sleep(500);
    const at = await page.evaluate(() => {
      const block = document.querySelector('#wall-root .day-block[data-iso="2026-09-27"]');
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
      return { top: block.getBoundingClientRect().top, offset, first: block.querySelector('.room-head .name').textContent, line: !!document.querySelector('.now-line') };
    });
    assert.equal(at.line, false, 'before doors there is no now line to land on');
    assert.equal(at.first, 'SUN PORTOLA');
    assert.ok(at.top >= at.offset - 2 && at.top <= at.offset + 32, `today landed at ${at.top}px; the chrome ends at ${at.offset}px`);
  } finally {
    await ctx.close();
  }
});

// A Late nights date is a festival day too (2026-09-23): on an ACL night
// between the weekends the open lands on tonight's head, and the dock lights
// LATE — it used to skip ahead to Friday Oct 2.
test('the day-of open on an ACL night between the weekends lands on tonight\'s Late nights head', { skip }, async () => {
  // Tue Sep 29, 8 PM in Austin: two late-night shows, no grid day.
  const { ctx, page } = await openPhone('acl-2026', { now: new Date('2026-09-30T01:00:00Z') });
  try {
    await sleep(800); // the dock's own glide to the lit tab
    const at = await page.evaluate(() => {
      const room = document.querySelector('#wall-root .day-block[data-day="Late nights"] .room[data-iso="2026-09-29"]');
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--jump-offset')) || 8;
      return {
        top: room.getBoundingClientRect().top, offset,
        head: room.querySelector('.room-head .name').textContent,
        lit: document.querySelector('#dock-days .day-tab.active')?.dataset.day,
      };
    });
    assert.equal(at.head, 'TUE LATE NIGHTS');
    assert.ok(at.top >= at.offset - 2 && at.top <= at.offset + 32, `tonight landed at ${at.top}px; the chrome ends at ${at.offset}px`);
    assert.equal(at.lit, 'Late nights', 'and the dock says where you are');
  } finally {
    await ctx.close();
  }
});

test('Portola hidden: Saturday\'s first head is SAT AFTERS, carrying the date — and it is Afters\' door, not the date\'s', { skip }, async () => {
  const { ctx, page } = await openPhone('portola-2026', { folded: [':fest'] });
  try {
    const sat = await page.evaluate(() => {
      const head = document.querySelector('#wall-root .day-block[data-day="Saturday"] .room-head');
      return { text: head.querySelector('.name').textContent, sub: head.querySelector('.sub').textContent, tag: head.tagName, aria: head.getAttribute('aria-label'), h: head.getBoundingClientRect().height };
    });
    assert.deepEqual([sat.text, sat.sub, sat.tag], ['SAT AFTERS', 'Sep 26', 'BUTTON']);
    assert.equal(sat.aria, 'Notes for Afters · Saturday');
    assert.ok(sat.h >= 44, `a door is ${sat.h}px tall on a phone; the floor is 44`);
  } finally {
    await ctx.close();
  }
});
