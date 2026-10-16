import { renderToString } from 'react-dom/server';
import App from './App.jsx';
import { messagesFor } from './i18n/messages.js';

/** The app's first screen as HTML, in one language, for prerendering (scripts/prerender.mjs). */
export function render(lang) {
  return renderToString(<App urlLang={lang} />);
}

export { messagesFor };
