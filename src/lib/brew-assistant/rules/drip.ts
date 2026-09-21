import type { BrewInput } from '../types';
import { has, round, tastesOver, tastesUnder, type Rule } from './shared';

/**
 * Vietnamese phin, batch filter brewers and cold brew.
 *
 * All three are drip or steep methods with a weighable dose and water, so they
 * share the filter input model. What differs is the clock: a phin drips for
 * minutes, a batch brewer for minutes, and cold brew for most of a day.
 */

const base = (input: BrewInput) => ({
  method: input.method,
  needsClarification: false as const,
});

const HOUR = 3600;

export const phinRules: Rule[] = [
  {
    id: 'phin_fast_press',
    priority: 10,
    test: (input) => input.behaviour === 'phin-fast',
    build: (input) => ({
      ...base(input),
      diagnosis: 'It ran straight through, so the water never spent long enough in the grounds.',
      adjustment: {
        variable: 'puck_preparation',
        direction: 'improve',
        title: 'Screw the press down a little further, or grind one step finer',
      },
      keepConstant: ['Dose', 'Water', 'Temperature'],
      nextTarget: { timeMin: 240, timeMax: 300 },
      reasons: [
        'A phin should take four to five minutes. Under two and it is rinsing rather than brewing.',
        'The insert sets the flow on this brewer — it is the control the grinder would otherwise do.',
      ],
      relatedContent: ['grindSize', 'filterCoffee'],
      ruleId: 'phin_fast_press',
      needsClarification: false,
    }),
  },
  {
    id: 'phin_stalled_press',
    priority: 20,
    test: (input) => input.behaviour === 'phin-stalled',
    build: (input) => ({
      ...base(input),
      diagnosis: 'It barely dripped, so the bed was packed tighter than the water could pass.',
      adjustment: {
        variable: 'puck_preparation',
        direction: 'improve',
        title: 'Back the press off until it rests on the coffee without compressing it',
      },
      keepConstant: ['Dose', 'Water', 'Grind'],
      nextTarget: { timeMin: 240, timeMax: 360 },
      reasons: [
        'The insert only needs to sit on the bed. Screwing it down hard stops the brew.',
        'Let it bloom with a little water for thirty seconds before filling the chamber.',
      ],
      relatedContent: ['grindSize', 'filterCoffee'],
      ruleId: 'phin_stalled_press',
      needsClarification: false,
    }),
  },
  {
    id: 'phin_bitter_grind',
    priority: 30,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Harsh and drying — the water took more than the coffee had to give.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind one step coarser' },
      keepConstant: ['Dose', 'Water', 'Press pressure'],
      nextTarget: { timeMin: 240, timeMax: 300 },
      reasons: ['Phin coffee is traditionally strong, but strong is not the same as harsh.'],
      relatedContent: ['grindSize', 'tasting'],
      ruleId: 'phin_bitter_grind',
      needsClarification: false,
    }),
  },
  {
    id: 'phin_weak_dose',
    priority: 40,
    test: (input) => tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Thin for a phin, which is a brewer meant to produce a small, concentrated cup.',
      adjustment: { variable: 'dose', direction: 'increase', title: 'Use more coffee for the same water' },
      keepConstant: ['Water', 'Grind', 'Temperature'],
      nextTarget: { dose: round(input.dose + 3, 1) },
      reasons: ['A phin is usually brewed at roughly 20 g of coffee to 90 g of water.'],
      relatedContent: ['ratio', 'filterCoffee'],
      ruleId: 'phin_weak_dose',
      needsClarification: false,
    }),
  },
];

export const batchFilterRules: Rule[] = [
  {
    id: 'batch_bed_uneven',
    priority: 10,
    test: (input) => input.behaviour === 'batch-bed-uneven',
    build: (input) => ({
      ...base(input),
      diagnosis: 'Dry patches or a bed pushed up one side mean the water did not reach all of it.',
      adjustment: {
        variable: 'agitation',
        direction: 'improve',
        title: 'Wet the bed evenly, then stir once as the brew finishes',
      },
      keepConstant: ['Dose', 'Water', 'Grind'],
      nextTarget: {},
      reasons: [
        'A shower head that only wets the middle leaves the edges barely brewed.',
        'Fixing the flow first means the grinder change afterwards tells you something.',
      ],
      relatedContent: ['filterCoffee', 'grindSize'],
      ruleId: 'batch_bed_uneven',
      needsClarification: false,
    }),
  },
  {
    id: 'batch_slow_grind',
    priority: 20,
    test: (input) => input.behaviour === 'batch-slow',
    build: (input) => ({
      ...base(input),
      diagnosis: 'A drawdown that outlasts the machine usually means the grind is holding the water up.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind one step coarser' },
      keepConstant: ['Dose', 'Water'],
      nextTarget: { timeMin: 240, timeMax: 360 },
      reasons: ['A full batch should finish draining within a minute of the water stopping.'],
      relatedContent: ['grindSize', 'filterCoffee'],
      ruleId: 'batch_slow_grind',
      needsClarification: false,
    }),
  },
  {
    id: 'batch_bitter_grind',
    priority: 30,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Bitter and drying: the water spent longer in the bed than the coffee wanted.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind one step coarser' },
      keepConstant: ['Dose', 'Water', 'Temperature'],
      nextTarget: { timeMin: 240, timeMax: 360 },
      reasons: ['Change the grinder before the recipe — it moves extraction without moving strength.'],
      relatedContent: ['grindSize', 'tasting'],
      ruleId: 'batch_bitter_grind',
      needsClarification: false,
    }),
  },
  {
    id: 'batch_weak_ratio',
    priority: 40,
    test: (input, metrics) => has(input, 'weak') && metrics.coffeePerLitre < 55,
    build: (input, metrics) => ({
      ...base(input),
      diagnosis: 'Balanced but thin is dilution rather than extraction.',
      adjustment: { variable: 'dose', direction: 'increase', title: 'Use more coffee for the same water' },
      keepConstant: ['Water', 'Grind', 'Temperature'],
      nextTarget: { dose: round(((input.water ?? 0) / 1000) * 60, 1) },
      reasons: [
        `That brew was about ${Math.round(metrics.coffeePerLitre)} g per litre; 60 g per litre is the usual starting point.`,
      ],
      relatedContent: ['ratio', 'filterCoffee'],
      ruleId: 'batch_weak_ratio',
      needsClarification: false,
    }),
  },
  {
    id: 'batch_under_grind',
    priority: 50,
    test: (input) => tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Sharp and hollow points at water leaving before it had taken enough.',
      adjustment: { variable: 'grind', direction: 'finer', title: 'Grind one step finer' },
      keepConstant: ['Dose', 'Water', 'Temperature'],
      nextTarget: { timeMin: 240, timeMax: 360 },
      reasons: ['Check the bed was evenly wet first: a channel does the same thing to the taste.'],
      relatedContent: ['grindSize', 'tasting'],
      ruleId: 'batch_under_grind',
      needsClarification: false,
    }),
  },
];

