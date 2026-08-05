import { photo, srcset } from './photos';

export interface CardImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

/**
 * React islands cannot render <picture>, so they get a plain WebP srcset built
 * from the pre-generated manifest.
 */
function fromManifest(key: string, displayWidth: number, displayHeight: number): CardImage {
  const entry = photo(key);
  return {
    src: entry.src,
    srcset: srcset(entry.webp),
    width: displayWidth,
    height: displayHeight,
  };
}

export function cardImage(key: string): CardImage {
  return fromManifest(key, 400, 300);
}

/** Small square thumbnail for the homepage finder results. */
export function thumbImage(key: string): CardImage {
  return fromManifest(key, 96, 96);
}
