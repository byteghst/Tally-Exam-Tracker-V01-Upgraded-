import type { ScoreInput, ScoreResult } from '@/types';

/**
 * Deterministic, side-effect-free scoring calculation for the MCQ + written
 * exam model. Every exam-related screen must go through this function
 * rather than computing marks inline in a component.
 */
export function calculateScore(input: ScoreInput): ScoreResult {
  const mcqCorrect = safeNumber(input.mcqCorrect);
  const mcqWrong = safeNumber(input.mcqWrong);
  const writtenMarksObtained = safeNumber(input.writtenMarksObtained);

  const totalMarks = round(input.mcqCount * input.mcqMarksEach + input.writtenCount * input.writtenMarksEach);

  const mcqScore = round(mcqCorrect * input.mcqMarksEach - mcqWrong * input.negativeMarkPerWrong);
  const writtenScore = round(writtenMarksObtained);
  const calculatedScore = round(mcqScore + writtenScore);

  const hasManualOverride =
    input.manualScore !== undefined && input.manualScore !== null && !Number.isNaN(input.manualScore);
  const finalScore = hasManualOverride ? (input.manualScore as number) : calculatedScore;

  const percentage = totalMarks > 0 ? round(clamp((finalScore / totalMarks) * 100, -100, 100)) : null;

  const attempted = mcqCorrect + mcqWrong;
  const accuracy = attempted > 0 ? round((mcqCorrect / attempted) * 100) : null;
  const attemptRate = input.mcqCount > 0 ? round((attempted / input.mcqCount) * 100) : null;

  return {
    totalMarks,
    mcqScore,
    writtenScore,
    calculatedScore,
    finalScore,
    isManualOverride: hasManualOverride,
    percentage,
    accuracy,
    attemptRate
  };
}

/** Validates that correct + wrong + unanswered doesn't exceed the MCQ count. */
export function validateMcqCounts(
  correct?: number,
  wrong?: number,
  unanswered?: number,
  mcqCount?: number
): string | null {
  if (!mcqCount) return null;
  const sum = safeNumber(correct) + safeNumber(wrong) + safeNumber(unanswered);
  if (sum > mcqCount) {
    return `Correct + wrong + unanswered (${sum}) exceeds the MCQ count (${mcqCount}).`;
  }
  return null;
}

function safeNumber(n: number | undefined): number {
  if (n === undefined || n === null || Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return n;
}

function round(n: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(n * factor) / factor;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
