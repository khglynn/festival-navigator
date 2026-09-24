// Entering a crew you already belong to (2026-09-23). Two people-facing
// promises, held here as pure functions before any screen is involved:
//
//   1. RECOGNIZE YOU — a crew link you are not yet "me" in on this device
//      skips the "who are you?" screen when the crew doc already carries this
//      device's person id on exactly ONE active member. Anything else — no
//      record, no match, two matches, a record that answers to a different
//      name here — asks, as it always has.
//   2. BRING YOUR PICKS — entering a crew at a festival where this device
//      knows ANOTHER crew holding your picks offers, once, to copy them over:
//      only yours, only levels above zero, only onto artists you have not
//      touched here, never notes, never anyone else's.
//
// Kevin's decision of the day frames both: two crews at one fest stay two
// crews ("keep crews isolated but support multiple for one fest"). Nothing
// here reads a crew this device was not already in, and nothing leaves the
// device except the normal pick path.
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
const memoryStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = memoryStorage;
globalThis.location = { origin: 'https://fest.kevinhg.com', hash: '' };

const crew = await import('../js/crew.js');
const entry = await import('../js/v3/crew-entry.js');

// Made-up tokens: never a real crew, and never written after a `#g=`.
const HERE = 'crewentry_here_0123456789';
const ROSS = 'crewentry_ross_0123456789';
const SOLO = 'crewentry_solo_0123456789';
const PID = 'pid_kevin_0001';
const FID = 'portola-2026';

const me = (extra = {}) => ({ token: 'persontoken_entry_0123456', id: PID, name: 'Kevin', crews: {}, ...extra });
const doc = (people, selections = {}, { v = 4, fid = FID } = {}) => ({
  v, meta: {}, spotify: {}, affinity: {}, people, festivals: { [fid]: { selections } },
});

// ---- 1. recognize you --------------------------------------------------------------
test('recognizedMember: exactly one active member carrying my pid is me', () => {
  const d = doc({ Kevin: { pid: PID }, Ross: { pid: 'pid_ross_00001' } });
  assert.equal(crew.recognizedMember(me(), HERE, d), 'Kevin');
});

test('recognizedMember: my name may differ between crews — the pid decides, not the spelling', () => {
  const d = doc({ 'Kevin HG': { pid: PID }, Ross: {} });
  assert.equal(crew.recognizedMember(me(), HERE, d), 'Kevin HG');
});

test('recognizedMember: anything ambiguous asks instead', () => {
  assert.equal(crew.recognizedMember(null, HERE, doc({ Kevin: { pid: PID } })), null, 'no person record on this device');
  assert.equal(crew.recognizedMember(me({ id: undefined }), HERE, doc({ Kevin: { pid: PID } })), null, 'a record with no id');
  assert.equal(crew.recognizedMember(me(), HERE, doc({ Kevin: {}, Ross: {} })), null, 'nobody carries my pid');
  assert.equal(crew.recognizedMember(me(), HERE, doc({ Kevin: { pid: PID }, Kev: { pid: PID } })), null,
    'two members carrying my pid — which one is a question, not a guess');
  assert.equal(crew.recognizedMember(me(), HERE, doc({ Kevin: { pid: PID, removed: true }, Ross: {} })), null,
    'a removed member is not someone to walk back in as');
  assert.equal(crew.recognizedMember(me(), HERE, null), null);
});

test('recognizedMember: a rename leaves a tombstone with my pid — the active name wins', () => {
  const d = doc({ Kevin: { pid: PID, removed: true }, 'Kevin HG': { pid: PID } });
  assert.equal(crew.recognizedMember(me(), HERE, d), 'Kevin HG');
});

test('recognizedMember: my record answering to ANOTHER active name here is ambiguous', () => {
  // The person record's own mirror says "in this crew I am Kev" while the pid
  // sits on Kevin. Two answers to one question: ask.
  const person = me({ crews: { [HERE]: { name: 'Kev', crewName: '' } } });
  assert.equal(crew.recognizedMember(person, HERE, doc({ Kevin: { pid: PID }, Kev: {} })), null);
  // The mirror agreeing, or naming someone no longer here, changes nothing.
  assert.equal(crew.recognizedMember(me({ crews: { [HERE]: { name: 'Kevin' } } }), HERE, doc({ Kevin: { pid: PID } })), 'Kevin');
  assert.equal(crew.recognizedMember(me({ crews: { [HERE]: { name: 'Gone' } } }), HERE, doc({ Kevin: { pid: PID } })), 'Kevin');
});

