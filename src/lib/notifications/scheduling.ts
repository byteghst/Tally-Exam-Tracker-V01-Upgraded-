import type { Exam, Task } from '@/types';
import { parseISODate } from '@/lib/dates';

export type ReminderKind = 'exam' | 'task';

export interface ReminderItem {
  /** Composite id, e.g. "exam-<uuid>" — stable per entity. */
  id: string;
  kind: ReminderKind;
  entityId: string;
  title: string;
  body: string;
  fireAt: Date;
  targetAt: Date;
}

const DEFAULT_HOUR = 9;

function combineDateAndTime(dateISO: string, time: string | undefined): Date {
  const d = parseISODate(dateISO);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(DEFAULT_HOUR, 0, 0, 0);
  }
  return d;
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}m`;
}

/** Builds the full list of reminders that have a fire time in the future. */
export function getFutureReminders(exams: Exam[], tasks: Task[], now: Date = new Date()): ReminderItem[] {
  const items: ReminderItem[] = [];

  for (const e of exams) {
    if (!e.reminderMinutesBefore || e.status !== 'upcoming') continue;
    const targetAt = combineDateAndTime(e.date, e.startTime);
    const fireAt = new Date(targetAt.getTime() - e.reminderMinutesBefore * 60_000);
    if (fireAt.getTime() <= now.getTime()) continue;
    items.push({
      id: `exam-${e.id}`,
      kind: 'exam',
      entityId: e.id,
      title: e.name,
      body: `Exam in ${minutesLabel(e.reminderMinutesBefore)}`,
      fireAt,
      targetAt
    });
  }

  for (const t of tasks) {
    if (!t.reminderMinutesBefore || !t.date || t.status === 'completed' || t.status === 'archived' || t.status === 'skipped')
      continue;
    const targetAt = combineDateAndTime(t.date, t.time);
    const fireAt = new Date(targetAt.getTime() - t.reminderMinutesBefore * 60_000);
    if (fireAt.getTime() <= now.getTime()) continue;
    items.push({
      id: `task-${t.id}`,
      kind: 'task',
      entityId: t.id,
      title: t.name,
      body: `Task in ${minutesLabel(t.reminderMinutesBefore)}`,
      fireAt,
      targetAt
    });
  }

  return items.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/**
 * Reminders whose fire time has already passed (within a grace window) and
 * that haven't already been shown. Used by the web checker, which can only
 * act while the app is actually open.
 */
export function getDueReminders(
  exams: Exam[],
  tasks: Task[],
  alreadyNotifiedIds: string[],
  now: Date = new Date(),
  graceMinutes = 30
): ReminderItem[] {
  const notified = new Set(alreadyNotifiedIds);
  const graceMs = graceMinutes * 60_000;
  return getAllReminders(exams, tasks).filter((item) => {
    if (notified.has(item.id)) return false;
    const diff = now.getTime() - item.fireAt.getTime();
    return diff >= 0 && diff <= graceMs;
  });
}

function getAllReminders(exams: Exam[], tasks: Task[]): ReminderItem[] {
  return getFutureReminders(exams, tasks, new Date(0));
}
