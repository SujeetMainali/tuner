import { memo } from 'react';
import { keyTarget, REED_BANKS } from '../lib/dsp.js';
import { STATUS_TEXT, fmtCents, fmtHz, keyStatus, shortAction } from '../lib/format.js';
import { reportCsv, reportTsv } from '../lib/report.js';

/** All keys on the current reed bank, with a summary and export. */
function Report({ keys, readings, bank, tuning, tolerance, selectedMidi, onSelect, onToast }) {
  const rows = keys.map((k) => ({ k, ...keyStatus(readings, bank, k.midi, tuning, tolerance), target: keyTarget(k.midi, bank, tuning) }));
  const tested = rows.filter((r) => r.reading);
  const good = tested.filter((r) => r.status === 'good').length;
  const avg = tested.length ? tested.reduce((a, r) => a + Math.abs(r.cents), 0) / tested.length : null;

  const exportCsv = () => {
    const blob = new Blob([reportCsv(keys, readings, bank, tuning, tolerance)], { type: 'text/csv' });
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
      await navigator.clipboard.writeText(reportTsv(keys, readings, bank, tuning, tolerance));
      onToast('Report copied');
    } catch {
      onToast('Copy is blocked here. Use Export CSV instead.');
    }
  };

  return (
    <section className="panel report" aria-label="Tuning report">
      <div className="kb-head">
        <h2>Tuning report · {REED_BANKS[bank].label} reeds</h2>
        <div className="btn-row">
          <button className="ghost" type="button" onClick={copy}>Copy</button>
          <button className="ghost" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <div className="summary">
        <Sum label="Tested" value={`${tested.length} / ${rows.length}`} />
        <Sum label="In tune" value={good} />
        <Sum label="Needs work" value={tested.length - good} />
        <Sum label="Average error" value={avg == null ? '—' : avg.toFixed(1) + '¢'} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Key</th><th>Swara</th><th className="r">Target Hz</th><th className="r">Measured Hz</th>
              <th className="r">Cents</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ k, reading, cents, status, target }) => (
              <tr key={k.midi} className={k.midi === selectedMidi ? 'sel' : ''} onClick={() => onSelect(k.midi)}>
                <td className="num">{k.name}</td>
                <td><span className="sw">{k.swara}</span></td>
                <td className="r num">{fmtHz(target)}</td>
                <td className="r num">{reading ? fmtHz(reading.freq) : '—'}</td>
                <td className="r num">{reading ? fmtCents(cents) : '—'}</td>
                <td className={'status-' + status}>{STATUS_TEXT[status]}</td>
                <td className="num action">{reading ? shortAction(cents, reading.spread, tolerance) : 'Measure'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Sum({ label, value }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

export default memo(Report);
