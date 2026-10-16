import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKeys, keyTarget } from '../src/lib/dsp.js';
import { shortAction } from '../src/lib/format.js';
import { keyInstructions } from '../src/lib/instructions.js';
import { reportCsv } from '../src/lib/report.js';
import { MESSAGES } from '../src/i18n/messages.js';

/** Every leaf path in a message table, with the kind of value found there. */
function shape(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix + k;
    if (Array.isArray(v)) return [[path, 'array:' + v.length]];
    if (v && typeof v === 'object') return shape(v, path + '.');
    return [[path, typeof v]];
  });
}

test('every language has every message English has, of the same kind', () => {
  const en = new Map(shape(MESSAGES.en));
  for (const lang of Object.keys(MESSAGES).filter((l) => l !== 'en')) {
    const other = new Map(shape(MESSAGES[lang]));
    for (const [path, kind] of en) assert.equal(other.get(path), kind, `${lang}.${path}`);
    for (const path of other.keys()) assert.ok(en.has(path), `${lang}.${path} has no English`);
  }
});

test('every message function returns non-empty text in both languages', () => {
  // Stands in for any parameter: every field is 'X' (flags are true), and it prints as 'X' itself.
  const flags = new Set(['sharp', 'above', 'locked', 'fromRoot']);
  const sample = new Proxy({}, {
    get: (_, k) => (typeof k === 'symbol' ? undefined : k === 'toString' || k === 'valueOf' ? () => 'X' : flags.has(k) ? true : 'X'),
  });
  for (const lang of Object.keys(MESSAGES)) {
    for (const [path] of shape(MESSAGES[lang])) {
      const v = path.split('.').reduce((o, k) => o[k], MESSAGES[lang]);
      if (typeof v !== 'function') continue;
      const out = v(sample);
      const text = Array.isArray(out) ? out.join(' ') : out;
      assert.ok(typeof text === 'string' && text.trim() && !text.includes('undefined'), `${lang}.${path}`);
    }
  }
});

const tuning = { a4: 440, system: 'equal', saPc: 0 };
const keys = buildKeys(48, 42, 0);
const c4 = keys.find((k) => k.name === 'C4');
const reading = (cents) => ({ freq: keyTarget(60, 'male', tuning) * 2 ** (cents / 1200), spread: 0.4, at: 1_700_000_000_000 });

test('instructions come out in Nepali with the same numbers', () => {
  const readings = { bass: {}, male: { 60: [reading(12)] }, female: {} };
  const ins = keyInstructions({ k: c4, bank: 'male', readings, tuning, tolerance: 3, keys, lang: 'ne' });
  assert.equal(ins.tone, 'off');
  assert.match(ins.headline, /12\.0¢ चढेको: जराबाट झार्नुहोस्/);
  assert.match(ins.steps.join(' '), /मेल रिड/);
  assert.match(ins.steps.join(' '), /सा/);
  assert.equal(ins.short, '12.0¢ झार्ने · जरा');
});

test('instructions come out in Hindi', () => {
  const readings = { bass: {}, male: { 60: [reading(-7)] }, female: {} };
  const ins = keyInstructions({ k: c4, bank: 'male', readings, tuning, tolerance: 3, keys, lang: 'hi' });
  assert.equal(ins.tone, 'near');
  assert.match(ins.headline, /7\.0¢ उतरा हुआ: सिरे से चढ़ाएँ/);
  assert.match(ins.steps.join(' '), /जीभ साफ़ करें/);
  assert.equal(ins.short, '7.0¢ चढ़ाएँ · सिरा');
});

test('short actions and the CSV follow the language', () => {
  assert.equal(shortAction(-5.25, 0.2, 3, 'ne'), '5.3¢ चढाउने · टुप्पो');
  assert.equal(shortAction(null, null, 3, 'ne'), 'नाप्नुहोस्');
  const readings = { bass: {}, male: { 60: [reading(1)] }, female: {} };
  const csv = reportCsv(keys, readings, 'male', tuning, 3, 'ne');
  assert.match(csv.split('\n')[0], /^कि,स्वर,बैंक/);
  assert.match(csv, /C4,सा,मेल,261\.63,[\d.]+,1\.0,0\.4,सुरमा,ठीक/);
});
