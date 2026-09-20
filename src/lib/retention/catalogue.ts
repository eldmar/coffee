import { cachedJson } from '../json-cache';
import type { RetentionRecipe } from '../../components/retention/RetentionRecipeCard';

/**
 * The recipe catalogue the retention widgets render from.
 *
 * It used to travel as island props, which meant every visitor downloaded the
 * whole catalogue inside the HTML — twice on the homepage and on /recipes/,
 * where two islands each carried their own copy — even though Recently viewed
 * and Saved recipes show nothing at all until you have browsed or saved
 * something. Now the catalogue is a static file the widgets fetch only once
 * they know they have something to show, so a first-time visitor never pays
 * for it.
 *
 * A failed load resolves to an empty catalogue: the widgets then render
 * nothing, exactly as they do for a first-time visitor.
 */
export const RETENTION_CATALOGUE_URL = '/recipes-index.json';

const cache = cachedJson<RetentionRecipe[]>(RETENTION_CATALOGUE_URL);

export function loadRetentionCatalogue(): Promise<RetentionRecipe[]> {
  return cache.load().catch(() => []);
}

export const resetRetentionCatalogue = cache.reset;
