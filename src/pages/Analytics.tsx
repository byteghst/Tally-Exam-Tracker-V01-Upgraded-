import { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, FileText } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Badge';
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
      <div className="py-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>
        <div className="mt-5">
          <EmptyState
            title="Not enough data yet"
            description="Analytics build up automatically from exams and tasks you record — nothing is estimated."
            icon={BarChart3}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>

      <GlassCard className="flex items-center gap-4 p-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent/[0.12] text-accent">
          <FileText size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">Monthly report</p>
          <p className="text-sm text-ink-muted">Download a detailed breakdown of any month.</p>
        </div>
        <Button size="sm" onClick={() => setReportOpen(true)}>
          Open
        </Button>
      </GlassCard>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Total exams" value={exams.length} />
        <MetricCard label="Average percentage" value={avgPercentage} suffix="%" />
        <MetricCard label="Total tasks" value={tasks.length} />
        <MetricCard label="Task completion" value={taskCompletionRate} suffix="%" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExamScoreTrendChart exams={completedExams} />
        <TaskCompletionTrendChart tasks={tasks} />
      </div>

      {milestones.length > 0 && (
        <GlassCard className="p-5">
          <p className="mb-3 text-sm font-medium text-ink-muted">Milestones</p>
          <ul className="space-y-3">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-start gap-3">
                <Award size={18} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-sm text-ink">{m.label}</p>
                  {m.detail && <p className="text-xs text-ink-faint">{m.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <MonthlyReportSheet open={reportOpen} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function MetricCard({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  const animated = useCountUp(value ?? 0, 700, suffix === '%' ? 1 : 0);
  return (
    <GlassCard className="p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
        {value === null ? '—' : `${animated}${suffix ?? ''}`}
      </p>
    </GlassCard>
  );
}
