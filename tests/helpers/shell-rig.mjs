// The real shell in jsdom: the real index.html and the real js/v3/app.js,
// booted the way a phone boots it. app.js needs a genuine Location, history
// and navigator, and it starts setIntervals (clock, poll, favicon, new-build
// re-check) that would keep `node --test` alive forever, so they are corralled
// here and cleared by close(). Each test file is its own process, so one
// bootShell() per file: the module graph (and its boot) runs once.
//
// `fetch` is the whole network. `storage` seeds localStorage before app.js
// reads it. Browser primitives jsdom lacks are supplied, never app behaviour.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function bootShell({ url = 'https://fest.kevinhg.com/', storage = {}, fetch } = {}) {
  const dom = new JSDOM(readFileSync(join(ROOT, 'index.html'), 'utf8'), { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.CSS = { escape: (s) => String(s).replace(/[^\w-]/g, (c) => `\\${c}`) };
  globalThis.history = dom.window.history;
  const store = new Map(Object.entries(storage));
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: dom.window.location, configurable: true });
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (h) => clearTimeout(h);
  // jsdom has no IntersectionObserver, and the day-tab scrollspy asks for one
  // the moment a wall has days — so without this every shell test that opens
  // a real festival dies inside renderDayNav. It only has to exist: what the
  // scrollspy actually decides comes from its geometry pass, which reads
  // layout jsdom does not have either.
  globalThis.IntersectionObserver = class {
    observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
  };
  globalThis.fetch = fetch || (async () => { throw new Error('no network in this test'); });
  dom.window.fetch = globalThis.fetch;
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // jsdom has no scrolling either ("Not implemented: Window's scrollTo()"):
  // the shell lands on a day rule after the wall changes shape, and that is
  // a scroll the layout-less DOM can only take quietly.
  dom.window.scrollTo = () => {};
  // jsdom has no canvas; the living favicon draws on one once a wall opens.
  dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
  dom.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

  const intervals = new Set();
  const realSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...a) => { const h = realSetInterval(...a); intervals.add(h); return h; };
  const close = () => { for (const h of intervals) clearInterval(h); dom.window.close(); };
  await import('../../js/v3/app.js');
  return { dom, close, $: (id) => dom.window.document.getElementById(id) };
}

// Resolve every pending microtask and short timer the boot chain queued.
export const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
