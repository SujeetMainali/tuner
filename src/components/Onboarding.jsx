import { useState } from 'react';
import { WESTERN } from '../lib/dsp.js';
import { BANKS } from '../lib/format.js';
import { LANGUAGES } from '../i18n/messages.js';
import { useI18n } from '../i18n/I18n.jsx';
import { Brand } from './Nav.jsx';
import { IconArrow, IconBack, IconCheck, IconClock, IconLock, IconMic, IconMusic, IconTune, IconWave } from './Icons.jsx';

// White and black keys of one octave from C, named the way harmonium players count them.
const KEY_NAMES = [['safed', 1], ['kali', 1], ['safed', 2], ['kali', 2], ['safed', 3], ['safed', 4], ['kali', 3], ['safed', 5], ['kali', 4], ['safed', 6], ['kali', 5], ['safed', 7]];
const PHONE_SA = [0, 1, 2, 3, 4, 5];
const pcName = (pc) => WESTERN[pc].replace('#', '♯');

/**
 * First-run setup. Phones get three short steps; desktops one card. `onFinish({ goal, saPc, stops,
 * bank, mic })` stores the choices; mic asks to start the microphone right away.
 */
export default function Onboarding({ phone, saPc, stops: initialStops, onLang, onFinish, onSkip }) {
  const { m, lang } = useI18n();
  const O = m.ui.onboard;
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState('tune');
  const [sa, setSa] = useState(saPc);
  const [stops, setStops] = useState(initialStops);

  const keyLabel = (pc) => O[KEY_NAMES[pc][0]](KEY_NAMES[pc][1]);
  const finish = (extra) => {
    const bank = stops.male ? 'male' : BANKS.find((b) => stops[b]) ?? 'male';
    onFinish({ goal, saPc: sa, stops: BANKS.some((b) => stops[b]) ? stops : { ...stops, male: true }, bank, ...extra });
  };
  const toggleStop = (b) => setStops((s) => ({ ...s, [b]: !s[b] }));

  const langCards = (
    <div className="ob-langs">
      {LANGUAGES.map((l) => (
        <label key={l.id} className="ob-lang" data-on={lang === l.id || undefined}>
          <input type="radio" name="ob-lang" value={l.id} checked={lang === l.id} onChange={() => onLang(l.id)} />
          <span className="ob-ring" aria-hidden="true"><span /></span>
          <span className="ob-lang-text">
            <span className="ob-lang-name" lang={l.id}>{l.label}</span>
            <span className="ob-lang-sub">{O.langSub[l.id]}</span>
          </span>
        </label>
      ))}
    </div>
  );

  const stopButtons = (cls) => BANKS.map((b) => (
    <button key={b} type="button" className={cls} aria-pressed={!!stops[b]} onClick={() => toggleStop(b)}>
      {cls === 'ob-stop' && <span className="ob-check" aria-hidden="true"><IconCheck size={12} /></span>}
      {m.bank[b]}
    </button>
  ));

  if (!phone) {
    return (
      <div className="ob-desk">
        <div className="ob-desk-in">
          <section className="ob-hero">
            <Brand size="lg" />
            <h1>{O.headline1}<br />{O.headline2}</h1>
            <p>{O.introDesktop}</p>
            <Swaras big />
            <ul className="ob-perks">
              {[O.perkOffline, O.perkAccount, O.perkLangs].map((t) => <li key={t}><span aria-hidden="true" />{t}</li>)}
            </ul>
          </section>
          <section className="ob-card" aria-labelledby="ob-setup">
            <h2 id="ob-setup">{O.deskTitle}</h2>
            <p className="ob-card-sub">{O.deskSub}</p>
            <ol className="ob-steps">
              <li>
                <span className="ob-n">1</span>
                <div>
                  <h3>{O.deskLang}</h3>
                  <div className="ob-chips three">
                    {LANGUAGES.map((l) => (
                      <button key={l.id} type="button" className="ob-chip" lang={l.id} aria-pressed={lang === l.id} onClick={() => onLang(l.id)}>{l.label}</button>
                    ))}
                  </div>
                </div>
              </li>
              <li>
                <span className="ob-n">2</span>
                <div>
                  <h3>{O.deskHarmonium}</h3>
                  <div className="ob-row">
                    <label className="ob-field">{O.deskSa}
                      <select value={sa} onChange={(e) => setSa(Number(e.target.value))}>
                        {WESTERN.map((_, pc) => (
                          <option key={pc} value={pc}>{pcName(pc)} · {keyLabel(pc)}{pc === 0 ? ` (${O.deskCommon})` : ''}</option>
                        ))}
                      </select>
                    </label>
                    <div className="ob-field">
                      <span>{O.deskStops}</span>
                      <div className="ob-chips">{stopButtons('ob-chip')}</div>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <span className="ob-n">3</span>
                <div>
                  <h3>{O.deskMic}</h3>
                  <p className="ob-text">{O.deskMicText}</p>
                </div>
              </li>
            </ol>
            <div className="ob-actions">
              <button type="button" className="btn-primary lg" onClick={() => { setGoal('tune'); onFinish({ ...pick(), goal: 'tune' }); }}>{O.startTune}</button>
              <button type="button" className="btn-secondary lg" onClick={() => onFinish({ ...pick(), goal: 'play' })}>{O.startPlay}</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  function pick() {
    const bank = stops.male ? 'male' : BANKS.find((b) => stops[b]) ?? 'male';
    return { saPc: sa, stops: BANKS.some((b) => stops[b]) ? stops : { ...stops, male: true }, bank };
  }

  const progress = (
    <div className="ob-top">
      <button type="button" className="ob-back" aria-label={m.ui.common.back} onClick={() => setStep(step - 1)}><IconBack /></button>
      <div className="ob-bar"><div style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
      <span className="ob-count">{step + 1}/3</span>
    </div>
  );

  return (
    <div className="ob-phone">
      {step === 0 && (
        <>
          <div className="ob-head">
            <Brand />
            <button type="button" className="ob-skip" onClick={onSkip}>{m.ui.common.skip}</button>
          </div>
          <Swaras />
          <h1 className="ob-h1">{O.headline1}<br />{O.headline2}</h1>
          <p className="ob-p">{O.intro}</p>
          <fieldset className="ob-fieldset">
            <legend>{O.chooseLang}</legend>
            {langCards}
          </fieldset>
          <div className="ob-fill" />
          <div className="ob-foot">
            <div className="ob-dots" aria-label={O.stepOf({ n: 1, total: 3 })}><span className="on" /><span /><span /></div>
            <button type="button" className="btn-primary xl" onClick={() => setStep(1)}>{m.ui.common.continue}<IconArrow /></button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          {progress}
          <h1 className="ob-h2">{O.setupTitle}</h1>
          <p className="ob-p sm">{O.setupIntro}</p>
          <section className="ob-sec">
            <h2>{O.goalQ}</h2>
            <div className="ob-goals">
              {[{ id: 'tune', Icon: IconTune, t: O.goalTune, s: O.goalTuneSub }, { id: 'play', Icon: IconMusic, t: O.goalPlay, s: O.goalPlaySub }].map(({ id, Icon, t, s }) => (
                <button key={id} type="button" className="ob-goal" aria-pressed={goal === id} onClick={() => setGoal(id)}>
                  <span className="ob-goal-icon"><Icon size={22} /></span>
                  <span className="ob-goal-t">{t}</span>
                  <span className="ob-goal-s">{s}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="ob-sec">
            <div className="ob-sec-head"><h2>{O.saQ}</h2><span>{O.saIs(pcName(sa))}</span></div>
            <div className="ob-keys">
              {PHONE_SA.map((pc) => (
                <button key={pc} type="button" className="ob-key" aria-pressed={sa === pc} onClick={() => setSa(pc)}>
                  <span className="ob-key-n">{pcName(pc)}</span>
                  <span className="ob-key-s">{keyLabel(pc)}</span>
                </button>
              ))}
            </div>
            <p className="ob-hint">{O.saHint}</p>
          </section>
          <section className="ob-sec">
            <h2 className="tight">{O.reedsQ}</h2>
            <p className="ob-hint top">{O.reedsHint}</p>
            <div className="ob-stops">{stopButtons('ob-stop')}</div>
          </section>
          <div className="ob-fill" />
          <div className="ob-foot">
            <button type="button" className="btn-primary xl" onClick={() => setStep(2)}>{m.ui.common.continue}<IconArrow /></button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          {progress}
          <div className="ob-mic-art" aria-hidden="true">
            <span className="r1" /><span className="r2" />
            <span className="ob-mic"><IconMic size={38} /></span>
            <span className="ob-float sw">ग</span>
            <span className="ob-float ct">±2¢</span>
          </div>
          <h1 className="ob-h2 center">{O.micTitle1}<br />{O.micTitle2}</h1>
          <ul className="ob-points">
            <li><span className="ob-pt-icon"><IconLock /></span><span><strong>{O.micPrivate}</strong> <span>{O.micPrivateSub}</span></span></li>
            <li><span className="ob-pt-icon"><IconClock /></span><span><strong>{O.micWhen}</strong> <span>{O.micWhenSub}</span></span></li>
            <li><span className="ob-pt-icon"><IconWave /></span><span><strong>{O.micRoom}</strong> <span>{O.micRoomSub}</span></span></li>
          </ul>
          <div className="ob-fill" />
          <div className="ob-foot">
            <button type="button" className="btn-primary xl" onClick={() => finish({ mic: true })}>{O.allowMic}</button>
            <button type="button" className="btn-ghost" onClick={() => finish({ mic: false, goal: goal === 'tune' ? 'home' : goal })}>{O.notNow}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The row of swara keys on the welcome screen. */
function Swaras({ big = false }) {
  const sw = big ? ['सा', 'रे', 'ग', 'म', 'प', 'ध', 'नि', 'सां'] : ['सा', 'रे', 'ग', 'म', 'प', 'ध', 'नि'];
  return (
    <div className={'ob-swaras' + (big ? ' big' : '')} aria-hidden="true">
      {sw.map((s, i) => (
        <span key={i} className={i === 0 ? 'sa' : big && i === 4 ? 'cue' : ''} style={big ? { height: 88 + i * 6 } : undefined}>{s}</span>
      ))}
    </div>
  );
}
