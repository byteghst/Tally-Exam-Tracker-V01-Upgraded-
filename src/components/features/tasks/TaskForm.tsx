import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { taskFormSchema, type TaskFormValues } from '@/lib/validation/taskSchema';
import { useTaskStore } from '@/store/taskStore';
import { useUIStore } from '@/store/uiStore';
import { todayISO } from '@/lib/dates';
import type { Task, TaskPriority, RecurrenceFreq } from '@/types';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  task?: Task;
}

type FieldErrors = Record<string, string | undefined>;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toFormState(task?: Task) {
  return {
    name: task?.name ?? '',
    date: task?.date ?? todayISO(),
    time: task?.time ?? '',
    estimatedDuration: task?.estimatedDuration?.toString() ?? '',
    priority: task?.priority ?? ('medium' as TaskPriority),
    category: task?.category ?? '',
    reminderMinutesBefore: task?.reminderMinutesBefore?.toString() ?? '',
    notes: task?.notes ?? '',
    recurrenceEnabled: !!task?.recurrence,
    recurrenceFreq: task?.recurrence?.freq ?? ('daily' as RecurrenceFreq),
    recurrenceDays: task?.recurrence?.daysOfWeek ?? ([] as number[]),
    recurrenceEndDate: task?.recurrence?.endDate ?? ''
  };
}

export function TaskForm({ open, onClose, task }: TaskFormProps) {
  const { addTask, updateTask } = useTaskStore();
  const { pushToast } = useUIStore();
  const isEdit = !!task;

  const [form, setForm] = useState(() => toFormState(task));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastId, setLastId] = useState(task?.id);

  if (task?.id !== lastId || (!task && lastId)) {
    setLastId(task?.id);
    setForm(toFormState(task));
    setErrors({});
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(day)
        ? f.recurrenceDays.filter((d) => d !== day)
        : [...f.recurrenceDays, day].sort()
    }));
  }

  async function handleSubmit() {
    const toValidate: TaskFormValues = {
      name: form.name,
      date: form.date,
      time: form.time,
      estimatedDuration: form.estimatedDuration === '' ? '' : Number(form.estimatedDuration),
      priority: form.priority,
      category: form.category,
      reminderMinutesBefore: form.reminderMinutesBefore === '' ? '' : Number(form.reminderMinutesBefore),
      notes: form.notes,
      recurrenceEnabled: form.recurrenceEnabled,
      recurrence: form.recurrenceEnabled
        ? {
            freq: form.recurrenceFreq,
            daysOfWeek: form.recurrenceDays,
            endDate: form.recurrenceEndDate || undefined
          }
        : undefined
    };

    const result = taskFormSchema.safeParse(toValidate);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const v = result.data;

    const payload = {
      name: v.name.trim(),
      date: v.date,
      time: v.time || undefined,
      estimatedDuration: v.estimatedDuration === '' ? undefined : v.estimatedDuration,
      priority: v.priority,
      category: v.category?.trim() || undefined,
      reminderMinutesBefore: v.reminderMinutesBefore === '' ? undefined : v.reminderMinutesBefore,
      notes: v.notes?.trim() || undefined,
      status: task?.status ?? ('todo' as const),
      recurrence: v.recurrenceEnabled ? v.recurrence : undefined,
      seriesId: task?.seriesId
    };

    try {
      if (isEdit && task) {
        await updateTask(task.id, payload);
        pushToast('Task updated');
      } else {
        await addTask(payload);
        pushToast(v.recurrenceEnabled ? 'Recurring task added' : 'Task added');
      }
      onClose();
    } catch {
      pushToast('Something went wrong saving this task. Please try again.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'Add task'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isEdit ? 'Save changes' : 'Add task'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Task name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="e.g. Revise Chapter 4 problems"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            error={errors.date}
          />
          <Input
            label="Time (optional)"
            type="time"
            value={form.time}
            onChange={(e) => set('time', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Estimated duration (min)"
            type="number"
            inputMode="numeric"
            value={form.estimatedDuration}
            onChange={(e) => set('estimatedDuration', e.target.value)}
            error={errors.estimatedDuration}
          />
          <Input
            label="Reminder (min before)"
            type="number"
            inputMode="numeric"
            value={form.reminderMinutesBefore}
            onChange={(e) => set('reminderMinutesBefore', e.target.value)}
            error={errors.reminderMinutesBefore}
          />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink-muted">Priority</legend>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('priority', p)}
                aria-pressed={form.priority === p}
                className={`flex-1 rounded-control border px-3 py-2 text-sm font-medium capitalize ${
                  form.priority === p ? 'border-accent bg-accent/15 text-accent' : 'border-border text-ink-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <Input
          label="Category (optional)"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
          error={errors.category}
        />

        <div className="space-y-3 rounded-control border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={form.recurrenceEnabled}
              onChange={(e) => set('recurrenceEnabled', e.target.checked)}
              className="h-4 w-4 rounded accent-accent"
            />
            Repeat this task
          </label>

          {form.recurrenceEnabled && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['daily', 'weekdays', 'weekly', 'custom'] as RecurrenceFreq[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set('recurrenceFreq', f)}
                    aria-pressed={form.recurrenceFreq === f}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${
                      form.recurrenceFreq === f ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {(form.recurrenceFreq === 'weekly' || form.recurrenceFreq === 'custom') && (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(i)}
                        aria-pressed={form.recurrenceDays.includes(i)}
                        className={`h-9 w-11 rounded-control text-xs font-medium ${
                          form.recurrenceDays.includes(i) ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {errors['recurrence.daysOfWeek'] && (
                    <p className="mt-1 text-sm text-danger">{errors['recurrence.daysOfWeek']}</p>
                  )}
                </div>
              )}

              <Input
                label="Ends on (optional)"
                type="date"
                value={form.recurrenceEndDate}
                onChange={(e) => set('recurrenceEndDate', e.target.value)}
              />
              <p className="text-xs text-ink-faint">
                Upcoming instances are generated automatically up to 60 days ahead.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-muted">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full rounded-control border border-border bg-surface p-3 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.notes && <p className="text-sm text-danger">{errors.notes}</p>}
        </div>
      </div>
    </Sheet>
  );
}
