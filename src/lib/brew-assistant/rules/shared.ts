import type { BrewDiagnosis, BrewInput, Taste } from '../types';

/** A rule looks at one brew and either claims it or passes. */
export interface Rule {
  id: string;
  /** Lower runs first. Mirrors the priority order in the spec. */
  priority: number;
  test: (input: BrewInput, metrics: Metrics) => boolean;
  build: (input: BrewInput, metrics: Metrics) => BrewDiagnosis;
}

export interface Metrics {
  /** Espresso: yield ÷ dose. Filter: water ÷ dose. */
  ratio: number;
  /** Espresso only, grams per second. */
  flowRate: number;
  /** Filter only, grams of coffee per litre of water. */
  coffeePerLitre: number;
}

export function metricsFor(input: BrewInput): Metrics {
  const out = input.yieldOut ?? input.water ?? 0;
  return {
    ratio: input.dose > 0 ? out / input.dose : 0,
    flowRate: input.time > 0 ? out / input.time : 0,
    coffeePerLitre: out > 0 ? (input.dose / out) * 1000 : 0,
  };
}

export const has = (input: BrewInput, ...tastes: Taste[]) =>
  tastes.some((taste) => input.tastes.includes(taste));

/** Under-extraction reads as sharp and empty rather than simply light. */
export const tastesUnder = (input: BrewInput) => has(input, 'sour', 'weak', 'hollow');
export const tastesOver = (input: BrewInput) => has(input, 'bitter', 'dry');

export const round = (value: number, step = 1) => Math.round(value / step) * step;

/**
 * Pick the first rule that claims the brew. Only one adjustment is ever
 * returned: two at once and the next brew cannot tell you which one worked.
 */
export function firstMatch(rules: Rule[], input: BrewInput): BrewDiagnosis | null {
  const metrics = metricsFor(input);
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (rule.test(input, metrics)) return rule.build(input, metrics);
  }
  return null;
}

/** Used when the answers cannot separate concentration from extraction. */
export function clarify(
  input: BrewInput,
  ruleId: string,
  question: string,
  related: string[],
): BrewDiagnosis {
  return {
    method: input.method,
    diagnosis: 'There is not quite enough here to point at one change.',
    adjustment: null,
    keepConstant: [],
    nextTarget: {},
    reasons: [],
    relatedContent: related,
    ruleId,
    needsClarification: true,
    clarificationQuestion: question,
  };
}
