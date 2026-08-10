import type { BrewDiagnosis, BrewInput, Method } from '../types';
import { has, round, tastesOver, tastesUnder, type Rule } from './shared';

/** Around 60 g of coffee per litre, the starting zone for filter brewing. */
const TARGET_RATIO = 16.7;

const base = (input: BrewInput) => ({ method: input.method, needsClarification: false as const });

const window = (input: BrewInput): [number, number] => {
  const spans: Record<Method, [number, number]> = {
    espresso: [27, 30],
    v60: [165, 210],
    aeropress: [120, 240],
    'french-press': [240, 360],
  };
  return spans[input.method];
};

const guideKey: Record<Method, string> = {
  espresso: 'espressoGuide',
  v60: 'v60Guide',
  aeropress: 'aeropressGuide',
  'french-press': 'frenchPressGuide',
};

const unchanged = (input: BrewInput) => ({
  dose: input.dose,
  water: input.water,
  timeMin: window(input)[0],
  timeMax: window(input)[1],
});

const grindFiner = (input: BrewInput, ruleId: string, diagnosis: string, why: string[]): BrewDiagnosis => ({
  ...base(input),
  diagnosis,
  adjustment: { variable: 'grind', direction: 'finer', title: 'Grind slightly finer' },
  keepConstant: ['Dose', 'Water', 'Temperature'],
  nextTarget: unchanged(input),
  reasons: why,
  relatedContent: ['grindSize', guideKey[input.method]],
  ruleId,
});

const grindCoarser = (input: BrewInput, ruleId: string, diagnosis: string, why: string[]): BrewDiagnosis => ({
  ...base(input),
  diagnosis,
  adjustment: { variable: 'grind', direction: 'coarser', title: 'Grind slightly coarser' },
  keepConstant: ['Dose', 'Water', 'Temperature'],
  nextTarget: unchanged(input),
  reasons: why,
  relatedContent: ['grindSize', guideKey[input.method]],
  ruleId,
});

/** Rules shared by every filter method, plus the method-specific ones below. */
const commonFilterRules: Rule[] = [
  // 4. Ratio, when the brew is balanced but simply the wrong strength.
  {
    id: 'filter_ratio_weak',
    priority: 40,
    // Weak without the sharpness of under-extraction: a dilution problem.
    test: (input, m) => has(input, 'weak') && !has(input, 'sour', 'hollow') && m.ratio > 17.5,
    build: (input) => ({
      ...base(input),
      diagnosis: 'The brew is balanced but there is more water than the coffee can fill.',
      adjustment: { variable: 'dose', direction: 'increase', title: 'Use a little more coffee' },
      keepConstant: ['Grind', 'Water', 'Temperature'],
      nextTarget: {
        dose: round((input.water ?? 0) / TARGET_RATIO, 0.5),
        water: input.water,
        timeMin: window(input)[0],
        timeMax: window(input)[1],
      },
      reasons: [
        'The cup is diluted rather than under-extracted, so changing the grind would solve the wrong problem.',
        'More coffee at the same water raises the strength without changing how the brew extracts.',
      ],
      relatedContent: ['ratio', guideKey[input.method]],
      ruleId: 'filter_ratio_weak',
    }),
  },
  {
    id: 'filter_ratio_strong',
    priority: 40,
    test: (input, m) => has(input, 'strong') && !tastesOver(input) && m.ratio < 15,
    build: (input) => ({
      ...base(input),
      diagnosis: 'The brew is concentrated rather than over-extracted.',
      adjustment: { variable: 'dose', direction: 'decrease', title: 'Use a little less coffee' },
      keepConstant: ['Grind', 'Water', 'Temperature'],
      nextTarget: {
        dose: round((input.water ?? 0) / TARGET_RATIO, 0.5),
        water: input.water,
        timeMin: window(input)[0],
        timeMax: window(input)[1],
      },
      reasons: [
        'The cup is concentrated rather than over-extracted, so changing the grind would solve the wrong problem.',
        'Nothing here says it is over-extracted, so lower the dose rather than coarsening the grind.',
      ],
      relatedContent: ['ratio', guideKey[input.method]],
      ruleId: 'filter_ratio_strong',
    }),
  },

  // 5. Roast-specific temperature.
  {
    id: 'filter_temperature_light',
    priority: 50,
    test: (input) => input.roast === 'light' && tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'A light roast that stays sour at a sensible brew time usually wants hotter water.',
      adjustment: {
        variable: 'temperature',
        direction: 'increase',
        title: 'Brew a few degrees hotter',
      },
      keepConstant: ['Grind', 'Dose', 'Water'],
      nextTarget: { ...unchanged(input), temperature: Math.min(96, (input.temperature ?? 93) + 2) },
      reasons: [
        'Light roasts are dense and less soluble, so the same recipe takes less from them.',
        'Water nearer 96°C is a smaller, more readable change than moving the grinder again.',
      ],
      relatedContent: ['temperature', guideKey[input.method]],
      ruleId: 'filter_temperature_light',
    }),
  },
  {
    id: 'filter_temperature_dark',
    priority: 50,
    test: (input) => input.roast === 'dark' && tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'A dark roast turning harsh at a sensible brew time usually wants cooler water.',
      adjustment: {
        variable: 'temperature',
        direction: 'decrease',
        title: 'Brew a few degrees cooler',
      },
      keepConstant: ['Grind', 'Dose', 'Water'],
      nextTarget: { ...unchanged(input), temperature: Math.max(88, (input.temperature ?? 94) - 3) },
      reasons: [
        'Dark roasts give up bitter material quickly, and hot water speeds that up.',
        'Cooler water softens the harshness without making the cup weaker.',
      ],
      relatedContent: ['temperature', guideKey[input.method]],
      ruleId: 'filter_temperature_dark',
    }),
  },

  // 6. Fallback on taste alone.
  {
    id: 'filter_fallback_under',
    priority: 90,
    test: (input) => tastesUnder(input),
    build: (input) =>
      grindFiner(input, 'filter_fallback_under', 'The brew reads as under-extracted.', [
        'Sharp, thin coffee generally means the water took too little from the grounds.',
        'One step finer is the smallest change that moves it, and it keeps the rest of the recipe readable.',
      ]),
  },
  {
    id: 'filter_fallback_over',
    priority: 90,
    test: (input) => tastesOver(input),
    build: (input) =>
      grindCoarser(input, 'filter_fallback_over', 'The brew reads as over-extracted.', [
        'Harsh, drying coffee generally means the water took too much from the grounds.',
        'One step coarser is the smallest change that moves it.',
      ]),
  },
];

