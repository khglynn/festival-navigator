// The data guards added before Portola and ACL (2026-09-16) — mistakes a
// data session can make that the app would render silently wrong:
//   · the two weekend spellings: artists[] says `weekends`, a grid set says
//     `weekend`. Crossed, nothing reads the tag, and the timetable shows both
//     weekends at once — every stage double-booked (ST-3);
//   · a display date typed next to its ISO date and disagreeing with it (the
//     day rule shows one date, the now line keys on the other);
//   · a name crews can already pick that the pick-key freeze does not hold,
//     so a later rename would pass CI (Buck Wilson, 2026-09-01);
//   · index.json's copy of a festival's status drifting from the file's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFestivalDoc } from '../api/_lib/festival-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- weekends ----------------------------------------------------------------------

const twoWeekends = () => ({
  id: 'x', name: 'X', status: 'scheduled', timezone: 'America/Chicago',
  artists: [{ name: 'Both', day: 'Friday', weekends: 'both' }, { name: 'One', day: 'Friday', weekends: 'W1' }],
  dayMeta: { Friday: { wd: 'Fri', dates: { W1: 'Oct 2', W2: 'Oct 9' }, isos: { W1: '2026-10-02', W2: '2026-10-09' } } },
  days: { Friday: { stages: ['A'], artists: [
    { name: 'Both', stage: 'A', time: '8:00 PM - 9:00 PM' },
    { name: 'One', stage: 'A', time: '9:00 PM - 10:00 PM', weekend: 'W1' },
  ] } },
});

test('a well-formed two-weekend schedule is clean', () => {
  assert.deepEqual(validateFestivalDoc(twoWeekends()), { errors: [], warnings: [] });
});

test('`weekends` on a grid set is an error — the timetable reads `weekend`', () => {
  const fest = twoWeekends();
  const one = fest.days.Friday.artists[1];
  delete one.weekend;
  one.weekends = 'W1';
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /Friday\.artists\[1\] \(One\): `weekends` is the lineup's tag — a grid set says `weekend`/.test(e)), errors.join('\n'));
});

test('`weekend` on a lineup entry is an error — artists[] reads `weekends`', () => {
  const fest = twoWeekends();
  fest.artists[1] = { name: 'One', day: 'Friday', weekend: 'W1' };
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /artists\[1\] \(One\): `weekend` is a grid set's tag — a lineup entry says `weekends`/.test(e)), errors.join('\n'));
});

test('a lineup split by weekend over a grid with no weekend tags is an error — the wall would show both weekends at once', () => {
  const fest = twoWeekends();
  delete fest.days.Friday.artists[1].weekend;
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /artists\[\] tag W1\/W2 but no days\{\} set carries a weekend/.test(e)), errors.join('\n'));
  // A single-weekend fest with no tags anywhere is the common case, and fine.
  const single = twoWeekends();
  for (const a of single.artists) delete a.weekends;
  delete single.days.Friday.artists[1].weekend;
  assert.deepEqual(validateFestivalDoc(single).errors, []);
});

test('a display date that disagrees with its ISO date warns — the day rule and the now line would name different days', () => {
  const fest = twoWeekends();
  fest.dayMeta.Friday.dates.W2 = 'Oct 10';
  const { errors, warnings } = validateFestivalDoc(fest);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /dayMeta\.Friday\.dates\.W2 "Oct 10" is not isos\.W2 2026-10-09 \(Oct 9\)/.test(w)), warnings.join('\n'));
  const single = { ...fest, dayMeta: { Friday: { wd: 'Fri', date: 'Oct 3', iso: '2026-10-02' } } };
  assert.ok(validateFestivalDoc(single).warnings.some((w) => /dayMeta\.Friday\.date "Oct 3" is not iso 2026-10-02 \(Oct 2\)/.test(w)));
  // A section's free-text range with no ISO beside it ("Sep 24-27") is not checked.
  const range = { ...fest, dayMeta: { ...twoWeekends().dayMeta, Afters: { date: 'Sep 24-27' } } };
  assert.deepEqual(validateFestivalDoc(range).warnings, []);
});

