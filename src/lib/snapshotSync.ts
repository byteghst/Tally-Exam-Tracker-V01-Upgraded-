import { useAuthStore } from '@/store/authStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useDeadlineStore, type Deadline } from '@/store/deadlineStore';
import { readSnapshot, writeSnapshot, type SnapshotKey } from '@/lib/offlineCache';
import type { Exam, ExamConfig, Task } from '@/types';

/**
 * Puts the last saved copy of each list back into its store, so the first
 * screen already has data without waiting for (or having) a connection. A
 * store that has already loaded from the account is left alone.
 */
export function restoreSnapshots(userId: string): void {
  const exams = readSnapshot<Exam>(userId, 'exams');
  if (exams && !useExamStore.getState().loaded) useExamStore.setState({ exams, loaded: true });

  const tasks = readSnapshot<Task>(userId, 'tasks');
  if (tasks && !useTaskStore.getState().loaded) useTaskStore.setState({ tasks, loaded: true });

  const configs = readSnapshot<ExamConfig>(userId, 'configs');
  if (configs && !useExamConfigStore.getState().loaded) useExamConfigStore.setState({ configs, loaded: true });

  const deadlines = readSnapshot<Deadline>(userId, 'deadlines');
  if (deadlines && !useDeadlineStore.getState().loaded) useDeadlineStore.setState({ deadlines, loaded: true });
}

let started = false;

/**
 * Keeps the on-device copy up to date: whenever a list changes after it has
 * been loaded, the new list is saved (debounced). Also empties the in-memory
 * lists on sign-out so the next account never sees the previous one's data.
 */
export function startSnapshotPersistence(): void {
  if (started) return;
  started = true;

  const timers: Partial<Record<SnapshotKey, number>> = {};
  const save = (key: SnapshotKey, read: () => unknown[]): void => {
    window.clearTimeout(timers[key]);
    timers[key] = window.setTimeout(() => {
      const userId = useAuthStore.getState().user?.id;
      if (userId) writeSnapshot(userId, key, read());
    }, 400);
  };

  // Only a successfully loaded list is saved, so a failed read can never
  // overwrite the copy with an empty one.
  useExamStore.subscribe((s, prev) => {
    if (s.loaded && s.exams !== prev.exams) save('exams', () => useExamStore.getState().exams);
  });
  useTaskStore.subscribe((s, prev) => {
    if (s.loaded && s.tasks !== prev.tasks) save('tasks', () => useTaskStore.getState().tasks);
  });
  useExamConfigStore.subscribe((s, prev) => {
    if (s.loaded && s.configs !== prev.configs) save('configs', () => useExamConfigStore.getState().configs);
  });
  useDeadlineStore.subscribe((s, prev) => {
    if (s.loaded && s.deadlines !== prev.deadlines) save('deadlines', () => useDeadlineStore.getState().deadlines);
  });

  useAuthStore.subscribe((s, prev) => {
    if (prev.user && !s.user) {
      useExamStore.setState({ exams: [], loaded: false });
      useTaskStore.setState({ tasks: [], loaded: false });
      useExamConfigStore.setState({ configs: [], loaded: false });
      useDeadlineStore.setState({ deadlines: [], loaded: false });
    }
  });
}
