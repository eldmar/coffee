export const RETENTION_KEYS = {
  learnProgress: 'kavovo.learnProgress.v1',
  savedRecipes: 'kavovo.savedRecipes.v1',
  recentRecipes: 'kavovo.recentRecipes.v1',
  preferences: 'kavovo.preferences.v1',
} as const;

export type RetentionKey = (typeof RETENTION_KEYS)[keyof typeof RETENTION_KEYS];
export type UnitPreference = 'metric' | 'us';

export interface LearnPathProgress {
  completedLessons: string[];
  lastVisitedLesson?: string;
  lastVisitedAt?: string;
}

export interface LearnProgressState {
  version: 1;
  paths: Record<string, LearnPathProgress>;
}

export interface SavedRecipeEntry {
  slug: string;
  savedAt: string;
}

export interface SavedRecipesState {
  version: 1;
  items: SavedRecipeEntry[];
}

export interface RecentRecipeEntry {
  slug: string;
  viewedAt: string;
}

export interface RecentRecipesState {
  version: 1;
  items: RecentRecipeEntry[];
}

export interface PreferencesState {
  version: 1;
  units: UnitPreference;
}

const memoryStorage = new Map<RetentionKey, string>();
const CHANGE_EVENT = 'kavovo:retention-changed';
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const emptyLearnProgress = (): LearnProgressState => ({ version: 1, paths: {} });
const emptySavedRecipes = (): SavedRecipesState => ({ version: 1, items: [] });
const emptyRecentRecipes = (): RecentRecipesState => ({ version: 1, items: [] });
const defaultPreferences = (): PreferencesState => ({ version: 1, units: 'metric' });

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && SLUG_PATTERN.test(value);
}

function normaliseTimestamp(value: unknown): string | undefined {
  const time =
    typeof value === 'number' && Number.isFinite(value) && value > 0
      ? value
      : typeof value === 'string'
        ? Date.parse(value)
        : Number.NaN;
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : undefined;
}

function readRaw(key: RetentionKey): string | null {
  if (typeof window !== 'undefined') {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) {
        memoryStorage.set(key, value);
        return value;
      }
    } catch {
      // The in-memory copy keeps controls usable in restricted browsers.
    }
  }
  return memoryStorage.get(key) ?? null;
}

function emitChange(key: RetentionKey): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

function writeRaw(key: RetentionKey, value: unknown): void {
  const serialised = JSON.stringify(value);
  memoryStorage.set(key, serialised);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, serialised);
    } catch {
      // Memory storage remains the active fallback for this page lifecycle.
    }
  }
  emitChange(key);
}

function parseStored<T>(key: RetentionKey, sanitise: (value: unknown) => T, fallback: () => T): T {
  const raw = readRaw(key);
  if (!raw) return fallback();
  try {
    return sanitise(JSON.parse(raw));
  } catch {
    return fallback();
  }
}

export function sanitiseLearnProgress(value: unknown): LearnProgressState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.paths)) {
    return emptyLearnProgress();
  }

  const paths: Record<string, LearnPathProgress> = {};
  for (const [pathSlug, rawPath] of Object.entries(value.paths)) {
    if (!isSlug(pathSlug) || !isRecord(rawPath)) continue;
    const rawCompleted = Array.isArray(rawPath.completedLessons)
      ? rawPath.completedLessons
      : Array.isArray(rawPath.completed)
        ? rawPath.completed
        : [];
    const completedLessons = [...new Set(rawCompleted.filter(isSlug))];
    const legacyVisit = isRecord(rawPath.lastVisited) ? rawPath.lastVisited : undefined;
    const lastVisitedLesson = isSlug(rawPath.lastVisitedLesson)
      ? rawPath.lastVisitedLesson
      : isSlug(legacyVisit?.lessonSlug)
        ? legacyVisit.lessonSlug
        : undefined;
    const lastVisitedAt = normaliseTimestamp(rawPath.lastVisitedAt ?? legacyVisit?.visitedAt);
    paths[pathSlug] = {
      completedLessons,
      ...(lastVisitedLesson && lastVisitedAt ? { lastVisitedLesson, lastVisitedAt } : {}),
    };
  }
  return { version: 1, paths };
}

function sanitiseRecipeEntries(
  value: unknown,
  timestampKey: 'savedAt' | 'viewedAt',
): Array<{ slug: string; savedAt: string } | { slug: string; viewedAt: string }> {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: Array<{ slug: string; savedAt: string } | { slug: string; viewedAt: string }> = [];

  for (const rawEntry of value) {
    if (!isRecord(rawEntry) || !isSlug(rawEntry.slug)) continue;
    const timestamp = normaliseTimestamp(rawEntry[timestampKey]);
    if (!timestamp) continue;
    if (seen.has(rawEntry.slug)) continue;
    seen.add(rawEntry.slug);
    entries.push({ slug: rawEntry.slug, [timestampKey]: timestamp } as
      | { slug: string; savedAt: string }
      | { slug: string; viewedAt: string });
  }
  return entries;
}

export function sanitiseSavedRecipes(value: unknown): SavedRecipesState {
  if (!isRecord(value) || value.version !== 1) return emptySavedRecipes();
  return {
    version: 1,
    items: sanitiseRecipeEntries(value.items ?? value.recipes, 'savedAt') as SavedRecipeEntry[],
  };
}

