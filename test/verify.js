/* ============================================================
 *  test/verify.js — headless verification of the assignment engine
 *  Run:  node test/verify.js   (or: npm test)
 *  Proves, without launching the GUI:
 *    1. Confidentiality — only needed columns are read; PII is dropped
 *       and never present on any delegate object.
 *    2. Experience rule — first-years avoid Advanced committees; a capped handful get in.
 *    3. Seniority picks — honored (strong boost) when capacity allows.
 *    4. Placement — delegates get seated.
 *  Generate the input first:  python make_mock_data.py
 * ========================================================== */
const fs = require('fs');
const path = require('path');
const E = require('../engine.js');

let failures = 0;
function check(label, cond, detail) {
  const ok = !!cond;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
}

const csvPath = path.join(__dirname, '..', 'mock_delegates.csv');
if (!fs.existsSync(csvPath)) {
  console.error('mock_delegates.csv not found — run:  python make_mock_data.py');
  process.exit(2);
}
const csv = fs.readFileSync(csvPath, 'utf8');

// ── Parse ───────────────────────────────────────────────
const { students, usedColumns, ignoredColumns } = E.parseDelegates(csv);
console.log(`\nParsed ${students.length} delegates`);
console.log(`  used columns:    ${usedColumns.join(', ')}`);
console.log(`  ignored columns: ${ignoredColumns.join(', ')}\n`);

// ── 1. Confidentiality ──────────────────────────────────
console.log('Confidentiality');
// Exact headers of the 2027 GPY Model UN Airtable form.
const NEEDED = ['First Name', 'Last Name', 'Preferred First Name', 'Delegation', 'Grade',
                'Are you a first year delegate or returning?', 'What are your interests in Model UN?',
                'Please select ALL committee sizes you are interested in', 'Seniority Pick'];
const PII = ['Gender', 'Pronouns', 'Birthday', 'T-Shirt Size', 'Email', 'Home Address', 'City', 'State',
             'Zip Code', 'Parent/Guardian & Emergency Contact Name', 'Parent/Guardian & Emergency Contact Phone',
             'Parent/Guardian & Emergency Contact Email', 'Additional Emergency Contact Phone',
             'Dietary Restrictions - Please select from the list below',
             'Allergies - Please select all allergies from the list below', 'Do you require an Epi-Pen?',
             'Medical Insurance Provider', 'Health Insurance Policy Number', 'Insurance Group Name/Number',
             'Medical Insurance Policy Holder Full Name', 'Policy Holder Phone Number', 'Medical Waiver',
             'Parent Signature - Code of Conduct'];

check('all needed columns were read',
  NEEDED.every(c => usedColumns.includes(c)),
  `missing: ${NEEDED.filter(c => !usedColumns.includes(c)).join(', ') || 'none'}`);
check('every PII column was ignored',
  PII.every(c => ignoredColumns.includes(c)),
  `leaked into used: ${PII.filter(c => usedColumns.includes(c)).join(', ') || 'none'}`);

const ALLOWED_KEYS = ['id', 'name', 'school', 'grade', 'year', 'prefType', 'prefTopics', 'prefSizes',
                      'seniorityPick', 'assigned', 'flagged', 'locked', 'country'];
const leakedKeys = new Set();
students.forEach(s => Object.keys(s).forEach(k => { if (!ALLOWED_KEYS.includes(k)) leakedKeys.add(k); }));
check('delegate objects hold no extra fields (no PII stored)',
  leakedKeys.size === 0, `unexpected keys: ${[...leakedKeys].join(', ') || 'none'}`);

// Belt-and-suspenders: no obviously-PII value (an email) anywhere in the data.
const anyEmail = students.some(s => JSON.stringify(s).includes('@'));
check('no email addresses present anywhere in delegate data', !anyEmail);

