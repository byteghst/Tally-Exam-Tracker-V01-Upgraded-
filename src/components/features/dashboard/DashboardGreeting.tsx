import { computeGreetingSummary } from '@/lib/greeting';
import { Rise, SplitWords } from '@/components/motion/Reveal';
import type { Exam, Task } from '@/types';

interface DashboardGreetingProps {
  userName?: string;
  exams: Exam[];
  tasks: Task[];
}

export function DashboardGreeting({ userName, exams, tasks }: DashboardGreetingProps) {
  const { timeGreeting, headline } = computeGreetingSummary({ exams, tasks });
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <header>
      <Rise>
        <p className="eyebrow">{dateLine}</p>
      </Rise>
      <h1 className="mt-4 font-serif text-[clamp(2.7rem,12vw,4.75rem)] leading-[0.95] tracking-tight text-ink">
        <SplitWords text={`${timeGreeting}${userName ? `, ${userName}` : ''}.`} />
      </h1>
      <Rise as="p" className="mt-5 max-w-md font-serif text-xl italic leading-snug text-ink-muted">
        {headline}
      </Rise>
    </header>
  );
}
