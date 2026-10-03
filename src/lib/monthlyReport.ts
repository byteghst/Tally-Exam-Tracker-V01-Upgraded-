import { calculateScore } from '@/lib/scoring';
import type { Exam, ExamType, Task, TaskPriority } from '@/types';
import type { StudySession, StudySubject } from '@/store/studyStore';

export interface ReportExam {
  id: string;
  name: string;
  date: string; // ISO yyyy-mm-dd
  type: ExamType;
  percentage: number;
  finalScore: number;
  totalMarks: number;
  accuracy: number | null;
}

export interface MonthlyReport {
  year: number;
  /** 0-11 */
  month: number;
  /** "September 2026" */
  label: string;
  /** "August" — the month used for the comparisons */
  prevLabel: string;
  daysInMonth: number;
  exams: {
    /** exams in the month that have a recorded result, oldest first */
    items: ReportExam[];
    count: number;
    average: number | null;
    best: ReportExam | null;
    lowest: ReportExam | null;
    previousAverage: number | null;
    /** average minus previous month's average, in percentage points */
    change: number | null;
    byType: { type: ExamType; count: number; average: number }[];
    /** exams in the month with no result recorded (upcoming or missed) */
    unscored: number;
  };
  tasks: {
    total: number;
    completed: number;
    /** 0-100, null when there are no tasks */
    rate: number | null;
    byPriority: { priority: TaskPriority; total: number; completed: number }[];
  };
  study: {
    totalMs: number;
    sessions: number;
    activeDays: number;
    avgPerActiveDayMs: number | null;
    /** studied time for every calendar day of the month (index 0 = the 1st) */
    perDayMs: number[];
    longestDay: { day: number; ms: number } | null;
    bySubject: { id: string; name: string; color: string; ms: number }[];
    previousTotalMs: number;
  };
  isEmpty: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (year: number, month: number) => `${year}-${pad(month + 1)}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

function scoreExam(e: Exam): ReportExam | null {
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
  if (score.percentage === null) return null;
  return {
    id: e.id,
    name: e.name,
    date: e.date,
    type: e.type,
    percentage: score.percentage,
    finalScore: score.finalScore,
    totalMarks: score.totalMarks,
    accuracy: score.accuracy
  };
}

function averageOf(items: { percentage: number }[]): number | null {
  if (items.length === 0) return null;
  return round1(items.reduce((sum, i) => sum + i.percentage, 0) / items.length);
}

export interface MonthlyReportInput {
  exams: Exam[];
  tasks: Task[];
  sessions: StudySession[];
  subjects: StudySubject[];
  year: number;
  /** 0-11 */
  month: number;
}

export function computeMonthlyReport({ exams, tasks, sessions, subjects, year, month }: MonthlyReportInput): MonthlyReport {
  const key = monthKey(year, month);
  const prev = new Date(year, month - 1, 1);
  const prevKey = monthKey(prev.getFullYear(), prev.getMonth());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDate = new Date(year, month, 1);

  // ---- Exams ----
  const monthExams = exams.filter((e) => e.date.startsWith(key));
  const items = monthExams
    .map(scoreExam)
    .filter((x): x is ReportExam => x !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const average = averageOf(items);
  const previousItems = exams
    .filter((e) => e.date.startsWith(prevKey))
    .map(scoreExam)
    .filter((x): x is ReportExam => x !== null);
  const previousAverage = averageOf(previousItems);
  const best = items.reduce<ReportExam | null>((b, x) => (b === null || x.percentage > b.percentage ? x : b), null);
  const lowest = items.reduce<ReportExam | null>((b, x) => (b === null || x.percentage < b.percentage ? x : b), null);
  const byType = (['daily', 'weekly', 'monthly'] as ExamType[])
    .map((type) => {
      const group = items.filter((i) => i.type === type);
      return { type, count: group.length, average: averageOf(group) ?? 0 };
    })
    .filter((g) => g.count > 0);

  // ---- Tasks ----
  const monthTasks = tasks.filter((t) => t.date?.startsWith(key) && t.status !== 'archived');
  const completed = monthTasks.filter((t) => t.status === 'completed').length;
  const byPriority = (['high', 'medium', 'low'] as TaskPriority[]).map((priority) => {
    const group = monthTasks.filter((t) => t.priority === priority);
    return { priority, total: group.length, completed: group.filter((t) => t.status === 'completed').length };
  });

  // ---- Study ----
  const inMonth = (ms: number, y: number, m: number) => {
    const d = new Date(ms);
    return d.getFullYear() === y && d.getMonth() === m;
  };
  const monthSessions = sessions.filter((s) => inMonth(s.end, year, month));
  const perDayMs = new Array<number>(daysInMonth).fill(0);
  const subjectMs = new Map<string, number>();
  for (const s of monthSessions) {
    perDayMs[new Date(s.end).getDate() - 1] += s.durationMs;
    subjectMs.set(s.subjectId, (subjectMs.get(s.subjectId) ?? 0) + s.durationMs);
  }
  const totalMs = perDayMs.reduce((a, b) => a + b, 0);
  const activeDays = perDayMs.filter((ms) => ms > 0).length;
  let longestDay: { day: number; ms: number } | null = null;
  perDayMs.forEach((ms, i) => {
    if (ms > 0 && (longestDay === null || ms > longestDay.ms)) longestDay = { day: i + 1, ms };
  });
  const bySubject = subjects
    .map((s) => ({ id: s.id, name: s.name, color: s.color, ms: subjectMs.get(s.id) ?? 0 }))
    .filter((s) => s.ms > 0)
    .sort((a, b) => b.ms - a.ms);
  const previousTotalMs = sessions
    .filter((s) => inMonth(s.end, prev.getFullYear(), prev.getMonth()))
    .reduce((sum, s) => sum + s.durationMs, 0);

  return {
    year,
    month,
    label: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    prevLabel: prev.toLocaleDateString('en-US', { month: 'long' }),
    daysInMonth,
    exams: {
      items,
      count: items.length,
      average,
      best,
      lowest,
      previousAverage,
      change: average !== null && previousAverage !== null ? round1(average - previousAverage) : null,
      byType,
      unscored: monthExams.length - items.length
    },
    tasks: {
      total: monthTasks.length,
      completed,
      rate: monthTasks.length > 0 ? Math.round((completed / monthTasks.length) * 100) : null,
      byPriority
    },
    study: {
      totalMs,
      sessions: monthSessions.length,
      activeDays,
      avgPerActiveDayMs: activeDays > 0 ? Math.round(totalMs / activeDays) : null,
      perDayMs,
      longestDay,
      bySubject,
      previousTotalMs
    },
    isEmpty: items.length === 0 && monthTasks.length === 0 && totalMs === 0
  };
}

/** The oldest month that has any data, so the report can't be paged back into emptiness. */
export function earliestReportMonth(exams: Exam[], tasks: Task[], sessions: StudySession[]): { year: number; month: number } {
  const now = new Date();
  let min = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const consider = (d: Date) => {
    const t = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (t < min) min = t;
  };
  for (const e of exams) consider(new Date(e.date + 'T00:00:00'));
  for (const t of tasks) if (t.date) consider(new Date(t.date + 'T00:00:00'));
  for (const s of sessions) consider(new Date(s.end));
  const d = new Date(min);
  return { year: d.getFullYear(), month: d.getMonth() };
}
