// What a crash report may say, pinned (v88, 2026-09-24). js/errlog.js is the
// app's one door out, and every string that can leave the phone — an error's
// message, each stack frame's function and path, and the local journal that
// Diagnostics hands to a person to paste — passes through scrubText(). The
// rule with teeth: never a crew token, the person token, a URL's query or
// hash, or a quoted snippet of a document (which is where note text lives).
//
// Tokens here are made the way the SERVER makes them (api/crew.js,
// api/person.js: randomBytes(20) as base64url, 27 characters; the public pid
// is randomBytes(9), 12 characters), fresh on every run, so the scrubber is
// tested against real shapes and no real-shaped token is ever committed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://fest.kevinhg.com/' });
globalThis.window = dom.window;

const { scrubText, parseStack, MARK } = await import('../js/errlog.js');

const crewToken = () => randomBytes(20).toString('base64url');
const pid = () => randomBytes(9).toString('base64url');

// No piece of the token survives: not whole, and not any ten characters of it.
function assertGone(out, token, where) {
  assert.ok(!out.includes(token), `${where}: the token itself survived`);
  for (let i = 0; i + 10 <= token.length; i++) {
    assert.ok(!out.includes(token.slice(i, i + 10)), `${where}: a 10-character piece of the token survived (${out})`);
  }
}

test('real token shapes are cut out wherever they sit — a thousand of them, with nothing known in advance', () => {
  for (let i = 0; i < 1000; i++) {
    const t = crewToken();
    const contexts = [
      t,
      `crew ${t} missing`,
      `https://fest.kevinhg.com/#g=${t}`,
      `https://fest.kevinhg.com/f/portola-2026#g=${t}&f=portola-2026&me=Ross`,
      `/api/crew?t=${t}&op=migrate`,
      `/api/festival-add?t=${encodeURIComponent(t)}`,
      `https://fest.kevinhg.com/#p=${t}`,
      `Setting the value of 'fn_me_v3_${t}' exceeded the quota.`,
      `key fn_crew_doc_v3_${t}`,
      `"${t}"`,
      `(${t})`,
      `%23g%3D${t}`,
      `token:${t},next`,
    ];
    for (const c of contexts) assertGone(scrubText(c, []), t, c.replace(t, '<t>'));
  }
});

test('a token with no digits and camel-case humps is still a token — there is no identifier exemption', () => {
  // About 7 in 100,000 random tokens look like this; an exemption for
  // camelCase would let exactly those through (BUILD.md decision 6).
  const camel = 'getBoundingClientRectFromUs'; // 27 characters, token-shaped
  assert.equal(scrubText(camel, []), MARK.token);
  assert.equal(scrubText('getBoundingClientRect is not a function', []), `${MARK.token} is not a function`, 'the accepted cost: long identifiers go too');
});

test('the device\'s own secrets go by exact match, even below the token-shape length', () => {
  const short = 'Sh0rtSecret_42ab'; // 16 characters: the shape rule alone would keep it
  assert.equal(scrubText(`saw ${short} here`, [short]), `saw ${MARK.token} here`);
  assert.equal(scrubText(`saw ${short} here`, []), `saw ${short} here`, 'known only to the exact layer');
});

test('the public pid rides along — PID_RE\'s range is disjoint from every token\'s', () => {
  for (let i = 0; i < 200; i++) {
    const p = pid();
    assert.equal(p.length, 12);
    assert.equal(scrubText(`person ${p} on v88`, []), `person ${p} on v88`);
  }
});

test('a URL keeps its host and path; its query and hash never leave', () => {
  const t = crewToken();
  assert.equal(scrubText(`GET https://fest.kevinhg.com/f/portola-2026#g=${t}&f=portola-2026 failed`, []), 'GET https://fest.kevinhg.com/f/portola-2026 failed');
  assert.equal(scrubText(`https://api.spotify.com/v1/me/following?type=artist&after=0Z9 404`, []), 'https://api.spotify.com/v1/me/following 404');
  assert.equal(scrubText(`fetch /api/crew?t=${t} timed out`, []), `fetch /api/crew${MARK.param} timed out`);
  assert.equal(scrubText('opened #new', []), 'opened #new', 'a hash with no value is not a parameter');
});

