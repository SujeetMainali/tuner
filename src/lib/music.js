/*
 * Hindustani music data and notation for riyaz: thaats, ragas, taals, alankar patterns and a
 * sargam notation parser. Pure functions, no DOM, testable in Node.
 *
 * Pitches are semitones relative to Sa (0 = madhya Sa, -1 = mandra Ni, 12 = taar Sa).
 *
 * Notation, one matra per word:
 *   S r R g G m M P d D n N   (lowercase = komal; m = shuddha Ma, M = tivra Ma)
 *   or सा रे॒ रे ग॒ ग म म॑ प ध॒ ध नि॒ नि
 *   .N   lower octave (prefix dot)      S'   upper octave (suffix apostrophe)
 *   -    hold the previous note          _ or ,   rest
 *   SR   several notes share one matra   |   vibhag bar (display only, ignored)
 *   Lines starting with > hold the lyrics for the notation line above them (one or more, e.g.
 *   Devanagari then a romanised line).
 */

export const LETTER_SEMI = { S: 0, r: 1, R: 2, g: 3, G: 4, m: 5, M: 6, P: 7, d: 8, D: 9, n: 10, N: 11 };
const DEV_BASE = { 'सा': 0, 'रे': 2, 'ग': 4, 'म': 5, 'प': 7, 'ध': 9, 'नि': 11 };
const KOMAL = '॒'; // ॒ below
const TIVRA = '॑'; // ॑ above

// Display names per semitone within the octave.
export const SWARA_DEV = ['सा', 'रे॒', 'रे', 'ग॒', 'ग', 'म', 'म॑', 'प', 'ध॒', 'ध', 'नि॒', 'नि'];
export const SWARA_LAT = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];

/** Thaats as semitone sets from Sa (Bhatkhande's ten). */
export const THAATS = {
  bilawal: [0, 2, 4, 5, 7, 9, 11],
  kalyan: [0, 2, 4, 6, 7, 9, 11],
  khamaj: [0, 2, 4, 5, 7, 9, 10],
  kafi: [0, 2, 3, 5, 7, 9, 10],
  asavari: [0, 2, 3, 5, 7, 8, 10],
  bhairavi: [0, 1, 3, 5, 7, 8, 10],
  bhairav: [0, 1, 4, 5, 7, 8, 11],
  poorvi: [0, 1, 4, 6, 7, 8, 11],
  marwa: [0, 1, 4, 6, 7, 9, 11],
  todi: [0, 1, 3, 6, 7, 8, 11],
};

/**
 * Taals: matras, vibhag lengths, vibhag marks (X sam, 0 khali, numbers tali) and theka bols.
 * Rupak begins on khali.
 */
export const TAALS = {
  teentaal: { beats: 16, vibhag: [4, 4, 4, 4], marks: ['X', '2', '0', '3'], theka: 'dha dhin dhin dha dha dhin dhin dha dha tin tin ta ta dhin dhin dha' },
  jhaptaal: { beats: 10, vibhag: [2, 3, 2, 3], marks: ['X', '2', '0', '3'], theka: 'dhi na dhi dhi na ti na dhi dhi na' },
  ektaal: { beats: 12, vibhag: [2, 2, 2, 2, 2, 2], marks: ['X', '0', '2', '0', '3', '4'], theka: 'dhin dhin dhage tirakita tu na ka tta dhage tirakita dhi na' },
  rupak: { beats: 7, vibhag: [3, 2, 2], marks: ['0', '1', '2'], theka: 'tin tin na dhi na dhi na' },
  keherwa: { beats: 8, vibhag: [4, 4], marks: ['X', '0'], theka: 'dha ge na ti na ka dhi na' },
  dadra: { beats: 6, vibhag: [3, 3], marks: ['X', '0'], theka: 'dha dhi na dha ti na' },
};
Object.values(TAALS).forEach((t) => { t.bols = t.theka.split(' '); });

