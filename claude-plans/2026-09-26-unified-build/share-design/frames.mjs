// The Share design round's frames (2026-09-26): the PRODUCTION app on
// live/plan-share, booted by ./rig.mjs (the made-up nine, nothing leaves the
// machine). Kevin asked for three things, and each part is drawn at phone 390
// and laptop 1280:
//   1-*  sharing while Our picks is open shares it open — what a friend sees
//   2-*  the day as text for a group chat (a MOCK of a chat, clearly labelled:
//        the words are production's, the bubble is not the app)
//   3-*  a quicker way to the crew link — three placements, each injected into
//        the real menus with the menus' own classes (a drawing, not a build)
//   node frames.mjs            every frame
//   node frames.mjs 1- 3a      only frames whose id starts with one of these
// PNGs land in ./shots/ (images are git-ignored).
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { openRig, openApp, sleep } from './rig.mjs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const want = (id) => !only.length || only.some((p) => id.startsWith(p));
const SAT_940 = new Date('2026-09-26T21:40:00-07:00');
const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1280, height: 800, desktop: true };
const SHARE_SVG = '<svg width="13" height="13" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 7.4V1.3M3.9 3.4 6 1.3l2.1 2.1M4.3 4.9H2.6v5.8h6.8V4.9H7.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const shot = async (page, id) => { await page.screenshot({ path: `${OUT}${id}.png` }); console.log('shot', id); };
const openPicks = async (page) => {
  await page.evaluate(() => document.querySelector('#plan .plan-grab').click());
  await sleep(900);
};
const lookAround = async (page) => {
  await page.evaluate(() => [...document.querySelectorAll('#welcome-card button')].find((b) => b.textContent === 'Look around').click());
  await sleep(1100);
};
const tap = async (page, sel) => {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error(`no box: ${sel}`);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(700);
};

const rig = await openRig();
try {
  // ---- 1 · Our picks open, shared open ----------------------------------------------
  for (const [id, size, guest, step] of [
    ['1a-sender-open-390', PHONE, false, 'open'],
    ['1b-friend-welcome-390', PHONE, true, 'welcome'],
    ['1c-friend-open-390', PHONE, true, 'open'],
    ['1d-sender-open-1280', LAPTOP, false, 'open'],
    ['1e-friend-welcome-1280', LAPTOP, true, 'welcome'],
    ['1f-friend-open-1280', LAPTOP, true, 'open'],
  ]) {
    if (!want(id)) continue;
    const { ctx, page } = await openApp(rig, { now: SAT_940, ...size, guest });
    if (guest && step === 'open') await lookAround(page);
    if (step === 'open') await openPicks(page);
    await shot(page, id);
    await ctx.close();
  }

  // ---- 2 · the day as text (a chat MOCK; the words are production's) --------------
  if (only.length === 0 || only.some((p) => '2-'.startsWith(p) || p.startsWith('2'))) {
    const texts = JSON.parse(execFileSync('node', [new URL('./texts.mjs', import.meta.url).pathname, '--json'], { encoding: 'utf8' }));
    const frames = [
      ['2a-text-lines-390', 'A · one line a stop (sent at 11 AM)', texts.morning.lines],
      ['2b-text-slashes-390', 'B · one paragraph, slashes (sent at 11 AM)', texts.morning.slashes],
      ['2c-text-nownext-390', 'C · now and next (sent at 9:40 PM)', texts.night.nowNext],
      ['2d-text-lines-night-390', 'A · one line a stop (sent at 9:40 PM)', texts.night.lines],
    ];
    const ctx = await rig.browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const [id, label, text] of frames) {
      if (!want(id)) continue;
      await page.setContent(chatMock(label, text));
      await sleep(150);
      await shot(page, id);
    }
    await ctx.close();
  }

  // ---- 3 · a quicker way to the crew link --------------------------------------------
  // a · a row in the Show menu (the fest name's menu): "Share the crew link"
  for (const [id, size] of [['3a-show-menu-390', PHONE], ['3a-show-menu-1280', LAPTOP]]) {
    if (!want(id)) continue;
    const { ctx, page } = await openApp(rig, { now: SAT_940, ...size });
    await tap(page, size.desktop ? '#rail-fest-link' : '#dock-fest-link');
    await page.evaluate((svg) => {
      const pop = [...document.querySelectorAll('.sort-pop:not(.hl-pop)')].find((p) => p.style.display !== 'none');
      const settings = pop.querySelector('button.settings').parentElement;
      const li = settings.cloneNode(true);
      const b = li.querySelector('button');
      b.className = 'share-link';
      b.querySelector('.check').innerHTML = svg;
      b.querySelector('.check').style.color = 'var(--tonal-text)';
      b.children[1].textContent = 'Share the crew link';
      b.children[1].style.color = 'var(--tonal-text)';
      b.children[1].style.fontWeight = '700';
      b.querySelector('.chev').remove();
      const div = pop.querySelector('.pop-div').cloneNode(true);
      settings.before(li, div);
    }, SHARE_SVG);
    await sleep(200);
    await shot(page, id);
    await ctx.close();
  }
  // b · a row in the people menu, beside + Invite someone
  for (const [id, size] of [['3b-people-menu-390', PHONE], ['3b-people-menu-1280', LAPTOP]]) {
    if (!want(id)) continue;
    const { ctx, page } = await openApp(rig, { now: SAT_940, ...size });
    await tap(page, size.desktop ? '#rail-you' : '#dock-you');
    await page.evaluate((svg) => {
      const pop = [...document.querySelectorAll('.hl-pop')].find((p) => p.style.display !== 'none');
      const invite = pop.querySelector('[data-act="invite"]').parentElement;
      const li = invite.cloneNode(true);
      const b = li.querySelector('button');
      b.dataset.act = 'share-link';
      const check = b.querySelector('.check');
      check.classList.remove('plus');
      check.innerHTML = svg;
      b.querySelector('.nm').textContent = 'Share the crew link';
      invite.after(li);
    }, SHARE_SVG);
    await sleep(200);
    await shot(page, id);
    await ctx.close();
  }
  // c · a share mark beside the fest name, always on screen
  for (const [id, size] of [['3c-fest-name-390', PHONE], ['3c-fest-name-1280', LAPTOP]]) {
    if (!want(id)) continue;
    const { ctx, page } = await openApp(rig, { now: SAT_940, ...size });
    await page.evaluate(([svg, desk]) => {
      const link = document.getElementById(desk ? 'rail-fest-link' : 'dock-fest-link');
      const wrap = link.parentElement;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sheet-close';
      b.setAttribute('aria-label', 'Share the crew link');
      b.innerHTML = svg;
      b.style.cssText = 'color: var(--tonal-text); margin-right: 6px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;';
      wrap.parentElement.insertBefore(b, wrap);
    }, [SHARE_SVG, !!size.desktop]);
    await sleep(200);
    await shot(page, id);
    await ctx.close();
  }
} finally {
  await rig.close();
}

