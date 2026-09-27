// The helper every NOW tap in the browser contract goes through
// (tests/helpers/browser.mjs nowInView, v103): it brings the day row to its
// start and waits for NOW whole and still. When it cannot, it must FAIL, with
// the row's geometry in the message — it used to swallow its timeout and let
// the tap go ahead, so a loaded Linux run failed later with no clue why (Sol's
// review of v103). Plain pages, no app: only the helper is under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, NO_BROWSER, nowInView } from '../helpers/browser.mjs';

const browser = await launchBrowser();
test.after(async () => { if (browser) await browser.close(); });
const skip = browser ? false : NO_BROWSER;
const page = async (html) => {
  const p = await (await browser.newContext({ viewport: { width: 390, height: 300 } })).newPage();
  await p.setContent(`<!doctype html><body style="margin:0">${html}</body>`);
  return p;
};
const row = (nowWidth, rowWidth, scrolled) => `
  <span id="dock-days" style="display:flex;gap:10px;overflow-x:auto;width:${rowWidth}px">
    <button id="dock-now" style="flex:none;width:${nowWidth}px">NOW</button>
    <button style="flex:none;width:300px">THU</button><button style="flex:none;width:300px">FRI</button>
  </span><script>document.getElementById('dock-days').scrollLeft = ${scrolled};</script>`;

test('NOW past the row\'s left edge: brought whole into view, and it resolves', { skip }, async () => {
  const p = await page(row(40, 200, 150));
  await nowInView(p, 'dock');
  const r = await p.evaluate(() => {
    const a = document.getElementById('dock-now').getBoundingClientRect();
    const b = document.getElementById('dock-days').getBoundingClientRect();
    return a.left >= b.left - 0.5 && a.right <= b.right + 0.5;
  });
  assert.equal(r, true);
  await p.context().close();
});

test('NOW that can never be whole (wider than its row): it fails, and says where NOW and the row are', { skip }, async () => {
  const p = await page(row(260, 200, 0));
  await assert.rejects(nowInView(p, 'dock', { timeout: 800 }), (e) => {
    assert.match(e.message, /NOW never came whole and still/);
    assert.match(e.message, /"now":\{"left":0,"right":260\}/);
    assert.match(e.message, /"row":\{"left":0,"right":200/);
    return true;
  });
  await p.context().close();
});
