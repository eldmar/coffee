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
