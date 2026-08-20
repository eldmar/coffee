/** Build the branded 1200x630 social cards referenced by hubs and key content. */
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
  {
    file: 'arabica-vs-robusta.webp',
    source: 'lesson-arabica-vs-robusta.png',
    eyebrow: 'UNDERSTAND YOUR BEANS',
    title: ['Arabica vs', 'Robusta'],
    fontSize: 72,
  },
  {
    file: 'cortado-vs-flat-white-vs-latte.webp',
    source: 'lesson-cortado-flat-white-latte.png',
    eyebrow: 'COMPARISON GUIDE',
    title: ['Cortado · Flat White', '· Latte'],
    fontSize: 57,
  },
  {
    file: 'americano-vs-filter-coffee.webp',
    source: 'lesson-americano-filter-coffee.png',
    eyebrow: 'COMPARISON GUIDE',
    title: ['Americano vs', 'Filter Coffee'],
    fontSize: 68,
  },
  {
    file: 'cold-brew-vs-iced-coffee.webp',
    source: 'lesson-cold-brew-iced-coffee.png',
    eyebrow: 'COMPARISON GUIDE',
    title: ['Cold Brew vs', 'Iced Coffee'],
    fontSize: 68,
  },
  {
    file: 'cappuccino-vs-flat-white.webp',
    source: 'lesson-cappuccino-flat-white.png',
    eyebrow: 'COMPARISON GUIDE',
    title: ['Cappuccino vs', 'Flat White'],
    fontSize: 64,
  },
  {
    file: 'espresso-ratio.webp',
    source: 'lesson-espresso-ratio.png',
    eyebrow: 'DIAL IN ESPRESSO',
    title: ['Espresso', 'Ratio'],
  },
  {
    file: 'iced-americano.webp',
    source: 'iced-americano.png',
    eyebrow: 'COFFEE · WATER · ICE',
    title: ['Iced Americano', 'Recipe'],
    fontSize: 66,
  },
];

const overlay = (eyebrow, title, fontSize = 82) => Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="720" height="630" fill="#2B211B" fill-opacity="0.91"/>
    <rect x="64" y="64" width="286" height="72" rx="6" fill="#F7F2E8"/>
    <rect x="64" y="184" width="48" height="5" fill="#B33B32"/>
    <text x="64" y="232" fill="#F7F2E8" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="2">${eyebrow}</text>
    <text x="64" y="348" fill="#FFFDF8" font-family="Georgia, serif" font-size="${fontSize}" font-weight="500">${title[0]}</text>
    <text x="64" y="442" fill="#FFFDF8" font-family="Georgia, serif" font-size="${fontSize}" font-weight="500">${title[1]}</text>
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
      { input: overlay(card.eyebrow, card.title, card.fontSize), left: 0, top: 0 },
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
