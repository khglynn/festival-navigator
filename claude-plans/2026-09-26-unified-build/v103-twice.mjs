// v103 round 3, T2: one set in two rooms. Horse Meat Disco's Friday shows
// under Afters AND Folsom; the viewer (Kevin, the rig's `sparse` crew, with HMD
// added as his must) highlights himself in the List, puts the keyboard on the
// Afters row and un-picks it with a real Enter. The Folsom row — which nobody
// is on — leaves; the Afters row stays, dimmed, until the focus moves on.
// Chromium and WebKit, 390 wide, Friday 8 PM. Frames into v103-shots/twice-*.
//   node claude-plans/2026-09-26-unified-build/v103-twice.mjs
import { openRig, openApp, PT, sleep, SHOTS } from './v103-rig.mjs';

const HMD = 'Horse Meat Disco';
const room = (r) => `.day-block[data-day="Friday"] .room[data-room="${r}"]`;
const rowIn = (r) => `${room(r)} .card[data-artist="${HMD}"]`;
const out = [];
let friend = false; // flipped to bring a friend's pick on the next poll
for (const engine of ['chromium', 'webkit']) {
  friend = false;
  const rig = await openRig({ engine });
  try {
    const routes = async (ctx, origin) => {
      await ctx.route(`${origin}/api/crew**`, async (route) => {
        if (route.request().method() !== 'GET') return route.fulfill({ status: 503, body: '{}' });
        const res = await route.fetch();
        const doc = await res.json();
        const sel = doc.festivals['portola-2026'].selections;
        sel[HMD] = { Kevin: 4 };
        for (const a of ['Soulwax', 'Prospa', 'Despacio']) sel[a] = { ...sel[a], Kevin: 2 }; // a List worth reading
        if (friend) sel.Galen = { ...sel.Galen, Kat: 2 };
        return route.fulfill({ response: res, json: doc });
      });
    };
    const { page, ctx, errors } = await openApp(rig, { now: PT('2026-09-25T20:00:00'), crew: 'sparse', view: 'list', highlight: ['Kevin'], routes });
    const seen = () => page.evaluate(([a, f]) => ({ afters: !!document.querySelector(a), folsom: !!document.querySelector(f), dim: !!document.querySelector(a)?.classList.contains('dim') }), [rowIn('Afters'), rowIn('Folsom')]);
    const before = await seen();
    await page.locator(rowIn('Afters')).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/twice-${engine}-1-before.png` });
    await page.locator(rowIn('Afters')).focus();
    let level = 4;
    for (let i = 0; i < 5 && level !== 0; i += 1) {
      await page.keyboard.press('Enter');
      await sleep(250);
      level = await page.evaluate((a) => document.querySelector(a)?.classList.contains('dim') ? 0 : -1, rowIn('Afters'));
    }
    await sleep(1200); // past the leftover watch's beat
    // The Folsom row leaving repaints the wall; the keyboard must still be on
    // the Afters row (it fell to <body> before the fix, so a Tab went to the
    // top of the page and the row's zoom stood on with nothing focused).
    const held = { ...(await seen()), focus: await page.evaluate((a) => (document.activeElement === document.querySelector(a) ? 'row' : document.activeElement.tagName), rowIn('Afters')) };
    await page.screenshot({ path: `${SHOTS}/twice-${engine}-2-held.png` });
    // The focus moves on: Tab until it rests on ANOTHER card. Chromium's Tab
    // reaches the row's own controls first (still on it, the row stays);
    // WebKit's skips buttons and lands on the next card at once.
    const onRow = () => page.evaluate((a) => {
      const c = document.querySelector(a);
      const f = document.activeElement;
      if (!f) return '-';
      if (c && c.contains(f)) return 'row';
      if (f.closest('#zoom-layer')) return `zoom:${f.getAttribute('aria-label') || f.className}`;
      const other = f.closest('.card[data-artist]');
      return other ? `card:${other.dataset.artist}` : `other:${f.id || f.className || f.tagName}`;
    }, rowIn('Afters'));
    const tabs = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      await sleep(700); // a leftover watch beat and its fade
      const where = await onRow();
      tabs.push(`${where}${(await seen()).afters ? ' (row stays)' : ' (row gone)'}`);
      if (where.startsWith('card:')) break;
    }
    await sleep(1400);
    const left = { ...(await seen()), tabs };
    await page.screenshot({ path: `${SHOTS}/twice-${engine}-3-left.png` });
    // The keyboard goes INTO the standing zoom (one more Tab), and a friend's
    // pick arrives on the poll — a whole repaint. The zoom stands on, and the
    // keyboard is on its card, never <body>. (The page coming back into view
    // is what asks for the poll here: the rig's clock is pinned. The rig's
    // service worker is blocked, and Playwright's block resolves register()
    // with nothing, so index.html's reg.update() throws on that event — a rig
    // artifact, not the app: a real register() resolves a registration.)
    await page.keyboard.press('Tab');
    await sleep(300);
    const inZoom = await page.evaluate(() => { const f = document.activeElement; return f.closest('#zoom-layer') ? (f.getAttribute('aria-label') || f.className) : `no:${f.className}`; });
    friend = true;
    await page.evaluate(() => { document.querySelector('#wall-root .card.zoom-source').dataset.walkMark = 'old'; document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(1500);
    const polled = await page.evaluate(() => {
      const f = document.activeElement;
      const card = f.closest('.card[data-artist]');
      return { repainted: !document.querySelector('#wall-root [data-walk-mark]'), focus: card ? `card:${card.dataset.artist}` : f.tagName, zoom: !!document.querySelector('#zoom-layer .zoom-slot.shown') };
    });
    await page.screenshot({ path: `${SHOTS}/twice-${engine}-4-repainted.png` });
    out.push({ engine, before, held, left, inZoom, polled, errors });
    await ctx.close();
  } finally {
    await rig.close();
  }
}
console.log(JSON.stringify(out, null, 1));
