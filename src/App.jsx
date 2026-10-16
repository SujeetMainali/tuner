import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildKeys, compareToTarget, keyTarget, status } from './lib/dsp.js';
import { bankName, fmtCents, latest, swaraName } from './lib/format.js';
import { I18nProvider } from './i18n/I18n.jsx';
import { messagesFor, pagePath, seoFor, viewFromPath } from './i18n/messages.js';
import { useDrone } from './hooks/useDrone.js';
import { useHarmonium } from './hooks/useHarmonium.js';
import { useMedia } from './hooks/useMedia.js';
import { useTuner } from './hooks/useTuner.js';
import { useTuningStore } from './hooks/useTuningStore.js';
import Home from './components/Home.jsx';
import { Sidebar, TabBar } from './components/Nav.jsx';
import Onboarding from './components/Onboarding.jsx';
import Play from './components/Play.jsx';
import Report from './components/Report.jsx';
import Riyaz from './components/Riyaz.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import Sheet from './components/Sheet.jsx';
import Tune from './components/Tune.jsx';

// Browser chrome colour for each forced theme (index.html covers 'system').
const THEME_COLOR = { light: '#f7f5f0', white: '#ffffff', dark: '#111613' };

/** Applies the chosen theme, language and page to <html>, the title and the URL. */
function useDocumentPrefs(theme, lang, view) {
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
    const seo = seoFor(lang, view);
    document.documentElement.lang = lang;
    document.title = seo.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
    // Keep the address on the matching page, so a shared link opens the same language and page.
    const path = pagePath(lang, view);
    if (location.pathname !== path) history.replaceState(history.state, '', path + location.search);
  }, [lang, view]);
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

