import { describe, expect, it } from 'vitest';
import { extractFaqs, recipeKeywords, recipeStepName, scaleRecipeMeasurements } from './recipes';

describe('recipe structured data helpers', () => {
  it('builds keyword descriptors without repeating the schema category or cuisine', () => {
    expect(
      recipeKeywords({
        title: 'Iced Latte',
        brewMethod: 'espresso',
        temperature: 'iced',
        milk: 'milk',
      }),
    ).toBe('Iced Latte recipe, espresso-based drink, served over ice, milk-based coffee');
  });

  it('does not repeat recipe when the editorial title already includes it', () => {
    expect(
      recipeKeywords({
        title: 'Iced Americano Recipe',
        brewMethod: 'espresso',
        temperature: 'iced',
        milk: 'black',
      }),
    ).toBe('Iced Americano Recipe, espresso-based drink, served over ice');
  });

  it('derives a short step name from the first action', () => {
    expect(
      recipeStepName(
        'Grind 18 g of coffee and brew a double espresso. Aim for a final yield of 36 g.',
      ),
    ).toBe('Grind 18 g of coffee and brew a double espresso');
  });

  it('removes measurement asides from a step name', () => {
    expect(
      recipeStepName(
        'Pull a double shot (18 g in, about 36 g out in 25 seconds) into a 160 ml cup.',
      ),
    ).toBe('Pull a double shot into a 160 ml cup');
  });

  it('does not leave a shortened step name ending on an incomplete word', () => {
    expect(
      recipeStepName('Heat the milk to 60–65 °C without bringing it to a boil.'),
    ).toBe('Heat the milk to 60–65 °C without bringing it to a boil');
    expect(
      recipeStepName('Tamp level with firm, even pressure.'),
    ).toBe('Tamp level with firm, even pressure');
    expect(
      recipeStepName(
        'Pour steadily so the drink settles into thirds: espresso, warm milk, and a deep cap of foam.',
      ),
    ).toBe(
      'Pour steadily so the drink settles into thirds: espresso, warm milk, and a deep cap of foam',
    );
  });
});

describe('recipe serving helpers', () => {
  it('scales coffee and water without changing brew times', () => {
    expect(
      scaleRecipeMeasurements(
        'Add 15 g coffee, bloom with 45 ml, then pour to 250 g by 2:00.',
        2,
      ),
    ).toBe('Add 30 g coffee, bloom with 90 ml, then pour to 500 g by 2:00.');
  });

  it('keeps half-gram quantities when scaling an odd dose', () => {
    expect(scaleRecipeMeasurements('Use 15 g coffee and 250 ml water.', 1.5)).toBe(
      'Use 22.5 g coffee and 375 ml water.',
    );
  });

  it('returns the original text for an invalid scale', () => {
    expect(scaleRecipeMeasurements('15 g coffee', 0)).toBe('15 g coffee');
  });
});

describe('recipe FAQ extraction', () => {
  it('uses the visible FAQ section as structured-data source', () => {
    expect(
      extractFaqs(`
## Frequently asked questions

### What is the ratio?

Use **one part coffee** to two parts water.

### Can I add milk?

Yes. Read the [milk guide](/learn/milk/) first.
`),
    ).toEqual([
      { question: 'What is the ratio?', answer: 'Use one part coffee to two parts water.' },
      { question: 'Can I add milk?', answer: 'Yes. Read the milk guide first.' },
    ]);
  });

  it('returns no FAQ data when the visible section is absent', () => {
    expect(extractFaqs('## Steps\n\n1. Brew coffee.')).toEqual([]);
  });

  it('stops before a following HTML callout', () => {
    expect(
      extractFaqs(`
## Frequently asked questions

### Can I use a paper filter?

Yes, rinse it first.

<div class="callout">

## Key takeaway

Keep the recipe repeatable.
`),
    ).toEqual([
      { question: 'Can I use a paper filter?', answer: 'Yes, rinse it first.' },
    ]);
  });
});
