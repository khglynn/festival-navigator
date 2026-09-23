// Lie-fi for the shell rig (2026-09-23): a network that HANGS instead of
// failing — Pier 80 with 40k phones on one tower — and a phone whose worker
// already holds the catalog and the festival file.
//
// `heldNetwork()` is a fetch where every request waits until the test
// releases it (an AbortSignal still aborts it, as a real hung request would
// be aborted by its timeout). `cachesHolding()` stands in for the worker's
// CacheStorage as the page sees it. Shared by the warm-open test files — each
// is its own process, because a warm open is by definition the FIRST boot of
// a page.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settle } from './shell-rig.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FID = 'portola-2026';
export const INDEX = JSON.parse(readFileSync(join(ROOT, 'data/festivals/index.json'), 'utf8'));
export const FEST = JSON.parse(readFileSync(join(ROOT, `data/festivals/${FID}.json`), 'utf8'));

export const crewDoc = (people, selections = {}) => ({
  v: 4, meta: { name: '', inviteFestId: FID }, spotify: {}, affinity: {},
  people, festivals: { [FID]: { selections } },
});

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

export function heldNetwork() {
  const held = [];
  const calls = [];
  const fetch = (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    calls.push(`${method} ${u}`);
    return new Promise((resolve, reject) => {
      held.push({ u, method, resolve });
      if (opts.signal) {
        opts.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      }
    });
  };
  // Answer every held request `match` picks; the rest keep hanging.
  const release = (match, respond) => {
    let n = 0;
    for (const h of held.splice(0)) {
      if (match(h)) { h.resolve(respond(h)); n += 1; } else held.push(h);
    }
    return n;
  };
  // Answer only the OLDEST held request `match` picks (two opens asking for
  // the same file, answered in order).
  const releaseFirst = (match, respond) => {
    const i = held.findIndex(match);
    if (i < 0) return 0;
    const [h] = held.splice(i, 1);
    h.resolve(respond(h));
    return 1;
  };
  const asked = (prefix) => calls.some((c) => c.includes(` ${prefix}`));
  return { fetch, release, releaseFirst, calls, asked };
}

export function cachesHolding(files) {
  const pathOf = (req) => new URL(typeof req === 'string' ? req : req.url, 'https://fest.kevinhg.com').pathname;
  return {
    match: async (req) => (files[pathOf(req)] ? json(files[pathOf(req)]) : undefined),
  };
}

// Milliseconds until `ok()` first holds, or null if it never does in `ms`.
export async function within(ms, ok) {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    if (ok()) return performance.now() - t0;
    await settle(5);
  }
  return ok() ? performance.now() - t0 : null;
}

export const SCREENS = ['screen-landing', 'screen-join', 'screen-create', 'screen-app', 'screen-settings', 'screen-badlink', 'screen-error'];

export const festFile = (id) => JSON.parse(readFileSync(join(ROOT, `data/festivals/${id}.json`), 'utf8'));

// The first button under `root` whose text matches — the way a person finds it.
export function buttonMatching(root, pattern) {
  return [...root.querySelectorAll('button')].find((b) => pattern.test(b.textContent)) || null;
}

// A matcher for held requests.
export const crewGet = (token) => (h) => h.method === 'GET' && h.u.startsWith(`/api/crew?t=${token}`);
export const fileGet = (id) => (h) => h.u === `/data/festivals/${id}.json`;
