import { cachedJson } from '../json-cache';
import type { PathReference } from './learnProgress';

/**
 * Published learning paths and their lessons, for "Continue where you left
 * off".
 *
 * Same reasoning as the recipe catalogue: the widget renders nothing until you
 * have actually started a path, so the homepage no longer carries every path
 * and lesson in its HTML on the chance that you have. A failed load resolves
 * empty and the widget stays hidden.
 */
export const LEARN_PATHS_URL = '/learn-paths.json';

const cache = cachedJson<PathReference[]>(LEARN_PATHS_URL);

export function loadLearnPaths(): Promise<PathReference[]> {
  return cache.load().catch(() => []);
}

export const resetLearnPaths = cache.reset;
