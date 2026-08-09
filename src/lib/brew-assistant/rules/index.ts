import type { BrewDiagnosis, BrewInput, Method } from '../types';
import { espressoRules } from './espresso';
import { aeropressRules, frenchPressRules, v60Rules } from './filter';
import { clarify, firstMatch, type Rule } from './shared';

const RULES: Record<Method, Rule[]> = {
  espresso: espressoRules,
  v60: v60Rules,
  aeropress: aeropressRules,
  'french-press': frenchPressRules,
};

const CLARIFY_QUESTION: Record<Method, string> = {
  espresso: 'Did the shot reach its final weight faster or slower than you expected?',
  v60: 'Did the water drain faster or slower than you expected?',
  aeropress: 'Was the plunger easier or harder to push than usual?',
  'french-press': 'Was there more sediment than usual, or was the plunger hard to push?',
};

const GUIDE_KEY: Record<Method, string> = {
  espresso: 'espressoGuide',
  v60: 'v60Guide',
  aeropress: 'aeropressGuide',
  'french-press': 'frenchPressGuide',
};

/**
 * Turn one recorded brew into one adjustment.
 *
 * Contradictory or thin answers get a single question rather than a guess: a
 * confident diagnosis from data that cannot support one is worse than asking.
 */
export function diagnose(input: BrewInput): BrewDiagnosis {
  const contradictory =
    (input.behaviour === 'espresso-fast' && input.time > 40) ||
    (input.behaviour === 'espresso-slow' && input.time < 15);

  const noSignal =
    (input.tastes.length === 0 || input.tastes.includes('unsure')) && input.behaviour === 'none';

  if (contradictory || noSignal) {
    return clarify(input, `${input.method}_needs_detail`, CLARIFY_QUESTION[input.method], [
      GUIDE_KEY[input.method],
      'tasting',
    ]);
  }

  const match = firstMatch(RULES[input.method], input);
  if (match) return match;

  // Everything is in range and nothing tastes wrong: say so rather than inventing work.
  return clarify(input, `${input.method}_no_fault_found`, CLARIFY_QUESTION[input.method], [
    GUIDE_KEY[input.method],
    'tasting',
  ]);
}

export { RULES };
