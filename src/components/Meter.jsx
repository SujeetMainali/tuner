const TICKS = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
const pos = (c) => 50 + c + '%';

/** Linear ±50 cent meter with the in-tune zone shaded. */
export default function Meter({ cents, tolerance }) {
  const needle = Math.max(-50, Math.min(50, cents || 0));
  return (
    <div className="meter" aria-hidden="true">
      <div className="zone" style={{ left: pos(-tolerance), width: tolerance * 2 + '%' }} />
      <div className="scale" />
      {TICKS.map((c) => (
        <div key={c} className={'tick ' + (c % 10 === 0 ? 'major' : 'minor')} style={{ left: pos(c) }} />
      ))}
      {TICKS.filter((c) => c % 25 === 0).map((c) => (
        <div key={'l' + c} className="tick-label" style={{ left: pos(c) }}>
          {c > 0 ? '+' + c : c}
        </div>
      ))}
      <div className="needle" style={{ left: pos(needle) }} />
    </div>
  );
}
