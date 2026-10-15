import { compareToTarget, keyTarget, status } from './dsp.js';
import { messagesFor } from '../i18n/messages.js';

export const BANKS = ['bass', 'male', 'female'];

// Cents of wander above which a reading is not trustworthy enough to file a reed against.
export const UNSTEADY_SPREAD = 2.5;

/** One-line action for tables, the CSV and the live readout. */
export function shortAction(cents, spread, tolerance, lang = 'en') {
  const m = messagesFor(lang).short;
  if (cents == null) return m.measure;
  if (spread != null && spread > UNSTEADY_SPREAD) return m.recheck;
  const a = Math.abs(cents).toFixed(1) + '¢';
  if (Math.abs(cents) <= tolerance) return m.ok;
  return cents > 0 ? m.lower(a) : m.raise(a);
}

export const saptakName = (saptak, lang = 'en') => {
  const m = messagesFor(lang).saptak;
  return m[saptak] ?? m.other(saptak);
};

export const statusText = (st, lang = 'en') => messagesFor(lang).status[st];
export const STATUS_TEXT = messagesFor('en').status;

export const bankName = (bank, lang = 'en') => messagesFor(lang).bank[bank];

/** Swara of a key: Latin (Sa, Re…) in English, Devanagari (सा, रे…) in Nepali. */
export const swaraName = (k, lang = 'en') => (lang === 'ne' ? k.swara : k.swaraLatin);

export const fmtCents = (c) =>
  c == null || Number.isNaN(c) ? '—' : (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c).toFixed(1) + '¢';

export const fmtHz = (f, d = 2) => (f == null || Number.isNaN(f) ? '—' : f.toFixed(d));

/** Saptak marks in Bhatkhande notation: dots above for higher octaves, below for lower. */
export function saptakDots(saptak) {
  const s = '•'.repeat(Math.abs(saptak));
  return saptak > 0 ? { above: s, below: '' } : { above: '', below: s };
}

export function direction(cents, tolerance, lang = 'en') {
  const m = messagesFor(lang).direction;
  if (Math.abs(cents) <= tolerance) return m.inTune;
  return cents > 0 ? m.sharp : m.flat;
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
