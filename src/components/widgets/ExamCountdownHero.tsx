import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiveCountdown } from '@/components/ui/LiveCountdown';
import { Rise } from '@/components/motion/Reveal';
import { maskUp } from '@/lib/motion';
import { useCountUp } from '@/hooks/useCountUp';
import { daysBetween, todayISO, formatDate } from '@/lib/dates';
import { targetTime } from '@/lib/countdown';
import { formatTime12 } from '@/lib/deadlineFormat';
import type { Exam } from '@/types';

interface ExamCountdownHeroProps {
  exam?: Exam;
  onAddExam: () => void;
}

export function ExamCountdownHero({ exam, onAddExam }: ExamCountdownHeroProps) {
  const days = exam ? Math.max(daysBetween(todayISO(), exam.date), 0) : 0;
  const animatedDays = useCountUp(days, 1400);

  if (!exam) {
    return (
      <Rise>
        <GlassCard className="p-5">
          <p className="eyebrow">Next exam</p>
          <p className="mt-5 font-serif text-5xl leading-none tracking-tight text-ink">Nothing ahead.</p>
          <p className="mt-3 max-w-xs text-ink-muted">Exams you add will show up here with a live countdown.</p>
          <Button size="sm" variant="secondary" className="mt-5" onClick={onAddExam}>
            Add exam
          </Button>
        </GlassCard>
      </Rise>
    );
  }

  const hasScore = exam.mcqCorrect !== undefined || exam.manualScoreOverride !== undefined;

  return (
    <Rise>
      <GlassCard className="p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Next exam</p>
          <span className="rounded-full bg-ink/[0.06] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {exam.type}
          </span>
        </div>

        <div className="mt-4 overflow-hidden pb-2">
          <motion.p
            variants={maskUp}
            className="font-serif text-[clamp(6.5rem,38vw,11rem)] leading-[0.82] tracking-tight text-ink"
          >
            {animatedDays}
          </motion.p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {days === 0 && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
          <p className="eyebrow !text-ink-muted">{days === 0 ? 'Today' : days === 1 ? 'Day to go' : 'Days to go'}</p>
        </div>

        {/* Live clock to the exact start time, when the exam has one. */}
        {exam.startTime && (
          <LiveCountdown
            target={targetTime(exam.date, exam.startTime)}
            variant="block"
            pastLabel="Started"
            pastSuffix=" ago"
            className="mt-5"
          />
        )}

        <p className="mt-5 font-serif text-3xl italic leading-tight text-ink">{exam.name}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDate(exam.date)}
          {exam.startTime ? ` · ${formatTime12(exam.startTime)}` : ''}
        </p>

        {hasScore && <p className="mt-3 text-xs text-ink-faint">A result is already recorded for this exam.</p>}

        {/* A real button: solid accent fill, full width, easy to hit with a thumb. */}
        <Link
          to={`/exams/${exam.id}`}
          className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-accent text-base font-semibold text-accent-on transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98] active:brightness-95"
        >
          Open exam
          <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </GlassCard>
    </Rise>
  );
}
