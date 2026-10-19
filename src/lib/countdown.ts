import { parseISODate } from '@/lib/dates';

/**
 * The moment (ms since epoch, local time) that something dated `dateISO` at
 * `time` (HH:mm) happens.
 *
 * With no time given, `whenNoTime` decides: 'start' = the first moment of that
 * day, 'end' = the last moment of it (a deadline with no time is due by the
 * end of the day).
 */
export function targetTime(dateISO: string, time?: string, whenNoTime: 'start' | 'end' = 'start'): number {
  const d = parseISODate(dateISO);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      d.setHours(h, m, 0, 0);
      return d.getTime();
    }
  }
  if (whenNoTime === 'end') d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export interface Remaining {
  /** true once the target moment has passed; the numbers then count time since. */
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Splits the gap between `now` and `target` into days, hours, minutes and seconds. */
export function remainingParts(target: number, now: number): Remaining {
  const diff = target - now;
  const total = Math.floor(Math.abs(diff) / 1000);
  return {
    past: diff <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Short text for a gap: "2d 04h 11m" (a day or more), "3h 05m 09s" (under a
 * day) or "11m 09s" (under an hour). Seconds only appear once they matter.
 */
export function formatCompact(r: Remaining): string {
  if (r.days > 0) return `${r.days}d ${pad(r.hours)}h ${pad(r.minutes)}m`;
  if (r.hours > 0) return `${r.hours}h ${pad(r.minutes)}m ${pad(r.seconds)}s`;
  return `${r.minutes}m ${pad(r.seconds)}s`;
}
