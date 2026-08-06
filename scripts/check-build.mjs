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

for (const page of pages) {
  const html = readFileSync(page, 'utf8');

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
}

for (const asset of missingAssets) problems.push(`referenced but not emitted: ${asset}`);

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
