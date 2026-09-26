import { z } from 'zod';

const typeRowSchema = z.object({
  enabled: z.boolean(),
  mcqCount: z.coerce.number().int().min(0, 'Cannot be negative'),
  mcqMarksEach: z.coerce.number().min(0, 'Cannot be negative'),
  writtenCount: z.coerce.number().int().min(0, 'Cannot be negative'),
  writtenMarksEach: z.coerce.number().min(0, 'Cannot be negative')
});

export const examConfigFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120, 'Keep it under 120 characters'),
    negativeMarkPerWrong: z.coerce.number().min(0, 'Cannot be negative'),
    daily: typeRowSchema,
    weekly: typeRowSchema,
    monthly: typeRowSchema
  })
  .superRefine((data, ctx) => {
    if (!data.daily.enabled && !data.weekly.enabled && !data.monthly.enabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daily', 'enabled'],
        message: 'Enable at least one exam type (daily, weekly, or monthly).'
      });
    }
  });

export type ExamConfigFormValues = z.infer<typeof examConfigFormSchema>;
