import type { Exam, Task } from '@/types';
import { calculateScore } from '@/lib/scoring';
import { countAllTimeProductiveDays } from '@/lib/momentum';

export interface Milestone {
  id: string;
  label: string;
  detail?: string;
}

interface MilestonesInput {
  exams: Exam[];
  tasks: Task[];
}

export function computeMilestones({ exams, tasks }: MilestonesInput): Milestone[] {
  const milestones: Milestone[] = [];

  // --- Exam count milestones ---
  if (exams.length >= 1) milestones.push({ id: 'first-exam', label: 'First exam recorded' });
  if (exams.length >= 10) milestones.push({ id: 'exams-10', label: '10 exams recorded' });
  if (exams.length >= 25) milestones.push({ id: 'exams-25', label: '25 exams recorded' });

  // --- Task completion milestones ---
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  if (completedTasks >= 1) milestones.push({ id: 'first-task', label: 'First task completed' });
  if (completedTasks >= 10) milestones.push({ id: 'tasks-10', label: '10 tasks completed' });

  // --- Productive-day milestones ---
  const productiveDays = countAllTimeProductiveDays({ exams, tasks });
  if (productiveDays >= 7) milestones.push({ id: 'days-7', label: '7 productive days' });
  if (productiveDays >= 30) milestones.push({ id: 'days-30', label: '30 productive days' });

  // --- Score/rank records (completed exams only) ---
  const completedExams = exams.filter((e) => e.status === 'completed');
  const withPercentage = completedExams
    .map((e) => ({
      exam: e,
      percentage: calculateScore({
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
    }))
    .filter((x): x is { exam: Exam; percentage: number } => x.percentage !== null);

  if (withPercentage.length > 0) {
    const best = withPercentage.reduce((a, b) => (b.percentage > a.percentage ? b : a));
    milestones.push({ id: 'highest-score', label: 'Highest score', detail: `${best.percentage}% — ${best.exam.name}` });
  }

  const withRank = completedExams.filter((e) => e.rank !== undefined);
  if (withRank.length > 0) {
    const best = withRank.reduce((a, b) => (b.rank! < a.rank! ? b : a));
    milestones.push({
      id: 'best-rank',
      label: 'Best rank',
      detail: `${best.rank}${best.participants ? ` / ${best.participants}` : ''} — ${best.name}`
    });
  }

  // biggest score improvement between consecutive same-type exams
  let biggestJump = 0;
  let biggestJumpExam: Exam | undefined;
  for (const type of ['daily', 'weekly', 'monthly'] as const) {
    const ofType = withPercentage
      .filter((x) => x.exam.type === type)
      .sort((a, b) => a.exam.date.localeCompare(b.exam.date));
    for (let i = 1; i < ofType.length; i++) {
      const diff = ofType[i].percentage - ofType[i - 1].percentage;
      if (diff > biggestJump) {
        biggestJump = diff;
        biggestJumpExam = ofType[i].exam;
      }
    }
  }
  if (biggestJumpExam) {
    milestones.push({
      id: 'biggest-jump',
      label: 'Biggest score improvement',
      detail: `+${Math.round(biggestJump * 10) / 10}% — ${biggestJumpExam.name}`
    });
  }

  return milestones;
}