// ── Field parsing sanity ────────────────────────────────
console.log('\nParsing');
const firstYears = students.filter(s => s.year === 'first').length;
const returning = students.length - firstYears;
check('year mapped to first/returning', firstYears > 0 && returning > 0, `${firstYears} first / ${returning} returning`);
check('every delegate has at least one interest', students.every(s => s.prefTopics.length >= 1));
check('interests are the form’s own options', students.every(s => s.prefTopics.every(t => E.INTERESTS.includes(t))));
check('grades parsed (9–12)', students.every(s => E.GRADES.includes(s.grade)));
check('names built from first + last name', students.every(s => /\S+ \S+/.test(s.name)));
check('"No preference on committee size" means no size preference',
  students.some(s => s.prefSizes.length === 0) && students.every(s => s.prefSizes.every(z => E.SIZE_OPTS.includes(z))));
check('no type preference invented (form has no type question)', students.every(s => s.prefType === null));
const withPick = students.filter(s => s.seniorityPick);
check('seniority picks resolved to committee ids', withPick.every(s => typeof s.seniorityPick === 'number'),
  `${withPick.length} delegates with a pick`);

// ── Assign ──────────────────────────────────────────────
const { fills } = E.runAssignment(students, E.COMMITTEES);
const byId = Object.fromEntries(E.COMMITTEES.map(c => [c.id, c]));
const placed = students.filter(s => s.assigned).length;
const flagged = students.filter(s => s.flagged).length;

// ── 2. Experience rule (soft) ───────────────────────────
console.log('\nExperience rule (first-years avoid Advanced; only a handful get in)');
const advanced = E.COMMITTEES.filter(c => c.tier === 'Advanced');
const firstsInAdv = students.filter(s => s.year === 'first' && s.assigned && byId[s.assigned].tier === 'Advanced');
check('first-years in Advanced committees are rare', firstsInAdv.length <= firstYears * 0.05,
  `${firstsInAdv.length} of ${firstYears} first-years: ` + (firstsInAdv.map(s => `${s.name}→${byId[s.assigned].name}`).join('; ') || 'none'));
check('no Advanced committee goes over its first-year seats',
  advanced.every(c => firstsInAdv.filter(s => s.assigned === c.id).length <= E.firstYearSeats(c)),
  advanced.map(c => `${c.name} ${E.firstYearSeats(c)}`).join(', '));
// Two committees, same topics: the first-year takes the non-Advanced one on an
// even fit, and the Advanced one only when it fits by more than the penalty.
const pair = [
  { id: 1, name: 'Adv', type: 'Court', topics: ['Law', 'History', 'Health'], size: 'Small', cap: 25, tier: 'Advanced' },
  { id: 2, name: 'Mid', type: 'Court', topics: ['Law', 'History', 'Health'], size: 'Small', cap: 25, tier: 'Intermediate' }
];
const fy = topics => ({ id: 1, name: 'F Y', school: 'S', grade: 9, year: 'first', prefTopics: topics, prefSizes: [] });
const even = [fy(['Law'])]; E.runAssignment(even, pair);
check('first-year takes the non-Advanced committee on an even fit', even[0].assigned === 2);
const strong = [fy(['Law', 'History', 'Health'])];
const weaker = [pair[0], { ...pair[1], topics: ['Law', 'Economic', 'Technology'] }];
E.runAssignment(strong, weaker);
check('first-year with a much stronger fit can get into an Advanced committee', strong[0].assigned === 1,
  E.explainPlacement(strong[0], weaker));

// ── 3. Seniority picks ──────────────────────────────────
console.log('\nSeniority picks (strong boost)');
const honored = withPick.filter(s => s.assigned === s.seniorityPick).length;
check('all seniority picks honored (capacity permitting)', honored === withPick.length,
  `${honored}/${withPick.length} honored`);

