import { describe, expect, it } from 'vitest';
import { recipeKeywords, recipeStepName } from './recipes';

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
