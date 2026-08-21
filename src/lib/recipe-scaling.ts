import type { UnitPreference } from './retention/storage';

export type IngredientUnit = 'g' | 'ml' | 'tsp' | 'tbsp';
export type IngredientRole = 'ingredient' | 'coffee-dose' | 'espresso-yield';

export interface StructuredIngredient {
  name: string;
  amount?: number;
  amountMin?: number;
  amountMax?: number;
  unit?: IngredientUnit;
  displayAmount?: string;
  scalable?: boolean;
  role?: IngredientRole;
  temperatureC?: number;
  note?: string;
}

export interface EspressoRecipe {
  dose: number;
  ratio: number;
}

export interface RecipeSettings {
  servings: 1 | 2 | 3;
  units: UnitPreference;
  dose?: number;
}

export interface RecipeSettingsEventDetail extends RecipeSettings {
  ingredientLines: string[];
  doseLabel?: string;
  yieldLabel?: string;
}

const GRAMS_TO_OUNCES = 0.03527396195;
const ML_TO_US_FL_OZ = 0.0338140227;

function roundTo(value: number, increment: number): number {
  return Math.round((value + Number.EPSILON) / increment) * increment;
}

function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(/\.0+$|(?<=\.[0-9]*)0+$/g, '').replace(/\.$/, '');
}

function convertAmount(
  amount: number,
  unit: IngredientUnit | undefined,
  units: UnitPreference,
  role: IngredientRole,
): { amount: number; unit?: string; decimals: number } {
  if (!unit) {
    return { amount: roundTo(amount, 0.5), decimals: 1 };
  }

  if (units === 'us' && unit === 'g') {
    return { amount: roundTo(amount * GRAMS_TO_OUNCES, 0.1), unit: 'oz', decimals: 1 };
  }
  if (units === 'us' && unit === 'ml') {
    return {
      amount: roundTo(amount * ML_TO_US_FL_OZ, 0.1),
      unit: 'US fl oz',
      decimals: 1,
    };
  }
  if (unit === 'ml') return { amount: roundTo(amount, 1), unit, decimals: 0 };
  if (unit === 'tsp' || unit === 'tbsp') {
    return { amount: roundTo(amount, 0.25), unit, decimals: 2 };
  }
  return {
    amount: roundTo(amount, role === 'coffee-dose' || role === 'espresso-yield' ? 0.1 : 0.1),
    unit,
    decimals: 1,
  };
}

export function formatQuantity(
  amount: number,
  unit: IngredientUnit | undefined,
  units: UnitPreference,
  role: IngredientRole = 'ingredient',
): string {
  const converted = convertAmount(amount, unit, units, role);
  return `${formatNumber(converted.amount, converted.decimals)}${converted.unit ? ` ${converted.unit}` : ''}`;
}

function ingredientBaseAmount(
  amount: number,
  role: IngredientRole,
  settings: RecipeSettings,
  espresso?: EspressoRecipe,
): number {
  if (role === 'coffee-dose' && settings.dose !== undefined) return settings.dose;
  if (role === 'espresso-yield' && settings.dose !== undefined && espresso) {
    return settings.dose * espresso.ratio;
  }
  return amount;
}

function formatTemperature(celsius: number, units: UnitPreference): string {
  if (units === 'us') return `${Math.round((celsius * 9) / 5 + 32)} °F`;
  return `${formatNumber(celsius, 1)} °C`;
}

export function formatIngredient(
  ingredient: StructuredIngredient,
  settings: RecipeSettings,
  espresso?: EspressoRecipe,
): string {
  const role = ingredient.role ?? 'ingredient';
  const factor = ingredient.scalable === false ? 1 : settings.servings;
  let amountText = ingredient.displayAmount;

  if (ingredient.amount !== undefined) {
    const base = ingredientBaseAmount(ingredient.amount, role, settings, espresso);
    const converted = convertAmount(base * factor, ingredient.unit, settings.units, role);
    amountText = `${formatNumber(converted.amount, converted.decimals)}${converted.unit ? ` ${converted.unit}` : ''}`;
  } else if (ingredient.amountMin !== undefined && ingredient.amountMax !== undefined) {
    const min = convertAmount(ingredient.amountMin * factor, ingredient.unit, settings.units, role);
    const max = convertAmount(ingredient.amountMax * factor, ingredient.unit, settings.units, role);
    amountText = `${formatNumber(min.amount, min.decimals)}–${formatNumber(max.amount, max.decimals)}${min.unit ? ` ${min.unit}` : ''}`;
  }

  const temperature =
    ingredient.temperatureC === undefined
      ? ''
      : ` at ${formatTemperature(ingredient.temperatureC, settings.units)}`;
  const note = ingredient.note ? ` (${ingredient.note})` : '';
  return `${amountText ?? ''}${amountText ? ' ' : ''}${ingredient.name}${temperature}${note}`.trim();
}

