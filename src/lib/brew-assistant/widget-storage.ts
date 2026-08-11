import type {
  WidgetAdjustmentType,
  WidgetFeedback,
  WidgetHistoryEntry,
  WidgetIssue,
  WidgetQuestionId,
  WidgetState,
  WidgetStep,
} from './widget-types';

export const WIDGET_STATE_KEY = 'kavovo:brew-widget:state:v1';
export const WIDGET_HISTORY_KEY = 'kavovo:brew-widget:history:v1';
export const WIDGET_HISTORY_LIMIT = 10;
export const WIDGET_HISTORY_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STEPS = new Set<WidgetStep>([
  'welcome',
  'method',
  'issue',
  'follow-up',
  'recommendation',
  'feedback',
]);
const QUESTION_IDS = new Set<string>([
  'closest',
  'flow',
  'sharpness',
  'crema-taste',
  'steep-length',
  'aeropress-cause',
  'strong-finish',
  'flat-character',
]);
const METHODS = new Set(['espresso', 'v60', 'aeropress', 'french-press']);
const ISSUES = new Set<WidgetIssue>([
  'sour',
  'bitter',
  'weak',
  'dry',
  'fast',
  'slow',
  'crema',
  'strong',
  'muddy',
  'flat',
  'not-sure',
]);
const ADJUSTMENT_TYPES = new Set<WidgetAdjustmentType>([
  'grind-finer',
  'grind-coarser',
  'change-ratio',
  'change-temperature',
  'change-time',
  'change-technique',
  'check-freshness',
]);
const FEEDBACK = new Set<WidgetFeedback>(['better', 'same', 'worse', 'not_tried']);
const ANSWER_VALUES: Record<WidgetQuestionId, Set<string>> = {
  closest: new Set(['sharp', 'harsh', 'thin', 'dry', 'flat']),
  flow: new Set(['fast', 'slow', 'expected', 'not-sure']),
  sharpness: new Set(['yes', 'no', 'not-sure']),
  'crema-taste': new Set(['good', 'off', 'not-sure']),
  'steep-length': new Set(['short', 'normal', 'long', 'not-sure']),
  'aeropress-cause': new Set(['long', 'hard', 'neither', 'not-sure']),
  'strong-finish': new Set(['yes', 'no', 'not-sure']),
  'flat-character': new Set(['sharp', 'balanced', 'not-sure']),
};

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function validAnswers(value: unknown): value is WidgetState['answers'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 2 &&
    entries.every(
      ([key, answer]) =>
        QUESTION_IDS.has(key) &&
        typeof answer === 'string' &&
        ANSWER_VALUES[key as WidgetQuestionId].has(answer),
    )
  );
}

export function createWidgetState(now = new Date()): WidgetState {
  return {
    version: 1,
    step: 'welcome',
    answers: {},
    updatedAt: now.toISOString(),
  };
}

export function isWidgetState(value: unknown): value is WidgetState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const state = value as WidgetState;
  if (
    state.version !== 1 ||
    !STEPS.has(state.step) ||
    !validAnswers(state.answers) ||
    !validDate(state.updatedAt)
  ) {
    return false;
  }
  if (state.method !== undefined && !METHODS.has(state.method)) return false;
  if (state.issue !== undefined && !ISSUES.has(state.issue)) return false;
  if (
    state.feedbackPending !== undefined &&
    typeof state.feedbackPending !== 'boolean'
  ) {
    return false;
  }
  if (state.feedback !== undefined && !FEEDBACK.has(state.feedback)) return false;
  if (state.startedAt !== undefined && !validDate(state.startedAt)) return false;
  if (
    state.recommendationId !== undefined &&
    (typeof state.recommendationId !== 'string' || state.recommendationId.length === 0)
  ) {
    return false;
  }
  if (state.issue && !state.method) return false;
  if (state.step === 'issue' && !state.method) return false;
  if (state.step === 'follow-up' && (!state.method || !state.issue)) return false;
  if (
    (state.step === 'recommendation' || state.step === 'feedback') &&
    (!state.method || !state.issue || !state.recommendationId)
  ) {
    return false;
  }
  if (state.feedbackPending && state.step !== 'recommendation') return false;
  if (
    state.feedback === 'not_tried' &&
    (state.step !== 'recommendation' || !state.feedbackPending)
  ) {
    return false;
  }
  if (
    state.step === 'recommendation' &&
    state.feedback !== undefined &&
    state.feedback !== 'not_tried'
  ) {
    return false;
  }
  if (state.step === 'feedback' && (!state.feedback || state.feedback === 'not_tried')) return false;
  if (
    state.attemptNumber !== undefined &&
    (!Number.isInteger(state.attemptNumber) || state.attemptNumber < 1)
  ) {
    return false;
  }
  return true;
}

