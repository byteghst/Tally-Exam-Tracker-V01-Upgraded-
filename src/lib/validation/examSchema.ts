import { z } from 'zod';

/**
 * Validates raw form input (strings from controlled inputs) rather than the
 * final Exam entity — coercion happens here so the form can stay simple
 * controlled inputs bound to strings.
 */
export const examFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Exam name is required').max(120, 'Keep it under 120 characters'),
    type: z.enum(['daily', 'weekly', 'monthly']),
    configId: z.string().optional().or(z.literal('')),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().optional(),
    status: z.enum(['upcoming', 'completed', 'missed']),

    mcqCount: z.coerce.number().int().min(0, 'Cannot be negative'),
    mcqMarksEach: z.coerce.number().min(0, 'Cannot be negative'),
    writtenCount: z.coerce.number().int().min(0, 'Cannot be negative'),
    writtenMarksEach: z.coerce.number().min(0, 'Cannot be negative'),
    negativeMarkPerWrong: z.coerce.number().min(0, 'Cannot be negative'),

    mcqCorrect: z.literal('').or(z.coerce.number().int().min(0, 'Cannot be negative')).optional(),
    mcqWrong: z.literal('').or(z.coerce.number().int().min(0, 'Cannot be negative')).optional(),
    mcqUnanswered: z.literal('').or(z.coerce.number().int().min(0, 'Cannot be negative')).optional(),
    writtenMarksObtained: z.literal('').or(z.coerce.number().min(0, 'Cannot be negative')).optional(),
    manualScoreOverride: z.literal('').or(z.coerce.number()).optional(),
    rank: z.literal('').or(z.coerce.number().int().min(1, 'Rank must be at least 1')).optional(),
    participants: z.literal('').or(z.coerce.number().int().min(1, 'Must be at least 1')).optional(),
    notes: z.string().max(2000, 'Keep notes under 2000 characters').optional(),
    reminderMinutesBefore: z.literal('').or(z.coerce.number().int().min(0, 'Cannot be negative')).optional()
  })
  .superRefine((data, ctx) => {
    const c = toNum(data.mcqCorrect);
    const w = toNum(data.mcqWrong);

    if (c !== undefined || w !== undefined) {
      const sum = (c ?? 0) + (w ?? 0);
      if (sum > data.mcqCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mcqWrong'],
          message: `Correct + wrong (${sum}) exceeds the MCQ count (${data.mcqCount}).`
        });
      }
    }

    const written = toNum(data.writtenMarksObtained);
    const writtenMax = data.writtenCount * data.writtenMarksEach;
    if (written !== undefined && written > writtenMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['writtenMarksObtained'],
        message: `Can't exceed the maximum written marks (${writtenMax}).`
      });
    }

    const rank = toNum(data.rank);
    const participants = toNum(data.participants);
    if (rank !== undefined && participants !== undefined && rank > participants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rank'],
        message: `Rank (${rank}) can't be greater than participants (${participants}).`
      });
    }
  });

export type ExamFormValues = z.infer<typeof examFormSchema>;

function toNum(v: number | '' | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  return v;
}
