/*
 * Build step after `vite build` and the SSR build of src/entry-server.jsx:
 * writes real HTML for each language (dist/index.html = English, dist/ne/ = Nepali, dist/hi/ = Hindi)
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
const { LANG_PATH } = await import(pathToFileURL(resolve('src/i18n/messages.js')).href);
const langs = Object.keys(LANG_PATH);
const abs = (path) => site + path;

function head(lang) {
  const seo = messagesFor(lang).seo;
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
      `<link rel="canonical" href="${abs(LANG_PATH[lang])}" />`,
      ...langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(LANG_PATH[l])}" />`),
      `<link rel="alternate" hreflang="x-default" href="${abs(LANG_PATH.en)}" />`,
      `<meta property="og:url" content="${abs(LANG_PATH[lang])}" />`,
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
    ...(site && { url: abs(LANG_PATH[lang]), image: abs('/og-image.png') }),
  };
  tags.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  return tags.map((t) => '    ' + t).join('\n');
}

const template = await readFile(resolve(DIST, 'index.html'), 'utf8');
if (!template.includes('<!-- seo:start') || !template.includes('<!--app-->')) {
  throw new Error('dist/index.html is missing the seo or app markers from index.html');
}

for (const lang of langs) {
  const html = template
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(/ *<!-- seo:start[\s\S]*?<!-- seo:end -->/, head(lang))
    .replace('<!--app-->', render(lang));
  const dir = resolve(DIST, '.' + LANG_PATH[lang]);
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, 'index.html'), html);
}

const robots = ['User-agent: *', 'Allow: /', ...(site ? ['', `Sitemap: ${abs('/sitemap.xml')}`] : [])].join('\n') + '\n';
await writeFile(resolve(DIST, 'robots.txt'), robots);

if (site) {
  const today = new Date().toISOString().slice(0, 10);
  const alternates = langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(LANG_PATH[l])}" />`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(LANG_PATH.en)}" />`).join('\n');
  const urls = langs.map((l) => `  <url>\n    <loc>${abs(LANG_PATH[l])}</loc>\n    <lastmod>${today}</lastmod>\n${alternates}\n  </url>`).join('\n');
  await writeFile(resolve(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);
} else {
  console.warn('prerender: no SITE_URL or VERCEL_PROJECT_PRODUCTION_URL, so canonical/hreflang links, og:image and sitemap.xml were skipped.');
}

await rm(SSR, { recursive: true, force: true });
console.log(`prerender: wrote ${langs.map((l) => LANG_PATH[l]).join(', ')}${site ? ' for ' + site : ''}`);