export function loadWidgetState(storage: StorageLike | null): WidgetState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WIDGET_STATE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isWidgetState(parsed)) return parsed;
    storage.removeItem(WIDGET_STATE_KEY);
  } catch {
    try {
      storage.removeItem(WIDGET_STATE_KEY);
    } catch {
      // Storage is optional; the in-memory state remains usable.
    }
  }
  return null;
}

export function saveWidgetState(storage: StorageLike | null, state: WidgetState): void {
  if (!storage) return;
  try {
    storage.setItem(WIDGET_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage is optional; the in-memory state remains usable.
  }
}

export function clearWidgetState(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(WIDGET_STATE_KEY);
  } catch {
    // Nothing else to clear.
  }
}

function isHistoryEntry(value: unknown): value is WidgetHistoryEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as WidgetHistoryEntry;
  return (
    METHODS.has(entry.method) &&
    ISSUES.has(entry.issue) &&
    validAnswers(entry.answers) &&
    typeof entry.recommendationId === 'string' &&
    entry.recommendationId.length > 0 &&
    ADJUSTMENT_TYPES.has(entry.adjustmentType) &&
    validDate(entry.createdAt) &&
    (entry.feedback === undefined || FEEDBACK.has(entry.feedback))
  );
}

export function loadWidgetHistory(
  storage: StorageLike | null,
  now = Date.now(),
): WidgetHistoryEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WIDGET_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid widget history');
    const history = parsed
      .filter(isHistoryEntry)
      .filter((entry) => now - Date.parse(entry.createdAt) <= WIDGET_HISTORY_TTL_MS)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, WIDGET_HISTORY_LIMIT);
    storage.setItem(WIDGET_HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch {
    try {
      storage.removeItem(WIDGET_HISTORY_KEY);
    } catch {
      // Nothing else to clear.
    }
    return [];
  }
}

export function saveWidgetHistoryEntry(
  storage: StorageLike | null,
  entry: WidgetHistoryEntry,
): WidgetHistoryEntry[] {
  const history = loadWidgetHistory(storage).filter(
    (item) => item.createdAt !== entry.createdAt || item.recommendationId !== entry.recommendationId,
  );
  const updated = [entry, ...history].slice(0, WIDGET_HISTORY_LIMIT);
  if (storage) {
    try {
      storage.setItem(WIDGET_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Storage is optional; return the in-memory result either way.
    }
  }
  return updated;
}

export function setWidgetHistoryFeedback(
  storage: StorageLike | null,
  recommendationId: string,
  createdAt: string,
  feedback: WidgetFeedback,
): WidgetHistoryEntry[] {
  const updated = loadWidgetHistory(storage).map((entry) =>
    entry.recommendationId === recommendationId && entry.createdAt === createdAt
      ? { ...entry, feedback }
      : entry,
  );
  if (storage) {
    try {
      storage.setItem(WIDGET_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Storage is optional; return the in-memory result either way.
    }
  }
  return updated;
}

export function clearWidgetHistory(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(WIDGET_HISTORY_KEY);
  } catch {
    // Nothing else to clear.
  }
}
