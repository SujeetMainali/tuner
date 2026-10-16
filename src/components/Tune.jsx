import { useEffect, useRef } from 'react';
import { keyTarget, status as statusOf } from '../lib/dsp.js';
import { BANKS, fmtCents, fmtHz, keyStatus, readingCents, swaraName } from '../lib/format.js';
import { keyInstructions } from '../lib/instructions.js';
import { pagePath } from '../i18n/messages.js';
import { useI18n } from '../i18n/I18n.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import Keys, { revealKey } from './Keys.jsx';
import Sheet from './Sheet.jsx';
import { IconCheck, IconClose, IconDown, IconInfo, IconSpeaker, IconUp } from './Icons.jsx';

/** "+14¢" for big errors, "+2.4¢" for small ones. */
export function centsText(c) {
  if (c == null || Number.isNaN(c)) return '—';
  const a = Math.abs(c);
  const sign = c > 0.05 ? '+' : c < -0.05 ? '−' : '±';
  return sign + (a >= 10 ? Math.round(a) : a.toFixed(1));
}

/** A tuner label or notice ({ id, params }) in the current language. */
function tunerText(m, n) {
  const v = m.tuner[n.id];
  if (typeof v !== 'function') return v ?? n.id;
  const p = n.params || {};
  return v({ ...p, bank: p.bank && m.bank[p.bank] });
}

/**
 * Tune: the live reading of the reed being played, what to do about it, and every key of the
 * chosen reed bank with its status.
 */
