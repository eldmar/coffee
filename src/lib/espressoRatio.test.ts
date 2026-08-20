import { describe, expect, it } from 'vitest';
import { formatEspressoAmount, targetEspressoYield } from './espressoRatio';

describe('espresso ratio calculator', () => {
  it('calculates the documented 1:2.5 example', () => {
    expect(targetEspressoYield(18, 2.5)).toBe(45);
  });

  it('supports every published ratio', () => {
    expect([1.5, 2, 2.5, 3].map((ratio) => targetEspressoYield(18, ratio))).toEqual([
      27, 36, 45, 54,
    ]);
  });

  it('rejects an unsupported ratio or invalid dose', () => {
    expect(targetEspressoYield(18, 2.2)).toBeNull();
    expect(targetEspressoYield(0, 2)).toBeNull();
  });

  it('keeps only meaningful decimal precision', () => {
    expect(formatEspressoAmount(45)).toBe('45');
    expect(formatEspressoAmount(42.5)).toBe('42.5');
  });
});