// ---- 2. bring your picks ---------------------------------------------------------------
// This device: HERE (Kevin + Nhu, a few of Kevin's picks already), ROSS (Kevin
// as "Kev" + Ross), SOLO (just Kevin). "Mine" is AFFIRMATIVE on both sides
// (Codex, 2026-09-23): the name carries this device's pid, or the person
// record's own mirror for that crew names exactly it — an unclaimed
// placeholder is nobody's to move picks onto or off.
const MINE = { pid: PID };
function device({ here, others, meName = 'Kevin', person = me() }) {
  const docs = new Map(Object.entries(others).map(([t, o]) => [t, o.doc]));
  const names = new Map(Object.entries(others).map(([t, o]) => [t, o.me]));
  return {
    token: HERE, fid: FID, doc: here, meName, person,
    crews: [{ token: HERE, name: '' }, ...Object.keys(others).map((t) => ({ token: t, name: '' }))],
    docFor: (t) => docs.get(t) || null,
    meFor: (t) => names.get(t) || null,
  };
}

test('plan: only MY picks, only above zero, only onto artists I have not touched here', () => {
  const here = doc({ Kevin: MINE, Nhu: {} }, {
    Robyn: { Kevin: 2 },          // already picked here — never overwritten, never lowered
    Soulwax: { Kevin: 0 },        // cleared here on purpose — a tombstone is a decision
    Prospa: { Nhu: 3 },           // Nhu's pick — mine is still missing, so mine comes over
  });
  const ross = doc({ Kev: MINE, Ross: {} }, {
    Robyn: { Kev: 4 },            // would RAISE my Robyn — still not touched
    Soulwax: { Kev: 3 },
    Prospa: { Kev: 1, Ross: 4 },
    Kettama: { Kev: 4 },
    'Dog Blood': { Ross: 4 },     // Ross's, never mine to bring
    Floating: { Kev: 0 },         // a tombstone over there is not a pick
  });
  const plan = entry.planBringPicks(device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } }));
  assert.ok(plan, 'there is something to bring');
  assert.deepEqual(plan.picks, { Prospa: 1, Kettama: 4 }, 'my name differs there (Kev) and the picks still come');
  assert.equal(plan.count, 2);
  assert.equal(plan.total, 4, 'four live picks of mine over there, two of them already decided here');
  assert.equal(plan.from.token, ROSS);
  assert.deepEqual(plan.from.people, ['Ross'], 'named by its people, never by me');
  assert.equal(plan.meName, 'Kevin', 'the plan remembers who it was made for');
});

test('plan: the person record’s own mirror is affirmative too (a name not yet stamped with the pid)', () => {
  const here = doc({ Kevin: {}, Nhu: {} });
  const ross = doc({ Kev: {}, Ross: {} }, { Robyn: { Kev: 4 } });
  const person = me({ crews: { [HERE]: { name: 'Kevin' }, [ROSS]: { name: 'Kev' } } });
  const plan = entry.planBringPicks(device({ here, person, others: { [ROSS]: { doc: ross, me: 'Kev' } } }));
  assert.deepEqual(plan.picks, { Robyn: 4 });
});

test('plan: a legacy (v3) crew reads its old "Must See" as must', () => {
  const here = doc({ Kevin: MINE });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 3 }, Soulwax: { Kev: 1 } }, { v: 3 });
  const plan = entry.planBringPicks(device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } }));
  assert.deepEqual(plan.picks, { Robyn: 4, Soulwax: 1 }, 'labels carry the meaning: legacy 3 IS must');
});

test('plan: several other crews — the one holding the most of my picks, and it says how many there are', () => {
  const here = doc({ Kevin: MINE });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 1 }, Soulwax: { Kev: 1 }, Prospa: { Kev: 1 } });
  const solo = doc({ Kevin: MINE }, { Robyn: { Kevin: 2 } });
  const plan = entry.planBringPicks(device({ here, others: {
    [SOLO]: { doc: solo, me: 'Kevin' },
    [ROSS]: { doc: ross, me: 'Kev' },
  } }));
  assert.equal(plan.from.token, ROSS, 'three picks beat one, whatever order the device learned them in');
  assert.equal(plan.others, 1, 'one more crew with picks of mine — the copy says so');
});

test('plan: nothing to offer when there is nothing to bring', () => {
  const here = doc({ Kevin: MINE }, { Robyn: { Kevin: 1 } });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } })), null,
    'everything I picked there is already decided here');
  assert.equal(entry.planBringPicks(device({ here, others: {} })), null, 'no other crew on this device');
  const elsewhere = doc({ Kev: MINE }, { Robyn: { Kev: 1 } }, { fid: 'acl-2026' });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: elsewhere, me: 'Kev' } } })), null,
    'another crew at a DIFFERENT festival is not this festival');
  const unclaimed = doc({ Kev: MINE }, { Robyn: { Kev: 1 } });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: unclaimed, me: null } } })), null,
    'a crew this device never claimed a name in has no "my picks"');
  const d = device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: unclaimed, me: 'Kev' } } });
  assert.equal(entry.planBringPicks({ ...d, docFor: () => null }), null, 'a crew with no cached doc — nothing to read, nothing fetched');
});

