import { REED_BANKS } from '../lib/dsp.js';
import { BANKS } from '../lib/format.js';

const MODES = [
  { id: 'auto', label: 'Find automatically' },
  { id: 'locked', label: 'Lock selected key' },
];

export default function Controls({
  listening, onToggleListening, bank, onBank, mode, onMode, autoSave, onAutoSave, onSaveNow, onPlayTarget,
}) {
  return (
    <section className="panel controls" aria-label="Controls">
      <button className={'primary' + (listening ? ' listening' : '')} id="listen" type="button" onClick={onToggleListening}>
        {listening ? 'Stop listening' : 'Start listening'}
      </button>

      <div className="seg-row">
        <span className="label">Reed bank being tested</span>
        <div className="seg" role="group" aria-label="Reed bank">
          {BANKS.map((b) => (
            <button key={b} type="button" aria-pressed={bank === b} onClick={() => onBank(b)}>
              {REED_BANKS[b].label}
            </button>
          ))}
        </div>
      </div>

      <div className="seg-row">
        <span className="label">Key</span>
        <div className="seg" role="group" aria-label="Key selection mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button className="ghost accent" type="button" onClick={onSaveNow}>Save this reading</button>
        <button className="ghost" type="button" onClick={onPlayTarget}>Play target tone</button>
        <label className="ghost check" htmlFor="auto-save">
          <input type="checkbox" id="auto-save" checked={autoSave} onChange={(e) => onAutoSave(e.target.checked)} />
          Auto-save steady notes
        </label>
      </div>
    </section>
  );
}
