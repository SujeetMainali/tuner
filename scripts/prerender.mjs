/*
 * Build step after `vite build` and the SSR build of src/entry-server.jsx:
 * writes real HTML for each language and section (dist/index.html = English home, dist/ne/ = Nepali,
 * dist/hi/tune/ = Hindi tuner, …)
 * with its own title, description, canonical and hreflang links, social-preview tags and
 * structured data, plus robots.txt and sitemap.xml.
 *
 * The public address comes from SITE_URL (e.g. https://tuner.example.com), or on Vercel from
 * VERCEL_PROJECT_PRODUCTION_URL. Without one, tags that need an absolute URL are left out.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const DIST = resolve('dist');
const SSR = resolve('dist-ssr');
const LOCALE = { en: 'en_US', ne: 'ne_NP', hi: 'hi_IN' };

const host = process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL)
  || '';
const site = host.replace(/\/+$/, '');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const { render, messagesFor } = await import(pathToFileURL(resolve(SSR, 'entry-server.js')).href);
const { LANG_PATH, VIEWS, pagePath, seoFor } = await import(pathToFileURL(resolve('src/i18n/messages.js')).href);
const langs = Object.keys(LANG_PATH);
const abs = (path) => site + path;

function head(lang, view) {
  const seo = seoFor(lang, view);
  const path = (l) => pagePath(l, view);
  const tags = [
    `<title>${esc(seo.title)}</title>`,
    `<meta name="description" content="${esc(seo.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(seo.appName)}" />`,
    `<meta property="og:title" content="${esc(seo.title)}" />`,
    `<meta property="og:description" content="${esc(seo.description)}" />`,
    `<meta property="og:locale" content="${LOCALE[lang]}" />`,
    ...langs.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALE[l]}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(seo.title)}" />`,
    `<meta name="twitter:description" content="${esc(seo.description)}" />`,
  ];
  if (site) {
    tags.push(
      `<link rel="canonical" href="${abs(path(lang))}" />`,
      ...langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(path(l))}" />`),
      `<link rel="alternate" hreflang="x-default" href="${abs(path('en'))}" />`,
      `<meta property="og:url" content="${abs(path(lang))}" />`,
      `<meta property="og:image" content="${abs('/og-image.png')}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta property="og:image:alt" content="${esc(seo.appName)}" />`,
      `<meta name="twitter:image" content="${abs('/og-image.png')}" />`,
    );
  }
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: seo.appName,
    description: seo.description,
    inLanguage: lang,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a microphone and a current web browser',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(site && { url: abs(path(lang)), image: abs('/og-image.png') }),
  };
  tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  return tags.map((t) => '    ' + t).join('\n');
}

const template = await readFile(resolve(DIST, 'index.html'), 'utf8');
if (!template.includes('<!-- seo:start') || !template.includes('<!--app-->')) {
  throw new Error('dist/index.html is missing the seo or app markers from index.html');
}

const pages = langs.flatMap((lang) => VIEWS.map((view) => ({ lang, view, path: pagePath(lang, view) })));
for (const { lang, view, path } of pages) {
  const html = template
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(/ *<!-- seo:start[\s\S]*?<!-- seo:end -->/, head(lang, view))
    .replace('<!--app-->', render(lang, view));
  const dir = resolve(DIST, '.' + path);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html);
}

const robots = ['User-agent: *', 'Allow: /', ...(site ? ['', `Sitemap: ${abs('/sitemap.xml')}`] : [])].join('\n') + '\n';
await writeFile(resolve(DIST, 'robots.txt'), robots);

if (site) {
  const today = new Date().toISOString().slice(0, 10);
  const alternates = (view) => langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(pagePath(l, view))}" />`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(pagePath('en', view))}" />`).join('\n');
  const urls = pages.map((p) => `  <url>\n    <loc>${abs(p.path)}</loc>\n    <lastmod>${today}</lastmod>\n${alternates(p.view)}\n  </url>`).join('\n');
  await writeFile(resolve(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
} else {
  console.warn('prerender: no SITE_URL or VERCEL_PROJECT_PRODUCTION_URL, so canonical/hreflang links, og:image and sitemap.xml were skipped.');
}

await rm(SSR, { recursive: true, force: true });
console.log(`prerender: wrote ${pages.map((p) => p.path).join(', ')}${site ? ' for ' + site : ''}`);