test('plan: the person record decides who is who — a shared phone never moves one human’s picks onto another', () => {
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 } });
  // Here, the device picker is "Drew" (Settings → You on a borrowed phone),
  // and the person record says this device is Kevin in this crew.
  const here = doc({ Kevin: MINE, Drew: {} });
  const borrowed = device({ here, meName: 'Drew', person: me({ crews: { [HERE]: { name: 'Kevin' } } }),
    others: { [ROSS]: { doc: ross, me: 'Kev' } } });
  assert.equal(entry.planBringPicks(borrowed), null, 'Drew is not the human whose picks these are');
  // Over there, the claimed name now carries someone else's pid.
  const reclaimed = doc({ Kev: { pid: 'pid_someone_else' }, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: reclaimed, me: 'Kev' } } })), null,
    'a name another person record owns is not mine to copy from');
  // And a removed me is not me.
  const removed = doc({ Kev: { ...MINE, removed: true }, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: removed, me: 'Kev' } } })), null);
});

test('plan (Codex repro 1): a borrowed phone with NO mirror entry — the placeholder picker gets no offer', () => {
  // The device's person is Kevin; the picker on this phone is Drew, a
  // placeholder with no pid; the person record has no mirror entry for this
  // crew at all. Kevin's other crew holds Robyn: must. This used to plan
  // Robyn.Drew = 4.
  const here = doc({ Kevin: MINE, Drew: {} });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here, meName: 'Drew', others: { [ROSS]: { doc: ross, me: 'Kev' } } })), null,
    'another member here carries my pid — Drew is not me');
  const placeholderOnly = doc({ Drew: {} });
  assert.equal(entry.planBringPicks(device({ here: placeholderOnly, meName: 'Drew', others: { [ROSS]: { doc: ross, me: 'Kev' } } })), null,
    'an unclaimed placeholder is nobody’s: no offer');
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), person: null, others: { [ROSS]: { doc: ross, me: 'Kev' } } })), null,
    'no person record on this device — no offer');
  // The same test on the SOURCE side: a placeholder there is not my picks.
  const sourcePlaceholder = doc({ Kev: {}, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), others: { [ROSS]: { doc: sourcePlaceholder, me: 'Kev' } } })), null);
  const mirrorNamesOther = doc({ Kev: {}, Ross: {} }, { Robyn: { Kev: 4 } });
  assert.equal(entry.planBringPicks(device({ here: doc({ Kevin: MINE }), person: me({ crews: { [ROSS]: { name: 'Ross' } } }),
    others: { [ROSS]: { doc: mirrorNamesOther, me: 'Kev' } } })), null, 'the mirror names someone else there');
});

test('plan: a crew still on the legacy format takes no writes until it migrates', () => {
  const here = doc({ Kevin: MINE }, {}, { v: 3 });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 1 } });
  assert.equal(entry.planBringPicks(device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } })), null);
});

// ---- the tap brings what the card named, from the crew it named ----------------------
test('bringFromSource (Codex repro 2): never switches crews — what is left of the NAMED crew, or nothing', () => {
  const NHU = 'crewentry_nhu_01234567890';
  const here = doc({ Kevin: MINE });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 } });
  const nhu = doc({ Kevin: MINE, Nhu: {} }, { Soulwax: { Kevin: 4 } });
  const d = device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' }, [NHU]: { doc: nhu, me: 'Kevin' } } });
  const plan = entry.planBringPicks(d);
  assert.equal(plan.from.token, ROSS, 'the card names Ross’s crew');
  // Robyn gets picked here while the card is up.
  const now = { ...d, doc: doc({ Kevin: MINE }, { Robyn: { Kevin: 1 } }) };
  assert.equal(entry.planBringPicks(now).from.token, NHU, 'a fresh plan WOULD pick Nhu’s crew now …');
  const tap = entry.bringFromSource(plan, now);
  assert.deepEqual(tap, { picks: {}, count: 0 }, '… but the tap only ever brings from the crew the card named');
});

test('bringFromSource: what is left of the named crew comes, re-checked at the tap', () => {
  const here = doc({ Kevin: MINE });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 }, Soulwax: { Kev: 1 } });
  const d = device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } });
  const plan = entry.planBringPicks(d);
  const now = { ...d, doc: doc({ Kevin: MINE }, { Robyn: { Kevin: 2 } }) };
  assert.deepEqual(entry.bringFromSource(plan, now), { picks: { Soulwax: 1 }, count: 1 });
});

