import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { computeFocusNow } from '@/lib/focusNow';
import type { Exam, Task } from '@/types';

interface FocusNowCardProps {
  exams: Exam[];
  tasks: Task[];
}

export function FocusNowCard({ exams, tasks }: FocusNowCardProps) {
  const rec = computeFocusNow({ exams, tasks });

  return (
    <GlassCard className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{rec.eyebrow}</p>
      <p className="mt-1 font-display text-lg font-semibold text-ink">{rec.title}</p>
      <p className="text-sm text-ink-muted">{rec.subtitle}</p>
      <Link
        to={rec.ctaPath}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        {rec.ctaLabel}
        <ArrowRight size={16} />
      </Link>
    </GlassCard>
  );
}
