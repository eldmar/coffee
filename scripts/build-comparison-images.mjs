/** Build text-free 4:3 hero composites for the new comparison guides. */
import sharp from 'sharp';
import { join } from 'node:path';

const WIDTH = 1600;
const HEIGHT = 1200;
const GAP = 12;
const SOURCE_DIR = 'photos-src';

const composites = [
  {
    file: 'lesson-cortado-flat-white-latte.png',
    sources: ['cortado.png', 'flat-white.png', 'caffe-latte.png'],
  },
  {
    file: 'lesson-americano-filter-coffee.png',
    sources: ['americano.png', 'v60-brewing.png'],
  },
  {
    file: 'lesson-cold-brew-iced-coffee.png',
    sources: ['cold-brew.png', 'iced-americano.png'],
  },
  {
    file: 'lesson-cappuccino-flat-white.png',
    sources: ['cappuccino.png', 'flat-white.png'],
  },
  {
    file: 'lesson-espresso-ratio.png',
    sources: ['lesson-espresso-basics-dose-yield-time.png'],
  },
];

for (const composite of composites) {
  const panelWidth = Math.floor((WIDTH - GAP * (composite.sources.length - 1)) / composite.sources.length);
  const layers = [];
  let left = 0;

  for (const [index, source] of composite.sources.entries()) {
    const width = index === composite.sources.length - 1 ? WIDTH - left : panelWidth;
    const input = await sharp(join(SOURCE_DIR, source))
      .resize(width, HEIGHT, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer();
    layers.push({ input, left, top: 0 });
    left += width + GAP;
  }

  const output = join(SOURCE_DIR, composite.file);
  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: '#f7f2e8',
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toFile(output);

  console.log(`${composite.file} ${WIDTH}x${HEIGHT}`);
}
