// A made-up crew of eight for ACL 2026 (the plan-days round, 2026-09-26):
// the model test's ACL crew (tests/plan-model.test.mjs, "ACL, a made-up
// crew") — placeholder names, invented picks on the real ACL lineup — so the
// open plan's days can be read across two weekends and the dated Late nights
// between. Never real crew data. Levels: 1-3 picked, 4 must.
export const ACL_ME = 'Ada';
export const ACL_MEMBERS = ['Ada', 'Bo', 'Cal', 'Dee', 'Eve', 'Flo', 'Gil', 'Hux'];
export const ACL_PICKS = {
  'Faouzia': { Ada: 2, Bo: 2, Cal: 1 },
  'Paris Paloma': { Ada: 3, Dee: 2, Eve: 2 },
  'Brandon Flowers': { Bo: 3, Cal: 3, Flo: 2 },
  'Turnstile': { Ada: 3, Bo: 2, Gil: 3, Hux: 2 },
  'Skrillex': { Cal: 4, Dee: 3, Eve: 3, Flo: 2, Gil: 2 },
  'Charli xcx': { Ada: 4, Bo: 3, Hux: 3 },
  'Kings of Leon': { Ada: 2, Dee: 3, Eve: 3, Hux: 2 },
  'Arcy Drive': { Flo: 3, Gil: 3, Hux: 2 },
  'Ryan Beatty': { Ada: 2, Bo: 3, Cal: 2 },
  'Lorde': { Ada: 4, Bo: 3, Cal: 3, Dee: 4, Eve: 2, Flo: 3 },
  'Fcukers': { Bo: 3, Dee: 2, Gil: 3, Hux: 3 },
  'The xx': { Ada: 3, Cal: 3, Eve: 4, Flo: 2 },
  'Twenty One Pilots': { Bo: 2, Dee: 3, Gil: 3 },
  'Jess Williamson': { Cal: 2, Eve: 2 },
};

export function crewDocAcl() {
  return {
    v: 4, meta: { name: 'Design crew', inviteFestId: 'acl-2026' }, spotify: {}, affinity: {},
    people: Object.fromEntries(ACL_MEMBERS.map((n, i) => [n, { colorIndex: i }])),
    festivals: { 'acl-2026': { selections: structuredClone(ACL_PICKS) } },
  };
}
