import { useCallback, useEffect, useRef, useState } from 'react';
import { compareToTarget, keyTarget, median, nearestKey, yin } from '../lib/dsp.js';

const FRAME_MS = 40;
const SILENCE_MS = 450;
const HOLD_WINDOW_MS = 1500;
const STEADY_WINDOW_MS = 1000;
const STEADY_MIN_FRAMES = 15;
const STEADY_MAX_SPREAD = 1.5; // cents
const STEADY_MIN_HOLD_MS = 900;

const idle = (label) => ({ kind: 'idle', label });

function spreadOf(cents) {
  if (!cents.length) return 0;
  const mean = cents.reduce((a, b) => a + b, 0) / cents.length;
  return Math.sqrt(cents.reduce((a, b) => a + (b - mean) ** 2, 0) / cents.length);
}

/**
 * Microphone capture, pitch detection and "hold a key steady" tracking.
 * `config` is read through a ref on every frame, so the audio loop never sees stale settings.
 */
export function useTuner(config) {
  const cfg = useRef(config);
  cfg.current = config;

  const [listening, setListening] = useState(false);
  const [live, setLive] = useState(idle('notListening'));
  const [notice, setNotice] = useState(null);
  // Labels and notices are message ids (src/i18n/messages.js `tuner`), translated where they are shown.
  const note = useCallback((id, params) => {
    setNotice((prev) => (prev?.id === id && JSON.stringify(prev.params) === JSON.stringify(params) ? prev : { id, params }));
  }, []);
  const centsRef = useRef(null); // read by the strobe's animation loop without re-rendering
  const audio = useRef({ ctx: null, analyser: null, stream: null, timer: null, wakeLock: null, frame: null });
  const hold = useRef({ midi: null, history: [], saved: false, start: 0, lastHeard: 0, ignoreUntil: 0 });

  const resetHold = useCallback(() => {
    Object.assign(hold.current, { history: [], saved: false, start: 0 });
  }, []);

  const showIdle = useCallback((label) => {
    centsRef.current = null;
    setLive((prev) => (prev.kind === 'idle' && prev.label === label ? prev : idle(label)));
  }, []);

  const requestWakeLock = useCallback(async () => {
    const a = audio.current;
    if (!('wakeLock' in navigator) || a.wakeLock) return;
    try {
      a.wakeLock = await navigator.wakeLock.request('screen');
      a.wakeLock.addEventListener('release', () => { a.wakeLock = null; });
    } catch {
      // Optional: the screen may dim.
    }
  }, []);

  const tick = useCallback(() => {
    const a = audio.current;
    const h = hold.current;
    const { keys, bank, mode, selectedMidi, tuning, autoSave, onSave, onKeyDetected } = cfg.current;
    if (!a.analyser) return;
    const now = performance.now();
    if (now < h.ignoreUntil) { // our own harmonium is sounding
      showIdle('paused');
      return;
    }

    if (!a.frame || a.frame.length !== a.analyser.fftSize) a.frame = new Float32Array(a.analyser.fftSize);
    a.analyser.getFloatTimeDomainData(a.frame);
    const r = yin(a.frame, a.ctx.sampleRate, { minFreq: 45, maxFreq: 2400 });

    if (!r || r.clarity < 0.8) {
      if (now - h.lastHeard > SILENCE_MS) {
        resetHold();
        h.midi = null;
        setNotice(null);
        showIdle('listening');
      }
      return;
    }
    h.lastHeard = now;

    let midi, octaveOffset = 0;
    if (mode === 'locked') {
      midi = selectedMidi;
      octaveOffset = compareToTarget(r.freq, keyTarget(midi, bank, tuning)).octaveOffset;
    } else {
      const n = nearestKey(r.freq, keys, bank, tuning);
      if (!n) {
        resetHold();
        h.midi = null;
        centsRef.current = null;
        setLive({ kind: 'out', freq: r.freq });
        note('outside');
        return;
      }
      midi = n.key.midi;
    }

    if (midi !== h.midi) {
      resetHold();
      h.midi = midi;
      h.start = now;
      if (mode === 'auto') onKeyDetected?.(midi);
    }
    if (!h.start) h.start = now;
    h.history.push({ t: now, freq: r.freq });
    h.history = h.history.filter((x) => now - x.t < HOLD_WINDOW_MS);

    const target = keyTarget(midi, bank, tuning);
    const recent = h.history.filter((x) => now - x.t < STEADY_WINDOW_MS);
    const freq = median(recent.map((x) => x.freq));
    const cents = compareToTarget(freq, target).cents;
    const spread = spreadOf(recent.map((x) => compareToTarget(x.freq, target).cents));
    const steady = recent.length >= STEADY_MIN_FRAMES && spread < STEADY_MAX_SPREAD && now - h.start > STEADY_MIN_HOLD_MS;

    centsRef.current = cents;
    setLive({ kind: 'note', midi, freq, cents, target, spread, steady, octaveOffset });

    if (octaveOffset !== 0) {
      const n = Math.abs(octaveOffset);
      const key = keys.find((k) => k.midi === midi);
      note('octave', { n, above: octaveOffset > 0, bank, key: key?.name });
    } else if (spread > 4 && h.history.length > STEADY_MIN_FRAMES) {
      note('wavering');
    } else {
      setNotice(null);
    }

    if (steady && autoSave && !h.saved && octaveOffset === 0) {
      h.saved = true;
      onSave?.(midi, freq, spread);
    }
  }, [resetHold, showIdle, note]);

  const stop = useCallback(() => {
    const a = audio.current;
    clearInterval(a.timer);
    a.stream?.getTracks().forEach((t) => t.stop());
    a.ctx?.close().catch(() => {});
    a.wakeLock?.release().catch(() => {});
    Object.assign(a, { ctx: null, analyser: null, stream: null, timer: null, wakeLock: null });
    resetHold();
    hold.current.midi = null;
    setListening(false);
    showIdle('notListening');
  }, [resetHold, showIdle]);

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      note('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      note('noApi');
      return;
    }
    const a = audio.current;
    try {
      try {
        a.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'NotFoundError') throw e;
        a.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      a.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (a.ctx.state === 'suspended') await a.ctx.resume();
      const src = a.ctx.createMediaStreamSource(a.stream);
      a.analyser = a.ctx.createAnalyser();
      a.analyser.fftSize = 4096;
      a.analyser.smoothingTimeConstant = 0;
      src.connect(a.analyser);
      a.timer = setInterval(tick, FRAME_MS);
      await requestWakeLock();
      setListening(true);
      setNotice(null);
      showIdle('listening');
    } catch (e) {
      stop();
      if (e.name === 'NotAllowedError') note('blocked');
      else if (e.name === 'NotFoundError') note('notFound');
      else note('failed', { msg: e.message });
    }
  }, [tick, stop, requestWakeLock, showIdle, note]);

  /** Ignores the microphone for `ms`, so the app's own harmonium is not measured as the instrument. */
  const pause = useCallback((ms) => {
    hold.current.ignoreUntil = performance.now() + ms;
    resetHold();
  }, [resetHold]);

  const liveRef = useRef(live);
  liveRef.current = live;

  /** Manual save of the current hold, for keys that never settle enough to auto-save. */
  const saveCurrent = useCallback(() => {
    const l = liveRef.current;
    if (l.kind !== 'note') return false;
    cfg.current.onSave?.(l.midi, l.freq, l.spread);
    return true;
  }, []);

  // Changing what is being measured invalidates the current hold.
  const lockKey = config.mode === 'locked' ? config.selectedMidi : null;
  const { bank, mode } = config;
  const { a4, system, saPc } = config.tuning;
  useEffect(() => { resetHold(); }, [bank, mode, lockKey, a4, system, saPc, config.keys, resetHold]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && audio.current.ctx) requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [requestWakeLock]);

  useEffect(() => stop, [stop]);

  return { listening, live, notice, centsRef, start, stop, pause, saveCurrent };
}