/** Mark for matra `i` of a taal: 'X', '0', a tali number, or null inside a vibhag. */
export function taalMark(taal, i) {
  const t = TAALS[taal];
  let pos = ((i % t.beats) + t.beats) % t.beats;
  for (let v = 0; v < t.vibhag.length; v++) {
    if (pos === 0) return t.marks[v];
    pos -= t.vibhag[v];
    if (pos < 0) return null;
  }
  return null;
}

/**
 * Common ragas (one widely taught version of each; gharanas differ in details).
 * aaroh/avroh/pakad use the notation above; jati is [ascending, descending] note count.
 */
export const RAGAS = [
  { id: 'yaman', name: 'Yaman', dev: 'यमन', thaat: 'kalyan', aaroh: ".N R G M P D N S'", avroh: "S' N D P M G R S", pakad: '.N R G R , P R , .N R S', vadi: 'G', samvadi: 'N', jati: [7, 7], time: 'evening', drone: 'P' },
  { id: 'bhupali', name: 'Bhupali', dev: 'भूपाली', thaat: 'kalyan', aaroh: "S R G P D S'", avroh: "S' D P G R S", pakad: 'G R S .D S R G , P G , D P G R S', vadi: 'G', samvadi: 'D', jati: [5, 5], time: 'evening', drone: 'P' },
  { id: 'bilawal', name: 'Bilawal', dev: 'बिलावल', thaat: 'bilawal', aaroh: "S R G m P D N S'", avroh: "S' N D P m G R S", pakad: "G R , G P , D N S'", vadi: 'D', samvadi: 'G', jati: [7, 7], time: 'lateMorning', drone: 'P' },
  { id: 'bhairav', name: 'Bhairav', dev: 'भैरव', thaat: 'bhairav', aaroh: "S r G m P d N S'", avroh: "S' N d P m G r S", pakad: 'G m d - d P , G m r - r S', vadi: 'd', samvadi: 'r', jati: [7, 7], time: 'morning', drone: 'P' },
  { id: 'bhairavi', name: 'Bhairavi', dev: 'भैरवी', thaat: 'bhairavi', aaroh: "S r g m P d n S'", avroh: "S' n d P m g r S", pakad: 'm g , S r S , .d .n S', vadi: 'm', samvadi: 'S', jati: [7, 7], time: 'morning', drone: 'P' },
  { id: 'kafi', name: 'Kafi', dev: 'काफी', thaat: 'kafi', aaroh: "S R g m P D n S'", avroh: "S' n D P m g R S", pakad: 'S S R R g g m m P', vadi: 'P', samvadi: 'S', jati: [7, 7], time: 'night', drone: 'P' },
  { id: 'bhimpalasi', name: 'Bhimpalasi', dev: 'भीमपलासी', thaat: 'kafi', aaroh: ".n S g m P n S'", avroh: "S' n D P m g R S", pakad: '.n S m , m g P m , g m g R S', vadi: 'm', samvadi: 'S', jati: [5, 7], time: 'afternoon', drone: 'P' },
  { id: 'bageshri', name: 'Bageshri', dev: 'बागेश्री', thaat: 'kafi', aaroh: "S g m D n S'", avroh: "S' n D m P D m g R S", pakad: 'D .n S m , m D n D , m g R S', vadi: 'm', samvadi: 'S', jati: [5, 7], time: 'lateNight', drone: 'm' },
  { id: 'khamaj', name: 'Khamaj', dev: 'खमाज', thaat: 'khamaj', aaroh: "S G m P D N S'", avroh: "S' n D P m G R S", pakad: 'n D m P D m G', vadi: 'G', samvadi: 'N', jati: [6, 7], time: 'night', drone: 'P' },
  { id: 'des', name: 'Des', dev: 'देस', thaat: 'khamaj', aaroh: "S R m P N S'", avroh: "S' n D P m G R G .N S", pakad: 'R m P n D P , m G R , G .N S', vadi: 'R', samvadi: 'P', jati: [5, 7], time: 'night', drone: 'P' },
  { id: 'durga', name: 'Durga', dev: 'दुर्गा', thaat: 'bilawal', aaroh: "S R m P D S'", avroh: "S' D P m R S", pakad: 'm P D m R , .D S', vadi: 'm', samvadi: 'S', jati: [5, 5], time: 'night', drone: 'P' },
  { id: 'malkauns', name: 'Malkauns', dev: 'मालकौंस', thaat: 'bhairavi', aaroh: "S g m d n S'", avroh: "S' n d m g S", pakad: 'm g m d n d m , g m g S', vadi: 'm', samvadi: 'S', jati: [5, 5], time: 'lateNight', drone: 'm' },
];