export default function App({ urlLang = null, urlView = 'home' }) {
  const [state, act] = useTuningStore(urlLang);
  const { settings, bank, mode, readings, stops, lang, theme } = state;
  const m = messagesFor(lang);
  const phone = useMedia();
  const [view, setViewState] = useState(urlView);
  const [practiceOpen, setPracticeOpenState] = useState(false); // phone: the full-screen practice view
  useDocumentPrefs(theme, lang, view);

  const setView = useCallback((v) => {
    setViewState(v);
    setPracticeOpenState(false);
    history.pushState({ view: v }, '', pagePath(lang, v));
    requestAnimationFrame(() => window.scrollTo(0, 0));
  }, [lang]);
  const setPracticeOpen = useCallback((open) => {
    setPracticeOpenState(open);
    if (open) history.pushState({ view: 'riyaz', practice: true }, '', pagePath(lang, 'riyaz'));
    else if (history.state?.practice) history.back();
  }, [lang]);
  useEffect(() => {
    const onPop = () => {
      setViewState(viewFromPath(location.pathname));
      setPracticeOpenState(!!history.state?.practice);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    // Riyaz uses the mic to check singing; those notes must not be saved as reed readings.
    keys, bank, mode, tuning, autoSave: view === 'tune', onSave,
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
    stops, tuning, keys,
    baseMidi: saMidi + (view === 'play' ? state.play.oct * 12 : 0),
    keysEnabled: (view === 'play' || view === 'riyaz') && !settingsOpen && state.onboarded,
    onSounding,
  });
  const [drone, toggleDrone] = useDrone(keyTarget(saMidi, 'male', tuning));
  // The Riyaz player has its own tanpura: leaving Home or Play silences this one.
  useEffect(() => { if (view !== 'home' && view !== 'play') toggleDrone(false); }, [view, toggleDrone]);

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
  const saHz = keyTarget(saMidi, bank, tuning);
  const hearSa = () => harmonium.playSequence([[saHz]], 2);

  const liveRef = useRef(tuner.live);
  liveRef.current = tuner.live;

  const finishOnboarding = ({ goal = 'home', saPc, stops: st, bank: b, mic } = {}) => {
    act.finishOnboarding({ settings: saPc == null ? {} : { saPc }, ...(st && { stops: st }), ...(b && { bank: b }), goal: goal === 'play' ? 'play' : 'tune' });
    const v = goal === 'play' ? 'riyaz' : goal === 'tune' ? 'tune' : 'home';
    setView(v);
    if (mic && v === 'tune') tuner.start();
  };

  const anyReading = Object.values(readings).some((b) => Object.keys(b).length);
  const H = m.ui.home;
  const steps = [
    { id: 'setup', title: H.stepSetup, done: true },
    { id: 'reed', title: H.stepReed, sub: H.stepReedSub, done: anyReading, view: 'tune' },
    {
      id: 'alankar', title: H.stepAlankar, sub: H.stepAlankarSub, done: state.practised, view: 'riyaz',
      go: () => { act.setRiyaz({ tab: 'alankar', alankar: 'straight' }); setView('riyaz'); if (phone) setPracticeOpen(true); },
    },
  ];
  const reeds = {
    good: keys.filter((k) => {
      const r = latest(readings, bank, k.midi);
      return r && status(compareToTarget(r.freq, keyTarget(k.midi, bank, tuning)).cents, settings.tolerance) === 'good';
    }).length,
    total: keys.length,
  };
  const saName = keyByMidi.get(saMidi)?.name.replace('#', '♯') ?? 'C4';

  let screen;
  if (view === 'home') {
    screen = (
      <Home phone={phone} onView={setView} onSettings={() => setSettingsOpen(true)} steps={steps} reeds={reeds}
        drone={drone} onDrone={() => toggleDrone()} onHearSa={hearSa} saHz={saHz} saName={saName} bank={bank} />
    );
  } else if (view === 'tune') {
    screen = (
      <Tune phone={phone} tuner={tuner} keys={keys} keyByMidi={keyByMidi} bank={bank} onBank={act.setBank} mode={mode}
        onAuto={() => act.setMode('auto')} readings={readings} tuning={tuning} tolerance={settings.tolerance} selected={selected}
        onSelect={selectFromTap} onStep={step}
        onSave={() => { if (!tuner.saveCurrent()) showToast(m.toast.holdFirst); }}
        onHear={hearIdeal} onCompare={compare} onClear={() => { act.clearKey(selected.midi); showToast(m.toast.cleared); }}
        tipShown={!state.tips.tune} onDismissTip={() => act.dismissTip('tune')} onHelp={() => setGuideOpen(true)} onView={setView}
        details={detailsOpen} onDetails={setDetailsOpen} />
    );
  } else if (view === 'play') {
    screen = (
      <Play phone={phone} keys={keys} saMidi={saMidi} stops={stops} onToggleStop={act.toggleStop} harmonium={harmonium}
        play={state.play} setPlay={act.setPlay} drone={drone} onDrone={() => toggleDrone()} />
    );
  } else if (view === 'riyaz') {
    screen = (
      <Riyaz phone={phone} rs={state.riyaz} setRiyaz={act.setRiyaz} songs={state.songs} saveSong={act.saveSong} deleteSong={act.deleteSong}
        saMidi={saMidi} tuning={tuning} stops={stops} tuner={tuner} liveRef={liveRef} keys={keys} harmonium={harmonium}
        open={practiceOpen} setOpen={setPracticeOpen} coachShown={!state.tips.practice} onDismissCoach={() => act.dismissTip('practice')}
        onPractised={act.setPractised} />
    );
  } else {
    screen = (
      <Report phone={phone} keys={keys} readings={readings} bank={bank} tuning={tuning} tolerance={settings.tolerance} settings={settings}
        onOpenKey={(midi) => { selectFromTap(midi); setView('tune'); }} onToast={showToast} onView={setView} />
    );
  }

  const full = phone && view === 'riyaz' && practiceOpen;
  const fill = phone && (view === 'play' || full);

  return (
    <I18nProvider lang={lang}>
      {!state.onboarded ? (
        <Onboarding phone={phone} saPc={settings.saPc} stops={stops} onLang={act.setLang} onFinish={finishOnboarding}
          onSkip={() => finishOnboarding({ goal: 'home' })} />
      ) : (
        <div className={'app' + (fill ? ' fill' : '') + (full ? ' full' : '') + ' view-' + view}>
          <Sidebar view={view} onView={setView} saName={saName.replace(/\d/, '')} bank={bank} onSetup={() => setSettingsOpen(true)}
            onLang={act.setLang} onSettings={() => setSettingsOpen(true)} />
          <main className="content">{screen}</main>
          {!full && <TabBar view={view} onView={setView} />}
        </div>
      )}

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

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title={m.guide.title} wide>
        <ol className="guide-steps">
          {m.guide.steps.map((s, i) => (
            <li key={s.title}>
              <span className="guide-n">{i + 1}</span>
              <div><div className="guide-t">{s.title}</div><div className="guide-x">{s.text}</div></div>
            </li>
          ))}
        </ol>
      </Sheet>

      {toast && <div className={'toast' + (full ? ' up' : '')} role="status">{toast}</div>}
    </I18nProvider>
  );
}
