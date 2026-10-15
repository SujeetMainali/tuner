/*
 * Turns a key's measurements into tuning instructions. Pure functions: no DOM, testable in Node.
 *
 * Reed physics used here: a free reed's pitch rises when metal comes off the free tip (less mass
 * where it moves most) and falls when metal comes off near the root (a less stiff tongue).
 * Dirt or rust on the tongue adds mass and pulls it flat.
 */
import { keyTarget, median, REED_BANKS } from './dsp.js';
import { readingCents, shortAction, BANKS, UNSTEADY_SPREAD } from './format.js';

export { shortAction };

const HIGH_REED_HZ = 700;
const LOW_REED_HZ = 160;
const INSTRUMENT_OFFSET_MIN_KEYS = 8;

const fmt = (c) => (c > 0 ? '+' : c < 0 ? '−' : '±') + Math.abs(c).toFixed(1) + '¢';
const abs1 = (c) => Math.abs(c).toFixed(1) + '¢';

function amountFor(absCents) {
  if (absCents <= 5) return 'one or two very light strokes';
  if (absCents <= 15) return 'two to four light strokes, measuring after every pair';
  if (absCents <= 35) return 'rounds of three or four strokes, measuring after each round';
  return 'steady rounds of strokes, measuring after each round';
}

function registerNote(soundingHz) {
  if (soundingHz >= HIGH_REED_HZ) {
    return 'This is a short, thin reed tongue. Each stroke moves the pitch a lot, so use the finest file or scraper and very light pressure.';
  }
  if (soundingHz <= LOW_REED_HZ) {
    return 'This is a long, heavy reed tongue. The pitch moves slowly, so expect more strokes than on the treble reeds. If the tip carries a weight, do not file the weight.';
  }
  return null;
}

