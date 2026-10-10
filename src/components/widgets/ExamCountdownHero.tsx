import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Rise, Rule } from '@/components/motion/Reveal';
import { maskUp } from '@/lib/motion';
import { useCountUp } from '@/hooks/useCountUp';
import { daysBetween, todayISO, formatDate } from '@/lib/dates';
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
        <p className="eyebrow">Next exam</p>
        <Rule strong className="mt-3" />
        <p className="mt-6 font-serif text-5xl leading-none tracking-tight text-ink">Nothing ahead.</p>
        <p className="mt-3 max-w-xs text-ink-muted">Exams you add will show up here with a live countdown.</p>
        <Button size="sm" variant="secondary" className="mt-5" onClick={onAddExam}>
          Add exam
        </Button>
      </Rise>
    );
  }

  const hasScore = exam.mcqCorrect !== undefined || exam.manualScoreOverride !== undefined;

  return (
    <Rise>
      {/* className="block" on the Link is load-bearing: <Link> renders an <a>,
          which is display:inline by default, and an inline element ignores
          its own margin-top. */}
      <Link to={`/exams/${exam.id}`} className="group block">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Next exam</p>
          <p className="eyebrow">{exam.type}</p>
        </div>
        <Rule strong className="mt-3" />

        <div className="mt-5 overflow-hidden pb-2">
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

        <p className="mt-5 font-serif text-3xl italic leading-tight text-ink">{exam.name}</p>
        <p className="mt-1 text-sm text-ink-muted">{formatDate(exam.date)}</p>

        {hasScore && <p className="mt-3 text-xs text-ink-faint">A result is already recorded for this exam.</p>}

        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent">
          Open exam
          <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1.5" />
        </span>
      </Link>
    </Rise>
  );
}
