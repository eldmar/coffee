/**
 * Home-screen icons for the web app manifest.
 *
 * Generated from public/favicon.png, which is already a 512px square on the
 * brand cream. The maskable variant insets that artwork into the 80% safe zone
 * Android crops to, so the mark survives a circular or squircle mask instead of
 * losing its edges.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SOURCE = 'public/favicon.png';
const OUT = 'public/icons';
// Matches --color-paper (light) in src/styles/global.css.
const BACKGROUND = { r: 251, g: 248, b: 242, alpha: 1 };
const SAFE_ZONE = 0.8;

mkdirSync(OUT, { recursive: true });

async function square(size, name) {
  await sharp(SOURCE)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  return name;
}

async function maskable(size, name) {
  const inner = Math.round(size * SAFE_ZONE);
  const pad = Math.round((size - inner) / 2);
  const artwork = await sharp(SOURCE).resize(inner, inner, { fit: 'cover' }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: artwork, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
  return name;
}

const written = [
  await square(192, 'icon-192.png'),
  await square(512, 'icon-512.png'),
  await maskable(512, 'icon-maskable-512.png'),
];

console.log(`App icons written to ${OUT}/: ${written.join(', ')}`);
