import { memo, useEffect, useMemo, useRef } from 'react';
import { keyStatus } from '../lib/format.js';

const KEY_WIDTH = 36; // matches --kw in styles.css

/** The harmonium keyboard, scrollable on phones, each key coloured by its latest reading. */
function Keyboard({ keys, readings, bank, tuning, tolerance, selectedMidi, liveMidi, onSelect }) {
  const scroller = useRef(null);
  const keyEls = useRef(new Map());

  const layout = useMemo(() => {
    let white = 0;
    const placed = keys.map((k) => {
      const left = k.black ? white * KEY_WIDTH - KEY_WIDTH * 0.32 : white++ * KEY_WIDTH;
      return { k, left };
    });
    return { placed, width: white * KEY_WIDTH };
  }, [keys]);

  useEffect(() => {
    const el = keyEls.current.get(selectedMidi);
    const sc = scroller.current;
    if (!el || !sc) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sc.scrollTo({ left: el.offsetLeft - sc.clientWidth / 2 + el.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedMidi, keys]);

  return (
    <section className="keyboard-section" aria-label="Keyboard">
      <div className="kb-head">
        <h2>Keyboard · tap a key to inspect it</h2>
        <div className="legend">
          <span style={{ '--c': 'var(--good)' }}>In tune</span>
          <span style={{ '--c': 'var(--near)' }}>Close</span>
          <span style={{ '--c': 'var(--off)' }}>Needs work</span>
          <span style={{ '--c': 'var(--untested)' }}>Not tested</span>
        </div>
      </div>
      <div className="kb-scroll" ref={scroller}>
        <div className="kb" style={{ width: layout.width }}>
          {layout.placed.map(({ k, left }) => {
            const { reading, cents, status } = keyStatus(readings, bank, k.midi, tuning, tolerance);
            const cls = [k.black ? 'b' : 'w', k.midi === selectedMidi && 'selected', k.midi === liveMidi && 'live']
              .filter(Boolean).join(' ');
            return (
              <button
                key={k.midi}
                ref={(el) => (el ? keyEls.current.set(k.midi, el) : keyEls.current.delete(k.midi))}
                type="button"
                className={cls}
                style={{ left }}
                aria-label={`${k.name}, ${k.swaraLatin}`}
                aria-pressed={k.midi === selectedMidi}
                onClick={() => onSelect(k.midi)}
              >
                <span className={'dot ' + status} />
                <span className="ct num">{reading ? (cents > 0 ? '+' : '') + cents.toFixed(0) : ''}</span>
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
