import { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Badge';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { ExamScoreTrendChart } from '@/components/features/analytics/ExamScoreTrendChart';
import { TaskCompletionTrendChart } from '@/components/features/analytics/TaskCompletionTrendChart';
import { MonthlyReportSheet } from '@/components/features/analytics/MonthlyReportSheet';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useStudyStore } from '@/store/studyStore';
import { calculateScore } from '@/lib/scoring';
import { computeMilestones } from '@/lib/milestones';
import { useCountUp } from '@/hooks/useCountUp';

export function Analytics() {
  const { exams, hydrate: hydrateExams } = useExamStore();
  const { tasks, hydrate: hydrateTasks } = useTaskStore();
  const studySessions = useStudyStore((s) => s.sessions);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    hydrateExams();
    hydrateTasks();
  }, [hydrateExams, hydrateTasks]);

  const completedExams = exams.filter((e) => e.status === 'completed');

  const avgPercentage = useMemo(() => {
    if (completedExams.length === 0) return null;
    const values = completedExams
      .map(
        (e) =>
          calculateScore({
            mcqCount: e.mcqCount,
            mcqMarksEach: e.mcqMarksEach,
            writtenCount: e.writtenCount,
            writtenMarksEach: e.writtenMarksEach,
            negativeMarkPerWrong: e.negativeMarkPerWrong,
            mcqCorrect: e.mcqCorrect,
            mcqWrong: e.mcqWrong,
            mcqUnanswered: e.mcqUnanswered,
            writtenMarksObtained: e.writtenMarksObtained,
            manualScore: e.manualScoreOverride
          }).percentage
      )
      .filter((p): p is number => p !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }, [completedExams]);

  const taskCompletionRate =
    tasks.length > 0
      ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100)
      : null;

  const milestones = useMemo(() => computeMilestones({ exams, tasks }), [exams, tasks]);

  if (completedExams.length === 0 && tasks.length === 0 && studySessions.length === 0) {
    return (
      <Stagger className="space-y-8 py-8">
        <Rise as="header">
          <p className="eyebrow">Insights</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Analytics</h1>
        </Rise>
        <Rise>
          <EmptyState
            title="Not enough data yet"
            description="Analytics build up automatically from exams and tasks you record. Nothing is estimated."
            icon={BarChart3}
          />
        </Rise>
      </Stagger>
    );
  }

  return (
    <Stagger className="space-y-10 py-8">
      <Rise as="header">
        <p className="eyebrow">Insights</p>
        <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Analytics</h1>
      </Rise>

      <Rise className="flex items-center gap-4 border-y border-border py-4">
        <FileText size={22} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Monthly report</p>
          <p className="text-sm text-ink-muted">Download a detailed breakdown of any month.</p>
        </div>
        <Button size="sm" onClick={() => setReportOpen(true)}>
          Open
        </Button>
      </Rise>

      <Rise className="grid grid-cols-2 gap-px border-y border-border bg-border md:grid-cols-4">
        <Metric label="Total exams" value={exams.length} />
        <Metric label="Average" value={avgPercentage} suffix="%" />
        <Metric label="Total tasks" value={tasks.length} />
        <Metric label="Task completion" value={taskCompletionRate} suffix="%" />
      </Rise>

      <Rise className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ExamScoreTrendChart exams={completedExams} />
        <TaskCompletionTrendChart tasks={tasks} />
      </Rise>

      {milestones.length > 0 && (
        <Section label="Milestones">
          <ul className="divide-y divide-border">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-start gap-3 py-3">
                <Award size={18} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-base text-ink">{m.label}</p>
                  {m.detail && <p className="text-sm text-ink-muted">{m.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <MonthlyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </Stagger>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  const animated = useCountUp(value ?? 0, 900, suffix === '%' ? 1 : 0);
  return (
    <div className="bg-surface px-4 py-5 first:pl-0 md:first:pl-0">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-serif text-5xl leading-none tracking-tight text-ink">
        {value === null ? '—' : `${animated}${suffix ?? ''}`}
      </p>
    </div>
  );
}
