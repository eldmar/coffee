import manifest from './photos.json';

export interface PhotoSource {
  url: string;
  width: number;
  height: number;
}

export interface Photo {
  width: number;
  height: number;
  avif: PhotoSource[];
  webp: PhotoSource[];
  src: string;
}

const photos = manifest as Record<string, Photo>;

/** Look up a pre-generated photo by key, failing loudly when it is missing. */
export function photo(key: string): Photo {
  const entry = photos[key];
  if (!entry) {
    throw new Error(
      `No pre-generated photo for "${key}". Add the source to src/assets and run \`npm run images\`.`,
    );
  }
  return entry;
}

export function srcset(sources: PhotoSource[]): string {
  return sources.map((s) => `${s.url} ${s.width}w`).join(', ');
}

/**
 * Reverse lookup from a rendered photo URL back to its entry.
 *
 * Open Graph wants og:image:width and og:image:height, but the layout only ever
 * sees the finished path. Social cards are a fixed 1200x630 (enforced by
 * scripts/build-social-images.mjs); a photo's size has to come back out of the
 * manifest it was generated from.
 */
export function photoBySrc(src: string): Photo | undefined {
  return Object.values(photos).find((entry) => entry.src === src);
}
