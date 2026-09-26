// The Share design round's rig (2026-09-26): round two's (design/ours-r2/rig.mjs)
// plus a guest — a phone with no name in this crew, the friend who opened a
// shared link. The REAL app in one headless Chromium, the made-up nine, /api
// answered in the page (GET crew = that crew; every write refused 503), and
// any request that is not this machine's static server aborted: nothing
// reaches a database or the network.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '../../../tests/helpers/static-server.mjs';
import { crewDoc, ME } from '../../2026-09-25-portola-live/design/ours-r2/crew.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const TOKEN = 'sharedesignframes_0123456'; // made up; never a real crew link
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openRig() {
  const { chromium } = await import('playwright');
  const server = await serveStatic(ROOT);
  const browser = await chromium.launch({ headless: true });
  return { server, browser, close: async () => { await browser.close(); await server.close(); } };
}

export async function openApp(rig, { now, width = 390, height = 844, desktop = false, guest = false } = {}) {
  const ctx = await rig.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: !desktop, isMobile: !desktop, serviceWorkers: 'block' });
  const origin = rig.server.origin;
  await ctx.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.fallback() : route.abort()));
  await ctx.route(`${origin}/api/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await ctx.route(`${origin}/api/crew**`, (route) => (route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(crewDoc('portola-2026', 9)) })
    : route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })));
  await ctx.route(`${origin}/api/festival-add**`, (route) => route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' }));
  await ctx.route(`${origin}/fn-i/**`, (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.addInitScript(([t, me, asGuest]) => {
    navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    // A phone has a share sheet; headless Chromium does not. The frames draw the phone's button.
    if (!navigator.share) navigator.share = () => Promise.resolve();
    localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'Design crew' }]));
    if (!asGuest) {
      localStorage.setItem(`fn_me_v3_${t}`, me);
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem('fn_coach_v1', '1');
    }
    localStorage.setItem('fn_errlog_off_v1', '1');
  }, [TOKEN, ME, guest]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  await page.clock.setFixedTime(now);
  await page.goto(`${origin}/#g=${TOKEN}&f=portola-2026`, { waitUntil: 'load' });
  await page.waitForSelector('#screen-app', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('#wall-root .card').length > 20, null, { timeout: 20000 });
  await sleep(900);
  return { ctx, page };
}
