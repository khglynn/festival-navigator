// Personal invite links + the boot-resume rule (Kevin notes 2 and 5,
// 2026-07-12). Pure crew.js behavior, no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };
globalThis.localStorage = {
  getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {},
};

const crew = await import('../js/crew.js');
const TOKEN = 'linktesttoken_0123456789012';

test('crewLink: crew-wide, fest-scoped, and personal variants', () => {
  assert.equal(crew.crewLink(TOKEN), `https://fest.kevinhg.com/#g=${TOKEN}`);
  // A fest-scoped link puts the festival in the PATH, under /f — so a human
  // reads it in a chat, and so the rewrite can fire at all (Vercel gives the
  // filesystem precedence over rewrites, and `/` is index.html). The hash
  // keeps its own copy: it is what the app reads, and it is what survives
  // when an unknown id redirects to `/`.
  assert.equal(crew.crewLink(TOKEN, 'lollapalooza-2025'),
    `https://fest.kevinhg.com/f/lollapalooza-2025#g=${TOKEN}&f=lollapalooza-2025`);
  // Personal link URL-encodes the name (spaces, unicode) and rides after &f=.
  assert.equal(crew.crewLink(TOKEN, 'lollapalooza-2025', 'Drew B'),
    `https://fest.kevinhg.com/f/lollapalooza-2025#g=${TOKEN}&f=lollapalooza-2025&me=Drew%20B`);
  // A bad fest id drops BOTH copies, stays on `/`, keeps the personal part.
  assert.equal(crew.crewLink(TOKEN, 'NOT VALID!', 'Drew'),
    `https://fest.kevinhg.com/#g=${TOKEN}&me=Drew`);
});

test('the crew token never leaves the hash', () => {
  // A query param lands in platform access logs and referrer headers, and the
  // token IS the crew's data. Only the public festival id may ride there.
  for (const link of [
    crew.crewLink(TOKEN),
    crew.crewLink(TOKEN, 'lollapalooza-2025'),
    crew.crewLink(TOKEN, 'lollapalooza-2025', 'Drew B'),
  ]) {
    const beforeHash = link.slice(0, link.indexOf('#') === -1 ? link.length : link.indexOf('#'));
    assert.ok(!beforeHash.includes(TOKEN), `token leaked out of the hash: ${link}`);
    assert.ok(!/[?&](g|me)=/.test(beforeHash), `token or member name in the query: ${link}`);
  }
});

test('meFromHash: parses, decodes, and tolerates junk', () => {
  location.hash = `#g=${TOKEN}&f=lollapalooza-2025&me=Drew%20B`;
  assert.equal(crew.meFromHash(), 'Drew B');
  location.hash = `#g=${TOKEN}`;
  assert.equal(crew.meFromHash(), null);
  location.hash = `#g=${TOKEN}&me=%E2%9C%94`; // decodes fine
  assert.equal(crew.meFromHash(), '✔');
  location.hash = `#g=${TOKEN}&me=%E0%A4%A`; // malformed percent-encoding
  assert.equal(crew.meFromHash(), null);
  location.hash = '';
});

test('bootTokenFor: cold start resumes, in-app navigation to bare URL does not', () => {
  // Cold open of the PWA with no hash: resume the remembered crew.
  assert.equal(crew.bootTokenFor(null, TOKEN, true), TOKEN);
  // A link always wins, first boot or not.
  assert.equal(crew.bootTokenFor('hashtok_0123456789012345', TOKEN, true), 'hashtok_0123456789012345');
  assert.equal(crew.bootTokenFor('hashtok_0123456789012345', TOKEN, false), 'hashtok_0123456789012345');
  // Browser back from the wall lands on a bare URL mid-session: LANDING,
  // never a resume loop (the note-2 bug: back used to re-enter the crew).
  assert.equal(crew.bootTokenFor(null, TOKEN, false), null);
  assert.equal(crew.bootTokenFor(null, null, true), null);
});

// Every link the app HANDS OUT says fest.kevinhg.com when it is made on one
// of the three production hosts (Kevin, 2026-10-02: yes to "every link the
// app builds says fest.kevinhg.com" — find your crew, question 2). A test
// build keeps its own address, so its links open that build. The address
// bar's own link (crewLink, written by history.replaceState) is never moved:
// history refuses a URL on another origin.
function onHost(origin) {
  const u = new URL(origin);
  location.origin = u.origin;
  location.hostname = u.hostname;
  globalThis.window = { location };
}
function withMeta(content, fn) {
  globalThis.document = { querySelector: (sel) => (sel === 'meta[name="fn-canonical-host"]' && content != null ? { content } : null) };
  try { return fn(); } finally { delete globalThis.document; }
}

