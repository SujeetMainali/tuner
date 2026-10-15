import { useCallback, useEffect, useRef, useState } from 'react';
import { createHarmonium, keyVoices } from '../lib/harmonium.js';

// Computer keys for one octave from Sa, laid out like a piano: home row white, row above black.
const KEYMAP = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l'];

/**
 * The reference harmonium. `onSounding(true|false)` tells the tuner to ignore the microphone
 * while it plays. Computer-keyboard playing is active only when `keysEnabled` is true.
 */
export function useHarmonium({ stops, tuning, keys, baseMidi, keysEnabled, onSounding }) {
  const inst = useRef(null);
  const held = useRef(new Set());
  const [down, setDown] = useState(() => new Set());
  const cfg = useRef();
  cfg.current = { stops, tuning, keys, baseMidi, onSounding };

  const harmonium = () => (inst.current ??= createHarmonium());

  const sync = useCallback(() => {
    setDown(new Set(held.current));
    cfg.current.onSounding?.(held.current.size > 0, 0);
  }, []);

  const noteOn = useCallback((midi) => {
    const { stops: s, tuning: t, keys: ks } = cfg.current;
    if (!ks.some((k) => k.midi === midi) || held.current.has(midi)) return;
    const freqs = keyVoices(midi, s, t).map((v) => v.freq);
    if (!freqs.length) return;
    harmonium().start('k' + midi, freqs);
    held.current.add(midi);
    sync();
  }, [sync]);

  const noteOff = useCallback((midi) => {
    if (!held.current.delete(midi)) return;
    inst.current?.stop('k' + midi);
    sync();
  }, [sync]);

  const allOff = useCallback(() => {
    if (!held.current.size) return;
    held.current.clear();
    inst.current?.stopAll();
    sync();
  }, [sync]);

  /** Plays groups of frequencies in turn (each group sounds together). */
  const playSequence = useCallback((groups, seconds = 1.6) => {
    const total = harmonium().sequence(groups, seconds);
    cfg.current.onSounding?.(true, total * 1000);
  }, []);

  // A change of stops or tuning re-voices nothing mid-note: release everything instead.
  useEffect(() => { allOff(); }, [stops, tuning, allOff]);

  useEffect(() => {
    if (!keysEnabled) return undefined;
    const typing = (e) => e.target.closest?.('input, select, textarea, dialog[open]') || e.metaKey || e.ctrlKey || e.altKey;
    const midiFor = (e) => {
      const i = KEYMAP.indexOf(e.key.toLowerCase());
      return i < 0 ? null : cfg.current.baseMidi + i;
    };
    const onDown = (e) => {
      if (e.repeat || typing(e)) return;
      const m = midiFor(e);
      if (m == null) return;
      e.preventDefault();
      noteOn(m);
    };
    const onUp = (e) => {
      const m = midiFor(e);
      if (m != null) noteOff(m);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', allOff);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', allOff);
      allOff();
    };
  }, [keysEnabled, noteOn, noteOff, allOff]);

  useEffect(() => () => inst.current?.close(), []);

  return { down, noteOn, noteOff, allOff, playSequence };
}
