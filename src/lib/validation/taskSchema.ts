import { z } from 'zod';

const recurrenceSchema = z
  .object({
    freq: z.enum(['daily', 'weekdays', 'weekly', 'custom']),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    interval: z.coerce.number().int().min(1).optional(),
    endDate: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if ((data.freq === 'weekly' || data.freq === 'custom') && (!data.daysOfWeek || data.daysOfWeek.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysOfWeek'],
        message: 'Pick at least one day of the week.'
      });
    }
  });

export const taskFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Task name is required').max(120, 'Keep it under 120 characters'),
    date: z.string().min(1, 'Date is required'),
    time: z.string().optional(),
    estimatedDuration: z.coerce.number().min(0, 'Cannot be negative').optional().or(z.literal('')),
    priority: z.enum(['low', 'medium', 'high']),
    category: z.string().max(60, 'Keep it under 60 characters').optional(),
    reminderMinutesBefore: z.coerce.number().int().min(0, 'Cannot be negative').optional().or(z.literal('')),
    notes: z.string().max(2000, 'Keep notes under 2000 characters').optional(),
    recurrenceEnabled: z.boolean(),
    recurrence: recurrenceSchema.optional()
  })
  .superRefine((data, ctx) => {
    if (data.recurrenceEnabled && !data.recurrence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrence'],
        message: 'Configure the repeat pattern.'
      });
    }
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;
