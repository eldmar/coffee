export const RATIO_STRENGTHS = ['strong', 'balanced', 'light'] as const;
export type RatioStrength = (typeof RATIO_STRENGTHS)[number];

export const COFFEE_RATIO_METHODS = [
  {
    id: 'espresso',
    label: 'Espresso',
    ratios: { strong: 1.5, balanced: 2, light: 2.5 },
    resultLabel: 'Recommended espresso yield',
    unit: 'g',
    note: 'Espresso compares dry coffee with the beverage in the cup, not all water used by the machine.',
  },
  {
    id: 'pour-over',
    label: 'Pour Over',
    ratios: { strong: 15, balanced: 16, light: 17 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'Use the calculated water as your total pour weight.',
  },
  {
    id: 'french-press',
    label: 'French Press',
    ratios: { strong: 14, balanced: 15, light: 16 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'Add all the calculated water at the start of the immersion.',
  },
  {
    id: 'aeropress',
    label: 'AeroPress',
    ratios: { strong: 12, balanced: 14, light: 16 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'This is a direct-drinking recipe; concentrated AeroPress recipes may use less water and dilute afterwards.',
  },
  {
    id: 'moka-pot',
    label: 'Moka Pot',
    ratios: null,
    resultLabel: 'Recommended fill',
    unit: '',
    note: 'Fill the basket level with coffee and the reservoir to just below the safety valve. Brewer size determines both amounts.',
  },
  {
    id: 'cold-brew',
    label: 'Cold Brew',
    ratios: { strong: 8, balanced: 10, light: 12 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'This range makes cold brew that is ready to drink after filtering.',
  },
  {
    id: 'cold-brew-concentrate',
    label: 'Cold Brew Concentrate',
    ratios: { strong: 4, balanced: 5, light: 6 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'Dilute the filtered concentrate with water or milk before serving.',
  },
] as const;

export type CoffeeRatioMethodId = (typeof COFFEE_RATIO_METHODS)[number]['id'];

export function calculateCoffeeRatio(
  methodId: CoffeeRatioMethodId,
  coffeeGrams: number,
  strength: RatioStrength,
) {
  const method = COFFEE_RATIO_METHODS.find((candidate) => candidate.id === methodId);
  if (!method || !Number.isFinite(coffeeGrams) || coffeeGrams <= 0) return undefined;

  if (method.ratios === null) {
    return { method, ratio: undefined, amount: undefined };
  }

  const ratio = method.ratios[strength];
  return {
    method,
    ratio,
    amount: Math.round(coffeeGrams * ratio),
  };
}
