import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALANKARS, BHAJANS, RAGAS, TAALS, THAATS, alankarGroups, layoutNotes, layoutText, noteEvents, parseNotation, parseWord,
  ragaPitchClasses, scaleNotes, taalMark,
} from '../src/lib/music.js';

test('notation words: letters, Devanagari, octaves, holds, rests and shared matras', () => {
  assert.deepEqual(parseWord('S'), [0]);
  assert.deepEqual(parseWord('.N'), [-1]);
  assert.deepEqual(parseWord("S'"), [12]);
  assert.deepEqual(parseWord('rgM'), [1, 3, 6]);
  assert.deepEqual(parseWord('-'), ['hold']);
  assert.deepEqual(parseWord('_'), ['rest']);
  assert.deepEqual(parseWord('S-R'), [0, 'hold', 2]);
  assert.deepEqual(parseWord('सा'), [0]);
  assert.deepEqual(parseWord('रे॒'), [1]);
  assert.deepEqual(parseWord('म॑'), [6]);
  assert.deepEqual(parseWord('नि॒'), [10]);
  assert.deepEqual(parseWord('सां'), [12]);
  assert.deepEqual(parseWord('.ध'), [-3]);
  assert.equal(parseWord('X'), null);
});

test('notation lines carry lyrics and report unreadable words', () => {
  const { lines, errors } = parseNotation("S R G - | m P\n> first line words\nP' Q");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].cells.length, 6);
  assert.equal(lines[0].lyric, 'first line words');
  assert.deepEqual(errors, ['Q']);
});

test('every raga uses only its thaat’s notes, and its vadi and samvadi are in the raga', () => {
  for (const r of RAGAS) {
    const pcs = ragaPitchClasses(r);
    const thaat = THAATS[r.thaat];
    assert.ok(thaat, r.id);
    // Khamaj and Des use both Ni in their thaat's spirit; allow one extra Ni only there.
    const extra = pcs.filter((p) => !thaat.includes(p));
    if (r.thaat === 'khamaj') assert.ok(extra.every((p) => p === 11), `${r.id}: ${extra}`);
    else assert.deepEqual(extra, [], r.id);
    for (const sw of [r.vadi, r.samvadi]) assert.ok(pcs.includes(scaleNotes(sw)[0]), `${r.id} ${sw}`);
    for (const part of [r.aaroh, r.avroh, r.pakad]) assert.deepEqual(parseNotation(part).errors, [], r.id);
  }
});

test('jati matches the notes in aaroh and avroh', () => {
  // Jati counts swaras, so komal and shuddha forms of one swara (n and N in Des) count once.
  const SWARA_OF_PC = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  const count = (str) => new Set(scaleNotes(str).map((s) => SWARA_OF_PC[((s % 12) + 12) % 12])).size;
  for (const r of RAGAS) {
    assert.equal(count(r.aaroh), r.jati[0], `${r.id} aaroh`);
    assert.equal(count(r.avroh), r.jati[1], `${r.id} avroh`);
  }
});

test('alankars: the straight one is aaroh then avroh, pairs overlap', () => {
  const bilawal = THAATS.bilawal;
  const straight = alankarGroups([0], bilawal).flat();
  assert.deepEqual(straight, [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0]);
  const pairs = alankarGroups([0, 1], bilawal);
  assert.deepEqual(pairs[0], [0, 2]);
  assert.deepEqual(pairs[6], [11, 12]);
  assert.deepEqual(pairs[7], [12, 11]);
  assert.deepEqual(pairs.at(-1), [2, 0]);
  for (const a of ALANKARS) assert.ok(alankarGroups(a.steps, bilawal).length > 0, a.id);
});

test('layout fills whole avartans and events follow holds and rests', () => {
  const lines = layoutNotes(alankarGroups([0, 1], THAATS.bilawal), 2, 16);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].cells.length, 16);
  const { events, matras } = noteEvents(layoutText('S - R _', 4));
  assert.equal(matras, 4);
  assert.deepEqual(events.map((e) => [e.semi, e.start, e.end]), [[0, 0, 2], [2, 2, 3]]);
});

test('taal marks: sam, tali and khali at vibhag starts', () => {
  assert.equal(taalMark('teentaal', 0), 'X');
  assert.equal(taalMark('teentaal', 8), '0');
  assert.equal(taalMark('teentaal', 12), '3');
  assert.equal(taalMark('teentaal', 5), null);
  assert.equal(taalMark('rupak', 0), '0');
  assert.equal(taalMark('jhaptaal', 5), '0');
  for (const [id, t] of Object.entries(TAALS)) {
    assert.equal(t.vibhag.reduce((a, b) => a + b, 0), t.beats, id);
    assert.equal(t.bols.length, t.beats, id);
  }
});

test('built-in bhajans parse cleanly and fill whole avartans of their taal', () => {
  for (const b of BHAJANS) {
    const { lines, errors } = parseNotation(b.notation);
    assert.deepEqual(errors, [], b.id);
    assert.ok(TAALS[b.taal], b.id);
    for (const [i, l] of lines.entries()) {
      assert.equal(l.cells.length % TAALS[b.taal].beats, 0, `${b.id} line ${i + 1}`);
      assert.match(l.lyric, /\n/, `${b.id} line ${i + 1} has Devanagari and romanised lyrics`);
    }
  }
});
