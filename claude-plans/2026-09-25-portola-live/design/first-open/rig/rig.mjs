// First-open design rig (2026-09-25). Serves the clean worktree statically,
// blocks the service worker, answers GET /api/crew with a MADE-UP crew doc,
// and ABORTS every non-GET /api call and every /fn-i (PostHog relay) call —
// nothing here can write to production. One browser, one context at a time.
import { serveStatic } from '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live/tests/helpers/static-server.mjs';
import { chromium } from 'playwright';

export const ROOT = '/Users/kevinhalladay-glynn/DevKev/personal/festival-navigator/.claude/worktrees/portola-live';
export const OUT = `${ROOT}/claude-plans/2026-09-25-portola-live/design/first-open/shots`;
// Not a real crew token: shaped to pass the parser, obviously fake.
export const TOKEN = 'DEMOcrewTOKENforDesignOnly01';
export const FID = 'portola-2026';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

// Invented friends. Picks on real public lineup names.
export function demoDoc({ people = true } = {}) {
  const ppl = people ? {
    Kevin: { colorIndex: 0 }, Maya: { colorIndex: 3 }, Jonah: { colorIndex: 6 },
    Priya: { colorIndex: 9 }, Theo: { colorIndex: 12 }, Rosa: { colorIndex: 15 },
  } : {};
  const sel = {};
  const put = (artist, who) => { sel[artist] = { ...(sel[artist] || {}), ...who }; };
  if (people) {
    put('Robyn', { Kevin: 4, Maya: 4, Jonah: 3, Priya: 4, Theo: 2, Rosa: 3 });
    put('Dog Blood', { Kevin: 3, Jonah: 4, Theo: 3 });
    put('Soulwax', { Kevin: 4, Maya: 2, Rosa: 3 });
    put('Tove Lo', { Maya: 4, Priya: 3, Rosa: 2 });
    put('Fcukers', { Kevin: 2, Jonah: 2 });
    put('Kettama', { Jonah: 3, Theo: 4 });
    put('Prospa', { Theo: 3, Kevin: 1 });
    put('Fatboy Slim', { Maya: 2, Priya: 2, Rosa: 1, Kevin: 2 });
    put('Groove Armada', { Priya: 3 });
    put('DJ Shadow', { Kevin: 3, Theo: 2 });
    put('Swedish House Mafia', { Maya: 3, Priya: 4, Rosa: 4, Jonah: 2 });
    put('Four Tet', { Kevin: 4, Jonah: 4, Theo: 3 });
    put('Parcels', { Maya: 3, Rosa: 3, Kevin: 2 });
    put('Kelela', { Priya: 2, Maya: 2 });
    put('Overmono', { Jonah: 3, Kevin: 3 });
    put('Despacio', { Kevin: 4, Maya: 3, Theo: 2 });
    put('2manydjs', { Kevin: 3, Jonah: 3 });
    put('Channel Tres', { Rosa: 3, Maya: 2 });
    put('Soulwax', { Jonah: 1 });
  }
  return {
    v: 4,
    meta: { name: 'The Portola Crew', inviteFestId: FID },
    spotify: {}, affinity: {},
    people: ppl,
    festivals: { [FID]: { selections: sel } },
  };
}

export async function startRig() {
  const server = await serveStatic(ROOT);
  const browser = await chromium.launch({ headless: true });
  const blocked = [];
  async function phone({ doc = demoDoc(), init = null, clock = null } = {}) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      serviceWorkers: 'block', reducedMotion: 'reduce',
    });
    await ctx.addInitScript(() => {
      navigator.serviceWorker.register = () => Promise.resolve({ update: () => Promise.resolve() });
    });
    if (clock) await ctx.addInitScript((t) => {
      const T = new Date(t).getTime(); const start = Date.now();
      const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T + (RealDate.now() - start)])); } static now() { return T + (RealDate.now() - start); } };
    }, clock);
    if (init) await ctx.addInitScript(init.fn, init.arg);
    await ctx.route('**/fn-i/**', (r) => { blocked.push(r.request().url().replace(/#.*/, '')); return r.abort(); });
    await ctx.route('**/api/**', (route) => {
      const req = route.request();
      const url = req.url();
      if (req.method() !== 'GET') { blocked.push(`${req.method()} ${url.split('?')[0]}`); return route.abort(); }
      if (url.includes('/api/crew')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(doc) });
      if (url.includes('/api/festival-add')) return route.fulfill({ contentType: 'application/json', body: '{"festivals":[]}' });
      if (url.includes('/api/person')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    return { ctx, page, errors };
  }
  return {
    server, browser, blocked, phone,
    async close() { await browser.close(); await server.close(); },
  };
}

// Seeds for localStorage, as init scripts (run before app.js).
export const seed = {
  claimed: (name) => ({ fn: ([t, n]) => { try { localStorage.setItem(`fn_me_v3_${t}`, n); localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }])); } catch {} }, arg: [TOKEN, name] }),
};
