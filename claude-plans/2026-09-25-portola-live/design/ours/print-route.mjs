// Prints what the OURS model computes for the made-up crew on the real
// Portola file: node print-route.mjs
import { readFileSync } from 'node:fs';
import { oursModel, clock, headlinersOf } from './ours-model.mjs';
import { SELECTIONS, MEMBERS } from './crew.mjs';
const fest = JSON.parse(readFileSync(new URL('../../../../data/festivals/portola-2026.json', import.meta.url), 'utf8'));
const m = oursModel(fest, SELECTIONS, MEMBERS);
console.log(`us=${m.us.length} (${m.us.join(' ')}) bar=${m.bar}`);
for (const n of m.nights) {
  console.log(`\n== ${n.night}  stops=${n.stops}`);
  for (const it of n.items) {
    if (it.kind === 'scattered') { console.log(`   ···  scattered ${clock(it.from)} – ${clock(it.to)}`); continue; }
    const acts = it.place.kind === 'room' ? headlinersOf(it, SELECTIONS).map((a) => a.name).join(' → ') : it.place.acts[0].name;
    console.log(` ${it.tier.padEnd(4)} ${clock(it.from).padStart(8)} – ${clock(it.to).padEnd(8)} ${String(it.count).padStart(2)} ${acts} @ ${it.place.place} [${it.people.join(',')}] musts=${it.musts}`);
    for (const f of it.forks) console.log(`         fork ${clock(f.from)}–${clock(f.to)} ${f.count} @ ${f.place.place} ${f.place.acts.length === 1 ? f.place.acts[0].name : ''} [${f.people.join(',')}]`);
  }
}

import { shareTextOf } from './ours-model.mjs';
console.log('\n--- share, Sat 9:40 PM ---\n' + shareTextOf(m, fest, SELECTIONS, 'Sat', 21 * 60 + 40));
console.log('\n--- share, Sat morning ---\n' + shareTextOf(m, fest, SELECTIONS, 'Sat', 11 * 60));
console.log('\n--- share, Fri 5:30 PM ---\n' + shareTextOf(m, fest, SELECTIONS, 'Fri', 17 * 60 + 30));
console.log('\n--- share, Thu ---\n' + JSON.stringify(shareTextOf(m, fest, SELECTIONS, 'Thu', 23 * 60)));
