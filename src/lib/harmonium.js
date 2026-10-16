/*
 * A reference harmonium: every key sounds at its exact target pitch on each open stop.
 * Web Audio only; the tone recipe (reedSpectrum) is a pure function so it can be tested in Node.
 */
import { keyTarget, REED_BANKS } from './dsp.js';
import { getAudio } from './audio.js';

const HARMONICS = 28;
const ATTACK = 0.06; // a reed speaks a little after the pallet opens
const RELEASE = 0.12;
const VOICE_GAIN = 0.16;

/**
 * Harmonic amplitudes of a free reed: a bright, buzzy spectrum falling roughly as 1/n,
 * with even harmonics a little weaker. Index 0 is DC and stays 0.
 */
export function reedSpectrum(count = HARMONICS) {
  const imag = new Float32Array(count);
  for (let n = 1; n < count; n++) imag[n] = (n % 2 ? 1 : 0.62) / Math.pow(n, 0.92);
  return imag;
}

/** Frequencies one key sounds with the given stops open, lowest first. */
export function keyVoices(midi, stops, tuning) {
  return Object.keys(REED_BANKS)
    .filter((b) => stops[b])
    .map((b) => ({ bank: b, freq: keyTarget(midi, b, tuning) }));
}

let waveCache = null;
const reedWave = (ctx) => (waveCache?.ctx === ctx ? waveCache.wave
  : (waveCache = { ctx, wave: ctx.createPeriodicWave(new Float32Array(HARMONICS), reedSpectrum()) }).wave);

/**
 * One reed voice: the given frequencies sounding together from `t0`, through `dest`.
 * Returns { release(when) }; release schedules the fade-out and stops the oscillators.
 */
export function reedVoice(ctx, dest, freqs, t0 = ctx.currentTime, level = VOICE_GAIN) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(level, t0 + ATTACK);
  // Soften the very top of the buzzy spectrum, more for high reeds, as the reed chamber does.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(9000, 900 + freqs[0] * 10);
  tone.Q.value = 0.7;
  tone.connect(out).connect(dest);
  const oscs = freqs.map((f) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(reedWave(ctx));
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 1 / Math.sqrt(freqs.length);
    o.connect(g).connect(tone);
    o.start(t0);
    return o;
  });
  let released = false;
  return {
    release(when = ctx.currentTime) {
      if (released) return;
      released = true;
      const t = Math.max(when, ctx.currentTime);
      // A release scheduled ahead starts from the sustain level; an immediate one from wherever the attack got to.
      const from = t >= t0 + ATTACK ? level : out.gain.value;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(from, t);
      out.gain.linearRampToValueAtTime(0, t + RELEASE);
      oscs.forEach((o) => o.stop(t + RELEASE + 0.02));
    },
  };
}

/** The playable instrument: voices keyed by id (one per held key), on the shared audio context. */
export function createHarmonium() {
  const voices = new Map(); // id -> voice

  function stopVoice(id, when) {
    const v = voices.get(id);
    if (!v) return;
    voices.delete(id);
    v.release(when);
  }

  /** Starts a sustained voice made of the given frequencies; returns its id. */
  function start(id, freqs) {
    const { ctx, master } = getAudio();
    stopVoice(id);
    voices.set(id, reedVoice(ctx, master, freqs));
    return id;
  }

  /** Sounds the frequencies for a fixed time, e.g. a "hear it" button. Returns seconds. */
  function play(freqs, seconds = 2) {
    const { ctx, master } = getAudio();
    reedVoice(ctx, master, freqs).release(ctx.currentTime + seconds);
    return seconds;
  }

  return {
    start,
    play,
    stop: (id) => stopVoice(id),
    stopAll: () => [...voices.keys()].forEach((id) => stopVoice(id)),
    /** Sounds each group in turn, e.g. the ideal pitch then the measured one. Returns seconds. */
    sequence(parts, seconds = 1.6, gap = 0.25) {
      const { ctx, master } = getAudio();
      parts.forEach((freqs, i) => reedVoice(ctx, master, freqs, ctx.currentTime + (seconds + gap) * i).release(ctx.currentTime + (seconds + gap) * i + seconds));
      return parts.length * (seconds + gap);
    },
    isSounding: () => voices.size > 0,
    close() {
      [...voices.keys()].forEach((id) => stopVoice(id));
    },
  };
}
