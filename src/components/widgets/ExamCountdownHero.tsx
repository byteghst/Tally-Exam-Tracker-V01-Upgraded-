import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, EmptyState } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCountUp } from '@/hooks/useCountUp';
import { daysBetween, todayISO, formatDate } from '@/lib/dates';
import type { Exam } from '@/types';

interface ExamCountdownHeroProps {
  exam?: Exam;
  onAddExam: () => void;
}

export function ExamCountdownHero({ exam, onAddExam }: ExamCountdownHeroProps) {
  const days = exam ? Math.max(daysBetween(todayISO(), exam.date), 0) : 0;
  const animatedDays = useCountUp(days, 700);

  if (!exam) {
    return (
      <GlassCard className="p-5">
        <p className="text-sm font-medium text-ink-muted">Next exam</p>
        <EmptyState
          title="No upcoming exams"
          description="Exams you add will show up here."
          icon={CalendarClock}
          action={
            <Button size="sm" variant="secondary" onClick={onAddExam}>
              Add exam
            </Button>
          }
        />
      </GlassCard>
    );
  }

  const hasScore = exam.mcqCorrect !== undefined || exam.manualScoreOverride !== undefined;

  return (
    <Link to={`/exams/${exam.id}`}>
      {/* Plain glass card, same weight as Momentum/Today's tasks — no
          accent ring or glow. That ring used to sit right at the top edge
          and visually fused with the card above it despite normal spacing;
          this card doesn't need special emphasis now that it's always shown. */}
      <GlassCard interactive className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Next exam</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-ink">{exam.name}</p>
          </div>
          <Badge tone={exam.type === 'daily' ? 'accent' : 'neutral'}>{exam.type}</Badge>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-5xl font-bold tabular-nums text-accent">
            {animatedDays}
          </span>
          <span className="text-sm font-medium uppercase tracking-wide text-ink-muted">
            {days === 0 ? 'today' : days === 1 ? 'day' : 'days'}
          </span>
        </div>
        <p className="text-xs text-ink-faint">{formatDate(exam.date)}</p>

        {hasScore && (
          <p className="mt-3 text-xs text-ink-faint">A result is already recorded for this exam.</p>
        )}

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          Open exam <ArrowRight size={16} />
        </span>
      </GlassCard>
    </Link>
  );
}
