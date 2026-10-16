import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildKeys, compareToTarget, keyTarget, status } from './lib/dsp.js';
import { bankName, fmtCents, latest, swaraName } from './lib/format.js';
import { I18nProvider } from './i18n/I18n.jsx';
import { LANG_PATH, LANGUAGES, messagesFor } from './i18n/messages.js';
import { useHarmonium } from './hooks/useHarmonium.js';
import { useTuner } from './hooks/useTuner.js';
import { useTuningStore } from './hooks/useTuningStore.js';
import Controls from './components/Controls.jsx';
import Guide from './components/Guide.jsx';
import Keyboard from './components/Keyboard.jsx';
import KeySheet from './components/KeySheet.jsx';
import Logo from './components/Logo.jsx';
import Readout from './components/Readout.jsx';
import Report from './components/Report.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import TabBar from './components/TabBar.jsx';

// Browser chrome colour for each forced theme (index.html covers 'system').
const THEME_COLOR = { light: '#f4f5f7', white: '#ffffff', dark: '#0f1115' };

/** Applies the chosen theme and language to <html>, the page title and the URL. */
function useDocumentPrefs(theme, lang) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      if (!el.dataset.auto) el.dataset.auto = el.content;
      el.content = THEME_COLOR[theme] ?? el.dataset.auto;
    });
  }, [theme]);
  useEffect(() => {
    const seo = messagesFor(lang).seo;
    document.documentElement.lang = lang;
    document.title = seo.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
    // Keep the address on the matching language page, so a shared link opens in the same language.
    const path = LANG_PATH[lang] ?? '/';
    if (location.pathname !== path) history.replaceState(history.state, '', path + location.search + location.hash);
  }, [lang]);
}

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

export default function App({ urlLang = null }) {
  const [state, act] = useTuningStore(urlLang);
  const { settings, bank, mode, autoSave, readings, keyboardMode, stops, lang, theme } = state;
  const m = messagesFor(lang);
  useDocumentPrefs(theme, lang);
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
    showToast(m.toast.saved({ key: k.name, swara: swaraName(k, lang), c: fmtCents(cents) }));
    try { navigator.vibrate?.(30); } catch { /* not supported */ }
  }, [act, keyByMidi, bank, tuning, showToast, m, lang]);

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

  // Sa of the madhya saptak: where the computer keyboard's home row starts.
  const saMidi = (keys.find((k) => k.saptak === 0 && k.swaraLatin === 'Sa') ?? keys[0]).midi;
  const { pause } = tuner;
  const onSounding = useCallback((on, ms) => pause(on ? (ms ? ms + 300 : 3.6e6) : 350), [pause]);
  const harmonium = useHarmonium({
    stops, tuning, keys, baseMidi: saMidi, keysEnabled: keyboardMode === 'play' && !settingsOpen, onSounding,
  });

  const { noteOn } = harmonium;
  const playKey = useCallback((midi) => {
    noteOn(midi);
    act.selectKey(midi);
  }, [noteOn, act]);

  const hearIdeal = (b) => {
    const f = keyTarget(selected.midi, b, tuning);
    harmonium.playSequence([[f]], 2);
    showToast(m.toast.ideal({ key: selected.name, bank: bankName(b, lang), hz: f.toFixed(2) }));
  };
  const compare = (b) => {
    const r = latest(readings, b, selected.midi);
    if (!r) return;
    const f = keyTarget(selected.midi, b, tuning);
    harmonium.playSequence([[f], [r.freq], [f, r.freq]], 1.5);
    showToast(m.toast.compare);
  };

  const first = keys[0];
  const last = keys[keys.length - 1];
  const liveMidi = tuner.live.kind === 'note' ? tuner.live.midi : null;
  const liveInfo = liveMidi == null ? null : {
    name: keyByMidi.get(liveMidi)?.name, cents: tuner.live.cents, st: status(tuner.live.cents, settings.tolerance),
  };

  return (
    <I18nProvider lang={lang}>
    <div className="shell">
      <header className="appbar">
        <div className="wrap appbar-in">
          <div className="brand">
            <Logo />
            <div>
              <h1>Bina 17 Tuner</h1>
              <p>{m.app.subtitle}</p>
            </div>
          </div>
          <dl className="context">
            <div><dt>{m.app.range}</dt><dd className="num">{first.name}–{last.name} · {m.app.keysCount(keys.length)}</dd></div>
            <div><dt>{m.app.systemLabel}</dt><dd>{m.system[settings.system === 'just' ? 'just' : 'equal']}</dd></div>
            <div><dt>{m.app.reference}</dt><dd className="num">A4 = {settings.a4} Hz</dd></div>
            <div><dt>{m.app.tolerance}</dt><dd className="num">±{settings.tolerance}¢</dd></div>
          </dl>
          <div className="appbar-end">
            <span className={'pill' + (tuner.listening ? ' on' : '')}>
              <span className="pill-dot" aria-hidden="true" />{tuner.listening ? m.app.micOn : m.app.micOff}
            </span>
            <select className="lang-select" value={lang} aria-label={m.app.language} onChange={(e) => act.setLang(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.label}</option>)}
            </select>
            <div className="seg seg-sm lang-seg" role="group" aria-label={m.app.language}>
              {LANGUAGES.map((l) => (
                <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} title={l.label} onClick={() => act.setLang(l.id)}>
                  {l.short}
                </button>
              ))}
            </div>
            <button className="btn" type="button" onClick={() => setSettingsOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
              <span className="btn-label">{m.app.settings}</span>
            </button>
          </div>
        </div>
      </header>

      <Controls
        listening={tuner.listening}
        onToggleListening={tuner.listening ? tuner.stop : tuner.start}
        bank={bank}
        onBank={act.setBank}
        mode={mode}
        onMode={act.setMode}
        autoSave={autoSave}
        onAutoSave={act.setAutoSave}
        onSaveNow={() => { if (!tuner.saveCurrent()) showToast(m.toast.holdFirst); }}
        onPlayTarget={() => hearIdeal(bank)}
      />

      <main className="wrap main">
        <div className="row-top">
          <Readout
            live={tuner.live}
            bank={bank}
            mode={mode}
            notice={tuner.notice}
            keyByMidi={keyByMidi}
            keyCount={keys.length}
            tolerance={settings.tolerance}
            centsRef={tuner.centsRef}
          />
          <KeySheet
            k={selected}
            keys={keys}
            readings={readings}
            bank={bank}
            tuning={tuning}
            tolerance={settings.tolerance}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onHear={hearIdeal}
            onCompare={compare}
            onClear={() => { act.clearKey(selected.midi); showToast(m.toast.cleared); }}
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
          live={liveInfo}
          onSelect={selectFromTap}
          mode={keyboardMode}
          onMode={(m) => { harmonium.allOff(); act.setKeyboardMode(m); }}
          stops={stops}
          onToggleStop={act.toggleStop}
          down={harmonium.down}
          onNoteOn={playKey}
          onNoteOff={harmonium.noteOff}
          saMidi={saMidi}
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

        <Guide />
      </main>

      <TabBar />

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        theme={theme}
        onTheme={act.setTheme}
        lang={lang}
        onLang={act.setLang}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => { act.setSettings(s); setSettingsOpen(false); showToast(m.toast.settingsSaved); }}
        onClearAll={() => { act.clearAll(); showToast(m.toast.allCleared); }}
      />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
    </I18nProvider>
  );
}
