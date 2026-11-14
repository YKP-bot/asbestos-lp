import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const ORIGIN = 'https://lp.sakuraigr.co.jp';
const SITE_NAME = 'アスベスト調査ナビ';
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');

if (WRITE === CHECK) {
  throw new Error('Use exactly one mode: --write or --check');
}

const xmlEscape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const decodeHtml = (value) => String(value)
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)));

const stripHtml = (value) => decodeHtml(String(value)
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const match = (html, pattern) => html.match(pattern)?.[1]?.trim() || '';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}

function routeFor(file) {
  const local = relative(ROOT, file).split(sep).join('/');
  if (local === 'index.html') return '/';
  if (!local.endsWith('/index.html')) return null;
  return `/${local.slice(0, -'index.html'.length)}`;
}

function parseJsonLd(html) {
  const values = [];
  for (const item of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(item[1])); }
    catch { /* Reported separately by the page audit. */ }
  }
  return values;
}

function schemaType(value) {
  const type = value?.['@type'];
  return Array.isArray(type) ? type : [type].filter(Boolean);
}

function websiteSchemas(value) {
  if (!value || typeof value !== 'object') return [];
  return [
    ...(schemaType(value).includes('WebSite') ? [value] : []),
    ...Object.values(value).flatMap(websiteSchemas),
  ];
}

function classification(route) {
  if (route.startsWith('/asbestos/area/')) return 'area';
  if (/^\/asbestos\/column\/[^/]+\/$/.test(route)
    && !route.includes('/category/') && route !== '/asbestos/column/ranking/') return 'column';
  return 'core';
}

async function existingLastmods() {
  const values = new Map();
  for (const sitemap of ['sitemap.xml', 'asbestos/sitemap.xml', 'sitemap-core.xml', 'sitemap-column.xml', 'sitemap-area.xml']) {
    try {
      const xml = await readFile(join(ROOT, sitemap), 'utf8');
      for (const item of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>\s*<\/url>/g)) {
        values.set(decodeHtml(item[1]), item[2]);
      }
    } catch { /* A split sitemap may not exist on the first run. */ }
  }
  return values;
}

const lastmodOverrides = JSON.parse(await readFile(join(SCRIPT_DIR, 'seo-lastmod.json'), 'utf8'));
const previousLastmods = await existingLastmods();
const allFiles = await walk(ROOT);
const htmlFiles = allFiles.filter((file) => file.endsWith(`${sep}index.html`) || file === join(ROOT, 'index.html'));
const errors = [];
const pages = [];

