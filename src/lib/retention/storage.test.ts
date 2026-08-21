import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RETENTION_KEYS,
  clearRetentionMemory,
  getLearnProgress,
  getRecentRecipes,
  getSavedRecipes,
  recordLessonVisit,
  recordRecentRecipe,
  sanitiseLearnProgress,
  sanitisePreferences,
  sanitiseRecentRecipes,
  sanitiseSavedRecipes,
  setLessonCompleted,
  setRecipeSaved,
} from './storage';

function installWindow(storage: Storage) {
  const listeners = new Map<string, Set<EventListener>>();
  vi.stubGlobal('CustomEvent', class<T> extends Event {
    detail: T;
    constructor(type: string, init?: CustomEventInit<T>) {
      super(type);
      this.detail = init?.detail as T;
    }
  });
  vi.stubGlobal('window', {
    localStorage: storage,
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
  });
}

function memoryLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  clearRetentionMemory();
});

describe('retention storage sanitisation', () => {
  it('rejects unknown versions and malformed records', () => {
    expect(sanitiseLearnProgress({ version: 2, paths: {} })).toEqual({ version: 1, paths: {} });
    expect(sanitiseSavedRecipes({ version: 1, items: [{ slug: '<script>', savedAt: 2 }] })).toEqual({
      version: 1,
      items: [],
    });
    expect(sanitiseRecentRecipes({ version: 1, items: 'nope' })).toEqual({ version: 1, items: [] });
    expect(sanitisePreferences({ version: 1, units: 'stones' })).toEqual({ version: 1, units: 'metric' });
  });

  it('deduplicates and caps recent recipes at eight', () => {
    const recipes = Array.from({ length: 10 }, (_, index) => ({
      slug: `recipe-${index + 1}`,
      viewedAt: index + 1,
    }));
    recipes.push({ slug: 'recipe-1', viewedAt: 99 });
    expect(sanitiseRecentRecipes({ version: 1, items: recipes }).items).toHaveLength(8);
  });
});

describe('retention storage behaviour', () => {
  it('stores completion, visits and saved recipes without profile data', () => {
    const storage = memoryLocalStorage();
    installWindow(storage);

    recordLessonVisit('coffee-basics', 'what-is-coffee', 100);
    setLessonCompleted('coffee-basics', 'what-is-coffee', true, 200);
    setRecipeSaved('espresso', true, 300);

    expect(getLearnProgress().paths['coffee-basics']).toMatchObject({
      completedLessons: ['what-is-coffee'],
      lastVisitedLesson: 'what-is-coffee',
      lastVisitedAt: '1970-01-01T00:00:00.200Z',
    });
    expect(getSavedRecipes().items).toEqual([
      { slug: 'espresso', savedAt: '1970-01-01T00:00:00.300Z' },
    ]);
    expect(JSON.parse(storage.getItem(RETENTION_KEYS.learnProgress) ?? '')).toEqual({
      version: 1,
      paths: {
        'coffee-basics': {
          completedLessons: ['what-is-coffee'],
          lastVisitedLesson: 'what-is-coffee',
          lastVisitedAt: '1970-01-01T00:00:00.200Z',
        },
      },
    });
    expect(JSON.parse(storage.getItem(RETENTION_KEYS.savedRecipes) ?? '')).toEqual({
      version: 1,
      items: [{ slug: 'espresso', savedAt: '1970-01-01T00:00:00.300Z' }],
    });
    expect(storage.getItem(RETENTION_KEYS.savedRecipes)).not.toContain('email');
  });

  it('keeps interactions working when localStorage is blocked', () => {
    installWindow({
      length: 0,
      clear: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
      key: () => null,
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });

    recordRecentRecipe('espresso', 100);
    recordRecentRecipe('cappuccino', 200);
    recordRecentRecipe('espresso', 300);
    expect(getRecentRecipes().items).toEqual([
      { slug: 'espresso', viewedAt: '1970-01-01T00:00:00.300Z' },
      { slug: 'cappuccino', viewedAt: '1970-01-01T00:00:00.200Z' },
    ]);
  });

  it('recovers from invalid JSON', () => {
    const storage = memoryLocalStorage();
    storage.setItem(RETENTION_KEYS.savedRecipes, '{not json');
    installWindow(storage);
    expect(getSavedRecipes()).toEqual({ version: 1, items: [] });
  });

  it('migrates the prototype field names into the documented version 1 shape', () => {
    expect(
      sanitiseLearnProgress({
        version: 1,
        paths: {
          basics: {
            completed: ['lesson-one'],
            lastVisited: { lessonSlug: 'lesson-two', visitedAt: 200 },
          },
        },
      }),
    ).toEqual({
      version: 1,
      paths: {
        basics: {
          completedLessons: ['lesson-one'],
          lastVisitedLesson: 'lesson-two',
          lastVisitedAt: '1970-01-01T00:00:00.200Z',
        },
      },
    });
    expect(
      sanitiseSavedRecipes({ version: 1, recipes: [{ slug: 'espresso', savedAt: 300 }] }),
    ).toEqual({
      version: 1,
      items: [{ slug: 'espresso', savedAt: '1970-01-01T00:00:00.300Z' }],
    });
  });
});
