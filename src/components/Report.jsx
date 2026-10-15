import { memo } from 'react';
import { keyTarget } from '../lib/dsp.js';
import { fmtCents, fmtHz, keyStatus, shortAction } from '../lib/format.js';
import { reportCsv, reportTsv } from '../lib/report.js';
import { useI18n } from '../i18n/I18n.jsx';

const CHART_RANGE = 25; // cents shown either side of the target in the deviation chart

/** All keys on the current reed bank: summary figures, a deviation chart, the table and export. */
function Report({ keys, readings, bank, tuning, tolerance, selectedMidi, onSelect, onToast }) {
  const { m, lang } = useI18n();
  const R = m.report;
  const rows = keys.map((k) => ({ k, ...keyStatus(readings, bank, k.midi, tuning, tolerance), target: keyTarget(k.midi, bank, tuning) }));
  const tested = rows.filter((r) => r.reading);
  const count = (s) => tested.filter((r) => r.status === s).length;
  const avg = tested.length ? tested.reduce((a, r) => a + Math.abs(r.cents), 0) / tested.length : null;

  const exportCsv = () => {
    const blob = new Blob(['\ufeff' + reportCsv(keys, readings, bank, tuning, tolerance, lang)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bina17-tuning-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportTsv(keys, readings, bank, tuning, tolerance, lang));
      onToast(m.toast.copied);
    } catch {
      onToast(m.toast.copyBlocked);
    }
  };

  const bandPct = (Math.min(tolerance, CHART_RANGE) / CHART_RANGE) * 50;

  return (
    <section className="card report" id="report" aria-label={R.title(m.bank[bank])}>
      <div className="card-head">
        <h2>{R.title(m.bank[bank])}</h2>
        <div className="head-actions">
          <button className="btn" type="button" onClick={copy}>{R.copy}</button>
          <button className="btn" type="button" onClick={exportCsv}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
            {R.export}
          </button>
        </div>
      </div>

      <dl className="kpis">
        <div><dt>{R.tested}</dt><dd className="num">{tested.length}<small> / {rows.length}</small></dd></div>
        <div><dt>{m.status.good}</dt><dd className="num status-good">{count('good')}</dd></div>
        <div><dt>{m.status.near}</dt><dd className="num status-near">{count('near')}</dd></div>
        <div><dt>{m.status.off}</dt><dd className="num status-off">{count('off')}</dd></div>
        <div><dt>{R.avg}</dt><dd className="num">{avg == null ? '—' : avg.toFixed(1) + '¢'}</dd></div>
      </dl>

      <div className="chart-block">
        <div className="chart-head">
          <h3>{R.chartTitle}</h3>
          <span className="hint">{R.chartHint({ tol: tolerance, range: CHART_RANGE })}</span>
        </div>
        <div className="chart-scroll">
          <div className="chart" style={{ minWidth: rows.length * 16 }}>
            <div className="chart-band" style={{ top: 50 - bandPct + '%', height: bandPct * 2 + '%' }} aria-hidden="true" />
            <div className="chart-zero" aria-hidden="true" />
            {rows.map(({ k, reading, cents, status }) => {
              const v = reading ? Math.max(-CHART_RANGE, Math.min(CHART_RANGE, cents)) : 0;
              const h = reading ? Math.max(1.5, (Math.abs(v) / CHART_RANGE) * 50) : 0;
              return (
                <button
                  key={k.midi}
                  type="button"
                  className={'bar-col' + (k.midi === selectedMidi ? ' sel' : '')}
                  onClick={() => onSelect(k.midi)}
                  aria-label={`${k.name}: ${reading ? fmtCents(cents) : R.notTested}`}
                  title={`${k.name} · ${reading ? fmtCents(cents) : R.notTested}`}
                >
                  {reading && (
                    <span className={'bar bg-' + status} style={v > 0 ? { bottom: '50%', height: h + '%' } : { top: '50%', height: h + '%' }} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="chart-axis num" style={{ minWidth: rows.length * 16 }} aria-hidden="true">
            {rows.map(({ k }) => <span key={k.midi}>{k.pc === 0 ? k.name : ''}</span>)}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{R.th.key}</th><th>{R.th.swara}</th><th className="r">{R.th.target}</th><th className="r">{R.th.measured}</th>
              <th className="r">{R.th.deviation}</th><th className="r">{R.th.steadiness}</th><th>{R.th.status}</th><th>{R.th.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ k, reading, cents, status, target }) => (
              <tr key={k.midi} className={k.midi === selectedMidi ? 'sel' : ''} onClick={() => onSelect(k.midi)}>
                <td className="num key-cell"><button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); onSelect(k.midi); }}>{k.name}</button></td>
                <td><span className="sw">{k.swara}</span></td>
                <td className="r num">{fmtHz(target)}</td>
                <td className="r num">{reading ? fmtHz(reading.freq) : '—'}</td>
                <td className={'r num status-' + status}>{reading ? fmtCents(cents) : '—'}</td>
                <td className="r num muted">{reading ? '±' + reading.spread.toFixed(1) + '¢' : '—'}</td>
                <td><span className={'status status-' + status}><span className={'dot ' + status} aria-hidden="true" />{m.status[status]}</span></td>
                <td className="num action">{shortAction(reading ? cents : null, reading?.spread, tolerance, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default memo(Report);
