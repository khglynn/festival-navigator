// Today's first-open screens, v89 code from the clean worktree, fake crew.
import { startRig, demoDoc, seed, TOKEN, FID, OUT, sleep } from './rig.mjs';

const rig = await startRig();
const O = rig.server.origin;
const only = process.argv[2] || null;
const results = [];

async function shot(name, { doc, init, url, waitFor, after, full = false }) {
  if (only && only !== name) return;
  const { ctx, page, errors } = await rig.phone({ doc, init });
  try {
    await page.goto(`${O}${url}`, { waitUntil: 'load' });
    await page.waitForSelector(waitFor, { state: 'visible', timeout: 15000 });
    await sleep(900);
    if (after) await after(page);
    const file = `${OUT}/today/${name}.png`;
    await page.screenshot({ path: file, fullPage: full });
    results.push({ name, file, errors });
    console.log('ok', name, errors.length ? errors : '');
  } catch (e) {
    console.log('FAIL', name, String(e).slice(0, 300), errors);
  } finally { await ctx.close(); }
}

const layers = (list) => ({ fn: ([t, n, l]) => {
  try { localStorage.setItem(`fn_me_v3_${t}`, n); localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }])); } catch {}
  history.replaceState({ layers: l }, '', location.href);
}, arg: [TOKEN, 'Kevin', list] });

// 1. Cold fest.kevinhg.com, a phone that has never been here.
await shot('t1-cold-landing', { url: '/', waitFor: '#screen-landing' });
// 2. A friend's crew link, on a new phone: the join screen.
await shot('t2-join-new-device', { url: `/#g=${TOKEN}&f=${FID}`, waitFor: '#screen-join' });
// 3. The same link for a crew with nobody in it yet.
await shot('t3-join-empty-crew', { doc: demoDoc({ people: false }), url: `/#g=${TOKEN}&f=${FID}`, waitFor: '#screen-join' });
// 4. First wall after joining: the How it works bar (coach mark).
await shot('t4-first-wall-coach-mark', { init: seed.claimed('Maya'), url: `/#g=${TOKEN}&f=${FID}`, waitFor: '#coach-mark' });
// 5. The share moment (opens right after a single-fest create).
await shot('t5-share-moment', { init: layers(['sheet:share']), url: `/#g=${TOKEN}&f=${FID}`, waitFor: '#artist-sheet' });
// 6. How it works, the page behind the bar's link.
await shot('t6-how-it-works', { init: layers(['settings', 'sub:how']), url: `/#g=${TOKEN}&f=${FID}`, waitFor: '#settings-subview', full: true });
// 7. A returning device (knows one crew, has a person) typing the bare URL.
await shot('t7-landing-returning', {
  init: { fn: ([t, d]) => {
    try {
      localStorage.setItem('fn_crews_v3', JSON.stringify([{ token: t, name: 'The Portola Crew' }]));
      localStorage.setItem(`fn_crew_doc_v3_${t}`, JSON.stringify(d));
      localStorage.setItem(`fn_crew_fest_v3_${t}`, 'portola-2026');
      localStorage.setItem(`fn_me_v3_${t}`, 'Kevin');
      localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'FAKEpersonTOKENdesignOnly0000000001', id: 'fakepid01', name: 'Kevin', crews: {} }));
    } catch {}
  }, arg: [TOKEN, demoDoc()] },
  url: '/', waitFor: '#screen-landing',
});
// 8. Recognized: this phone's person is already in the crew (pid match).
await shot('t8-recognized-welcome', {
  doc: (() => { const d = demoDoc(); d.people.Kevin.pid = 'fakepid01'; return d; })(),
  init: { fn: () => { try { localStorage.setItem('fn_person_v1', JSON.stringify({ token: 'FAKEpersonTOKENdesignOnly0000000001', id: 'fakepid01', name: 'Kevin', crews: {} })); } catch {} }, arg: null },
  url: `/#g=${TOKEN}&f=${FID}`, waitFor: '.toast, #toast-root *',
});

console.log('blocked writes:', rig.blocked);
await rig.close();
