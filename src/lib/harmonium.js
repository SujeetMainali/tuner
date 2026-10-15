/*
 * A reference harmonium: every key sounds at its exact target pitch on each open stop.
 * Web Audio only; the tone recipe (reedSpectrum) is a pure function so it can be tested in Node.
 */
import { keyTarget, REED_BANKS } from './dsp.js';

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

/** Creates the instrument lazily on first use (browsers only allow audio after a gesture). */
export function createHarmonium() {
  let ctx = null;
  let master = null;
  let wave = null;
  const voices = new Map(); // id -> { out, oscs }

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
      wave = ctx.createPeriodicWave(new Float32Array(HARMONICS), reedSpectrum(), { disableNormalization: false });
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function stopVoice(id, when) {
    const v = voices.get(id);
    if (!v) return;
    voices.delete(id);
    const t = Math.max(when ?? 0, ctx.currentTime);
    // A release scheduled ahead starts from the sustain level; an immediate one from wherever the attack got to.
    const from = t > ctx.currentTime + ATTACK ? VOICE_GAIN : v.out.gain.value;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(from, t);
    v.out.gain.linearRampToValueAtTime(0, t + RELEASE);
    v.oscs.forEach((o) => o.stop(t + RELEASE + 0.02));
  }

  /** Starts a sustained voice made of the given frequencies; returns its id. */
  function start(id, freqs) {
    ensure();
    stopVoice(id);
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(VOICE_GAIN, t + ATTACK);
    // Soften the very top of the buzzy spectrum, more for high reeds, as the reed chamber does.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = Math.min(9000, 900 + freqs[0] * 10);
    tone.Q.value = 0.7;
    tone.connect(out).connect(master);
    const oscs = freqs.map((f) => {
      const o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 1 / Math.sqrt(freqs.length);
      o.connect(g).connect(tone);
      o.start(t);
      return o;
    });
    voices.set(id, { out, oscs });
    return id;
  }

  /** Sounds the frequencies for a fixed time, e.g. a "hear it" button. Returns seconds. */
  function play(freqs, seconds = 2) {
    const id = 'once-' + Math.random().toString(36).slice(2);
    start(id, freqs);
    stopVoice(id, ctx.currentTime + seconds);
    return seconds;
  }

  return {
    start,
    play,
    stop: (id) => ctx && stopVoice(id),
    stopAll: () => ctx && [...voices.keys()].forEach((id) => stopVoice(id)),
    /** Sounds each group in turn, e.g. the ideal pitch then the measured one. Returns seconds. */
    sequence(parts, seconds = 1.6, gap = 0.25) {
      ensure();
      parts.forEach((freqs, i) => setTimeout(() => play(freqs, seconds), (seconds + gap) * i * 1000));
      return parts.length * (seconds + gap);
    },
    isSounding: () => voices.size > 0,
    close() {
      voices.clear();
      ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