/** Alankar patterns as scale-step offsets; each group is repeated from Sa upward, then mirrored down. */
export const ALANKARS = [
  { id: 'straight', steps: [0] },
  { id: 'pairs', steps: [0, 1] },
  { id: 'threes', steps: [0, 1, 2] },
  { id: 'fours', steps: [0, 1, 2, 3] },
  { id: 'skip', steps: [0, 2] },
  { id: 'turn', steps: [0, 1, 0] },
  { id: 'back', steps: [0, 2, 1] },
  { id: 'zigzag', steps: [0, 1, 2, 1] },
];

/** Parses one word: a list of parts (semitone number, 'hold' or 'rest'), or null if unreadable. */
export function parseWord(word) {
  if (word === '-' || word === '–' || word === '—') return ['hold'];
  if (word === '_' || word === ',') return ['rest'];
  const parts = [];
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    if (ch === '-' || ch === '–') { parts.push('hold'); i++; continue; }
    if (ch === '_' || ch === ',') { parts.push('rest'); i++; continue; }
    let oct = 0;
    while (word[i] === '.') { oct--; i++; }
    let semi = null;
    if (word[i] in LETTER_SEMI) {
      semi = LETTER_SEMI[word[i]];
      i++;
    } else {
      const two = word.slice(i, i + 2);
      const syl = two === 'सा' || two === 'रे' || two === 'नि' ? two : word[i];
      if (!(syl in DEV_BASE)) return null;
      semi = DEV_BASE[syl];
      i += syl.length;
      if (word[i] === KOMAL && [2, 4, 9, 11].includes(semi)) { semi -= 1; i++; }
      else if (word[i] === TIVRA && semi === 5) { semi = 6; i++; }
    }
    while (word[i] === "'" || word[i] === '’' || word[i] === 'ं') { oct++; i++; }
    parts.push(semi + 12 * oct);
  }
  return parts.length ? parts : null;
}

/**
 * Parses notation text into lines of cells. Each cell is one matra: { parts: [...] }.
 * Returns { lines: [{ cells, lyric }], errors: [word, ...] }.
 */
export function parseNotation(text) {
  const lines = [];
  const errors = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('>')) {
      if (lines.length) {
        const last = lines[lines.length - 1];
        last.lyric = last.lyric ? last.lyric + '\n' + line.slice(1).trim() : line.slice(1).trim();
      }
      continue;
    }
    const cells = [];
    for (const word of line.split(/\s+/)) {
      if (word === '|' || word === '||') continue;
      const parts = parseWord(word.replace(/\|/g, ''));
      if (parts) cells.push({ parts });
      else errors.push(word);
    }
    if (cells.length) lines.push({ cells, lyric: '' });
  }
  return { lines, errors };
}

/** Semitones in a scale-string (an aaroh or avroh), in order. */
export const scaleNotes = (str) => parseNotation(str).lines.flatMap((l) => l.cells.flatMap((c) => c.parts.filter((p) => typeof p === 'number')));

/** Unique pitch classes (0–11) of a raga or thaat, ascending from Sa. */
export function pitchClasses(semis) {
  return [...new Set(semis.map((s) => ((s % 12) + 12) % 12).concat(0))].sort((a, b) => a - b);
}

