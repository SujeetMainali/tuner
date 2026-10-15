import { keyTarget } from '../lib/dsp.js';
import { BANKS, fmtCents, fmtHz, keyStatus, readingCents, saptakName, swaraName } from '../lib/format.js';
import { keyInstructions } from '../lib/instructions.js';
import { useI18n } from '../i18n/I18n.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import Instructions from './Instructions.jsx';
import Swara from './Swara.jsx';

const SpeakerIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
);

/** Everything about the selected key: targets on every reed bank, readings, how it should sound, and reed advice. */
export default function KeySheet({ k, keys, readings, bank, tuning, tolerance, onPrev, onNext, onHear, onCompare, onClear }) {
  const { m, lang } = useI18n();
  const S = m.sheet;
  if (!k) return null;
  const keyCount = keys.length;
  const history = (readings[bank][k.midi] || []).slice().reverse();
  const ins = keyInstructions({ k, bank, readings, tuning, tolerance, keys, lang });
  const altSystem = tuning.system === 'just' ? 'equal' : 'just';
  const current = keyStatus(readings, bank, k.midi, tuning, tolerance);

  return (
    <section className="card sheet" id="key" aria-label={S.title}>
      <div className="card-head">
        <h2>{S.title}</h2>
        <div className="stepper">
          <button className="btn icon" type="button" aria-label={S.prev} onClick={onPrev} disabled={k.index === 0}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="num">{k.index + 1} / {keyCount}</span>
          <button className="btn icon" type="button" aria-label={S.next} onClick={onNext} disabled={k.index === keyCount - 1}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="card-body sheet-body">
        <div className="sheet-head">
          <Swara k={k} />
          <div>
            <div className="sheet-title">{k.name} · {swaraName(k, lang)}</div>
            <div className="sub">{saptakName(k.saptak, lang)} · {m.live.keyOf({ n: k.index + 1, total: keyCount })}</div>
          </div>
        </div>

        <div className="box">
          <table className="tbl">
            <thead>
              <tr><th>{S.bank}</th><th className="r">{S.ideal}</th><th className="r col-measured">{S.measured}</th><th className="r">{S.deviation}</th><th className="r"><span className="sr-only">{S.listen}</span></th></tr>
            </thead>
            <tbody>
              {BANKS.map((b) => {
                const { reading: r, cents, status } = keyStatus(readings, b, k.midi, tuning, tolerance);
                const alt = keyTarget(k.midi, b, { ...tuning, system: altSystem });
                return (
                  <tr key={b} className={b === bank ? 'current' : ''}>
                    <td>
                      <span className="bn">{m.bank[b]}</span>
                      {b === bank && <span className="tag">{S.testing}</span>}
                    </td>
                    <td className="r num" title={`${m.system[altSystem]}: ${fmtHz(alt)} Hz`}>{fmtHz(keyTarget(k.midi, b, tuning))}</td>
                    <td className="r num col-measured">{r ? fmtHz(r.freq) : '—'}</td>
                    <td className={'r num status-' + status}>{r ? fmtCents(cents) : <span title={S.notTested}>—<span className="sr-only">{S.notTested}</span></span>}</td>
                    <td className="r">
                      <button className="btn icon sm" type="button" aria-label={S.hearAria({ key: k.name, bank: m.bank[b] })} onClick={() => onHear(b)}>
                        <SpeakerIcon />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="listen-row">
          <button className="btn" type="button" onClick={() => onHear(bank)}>
            <SpeakerIcon />{S.hearIdeal(k.name)}
          </button>
          <button className="btn" type="button" onClick={() => onCompare(bank)} disabled={!current.reading}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" /></svg>
            {S.compare}
          </button>
          <span className="hint">{current.reading ? S.compareHint : S.measureFirst}</span>
        </div>

        <Instructions ins={ins} />

        <div>
          <div className="label">{S.saved(m.bank[bank])}</div>
          <ul className="history">
            {history.length ? (
              history.map((h) => (
                <li key={h.at}>
                  <span>{new Date(h.at).toLocaleString(lang === 'ne' ? 'ne-NP' : [], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="num">{fmtHz(h.freq)} Hz · {fmtCents(readingCents(h, k.midi, bank, tuning))}</span>
                </li>
              ))
            ) : (
              <li>{S.none}</li>
            )}
          </ul>
        </div>

        <div className="sheet-foot">
          <ConfirmButton className="btn danger" label={S.clear} confirmLabel={S.clearConfirm} onConfirm={onClear} />
        </div>
      </div>
    </section>
  );
}
