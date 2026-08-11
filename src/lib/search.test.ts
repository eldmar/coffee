import { describe, expect, it } from 'vitest';
import {
  filterSearchResults,
  highlightSearchText,
  isSearchTypeFilter,
  normalizeSearchText,
  rankSearchDocs,
  type SearchDoc,
} from './search';

const doc = (overrides: Partial<SearchDoc>): SearchDoc => ({
  type: 'recipe',
  title: 'Untitled',
  description: '',
  url: '/untitled/',
  keywords: '',
  body: '',
  ...overrides,
});

describe('search ranking', () => {
  it('uses the specified title, metadata, summary, and body weights', () => {
    const results = rankSearchDocs(
      [
        doc({ title: 'Coffee basics', body: 'A passing mention of espresso.' }),
        doc({ title: 'Dial in your coffee', description: 'A clear espresso summary.' }),
        doc({ title: 'Coffee glossary', keywords: 'espresso' }),
        doc({ title: 'Espresso tonic' }),
        doc({ title: 'Espresso' }),
      ],
      'espresso',
    );

    expect(results.map(({ doc: result, score }) => [result.title, score])).toEqual([
      ['Espresso', 100],
      ['Espresso tonic', 80],
      ['Coffee glossary', 40],
      ['Dial in your coffee', 20],
      ['Coffee basics', 5],
    ]);
  });

  it('normalizes case and diacritics', () => {
    const results = rankSearchDocs(
      [doc({ title: 'Café Cubano', url: '/cafe-cubano/' })],
      'CAFE',
    );

    expect(results[0]).toMatchObject({ score: 80, doc: { url: '/cafe-cubano/' } });
    expect(normalizeSearchText('Crème BRÛLÉE')).toBe('creme brulee');
    expect(highlightSearchText('Café Cubano', 'cafe')).toEqual([
      { text: 'Café', match: true },
      { text: ' Cubano', match: false },
    ]);
  });

  it('gives compact summaries the same weight as descriptions', () => {
    const results = rankSearchDocs(
      [doc({ title: 'V60 guide', summary: 'A bright espresso-style concentrate.' })],
      'espresso',
    );

    expect(results[0].score).toBe(20);
  });

  it('treats common singular and plural forms alike', () => {
    const results = rankSearchDocs(
      [doc({ title: 'Coffee recipe' }), doc({ title: 'Coffee equipment' })],
      'recipes',
    );

    expect(results).toHaveLength(1);
    expect(results[0].doc.title).toBe('Coffee recipe');
  });

  it('requires every query term while allowing terms to span fields', () => {
    const results = rankSearchDocs(
      [
        doc({ title: 'Espresso', body: 'grind size and extraction' }),
        doc({ title: 'Espresso tonic', body: 'serve over ice' }),
      ],
      'espresso grind',
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ score: 5, doc: { title: 'Espresso' } });
  });

  it('filters ranked results by a URL-safe content type', () => {
    const ranked = rankSearchDocs(
      [
        doc({ type: 'recipe', title: 'Espresso recipe' }),
        doc({ type: 'guide', title: 'Espresso guide', url: '/guides/espresso/' }),
      ],
      'espresso',
    );

    expect(filterSearchResults(ranked, 'guide').map(({ doc: result }) => result.url)).toEqual([
      '/guides/espresso/',
    ]);
    expect(filterSearchResults(ranked, 'all')).toBe(ranked);
    expect(isSearchTypeFilter('journal')).toBe(true);
    expect(isSearchTypeFilter('video')).toBe(false);
  });
});
