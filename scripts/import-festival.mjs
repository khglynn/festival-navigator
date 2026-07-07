#!/usr/bin/env node
// Convert a pasted lineup (one artist per line) into a festival JSON skeleton.
//
//   node scripts/import-festival.mjs --id my-fest-2026 --name "My Fest" \
//     --dates "Oct 2-4, 2026" --location "Austin, TX" < lineup.txt
//
// Line formats accepted:
//   Artist Name
//   Artist Name | Friday
//   Artist Name | Friday | W1        (two-weekend festivals)
// Writes data/festivals/<id>.json, then reminds you to add the index entry
// and run the validator.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : dflt;
};
const id = flag('id');
if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) {
  console.error('Usage: node scripts/import-festival.mjs --id my-fest-2026 --name "My Fest" [--dates ..] [--location ..] [--accent "R, G, B"] < lineup.txt');
  process.exit(1);
}

const lines = readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const seen = new Set();
const artists = [];
for (const line of lines) {
  const [name, day, weekends] = line.split('|').map((p) => p.trim());
  if (!name || seen.has(name.toUpperCase())) continue;
  seen.add(name.toUpperCase());
  const a = { name };
  if (day) a.day = day;
  if (weekends) a.weekends = weekends;
  artists.push(a);
}
if (!artists.length) { console.error('No artists on stdin — paste the lineup, one per line.'); process.exit(1); }

const fest = {
  id,
  name: flag('name', id),
  year: flag('year', `'${new Date().getFullYear() % 100}`),
  subtitle: flag('subtitle', ''),
  location: flag('location', ''),
  dates: flag('dates', ''),
  accent: flag('accent', '16, 185, 129'),
  status: 'lineup',
  artists,
};

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'festivals', `${id}.json`);
if (existsSync(out) && !args.includes('--force')) {
  console.error(`${out} exists — pass --force to overwrite.`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(fest, null, 2) + '\n');
console.log(`Wrote ${out} (${artists.length} artists).`);
console.log('Next: add an entry to data/festivals/index.json (date order, archived last),');
console.log('then: node scripts/validate-festivals.mjs');
