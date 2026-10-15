/*
 * Turns a key's measurements into tuning instructions. Pure functions: no DOM, testable in Node.
 * The wording comes from src/i18n/messages.js (`ins`), in the requested language.
 *
 * Reed physics used here: a free reed's pitch rises when metal comes off the free tip (less mass
 * where it moves most) and falls when metal comes off near the root (a less stiff tongue).
 * Dirt or rust on the tongue adds mass and pulls it flat.
 */
import { keyTarget, median } from './dsp.js';
import { readingCents, shortAction, swaraName, BANKS, UNSTEADY_SPREAD } from './format.js';
import { messagesFor } from '../i18n/messages.js';

export { shortAction };

const HIGH_REED_HZ = 700;
const LOW_REED_HZ = 160;
const INSTRUMENT_OFFSET_MIN_KEYS = 8;

const fmt = (c) => (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c).toFixed(1) + '¢';
const abs1 = (c) => Math.abs(c).toFixed(1) + '¢';

function amountFor(absCents, M) {
  if (absCents <= 5) return M.amount.tiny;
  if (absCents <= 15) return M.amount.small;
  if (absCents <= 35) return M.amount.mid;
  return M.amount.big;
}

function registerNote(soundingHz, M) {
  if (soundingHz >= HIGH_REED_HZ) return M.regHigh;
  if (soundingHz <= LOW_REED_HZ) return M.regLow;
  return null;
}

/** What the trend between the last two readings says about the last adjustment. */
function trendNote(prevC, curC, tolerance, M) {
  const absCur = Math.abs(curC);
  const absPrev = Math.abs(prevC);
  const prev = fmt(prevC);
  const cur = fmt(curC);
  if (absCur <= tolerance && absPrev > tolerance) {
    return { kind: 'fixed', text: M.trendFixed({ prev, cur }) };
  }
  if (absCur > tolerance && absPrev > tolerance && Math.sign(prevC) !== Math.sign(curC)) {
    return { kind: 'overshoot', text: M.trendOvershoot({ prev, cur, fromRoot: curC > 0 }) };
  }
  if (absCur < absPrev - 0.5) {
    const moved = absPrev - absCur;
    const ratio = absCur / moved;
    const more = ratio > 6 ? M.trendMuchMore : M.trendMore(Math.max(0.5, Math.round(ratio * 2) / 2));
    return { kind: 'progress', text: M.trendProgress({ moved: abs1(moved), prev, cur, more }) };
  }
  if (absCur > absPrev + 0.5 && Math.sign(prevC) === Math.sign(curC)) {
    return { kind: 'worse', text: M.trendWorse({ d: abs1(absCur - absPrev), prev, cur }) };
  }
  return { kind: 'unchanged', text: M.trendUnchanged({ prev, cur }) };
}

/** Median deviation of every measured key on a bank, or null if too few keys are measured. */
export function instrumentOffset(readings, bank, keys, tuning) {
  const cents = [];
  for (const k of keys) {
    const list = readings[bank]?.[k.midi];
    if (list?.length) cents.push(readingCents(list[list.length - 1], k.midi, bank, tuning));
  }
  if (cents.length < INSTRUMENT_OFFSET_MIN_KEYS) return null;
  return { cents: median(cents), count: cents.length };
}

/**
 * Full instructions for one key on one reed bank, in `lang` ('en' or 'ne').
 * Returns { tone: 'good' | 'near' | 'off' | 'info', headline, steps: string[], notes: string[], short }.
 */
export function keyInstructions({ k, bank, readings, tuning, tolerance, keys, lang = 'en' }) {
  const all = messagesFor(lang);
  const M = all.ins;
  const bankLabel = all.bank[bank];
  const swara = swaraName(k, lang);
  const list = readings[bank]?.[k.midi] || [];
  const soundingHz = keyTarget(k.midi, bank, tuning);
  const notes = [];

  if (!list.length) {
    return {
      tone: 'info',
      headline: M.measureHead({ key: k.name, bank: bankLabel }),
      steps: M.measureSteps({ bank: bankLabel, key: k.name, swara }),
      notes,
      short: all.short.measure,
    };
  }

  const cur = list[list.length - 1];
  const c = readingCents(cur, k.midi, bank, tuning);
  const a = Math.abs(c);
  const beat = Math.abs(cur.freq - soundingHz);

  // Response-based context: trend, the other reed banks on this key, and the instrument as a whole.
  if (list.length >= 2) {
    notes.push(trendNote(readingCents(list[list.length - 2], k.midi, bank, tuning), c, tolerance, M).text);
  }
  for (const other of BANKS) {
    if (other === bank) continue;
    const ol = readings[other]?.[k.midi];
    if (!ol?.length) continue;
    const oc = readingCents(ol[ol.length - 1], k.midi, other, tuning);
    if (Math.abs(c - oc) > tolerance) {
      notes.push(M.otherBank({ bank: all.bank[other], oc: fmt(oc), apart: abs1(c - oc) }));
    }
  }
  const offset = instrumentOffset(readings, bank, keys, tuning);
  if (offset && Math.abs(offset.cents) > tolerance) {
    const a4 = (tuning.a4 * Math.pow(2, offset.cents / 1200)).toFixed(1);
    notes.push(M.offset({ count: offset.count, bank: bankLabel, off: fmt(offset.cents), a4 }));
  }

  // An unsteady reading must not drive metal removal.
  if (cur.spread > UNSTEADY_SPREAD) {
    return {
      tone: 'near',
      headline: M.recheckHead(cur.spread.toFixed(1)),
      steps: M.recheckSteps(bankLabel),
      notes,
      short: all.short.recheck,
    };
  }

  if (a <= tolerance) {
    const lean = a > tolerance * 0.6 ? M.lean({ sharp: c > 0, tol: tolerance }) : '';
    return {
      tone: 'good',
      headline: M.goodHead(fmt(c)),
      steps: [M.goodStep(lean)],
      notes,
      short: all.short.ok,
    };
  }

  const sharp = c > 0;
  const steps = [];
  if (a > 35) steps.push(M.bigError({ a: abs1(c), key: k.name }));
  steps.push(M.openReed({ bank: bankLabel, n: k.index + 1, key: k.name, swara }));
  if (!sharp) steps.push(M.clean);
  steps.push(M.shim);
  steps.push(sharp ? M.lower(amountFor(a, M)) : M.raise(amountFor(a, M)));
  steps.push(M.refit({ bank: bankLabel, beat: beat.toFixed(2) }));
  steps.push(M.stopWhen(tolerance));

  const reg = registerNote(soundingHz, M);
  if (reg) notes.unshift(reg);

  return {
    tone: a <= tolerance * 3 ? 'near' : 'off',
    headline: M.head({ sharp, a: abs1(c) }),
    steps,
    notes,
    short: shortAction(c, cur.spread, tolerance, lang),
  };
}
