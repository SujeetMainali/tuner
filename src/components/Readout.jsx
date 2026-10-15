import { status } from '../lib/dsp.js';
import { direction, fmtCents, fmtHz, saptakName, swaraName } from '../lib/format.js';
import { useI18n } from '../i18n/I18n.jsx';
import Meter from './Meter.jsx';
import Strobe from './Strobe.jsx';
import Swara from './Swara.jsx';

/** A tuner label or notice ({ id, params }) in the current language. */
function tunerText(m, n) {
  const v = m.tuner[n.id];
  if (typeof v !== 'function') return v ?? n.id;
  const p = n.params || {};
  return v({ ...p, bank: p.bank && m.bank[p.bank] });
}

export default function Readout({ live, bank, mode, notice, keyByMidi, keyCount, tolerance, centsRef }) {
  const { m, lang } = useI18n();
  const L = m.live;
  const note = live.kind === 'note' ? live : null;
  const k = note ? keyByMidi.get(note.midi) : null;
  const st = note ? status(note.cents, tolerance) : null;
  const idleText = live.kind === 'idle' ? tunerText(m, { id: live.label }) : '';

  let western = L.playKey;
  let sub = idleText;
  let chip = { cls: 'chip', text: idleText };
  if (note) {
    western = k?.name;
    sub = `${saptakName(k?.saptak, lang)} · ${swaraName(k, lang)} · ${L.keyOf({ n: k.index + 1, total: keyCount })}`;
    chip = { cls: 'chip ' + st, text: direction(note.cents, tolerance, lang) + (note.steady ? ' · ' + L.steady : '') };
  } else if (live.kind === 'out') {
    western = L.outside;
    sub = L.noMatch;
    chip = { cls: 'chip', text: L.noMatch };
  }

  return (
    <section className="card readout" id="live" aria-label={L.title}>
      <div className="card-head">
        <h2>{L.title}</h2>
        <span className="meta">{L.meta({ bank: m.bank[bank], locked: mode === 'locked' })}</span>
      </div>
      <div className="card-body readout-body">
        <div className="note-row">
          <div className="note">
            <Swara k={k} />
            <div>
              <div className="western">{western}</div>
              <div className="note-sub">{sub}</div>
            </div>
          </div>
          <div className="cents">
            <div className="value" style={{ color: st ? `var(--${st})` : undefined }}>
              {note ? fmtCents(note.cents) : live.kind === 'out' ? '—' : '±0.0¢'}
            </div>
            <span className={chip.cls} id="live-status">{chip.text}</span>
          </div>
        </div>

        <Meter cents={note?.cents} tolerance={tolerance} />

        <div>
          <Strobe centsRef={centsRef} tolerance={tolerance} />
          <p className="hint">{L.strobeHint}</p>
        </div>

        <dl className="stats">
          <Stat label={L.measured} value={note || live.kind === 'out' ? fmtHz(live.freq) + ' Hz' : '— Hz'} />
          <Stat label={L.target} value={note ? fmtHz(note.target) + ' Hz' : '— Hz'} />
          <Stat label={L.beat} value={note ? Math.abs(note.freq - note.target).toFixed(2) + ' Hz' : '—'} />
          <Stat label={L.steadiness} value={note ? '±' + note.spread.toFixed(1) + '¢' : '—'} />
        </dl>
        {note && note.octaveOffset === 0 && <LiveHint note={note} k={k} bank={bank} tolerance={tolerance} />}
        {notice && <div className="notice" role="status">{tunerText(m, notice)}</div>}
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}

/** What the current sound means for the reed, in one line. */
function LiveHint({ note, k, bank, tolerance }) {
  const { m } = useI18n();
  const L = m.live;
  const a = Math.abs(note.cents);
  let text;
  if (a <= tolerance) text = L.hintGood({ key: k?.name, bank: m.bank[bank] });
  else if (note.cents > 0) text = L.hintSharp({ key: k?.name, a: a.toFixed(1) });
  else text = L.hintFlat({ key: k?.name, a: a.toFixed(1) });
  if (!note.steady) text += L.hintHold;
  return (
    <div className={'live-hint tone-' + status(note.cents, tolerance)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
      <p>{text}</p>
    </div>
  );
}
