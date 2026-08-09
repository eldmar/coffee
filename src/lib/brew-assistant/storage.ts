import type { BrewAttempt, BrewSession, Method } from './types';

const KEY = 'kavovo.brew-sessions.v1';
const SCHEMA_VERSION = 1;

/** Private browsing and blocked storage both throw. Neither should break the assistant. */
function available(): boolean {
  try {
    const probe = '__kavovo_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = () => typeof window !== 'undefined' && available();

/** Anything from an older or unrecognised schema is dropped rather than guessed at. */
export function loadSessions(): BrewSession[] {
  if (!storageAvailable()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (session): session is BrewSession =>
        typeof session === 'object' &&
        session !== null &&
        (session as BrewSession).schemaVersion === SCHEMA_VERSION &&
        Array.isArray((session as BrewSession).attempts),
    );
  } catch {
    return [];
  }
}

function persist(sessions: BrewSession[]): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    // A full quota should not take the wizard down with it.
  }
}

export function newSession(method: Method): BrewSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    method,
    attempts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function saveAttempt(session: BrewSession, attempt: BrewAttempt): BrewSession {
  const updated: BrewSession = {
    ...session,
    attempts: [...session.attempts, attempt],
    updatedAt: new Date().toISOString(),
  };
  const others = loadSessions().filter((s) => s.id !== session.id);
  persist([updated, ...others].slice(0, 20));
  return updated;
}

export function updateSession(session: BrewSession): void {
  const others = loadSessions().filter((s) => s.id !== session.id);
  persist([session, ...others].slice(0, 20));
}

export function clearSession(id: string): void {
  persist(loadSessions().filter((session) => session.id !== id));
}

export function clearAll(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do if removal fails.
  }
}
