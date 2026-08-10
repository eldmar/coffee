import { describe, expect, it } from 'vitest';
import {
  WIDGET_HISTORY_LIMIT,
  WIDGET_HISTORY_TTL_MS,
  WIDGET_STATE_KEY,
  createWidgetState,
  loadWidgetHistory,
  loadWidgetState,
  saveWidgetHistoryEntry,
  saveWidgetState,
  type StorageLike,
} from './widget-storage';
import type { WidgetHistoryEntry } from './widget-types';

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const historyEntry = (createdAt: string, recommendationId: string): WidgetHistoryEntry => ({
  method: 'espresso',
  issue: 'sour',
  answers: { flow: 'fast' },
  recommendationId,
  adjustmentType: 'grind-finer',
  createdAt,
});

describe('widget session state', () => {
  it('round-trips a valid session', () => {
    const storage = new MemoryStorage();
    const state = { ...createWidgetState(), step: 'method' as const, attemptNumber: 1 };
    saveWidgetState(storage, state);
    expect(loadWidgetState(storage)).toEqual(state);
  });

  it('drops incompatible or corrupted state', () => {
    const storage = new MemoryStorage();
    storage.setItem(WIDGET_STATE_KEY, '{broken');
    expect(loadWidgetState(storage)).toBeNull();
    expect(storage.getItem(WIDGET_STATE_KEY)).toBeNull();

    storage.setItem(WIDGET_STATE_KEY, JSON.stringify({ ...createWidgetState(), version: 2 }));
    expect(loadWidgetState(storage)).toBeNull();

    storage.setItem(
      WIDGET_STATE_KEY,
      JSON.stringify({
        ...createWidgetState(),
        step: 'follow-up',
        method: 'espresso',
        issue: 'sour',
        answers: { flow: 'invented' },
      }),
    );
    expect(loadWidgetState(storage)).toBeNull();
  });

  it('continues without throwing when storage is unavailable', () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveWidgetState(blocked, createWidgetState())).not.toThrow();
    expect(loadWidgetState(blocked)).toBeNull();
  });
});

describe('widget history', () => {
  it('keeps only the ten newest attempts', () => {
    const storage = new MemoryStorage();
    const base = Date.now();
    for (let index = 0; index < 12; index += 1) {
      saveWidgetHistoryEntry(
        storage,
        historyEntry(new Date(base - index * 1000).toISOString(), `rule-${index}`),
      );
    }
    const history = loadWidgetHistory(storage, base);
    expect(history).toHaveLength(WIDGET_HISTORY_LIMIT);
    expect(history[0].recommendationId).toBe('rule-0');
  });

  it('removes entries older than 90 days', () => {
    const storage = new MemoryStorage();
    const base = Date.now();
    saveWidgetHistoryEntry(storage, historyEntry(new Date(base).toISOString(), 'fresh'));
    saveWidgetHistoryEntry(
      storage,
      historyEntry(new Date(base - WIDGET_HISTORY_TTL_MS - 1).toISOString(), 'expired'),
    );
    expect(loadWidgetHistory(storage, base).map((entry) => entry.recommendationId)).toEqual([
      'fresh',
    ]);
  });

  it('drops malformed history entries', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'kavovo:brew-widget:history:v1',
      JSON.stringify([
        historyEntry(new Date().toISOString(), 'valid'),
        { ...historyEntry(new Date().toISOString(), 'invalid'), adjustmentType: 'free-text' },
      ]),
    );
    expect(loadWidgetHistory(storage).map((entry) => entry.recommendationId)).toEqual(['valid']);
  });
});
