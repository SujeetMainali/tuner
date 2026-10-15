import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildKeys, compareToTarget, keyTarget } from './lib/dsp.js';
import { fmtCents } from './lib/format.js';
import { useTuner } from './hooks/useTuner.js';
import { useTuningStore } from './hooks/useTuningStore.js';
import Controls from './components/Controls.jsx';
import Guide from './components/Guide.jsx';
import Keyboard from './components/Keyboard.jsx';
import KeySheet from './components/KeySheet.jsx';
import Readout from './components/Readout.jsx';
import Report from './components/Report.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';

function useToast() {
  const [message, setMessage] = useState(null);
  const timer = useRef();
  const show = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 1800);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [message, show];
}

export default function App() {
  const [state, act] = useTuningStore();
  const { settings, bank, mode, autoSave, readings } = state;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, showToast] = useToast();

  const tuning = useMemo(
    () => ({ a4: settings.a4, system: settings.system, saPc: settings.saPc }),
    [settings.a4, settings.system, settings.saPc],
  );
  const keys = useMemo(
    () => buildKeys(settings.lowestMidi, settings.keyCount, settings.saPc),
    [settings.lowestMidi, settings.keyCount, settings.saPc],
  );
  const keyByMidi = useMemo(() => new Map(keys.map((k) => [k.midi, k])), [keys]);
  const selected = keyByMidi.get(state.selectedMidi) ?? keys[Math.min(12, keys.length - 1)];

  const onSave = useCallback((midi, freq, spread) => {
    act.saveReading(midi, freq, spread);
    const k = keyByMidi.get(midi);
    const cents = compareToTarget(freq, keyTarget(midi, bank, tuning)).cents;
    showToast(`Saved ${k.name} (${k.swaraLatin}) · ${fmtCents(cents)}`);
    try { navigator.vibrate?.(30); } catch { /* not supported */ }
  }, [act, keyByMidi, bank, tuning, showToast]);

  const tuner = useTuner({
    keys, bank, mode, tuning, autoSave, onSave,
    selectedMidi: selected.midi,
    onKeyDetected: act.selectKey,
  });

  const selectFromTap = useCallback((midi) => {
    act.selectKey(midi);
    act.setMode('locked');
  }, [act]);

  const step = (delta) => {
    const next = keys[selected.index + delta];
    if (next) selectFromTap(next.midi);
  };

  const first = keys[0];
  const last = keys[keys.length - 1];
  const liveMidi = tuner.live.kind === 'note' ? tuner.live.midi : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Bina 17 Tuner</h1>
          <p>
            {keys.length} keys · {first.name}–{last.name} · {settings.system === 'just' ? 'Just intonation' : 'Equal temperament'} ·{' '}
            <span style={{ whiteSpace: 'nowrap' }}>A4 = {settings.a4} Hz</span>
          </p>
        </div>
        <button className="icon-btn" type="button" onClick={() => setSettingsOpen(true)}>Settings</button>
      </header>

      <div className="col col-live">
        <Readout
          live={tuner.live}
          bank={bank}
          notice={tuner.notice}
          keyByMidi={keyByMidi}
          tolerance={settings.tolerance}
          centsRef={tuner.centsRef}
        />
        <Controls
          listening={tuner.listening}
          onToggleListening={tuner.listening ? tuner.stop : tuner.start}
          bank={bank}
          onBank={act.setBank}
          mode={mode}
          onMode={act.setMode}
          autoSave={autoSave}
          onAutoSave={act.setAutoSave}
          onSaveNow={() => { if (!tuner.saveCurrent()) showToast('Play and hold a key first'); }}
          onPlayTarget={() => {
            const f = keyTarget(selected.midi, bank, tuning);
            tuner.playReference(f);
            showToast(`Playing ${selected.name} target · ${f.toFixed(2)} Hz`);
          }}
        />
      </div>

      <Keyboard
        keys={keys}
        readings={readings}
        bank={bank}
        tuning={tuning}
        tolerance={settings.tolerance}
        selectedMidi={selected.midi}
        liveMidi={liveMidi}
        onSelect={selectFromTap}
      />

      <div className="col col-detail">
        <KeySheet
          k={selected}
          keys={keys}
          readings={readings}
          bank={bank}
          tuning={tuning}
          tolerance={settings.tolerance}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClear={() => { act.clearKey(selected.midi); showToast('Cleared'); }}
        />
        <Report
          keys={keys}
          readings={readings}
          bank={bank}
          tuning={tuning}
          tolerance={settings.tolerance}
          selectedMidi={selected.midi}
          onSelect={selectFromTap}
          onToast={showToast}
        />
      </div>

      <Guide />

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => { act.setSettings(s); setSettingsOpen(false); showToast('Settings saved'); }}
        onClearAll={() => { act.clearAll(); showToast('All readings cleared'); }}
      />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