test('bringFromSource: a changed identity on either side voids the offer', () => {
  const here = doc({ Kevin: MINE, Nhu: {} });
  const ross = doc({ Kev: MINE, Ross: {} }, { Robyn: { Kev: 4 } });
  const d = device({ here, others: { [ROSS]: { doc: ross, me: 'Kev' } } });
  const plan = entry.planBringPicks(d);
  assert.equal(entry.bringFromSource(plan, { ...d, meName: 'Nhu' }), null, 'switched to Nhu here (Settings → You)');
  assert.equal(entry.bringFromSource(plan, { ...d, meFor: () => 'Ross' }), null, 'the source’s claim changed');
  assert.equal(entry.bringFromSource(plan, { ...d, fid: 'acl-2026' }), null, 'another festival');
  assert.equal(entry.bringFromSource(plan, { ...d, token: SOLO }), null, 'another crew');
  assert.equal(entry.bringFromSource(plan, { ...d, person: null }), null, 'no person record any more');
});

// ---- the words ------------------------------------------------------------------------
const planOf = (over) => ({ fid: FID, count: 12, total: 12, others: 0, picks: {}, from: { token: ROSS, name: 'Kev', people: ['Ross'] }, ...over });

test('copy: short, warm, and names the other crew by its people', () => {
  assert.equal(entry.bringOfferCopy(planOf(), 'Portola').line, 'Bring your 12 Portola picks from your crew with Ross?');
  assert.equal(entry.bringOfferCopy(planOf({ from: { people: ['Ross', 'Nhu'] } }), 'Portola').line,
    'Bring your 12 Portola picks from your crew with Ross and Nhu?');
  assert.equal(entry.bringOfferCopy(planOf({ from: { people: ['Ross', 'Nhu', 'Kat'] } }), 'Portola').line,
    'Bring your 12 Portola picks from your crew with Ross, Nhu and Kat?');
  assert.equal(entry.bringOfferCopy(planOf({ from: { people: ['Ross', 'Nhu', 'Kat', 'Drew', 'Pega'] } }), 'Portola').line,
    'Bring your 12 Portola picks from your crew with Ross, Nhu and 3 others?');
  assert.equal(entry.bringOfferCopy(planOf({ from: { people: [] } }), 'Portola').line,
    'Bring your 12 Portola picks from your solo board?');
});

test('copy: counts say what actually arrives', () => {
  const one = entry.bringOfferCopy(planOf({ count: 1, total: 1 }), 'Portola');
  assert.equal(one.line, 'Bring your Portola pick from your crew with Ross?');
  assert.equal(one.yes, 'Bring it');
  assert.equal(entry.bringOfferCopy(planOf({ count: 3, total: 12 }), 'Portola').line,
    'Bring 3 more of your Portola picks from your crew with Ross?', 'nine were already decided here');
  assert.equal(entry.bringOfferCopy(planOf(), 'Portola').yes, 'Bring them');
  assert.equal(entry.bringOfferCopy(planOf(), 'Portola').no, 'No thanks');
  assert.equal(entry.bringDoneLine(12), 'Brought 12 picks over ✓');
  assert.equal(entry.bringDoneLine(1), 'Brought 1 pick over ✓');
});

test('copy: several other crews — it says it picked the fullest', () => {
  const c = entry.bringOfferCopy(planOf({ others: 1 }), 'Portola');
  assert.match(c.sub, /fullest of your 2 other Portola crews/);
  assert.match(entry.bringOfferCopy(planOf(), 'Portola').sub, /nothing you’ve picked here changes/i);
});

// ---- once per crew × fest ---------------------------------------------------------------
test('the answer is remembered per crew × festival', () => {
  store.clear();
  assert.equal(entry.bringAnswered(HERE, FID), false);
  entry.rememberBringAnswer(HERE, FID, 'declined');
  assert.equal(entry.bringAnswered(HERE, FID), true);
  assert.equal(entry.bringAnswered(HERE, 'acl-2026'), false, 'another festival in the same crew asks for itself');
  assert.equal(entry.bringAnswered(ROSS, FID), false, 'another crew at the same festival asks for itself');
  assert.ok([...store.keys()].some((k) => k.startsWith('fn_bring_picks_v1')), 'it reached localStorage');
});

test('a storage-blocked browser (the GETTER throws) still hears the answer for this page — and never throws', () => {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError: Failed to read the localStorage property from Window'); },
  });
  try {
    assert.doesNotThrow(() => entry.bringAnswered(SOLO, FID));
    assert.equal(entry.bringAnswered(SOLO, FID), false);
    assert.doesNotThrow(() => entry.rememberBringAnswer(SOLO, FID, 'brought'));
    assert.equal(entry.bringAnswered(SOLO, FID), true, 'memory carries it when storage cannot');
  } finally {
    Object.defineProperty(globalThis, 'localStorage', prev);
  }
});
