/*
 * Riyaz audio: a tanpura drone, a tabla theka and a transport that plays notation on the
 * harmonium, all scheduled ahead on the shared AudioContext so they stay in time.
 */
import { getAudio } from './audio.js';
import { reedVoice } from './harmonium.js';
import { noteEvents, TAALS } from './music.js';

const LOOKAHEAD = 0.15; // seconds scheduled ahead
const TICK_MS = 25;
const TANPURA_GAP = 1.15; // seconds between plucks

let tanpuraWave = null;
function jawariWave(ctx) {
  if (tanpuraWave?.ctx === ctx) return tanpuraWave.wave;
  // The bridge (jawari) makes high harmonics bloom, so the spectrum falls off slowly.
  const n = 40;
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = 1 / Math.pow(k, 0.55) * (k % 3 === 0 ? 0.8 : 1);
  tanpuraWave = { ctx, wave: ctx.createPeriodicWave(new Float32Array(n), imag) };
  return tanpuraWave.wave;
}

/** One tanpura string pluck at `freq`, starting at `t`. */
function pluck(ctx, dest, freq, t) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 4.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(6500, t);
  lp.frequency.exponentialRampToValueAtTime(1400, t + 2.5);
  lp.connect(g).connect(dest);
  [0, 4].forEach((cents) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(jawariWave(ctx));
    o.frequency.value = freq * Math.pow(2, cents / 1200);
    o.connect(lp);
    o.start(t);
    o.stop(t + 4.3);
  });
}

/** Tabla strokes, the dayan tuned to Sa. */
function stroke(ctx, dest, bol, t, dur, saHz, accent) {
  const vol = accent ? 1.25 : 1;
  const bass = (pitchUp) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(pitchUp ? 105 : 60, t + 0.18);
    g.gain.setValueAtTime(0.55 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.6);
  };
  const ring = (decay, level = 0.32) => {
    [1, 2.02, 3.01].forEach((h, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = saHz * h;
      g.gain.setValueAtTime(level * vol / (i + 1.5), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + decay + 0.02);
    });
  };
  const tick = (at = t, level = 0.25) => {
    const len = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = level * vol;
    src.buffer = buf;
    src.connect(bp).connect(g).connect(dest);
    src.start(at);
  };
  switch (bol) {
    case 'dha': bass(false); ring(0.35); break;
    case 'dhin': case 'dhi': bass(false); ring(0.7, 0.26); break;
    case 'ge': bass(true); break;
    case 'na': ring(0.3); break;
    case 'tin': case 'tu': ring(0.65, 0.24); break;
    case 'ta': case 'ti': ring(0.12, 0.2); tick(t, 0.18); break;
    case 'ka': case 'tta': tick(t, 0.3); break;
    case 'dhage': bass(false); ring(0.3); stroke(ctx, dest, 'ge', t + dur / 2, dur / 2, saHz, false); break;
    case 'tirakita': [0, 1, 2, 3].forEach((k) => tick(t + (dur * k) / 4, k % 2 ? 0.16 : 0.24)); break;
    default: tick(t);
  }
}

/**
 * The riyaz engine. `freqFor(semi, bank)` turns a semitone from Sa into Hz using the tuner's
 * settings. Everything is optional and can be switched while playing.
 */