export const v60Rules: Rule[] = [
  {
    id: 'v60_grind_too_fine',
    priority: 15,
    test: (input) => input.grind === 'fine' && (input.behaviour === 'v60-stalled' || tastesOver(input)),
    build: (input) =>
      grindCoarser(input, 'v60_grind_too_fine', 'That grind is finer than a cone dripper can drain.', [
        'A fine grind packs the bed and slows the drawdown, which over-extracts everything the water does reach.',
        'Medium is the reference for a V60. Move there before changing anything else.',
      ]),
  },
  {
    id: 'v60_uneven_bed',
    priority: 20,
    test: (input) =>
      input.behaviour === 'v60-uneven' || (has(input, 'sour') && has(input, 'bitter')),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Water seems to have found its own route through the bed.',
      adjustment: {
        variable: 'technique',
        direction: 'improve',
        title: 'Pour more slowly, in smaller circles',
      },
      keepConstant: ['Grind', 'Dose', 'Water', 'Temperature'],
      nextTarget: unchanged(input),
      reasons: [
        'Sour and bitter together, or a bed left uneven, points to part of the coffee being over-extracted while the rest is barely touched.',
        'Keep the pour inside the coffee and away from the paper, and swirl once at the end to flatten the bed. Leave the grinder where it is.',
      ],
      relatedContent: ['v60Guide', 'grindSize'],
      ruleId: 'v60_uneven_bed',
    }),
  },
  {
    id: 'v60_stalled_bitter',
    priority: 30,
    test: (input) => input.behaviour === 'v60-stalled' || (input.time > 240 && tastesOver(input)),
    build: (input) =>
      grindCoarser(input, 'v60_stalled_bitter', 'The drawdown dragged and the cup turned harsh.', [
        'A slow drawdown keeps the water with the coffee far longer than the recipe intends.',
        'A coarser grind lets it drain in time and takes the drying edge off the cup.',
      ]),
  },
  {
    id: 'v60_fast_sour',
    priority: 30,
    test: (input) => input.behaviour === 'v60-fast' || (input.time < 150 && tastesUnder(input)),
    build: (input) =>
      grindFiner(input, 'v60_fast_sour', 'The water drained before it had taken much from the coffee.', [
        'A fast drawdown is the usual reason a V60 tastes sharp and thin.',
        'A finer grind slows it down and should bring sweetness with it.',
      ]),
  },
  ...commonFilterRules,
];

