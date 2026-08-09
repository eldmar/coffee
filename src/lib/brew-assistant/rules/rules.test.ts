import { describe, expect, it } from 'vitest';
import { diagnose, RULES } from './index';
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

describe('espresso rules', () => {
  it('sends a fast, sour shot finer', () => {
    const result = diagnose(espresso({ yieldOut: 40, time: 22, tastes: ['sour', 'weak'] }));
    expect(result.adjustment.variable).toBe('grind');
    expect(result.adjustment.direction).toBe('finer');
  });

  it('sends a slow, bitter shot coarser', () => {
    const result = diagnose(espresso({ time: 40, tastes: ['bitter', 'dry'] }));
    expect(result.adjustment.direction).toBe('coarser');
  });

  it('blames puck preparation, not the grinder, when a shot sprays', () => {
    const result = diagnose(espresso({ behaviour: 'espresso-spraying', tastes: ['bitter'] }));
    expect(result.adjustment.variable).toBe('technique');
    expect(result.ruleId).toBe('espresso_channeling');
  });

  it('treats sour and bitter together as uneven extraction', () => {
    const result = diagnose(espresso({ tastes: ['sour', 'bitter'] }));
    expect(result.adjustment.variable).toBe('technique');
  });

  it('raises the temperature for a sour light roast at a normal flow', () => {
    const result = diagnose(espresso({ roast: 'light', tastes: ['sour'], time: 28 }));
    expect(result.adjustment.variable).toBe('temperature');
    expect(result.adjustment.direction).toBe('increase');
  });

  // The scenario the spec calls out by name.
  it('matches the required acceptance scenario', () => {
    const result = diagnose(
      espresso({ roast: 'light', dose: 18, yieldOut: 40, time: 22, tastes: ['sour', 'weak'] }),
    );
    expect(result.adjustment.title).toBe('Grind slightly finer');
    expect(result.keepConstant).toContain('Dose');
    expect(result.nextTarget.dose).toBe(18);
    // 18 g at the 1:2.1 starting zone, which is the 38 g the spec asks for.
    expect(result.nextTarget.yieldOut).toBe(38);
    expect(result.nextTarget.timeMin).toBe(27);
    expect(result.nextTarget.timeMax).toBe(30);
  });
});

describe('filter rules', () => {
  it('sends a fast, sour V60 finer', () => {
    const result = diagnose(filter('v60', { behaviour: 'v60-fast', tastes: ['sour'] }));
    expect(result.adjustment.direction).toBe('finer');
  });

  it('sends a stalled, bitter V60 coarser', () => {
    const result = diagnose(filter('v60', { behaviour: 'v60-stalled', tastes: ['bitter'] }));
    expect(result.adjustment.direction).toBe('coarser');
  });

  it('extends the steep for a weak AeroPress brewed briefly', () => {
    const result = diagnose(filter('aeropress', { time: 60, tastes: ['sour'] }));
    expect(result.adjustment.variable).toBe('time');
    expect(result.adjustment.direction).toBe('increase');
  });

  it('sends a gritty French press coarser', () => {
    const result = diagnose(
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
    expect(result.adjustment).toBeTruthy();
    expect(typeof result.adjustment.title).toBe('string');
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
