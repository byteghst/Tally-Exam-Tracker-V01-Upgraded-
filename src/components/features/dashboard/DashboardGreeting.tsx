import { computeGreetingSummary } from '@/lib/greeting';
import type { Exam, Task } from '@/types';

interface DashboardGreetingProps {
  userName?: string;
  exams: Exam[];
  tasks: Task[];
}

export function DashboardGreeting({ userName, exams, tasks }: DashboardGreetingProps) {
  const { timeGreeting, headline } = computeGreetingSummary({ exams, tasks });

  return (
    <header>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {timeGreeting}
        {userName ? `, ${userName}` : ''}.
      </h1>
      <p className="mt-0.5 text-ink-muted">{headline}</p>
    </header>
  );
}
