import type { RecurrenceRule } from '@/types';

/** Returns today's date as a local yyyy-mm-dd string (never UTC-shifted). */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses a yyyy-mm-dd string as a local date (avoids the classic UTC-midnight-shift bug). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function isPast(iso: string): boolean {
  return parseISODate(iso).getTime() < parseISODate(todayISO()).getTime();
}

export function isFuture(iso: string): boolean {
  return parseISODate(iso).getTime() > parseISODate(todayISO()).getTime();
}

export function daysBetween(fromISO: string, toISO: string): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const a = parseISODate(fromISO).getTime();
  const b = parseISODate(toISO).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/** Human countdown, e.g. "in 3 days", "today", "5 days overdue". */
export function describeCountdown(dateISO: string): string {
  const diff = daysBetween(todayISO(), dateISO);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return '1 day overdue';
  return `${Math.abs(diff)} days overdue`;
}

export function formatDate(iso: string, format: string = 'MMM d, yyyy'): string {
  const d = parseISODate(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  if (format === 'dd/MM/yyyy') {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  if (format === 'MM/dd/yyyy') {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Builds a full-week-aligned grid of ISO dates for a given month (including
 * the leading/trailing days from adjacent months needed to fill whole weeks),
 * respecting the given first day of week (0 = Sunday, 1 = Monday).
 */
export function getMonthGrid(year: number, month: number, firstDayOfWeek: 0 | 1 = 0): string[] {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() - firstDayOfWeek + 7) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const lastOfMonth = new Date(year, month + 1, 0);
  const endOffset = (firstDayOfWeek + 6 - lastOfMonth.getDay() + 7) % 7;
  const totalDays =
    startOffset + lastOfMonth.getDate() + endOffset;

  const days: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(toISODate(d));
  }
  return days;
}

/**
 * Expands a recurrence rule into concrete ISO dates within [fromISO, toISO] (inclusive).
 * Used to generate task instances on the fly rather than pre-materializing years of rows.
 */
export function expandRecurrence(
  rule: RecurrenceRule,
  anchorISO: string,
  fromISO: string,
  toISO: string
): string[] {
  const anchor = parseISODate(anchorISO);
  const from = parseISODate(fromISO);
  const to = parseISODate(toISO);
  const end = rule.endDate ? parseISODate(rule.endDate) : to;
  const hardEnd = end < to ? end : to;
  const interval = rule.interval && rule.interval > 0 ? rule.interval : 1;

  const dates: string[] = [];
  const cursor = new Date(Math.max(anchor.getTime(), from.getTime()));

  // align cursor to a valid day-of-week set for weekly/custom before iterating
  let guard = 0;
  while (cursor.getTime() <= hardEnd.getTime() && guard < 3660) {
    guard++;
    const dow = cursor.getDay();
    const matches =
      rule.freq === 'daily' ||
      (rule.freq === 'weekdays' && dow !== 0 && dow !== 6) ||
      ((rule.freq === 'weekly' || rule.freq === 'custom') &&
        (rule.daysOfWeek ?? [anchor.getDay()]).includes(dow));

    if (matches) {
      const iso = toISODate(cursor);
      if (parseISODate(iso) >= from) dates.push(iso);
    }
    cursor.setDate(cursor.getDate() + (rule.freq === 'weekly' || rule.freq === 'custom' ? 1 : interval));
  }

  return dates;
}
