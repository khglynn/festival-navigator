// v103: the crew playlist's words, in a real browser with real taps (390),
// against a Spotify answered from memory: the first search answers, every one
// after it is a 429 asking for 21 hours. Make playlist (Everyone), then — with
// Spotify answering again — Add new picks. Frames into v103-shots/spotify-*.
//   node claude-plans/2026-09-26-unified-build/v103-spotify-walk.mjs
import path from 'node:path';
import { openRig, openApp, PT, sleep, tap, SHOTS } from './v103-rig.mjs';

const CID = 'c'.repeat(32);
let busy = true;
let searched = 0;
const items = [];
const playlists = {};
const rig = await openRig();
try {
  const routes = async (ctx, origin) => {
    // The crew as the rig serves it, with a Spotify app on it.
    // (A crew write is kept in this walk's memory only — the playlist's meta,
    // so the drill knows the playlist after a reload; nothing leaves the rig.)
    await ctx.route(`${origin}/api/crew**`, async (route) => {
      if (route.request().method() !== 'GET') {
        const body = JSON.parse(route.request().postData() || '{}');
        Object.assign(playlists, ((body.data || {}).spotify || {}).playlists || {});
        return route.fulfill({ status: 503, body: '{}' });
      }
      const res = await route.fetch();
      const doc = await res.json();
      doc.spotify = { clientId: CID, playlists };
      return route.fulfill({ response: res, json: doc });
    });
    await ctx.route('https://api.spotify.com/**', async (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace('/v1', '');
      const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body) });
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      if (p === '/search') {
        searched += 1;
        const artist = /artist:"(.*)"/.exec(u.searchParams.get('q'))[1];
        if (busy && searched > 1) return json({}, 429, { 'Retry-After': String(21 * 3600), 'access-control-expose-headers': 'Retry-After' });
        return json({ tracks: { items: [0, 1, 2].map((i) => ({ uri: `spotify:track:${artist.replace(/\W/g, '')}${i}`, artists: [{ name: artist }] })) } });
      }
      if (p === '/me/playlists') return json({ id: 'walkpl', external_urls: { spotify: 'https://open.spotify.com/playlist/walkpl' } }, 201);
      if (p.startsWith('/playlists/walkpl/items')) {
        if (route.request().method() === 'POST') { items.push(...JSON.parse(route.request().postData()).uris); return json({ snapshot_id: 's' }, 201); }
        return json({ items: items.map((uri) => ({ track: { uri } })), next: null });
      }
      return json({ error: 'not in this walk' }, 404);
    });
  };
  const store = {
    fn_spotify_auth_v1: JSON.stringify({ clientId: CID, access_token: 'at', refresh_token: 'rt', expires_at: Date.now() + 3600e3 }),
    fn_spotify_libmap_v1: JSON.stringify({ clientId: CID, userId: 'ana', fetchedAt: '2026-09-26T00:00:00Z', artists: { robyn: { songs: 12 } }, trackUris: { robyn: ['spotify:track:anaRobyn'] } }),
  };
  let { ctx, page, errors } = await openApp(rig, { now: PT('2026-09-26T16:15:00'), width: 390, view: 'list', routes, store });
  // sp=1 is the address that opens the Spotify drill (the OAuth return's).
  await page.evaluate(() => { location.hash += '&sp=1'; location.reload(); });
  await page.waitForSelector('text=Playlist from our picks', { timeout: 15000 });
  const shot = async (id) => {
    const card = page.locator('.settings-card', { hasText: 'Playlist from our picks' });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
  };
  await shot('spotify-before-390');
  await tap(page, 'button.btn-tonal[data-pl-run]');
  await page.waitForFunction(() => /✓/.test(document.getElementById('spot-pl-status')?.textContent || ''), null, { timeout: 60000 });
  console.log('make:', await page.textContent('#spot-pl-status'));
  await shot('spotify-made-busy-390');
  busy = false;
  // Open the drill again so it offers Add new picks for the playlist it now knows.
  await sleep(3000); // the sync push is debounced
  console.log('crew playlists after make:', JSON.stringify(Object.keys(playlists)));
  // A fresh open of the drill (a new tab on the same phone), which now knows the playlist.
  const url = page.url().replace(/&sp=1/g, '');
  await page.close();
  const page2 = await ctx.newPage();
  page2.on('pageerror', (e) => errors.push(e.message));
  await page2.clock.setFixedTime(PT('2026-09-26T16:20:00'));
  await page2.goto(`${url}&sp=1`, { waitUntil: 'load' });
  await page2.waitForSelector('text=Add new picks', { timeout: 15000 });
  await sleep(500);
  page = page2;
  const add = page.locator('button', { hasText: 'Add new picks' });
  const b = await add.boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => /Added|already|no songs/.test(document.getElementById('spot-pl-status')?.textContent || ''), null, { timeout: 60000 });
  console.log('add:', await page.textContent('#spot-pl-status'));
  await shot('spotify-topped-up-390');
  console.log('errors:', errors, 'searched:', searched, 'items:', items.length);
  await ctx.close();
} finally { await rig.close(); }