// ---- drop-in rooms (plan.js rule 9, 2026-09-26) -------------------------------------
// A room people drift in and out of (Portola's Despacio, open seven hours) is
// DECLARED with `"dropIn": true`; Our picks never guesses it from the shape.
// The shape is still a good question for the author, so a live festival with
// a stage whose whole day is one set, beside stages that run several, is asked
// once — and answering either way (true or false) is the answer.

const withRoom = (extra = {}) => ({
  id: 'x', name: 'X', status: 'scheduled', timezone: 'America/Los_Angeles',
  artists: [{ name: 'Opener', day: 'Saturday' }, { name: 'Closer', day: 'Saturday' }, { name: 'Long Room', day: 'Saturday' }],
  dayMeta: { Saturday: { wd: 'Sat', date: 'Sep 26', iso: '2026-09-26' } },
  days: { Saturday: { stages: ['Main', 'Room'], artists: [
    { name: 'Opener', stage: 'Main', time: '6:00 PM - 7:00 PM' },
    { name: 'Closer', stage: 'Main', time: '8:00 PM - 9:00 PM' },
    { name: 'Long Room', stage: 'Room', time: '2:00 PM - 10:00 PM', ...extra },
  ] } },
});
const asked = (r) => r.warnings.filter((w) => /dropIn/.test(w));

test('dropIn must be a boolean, on a grid set and on a section entry', () => {
  for (const ok of [true, false]) assert.deepEqual(validateFestivalDoc(withRoom({ dropIn: ok })), { errors: [], warnings: [] }, `dropIn: ${ok}`);
  for (const bad of ['true', 1, null, 'yes']) {
    const { errors } = validateFestivalDoc(withRoom({ dropIn: bad }));
    assert.ok(errors.some((e) => /Saturday\.artists\[2\] \(Long Room\): dropIn must be true or false/.test(e)), `${JSON.stringify(bad)}: ${errors.join('\n')}`);
  }
  const fest = withRoom({ dropIn: true });
  fest.dayMeta.Afters = { date: 'Sep 25-26' };
  fest.artists.push({ name: 'Invite', day: 'Afters', night: 'Fri', venue: 'Pier 80', time: '5:00 PM - 11:00 PM', dropIn: 'true' });
  const { errors } = validateFestivalDoc(fest);
  assert.ok(errors.some((e) => /artists \(Invite\): dropIn must be true or false/.test(e)), errors.join('\n'));
  fest.artists[3].dropIn = true;
  assert.deepEqual(validateFestivalDoc(fest).errors, []);
});

test('the one-set nudge: a live festival\'s lone all-day set beside busy stages is asked once; true or false answers it', () => {
  const [w, ...more] = asked(validateFestivalDoc(withRoom()));
  assert.deepEqual(more, []);
  assert.match(w, /Saturday: Long Room is the only set on Room all day — if people drift in and out, mark it "dropIn": true/);
  assert.match(w, /if it is a set people go to, "dropIn": false/);
  assert.deepEqual(asked(validateFestivalDoc(withRoom({ dropIn: true }))), []);
  assert.deepEqual(asked(validateFestivalDoc(withRoom({ dropIn: false }))), []);
  // Archived files are never asked (Lollapalooza 2025's 30-minute Bonus
  // Tracks set is a set, and nobody is editing that file).
  assert.deepEqual(asked(validateFestivalDoc({ ...withRoom(), status: 'archived' })), []);
  // A day of one-set stages is a small show, not a room beside a festival.
  const small = withRoom();
  small.days.Saturday.artists.splice(1, 1);
  assert.deepEqual(asked(validateFestivalDoc(small)), []);
});

test('Portola declares its three drop-in rooms and is clean; without the grid\'s two it is asked about exactly those', () => {
  const portola = JSON.parse(readFileSync(join(ROOT, 'data/festivals/portola-2026.json'), 'utf8'));
  const declared = [
    ...Object.entries(portola.days).flatMap(([day, d]) => (d.artists || []).filter((a) => a.dropIn === true).map((a) => `${day} ${a.stage} ${a.name} ${a.time}`)),
    ...portola.artists.filter((a) => a.dropIn === true).map((a) => `${a.day} ${a.venue} ${a.name} ${a.time}`),
  ];
  assert.deepEqual(declared, [
    'Saturday Despacio Despacio 2:45 PM - 9:45 PM',
    'Sunday Despacio Despacio 3:30 PM - 10:30 PM',
    'Afters Pier 80 (loyalty invite) Despacio 5 PM - 11 PM',
  ]);
  assert.deepEqual(validateFestivalDoc(portola, { filename: 'portola-2026.json' }).warnings, []);
  for (const d of Object.values(portola.days)) for (const a of d.artists || []) delete a.dropIn;
  const w = asked(validateFestivalDoc(portola, { filename: 'portola-2026.json' }));
  assert.equal(w.length, 2, w.join('\n'));
  assert.match(w[0], /Saturday: Despacio is the only set on Despacio all day/);
  assert.match(w[1], /Sunday: Despacio is the only set on Despacio all day/);
});

