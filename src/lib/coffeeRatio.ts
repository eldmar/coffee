export const RATIO_STRENGTHS = ['strong', 'balanced', 'light'] as const;
export type RatioStrength = (typeof RATIO_STRENGTHS)[number];

export const RATIO_UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type RatioUnitSystem = (typeof RATIO_UNIT_SYSTEMS)[number];

const GRAMS_PER_OUNCE = 28.349523125;
const MILLILITRES_PER_FLUID_OUNCE = 29.5735295625;

export const COFFEE_RATIO_METHODS = [
  {
    id: 'filter-coffee',
    label: 'Filter Coffee',
    ratios: { strong: 15, balanced: 16.7, light: 17 },
    resultLabel: 'Recommended water',
    unit: 'ml',
    note: 'Use the calculated water as the total amount added during the brew.',
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
    id: 'espresso',
    label: 'Espresso',
    ratios: { strong: 1.5, balanced: 2, light: 2.5 },
    resultLabel: 'Recommended espresso yield',
    unit: 'g',
    note: 'Espresso compares dry coffee with the beverage in the cup, not all water used by the machine.',
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

export function coffeeDoseToGrams(amount: number, unitSystem: RatioUnitSystem) {
  return unitSystem === 'imperial' ? amount * GRAMS_PER_OUNCE : amount;
}

export function coffeeDoseFromGrams(grams: number, unitSystem: RatioUnitSystem) {
  return unitSystem === 'imperial' ? grams / GRAMS_PER_OUNCE : grams;
}

export function ratioResultForUnits(
  amount: number,
  metricUnit: 'g' | 'ml',
  unitSystem: RatioUnitSystem,
) {
  if (unitSystem === 'metric') return { amount, unit: metricUnit };

  const divisor = metricUnit === 'g' ? GRAMS_PER_OUNCE : MILLILITRES_PER_FLUID_OUNCE;
  return {
    amount: Math.round((amount / divisor) * 100) / 100,
    unit: metricUnit === 'g' ? 'oz' : 'fl oz',
  };
}

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
