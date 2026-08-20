export interface RecipeFilterState {
  query: string;
  method: string;
  temp: 'any' | 'hot' | 'iced';
  milk: 'any' | 'black' | 'milk';
}

interface RecipeFilterInput {
  query?: string;
  method?: string;
  temp?: string;
  milk?: string;
}

const METHODS = new Set([
  'espresso',
  'aeropress',
  'v60',
  'french-press',
  'moka-pot',
  'cold-brew',
  'filter',
  'phin',
  'cezve',
]);

/** Parse only the public URL contract; unsupported and legacy values are ignored. */
export function parseRecipeFilterSearch(search: string): RecipeFilterState {
  const params = new URLSearchParams(search);
  const method = params.get('method');
  const temperature = params.get('temperature');
  const milk = params.get('milk');
  return {
    query: params.get('q') ?? '',
    method: method && METHODS.has(method) ? method : 'any',
    temp: temperature === 'hot' || temperature === 'iced' ? temperature : 'any',
    milk: milk === 'black' ? 'black' : milk === 'with-milk' ? 'milk' : 'any',
  };
}

/** Create the canonical query used by the catalogue and homepage finder. */
export function serialiseRecipeFilters({
  query = '',
  method = 'any',
  temp = 'any',
  milk = 'any',
}: RecipeFilterInput): string {
  const params = new URLSearchParams();
  const cleanQuery = query.trim();
  if (cleanQuery) params.set('q', cleanQuery);
  if (method !== 'any' && METHODS.has(method)) params.set('method', method);
  if (temp === 'hot' || temp === 'iced') params.set('temperature', temp);
  if (milk === 'black') params.set('milk', 'black');
  if (milk === 'milk') params.set('milk', 'with-milk');
  return params.toString();
}
