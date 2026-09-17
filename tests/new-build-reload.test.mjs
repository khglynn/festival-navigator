// index.html's new-build glue, run as shipped: the inline script is lifted out
// of index.html and executed against a jsdom page with a stand-in service
// worker container. It stays inline on purpose — it has to work when the
// module graph cannot load — so this reads the real bytes rather than a copy.
//
// The one rule (2026-09-16): a new build reloads the page only when nothing
// is in progress. A half-typed note lives only in memory (notes.js), so the
// old "first 20 s" and "tab is hidden" shortcuts reloaded it away; and the
// "refresh" notice was a toast the next toast erased.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const GLUE = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes('controllerchange'));

function page({ controlled = true } = {}) {
  const dom = new JSDOM(HTML, { url: 'https://fest.kevinhg.com/', pretendToBeVisual: true });
  const { document } = dom.window;
  // jsdom has no layout, so every element reports zero client rects. Visible
  // here means what it means in a browser: no display:none on the way up.
  dom.window.Element.prototype.getClientRects = function () {
    for (let n = this; n; n = n.parentElement) if (n.style && n.style.display === 'none') return [];
    return [{}];
  };
  let visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
  Object.defineProperty(document, 'hidden', { get: () => visibility !== 'visible', configurable: true });
  const listeners = {};
  const sw = {
    controller: controlled ? {} : null,
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    register: () => Promise.resolve({ update: () => Promise.resolve() }),
  };
  const timers = [];
  const out = { reloads: 0, notices: 0 };
  const ctx = {
    navigator: { serviceWorker: sw },
    document,
    location: { reload: () => { out.reloads += 1; } },
    window: { dispatchEvent: (e) => { if (e.type === 'fn:new-build') out.notices += 1; return true; } },
    CustomEvent: dom.window.CustomEvent,
    setInterval: (fn) => { timers.push(fn); return timers.length; },
    // A tab open for a minute: past any first-seconds grace a script may keep.
    performance: { now: () => 60000 },
  };
  vm.runInNewContext(GLUE, ctx);
  return Object.assign(out, {
    document,
    newWorker: () => { for (const fn of listeners.controllerchange || []) fn(); },
    hide: () => { visibility = 'hidden'; document.dispatchEvent(new dom.window.Event('visibilitychange')); },
    show: () => { visibility = 'visible'; document.dispatchEvent(new dom.window.Event('visibilitychange')); },
    tick: () => { for (const fn of timers) fn(); },
    wall: () => document.getElementById('screen-app'),
  });
}

// A note being written: a textarea with words in it, on screen, not focused
// (the person switched to Maps mid-sentence).
function draft(p, words = 'meet at the') {
  p.wall().style.display = '';
  const ta = p.document.createElement('textarea');
  ta.value = words;
  p.wall().appendChild(ta);
  return ta;
}

test('the glue is still inline in index.html (it must run when the module graph cannot)', () => {
  assert.ok(GLUE, 'an inline <script> handles controllerchange');
});

test('a quiet page reloads the moment a new build takes over — the stale-preview fix stays', () => {
  const p = page();
  p.newWorker();
  assert.equal(p.reloads, 1);
  assert.equal(p.notices, 0);
});

test('a draft on screen and a hidden tab: no reload, however old the page is', () => {
  const p = page();
  draft(p);
  p.hide();
  p.newWorker();
  assert.equal(p.reloads, 0, 'the words would be gone when they come back');
  p.tick();
  p.show();
  p.hide();
  assert.equal(p.reloads, 0, 'every re-check still sees the draft');
});

test('the reload waits, then happens the first time the page is quiet', () => {
  const p = page();
  const ta = draft(p);
  p.newWorker();
  assert.equal(p.reloads, 0);
  assert.equal(p.notices, 1, 'the person is told once');
  ta.value = ''; // sent
  p.tick();
  assert.equal(p.reloads, 1, 'the slow timer catches it');
  p.tick();
  p.hide();
  assert.equal(p.reloads, 1, 'and only once');
});

test('coming back to the tab is a re-check too', () => {
  const p = page();
  const ta = draft(p);
  p.newWorker();
  assert.equal(p.reloads, 0);
  ta.remove();
  p.hide();
  assert.equal(p.reloads, 1);
});

test('in progress means: a busy flag, a sheet, a zoom, or a field in use', () => {
  const blockers = {
    'crew being created': (d) => { d.body.dataset.busy = 'create'; },
    'sheet open': (d) => { const b = d.createElement('div'); b.id = 'sheet-backdrop'; d.body.appendChild(b); },
    'card zoomed': (d) => { const l = d.createElement('div'); l.id = 'zoom-layer'; const s = d.createElement('div'); s.className = 'zoom-slot'; l.appendChild(s); d.body.appendChild(l); },
    'focused empty field': (d) => { d.getElementById('screen-landing').style.display = ''; const i = d.createElement('input'); d.getElementById('landing-you').appendChild(i); i.focus(); },
  };
  for (const [why, block] of Object.entries(blockers)) {
    const p = page();
    block(p.document);
    p.newWorker();
    assert.equal(p.reloads, 0, why);
    assert.equal(p.notices, 1, why);
  }
});

test('fields that hold nothing of the person\'s do not block: off-screen values, read-only link boxes', () => {
  const p = page();
  // The bad-link screen pre-fills its input and is then hidden; a share link
  // box is read-only. Neither is work a reload could lose.
  p.document.getElementById('badlink-input').value = 'https://fest.kevinhg.com/';
  p.wall().style.display = '';
  const box = p.document.createElement('input');
  box.readOnly = true;
  box.value = 'https://fest.kevinhg.com/';
  p.wall().appendChild(box);
  p.newWorker();
  assert.equal(p.reloads, 1);
});

test('the first worker to claim a page is not a new build; the next one is', () => {
  const p = page({ controlled: false });
  p.newWorker();
  assert.equal(p.reloads, 0, 'this page already runs what that worker serves');
  assert.equal(p.notices, 0);
  p.newWorker();
  assert.equal(p.reloads, 1, 'a page whose first install happened this session still gets the next build');
});

test('a second takeover while one is waiting does not announce twice', () => {
  const p = page();
  draft(p);
  p.newWorker();
  p.newWorker();
  assert.equal(p.notices, 1);
  assert.equal(p.reloads, 0);
});