// A chat, drawn plainly: the label says it is a mock. The bubble carries the
// text exactly as the share sheet would receive it; the link card under it is
// what a chat app draws for the link beside the text (the festival's preview
// from api/share.js — here a stand-in box with the festival's name).
function chatMock(label, text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; background: #000; color: #fff; font: 15px/1.35 -apple-system, "Helvetica Neue", Arial, sans-serif; }
    .top { padding: 14px 16px 10px; border-bottom: 1px solid #222; font-size: 12px; color: #8e8e93; letter-spacing: .02em; }
    .top b { display: block; color: #fff; font-size: 15px; margin-top: 3px; letter-spacing: 0; }
    .thread { padding: 14px 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
    .who { align-self: flex-end; font-size: 11px; color: #8e8e93; margin-right: 8px; }
    .bubble { max-width: 82%; background: #0a84ff; border-radius: 18px; padding: 8px 12px; white-space: pre-wrap; word-wrap: break-word; }
    .card { width: 82%; border-radius: 16px; overflow: hidden; background: #1c1c1e; }
    .card .img { height: 92px; background: linear-gradient(135deg, #7b3fe4, #e0529c 55%, #f5a25d); display: flex; align-items: flex-end; padding: 10px 12px; box-sizing: border-box; font: 800 22px/1 Impact, "Anton", sans-serif; letter-spacing: .02em; }
    .card .meta { padding: 8px 12px 10px; font-size: 13px; }
    .card .meta span { display: block; color: #8e8e93; font-size: 12px; margin-top: 2px; }
  </style>
  <div class="top">MOCK · how the Share lands in a group chat (not the app)<b>${esc(label)}</b></div>
  <div class="thread"><div class="who">You</div><div class="bubble">${esc(text)}</div>
  <div class="card"><div class="img">PORTOLA '26</div><div class="meta">Portola '26 · Festival Navigator<span>fest.kevinhg.com · opens on Our picks</span></div></div></div>`;
}
