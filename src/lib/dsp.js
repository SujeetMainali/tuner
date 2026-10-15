/* Pitch detection and harmonium tuning maths. No DOM access, so it runs in Node for tests. */

export const WESTERN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Swara for each semitone above Sa. Komal swaras carry a low line, tivra Ma a high mark.
export const SARGAM = ['सा', 'रे॒', 'रे', 'ग॒', 'ग', 'म', 'म॑', 'प', 'ध॒', 'ध', 'नि॒', 'नि'];
export const SARGAM_LATIN = ['Sa', 're', 'Re', 'ga', 'Ga', 'ma', 'Ma', 'Pa', 'dha', 'Dha', 'ni', 'Ni'];
// 5-limit just ratios from Sa, the usual shuddha/komal/tivra set.
export const JUST_RATIOS = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

// Reed banks sound relative to the key's written pitch: bass a 16' rank, male 8', female 4'.
export const REED_BANKS = {
  bass: { label: 'Bass', factor: 0.5 },
  male: { label: 'Male', factor: 1 },
  female: { label: 'Female', factor: 2 },
};

export const centsBetween = (f, ref) => 1200 * Math.log2(f / ref);
export const midiToEt = (midi, a4) => a4 * Math.pow(2, (midi - 69) / 12);
export const noteName = (midi) => WESTERN[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);

/**
 * Target frequency for one key on one reed bank.
 * tuning: { a4, system: 'equal' | 'just', saPc (0-11 pitch class of Sa) }
 */
export function keyTarget(midi, bank, tuning) {
  const factor = REED_BANKS[bank].factor;
  if (tuning.system !== 'just') return midiToEt(midi, tuning.a4) * factor;
  const degree = (((midi - tuning.saPc) % 12) + 12) % 12;
  const saMidi = midi - degree;
  return midiToEt(saMidi, tuning.a4) * JUST_RATIOS[degree] * factor;
}

/** The 42 (or n) keys of the instrument, lowest first. */
export function buildKeys(lowestMidi, count, saPc) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    const midi = lowestMidi + i;
    const pc = ((midi % 12) + 12) % 12;
    const degree = (((midi - saPc) % 12) + 12) % 12;
    keys.push({
      index: i,
      midi,
      name: noteName(midi),
      pc,
      black: [1, 3, 6, 8, 10].includes(pc),
      swara: SARGAM[degree],
      swaraLatin: SARGAM_LATIN[degree],
      // Saptak relative to the instrument: the octave holding Sa nearest middle C is madhya.
      saptak: Math.floor((midi - (60 + saPc - (saPc > 6 ? 12 : 0))) / 12),
    });
  }
  return keys;
}

/**
 * YIN fundamental estimate (de Cheveigné & Kawahara 2002) with parabolic refinement.
 * Returns { freq, clarity, rms } or null when the frame is silent or aperiodic.
 */
export function yin(buf, sampleRate, opts) {
  const o = Object.assign({ minFreq: 50, maxFreq: 2200, threshold: 0.12, minRms: 0.004 }, opts);
  const maxLag = Math.min(Math.floor(sampleRate / o.minFreq), Math.floor(buf.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / o.maxFreq));
  const W = buf.length - maxLag - 1;
  if (W < maxLag) return null;

  let energy = 0;
  for (let i = 0; i < W; i++) energy += buf[i] * buf[i];
  const rms = Math.sqrt(energy / W);
  if (rms < o.minRms) return null;

  const d = new Float32Array(maxLag + 2);
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const e = buf[i] - buf[i + tau];
      s += e * e;
    }
    d[tau] = s;
  }
  const raw = d.slice();
  // Cumulative mean normalised difference.
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxLag + 1; tau++) {
    running += d[tau];
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1;
  }

  let tau = -1;
  for (let t = minLag; t <= maxLag; t++) {
    if (d[t] < o.threshold) {
      while (t + 1 <= maxLag && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    // No dip under the threshold: accept the global minimum only if it is reasonably periodic.
    let best = minLag;
    for (let t = minLag + 1; t <= maxLag; t++) if (d[t] < d[best]) best = t;
    if (d[best] > 0.3) return null;
    tau = best;
  }

  let refined = tau;
  if (tau > 1 && tau < maxLag + 1) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a - 2 * b + c;
    if (den !== 0) refined = tau + (0.5 * (a - c)) / den;
  }

  // Short periods (high keys) lose precision to lag quantisation. Re-measure at the
  // furthest whole multiple of the period in the window, which divides the error by m.
  // raw[] is valid for lags 1..maxLag; keep the parabola's right neighbour inside that.
  const m = Math.floor((maxLag - 3) / refined);
  if (m >= 2) {
    const centre = Math.round(m * refined);
    let L = centre;
    for (let t = Math.max(2, centre - 2); t <= Math.min(maxLag - 1, centre + 2); t++) if (raw[t] < raw[L]) L = t;
    if (L > 1 && L < maxLag) {
      const a = raw[L - 1], b = raw[L], c = raw[L + 1];
      const den = a - 2 * b + c;
      const fine = den !== 0 ? L + (0.5 * (a - c)) / den : L;
      if (Math.abs(fine / m - refined) < 0.5) refined = fine / m;
    }
  }
  return { freq: sampleRate / refined, clarity: 1 - d[tau], rms };
}

export const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Nearest key for a measured frequency on the given bank, or null if outside the keyboard. */
export function nearestKey(freq, keys, bank, tuning) {
  let best = null, bestAbs = Infinity;
  for (const k of keys) {
    const c = centsBetween(freq, keyTarget(k.midi, bank, tuning));
    if (Math.abs(c) < bestAbs) { bestAbs = Math.abs(c); best = { key: k, cents: c }; }
  }
  return best && bestAbs <= 60 ? best : null;
}

/**
 * Cents from the target, folding out whole-octave errors so a reading on the wrong
 * reed bank is reported as an octave mismatch rather than a 1200-cent deviation.
 */
export function compareToTarget(freq, target) {
  const raw = centsBetween(freq, target);
  const octaves = Math.round(raw / 1200);
  return { cents: raw - octaves * 1200, octaveOffset: octaves };
}

export function status(cents, tolerance) {
  if (cents == null || Number.isNaN(cents)) return 'untested';
  const a = Math.abs(cents);
  if (a <= tolerance) return 'good';
  if (a <= tolerance * 3) return 'near';
  return 'off';
}
