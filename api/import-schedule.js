// Read a festival app's schedule export (2026-09-26, Kevin at Portola: the
// official app exports "My 2026 Portola Schedule" as one image per day).
//
//   POST /api/import-schedule   X-Crew-Token: <crew token>
//        {image: <base64 JPEG/PNG/WEBP/HEIC, or a data: URL>}
//     -> 200 {festival, day, items: [{name, start, end, stage}]}
//
// It returns only what is PRINTED — the phone matches names to the lineup
// (js/v3/import-match.js) and the person lands every level before anything is
// written, through the app's ordinary pick path. This endpoint writes nothing,
// stores nothing, and never echoes or logs the image.
//
// A crew is required (the X-Crew-Token header, checked against the crews
// table — a read). The only other Gemini door, festival-add, asks the same;
// the repo is public, so without it anyone could point a script at our key.
// Every person who can import already holds their crew's token (it is how
// they reached the wall), so the check costs them nothing. It rides a HEADER,
// never the query: platform logs keep URLs (the person token's rule).
//
// Status codes the phone reads: 400 not an image (or no body), 401 no crew
// we know, 403 cross-site, 405, 413 too big, 429 slow down, 502 the model
// failed or read nothing usable, 500 unconfigured.
import { neon } from '@neondatabase/serverless';
import { rateLimited, crossSite, callGemini } from './_lib/guard.mjs';
import { TOKEN_RE } from './_lib/crew-shared.mjs';

// Vercel refuses a request body over 4.5 MB before this code runs. The phone
// downscales to ~1080 px wide JPEG first (a Portola export is ~450 KB), so
// 3 MB of image — 4 MB as base64 — is room for an un-shrunk screenshot and
// still under the platform's wall, where our own 413 can say what happened.
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MIN_IMAGE_BYTES = 64;
const MAX_ITEMS = 60;

// The magic bytes decide what an upload is — never the name or the type the
// phone claims. Gemini reads these four.
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG' && buf[4] === 0x0d && buf[5] === 0x0a) return 'image/png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}

// {image} -> {mimeType, data} | {status, error}. The base64 is checked as
// base64 (Buffer.from skips anything else without a word), sized before it is
// decoded, and sniffed after.
export function imageFrom(body) {
  const raw = body && typeof body.image === 'string' ? body.image : '';
  if (!raw) return { status: 400, error: 'Send the schedule image' };
  const b64 = raw.replace(/^data:[^;,]{0,60};base64,/, '').replace(/\s+/g, '');
  if (b64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) return { status: 413, error: 'That image is too big — try a screenshot of it' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { status: 400, error: 'That doesn’t look like an image' };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_IMAGE_BYTES) return { status: 413, error: 'That image is too big — try a screenshot of it' };
  const mimeType = buf.length >= MIN_IMAGE_BYTES ? sniffImage(buf) : null;
  if (!mimeType) return { status: 400, error: 'That doesn’t look like an image' };
  return { mimeType, data: b64 };
}

// What the model is asked, and nothing more: transcribe what is printed.
export const READ_PROMPT = `This image should be a person's own schedule exported from a music festival's app (for example "My 2026 Portola Schedule"): a day heading, then a list of sets, each an artist name with a time range and a stage.

Transcribe exactly what is printed:
- festival: the festival's name as printed, without the year or words like "My" and "Schedule"; null if none is printed.
- day: the day heading exactly as printed (for example "Saturday 9/26"); null if none is printed.
- items: every set listed, in the printed order. name: exactly as printed (same spelling, capitals and punctuation). start and end: as printed, written like "2:45 PM"; null if not printed. stage: as printed; null if not printed.

Rules: only what is printed on this image. Never add a set, never correct, complete or translate a name, never infer a time or a stage. Ignore titles, footers, app promotion, logos and decoration. If the image is not a festival schedule, set isSchedule to false and items to an empty list.`;

const S = { type: 'STRING', nullable: true };
export const READ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isSchedule: { type: 'BOOLEAN' },
    festival: S,
    day: S,
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { name: { type: 'STRING' }, start: S, end: S, stage: S },
        required: ['name'],
        propertyOrdering: ['name', 'start', 'end', 'stage'],
      },
    },
  },
  required: ['isSchedule', 'items'],
  propertyOrdering: ['isSchedule', 'festival', 'day', 'items'],
};

// The model's answer is data from an image anyone could have made: every
// string is trimmed, stripped of control characters and capped, and anything
// not in the shape is dropped. Null when there is no answer at all.
const clean = (v, max) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};
export function shapeRead(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const items = [];
  for (const it of Array.isArray(parsed.items) ? parsed.items : []) {
    if (!it || typeof it !== 'object') continue;
    const name = clean(it.name, 120);
    if (!name) continue;
    items.push({ name, start: clean(it.start, 20), end: clean(it.end, 20), stage: clean(it.stage, 60) });
    if (items.length >= MAX_ITEMS) break;
  }
  return { festival: clean(parsed.festival, 80), day: clean(parsed.day, 60), items };
}

async function crewExistsInStore(token) {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Store not configured'), { status: 500 });
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT 1 FROM crews WHERE token = ${token}`;
  return rows.length > 0;
}

async function readWithGemini(image) {
  const result = await callGemini(READ_PROMPT, { image, schema: READ_SCHEMA });
  if (result.error) return { status: result.status === 500 ? 500 : 502, error: result.status === 500 ? result.error : 'Couldn’t read the image just now — try again' };
  let parsed = null;
  try { parsed = JSON.parse(result.text); } catch { /* not JSON: below */ }
  const read = shapeRead(parsed);
  if (!read) return { status: 502, error: 'Couldn’t read the image just now — try again' };
  return { read };
}

// The handler, with its two outside calls passed in so the tests drive it
// with neither a database nor a model (tests/import-schedule.test.mjs).
export function makeImportHandler({ crewExists = crewExistsInStore, readImage = readWithGemini } = {}) {
  return async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (crossSite(req)) return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    res.setHeader('Cache-Control', 'no-store');
    // Per serverless instance (guard.mjs): a speed bump before the store is
    // asked anything. Loose enough for a festival's phones sharing a carrier
    // address — the crew check is the real wall.
    if (rateLimited(req, 'import-schedule', 30, 60 * 60 * 1000)) return res.status(429).json({ error: 'Lots of imports just now — try again in a few minutes' });
    const token = (req.headers['x-crew-token'] || '').toString();
    if (!TOKEN_RE.test(token)) return res.status(401).json({ error: 'Open your crew’s link first' });
    let body;
    try { body = req.body; } catch { return res.status(400).json({ error: 'Send the schedule image' }); }
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    const image = imageFrom(body);
    if (image.error) return res.status(image.status).json({ error: image.error });
    try {
      if (!(await crewExists(token))) return res.status(401).json({ error: 'Open your crew’s link first' });
      const out = await readImage(image);
      if (out.error) return res.status(out.status).json({ error: out.error });
      return res.status(200).json(out.read);
    } catch (error) {
      // The message only — an error from a request can carry its body, and
      // the body here is someone's picture.
      console.error('import-schedule error:', error && error.message);
      if (error && error.status === 500) return res.status(500).json({ error: 'Store not configured' });
      return res.status(502).json({ error: 'Couldn’t read the image just now — try again' });
    }
  };
}

export default makeImportHandler();
