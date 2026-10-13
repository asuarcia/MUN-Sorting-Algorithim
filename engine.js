/* ============================================================
 *  engine.js — MUN committee-assignment core logic
 *  Shared by the desktop UI (index.html) and the headless test
 *  (test/verify.js). No DOM, no browser APIs — pure functions so
 *  the same code that runs in the app can be verified in Node.
 * ========================================================== */
(function (root) {
  'use strict';

  // ── Committees ──────────────────────────────────────────
  // The default line-up. Organizers edit their own on the Committees tab;
  // every function below takes the committee list as a parameter.
  // tier drives experience-based matching:
  //   Advanced     → first-years are NEVER placed here (hard rule);
  //                  returning delegates are nudged toward these.
  //   Beginner     → large, first-year-friendly bodies.
  //   Intermediate → everything else.
  const COMMITTEES = [
    { id:1,  name:"African Summit",                  type:"Regional Summit", topics:["Healthcare","Corruption","Industrialization"], size:"Small",  cap:30,  tier:"Intermediate" },
    { id:2,  name:"Economic & Finance",              type:"Topic-based",     topics:["Economics","Trade","Banking"],                size:"Medium", cap:60,  tier:"Intermediate" },
    { id:3,  name:"European Summit",                 type:"Regional Summit", topics:["Technology","Politics","Defense"],            size:"Small",  cap:30,  tier:"Intermediate" },
    { id:4,  name:"Group of 20",                     type:"General",         topics:["Energy","Economics","Taxation"],              size:"Small",  cap:30,  tier:"Intermediate" },
    { id:5,  name:"International Court of Justice",   type:"Court",           topics:["Law","International Relations"],               size:"Small",  cap:25,  tier:"Advanced" },
    { id:6,  name:"International Security & Crime",   type:"Topic-based",     topics:["Security","Military","Law"],                   size:"Medium", cap:60,  tier:"Intermediate" },
    { id:7,  name:"Nation Building",                 type:"Historical",      topics:["History","Politics","Economics"],             size:"Large",  cap:120, tier:"Beginner" },
    { id:8,  name:"Press / Media",                   type:"Press",           topics:["Media","Journalism","Social Media"],          size:"Small",  cap:25,  tier:"Advanced" },
    { id:9,  name:"Social, Humanitarian & Cultural", type:"Topic-based",     topics:["Human Rights","Environment","Humanitarian"],  size:"Medium", cap:60,  tier:"Intermediate" },
    { id:10, name:"Asia-Pacific Summit",             type:"Regional Summit", topics:["Human Rights","Drug Policy","Environment"],   size:"Small",  cap:30,  tier:"Intermediate" },
    { id:11, name:"Environment & Technology",        type:"Topic-based",     topics:["Environment","Technology","Energy"],          size:"Medium", cap:60,  tier:"Intermediate" },
    { id:12, name:"General Assembly",                type:"General",         topics:["Population","Security","Humanitarian"],       size:"Large",  cap:120, tier:"Beginner" },
    { id:13, name:"Historical Security Council",     type:"Historical",      topics:["History","Security","Human Rights"],          size:"Small",  cap:25,  tier:"Advanced" },
    { id:14, name:"International Criminal Court",     type:"Court",           topics:["Law","History","Justice"],                    size:"Small",  cap:25,  tier:"Advanced" },
    { id:15, name:"MENA Summit",                     type:"Regional Summit", topics:["Labor","Healthcare","Human Rights"],          size:"Small",  cap:30,  tier:"Intermediate" },
    { id:16, name:"Pan-American Summit",             type:"Regional Summit", topics:["Law","Environment","Politics"],               size:"Small",  cap:30,  tier:"Intermediate" },
    { id:17, name:"Security Council",                type:"Topic-based",     topics:["Security","Technology","Military"],           size:"Small",  cap:25,  tier:"Advanced" },
    { id:18, name:"World Health Organization",       type:"Topic-based",     topics:["Healthcare","Humanitarian","Environment"],    size:"Medium", cap:60,  tier:"Intermediate" }
  ];

  const TYPE_OPTS = ["Regional Summit","Topic-based","Court","General","Historical","Press"];
  const SIZE_OPTS = ["Small","Medium","Large"];
  const TIER_OPTS = ["Beginner","Intermediate","Advanced"];

  // ── Field normalisers ───────────────────────────────────
  function matchType(raw) {
    const r = (raw || '').toLowerCase();
    if (r.includes('regional') || r.includes('summit'))   return 'Regional Summit';
    if (r.includes('criminal'))                           return 'Court';
    if (r.includes('court'))                              return 'Court';
    if (r.includes('historical') || r.includes('history'))return 'Historical';
    if (r.includes('press') || r.includes('media'))       return 'Press';
    if (r.includes('general') || r.includes('assembly'))  return 'General';
    if (r.includes('topic') || r.includes('specialized')) return 'Topic-based';
    for (const t of TYPE_OPTS) if (t.toLowerCase() === r) return t;
    return 'Topic-based';
  }

  function matchSize(raw) {
    const r = (raw || '').toLowerCase().trim();
    if (r === 'small' || r === 's') return 'Small';
    if (r === 'large' || r === 'l') return 'Large';
    return 'Medium';
  }

  // Resolve a free-text "seniority pick" to a committee id, or null.
  // Aliases point at committee NAMES (not ids) so they keep working after an
  // organizer edits the committee list. Acronyms are also derived from each
  // committee's own name ("World Health Organization" → "who").
  const COMMITTEE_ALIASES = {
    'icj':'International Court of Justice',
    'icc':'International Criminal Court',
    'sc':'Security Council', 'unsc':'Security Council',
    'hsc':'Historical Security Council',
    'ga':'General Assembly', 'unga':'General Assembly',
    'g20':'Group of 20', 'g-20':'Group of 20',
    'who':'World Health Organization',
    'press':'Press / Media', 'media':'Press / Media',
    'sochum':'Social, Humanitarian & Cultural', 'ecofin':'Economic & Finance'
  };
  const STOP = new Set(['of','and','the','for','on']);
  function acronym(name) {
    return String(name).split(/[^A-Za-z0-9]+/).filter(w => w && !STOP.has(w.toLowerCase()))
      .map(w => w[0]).join('').toLowerCase();
  }
  function matchCommittee(raw, committees) {
    committees = committees || COMMITTEES;
    const r = (raw || '').toLowerCase().trim();
    if (!r) return null;
    const byName = n => committees.find(c => c.name.toLowerCase() === n.toLowerCase());
    let hit = byName(r);                                                              // exact
    if (hit) return hit.id;
    if (COMMITTEE_ALIASES[r] && (hit = byName(COMMITTEE_ALIASES[r]))) return hit.id; // known acronym
    hit = committees.find(c => (c.abbr && c.abbr.toLowerCase() === r) || acronym(c.name) === r);
    if (hit) return hit.id;                                                           // derived acronym
    for (const c of committees) {                                                     // substring
      const n = c.name.toLowerCase();
      if (r.length >= 4 && (n.includes(r) || r.includes(n))) return c.id;
    }
    const rw = new Set(r.split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)));        // word overlap
    let best = null, bestScore = 0;
    for (const c of committees) {
      const overlap = c.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
        .filter(w => rw.has(w)).length;
      if (overlap > bestScore) { bestScore = overlap; best = c.id; }
    }
    return bestScore > 0 ? best : null;
  }

  // ── CSV parsing ─────────────────────────────────────────
  // Full-document RFC 4180 parser. Registration exports routinely carry
  // multi-line cells (notes, addresses, medical info), so splitting on
  // newlines first would tear rows apart — quotes must be tracked across lines.
  function parseCSV(text) {
    text = (text || '').replace(/^﻿/, '');
    const rows = []; let row = []; let field = ''; let quoted = false;
    let i = 0; const n = text.length;
    const endField = () => { row.push(quoted ? field : field.trim()); field = ''; quoted = false; };
    const endRow   = () => {
      endField();
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    };
    while (i < n) {
      const ch = text[i];
      if (ch === '"' && !quoted && field.trim() === '') {            // opening quote
        let j = i + 1, buf = '';
        while (j < n) {
          const q = text.indexOf('"', j);
          if (q === -1) { buf += text.slice(j); j = n; break; }
          buf += text.slice(j, q);
          if (text[q + 1] === '"') { buf += '"'; j = q + 2; }
          else { j = q + 1; break; }
        }
        field = buf; quoted = true; i = j;
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') i++; // stray chars after closing quote
        continue;
      }
      if (ch === ',') { endField(); i++; continue; }
      if (ch === '\n' || ch === '\r') {
        endRow();
        i += (ch === '\r' && text[i + 1] === '\n') ? 2 : 1;
        continue;
      }
      if (!quoted) field += ch;
      i++;
    }
    if (field !== '' || quoted || row.length) endRow();
    return rows;
  }

  // Single-line convenience wrapper.
  function parseCSVRow(line) { return parseCSV(line)[0] || []; }

  // Quote one value for CSV output (RFC 4180).
  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }

  function findCol(headers, candidates) {
    for (const c of candidates) { const i = headers.indexOf(c); if (i !== -1) return i; }
    return -1;
  }

  // The ONLY columns the sorter consumes. Anything else in the upload
  // (email, phone, address, medical, DOB, …) is ignored and never stored.
  const COLUMN_CANDIDATES = {
    name:      ['name','full name','student name','delegate name','first and last name'],
    school:    ['school','school name','institution','organization','delegation'],
    year:      ['year','experience','delegate year','level','experience level','first-year/returning','returning?','status'],
    type:      ['preferred type','type','committee type','pref type','preference type','committee preference'],
    topics:    ['preferred topics','topics','pref topics','topic preferences','topic'],
    size:      ['preferred size','size','pref size','committee size','size preference'],
    seniority: ['seniority pick','direct pick','seniority assignment','direct assignment','guaranteed committee','guaranteed placement','senior pick','priority pick']
  };

  /**
   * Parse a CSV string into delegate records, keeping ONLY needed fields.
   * Returns { students, usedColumns, ignoredColumns, missingColumns, unmatchedPicks, total }.
   * usedColumns / ignoredColumns use the ORIGINAL header text (for display).
   */
  function parseDelegates(text, committees) {
    committees = committees || COMMITTEES;
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('Spreadsheet has no data rows');

    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => h.toLowerCase().trim());

    const cm = {}; const usedIdx = new Set();
    for (const key of Object.keys(COLUMN_CANDIDATES)) {
      const idx = findCol(headers, COLUMN_CANDIDATES[key]);
      cm[key] = idx;
      if (idx !== -1) usedIdx.add(idx);
    }

    const usedColumns    = [...usedIdx].sort((a, b) => a - b).map(i => rawHeaders[i]);
    const ignoredColumns = rawHeaders.filter((h, i) => !usedIdx.has(i) && h.trim() !== '');
    const missingColumns = Object.keys(cm).filter(k => cm[k] === -1 && k !== 'seniority');

    const students = []; const unmatchedPicks = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.every(v => !v)) continue;
      const get  = idx => (idx !== -1 ? (cols[idx] || '') : '').trim();

      const rawYear = get(cm.year).toLowerCase();
      const year = (['first','1st','new','novice','freshman','beginner'].some(v => rawYear.includes(v)) || rawYear === 'f')
        ? 'first' : 'returning';

      const prefType = get(cm.type) ? matchType(get(cm.type)) : 'Topic-based';

      let prefTopics = get(cm.topics).split(/[;,|]/).map(t => t.trim()).filter(Boolean).slice(0, 3);
      if (!prefTopics.length) prefTopics = ['Economics'];

      const prefSize = get(cm.size) ? matchSize(get(cm.size)) : 'Medium';

      const rawPick = get(cm.seniority);
      const seniorityPick = matchCommittee(rawPick, committees);
      if (rawPick && !seniorityPick) unmatchedPicks.push(rawPick);

      students.push({
        id: students.length + 1,
        name:   get(cm.name)   || `Delegate ${students.length + 1}`,
        school: get(cm.school) || 'Unknown School',
        year,
        prefType,
        prefTopics,
        prefSize,
        seniorityPick,
        assigned: null,
        flagged: false,
        locked: false
      });
    }
    return { students, usedColumns, ignoredColumns, missingColumns, unmatchedPicks, total: students.length };
  }

  // ── Scoring + assignment ────────────────────────────────
  // Topics compare case-insensitively: "human rights" on the form matches
  // "Human Rights" on the committee.
  function topicHits(student, committee) {
    const ct = new Set(committee.topics.map(t => String(t).toLowerCase()));
    return student.prefTopics.filter(t => ct.has(String(t).toLowerCase()));
  }

  // Hard constraints return -Infinity (delegate can never go there):
  //   • committee is full
  //   • first-year + Advanced committee
  // Everything else is a soft score; highest score wins a seat.
  function scoreMatch(student, committee, ctx) {
    const { fills, schoolCnts, schoolSizes, total } = ctx;
    if (fills[committee.id] >= committee.cap) return -Infinity;                 // no seats
    if (student.year === 'first' && committee.tier === 'Advanced') return -Infinity; // experience hard rule

    let s = 0;

    // Seniority pick — strong boost (dominates normal prefs, still loses to a full/illegal committee)
    if (student.seniorityPick && committee.id === student.seniorityPick) s += 120;

    // Stated preferences
    if (student.prefType === committee.type) s += 40; else s -= 8;
    s += topicHits(student, committee).length * 22;
    if (student.prefSize === committee.size) s += 14;

    // Experience fit (soft)
    if (student.year === 'returning' && committee.tier === 'Advanced') s += 18;
    if (student.year === 'first'     && committee.tier === 'Beginner') s += 10;

    s -= (fills[committee.id] / committee.cap) * 12;                            // prefer emptier committees

    // School spread (soft): penalise going over a school's proportional fair share
    const count = schoolCnts[committee.id][student.school] || 0;
    if (count > 0) {
      const fairShare = Math.max(1, (schoolSizes[student.school] / total) * committee.cap);
      if (count >= fairShare * 2)      s -= 60;
      else if (count >= fairShare)     s -= 25;
    }
    return s;
  }

  /**
   * Seat every delegate. Delegates with `locked: true` (moved by hand by an
   * organizer) keep their committee and claim their seat first, so re-running
   * never undoes hand placements.
   */
  function runAssignment(students, committees) {
    committees = committees || COMMITTEES;
    const byId = Object.fromEntries(committees.map(c => [c.id, c]));
    students.forEach(s => {
      s.flagged = false;
      if (s.locked && byId[s.assigned]) return;
      s.locked = false; s.assigned = null;
    });

    const fills      = Object.fromEntries(committees.map(c => [c.id, 0]));
    const schoolCnts = Object.fromEntries(committees.map(c => [c.id, {}]));
    const schoolSizes = {};
    students.forEach(s => { schoolSizes[s.school] = (schoolSizes[s.school] || 0) + 1; });
    const total = students.length;

    const seat = (student, c) => {
      student.assigned = c.id;
      fills[c.id]++;
      schoolCnts[c.id][student.school] = (schoolCnts[c.id][student.school] || 0) + 1;
    };
    students.filter(s => s.locked).forEach(s => seat(s, byId[s.assigned]));

    const typeCount = {};
    committees.forEach(c => { typeCount[c.type] = (typeCount[c.type] || 0) + 1; });

    // Placement order: seniority picks first (claim their seat), then delegates whose
    // preferred committee type is rarer (fewer seats to fight over) go earlier.
    const sorted = students.filter(s => !s.locked).sort((a, b) => {
      const ap = a.seniorityPick ? 0 : 1, bp = b.seniorityPick ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (typeCount[a.prefType] || 0) - (typeCount[b.prefType] || 0);
    });

    for (const student of sorted) {
      let best = -Infinity, bestC = null;
      for (const c of committees) {
        const sc = scoreMatch(student, c, { fills, schoolCnts, schoolSizes, total });
        if (sc > best) { best = sc; bestC = c; }
      }
      if (bestC) seat(student, bestC);
      else student.flagged = true;  // every legal committee is full
    }
    return { fills };
  }

  // ── Explanations + metrics ──────────────────────────────
  // Short reason a delegate sits where they do — what an organizer reads
  // out when a school advisor asks "why this committee?".
  function explainPlacement(student, committees) {
    committees = committees || COMMITTEES;
    if (student.flagged) return 'No seat — every committee they can join is full';
    const c = committees.find(x => x.id === student.assigned);
    if (!c) return '';
    if (student.locked) return 'Placed by hand';
    const why = [];
    if (student.seniorityPick === c.id) why.push('seniority pick');
    else if (student.seniorityPick) {
      const p = committees.find(x => x.id === student.seniorityPick);
      if (p) why.push(student.year === 'first' && p.tier === 'Advanced'
        ? `pick (${p.name}) is closed to first-years` : `pick (${p.name}) was full`);
    }
    if (student.prefType === c.type) why.push('preferred type');
    const hits = topicHits(student, c);
    if (hits.length) why.push('topics: ' + hits.join(', '));
    if (student.prefSize === c.size) why.push('preferred size');
    if (!why.length) why.push('best open seat');
    return why.join(' · ');
  }

  function metrics(students, committees) {
    committees = committees || COMMITTEES;
    const byId = Object.fromEntries(committees.map(c => [c.id, c]));
    const placed = students.filter(s => byId[s.assigned]);
    const pct = n => placed.length ? Math.round(n / placed.length * 100) : 0;
    const picks = students.filter(s => s.seniorityPick);

    // Largest single-school share of any committee (rooms of 5+), to spot a school dominating.
    let top = null;
    committees.forEach(c => {
      const here = placed.filter(s => s.assigned === c.id);
      if (here.length < 5) return;
      const cnt = {};
      here.forEach(s => { cnt[s.school] = (cnt[s.school] || 0) + 1; });
      Object.entries(cnt).forEach(([school, n]) => {
        const share = n / here.length;
        if (!top || share > top.share) top = { share, school, committee: c.name, n, of: here.length };
      });
    });

    return {
      placed: placed.length,
      flagged: students.filter(s => s.flagged).length,
      seats: committees.reduce((a, c) => a + c.cap, 0),
      typeMatch:  pct(placed.filter(s => s.prefType === byId[s.assigned].type).length),
      topicMatch: pct(placed.filter(s => topicHits(s, byId[s.assigned]).length > 0).length),
      sizeMatch:  pct(placed.filter(s => s.prefSize === byId[s.assigned].size).length),
      picksHonored: picks.filter(s => s.assigned === s.seniorityPick).length,
      picksTotal: picks.length,
      maxSchoolShare: top ? { school: top.school, committee: top.committee, n: top.n, of: top.of, pct: Math.round(top.share * 100) } : null
    };
  }

  // Problems worth knowing BEFORE running — so the organizer can add seats or
  // fix the registration sheet instead of finding out from the flagged list.
  function preflight(students, committees) {
    committees = committees || COMMITTEES;
    const out = [];
    if (!committees.length) return [{ level:'error', msg:'There are no committees — add some on the Committees tab.' }];
    const seats = committees.reduce((a, c) => a + c.cap, 0);
    if (students.length > seats)
      out.push({ level:'warn', msg:`${students.length} delegates but only ${seats} seats — ${students.length - seats} will be flagged. Raise committee capacities on the Committees tab to seat everyone.` });
    const firsts = students.filter(s => s.year === 'first').length;
    const openSeats = committees.filter(c => c.tier !== 'Advanced').reduce((a, c) => a + c.cap, 0);
    if (firsts > openSeats)
      out.push({ level:'warn', msg:`${firsts} first-years but only ${openSeats} seats outside advanced committees — ${firsts - openSeats} first-years can't be seated.` });
    const byId = Object.fromEntries(committees.map(c => [c.id, c]));
    const badPicks = students.filter(s => s.year === 'first' && byId[s.seniorityPick] && byId[s.seniorityPick].tier === 'Advanced').length;
    if (badPicks)
      out.push({ level:'info', msg:`${badPicks} first-year${badPicks !== 1 ? 's have' : ' has'} a seniority pick for an advanced committee. The experience rule wins, so ${badPicks !== 1 ? 'those picks' : 'that pick'} can't be honored.` });
    const pickCnt = {};
    students.forEach(s => { if (byId[s.seniorityPick]) pickCnt[s.seniorityPick] = (pickCnt[s.seniorityPick] || 0) + 1; });
    Object.entries(pickCnt).forEach(([id, n]) => {
      const c = byId[id];
      if (n > c.cap) out.push({ level:'warn', msg:`${n} seniority picks for ${c.name}, which has ${c.cap} seats — ${n - c.cap} won't get their pick.` });
    });
    const types = new Set(committees.map(c => c.type));
    const orphan = [...new Set(students.map(s => s.prefType).filter(t => !types.has(t)))];
    if (orphan.length)
      out.push({ level:'info', msg:`No committee is of type ${orphan.join(', ')} — delegates who asked for it are matched on topics and size instead.` });
    return out;
  }

  // Sanity-check an organizer-edited committee list. Returns a list of problems.
  function validateCommittees(list) {
    const errs = [];
    if (!Array.isArray(list) || !list.length) return ['Add at least one committee'];
    const names = new Set();
    list.forEach((c, i) => {
      const label = (c.name && String(c.name).trim()) || `Row ${i + 1}`;
      if (!c.name || !String(c.name).trim()) errs.push(`Row ${i + 1}: name is empty`);
      else if (names.has(c.name.trim().toLowerCase())) errs.push(`${label}: name is used twice`);
      else names.add(c.name.trim().toLowerCase());
      if (!(Number.isInteger(c.cap) && c.cap > 0)) errs.push(`${label}: seats must be a whole number above 0`);
      if (!TYPE_OPTS.includes(c.type)) errs.push(`${label}: unknown type "${c.type}"`);
      if (!SIZE_OPTS.includes(c.size)) errs.push(`${label}: unknown size "${c.size}"`);
      if (!TIER_OPTS.includes(c.tier)) errs.push(`${label}: unknown level "${c.tier}"`);
      if (!Array.isArray(c.topics)) errs.push(`${label}: topics must be a list`);
    });
    return errs;
  }

  // ── Export ──────────────────────────────────────────────
  const api = {
    COMMITTEES, TYPE_OPTS, SIZE_OPTS, TIER_OPTS, COLUMN_CANDIDATES,
    matchType, matchSize, matchCommittee, acronym,
    parseCSV, parseCSVRow, csvCell, toCSV, findCol,
    parseDelegates, topicHits, scoreMatch, runAssignment,
    explainPlacement, metrics, preflight, validateCommittees
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENGINE = api;

})(typeof window !== 'undefined' ? window : globalThis);
