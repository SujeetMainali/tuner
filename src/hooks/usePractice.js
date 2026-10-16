import { useCallback, useEffect, useRef, useState } from 'react';
import { createPracticeEngine } from '../lib/practice.js';

const HIT_CENTS = 40; // a sung or played note this close to the written one (any octave) counts

/** Cents from `f` to the nearest octave of `target`, in −600…600. */
const foldedCents = (f, target) => {
  const c = 1200 * Math.log2(f / target);
  return ((((c + 600) % 1200) + 1200) % 1200) - 600;
};

/**
 * Riyaz transport for React: plays lines of cells with harmonium, tabla and tanpura, reports the
 * current matra for highlighting, and (when `checking`) marks each matra hit or missed from the
 * tuner's live pitch, read through `liveRef`.
 */
export function usePractice({ liveRef }) {
  const engine = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(null); // { matra, pass }
  const [results, setResults] = useState({}); // matra -> 'hit' | 'miss'
  const judge = useRef({ matra: -1, pass: -1, best: Infinity, expected: null });
  const ctxRef = useRef({ cells: [], checking: false, freqFor: null });
  const droneState = useRef({ on: false, saHz: 0, note: null });

  const eng = () => (engine.current ??= createPracticeEngine());

  const finish = useCallback(() => {
    const j = judge.current;
    if (j.matra < 0 || !j.expected?.length || !ctxRef.current.checking) return;
    const verdict = j.best <= HIT_CENTS ? 'hit' : 'miss';
    const at = j.matra;
    setResults((r) => (r[at] === verdict ? r : { ...r, [at]: verdict }));
  }, []);

  // Follow the playhead and judge the mic while playing.
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const loop = () => {
      const p = eng().position();
      if (!p) { setPlaying(false); setPos(null); return; }
      const j = judge.current;
      if (p.matra !== j.matra || p.pass !== j.pass) {
        finish();
        if (p.pass !== j.pass) setResults({});
        const cell = ctxRef.current.cells[p.matra];
        j.matra = p.matra;
        j.pass = p.pass;
        j.best = Infinity;
        j.expected = cell ? cell.parts.filter((x) => typeof x === 'number') : null;
        setPos({ matra: p.matra, pass: p.pass });
      }
      const live = liveRef.current;
      if (ctxRef.current.checking && j.expected?.length && live?.freq && (live.kind === 'note' || live.kind === 'out')) {
        for (const semi of j.expected) {
          const c = Math.abs(foldedCents(live.freq, ctxRef.current.freqFor(semi)));
          if (c < j.best) j.best = c;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, finish, liveRef]);

  /** opts: { bpm, loop, taal, notes, tabla, drone, droneNote, saHz, freqs(semi) -> [Hz], freqFor(semi) -> Hz, checking } */
  const play = useCallback((lines, opts) => {
    ctxRef.current = { cells: lines.flatMap((l) => l.cells), checking: !!opts.checking, freqFor: opts.freqFor };
    judge.current = { matra: -1, pass: -1, best: Infinity, expected: null };
    setResults({});
    eng().play(lines, { ...opts, notes: opts.notes && !opts.checking, onEnd: () => setPlaying(false) });
    if (opts.drone) eng().droneOn(opts.saHz, opts.droneNote);
    else eng().droneOff();
    droneState.current = { on: !!opts.drone, saHz: opts.saHz, note: opts.droneNote };
    setPlaying(true);
  }, []);

  const stop = useCallback(() => {
    finish();
    eng().stop();
    eng().droneOff();
    droneState.current = { on: false, saHz: 0, note: null };
    setPlaying(false);
    setPos(null);
  }, [finish]);

  /** Applies the player's current settings while playing (the same object `play` takes). */
  const update = useCallback((opts) => {
    if (!engine.current?.isPlaying()) return;
    if (ctxRef.current.checking && !opts.checking) setResults({});
    ctxRef.current.checking = !!opts.checking;
    ctxRef.current.freqFor = opts.freqFor;
    const { bpm, loop, taal, tabla, notes, freqs, saHz } = opts;
    eng().set({ bpm, loop, taal, tabla, freqs, saHz, notes: notes && !opts.checking });
    const d = droneState.current;
    if (opts.drone && (!d.on || d.saHz !== saHz || d.note !== opts.droneNote)) eng().droneOn(saHz, opts.droneNote);
    if (!opts.drone && d.on) eng().droneOff();
    droneState.current = { on: !!opts.drone, saHz, note: opts.droneNote };
  }, []);

  useEffect(() => () => engine.current?.dispose(), []);

  const values = Object.values(results);
  const score = { hit: values.filter((v) => v === 'hit').length, total: values.length };
  return { playing, pos, results, score, play, stop, update };
}
