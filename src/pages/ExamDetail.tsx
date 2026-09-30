import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExamForm } from '@/components/features/exams/ExamForm';
import { useExamStore } from '@/store/examStore';
import { useUIStore } from '@/store/uiStore';
import { useCountUp } from '@/hooks/useCountUp';
import { calculateScore } from '@/lib/scoring';
import { compareToPrevious } from '@/lib/examComparison';
import { formatDate } from '@/lib/dates';

export function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exams, hydrate, deleteExam, duplicateExam } = useExamStore();
  const { pushToast } = useUIStore();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (exams.length === 0) hydrate();
  }, [exams.length, hydrate]);

  const exam = exams.find((e) => e.id === id);

  if (!exam) {
    return (
      <div className="py-6">
        <p className="text-ink-muted">Exam not found.</p>
        <Link to="/exams" className="text-accent">
          Back to Exams
        </Link>
      </div>
    );
  }

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

  const comparison = exam.status === 'completed' ? compareToPrevious(exam, exams) : undefined;

  async function handleDuplicate() {
    await duplicateExam(exam!.id);
    pushToast('Exam duplicated');
    navigate('/exams');
  }

  async function handleDelete() {
    // deleteExam already shows its own "Deleted" toast
    await deleteExam(exam!.id);
    navigate('/exams');
  }

  return (
    <div className="space-y-5 py-6">
      <Link to="/exams" className="text-sm text-ink-muted">
        ← Back to Exams
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{exam.name}</h1>
          <p className="text-sm text-ink-muted">{formatDate(exam.date)}</p>
        </div>
        <Badge tone={exam.type === 'daily' ? 'accent' : 'neutral'}>{exam.type}</Badge>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditOpen(true)}>
          Edit
        </Button>
        <Button size="sm" variant="secondary" onClick={handleDuplicate}>
          Duplicate
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleteConfirmOpen(true)}>
          Delete
        </Button>
      </div>

      {comparison?.previousExam && comparison.percentageDiff !== null && (
        <GlassCard className="flex flex-wrap gap-6 p-5">
          <ComparisonStat
            label="Score vs. previous"
            diff={comparison.percentageDiff}
            unit="%"
            detail={`${comparison.previousPercentage}% → ${comparison.currentPercentage}%`}
          />
        </GlassCard>
      )}

      <GlassCard className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Final score" value={score.finalScore} decimals={1} />
        <Stat label="Out of" raw={`${score.totalMarks}`} />
        <Stat label="Percentage" value={score.percentage} suffix="%" decimals={1} />
        <Stat label="Accuracy" value={score.accuracy} suffix="%" decimals={1} />
        <Stat label="Correct" value={exam.mcqCorrect ?? null} />
        <Stat label="Wrong" value={exam.mcqWrong ?? null} />
        <Stat label="Attempt rate" value={score.attemptRate} suffix="%" decimals={1} />
      </GlassCard>

      <GlassCard className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="MCQ score" raw={`${score.mcqScore} / ${exam.mcqCount * exam.mcqMarksEach}`} />
        <Stat
          label="Written score"
          raw={`${score.writtenScore} / ${exam.writtenCount * exam.writtenMarksEach}`}
        />
        <Stat label="Unanswered" value={exam.mcqUnanswered ?? null} />
        <Stat label="Negative / wrong" raw={`${exam.negativeMarkPerWrong}`} />
      </GlassCard>

      {score.isManualOverride && (
        <p className="text-sm text-ink-faint">
          Final score was manually overridden (calculated value was {score.calculatedScore}).
        </p>
      )}

      {exam.notes && (
        <GlassCard className="p-5">
          <p className="text-sm font-medium text-ink-muted">Notes</p>
          <p className="mt-1 text-ink">{exam.notes}</p>
        </GlassCard>
      )}

      <ExamForm open={editOpen} onClose={() => setEditOpen(false)} exam={exam} />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete this exam?"
        description={`"${exam.name}" and its recorded result will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

function ComparisonStat({
  label,
  diff,
  unit,
  detail
}: {
  label: string;
  diff: number;
  unit: string;
  detail: string;
}) {
  const improved = diff > 0;
  const flat = diff === 0;
  const Icon = improved ? TrendingUp : TrendingDown;
  const tone = flat ? 'text-ink-muted' : improved ? 'text-success' : 'text-danger';

  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <div className={`mt-1 flex items-center gap-1.5 font-display text-lg font-semibold tabular-nums ${tone}`}>
        {!flat && <Icon size={18} />}
        <span>
          {flat ? 'No change' : `${improved ? '+' : ''}${diff}${unit}`}
        </span>
      </div>
      <p className="text-xs text-ink-faint">{detail}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  decimals = 0,
  raw
}: {
  label: string;
  value?: number | null;
  suffix?: string;
  decimals?: number;
  raw?: string;
}) {
  const animated = useCountUp(value ?? 0, 500, decimals);
  const display = raw !== undefined ? raw : value === null || value === undefined ? '—' : `${animated}${suffix ?? ''}`;
  return (
    <div>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-ink">{display}</p>
    </div>
  );
}
