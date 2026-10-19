import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiveCountdown } from '@/components/ui/LiveCountdown';
import { Rise, Stagger } from '@/components/motion/Reveal';
import { ExamForm } from '@/components/features/exams/ExamForm';
import { useExamStore } from '@/store/examStore';
import { useOpenAddFromNavState } from '@/hooks/useOpenAddFromNavState';
import { calculateScore } from '@/lib/scoring';
import { describeCountdown, formatDate, isPast, parseISODate } from '@/lib/dates';
import { targetTime } from '@/lib/countdown';
import { formatTime12 } from '@/lib/deadlineFormat';
import { sortExamsByDateTime } from '@/lib/examSort';
import { spring } from '@/lib/motion';
import type { Exam, ExamType } from '@/types';

const FILTERS: Array<{ label: string; value: ExamType | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
];

// One colour per exam type, used for the small dot on each row.
const TYPE_DOT: Record<ExamType, string> = {
  daily: 'bg-accent',
  weekly: 'bg-saffron',
  monthly: 'bg-forest'
};

/** /exams/daily, /exams/weekly, /exams/monthly pre-select the matching filter
 *  and lock the type when adding a new exam from that view; /exams shows everything. */
function filterFromPath(pathname: string): ExamType | 'all' {
  if (pathname.endsWith('/daily')) return 'daily';
  if (pathname.endsWith('/weekly')) return 'weekly';
  if (pathname.endsWith('/monthly')) return 'monthly';
  return 'all';
}

/** The exam coming up next, with a live clock to its start time. */
function NextExamBanner({ exam }: { exam: Exam }) {
  const target = exam.startTime ? targetTime(exam.date, exam.startTime) : null;
  return (
    <Rise>
      <Link to={`/exams/${exam.id}`} className="block">
        <GlassCard interactive className="p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Next exam</p>
            <p className="eyebrow">{exam.type}</p>
          </div>
          <p className="mt-2 truncate font-serif text-3xl leading-tight tracking-tight text-ink">{exam.name}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(exam.date)}
            {exam.startTime ? ` \u00b7 ${formatTime12(exam.startTime)}` : ''}
          </p>
          {target !== null ? (
            <LiveCountdown target={target} variant="block" pastLabel="Started" pastSuffix=" ago" className="mt-4" />
          ) : (
            <p className="mt-4 font-serif text-3xl leading-none text-ink">{describeCountdown(exam.date)}</p>
          )}
        </GlassCard>
      </Link>
    </Rise>
  );
}

export function Exams() {
  const { exams, hydrate } = useExamStore();
  const location = useLocation();
  const [filter, setFilter] = useState<ExamType | 'all'>(() => filterFromPath(location.pathname));
  const [formOpen, setFormOpen] = useState(false);

  useOpenAddFromNavState(() => setFormOpen(true));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setFilter(filterFromPath(location.pathname));
  }, [location.pathname]);

  const filtered = sortExamsByDateTime(filter === 'all' ? exams : exams.filter((e) => e.type === filter));
  const nextExam = sortExamsByDateTime(exams.filter((e) => e.status === 'upcoming' && !isPast(e.date)))[0];
  const addDefaultType: ExamType = filter === 'all' ? 'daily' : filter;
  const countOf = (value: ExamType | 'all') => (value === 'all' ? exams.length : exams.filter((e) => e.type === value).length);

  return (
    <Stagger className="space-y-8 py-8" stagger={0.05}>
      <Rise as="header" className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Records</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Exams</h1>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Add exam
        </Button>
      </Rise>

      {nextExam && <NextExamBanner exam={nextExam} />}

      <Rise className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={clsx(
                'relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200',
                active ? 'text-accent-on' : 'bg-ink/[0.05] text-ink-muted hover:text-ink'
              )}
            >
              {active && (
                <motion.span
                  layoutId="exam-filter"
                  transition={spring}
                  className="absolute inset-0 rounded-full bg-accent"
                />
              )}
              <span className="relative">
                {f.label}
                <span className="ml-1.5 font-numeric text-xs tabular-nums opacity-70">{countOf(f.value)}</span>
              </span>
            </button>
          );
        })}
      </Rise>

      {filtered.length === 0 ? (
        <Rise>
          <p className="font-serif text-5xl leading-none tracking-tight text-ink">No exams yet.</p>
          <p className="mt-3 max-w-xs text-ink-muted">Your exam history will appear here once you add your first exam.</p>
          <Button className="mt-5" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add your first exam
          </Button>
        </Rise>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((exam) => {
            const score = calculateScore({
              mcqCount: exam.mcqCount,
              mcqMarksEach: exam.mcqMarksEach,
              writtenCount: exam.writtenCount,
              writtenMarksEach: exam.writtenMarksEach,
              negativeMarkPerWrong: exam.negativeMarkPerWrong,
              mcqCorrect: exam.mcqCorrect,
              mcqWrong: exam.mcqWrong,
              mcqUnanswered: exam.mcqUnanswered,
              writtenMarksObtained: exam.writtenMarksObtained,
              manualScore: exam.manualScoreOverride
            });
            const date = parseISODate(exam.date);
            const completed = exam.status === 'completed';
            return (
              <Rise as="li" key={exam.id}>
                <Link
                  to={`/exams/${exam.id}`}
                  className="group flex items-center gap-4 rounded-card bg-surface-raised px-4 py-3.5 shadow-soft transition-shadow duration-200 hover:shadow-raise"
                >
                  <div className="w-12 shrink-0 text-center">
                    <p className="font-serif text-3xl leading-none text-ink">{date.getDate()}</p>
                    <p className="eyebrow mt-1">{date.toLocaleDateString(undefined, { month: 'short' })}</p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-ink">{exam.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs capitalize text-ink-muted">
                      <span className={clsx('h-2 w-2 rounded-full', TYPE_DOT[exam.type])} />
                      {exam.type}
                      {!completed && ` \u00b7 ${exam.status}`}
                      {exam.startTime && ` \u00b7 ${formatTime12(exam.startTime)}`}
                    </p>
                    {exam.status === 'upcoming' && exam.startTime && (
                      <p className="mt-1 text-xs font-semibold text-accent">
                        <LiveCountdown
                          target={targetTime(exam.date, exam.startTime)}
                          futureSuffix=" to go"
                          pastPrefix="Started"
                          pastSuffix=" ago"
                        />
                      </p>
                    )}
                  </div>

                  {completed && (
                    <div className="text-right">
                      <p className="font-serif text-3xl leading-none tracking-tight text-ink">
                        {score.percentage !== null ? `${Math.round(score.percentage)}%` : '\u2014'}
                      </p>
                      <p className="mt-1 font-numeric text-xs tabular-nums text-ink-muted">
                        {score.finalScore} / {score.totalMarks}
                        {score.isManualOverride && ' (manual)'}
                      </p>
                    </div>
                  )}

                  <ChevronRight
                    size={18}
                    className="shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-1"
                  />
                </Link>
              </Rise>
            );
          })}
        </ul>
      )}

      <ExamForm open={formOpen} onClose={() => setFormOpen(false)} defaultType={addDefaultType} />
    </Stagger>
  );
}
