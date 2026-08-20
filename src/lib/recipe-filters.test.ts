import { describe, expect, it, vi } from 'vitest';
import {
  parseRecipeFilterSearch,
  serialiseRecipeFilters,
  syncRecipeFilterUrl,
} from './recipe-filters';

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

  it('replaces only the initial URL while removing unknown parameters', () => {
    const location = {
      pathname: '/recipes/',
      search: '?method=espresso&temperature=iced&unknown=value',
      hash: '',
    };
    const history = {
      state: null,
      pushState: vi.fn(),
      replaceState: vi.fn(),
    };

    syncRecipeFilterUrl(
      parseRecipeFilterSearch(location.search),
      location,
      history,
      'normalise',
    );

    expect(history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/recipes/?method=espresso&temperature=iced',
    );
    expect(history.pushState).not.toHaveBeenCalled();
  });

  it('pushes user changes so Back can restore the previous filter combination', () => {
    const icedSearch = '?method=espresso&temperature=iced&milk=with-milk';
    const location = { pathname: '/recipes/', search: icedSearch, hash: '' };
    const history = {
      state: null,
      pushState: vi.fn(),
      replaceState: vi.fn(),
    };

    syncRecipeFilterUrl(
      { method: 'espresso', temp: 'hot', milk: 'milk' },
      location,
      history,
      'user',
    );

    expect(history.pushState).toHaveBeenCalledWith(
      null,
      '',
      '/recipes/?method=espresso&temperature=hot&milk=with-milk',
    );
    expect(history.replaceState).not.toHaveBeenCalled();

    // Back restores the prior URL first; popstate then reads it into React state.
    const restored = parseRecipeFilterSearch(icedSearch);
    expect(restored).toEqual({ query: '', method: 'espresso', temp: 'iced', milk: 'milk' });

    syncRecipeFilterUrl(restored, location, history, 'user');
    expect(history.pushState).toHaveBeenCalledTimes(1);
  });
});
