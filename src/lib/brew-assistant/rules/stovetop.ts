import type { BrewInput } from '../types';
import { has, round, tastesOver, tastesUnder, type Rule } from './shared';

/**
 * Moka pot and cezve.
 *
 * Both are driven by the hob far more than by the recipe, which is why `heat`
 * is the adjustment these rules reach for first. The moka rules follow the
 * causes already published in /guides/moka-pot/ — the assistant contradicting
 * the site's own guide would be worse than having no assistant.
 */

const base = (input: BrewInput) => ({
  method: input.method,
  needsClarification: false as const,
});

/** The basket sets the dose, so a moka recipe is really water and grind. */
const keepMoka = ['Basket fill', 'Water level'];

export const mokaPotRules: Rule[] = [
  {
    // Guide: "A moka pot brews at one to two bars and does not build espresso
    // crema." Nothing to fix, so nothing is changed.
    id: 'moka_no_crema_expected',
    priority: 10,
    test: (input) => input.behaviour === 'moka-erupted' && !has(input, 'bitter', 'dry', 'sour'),
    build: (input) => ({
      ...base(input),
      diagnosis:
        'A moka pot brews at one to two bars, so it never builds espresso crema. A lively stream on its own is not a fault.',
      adjustment: null,
      keepConstant: [],
      nextTarget: {},
      reasons: [],
      relatedContent: ['mokaPotGuide', 'tasting'],
      ruleId: 'moka_no_crema_expected',
      needsClarification: true,
      clarificationQuestion: 'How did the coffee itself taste — sharp, balanced or harsh?',
    }),
  },
  {
    // Guide: spitting and sputtering from the start means the heat is too high.
    id: 'moka_sputtering_heat',
    priority: 20,
    test: (input) => input.behaviour === 'moka-sputtering',
    build: (input) => ({
      ...base(input),
      diagnosis: 'Spitting from the start is the pot telling you the hob is hotter than it needs.',
      adjustment: {
        variable: 'heat',
        direction: 'decrease',
        title: 'Turn the hob down',
      },
      keepConstant: [...keepMoka, 'Grind'],
      nextTarget: {},
      reasons: [
        'The flame should not spread past the base of the pot.',
        'Heat drives everything here, so change it before touching the grinder.',
      ],
      relatedContent: ['mokaPotGuide'],
      ruleId: 'moka_sputtering_heat',
      needsClarification: false,
    }),
  },
  {
    // Guide: nothing comes up → grind too fine, or the basket was tamped.
    id: 'moka_stalled_grind',
    priority: 30,
    test: (input) => input.behaviour === 'moka-stalled',
    build: (input) => ({
      ...base(input),
      diagnosis: 'Barely anything came through, which means the water could not get past the bed.',
      adjustment: {
        variable: 'grind',
        direction: 'coarser',
        title: 'Grind one step coarser and level the basket without pressing',
      },
      keepConstant: keepMoka,
      nextTarget: {},
      reasons: [
        'A moka pot makes one to two bars. A grind that an espresso machine would push through will stop it.',
        'Tamping a moka basket has the same effect as grinding finer.',
      ],
      relatedContent: ['mokaPotGuide', 'grindSize'],
      ruleId: 'moka_stalled_grind',
      needsClarification: false,
    }),
  },
  {
    // Guide: burnt → heat too high, or left on the hob after brewing.
    id: 'moka_burnt_heat',
    priority: 40,
    test: (input) => tastesOver(input) && input.heatLevel === 'high',
    build: (input) => ({
      ...base(input),
      diagnosis: 'Harsh, burnt notes on a high hob are almost always the heat rather than the coffee.',
      adjustment: {
        variable: 'heat',
        direction: 'decrease',
        title: 'Brew on low to medium heat and start with preheated water',
      },
      keepConstant: [...keepMoka, 'Grind'],
      nextTarget: {},
      reasons: [
        'Preheated water shortens the time the grounds spend heating up in the basket.',
        'Take the pot off as soon as the stream turns pale.',
      ],
      relatedContent: ['mokaPotGuide', 'temperature'],
      ruleId: 'moka_burnt_heat',
      needsClarification: false,
    }),
  },
  {
    id: 'moka_bitter_grind',
    priority: 50,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Bitter and drying suggests the water took more from the grounds than it should.',
      adjustment: {
        variable: 'grind',
        direction: 'coarser',
        title: 'Grind one step coarser',
      },
      keepConstant: [...keepMoka, 'Heat'],
      nextTarget: {},
      reasons: ['Take the pot off the heat as soon as the stream pales, not when it stops.'],
      relatedContent: ['mokaPotGuide', 'grindSize'],
      ruleId: 'moka_bitter_grind',
      needsClarification: false,
    }),
  },
  {
    // Guide: weak and watery → the basket was not full, or the grind is too coarse.
    id: 'moka_weak_basket',
    priority: 60,
    test: (input) => tastesUnder(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Thin and watery on a moka pot is usually a basket that was not quite full.',
      adjustment: {
        variable: 'dose',
        direction: 'increase',
        title: 'Fill the basket level to the rim, then grind one step finer if it is still thin',
      },
      keepConstant: ['Water level', 'Heat'],
      nextTarget: {},
      reasons: [
        'The basket sets the dose on this brewer — a part-filled one cannot be corrected later.',
        'Level it, but do not press it down.',
      ],
      relatedContent: ['mokaPotGuide', 'ratio'],
      ruleId: 'moka_weak_basket',
      needsClarification: false,
    }),
  },
];