test('shareLink: on fest., festival. and crew.kevinhg.com every handed-out link says https://fest.kevinhg.com — the address bar keeps its own host', () => {
  for (const host of ['https://fest.kevinhg.com', 'https://festival.kevinhg.com', 'https://crew.kevinhg.com']) {
    onHost(host);
    withMeta('fest.kevinhg.com', () => {
      assert.equal(crew.shareOrigin(), 'https://fest.kevinhg.com', host);
      assert.equal(crew.shareLink(TOKEN, 'acl-2026'), `https://fest.kevinhg.com/f/acl-2026#g=${TOKEN}&f=acl-2026`, host);
      assert.equal(crew.shareLink(TOKEN, 'portola-2026', null, ['fest', 'afters'], 'list', { plan: '2026-09-26' }),
        `https://fest.kevinhg.com/f/portola-2026#g=${TOKEN}&f=portola-2026&show=fest,afters&view=list&plan=2026-09-26`, `${host}: the view and the plan ride as before`);
      assert.equal(crew.shareLink(TOKEN, 'acl-2026', 'Drew B'), `https://fest.kevinhg.com/f/acl-2026#g=${TOKEN}&f=acl-2026&me=Drew%20B`, `${host}: a personal link too`);
      assert.equal(crew.crewLink(TOKEN, 'acl-2026'), `${host}/f/acl-2026#g=${TOKEN}&f=acl-2026`, `${host}: the address bar's link is this page's own`);
    });
  }
});

test('shareLink: a preview, staging, localhost or any other host keeps its own address — a test build’s link opens that test build', () => {
  for (const host of ['https://festival-navigator-git-feat-x-kevinhg.vercel.app', 'https://stage.fest.kevinhg.com', 'http://localhost:3000', 'http://127.0.0.1:5173', 'https://fest.example.org']) {
    onHost(host);
    withMeta('fest.kevinhg.com', () => {
      assert.equal(crew.shareOrigin(), host);
      assert.equal(crew.shareLink(TOKEN, 'acl-2026'), crew.crewLink(TOKEN, 'acl-2026'), host);
    });
  }
});

test('shareOrigin reads index.html’s fn-canonical-host meta (one value, one home), with the literal as the fallback', () => {
  onHost('https://crew.kevinhg.com');
  assert.equal(withMeta('fest.kevinhg.com', () => crew.shareOrigin()), 'https://fest.kevinhg.com');
  assert.equal(withMeta(null, () => crew.shareOrigin()), 'https://fest.kevinhg.com', 'no meta: the literal, as spotify.js falls back');
  assert.equal(withMeta('  ', () => crew.shareOrigin()), 'https://fest.kevinhg.com', 'an empty meta: the literal');
  assert.equal(withMeta('evil.example/x?', () => crew.shareOrigin()), 'https://fest.kevinhg.com', 'never anything but a host name');
  assert.equal(crew.shareOrigin(), 'https://fest.kevinhg.com', 'no document at all (Node): the literal');
  onHost('https://fest.kevinhg.com'); // back to the file's own host for anything after
  delete globalThis.window;
});

test('the token never leaves the hash in a handed-out link either', () => {
  onHost('https://festival.kevinhg.com');
  for (const link of [crew.shareLink(TOKEN), crew.shareLink(TOKEN, 'acl-2026', 'Drew'), crew.shareLink(TOKEN, 'portola-2026', null, ['fest'], 'list')]) {
    const beforeHash = link.slice(0, link.indexOf('#'));
    assert.ok(!beforeHash.includes(TOKEN) && !/[?&](g|me)=/.test(beforeHash), link);
  }
  onHost('https://fest.kevinhg.com');
  delete globalThis.window;
});

test('which builder each link uses: what is handed to someone is a shareLink; what history writes is a crewLink', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../js/v3/app.js', import.meta.url), 'utf8');
  const settings = readFileSync(new URL('../js/v3/settings.js', import.meta.url), 'utf8');
  const body = (src, head) => src.slice(src.indexOf(head), src.indexOf('\n}\n', src.indexOf(head)));
  assert.match(body(app, 'function inviteLink('), /crew\.shareLink\(/, 'the invite link: the Invite sheet, its QR, the Show menu row, Settings');
  assert.match(body(app, 'function planLink('), /crew\.shareLink\(/, 'the plan’s Share');
  assert.doesNotMatch(settings, /crew\.crewLink\(/, 'Settings hands out links only: none of them is the address bar');
  assert.match(body(app, 'function wallUrl('), /crew\.crewLink\(/, 'the wall’s own address');
  for (const m of app.matchAll(/history\.(?:replaceState|pushState)\([^;]*\);/g)) {
    assert.doesNotMatch(m[0], /shareLink|inviteLink|planLink|shareOrigin/, `history takes this page's own origin only: ${m[0]}`);
  }
});
