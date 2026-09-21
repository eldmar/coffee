import { describe, expect, it } from 'vitest';
import { changedVariables, diagnose, RULES } from './index';
import { CONTENT } from '../content';
import { parseNumber, validate, hasBlockingError } from '../validation';
import type { BrewInput } from '../types';

const espresso = (over: Partial<BrewInput> = {}): BrewInput => ({
  method: 'espresso',
  dose: 18,
  yieldOut: 36,
  time: 28,
  roast: 'medium',
  tastes: [],
  behaviour: 'none',
  ...over,
});

const filter = (method: BrewInput['method'], over: Partial<BrewInput> = {}): BrewInput => ({
  method,
  dose: 15,
  water: 250,
  time: 210,
  roast: 'medium',
  tastes: [],
  behaviour: 'none',
  ...over,
});

const recommendation = (input: BrewInput) => {
  const result = diagnose(input);
  if (result.needsClarification) throw new Error(`Expected recommendation, got ${result.ruleId}`);
  return result;
};

describe('espresso rules', () => {
  it('sends a fast, sour shot finer', () => {
    const result = recommendation(espresso({ yieldOut: 40, time: 22, tastes: ['sour', 'weak'] }));
    expect(result.adjustment.variable).toBe('grind');
    expect(result.adjustment.direction).toBe('finer');
  });

  it('sends a slow, bitter shot coarser', () => {
    const result = recommendation(espresso({ time: 40, tastes: ['bitter', 'dry'] }));
    expect(result.adjustment.direction).toBe('coarser');
  });

  it('blames puck preparation, not the grinder, when a shot sprays', () => {
    const result = recommendation(espresso({ behaviour: 'espresso-spraying', tastes: ['bitter'] }));
    expect(result.adjustment.variable).toBe('puck_preparation');
    expect(result.ruleId).toBe('espresso_channeling');
  });

  it('treats sour and bitter together as uneven extraction', () => {
    const result = recommendation(espresso({ tastes: ['sour', 'bitter'] }));
    expect(result.adjustment.variable).toBe('puck_preparation');
  });

  it('raises the temperature for a hollow light roast at a normal flow', () => {
    const result = recommendation(espresso({ roast: 'light', tastes: ['hollow'], time: 28 }));
    expect(result.adjustment.variable).toBe('temperature');
    expect(result.adjustment.direction).toBe('increase');
  });

  it('asks about freshness instead of changing extraction for good espresso with little crema', () => {
    const result = diagnose(espresso({ behaviour: 'espresso-low-crema', tastes: [] }));
    expect(result.needsClarification).toBe(true);
    expect(result.adjustment).toBeNull();
    expect(result.ruleId).toBe('espresso_low_crema_good_taste');
  });

  // The scenario the spec calls out by name.
  it('matches the required acceptance scenario', () => {
    const input = espresso({ dose: 18, yieldOut: 36, time: 20, tastes: ['sour'] });
    const result = recommendation(input);
    expect(result.adjustment.title).toBe('Grind slightly finer');
    expect(result.keepConstant).toContain('Dose');
    expect(result.nextTarget.dose).toBe(18);
    expect(result.nextTarget.yieldOut).toBe(36);
    expect(result.nextTarget.timeMin).toBe(27);
    expect(result.nextTarget.timeMax).toBe(30);
    expect(changedVariables(input, result)).toEqual(['grind']);
  });

  it('keeps dose and yield unchanged for a slow, bitter 18 g shot', () => {
    const input = espresso({ dose: 18, yieldOut: 36, time: 40, tastes: ['bitter'] });
    const result = recommendation(input);
    expect(result.adjustment.direction).toBe('coarser');
    expect(result.nextTarget.dose).toBe(18);
    expect(result.nextTarget.yieldOut).toBe(36);
    expect(changedVariables(input, result)).toEqual(['grind']);
  });

  it('changes only puck preparation for a spraying 18 g shot', () => {
    const input = espresso({ dose: 18, yieldOut: 36, behaviour: 'espresso-spraying' });
    const result = recommendation(input);
    expect(result.adjustment.variable).toBe('puck_preparation');
    expect(result.adjustment.title).not.toMatch(/grind/i);
    expect(changedVariables(input, result)).toEqual(['puck_preparation']);
  });
});

