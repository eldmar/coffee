import type { BrewDiagnosis, BrewInput } from '../types';
import { has, round, tastesOver, tastesUnder, type Metrics, type Rule } from './shared';

/**
 * The starting zone for a double, not a standard every coffee must meet.
 * A light roast may want a longer ratio; a dark one may want a shorter.
 */
const TARGET_RATIO = 2.1;
const TARGET_TIME: [number, number] = [27, 30];

const targetYield = (input: BrewInput) => round(input.dose * TARGET_RATIO, 1);

/** Reached a normal yield well inside the usual window. */
const ranFast = (input: BrewInput, m: Metrics) =>
  input.behaviour === 'espresso-fast' || (input.time < 25 && m.ratio >= 1.8);

const ranSlow = (input: BrewInput, m: Metrics) =>
  input.behaviour === 'espresso-slow' || (input.time > 35 && m.ratio <= 2.4);

const base = (input: BrewInput): Pick<BrewDiagnosis, 'method' | 'needsClarification'> => ({
  method: input.method,
  needsClarification: false,
});

export const espressoRules: Rule[] = [
  // 2. Method-specific technical problem, before anything about taste.
  {
    id: 'espresso_channeling',
    priority: 20,
    test: (input) =>
      input.behaviour === 'espresso-spraying' ||
      (has(input, 'sour') && has(input, 'bitter')) ||
      (has(input, 'sour') && has(input, 'dry')),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot suggests water found an easy path through the puck.',
      adjustment: {
        variable: 'technique',
        direction: 'improve',
        title: 'Level the coffee before you tamp',
      },
      keepConstant: ['Grind', 'Dose', 'Yield', 'Temperature'],
      nextTarget: {
        dose: input.dose,
        yieldOut: input.yieldOut,
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'Tasting sour and bitter together, or a shot that sprays, usually points to uneven extraction rather than a grind that is simply too fine or too coarse.',
        'Break up clumps, level the bed and tamp flat on a stable surface. Leave the grinder alone until the flow looks even.',
      ],
      relatedContent: ['channeling', 'sourVsBitter'],
      ruleId: 'espresso_channeling',
    }),
  },

  // 3. Taste combined with how the shot ran.
  {
    id: 'espresso_fast_sour',
    priority: 30,
    test: (input, m) => ranFast(input, m) && tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot ran quickly and tasted under-extracted.',
      adjustment: { variable: 'grind', direction: 'finer', title: 'Grind slightly finer' },
      keepConstant: ['Dose', 'Temperature', 'Puck preparation'],
      nextTarget: {
        dose: input.dose,
        yieldOut: targetYield(input),
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'Water passed through the coffee before it had taken much from it, which is what sharp, thin, hollow shots usually mean.',
        'A finer grind should slow the flow and bring out more sweetness without changing anything else in the recipe.',
      ],
      relatedContent: ['sourVsBitter', 'grindFinerOrCoarser'],
      ruleId: 'espresso_fast_sour',
    }),
  },
  {
    id: 'espresso_slow_bitter',
    priority: 30,
    test: (input, m) => ranSlow(input, m) && tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot ran slowly and tasted over-extracted.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind slightly coarser' },
      keepConstant: ['Dose', 'Temperature', 'Puck preparation'],
      nextTarget: {
        dose: input.dose,
        yieldOut: targetYield(input),
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'The water spent longer with the coffee than it needed, which is where harsh, drying flavours come from.',
        'A coarser grind should speed the shot up and take the bitterness back without touching the dose.',
      ],
      relatedContent: ['sourVsBitter', 'grindFinerOrCoarser'],
      ruleId: 'espresso_slow_bitter',
    }),
  },

  // 4. Ratio, once the shot time itself looks reasonable.
  {
    id: 'espresso_ratio_diluted',
    priority: 40,
    test: (input, m) => m.ratio > 2.6 && has(input, 'weak', 'hollow'),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The drink is longer than the coffee can fill.',
      adjustment: { variable: 'yield', direction: 'decrease', title: 'Stop the shot earlier' },
      keepConstant: ['Grind', 'Dose', 'Temperature'],
      nextTarget: {
        dose: input.dose,
        yieldOut: targetYield(input),
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'At this ratio the shot is diluted rather than under-extracted, so grinding finer would make it harsh before it made it stronger.',
        'Stopping earlier concentrates the same coffee. Change the grind only once the strength feels right.',
      ],
      relatedContent: ['doseYieldTime', 'ratio'],
      ruleId: 'espresso_ratio_diluted',
    }),
  },
  {
    id: 'espresso_ratio_concentrated',
    priority: 40,
    test: (input, m) => m.ratio < 1.6 && has(input, 'strong') && !tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot is very concentrated, but not over-extracted.',
      adjustment: { variable: 'yield', direction: 'increase', title: 'Let the shot run a little longer' },
      keepConstant: ['Grind', 'Dose', 'Temperature'],
      nextTarget: {
        dose: input.dose,
        yieldOut: targetYield(input),
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'Nothing here suggests the coffee is over-extracted — there is simply very little water in the cup.',
        'A slightly longer yield dilutes it towards the usual starting zone without changing how it extracts.',
      ],
      relatedContent: ['doseYieldTime', 'ratio'],
      ruleId: 'espresso_ratio_concentrated',
    }),
  },

  // 5. Roast-specific temperature, once grind and ratio are not the story.
  {
    id: 'espresso_temperature_light',
    priority: 50,
    test: (input) => input.roast === 'light' && tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'A light roast that stays sour at a sensible shot time usually wants more energy.',
      adjustment: {
        variable: 'temperature',
        direction: 'increase',
        title: 'Raise the brew temperature slightly',
      },
      keepConstant: ['Grind', 'Dose', 'Yield'],
      nextTarget: {
        dose: input.dose,
        yieldOut: input.yieldOut,
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
        temperature: Math.min(96, (input.temperature ?? 93) + 1),
      },
      reasons: [
        'Light roasts are denser and less soluble, so the same recipe extracts less from them.',
        'A degree or two more should help, and it is a smaller change than moving the grinder again.',
      ],
      relatedContent: ['temperature', 'doseYieldTime'],
      ruleId: 'espresso_temperature_light',
    }),
  },
  {
    id: 'espresso_temperature_dark',
    priority: 50,
    test: (input) => input.roast === 'dark' && tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'A dark roast turning harsh at a sensible shot time usually wants less energy.',
      adjustment: {
        variable: 'temperature',
        direction: 'decrease',
        title: 'Lower the brew temperature slightly',
      },
      keepConstant: ['Grind', 'Dose', 'Yield'],
      nextTarget: {
        dose: input.dose,
        yieldOut: input.yieldOut,
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
        temperature: Math.max(88, (input.temperature ?? 93) - 1),
      },
      reasons: [
        'Dark roasts are more soluble, so they give up bitter material readily at a normal shot time.',
        'Cooler water softens that without making the shot weaker.',
      ],
      relatedContent: ['temperature', 'sourVsBitter'],
      ruleId: 'espresso_temperature_dark',
    }),
  },

  // 6. Fallback: the taste is clear even if nothing else is.
  {
    id: 'espresso_fallback_under',
    priority: 90,
    test: (input) => tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot reads as under-extracted.',
      adjustment: { variable: 'grind', direction: 'finer', title: 'Grind slightly finer' },
      keepConstant: ['Dose', 'Yield', 'Temperature'],
      nextTarget: {
        dose: input.dose,
        yieldOut: input.yieldOut,
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'Sharp, thin coffee generally means the water took too little from the grounds.',
        'One step finer is the smallest change that moves it, and it keeps the rest of the recipe readable.',
      ],
      relatedContent: ['grindFinerOrCoarser', 'sourVsBitter'],
      ruleId: 'espresso_fallback_under',
    }),
  },
  {
    id: 'espresso_fallback_over',
    priority: 90,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The shot reads as over-extracted.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind slightly coarser' },
      keepConstant: ['Dose', 'Yield', 'Temperature'],
      nextTarget: {
        dose: input.dose,
        yieldOut: input.yieldOut,
        timeMin: TARGET_TIME[0],
        timeMax: TARGET_TIME[1],
      },
      reasons: [
        'Harsh, drying coffee generally means the water took too much from the grounds.',
        'One step coarser is the smallest change that moves it.',
      ],
      relatedContent: ['grindFinerOrCoarser', 'sourVsBitter'],
      ruleId: 'espresso_fallback_over',
    }),
  },
];
