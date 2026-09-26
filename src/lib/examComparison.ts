import { calculateScore } from '@/lib/scoring';
import type { Exam } from '@/types';

export interface ExamComparison {
  previousExam?: Exam;
  previousPercentage: number | null;
  currentPercentage: number | null;
  percentageDiff: number | null;
  rankDiff: number | null;
}

function scoreOf(exam: Exam) {
  return calculateScore({
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
}

/**
 * Compares a completed exam to the most recent earlier completed exam of the
 * same type (daily/weekly/monthly) — and, when both used the same config,
 * that's an apples-to-apples comparison; otherwise it's still a fair
 * same-cadence comparison via percentage.
 */
export function compareToPrevious(exam: Exam, allExams: Exam[]): ExamComparison {
  const priorOfType = allExams
    .filter((e) => e.id !== exam.id && e.type === exam.type && e.status === 'completed' && e.date < exam.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const previousExam = priorOfType[0];
  const currentPercentage = scoreOf(exam).percentage;

  if (!previousExam) {
    return { previousExam: undefined, previousPercentage: null, currentPercentage, percentageDiff: null, rankDiff: null };
  }

  const previousPercentage = scoreOf(previousExam).percentage;
  const percentageDiff =
    currentPercentage !== null && previousPercentage !== null
      ? Math.round((currentPercentage - previousPercentage) * 10) / 10
      : null;

  const rankDiff =
    exam.rank !== undefined && previousExam.rank !== undefined ? previousExam.rank - exam.rank : null;

  return { previousExam, previousPercentage, currentPercentage, percentageDiff, rankDiff };
}
