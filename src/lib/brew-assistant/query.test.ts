import { describe, expect, it } from 'vitest';
import { parseAssistantParams } from './query';

describe('assistant handoff query', () => {
  it('accepts the widget method, issue and entry contract', () => {
    expect(parseAssistantParams('?method=espresso&issue=sour&entry=widget')).toMatchObject({
      method: 'espresso',
      taste: 'sour',
      behaviour: null,
      entry: 'widget',
    });
  });

  it('maps generic speed issues to method-specific behaviour', () => {
    expect(parseAssistantParams('?method=v60&issue=fast').behaviour).toBe('v60-fast');
    expect(parseAssistantParams('?method=espresso&issue=crema').behaviour).toBe(
      'espresso-low-crema',
    );
  });

  it('keeps the legacy homepage mode parameter working', () => {
    expect(parseAssistantParams('?mode=aeropress&issue=weak')).toMatchObject({
      method: 'aeropress',
      taste: 'weak',
    });
  });

  it('ignores unknown values and all recipe numbers', () => {
    expect(
      parseAssistantParams('?method=chemex&issue=whatever&dose=18&time=28&temperature=94'),
    ).toMatchObject({ method: null, taste: null, behaviour: null });
  });
});