export function createPracticeEngine() {
  let timer = null;
  let droneTimer = null;
  let bus = null;
  const voices = new Set();
  const state = {
    playing: false, piece: null, events: [], matras: 0, bpm: 80, loop: true, taal: 'teentaal',
    notes: true, tabla: true, freqs: null, saHz: 261.63,
    startTime: 0, nextMatra: 0, nextEvent: 0, pass: 0, onEnd: null,
  };

  const audio = () => {
    const a = getAudio();
    if (!bus) {
      bus = {
        harmonium: a.ctx.createGain(), tabla: a.ctx.createGain(), drone: a.ctx.createGain(),
      };
      bus.harmonium.gain.value = 0.9;
      bus.tabla.gain.value = 0.7;
      bus.drone.gain.value = 0.55;
      Object.values(bus).forEach((g) => g.connect(a.master));
    }
    return a;
  };

  const matraSec = () => 60 / state.bpm;

  function schedule() {
    const { ctx } = audio();
    const horizon = ctx.currentTime + LOOKAHEAD;
    const len = state.matras;
    // Tabla, one bol per matra, counted from the start so the theka lines up with the notation.
    while (state.startTime + state.nextMatra * matraSec() < horizon) {
      if (!state.loop && len && state.nextMatra >= len) break;
      const m = state.nextMatra;
      const t = state.startTime + m * matraSec();
      const taal = TAALS[state.taal];
      if (state.tabla && taal) {
        const pos = m % taal.beats;
        stroke(ctx, bus.tabla, taal.bols[pos], t, matraSec(), state.saHz, pos === 0);
      }
      state.nextMatra++;
    }
    // Notes: events repeat every `len` matras while looping.
    // Keeps its place even while muted, so turning the notes back on picks up where playback is.
    if (len && state.events.length) {
      for (;;) {
        const k = state.nextEvent;
        const pass = Math.floor(k / state.events.length);
        if (!state.loop && pass > 0) break;
        const ev = state.events[k % state.events.length];
        const t0 = state.startTime + (pass * len + ev.start) * matraSec();
        if (t0 >= horizon) break;
        const t1 = state.startTime + (pass * len + ev.end) * matraSec();
        if (state.notes && t1 > ctx.currentTime + 0.03) {
          const v = reedVoice(ctx, bus.harmonium, state.freqs(ev.semi), Math.max(t0, ctx.currentTime), 0.14);
          v.release(t1 - 0.02);
          voices.add(v);
          setTimeout(() => voices.delete(v), (t1 - ctx.currentTime + 0.5) * 1000);
        }
        state.nextEvent++;
      }
    }
    if (!state.loop && len && ctx.currentTime > state.startTime + len * matraSec() + 0.05) {
      stop();
      state.onEnd?.();
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    state.playing = false;
    voices.forEach((v) => v.release());
    voices.clear();
  }

  /**
   * Plays `lines` of cells (music.js layout) from the start. Empty lines = tabla only, endless.
   * opts: { bpm, loop, taal, notes, tabla, freqs(semi) -> [Hz], saHz, onEnd }
   */
  function play(lines, opts) {
    stop();
    const { ctx } = audio();
    const { events, matras } = noteEvents(lines);
    Object.assign(state, opts, {
      piece: lines, events, matras: matras || TAALS[opts.taal]?.beats || 16,
      startTime: ctx.currentTime + 0.12, nextMatra: 0, nextEvent: 0, playing: true,
    });
    if (!events.length) state.loop = true;
    schedule();
    timer = setInterval(schedule, TICK_MS);
  }

  /** Where playback is now: { matra (within the piece), pass } or null when stopped. */
  function position() {
    if (!state.playing) return null;
    const { ctx } = audio();
    const elapsed = (ctx.currentTime - state.startTime) / matraSec();
    if (elapsed < 0) return { matra: 0, pass: 0, frac: 0 };
    const len = state.matras;
    const pass = Math.floor(elapsed / len);
    const within = elapsed - pass * len;
    return { matra: Math.floor(within), pass, frac: within - Math.floor(within) };
  }

  /** Changes settings while playing; tempo changes keep the current position. */
  function set(opts) {
    if (opts.bpm && opts.bpm !== state.bpm && state.playing) {
      const { ctx } = audio();
      const now = (ctx.currentTime - state.startTime) / matraSec();
      state.bpm = opts.bpm;
      state.startTime = ctx.currentTime - now * matraSec();
      // Reschedule from now: release voices that started early and recount.
      voices.forEach((v) => v.release());
      voices.clear();
      state.nextMatra = Math.ceil(now);
      const len = state.matras;
      const pass = Math.floor(now / len);
      const within = now - pass * len;
      const idx = state.events.findIndex((e) => e.start >= within);
      state.nextEvent = pass * state.events.length + (idx < 0 ? state.events.length : idx);
    }
    const { bpm, ...rest } = opts;
    Object.assign(state, rest);
    if (!state.notes) { voices.forEach((v) => v.release()); voices.clear(); }
  }

  /** Tanpura drone: first string (Pa, Ma or Ni below Sa), two madhya Sa, then mandra Sa. */
  function droneOn(saHz, first = 'P') {
    droneOff();
    const { ctx } = audio();
    const firstRatio = { P: 0.75, m: 2 / 3, N: 15 / 16 }[first] ?? 0.75; // just ratios, below Sa
    const strings = [saHz * firstRatio, saHz, saHz, saHz / 2];
    let next = ctx.currentTime + 0.05;
    let k = 0;
    const tick = () => {
      while (next < ctx.currentTime + 0.4) {
        pluck(ctx, bus.drone, strings[k % 4], next);
        next += TANPURA_GAP + (k % 4 === 3 ? 0.5 : 0);
        k++;
      }
    };
    tick();
    droneTimer = setInterval(tick, 100);
    bus.drone.gain.cancelScheduledValues(ctx.currentTime);
    bus.drone.gain.setValueAtTime(0.55, ctx.currentTime);
  }

  function droneOff() {
    if (!droneTimer) return;
    clearInterval(droneTimer);
    droneTimer = null;
    const { ctx } = audio();
    bus.drone.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => { if (!droneTimer) bus.drone.gain.value = 0.55; }, 3000);
  }

  return {
    play, stop, set, position, droneOn, droneOff,
    isPlaying: () => state.playing,
    dispose() { stop(); droneOff(); },
  };
}
