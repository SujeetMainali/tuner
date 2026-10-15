import { useEffect, useRef } from 'react';
import { status } from '../lib/dsp.js';

const ROWS = [
  { period: 48, mult: 1 },
  { period: 24, mult: 2 },
  { period: 12, mult: 4 },
];

/** Strobe display: bands drift with speed proportional to the deviation and stop when in tune. */
export default function Strobe({ centsRef, tolerance }) {
  const canvas = useRef(null);
  const tol = useRef(tolerance);
  tol.current = tolerance;

  useEffect(() => {
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let offset = 0;
    let last = performance.now();
    let raf;

    const draw = (now) => {
      const cv = canvas.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = centsRef.current;
      // 1 cent drifts slowly enough to see; 50 cents races.
      if (c != null && !reduceMotion.matches) offset += c * 6 * dt;

      const css = getComputedStyle(document.documentElement);
      const token = c == null ? '--untested' : '--' + status(c, tol.current);
      g.clearRect(0, 0, w, h);
      g.fillStyle = css.getPropertyValue(token).trim();
      ROWS.forEach((r, i) => {
        const y = (i * h) / 3;
        const off = (((offset * r.mult) % r.period) + r.period) % r.period;
        for (let x = -r.period + off; x < w; x += r.period) g.fillRect(x, y + 2, r.period / 2, h / 3 - 4);
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [centsRef]);

  return (
    <div className="strobe-wrap">
      <canvas ref={canvas} className="strobe" aria-hidden="true" />
    </div>
  );
}
