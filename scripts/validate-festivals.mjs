#!/usr/bin/env node
// Validate data/festivals/*.json against the festival schema.
// Run:  node scripts/validate-festivals.mjs        (errors exit 1; warnings don't)
// Used by CI and by scripts/import-festival.mjs.
// The rules themselves live in api/_lib/festival-rules.mjs (single source of
// truth, shared with the /api/festival-add candidate validation).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';
import { frozenKeyProblems, artistNamesOf, dayLabelsOf } from '../api/_lib/pick-keys.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'data', 'festivals');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'live-pick-keys.json');

const errors = [];
const warnings = [];

if (!existsSync(DIR)) {
  console.log('No data/festivals/ directory yet — nothing to validate.');
  process.exit(0);
}

const files = readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'index.json');
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const indexIds = new Set(index.map((e) => e.id));
const indexed = new Map(index.map((e) => [e.id, e]));

// The pick-key freeze (api/_lib/pick-keys.mjs): a live festival's id, artist
// names and day labels are the strings every crew's picks and notes hang off,
// and the crew doc cannot rename a key. This is the same check
// tests/live-pick-keys.test.mjs runs — repeated here so the ONE command every
// data-editing session is told to run catches a rename without the full suite.
let frozen = { festivals: {} };
try { frozen = JSON.parse(readFileSync(FIXTURE, 'utf8')); }
catch (e) { errors.push(`tests/fixtures/live-pick-keys.json unreadable: ${e.message}`); }

for (const file of files) {
  let fest;
  try { fest = JSON.parse(readFileSync(join(DIR, file), 'utf8')); }
  catch (e) { errors.push(`${file}: invalid JSON: ${e.message}`); continue; }
  const r = validateFestivalDoc(fest, { filename: file });
  errors.push(...r.errors.map((m) => `${file}: ${m}`));
  warnings.push(...r.warnings.map((m) => `${file}: ${m}`));
  const listed = indexed.get(fest.id);
  if (!listed) errors.push(`${file}: festival not listed in index.json`);
  // index.json repeats a few of the file's fields for the landing. Status is
  // behaviour there (ordering, the default festival, muting), so a drift is an
  // error; name and accent are only looks. The display `dates` are free text
  // that already differ in punctuation, and nothing reads them as data.
  else {
    if (listed.status !== fest.status) errors.push(`${file}: status ${JSON.stringify(fest.status)} but index.json says ${JSON.stringify(listed.status)} — the landing reads index.json; change both`);
    for (const k of ['name', 'accent']) {
      if (listed[k] !== fest[k]) warnings.push(`${file}: ${k} ${JSON.stringify(fest[k])} but index.json says ${JSON.stringify(listed[k])}`);
    }
  }
  const entry = frozen.festivals && frozen.festivals[fest.id];
  if (entry) {
    errors.push(...frozenKeyProblems(fest, entry, { indexIds }).map((m) => `${file}: FROZEN KEY — ${m}`));
    // …and the freeze must hold every key the file exposes. A name added
    // without a re-freeze is pickable at once, and nothing would notice it
    // being renamed (Buck Wilson, added 2026-09-01 and never frozen).
    const names = new Set(entry.names || []);
    const days = new Set(entry.days || []);
    const fresh = [...artistNamesOf(fest).filter((n) => !names.has(n)), ...dayLabelsOf(fest).filter((d) => !days.has(d))];
    if (fresh.length) errors.push(`${file}: not frozen yet: ${fresh.map((k) => JSON.stringify(k)).join(', ')} — crews can pick ${fresh.length === 1 ? 'it' : 'them'} now, so a rename would go unnoticed; run node scripts/freeze-pick-keys.mjs ${fest.id}`);
  } else if (fest.status !== 'archived') {
    errors.push(`${file}: live festival has no pick-key freeze — real people may be picking in it. Run: node scripts/freeze-pick-keys.mjs ${fest.id}`);
  }
}
for (const id of Object.keys((frozen.festivals) || {})) {
  if (!indexIds.has(id)) errors.push(`tests/fixtures/live-pick-keys.json: ${id} is frozen (live crews pick in it) but is no longer in index.json — ids never change`);
}
for (const entry of index) {
  if (!files.includes(`${entry.id}.json`)) errors.push(`index.json: lists ${entry.id} but ${entry.id}.json missing`);
  for (const k of ['id', 'name', 'status']) if (!entry[k]) errors.push(`index.json: ${entry.id || '?'}: missing ${k}`);
  // startsOn drives the landing's date sort and its "Sep '26" labels —
  // free-text `dates` can't be sorted, so the ISO key is required, and it
  // must be a REAL calendar date (2026-99-99 sorts lexically and months
  // beyond Dec render as no month at all — shape alone isn't enough).
  const so = entry.startsOn || '';
  const parsed = new Date(`${so}T00:00:00Z`);
  const roundTrips = /^\d{4}-\d{2}-\d{2}$/.test(so)
    && !Number.isNaN(parsed.getTime()) // guard BEFORE toISOString — an invalid date THROWS there
    && parsed.toISOString().slice(0, 10) === so;
  if (!roundTrips) {
    errors.push(`index.json: ${entry.id || '?'}: startsOn must be a real YYYY-MM-DD date`);
  }
}

warnings.forEach((w) => console.log(`⚠️  ${w}`));
errors.forEach((e) => console.log(`❌ ${e}`));
console.log(`\n${files.length} festival file(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
