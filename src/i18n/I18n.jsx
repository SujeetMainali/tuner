import { createContext, useContext, useMemo } from 'react';
import { messagesFor } from './messages.js';

const I18nContext = createContext({ lang: 'en', m: messagesFor('en') });

export function I18nProvider({ lang, children }) {
  const value = useMemo(() => ({ lang, m: messagesFor(lang) }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The current language id and its message table. */
export const useI18n = () => useContext(I18nContext);
