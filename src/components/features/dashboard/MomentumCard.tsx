import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Section } from '@/components/motion/Reveal';
import { pop } from '@/lib/motion';
import { computeMomentum } from '@/lib/momentum';
import type { Exam, Task } from '@/types';

export function MomentumCard({ exams, tasks }: { exams: Exam[]; tasks: Task[] }) {
  const { days, productiveCount } = computeMomentum({ exams, tasks }, 7);

  return (
    <Section
      label="7-day momentum"
      aside={
        <p className="font-numeric text-sm tabular-nums text-ink-muted">
          {productiveCount} productive day{productiveCount === 1 ? '' : 's'}
        </p>
      }
    >
      <div className="flex justify-between gap-1.5">
        {days.map((d, i) => (
          <div key={d.iso} className="flex flex-1 flex-col items-center gap-2.5">
            <span className={`eyebrow ${d.isToday ? '!text-accent' : ''}`}>{d.label}</span>
            <motion.div
              variants={pop}
              custom={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                d.productive
                  ? 'border-ink bg-ink text-surface'
                  : d.isToday
                    ? 'border-accent text-ink-faint'
                    : 'border-border text-ink-faint'
              }`}
            >
              {d.productive ? <Check size={15} strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-current" />}
            </motion.div>
          </div>
        ))}
      </div>
    </Section>
  );
}
