import { status, REED_BANKS } from '../lib/dsp.js';
import { direction, fmtCents, fmtHz } from '../lib/format.js';
import Meter from './Meter.jsx';
import Strobe from './Strobe.jsx';
import Swara from './Swara.jsx';

export default function Readout({ live, bank, notice, keyByMidi, tolerance, centsRef }) {
  const note = live.kind === 'note' ? live : null;
  const k = note ? keyByMidi.get(note.midi) : null;
  const st = note ? status(note.cents, tolerance) : null;

  let western = 'Play a key';
  let chip = { cls: 'chip', text: live.label };
  if (note) {
    western = k?.name;
    chip = { cls: 'chip ' + st, text: direction(note.cents, tolerance) + (note.steady ? ' · steady' : '') };
  } else if (live.kind === 'out') {
    western = 'Outside keyboard';
    chip = { cls: 'chip', text: 'No matching key' };
  }

  return (
    <section className="panel readout" aria-label="Live reading">
      <div className="note-row">
        <div className="note">
          <Swara k={k} />
          <div className="western">{western}</div>
        </div>
        <div className="cents">
          <div className="value" style={{ color: st ? `var(--${st})` : undefined }}>
            {note ? fmtCents(note.cents) : live.kind === 'out' ? '—' : '±0.0¢'}
          </div>
          <span className={chip.cls} id="live-status">{chip.text}</span>
        </div>
      </div>

      <Strobe centsRef={centsRef} tolerance={tolerance} />
      <p className="strobe-hint">Strobe: bands drift right when sharp, left when flat, and stand still when in tune.</p>
      <Meter cents={note?.cents} tolerance={tolerance} />

      <div className="stats">
        <Stat label="Measured" value={note || live.kind === 'out' ? fmtHz(live.freq) + ' Hz' : '— Hz'} />
        <Stat label="Target" value={note ? fmtHz(note.target) + ' Hz' : '— Hz'} />
        <Stat label="Beat rate" value={note ? Math.abs(note.freq - note.target).toFixed(2) + ' Hz' : '—'} />
        <Stat label="Steadiness" value={note ? '±' + note.spread.toFixed(1) + '¢' : '—'} />
      </div>
      {note && note.octaveOffset === 0 && <LiveHint note={note} k={k} bank={bank} tolerance={tolerance} />}
      {notice && <div className="notice" role="status">{notice}</div>}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}

/** What the current sound means for the reed, in one line. */
function LiveHint({ note, k, bank, tolerance }) {
  const a = Math.abs(note.cents);
  let text;
  if (a <= tolerance) text = `${k?.name} is in tune on the ${REED_BANKS[bank].label} reed. No work needed.`;
  else if (note.cents > 0) text = `${k?.name} is ${a.toFixed(1)}¢ sharp: to lower it, remove metal near the root of the reed tongue.`;
  else text = `${k?.name} is ${a.toFixed(1)}¢ flat: clean the tongue, then remove metal at the free tip to raise it.`;
  if (!note.steady) text += ' Hold the key steady to save this reading.';
  return <p className={'live-hint tone-' + status(note.cents, tolerance)}>{text}</p>;
}
