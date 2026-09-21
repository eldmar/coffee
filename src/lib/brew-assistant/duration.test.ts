import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationRange } from './duration';

describe('formatDuration', () => {
  it('writes an espresso shot in seconds', () => {
    expect(formatDuration(28)).toBe('28 sec');
  });

  it('writes a filter brew as minutes and seconds', () => {
    expect(formatDuration(210)).toBe('3:30');
  });

  it('writes a cold steep in hours rather than 86400 sec', () => {
    expect(formatDuration(86400)).toBe('24 hours');
    expect(formatDuration(3600)).toBe('1 hour');
    expect(formatDuration(16 * 3600)).toBe('16 hours');
  });
});

describe('formatDurationRange', () => {
  it('keeps short windows in seconds', () => {
    expect(formatDurationRange(27, 30)).toBe('27–30 sec');
  });

  it('keeps brew windows in minutes', () => {
    expect(formatDurationRange(240, 360)).toBe('4:00–6:00');
  });

  it('writes a steep window in hours, not 840:00', () => {
    expect(formatDurationRange(14 * 3600, 18 * 3600)).toBe('14–18 hours');
  });
});
