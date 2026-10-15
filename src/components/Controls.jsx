import { BANKS } from '../lib/format.js';
import { useI18n } from '../i18n/I18n.jsx';

/** The toolbar under the app bar: listening, what is being measured, and saving. */
export default function Controls({
  listening, onToggleListening, bank, onBank, mode, onMode, autoSave, onAutoSave, onSaveNow, onPlayTarget,
}) {
  const { m } = useI18n();
  const c = m.controls;
  const modes = [{ id: 'auto', label: c.auto }, { id: 'locked', label: c.lock }];
  return (
    <div className="toolbar" aria-label={c.region} role="region">
      <div className="wrap toolbar-in">
        <button className={'btn primary' + (listening ? ' listening' : '')} id="listen" type="button" onClick={onToggleListening}>
          {listening ? (
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
          )}
          {listening ? c.stop : c.start}
        </button>

        <div className="field-inline">
          <span className="field-label" id="bank-label">{c.bank}</span>
          <div className="seg" role="group" aria-labelledby="bank-label">
            {BANKS.map((b) => (
              <button key={b} type="button" aria-pressed={bank === b} onClick={() => onBank(b)}>
                {m.bank[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="field-inline">
          <span className="field-label" id="mode-label">{c.key}</span>
          <div className="seg" role="group" aria-labelledby="mode-label">
            {modes.map((x) => (
              <button key={x.id} type="button" aria-pressed={mode === x.id} onClick={() => onMode(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-end">
          <button className="btn" type="button" onClick={onSaveNow}>{c.save}</button>
          <button className="btn" type="button" onClick={onPlayTarget}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
            {c.playTarget}
          </button>
          <label className="btn check" htmlFor="auto-save">
            <input type="checkbox" id="auto-save" checked={autoSave} onChange={(e) => onAutoSave(e.target.checked)} />
            {c.autoSave}
          </label>
        </div>
      </div>
    </div>
  );
}
