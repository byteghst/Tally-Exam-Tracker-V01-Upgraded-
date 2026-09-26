import type { Exam, Task } from '@/types';
import { toISODate, todayISO } from '@/lib/dates';

export interface MomentumDay {
  iso: string;
  label: string; // single-letter weekday, e.g. 'M'
  productive: boolean;
  isToday: boolean;
}

export interface MomentumResult {
  days: MomentumDay[];
  productiveCount: number;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MomentumInput {
  exams: Exam[];
  tasks: Task[];
}

/**
 * A day counts as "productive" if a task was completed or an exam result was
 * recorded (completed) with its last update on that day — a direct read of
 * real records, no separate streak counter or fabricated points.
 */
function productiveDateSet({ exams, tasks }: MomentumInput): Set<string> {
  const dates = new Set<string>();
  for (const t of tasks) {
    if (t.status === 'completed') dates.add(toISODate(new Date(t.updatedAt)));
  }
  for (const e of exams) {
    if (e.status === 'completed') dates.add(toISODate(new Date(e.updatedAt)));
  }
  return dates;
}

export function computeMomentum(input: MomentumInput, daysBack = 7): MomentumResult {
  const productiveDates = productiveDateSet(input);
  const today = todayISO();
  const days: MomentumDay[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = toISODate(d);
    days.push({
      iso,
      label: WEEKDAY_LETTERS[d.getDay()],
      productive: productiveDates.has(iso),
      isToday: iso === today
    });
  }

  return {
    days,
    productiveCount: days.filter((d) => d.productive).length
  };
}

/** Count of distinct all-time productive days (used for milestones, not the 7-day strip). */
export function countAllTimeProductiveDays(input: MomentumInput): number {
  return productiveDateSet(input).size;
}
