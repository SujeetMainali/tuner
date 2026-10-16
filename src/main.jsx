import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { viewFromPath } from './i18n/messages.js';
import './styles.css';

// /ne/ opens in Nepali, /hi/ in Hindi; …/tune/, …/play/, …/riyaz/ and …/report/ open those sections. The prerendered HTML in #root is for crawlers and first paint; React
// replaces it with the live app (saved readings and settings differ per visitor, so no hydration).
const urlLang = location.pathname.match(/^\/(ne|hi)(\/|$)/)?.[1] ?? null;
const urlView = viewFromPath(location.pathname);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App urlLang={urlLang} urlView={urlView} />
  </React.StrictMode>,
);
