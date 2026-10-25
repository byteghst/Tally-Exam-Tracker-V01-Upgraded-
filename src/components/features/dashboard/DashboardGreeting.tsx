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
    <header className="min-w-0 max-w-full">
      <Rise>
        <p className="eyebrow">{dateLine}</p>
      </Rise>
      <h1 className="mt-4 max-w-full break-words font-serif text-[clamp(2rem,9.5vw,4.75rem)] leading-[1.02] tracking-tight text-ink">
        <SplitWords text={`${timeGreeting}${userName ? `, ${userName}` : ''}.`} />
      </h1>
      <Rise as="p" className="mt-4 max-w-md break-words font-serif text-lg italic leading-snug text-ink-muted sm:mt-5 sm:text-xl">
        {headline}
      </Rise>
    </header>
  );
}
