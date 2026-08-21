import { describe, expect, it } from 'vitest';
import {
  formatIngredient,
  parseRecipeSettings,
  recipeShareUrl,
  scaleInstructionMeasurements,
  type EspressoRecipe,
} from './recipe-scaling';

const espresso: EspressoRecipe = { dose: 18, ratio: 2 };

describe('structured ingredient scaling', () => {
  it('scales ranges and leaves text amounts unchanged', () => {
    expect(
      formatIngredient(
        { name: 'brown sugar', amountMin: 8, amountMax: 10, unit: 'g' },
        { servings: 2, units: 'metric' },
      ),
    ).toBe('16–20 g brown sugar');
    expect(
      formatIngredient(
        { name: 'ice', displayAmount: 'as needed', scalable: false },
        { servings: 3, units: 'metric' },
      ),
    ).toBe('as needed ice');
  });

  it('uses the selected espresso dose and fixed ratio without changing milk independently', () => {
    const settings = { servings: 2 as const, units: 'metric' as const, dose: 20 };
    expect(
      formatIngredient(
        { name: 'coffee', amount: 18, unit: 'g', role: 'coffee-dose' },
        settings,
        espresso,
      ),
    ).toBe('40 g coffee');
    expect(
      formatIngredient(
        { name: 'espresso, target yield', amount: 36, unit: 'g', role: 'espresso-yield' },
        settings,
        espresso,
      ),
    ).toBe('80 g espresso, target yield');
    expect(
      formatIngredient({ name: 'milk', amount: 150, unit: 'ml' }, settings, espresso),
    ).toBe('300 ml milk');
  });

  it('converts metric mass, volume, and temperature to US customary units', () => {
    expect(
      formatIngredient(
        { name: 'water', amount: 250, unit: 'ml', temperatureC: 93 },
        { servings: 1, units: 'us' },
      ),
    ).toBe('8.5 US fl oz water at 199 °F');
    expect(
      formatIngredient(
        { name: 'coffee', amount: 18, unit: 'g', role: 'coffee-dose' },
        { servings: 1, units: 'us' },
      ),
    ).toBe('0.6 oz coffee');
  });
});

describe('recipe settings URLs', () => {
  it('accepts only safe parameters and restores defaults', () => {
    expect(parseRecipeSettings('?servings=3&units=us&dose=20.04', 'metric', espresso)).toEqual({
      servings: 3,
      units: 'us',
      dose: 20,
    });
    expect(parseRecipeSettings('?servings=8&units=imperial&dose=500', 'metric', espresso)).toEqual({
      servings: 1,
      units: 'metric',
      dose: 18,
    });
  });

  it('shares current settings while leaving the canonical path available separately', () => {
    expect(
      recipeShareUrl(
        'https://kavovo.uk/recipes/espresso/?old=yes#steps',
        { servings: 2, units: 'metric', dose: 20 },
        espresso,
      ),
    ).toBe('https://kavovo.uk/recipes/espresso/?servings=2&units=metric&dose=20');
  });
});

describe('Brew Mode measurements', () => {
  it('scales mass and volume but not seconds or temperature', () => {
    expect(
      scaleInstructionMeasurements(
        'Use 18 g coffee and 150 ml milk for 30 seconds at 60 °C.',
        { servings: 2, units: 'metric', dose: 20 },
        espresso,
      ),
    ).toBe('Use 40 g coffee and 300 ml milk for 30 seconds at 60 °C.');
  });

  it('converts Brew Mode measurements and collapses an espresso range to its target', () => {
    expect(
      scaleInstructionMeasurements(
        'Brew 36–40 g espresso and add 120 ml water at 93 °C.',
        { servings: 1, units: 'us', dose: 20 },
        espresso,
      ),
    ).toBe('Brew 1.4 oz espresso and add 4.1 US fl oz water at 199 °F.');
  });
});
