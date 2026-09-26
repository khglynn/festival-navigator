// Prints the plan's route per night for a crew, the way the model test reads
// it (tier, when, how many, where) — plus each stop's forks — so a design
// option can be judged in numbers before any frame is drawn.
//   node print-route.mjs [nine|despacio] [night-iso ...] [--option=<name>] [--hl=Ana,Ben]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="wall-root"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.CSS = dom.window.CSS;
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.cancelAnimationFrame = () => {};
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const P = await import(join(ROOT, 'js/v3/plan.js'));
const { selectionsDespacio, MEMBERS } = await import('./crew-despacio.mjs');

const args = process.argv.slice(2);
const opt = (k) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
const which = args.find((a) => a === 'nine' || a === 'despacio') || 'despacio';
const nightsWanted = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const festId = opt('fest') || 'portola-2026';
const fest = JSON.parse(readFileSync(join(ROOT, `data/festivals/${festId}.json`), 'utf8'));
const nine = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/plan-crew-nine.json'), 'utf8'));
const picks = which === 'nine' ? nine.picks : selectionsDespacio();
const members = which === 'nine' ? nine.members : MEMBERS;
const highlight = opt('hl') ? opt('hl').split(',') : [];
const folded = opt('fold') ? opt('fold').split(',') : [];

const q = P.quietClock;
const plan = P.planOf(fest, { picks, members, folded, ...(opt('option') ? { dropIn: opt('option') } : {}), ...(highlight.length ? { people: highlight } : {}) });
console.log(`crew=${which} us=${plan.us.length} bar=${plan.bar} option=${opt('option') || '(today)'} hl=${highlight.join(',') || '-'}`);
for (const n of plan.nights) {
  if (nightsWanted.length && !nightsWanted.includes(n.id)) continue;
  const route = plan.night(n.id);
  console.log(`\n== ${n.wd} ${n.id} (${route.stops} stops)`);
  for (const it of route.items) {
    if (it.kind === 'scattered') { console.log(`   ··· ${q(it.from)}–${q(it.to)}`); continue; }
    const what = `${it.place.place}${it.place.kind !== 'room' ? ` (${it.acts[0].name})` : ''}`;
    const extra = it.kind === 'stop' ? '' : ` [${it.kind}]`;
    console.log(`   ${it.tier || ''} ${q(it.from)}–${q(it.to)} ${it.count || ''} ${what}${extra}${it.dropIn ? ' [drop-in]' : ''}  <${(it.people || []).join(',')}>`);
    const f = it.forks ? P.forkFor(it, plan.bar) : null;
    if (f) console.log(`        or ${f.place.place}${f.place.kind !== 'room' ? ` (${f.place.acts[0].name})` : ''} ${q(f.from)}–${q(f.to)} ${f.count}`);
  }
  if (route.dropIns && route.dropIns.length) for (const d of route.dropIns) console.log(`   ~ drop-in line: ${d.place.place} ${q(d.from)}–${q(d.to)} ${d.count} picked <${d.people.join(',')}>`);
}
