// Person records (the "me link"): the validator is the shape gate for a doc
// whose token is a MASTER KEY — its crews registry holds every crew token the
// person is in. These tests pin: what a person doc may contain, that v and
// createdAt are not client-writable, and that the only person identifier a
// CREW doc may carry is the public pid (never the token).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newPersonDoc, validatePersonIncoming, validateIncoming, PID_RE,
} from '../api/_lib/crew-shared.mjs';

const CREW_TOKEN = 'crewtoken_test_0123456789';

test('newPersonDoc shape: v1, name, empty crews registry', () => {
  const doc = newPersonDoc('Kevin', '2026-07-13T00:00:00Z');
  assert.deepEqual(doc, { v: 1, name: 'Kevin', createdAt: '2026-07-13T00:00:00Z', crews: {} });
});

test('a name claim and a crews entry pass', () => {
  assert.equal(validatePersonIncoming({ name: 'Kevin' }).ok, true);
  assert.equal(validatePersonIncoming({
    crews: { [CREW_TOKEN]: { name: 'Kevin', crewName: 'Electric Forest 26' } },
  }).ok, true);
});

test('v and createdAt are not client-writable, unknown sections rejected', () => {
  assert.equal(validatePersonIncoming({ v: 2 }).ok, false);
  assert.equal(validatePersonIncoming({ createdAt: '2020-01-01' }).ok, false);
  assert.equal(validatePersonIncoming({ library: {} }).ok, false, 'Phase 2 section is not open yet');
});

test('crews registry: bad token keys and unknown entry keys are refused', () => {
  assert.equal(validatePersonIncoming({ crews: { short: { name: 'K' } } }).ok, false);
  assert.equal(validatePersonIncoming({ crews: { [CREW_TOKEN]: { token: 'x'.repeat(27) } } }).ok, false,
    'no nested credential smuggling');
  assert.equal(validatePersonIncoming({ crews: { [CREW_TOKEN]: ['K'] } }).ok, false);
  assert.equal(validatePersonIncoming({ crews: [] }).ok, false);
});

test('prototype-rebinding keys never validate', () => {
  const evil = JSON.parse('{"crews": {"__proto__": {"name": "x"}}}');
  assert.equal(validatePersonIncoming(evil).ok, false);
});

test('crew docs accept pid — and only a plausible one', () => {
  assert.equal(validateIncoming({ people: { Kevin: { pid: 'pid_abc12345' } } }).ok, true);
  assert.equal(validateIncoming({ people: { Kevin: { pid: 'no' } } }).ok, false, 'too short');
  assert.equal(validateIncoming({ people: { Kevin: { pid: 'x'.repeat(30) } } }).ok, false, 'too long');
  // A person TOKEN (20-40 chars) must not fit where a pid belongs — the regex
  // caps at 24, so a full-length 27-char token is structurally rejected.
  assert.equal(PID_RE.test('a'.repeat(27)), false);
});