for (const file of htmlFiles) {
  const route = routeFor(file);
  if (!route || (!route.startsWith('/asbestos/') && route !== '/')) continue;
  const html = await readFile(file, 'utf8');
  const canonical = match(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i);
  const robots = match(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["'][^>]*>/i).toLowerCase();
  const title = match(html, /<title>([\s\S]*?)<\/title>/i);
  const description = match(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i);
  const ogUrl = match(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["'][^>]*>/i);
  const siteNames = [...html.matchAll(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']*)["'][^>]*>/gi)];
  const expectedCanonical = `${ORIGIN}${route}`;
  const local = relative(ROOT, file).split(sep).join('/');

  if (!title) errors.push(`${local}: title is missing`);
  if (!description) errors.push(`${local}: meta description is missing`);
  if (siteNames.length !== 1 || decodeHtml(siteNames[0]?.[1] || '') !== SITE_NAME) {
    errors.push(`${local}: og:site_name must be ${SITE_NAME}`);
  }
  if (canonical !== expectedCanonical) errors.push(`${local}: canonical must be ${expectedCanonical}`);
  if (ogUrl && ogUrl !== expectedCanonical) errors.push(`${local}: og:url differs from canonical`);
  if (robots.includes('noindex')) {
    errors.push(`${local}: production page must not contain noindex`);
    continue;
  }
  if (!/(^|,)\s*index\b/.test(robots)) errors.push(`${local}: robots must explicitly allow index`);

  const schemas = parseJsonLd(html);
  const invalidSchemaCount = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>/gi)].length - schemas.length;
  if (invalidSchemaCount) errors.push(`${local}: invalid JSON-LD (${invalidSchemaCount})`);
  const websites = schemas.flatMap(websiteSchemas);
  if (route === '/' && websites.length !== 1) errors.push(`${local}: homepage must define exactly one WebSite`);
  for (const website of websites) {
    if (website.name !== SITE_NAME || website.url !== `${ORIGIN}/` || website['@id'] !== `${ORIGIN}/#website`) {
      errors.push(`${local}: WebSite must use the shared root URL and site name`);
    }
  }
  const article = schemas.find((item) => schemaType(item).some((type) => ['Article', 'BlogPosting', 'NewsArticle'].includes(type)));
  const schemaModified = typeof article?.dateModified === 'string' ? article.dateModified.slice(0, 10) : '';
  const lastmod = lastmodOverrides[canonical] || schemaModified || previousLastmods.get(canonical) || new Date().toISOString().slice(0, 10);

  pages.push({ file, local, route, canonical, title, description, html, article, lastmod, group: classification(route) });
}

const routes = new Set(pages.map((page) => page.route));
for (const page of pages) {
  for (const item of page.html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeHtml(item[1]);
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    let target;
    try { target = new URL(href, ORIGIN); } catch { continue; }
    if (target.origin !== ORIGIN) continue;
    const pathname = target.pathname;
    if (/\.[a-z0-9]{1,8}$/i.test(pathname) || pathname.startsWith('/.netlify/')) continue;
    if (pathname !== '/' && !pathname.endsWith('/')) errors.push(`${page.local}: internal HTML link lacks trailing slash: ${href}`);
    const normalized = pathname === '/' || pathname.endsWith('/') ? pathname : `${pathname}/`;
    if (!routes.has(normalized)) errors.push(`${page.local}: internal HTML target is missing: ${href}`);
  }
}

pages.sort((a, b) => a.canonical.localeCompare(b.canonical, 'en'));

function urlset(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map((page) => `  <url><loc>${xmlEscape(page.canonical)}</loc><lastmod>${page.lastmod}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`;
}

const grouped = Object.fromEntries(['core', 'column', 'area'].map((group) => [group, pages.filter((page) => page.group === group)]));
const articlePages = pages
  .filter((page) => page.article && page.route !== '/')
  .sort((a, b) => String(b.article.dateModified || b.article.datePublished || '').localeCompare(String(a.article.dateModified || a.article.datePublished || ''))
    || a.canonical.localeCompare(b.canonical, 'en'));

function rssDate(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.valueOf()) ? new Date('2026-01-01T00:00:00+09:00').toUTCString() : date.toUTCString();
}

function rss() {
  const buildDate = rssDate(articlePages[0]?.article?.dateModified || articlePages[0]?.article?.datePublished);
  const items = articlePages.map((page) => {
    const article = page.article;
    const headline = article.headline || stripHtml(match(page.html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
    const image = typeof article.image === 'string' ? article.image : Array.isArray(article.image) ? article.image[0] : article.image?.url;
    return [
      '    <item>',
      `      <title>${xmlEscape(headline)}</title>`,
      `      <link>${xmlEscape(page.canonical)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(page.canonical)}</guid>`,
      `      <pubDate>${rssDate(article.datePublished || article.dateModified)}</pubDate>`,
      `      <description>${xmlEscape(article.description || page.description)}</description>`,
      image ? `      <media:content url="${xmlEscape(image)}" medium="image" />` : '',
      '    </item>'
    ].filter(Boolean).join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n  <channel>\n    <title>アスベスト調査ナビ</title>\n    <link>${ORIGIN}/asbestos/</link>\n    <description>アスベスト・事前調査・費用・法令・建材に関する専門情報</description>\n    <language>ja</language>\n    <lastBuildDate>${buildDate}</lastBuildDate>\n    <atom:link href="${ORIGIN}/asbestos/rss.xml" rel="self" type="application/rss+xml" />\n${items}\n  </channel>\n</rss>\n`;
}

const robots = `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`;
const asbestosPages = pages.filter((page) => page.route.startsWith('/asbestos/'));
const outputs = new Map([
  ['sitemap.xml', urlset(pages)],
  ['asbestos/sitemap.xml', urlset(asbestosPages)],
  ['asbestos/rss.xml', rss()],
  ['robots.txt', robots],
  ['asbestos/robots.txt', robots]
]);

const drift = [];
for (const [local, content] of outputs) {
  const path = join(ROOT, local);
  let current = '';
  try { current = await readFile(path, 'utf8'); } catch { /* New generated file. */ }
  if (current === content) continue;
  drift.push(local);
  if (WRITE) await writeFile(path, content, 'utf8');
}

if (errors.length) {
  console.error(`SEO audit failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else if (CHECK && drift.length) {
  console.error(`Generated SEO files are stale: ${drift.join(', ')}`);
  console.error('Run: npm run build:seo');
  process.exitCode = 1;
} else {
  const action = WRITE ? `updated ${drift.length} generated file(s)` : 'all generated files are current';
  console.log(`SEO OK: ${pages.length} indexable pages (${grouped.core.length} core, ${grouped.column.length} column, ${grouped.area.length} area); ${action}.`);
}
