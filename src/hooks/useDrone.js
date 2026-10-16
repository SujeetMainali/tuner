import { useCallback, useEffect, useRef, useState } from 'react';
import { createPracticeEngine } from '../lib/practice.js';

/** A tanpura drone on Sa (and Pa) that can be switched on and off on its own, outside Riyaz. */
export function useDrone(saHz) {
  const engine = useRef(null);
  const [on, setOn] = useState(false);

  const eng = () => (engine.current ??= createPracticeEngine());

  const toggle = useCallback((next) => setOn((v) => (typeof next === 'boolean' ? next : !v)), []);

  useEffect(() => {
    if (on) eng().droneOn(saHz, 'P');
    else engine.current?.droneOff();
  }, [on, saHz]);

  useEffect(() => () => engine.current?.dispose(), []);

  return [on, toggle];
}
