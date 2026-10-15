import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyVoices, reedSpectrum } from '../src/lib/harmonium.js';

const equal = { a4: 440, system: 'equal', saPc: 0 };
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('each open stop sounds the key at its ideal pitch on that reed bank', () => {
  const v = keyVoices(69, { bass: true, male: true, female: true }, equal);
  assert.deepEqual(v.map((x) => x.bank), ['bass', 'male', 'female']);
  close(v[0].freq, 220);
  close(v[1].freq, 440);
  close(v[2].freq, 880);
});

test('closed stops are silent, and no stops means no sound', () => {
  assert.deepEqual(keyVoices(60, { bass: false, male: true, female: false }, equal).map((x) => x.bank), ['male']);
  assert.equal(keyVoices(60, { bass: false, male: false, female: false }, equal).length, 0);
});

test('the reference follows the tuning settings: A4 and just intonation from Sa', () => {
  close(keyVoices(69, { male: true }, { ...equal, a4: 442 })[0].freq, 442);
  // Just Pa is a pure 3:2 above Sa, about 2 cents above the tempered fifth.
  const sa = keyVoices(60, { male: true }, { ...equal, system: 'just' })[0].freq;
  const pa = keyVoices(67, { male: true }, { ...equal, system: 'just' })[0].freq;
  close(pa / sa, 1.5);
});

test('reed spectrum: no DC, falling harmonics, even ones softer than their odd neighbours', () => {
  const s = reedSpectrum(16);
  assert.equal(s[0], 0);
  assert.ok(s[1] > s[3] && s[3] > s[5]);
  assert.ok(s[2] < s[1] && s[2] < s[3]);
});
