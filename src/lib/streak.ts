import type { Task } from '@/types';
import { parseISODate, toISODate } from '@/lib/dates';

/**
 * How many days in a row, ending on `endISO`, had some real progress: at least
 * one completed task scheduled that day, or some study time logged that day.
 *
 * If `endISO` itself has nothing yet (it is early in the day), the streak is
 * counted from the day before, so a streak is not lost just because you have
 * not started today.
 */
export function computeStreak(tasks: Task[], sessions: Array<{ end: number }>, endISO: string): number {
  const productive = new Set<string>();
  for (const task of tasks) {
    if (task.status === 'completed' && task.date) productive.add(task.date);
  }
  for (const session of sessions) {
    productive.add(toISODate(new Date(session.end)));
  }

  const day = parseISODate(endISO);
  if (!productive.has(toISODate(day))) day.setDate(day.getDate() - 1);

  let count = 0;
  while (productive.has(toISODate(day))) {
    count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
