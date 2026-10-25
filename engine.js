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
  // Topics use the registration form's interest list (INTERESTS below) so a
  // delegate's ticked interests line up with committees word for word.
  const COMMITTEES = [
    { id:1,  name:"African Summit",                  type:"Regional Summit", topics:["Health","Economic","Social Justice/Human Rights"],                 size:"Small",  cap:30,  tier:"Intermediate" },
    { id:2,  name:"Economic & Finance",              type:"Topic-based",     topics:["Economic","Technology","Law"],                                     size:"Medium", cap:60,  tier:"Intermediate" },
    { id:3,  name:"European Summit",                 type:"Regional Summit", topics:["Technology","Economic","Military/Conflict Resolution"],            size:"Small",  cap:30,  tier:"Intermediate" },
    { id:4,  name:"Group of 20",                     type:"General",         topics:["Economic","Environment","Technology"],                             size:"Small",  cap:30,  tier:"Intermediate" },
    { id:5,  name:"International Court of Justice",   type:"Court",           topics:["Law","Social Justice/Human Rights","History"],                     size:"Small",  cap:25,  tier:"Advanced" },
    { id:6,  name:"International Security & Crime",   type:"Topic-based",     topics:["Military/Conflict Resolution","Law","Technology"],                size:"Medium", cap:60,  tier:"Intermediate" },
    { id:7,  name:"Nation Building",                 type:"Historical",      topics:["History","Economic","Social Justice/Human Rights"],                size:"Large",  cap:120, tier:"Beginner" },
    { id:8,  name:"Press / Media",                   type:"Press",           topics:["Social Media","Technology","Social Justice/Human Rights"],         size:"Small",  cap:25,  tier:"Advanced" },
    { id:9,  name:"Social, Humanitarian & Cultural", type:"Topic-based",     topics:["Social Justice/Human Rights","Health","Environment"],              size:"Medium", cap:60,  tier:"Intermediate" },
    { id:10, name:"Asia-Pacific Summit",             type:"Regional Summit", topics:["Environment","Economic","Military/Conflict Resolution"],           size:"Small",  cap:30,  tier:"Intermediate" },
    { id:11, name:"Environment & Technology",        type:"Topic-based",     topics:["Environment","Technology","Social Media"],                         size:"Medium", cap:60,  tier:"Intermediate" },
    { id:12, name:"General Assembly",                type:"General",         topics:["Social Justice/Human Rights","Military/Conflict Resolution","Health"], size:"Large", cap:120, tier:"Beginner" },
    { id:13, name:"Historical Security Council",     type:"Historical",      topics:["History","Military/Conflict Resolution","Law"],                    size:"Small",  cap:25,  tier:"Advanced" },
    { id:14, name:"International Criminal Court",     type:"Court",           topics:["Law","Social Justice/Human Rights","History"],                     size:"Small",  cap:25,  tier:"Advanced" },
    { id:15, name:"MENA Summit",                     type:"Regional Summit", topics:["Military/Conflict Resolution","Health","Social Justice/Human Rights"], size:"Small", cap:30, tier:"Intermediate" },
    { id:16, name:"Pan-American Summit",             type:"Regional Summit", topics:["Law","Environment","Economic"],                                    size:"Small",  cap:30,  tier:"Intermediate" },
    { id:17, name:"Security Council",                type:"Topic-based",     topics:["Military/Conflict Resolution","Technology","Law"],                size:"Small",  cap:25,  tier:"Advanced" },
    { id:18, name:"World Health Organization",       type:"Topic-based",     topics:["Health","Technology","Social Justice/Human Rights"],              size:"Medium", cap:60,  tier:"Intermediate" }
  ];

  const TYPE_OPTS = ["Regional Summit","Topic-based","Court","General","Historical","Press"];
  const SIZE_OPTS = ["Small","Medium","Large"];
  const TIER_OPTS = ["Beginner","Intermediate","Advanced"];

  // ── The registration form (2027 GPY Model UN, Airtable) ──
  // Defaults mirror the form so its export imports with no renaming.
  const DEFAULT_CONFERENCE = "2027 GPY Model UN Conference";
  // "What are your interests in Model UN?" (tick all that apply)
  const INTERESTS = ["Technology","Health","Environment","Economic","Law",
    "Social Justice/Human Rights","History","Military/Conflict Resolution","Social Media"];
  // "Please select ALL committee sizes you are interested in"
  const SIZE_RANGES = { Small:[20, 40], Medium:[40, 70], Large:[70, Infinity] };
  const sizeLabel = s => SIZE_RANGES[s] ? `${s} (${SIZE_RANGES[s][0]}${SIZE_RANGES[s][1] === Infinity ? '+' : '–' + SIZE_RANGES[s][1]})` : s;
  const GRADES = [9, 10, 11, 12];

  // ── Field normalisers ───────────────────────────────────
  // Fold a topic onto the form's interest list, so committees written with
  // older or looser words ("Healthcare", "Security", "Human Rights") still
  // match what delegates ticked. Anything unrecognised is kept as typed.
  const INTEREST_RULES = [
    [/social media|journalis|press|\bmedia\b/,                                        'Social Media'],
    [/social justice|human rights|humanitarian|refugee|civil rights|equality/,        'Social Justice/Human Rights'],
    [/military|conflict|security|defen[cs]e|\bwar\b|peace|terroris|disarm/,           'Military/Conflict Resolution'],
    [/tech|cyber|digital|\bai\b|artificial intelligence|space/,                       'Technology'],
    [/health|medic|disease|pandemic/,                                                 'Health'],
    [/environment|climate|energy|sustainab|ocean/,                                    'Environment'],
    [/econom|trade|financ|bank|tax|labou?r|industr|development/,                      'Economic'],
    [/histor/,                                                                        'History'],
    [/\blaw\b|legal|justice|court|corruption|crime|criminal/,                         'Law']
  ];
  function normalizeTopic(raw) {
    const t = String(raw || '').trim();
    if (!t) return '';
    const exact = INTERESTS.find(i => i.toLowerCase() === t.toLowerCase());
    if (exact) return exact;
    const r = t.toLowerCase();
    for (const [re, interest] of INTEREST_RULES) if (re.test(r)) return interest;
    return t;
  }

  // Multi-select sizes, e.g. "Small (20-40),Medium (40-70)". An empty list
  // means no preference (also what "No preference on committee size" gives).
  function matchSizes(raw) {
    const out = [];
    String(raw || '').split(/[;,|]/).forEach(part => {
      const r = part.toLowerCase().trim();
      if (!r || r.includes('no pref') || r.includes('any')) return;
      let s = null;
      if (r.startsWith('small') || r === 's') s = 'Small';
      else if (r.startsWith('medium') || r === 'm') s = 'Medium';
      else if (r.startsWith('large') || r === 'l') s = 'Large';
      if (s && !out.includes(s)) out.push(s);
    });
    return out.length === SIZE_OPTS.length ? [] : out;   // ticked every size = no preference
  }

  function matchGrade(raw) {
    const m = String(raw || '').match(/\d+/);
    const g = m ? parseInt(m[0], 10) : NaN;
    return g >= 6 && g <= 12 ? g : null;
  }
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

  // Exact header names first; then, if none matched, the first header the
  // fallback pattern hits — Airtable exports use the FIELD name, which an
  // organizer may have worded differently from the form question.
  function findCol(headers, candidates, pattern, taken) {
    for (const c of candidates) { const i = headers.indexOf(c); if (i !== -1) return i; }
    if (pattern) for (let i = 0; i < headers.length; i++) if (!(taken && taken.has(i)) && pattern.test(headers[i])) return i;
    return -1;
  }

  // The ONLY columns the sorter consumes. Anything else in the upload
  // (email, phone, address, medical, DOB, …) is ignored and never stored.
  // The first name in each list is the exact header on the 2027 GPY form.
  const COLUMN_CANDIDATES = {
    preferred: ['preferred first name','preferred name','nickname','goes by'],
    first:     ['first name','first','given name'],
    last:      ['last name','last','surname','family name'],
    name:      ['name','full name','student name','delegate name','first and last name'],
    school:    ['delegation','school','school name','institution','organization'],
    grade:     ['grade','grade level','current grade','school grade'],
    year:      ['are you a first year delegate or returning?','year','experience','delegate year','experience level','first-year/returning','returning?','status'],
    topics:    ['what are your interests in model un?','interests','preferred topics','topics','pref topics','topic preferences','topic'],
    size:      ['please select all committee sizes you are interested in','committee sizes','preferred size','pref size','committee size','size preference','size'],
    type:      ['preferred type','committee type','pref type','preference type','committee preference','type'],
    seniority: ['seniority pick','direct pick','seniority assignment','direct assignment','guaranteed committee','guaranteed placement','senior pick','priority pick']
  };
  const COLUMN_PATTERNS = {
    preferred: /^preferred (first )?name/,
    first:     /^first name/,
    last:      /^last name/,
    school:    /delegation|school/,
    grade:     /^(current )?grade\b/,
    year:      /first[- ]?year|returning/,
    topics:    /\binterests\b|topic/,         // not "…sizes you are interested in"
    size:      /committee sizes?\b/,
    seniority: /seniority|guaranteed (committee|placement)/
  };
  // Columns that may be absent without a warning: the form doesn't ask for them.
  const OPTIONAL_COLUMNS = ['preferred','first','last','name','grade','type','seniority'];

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
      const idx = findCol(headers, COLUMN_CANDIDATES[key], COLUMN_PATTERNS[key], usedIdx);
      cm[key] = usedIdx.has(idx) ? -1 : idx;
      if (cm[key] !== -1) usedIdx.add(idx);
    }

    const usedColumns    = [...usedIdx].sort((a, b) => a - b).map(i => rawHeaders[i]);
    const ignoredColumns = rawHeaders.filter((h, i) => !usedIdx.has(i) && h.trim() !== '');
    const missingColumns = Object.keys(cm).filter(k => cm[k] === -1 && !OPTIONAL_COLUMNS.includes(k));
    if (cm.name === -1 && cm.first === -1 && cm.last === -1) missingColumns.unshift('name');

    const students = []; const unmatchedPicks = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.every(v => !v)) continue;
      const get  = idx => (idx !== -1 ? (cols[idx] || '') : '').trim();

      // Rosters use the name the delegate goes by: "Preferred First" + "Last".
      const first = get(cm.preferred) || get(cm.first);
      const name  = [first, get(cm.last)].filter(Boolean).join(' ') || get(cm.name);

      const rawYear = get(cm.year).toLowerCase();
      const year = (['first','1st','new','novice','freshman','beginner'].some(v => rawYear.includes(v)) || rawYear === 'f')
        ? 'first' : 'returning';

      const prefTopics = [...new Set(get(cm.topics).split(/[;,|]/).map(normalizeTopic).filter(Boolean))];

      const rawPick = get(cm.seniority);
      const seniorityPick = matchCommittee(rawPick, committees);
      if (rawPick && !seniorityPick) unmatchedPicks.push(rawPick);

      students.push({
        id: students.length + 1,
        name:   name || `Delegate ${students.length + 1}`,
        school: get(cm.school) || 'Unknown School',
        grade:  matchGrade(get(cm.grade)),
        year,
        prefType:  get(cm.type) ? matchType(get(cm.type)) : null,
        prefTopics,
        prefSizes: matchSizes(get(cm.size)),
        seniorityPick,
        assigned: null,
        flagged: false,
        locked: false
      });
    }
    return { students, usedColumns, ignoredColumns, missingColumns, unmatchedPicks, total: students.length };
  }

  // ── Scoring + assignment ────────────────────────────────
  // Topics compare after folding onto the form's interest list, so "health"
  // on the form matches "Healthcare" typed on a committee.
  function topicHits(student, committee) {
    const ct = new Set(committee.topics.map(t => normalizeTopic(t).toLowerCase()));
    return student.prefTopics.filter(t => ct.has(normalizeTopic(t).toLowerCase()));
  }

  // Sizes the delegate ticked; [] = no preference. Sessions saved before the
  // form allowed several sizes carry a single prefSize string instead.
  function sizesOf(student) {
    if (Array.isArray(student.prefSizes)) return student.prefSizes;
    return student.prefSize ? [student.prefSize] : [];
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

    // Stated preferences (type only when the sheet asked for it — the GPY form doesn't)
    if (student.prefType) { if (student.prefType === committee.type) s += 40; else s -= 8; }
    s += topicHits(student, committee).length * 22;
    const sizes = sizesOf(student);
    if (sizes.length) { if (sizes.includes(committee.size)) s += 14; else s -= 10; }  // unticked = not interested

    // Experience fit (soft)
    if (student.year === 'returning' && committee.tier === 'Advanced') s += 18;
    if (student.year === 'returning' && committee.tier === 'Advanced' && student.grade >= 11) s += 8;  // upperclassmen
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
    // preferred committee type is rarer (fewer seats to fight over), then older
    // grades first so seniors get first call on the seats they want.
    const sorted = students.filter(s => !s.locked).sort((a, b) => {
      const ap = a.seniorityPick ? 0 : 1, bp = b.seniorityPick ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = a.prefType ? (typeCount[a.prefType] || 0) : 0, bt = b.prefType ? (typeCount[b.prefType] || 0) : 0;
      if (at !== bt) return at - bt;
      return (b.grade || 0) - (a.grade || 0);
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
    if (student.prefType && student.prefType === c.type) why.push('preferred type');
    const hits = topicHits(student, c);
    if (hits.length) why.push('interests: ' + hits.join(', '));
    if (sizesOf(student).includes(c.size)) why.push('preferred size');
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

    // A rate over only the delegates who answered that question; null if nobody did.
    const rate = (asked, hit) => asked.length ? Math.round(asked.filter(hit).length / asked.length * 100) : null;

    return {
      placed: placed.length,
      flagged: students.filter(s => s.flagged).length,
      seats: committees.reduce((a, c) => a + c.cap, 0),
      typeMatch:  rate(placed.filter(s => s.prefType), s => s.prefType === byId[s.assigned].type),
      topicMatch: pct(placed.filter(s => topicHits(s, byId[s.assigned]).length > 0).length),
      sizeMatch:  rate(placed.filter(s => sizesOf(s).length), s => sizesOf(s).includes(byId[s.assigned].size)),
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
    const orphan = [...new Set(students.map(s => s.prefType).filter(t => t && !types.has(t)))];
    if (orphan.length)
      out.push({ level:'info', msg:`No committee is of type ${orphan.join(', ')} — delegates who asked for it are matched on topics and size instead.` });
    // The form promises sizes by seat count; flag committees that break that promise.
    const offSize = committees.filter(c => SIZE_RANGES[c.size] && (c.cap < SIZE_RANGES[c.size][0] || c.cap > SIZE_RANGES[c.size][1]));
    if (offSize.length)
      out.push({ level:'info', msg:`Seat counts outside the size the form describes: ${offSize.map(c => `${c.name} is ${c.size} with ${c.cap} seats (form says ${sizeLabel(c.size).replace(/^\w+ /, '')})`).join('; ')}.` });
    // Interests no committee covers can never be matched.
    const covered = new Set(committees.flatMap(c => c.topics.map(t => normalizeTopic(t))));
    const uncovered = [...new Set(students.flatMap(s => s.prefTopics))].filter(t => !covered.has(t));
    if (uncovered.length)
      out.push({ level:'info', msg:`No committee lists ${uncovered.join(', ')} as a topic, so delegates interested in ${uncovered.length === 1 ? 'it' : 'them'} can't be matched on it.` });
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
    DEFAULT_CONFERENCE, INTERESTS, SIZE_RANGES, GRADES, sizeLabel,
    matchType, matchSizes, matchGrade, normalizeTopic, sizesOf, matchCommittee, acronym,
    parseCSV, parseCSVRow, csvCell, toCSV, findCol,
    parseDelegates, topicHits, scoreMatch, runAssignment,
    explainPlacement, metrics, preflight, validateCommittees
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENGINE = api;

})(typeof window !== 'undefined' ? window : globalThis);
