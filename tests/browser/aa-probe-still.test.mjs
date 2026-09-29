// Probe: zoom-still-hand's glide, instrumented. usage: node probe-still.mjs <engine chromium|webkit> <runs> <lateMs> [aim: center|measured]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { serveStatic } = await import('../helpers/static-server.mjs');
const { launchBrowser, launchWebkit, lateStarts, motionDone } = await import('../helpers/browser.mjs');
import test from 'node:test';
let eng = 'webkit', late = '0', aim = 'center', rate = '1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await serveStatic(W);
const wk = await launchWebkit(); const cr = await launchBrowser(); let engine = wk;
const FID = 'portola-2026';
const SEL = { 'Milli Meng': { Ross: 3 }, Galen: { Ross: 1, Nhu: 2 }, Soulwax: { Nhu: 4 }, Prospa: { Nhu: 2 } };
const doc = () => ({ v: 4, meta: { name: 'Hand', inviteFestId: FID }, spotify: {}, affinity: {}, people: { Kevin: { colorIndex: 0 }, Ross: { colorIndex: 5 }, Nhu: { colorIndex: 3 } }, festivals: { [FID]: { selections: SEL } } });

async function one(k) {
  const ctx = await engine.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await lateStarts(ctx, Number(late));
  const TOKEN = 'stillhandcontract_012345';
  await ctx.addInitScript(([t, f]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Hand' }]));
    localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
    localStorage.setItem(`fn_crew_fest_v3_${t}`, f);
    localStorage.setItem('fn_welcome_v1', '1');
    const d = (e) => {
      const t = e.target; const desc = t && t.nodeType === 1 ? `${t.tagName.toLowerCase()}#${t.id}.${[...t.classList].join('.')}` : String(t);
      const n = document.getElementById('rail-now'); const r = n && n.getBoundingClientRect();
      (window.__dbg = window.__dbg || []).push([Math.round(performance.now()), e.type, desc, Math.round(e.clientX), Math.round(e.clientY), n ? `now hidden=${n.hidden} leaving=${n.dataset.leaving || ''} x=${Math.round(r.left)}..${Math.round(r.right)} y=${Math.round(r.top)}..${Math.round(r.bottom)} anims=${n.getAnimations().length} conn=${n.isConnected}` : 'no-now', `sy=${Math.round(scrollY)}`]);
    };
    for (const ty of ['pointerdown', 'pointerup', 'click']) document.addEventListener(ty, d, true);
    addEventListener('scroll', () => { const a = window.__sc = window.__sc || []; a.push([Math.round(performance.now()), Math.round(scrollY)]); }, { passive: true });
    // watch NOW's attributes
    new MutationObserver((ms) => { for (const m of ms) { const n = m.target; if (n.id === 'rail-now') (window.__dbg = window.__dbg || []).push([Math.round(performance.now()), 'now-attr', m.attributeName, String(n.getAttribute(m.attributeName))]); } }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden', 'data-leaving', 'class', 'style'] });
  }, [TOKEN, FID]);
  const body = JSON.stringify(doc());
  await ctx.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/crew**', (route) => (route.request().method() === 'GET' ? route.fulfill({ contentType: 'application/json', body }) : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route('**/api/festival-add**', (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date('2026-09-26T22:30:00-07:00'));
  await page.goto(`${server.origin}/#g=${TOKEN}`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(400);
  if (Number(rate) > 1 && eng !== 'webkit') { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(rate) }); }
  const mark = (m) => page.evaluate((x) => (window.__dbg = window.__dbg || []).push([Math.round(performance.now()), 'TEST', x]), m);
  await page.evaluate(() => {
    const t0 = performance.now(); let last = '';
    const tick = () => {
      const n = document.getElementById('rail-now'); const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
      const st = `NOWf hidden=${n.hidden} lv=${n.dataset.leaving || ''} x=${Math.round(r.left)} w=${Math.round(r.width)} op=${Number(cs.opacity).toFixed(2)} an=${n.getAnimations().length} sy=${Math.round(scrollY)}`;
      if (st !== last) { (window.__dbg = window.__dbg || []).push([Math.round(performance.now()), st]); last = st; }
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await mark('click Ross');
  await page.locator('#person-chips .person-chip', { hasText: 'Ross' }).first().click();
  let now;
  if (aim === 'measured') {
    await page.waitForFunction(() => { const n = document.getElementById('rail-now'); return !!n && !n.hidden && n.getClientRects().length > 0; }, null, { timeout: 5000 });
    await motionDone(page, { within: '#day-rail' });
  } else await sleep(400);
  if (aim === 'aimcol') {
    await page.waitForFunction(() => { const n = document.getElementById('rail-now'); return !!n && !n.hidden && n.getClientRects().length > 0; }, null, { timeout: 5000 });
    await motionDone(page, { within: '#day-rail' });
    now = await page.evaluate(() => {
      const r = document.getElementById('rail-now').getBoundingClientRect();
      const lo = Math.ceil(r.left + 4), hi = Math.floor(r.right - 4), mid = Math.round(r.left + r.width / 2);
      const cols = [...document.querySelectorAll('#wall-root .card.cell')].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0);
      const over = (x) => cols.some((b) => x >= b.left + 2 && x <= b.right - 2);
      let x = null;
      for (let d = 0; d <= hi - lo && x == null; d++) x = [mid - d, mid + d].find((c) => c >= lo && c <= hi && over(c)) ?? null;
      return { x: x ?? mid, y: Math.round(r.top + r.height / 2) };
    });
  } else now = await page.evaluate(() => { const r = document.getElementById('rail-now').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
  const top = await page.evaluate(() => scrollY);
  const pre = await page.evaluate(([x, y]) => {
    const e = document.elementFromPoint(x, y); const n = document.getElementById('rail-now'); const cs = getComputedStyle(n);
    const running = document.getAnimations().filter((a) => a.playState === 'running' || a.pending).map((a) => `${a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.className) : '?'}:${a.playState}${a.pending ? '/pending' : ''}`);
    const corner = document.querySelector('.plan-corner, #plan-corner, .our-plan, .plan-shelf');
    return { hit: e ? `${e.tagName.toLowerCase()}#${e.id}.${[...e.classList].join('.')}` : null, op: cs.opacity, pe: cs.pointerEvents, vis: cs.visibility, tr: cs.transform, running: running.slice(0, 12), corner: corner ? corner.className : null, busy: document.body.dataset.busy || '' };
  }, [now.x, now.y]);
  await mark(`pre ${JSON.stringify(pre)}`);
  await mark(`click NOW at ${now.x},${now.y}`);
  await page.mouse.click(now.x, now.y);
  await sleep(1500);
  const landed = await page.evaluate(() => scrollY);
  const dbg = await page.evaluate(() => window.__dbg || []);
  const sc = await page.evaluate(() => window.__sc || []);
  await ctx.close();
  return { res: { k, top, landed, glided: landed > top + 100 }, dbg, sc, errors };
}

// THROWAWAY PROBE (probe/webkit-reds only, never merged): the zoom-still-hand
// glide, 12 runs per aim in WebKit and 4 in Chromium, every input and NOW's
// state logged for any run whose click on NOW did not glide the page.
test('probe: the NOW glide under load', { timeout: 900000 }, async () => {
  const out = [];
  for (const [e, a, n] of [['webkit', 'center', 12], ['webkit', 'measured', 12], ['webkit', 'aimcol', 12], ['chromium', 'aimcol', 4]]) {
    eng = e; aim = a; engine = e === 'webkit' ? wk : cr;
    let fails = 0;
    for (let k = 0; k < n; k++) {
      let r;
      try { r = await one(k); } catch (err) { console.log(`PROBE ${e} ${a} run ${k} threw ${err && err.message}`); fails++; continue; }
      if (!r.res.glided) fails++;
      if (!r.res.glided) {
        console.log(`PROBE FAIL ${e} ${a} ${JSON.stringify(r.res)}`);
        const t0 = (r.dbg.find((d) => d[1] === 'TEST') || [0])[0];
        for (const d of r.dbg) if (d[0] >= t0 - 50) console.log('PROBE   ', d[0] - t0, ...d.slice(1));
        console.log('PROBE    scroll', JSON.stringify(r.sc.filter((s) => s[0] >= t0).map((s) => [s[0] - t0, s[1]]).slice(0, 12)));
        console.log('PROBE    errors', JSON.stringify(r.errors));
      }
    }
    out.push(`${e} ${a}: ${fails}/${n} did not glide`);
    console.log(`PROBE SUMMARY ${e} ${a}: ${fails}/${n} did not glide`);
  }
  console.log(`PROBE ALL ${out.join(' | ')}`);
  await wk.close(); await cr.close(); await server.close();
});
