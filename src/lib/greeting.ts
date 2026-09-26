import type { Exam, Task } from '@/types';
import { todayISO } from '@/lib/dates';

export interface GreetingSummary {
  timeGreeting: string; // "Good morning" / "Good afternoon" / "Good evening"
  headline: string;
}

interface GreetingInput {
  exams: Exam[];
  tasks: Task[];
  hour?: number; // injectable for tests; defaults to current local hour
}

export function computeGreetingSummary({ exams, tasks, hour }: GreetingInput): GreetingSummary {
  const h = hour ?? new Date().getHours();
  const timeGreeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  const today = todayISO();
  const hasAnyDataEver = exams.length > 0 || tasks.length > 0;

  if (!hasAnyDataEver) {
    return { timeGreeting, headline: "Let's get your first exam or task in." };
  }

  const todaysTasks = tasks.filter((t) => t.date === today);
  const todaysIncompleteTasks = todaysTasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'archived' && t.status !== 'skipped'
  );
  const examsToday = exams.filter((e) => e.status === 'upcoming' && e.date === today);
  const overdueTasks = tasks.filter(
    (t) => t.date && t.date < today && t.status !== 'completed' && t.status !== 'archived' && t.status !== 'skipped'
  );

  const importantCount = todaysIncompleteTasks.length + examsToday.length + overdueTasks.length;

  if (importantCount > 0) {
    return {
      timeGreeting,
      headline: `You have ${importantCount} important thing${importantCount === 1 ? '' : 's'} today.`
    };
  }

  if (todaysTasks.length > 0) {
    return { timeGreeting, headline: 'Everything is done for today.' };
  }

  return { timeGreeting, headline: 'Nothing urgent today.' };
}