// ---- the CI command: freeze completeness and index.json ----------------------------

// A throwaway copy of the tree with one extra festival in it, run through the
// same command CI runs.
function validateWith({ file, index, frozen }) {
  const dir = mkdtempSync(join(tmpdir(), 'fest-guards-'));
  for (const d of ['data', 'scripts', 'api', 'js']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  cpSync(join(ROOT, 'tests', 'fixtures'), join(dir, 'tests', 'fixtures'), { recursive: true });
  writeFileSync(join(dir, 'data/festivals/guard-fest.json'), JSON.stringify(file));
  const idx = JSON.parse(readFileSync(join(dir, 'data/festivals/index.json'), 'utf8'));
  writeFileSync(join(dir, 'data/festivals/index.json'), JSON.stringify([...idx, index]));
  const fixture = JSON.parse(readFileSync(join(dir, 'tests/fixtures/live-pick-keys.json'), 'utf8'));
  fixture.festivals['guard-fest'] = frozen;
  writeFileSync(join(dir, 'tests/fixtures/live-pick-keys.json'), JSON.stringify(fixture));
  try {
    return { ok: true, out: execFileSync(process.execPath, [join(dir, 'scripts/validate-festivals.mjs')], { encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: e.stdout || '' };
  }
}
const guardFest = () => ({
  file: { id: 'guard-fest', name: 'Guard Fest', status: 'lineup', accent: '1, 2, 3', dates: 'Jan 1-2, 2027', artists: [{ name: 'Frozen', day: 'Friday' }, { name: 'Fresh', day: 'Saturday' }] },
  index: { id: 'guard-fest', name: 'Guard Fest', status: 'lineup', accent: '1, 2, 3', dates: 'Jan 1–2, 2027', startsOn: '2027-01-01' },
  frozen: { frozenAt: '2027-01-01', id: 'guard-fest', names: ['Fresh', 'Frozen'], days: ['Friday', 'Saturday'] },
});
const lines = (out, re) => out.split('\n').filter((l) => l.includes('guard-fest') && re.test(l));

test('the CI command passes the guard festival when the freeze holds every key and index.json agrees (display dates may differ)', () => {
  const r = validateWith(guardFest());
  assert.ok(r.ok, r.out);
  assert.deepEqual(lines(r.out, /./), []);
});

test('a name or day label a crew can pick that the freeze does not hold fails CI, and says which command fixes it', () => {
  const g = guardFest();
  g.frozen.names = ['Frozen'];
  g.frozen.days = ['Friday'];
  const r = validateWith(g);
  assert.equal(r.ok, false);
  const [line] = lines(r.out, /not frozen/);
  assert.ok(line, r.out);
  assert.match(line, /"Fresh"/);
  assert.match(line, /"Saturday"/);
  assert.match(line, /run node scripts\/freeze-pick-keys\.mjs guard-fest/);
});

test('index.json\'s status must match the file; a drifted name or accent only warns', () => {
  const g = guardFest();
  g.index.status = 'scheduled';
  const r = validateWith(g);
  assert.equal(r.ok, false);
  assert.ok(lines(r.out, /❌.*status "lineup" but index\.json says "scheduled"/).length, r.out);

  const h = guardFest();
  h.index.name = 'Guard Festival';
  h.index.accent = '9, 9, 9';
  const s = validateWith(h);
  assert.ok(s.ok, s.out);
  assert.ok(lines(s.out, /⚠️.*name "Guard Fest" but index\.json says "Guard Festival"/).length, s.out);
  assert.ok(lines(s.out, /⚠️.*accent "1, 2, 3" but index\.json says "9, 9, 9"/).length, s.out);
});
