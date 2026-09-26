// The schedule-export reader (api/import-schedule.js, 2026-09-26): its
// guards, with neither a database nor a model — both are passed in — and the
// one change to guard.mjs's callGemini (an optional image part and schema),
// with fetch stubbed so the exact request body is on the table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeImportHandler, imageFrom, sniffImage, shapeRead, MAX_IMAGE_BYTES, READ_SCHEMA,
} from '../api/import-schedule.js';
import { callGemini } from '../api/_lib/guard.mjs';

const TOKEN = 'crewtoken_test_0123456789';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(200, 2)]);
const HEIC = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(200, 3)]);
const TEXT = Buffer.from('Despacio 2:45PM - 9:45PM DESPACIO '.repeat(10));

let ipSeq = 0;
function call(handler, { method = 'POST', headers = {}, body, ip } = {}) {
  const req = {
    method,
    headers: { host: 'fest.kevinhg.com', 'x-forwarded-for': ip || `10.0.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`, ...headers },
    body,
  };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {}, body: undefined,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(o) { this.body = o; resolve(this); return this; },
      end() { resolve(this); return this; },
    };
    Promise.resolve(handler(req, res)).then(() => resolve(res));
  });
}
const withCrew = (extra = {}) => ({ 'x-crew-token': TOKEN, ...extra });
const READ = { festival: 'Portola', day: 'Saturday 9/26', items: [{ name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO' }] };

function rig({ crew = true, read = READ } = {}) {
  const calls = { crew: [], read: [] };
  const handler = makeImportHandler({
    crewExists: async (t) => { calls.crew.push(t); return crew; },
    readImage: async (img) => { calls.read.push(img); return typeof read === 'function' ? read(img) : { read }; },
  });
  return { handler, calls };
}

test('preflight, cross-site and method are refused before anything is read', async () => {
  const { handler, calls } = rig();
  assert.equal((await call(handler, { method: 'OPTIONS' })).statusCode, 204);
  assert.equal((await call(handler, { headers: withCrew({ origin: 'https://evil.example' }), body: { image: JPEG.toString('base64') } })).statusCode, 403);
  assert.equal((await call(handler, { method: 'GET', headers: withCrew() })).statusCode, 405);
  assert.equal(calls.crew.length + calls.read.length, 0);
});

test('a crew is required: no token, a malformed one, or one the store does not know is a 401 — and the model is never asked', async () => {
  const known = rig();
  for (const headers of [{}, { 'x-crew-token': 'short' }, { 'x-crew-token': 'has spaces in it and is long enough' }]) {
    const r = await call(known.handler, { headers, body: { image: JPEG.toString('base64') } });
    assert.equal(r.statusCode, 401, JSON.stringify(headers));
  }
  assert.equal(known.calls.crew.length, 0, 'a malformed token never reaches the store');
  const stranger = rig({ crew: false });
  const r = await call(stranger.handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } });
  assert.equal(r.statusCode, 401);
  assert.deepEqual(stranger.calls.crew, [TOKEN]);
  assert.equal(stranger.calls.read.length, 0, 'a stranger never spends the model');
});

test('the token rides a header, never the query', async () => {
  const { handler, calls } = rig();
  const req = { method: 'POST', headers: { host: 'x', 'x-forwarded-for': '10.9.9.9' }, query: { t: TOKEN }, body: { image: JPEG.toString('base64') } };
  const res = await new Promise((resolve) => {
    const r = { headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; resolve(this); return this; }, end() { resolve(this); } };
    handler(req, r);
  });
  assert.equal(res.statusCode, 401);
  assert.equal(calls.read.length, 0);
});

test('not an image is a 400; too big is a 413 — both before the store or the model', async () => {
  const { handler, calls } = rig();
  const cases = [
    [undefined, 400], [{}, 400], [{ image: '' }, 400], [{ image: 42 }, 400],
    [{ image: TEXT.toString('base64') }, 400],
    [{ image: 'not base64 at all!' }, 400],
    [{ image: JPEG.subarray(0, 20).toString('base64') }, 400],
    [{ image: 'A'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8) }, 413],
  ];
  for (const [body, status] of cases) {
    const r = await call(handler, { headers: withCrew(), body });
    assert.equal(r.statusCode, status, JSON.stringify(body)?.slice(0, 60));
  }
  assert.equal(calls.crew.length + calls.read.length, 0);
  // A malformed JSON body (Vercel's parser throws on read) is a 400 too.
  const req = { method: 'POST', headers: { host: 'x', 'x-forwarded-for': '10.8.8.8', 'x-crew-token': TOKEN } };
  Object.defineProperty(req, 'body', { get() { throw new Error('Invalid JSON'); } });
  const res = await new Promise((resolve) => {
    const r = { headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; resolve(this); return this; }, end() { resolve(this); } };
    handler(req, r);
  });
  assert.equal(res.statusCode, 400);
});

test('the bytes decide the type — JPEG, PNG, WEBP and HEIC pass, whatever the phone claims; a data: URL is fine', async () => {
  assert.equal(sniffImage(JPEG), 'image/jpeg');
  assert.equal(sniffImage(PNG), 'image/png');
  assert.equal(sniffImage(WEBP), 'image/webp');
  assert.equal(sniffImage(HEIC), 'image/heic');
  assert.equal(sniffImage(TEXT), null);
  const { handler, calls } = rig();
  const r = await call(handler, { headers: withCrew(), body: { image: `data:image/gif;base64,${PNG.toString('base64')}` } });
  assert.equal(r.statusCode, 200);
  assert.equal(calls.read[0].mimeType, 'image/png', 'sniffed, not the claimed gif');
  assert.equal(calls.read[0].data, PNG.toString('base64'), 'the prefix is gone');
  assert.equal(imageFrom({ image: JPEG.toString('base64').replace(/(.{40})/g, '$1\n') }).mimeType, 'image/jpeg', 'wrapped base64');
});

