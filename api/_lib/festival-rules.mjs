// The festival-document rules, as a pure module — the SINGLE source of truth
// consumed by BOTH scripts/validate-festivals.mjs (CI) and api/festival-add.js
// (LLM-researched candidates). If a rule changes, it changes here once.
import { timeToMinutes } from '../../js/time.js';

export const SLUG_RE = /^[a-z0-9-]{1,64}$/;
export const ACCENT_RE = /^\d{1,3}, \d{1,3}, \d{1,3}$/;
export const STATUSES = ['lineup', 'scheduled', 'archived'];
export const TIME_RE = /^\d{1,2}(:\d{2})? (AM|PM)( - (\d{1,2}(:\d{2})? (AM|PM)|Close))?$/i;

// Validate one festival document. `filename` is optional (CI passes it to
// enforce filename-matches-id; API candidates have no file).
export function validateFestivalDoc(fest, { filename } = {}) {
  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);
  const warn = (msg) => warnings.push(msg);

  if (!fest || typeof fest !== 'object' || Array.isArray(fest)) {
    return { errors: ['festival must be an object'], warnings };
  }
  if (!fest.id || !SLUG_RE.test(fest.id)) err(`bad id ${JSON.stringify(fest.id)}`);
  if (filename && filename !== `${fest.id}.json`) err(`filename must match id (${fest.id}.json)`);
  if (!fest.name) err('missing name');
  if (!STATUSES.includes(fest.status)) err(`status must be one of ${STATUSES.join('|')}`);
  if (fest.accent && !ACCENT_RE.test(fest.accent)) err(`accent must be "R, G, B" (got ${fest.accent})`);
  if (!Array.isArray(fest.artists)) err('artists[] must be an array');
  else if (fest.artists.length === 0) {
    if (fest.status === 'lineup') warn('empty lineup (festival announced but no artists yet)');
    else err(`artists[] must be non-empty for status=${fest.status}`);
  }

  const artistNames = new Set();
  (Array.isArray(fest.artists) ? fest.artists : []).forEach((a, i) => {
    if (!a || !a.name || typeof a.name !== 'string') err(`artists[${i}]: missing name`);
    else {
      const key = a.name.toUpperCase();
      if (artistNames.has(key)) warn(`duplicate artist in artists[]: ${a.name}`);
      artistNames.add(key);
    }
    if (a && a.time && !TIME_RE.test(a.time)) err(`artists[${i}] (${a.name}): unparseable time ${JSON.stringify(a.time)}`);
    if (a && a.weekends && !['W1', 'W2', 'both'].includes(a.weekends)) err(`artists[${i}] (${a.name}): weekends must be W1|W2|both`);
  });

  if (fest.status === 'scheduled') {
    if (!fest.days || Object.keys(fest.days).length === 0) {
      err('scheduled festival needs days{}');
      return { errors, warnings };
    }
    for (const [label, day] of Object.entries(fest.days)) {
      if (!Array.isArray(day.stages) || !day.stages.length) err(`${label}: missing stages[]`);
      if (!Array.isArray(day.artists) || !day.artists.length) { err(`${label}: missing artists[]`); continue; }
      day.artists.forEach((a, i) => {
        if (!a.name) err(`${label}.artists[${i}]: missing name`);
        if (!a.stage) err(`${label}.artists[${i}] (${a.name}): missing stage`);
        else if (!day.stages.includes(a.stage)) err(`${label}.artists[${i}] (${a.name}): stage ${JSON.stringify(a.stage)} not in day stages`);
        if (!a.time || !TIME_RE.test(a.time)) err(`${label}.artists[${i}] (${a.name}): bad time ${JSON.stringify(a.time)}`);
        else { try { timeToMinutes(a.time.split(' - ')[0]); } catch { err(`${label}.artists[${i}]: time did not parse`); } }
        if (a.name && !artistNames.has(a.name.toUpperCase())) warn(`${label}: ${a.name} plays but is missing from artists[]`);
      });
      if (fest.dayMeta && !fest.dayMeta[label]) warn(`dayMeta missing entry for ${label}`);
    }
  }

  if (fest.activities) {
    for (const [label, list] of Object.entries(fest.activities)) {
      if (!Array.isArray(list)) { err(`activities.${label} must be an array`); continue; }
      list.forEach((a, i) => {
        if (!a.name || !a.time || !a.venue) err(`activities.${label}[${i}]: needs name, time, venue`);
      });
    }
  }

  return { errors, warnings };
}