describe('filter rules', () => {
  it('sends a fast, sour V60 finer', () => {
    const result = recommendation(filter('v60', { behaviour: 'v60-fast', tastes: ['sour'] }));
    expect(result.adjustment.direction).toBe('finer');
  });

  it('sends a stalled, bitter V60 coarser', () => {
    const result = recommendation(filter('v60', { behaviour: 'v60-stalled', tastes: ['bitter'] }));
    expect(result.adjustment.direction).toBe('coarser');
  });

  it('goes finer for a sour AeroPress while keeping a short steep unchanged', () => {
    const result = recommendation(filter('aeropress', { time: 60, tastes: ['sour'] }));
    expect(result.adjustment.variable).toBe('grind');
    expect(result.adjustment.direction).toBe('finer');
  });

  it('adds bypass water to strong AeroPress that is not bitter', () => {
    const result = recommendation(
      filter('aeropress', { dose: 20, water: 250, tastes: ['strong'], time: 180 }),
    );
    expect(result.adjustment.variable).toBe('water');
    expect(result.ruleId).toBe('aeropress_strong_balanced');
    expect(result.nextTarget.bypass).toBeGreaterThan(0);
  });

  it('sends muddy AeroPress coarser', () => {
    const result = recommendation(filter('aeropress', { tastes: ['muddy'] }));
    expect(result.adjustment.direction).toBe('coarser');
    expect(result.ruleId).toBe('aeropress_muddy');
  });

  it('sends a gritty French press coarser', () => {
    const result = recommendation(
      filter('french-press', { behaviour: 'french-press-sediment', tastes: ['muddy'], time: 300 }),
    );
    expect(result.adjustment.direction).toBe('coarser');
    expect(result.ruleId).toBe('french_press_sediment');
  });
});

describe('thin or contradictory answers', () => {
  it('asks a question instead of guessing when nothing is known', () => {
    const result = diagnose(espresso({ tastes: ['unsure'], behaviour: 'none' }));
    expect(result.needsClarification).toBe(true);
    expect(result.clarificationQuestion).toBeTruthy();
    expect(result.adjustment).toBeNull();
  });

  it('asks a question when the shot is called fast but took 45 seconds', () => {
    const result = diagnose(espresso({ behaviour: 'espresso-fast', time: 45, tastes: ['sour'] }));
    expect(result.needsClarification).toBe(true);
  });
});

describe('every answer carries exactly one adjustment', () => {
  const inputs: BrewInput[] = [
    espresso({ yieldOut: 40, time: 22, tastes: ['sour'] }),
    espresso({ time: 40, tastes: ['bitter'] }),
    espresso({ tastes: ['sour', 'bitter'] }),
    filter('v60', { tastes: ['bitter'], time: 260 }),
    filter('aeropress', { tastes: ['bitter'], time: 300 }),
    filter('french-press', { tastes: ['sour'], time: 180 }),
  ];

  it.each(inputs)('returns one adjustment for %o', (input) => {
    const result = diagnose(input);
    expect(changedVariables(input, result).length).toBeLessThanOrEqual(1);
    if (!result.needsClarification) expect(typeof result.adjustment.title).toBe('string');
  });
});

describe('content map', () => {
  it('gives every rule at least one link that exists', () => {
    for (const rules of Object.values(RULES)) {
      for (const rule of rules) {
        const sample = rule.build(espresso({ tastes: ['sour'] }), {
          ratio: 2,
          flowRate: 1.3,
          coffeePerLitre: 60,
        });
        expect(sample.relatedContent.length).toBeGreaterThan(0);
        for (const key of sample.relatedContent) {
          expect(CONTENT[key], `missing content key: ${key}`).toBeTruthy();
        }
      }
    }
  });
});

