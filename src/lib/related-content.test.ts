import { describe, expect, it } from 'vitest';
import { relatedRecipeScore, selectRelatedRecipeSlugs, type RelatedRecipeData } from './related-content';

const source: RelatedRecipeData = {
  slug: 'iced-latte',
  title: 'Iced Latte',
  category: 'iced-coffee',
  brewMethod: 'espresso',
  temperature: 'iced',
  milk: 'milk',
  ingredientNames: ['coffee', 'vanilla syrup', 'milk', 'ice'],
  seasonalTags: ['summer'],
};

const candidate = (overrides: Partial<RelatedRecipeData>): RelatedRecipeData => ({
  slug: 'candidate',
  title: 'Candidate',
  category: 'espresso-drinks',
  brewMethod: 'filter',
  temperature: 'hot',
  milk: 'black',
  ingredientNames: ['coffee', 'water'],
  seasonalTags: [],
  ...overrides,
});

describe('related recipe scoring', () => {
  it('uses the documented category, method, temperature, milk, ingredient, and season weights', () => {
    expect(
      relatedRecipeScore(
        source,
        candidate({
          category: 'iced-coffee',
          brewMethod: 'espresso',
          temperature: 'iced',
          milk: 'milk',
          ingredientNames: ['vanilla syrup'],
          seasonalTags: ['summer'],
        }),
      ),
    ).toBe(12);
  });

  it('does not count generic coffee and water as a shared main ingredient', () => {
    expect(relatedRecipeScore(source, candidate({ ingredientNames: ['coffee', 'water'] }))).toBe(0);
  });
});

describe('related recipe selection', () => {
  const candidates = [
    candidate({ slug: 'alpha', category: 'iced-coffee', temperature: 'iced' }),
    candidate({ slug: 'beta', category: 'iced-coffee', brewMethod: 'espresso', temperature: 'iced' }),
    candidate({ slug: 'gamma', category: 'iced-coffee', brewMethod: 'espresso', temperature: 'iced' }),
    candidate({ slug: 'delta', category: 'milk-drinks', brewMethod: 'espresso', milk: 'milk' }),
  ];

  it('gives valid manual choices priority and excludes the current recipe', () => {
    expect(selectRelatedRecipeSlugs(source, [...candidates, source], ['delta'], 2)).toEqual([
      'delta',
      'beta',
    ]);
  });

  it('is stable and limits one category to two cards', () => {
    expect(selectRelatedRecipeSlugs(source, candidates, [], 3)).toEqual(['beta', 'gamma', 'delta']);
    expect(selectRelatedRecipeSlugs(source, [...candidates].reverse(), [], 3)).toEqual([
      'beta',
      'gamma',
      'delta',
    ]);
  });
});