export default function Tune({
  phone, tuner, keys, keyByMidi, bank, onBank, mode, onAuto, readings, tuning, tolerance, selected,
  onSelect, onStep, onSave, onHear, onCompare, onClear, tipShown, onDismissTip, onHelp, onView,
  details, onDetails,
}) {
  const { m, lang } = useI18n();
  const T = m.ui.tune;
  const { live, listening } = tuner;
  const note = live.kind === 'note' ? live : null;
  const k = (note && keyByMidi.get(note.midi)) || selected;
  const cents = note ? note.cents : null;
  const st = note ? statusOf(note.cents, tolerance) : null;
  const saved = keyStatus(readings, bank, k.midi, tuning, tolerance);
  const ins = keyInstructions({ k, bank, readings, tuning, tolerance, keys, lang });
  const checked = keys.filter((x) => readings[bank]?.[x.midi]?.length).length;
  const target = keyTarget(k.midi, bank, tuning);

  // What to do, from the live sound when there is one, else from the key's last saved reading.
  const basis = note && note.octaveOffset === 0 ? { c: note.cents, steady: note.steady } : saved.reading ? { c: saved.cents, steady: true } : null;
  let advice;
  if (!basis) advice = { tone: 'info', title: ins.headline, body: ins.steps[0], Icon: IconInfo };
  else if (!basis.steady) advice = { tone: 'info', title: T.holdTitle, body: T.holdBody, Icon: IconInfo };
  else if (Math.abs(basis.c) <= tolerance) advice = { tone: 'good', title: T.goodTitle, body: T.goodBody, Icon: IconCheck };
  else if (basis.c > 0) advice = { tone: 'warn', title: T.lowerTitle, body: T.lowerBody, step: T.lowerStep, Icon: IconDown };
  else advice = { tone: 'warn', title: T.raiseTitle, body: T.raiseBody, step: T.raiseStep, Icon: IconUp };
  const trend = (readings[bank]?.[k.midi]?.length ?? 0) >= 2 ? ins.notes.find((n) => n) : null;

  // Desktop shortcuts: Space saves, ←/→ change key.
  const keysRef = useRef();
  keysRef.current = { onSave, onStep };
  useEffect(() => {
    if (phone) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea, button, a, dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); keysRef.current.onSave(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); keysRef.current.onStep(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); keysRef.current.onStep(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone]);

  const bankSeg = (
    <div className="seg" role="group" aria-label={m.controls.bank}>
      {BANKS.map((b) => <button key={b} type="button" aria-pressed={bank === b} onClick={() => onBank(b)}>{m.bank[b]}</button>)}
    </div>
  );

  const pill = !listening
    ? <span className="pill off">{T.notListening}</span>
    : live.kind === 'idle' && live.label === 'paused'
      ? <span className="pill off">{T.paused}</span>
      : <span className="pill on"><span className="pill-dot" />{note && !phone ? `${T.hearing(k.name)} · ${note.steady ? T.steady : T.settling}` : T.listening}</span>;

  const centsBlock = (
    <div className={'rd-cents tone-' + (st ?? 'none')}>
      <span className="rd-c">{note ? centsText(cents) : '—'}{note && <span className="rd-u">¢</span>}</span>
      <span className="rd-dir">{note ? m.direction[st === 'good' ? 'inTune' : cents > 0 ? 'sharp' : 'flat'] : ' '}</span>
    </div>
  );

  const meter = <Meter cents={cents} tolerance={tolerance} status={st} />;

  const notice = tuner.notice && <p className="notice" role="status">{tunerText(m, tuner.notice)}</p>;

  const lockChip = mode === 'locked' && (
    <div className="lock-chip">
      <span>{T.locked(k.name)}</span>
      <button type="button" onClick={onAuto}>{T.auto}</button>
    </div>
  );

  const adviceCard = (
    <section className={'advice tone-' + advice.tone} aria-label={advice.title}>
      {phone && <span className="advice-icon"><advice.Icon /></span>}
      <div className="advice-text">
        <h2>{advice.title}</h2>
        {phone || advice.tone !== 'warn'
          ? <p>{advice.body}</p>
          : (
            <ol>
              <li>{advice.step}</li>
              <li>{T.stepLittle}</li>
              <li>{T.stepSave(tolerance)}</li>
            </ol>
          )}
        {!phone && trend && <p className="advice-trend">{trend}</p>}
      </div>
    </section>
  );

  const actions = (
    <div className="tune-actions">
      <button type="button" className="btn-primary" onClick={onSave}>{T.save}</button>
      <button type="button" className="btn-secondary" onClick={() => onHear(bank)}><IconSpeaker />{T.hear}</button>
    </div>
  );

  const keyState = (x) => {
    const s = keyStatus(readings, bank, x.midi, tuning, tolerance).status;
    return { tone: x.midi === k.midi ? 'sel' : null, dot: s === 'untested' ? 'untested' : s };
  };
  const ariaFor = (x) => `${x.name}, ${swaraName(x, lang)}, ${m.status[keyStatus(readings, bank, x.midi, tuning, tolerance).status]}`;

  const detailsSheet = (
    <KeyDetails open={details} onClose={() => onDetails(false)} k={k} keys={keys} readings={readings} bank={bank} tuning={tuning}
      tolerance={tolerance} ins={ins} onHear={onHear} onCompare={onCompare} onClear={onClear} onStep={onStep} />
  );

  if (phone) {
    return (
      <div className="screen tune">
        <header className="ph-head">
          <h1 className="ph-h1">{m.ui.nav.tune}</h1>
          {bankSeg}
          <button type="button" className="icon-btn lg q" aria-label={T.help} onClick={onHelp}>?</button>
        </header>
        {tipShown && (
          <div className="tip" role="note">
            <IconInfo />
            <span>{T.tip}</span>
            <button type="button" aria-label={m.ui.common.dismiss} onClick={onDismissTip}><IconClose /></button>
          </div>
        )}
        <section className="card readout" aria-label={m.live.title}>
          <div className="rd-top">
            {listening ? <button type="button" className="pill-btn" onClick={tuner.stop} aria-label={T.stop}>{pill}</button> : pill}
            <span className="rd-target">{T.target(fmtHz(target))}</span>
          </div>
          <div className="rd-main">
            <div className="rd-note">
              <span className="rd-sw">{k.swara}</span>
              <span className="rd-name">{swaraName(k, lang)} · {k.name}</span>
            </div>
            {centsBlock}
          </div>
          {meter}
          {!listening && (
            <div className="rd-idle">
              <p>{T.idle}</p>
              <button type="button" className="btn-primary" onClick={tuner.start}>{T.start}</button>
            </div>
          )}
        </section>
        {lockChip}
        {notice}
        {adviceCard}
        {actions}
        <section aria-label={T.keysAria} className="strip-sec">
          <div className="strip-head">
            <span>{T.checked({ bank: m.bank[bank], n: checked, total: keys.length })}</span>
            <button type="button" className="text-link" onClick={() => onDetails(true)}>{T.details}</button>
          </div>
          <KeyStrip keys={keys} current={k.midi} keyState={keyState} ariaFor={ariaFor} onSelect={onSelect} />
        </section>
        {detailsSheet}
      </div>
    );
  }

  return (
    <div className="screen tune desk">
      <header className="dk-head row">
        <div className="dk-head-t">
          <h1>{m.ui.nav.tune}</h1>
          <p>{T.intro}</p>
        </div>
        {bankSeg}
        <button type="button" className={listening ? 'btn-secondary listen on' : 'btn-primary listen'} onClick={listening ? tuner.stop : tuner.start}>
          <span className="listen-dot" />{listening ? T.stop : T.listen}
        </button>
        <button type="button" className="icon-btn lg q" aria-label={T.help} onClick={onHelp}>?</button>
      </header>
      <div className="tune-grid">
        <section className="card readout big" aria-label={m.live.title}>
          <div className="rd-top">
            {pill}
            <span className="rd-target">{T.reed(m.bank[bank])} · {T.target(fmtHz(target))}</span>
          </div>
          <div className="rd-main">
            <div className="rd-note">
              <span className="rd-sw">{k.swara}</span>
              <span className="rd-name-col"><span className="rd-sname">{swaraName(k, lang)}</span><span className="rd-kname">{k.name}</span></span>
            </div>
            {centsBlock}
          </div>
          {meter}
          <dl className="rd-stats">
            <div><dt>{m.live.measured}</dt><dd>{note ? fmtHz(note.freq) + ' Hz' : '—'}</dd></div>
            <div><dt>{m.live.target}</dt><dd>{fmtHz(target)} Hz</dd></div>
            <div><dt>{m.live.steadiness}</dt><dd>{note ? '±' + note.spread.toFixed(1) + '¢' : '—'}</dd></div>
            <div><dt>{T.lastSaved}</dt><dd>{saved.reading ? centsText(saved.cents) + '¢' : '—'}</dd></div>
          </dl>
          {!listening && <p className="rd-idle-text">{T.idle}</p>}
          {notice}
        </section>
        <div className="tune-side">
          {lockChip}
          {adviceCard}
          {actions}
          <p className="shortcut">{T.shortcut} <kbd>Space</kbd> {T.saves}, <kbd>←</kbd> <kbd>→</kbd> {T.changeKey}. <button type="button" className="text-link" onClick={() => onDetails(true)}>{T.details}</button></p>
        </div>
      </div>
      <section className="card kb-card" aria-labelledby="kb-title">
        <div className="kb-card-head">
          <h2 id="kb-title">{T.checked({ bank: m.bank[bank], n: checked, total: keys.length })}</h2>
          <Legend />
          <a className="text-link" href={pagePath(lang, 'report')} onClick={(e) => { e.preventDefault(); onView('report'); }}>{T.allKeys}</a>
        </div>
        <Keys keys={keys} keyState={keyState} mode="select" onPress={onSelect} reveal={k.midi} ariaFor={ariaFor} minKey={34} className="tune-keys" />
      </section>
      {detailsSheet}
    </div>
  );
}

