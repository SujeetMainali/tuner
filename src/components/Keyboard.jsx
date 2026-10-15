import { memo, useEffect, useMemo, useRef } from 'react';
import { BANKS, keyStatus, swaraName } from '../lib/format.js';
import { useI18n } from '../i18n/I18n.jsx';

const MIN_KEY_WIDTH = 36; // px; below this the keyboard scrolls sideways instead of shrinking
const roundedCents = (c) => {
  const r = Math.round(c);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r);
};

/**
 * The harmonium keyboard. In Inspect mode a tap selects a key and each key shows its latest
 * reading; in Play mode it is a reference harmonium sounding every key at its ideal pitch.
 */
function Keyboard({
  keys, readings, bank, tuning, tolerance, selectedMidi, liveMidi, onSelect,
  mode, onMode, stops, onToggleStop, down, onNoteOn, onNoteOff, saMidi,
}) {
  const { m, lang } = useI18n();
  const K = m.keyboard;
  const modes = [{ id: 'inspect', label: K.inspect }, { id: 'play', label: K.play }];
  const scroller = useRef(null);
  const keyEls = useRef(new Map());
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

  return (
    <section className={'card keyboard-section' + (playing ? ' is-playing' : '')} id="keys" aria-label={playing ? K.titlePlay : K.titleInspect(m.bank[bank])}>
      <div className="card-head wrap-head">
        <div className="head-title">
          <h2>{playing ? K.titlePlay : K.titleInspect(m.bank[bank])}</h2>
          <span className="meta">
            {playing ? K.metaPlay({ sys: m.system[tuning.system === 'just' ? 'just' : 'equal'], a4: tuning.a4 }) : K.metaInspect}
          </span>
        </div>
        <div className="seg" role="group" aria-label={K.modeAria}>
          {modes.map((x) => (
            <button key={x.id} type="button" aria-pressed={mode === x.id} onClick={() => onMode(x.id)}>{x.label}</button>
          ))}
        </div>
      </div>

      <div className="kb-bar">
        {playing ? (
          <>
            <div className="stops" role="group" aria-label={K.stops}>
              <span className="field-label">{K.stops}</span>
              {BANKS.map((b) => (
                <button key={b} type="button" className="stop" aria-pressed={!!stops[b]} onClick={() => onToggleStop(b)}>
                  <span className="stop-knob" aria-hidden="true" />{m.bank[b]}
                </button>
              ))}
            </div>
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
        <div className="kb" style={{ minWidth: layout.minWidth }} onContextMenu={playing ? (e) => e.preventDefault() : undefined}>
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
                ref={(el) => (el ? keyEls.current.set(k.midi, el) : keyEls.current.delete(k.midi))}
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
      </div>
    </section>
  );
}

export default memo(Keyboard);