describe('validation', () => {
  it('reads a decimal comma', () => {
    expect(parseNumber('18,5')).toBe(18.5);
    expect(parseNumber('18.5')).toBe(18.5);
    expect(parseNumber('  ')).toBeNull();
  });

  it('blocks zero and negative values', () => {
    expect(hasBlockingError(validate('espresso', { dose: 0, yieldOut: 36, time: 28 }))).toBe(true);
    expect(hasBlockingError(validate('espresso', { dose: 18, yieldOut: 36, time: -1 }))).toBe(true);
  });

  it('warns without blocking on an unusual but possible dose', () => {
    const issues = validate('espresso', { dose: 34, yieldOut: 36, time: 28 });
    expect(hasBlockingError(issues)).toBe(false);
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('blocks a missing required field', () => {
    expect(hasBlockingError(validate('v60', { dose: 15, time: 210 }))).toBe(true);
  });
});

describe('moka pot rules', () => {
  const moka = (over: Partial<BrewInput> = {}) => filter('moka-pot', { dose: 17, water: 250, time: 240, ...over });

  it('turns the hob down before touching the grinder when it sputters', () => {
    const result = recommendation(moka({ behaviour: 'moka-sputtering', tastes: ['bitter'] }));
    expect(result.adjustment.variable).toBe('heat');
    expect(result.adjustment.direction).toBe('decrease');
    // The guide says heat first: a grind change now would not be measurable.
    expect(result.keepConstant).toContain('Grind');
  });

  it('coarsens the grind when barely anything comes through', () => {
    const result = recommendation(moka({ behaviour: 'moka-stalled' }));
    expect(result.adjustment.variable).toBe('grind');
    expect(result.adjustment.direction).toBe('coarser');
  });

  it('blames the hob rather than the coffee when it burnt on high heat', () => {
    const result = recommendation(moka({ tastes: ['bitter'], heatLevel: 'high' }));
    expect(result.adjustment.variable).toBe('heat');
  });

  it('fills the basket before grinding finer when it tastes thin', () => {
    const result = recommendation(moka({ tastes: ['weak'] }));
    expect(result.adjustment.variable).toBe('dose');
    expect(result.adjustment.direction).toBe('increase');
  });

  it('treats missing crema as normal rather than a fault', () => {
    const result = diagnose(moka({ behaviour: 'moka-erupted' }));
    expect(result.needsClarification).toBe(true);
    expect(result.adjustment).toBeNull();
  });
});

describe('cezve rules', () => {
  const cezve = (over: Partial<BrewInput> = {}) => filter('cezve', { dose: 7, water: 70, time: 180, ...over });

  it('lowers the heat when it boiled over', () => {
    const result = recommendation(cezve({ behaviour: 'cezve-boiled-over' }));
    expect(result.adjustment.variable).toBe('heat');
    expect(result.adjustment.direction).toBe('decrease');
  });

  it('grinds finer when no foam formed', () => {
    const result = recommendation(cezve({ behaviour: 'cezve-no-foam' }));
    expect(result.adjustment.direction).toBe('finer');
  });
});

describe('phin rules', () => {
  const phin = (over: Partial<BrewInput> = {}) => filter('phin', { dose: 20, water: 90, time: 270, ...over });

  it('tightens the press when it runs straight through', () => {
    const result = recommendation(phin({ behaviour: 'phin-fast', tastes: ['weak'] }));
    expect(result.adjustment.variable).toBe('puck_preparation');
  });

  it('backs the press off when it stalls', () => {
    const result = recommendation(phin({ behaviour: 'phin-stalled' }));
    expect(result.adjustment.variable).toBe('puck_preparation');
  });
});

describe('batch filter rules', () => {
  const batch = (over: Partial<BrewInput> = {}) => filter('batch-filter', { dose: 60, water: 1000, time: 300, ...over });

  it('fixes an uneven bed before the grind', () => {
    const result = recommendation(batch({ behaviour: 'batch-bed-uneven', tastes: ['sour'] }));
    expect(result.adjustment.variable).toBe('agitation');
    expect(result.keepConstant).toContain('Grind');
  });

  it('treats thin but balanced coffee as dilution, not extraction', () => {
    const result = recommendation(batch({ dose: 45, tastes: ['weak'] }));
    expect(result.adjustment.variable).toBe('dose');
  });
});

describe('cold brew rules', () => {
  const HOUR = 3600;
  const cold = (over: Partial<BrewInput> = {}) =>
    filter('cold-brew', { dose: 100, water: 1000, time: 16 * HOUR, ...over });

  it('shortens a steep that ran past twenty hours', () => {
    const result = recommendation(cold({ time: 24 * HOUR, tastes: ['bitter'] }));
    expect(result.adjustment.variable).toBe('steep_time');
    expect(result.adjustment.direction).toBe('decrease');
  });

  it('blames the grind, not the clock, when a normal steep tastes harsh', () => {
    const result = recommendation(cold({ tastes: ['bitter'] }));
    expect(result.adjustment.variable).toBe('grind');
  });

  it('lengthens a steep that was cut short', () => {
    const result = recommendation(cold({ time: 8 * HOUR, tastes: ['weak'] }));
    expect(result.adjustment.variable).toBe('steep_time');
    expect(result.adjustment.direction).toBe('increase');
  });

  it('accepts a steep measured in hours that the filter range would reject', () => {
    expect(hasBlockingError(validate('cold-brew', { dose: 100, water: 1000, time: 16 * HOUR }))).toBe(false);
    expect(hasBlockingError(validate('v60', { dose: 15, water: 250, time: 16 * HOUR }))).toBe(true);
  });
});

describe('every method', () => {
  it('has rules, a clarify question and a related page that resolves', () => {
    for (const method of Object.keys(RULES) as BrewInput['method'][]) {
      expect(RULES[method].length, `${method} has no rules`).toBeGreaterThan(0);
      const result = diagnose(filter(method, { tastes: [], behaviour: 'none' }));
      expect(result.ruleId, `${method} produced no diagnosis`).toBeTruthy();
      for (const key of result.relatedContent) {
        expect(CONTENT[key], `${method} links to unknown content key ${key}`).toBeDefined();
      }
    }
  });
});