// ── 4. Placement ────────────────────────────────────────
// With more delegates than seats, the overflow is correctly flagged for manual
// review — so we verify every seat is filled and only the true overflow is flagged.
console.log('\nPlacement');
const totalCap = E.COMMITTEES.reduce((a, c) => a + c.cap, 0);
const expectedPlaced  = Math.min(students.length, totalCap);
const expectedFlagged = Math.max(0, students.length - totalCap);
check('every available seat is filled', placed === expectedPlaced,
  `${placed} placed of ${totalCap} seats`);
check('only true overflow (delegates beyond capacity) is flagged', flagged === expectedFlagged,
  `${flagged} flagged; capacity short by ${expectedFlagged}`);

// ── 5. CSV robustness ───────────────────────────────────
console.log('\nCSV robustness');
const tricky = '﻿Name,School,Year,Notes,Preferred Topics\r\n' +
  'Ann Lee,"Hill, School",first,"line one\nline two, with comma",Law;History\r\n' +
  '"Bo ""BJ"" Ray",Oak High,returning,,"Security; Military"\r\n\r\n';
const t = E.parseDelegates(tricky);
check('multi-line quoted cells do not split a row', t.students.length === 2, `${t.students.length} rows`);
check('quoted commas and escaped quotes survive',
  t.students[0].school === 'Hill, School' && t.students[1].name === 'Bo "BJ" Ray');
check('missing required columns are reported',
  t.missingColumns.includes('size') && !t.missingColumns.includes('type'), t.missingColumns.join(', '));
check('CSV export round-trips awkward values',
  JSON.stringify(E.parseCSV(E.toCSV([['a,b', 'say "hi"', 'x\ny', ' pad ']]))[0]) ===
  JSON.stringify(['a,b', 'say "hi"', 'x\ny', ' pad ']));

// ── 6. Seniority-pick matching ──────────────────────────
console.log('\nSeniority-pick matching');
const cases = { 'ICJ':5, 'who':18, 'Security Council':17, 'sochum':9, 'G20':4, 'hsc':13, 'International Court':5, 'xyz':null };
const bad = Object.entries(cases).filter(([k, v]) => E.matchCommittee(k) !== v);
check('names and acronyms resolve to the right committee', !bad.length,
  bad.map(([k, v]) => `${k}→${E.matchCommittee(k)} (want ${v})`).join('; ') || 'clean');
const renamed = E.COMMITTEES.map(c => c.id === 18 ? { ...c, id: 99 } : c);
check('aliases follow committee names, not fixed ids', E.matchCommittee('WHO', renamed) === 99);
check('topics match case-insensitively',
  E.topicHits({ prefTopics: ['health', 'LAW'] }, E.COMMITTEES[14]).length === 1);
check('older topic words fold onto the form’s interests',
  E.normalizeTopic('Healthcare') === 'Health' && E.normalizeTopic('Human Rights') === 'Social Justice/Human Rights' &&
  E.normalizeTopic('Security') === 'Military/Conflict Resolution' && E.normalizeTopic('Economics') === 'Economic' &&
  E.normalizeTopic('Journalism') === 'Social Media' && E.normalizeTopic('Drug Policy') === 'Drug Policy');
check('multi-select sizes parse; all three = no preference',
  JSON.stringify(E.matchSizes('Small (20-40),Large (70+)')) === '["Small","Large"]' &&
  E.matchSizes('No preference on committee size').length === 0 &&
  E.matchSizes('Small (20-40),Medium (40-70),Large (70+)').length === 0);
check('default committee sizes sit inside the form’s seat ranges',
  E.COMMITTEES.every(c => c.cap >= E.SIZE_RANGES[c.size][0] && c.cap <= E.SIZE_RANGES[c.size][1]));
check('every form interest is covered by some default committee',
  E.INTERESTS.every(i => E.COMMITTEES.some(c => c.topics.includes(i))));
const renamedHdr = E.parseDelegates('First Name,Last Name,School Name,Year in MUN (first year or returning),Interests,Committee size\nA,B,X,First year delegate,Law,Small (20-40)\n');
check('loosely-named Airtable fields are still found',
  renamedHdr.missingColumns.length === 0 && renamedHdr.students[0].year === 'first' && renamedHdr.students[0].prefSizes[0] === 'Small',
  renamedHdr.usedColumns.join(' | '));

