import type { Exam } from '@/types';

/**
 * Default display order for the Exams list: earliest date first, and for
 * two exams on the same date, the one with the earlier start time first.
 * Exams with no start time set are treated as "all-day" and sort before
 * timed exams on the same date (same convention most calendar apps use).
 */
export function sortExamsByDateTime(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const at = a.startTime ?? '';
    const bt = b.startTime ?? '';
    if (at === bt) return 0;
    if (at === '') return -1;
    if (bt === '') return 1;
    return at.localeCompare(bt);
  });
}
