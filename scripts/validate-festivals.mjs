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

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'festivals');

const errors = [];
const warnings = [];

if (!existsSync(DIR)) {
  console.log('No data/festivals/ directory yet — nothing to validate.');
  process.exit(0);
}

const files = readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'index.json');
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const indexIds = new Set(index.map((e) => e.id));

for (const file of files) {
  let fest;
  try { fest = JSON.parse(readFileSync(join(DIR, file), 'utf8')); }
  catch (e) { errors.push(`${file}: invalid JSON: ${e.message}`); continue; }
  const r = validateFestivalDoc(fest, { filename: file });
  errors.push(...r.errors.map((m) => `${file}: ${m}`));
  warnings.push(...r.warnings.map((m) => `${file}: ${m}`));
  if (!indexIds.has(fest.id)) errors.push(`${file}: festival not listed in index.json`);
}
for (const entry of index) {
  if (!files.includes(`${entry.id}.json`)) errors.push(`index.json: lists ${entry.id} but ${entry.id}.json missing`);
  for (const k of ['id', 'name', 'status']) if (!entry[k]) errors.push(`index.json: ${entry.id || '?'}: missing ${k}`);
  // startsOn drives the landing's date sort and its "Sep '26" labels —
  // free-text `dates` can't be sorted, so the ISO key is required.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.startsOn || '')) {
    errors.push(`index.json: ${entry.id || '?'}: startsOn must be YYYY-MM-DD`);
  }
}

warnings.forEach((w) => console.log(`⚠️  ${w}`));
errors.forEach((e) => console.log(`❌ ${e}`));
console.log(`\n${files.length} festival file(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
