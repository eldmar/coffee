export const ESPRESSO_RATIOS = [1.5, 2, 2.5, 3] as const;

export type EspressoRatio = (typeof ESPRESSO_RATIOS)[number];

export function targetEspressoYield(dose: number, ratio: number): number | null {
  if (!Number.isFinite(dose) || dose <= 0 || !ESPRESSO_RATIOS.includes(ratio as EspressoRatio)) {
    return null;
  }

  return Math.round(dose * ratio * 10) / 10;
}

export function formatEspressoAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}
