import type { Subtask, Task, TaskStatus } from '@/types';

/** A fresh, unfinished subtask. */
export function newSubtask(name: string): Subtask {
  return { id: crypto.randomUUID(), name: name.trim(), done: false };
}

export interface SubtaskProgress {
  done: number;
  total: number;
  /** 0 to 100 */
  percent: number;
}

/** Progress through a task's subtasks, or null when the task has none. */
export function subtaskProgress(task: Pick<Task, 'subtasks'>): SubtaskProgress | null {
  const list = task.subtasks ?? [];
  if (list.length === 0) return null;
  const done = list.filter((s) => s.done).length;
  return { done, total: list.length, percent: Math.round((done / list.length) * 100) };
}

/**
 * A task that has subtasks is complete exactly when every subtask is done.
 * If a subtask is added or un-ticked on a completed task, it goes back to
 * "todo". Tasks without subtasks keep whatever status they had.
 */
export function statusFromSubtasks(subtasks: Subtask[], current: TaskStatus): TaskStatus {
  if (subtasks.length === 0) return current;
  if (subtasks.every((s) => s.done)) return 'completed';
  return current === 'completed' ? 'todo' : current;
}
