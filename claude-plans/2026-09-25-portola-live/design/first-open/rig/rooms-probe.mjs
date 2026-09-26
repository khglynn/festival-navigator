import { startRig, seed, TOKEN, FID, sleep } from './rig.mjs';
const rig = await startRig();
const { ctx, page } = await rig.phone({ init: seed.claimed('Kevin') });
await page.goto(`${rig.server.origin}/#g=${TOKEN}&f=${FID}`, { waitUntil: 'load' });
await page.waitForSelector('#screen-app .card', { timeout: 15000 });
await sleep(500);
console.log(JSON.stringify(await page.evaluate(async () => (await import('/js/v3/app.js')).roomsOnWall())));
await ctx.close(); await rig.close();
