import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Content dates for <lastmod>, keyed by the page's pathname.
 *
 * Crawlers use lastmod to decide what is worth re-fetching, and the dates are
 * already in the frontmatter — the sitemap just never carried them. Read
 * straight from disk rather than through astro:content, because the sitemap
 * integration is configured before the content layer exists.
 *
 * Only pages whose date is a fact get one. Guides carry no date field and the
 * listing pages change for reasons no frontmatter records, so they are left
 * without lastmod rather than given an invented one.
 */
const CONTENT = 'src/content';

function frontmatter(file) {
  const source = readFileSync(file, 'utf8');
  const end = source.indexOf('\n---', 4);
  return end === -1 ? '' : source.slice(0, end);
}

function dateIn(block, ...keys) {
  for (const key of keys) {
    const match = block.match(new RegExp(`^${key}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm'));
    if (match) return match[1];
  }
  return undefined;
}

function markdownIn(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...markdownIn(path));
    else if (entry.name.endsWith('.md')) out.push(path);
  }
  return out;
}

function collection(name) {
  const dir = join(CONTENT, name);
  try {
    return statSync(dir).isDirectory() ? markdownIn(dir) : [];
  } catch {
    return [];
  }
}

export function contentLastmod() {
  /** @type {Record<string, string>} */
  const dates = {};

  for (const file of collection('recipes')) {
    const slug = file.slice(`${CONTENT}/recipes/`.length, -3);
    const date = dateIn(frontmatter(file), 'dateModified', 'datePublished');
    if (date) dates[`/recipes/${slug}/`] = date;
  }

  for (const file of collection('journal')) {
    const slug = file.slice(`${CONTENT}/journal/`.length, -3);
    const date = dateIn(frontmatter(file), 'dateModified', 'date');
    if (date) dates[`/journal/${slug}/`] = date;
  }

  // A path's index is as fresh as its freshest lesson.
  /** @type {Record<string, string>} */
  const pathLatest = {};
  for (const file of collection('lessons')) {
    const id = file.slice(`${CONTENT}/lessons/`.length, -3);
    const date = dateIn(frontmatter(file), 'dateModified', 'datePublished');
    if (!date) continue;
    dates[`/learn/${id}/`] = date;
    const [pathSlug] = id.split('/');
    if (!pathLatest[pathSlug] || date > pathLatest[pathSlug]) pathLatest[pathSlug] = date;
  }
  for (const [pathSlug, date] of Object.entries(pathLatest)) {
    dates[`/learn/${pathSlug}/`] = date;
  }

  return dates;
}
