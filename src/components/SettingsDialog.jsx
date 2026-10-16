import { useEffect, useRef, useState } from 'react';
import { WESTERN, noteName } from '../lib/dsp.js';
import { LANGUAGES } from '../i18n/messages.js';
import { useI18n } from '../i18n/I18n.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import { IconClose } from './Icons.jsx';

const LOWEST_OPTIONS = Array.from({ length: 25 }, (_, i) => 36 + i); // C2..C4
const THEMES = ['system', 'light', 'white', 'dark'];

function clampNum(value, lo, hi, fallback) {
  const v = parseFloat(value);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/**
 * Appearance (theme, language) applies as soon as it is picked; instrument settings apply on Save.
 */
export default function SettingsDialog({ open, settings, theme, onTheme, lang, onLang, onSave, onClose, onClearAll }) {
  const { m } = useI18n();
  const S = m.settings;
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
    <dialog ref={dialog} onClose={onClose} aria-labelledby="settings-title"
      onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
      <form className="dlg" onSubmit={submit}>
        <div className="dlg-head">
          <h2 id="settings-title" className="dlg-title">{S.title}</h2>
          <button type="button" className="icon-btn" aria-label={m.ui.common.close} onClick={onClose}><IconClose /></button>
        </div>

        <div className="dlg-group" role="group" aria-labelledby="grp-look">
          <div className="label" id="grp-look">{S.appearance}</div>
          <div className="field">
            <span className="field-name" id="theme-label">{S.theme}</span>
            <div className="seg seg-full" role="group" aria-labelledby="theme-label">
              {THEMES.map((t) => (
                <button key={t} type="button" aria-pressed={theme === t} onClick={() => onTheme(t)}>
                  <span className={'swatch swatch-' + t} aria-hidden="true" />{S.themes[t]}
                </button>
              ))}
            </div>
            <small>{S.themeHelp}</small>
          </div>
          <div className="field">
            <span className="field-name" id="lang-label">{S.language}</span>
            <div className="seg seg-full" role="group" aria-labelledby="lang-label">
              {LANGUAGES.map((l) => (
                <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => onLang(l.id)}>{l.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="dlg-group" role="group" aria-labelledby="grp-inst">
          <div className="label" id="grp-inst">{S.instrument}</div>
          <div className="field">
            <label htmlFor="set-a4">{S.a4}</label>
            <input id="set-a4" type="number" inputMode="decimal" min="415" max="466" step="0.1" value={form.a4} onChange={set('a4')} />
            <small>{S.a4Help}</small>
          </div>
          <div className="field">
            <label htmlFor="set-system">{S.system}</label>
            <select id="set-system" value={form.system} onChange={set('system')}>
              <option value="equal">{S.equalOpt}</option>
              <option value="just">{S.justOpt}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="set-sa">{S.sa}</label>
            <select id="set-sa" value={form.saPc} onChange={set('saPc')}>
              {WESTERN.map((n, i) => <option key={n} value={i}>{n}</option>)}
            </select>
            <small>{S.saHelp}</small>
          </div>
          <div className="field">
            <label htmlFor="set-low">{S.low}</label>
            <select id="set-low" value={form.lowestMidi} onChange={set('lowestMidi')}>
              {LOWEST_OPTIONS.map((x) => <option key={x} value={x}>{noteName(x)}</option>)}
            </select>
            <small>{S.lowHelp}</small>
          </div>
          <div className="field">
            <label htmlFor="set-count">{S.count}</label>
            <input id="set-count" type="number" inputMode="numeric" min="12" max="61" step="1" value={form.keyCount} onChange={set('keyCount')} />
          </div>
          <div className="field">
            <label htmlFor="set-tol">{S.tol}</label>
            <input id="set-tol" type="number" inputMode="decimal" min="0.5" max="15" step="0.5" value={form.tolerance} onChange={set('tolerance')} />
            <small>{S.tolHelp}</small>
          </div>
        </div>

        <div className="dlg-actions">
          <ConfirmButton className="btn-danger" label={S.clearAll} confirmLabel={S.clearAllConfirm} onConfirm={onClearAll} />
          <div className="btn-row">
            <button className="btn-secondary" type="button" onClick={onClose}>{S.cancel}</button>
            <button className="btn-primary" type="submit">{S.save}</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
