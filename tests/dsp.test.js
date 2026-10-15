import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKeys, centsBetween, compareToTarget, keyTarget, median, midiToEt, nearestKey, yin,
} from '../src/lib/dsp.js';

const SR = 48000;
const N = 4096;
const ET = { a4: 440, system: 'equal', saPc: 0 };

/** A free-reed-like tone: twelve harmonics, odd ones stronger, plus a little noise. */
function reed(freq, phase = 0) {
  const buf = new Float32Array(N);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.01;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let h = 1; h <= 12; h++) s += ((h % 2 ? 1 : 0.6) / h) * Math.sin(2 * Math.PI * freq * h * (i / SR) + phase * h);
    buf[i] = 0.2 * s + noise();
  }
  return buf;
}

test('yin measures reed tones within 0.1 cent from C2 to F6', () => {
  for (const midi of [36, 41, 48, 55, 60, 67, 72, 79, 84, 89]) {
    for (const detune of [-23.4, -4.1, 0, 2.7, 11.9]) {
      const f = midiToEt(midi, 440) * 2 ** (detune / 1200);
      const est = median([0, 1, 2, 3, 4].map((p) => yin(reed(f, p), SR).freq));
      const got = centsBetween(est, midiToEt(midi, 440));
      assert.ok(Math.abs(got - detune) < 0.1, `midi ${midi} detune ${detune}: got ${got.toFixed(3)}`);
    }
  }
});

test('yin returns null for silence', () => {
  assert.equal(yin(new Float32Array(N), SR), null);
});

test('Bina 17 default keyboard is 42 keys from C3 to F6 with Sa on C', () => {
  const keys = buildKeys(48, 42, 0);
  assert.equal(keys.length, 42);
  assert.equal(keys[0].name, 'C3');
  assert.equal(keys[41].name, 'F6');
  assert.equal(keys.find((k) => k.midi === 60).swaraLatin, 'Sa');
  assert.equal(keys.find((k) => k.midi === 60).saptak, 0);
  assert.equal(keys.find((k) => k.midi === 48).saptak, -1);
});

test('reed banks sound an octave apart', () => {
  assert.equal(keyTarget(60, 'male', ET).toFixed(2), '261.63');
  assert.equal(keyTarget(60, 'bass', ET).toFixed(2), '130.81');
  assert.equal(keyTarget(60, 'female', ET).toFixed(2), '523.25');
});

test('just intonation uses 5-limit ratios from Sa', () => {
  const just = { ...ET, system: 'just' };
  assert.equal(keyTarget(64, 'male', just).toFixed(2), (261.6256 * 5 / 4).toFixed(2)); // Ga
  assert.equal(keyTarget(67, 'male', just).toFixed(2), (261.6256 * 3 / 2).toFixed(2)); // Pa
});

test('nearestKey picks the right key and rejects pitches off the keyboard', () => {
  const keys = buildKeys(48, 42, 0);
  const hit = nearestKey(midiToEt(67, 440) * 2 ** (-12 / 1200), keys, 'male', ET);
  assert.equal(hit.key.name, 'G4');
  assert.ok(Math.abs(hit.cents + 12) < 1e-9);
  assert.equal(nearestKey(40, keys, 'male', ET), null);
});

test('octave errors are folded out and reported', () => {
  const r = compareToTarget(130.9, 261.63);
  assert.equal(r.octaveOffset, -1);
  assert.ok(Math.abs(r.cents) < 2);
});
