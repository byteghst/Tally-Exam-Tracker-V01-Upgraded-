/**
 * On-device copy of the account's lists (exams, tasks, configs, deadlines), so
 * the app can open and show the last known data with no connection.
 *
 * The account database stays the source of truth: every successful read
 * overwrites this copy. It is keyed by user id and wiped on sign-out. Study
 * data and settings already keep their own device copy (see studyStore and
 * settingsStore), so they are not part of this.
 */
export type SnapshotKey = 'exams' | 'tasks' | 'configs' | 'deadlines';

const PREFIX = 'tally-offline-v1:';

function storageKey(userId: string, key: SnapshotKey): string {
  return `${PREFIX}${userId}:${key}`;
}

export function readSnapshot<T>(userId: string, key: SnapshotKey): T[] | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function writeSnapshot(userId: string, key: SnapshotKey, items: unknown[]): void {
  try {
    localStorage.setItem(storageKey(userId, key), JSON.stringify(items));
  } catch {
    /* storage full or unavailable: the account copy still works */
  }
}

/** Removes every saved list copy (all accounts) from this device. */
export function clearSnapshots(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
