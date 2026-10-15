import { useEffect, useRef, useState } from 'react';
import { WESTERN, noteName } from '../lib/dsp.js';
import ConfirmButton from './ConfirmButton.jsx';

const LOWEST_OPTIONS = Array.from({ length: 25 }, (_, i) => 36 + i); // C2..C4

function clampNum(value, lo, hi, fallback) {
  const v = parseFloat(value);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

export default function SettingsDialog({ open, settings, onSave, onClose, onClearAll }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(settings);

  useEffect(() => {
    const d = dialog.current;
    if (open && !d.open) {
      setForm(settings);
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, settings]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      a4: clampNum(form.a4, 415, 466, 440),
      system: form.system === 'just' ? 'just' : 'equal',
      saPc: parseInt(form.saPc, 10) || 0,
      lowestMidi: parseInt(form.lowestMidi, 10) || 48,
      keyCount: Math.round(clampNum(form.keyCount, 12, 61, 42)),
      tolerance: clampNum(form.tolerance, 0.5, 15, 3),
    });
  };

  return (
    <dialog ref={dialog} onClose={onClose}>
      <form className="dlg" onSubmit={submit}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Instrument settings</h2>
        <div className="field">
          <label htmlFor="set-a4">Concert pitch A4 (Hz)</label>
          <input id="set-a4" type="number" inputMode="decimal" min="415" max="466" step="0.1" value={form.a4} onChange={set('a4')} />
          <small>Most Indian harmoniums today are tuned to A4 = 440 Hz.</small>
        </div>
        <div className="field">
          <label htmlFor="set-system">Tuning system</label>
          <select id="set-system" value={form.system} onChange={set('system')}>
            <option value="equal">Equal temperament (factory standard)</option>
            <option value="just">Just intonation from Sa (shuddha ratios)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="set-sa">Sa is on key</label>
          <select id="set-sa" value={form.saPc} onChange={set('saPc')}>
            {WESTERN.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          <small>Sets the swara names and, for just intonation, the ratios.</small>
        </div>
        <div className="field">
          <label htmlFor="set-low">Lowest key (Male reed pitch)</label>
          <select id="set-low" value={form.lowestMidi} onChange={set('lowestMidi')}>
            {LOWEST_OPTIONS.map((m) => <option key={m} value={m}>{noteName(m)}</option>)}
          </select>
          <small>The Bina 17 has 42 keys from C to F. Play the leftmost key on the Male stop to confirm its octave.</small>
        </div>
        <div className="field">
          <label htmlFor="set-count">Number of keys</label>
          <input id="set-count" type="number" inputMode="numeric" min="12" max="61" step="1" value={form.keyCount} onChange={set('keyCount')} />
        </div>
        <div className="field">
          <label htmlFor="set-tol">In-tune tolerance (± cents)</label>
          <input id="set-tol" type="number" inputMode="decimal" min="0.5" max="15" step="0.5" value={form.tolerance} onChange={set('tolerance')} />
          <small>3 cents is a careful professional standard. Keys within 3× this show as close.</small>
        </div>
        <div className="dlg-actions">
          <ConfirmButton className="ghost danger" label="Clear all readings" confirmLabel="Tap again to clear everything" onConfirm={onClearAll} />
          <div className="btn-row">
            <button className="ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="ghost accent" type="submit">Save</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
