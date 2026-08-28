// An error body's message, whatever shape it came in (UI walk, 2026-08-27):
// Vercel's deployment-protection wall answers /api calls with
// {error: {message, code}}, and `new Error(body.error)` on that object
// rendered "[object Object]" under the create form. Every place a response
// body becomes a message goes through errorText now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { errorText } from '../js/util.js';

test('errorText: our own string errors pass through; objects give message (code); junk gives the fallback', () => {
  assert.equal(errorText({ error: 'Crew not found' }, 'x'), 'Crew not found');
  assert.equal(errorText({ error: { message: 'Protected deployment', code: '401' } }, 'x'), 'Protected deployment (401)');
  assert.equal(errorText({ error: { message: 'Nope' } }, 'x'), 'Nope');
  assert.equal(errorText({ error: { code: 500 } }, 'x'), 'x', 'a code with no message is not a message');
  assert.equal(errorText({ error: '' }, 'x'), 'x');
  assert.equal(errorText({}, 'x'), 'x');
  assert.equal(errorText(null, 'x'), 'x');
  assert.equal(errorText({ error: 42 }, 'x'), 'x');
});

test('createCrew never throws "[object Object]" — a protection wall reads as its message', async () => {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Protected deployment', code: '401' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const crew = await import('../js/crew.js');
    await assert.rejects(() => crew.createCrew('Portola 26', 'zz', { colorIndex: 0 }, 'portola-2026'), (e) => {
      assert.equal(e.message, 'Protected deployment (401)');
      return true;
    });
  } finally {
    globalThis.fetch = origFetch;
  }
});
