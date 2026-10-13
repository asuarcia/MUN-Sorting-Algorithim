/* ============================================================
 *  test/verify.js — headless verification of the assignment engine
 *  Run:  node test/verify.js   (or: npm test)
 *  Proves, without launching the GUI:
 *    1. Confidentiality — only needed columns are read; PII is dropped
 *       and never present on any delegate object.
 *    2. Hard rule — no first-year lands in an Advanced committee.
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
const NEEDED = ['Full Name', 'School', 'Year', 'Preferred Type', 'Preferred Topics', 'Preferred Size', 'Seniority Pick'];
const PII = ['Email', 'Phone Number', 'Date of Birth', 'Home Address', 'Medical Conditions',
             'Allergies', 'Dietary Restrictions', 'Emergency Contact Name',
             'Emergency Contact Phone', 'Parent/Guardian Email'];

check('all needed columns were read',
  NEEDED.every(c => usedColumns.includes(c)),
  `missing: ${NEEDED.filter(c => !usedColumns.includes(c)).join(', ') || 'none'}`);
check('every PII column was ignored',
  PII.every(c => ignoredColumns.includes(c)),
  `leaked into used: ${PII.filter(c => usedColumns.includes(c)).join(', ') || 'none'}`);

const ALLOWED_KEYS = ['id', 'name', 'school', 'year', 'prefType', 'prefTopics', 'prefSize',
                      'seniorityPick', 'assigned', 'flagged', 'locked'];
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
check('every delegate has 1–3 topics',
  students.every(s => s.prefTopics.length >= 1 && s.prefTopics.length <= 3));
const withPick = students.filter(s => s.seniorityPick);
check('seniority picks resolved to committee ids', withPick.every(s => typeof s.seniorityPick === 'number'),
  `${withPick.length} delegates with a pick`);

// ── Assign ──────────────────────────────────────────────
const { fills } = E.runAssignment(students, E.COMMITTEES);
const byId = Object.fromEntries(E.COMMITTEES.map(c => [c.id, c]));
const placed = students.filter(s => s.assigned).length;
const flagged = students.filter(s => s.flagged).length;

// ── 2. Hard experience rule ─────────────────────────────
console.log('\nExperience rule (HARD: first-years never in Advanced)');
const violations = students.filter(s => s.year === 'first' && s.assigned && byId[s.assigned].tier === 'Advanced');
check('no first-year placed in an Advanced committee', violations.length === 0,
  violations.length ? violations.map(s => `${s.name}→${byId[s.assigned].name}`).join('; ') : 'clean');
const advNames = E.COMMITTEES.filter(c => c.tier === 'Advanced').map(c => c.name).join(', ');
console.log(`        (Advanced committees: ${advNames})`);

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
  ['type', 'size'].every(k => t.missingColumns.includes(k)), t.missingColumns.join(', '));
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
  E.topicHits({ prefTopics: ['human rights', 'LAW'] }, E.COMMITTEES[14]).length === 1);

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
  [m.typeMatch, m.topicMatch, m.sizeMatch].every(p => p >= 0 && p <= 100),
  `type ${m.typeMatch}% · topic ${m.topicMatch}% · size ${m.sizeMatch}% · picks ${m.picksHonored}/${m.picksTotal}`);
const pf = E.preflight(students, E.COMMITTEES);
check('preflight warns that capacity is short', pf.some(w => /only \d+ seats/.test(w.msg)));
check('every placed delegate has an explanation',
  students.filter(s => s.assigned).every(s => E.explainPlacement(s, E.COMMITTEES).length > 0));
check('default committee list is valid', E.validateCommittees(E.COMMITTEES).length === 0);
check('bad committee rows are rejected',
  E.validateCommittees([{ name: '', cap: 0, type: 'X', size: 'Small', tier: 'Beginner', topics: [] }]).length >= 3);

// ── Distribution snapshot ───────────────────────────────
console.log('\nCommittee fill (assigned / cap · tier):');
E.COMMITTEES.forEach(c => {
  const n = fills[c.id] || 0;
  console.log(`  ${String(n).padStart(3)} / ${String(c.cap).padStart(3)}   ${c.tier.padEnd(12)} ${c.name}`);
});

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
