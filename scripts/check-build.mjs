/**
 * Post-build guard.
 *
 * Astro silently falls back to an on-demand image endpoint when sharp is not
 * usable during the build. On a static host those /_image/ URLs 404 and every
 * photo disappears — which is exactly what shipped once. This turns that
 * silent degradation into a failed build, and also catches any asset the HTML
 * references but the build never emitted.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// --warn-only reports problems without failing the build. Used on the host
// while we work out why its environment differs from a clean local build.
const warnOnly = process.argv.includes('--warn-only');
const DIST = 'dist';
const problems = [];

function htmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

const pages = htmlFiles(DIST);
if (pages.length === 0) {
  problems.push(
    'no HTML pages in dist/ — the build produced a server bundle rather than a static site',
  );
}
console.log(`Checking ${pages.length} pages in ${DIST}/`);

const missingAssets = new Set();
let onDemandImages = 0;
let recipeSchemas = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');

  const headings = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  const h1Count = headings.filter((level) => level === 1).length;
  if (h1Count !== 1) {
    problems.push(`${relative(DIST, page)} has ${h1Count} h1 elements; expected exactly one`);
  }
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] > headings[index - 1] + 1) {
      problems.push(
        `${relative(DIST, page)} skips heading level h${headings[index - 1]} to h${headings[index]}`,
      );
      break;
    }
  }

  const onDemand = html.match(/\/_image\/\?href=/g);
  if (onDemand) {
    onDemandImages += onDemand.length;
    problems.push(
      `${relative(DIST, page)} references ${onDemand.length} on-demand image URL(s) — sharp did not run during the build`,
    );
  }

  for (const match of html.matchAll(/(?:src|href)="(\/(?:_astro|img)\/[^"?#]+)"/g)) {
    if (!existsSync(join(DIST, match[1]))) missingAssets.add(match[1]);
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/gi)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (/^\/(?:_astro|img)\//.test(url) && !existsSync(join(DIST, url))) missingAssets.add(url);
    }
  }

  for (const match of html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let schema;
    try {
      schema = JSON.parse(match[1]);
    } catch {
      problems.push(`${relative(DIST, page)} contains invalid JSON-LD`);
      continue;
    }
    if (schema?.['@type'] !== 'Recipe') continue;
    recipeSchemas += 1;
    const label = relative(DIST, page);
    if (typeof schema.keywords !== 'string' || schema.keywords.trim().length === 0) {
      problems.push(`${label} Recipe schema is missing keywords`);
    }
    if (!Array.isArray(schema.recipeInstructions) || schema.recipeInstructions.length === 0) {
      problems.push(`${label} Recipe schema is missing recipeInstructions`);
      continue;
    }
    for (const [index, step] of schema.recipeInstructions.entries()) {
      if (step?.['@type'] !== 'HowToStep') {
        problems.push(`${label} instruction ${index + 1} is not a HowToStep`);
        continue;
      }
      if (typeof step.name !== 'string' || step.name.trim().length === 0) {
        problems.push(`${label} instruction ${index + 1} is missing a descriptive name`);
      }
      if (typeof step.text !== 'string' || step.text.trim().length === 0) {
        problems.push(`${label} instruction ${index + 1} is missing text`);
      }
      const fragment = typeof step.url === 'string' ? step.url.split('#')[1] : '';
      if (!fragment || !html.includes(`id="${fragment}"`)) {
        problems.push(`${label} instruction ${index + 1} URL does not target a rendered step`);
      }
    }
  }
}

const searchPage = join(DIST, 'search', 'index.html');
if (existsSync(searchPage)) {
  const html = readFileSync(searchPage, 'utf8');
  if (!/<meta name="robots" content="noindex, follow">/i.test(html)) {
    problems.push('search/index.html is missing noindex, follow');
  }
  if (!/<link rel="canonical" href="https?:\/\/[^"?]+\/search\/">/i.test(html)) {
    problems.push('search/index.html canonical is not the query-free /search/ URL');
  }
  if (!html.includes('placeholder="Search all KAVOVO"')) {
    problems.push('search/index.html is missing the global search placeholder');
  }
  if (!html.includes('aria-label="Filter search results by content type"')) {
    problems.push('search/index.html is missing content-type search filters');
  }
}

const recipesPage = join(DIST, 'recipes', 'index.html');
if (existsSync(recipesPage)) {
  const html = readFileSync(recipesPage, 'utf8');
  if (!/placeholder="Search \d+ recipes"/.test(html)) {
    problems.push('recipes/index.html is missing its recipe-count search placeholder');
  }
  if (!html.includes('data-brew-widget-reveal="immediate"')) {
    problems.push('recipes/index.html floating brew widget should appear immediately');
  }
  if (!html.includes('bg-line object-cover')) {
    problems.push('recipes/index.html cards are missing image skeleton backgrounds');
  }
}

const shopPage = join(DIST, 'shop', 'index.html');
if (existsSync(shopPage)) {
  const html = readFileSync(shopPage, 'utf8');
  if (!/<meta name="robots" content="noindex, follow">/i.test(html)) {
    problems.push('shop/index.html is missing noindex, follow while the shop is prelaunch');
  }
}

const homePage = join(DIST, 'index.html');
if (existsSync(homePage)) {
  const html = readFileSync(homePage, 'utf8');
  if (!html.includes('data-brew-widget')) {
    problems.push('index.html is missing the global Fix my coffee widget');
  }
  if (!html.includes('data-brew-widget-reveal="scroll"')) {
    problems.push('index.html floating brew widget must wait for the first scroll');
  }
  if (!/<button[^>]*class="brew-widget-trigger"[^>]*\shidden(?:\s|>)/i.test(html)) {
    problems.push('index.html floating brew widget trigger is not initially hidden');
  }
  if (html.includes('Not sure where to start?')) {
    problems.push('index.html includes the duplicated brew-method chooser');
  }
}

const assistantPage = join(DIST, 'assistant', 'index.html');
if (existsSync(assistantPage)) {
  const html = readFileSync(assistantPage, 'utf8');
  if (html.includes('data-brew-widget')) {
    problems.push('assistant/index.html includes the floating widget beside the full assistant');
  }
  if (!/<link rel="canonical" href="https:\/\/kavovo\.uk\/assistant\/">/i.test(html)) {
    problems.push('assistant/index.html canonical must stay query-free');
  }
}

for (const contentPage of [
  join(DIST, 'recipes', 'index.html'),
  join(DIST, 'guides', 'index.html'),
  join(DIST, 'learn', 'index.html'),
  join(DIST, 'journal', 'index.html'),
]) {
  if (existsSync(contentPage) && /<meta name="robots" content="noindex/i.test(readFileSync(contentPage, 'utf8'))) {
    problems.push(`${relative(DIST, contentPage)} was accidentally marked noindex`);
  }
}

for (const entry of readdirSync(DIST, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.xml')) continue;
  const xml = readFileSync(join(DIST, entry.name), 'utf8');
  for (const excludedPath of ['/404/', '/search/', '/shop/', '/subscription-confirmed/']) {
    if (xml.includes(`<loc>https://kavovo.uk${excludedPath}</loc>`)) {
      problems.push(`${entry.name} includes excluded page ${excludedPath}`);
    }
  }
}

for (const asset of missingAssets) problems.push(`referenced but not emitted: ${asset}`);
if (recipeSchemas === 0) problems.push('no Recipe schemas found in the production build');

// Internal links. Lessons hand-pick their "put it into practice" links, and a
// typo there is invisible until someone clicks it.
const deadLinks = new Map();
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const match of html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/g)) {
    const href = match[1].split(/[?#]/)[0];
    if (!href || href.startsWith('/api/')) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(href)) continue; // a file, covered by the asset check
    const target = join(DIST, href, 'index.html');
    if (!existsSync(target)) {
      if (!deadLinks.has(href)) deadLinks.set(href, relative(DIST, page));
    }
  }
}
for (const [href, from] of deadLinks) problems.push(`dead internal link ${href} (from ${from})`);

// The Brew Assistant renders its links in the browser, so they never appear in
// the static HTML the check above walks. Read them from the content map instead:
// a renamed lesson should fail the build, not quietly link into nothing.
const contentMap = 'src/lib/brew-assistant/content.ts';
if (existsSync(contentMap)) {
  const source = readFileSync(contentMap, 'utf8');
  for (const match of source.matchAll(/href:\s*'(\/[^']+)'/g)) {
    if (!existsSync(join(DIST, match[1], 'index.html'))) {
      problems.push(`brew assistant links to a page that does not exist: ${match[1]}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\nBuild check ${warnOnly ? 'WARNING' : 'failed'}:\n`);
  for (const problem of problems.slice(0, 15)) console.error('  •', problem);
  if (problems.length > 15) console.error(`  … and ${problems.length - 15} more`);
  if (onDemandImages > 0) {
    console.error(
      '\n  Photos must come from public/img via the Photo component, never from\n' +
        "  Astro's image pipeline — the host cannot run it. See scripts/build-images.mjs.\n",
    );
  }
  if (!warnOnly) process.exit(1);
}

const variants = existsSync(join(DIST, 'img'))
  ? readdirSync(join(DIST, 'img')).filter((f) => /\.(avif|webp)$/.test(f)).length
  : 0;
if (variants === 0) {
  console.error('\nBuild check: no image variants in dist/img — run `npm run images`.\n');
  if (!warnOnly) process.exit(1);
}
console.log(`Build check passed: ${pages.length} pages, ${variants} image variants served statically.`);
console.log(`Structured data check passed: ${recipeSchemas} Recipe schemas.`);
