import { describe, expect, it } from 'vitest';
import {
  calculateCoffeeRatio,
  coffeeDoseFromGrams,
  coffeeDoseToGrams,
  ratioResultForUnits,
} from './coffeeRatio';

describe('coffee-to-water ratio calculator', () => {
  it('calculates balanced pour-over water from the coffee dose', () => {
    const result = calculateCoffeeRatio('pour-over', 18, 'balanced');
    expect(result?.ratio).toBe(16);
    expect(result?.amount).toBe(288);
    expect(result?.method.unit).toBe('ml');
  });

  it('uses the standard 60 g per litre starting point for filter coffee', () => {
    const result = calculateCoffeeRatio('filter-coffee', 15, 'balanced');
    expect(result?.ratio).toBe(16.7);
    expect(result?.amount).toBe(251);
  });

  it('converts US customary coffee doses and results without changing the ratio', () => {
    const coffeeGrams = coffeeDoseToGrams(1, 'imperial');
    const result = calculateCoffeeRatio('filter-coffee', coffeeGrams, 'balanced');
    const converted = ratioResultForUnits(result?.amount ?? 0, 'ml', 'imperial');

    expect(coffeeGrams).toBeCloseTo(28.35, 2);
    expect(coffeeDoseFromGrams(coffeeGrams, 'imperial')).toBeCloseTo(1, 5);
    expect(converted).toEqual({ amount: 15.99, unit: 'fl oz' });
  });

  it('labels espresso as beverage yield rather than brew water', () => {
    const result = calculateCoffeeRatio('espresso', 18, 'balanced');
    expect(result?.amount).toBe(36);
    expect(result?.method.resultLabel).toBe('Recommended espresso yield');
  });

  it('does not invent a universal Moka Pot ratio', () => {
    const result = calculateCoffeeRatio('moka-pot', 18, 'balanced');
    expect(result?.ratio).toBeUndefined();
    expect(result?.amount).toBeUndefined();
    expect(result?.method.note).toContain('safety valve');
  });

  it('rejects invalid coffee doses', () => {
    expect(calculateCoffeeRatio('french-press', 0, 'balanced')).toBeUndefined();
    expect(calculateCoffeeRatio('cold-brew', Number.NaN, 'strong')).toBeUndefined();
  });
});
