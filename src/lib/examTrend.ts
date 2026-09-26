import { calculateScore } from '@/lib/scoring';
import { parseISODate } from '@/lib/dates';
import type { Exam } from '@/types';

export interface ExamTrendPoint {
  date: string; // ISO
  label: string; // "9/16" short form for chart ticks
  percentage: number;
  name: string;
}

/**
 * Every completed exam with a resolvable percentage, sorted chronologically.
 * Both the on-page chart and the shareable card call this exact function, so
 * a "highest score" or "latest score" claim on the card can never disagree
 * with what the Dashboard/Analytics page itself shows.
 */
export function computeExamTrendPoints(exams: Exam[]): ExamTrendPoint[] {
  return exams
    .map((e) => {
      const score = calculateScore({
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
      });
      return score.percentage === null
        ? null
        : {
            date: e.date,
            label: `${parseISODate(e.date).getMonth() + 1}/${parseISODate(e.date).getDate()}`,
            percentage: score.percentage,
            name: e.name
          };
    })
    .filter((p): p is ExamTrendPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