export const coldBrewRules: Rule[] = [
  {
    id: 'cold_brew_silty',
    priority: 10,
    test: (input) => input.behaviour === 'cold-brew-silty',
    build: (input) => ({
      ...base(input),
      diagnosis: 'Silt in the bottle is fines passing the filter, not a problem with the steep.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind coarser and filter once more' },
      keepConstant: ['Dose', 'Water', 'Steep time'],
      nextTarget: {},
      reasons: [
        'Cold brew wants a coarse, even grind — closer to French press than to filter.',
        'Let it settle before decanting, and pour off the clear coffee rather than the last of it.',
      ],
      relatedContent: ['grindSize', 'coldBrew'],
      ruleId: 'cold_brew_silty',
      needsClarification: false,
    }),
  },
  {
    id: 'cold_brew_bitter_time',
    priority: 20,
    test: (input) => tastesOver(input) && input.time > 20 * HOUR,
    build: (input) => ({
      ...base(input),
      diagnosis: 'Past about twenty hours the steep starts taking the parts you do not want.',
      adjustment: { variable: 'steep_time', direction: 'decrease', title: 'Steep for 16 hours instead' },
      keepConstant: ['Dose', 'Water', 'Grind'],
      nextTarget: { timeMin: 14 * HOUR, timeMax: 18 * HOUR },
      reasons: ['Cold brew keeps extracting in the fridge until you take the grounds out.'],
      relatedContent: ['coldBrew', 'tasting'],
      ruleId: 'cold_brew_bitter_time',
      needsClarification: false,
    }),
  },
  {
    id: 'cold_brew_bitter_grind',
    priority: 30,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Harsh without a long steep behind it points at the grind rather than the clock.',
      adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind one step coarser' },
      keepConstant: ['Dose', 'Water', 'Steep time'],
      nextTarget: {},
      reasons: ['A fine grind keeps extracting for the whole steep, which is a long time to get it wrong.'],
      relatedContent: ['grindSize', 'coldBrew'],
      ruleId: 'cold_brew_bitter_grind',
      needsClarification: false,
    }),
  },
  {
    id: 'cold_brew_weak_time',
    priority: 40,
    test: (input) => tastesUnder(input) && input.time < 12 * HOUR,
    build: (input) => ({
      ...base(input),
      diagnosis: 'Under twelve hours a cold steep has not finished, whatever the ratio says.',
      adjustment: { variable: 'steep_time', direction: 'increase', title: 'Steep for 16 hours' },
      keepConstant: ['Dose', 'Water', 'Grind'],
      nextTarget: { timeMin: 14 * HOUR, timeMax: 18 * HOUR },
      reasons: ['Cold water works slowly. Time is the lever before the ratio.'],
      relatedContent: ['coldBrew', 'ratio'],
      ruleId: 'cold_brew_weak_time',
      needsClarification: false,
    }),
  },
  {
    id: 'cold_brew_weak_ratio',
    priority: 50,
    test: (input) => tastesUnder(input),
    build: (input, metrics) => ({
      ...base(input),
      diagnosis: 'A full steep that still tastes thin is a concentrate that was never concentrated.',
      adjustment: { variable: 'dose', direction: 'increase', title: 'Use more coffee for the same water' },
      keepConstant: ['Water', 'Grind', 'Steep time'],
      nextTarget: { dose: round(((input.water ?? 0) / 1000) * 100, 1) },
      reasons: [
        `That batch was about ${Math.round(metrics.coffeePerLitre)} g per litre. Cold brew meant for dilution starts nearer 100.`,
      ],
      relatedContent: ['ratio', 'coldBrew'],
      ruleId: 'cold_brew_weak_ratio',
      needsClarification: false,
    }),
  },
];
