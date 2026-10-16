import { useI18n } from '../i18n/I18n.jsx';
import { pagePath } from '../i18n/messages.js';
import { Brand } from './Nav.jsx';
import { IconCheck, IconChevron, IconKeys, IconList, IconMusic, IconPlay, IconSliders, IconTune } from './Icons.jsx';

/**
 * The start screen: a "get started" checklist until the first reed and the first alankar are done,
 * then a summary of the reeds; big doors into each section; and two quick sounds.
 */
export default function Home({ phone, onView, onPractise, onSettings, steps, reeds, drone, onDrone, onHearSa, saHz, saName, bank }) {
  const { m, lang } = useI18n();
  const H = m.ui.home;
  const done = steps.filter((s) => s.done).length;
  const go = (view, fn) => ({
    href: pagePath(lang, view),
    onClick: (e) => { e.preventDefault(); (fn ?? (() => onView(view)))(); },
  });

  const checklist = done < steps.length ? (
    <section className="card gs" aria-labelledby="gs-title">
      <div className="gs-head">
        <h2 id="gs-title">{H.started}</h2>
        <span>{H.doneCount({ n: done, total: steps.length })}</span>
      </div>
      <div className="bar-track"><div style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="gs-steps">
        {steps.map((s, i) => {
          const next = !s.done && steps.slice(0, i).every((x) => x.done || x.id === 'setup');
          const body = (
            <>
              <span className={'gs-n' + (s.done ? ' done' : next ? ' next' : '')}>{s.done ? <IconCheck /> : i + 1}</span>
              <span className="gs-text">
                <span className="gs-t">{s.title}</span>
                {s.sub && !s.done && <span className="gs-s">{s.sub}</span>}
              </span>
              {!s.done && phone && <IconChevron />}
            </>
          );
          return (
            <li key={s.id} className={(s.done ? 'done' : '') + (next ? ' next' : '')}>
              {s.done ? <div className="gs-row">{body}</div> : <a className="gs-row" {...go(s.view, s.go)}>{body}</a>}
            </li>
          );
        })}
      </ol>
    </section>
  ) : (
    <section className="card gs" aria-labelledby="gs-title">
      <div className="gs-head">
        <h2 id="gs-title">{H.reedsTitle}</h2>
        <a className="text-link" {...go('report')}>{H.openReport}</a>
      </div>
      <p className="gs-status">{H.reedsStatus({ good: reeds.good, total: reeds.total })}</p>
      <div className="bar-track"><div style={{ width: `${(reeds.good / reeds.total) * 100}%` }} /></div>
    </section>
  );

  const quick = (
    <section className={phone ? 'quick' : 'card quick'} aria-labelledby="qs-title">
      <h2 id="qs-title">{H.quick}</h2>
      <div className="quick-row">
        <button type="button" className="quick-btn" aria-pressed={drone} onClick={onDrone}>
          <span className="quick-icon"><IconPlay size={14} /></span>
          <span className="quick-text"><span>{H.tanpura}</span><small>{H.tanpuraSub}</small></span>
        </button>
        <button type="button" className="quick-btn" onClick={onHearSa}>
          <span className="quick-icon sw">सा</span>
          <span className="quick-text"><span>{H.hearSa}</span><small>{saName} · {saHz.toFixed(1)} Hz</small></span>
        </button>
      </div>
    </section>
  );

  if (phone) {
    return (
      <div className="screen home">
        <header className="ph-head">
          <div className="ph-title">
            <span className="wordmark">{m.ui.brand}</span>
            <span className="ph-sub">{m.ui.harmonium.summary({ sa: saName.replace(/\d/, ''), bank: m.bank[bank] })}</span>
          </div>
          <button type="button" className="icon-btn lg" aria-label={m.ui.common.settings} onClick={onSettings}><IconSliders /></button>
        </header>
        {checklist}
        <div className="doors two">
          <a className="door dark" {...go('tune')}>
            <span className="door-icon"><IconTune size={22} /></span>
            <span><span className="door-t">{m.ui.nav.tune}</span><span className="door-s">{H.tuneSub}</span></span>
          </a>
          <a className="door accent" {...go('riyaz')}>
            <span className="door-icon"><IconMusic size={22} /></span>
            <span><span className="door-t">{m.ui.nav.riyaz}</span><span className="door-s">{H.riyazSub}</span></span>
          </a>
        </div>
        {quick}
      </div>
    );
  }

  return (
    <div className="screen home desk">
      <header className="dk-head">
        <h1>{H.title}</h1>
        <p>{H.sub}</p>
      </header>
      <div className="home-top">
        {checklist}
        {quick}
      </div>
      <div className="doors four">
        <a className="door dark" {...go('tune')}>
          <span className="door-icon"><IconTune size={24} /></span>
          <span><span className="door-t">{m.ui.nav.tune}</span><span className="door-s">{H.tuneSubLong}</span></span>
        </a>
        <a className="door cream" {...go('play')}>
          <span className="door-icon"><IconKeys size={24} /></span>
          <span><span className="door-t">{m.ui.nav.play}</span><span className="door-s">{H.playSubLong}</span></span>
        </a>
        <a className="door accent" {...go('riyaz', onPractise)}>
          <span className="door-icon"><IconMusic size={24} /></span>
          <span><span className="door-t">{m.ui.nav.riyaz}</span><span className="door-s">{H.riyazSubLong}</span></span>
        </a>
        <a className="door light" {...go('report')}>
          <span className="door-icon"><IconList size={24} /></span>
          <span><span className="door-t">{m.ui.nav.report}</span><span className="door-s">{H.reportSubLong}</span></span>
        </a>
      </div>
    </div>
  );
}
