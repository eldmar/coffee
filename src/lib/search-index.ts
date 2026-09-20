import { cachedJson } from './json-cache';
import type { SearchDoc } from './search';

/**
 * Browser half of the search corpus.
 *
 * The index is a static file rather than island props (see
 * src/pages/search-index.json.ts), so the page paints its search box before
 * the corpus has arrived. The request starts on mount — anyone on /search/ is
 * about to search, and the worst place to add latency is the first keystroke.
 *
 * A failure rejects rather than resolving empty: search is the whole page, so
 * the component says so instead of pretending nothing matched.
 */
export const SEARCH_INDEX_URL = '/search-index.json';

const cache = cachedJson<SearchDoc[]>(SEARCH_INDEX_URL);

export const loadSearchIndex = cache.load;
export const resetSearchIndex = cache.reset;