test('a JSON parse message loses its quoted snippet — the bad input can be a crew doc with notes in it', () => {
  // V8 quotes a window of the input around the bad character.
  const v8 = 'Unexpected token \'m\', "meet at the ferris wheel at 9" is not valid JSON';
  const out = scrubText(v8, []);
  assert.ok(!/ferris|wheel|meet/.test(out), out);
  assert.equal(out, `Unexpected token 'm', "${MARK.text}" is not valid JSON`);
  const windowed = 'Unexpected non-whitespace character after JSON at position 9: ..."text":"see you by the pier"}x"... is not valid JSON';
  assert.ok(!/pier|see you/.test(scrubText(windowed, [])));
  const lone = 'JSON Parse error: Unterminated string "back by the ferris';
  assert.ok(!/ferris|back by/.test(scrubText(lone, [])), 'a lone quote takes everything after it');
  // Outside a JSON message, quotes are code (Firefox quotes property names).
  assert.equal(scrubText('can\'t access property "people", doc is undefined', []), 'can\'t access property "people", doc is undefined');
});

test('email addresses never ride along', () => {
  assert.equal(scrubText('access request for kevin@example.com failed', []), `access request for ${MARK.email} failed`);
});

// ---- stacks ----------------------------------------------------------------
test('a V8 stack becomes path-only frames, outermost first, with a token nowhere in them', () => {
  const t = crewToken();
  const stack = [
    'TypeError: Cannot read properties of undefined (reading \'people\')',
    '    at activateCrew (https://fest.kevinhg.com/js/state.js:87:41)',
    '    at enterApp (https://fest.kevinhg.com/js/v3/app.js:2366:11)',
    '    at async boot (https://fest.kevinhg.com/js/v3/app.js:2731:5)',
    `    at https://fest.kevinhg.com/f/portola-2026#g=${t}&f=portola-2026:281:7`,
    `    at Object.${t} (https://fest.kevinhg.com/js/crew.js?t=${t}:3:1)`,
    '    at Array.forEach (<anonymous>)',
    '    at html2canvas (https://fest.kevinhg.com/vendor/html2canvas.min.js:20:9941)',
    '    at chrome-extension://abcdefghijklmnopabcdefghijklmnop/inject.js:1:2',
  ].join('\n');
  const frames = parseStack(stack, []);
  assertGone(JSON.stringify(frames), t, 'V8 frames');
  assert.deepEqual(frames.map((f) => f.filename), [
    'chrome-extension:', '/vendor/html2canvas.min.js', '/js/crew.js', '/f/portola-2026', '/js/v3/app.js', '/js/v3/app.js', '/js/state.js',
  ], 'outermost first, the throw last; `(<anonymous>)` has no place to point at and is dropped');
  const top = frames[frames.length - 1];
  assert.deepEqual(top, { platform: 'custom', lang: 'javascript', function: 'activateCrew', filename: '/js/state.js', in_app: true, lineno: 87, colno: 41 });
  assert.equal(frames.find((f) => f.filename === '/vendor/html2canvas.min.js').in_app, false, 'a vendor file is not ours');
  assert.equal(frames[0].in_app, false, 'an extension is not ours');
  assert.equal(frames.find((f) => f.filename === '/js/crew.js').function, `Object.${MARK.token}`);
});

test('a WebKit stack (Safari, and Firefox\'s shape) parses the same way', () => {
  const t = crewToken();
  const stack = [
    'activateCrew@https://fest.kevinhg.com/js/state.js:87:41',
    'enterApp@https://fest.kevinhg.com/js/v3/app.js:2366:11',
    '@https://fest.kevinhg.com/js/v3/app.js:2731:5',
    'forEach@[native code]',
    `module code@https://fest.kevinhg.com/#g=${t}:3:9`,
  ].join('\n');
  const frames = parseStack(stack, []);
  assertGone(JSON.stringify(frames), t, 'WebKit frames');
  assert.deepEqual(frames.map((f) => [f.function, f.filename, f.lineno || null]), [
    ['module code', '/', 3],
    ['forEach', '[native code]', null],
    ['?', '/js/v3/app.js', 2731],
    ['enterApp', '/js/v3/app.js', 2366],
    ['activateCrew', '/js/state.js', 87],
  ]);
});

test('a line that parses as nothing is dropped, never sent raw', () => {
  const t = crewToken();
  assert.deepEqual(parseStack(`Error: boom #g=${t}\nsomething odd ${t}\n`, []), []);
  assert.deepEqual(parseStack(null, []), []);
});
