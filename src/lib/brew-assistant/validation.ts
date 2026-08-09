import type { BrewInput, Method } from './types';

export type Severity = 'error' | 'warning';

export interface FieldIssue {
  field: string;
  severity: Severity;
  message: string;
}

/**
 * Accept "18,5" as well as "18.5". People type whichever their keyboard offers,
 * and rejecting one of them is a validation failure of ours, not theirs.
 */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

interface Range {
  /** Outside this, continuing is blocked. */
  hardMin: number;
  hardMax: number;
  /** Outside this it is unusual but possible, so we only warn. */
  softMin: number;
  softMax: number;
  unit: string;
}

const RANGES: Record<string, Range> = {
  espressoDose: { hardMin: 0, hardMax: 60, softMin: 7, softMax: 30, unit: 'g' },
  espressoYield: { hardMin: 0, hardMax: 300, softMin: 10, softMax: 120, unit: 'g' },
  espressoTime: { hardMin: 0, hardMax: 300, softMin: 5, softMax: 90, unit: 'sec' },
  filterDose: { hardMin: 0, hardMax: 300, softMin: 5, softMax: 100, unit: 'g' },
  filterWater: { hardMin: 0, hardMax: 5000, softMin: 50, softMax: 2000, unit: 'g' },
  filterTime: { hardMin: 0, hardMax: 3600, softMin: 30, softMax: 900, unit: 'sec' },
  temperature: { hardMin: 40, hardMax: 100, softMin: 70, softMax: 100, unit: '°C' },
};

function check(field: string, key: keyof typeof RANGES, value: number | undefined): FieldIssue[] {
  if (value === undefined) return [];
  const range = RANGES[key];
  if (value <= range.hardMin || value > range.hardMax) {
    return [
      {
        field,
        severity: 'error',
        message: `Enter a value between ${range.hardMin + 1} and ${range.hardMax} ${range.unit}.`,
      },
    ];
  }
  if (value < range.softMin || value > range.softMax) {
    return [
      {
        field,
        severity: 'warning',
        message: `That is outside the usual ${range.softMin}–${range.softMax} ${range.unit}. You can carry on if it is what you brewed.`,
      },
    ];
  }
  return [];
}

/** Temperature is the only field shared by every method. */
function temperatureIssues(input: Partial<BrewInput>): FieldIssue[] {
  if (input.temperature === undefined) return [];
  const range = RANGES.temperature;
  if (input.temperature < range.hardMin || input.temperature > range.hardMax) {
    return [
      {
        field: 'temperature',
        severity: 'error',
        message: `Enter a temperature between ${range.hardMin} and ${range.hardMax} °C.`,
      },
    ];
  }
  return check('temperature', 'temperature', input.temperature);
}

export function validate(method: Method, input: Partial<BrewInput>): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const required = (field: string, value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) {
      issues.push({ field, severity: 'error', message: 'This one is needed to suggest a change.' });
      return false;
    }
    return true;
  };

  if (method === 'espresso') {
    if (required('dose', input.dose)) issues.push(...check('dose', 'espressoDose', input.dose));
    if (required('yieldOut', input.yieldOut)) {
      issues.push(...check('yieldOut', 'espressoYield', input.yieldOut));
    }
    if (required('time', input.time)) issues.push(...check('time', 'espressoTime', input.time));
  } else {
    if (required('dose', input.dose)) issues.push(...check('dose', 'filterDose', input.dose));
    if (required('water', input.water)) issues.push(...check('water', 'filterWater', input.water));
    if (required('time', input.time)) issues.push(...check('time', 'filterTime', input.time));
  }

  issues.push(...temperatureIssues(input));
  return issues;
}

export const hasBlockingError = (issues: FieldIssue[]) =>
  issues.some((issue) => issue.severity === 'error');
