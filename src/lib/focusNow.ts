import type { Exam, Task } from '@/types';
import { daysBetween, todayISO } from '@/lib/dates';
import { sortExamsByDateTime } from '@/lib/examSort';

export interface FocusRecommendation {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaPath: string;
}

interface FocusNowInput {
  exams: Exam[];
  tasks: Task[];
}

const EXAM_HORIZON_DAYS = 3;

/**
 * Picks exactly one next action, in a fixed priority order, using only data
 * that already exists in the app. No AI, no fabricated urgency — every
 * branch is a plain, explainable rule over real records.
 */
export function computeFocusNow({ exams, tasks }: FocusNowInput): FocusRecommendation {
  const today = todayISO();

  // 1. An exam within the horizon
  const soonExams = sortExamsByDateTime(
    exams.filter((e) => e.status === 'upcoming' && daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= EXAM_HORIZON_DAYS)
  );
  if (soonExams.length > 0) {
    const e = soonExams[0];
    const days = daysBetween(today, e.date);
    return {
      eyebrow: 'Upcoming exam',
      title: e.name,
      subtitle: days === 0 ? 'Today' : `In ${days} day${days === 1 ? '' : 's'}`,
      ctaLabel: 'Open exam',
      ctaPath: `/exams/${e.id}`
    };
  }

  // 2. Overdue tasks
  const overdueTasks = tasks
    .filter((t) => t.date && t.date < today && t.status !== 'completed' && t.status !== 'archived' && t.status !== 'skipped')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  if (overdueTasks.length > 0) {
    const t = overdueTasks[0];
    return {
      eyebrow: 'Overdue',
      title: t.name,
      subtitle:
        overdueTasks.length > 1
          ? `Overdue, plus ${overdueTasks.length - 1} more task${overdueTasks.length - 1 === 1 ? '' : 's'} waiting`
          : 'Overdue',
      ctaLabel: 'Open tasks',
      ctaPath: '/tasks'
    };
  }

  // 3. Today's remaining tasks
  const todaysTasks = tasks.filter((t) => t.date === today && t.status !== 'completed' && t.status !== 'archived' && t.status !== 'skipped');
  if (todaysTasks.length > 0) {
    const t = todaysTasks[0];
    return {
      eyebrow: 'Today',
      title: t.name,
      subtitle: todaysTasks.length > 1 ? `${todaysTasks.length} tasks remain today` : '1 task remains today',
      ctaLabel: 'Open tasks',
      ctaPath: '/tasks'
    };
  }

  // 4. Any exam further out, so there's always something concrete to point to
  const anyUpcoming = sortExamsByDateTime(exams.filter((e) => e.status === 'upcoming'));
  if (anyUpcoming.length > 0) {
    const e = anyUpcoming[0];
    const days = daysBetween(today, e.date);
    return {
      eyebrow: 'Coming up',
      title: e.name,
      subtitle: `In ${days} day${days === 1 ? '' : 's'}`,
      ctaLabel: 'Open exam',
      ctaPath: `/exams/${e.id}`
    };
  }

  // 5. Clear
  return {
    eyebrow: "You're clear",
    title: 'Nothing urgent right now',
    subtitle: 'Add an exam or task to get started.',
    ctaLabel: 'Add an exam',
    ctaPath: '/exams'
  };
}