export function sanitiseRecentRecipes(value: unknown): RecentRecipesState {
  if (!isRecord(value) || value.version !== 1) return emptyRecentRecipes();
  return {
    version: 1,
    items: (sanitiseRecipeEntries(value.items ?? value.recipes, 'viewedAt') as RecentRecipeEntry[]).slice(0, 8),
  };
}

export function sanitisePreferences(value: unknown): PreferencesState {
  if (!isRecord(value) || value.version !== 1) return defaultPreferences();
  return { version: 1, units: value.units === 'us' ? 'us' : 'metric' };
}

export function getLearnProgress(): LearnProgressState {
  return parseStored(RETENTION_KEYS.learnProgress, sanitiseLearnProgress, emptyLearnProgress);
}

export function recordLessonVisit(pathSlug: string, lessonSlug: string, now = Date.now()): void {
  const lastVisitedAt = normaliseTimestamp(now);
  if (!isSlug(pathSlug) || !isSlug(lessonSlug) || !lastVisitedAt) return;
  const state = getLearnProgress();
  const current = state.paths[pathSlug] ?? { completedLessons: [] };
  state.paths[pathSlug] = {
    ...current,
    lastVisitedLesson: lessonSlug,
    lastVisitedAt,
  };
  writeRaw(RETENTION_KEYS.learnProgress, state);
}

export function setLessonCompleted(
  pathSlug: string,
  lessonSlug: string,
  completed: boolean,
  now = Date.now(),
): LearnPathProgress | null {
  const lastVisitedAt = normaliseTimestamp(now);
  if (!isSlug(pathSlug) || !isSlug(lessonSlug) || !lastVisitedAt) return null;
  const state = getLearnProgress();
  const current = state.paths[pathSlug] ?? { completedLessons: [] };
  const completedLessons = new Set(current.completedLessons);
  if (completed) completedLessons.add(lessonSlug);
  else completedLessons.delete(lessonSlug);
  const next: LearnPathProgress = {
    ...current,
    completedLessons: [...completedLessons],
    lastVisitedLesson: lessonSlug,
    lastVisitedAt,
  };
  state.paths[pathSlug] = next;
  writeRaw(RETENTION_KEYS.learnProgress, state);
  return next;
}

export function resetLearnPath(pathSlug: string): void {
  if (!isSlug(pathSlug)) return;
  const state = getLearnProgress();
  delete state.paths[pathSlug];
  writeRaw(RETENTION_KEYS.learnProgress, state);
}

export function getSavedRecipes(): SavedRecipesState {
  return parseStored(RETENTION_KEYS.savedRecipes, sanitiseSavedRecipes, emptySavedRecipes);
}

export function isRecipeSaved(slug: string): boolean {
  return getSavedRecipes().items.some((entry) => entry.slug === slug);
}

export function setRecipeSaved(slug: string, saved: boolean, now = Date.now()): SavedRecipesState {
  const savedAt = normaliseTimestamp(now);
  if (!isSlug(slug) || !savedAt) return getSavedRecipes();
  const state = getSavedRecipes();
  const items = state.items.filter((entry) => entry.slug !== slug);
  if (saved) items.unshift({ slug, savedAt });
  const next: SavedRecipesState = { version: 1, items };
  writeRaw(RETENTION_KEYS.savedRecipes, next);
  return next;
}

export function toggleSavedRecipe(slug: string, now = Date.now()): boolean {
  const nextSaved = !isRecipeSaved(slug);
  setRecipeSaved(slug, nextSaved, now);
  return nextSaved;
}

export function getRecentRecipes(): RecentRecipesState {
  return parseStored(RETENTION_KEYS.recentRecipes, sanitiseRecentRecipes, emptyRecentRecipes);
}

export function recordRecentRecipe(slug: string, now = Date.now()): RecentRecipesState {
  const viewedAt = normaliseTimestamp(now);
  if (!isSlug(slug) || !viewedAt) return getRecentRecipes();
  const current = getRecentRecipes().items.filter((entry) => entry.slug !== slug);
  const next: RecentRecipesState = {
    version: 1,
    items: [{ slug, viewedAt }, ...current].slice(0, 8),
  };
  writeRaw(RETENTION_KEYS.recentRecipes, next);
  return next;
}

export function clearRecentRecipes(): void {
  writeRaw(RETENTION_KEYS.recentRecipes, emptyRecentRecipes());
}

export function getPreferences(): PreferencesState {
  return parseStored(RETENTION_KEYS.preferences, sanitisePreferences, defaultPreferences);
}

export function setUnitPreference(units: UnitPreference): PreferencesState {
  const next: PreferencesState = { version: 1, units };
  writeRaw(RETENTION_KEYS.preferences, next);
  return next;
}

export function subscribeRetentionKey(key: RetentionKey, callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onLocalChange = (event: Event) => {
    if ((event as CustomEvent<{ key?: string }>).detail?.key === key) callback();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener(CHANGE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Test helper: production code should use the public reset/clear functions. */
export function clearRetentionMemory(): void {
  memoryStorage.clear();
}
