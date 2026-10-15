import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18n.jsx';

const TABS = [
  { id: 'live', icon: <><path d="M4 16a8 8 0 0 1 16 0" /><path d="m12 16 3-6" /></> },
  { id: 'keys', icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v10M15 4v10M9 14v6M15 14v6" /></> },
  { id: 'report', icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
  { id: 'guide', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></> },
];

/** Phone-only bottom navigation between the page's sections; highlights the one in view. */
export default function TabBar() {
  const { m } = useI18n();
  const [active, setActive] = useState('live');

  useEffect(() => {
    const els = TABS.map((t) => document.getElementById(t.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (seen[0]) setActive(seen[0].target.id);
    }, { rootMargin: '-35% 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav className="tabbar" aria-label={m.tabs.aria}>
      {TABS.map((t) => (
        <a key={t.id} href={'#' + t.id} aria-current={active === t.id ? 'true' : undefined} onClick={() => setActive(t.id)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
          {m.tabs[t.id]}
        </a>
      ))}
    </nav>
  );
}
