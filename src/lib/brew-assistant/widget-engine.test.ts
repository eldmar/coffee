import { describe, expect, it } from 'vitest';
import {
  buildFullAssistantHref,
  diagnoseWidget,
  nextWidgetQuestion,
} from './widget-engine';
import type { Method } from './types';
import type { WidgetIssue, WidgetState } from './widget-types';

const state = (
  method: Method,
  issue: WidgetIssue,
  answers: WidgetState['answers'] = {},
): WidgetState => ({
  version: 1,
  step: 'follow-up',
  method,
  issue,
  answers,
  startedAt: '2026-08-10T12:00:00.000Z',
  updatedAt: '2026-08-10T12:00:00.000Z',
});

const recommendation = (input: WidgetState) => {
  const outcome = diagnoseWidget(input);
  expect(outcome.kind).toBe('recommendation');
  if (outcome.kind !== 'recommendation') throw new Error('Expected recommendation');
  return outcome.recommendation;
};

describe('widget engine acceptance routes', () => {
  it('sends sour, fast espresso finer', () => {
    const result = recommendation(state('espresso', 'sour', { flow: 'fast' }));
    expect(result.adjustmentType).toBe('grind-finer');
    expect(result.id).toBe('espresso_fast_sour');
  });

  it('sends bitter, slow espresso coarser', () => {
    const result = recommendation(state('espresso', 'bitter', { flow: 'slow' }));
    expect(result.adjustmentType).toBe('grind-coarser');
  });

  it('separates balanced weak espresso from under-extraction', () => {
    const result = recommendation(state('espresso', 'weak', { sharpness: 'no' }));
    expect(result.adjustmentType).toBe('change-ratio');
    expect(result.adjustment).toBe('Increase the dose slightly');
  });

  it('does not dial in by crema when the espresso tastes good', () => {
    const result = diagnoseWidget(state('espresso', 'crema', { 'crema-taste': 'good' }));
    expect(result.kind).toBe('needs-details');
  });

  it('sends sour, fast V60 finer', () => {
    expect(recommendation(state('v60', 'sour', { flow: 'fast' })).adjustmentType).toBe(
      'grind-finer',
    );
  });

  it('sends bitter, slow V60 coarser', () => {
    expect(recommendation(state('v60', 'bitter', { flow: 'slow' })).adjustmentType).toBe(
      'grind-coarser',
    );
  });

  it('sends weak and sour V60 finer without changing dose too', () => {
    const result = recommendation(state('v60', 'weak', { sharpness: 'yes' }));
    expect(result.adjustmentType).toBe('grind-finer');
    expect(result.keepUnchanged).toContain('Dose');
  });

  it('adds a bypass to balanced strong AeroPress', () => {
    const result = recommendation(state('aeropress', 'strong', { 'strong-finish': 'no' }));
    expect(result.id).toBe('aeropress_strong_balanced');
    expect(result.adjustmentType).toBe('change-ratio');
    expect(result.adjustment).toContain('bypass');
  });

  it('sends muddy AeroPress and French press coarser', () => {
    expect(recommendation(state('aeropress', 'muddy')).adjustmentType).toBe('grind-coarser');
    expect(recommendation(state('french-press', 'muddy')).adjustmentType).toBe(
      'grind-coarser',
    );
  });

  it('changes ratio for weak French press that is not sour', () => {
    const result = recommendation(state('french-press', 'weak', { sharpness: 'no' }));
    expect(result.adjustmentType).toBe('change-ratio');
  });
});

describe('widget confidence and handoff', () => {
  it('uses at most two quick questions for not sure', () => {
    const first = diagnoseWidget(state('espresso', 'not-sure'));
    expect(first.kind).toBe('question');
    expect(first.kind === 'question' && first.question.id).toBe('closest');

    const second = diagnoseWidget(state('espresso', 'not-sure', { closest: 'sharp' }));
    expect(second.kind).toBe('question');
    expect(second.kind === 'question' && second.question.id).toBe('flow');

    const finalState = state('espresso', 'not-sure', { closest: 'sharp', flow: 'fast' });
    const final = diagnoseWidget(finalState);
    expect(final.kind).toBe('recommendation');
    expect(Object.keys(finalState.answers)).toHaveLength(2);
  });

  it('escalates conflicting or muted answers instead of guessing', () => {
    expect(diagnoseWidget(state('v60', 'sour', { flow: 'slow' })).kind).toBe('needs-details');
    expect(
      diagnoseWidget(state('v60', 'flat', { 'flat-character': 'balanced' })).kind,
    ).toBe('needs-details');
  });

  it('returns the same recommendation ID for the same input', () => {
    const input = state('espresso', 'sour', { flow: 'fast' });
    expect(recommendation(input).id).toBe(recommendation(input).id);
  });

  it('validates full assistant query parameters through allowlists', () => {
    expect(buildFullAssistantHref('espresso', 'sour')).toBe(
      '/assistant/?method=espresso&issue=sour&entry=widget',
    );
    expect(buildFullAssistantHref('unknown', 'free text')).toBe('/assistant/?entry=widget');
  });

  it('does not ask another question after two answers', () => {
    expect(
      nextWidgetQuestion('espresso', 'not-sure', { closest: 'sharp', flow: 'not-sure' }),
    ).toBeNull();
  });
});
