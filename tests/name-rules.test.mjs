// FLOW-5 regression: the form's rule IS the server's rule — a name the UI
// accepts must pass the validator, and a name the validator rejects must be
// caught by the form. Both sides import js/name-rules.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { nameProblem, NAME_LIMITS } from '../js/name-rules.mjs';
import { validateIncoming } from '../api/_lib/crew-shared.mjs';

const serverAccepts = (name) =>
  validateIncoming({ people: { [name]: { colorIndex: 0 } } }).ok;

test('form and server agree on every probe name', () => {
  const probes = [
    'Kevin', 'Aoife Ní Bhraonáin', 'J.R.', 'D-Rock', 'ünïcodé', '🎪',
    "O'Brien", 'Quote"y', 'Back\\slash', 'Tick`er', 'Amp&ersand', '<script>',
    ' leading', 'trailing ', 'x'.repeat(NAME_LIMITS.personName + 1),
    '__proto__', 'constructor',
  ];
  for (const name of probes) {
    const formOk = nameProblem(name) === null;
    assert.equal(formOk, serverAccepts(name), `form/server disagree on ${JSON.stringify(name)}`);
  }
});

test('the classic FLOW-5 case: apostrophes are told no at the form', () => {
  assert.notEqual(nameProblem("O'Brien"), null);
  assert.equal(serverAccepts("O'Brien"), false);
});
