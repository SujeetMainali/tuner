import { keyTarget, REED_BANKS } from '../lib/dsp.js';
import { BANKS, SAPTAK, fmtCents, fmtHz, keyStatus, readingCents } from '../lib/format.js';
import { keyInstructions } from '../lib/instructions.js';
import ConfirmButton from './ConfirmButton.jsx';
import Instructions from './Instructions.jsx';
import Swara from './Swara.jsx';

/** Everything about the selected key: targets on every reed bank, readings, history and reed advice. */
export default function KeySheet({ k, keys, readings, bank, tuning, tolerance, onPrev, onNext, onClear }) {
  if (!k) return null;
  const keyCount = keys.length;
  const history = (readings[bank][k.midi] || []).slice().reverse();
  const ins = keyInstructions({ k, bank, readings, tuning, tolerance, keys });

  return (
    <section className="panel sheet" aria-label="Selected key">
      <div className="sheet-head">
        <Swara k={k} />
        <div>
          <h2>{k.name} · key {k.index + 1} of {keyCount}</h2>
          <div className="sub">{SAPTAK[k.saptak] || 'Saptak ' + k.saptak} · {k.swaraLatin}</div>
        </div>
      </div>

      <div className="banks">
        {BANKS.map((b) => {
          const { reading: r, cents, status } = keyStatus(readings, b, k.midi, tuning, tolerance);
          const et = keyTarget(k.midi, b, { ...tuning, system: 'equal' });
          const ji = keyTarget(k.midi, b, { ...tuning, system: 'just' });
          const alt = tuning.system === 'just' ? `Equal temperament ${fmtHz(et)} Hz` : `Just intonation ${fmtHz(ji)} Hz`;
          return (
            <div key={b} className={'bank-row' + (b === bank ? ' current' : '')}>
              <span className="bn">{REED_BANKS[b].label}</span>
              <span className="tg num">{fmtHz(keyTarget(k.midi, b, tuning))} Hz</span>
              <span className="ms">
                {r ? <span className={'num status-' + status}>{fmtCents(cents)}</span> : <span className="status-untested">—</span>}
              </span>
              <span className="extra num">
                {r ? `Measured ${fmtHz(r.freq)} Hz · steady ±${r.spread.toFixed(1)}¢ · ${alt}` : alt}
              </span>
            </div>
          );
        })}
      </div>

      <Instructions ins={ins} />

      <div>
        <div className="label">Saved readings on this bank</div>
        <ul className="history">
          {history.length ? (
            history.map((h) => (
              <li key={h.at}>
                <span>{new Date(h.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="num">{fmtHz(h.freq)} Hz · {fmtCents(readingCents(h, k.midi, bank, tuning))}</span>
              </li>
            ))
          ) : (
            <li>None yet</li>
          )}
        </ul>
      </div>

      <div className="btn-row">
        <button className="ghost" type="button" onClick={onPrev} disabled={k.index === 0}>← Previous key</button>
        <button className="ghost" type="button" onClick={onNext} disabled={k.index === keyCount - 1}>Next key →</button>
        <ConfirmButton label="Clear this key" confirmLabel="Tap again to clear" onConfirm={onClear} />
      </div>
    </section>
  );
}
