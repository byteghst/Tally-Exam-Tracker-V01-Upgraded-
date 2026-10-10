import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Section } from '@/components/motion/Reveal';
import { AnimatedCheck, StrikeText } from '@/components/motion/Check';
import type { MissionItem } from '@/lib/dailyMission';

const ITEM_PATH: Record<string, string> = {
  tasks: '/tasks',
  'record-results': '/exams'
};

export function DailyMission({ items, onDismiss }: { items: MissionItem[]; onDismiss: () => void }) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  return (
    <Section
      label="Today's mission"
      aside={
        <div className="flex items-center gap-2">
          <span className="font-numeric text-sm tabular-nums text-ink-muted">
            {doneCount} / {items.length}
          </span>
          <button
            onClick={onDismiss}
            aria-label="Dismiss today's mission"
            className="-mr-1 rounded-control p-1 text-ink-faint hover:bg-ink/5 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <Link to={ITEM_PATH[item.id] ?? '/dashboard'} className="flex items-center gap-3 py-3">
              <AnimatedCheck checked={item.done} size={22} />
              <StrikeText done={item.done} className="text-base">
                {item.label}
              </StrikeText>
            </Link>
          </li>
        ))}
      </ul>
      {allDone && <p className="mt-3 font-serif text-xl italic text-success">Mission complete.</p>}
    </Section>
  );
}
