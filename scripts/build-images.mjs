/**
 * Pre-generates responsive image variants into public/img/ and writes the
 * manifest the site renders from.
 *
 * Image processing happens here, on a machine where sharp works, and the
 * results are committed. The host only serves static files, so nothing depends
 * on whether its build environment can process images — Astro silently falls
 * back to an on-demand endpoint that 404s, which once took every photo down.
 *
 * Sources and keys live in photos.config.json. Run after changing a photo:
 *   npm run images
 */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = 'photos-src';
const OUT_DIR = 'public/img';
const MANIFEST = 'src/lib/photos.json';

const WIDTHS = [400, 800, 1200, 1600];
const FALLBACK_WIDTH = 800;

const config = JSON.parse(readFileSync('photos.config.json', 'utf8'));
const wide = new Set(config.wide ?? []);
const [aspectW, aspectH] = config.crop?.aspect ?? [4, 3];

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest = {};
const missing = [];

for (const [key, file] of Object.entries(config.photos)) {
  const input = join(SRC_DIR, file);
  if (!existsSync(input)) {
    missing.push(`${key} -> ${input}`);
    continue;
  }

  // Content hash in the file name is what makes immutable caching safe:
  // replace a photo and every URL changes with it.
  const hash = createHash('sha256').update(readFileSync(input)).digest('hex').slice(0, 8);
  const meta = await sharp(input).metadata();
  // Cards are 4:3; the hero and shop teaser keep their own wider framing.
  const ratio = wide.has(key) ? meta.width / meta.height : aspectW / aspectH;

  const widths = WIDTHS.filter((w) => w <= meta.width);
  if (widths.length === 0) widths.push(meta.width);

  const entry = { width: 0, height: 0, avif: [], webp: [], src: '' };

  for (const width of widths) {
    const height = Math.round(width / ratio);
    for (const format of ['avif', 'webp']) {
      const name = `${key}.${hash}-${width}.${format}`;
      await sharp(input)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        [format](format === 'avif' ? { quality: 55 } : { quality: 78 })
        .toFile(join(OUT_DIR, name));
      entry[format].push({ url: `/img/${name}`, width, height });
    }
  }

  const fallbackWidth = widths.includes(FALLBACK_WIDTH) ? FALLBACK_WIDTH : widths.at(-1);
  const fallbackHeight = Math.round(fallbackWidth / ratio);
  const fallbackName = `${key}.${hash}-${fallbackWidth}.jpg`;
  await sharp(input)
    .resize(fallbackWidth, fallbackHeight, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(join(OUT_DIR, fallbackName));

  entry.src = `/img/${fallbackName}`;
  entry.width = fallbackWidth;
  entry.height = fallbackHeight;

  manifest[key] = entry;
  console.log(`${key.padEnd(22)} ${widths.join('/')} px`);
}

if (missing.length > 0) {
  console.error('\nMissing source files:');
  for (const m of missing) console.error('  •', m);
  process.exit(1);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${Object.keys(manifest).length} photos -> ${OUT_DIR}`);
