import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Rise, Rule, Section, Stagger } from '@/components/motion/Reveal';
import { ExamForm } from '@/components/features/exams/ExamForm';
import { useExamStore } from '@/store/examStore';
import { useUIStore } from '@/store/uiStore';
import { useCountUp } from '@/hooks/useCountUp';
import { calculateScore } from '@/lib/scoring';
import { compareToPrevious } from '@/lib/examComparison';
import { formatDate } from '@/lib/dates';

/** Goes back one step in history, or to the exam list if the page was opened directly. */
function useGoBack() {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/exams');
  };
}

function BackButton() {
  const goBack = useGoBack();
  return (
    <Button variant="secondary" size="sm" onClick={goBack}>
      <ArrowLeft size={16} /> Back
    </Button>
  );
}

const fmt = (n: number | null | undefined, suffix = '') =>
  n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}${suffix}`;

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
      <div className="space-y-6 py-8">
        <BackButton />
        <p className="font-serif text-4xl leading-none tracking-tight text-ink">Exam not found.</p>
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

  const rows: Array<[string, string]> = [
    ['Final score', `${fmt(score.finalScore)} / ${score.totalMarks}`],
    ['Accuracy', fmt(score.accuracy, '%')],
    ['Attempt rate', fmt(score.attemptRate, '%')],
    ['Correct', fmt(exam.mcqCorrect)],
    ['Wrong', fmt(exam.mcqWrong)],
    ['Unanswered', fmt(exam.mcqUnanswered)],
    ['MCQ score', `${score.mcqScore} / ${exam.mcqCount * exam.mcqMarksEach}`],
    ['Written score', `${score.writtenScore} / ${exam.writtenCount * exam.writtenMarksEach}`],
    ['Negative / wrong', `${exam.negativeMarkPerWrong}`]
  ];

  return (
    <Stagger className="space-y-10 py-8">
      <Rise>
        <BackButton />
      </Rise>

      <Rise as="header">
        <p className="eyebrow">
          {exam.type} exam · {formatDate(exam.date)}
        </p>
        <h1 className="mt-3 font-serif text-[clamp(2.75rem,12vw,4.5rem)] leading-[0.95] tracking-tight text-ink">
          {exam.name}
        </h1>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDuplicate}>
            Duplicate
          </Button>
          <Button size="sm" variant="secondary" className="text-danger" onClick={() => setDeleteConfirmOpen(true)}>
            Delete
          </Button>
        </div>
      </Rise>

      <Rise>
        <ScoreHero percentage={score.percentage} finalScore={score.finalScore} totalMarks={score.totalMarks} />

        {comparison?.previousExam && comparison.percentageDiff !== null && (
          <Comparison
            diff={comparison.percentageDiff}
            detail={`${comparison.previousPercentage}% → ${comparison.currentPercentage}%`}
          />
        )}

        {score.isManualOverride && (
          <p className="mt-3 text-sm text-ink-faint">
            Final score was manually overridden (calculated value was {score.calculatedScore}).
          </p>
        )}
      </Rise>

      <Section label="Breakdown">
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-numeric text-lg font-medium tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {exam.notes && (
        <Section label="Notes">
          <p className="whitespace-pre-line font-serif text-xl italic leading-snug text-ink">{exam.notes}</p>
        </Section>
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
    </Stagger>
  );
}

function ScoreHero({
  percentage,
  finalScore,
  totalMarks
}: {
  percentage: number | null;
  finalScore: number;
  totalMarks: number;
}) {
  const animated = useCountUp(percentage ?? 0, 1300, 1);

  return (
    <div>
      <p className="eyebrow">Result</p>
      <Rule strong className="mt-3" />
      {percentage === null ? (
        <p className="mt-6 font-serif text-5xl leading-none tracking-tight text-ink">No result yet.</p>
      ) : (
        <>
          <p className="mt-5 font-serif text-[clamp(5.5rem,30vw,9rem)] leading-[0.85] tracking-tight text-ink">
            {animated}
            <span className="text-[0.45em] text-ink-faint">%</span>
          </p>
          <p className="mt-3 font-numeric text-base tabular-nums text-ink-muted">
            {Math.round(finalScore * 10) / 10} of {totalMarks} marks
          </p>
        </>
      )}
    </div>
  );
}

function Comparison({ diff, detail }: { diff: number; detail: string }) {
  const improved = diff > 0;
  const flat = diff === 0;
  const Icon = improved ? TrendingUp : TrendingDown;
  const tone = flat ? 'text-ink-muted' : improved ? 'text-forest' : 'text-danger';

  return (
    <div className={`mt-5 flex items-center gap-2 border-t border-border pt-4 ${tone}`}>
      {!flat && <Icon size={20} />}
      <span className="font-numeric text-lg font-semibold tabular-nums">
        {flat ? 'No change' : `${improved ? '+' : ''}${diff}%`}
      </span>
      <span className="text-sm text-ink-muted">vs. previous · {detail}</span>
    </div>
  );
}
