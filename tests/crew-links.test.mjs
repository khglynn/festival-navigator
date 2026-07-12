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
  assert.equal(crew.crewLink(TOKEN, 'lollapalooza-2025'),
    `https://fest.kevinhg.com/#g=${TOKEN}&f=lollapalooza-2025`);
  // Personal link URL-encodes the name (spaces, unicode) and rides after &f=.
  assert.equal(crew.crewLink(TOKEN, 'lollapalooza-2025', 'Drew B'),
    `https://fest.kevinhg.com/#g=${TOKEN}&f=lollapalooza-2025&me=Drew%20B`);
  // A bad fest id drops the &f= but keeps the personal part.
  assert.equal(crew.crewLink(TOKEN, 'NOT VALID!', 'Drew'),
    `https://fest.kevinhg.com/#g=${TOKEN}&me=Drew`);
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