export const cezveRules: Rule[] = [
  {
    id: 'cezve_boiled_over',
    priority: 10,
    test: (input) => input.behaviour === 'cezve-boiled-over',
    build: (input) => ({
      ...base(input),
      diagnosis: 'It boiled rather than rose. Once a cezve boils, the foam is gone and cannot be brought back.',
      adjustment: {
        variable: 'heat',
        direction: 'decrease',
        title: 'Brew on the lowest heat that still raises the foam',
      },
      keepConstant: ['Grind', 'Dose', 'Water'],
      nextTarget: {},
      reasons: [
        'Lift the cezve away the moment the foam reaches the rim.',
        'Slow heat is what builds the foam in the first place.',
      ],
      relatedContent: ['temperature', 'tasting'],
      ruleId: 'cezve_boiled_over',
      needsClarification: false,
    }),
  },
  {
    id: 'cezve_no_foam',
    priority: 20,
    test: (input) => input.behaviour === 'cezve-no-foam',
    build: (input) => ({
      ...base(input),
      diagnosis: 'No foam usually means the grind was not fine enough, or the heat rushed it.',
      adjustment: {
        variable: 'grind',
        direction: 'finer',
        title: 'Grind to a flour-fine powder',
      },
      keepConstant: ['Dose', 'Water', 'Heat'],
      nextTarget: {},
      reasons: [
        'A cezve wants a grind finer than espresso — closer to icing sugar than to sand.',
        'Stir once before it goes on the heat, then leave it alone.',
      ],
      relatedContent: ['grindSize', 'freshness'],
      ruleId: 'cezve_no_foam',
      needsClarification: false,
    }),
  },
  {
    id: 'cezve_muddy_settle',
    priority: 30,
    test: (input) => has(input, 'muddy', 'dry'),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Grounds carried into the cup rather than settling in it.',
      adjustment: {
        variable: 'agitation',
        direction: 'improve',
        title: 'Pour slowly and let the cup stand for a minute before drinking',
      },
      keepConstant: ['Grind', 'Dose', 'Water', 'Heat'],
      nextTarget: {},
      reasons: [
        'The last mouthful is meant to stay in the cup.',
        'Stirring after it comes off the heat puts the settled grounds back into suspension.',
      ],
      relatedContent: ['tasting', 'grindSize'],
      ruleId: 'cezve_muddy_settle',
      needsClarification: false,
    }),
  },
  {
    id: 'cezve_weak_ratio',
    priority: 40,
    test: (input) => tastesUnder(input),
    build: (input, metrics) => ({
      ...base(input),
      diagnosis: 'Thin for a cezve — there was more water than the coffee could fill.',
      adjustment: {
        variable: 'dose',
        direction: 'increase',
        title: 'Use one heaped teaspoon of coffee per 70 ml cup',
      },
      keepConstant: ['Grind', 'Heat'],
      nextTarget: { dose: round(input.dose + 1, 0.5) },
      reasons: [
        metrics.coffeePerLitre > 0
          ? `That brew worked out at about ${Math.round(metrics.coffeePerLitre)} g per litre.`
          : 'A cezve is brewed strong and served small.',
      ],
      relatedContent: ['ratio', 'tasting'],
      ruleId: 'cezve_weak_ratio',
      needsClarification: false,
    }),
  },
  {
    id: 'cezve_bitter_heat',
    priority: 50,
    test: (input) => tastesOver(input),
    build: (input) => ({
      ...base(input),
      diagnosis: 'Harsh and drying means it spent too long getting hot.',
      adjustment: {
        variable: 'heat',
        direction: 'decrease',
        title: 'Take it off as the foam rises, and do not let it rise twice',
      },
      keepConstant: ['Grind', 'Dose', 'Water'],
      nextTarget: {},
      reasons: ['A second rise extracts what the first one already finished.'],
      relatedContent: ['temperature', 'tasting'],
      ruleId: 'cezve_bitter_heat',
      needsClarification: false,
    }),
  },
];
