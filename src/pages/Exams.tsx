import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileSpreadsheet } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge, EmptyState } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ExamForm } from '@/components/features/exams/ExamForm';
import { useExamStore } from '@/store/examStore';
import { useOpenAddFromNavState } from '@/hooks/useOpenAddFromNavState';
import { calculateScore } from '@/lib/scoring';
import { formatDate } from '@/lib/dates';
import { sortExamsByDateTime } from '@/lib/examSort';
import type { ExamType } from '@/types';

const FILTERS: Array<{ label: string; value: ExamType | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
];

/** /exams/daily, /exams/weekly, /exams/monthly pre-select the matching filter
 *  and lock the type when adding a new exam from that view; /exams shows everything. */
function filterFromPath(pathname: string): ExamType | 'all' {
  if (pathname.endsWith('/daily')) return 'daily';
  if (pathname.endsWith('/weekly')) return 'weekly';
  if (pathname.endsWith('/monthly')) return 'monthly';
  return 'all';
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
  const addDefaultType: ExamType = filter === 'all' ? 'daily' : filter;

  return (
    <div className="space-y-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Exams</h1>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          Add exam
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filter === f.value ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No exams yet"
          description="Your exam history will appear here once you add your first exam."
          icon={FileSpreadsheet}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              Add your first exam
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            return (
              <Link key={exam.id} to={`/exams/${exam.id}`}>
                <GlassCard interactive className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-ink">{exam.name}</p>
                      <p className="text-sm text-ink-muted">{formatDate(exam.date)}</p>
                    </div>
                    <Badge tone={exam.type === 'daily' ? 'accent' : 'neutral'}>{exam.type}</Badge>
                  </div>
                  {exam.status === 'completed' && (
                    <p className="mt-3 font-display text-lg font-semibold tabular-nums">
                      {score.finalScore} / {score.totalMarks}
                      {score.isManualOverride && <span className="ml-1 text-xs text-ink-faint">(manual)</span>}
                    </p>
                  )}
                  {exam.status !== 'completed' && (
                    <Badge tone={exam.status === 'missed' ? 'danger' : 'neutral'} className="mt-3">
                      {exam.status}
                    </Badge>
                  )}
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}

      <ExamForm open={formOpen} onClose={() => setFormOpen(false)} defaultType={addDefaultType} />
    </div>
  );
}