// ── 7. Manual moves survive a re-run ────────────────────
console.log('\nManual moves (locked)');
const moved = students.find(s => s.assigned && s.year === 'returning');
const target = E.COMMITTEES.find(c => c.id !== moved.assigned && c.tier === 'Advanced');
moved.assigned = target.id; moved.locked = true;
const prevOther = students.filter(s => s !== moved).map(s => s.assigned);
E.runAssignment(students, E.COMMITTEES);
check('locked delegate keeps their hand-placed committee', moved.assigned === target.id);
const fills2 = {}; students.forEach(s => { if (s.assigned) fills2[s.assigned] = (fills2[s.assigned] || 0) + 1; });
check('no committee over capacity after re-run', E.COMMITTEES.every(c => (fills2[c.id] || 0) <= c.cap));
check('re-run is deterministic for everyone else',
  students.filter(s => s !== moved).filter((s, i) => s.assigned !== prevOther[i]).length < students.length * 0.1);

// ── 8. Metrics + preflight ──────────────────────────────
console.log('\nMetrics + preflight');
const m = E.metrics(students, E.COMMITTEES);
check('metrics report sensible percentages',
  m.typeMatch === null && [m.topicMatch, m.sizeMatch].every(p => p >= 0 && p <= 100),
  `type ${m.typeMatch}% · topic ${m.topicMatch}% · size ${m.sizeMatch}% · picks ${m.picksHonored}/${m.picksTotal}`);
const pf = E.preflight(students, E.COMMITTEES);
check('preflight warns that capacity is short', pf.some(w => /only \d+ seats/.test(w.msg)));
check('every placed delegate has an explanation',
  students.filter(s => s.assigned).every(s => E.explainPlacement(s, E.COMMITTEES).length > 0));
check('default committee list is valid', E.validateCommittees(E.COMMITTEES).length === 0);
check('bad committee rows are rejected',
  E.validateCommittees([{ name: '', cap: 0, type: 'X', size: 'Small', tier: 'Beginner', topics: [] }]).length >= 3);

// ── 9. Countries ────────────────────────────────────────
console.log('\nCountries');
E.runAssignment(students, E.COMMITTEES);
const noCountry = E.COMMITTEES.filter(c => !E.positionsFor(c, 1).length).map(c => c.id);
check('every seated delegate outside Courts/Press has a country',
  students.filter(s => s.assigned && !noCountry.includes(s.assigned)).every(s => s.country) &&
  students.filter(s => noCountry.includes(s.assigned)).every(s => !s.country),
  `no countries in: ${E.COMMITTEES.filter(c => noCountry.includes(c.id)).map(c => c.name).join(', ')}`);
const dupRooms = E.COMMITTEES.filter(c => {
  const here = students.filter(s => s.assigned === c.id);
  const pos = E.positionsFor(c, here.length);
  return pos.length && new Set(pos).size === pos.length && new Set(here.map(s => s.country)).size !== here.length;
});
check('no country is given twice in a room that has enough countries', dupRooms.length === 0, dupRooms.map(c => c.name).join(', ') || 'clean');
const nb = E.COMMITTEES.find(c => c.name === 'Nation Building');
const nbCounts = Object.values(students.filter(s => s.assigned === nb.id).reduce((a, s) => (a[s.country] = (a[s.country] || 0) + 1, a), {}));
check('Nation Building spreads delegates evenly across its nations', Math.max(...nbCounts) - Math.min(...nbCounts) <= 1, nbCounts.join(' / '));
const mena = E.COMMITTEES.find(c => c.name === 'MENA Summit');
check('a region that runs out continues with outside countries, not duplicates',
  new Set(E.positionsFor(mena, mena.cap)).size === mena.cap);
