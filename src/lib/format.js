import { compareToTarget, keyTarget, status } from './dsp.js';

export const BANKS = ['bass', 'male', 'female'];

// Cents of wander above which a reading is not trustworthy enough to file a reed against.
export const UNSTEADY_SPREAD = 2.5;

/** One-line action for tables, the CSV and the live readout. */
export function shortAction(cents, spread, tolerance) {
  if (cents == null) return 'Measure';
  if (spread != null && spread > UNSTEADY_SPREAD) return 'Re-check';
  const a = Math.abs(cents).toFixed(1) + '¢';
  if (Math.abs(cents) <= tolerance) return 'OK';
  return cents > 0 ? `Lower ${a} · root` : `Raise ${a} · tip`;
}

export const SAPTAK = {
  '-2': 'Ati-mandra saptak',
  '-1': 'Mandra saptak',
  0: 'Madhya saptak',
  1: 'Taar saptak',
  2: 'Ati-taar saptak',
};

export const STATUS_TEXT = { good: 'In tune', near: 'Close', off: 'Needs work', untested: 'Not tested' };

export const fmtCents = (c) =>
  c == null || Number.isNaN(c) ? '—' : (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c).toFixed(1) + '¢';

export const fmtHz = (f, d = 2) => (f == null || Number.isNaN(f) ? '—' : f.toFixed(d));

/** Saptak marks in Bhatkhande notation: dots above for higher octaves, below for lower. */
export function saptakDots(saptak) {
  const s = '•'.repeat(Math.abs(saptak));
  return saptak > 0 ? { above: s, below: '' } : { above: '', below: s };
}

export function direction(cents, tolerance) {
  if (Math.abs(cents) <= tolerance) return 'In tune';
  return cents > 0 ? 'Sharp' : 'Flat';
}

export const latest = (readings, bank, midi) => {
  const list = readings[bank]?.[midi];
  return list && list.length ? list[list.length - 1] : null;
};

// Cents are recomputed from the stored frequency, so readings stay valid when A4 or the system changes.
export const readingCents = (reading, midi, bank, tuning) =>
  compareToTarget(reading.freq, keyTarget(midi, bank, tuning)).cents;

export function keyStatus(readings, bank, midi, tuning, tolerance) {
  const r = latest(readings, bank, midi);
  const cents = r ? readingCents(r, midi, bank, tuning) : null;
  return { reading: r, cents, status: status(cents, tolerance) };
}
