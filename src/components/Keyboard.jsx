import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BANKS, fmtCents, keyStatus, swaraName } from '../lib/format.js';
import { useI18n } from '../i18n/I18n.jsx';

const MIN_KEY_WIDTH = 36; // px; below this the keyboard scrolls sideways instead of shrinking
const roundedCents = (c) => {
  const r = Math.round(c);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r);
};

const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="8" width="18" height="12" rx="2" /><path d="M7 8V6a5 5 0 0 1 9-3" /><path d="m16 1 0 2.5-2.5 0" />
  </svg>
);

/**
 * The harmonium keyboard. In Inspect mode a tap selects a key and each key shows its latest
 * reading; in Play mode it is a reference harmonium sounding every key at its ideal pitch.
 * On narrow screens a Landscape view shows all keys at once, sideways and full screen.
 */
function Keyboard(props) {
  const { keys, bank, tuning, tolerance, selectedMidi, mode, onMode, stops, onToggleStop, saMidi } = props;
  const { m } = useI18n();
  const K = m.keyboard;
  const scroller = useRef(null);
  const keyEls = useRef(new Map());
  const [landscape, setLandscape] = useState(false);
  const playing = mode === 'play';

  useEffect(() => {
    if (playing) return; // never yank the keyboard sideways while someone is playing it
    const el = keyEls.current.get(selectedMidi);
    const sc = scroller.current;
    if (!el || !sc || sc.scrollWidth <= sc.clientWidth) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sc.scrollTo({ left: el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedMidi, keys, playing]);

  const noStops = !BANKS.some((b) => stops[b]);
  const saName = keys.find((k) => k.midi === saMidi)?.name;
  const title = playing ? K.titlePlay : K.titleInspect(m.bank[bank]);

  return (
    <section className={'card keyboard-section' + (playing ? ' is-playing' : '')} id="keys" aria-label={title}>
      <div className="card-head wrap-head">
        <div className="head-title">
          <h2>{title}</h2>
          <span className="meta">
            {playing ? K.metaPlay({ sys: m.system[tuning.system === 'just' ? 'just' : 'equal'], a4: tuning.a4 }) : K.metaInspect}
          </span>
        </div>
        <div className="head-actions">
          <ModeSwitch mode={mode} onMode={onMode} />
          <button className="btn landscape-btn" type="button" onClick={() => setLandscape(true)} aria-label={K.rotateAria}>
            <RotateIcon /><span>{K.rotate}</span>
          </button>
        </div>
      </div>

      <div className="kb-bar">
        {playing ? (
          <>
            <Stops stops={stops} onToggleStop={onToggleStop} />
            <span className="hint">
              {noStops
                ? K.noStops
                : <>{K.hintPre}<kbd>A</kbd>–<kbd>K</kbd>{K.hintMid(saName)}<kbd>W</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd>{K.hintEnd}</>}
            </span>
          </>
        ) : (
          <ul className="legend">
            <li><span className="dot good" aria-hidden="true" />{K.legendGood(tolerance)}</li>
            <li><span className="dot near" aria-hidden="true" />{K.legendNear(tolerance * 3)}</li>
            <li><span className="dot off" aria-hidden="true" />{m.status.off}</li>
            <li><span className="dot untested" aria-hidden="true" />{m.status.untested}</li>
          </ul>
        )}
      </div>

      <div className="kb-scroll" ref={scroller}>
        <KeyGrid {...props} keyEls={keyEls} />
      </div>

      {landscape && <LandscapeKeyboard {...props} title={title} onClose={() => setLandscape(false)} />}
    </section>
  );
}

function ModeSwitch({ mode, onMode }) {
  const { m } = useI18n();
  const K = m.keyboard;
  return (
    <div className="seg" role="group" aria-label={K.modeAria}>
      {[{ id: 'inspect', label: K.inspect }, { id: 'play', label: K.play }].map((x) => (
        <button key={x.id} type="button" aria-pressed={mode === x.id} onClick={() => onMode(x.id)}>{x.label}</button>
      ))}
    </div>
  );
}

function Stops({ stops, onToggleStop }) {
  const { m } = useI18n();
  return (
    <div className="stops" role="group" aria-label={m.keyboard.stops}>
      <span className="field-label">{m.keyboard.stops}</span>
      {BANKS.map((b) => (
        <button key={b} type="button" className="stop" aria-pressed={!!stops[b]} onClick={() => onToggleStop(b)}>
          <span className="stop-knob" aria-hidden="true" />{m.bank[b]}
        </button>
      ))}
    </div>
  );
}

/** The keys themselves. `fit` sizes them to the container instead of scrolling. */
function KeyGrid({
  keys, readings, bank, tuning, tolerance, selectedMidi, liveMidi, onSelect,
  mode, down, onNoteOn, onNoteOff, keyEls, fit = false,
}) {
  const { m, lang } = useI18n();
  const K = m.keyboard;
  const playing = mode === 'play';

  const layout = useMemo(() => {
    const whites = keys.filter((k) => !k.black).length;
    const unit = 100 / whites;
    let white = 0;
    const placed = keys.map((k) => {
      const left = k.black ? (white - 0.32) * unit : white++ * unit;
      return { k, left: left + '%', width: k.black ? 0.64 * unit + '%' : `calc(${unit}% - 3px)` };
    });
    return { placed, minWidth: whites * MIN_KEY_WIDTH };
  }, [keys]);

  return (
    <div className="kb" style={fit ? undefined : { minWidth: layout.minWidth }} onContextMenu={playing ? (e) => e.preventDefault() : undefined}>
      {layout.placed.map(({ k, left, width }) => {
        const { reading, cents, status } = keyStatus(readings, bank, k.midi, tuning, tolerance);
        const cls = [
          k.black ? 'b' : 'w',
          !playing && k.midi === selectedMidi && 'selected',
          !playing && k.midi === liveMidi && 'live',
          down.has(k.midi) && 'down',
        ].filter(Boolean).join(' ');
        const press = playing ? {
          onPointerDown: (e) => { e.preventDefault(); onNoteOn(k.midi); },
          onPointerUp: () => onNoteOff(k.midi),
          onPointerLeave: () => onNoteOff(k.midi),
          onPointerCancel: () => onNoteOff(k.midi),
          onKeyDown: (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onNoteOn(k.midi); } },
          onKeyUp: (e) => { if (e.key === ' ' || e.key === 'Enter') onNoteOff(k.midi); },
        } : { onClick: () => onSelect(k.midi) };
        return (
          <button
            key={k.midi}
            ref={keyEls ? (el) => (el ? keyEls.current.set(k.midi, el) : keyEls.current.delete(k.midi)) : undefined}
            type="button"
            className={cls}
            style={{ left, width }}
            aria-label={playing ? K.playAria({ key: k.name, swara: swaraName(k, lang) }) : K.keyAria({ key: k.name, swara: swaraName(k, lang), status: m.status[status] })}
            aria-pressed={playing ? down.has(k.midi) : k.midi === selectedMidi}
            {...press}
          >
            {!playing && <span className={'dot ' + status} />}
            {!playing && <span className="ct num">{reading ? roundedCents(cents) : ''}</span>}
            <span className="sw">{k.swara}</span>
            <span className="nm">{k.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Full-screen keyboard laid out sideways. Where the browser allows it, the screen is locked to
 * landscape; otherwise (iPhone, desktop) CSS turns the panel 90° while the phone is upright.
 */
function LandscapeKeyboard(props) {
  const { keys, readings, bank, tuning, tolerance, selectedMidi, live, mode, onMode, stops, onToggleStop, down, title, onClose, onNoteOff } = props;
  const { m, lang } = useI18n();
  const K = m.keyboard;
  const panel = useRef(null);
  const closeBtn = useRef(null);
  const playing = mode === 'play';

  useEffect(() => {
    const el = panel.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    let locked = false;
    (async () => {
      try {
        await el.requestFullscreen?.({ navigationUI: 'hide' });
        await screen.orientation?.lock?.('landscape');
        locked = true;
      } catch { /* not supported (iOS) or refused: the CSS rotation covers it */ }
    })();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (locked) try { screen.orientation.unlock(); } catch { /* ignore */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  // Release any held notes if the view closes mid-chord.
  const held = useRef(down);
  held.current = down;
  useEffect(() => () => held.current.forEach((midi) => onNoteOff(midi)), [onNoteOff]);

  const sel = keys.find((k) => k.midi === selectedMidi);
  const st = sel && keyStatus(readings, bank, sel.midi, tuning, tolerance);
  const heldNames = keys.filter((k) => down.has(k.midi)).map((k) => k.name).join(' · ');

  return createPortal(
    <div className="kb-landscape" ref={panel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="kbl-bar">
        <button ref={closeBtn} className="btn icon" type="button" aria-label={K.close} onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <h2 className="kbl-title">{title}</h2>
        <span className="kbl-info num">
          {playing
            ? heldNames || K.hintIdle
            : live
              ? <span className={'status-' + live.st}>● {live.name} {fmtCents(live.cents)}</span>
              : sel && <>{sel.name} · {swaraName(sel, lang)} · <span className={'status-' + st.status}>{st.reading ? fmtCents(st.cents) : m.status.untested}</span></>}
        </span>
        <div className="kbl-controls">
          {playing && <Stops stops={stops} onToggleStop={onToggleStop} />}
          <ModeSwitch mode={mode} onMode={onMode} />
        </div>
      </div>
      <div className={'kbl-keys' + (playing ? ' is-playing' : '')}>
        <KeyGrid {...props} fit />
      </div>
    </div>,
    document.body,
  );
}

export default memo(Keyboard);
