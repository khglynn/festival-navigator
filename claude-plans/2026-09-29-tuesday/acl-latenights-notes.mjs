// The notes door for tonight's dated room, the zoom's facts for a Late-night
// card, and the Share at 8:20 PM (2026-09-29).
//   node claude-plans/2026-09-29-tuesday/acl-latenights-notes.mjs [--webkit] [--width=N]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../tests/helpers/static-server.mjs';
import { motionDone } from '../../tests/helpers/browser.mjs';
import { openAcl, CLOCKS } from './acl-latenights-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const engineName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const width = Number((process.argv.find((a) => a.startsWith('--width=')) || '--width=390').slice(8));
const pw = await import('playwright');
const browser = await pw[engineName].launch({ headless: true });
const server = await serveStatic(ROOT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const { ctx, page, desk, token, errors } = await openAcl(browser, server.origin, { at: CLOCKS['sep29-820pm'], width });
  const press = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    if (desk) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(700);
    await motionDone(page).catch(() => {});
  };
  const room = '#wall-root .room[data-iso="2026-09-29"]';
  const headInfo = await page.evaluate((r) => {
    const h = document.querySelector(`${r} > .room-head`);
    const btn = h && (h.matches('button') ? h : h.querySelector('button'));
    return { head: h && h.outerHTML.slice(0, 400), button: btn && btn.outerHTML.slice(0, 200) };
  }, room);
  console.log('head', JSON.stringify(headInfo));
  await press(`${room} > .room-head button, ${room} > button.room-head, ${room} > .room-head`);
  const sheet = await page.evaluate(() => {
    const s = document.querySelector('.sheet, #sheet, [role="dialog"]');
    return s ? s.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  });
  console.log('sheet after head', sheet, '| url hash key', await page.evaluate(() => JSON.stringify(history.state)));
  // Write a note and send it (the server refuses every write; the doc keeps it).
  const ta = page.locator('textarea').first();
  if (await ta.count()) {
    await ta.focus();
    await page.keyboard.type('Meet at the Mohawk rail');
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    await sleep(600);
    const sendBtn = page.locator('.sheet button.send, button[aria-label*="Send" i], .composer button[type="submit"]').first();
    if (await sendBtn.count() && await sendBtn.isVisible()) {
      const b = await sendBtn.boundingBox();
      if (desk) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); else await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await sleep(600);
    }
    const keys = await page.evaluate((t) => {
      const raw = localStorage.getItem(`fn_crew_v3_${t}`) || Object.keys(localStorage).filter((k) => k.includes(t)).map((k) => `${k}=${(localStorage.getItem(k) || '').slice(0, 300)}`).join(' || ');
      return raw;
    }, token);
    console.log('stored', String(keys).slice(0, 1200));
  }
  console.log('errors', JSON.stringify(errors()));
  await ctx.close();
} finally { await browser.close(); await server.close(); }
