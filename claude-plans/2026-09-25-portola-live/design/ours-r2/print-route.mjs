// Prints what the round-two OURS model computes for the made-up crew of nine
// on the real Portola file: node print-route.mjs [--fold Folsom,Afters]
// With no flag it prints the whole festival, then the same crew with Folsom
// hidden (rule 8), so the two can be compared.
import { readFileSync } from 'node:fs';
import { oursModel, clock, headlinersOf, shareTextOf } from './ours-model.mjs';
import { selectionsFor, MEMBERS } from './crew.mjs';
const fest = JSON.parse(readFileSync(new URL('../../../../data/festivals/portola-2026.json', import.meta.url), 'utf8'));
const PICKS = selectionsFor(9);
const arg = process.argv.indexOf('--fold');
const runs = arg > 0 ? [process.argv[arg + 1].split(',')] : [[], ['Folsom']];

function print(folded) {
  const m = oursModel(fest, PICKS, MEMBERS, { folded });
  console.log(`\n######## folded=[${folded.join(', ')}]  us=${m.us.length} (${m.us.join(' ')}) bar=${m.bar}`);
  for (const n of m.nights) {
    console.log(`\n== ${n.night}  stops=${n.stops}`);
    for (const it of n.items) {
      if (it.kind === 'scattered') { console.log(`   ···  scattered ${clock(it.from)} – ${clock(it.to)}`); continue; }
      const acts = it.place.kind === 'room' ? headlinersOf(it, PICKS).map((a) => a.name).join(' → ') : it.place.acts[0].name;
      const also = it.alsoAt.length ? `  ALSO: ${it.alsoAt.map((o) => `${o.act} ${o.night} ${o.place} ${clock(o.from)}`).join('; ')}` : '';
      console.log(` ${it.tier.padEnd(4)} ${clock(it.from).padStart(8)} – ${clock(it.to).padEnd(8)} ${String(it.count).padStart(2)} ${acts} @ ${it.place.place} [${it.people.join(',')}] musts=${it.musts} maybe=${it.maybe.length}${also}`);
      for (const f of it.forks) console.log(`         fork ${clock(f.from)}–${clock(f.to)} ${f.count} @ ${f.place.place} ${f.place.acts.length === 1 ? f.place.acts[0].name : ''} [${f.people.join(',')}]`);
    }
  }
  for (const [night, min] of [['Sat', 11 * 60], ['Sat', 21 * 60 + 40], ['Sun', 14 * 60]]) {
    console.log(`\n--- share, ${night} ${clock(min)} ---\n` + shareTextOf(m, fest, PICKS, night, min));
  }
  return m;
}
for (const f of runs) print(f);