test('a read comes back as printed — and the image never does', async () => {
  const { handler } = rig();
  const b64 = JPEG.toString('base64');
  const r = await call(handler, { headers: withCrew(), body: { image: b64 } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, READ);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.ok(!JSON.stringify(r.body).includes(b64.slice(0, 40)));
});

test('the model failing is a 502, and an error is logged by message only (never the picture)', async () => {
  const failing = rig({ read: () => ({ status: 502, error: 'Couldn’t read the image just now — try again' }) });
  assert.equal((await call(failing.handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } })).statusCode, 502);
  const b64 = JPEG.toString('base64');
  const throwing = makeImportHandler({
    crewExists: async () => true,
    readImage: async () => { throw Object.assign(new Error('socket hang up'), { body: b64 }); },
  });
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a);
  try {
    const r = await call(throwing, { headers: withCrew(), body: { image: b64 } });
    assert.equal(r.statusCode, 502);
  } finally { console.error = orig; }
  assert.ok(logged.length === 1 && !JSON.stringify(logged).includes(b64.slice(0, 40)));
});

test('the rate limit answers 429 on the 31st read from one address in an hour', async () => {
  const { handler } = rig();
  let last;
  for (let i = 0; i < 31; i++) last = await call(handler, { headers: withCrew(), body: { image: JPEG.toString('base64') }, ip: '10.200.0.1' });
  assert.equal(last.statusCode, 429);
});

test('the model\'s answer is data: shaped, cleaned, capped', () => {
  assert.equal(shapeRead(null), null);
  assert.equal(shapeRead([]), null);
  assert.equal(shapeRead('x'), null);
  const out = shapeRead({
    festival: '  Portola ', day: 'Saturday\u00009/26', extra: 'dropped',
    items: [
      { name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO', extra: 1 },
      { name: '   ' }, null, 'VTSS', { name: 42 },
      { name: 'x'.repeat(500), start: 7 },
    ],
  });
  assert.deepEqual(out, {
    festival: 'Portola', day: 'Saturday 9/26',
    items: [
      { name: 'Despacio', start: '2:45 PM', end: '9:45 PM', stage: 'DESPACIO' },
      { name: 'x'.repeat(120), start: null, end: null, stage: null },
    ],
  });
  const many = shapeRead({ items: Array.from({ length: 200 }, (_, i) => ({ name: `A${i}` })) });
  assert.equal(many.items.length, 60);
  assert.deepEqual(shapeRead({ isSchedule: false, items: [] }), { festival: null, day: null, items: [] });
});

// ---- guard.mjs callGemini: the text-only request is unchanged -----------------
async function captureGemini(fn) {
  const sent = [];
  const origFetch = globalThis.fetch;
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = async (url, init) => {
    sent.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"isSchedule":true,"items":[]}' }] } }] }) };
  };
  try { await fn(); } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = origKey;
  }
  return sent;
}

test('callGemini: a text-only call sends exactly the body it always did', async () => {
  const sent = await captureGemini(async () => {
    await callGemini('hello');
    await callGemini('research', { grounded: true });
  });
  assert.deepEqual(sent[0].body, { contents: [{ role: 'user', parts: [{ text: 'hello' }] }] });
  assert.deepEqual(sent[1].body, { contents: [{ role: 'user', parts: [{ text: 'research' }] }], tools: [{ google_search: {} }] });
});

test('callGemini: an image goes first as inline data, and a schema asks for strict JSON', async () => {
  const sent = await captureGemini(async () => {
    const r = await callGemini('read this', { image: { mimeType: 'image/jpeg', data: 'QUJD' }, schema: READ_SCHEMA });
    assert.equal(r.text, '{"isSchedule":true,"items":[]}');
  });
  assert.deepEqual(sent[0].body.contents[0].parts, [{ inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } }, { text: 'read this' }]);
  assert.deepEqual(sent[0].body.generationConfig, { responseMimeType: 'application/json', responseSchema: READ_SCHEMA });
  assert.equal(sent[0].body.tools, undefined);
});

test('the default reader: the model through callGemini, shaped on the way out; a model error is a 502', async () => {
  const handler = makeImportHandler({ crewExists: async () => true });
  const origFetch = globalThis.fetch;
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  let answer = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ isSchedule: true, day: 'Sunday 9/27', items: [{ name: 'VTSS', start: '4:30 PM', end: '5:30 PM', stage: 'WAREHOUSE' }] }) }] } }] }) };
  globalThis.fetch = async () => answer;
  try {
    const ok = await call(handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.body, { festival: null, day: 'Sunday 9/27', items: [{ name: 'VTSS', start: '4:30 PM', end: '5:30 PM', stage: 'WAREHOUSE' }] });
    answer = { ok: false, status: 404, json: async () => ({ error: { status: 'NOT_FOUND' } }) };
    assert.equal((await call(handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } })).statusCode, 502);
    answer = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) };
    assert.equal((await call(handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } })).statusCode, 502);
    delete process.env.GEMINI_API_KEY;
    assert.equal((await call(handler, { headers: withCrew(), body: { image: JPEG.toString('base64') } })).statusCode, 500);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = origKey;
  }
});
