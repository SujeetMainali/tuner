import { LANGUAGES, pagePath } from '../i18n/messages.js';
import { useI18n } from '../i18n/I18n.jsx';
import { IconNote, IconSliders, NAV_ICONS } from './Icons.jsx';

export const SECTIONS = ['home', 'tune', 'play', 'riyaz', 'report'];

/** The Swara mark and wordmark. */
export function Brand({ size = 'md' }) {
  const { m } = useI18n();
  return (
    <div className={'brand brand-' + size}>
      <span className="brand-mark"><IconNote size={size === 'lg' ? 22 : 20} /></span>
      <span className="brand-words">
        <span className="brand-name">{m.ui.brand}</span>
        <span className="brand-tag">{m.ui.tagline}</span>
      </span>
    </div>
  );
}

const link = (lang, view, onView) => ({
  href: pagePath(lang, view),
  onClick: (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    onView(view);
  },
});

/** Desktop: the left sidebar with the sections, the harmonium summary, language and settings. */
export function Sidebar({ view, onView, saName, bank, onSetup, onLang, onSettings }) {
  const { m, lang } = useI18n();
  const U = m.ui;
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label={U.nav.aria} className="side-nav">
        {SECTIONS.map((s) => {
          const Icon = NAV_ICONS[s];
          return (
            <a key={s} {...link(lang, s, onView)} aria-current={view === s ? 'page' : undefined}>
              <Icon />{U.nav[s]}
            </a>
          );
        })}
      </nav>
      <div className="side-fill" />
      <div className="side-harmonium">
        <span className="sh-label">{U.harmonium.label}</span>
        <span className="sh-value">{U.harmonium.summary({ sa: saName, bank: m.bank[bank] })}</span>
        <button type="button" className="link-btn" onClick={onSetup}>{U.harmonium.change}</button>
      </div>
      <div className="side-tools">
        <select aria-label={U.common.language} value={lang} onChange={(e) => onLang(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.label}</option>)}
        </select>
        <button type="button" className="icon-btn" aria-label={U.common.settings} onClick={onSettings}><IconSliders size={18} /></button>
      </div>
    </aside>
  );
}

/** Phone: the bottom tab bar. */
export function TabBar({ view, onView }) {
  const { m, lang } = useI18n();
  const U = m.ui;
  return (
    <nav className="tabbar" aria-label={U.nav.aria}>
      {SECTIONS.map((s) => {
        const Icon = NAV_ICONS[s];
        return (
          <a key={s} {...link(lang, s, onView)} aria-current={view === s ? 'page' : undefined}>
            <span className="tab-pill"><Icon size={22} /></span>
            {U.nav[s]}
          </a>
        );
      })}
    </nav>
  );
}
