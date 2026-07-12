// The ONE definition of a valid person/crew name — imported by BOTH the
// client (join/create forms, FLOW-5) and the server validator
// (api/_lib/crew-shared.mjs). A name the join screen accepts but the server
// rejects used to strand a member local-only, with nothing but a gray sync
// dot to hint why; sharing the rule makes that class of drift impossible.

// Printable, no angle brackets / quotes / backticks / control chars.
// Names end up in HTML and in AI prompts — keep them tame.
export const SAFE_NAME_RE = /^[^\x00-\x1f<>"'`&\\]{1,}$/;

export const NAME_LIMITS = {
  personName: 24,
  crewName: 40,
};

// Keys that would rebind an object's prototype through bracket-assign merges.
export const FORBIDDEN_NAME_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function validName(v, max) {
  return typeof v === 'string' && v.length <= max && SAFE_NAME_RE.test(v)
    && v.trim() === v && !FORBIDDEN_NAME_KEYS.has(v);
}

// Human-facing reason for the join/create forms (null = fine).
export function nameProblem(name, max = NAME_LIMITS.personName) {
  if (!name) return 'Add your name so the crew knows whose picks are whose.';
  if (name.trim() !== name) return 'No spaces at the start or end.';
  if (name.length > max) return `Keep it under ${max} characters.`;
  if (!SAFE_NAME_RE.test(name) || FORBIDDEN_NAME_KEYS.has(name)) {
    return 'Quotes, angle brackets, ampersands and backslashes can’t be in a name.';
  }
  return null;
}