/** What the trend between the last two readings says about the last adjustment. */
function trendNote(prevC, curC, tolerance) {
  const delta = curC - prevC;
  const absCur = Math.abs(curC);
  const absPrev = Math.abs(prevC);
  if (absCur <= tolerance && absPrev > tolerance) {
    return { kind: 'fixed', text: `Fixed: the last adjustment brought it from ${fmt(prevC)} to ${fmt(curC)}.` };
  }
  if (absCur > tolerance && absPrev > tolerance && Math.sign(prevC) !== Math.sign(curC)) {
    const end = curC > 0 ? 'root' : 'tip';
    return {
      kind: 'overshoot',
      text: `Overshot: the last adjustment moved it from ${fmt(prevC)} past the target to ${fmt(curC)}. Correct back from the ${end} with lighter strokes than last time.`,
    };
  }
  if (absCur < absPrev - 0.5) {
    const moved = absPrev - absCur;
    const ratio = absCur / moved;
    const more = ratio > 6
      ? 'It needs much more of the same work; use slightly firmer strokes.'
      : `About ${Math.max(0.5, Math.round(ratio * 2) / 2)}× the same amount of work again should bring it in.`;
    return { kind: 'progress', text: `The last adjustment moved it ${abs1(moved)} closer (${fmt(prevC)} → ${fmt(curC)}). ${more}` };
  }
  if (absCur > absPrev + 0.5 && Math.sign(prevC) === Math.sign(curC)) {
    return {
      kind: 'worse',
      text: `It moved ${abs1(absCur - absPrev)} further away since the last reading (${fmt(prevC)} → ${fmt(curC)}). Check you are working the right end: the root lowers the pitch, the tip raises it.`,
    };
  }
  return { kind: 'unchanged', text: `No real change since the last reading (${fmt(prevC)} → ${fmt(curC)}).` };
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
 * Full instructions for one key on one reed bank.
 * Returns { tone: 'good' | 'near' | 'off' | 'info', headline, steps: string[], notes: string[], short }.
 */
export function keyInstructions({ k, bank, readings, tuning, tolerance, keys }) {
  const bankLabel = REED_BANKS[bank].label;
  const list = readings[bank]?.[k.midi] || [];
  const soundingHz = keyTarget(k.midi, bank, tuning);
  const notes = [];

  if (!list.length) {
    return {
      tone: 'info',
      headline: `Measure ${k.name} on the ${bankLabel} reed`,
      steps: [
        `Close every stop, then open only the ${bankLabel} stop.`,
        `Pump to your normal playing pressure and hold ${k.name} (${k.swaraLatin}) for about two seconds.`,
        'The reading saves automatically once it is steady.',
      ],
      notes,
      short: 'Measure',
    };
  }

  const cur = list[list.length - 1];
  const c = readingCents(cur, k.midi, bank, tuning);
  const a = Math.abs(c);
  const beat = Math.abs(cur.freq - soundingHz);

  // Response-based context: trend, the other reed banks on this key, and the instrument as a whole.
  let trend = null;
  if (list.length >= 2) {
    trend = trendNote(readingCents(list[list.length - 2], k.midi, bank, tuning), c, tolerance);
    notes.push(trend.text);
  }
  for (const other of BANKS) {
    if (other === bank) continue;
    const ol = readings[other]?.[k.midi];
    if (!ol?.length) continue;
    const oc = readingCents(ol[ol.length - 1], k.midi, other, tuning);
    if (Math.abs(c - oc) > tolerance) {
      notes.push(
        `The ${REED_BANKS[other].label} reed on this key reads ${fmt(oc)}. With both stops open the two reeds are ${abs1(c - oc)} apart and will beat; tune each to its own target.`,
      );
    }
  }
  const offset = instrumentOffset(readings, bank, keys, tuning);
  if (offset && Math.abs(offset.cents) > tolerance) {
    const a4 = tuning.a4 * Math.pow(2, offset.cents / 1200);
    notes.push(
      `Across ${offset.count} measured keys the ${bankLabel} reeds sit around ${fmt(offset.cents)}. The harmonium may have been tuned to A4 ≈ ${a4.toFixed(1)} Hz. To keep its own pitch and only fix the outliers, set A4 to ${a4.toFixed(1)} in Settings.`,
    );
  }

  // An unsteady reading must not drive metal removal.
  if (cur.spread > UNSTEADY_SPREAD) {
    return {
      tone: 'near',
      headline: `Re-check before adjusting: the reading wandered ±${cur.spread.toFixed(1)}¢`,
      steps: [
        `Make sure only the ${bankLabel} stop is open and the drone stops are shut.`,
        'Pump smoothly so the bellows pressure stays even, and hold the key longer.',
        'If it still wavers, check that the reed sits tight in its slot and that the key pad closes fully; a loose reed or a leak makes the pitch drift.',
        'Measure again. Only file the reed once the reading is steady.',
      ],
      notes,
      short: 'Re-check',
    };
  }

  if (a <= tolerance) {
    const lean = a > tolerance * 0.6 ? ` It leans ${c > 0 ? 'sharp' : 'flat'}; leave it unless you want it tighter than ±${tolerance}¢.` : '';
    return {
      tone: 'good',
      headline: `In tune: ${fmt(c)}. No work needed.`,
      steps: [`Leave this reed alone.${lean}`],
      notes,
      short: 'OK',
    };
  }

  const sharp = c > 0;
  const steps = [];
  if (a > 35) {
    steps.push(
      `${abs1(c)} is a large error for one reed. Before filing, check that this reed belongs to ${k.name} (reeds can be swapped between slots), that the tongue is not cracked (a buzzy, weak tone), and that it does not rub the frame.`,
    );
  }
  steps.push(`Open the harmonium and find the ${bankLabel} reed for key ${k.index + 1} (${k.name}, ${k.swaraLatin}). Mark it so it goes back the same way.`);
  if (!sharp) {
    steps.push('Clean the tongue first with a soft brush. Dust or rust adds weight and pulls a reed flat, and cleaning alone can bring it up a few cents. Re-measure after cleaning.');
  }
  steps.push('Slip a thin shim under the tongue so it is supported and cannot bend through the frame while you work.');
  steps.push(
    sharp
      ? `To lower the pitch, remove metal near the root of the tongue, next to the rivet: ${amountFor(a)}.`
      : `To raise the pitch, remove metal at the free tip of the tongue: ${amountFor(a)}.`,
  );
  steps.push(
    `Refit the reed, open only the ${bankLabel} stop and re-measure. Use "Play target tone" to compare: it beats ${beat.toFixed(2)} times a second against the target now, and the beats slow and stop as it comes into tune.`,
  );
  steps.push(`Stop when it reads within ±${tolerance}¢. Remove too little rather than too much: going past the target means working the other end.`);

  const reg = registerNote(soundingHz);
  if (reg) notes.unshift(reg);

  return {
    tone: a <= tolerance * 3 ? 'near' : 'off',
    headline: `${sharp ? 'Sharp' : 'Flat'} by ${abs1(c)}: ${sharp ? 'lower it at the root' : 'raise it at the tip'}`,
    steps,
    notes,
    short: shortAction(c, cur.spread, tolerance),
  };
}
