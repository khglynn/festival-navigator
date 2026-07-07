#!/usr/bin/env node
// Validate data/festivals/*.json against the v3 festival schema.
// Run:  node scripts/validate-festivals.mjs        (errors exit 1; warnings don't)
// Used by CI and by scripts/import-festival.mjs.
//
// Schema summary (v3):
//   id: slug matching filename · status: lineup|scheduled|archived
//   artists[] ALWAYS present: [{name, day?, stage?, time?, note?}]
//   scheduled festivals also have: stages[], dayMeta{}, days{label:{stages[], artists[{name,stage,time}]}}
//   optional: activities{label:[{name,time,venue}]}, accent "R, G, B", dayStartHour
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeToMinutes } from '../js/time.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'festivals');
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const ACCENT_RE = /^\d{1,3}, \d{1,3}, \d{1,3}$/;
const STATUSES = ['lineup', 'scheduled', 'archived'];
const TIME_RE = /^\d{1,2}(:\d{2})? (AM|PM)( - (\d{1,2}(:\d{2})? (AM|PM)|Close))?$/i;

const errors = [];
const warnings = [];
const err = (f, msg) => errors.push(`${f}: ${msg}`);
const warn = (f, msg) => warnings.push(`${f}: ${msg}`);

function validateFestival(file, fest) {
  const f = file;
  if (!fest.id || !SLUG_RE.test(fest.id)) err(f, `bad id ${JSON.stringify(fest.id)}`);
  if (file !== `${fest.id}.json`) err(f, `filename must match id (${fest.id}.json)`);
  if (!fest.name) err(f, 'missing name');
  if (!STATUSES.includes(fest.status)) err(f, `status must be one of ${STATUSES.join('|')}`);
  if (fest.accent && !ACCENT_RE.test(fest.accent)) err(f, `accent must be "R, G, B" (got ${fest.accent})`);
  if (!Array.isArray(fest.artists)) err(f, 'artists[] must be an array');
  else if (fest.artists.length === 0) {
    if (fest.status === 'lineup') warn(f, 'empty lineup (festival announced but no artists yet)');
    else err(f, `artists[] must be non-empty for status=${fest.status}`);
  }

  const artistNames = new Set();
  (fest.artists || []).forEach((a, i) => {
    if (!a.name || typeof a.name !== 'string') err(f, `artists[${i}]: missing name`);
    else {
      const key = a.name.toUpperCase();
      if (artistNames.has(key)) warn(f, `duplicate artist in artists[]: ${a.name}`);
      artistNames.add(key);
    }
    if (a.time && !TIME_RE.test(a.time)) err(f, `artists[${i}] (${a.name}): unparseable time ${JSON.stringify(a.time)}`);
    if (a.weekends && !['W1', 'W2', 'both'].includes(a.weekends)) err(f, `artists[${i}] (${a.name}): weekends must be W1|W2|both`);
  });

  if (fest.status === 'scheduled') {
    if (!fest.days || Object.keys(fest.days).length === 0) { err(f, 'scheduled festival needs days{}'); return; }
    for (const [label, day] of Object.entries(fest.days)) {
      if (!Array.isArray(day.stages) || !day.stages.length) err(f, `${label}: missing stages[]`);
      if (!Array.isArray(day.artists) || !day.artists.length) { err(f, `${label}: missing artists[]`); continue; }
      day.artists.forEach((a, i) => {
        if (!a.name) err(f, `${label}.artists[${i}]: missing name`);
        if (!a.stage) err(f, `${label}.artists[${i}] (${a.name}): missing stage`);
        else if (!day.stages.includes(a.stage)) err(f, `${label}.artists[${i}] (${a.name}): stage ${JSON.stringify(a.stage)} not in day stages`);
        if (!a.time || !TIME_RE.test(a.time)) err(f, `${label}.artists[${i}] (${a.name}): bad time ${JSON.stringify(a.time)}`);
        else { try { timeToMinutes(a.time.split(' - ')[0]); } catch { err(f, `${label}.artists[${i}]: time did not parse`); } }
        // Every scheduled set's artist should appear in the top-level artists[] (list view source of truth).
        if (a.name && !artistNames.has(a.name.toUpperCase())) warn(f, `${label}: ${a.name} plays but is missing from artists[]`);
      });
      if (fest.dayMeta && !fest.dayMeta[label]) warn(f, `dayMeta missing entry for ${label}`);
    }
  }

  if (fest.activities) {
    for (const [label, list] of Object.entries(fest.activities)) {
      if (!Array.isArray(list)) { err(f, `activities.${label} must be an array`); continue; }
      list.forEach((a, i) => {
        if (!a.name || !a.time || !a.venue) err(f, `activities.${label}[${i}]: needs name, time, venue`);
      });
    }
  }
}

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
  catch (e) { err(file, `invalid JSON: ${e.message}`); continue; }
  validateFestival(file, fest);
  if (!indexIds.has(fest.id)) err(file, 'festival not listed in index.json');
}
for (const entry of index) {
  if (!files.includes(`${entry.id}.json`)) err('index.json', `lists ${entry.id} but ${entry.id}.json missing`);
  for (const k of ['id', 'name', 'status']) if (!entry[k]) err('index.json', `${entry.id || '?'}: missing ${k}`);
}

warnings.forEach((w) => console.log(`⚠️  ${w}`));
errors.forEach((e) => console.log(`❌ ${e}`));
console.log(`\n${files.length} festival file(s): ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
