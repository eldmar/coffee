/** Build the five branded 1200x630 social cards referenced by the main hubs. */
import sharp from 'sharp';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = 'public/social';
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 250 * 1024;

const cards = [
  {
    file: 'recipes.webp',
    source: 'iced-latte.png',
    eyebrow: 'MAKE IT AT HOME',
    title: ['Coffee', 'Recipes'],
  },
  {
    file: 'brew-guides.webp',
    source: 'v60-brewing.png',
    eyebrow: 'BREW WITH CONFIDENCE',
    title: ['Brew', 'Guides'],
  },
  {
    file: 'learn.webp',
    source: 'beans-bowl.png',
    eyebrow: 'FROM BEAN TO CUP',
    title: ['Learn', 'Coffee'],
  },
  {
    file: 'journal.webp',
    source: 'journal-ice-is-an-ingredient.png',
    eyebrow: 'IDEAS FOR A SLOW CUP',
    title: ['Coffee', 'Journal'],
  },
  {
    file: 'filter-coffee-recipes.webp',
    source: 'v60-brewing.png',
    eyebrow: 'V60 · AEROPRESS · FRENCH PRESS',
    title: ['Filter Coffee', 'Recipes'],
  },
];

const overlay = (eyebrow, title) => Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="630" fill="#2B211B" fill-opacity="0.91"/>
    <rect x="64" y="64" width="286" height="72" rx="6" fill="#F7F2E8"/>
    <rect x="64" y="184" width="48" height="5" fill="#B33B32"/>
    <text x="64" y="232" fill="#F7F2E8" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="2">${eyebrow}</text>
    <text x="64" y="348" fill="#FFFDF8" font-family="Georgia, serif" font-size="82" font-weight="500">${title[0]}</text>
    <text x="64" y="442" fill="#FFFDF8" font-family="Georgia, serif" font-size="82" font-weight="500">${title[1]}</text>
    <text x="64" y="548" fill="#D8CFC1" font-family="Arial, sans-serif" font-size="24">Better coffee at home. Every day.</text>
  </svg>
`);

mkdirSync(OUT_DIR, { recursive: true });
const logo = await sharp(readFileSync('public/images/kavovo-lockup.svg'))
  .resize({ width: 230 })
  .png()
  .toBuffer();

for (const card of cards) {
  const output = join(OUT_DIR, card.file);
  await sharp(join('photos-src', card.source))
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .composite([
      { input: overlay(card.eyebrow, card.title), left: 0, top: 0 },
      { input: logo, left: 92, top: 84 },
    ])
    .webp({ quality: 78, effort: 6 })
    .toFile(output);

  const metadata = await sharp(output).metadata();
  const bytes = statSync(output).size;
  if (metadata.width !== WIDTH || metadata.height !== HEIGHT || bytes >= MAX_BYTES) {
    throw new Error(`${output} failed social image constraints (${metadata.width}x${metadata.height}, ${bytes} bytes)`);
  }
  console.log(`${card.file.padEnd(28)} ${Math.round(bytes / 1024)} KB`);
}
