import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// /ne/ opens in Nepali, /hi/ in Hindi. The prerendered HTML in #root is for crawlers and first paint; React
// replaces it with the live app (saved readings and settings differ per visitor, so no hydration).
const urlLang = location.pathname.match(/^\/(ne|hi)(\/|$)/)?.[1] ?? null;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App urlLang={urlLang} />
  </React.StrictMode>,
);
