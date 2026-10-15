import type { Task } from '@/types';
import { parseISODate, toISODate, todayISO } from '@/lib/dates';
import { computeStreak } from '@/lib/streak';
import type { TaskCardData, TaskCardDay } from '@/lib/shareCard/drawTaskCard';

export type TaskCardRange = 'today' | 'yesterday' | 'week';

interface BuildInput {
  range: TaskCardRange;
  /** Every task, not just one day's. */
  tasks: Task[];
  /** Finished study sessions. */
  sessions: Array<{ end: number; durationMs: number }>;
  /** A running timer: when it started (ms) and how long it has run (ms), or null. */
  active: { startedAt: number; elapsedMs: number } | null;
  name?: string;
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Gathers everything the card shows for the chosen range. */
export function buildTaskCardData({ range, tasks, sessions, active, name }: BuildInput): TaskCardData {
  const today = todayISO();
  let start = today;
  let end = today;
  if (range === 'yesterday') {
    start = addDays(today, -1);
    end = start;
  } else if (range === 'week') {
    start = addDays(today, -6);
  }

  const fromMs = parseISODate(start).getTime();
  const toMs = parseISODate(addDays(end, 1)).getTime();

  let studyMs = sessions.filter((s) => s.end >= fromMs && s.end < toMs).reduce((sum, s) => sum + s.durationMs, 0);
  if (active && active.startedAt >= fromMs && active.startedAt < toMs) studyMs += active.elapsedMs;

  const inRange = tasks.filter((t) => t.date && t.date >= start && t.date <= end);

  let days: TaskCardDay[] | undefined;
  if (range === 'week') {
    days = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDays(start, i);
      const ofDay = inRange.filter((t) => t.date === iso);
      days.push({ iso, total: ofDay.length, done: ofDay.filter((t) => t.status === 'completed').length });
    }
  }

  return {
    kind: range === 'week' ? 'week' : 'day',
    dateISO: start,
    endISO: end,
    dayLabel: range === 'yesterday' ? 'Yesterday' : 'Today',
    name,
    tasks: inRange,
    studyMs,
    streak: computeStreak(tasks, sessions, end),
    days
  };
}