export function formatIngredients(
  ingredients: StructuredIngredient[],
  settings: RecipeSettings,
  espresso?: EspressoRecipe,
): string[] {
  return ingredients.map((ingredient) => formatIngredient(ingredient, settings, espresso));
}

export function parseRecipeSettings(
  search: string,
  preferredUnits: UnitPreference,
  espresso?: EspressoRecipe,
): RecipeSettings {
  const params = new URLSearchParams(search);
  const servingsValue = Number(params.get('servings'));
  const servings: 1 | 2 | 3 =
    servingsValue === 2 || servingsValue === 3 ? servingsValue : 1;
  const rawUnits = params.get('units');
  const units: UnitPreference = rawUnits === 'metric' || rawUnits === 'us' ? rawUnits : preferredUnits;
  const rawDose = Number(params.get('dose'));
  const dose =
    espresso && Number.isFinite(rawDose) && rawDose >= 5 && rawDose <= 60
      ? roundTo(rawDose, 0.1)
      : espresso?.dose;
  return { servings, units, ...(dose !== undefined ? { dose } : {}) };
}

export function recipeShareUrl(
  baseUrl: string,
  settings: RecipeSettings,
  espresso?: EspressoRecipe,
): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('servings', String(settings.servings));
  url.searchParams.set('units', settings.units);
  if (espresso && settings.dose !== undefined) {
    url.searchParams.set('dose', formatNumber(settings.dose, 1));
  }
  return url.toString();
}

function closeTo(value: number, expected: number): boolean {
  return Math.abs(value - expected) <= Math.max(0.11, expected * 0.025);
}

/**
 * Steps remain editorial prose, so only recognised measurement tokens are
 * transformed here. Seconds, minutes, ratios and temperatures are never
 * multiplied; temperature is converted separately for US customary mode.
 */
export function scaleInstructionMeasurements(
  text: string,
  settings: RecipeSettings,
  espresso?: EspressoRecipe,
): string {
  const measurementPattern = /(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*(g|ml)\b/gi;
  let scaled = text.replace(
    measurementPattern,
    (_match, rawMin: string, rawMax: string | undefined, rawUnit: string) => {
      const unit = rawUnit.toLowerCase() as 'g' | 'ml';
      const min = Number(rawMin);
      const max = rawMax === undefined ? undefined : Number(rawMax);
      let nextMin = min * settings.servings;
      let nextMax = max === undefined ? undefined : max * settings.servings;

      if (unit === 'g' && espresso && settings.dose !== undefined) {
        const baseYield = espresso.dose * espresso.ratio;
        const isDose = closeTo(min, espresso.dose) && max === undefined;
        const isYield =
          closeTo(min, baseYield) ||
          (max !== undefined && (closeTo(max, baseYield) || (min <= baseYield && max >= baseYield)));
        if (isDose) {
          nextMin = settings.dose * settings.servings;
          nextMax = undefined;
        } else if (isYield) {
          nextMin = settings.dose * espresso.ratio * settings.servings;
          nextMax = undefined;
        }
      }

      const convertedMin = convertAmount(nextMin, unit, settings.units, 'ingredient');
      if (nextMax === undefined) {
        return `${formatNumber(convertedMin.amount, convertedMin.decimals)} ${convertedMin.unit}`;
      }
      const convertedMax = convertAmount(nextMax, unit, settings.units, 'ingredient');
      return `${formatNumber(convertedMin.amount, convertedMin.decimals)}–${formatNumber(convertedMax.amount, convertedMax.decimals)} ${convertedMin.unit}`;
    },
  );

  if (settings.units === 'us') {
    scaled = scaled.replace(
      /(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*°\s*C\b/gi,
      (_match, rawMin: string, rawMax: string | undefined) => {
        const toFahrenheit = (value: string) => Math.round((Number(value) * 9) / 5 + 32);
        return rawMax
          ? `${toFahrenheit(rawMin)}–${toFahrenheit(rawMax)} °F`
          : `${toFahrenheit(rawMin)} °F`;
      },
    );
  }
  return scaled;
}
