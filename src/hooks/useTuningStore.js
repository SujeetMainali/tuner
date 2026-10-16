import { useCallback, useEffect, useState } from 'react';

const STORE_KEY = 'bina17-tuner-v1';
const MAX_HISTORY = 6;

export const DEFAULT_SETTINGS = { a4: 440, system: 'equal', saPc: 0, lowestMidi: 48, keyCount: 42, tolerance: 3 };

const browserLang = () => {
  try {
    const first = (navigator.languages || [navigator.language]).map((l) => l.slice(0, 2).toLowerCase()).find((l) => ['en', 'ne', 'hi'].includes(l));
    return first ?? 'en';
  } catch { return 'en'; }
};

const DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  lang: browserLang(), // 'en' | 'ne' | 'hi'
  theme: 'system', // 'system' | 'light' | 'white' | 'dark'
  bank: 'male',
  mode: 'auto',
  selectedMidi: 60,
  autoSave: true,
  keyboardMode: 'inspect', // 'inspect' selects keys, 'play' sounds the reference harmonium
  stops: { bass: false, male: true, female: false }, // reference harmonium stops
  riyaz: {
    tab: 'alankar', thaat: 'bilawal', alankar: 'straight', raga: 'yaman', ragaEx: 'aarohAvroh', song: 'free',
    bpm: 80, laya: 1, taal: 'teentaal', loop: true, notes: true, drone: true, tabla: true, script: null,
  },
  songs: [], // [{ id, title, taal, notation }]
  onboarded: false, // the first-run setup was finished or skipped
  goal: 'tune', // what the player wanted to do first: 'tune' | 'play'
  practised: false, // has played a Riyaz exercise at least once
  tips: {}, // tip id -> true once dismissed
  play: { hold: false, oct: 0, raga: '', volume: 0.8, compact: false }, // virtual harmonium
  readings: { bass: {}, male: {}, female: {} }, // bank -> midi -> [{ freq, spread, at }]
};

/** Saved state, or defaults. A language in the URL (/ne/) wins over the saved one. */
function load(urlLang) {
  const withLang = (s) => (urlLang ? { ...s, lang: urlLang } : s);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return withLang({
        ...DEFAULTS,
        ...s,
        settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
        readings: { ...DEFAULTS.readings, ...(s.readings || {}) },
        stops: { ...DEFAULTS.stops, ...(s.stops || {}) },
        riyaz: { ...DEFAULTS.riyaz, ...(s.riyaz || {}) },
        songs: Array.isArray(s.songs) ? s.songs : [],
        tips: { ...(s.tips || {}) },
        play: { ...DEFAULTS.play, ...(s.play || {}) },
        // Someone who already saved readings has used the app: skip the first-run setup for them.
        onboarded: s.onboarded ?? Object.values(s.readings || {}).some((b) => Object.keys(b || {}).length),
      });
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return withLang(structuredClone(DEFAULTS));
}

/** All persisted tuner state: settings, the chosen reed bank and mode, and saved readings. */
export function useTuningStore(urlLang) {
  const [state, setState] = useState(() => load(urlLang));

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or full storage: keep working in memory.
    }
  }, [state]);

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);

  const actions = {
    setSettings: useCallback((settings) => patch({ settings }), [patch]),
    setBank: useCallback((bank) => patch({ bank }), [patch]),
    setMode: useCallback((mode) => patch({ mode }), [patch]),
    setAutoSave: useCallback((autoSave) => patch({ autoSave }), [patch]),
    setLang: useCallback((lang) => patch({ lang }), [patch]),
    setTheme: useCallback((theme) => patch({ theme }), [patch]),
    setRiyaz: useCallback((p) => setState((s) => ({ ...s, riyaz: { ...s.riyaz, ...p } })), []),
    saveSong: useCallback((song) => setState((s) => {
      const exists = s.songs.some((x) => x.id === song.id);
      return { ...s, songs: exists ? s.songs.map((x) => (x.id === song.id ? song : x)) : [...s.songs, song] };
    }), []),
    deleteSong: useCallback((id) => setState((s) => ({ ...s, songs: s.songs.filter((x) => x.id !== id) })), []),
    setKeyboardMode: useCallback((keyboardMode) => patch({ keyboardMode }), [patch]),
    toggleStop: useCallback((bank) => setState((s) => ({ ...s, stops: { ...s.stops, [bank]: !s.stops[bank] } })), []),
    selectKey: useCallback((selectedMidi) => patch({ selectedMidi }), [patch]),
    setStops: useCallback((stops) => patch({ stops }), [patch]),
    finishOnboarding: useCallback((p = {}) => setState((s) => ({
      ...s, ...p, settings: { ...s.settings, ...(p.settings || {}) }, onboarded: true,
    })), []),
    setPractised: useCallback(() => setState((s) => (s.practised ? s : { ...s, practised: true })), []),
    dismissTip: useCallback((id) => setState((s) => ({ ...s, tips: { ...s.tips, [id]: true } })), []),
    setPlay: useCallback((p) => setState((s) => ({ ...s, play: { ...s.play, ...p } })), []),

    saveReading: useCallback((midi, freq, spread) => {
      setState((s) => {
        const list = [...(s.readings[s.bank][midi] || []), { freq, spread, at: Date.now() }].slice(-MAX_HISTORY);
        return { ...s, readings: { ...s.readings, [s.bank]: { ...s.readings[s.bank], [midi]: list } } };
      });
    }, []),

    clearKey: useCallback((midi) => {
      setState((s) => {
        const bankReadings = { ...s.readings[s.bank] };
        delete bankReadings[midi];
        return { ...s, readings: { ...s.readings, [s.bank]: bankReadings } };
      });
    }, []),

    clearAll: useCallback(() => patch({ readings: { bass: {}, male: {}, female: {} } }), [patch]),
  };

  return [state, actions];
}
