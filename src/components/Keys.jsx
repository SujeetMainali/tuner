import { memo, useEffect, useMemo, useRef } from 'react';

/**
 * Scrolls `el` to the middle of the scroller along the keyboard's axis when it is out of view.
 * Exported for screens that keep their own scroller.
 */
export function revealKey(sc, el, vertical, smooth = true) {
  const [pos, size, scroll, view, total] = vertical
    ? [el.offsetTop, el.offsetHeight, sc.scrollTop, sc.clientHeight, sc.scrollHeight]
    : [el.offsetLeft, el.offsetWidth, sc.scrollLeft, sc.clientWidth, sc.scrollWidth];
  if (total <= view || (pos >= scroll && pos + size <= scroll + view)) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  sc.scrollTo({ [vertical ? 'top' : 'left']: pos - view / 2 + size / 2, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

/**
 * A harmonium keyboard, flat (low notes left) or upright (low notes at the bottom, like a flute).
 *
 * keyState(k) returns what to draw on a key: { tone: 'cue' | 'sel' | 'down' | 'dim' | null,
 * dot: 'good' | 'near' | 'off' | 'untested' | null, cap: computer key or '' }.
 * mode 'play' sounds keys while held (onPress / onRelease); mode 'select' taps (onPress only).
 */
function Keys({
  keys, keyState, onPress, onRelease, mode = 'play', vertical = false, reveal = null,
  minKey = vertical ? 44 : 36, fit = false, theme = 'light', ariaFor, className = '',
}) {
  const scroller = useRef(null);
  const els = useRef(new Map());

  const layout = useMemo(() => {
    const whites = keys.filter((k) => !k.black).length;
    const unit = 100 / whites;
    let w = 0;
    const placed = keys.map((k) => {
      const pos = k.black ? (w - 0.32) * unit : w++ * unit;
      const span = k.black ? 0.64 * unit : unit;
      // Upright, the lowest key sits at the bottom.
      const start = vertical ? 100 - pos - span : pos;
      return { k, start, span };
    });
    return { placed, whites };
  }, [keys, vertical]);

  // Keep the key that matters (the cue, the selection, Sa) in view.
  useEffect(() => {
    const el = els.current.get(reveal);
    if (el && scroller.current) revealKey(scroller.current, el, vertical);
  }, [reveal, vertical, layout]);

  const play = mode === 'play';
  const minSize = fit ? undefined : { [vertical ? 'minHeight' : 'minWidth']: layout.whites * minKey };

  return (
    <div className={`keys keys-${vertical ? 'v' : 'h'} keys-${theme} ${className}`} ref={scroller}>
      <div className="keys-in" style={minSize} onContextMenu={play ? (e) => e.preventDefault() : undefined}>
        {layout.placed.map(({ k, start, span }) => {
          const st = keyState(k);
          const style = vertical
            ? { top: `calc(${start}% + ${k.black ? 0 : 1}px)`, height: k.black ? span + '%' : `calc(${span}% - 2px)` }
            : { left: `calc(${start}% + ${k.black ? 0 : 1.5}px)`, width: k.black ? span + '%' : `calc(${span}% - 3px)` };
          const handlers = play ? {
            onPointerDown: (e) => { e.preventDefault(); e.currentTarget.releasePointerCapture?.(e.pointerId); onPress(k.midi); },
            onPointerUp: () => onRelease?.(k.midi),
            onPointerLeave: () => onRelease?.(k.midi),
            onPointerCancel: () => onRelease?.(k.midi),
            onKeyDown: (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); onPress(k.midi); } },
            onKeyUp: (e) => { if (e.key === ' ' || e.key === 'Enter') onRelease?.(k.midi); },
          } : { onClick: () => onPress(k.midi) };
          return (
            <button
              key={k.midi}
              ref={(el) => (el ? els.current.set(k.midi, el) : els.current.delete(k.midi))}
              type="button"
              className={['key', k.black ? 'b' : 'w', st.tone].filter(Boolean).join(' ')}
              style={style}
              aria-label={ariaFor(k, st)}
              aria-pressed={st.tone === 'down' || st.tone === 'sel' || undefined}
              {...handlers}
            >
              {st.dot && <span className={'kdot ' + st.dot} />}
              <span className="ksw">
                {k.saptak > 0 && <span className="koct up" aria-hidden="true">{'•'.repeat(k.saptak)}</span>}
                {k.swara}
                {k.saptak < 0 && <span className="koct down" aria-hidden="true">{'•'.repeat(-k.saptak)}</span>}
              </span>
              {!k.black && <span className="knm">{k.name.replace('#', '♯')}</span>}
              {st.cap && <kbd className="kcap">{st.cap}</kbd>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(Keys);
