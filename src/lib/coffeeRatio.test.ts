import { describe, expect, it } from 'vitest';
import { calculateCoffeeRatio } from './coffeeRatio';

describe('coffee-to-water ratio calculator', () => {
  it('calculates balanced pour-over water from the coffee dose', () => {
    const result = calculateCoffeeRatio('pour-over', 18, 'balanced');
    expect(result?.ratio).toBe(16);
    expect(result?.amount).toBe(288);
    expect(result?.method.unit).toBe('ml');
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