check('Security Council starts with the P5', ['United States', 'China', 'Russia', 'United Kingdom', 'France'].every(n => E.positionsFor(E.COMMITTEES.find(c => c.name === 'Security Council'), 5).includes(n)));

// Inversions: (first-year, returning) pairs in one room where the first-year
// got the more significant country. 0% would be strict, ~50% random.
const inversions = size => {
  let inv = 0, pairs = 0;
  E.COMMITTEES.filter(c => c.size === size).forEach(c => {
    const here = students.filter(s => s.assigned === c.id && s.country);
    const pos = E.positionsFor(c, here.length);
    if (new Set(pos).size < pos.length) return;
    const r = s => pos.indexOf(s.country);
    const F = here.filter(s => s.year === 'first'), R = here.filter(s => s.year === 'returning');
    F.forEach(f => R.forEach(x => { pairs++; if (r(f) < r(x)) inv++; }));
  });
  return pairs ? inv / pairs * 100 : 0;
};
const invL = inversions('Large'), invM = inversions('Medium'), invS = inversions('Small');
check('returning delegates get the more significant countries, but not strictly',
  [invL, invM, invS].every(p => p > 1 && p < 25), `first-year ahead of a returner: Large ${invL.toFixed(1)}% · Medium ${invM.toFixed(1)}% · Small ${invS.toFixed(1)}%`);
check('big committees follow experience more closely than small ones', invL < invS);
const statesBefore = students.map(s => s.country).join('|');
E.assignCountries(students, E.COMMITTEES);
check('countries are deterministic', students.map(s => s.country).join('|') === statesBefore);

// A room with very few returners still ranks by what experience there is.
const world = [{ id: 1, name: 'GA', type: 'General', topics: [], size: 'Large', cap: 120, tier: 'Beginner', countries: [], pool: 'World' }];
const top = E.positionsFor(world[0], 60);
const room = (returners) => Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `D${i}`, school: 'S', year: i < returners ? 'returning' : 'first', grade: 9 + (i % 4), prefTopics: [], prefSizes: [], assigned: 1 }));
const few = room(3); E.assignCountries(few, world);
const fewRet = few.filter(s => s.year === 'returning').map(s => top.indexOf(s.country));
check('with only 3 returners, they still get top countries', fewRet.every(r => r < 15), `positions ${fewRet.map(r => r + 1).join(', ')} of 60`);
const meanPos = (list, g) => { const r = list.filter(s => s.year === 'first' && s.grade === g).map(s => top.indexOf(s.country)); return r.reduce((a, b) => a + b, 0) / r.length; };
check('...and older first-years get the next most significant ones', meanPos(few, 12) < meanPos(few, 9),
  `mean position: grade 12 first-years ${(meanPos(few, 12) + 1).toFixed(0)}, grade 9 ${(meanPos(few, 9) + 1).toFixed(0)}`);
const none = room(0); E.assignCountries(none, world);
check('with no returners at all, grade decides', meanPos(none, 12) < meanPos(none, 11) && meanPos(none, 11) < meanPos(none, 9));
check('committees saved before countries get their defaults by name',
  E.positionsOf({ name: 'Security Council', type: 'Topic-based' }).countries[0] === 'United States' &&
  E.positionsOf({ name: 'My Custom Court', type: 'Court' }).pool === '' && E.positionsOf({ name: 'Custom', type: 'General' }).pool === 'World');
const cf = E.metrics(students, E.COMMITTEES).countryFit;
console.log(`        returning delegates: ${cf.returningPct}% of those with a country, ${cf.topReturningPct}% of each room's top fifth`);

// ── Distribution snapshot ───────────────────────────────
console.log('\nCommittee fill (assigned / cap · tier):');
E.COMMITTEES.forEach(c => {
  const n = fills[c.id] || 0;
  console.log(`  ${String(n).padStart(3)} / ${String(c.cap).padStart(3)}   ${c.tier.padEnd(12)} ${c.name}`);
});

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
