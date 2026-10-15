import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKeys, keyTarget } from '../src/lib/dsp.js';
import { keyInstructions, shortAction } from '../src/lib/instructions.js';
import { reportCsv } from '../src/lib/report.js';

const tuning = { a4: 440, system: 'equal', saPc: 0 };
const keys = buildKeys(48, 42, 0);
const key = (name) => keys.find((k) => k.name === name);
const at = (midi, bank, cents) => keyTarget(midi, bank, tuning) * 2 ** (cents / 1200);
const reading = (midi, bank, cents, spread = 0.4, t = 0) => ({ freq: at(midi, bank, cents), spread, at: 1_700_000_000_000 + t });
const empty = () => ({ bass: {}, male: {}, female: {} });
const run = (name, readings, bank = 'male', tolerance = 3) =>
  keyInstructions({ k: key(name), bank, readings, tuning, tolerance, keys });

test('unmeasured key asks for a measurement on the chosen bank', () => {
  const ins = run('C4', empty());
  assert.equal(ins.tone, 'info');
  assert.match(ins.headline, /Measure C4 on the Male reed/);
  assert.equal(ins.short, 'Measure');
});

test('in-tune key needs no work, and a near-edge reading says which way it leans', () => {
  const r = empty();
  r.male[60] = [reading(60, 'male', 0.5)];
  assert.equal(run('C4', r).tone, 'good');
  r.male[60] = [reading(60, 'male', 2.4)];
  const ins = run('C4', r);
  assert.equal(ins.tone, 'good');
  assert.match(ins.steps[0], /leans sharp/);
});

test('sharp key: lower at the root, with the beat rate', () => {
  const r = empty();
  r.male[67] = [reading(67, 'male', 12)];
  const ins = run('G4', r);
  assert.equal(ins.tone, 'off');
  assert.match(ins.headline, /Sharp by 12\.0¢: lower it at the root/);
  assert.ok(ins.steps.some((s) => /near the root/.test(s)));
  assert.ok(ins.steps.some((s) => /beats \d+\.\d\d times a second/.test(s)));
  assert.equal(ins.short, 'Lower 12.0¢ · root');
});

test('flat key: clean first, then raise at the tip', () => {
  const r = empty();
  r.male[57] = [reading(57, 'male', -7)];
  const ins = run('A3', r);
  assert.match(ins.headline, /Flat by 7\.0¢: raise it at the tip/);
  assert.ok(ins.steps.some((s) => /Clean the tongue/.test(s)));
  assert.ok(ins.steps.some((s) => /free tip/.test(s)));
});

test('unsteady reading means re-check, never file', () => {
  const r = empty();
  r.male[60] = [reading(60, 'male', 15, 3.4)];
  const ins = run('C4', r);
  assert.equal(ins.short, 'Re-check');
  assert.ok(!ins.steps.some((s) => /remove metal/.test(s)));
});

test('large error asks to check the reed is in the right slot', () => {
  const r = empty();
  r.male[62] = [reading(62, 'male', -48)];
  assert.match(run('D4', r).steps[0], /belongs to D4/);
});

test('register notes: thin treble tongues and heavy bass tongues', () => {
  const r = empty();
  r.male[84] = [reading(84, 'male', 6)];
  assert.match(run('C6', r).notes[0], /short, thin reed tongue/);
  r.bass[48] = [reading(48, 'bass', 6)];
  assert.match(run('C3', r, 'bass').notes[0], /long, heavy reed tongue/);
});

test('trend: progress estimates the remaining work', () => {
  const r = empty();
  r.male[60] = [reading(60, 'male', 12, 0.4, 0), reading(60, 'male', 8, 0.4, 1)];
  const note = run('C4', r).notes.find((n) => /closer/.test(n));
  assert.match(note, /moved it 4\.0¢ closer/);
  assert.match(note, /About 2× the same amount/);
});

test('trend: overshoot and wrong-end work are called out', () => {
  const r = empty();
  r.male[60] = [reading(60, 'male', 9, 0.4, 0), reading(60, 'male', -6, 0.4, 1)];
  assert.ok(run('C4', r).notes.some((n) => /Overshot/.test(n) && /from the tip/.test(n)));
  r.male[60] = [reading(60, 'male', 6, 0.4, 0), reading(60, 'male', 10, 0.4, 1)];
  assert.ok(run('C4', r).notes.some((n) => /further away/.test(n) && /root lowers/.test(n)));
  r.male[60] = [reading(60, 'male', 9, 0.4, 0), reading(60, 'male', 2, 0.4, 1)];
  assert.ok(run('C4', r).notes.some((n) => /^Fixed/.test(n)));
});

test('the other reed bank on the same key is compared', () => {
  const r = empty();
  r.male[60] = [reading(60, 'male', 0)];
  r.bass[60] = [reading(60, 'bass', 9)];
  assert.ok(run('C4', r).notes.some((n) => /Bass reed on this key reads \+9\.0¢/.test(n)));
});

test('a whole instrument tuned off-pitch suggests a matching A4', () => {
  const r = empty();
  for (let m = 48; m < 58; m++) r.male[m] = [reading(m, 'male', -14 + (m % 3))];
  const note = run('C3', r).notes.find((n) => /may have been tuned to A4/.test(n));
  assert.ok(note);
  assert.match(note, /A4 ≈ 43\d\.\d Hz/);
});

test('shortAction', () => {
  assert.equal(shortAction(null, null, 3), 'Measure');
  assert.equal(shortAction(1, 0.2, 3), 'OK');
  assert.equal(shortAction(-5.25, 0.2, 3), 'Raise 5.3¢ · tip');
  assert.equal(shortAction(20, 4, 3), 'Re-check');
});

test('CSV includes each key with its instruction, quoted safely', () => {
  const r = empty();
  r.male[67] = [reading(67, 'male', 12)];
  const csv = reportCsv(keys, r, 'male', tuning, 3).split('\n');
  assert.equal(csv.length, 43);
  const g4 = csv.find((l) => l.startsWith('G4,'));
  assert.match(g4, /Lower 12\.0¢ · root/);
  assert.match(g4, /"Sharp by 12\.0¢: lower it at the root/);
});
