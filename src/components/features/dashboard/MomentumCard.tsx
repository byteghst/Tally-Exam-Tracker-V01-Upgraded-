import { Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { computeMomentum } from '@/lib/momentum';
import type { Exam, Task } from '@/types';

export function MomentumCard({ exams, tasks }: { exams: Exam[]; tasks: Task[] }) {
  const { days, productiveCount } = computeMomentum({ exams, tasks }, 7);

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">7-day momentum</p>
        <p className="text-sm font-semibold tabular-nums text-ink">
          {productiveCount} productive day{productiveCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className="mt-4 flex justify-between gap-1.5">
        {days.map((d) => (
          <div key={d.iso} className="flex flex-1 flex-col items-center gap-1.5">
            <span className={`text-xs ${d.isToday ? 'font-semibold text-accent' : 'text-ink-faint'}`}>{d.label}</span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-300 ${
                d.productive
                  ? 'border-accent bg-accent/15 text-accent'
                  : d.isToday
                    ? 'border-accent/40 text-ink-faint'
                    : 'border-border text-ink-faint'
              }`}
            >
              {d.productive ? <Check size={14} /> : <span className="h-1 w-1 rounded-full bg-current" />}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