export const aeropressRules: Rule[] = [
  {
    id: 'aeropress_muddy',
    priority: 20,
    test: (input) => has(input, 'muddy'),
    build: (input) =>
      grindCoarser(input, 'aeropress_muddy', 'Fine particles are making the cup muddy.', [
        'A grind that is too fine can pass through or clog the filter and leave a heavy, silty cup.',
        'Move one step coarser and keep the steep and press unchanged.',
      ]),
  },
  {
    id: 'aeropress_easy_press_weak',
    priority: 20,
    test: (input) => input.behaviour === 'aeropress-easy' && tastesUnder(input),
    build: (input) =>
      grindFiner(input, 'aeropress_easy_press_weak', 'The press met almost no resistance and the cup is thin.', [
        'A press that offers no resistance means the coffee is coarse enough for water to move straight past it.',
        'A finer grind gives the steep more to work with. Keep pressing slowly.',
      ]),
  },
  {
    id: 'aeropress_hard_press_bitter',
    priority: 20,
    test: (input) => input.behaviour === 'aeropress-hard' && tastesOver(input),
    build: (input) =>
      grindCoarser(input, 'aeropress_hard_press_bitter', 'The press was a struggle and the cup turned harsh.', [
        'A hard press means the grind is fine enough to block the filter, which also pushes extraction too far.',
        'A coarser grind should make the press smooth again and take the bitterness back.',
      ]),
  },
  {
    id: 'aeropress_short_steep_sour',
    priority: 30,
    test: (input) => input.time < 120 && tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The steep was short for the grind you used.',
      adjustment: { variable: 'time', direction: 'increase', title: 'Steep for longer' },
      keepConstant: ['Grind', 'Dose', 'Water', 'Temperature'],
      nextTarget: { ...unchanged(input), timeMin: 180, timeMax: 240 },
      reasons: [
        'Extraction happens during the steep, not the press, so a short steep leaves the coffee sharp.',
        'Try three to four minutes before touching the grinder — it is the easier change to read.',
      ],
      relatedContent: ['aeropressGuide', 'ratio'],
      ruleId: 'aeropress_short_steep_sour',
    }),
  },
  {
    id: 'aeropress_long_steep_bitter',
    priority: 30,
    test: (input) => input.time > 240 && tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The steep ran long for the grind you used.',
      adjustment: { variable: 'time', direction: 'decrease', title: 'Steep for less time' },
      keepConstant: ['Grind', 'Dose', 'Water', 'Temperature'],
      nextTarget: { ...unchanged(input), timeMin: 120, timeMax: 180 },
      reasons: [
        'The longer the coffee sits in water, the more bitter material comes with it.',
        'Shortening the steep is a smaller change than moving the grinder, so try it first.',
      ],
      relatedContent: ['aeropressGuide', 'grindSize'],
      ruleId: 'aeropress_long_steep_bitter',
    }),
  },
  {
    id: 'aeropress_strong_balanced',
    priority: 35,
    test: (input) => has(input, 'strong') && !tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The cup is concentrated rather than over-extracted.',
      adjustment: {
        variable: 'water',
        direction: 'increase',
        title: 'Add a small bypass after pressing',
      },
      keepConstant: ['Grind', 'Dose', 'Steep time', 'Temperature'],
      nextTarget: {
        ...unchanged(input),
        bypass: Math.max(20, round((input.water ?? 200) * 0.1, 5)),
      },
      reasons: [
        'Nothing here points to bitterness or over-extraction; the finished coffee is simply concentrated.',
        'A little hot water after pressing lowers the strength without changing the extraction.',
      ],
      relatedContent: ['ratio', 'aeropressGuide'],
      ruleId: 'aeropress_strong_balanced',
    }),
  },
  ...commonFilterRules,
];

export const frenchPressRules: Rule[] = [
  {
    id: 'french_press_fine_grind_bitter',
    priority: 20,
    test: (input) => (input.grind === 'fine' || input.grind === 'medium-fine') && tastesOver(input),
    build: (input) =>
      grindCoarser(
        input,
        'french_press_fine_grind_bitter',
        'The grind is fine for a brewer that steeps for minutes.',
        [
          'In full immersion the coffee cannot escape the water, so a fine grind keeps extracting for the whole steep.',
          'Medium-coarse is the reference here. Coarser will also cut the sediment.',
        ],
      ),
  },
  {
    id: 'french_press_sediment',
    priority: 20,
    test: (input) => input.behaviour === 'french-press-sediment' || has(input, 'muddy'),
    build: (input) =>
      grindCoarser(input, 'french_press_sediment', 'Too many fine particles are passing the mesh.', [
        'Grit in the cup comes from fines small enough to slip through the screen, not from the steep.',
        'A coarser grind produces fewer of them. Skim the crust, let the grounds settle, then press slowly.',
      ]),
  },
  {
    id: 'french_press_hard_press',
    priority: 20,
    test: (input) => input.behaviour === 'french-press-hard',
    build: (input) =>
      grindCoarser(input, 'french_press_hard_press', 'The plunger is meeting more resistance than it should.', [
        'A hard press means the grind is fine enough to pack against the mesh.',
        'Grind coarser and never force the plunger — pushing harder stirs the settled grounds back into the coffee.',
      ]),
  },
  {
    id: 'french_press_short_steep_sour',
    priority: 30,
    test: (input) => input.time < 240 && tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'The steep was short for a full-immersion brew.',
      adjustment: { variable: 'time', direction: 'increase', title: 'Steep for longer' },
      keepConstant: ['Grind', 'Dose', 'Water', 'Temperature'],
      nextTarget: { ...unchanged(input), timeMin: 240, timeMax: 300 },
      reasons: [
        'In a press the steep is the whole extraction, so a short one leaves the cup thin and sharp.',
        'Four minutes is the reference. Extend the time before you change the grind.',
      ],
      relatedContent: ['frenchPressGuide', 'ratio'],
      ruleId: 'french_press_short_steep_sour',
    }),
  },
  ...commonFilterRules,
];