/** All pitch classes a raga uses (aaroh and avroh). */
export const ragaPitchClasses = (raga) => pitchClasses([...scaleNotes(raga.aaroh), ...scaleNotes(raga.avroh)]);

/**
 * Notes of an alankar over a scale: ascending groups from Sa to taar Sa using `asc` pitch
 * classes, then the mirror descending with `desc` (defaults to `asc`). Returns groups of semitones.
 */
export function alankarGroups(steps, asc, desc = asc) {
  const n = asc.length;
  const up = (k) => Math.floor(k / n) * 12 + asc[((k % n) + n) % n];
  const m = desc.length;
  const down = (k) => Math.floor(k / m) * 12 + desc[((k % m) + m) % m];
  const span = Math.max(...steps);
  const groups = [];
  for (let i = 0; i + span <= n; i++) groups.push(steps.map((o) => up(i + o)));
  for (let i = m; i - span >= 0; i--) groups.push(steps.map((o) => down(i - o)));
  return groups;
}

/** Groups of notes laid out `laya` notes per matra, padded with holds to whole avartans of `beats`. */
export function layoutNotes(groups, laya, beats) {
  const notes = groups.flat();
  const cells = [];
  for (let i = 0; i < notes.length; i += laya) {
    const parts = notes.slice(i, i + laya);
    while (parts.length < laya) parts.push('hold');
    cells.push({ parts, groupStart: false });
  }
  // Mark where each group starts, for spacing in the display.
  let k = 0;
  groups.forEach((g) => { const c = Math.floor(k / laya); if (cells[c] && k % laya === 0) cells[c].groupStart = true; k += g.length; });
  while (cells.length % beats) cells.push({ parts: ['hold'] });
  return chunk(cells, beats);
}

/** Notation text laid out as lines of whole avartans (`beats` matras each), `laya` words per matra. */
export function layoutText(text, beats, laya = 1) {
  const words = parseNotation(text).lines.flatMap((l) => l.cells);
  const cells = [];
  for (let i = 0; i < words.length; i += laya) {
    const group = words.slice(i, i + laya);
    while (group.length < laya) group.push({ parts: ['hold'] });
    cells.push({ parts: group.flatMap((c) => c.parts) });
  }
  while (cells.length % beats) cells.push({ parts: ['hold'] });
  return chunk(cells, beats);
}

function chunk(cells, size) {
  const lines = [];
  for (let i = 0; i < cells.length; i += size) lines.push({ cells: cells.slice(i, i + size), lyric: '' });
  return lines;
}

/**
 * Turns lines of cells into timed note events for playback, in matras from the start:
 * [{ start, end, semi, cell }]. Holds extend the sounding note; rests end it.
 */
export function noteEvents(lines) {
  const events = [];
  let cur = null;
  let m = 0;
  lines.flatMap((l) => l.cells).forEach((cell, ci) => {
    const step = 1 / cell.parts.length;
    cell.parts.forEach((p, pi) => {
      const t = m + pi * step;
      if (p === 'hold') return;
      if (cur) { cur.end = t; events.push(cur); cur = null; }
      if (typeof p === 'number') cur = { start: t, end: t, semi: p, cell: ci };
    });
    m += 1;
  });
  if (cur) { cur.end = m; events.push(cur); }
  return { events, matras: m };
}

/** Display label for a semitone: { text, octave } in Devanagari ('dev') or letters ('lat'). */
export function swaraLabel(semi, script = 'dev') {
  const pc = ((semi % 12) + 12) % 12;
  return { text: (script === 'dev' ? SWARA_DEV : SWARA_LAT)[pc], octave: Math.floor(semi / 12) };
}

/**
 * Built-in Krishna bhajans. The words are traditional and public domain; the tunes are simple
 * practice arrangements written for this app (traditional melodies vary by region and singer).
 * `source` keys name the text's origin (messages: riyaz.sources).
 */
