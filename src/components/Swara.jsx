import { saptakDots } from '../lib/format.js';

/** A swara with its saptak dots, e.g. सां with a dot above for the taar saptak. */
export default function Swara({ k, className = 'swara' }) {
  if (!k) return <div className={className}>–</div>;
  const d = saptakDots(k.saptak);
  return (
    <div className={className}>
      {k.swara}
      <span className="dots above">{d.above}</span>
      <span className="dots below">{d.below}</span>
    </div>
  );
}
