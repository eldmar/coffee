import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export interface CardImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

/**
 * React islands cannot use <Picture>, so optimised sources are resolved at
 * build time and handed over as plain strings.
 */
export async function cardImage(image: ImageMetadata): Promise<CardImage> {
  const optimised = await getImage({
    src: image,
    format: 'webp',
    widths: [400, 640, 800],
  });

  return {
    src: optimised.src,
    srcset: optimised.srcSet.attribute,
    width: 400,
    height: 300,
  };
}

/** Small square thumbnail for the homepage finder results. */
export async function thumbImage(image: ImageMetadata): Promise<CardImage> {
  const optimised = await getImage({
    src: image,
    format: 'webp',
    widths: [96, 192],
  });

  return {
    src: optimised.src,
    srcset: optimised.srcSet.attribute,
    width: 96,
    height: 96,
  };
}
