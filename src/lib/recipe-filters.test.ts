import { describe, expect, it } from 'vitest';
import { parseRecipeFilterSearch, serialiseRecipeFilters } from './recipe-filters';

describe('recipe filter URLs', () => {
  it('restores the documented filters after a reload', () => {
    expect(
      parseRecipeFilterSearch('?method=espresso&temperature=iced&milk=with-milk'),
    ).toEqual({ query: '', method: 'espresso', temp: 'iced', milk: 'milk' });
  });

  it('ignores unknown and legacy parameter values', () => {
    expect(parseRecipeFilterSearch('?method=other&temp=iced&milk=milk')).toEqual({
      query: '',
      method: 'any',
      temp: 'any',
      milk: 'any',
    });
  });

  it('writes the canonical query contract', () => {
    expect(
      serialiseRecipeFilters({ method: 'v60', temp: 'iced', milk: 'milk' }),
    ).toBe('method=v60&temperature=iced&milk=with-milk');
  });

  it('clears the query when every filter is reset', () => {
    expect(serialiseRecipeFilters({ query: '', method: 'any', temp: 'any', milk: 'any' })).toBe('');
  });
});
