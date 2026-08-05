/**
 * Post-build guard.
 *
 * Astro silently falls back to an on-demand image endpoint when sharp is not
 * usable during the build. On a static host those /_image/ URLs 404 and every
 * photo disappears — which is exactly what shipped once. This turns that
 * silent degradation into a failed build, and also catches any asset the HTML
 * references but the build never emitted.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
if (pages.length === 0) problems.push('no HTML pages were emitted');

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

  for (const match of html.matchAll(/(?:src|href)="(\/_astro\/[^"?#]+)"/g)) {
    if (!existsSync(join(DIST, match[1]))) missingAssets.add(match[1]);
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/gi)) {
    for (const candidate of match[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url.startsWith('/_astro/') && !existsSync(join(DIST, url))) missingAssets.add(url);
    }
  }
}

for (const asset of missingAssets) problems.push(`referenced but not emitted: ${asset}`);

if (problems.length > 0) {
  console.error('\nBuild check failed:\n');
  for (const problem of problems.slice(0, 15)) console.error('  •', problem);
  if (problems.length > 15) console.error(`  … and ${problems.length - 15} more`);
  if (onDemandImages > 0) {
    console.error(
      '\n  Fix: make sure `sharp` installs in the build environment (it is an\n' +
        '  explicit dependency) so Astro can pre-generate AVIF/WebP variants.\n',
    );
  }
  process.exit(1);
}

const assets = readdirSync(join(DIST, '_astro')).filter((f) => /\.(avif|webp)$/.test(f));
console.log(
  `Build check passed: ${pages.length} pages, ${assets.length} pre-generated image variants.`,
);
