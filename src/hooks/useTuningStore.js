import { useCallback, useEffect, useState } from 'react';

const STORE_KEY = 'bina17-tuner-v1';
const MAX_HISTORY = 6;

export const DEFAULT_SETTINGS = { a4: 440, system: 'equal', saPc: 0, lowestMidi: 48, keyCount: 42, tolerance: 3 };

const DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  bank: 'male',
  mode: 'auto',
  selectedMidi: 60,
  autoSave: true,
  readings: { bass: {}, male: {}, female: {} }, // bank -> midi -> [{ freq, spread, at }]
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...s,
        settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
        readings: { ...DEFAULTS.readings, ...(s.readings || {}) },
      };
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return structuredClone(DEFAULTS);
}

/** All persisted tuner state: settings, the chosen reed bank and mode, and saved readings. */
export function useTuningStore() {
  const [state, setState] = useState(load);

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
    selectKey: useCallback((selectedMidi) => patch({ selectedMidi }), [patch]),

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