export function Legend() {
  const { m } = useI18n();
  const L = m.ui.tune.legend;
  return (
    <ul className="legend">
      <li><span className="ldot good" />{L.good}</li>
      <li><span className="ldot near" />{L.near}</li>
      <li><span className="ldot off" />{L.off}</li>
      <li><span className="ldot untested" />{L.none}</li>
    </ul>
  );
}

/** The cents meter: −50…+50, the tolerance band in green, the needle in the status colour. */
function Meter({ cents, tolerance, status }) {
  const { m } = useI18n();
  const v = cents == null ? null : Math.max(-50, Math.min(50, cents));
  const band = Math.min(50, tolerance);
  return (
    <div className="meter" role="img" aria-label={cents == null ? m.live.playKey : `${centsText(cents)}¢`}>
      <div className="mt-track" />
      <div className="mt-band" style={{ left: 50 - band + '%', width: band * 2 + '%' }} />
      <div className="mt-zero" />
      {v != null && <div className={'mt-needle tone-' + status} style={{ left: 50 + v + '%' }} />}
      <div className="mt-scale"><span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span></div>
    </div>
  );
}

/** Phone: every key of the bank in one scrolling row, each with its status dot. */
function KeyStrip({ keys, current, keyState, ariaFor, onSelect }) {
  const sc = useRef(null);
  const els = useRef(new Map());
  useEffect(() => {
    const el = els.current.get(current);
    if (el && sc.current) revealKey(sc.current, el, false);
  }, [current]);
  return (
    <div className="kstrip" ref={sc}>
      {keys.map((x) => {
        const s = keyState(x);
        return (
          <button key={x.midi} ref={(el) => (el ? els.current.set(x.midi, el) : els.current.delete(x.midi))} type="button"
            className={'kstrip-key' + (s.tone === 'sel' ? ' sel' : '') + (x.black ? ' blk' : '')} aria-label={ariaFor(x)} aria-pressed={s.tone === 'sel'} onClick={() => onSelect(x.midi)}>
            <span className={'kdot ' + s.dot} />
            <span className="ksw">{x.swara}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Everything about one key: all three banks, the full instructions, saved readings, clearing. */
function KeyDetails({ open, onClose, k, keys, readings, bank, tuning, tolerance, ins, onHear, onCompare, onClear, onStep }) {
  const { m, lang } = useI18n();
  const S = m.sheet;
  const history = (readings[bank][k.midi] || []).slice().reverse();
  const current = keyStatus(readings, bank, k.midi, tuning, tolerance);
  return (
    <Sheet open={open} onClose={onClose} title={`${k.name} · ${swaraName(k, lang)}`} wide>
      <div className="kd-step">
        <button type="button" className="btn-secondary sm" onClick={() => onStep(-1)} disabled={k.index === 0}>‹ {S.prev}</button>
        <span>{m.live.keyOf({ n: k.index + 1, total: keys.length })}</span>
        <button type="button" className="btn-secondary sm" onClick={() => onStep(1)} disabled={k.index === keys.length - 1}>{S.next} ›</button>
      </div>
      <div className="table-box">
        <table className="tbl">
          <thead><tr><th>{S.bank}</th><th className="r">{S.ideal}</th><th className="r">{S.measured}</th><th className="r">{S.deviation}</th><th><span className="sr-only">{S.listen}</span></th></tr></thead>
          <tbody>
            {BANKS.map((b) => {
              const { reading: r, cents, status } = keyStatus(readings, b, k.midi, tuning, tolerance);
              return (
                <tr key={b} className={b === bank ? 'current' : ''}>
                  <td>{m.bank[b]}{b === bank && <span className="tag">{S.testing}</span>}</td>
                  <td className="r num">{fmtHz(keyTarget(k.midi, b, tuning))}</td>
                  <td className="r num">{r ? fmtHz(r.freq) : '—'}</td>
                  <td className={'r num status-' + status}>{r ? fmtCents(cents) : '—'}</td>
                  <td className="r"><button type="button" className="icon-btn sm" aria-label={S.hearAria({ key: k.name, bank: m.bank[b] })} onClick={() => onHear(b)}><IconSpeaker size={16} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="kd-row">
        <button type="button" className="btn-secondary" onClick={() => onCompare(bank)} disabled={!current.reading}>{S.compare}</button>
        <span className="hint">{current.reading ? S.compareHint : S.measureFirst}</span>
      </div>
      <div className={'kd-ins tone-' + ins.tone}>
        <h3>{ins.headline}</h3>
        {ins.steps.length > 1 ? <ol>{ins.steps.map((s) => <li key={s}>{s}</li>)}</ol> : <p>{ins.steps[0]}</p>}
        {ins.notes.length > 0 && <ul>{ins.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      </div>
      <div>
        <h3 className="kd-h">{S.saved(m.bank[bank])}</h3>
        <ul className="kd-history">
          {history.length ? history.map((h) => (
            <li key={h.at}>
              <span>{new Date(h.at).toLocaleString({ ne: 'ne-NP', hi: 'hi-IN' }[lang] ?? [], { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span className="num">{fmtHz(h.freq)} Hz · {fmtCents(readingCents(h, k.midi, bank, tuning))}</span>
            </li>
          )) : <li>{S.none}</li>}
        </ul>
      </div>
      <ConfirmButton className="btn-danger" label={S.clear} confirmLabel={S.clearConfirm} onConfirm={onClear} />
    </Sheet>
  );
}