export const BHAJANS = [
  {
    id: 'mahamantra', title: 'हरे कृष्ण महामन्त्र', titleLat: 'Hare Krishna Mahamantra', source: 'mahamantra', taal: 'keherwa', bpm: 96,
    notation: `S R G G R G m G
> हरे कृष्ण हरे कृष्ण
> hare krishna hare krishna
G m P P m G R S
> कृष्ण कृष्ण हरे हरे
> krishna krishna hare hare
P P D P m P G m
> हरे राम हरे राम
> hare rama hare rama
G m P m G R S S
> राम राम हरे हरे
> rama rama hare hare`,
  },
  {
    id: 'govind-bolo', title: 'गोविन्द बोलो हरि गोपाल बोलो', titleLat: 'Govind Bolo Hari Gopal Bolo', source: 'kirtan', taal: 'keherwa', bpm: 100,
    notation: `S - R G m - P - P D P m G R S -
> गोविन्द बोलो हरि गोपाल बोलो
> govind bolo hari gopal bolo
G - m P D - P - m P m G R - S -
> राधा रमण हरि गोविन्द बोलो
> radha raman hari govind bolo`,
  },
  {
    id: 'hare-murare', title: 'श्री कृष्ण गोविन्द हरे मुरारे', titleLat: 'Shri Krishna Govind Hare Murare', source: 'kirtan', taal: 'dadra', bpm: 110,
    notation: `S - S R G - G m G R S -
> श्री कृष्ण गोविन्द हरे मुरारे
> shri krishna govind hare murare
R - G m P - m G R G S -
> हे नाथ नारायण वासुदेवा
> he nath narayan vasudeva`,
  },
  {
    id: 'achyutashtakam', title: 'अच्युतं केशवं', titleLat: 'Achyutam Keshavam', source: 'achyutashtakam', taal: 'keherwa', bpm: 88,
    notation: `G - G R G - P - G R S - R - G -
> अच्युतं केशवं रामनारायणं
> achyutam keshavam rama-narayanam
P - P D P - G - R G P G R - S -
> कृष्णदामोदरं वासुदेवं हरिम्
> krishna-damodaram vasudevam harim
G - G P D - S' - D P G - R - G -
> श्रीधरं माधवं गोपिकावल्लभं
> shridharam madhavam gopika-vallabham
P - G R G - P G R - .D - S - - -
> जानकीनायकं रामचन्द्रं भजे
> janaki-nayakam ramachandram bhaje`,
  },
  {
    id: 'madhurashtakam', title: 'अधरं मधुरं', titleLat: 'Adharam Madhuram', source: 'madhurashtakam', taal: 'dadra', bpm: 104,
    notation: `S R G - G - G m P - P -
> अधरं मधुरं वदनं मधुरं
> adharam madhuram vadanam madhuram
P D P - m - G m G - R -
> नयनं मधुरं हसितं मधुरम्
> nayanam madhuram hasitam madhuram
S R G - m - P m G - R -
> हृदयं मधुरं गमनं मधुरं
> hridayam madhuram gamanam madhuram
G m P D P m G R S - - -
> मधुराधिपतेरखिलं मधुरम्
> madhuradhipater akhilam madhuram`,
  },
  {
    id: 'radhe-krishna', title: 'राधे कृष्णा राधे श्याम', titleLat: 'Radhe Krishna Radhe Shyam', source: 'kirtan', taal: 'keherwa', bpm: 92,
    notation: `S R G - R G m -
> राधे कृष्णा राधे कृष्णा
> radhe krishna radhe krishna
G m P - m G R -
> कृष्णा कृष्णा राधे राधे
> krishna krishna radhe radhe
P m G - m G R -
> राधे श्याम राधे श्याम
> radhe shyam radhe shyam
G R S - .N R S -
> श्याम श्याम राधे राधे
> shyam shyam radhe radhe`,
  },
];
