import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setVolume } from '../lib/audio.js';
import { BANKS } from '../lib/format.js';
import { RAGAS, ragaPitchClasses } from '../lib/music.js';
import { useI18n } from '../i18n/I18n.jsx';
import Keys from './Keys.jsx';
import { IconChevronDown, IconChevronUp, IconClose, IconRotate } from './Icons.jsx';

// The computer keys from Sa upward (see useHarmonium).
export const KEYMAP = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l'];
const OCT_KEYS = ['low', 'mid', 'high'];

/**
 * Play: the virtual harmonium. Every key at its true pitch on the open stops, played by touch, mouse
 * or computer keyboard; notes can be held like a drone, and a raga's notes can be picked out.
 */
export default function Play({ phone, keys, saMidi, stops, onToggleStop, harmonium, play, setPlay, drone, onDrone }) {
  const { m, lang } = useI18n();
  const P = m.ui.play;
  const { down, noteOn, noteOff, allOff } = harmonium;
  const { hold, oct, raga, volume, compact } = play;
  const [landscape, setLandscape] = useState(false);
  const base = saMidi + oct * 12;

  useEffect(() => { setVolume(volume); }, [volume]);

  const press = useCallback((midi) => {
    if (hold && down.has(midi)) noteOff(midi);
    else noteOn(midi);
  }, [hold, down, noteOn, noteOff]);
  const release = useCallback((midi) => { if (!hold) noteOff(midi); }, [hold, noteOff]);

  const setOct = (o) => { allOff(); setPlay({ oct: Math.max(-1, Math.min(1, o)) }); };
  const toggleHold = () => { if (hold) allOff(); setPlay({ hold: !hold }); };

  // Desktop: Z / X change octave, Space releases everything.
  const ref = useRef();
  ref.current = { oct, allOff, setOct };
  useEffect(() => {
    if (phone) return undefined;
    const onKey = (e) => {
      if (e.repeat || e.target.closest?.('input, select, textarea, dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') ref.current.setOct(ref.current.oct - 1);
      else if (k === 'x') ref.current.setOct(ref.current.oct + 1);
      else if (k === ' ' && !e.target.closest?.('button')) { e.preventDefault(); ref.current.allOff(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone]);

  const ragaObj = RAGAS.find((r) => r.id === raga);
  const ragaPcs = ragaObj ? new Set(ragaPitchClasses(ragaObj).map((p) => ((p % 12) + 12) % 12)) : null;
  const degree = (midi) => (((midi - saMidi) % 12) + 12) % 12;

  const keyState = (k) => {
    const i = k.midi - base;
    return {
      tone: down.has(k.midi) ? 'down' : ragaPcs && !ragaPcs.has(degree(k.midi)) ? 'dim' : null,
      cap: !phone && i >= 0 && i < KEYMAP.length ? KEYMAP[i].toUpperCase() : '',
    };
  };
  const ariaFor = (k) => P.playAria(`${k.name} · ${k.swara}`);

  const held = keys.filter((k) => down.has(k.midi));
  const heldSw = held.length ? held.map((k) => k.swara).join('  ') : phone ? P.tap : P.press;
  const heldNm = held.map((k) => k.name).join(phone ? ' ' : ' · ');
  const noStops = !BANKS.some((b) => stops[b]);
  // Collapsed controls: what is set, in one line.
  const summary = [BANKS.filter((b) => stops[b]).map((b) => m.bank[b]).join(' + ') || '—', P.octaves[OCT_KEYS[oct + 1]], hold && P.hold, drone && P.tanpura]
    .filter(Boolean).join(' · ');

  const stopButtons = BANKS.map((b) => (
    <button key={b} type="button" className="stop-btn" aria-pressed={!!stops[b]} onClick={() => onToggleStop(b)}>
      <span className="stop-knob" aria-hidden="true" />{m.bank[b]}
    </button>
  ));
  const octave = (
    <div className="oct" role="group" aria-label={P.octave}>
      <button type="button" aria-label={P.lower} onClick={() => setOct(oct - 1)} disabled={oct <= -1}>−</button>
      <span>{P.octaves[OCT_KEYS[oct + 1]]}</span>
      <button type="button" aria-label={P.higher} onClick={() => setOct(oct + 1)} disabled={oct >= 1}>+</button>
    </div>
  );
  const sounding = (
    <div className="sounding" aria-live="polite">
      <span className="snd-label">{P.sounding}</span>
      <span className={'snd-sw' + (held.length ? '' : ' empty')}>{heldSw}</span>
      {held.length > 0 && <span className="snd-nm">{heldNm}</span>}
      {!phone && <button type="button" className="snd-release" onClick={allOff}>{P.release}</button>}
    </div>
  );

  if (phone) {
    return (
      <div className="screen play fill">
        <header className="ph-head">
          <div className="ph-title">
            <h1 className="ph-h1">{P.title}</h1>
            <span className="ph-sub">{compact ? summary : P.sub(keys.find((k) => k.midi === saMidi)?.name.replace(/\d/, '') ?? 'C')}</span>
          </div>
          <button type="button" className="btn-secondary sm" onClick={() => setLandscape(true)}><IconRotate />{P.landscape}</button>
          <button type="button" className="icon-btn lg" aria-expanded={!compact} aria-controls="play-controls"
            aria-label={compact ? P.showControls : P.hideControls} onClick={() => setPlay({ compact: !compact })}>
            {compact ? <IconChevronDown /> : <IconChevronUp />}
          </button>
        </header>
        {!compact && (
          <div className="play-controls" id="play-controls">
            <div className="play-stops" role="group" aria-label={P.stops}>{stopButtons}</div>
            <div className="play-row">
              {octave}
              <button type="button" className="tog" aria-pressed={hold} onClick={toggleHold}>{P.hold}</button>
              <button type="button" className="tog" aria-pressed={drone} onClick={onDrone}>{P.tanpura}</button>
            </div>
          </div>
        )}
        {noStops ? <p className="notice">{P.noStops}</p> : sounding}
        <section className="play-keys" aria-label={P.keysAria}>
          <Keys keys={keys} keyState={keyState} onPress={press} onRelease={release} vertical reveal={base + 4} ariaFor={ariaFor} theme="dark" />
        </section>
        {landscape && (
          <Landscape keys={keys} base={base} keyState={keyState} press={press} release={release} ariaFor={ariaFor} heldSw={held.length ? heldSw : ''}
            onClose={() => setLandscape(false)} allOff={allOff} stopButtons={stopButtons} octave={octave}
            zoom={!!play.lsZoom} onZoom={(z) => setPlay({ lsZoom: z })} />
        )}
      </div>
    );
  }

  return (
    <div className="screen play desk">
      <header className="dk-head">
        <h1>{P.titleLong}</h1>
        <p>{P.intro}</p>
      </header>
      <section className="card play-panel" aria-label={m.ui.common.settings}>
        <div className="pp-field">
          <span>{P.stops}</span>
          <div className="pp-stops" role="group" aria-label={P.stops}>{stopButtons}</div>
        </div>
        <div className="pp-field">
          <span>{P.octave}</span>
          {octave}
        </div>
        <div className="pp-toggles">
          <button type="button" className="tog" aria-pressed={hold} onClick={toggleHold}>{P.hold}</button>
          <button type="button" className="tog" aria-pressed={drone} onClick={onDrone}>{P.drone}</button>
        </div>
        <label className="pp-field">{P.raga}
          <select value={raga} onChange={(e) => setPlay({ raga: e.target.value })}>
            <option value="">{P.ragaOff}</option>
            {RAGAS.map((r) => <option key={r.id} value={r.id}>{lang === 'en' ? r.name : r.dev}</option>)}
          </select>
        </label>
        <label className="pp-field grow">{P.volume}
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setPlay({ volume: Number(e.target.value) })} />
        </label>
      </section>
      {noStops ? <p className="notice">{P.noStops}</p> : sounding}
      <section className="play-board" aria-label={P.keysAria}>
        <Keys keys={keys} keyState={keyState} onPress={press} onRelease={release} reveal={base + 4} ariaFor={ariaFor} theme="dark" minKey={40} />
      </section>
      <ul className="shortcuts" aria-label={P.shortcutsAria}>
        <li><kbd>A–K</kbd><span>{P.tipWhite}</span></li>
        <li><kbd>W E T Y U</kbd><span>{P.tipBlack}</span></li>
        <li><kbd>Z X</kbd><span>{P.tipOct}</span></li>
        <li><kbd>Space</kbd><span>{P.tipRelease}</span></li>
      </ul>
    </div>
  );
}

/**
 * Phone: the keyboard sideways and full screen: every key, or zoomed to two octaves from the chosen Sa
 * for bigger keys. Where the browser allows it the screen locks to landscape; otherwise (iPhone, or a
 * refused lock) an inner panel turns a quarter turn while the phone is upright. The rotation is on
 * that inner panel because browsers reset transforms on the fullscreen element itself.
 */
function Landscape({ keys, base, keyState, press, release, ariaFor, heldSw, onClose, allOff, stopButtons, octave, zoom, onZoom }) {
  const { m } = useI18n();
  const panel = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = panel.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let locked = false;
    (async () => {
      try {
        await el.requestFullscreen?.({ navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape');
        locked = true;
      } catch { /* not supported (iOS) or refused: the rotated panel covers it */ }
    })();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      allOff();
      if (locked) try { screen.orientation.unlock(); } catch { /* ignore */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Every key by default; zoomed, two octaves (Sa to Sa'') from the chosen octave, inside the instrument's range.
  const first = keys[0].midi;
  const last = keys[keys.length - 1].midi;
  const start = Math.max(first, Math.min(base, last - 24));
  const shown = zoom ? keys.filter((k) => k.midi >= start && k.midi <= start + 24) : keys;

  return createPortal(
    <div className="landscape" ref={panel} role="dialog" aria-modal="true" aria-label={m.ui.play.titleLong}>
      <div className="ls-rot">
        <div className="ls-bar">
          <button type="button" className="icon-btn" aria-label={m.ui.common.close} onClick={onClose}><IconClose /></button>
          <span className={'ls-held' + (heldSw ? '' : ' empty')}>{heldSw || m.ui.play.tap}</span>
          <div className="ls-stops" role="group" aria-label={m.ui.play.stops}>{stopButtons}</div>
          <div className="seg ls-zoom" role="group" aria-label={m.ui.play.range}>
            <button type="button" aria-pressed={!zoom} onClick={() => onZoom(false)}>{m.ui.play.allKeys(keys.length)}</button>
            <button type="button" aria-pressed={zoom} onClick={() => onZoom(true)}>{m.ui.play.twoOctaves}</button>
          </div>
          {zoom && octave}
        </div>
        <div className="ls-keys">
          <Keys keys={shown} keyState={keyState} onPress={press} onRelease={release} fit ariaFor={ariaFor} theme="dark" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
