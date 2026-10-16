import { memo, useState } from 'react';
import { keyTarget } from '../lib/dsp.js';
import { fmtHz, keyStatus, shortAction, swaraName } from '../lib/format.js';
import { reportCsv, reportTsv } from '../lib/report.js';
import { useI18n } from '../i18n/I18n.jsx';
import { centsText } from './Tune.jsx';
import { IconChevron, IconDownload } from './Icons.jsx';

const CHART_RANGE = 35; // cents shown either side of the target in the deviation chart

/**
 * Report: how many reeds of the current bank are in tune, which to fix first and, on desktops,
 * the deviation chart and a table of every key, with copy and CSV export.
 */
function Report({ phone, keys, readings, bank, tuning, tolerance, settings, onOpenKey, onToast, onView }) {
  const { m, lang } = useI18n();
  const U = m.ui.report;
  const [filter, setFilter] = useState('work');
  const rows = keys.map((k) => ({ k, ...keyStatus(readings, bank, k.midi, tuning, tolerance), target: keyTarget(k.midi, bank, tuning) }));
  const tested = rows.filter((r) => r.reading);
  const count = (s) => rows.filter((r) => r.status === s).length;
  const n = { good: count('good'), near: count('near'), off: count('off'), none: count('untested') };
  const avg = tested.length ? tested.reduce((a, r) => a + Math.abs(r.cents), 0) / tested.length : null;
  const toFix = tested.filter((r) => r.status === 'off' || r.status === 'near').sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
  const action = (r) => (!r.reading ? U.notChecked : r.status === 'good' ? U.leave : r.cents > 0 ? U.sharpLower : U.flatRaise);

  const exportCsv = () => {
    const blob = new Blob(['﻿' + reportCsv(keys, readings, bank, tuning, tolerance, lang)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `swara-tuning-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const bar = (
    <div className="stack-bar" role="img" aria-label={U.barAria(n)}>
      {['good', 'near', 'off', 'none'].map((s) => n[s] > 0 && <span key={s} className={'sb-' + s} style={{ flexGrow: n[s] }} />)}
    </div>
  );
  const legend = (
    <ul className="sb-legend">
      {['good', 'near', 'off', 'none'].map((s) => <li key={s}><span className={'ldot ' + (s === 'none' ? 'untested' : s)} />{U.legend[s]} · {n[s]}</li>)}
    </ul>
  );
  const empty = !tested.length && (
    <section className="card rp-empty">
      <h2>{U.empty}</h2>
      <p>{U.emptySub}</p>
      <button type="button" className="btn-primary" onClick={() => onView('tune')}>{U.emptyCta}</button>
    </section>
  );
  const centsCls = (r) => 'rp-cents tone-' + r.status;

  if (phone) {
    return (
      <div className="screen report">
        <header className="ph-head">
          <h1 className="ph-h1 grow">{U.title}</h1>
          <button type="button" className="btn-secondary sm" onClick={exportCsv} disabled={!tested.length}><IconDownload />{U.export}</button>
        </header>
        <section className="card summary" aria-label={U.summaryAria}>
          <div className="sum-top"><span>{U.reeds(m.bank[bank])}</span><span>{U.tolerance(tolerance)}</span></div>
          <div className="sum-big"><span className="sum-n">{n.good}</span><span>{U.inTuneOf(keys.length)}</span></div>
          {bar}
          {legend}
        </section>
        {empty || (
          <section aria-labelledby="fix">
            <div className="sec-head">
              <h2 id="fix">{U.fixFirst}</h2>
              <span>{U.furthest}</span>
            </div>
            {toFix.length ? (
              <ul className="fix-list">
                {toFix.map((r) => (
                  <li key={r.k.midi}>
                    <button type="button" onClick={() => onOpenKey(r.k.midi)}>
                      <span className="fix-sw">{r.k.swara}</span>
                      <span className="fix-text"><span>{r.k.name.replace('#', '♯')} · {swaraName(r.k, lang)}</span><small>{action(r)}</small></span>
                      <span className={centsCls(r)}>{centsText(r.cents)}¢</span>
                      <IconChevron />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="ok-note">{U.allGood}</p>}
          </section>
        )}
        <p className="tech-note">{U.technician}</p>
      </div>
    );
  }

  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'work' ? r.status === 'off' || r.status === 'near' : !r.reading));
  const band = (Math.min(tolerance, CHART_RANGE) / CHART_RANGE) * 50;
  return (
    <div className="screen report desk">
      <header className="dk-head row">
        <div className="dk-head-t">
          <h1>{U.titleLong}</h1>
          <p>{U.meta({ bank: m.bank[bank], tol: tolerance, a4: settings.a4, sys: m.system[settings.system === 'just' ? 'just' : 'equal'].toLowerCase() })}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={copy} disabled={!tested.length}>{m.report.copy}</button>
        <button type="button" className="btn-primary" onClick={exportCsv} disabled={!tested.length}>{m.report.export}</button>
      </header>
      <dl className="kpis">
        <div className="card"><dt>{U.legend.good}</dt><dd className="tone-good">{n.good}<small> / {keys.length}</small></dd></div>
        <div className="card"><dt>{U.kpiNear({ a: tolerance, b: tolerance * 3 })}</dt><dd className="tone-near">{n.near}</dd></div>
        <div className="card"><dt>{U.kpiOff}</dt><dd className="tone-off">{n.off}</dd></div>
        <div className="card"><dt>{U.kpiAvg}</dt><dd>{avg == null ? '—' : avg.toFixed(1) + '¢'}</dd></div>
      </dl>
      {empty || (
        <>
          <section className="card chart-card" aria-labelledby="chart-t">
            <div className="chart-head"><h2 id="chart-t">{m.report.chartTitle}</h2><span>{U.chartHint(tolerance)}</span></div>
            <div className="chart-scroll">
              <div className="chart" role="img" aria-label={U.chartAria} style={{ minWidth: rows.length * 18 }}>
                <div className="chart-band" style={{ top: 50 - band + '%', height: band * 2 + '%' }} />
                <div className="chart-zero" />
                <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
                  {rows.map((r) => {
                    const v = r.reading ? Math.max(-CHART_RANGE, Math.min(CHART_RANGE, r.cents)) : 0;
                    const h = r.reading ? Math.max(1.5, (Math.abs(v) / CHART_RANGE) * 50) : 0;
                    return (
                      <button key={r.k.midi} type="button" className="bar-col" onClick={() => onOpenKey(r.k.midi)}
                        aria-label={`${r.k.name}: ${r.reading ? centsText(r.cents) + '¢' : U.notChecked}`} title={`${r.k.name} · ${r.reading ? centsText(r.cents) + '¢' : U.notChecked}`}>
                        {r.reading
                          ? <span className={'bar tone-' + r.status} style={v > 0 ? { bottom: '50%', height: h + '%' } : { top: '50%', height: h + '%' }} />
                          : <span className="bar none" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="chart-axis" style={{ minWidth: rows.length * 18, gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} aria-hidden="true">
                {rows.map((r) => <span key={r.k.midi}>{r.k.pc === 0 ? r.k.name : ''}</span>)}
              </div>
            </div>
          </section>
          <section className="card table-card" aria-labelledby="tbl-t">
            <div className="table-head">
              <h2 id="tbl-t">{U.every}</h2>
              <div className="filters" role="group" aria-label={U.filterAria}>
                {['work', 'none', 'all'].map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{U.filters[f]}</button>)}
              </div>
            </div>
            <div className="table-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>{m.report.th.key}</th><th>{m.report.th.swara}</th><th>{m.report.th.target}</th><th>{m.report.th.measured}</th>
                    <th>{m.report.th.deviation}</th><th>{m.report.th.status}</th><th>{U.todo}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.k.midi}>
                      <td><button type="button" className="row-link" onClick={() => onOpenKey(r.k.midi)}>{r.k.name.replace('#', '♯')}</button></td>
                      <td className="sw">{r.k.swara}</td>
                      <td className="mono">{fmtHz(r.target)} Hz</td>
                      <td className="mono">{r.reading ? fmtHz(r.reading.freq) + ' Hz' : '—'}</td>
                      <td className={'mono ' + centsCls(r)}>{r.reading ? centsText(r.cents) + '¢' : '—'}</td>
                      <td><span className={'st-pill ' + r.status}>{U.legend[r.status === 'untested' ? 'none' : r.status]}</span></td>
                      <td className="todo" title={r.reading ? shortAction(r.cents, r.reading.spread, tolerance, lang) : ''}>{action(r)}</td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan="7" className="empty-row">{filter === 'work' ? U.allGood : U.none}</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="tech-note in">{U.technician}</p>
          </section>
        </>
      )}
    </div>
  );
}

export default memo(Report);
